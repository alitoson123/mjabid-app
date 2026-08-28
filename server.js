// ================= server.js — نقطة الدخول: تشغيل الخادم، الاتصالات، والتوجيه =================
// GameServer (Durable Object): غرفة لعب واحدة — يستقبل اتصالات WebSocket/الاستطلاع،
// يحفظ حالة الغرفة، ويُشغّل حلقة Alarm للجدولة. لا يحتوي قواعد لعبة ولا قرارات بوت
// ولا اتصال Firebase مباشر — كلها مفوّضة للوحدات المستوردة أدناه.
// المسؤول الرئيسي (export default بالأسفل): يوجّه كل طلب HTTP/WebSocket لغرفته
// الصحيحة عبر Durable Object، ويشغّل مهمة جوائز الأسبوع المجدولة (Cron).
import { DurableObject } from "cloudflare:workers";
import {
  meta, setup, validateAction, applyAction, isGameOver, viewFor,
  shuffle, isBotLike, PRESENCE_GRACE_MS, POLL_WAIT_MS, TURN_MS, resolveTier,
  forfeitResult, FORFEIT_GRACE_MS, // NEW CODE — نتيجة انسحاب فريق كامل (2ضد2) + مهلة الانسحاب بعد انقطاع تلقائي
} from './gameLogic.js';
import {
  BOT_NAMES, randomBotAvatar, armBotMoveTiming, armBotBidTiming, decideBotAction, pickBotBidCard,
} from './botLogic.js';
import {
  getFirebaseAccessToken, getFirebaseProjectId, verifyFirebaseIdToken,
  firestorePatch, fsVal, adjustPlayerGold, adjustPlayerRank, distributeWeeklyPrizes,
  getTierOverrides, claimDailyReward, claimAdReward, atomicIncrementField, atomicMaxField, // FIX — أضفنا claimAdReward (إعلان المكافأة)
  publishRoomStatus, removeRoomStatus, claimGlobalGift, incrementWeeklyPoints, // FIX — أضفنا incrementWeeklyPoints
  getMiniProfile, // NEW CODE — نافذة الملف الشخصي المصغّرة أثناء اللعب
  mintCustomToken, storeAppLoginToken, takeAppLoginToken, // NEW CODE — دخول التطبيق بجوجل عبر المتصفح (browser-relay)
} from './db.js';

// علامة نسخة صريحة — يدويًا نرفعها بكل تحديث مهم. تظهر بمسار /health فورًا (يمر عبر الـWorker
// نفسه لا عبر أي GameServer معيّن، فلا علاقة له بمشكلة "كائن قديم عالق بذاكرته" إطلاقاً) —
// أسرع طريقة تتأكد فيها إن wrangler deploy فعلاً رفع هذا الملف بالذات، بمعزل تام عن أي طاولة.
const SERVER_VERSION="2026-08-18-forfeit-grace-and-listing-race"; // NEW CODE — نتيجة الانسحاب تعرض الاسم الحقيقي لمن غادر فعلياً، لا "بوت N" المجرّدة — الأخيرة تبقى كما هي أثناء اللعب الحي فقط
// ينتظر وعداً بحد أقصى ms ميلي ثانية وإلا يرفض بـ"timeout" — مشترك بين كل عمليات فايرستور المهلة‑حسّاسة (DRY)
function withTimeout(p,ms){ return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),ms))]); }

// ================= مضيف الغرفة: WebSocket + بديل الاستطلاع =================
export class GameServer extends DurableObject {
  constructor(ctx, env){
    super(ctx, env);
    this.ctx=ctx; this.env=env;
    this.game={status:"lobby",seats:[],mode:"solo",tier:null,names:{},avatars:{},state:null,result:null,verifiedUids:{},creatorPid:null}; // FIX — أضفنا creatorPid
    this.seq=0;
    this.waiters=[];
    this.lastSeen=new Map();
    // HIBERNATION — ترحيل كامل لواجهة سُبات WebSocket: الغرفة تنام والاتصالات تظل حية بيد المنصة، وتصحى
    // أجزاء ثانية فقط لحظة وصول رسالة فعلية — هذا يقص بند "مدة بقاء الكائن نشطاً" (المهيمن على الفاتورة)
    // جذرياً. خريطة this.conns القديمة أُلغيت نهائياً: هوية كل اتصال (pid) صارت "مرفقاً متسلسلاً" على
    // الاتصال نفسه (serializeAttachment) تنجو من النوم، وقائمة الاتصالات مصدرها المنصة (ctx.getWebSockets).
    // استعادة الحالة المحفوظة إن أفاق الكائن بعد سبات — كي لا تُفقد الجولة
    if(ctx&&typeof ctx.blockConcurrencyWhile==="function"){
      ctx.blockConcurrencyWhile(async()=>{
        try{
          const saved=await ctx.storage.get("game");
          if(saved)this.game=saved;
          const sq=await ctx.storage.get("seq");
          if(typeof sq==="number")this.seq=sq;
          const rid=await ctx.storage.get("roomId"); // HIBERNATION — roomId كان يُشتق من رابط الطلب فقط؛ الاستيقاظ برسالة WebSocket لا يمر بأي رابط، فصار محفوظاً
          if(typeof rid==="string"&&rid)this.roomId=rid; // HIBERNATION
          for(const ws of (this.ctx.getWebSockets?this.ctx.getWebSockets():[])){ // HIBERNATION — أعد بناء "آخر ظهور" لأصحاب الاتصالات النائمة: بلا هذا، كنس الحضور بعد الاستيقاظ قد يعامل متصلين فعليين كمنقطعين
            try{ const a=ws.deserializeAttachment&&ws.deserializeAttachment(); if(a&&a.pid)this.lastSeen.set(a.pid,Date.now()); }catch(e){} // HIBERNATION
          } // HIBERNATION
        }catch(e){}
      });
    }
  }
  async _persist(){ try{ if(this.ctx&&this.ctx.storage)await this.ctx.storage.put({game:this.game,seq:this.seq}); }catch(e){} }
  _sockets(){ try{ return this.ctx.getWebSockets?this.ctx.getWebSockets():[]; }catch(e){ return []; } } // HIBERNATION — قائمة الاتصالات الحية من المنصة (تشمل النائمة)
  _wsPid(ws){ try{ const a=ws.deserializeAttachment&&ws.deserializeAttachment(); return a&&a.pid||null; }catch(e){ return null; } } // HIBERNATION — هوية الاتصال من مرفقه المتسلسل
  _clearTimers(){} // متبقّية للتوافق فقط — الجدولة الحين عبر Alarms (ينام العنصر بينها، ما يُحاسَب Duration وهو نايم)
  _broadcast(){
    this.seq++;
    this._persist();
    const ws=[...this.waiters]; this.waiters=[];
    for(const w of ws){try{w.resolve()}catch(e){}}
    for(const sock of this._sockets()){ // HIBERNATION
      const pid=this._wsPid(sock); if(!pid)continue; // HIBERNATION
      try{ sock.send(JSON.stringify(this._stateFor(pid))); }catch(e){}
    }
  }
  _bump(){
    this._broadcast();
    this._armBots();
  }
  _connectedCount(){
    const now=Date.now(); let n=this._sockets().filter(w=>this._wsPid(w)).length; // HIBERNATION
    for(const [,ts] of this.lastSeen)if(now-ts<30000)n++;
    return n;
  }
  _spectatorCount(){
    // عدد المتصلين حاليًا اللي ما هم بمقاعد اللعب (يتفرجون فقط) — يُستخدم لعرض "كم شخص يشاهد" بواجهة المستخدم
    const now=Date.now(); const seats=new Set(this.game.seats||[]);
    const active=new Set();
    for(const w of this._sockets()){const pid=this._wsPid(w);if(pid&&!seats.has(pid))active.add(pid);} // HIBERNATION
    for(const [pid,ts] of this.lastSeen)if(now-ts<30000&&!seats.has(pid))active.add(pid);
    return active.size;
  }
  _isPresent(pid){
    for(const w of this._sockets())if(this._wsPid(w)===pid)return true; // HIBERNATION — ساكيت مفتوح (ولو نائماً) = متصل الآن
    const ts=this.lastSeen.get(pid);
    return !!ts && (Date.now()-ts<PRESENCE_GRACE_MS);
  }
  // ===== طبقة تحقق الهوية: تفصل تماماً بين pid (هوية اتصال/مقعد مؤقتة — wb-player-id، من اختيار
  // العميل الحر) وuid (حساب Firebase حقيقي — لا يُقبل إلا موقّعاً من Google). هذي أدناه هي النقطة
  // الوحيدة بكل الملف اللي تكتب بخريطة verifiedUids؛ ولا مكان آخر يضع فيها قيمة مباشرة من رسالة عميل. =====
  async _verifyAndBindUid(pid, idToken){
    if(!idToken||typeof idToken!=="string"||idToken.length>4096)return; // شكل غير معقول لرمز Firebase — تجاهل فوراً بلا معالجة
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT){ console.log("[TRACE] _verifyAndBindUid: لا يوجد سرّ FIREBASE_SERVICE_ACCOUNT بالبيئة — تحقّق بـ`wrangler secret list`"); return; } // ما فيه اعتماد خادم — اللاعب يبقى "زائر" بأمان، لا نخمّن
    const projectId=getFirebaseProjectId(this.env);
    if(!projectId){ console.log("[TRACE] _verifyAndBindUid: السرّ موجود لكن تعذّر استخراج project_id منه (JSON تالف؟)"); return; }
    const uid=await verifyFirebaseIdToken(idToken,projectId); // توقيع Google هو مصدر الثقة الوحيد — لا ادّعاء من العميل يُقبل مباشرة
    if(!uid){ console.log("[TRACE] _verifyAndBindUid: فشل التحقق من idToken للاعب",pid,"(منتهي/تالف/لمشروع آخر)"); return; } // رمز مزوّر/منتهي/تالف/لمشروع آخر — لا نربط شيئاً؛ يبقى pid بلا حساب موثّق لهذي الجلسة
    const g=this.game;
    g.verifiedUids=g.verifiedUids||{};
    const isNew=g.verifiedUids[pid]!==uid;
    if(isNew){ g.verifiedUids[pid]=uid; await this._persist(); console.log("[TRACE] _verifyAndBindUid: تم توثيق",pid,"بنجاح"); } // نحفظ فوراً — التحقق ثمين، ما نعتمد على broadcast لاحق يحفظه
    // ربط متأخر أثناء جولة جارية فاتها "المرور الأول" لرسوم الدخول (راجع _chargeLateTierFee) — بلا أي أثر لو ما فيه شي مستحق أصلاً
    if(isNew)await this._chargeLateTierFee(pid);
  }
  // رسوم دخول متأخرة: لو "المرور الأول" (_processTierFee عند start) فات هذا اللاعب لأن uid ما كان موثّقاً
  // وقتها بالضبط، اقبضها الآن فور اكتمال التوثيق — بدل ما تُفقد رسوم الطبقة للأبد لمجرد فرق توقيت شبكة.
  // آمنة من التكرار: g.state.feePaid واحدة يملأها هذا المسار و_processTierFee معاً، وكل pid يُحسم مرة واحدة
  // بالضبط (إما هنا وإما هناك) — راجع تحليل التزامن بالتعليق أعلى _processTierFee.
  async _chargeLateTierFee(pid){
    const g=this.game;
    if(!g.tier||!g.tier.fee||!g.tierFeeCharged)return; // ما فيه رسوم، أو "المرور الأول" لسّا ما صار (بيتكفّل بيه هو نفسه بعد شوي)
    if(!g.state||g.status!=="playing"||!g.state.humans.includes(pid))return;
    if((g.state.ejected||[]).includes(pid))return;
    g.state.feePaid=g.state.feePaid||[];
    if(g.state.feePaid.includes(pid))return; // خُصم أصلاً (إما بالمرور الأول أو بمحاولة متأخرة سابقة) — لا نكرر
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT)return;
    const uid=this._verifiedUid(pid);
    if(!uid)return;
    g.state.feePaid.push(pid); // نثبّت المحاولة فورًا (قبل أي await) — يمنع أي تداخل من محاولة ثانية لنفس pid
    try{
      const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000);
      const res=await withTimeout(adjustPlayerGold(token,projectId,uid,-g.tier.fee),8000);
      if(!res.ok){
        g.state.ejected=g.state.ejected||[];
        g.state.ejected.push(pid);
        g.state.log=(g.state.names[pid]||"لاعب")+" — ذهبه لا يكفي لدخول هذي الطبقة، البوت يكمل مكانه";
      }
      console.log("[TRACE] _chargeLateTierFee: خصم متأخر لـ",pid,"—",res.ok?"نجح":"رصيد غير كافٍ، طُرد");
      this._bump();
    }catch(e){ console.log("[TRACE] _chargeLateTierFee فشلت لـ",pid,"—",e.message); }
  }
  // المرجع الوحيد لقراءة uid موثّق لأي pid — أي دالة تحتاج uid حقيقي (خصم/إضافة ذهب أو أي كتابة
  // على مستند اللاعب) تنادي هذي فقط ولا تقرأ verifiedUids مباشرة؛ ترجع null دائماً لأي "زائر" لم يُتحقق منه
  // ═══ AUTO-PLAY — نظام "التحكم الآلي + مهلة استعادة ٣ دقائق" ═══
  // انقطاع/إغلاق/انتهاء وقت الدور → المقعد يتحول فوراً لتحكم آلي: البوت يقرر ويرمي بسرعة (~٠.٨ث) بكل دور،
  // والمقعد يحتفظ باسم وصورة صاحبه كما هما (شارة 🤖 فقط بالواجهة). اللاعب العائد خلال ٣ دقائق يجد مقعده
  // بانتظاره وزر "استعادة التحكم". بعد انقضائها: الودية → البوت يستلم المقعد رسمياً ويصير متاحاً لأي منضم
  // (آلية الإحلال والدخول الموجودة نفسها)؛ التنافسية → التحكم الآلي يستمر لنهاية الجولة حمايةً لعدالة
  // النقاط، مع خصم نقاط تصنيف الانسحاب مرة واحدة (بالدالة الموجودة أصلاً). لا مؤقتات ذاكرة إطلاقاً —
  // كل التوقيتات عبر منبّه الكائن (متوافقة مع السُبات)، والحالة كلها داخل g (تُحفظ وتُستعاد تلقائياً).
  AUTO_GRACE_MS=3*60*1000; // AUTO-PLAY
  _autoMap(){ this.game.autoPlay=this.game.autoPlay||{}; return this.game.autoPlay; } // AUTO-PLAY
  _isAuto(pid){ const a=this._autoMap()[pid]; return !!(a&&(a.locked||Date.now()<a.until)); } // AUTO-PLAY — locked: تنافسية بعد انقضاء المهلة (يستمر لنهاية الجولة)
  _setAuto(pid,src){ // AUTO-PLAY
    const g=this.game,s=g.state; // AUTO-PLAY
    if(!s||g.status!=="playing"||!s.humans.includes(pid)||(s.ejected||[]).includes(pid))return false; // AUTO-PLAY
    const m=this._autoMap(); if(m[pid])return false; // AUTO-PLAY
    m[pid]={until:Date.now()+this.AUTO_GRACE_MS,src,setAt:Date.now()}; // AUTO-PLAY
    s.log=(s.names[pid]||"لاعب")+" — تحكم آلي مؤقت 🤖"; // AUTO-PLAY
    console.log("[TRACE] AUTO-PLAY: فُعّل لـ",pid,"سبب:",src); // AUTO-PLAY
    return true; // AUTO-PLAY
  } // AUTO-PLAY
  _clearAuto(pid){ const m=this._autoMap(); if(m[pid]){ delete m[pid]; return true; } return false; } // AUTO-PLAY
  _sweepAutoExpiry(){ // AUTO-PLAY — يُستدعى كل نبضة (من _armBots): حسم المنقضية مهلتهم
    const g=this.game,s=g.state,now=Date.now(); if(g.status!=="playing"||!s)return false; // AUTO-PLAY
    let changed=false; // AUTO-PLAY
    const ranked=!!(g.tier&&g.tier.fee); // AUTO-PLAY
    for(const pid of Object.keys(this._autoMap())){ // AUTO-PLAY
      const a=this._autoMap()[pid]; if(!a||a.locked||now<a.until)continue; // AUTO-PLAY
      if(!s.humans.includes(pid)){ delete this._autoMap()[pid]; continue; } // AUTO-PLAY — استُبدل/طُرد بمسار آخر
      if(this._isPresent(pid)){ a.until=now+this.AUTO_GRACE_MS; continue; } // AUTO-PLAY — متصل فعلياً لكنه خامل: لا يُسحب مقعد حاضر — تتمدد مهلته بصمت (يظل بإمكانه "استعادة التحكم" بأي لحظة)
      if(ranked){ // AUTO-PLAY — تنافسية: يستمر آلياً لنهاية الجولة + عقوبة انسحاب مرة واحدة
        a.locked=true; changed=true; // AUTO-PLAY
        s.log=(s.names[pid]||"لاعب")+" لم يعد — البوت يكمل عنه للنهاية (تنافسي)"; // AUTO-PLAY
        if(!a.penApplied){ a.penApplied=true; this.ctx.waitUntil(this._applyImmediateRankPenalty(pid)); } // AUTO-PLAY — نفس دالة عقوبة الانسحاب الموجودة
      }else{ // AUTO-PLAY — ودية: البوت يستلم المقعد رسمياً — يصير متاحاً لأي منضم (آلية الإحلال والدخول الموجودة)
        const oldName=s.names[pid]||g.names[pid]||"لاعب"; // AUTO-PLAY
        const botPid=this._replaceWithBot(pid,"timeout"); // AUTO-PLAY
        delete this._autoMap()[pid]; // AUTO-PLAY
        if(botPid){ s.log=oldName+" لم يعد — المقعد متاح لأي لاعب"; changed=true; this.ctx.waitUntil(this._clearActiveRoom(pid)); this.ctx.waitUntil(this._syncActiveRoomListing()); } // AUTO-PLAY
      } // AUTO-PLAY
    } // AUTO-PLAY
    return changed; // AUTO-PLAY
  } // AUTO-PLAY
  _verifiedUid(pid){
    const g=this.game;
    return (g.verifiedUids&&g.verifiedUids[pid])||null;
  }
  _stateFor(pid){
    // AUTO-PLAY — تُضاف حقول التحكم الآلي أسفل الدالة عند بناء الكائن (ابحث autoPids)
    const g=this.game;
    const _am=this._autoMap(); // AUTO-PLAY
    return{type:"state",status:g.status,seats:g.seats,you:pid,
      autoPids:Object.keys(_am).filter(p2=>this._isAuto(p2)), // AUTO-PLAY — شارة 🤖 بالمقاعد
      autoMe:this._isAuto(pid)&&!(_am[pid]&&_am[pid].locked), // AUTO-PLAY — شريط "استعادة التحكم" (لا يظهر بعد قفل التنافسية)
      connected:this._connectedCount(),
      spectators:this._spectatorCount(),
      lobby:g.status==="lobby"?{mode:g.mode,tier:g.tier||null,creator:g.creatorPid||null,names:g.names,avatars:g.avatars,isPublic:!!g.isPublic,previewBots:this._previewBots()}:null, // FIX — creator من g.creatorPid الثابت، لا g.seats[0] المتغيّر مع كل تبديل مقعد
      view:g.state?viewFor(g.state,pid):null,
      uids:this._safeUidsMap(), // NEW CODE — معرّفات اللاعبين الموثّقين المقعودين فقط (لا بوتات) — تلزم الواجهة لعرض رتبة/إرسال صداقة لكل لاعب
      result:g.result,meta:meta};
  }
  // FIX — معاينة أسماء/صور البوتات للمقاعد الشاغرة أثناء انتظار اللوبي (قبل بدء اللعبة الفعلي) — يعطي
  // اللاعب انطباعاً بامتلاء الطاولة تدريجياً بدل قفزة مفاجئة من فراغ لطاولة مكتملة عند البدء. مستقرة عمداً
  // (تُحسب مرة واحدة، لا تُعاد عشوائياً بكل بث) لتفادي أسماء "ترمش" وتتغيّر مع كل تحديث حالة
  _previewBots(){ // FIX
    const g=this.game; // FIX
    const need=4-g.seats.length; // FIX
    if(need<=0){ g._previewBotNames=null; return []; } // FIX — الطاولة مكتملة فعلياً ببشر، لا داعي لأي معاينة
    if(!g._previewBotNames||g._previewBotNames.length!==need){ // FIX — أول مرة، أو تغيّر عدد الشواغر (لاعب جديد انضم)
      // FIX — نفس فرق _isFriendlySession بالضبط (لعب سريع مقابل أي مجموعة أنشأها مستخدم): كانت هذي المعاينة
      // وحدها تتجاهله فتَعِد بأسماء بشرية عشوائية بينما بدء اللعبة الفعلي (وأي استبدال لاحق) يُظهران "بوت N"
      // صريحاً — وعد شاشة الدعوة يلزم يطابق الواقع من أول لحظة يشوفها اللاعب، لا فقط لحظة الضغط "ابدأ"
      if(this._isFriendlySession()){ // FIX
        const merged=Object.assign({},g.names); // FIX — نسخة مؤقتة نحدّثها بكل تكرار، كي "بوت 2" ما يتعارض مع "بوت 1" بنفس المعاينة
        const out=[]; // FIX
        for(let i=0;i<need;i++){ // FIX
          const label=this._nextBotLabel(merged); // FIX — دائماً مرقّمة "بوت 1"/"بوت 2"
          merged["preview-"+i]=label; out.push({name:label,avatar:"🤖"}); // FIX
        } // FIX
        g._previewBotNames=out; // FIX
      }else{ // FIX
        const taken=new Set(Object.values(g.names)); // FIX — لا نكرر اسم لاعب بشري منضمّ فعلاً
        const pool=shuffle(BOT_NAMES.filter(n=>!taken.has(n))).slice(0,need); // FIX
        g._previewBotNames=pool.map(n=>({name:n,avatar:randomBotAvatar()})); // FIX
      } // FIX
    } // FIX
    return g._previewBotNames; // FIX
  } // FIX
  // NEW CODE — معرّفات فايرستور الموثّقة فقط للمقاعد الحالية (تُقرأ من g.verifiedUids الموجودة أصلاً، لا تُنشئ شيئاً
  // جديداً) — نفس مستوى الحساسية اللي uid مكشوف فيه أصلاً بلوحة الصدارة العامة، ليس معلومة سرّية بهذا التطبيق
  _safeUidsMap(){ // NEW CODE
    const g=this.game; const out={}; // NEW CODE
    const seats=(g.state&&g.state.seats)||g.seats||[]; // NEW CODE
    for(const pid of seats){ // NEW CODE
      if(pid.startsWith("bot-"))continue; // NEW CODE
      const uid=(g.verifiedUids||{})[pid]; // NEW CODE
      if(uid)out[pid]=uid; // NEW CODE
    } // NEW CODE
    return out; // NEW CODE
  } // NEW CODE
  async _processTierFee(){
    const g=this.game;
    if(!g.tier||!g.tier.fee||g.tierFeeCharged)return; // مجانية، أو خُصمت أصلًا لهذي الطاولة
    g.tierFeeCharged=true; // نمنع التكرار فورًا حتى لو تعدد الاستدعاء بالتوازي
    console.log("[TRACE] _processTierFee بدأت — نسخة:",SERVER_VERSION,"— fee:",g.tier.fee,"لاعبين:",(g.state&&g.state.humans||[]).length);
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT){ console.log("[TRACE] _processTierFee: لا يوجد سرّ FIREBASE_SERVICE_ACCOUNT بالبيئة — تحقّق بـ`wrangler secret list`"); return; } // ما فيه اعتماد — تجاهل بأمان بدل ما نعطّل اللعب
    try{
      const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000);
      console.log("[TRACE] _processTierFee: حصلت على token فايرستور");
      // FIX — الإصلاح الجوهري: نطبّق تعديلات لوحة التحكم (config/tiers) فوق القيم الرسمية الافتراضية هنا،
      // قبل أي خصم فعلي — كان السيرفر يخصم/يدفع القيم الثابتة بـSERVER_TIERS دائماً، متجاهلاً أي تعديل من
      // لوحة التحكم كليًا (تلك التعديلات كانت تُطبَّق على عرض الواجهة فقط، لا على الخصم/الدفع الفعلي إطلاقاً)
      try{ // FIX
        const overrides=await withTimeout(getTierOverrides(token,projectId),5000); // FIX
        const ov=overrides[g.tier.key]; // FIX
        if(ov){ // FIX
          const feeField=g.mode==="team"?"teamFee":"soloFee", winField=g.mode==="team"?"teamWin":"soloWin"; // FIX — نفس أسماء الحقول اللي تقرأها الواجهة بالضبط (tierVal)
          if(typeof ov[feeField]==="number")g.tier.fee=ov[feeField]; // FIX
          if(typeof ov[winField]==="number")g.tier.win=ov[winField]; // FIX
          if(typeof ov.goal==="number"&&g.tier.goal!=null)g.tier.goal=ov.goal; // FIX — لا نفرض هدفاً على جلسة كانت أصلاً بلا هدف (null)
          console.log("[TRACE] _processTierFee: طُبِّقت تعديلات لوحة التحكم على",g.tier.key,"—",JSON.stringify(g.tier)); // FIX
        } // FIX
      }catch(e){ console.log("[TRACE] _processTierFee: فشل جلب تعديلات لوحة التحكم، نتابع بالقيم الافتراضية —",e.message); } // FIX
      let ejectedAny=false;
      g.state.feePaid=g.state.feePaid||[]; // من هنا يعرف _chargeLateTierFee مين خُصم أصلاً فما يكرر الخصم
      for(const pid of (g.state.humans||[])){
        if((g.state.ejected||[]).includes(pid))continue;
        const uid=this._verifiedUid(pid); // uid موثّق بتوقيع Google فقط — لا نص ادّعاه العميل مباشرة (راجع _verifyAndBindUid)
        if(!uid){ console.log("[TRACE] _processTierFee:",pid,"بلا uid موثّق وقت المرور الأول — _chargeLateTierFee سيلتقطه فور اكتمال توثيقه"); continue; } // نتجاوزه الآن بأمان بدل التخمين؛ الباب يبقى مفتوحاً له لاحقاً
        g.state.feePaid.push(pid);
        try{
          const res=await withTimeout(adjustPlayerGold(token,projectId,uid,-g.tier.fee),8000);
          if(!res.ok){
            g.state.ejected=g.state.ejected||[];
            g.state.ejected.push(pid);
            g.state.log=(g.state.names[pid]||"لاعب")+" — ذهبه لا يكفي لدخول هذي الطبقة، البوت يكمل مكانه";
            ejectedAny=true;
          }
        }catch(e){ console.log("[TRACE] _processTierFee: خطأ للاعب",pid,"—",e.message); }
      }
      if(ejectedAny)this._broadcast();
      console.log("[TRACE] _processTierFee انتهت بنجاح");
    }catch(e){ console.log("[TRACE] _processTierFee فشلت كليًا —",e.message); }
  }
  async _processReaction(pid,uid,reactId){ // FIX
    const g=this.game; // FIX
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT){ this._sendTo(pid,{type:"error",error:"الخدمة غير متاحة الآن"}); return; } // FIX
    try{
      const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000); // FIX
      const res=await withTimeout(adjustPlayerGold(token,projectId,uid,-50),8000); // FIX — ٥٠ ذهب ثابتة؛ ترفض تلقائياً لو الناتج سيصير سالباً (رصيد غير كافٍ)، بلا حاجة لقراءة تحقق منفصلة
      console.log("[TRACE] _processReaction —",pid,uid,reactId,"نجح:",res.ok,"قبل:",res.before,"بعد:",res.after); // FIX
      if(!res.ok){ this._sendTo(pid,{type:"error",error:"لا يوجد رصيد كافٍ (يلزم 50 ذهب)"}); return; } // FIX
      const payload=JSON.stringify({type:"react",from:pid,reactId,ts:Date.now()}); // FIX — نفس نمط بث الدردشة بالضبط، بما فيه صاحب الطلب نفسه (يحتاج يشوف تفاعله بعد تأكيد الخصم فعلياً، لا فوراً بتفاؤل)
      for(const sock of this._sockets()){ try{ sock.send(payload); }catch(e){} } // HIBERNATION
    }catch(e){ console.log("[TRACE] _processReaction فشلت —",pid,e.message); this._sendTo(pid,{type:"error",error:"تعذّر إرسال التفاعل"}); } // FIX
  } // FIX
  _sendTo(pid,obj){ // FIX — إرسال مستهدَف لمقبس لاعب واحد بعينه (لا بث)، يُستخدم لأخطاء لا يفترض تصل لبقية الطاولة
    const payload=JSON.stringify(obj); // FIX
    for(const sock of this._sockets()){ if(this._wsPid(sock)===pid){ try{ sock.send(payload); }catch(e){} break; } } // HIBERNATION
  } // FIX
  async _clearActiveRoom(pid){
    // نظّف علم "يلعب الآن" بفايرستور فور اكتشاف انقطاعه من السيرفر نفسه — بدل الاعتماد فقط على تنظيف العميل (اللي ما يصير لو أغلق التطبيق فجأة أو انقطع نته)
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT)return;
    const uid=this._verifiedUid(pid); // uid موثّق فقط — لا خريطة قديمة غير محقَّقة
    if(!uid)return; // ما نعرف حسابه الحقيقي — نتجاوزه بأمان
    try{
      const {token,projectId}=await getFirebaseAccessToken(this.env);
      await firestorePatch(token,projectId,"players/"+uid,{activeRoom:fsVal(null)},["activeRoom"]);
    }catch(e){}
  }
  async _processTierReward(){
    const g=this.game;
    if(!g.tier||!g.tier.win||!g.result||g.tierRewardRound===g.roundSeq)return; // NEW CODE — عداد رقمي صريح بدل مقارنة g.result (كائن) — يبقى صحيحاً حتى لو الـDurable Object نام واستيقظ بين المحاولتين
    g.tierRewardRound=g.roundSeq; // NEW CODE
    console.log("[TRACE] _processTierReward بدأت — win:",g.tier.win,"— نتيجة الجولة:",JSON.stringify(g.result)); // NEW CODE — نطبع النتيجة كاملة، مو بس win، عشان نشوف مين احتُسب فائزاً بالضبط
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT){ console.log("[TRACE] _processTierReward: لا يوجد سرّ FIREBASE_SERVICE_ACCOUNT بالبيئة"); return; } // NEW CODE
    try{
      const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000);
      const r=g.result;
      let winners=[];
      if(r.mode==="team"&&r.winnerTeam!=="draw"&&r.teams)winners=r.teams[r.winnerTeam]||[];
      else if(r.winner)winners=[r.winner];
      console.log("[TRACE] _processTierReward: الفائزون المحسوبون:",JSON.stringify(winners),"— humans:",JSON.stringify(g.state&&g.state.humans),"— ejected:",JSON.stringify(g.state&&g.state.ejected)); // NEW CODE
      if(!winners.length)console.log("[TRACE] _processTierReward: صفر فائزين (تعادل على الأغلب) — لا مكافأة تُصرف، هذا متوقّع"); // NEW CODE
      for(const pid of winners){
        if(!g.state.humans.includes(pid)){ console.log("[TRACE] _processTierReward:",pid,"بوت، تجاوز"); continue; } // NEW CODE — كانت تجاوز صامت، صارت مسجّلة
        if((g.state.ejected||[]).includes(pid)){ console.log("[TRACE] _processTierReward:",pid,"مطرود، تجاوز"); continue; } // NEW CODE
        const uid=this._verifiedUid(pid);
        if(!uid){ console.log("[TRACE] _processTierReward:",pid,"بلا uid موثّق — لن يستلم مكافأة!"); continue; } // NEW CODE — هذا أهم سطر تتبّع لتشخيص مشكلة "الفائز ما استلم"
        try{
          const res=await withTimeout(adjustPlayerGold(token,projectId,uid,g.tier.win),8000);
          console.log("[TRACE] _processTierReward:",pid,"(uid:",uid,") استلم +"+g.tier.win,"— قبل:",res.before,"بعد:",res.after); // NEW CODE
        }catch(e){ console.log("[TRACE] _processTierReward: خطأ للاعب",pid,"—",e.message); }
      }
      console.log("[TRACE] _processTierReward انتهت بنجاح");
    }catch(e){ console.log("[TRACE] _processTierReward فشلت كليًا —",e.message); }
  }
  _isPrivGroupRoom(){ // NEW CODE — جلسة خاصة (مجموعة أصدقاء): ليست غرفة pub- سريعة، وليست طبقة تنافسية برسوم
    return !(this.roomId&&this.roomId.startsWith("pub-"))&&!(this.game.tier&&this.game.tier.fee); // NEW CODE
  } // NEW CODE
  async _processPrivReward(){ // NEW CODE — الفريق الفائز بالجلسة الخاصة *الجماعية* يحصد 100 ذهب لكل عضو
    const g=this.game; // NEW CODE
    if(!this._isPrivGroupRoom()||!g.result||g.result.mode!=="team"||g.privRewardRound===g.roundSeq)return; // NEW CODE — جماعي فقط بطلب صريح؛ حارس لكل جولة كنمط المكافآت التنافسية حرفياً
    g.privRewardRound=g.roundSeq; // NEW CODE
    const r=g.result; // NEW CODE
    if(r.winnerTeam==="draw"||!r.teams)return; // NEW CODE
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT)return; // NEW CODE
    try{ // NEW CODE
      const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000); // NEW CODE
      for(const pid of (r.teams[r.winnerTeam]||[])){ // NEW CODE
        if(!g.state.humans.includes(pid))continue; // NEW CODE — البوتات لا تُكافأ
        if((g.state.ejected||[]).includes(pid))continue; // NEW CODE
        const uid=this._verifiedUid(pid); // NEW CODE
        if(!uid){ console.log("[TRACE] مكافأة جلسة خاصة:",pid,"بلا uid موثّق — لن يستلم"); continue; } // NEW CODE
        try{ const res=await withTimeout(adjustPlayerGold(token,projectId,uid,100),8000); // NEW CODE
          console.log("[TRACE] مكافأة جلسة خاصة:",pid,"استلم +100 — قبل:",res.before,"بعد:",res.after); // NEW CODE
        }catch(e){ console.log("[TRACE] مكافأة جلسة خاصة: خطأ للاعب",pid,"—",e.message); } // NEW CODE
      } // NEW CODE
    }catch(e){ console.log("[TRACE] _processPrivReward فشلت —",e.message); } // NEW CODE
  } // NEW CODE
  // NEW CODE — نقاط الرتبة التنافسية عند انتهاء الجولة طبيعيًا: فائزون +rankWin، خاسرون -rankLoss (كلاهما من
  // الجدول الرسمي resolveTier، لا من العميل). يستثني تلقائيًا أي منسحب/مطرود (عوقب فورًا بالفعل عبر
  // _applyImmediateRankPenalty وقت خروجه، معاقبته هنا ثانية = عقوبة مزدوجة)
  async _processTierRankPoints(){ // NEW CODE
    const g=this.game; // NEW CODE
    if(!g.tier||!g.tier._rankWin||g.tierRankRound===g.roundSeq||!g.result)return; // NEW CODE
    g.tierRankRound=g.roundSeq; // NEW CODE
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT)return; // NEW CODE
    try{ // NEW CODE
      const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000); // NEW CODE
      const r=g.result; // NEW CODE
      let winners=[],losers=[]; // NEW CODE
      if(r.mode==="team"&&r.teams&&(r.winnerTeam===0||r.winnerTeam===1)){ winners=r.teams[r.winnerTeam]; losers=r.teams[1-r.winnerTeam]; } // NEW CODE
      else if(r.winner){ winners=[r.winner]; losers=(g.state.humans||[]).filter(p=>p!==r.winner); } // NEW CODE — تعادل: صفر تغيير للجميع
      console.log("[TRACE] _processTierRankPoints: فائزون",JSON.stringify(winners),"خاسرون",JSON.stringify(losers),"— win:",g.tier._rankWin,"loss:",g.tier._rankLoss); // NEW CODE
      for(const pid of winners){ // NEW CODE
        if(!g.state.humans.includes(pid)||(g.state.ejected||[]).includes(pid))continue; // NEW CODE
        const uid=this._verifiedUid(pid); if(!uid)continue; // NEW CODE
        try{ const res=await withTimeout(adjustPlayerRank(token,projectId,uid,g.tier._rankWin),8000); console.log("[TRACE] rank فوز —",pid,uid,res.before,"→",res.after); }catch(e){ console.log("[TRACE] rank فوز فشل —",pid,e.message); } // NEW CODE
        // FIX — السبب الجذري لتجمّد لوحة الصدارة الأسبوعية: weekPts لم تكن تُحدَّث هنا إطلاقاً منذ تحوّل
        // نظام الرتبة للسيرفر بجلسة أمان سابقة — بقيت معلّقة على مسار قديم بالعميل معطَّل أونلاين تماماً.
        // فقط الفوز يزيدها (لا الخسارة) — لوحة الصدارة الأسبوعية تكافئ النشاط والفوز، لا تعاقب كالرتبة العامة
        try{ const res=await withTimeout(incrementWeeklyPoints(token,projectId,uid,g.tier._rankWin),8000); console.log("[TRACE] weekPts فوز —",pid,uid,res.before,"→",res.after); }catch(e){ console.log("[TRACE] weekPts فوز فشل —",pid,e.message); } // FIX
        // FIX — الإصلاح الجذري لـ"لاعب متصدر بلا إحصائيات ظاهرة": games/wins/best كانت لا تزال محلية
        // بالكامل بالعميل (localStorage + حفظ مؤجَّل غير مضمون)، بينما weekPts/rank صارتا سيرفريتين موثوقتين
        // منذ جلسة سابقة — هذا التناقض بالضبط يعني لاعباً نشطاً فعلياً (متصدر) لكن بلا أي إحصائيات ظاهرة إن
        // فشل حفظه المحلي لأي سبب. الآن تُحدَّث هنا بنفس الموثوقية، لكل لاعب مقعود فعلياً بغض النظر عن اسم مستخدم
        try{ await withTimeout(atomicIncrementField(token,projectId,"players/"+uid,"games",1),8000); }catch(e){ console.log("[TRACE] games فوز فشل —",pid,e.message); } // FIX
        try{ await withTimeout(atomicIncrementField(token,projectId,"players/"+uid,"wins",1),8000); }catch(e){ console.log("[TRACE] wins فشل —",pid,e.message); } // FIX
        const myPts=(r.scores&&r.scores[pid])?r.scores[pid].points:0; // FIX
        if(myPts>0){ try{ await withTimeout(atomicMaxField(token,projectId,"players/"+uid,"best",myPts),8000); }catch(e){ console.log("[TRACE] best فوز فشل —",pid,e.message); } } // FIX
      } // NEW CODE
      for(const pid of losers){ // NEW CODE
        if(!g.state.humans.includes(pid)||(g.state.ejected||[]).includes(pid))continue; // NEW CODE
        const uid=this._verifiedUid(pid); if(!uid)continue; // NEW CODE
        try{ const res=await withTimeout(adjustPlayerRank(token,projectId,uid,-g.tier._rankLoss),8000); console.log("[TRACE] rank خسارة —",pid,uid,res.before,"→",res.after); }catch(e){ console.log("[TRACE] rank خسارة فشل —",pid,e.message); } // NEW CODE
        try{ await withTimeout(atomicIncrementField(token,projectId,"players/"+uid,"games",1),8000); }catch(e){ console.log("[TRACE] games خسارة فشل —",pid,e.message); } // FIX — الخاسر يُحتسب بعدد الجولات أيضاً، لا الفوز فقط
        const myPts=(r.scores&&r.scores[pid])?r.scores[pid].points:0; // FIX
        if(myPts>0){ try{ await withTimeout(atomicMaxField(token,projectId,"players/"+uid,"best",myPts),8000); }catch(e){ console.log("[TRACE] best خسارة فشل —",pid,e.message); } } // FIX — قد يحقق الخاسر أفضل نتيجة شخصية له رغم خسارة الجولة
      } // NEW CODE
      console.log("[TRACE] _processTierRankPoints انتهت بنجاح"); // NEW CODE
    }catch(e){ console.log("[TRACE] _processTierRankPoints فشلت كليًا —",e.message); } // NEW CODE
  } // NEW CODE
  // عقوبة انسحاب فورية (زر الخروج أو انقطاع) — لا تنتظر نهاية الجولة، ولا تتكرر لاحقًا بـ_processTierRankPoints
  // بما إن اللاعب صار محذوفاً من g.state.humans تمامًا فور الاستبدال (isBotLike تتجاهله تلقائيًا هناك)
  async _applyImmediateRankPenalty(pid){ // NEW CODE
    const g=this.game; // NEW CODE
    if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT)return; // NEW CODE
    try{ // NEW CODE
      const uid=this._verifiedUid(pid); if(!uid)return; // NEW CODE
      const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000); // NEW CODE
      const res=await withTimeout(adjustPlayerRank(token,projectId,uid,-g.tier._rankLoss),8000); // NEW CODE
      console.log("[TRACE] rank انسحاب فوري —",pid,uid,res.before,"→",res.after); // NEW CODE
    }catch(e){ console.log("[TRACE] rank انسحاب فوري فشل —",pid,e.message); } // NEW CODE
  } // NEW CODE
  // NEW CODE — فحص انسحاب فريق كامل (2ضد2): لو صار أحد الفريقين بلا أي لاعب حقيقي متصل (غادروا كلهم، أو
  // استُبدلوا ببوتات) والفريق الآخر لا يزال فيه واحد على الأقل، تُنهى الجولة فوراً بانسحاب — بلا انتظار
  // بقية الأوراق ضد بوتات لا طائل منها. نحسب هنا فقط "مين متصل" (شأن السيرفر)، وبناء النتيجة كاملة نفوّضه
  // لـforfeitResult (gameLogic.js) — فيُعالَج تلقائياً بمسار المكافآت/نقاط الرتبة الموجود أصلاً، صفر تكرار.
  // يُستدعى من كل نقطة تتغيّر فيها تركيبة s.humans: _armBots، alarm (احتياطياً)، ومعالج "leave" الصريح.
  _checkTeamForfeit(){ // NEW CODE
    const g=this.game, s=g.state; // NEW CODE
    if(g.mode!=="team"||g.status!=="playing"||!s)return false; // NEW CODE
    const tA=[s.seats[0],s.seats[2]], tB=[s.seats[1],s.seats[3]]; // NEW CODE — نفس تجميع isGameOver/forfeitResult بالضبط
    const humansA=tA.filter(p=>s.humans.includes(p)).length; // NEW CODE
    const humansB=tB.filter(p=>s.humans.includes(p)).length; // NEW CODE
    // FIX — الإصلاح الجوهري الثاني (سبب "الجولة تنتهي بالنص والخاسر يفوز"): مجرد وجود bot-r- ما كان كافياً.
    // الانقطاع التلقائي (٢٠ث بلا نبضة — تقطّع شبكة، تطبيق بالخلفية) كان يستبدل بوتاً ثم يُحسب فوراً انسحاباً
    // نهائياً، فتُنهى الجولة لصالح الخصم في نفس اللحظة — حتى لو المنقطع كان متقدماً بالنقاط ورجع بعد ثوانٍ.
    // الآن: خروج صريح (زر) = انسحاب فوري (قرار واعٍ)؛ انقطاع تلقائي = ننتظر FORFEIT_GRACE_MS بعد الاستبدال،
    // ولو رجع خلالها يسترد مقعده (_tryDropIn) والجولة تكمل عادي. ولو الفريق فيه مقعدان بديلان، لازم كلاهما
    // يستوفيان الشرط (every) — ما نحسم بسبب واحد ما دام الثاني قد يرجع.
    const now=Date.now(); // FIX
    const wasAbandoned=team=>{ // FIX
      const rs=team.filter(p=>s.replacedMeta&&s.replacedMeta[p]); // FIX — مقاعد بديلة فعلياً لإنسان غادر (bot-r-)
      if(!rs.length)return false; // FIX — فريق بوتات بالتصميم من البداية (bot-N فقط) — طبيعي، لا انسحاب
      return rs.every(p=>{const m=s.replacedMeta[p]; return m.reason==="leave"||(now-m.at>=FORFEIT_GRACE_MS);}); // FIX
    }; // FIX
    let winnerTeam=null; // NEW CODE
    if(humansA===0&&humansB>0&&wasAbandoned(tA))winnerTeam=1; // FIX — أضفنا شرط wasAbandoned
    else if(humansB===0&&humansA>0&&wasAbandoned(tB))winnerTeam=0; // FIX — أضفنا شرط wasAbandoned
    if(winnerTeam===null)return false; // NEW CODE — كلا الفريقين فيهما بشر، أو الفريق الفاضي بوتات بالتصميم أصلاً، أو كلاهما فاضٍ
    g.status="over"; // NEW CODE
    g.result=forfeitResult(s,winnerTeam); // NEW CODE — كل حساب النقاط/الفرق من gameLogic.js، صفر منطق لعبة هنا
    g.roundSeq=(g.roundSeq||0)+1; // NEW CODE — نفس نمط انتهاء جولة طبيعية: عداد جديد كي _processTierReward/_processTierRankPoints ما تعتبرها جولة قديمة مكرَّرة
    console.log("[TRACE] _checkTeamForfeit: فريق",winnerTeam,"يفوز بالانسحاب — الفريق الآخر بلا بشر متصلين (كان فيه إنسان غادر فعلياً)"); // FIX
    this.ctx.waitUntil(this._processTierReward()); // NEW CODE — نفس مسار مكافأة الذهب الطبيعي حرفياً
    this.ctx.waitUntil(this._processPrivReward()); // NEW CODE — ومكافأة الجلسة الخاصة الجماعية أيضاً (انسحاب الخصوم = فوز فريقك)
    this.ctx.waitUntil(this._processTierRankPoints()); // NEW CODE — نفس مسار نقاط الرتبة الطبيعي حرفياً
    this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE — الغرفة خلصت، تُزال من قائمة الجلسات النشطة فوراً
    return true; // NEW CODE
  } // NEW CODE
  // FIX — تصحيح جوهري: الفرق الحقيقي هو "لعب سريع" (pub-، مطابقة عشوائية آلية بالكامل، بلا أي اختيار من
  // المستخدم) مقابل أي جلسة أنشأها مستخدم بنفسه (مجموعة) — سواء اختار لها "خاصة (بالرابط بس)" أو "تظهر
  // بالجلسات النشطة". كلا خياري المجموعة يبقيان جلسة ودية بلا رسوم بطبيعتها أصلاً (راجع _syncActiveRoomListing:
  // الجلسات النشطة أصلاً مقصورة على ما بلا رسوم)، فتستحقان هوية البوت الصريحة بالتساوي — "تظهر بالجلسات
  // النشطة" يغيّر مين يقدر يكتشف الغرفة فقط، لا طبيعتها الودية. isPublic كان يُحسَب هنا خطأً وكأنه يعني
  // "مطابقة عامة مجهولة"، بينما هو فقط علم ظهور بالقائمة لمجموعة أنشأها مستخدم أصلاً — أزلناه من الشرط.
  _isFriendlySession(){ // FIX
    return !this.roomId.startsWith("pub-"); // FIX
  } // FIX
  // FIX — رقم بوت متسلسل دائماً "بوت 1"، "بوت 2"... (لا "بوت" مجرّد بلا رقم أبداً) — يفحص الأسماء المستخدَمة
  // فعلاً ويتفادى أي تعارض، مشتركة بين البدء والاستبدال ومعاينة اللوبي الثلاثة (DRY)
  _nextBotLabel(names){ // FIX
    const used=new Set(Object.values(names)); // FIX
    let n=1; while(used.has("بوت "+n))n++; // FIX
    return "بوت "+n; // FIX
  } // FIX
  _startGame(){
    const g=this.game;
    const bots=[]; let bi=0;
    const names=Object.assign({},g.names);
    const avatars=Object.assign({},g.avatars);
    const taken=new Set(Object.values(names));
    // NEW CODE — جلسة ودية (مجموعة أنشأها مستخدم، خاصة أو معلَنة بالجلسات النشطة سواء) لا لعب سريع: البوت
    // المكمّل يظهر بهويته الحقيقية "بوت N" + أفاتار 🤖 صريح، بدل اسم بشري عشوائي كان يكسر وعد شاشة الدعوة.
    const isFriendly=this._isFriendlySession(); // FIX
    const pool=shuffle(BOT_NAMES.filter(n=>!taken.has(n)));
    while(g.seats.length+bots.length<4){
      const bpid="bot-"+(++bi);
      bots.push(bpid);
      if(isFriendly){
        names[bpid]=this._nextBotLabel(names); // FIX — دائماً مرقّمة "بوت 1"/"بوت 2"، لا "بوت" مجرّد للأول
        avatars[bpid]="🤖"; // NEW CODE — أفاتار بوت واضح، نفس رمز شاشة الدعوة بالضبط
      }else{
        names[bpid]=pool.length?pool.shift():("بوت "+bi);
        avatars[bpid]=randomBotAvatar(); // صورة عشوائية واقعية من المجموعة — للمطابقة العامة فقط
      }
    }
    let seats;
    if(g.mode==="team"&&g.seats.length===2){
      seats=[g.seats[0],bots[0],g.seats[1],bots[1]]; // الصديقان شريكان والبوتات ضدهما
    }else{
      seats=g.seats.concat(bots);
    }
    for(const h of g.seats)if(!names[h])names[h]="لاعب";
    g.state=setup({seats,humans:g.seats.slice(),mode:g.mode,names,avatars,tier:g.tier||null,tierGoal:g.tier?g.tier.goal:null,blocks:g.tier?g.tier.blocks:null});
    g.status="playing"; g.result=null;
    g.roundSeq=(g.roundSeq||0)+1; // NEW CODE — عداد جولة صريح (رقم بسيط، لا مرجع كائن) — يُستخدم بـ_processTierReward بدل مقارنة g.result نفسه
    g.roomStartedAt=Date.now(); // NEW CODE — قائمة الجلسات النشطة: "بدأت قبل X" — نخزّنه بحالة الغرفة المحفوظة (لا حقل نسخة مؤقت) كي يصمد نوم/صحوة الـDurable Object
    this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE — نقطة واحدة تغطي: الانضمام التلقائي للغرف العامة، زر "ابدأ" اليدوي، وإعادة اللعب (reset) معاً
  }
  // NEW CODE — قائمة الجلسات النشطة: يبني ملخص الطاولة الحالي وينشره (أو يزيله) من مجموعة active_rooms
  // بفايرستور — العميل يقرأها مباشرة عبر Firebase SDK (بلا مسار HTTP جديد بالـWorker، تحديث حي بلا استطلاع).
  // خصوصية: فقط الطاولات العامة (pub-، من "لعب سريع"/"جلسة كاملة") تُنشر أبداً — الغرف الخاصة (روابط دعوة)
  // ما تظهر بقائمة عامة لأي أحد يتصفحها، بغض النظر عن حالتها. يُستدعى من نقاط دورة حياة محددة فقط (بداية/
  // انضمام لوبي/تغيير إعداد/انتهاء/إغلاق) — لا من كل _bump، كي ما نكتب لفايرستور على كل حركة لعب عادية.
  // NEW CODE — Drop-in: لاعب حقيقي يأخذ مقعد بوت أثناء جولة جارية فعلاً. فقط أثناء دور عادي (لا وسط نزاع
  // وقّف — تعقيد هوية بمنتصف نزاع غير مبرر) وفقط لمقعد "بوت حقيقي" (id مو موجود بـs.humans من الأساس)؛
  // هذا يستثني عمدًا مقاعد بشر مطرودين (موجودين بـs.humans رغم s.ejected) — قد يرجعون هم بأنفسهم لاحقًا،
  // ما نبي غريب يسرق مقعدهم. النقل شامل: اليد والكومة (يكمل من نفس نقطة البوت بالضبط، لا يبدأ من الصفر)،
  // الاسم/الصورة تُضبط تلقائيًا بالمنطق الموجود أسفل بمعالج join (يعتمد على g.seats.includes(pid))، والدور
  // ينتقل له فورًا بمهلة كاملة جديدة لو صادف كانت نوبة نفس البوت وقت الانضمام. رسوم الطبقة (لو موجودة) تُحصَّل
  // تلقائيًا بنفس آلية _chargeLateTierFee الموجودة أصلاً (تتفعّل فور توثيق uid، وتتحقق أصلاً من g.state.humans) —
  // صفر كود إضافي لزم لهذا الجزء، أي طاولة برسوم تبقى عادلة بلا "ركوب مجاني".
  // NEW CODE — إحلال بوت محل لاعب منسحب (خروج صريح أو انقطاع) من طاولة تلعب فعلاً: يأخذ يده وكومته
  // بالضبط ويُسمّى باسم من BOT_NAMES (نفس اتفاقية بوتات _startGame الأصلية) — لا يبقى أي أثر لهويته القديمة
  // بالمقعد. عكس _tryDropIn تمامًا (اللي يأخذ مقعد بوت لصالح إنسان)؛ يشترك معه بنفس فكرة "نقل الهوية الكاملة".
  _replaceWithBot(pid,reason){ // NEW CODE — reason: "leave" (زر خروج صريح) أو "timeout" (انقطاع تلقائي بعد مهلة الحضور)
    const g=this.game, s=g.state; if(!s)return null; // NEW CODE
    const idx=s.seats.indexOf(pid); if(idx<0)return null; // NEW CODE
    const botPid="bot-r-"+idx; // NEW CODE — فريد دائمًا (مقعد واحد بكل طاولة)، ما يتعارض مع بوتات _startGame (bot-N)
    const realName=s.names[pid]; // NEW CODE — نحفظه قبل الحذف بالأسفل — يُستخدم بنتيجة الانسحاب فقط، لا أثناء اللعب الحي
    s.seats[idx]=botPid; // NEW CODE
    s.hands[botPid]=s.hands[pid]||[]; delete s.hands[pid]; // NEW CODE
    s.piles[botPid]=s.piles[pid]||[]; delete s.piles[pid]; // NEW CODE
    // FIX — نفس فرق _startGame بالضبط (كان مفقوداً هنا كليًا): جلسة ودية (مجموعة، خاصة أو معلَنة سواء)
    // تستحق "بوت N" + 🤖 صريحين، لا اسماً بشرياً عشوائياً من BOT_NAMES — كان اللاعب المتبقي يشوف بوتاً
    // بهوية مزيفة رغم إن شاشة الدعوة والبوتات الأصلية بنفس الطاولة تعده صراحة بهوية بوت واضحة
    if(this._isFriendlySession()){ // FIX
      s.names[botPid]=this._nextBotLabel(s.names); s.avatars[botPid]="🤖"; // FIX — دائماً مرقّمة "بوت 1"/"بوت 2"
    }else{ // FIX
      const taken=new Set(Object.values(s.names)); // NEW CODE
      const pool=BOT_NAMES.filter(n=>!taken.has(n)); // NEW CODE
      s.names[botPid]=pool.length?pool[Math.floor(Math.random()*pool.length)]:"بوت"; // NEW CODE
      s.avatars[botPid]=randomBotAvatar(); // NEW CODE — صورة عشوائية من المجموعة الجديدة للبوت البديل
    } // FIX
    delete s.names[pid]; delete s.avatars[pid]; // FIX — موحّد لكلا الفرعين أعلاه بدل تكراره بكل واحد
    // NEW CODE — "بوت N" يبقى هوية المقعد أثناء اللعب الحي (شفافية)، بس نحفظ هنا مين كان بالمقعد ولماذا ومتى:
    //   name   → نتيجة الانسحاب (forfeitResult) تعرض الاسم الحقيقي بدل تسمية البوت
    //   pid    → لو رجع نفس اللاعب (انقطاع مؤقت) يسترد مقعده هو تحديداً لا أي مقعد بوت (_tryDropIn)
    //   reason/at → _checkTeamForfeit: خروج صريح = انسحاب فوري؛ انقطاع تلقائي = انتظار FORFEIT_GRACE_MS قبل الحسم
    s.replacedMeta=s.replacedMeta||{}; // NEW CODE
    s.replacedMeta[botPid]={pid,name:realName||"لاعب",reason:reason||"timeout",at:Date.now()}; // NEW CODE
    s.humans=s.humans.filter(p=>p!==pid); // NEW CODE
    if(s.turn===pid)s.turn=botPid; // NEW CODE
    if(s.lastEater===pid)s.lastEater=botPid; // NEW CODE
    if(s.waqf){ // NEW CODE — تحديث أي مرجع بنزاع وقّف نشط (نادر، لكن احتياط لضمان اتساق كامل)
      if(s.waqf.holder===pid)s.waqf.holder=botPid; // NEW CODE
      if(s.waqf.onlyBidder===pid)s.waqf.onlyBidder=botPid; // NEW CODE
      if(s.waqf.contested)s.waqf.contested.forEach(c=>{if(c.by===pid)c.by=botPid;}); // NEW CODE
    } // NEW CODE
    return botPid; // NEW CODE
  } // NEW CODE
  // فحص مشترك لكل مقاعد اللاعبين الحقيقيين (استُدعي من _armBots ومن alarm احتياطياً — نقطة منطق واحدة، DRY)
  _replaceDisconnectedWithBots(){ // NEW CODE
    const g=this.game, s=g.state; if(!s)return false; // NEW CODE
    let any=false; // NEW CODE
    for(const pid of s.seats.slice()){ // NEW CODE — نسخة ثابتة؛ نعدّل s.seats داخل الحلقة نفسها
      if(pid.startsWith("bot-")||this._isPresent(pid))continue; // NEW CODE
      // AUTO-PLAY — الغائب صامتاً (مهلة الحضور فاتت بلا حدث إغلاق) يدخل التحكم الآلي بدل الاستبدال الفوري —
      // مقعده واسمه وصورته تبقى له ٣ دقائق كاملة؛ الحسم النهائي كله عند _sweepAutoExpiry حصراً
      if(s.humans.includes(pid)){ if(this._setAuto(pid,"dc"))any=true; continue; } // AUTO-PLAY
    } // NEW CODE
    if(any)this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE — تركيبة المقاعد تغيّرت فعليًا؛ القائمة العامة لازم تعكس البوت الجديد فورًا بدل ما تبقى بصورة اللاعب المنسحب معلّقة
    return any; // NEW CODE
  } // NEW CODE
  // Drop-in فشلت أول محاولة له (غالبًا وسط نزاع وقّف نشط وقت وصول join)؟ نعيد فحصه هنا كل نبضة حتى ينجح أو يغادر
  _retryPendingDropIns(){ // NEW CODE
    const g=this.game, s=g.state; // NEW CODE
    if(!g.wantsSeat||!g.wantsSeat.length||g.status!=="playing"||!s||s.phase!=="turn")return; // NEW CODE
    const stillWaiting=[]; // NEW CODE
    for(const w of g.wantsSeat){ // NEW CODE — كائن {pid,name,avatar} الآن، لا pid خام
      const pid=w.pid; // NEW CODE
      if(!this._isPresent(pid))continue; // NEW CODE — غادر أصلاً قبل ما يلقى مقعد؛ نتجاهله بصمت (يُحذف من القائمة)
      if(this._tryDropIn(pid)){ // NEW CODE
        if(!g.seats.includes(pid))g.seats.push(pid); // NEW CODE
        if(w.name){ g.names[pid]=w.name; s.names[pid]=w.name; } // NEW CODE — نطبّق الاسم المحفوظ الآن (nextDropIn نفسها عمداً ما تضبطه، راجع تعليقها)
        if(w.avatar){ g.avatars[pid]=w.avatar; s.avatars[pid]=w.avatar; } // NEW CODE
        s.log=(s.names[pid]||"لاعب")+" دخل الطاولة"; // NEW CODE
        this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE
      }else stillWaiting.push(w); // NEW CODE — لسّا ما فيه مقعد بوت متاح أو لسّا وسط نزاع وقّف
    } // NEW CODE
    g.wantsSeat=stillWaiting; // NEW CODE
  } // NEW CODE
  _tryDropIn(pid){ // NEW CODE
    const g=this.game; // NEW CODE
    if(g.status!=="playing"||!g.state||g.state.phase!=="turn")return false; // NEW CODE
    const s=g.state; // NEW CODE
    if(s.seats.includes(pid))return false; // NEW CODE — هذا pid مقعود أصلاً (احتياطي، ما يفترض يصير عادة)
    // FIX — أولوية مطلقة لمقعده هو نفسه لو كان قد استُبدل (انقطاع مؤقت ورجع): كان يأخذ "أول مقعد بوت" أياً كان،
    // فقد يهبط بفريق الخصم بدل شريكه، ويبقى مقعده الأصلي بديلاً يُحسب عليه انسحاباً رغم إنه رجع فعلياً
    let botIdx=s.seats.findIndex(p=>s.replacedMeta&&s.replacedMeta[p]&&s.replacedMeta[p].pid===pid); // FIX
    if(botIdx<0)botIdx=s.seats.findIndex(p=>!s.humans.includes(p)); // NEW CODE — وإلا أول مقعد "بوت حقيقي" متاح
    if(botIdx<0)return false; // NEW CODE — ما فيه أي مقعد بوت — الكل بشر فعليون (بما فيهم مطرودون)
    const botPid=s.seats[botIdx]; // NEW CODE
    if(s.replacedMeta)delete s.replacedMeta[botPid]; // FIX — المقعد صار بشرياً من جديد — لا يُحسب انسحاباً بعد الآن
    s.seats[botIdx]=pid; // NEW CODE
    s.hands[pid]=s.hands[botPid]; delete s.hands[botPid]; // NEW CODE
    s.piles[pid]=s.piles[botPid]; delete s.piles[botPid]; // NEW CODE
    delete s.names[botPid]; delete s.avatars[botPid]; // NEW CODE — الاسم/الصورة الحقيقيين يُضبطان أسفل بمعالج join
    s.humans.push(pid); // NEW CODE
    if(s.turn===botPid){ s.turn=pid; s.turnDeadline=Date.now()+TURN_MS; s.botMoveAt=null; s._botMoveTurn=null; } // NEW CODE — مهلة كاملة جديدة، ما نستعجله على بقية عدّ البوت
    if(s.lastEater===botPid)s.lastEater=pid; // NEW CODE — تسمية عرضية للحدث الأخير فقط، تناسق بسيط
    console.log("[TRACE] _tryDropIn: نجح —",pid,"أخذ مقعد",botPid); // NEW CODE
    return true; // NEW CODE
  } // NEW CODE
  // FIX — سبب "طاولة بوت N وكلها بوتات" العالقة بالجلسات النشطة: لحظة استبدال آخر إنسان تُطلق _replaceDisconnectedWithBots
  // نشراً (لتحديث المقاعد) وبنفس اللحظة يُطلق الإغلاق حذفاً — كلاهما waitUntil متوازيان، وكل واحد يجدّد رمز فايرستور
  // ثم يكتب؛ لو خلص الحذف أولاً، النشر القديم (المقاعد كلها بوتات) يكتب فوقه ويبقى للأبد لأن الغرفة أُغلقت وما تعود
  // تزامن أبداً. الحل: سلسلة تنفيذ واحدة بالترتيب — كل نداء ينفَّذ بعد سابقه ويقرأ g.status الحالي وقت تنفيذه هو
  // (لا وقت استدعائه)، فآخر نداء يرى دائماً "closed"/"over" ويحذف. صفر تغيير بمنطق النشر نفسه.
  _syncActiveRoomListing(){ // FIX
    this._listingChain=(this._listingChain||Promise.resolve()) // FIX
      .then(()=>this._syncActiveRoomListingNow()) // FIX
      .catch(e=>console.log("[TRACE] _syncActiveRoomListing فشلت —",e&&e.message)); // FIX — فشل واحد لا يكسر السلسلة للنداءات التالية
    return this._listingChain; // FIX
  } // FIX
  async _syncActiveRoomListingNow(){ // FIX — كانت اسمها _syncActiveRoomListing، المنطق نفسه حرفياً
    if(!this.roomId)return; // NEW CODE
    const g=this.game;
    const eligible=this.roomId.startsWith("pub-")||g.isPublic===true; // NEW CODE — عامة تلقائيًا (مطابقة سريعة) أو مجموعة فعّل صاحبها "عامة" صراحة
    if(!eligible)return removeRoomStatus(this.env,this.roomId); // NEW CODE — إزالة صريحة (لا تجاوز صامت) — يغطي حالة "كانت عامة ثم رجّعها صاحبها خاصة"؛ لو أصلاً ما نُشرت، حذف مستند غير موجود بلا أي أثر سلبي
    if(g.tier&&g.tier.fee>0){ // NEW CODE — القائمة مخصّصة للجلسات الودية/المجانية فقط؛ أي طبقة برسوم لا تُنشر إطلاقًا
      return removeRoomStatus(this.env,this.roomId); // NEW CODE — احتياطي: تُزال فورًا لو كانت منشورة سابقًا قبل ما تُحدَّد الرسوم بـconfig
    } // NEW CODE
    if(g.status==="over"||g.status==="closed"){ // NEW CODE — إزالة صريحة (بدل الاعتماد على السقوط الضمني للحالة الافتراضية بالأسفل فقط)
      return removeRoomStatus(this.env,this.roomId); // NEW CODE
    } // NEW CODE
    if(g.status==="lobby"){ // NEW CODE
      if(!g.seats.length)return removeRoomStatus(this.env,this.roomId); // NEW CODE — لوبي فاضي بلا أحد، لا داعي ينشر
      const seats=[]; for(let i=0;i<4;i++)seats.push(g.seats[i]?{name:g.names[g.seats[i]]||"لاعب",avatar:g.avatars[g.seats[i]]||""}:null); // NEW CODE
      return publishRoomStatus(this.env,this.roomId,{ // NEW CODE
        name:"طاولة "+(g.names[g.seats[0]]||"لاعب"),mode:g.mode,tierKey:(g.tier&&g.tier.key)||null, // NEW CODE
        status:"lobby",startedAt:null,seats,updatedAt:Date.now()}); // NEW CODE — حذفنا حقل fee (صار دايمًا صفر بعد الشرط بالأعلى، لا داعي نبثّه)
    } // NEW CODE
    if(g.status==="playing"&&g.state){ // NEW CODE
      const s=g.state; // NEW CODE
      const seats=s.seats.map(pid=>s.humans.includes(pid) // NEW CODE
        ?{name:s.names[pid]||"لاعب",avatar:s.avatars[pid]||""} // NEW CODE
        :{name:s.names[pid]||"بوت",avatar:s.avatars[pid]||"",isBot:true}); // NEW CODE — البوت يظهر بصورته الفعلية مع علامة isBot، لا كمقعد فاضٍ — الواجهة تحسب humanCount بنفسها وتتيح drop-in
      return publishRoomStatus(this.env,this.roomId,{ // NEW CODE
        name:"طاولة "+(s.names[s.seats[0]]||"لاعب"),mode:s.mode,tierKey:(s.tier&&s.tier.key)||null, // NEW CODE
        status:"playing",startedAt:g.roomStartedAt||Date.now(),seats,updatedAt:Date.now()}); // NEW CODE
    } // NEW CODE
    return removeRoomStatus(this.env,this.roomId); // NEW CODE — احتياطي إضافي لأي حالة أخرى غير متوقعة
  } // NEW CODE
  async _process(pid,msg){ // FIX — صارت async: بوابة رسوم الجلسة الخاصة (msg.type=start) تنتظر خصم الذهب متزامنةً قبل السماح بالبدء
    const g=this.game;
    if(!msg||typeof msg.type!=="string")return{type:"error",error:"invalid message"};
    if(msg.type==="join"){
      { const a=this._autoMap()[pid]; // AUTO-PLAY — ومضة انقطاع (رجع خلال ثوانٍ): محو صامت بلا إزعاج بالزر
        if(a&&!a.locked&&a.src==="dc"&&Date.now()-a.setAt<10000){ this._clearAuto(pid); if(g.state)g.state._autoMoveTurn=null; } } // AUTO-PLAY
      const isSpectator=msg.spectate===true; // NEW CODE — نية مشاهدة صريحة من العميل (أزرار "شاهد"/"تفرج") — لا تُقحَم كلاعب مهما كانت حالة الغرفة
      if(!g.creatorPid&&!isSpectator&&g.status==="lobby"&&g.seats.length===0)g.creatorPid=pid; // FIX — يُثبَّت مرة واحدة فقط لأول لاعب حقيقي، لا يتغيّر بعدها إطلاقاً مهما تحرّكت المقاعد لاحقاً بـmoveSeat
      if(!isSpectator&&g.status==="lobby"&&!g.seats.includes(pid)&&g.seats.length<4)g.seats.push(pid); // NEW CODE — أضفنا isSpectator&&
      const droppedIn=!isSpectator&&this._tryDropIn(pid); // NEW CODE — drop-in ممنوع تمامًا لمن نيته صريحة مشاهدة فقط، بغض النظر عن حالة الغرفة أو الطبقة
      if(!isSpectator&&!droppedIn&&g.status==="playing"){ // NEW CODE — فشلت المحاولة الأولى (غالبًا وسط نزاع وقّف نشط) — نسجّله لإعادة المحاولة تلقائياً
        g.wantsSeat=g.wantsSeat||[]; // NEW CODE
        const nm2=(typeof msg.name==="string"&&msg.name.trim())?msg.name.trim().slice(0,14):null; // NEW CODE — نحفظ الاسم/الصورة هنا لأن g.seats.includes(pid) لسّا false، فمنطق ضبط الاسم بالأسفل لن يشتغل له إطلاقاً
        const av2=(typeof msg.avatar==="string"&&msg.avatar.trim())?msg.avatar.trim().slice(0,300):null; // NEW CODE
        const existing2=g.wantsSeat.find(w=>w.pid===pid); // NEW CODE
        if(existing2){ if(nm2)existing2.name=nm2; if(av2)existing2.avatar=av2; } // NEW CODE — تحديث لو حاول الانضمام أكثر من مرة وهو منتظر
        else g.wantsSeat.push({pid,name:nm2,avatar:av2}); // NEW CODE
      } // NEW CODE
      if(droppedIn&&!g.seats.includes(pid))g.seats.push(pid); // تسجيل دائم بمرآة اللوبي: يضمن ظهوره كلاعب أصلي بأي "إعادة" لاحقة على نفس الطاولة، لا مجرد ضيف لهالجولة فقط
      // خط دفاع إضافي: لو أول لاعب بالغرفة أرفق طبقته مع رسالة الانضمام نفسها، نثبّتها فورًا — بدون انتظار رسالة config منفصلة قد تتأخر عن بدء الغرفة التلقائي
      if(g.status==="lobby"&&!g.tier&&g.creatorPid===pid&&msg.tier&&typeof msg.tier==="object"){ // FIX — creatorPid بدل g.seats[0]
        if(msg.mode==="team"||msg.mode==="solo")g.mode=msg.mode; // FIX — الوضع يُضبط أولاً، resolveTier يحتاجه لاختيار fee/win الصحيحة (فردي/فريقي)
        // FIX — الإصلاح الجذري: كان هذا المسار يعيّن g.tier=msg.tier مباشرة (كائن العميل الخام)، متجاوزاً
        // resolveTier كليًا — يعني _rankWin/_rankLoss لا تُضبطان أبداً، فنقاط الرتبة/الصدارة الأسبوعية لا
        // تُحسب إطلاقاً لأي مباراة تمر بهذا المسار تحديداً (وهو المسار المعتاد لغرف البحث العامة "pub-"،
        // لا حالة نادرة). الآن نستدعي resolveTier بنفس منطق معالج config الرسمي بالضبط — DRY واتساق تام
        const resolved=resolveTier(msg.tier.key, g.mode); // FIX
        if(resolved){ // FIX
          g.tier={key:resolved.key,name:(typeof msg.tier.name==="string"?msg.tier.name.slice(0,40):resolved.key),fee:resolved.fee,win:resolved.win,goal:resolved.goal,_isSession:resolved.isSession,_rankWin:resolved.rankWin,_rankLoss:resolved.rankLoss}; // FIX — وحّدنا كل الأطوار على الرزمة الافتراضية (لا blocks متمايزة بعد الآن)
        }else if(!msg.tier.fee||msg.tier.fee<=0){ // FIX — طبقة مخصّصة مجانية
          g.tier={key:String(msg.tier.key||"custom").slice(0,30),name:String(msg.tier.name||"").slice(0,40),fee:0,win:0,goal:(typeof msg.tier.goal==="number"?Math.max(0,Math.min(5000,msg.tier.goal)):null)}; // FIX
        } // FIX — مفتاح مجهول برسوم>0: نتجاهله بصمت، g.tier يبقى فارغاً (تُعالَج لاحقاً برسالة config الرسمية)
      }
      // الغرف العامة (بحث عن لاعبين): تبدأ ذاتياً عند اكتمال 4 أو بعد 15 ثانية بالبوتات
      if(this.roomId&&this.roomId.startsWith("pub-")&&g.status==="lobby"){
        if(g.seats.length>=4){ this._startGame(); this.ctx.waitUntil(this._processTierFee()); }
        else if(!g.pubTimerAt){ g.pubTimerAt=Date.now()+15000; }
      }
      if(g.seats.includes(pid)&&typeof msg.name==="string"&&msg.name.trim()){
        const nm=msg.name.trim().slice(0,14);
        g.names[pid]=nm;
        if(g.state&&g.state.names)g.state.names[pid]=nm; // ينعكس فوراً حتى أثناء اللعب
      }else if(g.seats.includes(pid)&&!g.names[pid]){ // FIX — لا اسم مُرسَل الآن، ولا اسم محفوظ مسبقاً لهذا المقعد
        // FIX — كان الاسم يبقى بلا قيمة للأبد لأي لاعب انضم بلا اسم (زائر/ضيف)، يظهر فارغاً بكل الشاشات —
        // نعيّن اسماً افتراضياً واضحاً فوراً بدل تركه فارغاً. لا نطغى على اسم صحيح موجود مسبقاً بأي حال
        g.names[pid]="لاعب شعبي"; // FIX
        if(g.state&&g.state.names)g.state.names[pid]="لاعب شعبي"; // FIX
      }
      if(g.seats.includes(pid)&&typeof msg.avatar==="string"&&msg.avatar.trim()){
        const av=msg.avatar.trim().slice(0,300);
        g.avatars[pid]=av;
        if(g.state&&g.state.avatars)g.state.avatars[pid]=av; // ينعكس فوراً حتى أثناء اللعب
      }
      if(droppedIn&&g.state)g.state.log=(g.state.names[pid]||"لاعب")+" دخل الطاولة"; // NEW CODE — إشعار دخول مرئي، بعد ضبط الاسم مباشرة (نفس نمط رسالة المغادرة "فلان غادر — بوت أخذ مكانه")
      if(g.status==="lobby"||droppedIn)this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE — أضفنا droppedIn: تركيبة المقاعد تغيّرت أثناء اللعب، القائمة العامة لازم تنعكس فورًا
      // توثيق الحساب الحقيقي (إن أُرفق): تحقّق تشفيري كامل عبر db.js بدل تصديق أي uid يرسله العميل
      // مباشرة. لا نوقف رد "join" بانتظاره (fire-and-forget عبر waitUntil) — انضمام اللاعب لا يتأخر،
      // وأي عملية ذهب لاحقة (تبدأ فقط برسالة "start" منفصلة الطاولات) أصلاً بعد هذا بأجزاء ثانية على الأقل.
      if(typeof msg.idToken==="string"&&msg.idToken)this.ctx.waitUntil(this._verifyAndBindUid(pid,msg.idToken));
      this._bump(); return null;
    }
    if(msg.type==="auth"){
      // إعادة ربط uid لاحقًا — يغطي تأخر جاهزية Firebase بالواجهة أو تجدّد التوكن أثناء الجلسة (مصدرها
      // withIdToken/onIdTokenChanged بالعميل). نفس مسار التحقق المستخدم بـjoin/config بالضبط (عبر
      // _verifyAndBindUid → db.js)، بلا أي تكرار منطق. رسالة تحقّق هوية بحتة — ما تغيّر مقعدًا ولا تبدأ
      // جولة ولا تبثّ حالة، فما تحتاج _bump()
      if(typeof msg.idToken==="string"&&msg.idToken)this.ctx.waitUntil(this._verifyAndBindUid(pid,msg.idToken));
      return null;
    }
    if(msg.type==="chat"){
      if(!g.seats.includes(pid))return{type:"error",error:"المتفرج لا يتكلم"};
      // FIX — الجلسة ودية = بلا طبقة تنافسية حقيقية عليها مبلغ فعلي؛ نفس معيار isFriendly بـviewFor بالضبط.
      // الحظر يشمل كلا نوعي الرسالة (نص حر واختصار جاهز) بالمنافسات الرسمية — الواجهة تُخفي صندوق الدردشة
      // بالكامل (كلا التبويبين معاً) بهذي الحالة، فالسيرفر يطابقها هنا دفاعاً بعمق، لا اعتماداً على الواجهة فقط
      const isFriendly=!(g.tier&&g.tier.fee>0); // FIX
      if(!isFriendly)return{type:"error",error:"المحادثة غير متاحة بالمباريات التنافسية"}; // FIX
      const now=Date.now();
      this._lastChat=this._lastChat||new Map();
      const last=this._lastChat.get(pid)||0;
      if(now-last<1200)return null; // حد أدنى بين الرسائل لمنع الإسبام
      let payload; // FIX
      if(typeof msg.text==="string"&&msg.text.trim()){ // FIX — نص حر
        const text=msg.text.trim().slice(0,200); // FIX — سقف طول معقول، يمنع رسائل ضخمة تُثقل البث
        this._lastChat.set(pid,now); // FIX
        payload=JSON.stringify({type:"chat",from:pid,text,name:g.names[pid]||"لاعب",avatar:g.avatars[pid]||null,ts:now}); // FIX — يشمل الاسم والصورة كما طُلب صراحة
      }else{ // دردشة سريعة: عبارات محدّدة مسبقاً فقط (لا نص حر) — تُبث فوراً لكل من بالغرفة دون المساس بحالة اللعبة
        const allowed=new Set(["janb","matakhoz","salam","sar3","dahek","alaykum","bayyad","atahadak","sahsah"]); // FIX — أضفنا الأربع الجديدة: كانت القائمة أقدم من إضافتها بالواجهة، فالسيرفر يرفض بثّها — المرسل يسمع صوته المحلي فقط ولا يصل الآخرين شيء
        const phraseId=String(msg.phraseId||"");
        if(!allowed.has(phraseId))return{type:"error",error:"عبارة غير معروفة"};
        this._lastChat.set(pid,now);
        payload=JSON.stringify({type:"chat",from:pid,phraseId,ts:now});
      } // FIX
      for(const sock of this._sockets()){ try{ sock.send(payload); }catch(e){} } // HIBERNATION — نفس بث الغرفة بالضبط (اتصالات هذا الكائن = هذي الطاولة فقط)
      return null;
    }
    if(msg.type==="react"){ // FIX — تفاعلات مدفوعة (٥٠ ذهب): يتحقق السيرفر من الرصيد فعلياً قبل أي بث، لا يثق بالعميل إطلاقاً
      const REACT_IDS=new Set(["welcome","wait","ok","sure","noway","serious","howso","enough","wewon","thanks"]); // FIX
      const reactId=String(msg.reactId||""); // FIX
      if(!REACT_IDS.has(reactId))return{type:"error",error:"تفاعل غير معروف"}; // FIX
      if(!g.seats.includes(pid))return{type:"error",error:"المتفرج لا يتفاعل"}; // FIX
      const now2=Date.now(); // FIX
      this._lastReact=this._lastReact||new Map(); // FIX
      const lastR=this._lastReact.get(pid)||0; // FIX
      if(now2-lastR<1200)return null; // FIX — نفس حد الدردشة، منع الإسبام
      const uid=this._verifiedUid(pid); // FIX
      if(!uid)return{type:"error",error:"يلزم تسجيل الدخول لاستخدام التفاعلات"}; // FIX
      this._lastReact.set(pid,now2); // FIX — نحجزها فوراً (لا بعد نجاح الخصم) لمنع سباق نقرات متتالية سريعة جداً
      this.ctx.waitUntil(this._processReaction(pid,uid,reactId)); // FIX — الخصم والبث فعل غير متزامن (يحتاج قراءة/كتابة فايرستور)
      return null; // FIX
    } // FIX
    if(msg.type==="leave"){ // NEW CODE — انسحاب صريح (زر الخروج): إحلال بوت + عقوبة رتبة فورية، بدل انتظار مهلة الحضور العامة (٢٠ث)
      if(g.status==="playing"&&g.state&&g.state.seats.includes(pid)&&!pid.startsWith("bot-")){ // NEW CODE
        const oldName=g.state.names[pid]||g.names[pid]||"لاعب"; // NEW CODE — نلتقطه قبل ما _replaceWithBot يحذفه
        const wasHuman=g.state.humans.includes(pid); // NEW CODE
        const botPid=this._replaceWithBot(pid,"leave"); // NEW CODE — خروج صريح واعٍ — يؤهّل للانسحاب فوراً بلا مهلة
        if(botPid){ // NEW CODE
          g.state.log=oldName+" غادر — "+(g.state.names[botPid]||"بوت")+" أخذ مكانه"; // NEW CODE
          if(wasHuman)this.ctx.waitUntil(this._clearActiveRoom(pid)); // NEW CODE
          if(g.tier&&g.tier._rankLoss){ // NEW CODE — عقوبة انسحاب فورية لجلسة تنافسية (بمعزل عن نتيجة الجولة النهائية لاحقاً)
            this.ctx.waitUntil(this._applyImmediateRankPenalty(pid)); // NEW CODE
          } // NEW CODE
          this._checkTeamForfeit(); // NEW CODE — قد يحوّل g.status لـ"over" فوراً لو صار فريقه بلا بشر بالكامل الآن
          this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE
          this._broadcast(); // NEW CODE
        } // NEW CODE
      } // NEW CODE
      return null; // NEW CODE — الاتصال يُغلَق فعليًا من العميل بعد هذا مباشرة؛ webSocketClose يتكفل بالباقي
    } // NEW CODE
    if(msg.type==="config"){
      if(g.status!=="lobby")return{type:"error",error:"اللعبة بدأت"};
      if(g.creatorPid!==pid)return{type:"error",error:"منشئ الغرفة فقط يغيّر الإعدادات"}; // FIX — creatorPid ثابت
      if(msg.mode!==undefined){ // FIX
        const newMode=msg.mode==="team"?"team":"solo"; // FIX
        const modeChanged=g.mode!==newMode; // FIX
        g.mode=newMode; // FIX
        // FIX — الإصلاح الجوهري: لو الوضع تغيّر فعلياً وعندنا طبقة تنافسية معروفة مسبقاً (زر تبديل منفصل، بلا
        // tier مرفق بنفس الرسالة)، أعد حلّها بالوضع الجديد فوراً — بدون هذا، الرسوم/الجائزة تبقى عالقة على
        // قيم الوضع القديم (مثلاً فردي: ١٠٠/٢٠٠) رغم إن اللعبة الفعلية صارت فريقية (المفروض ١٥٠/٤٠٠) —
        // هذا كان السبب الفعلي لخصم مبلغ خاطئ ظهر لسامي كـ"-100" بجولة فريقية كان يُفترض تُحتسب بقيم فريقي
        if(modeChanged&&g.tier&&g.tier.key&&msg.tier===undefined){ // FIX
          const reResolved=resolveTier(g.tier._isSession?"session-"+g.tier.key:g.tier.key,newMode); // FIX
          if(reResolved){ // FIX — طبقة رسمية معروفة بالجدول: أعد بناءها كاملة بقيم الوضع الجديد الصحيحة
            g.tier={key:reResolved.key,name:g.tier.name,fee:reResolved.fee,win:reResolved.win,goal:reResolved.goal,_isSession:reResolved.isSession,_rankWin:reResolved.rankWin,_rankLoss:reResolved.rankLoss}; // FIX — وحّدنا كل الأطوار على الرزمة الافتراضية (لا blocks متمايزة بعد الآن)
            console.log("[TRACE] config: أعدنا حلّ الطبقة بعد تبديل الوضع —",JSON.stringify(g.tier)); // FIX
          } // FIX — طبقة مخصّصة مجانية (custom/group-goal): لا فرق مالي بين الأوضاع أصلاً (fee=0 دائماً)، تبقى كما هي بأمان
        } // FIX
      }
      if(msg.tier!==undefined){ // NEW CODE
        if(msg.tier===null){ g.tier=null; } // NEW CODE — إلغاء الطبقة (رجوع لودّي)
        else{ // NEW CODE
          const resolved=resolveTier(msg.tier&&msg.tier.key, g.mode); // NEW CODE — نتجاهل كل fee/win/goal أرسلها العميل، نثق فقط بالمفتاح
          if(resolved){ // NEW CODE — طبقة تنافسية معروفة رسميًا بالجدول — كل القيم المالية من هناك فقط
            g.tier={key:resolved.key,name:(typeof msg.tier.name==="string"?msg.tier.name.slice(0,40):resolved.key),fee:resolved.fee,win:resolved.win,goal:resolved.goal,_isSession:resolved.isSession,_rankWin:resolved.rankWin,_rankLoss:resolved.rankLoss}; // FIX — وحّدنا كل الأطوار على الرزمة الافتراضية (لا blocks متمايزة بعد الآن)
          }else if(msg.tier&&typeof msg.tier==="object"&&(!msg.tier.fee||msg.tier.fee<=0)){ // NEW CODE — طبقة مخصّصة مجانية (مجموعات الأصدقاء بهدف نقاط) — صفر مخاطرة مالية، نقبلها كما هي
            g.tier={key:String(msg.tier.key||"custom").slice(0,30),name:String(msg.tier.name||"").slice(0,40),fee:0,win:0,goal:(typeof msg.tier.goal==="number"?Math.max(0,Math.min(5000,msg.tier.goal)):null)}; // NEW CODE
          } // NEW CODE — غير هذا (مفتاح مجهول برسوم>0): رسالة فاسدة، نتجاهلها بصمت، g.tier يبقى كما كان
        } // NEW CODE
      }      // {key,name,fee,win,goal} — القيم المالية موثوقة من resolveTier وليست من العميل مباشرة (راجع الكتلة أعلاه)
      if(msg.isPublic!==undefined)g.isPublic=!!msg.isPublic; // NEW CODE — منشئ المجموعة يختار إظهارها بالجلسات النشطة أو خصوصيتها (رابط دعوة فقط)، افتراضيًا خاصة
      if(typeof msg.idToken==="string"&&msg.idToken)this.ctx.waitUntil(this._verifyAndBindUid(pid,msg.idToken));
      console.log("[TRACE] config استُلمت — tier:",JSON.stringify(g.tier),"mode:",g.mode);
      this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE — قائمة الجلسات النشطة: الطبقة/الوضع تغيّرا
      this._bump(); return null;
    }
    if(msg.type==="moveSeat"){ // NEW CODE — تبديل مقعد اللاعب نفسه مع لاعب آخر مشغول فعلياً (سحب وإفلات باللوبي) — يشتغل بلا قيد "منشئ الغرفة فقط" لأن كل لاعب يحرّك نفسه هو بس
      if(g.status!=="lobby")return{type:"error",error:"اللعبة بدأت"};
      const toIndex=msg.toIndex;
      if(typeof toIndex!=="number"||toIndex<0||toIndex>=g.seats.length)return{type:"error",error:"مقعد غير صالح"}; // بس بين مقاعد مشغولة فعلياً بلاعبين حقيقيين — مقاعد البوت الاحتياطية غير موجودة فعلياً بهذي المصفوفة قبل بدء اللعبة
      const fromIndex=g.seats.indexOf(pid);
      if(fromIndex===-1)return{type:"error",error:"أنت لست بمقعد بهذي الطاولة"}; // المتفرج لا يحرّك مقعداً
      if(fromIndex!==toIndex){
        const tmp=g.seats[toIndex]; g.seats[toIndex]=pid; g.seats[fromIndex]=tmp; // تبديل بسيط مباشر بين مقعدين
      }
      this._bump(); return null;
    }
    if(msg.type==="resumeControl"){ // AUTO-PLAY — زر "استعادة التحكم"
      if(!g.state||g.status!=="playing")return{type:"error",error:"لا جولة جارية"};
      if(!this._autoMap()[pid])return null; // ليس بتحكم آلي أصلاً — تجاهل صامت
      const a=this._autoMap()[pid];
      if(a.locked)return{type:"error",error:"انقضت مهلة الاستعادة — البوت يكمل هذي الجولة"};
      this._clearAuto(pid);
      const s=g.state;
      if(s.phase==="turn"&&s.turn===pid){ s.turnDeadline=Date.now()+TURN_MS; s.botMoveAt=null; s._botMoveTurn=null; s._autoMoveTurn=null; } // مهلة بشرية كاملة جديدة لدوره الحالي
      s.log=(s.names[pid]||"لاعب")+" استعاد التحكم ✋";
      this._bump(); return null;
    } // AUTO-PLAY
    if(msg.type==="start"){
      if(g.status!=="lobby")return{type:"error",error:"بدأت أصلاً"};
      if(g.creatorPid!==pid)return{type:"error",error:"منشئ الغرفة فقط يبدأ"}; // FIX — creatorPid ثابت، لا يتأثر بتبديل المقاعد اليدوي
      if(!g.seats.length)return{type:"error",error:"لا لاعبين"};
      // NEW CODE — اقتصاد الجلسات الخاصة (مجموعات الأصدقاء، غير غرف pub- السريعة): إنشاؤها يكلّف منشئها
      // 400 ذهب تُخصم لحظة البدء الفعلي — مرة واحدة لكل غرفة مهما أُعيدت. متزامنة عمداً: رصيد غير كافٍ
      // أو حساب غير مسجّل = البدء يُرفض برسالة واضحة، لا خصم صامت لاحق. نفس آلية الذهب الموثّقة الموجودة.
      if(this._isPrivGroupRoom()&&!g.privFeeCharged){ // NEW CODE
        if(g._privFeePending)return{type:"error",error:"جارٍ بدء الجلسة..."}; // FIX — قفل: ضغطتا بدء متسارعتان لا تخصمان مرتين أثناء انتظار الشبكة
        g._privFeePending=true; // FIX
        const uid=this._verifiedUid(pid); // NEW CODE
        if(!uid){g._privFeePending=false;return{type:"error",error:"إنشاء الجلسات الخاصة يتطلب تسجيل الدخول بحساب"};} // NEW CODE
        if(!this.env||!this.env.FIREBASE_SERVICE_ACCOUNT){g._privFeePending=false;return{type:"error",error:"تعذّر التحقق من الرصيد — حاول لاحقاً"};} // NEW CODE
        try{ // NEW CODE
          const {token,projectId}=await withTimeout(getFirebaseAccessToken(this.env),8000); // NEW CODE
          const res=await withTimeout(adjustPlayerGold(token,projectId,uid,-400),8000); // NEW CODE — يرفض تلقائياً لو الناتج سالب
          if(!res.ok){g._privFeePending=false;return{type:"error",error:"رصيدك لا يكفي — إنشاء الجلسة الخاصة يحتاج 400 ذهب"};} // NEW CODE
          g.privFeeCharged=true; g._privFeePending=false; // NEW CODE
          console.log("[TRACE] رسوم جلسة خاصة: خُصم 400 من",pid,"(uid:",uid,") — قبل:",res.before,"بعد:",res.after); // NEW CODE
        }catch(e){ g._privFeePending=false; console.log("[TRACE] رسوم جلسة خاصة فشلت —",e.message); return{type:"error",error:"تعذّر خصم رسوم الجلسة — حاول ثانية"}; } // NEW CODE
      } // NEW CODE
      this.game.autoPlay={}; // AUTO-PLAY — تنظيف: جولة جديدة تبدأ صافية
      this._startGame();
      this.ctx.waitUntil(this._processTierFee());
      this._bump(); return null;
    }
    if(msg.type==="action"){
      if(g.status!=="playing")return{type:"error",error:"اللعبة ليست جارية"};
      if(!g.state.seats.includes(pid))return{type:"error",error:"المتفرج لا يلعب"};
      const v=validateAction(g.state,pid,msg.action);
      if(!v.ok)return{type:"error",error:v.error};
      g.state=applyAction(g.state,pid,msg.action);
      if(msg.action.t==="setName")g.names[pid]=g.state.names[pid];
      const end=isGameOver(g.state);
      if(end.over){g.status="over";g.result=end;g.autoPlay={};this.ctx.waitUntil(this._processTierReward());this.ctx.waitUntil(this._processPrivReward());this.ctx.waitUntil(this._processTierRankPoints());this.ctx.waitUntil(this._syncActiveRoomListing());} // NEW CODE — أضفنا _processPrivReward (جلسات خاصة جماعية)
      this._bump(); return null;
    }
    if(msg.type==="reset"){
      if(!g.seats.includes(pid))return{type:"error",error:"المتفرج لا يعيد"};
      if(g.status==="over"){this._startGame();this.ctx.waitUntil(this._processTierFee());this._bump();return null}
      return{type:"error",error:"الجولة ما زالت جارية"};
    }
    return{type:"error",error:"unknown type"};
  }
  _armBots(){
    // فحص الانقطاع لا يحتاج مؤقت — ينفّذ فوراً كل نبضة (بدون تأخير)
    const g=this.game;
    try{
      if(g.status==="lobby"){ // NEW CODE — لوبي مهجور (لا أحد حاضر، أو المنشئ تحديداً غائب) لم يكن له أي تنظيف إطلاقاً
        if(this._checkLobbyAbandonment())this._broadcast(); // NEW CODE
      } // NEW CODE
      if(g.status==="playing"&&g.state){
        const s=g.state;
        let ejectedNow=this._replaceDisconnectedWithBots(); // NEW CODE — (بعد AUTO-PLAY: تفعيل تحكم آلي للغائبين، لا إحلال مباشر)
        if(this._sweepAutoExpiry())ejectedNow=true; // AUTO-PLAY — حسم منقضي المهلة (ودية: إحلال؛ تنافسية: قفل + عقوبة)
        if(g.status==="playing"&&s.phase==="turn"&&this._isAuto(s.turn)&&s._autoMoveTurn!==s.turn){ // AUTO-PLAY — دور صاحب تحكم آلي: البوت يقرر خلال ~٠.٨ث لا ١٥ (المواصفة)
          s.botMoveAt=Date.now()+800; s._autoMoveTurn=s.turn; // AUTO-PLAY
        } // AUTO-PLAY
        if(this._checkTeamForfeit())ejectedNow=true; // NEW CODE — فريق صار بلا بشر بعد الاستبدال أعلاه؟ تُنهى الجولة فوراً بانسحاب
        // ما بقي ولا لاعب حقيقي متصل (الكل غادر أو أصلاً بوت)؟ الجلسة خلاص ما فيها أحد يراقبها — نقفلها كليًا بدل ما تكمل البوتات تلعب مع بعض للأبد
        const anyHumanLeft=s.humans.some(pid=>this._isPresent(pid)); // NEW CODE — تبسيط: المنقطع صار محذوفاً من humans تمامًا الآن، لا داعي لفلتر ejected إضافي
        if(!anyHumanLeft&&g.status==="playing"){
          g.status="closed"; g.closedAt=Date.now();
          for(const pid of s.humans)this.ctx.waitUntil(this._clearActiveRoom(pid)); // تنظيف شامل احتياطي
          this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE — قائمة الجلسات النشطة: الغرفة أُغلقت، تُزال من القائمة العامة
          ejectedNow=true;
        }
        this._retryPendingDropIns(); // NEW CODE — أي منضم كان ينتظر مقعد بوت (فشلت محاولته الأولى وسط نزاع وقّف) يُعاد فحصه هنا كل نبضة
        if(ejectedNow)this._broadcast();
      }
    }catch(e){ console.log("[TRACE] استثناء بـ_armBots:",e.message,e.stack); }
    const p=this._scheduleAlarm();
    if(this.ctx&&typeof this.ctx.waitUntil==="function")this.ctx.waitUntil(p);
  }
  // NEW CODE — لوبي مهجور بالكامل (لا أحد حاضر فعلياً) ما كان له أي آلية تنظيف — يبقى معلَناً بـ"الجلسات النشطة"
  // للأبد (يبدو طازجاً "قبل لحظات" رغم مرور ساعات)، وأي منضم جديد يعلق بلا قدرة على البدء (منشئ الغرفة غائب
  // نهائياً، creatorPid ما يتغيّر لوحده). تُستدعى من _armBots دورياً — بوضع lobby فقط.
  _checkLobbyAbandonment(){ // NEW CODE
    const g=this.game; // NEW CODE
    if(g.status!=="lobby"||!g.seats.length)return false; // NEW CODE
    const present=g.seats.filter(pid=>this._isPresent(pid)); // NEW CODE
    if(present.length===g.seats.length)return false; // NEW CODE — الكل حاضر، ما فيه شي يلزم فعله
    if(!present.length){ // NEW CODE — الكل غائب — الغرفة مهجورة بالكامل
      g.status="closed"; // NEW CODE — نفس القيمة اللي _syncActiveRoomListing يتعرّف عليها ويحذف الإعلان تلقائياً
      console.log("[TRACE] _checkLobbyAbandonment: لوبي مهجور بالكامل — أُغلق"); // NEW CODE
    }else{ // NEW CODE — بعضهم غائب (يمكن المنشئ نفسه) لكن فيه حاضر واحد على الأقل يستحق الغرفة تبقى مفتوحة له
      g.seats=present; // NEW CODE — احذف المقاعد الشبح، تفتح من جديد لمنضم جديد
      if(!g.seats.includes(g.creatorPid))g.creatorPid=g.seats[0]; // NEW CODE — المنشئ غادر — انقل الملكية لأول حاضر باقٍ
      console.log("[TRACE] _checkLobbyAbandonment: حذفنا مقاعد غائبة، المنشئ الحالي —",g.creatorPid); // NEW CODE
    } // NEW CODE
    this.ctx.waitUntil(this._syncActiveRoomListing()); // NEW CODE
    return true; // NEW CODE
  } // NEW CODE
  // يحسب أقرب "وقت صحوة" لازم من بين كل الأعمال المؤجّلة (حركة بوت/مهلة دور/مزايدات وقّف/حسم وقّف/مؤقت لوبي عام)
  // ويجدوله بمنبّه Alarm وحيد بدل عدة setTimeout — العنصر ينام تمامًا بين الآن وذاك الوقت، صفر محاسبة Duration وهو نايم
  async _scheduleAlarm(){
    const g=this.game;
    let next=null;
    const bump=t=>{ if(t!=null&&(next===null||t<next))next=t; };
    if(g.status==="lobby"&&this.roomId&&this.roomId.startsWith("pub-")&&g.seats.length>0&&g.seats.length<4){
      if(!g.pubTimerAt)g.pubTimerAt=Date.now()+15000;
      bump(g.pubTimerAt);
    }
    // NEW CODE — بدون هذا، أي لوبي مجموعة خاصة (لا pub-) ما كان يحصل أي منبّه إطلاقاً طول بقائه بحالة lobby —
    // لو انهجر بالكامل (ولا رسالة توصل تفعّل _bump مرة ثانية)، ما فيه شي يوقظ العنصر ليكتشف ذلك أبداً، فيبقى
    // معلَناً بـ"الجلسات النشطة" للأبد. فحص دوري كل ~مهلة السماح، يشمل pub- والخاصة سواء (زيادة تكرار بسيطة
    // لجلسات pub- بلا ضرر، أرخص بكثير من غرفة معلَّقة تعرض نفسها كمتاحة بلا نهاية).
    if(g.status==="lobby"&&g.seats.length>0){ // NEW CODE
      bump(Date.now()+PRESENCE_GRACE_MS+2000); // NEW CODE
    } // NEW CODE
    if(g.status==="playing"&&g.state){
      const s=g.state;
      const bots=s.seats.filter(p=>isBotLike(s,p));
      // NEW CODE — منبّه لانقضاء مهلة الانسحاب لأي مقعد بديل بانقطاع تلقائي — كي يُحسم بوقته حتى لو الغرفة هادئة
      if(s.replacedMeta)for(const b in s.replacedMeta){const m=s.replacedMeta[b]; if(m.reason!=="leave")bump(m.at+FORFEIT_GRACE_MS+200);} // NEW CODE
      for(const pid in this._autoMap()){const a=this._autoMap()[pid]; if(!a.locked)bump(a.until+200); } // AUTO-PLAY — حسم انقضاء المهلة بوقته حتى لو الغرفة هادئة
      if(s.phase==="turn"&&this._isAuto(s.turn)&&s.botMoveAt)bump(s.botMoveAt); // AUTO-PLAY
      if(s.phase==="turn"){
        if(bots.includes(s.turn)){
          armBotMoveTiming(s); // مفوّض لـ botLogic.js — يحسب/يثبّت "متى يتحرك البوت" لدور s.turn الحالي
          bump(s.botMoveAt);
        }
        bump(s.turnDeadline+600);
      }
      if(s.phase==="waqf"&&s.waqf){
        armBotBidTiming(s,bots); // مفوّض لـ botLogic.js — يقرر أي بوت يزايد على نافذة "وقّف" الحالية ومتى
        for(const b in s.waqf.botBidTimes)bump(s.waqf.botBidTimes[b]);
        bump(s.waqf.deadline+350);
      }
    }
    await this._persist();
    if(this.ctx&&this.ctx.storage){
      try{
        if(next!=null)await this.ctx.storage.setAlarm(next);
        else if(typeof this.ctx.storage.deleteAlarm==="function")await this.ctx.storage.deleteAlarm();
      }catch(e){}
    }
  }
  // يُستدعى تلقائياً من Cloudflare عند حلول وقت المنبّه — العنصر كان نايماً تمامًا لين هاللحظة
  // فحص الحركات المتأخرة: لو منبّه كلاودفلير تأخر فعليًا (أكثر من 800ms عن الموعد)، نفّذ منطق المنبّه فورًا
  async _catchUpOverdue(){
    const g=this.game;
    if(g.status!=="playing"||!g.state)return;
    const s=g.state, now=Date.now(), GRACE=800;
    let due=false;
    if(s.phase==="turn"){
      if(s.botMoveAt&&(isBotLike(s,s.turn)||this._isAuto(s.turn))&&now>=s.botMoveAt+GRACE)due=true; // AUTO-PLAY
      if(now>=s.turnDeadline+600+GRACE)due=true;
    }else if(s.phase==="waqf"&&s.waqf){
      if(s.waqf.botBidTimes)for(const b in s.waqf.botBidTimes)if(now>=s.waqf.botBidTimes[b]+GRACE){due=true;break}
      if(now>=s.waqf.deadline+350+GRACE)due=true;
    }
    if(due){ try{ await this.alarm(); }catch(e){} }
  }
  async alarm(){
    const g=this.game, now=Date.now();
    try{
    if(g.status==="lobby"&&g.pubTimerAt&&now>=g.pubTimerAt-50){
      g.pubTimerAt=null;
      if(g.status==="lobby"&&g.seats.length>0){ this._startGame(); this.ctx.waitUntil(this._processTierFee()); this._bump(); await this._scheduleAlarm(); return; }
    }
    if(g.status==="playing"&&g.state){
      try{
      const s=g.state;
      if(s.phase==="turn"){
        if(s.botMoveAt&&now>=s.botMoveAt-50&&(isBotLike(s,s.turn)||this._isAuto(s.turn))){ // AUTO-PLAY
          const pid=s.turn;
          const act=decideBotAction(s,pid); // مفوّض لـ botLogic.js — قرار حركة البوت الكامل (التقاط/رمي)
          const err=await this._process(pid,{type:"action",action:act}); // FIX — حرج: _process صارت async؛ بلا انتظار كان الناتج "وعداً" يُقيَّم دائماً كخطأ فتُرمى pass إضافية بعد كل حركة بوت
          if(err)await this._process(pid,{type:"action",action:{t:"pass"}}); // FIX
          await this._scheduleAlarm(); return;
        }
        if(now>=s.turnDeadline+600-50){
          if(g.status==="playing"&&g.state.phase==="turn"){
            this._setAuto(g.state.turn,"to"); // AUTO-PLAY — انتهى وقته دون أن يلعب: تحكم آلي فوراً (أدواره التالية يرميها البوت بلا انتظار الـ١٥ث)
            await this._process(g.state.turn,{type:"action",action:{t:"timeout"}}); // FIX
          }
          await this._scheduleAlarm(); return;
        }
      }
      if(s.phase==="waqf"&&s.waqf){
        if(s.waqf.botBidTimes){
          for(const b in s.waqf.botBidTimes){
            if(now>=s.waqf.botBidTimes[b]-50){
              const st2=g.state;
              if(g.status==="playing"&&st2.phase==="waqf"){
                const c2=pickBotBidCard(st2,b); // مفوّض لـ botLogic.js — أي ورقة يستخدمها البوت للمزايدة
                if(c2){
                  const err=await this._process(b,{type:"action",action:{t:"bid",cardId:c2.id}}); // FIX
                  if(err){ delete s.waqf.botBidTimes[b]; } // فشل التحقق لأي سبب — لا نكرر نفس المحاولة الفاشلة للأبد
                  await this._scheduleAlarm(); return;
                }
              }
            }
          }
        }
        if(now>=s.waqf.deadline+350-50){
          if(g.status==="playing"&&g.state.phase==="waqf")
            await this._process(g.state.waqf.holder,{type:"action",action:{t:"settle"}}); // FIX
          await this._scheduleAlarm(); return;
        }
      }
      }catch(e){
        // حماية جوهرية: أي استثناء غير متوقع هنا (ببوت أو تسوية أو مهلة) ما يوقف دورة المنبّه — يُسجَّل ونعيد الجدولة دائمًا
        console.log("[TRACE] استثناء داخل alarm أثناء معالجة اللعب:",e.message,e.stack);
        await this._scheduleAlarm(); return;
      }
    }
    // ما فيه شي مستحق فعلاً وقت الصحوة (منبّه بدري أو حالة تغيّرت) — أعد الجدولة الصحيحة (ننتظرها مباشرة، مو fire-and-forget، لأننا أصلاً بدالّة async)
    if(g.status==="playing"&&g.state){
      this._replaceDisconnectedWithBots(); // NEW CODE — نفس منطق _armBots، موحَّد بدالة مشتركة بدل تكرار الحلقة هنا مرة ثانية
      if(this._checkTeamForfeit())this._broadcast(); // NEW CODE — لا بث آخر بهذا الفرع أصلاً، فنضمن وصول نتيجة الانسحاب فوراً لا الانتظار لحدث لاحق
    }
    await this._scheduleAlarm();
    }catch(e){
      // شبكة أمان أخيرة على مستوى الدالة كاملة — أي استثناء ما تمت تغطيته بمكان تاني، على الأقل نضمن محاولة إعادة الجدولة بدل ما يتوقف العنصر تمامًا
      console.log("[TRACE] استثناء عام غير متوقع بـalarm:",e.message,e.stack);
      try{ await this._scheduleAlarm(); }catch(e2){ console.log("[TRACE] فشلت حتى إعادة الجدولة الاحتياطية:",e2.message); }
    }
  }
  // HIBERNATION — معالجات اتصالات السُبات: نفس منطق المستمعات القديمة حرفياً، منقولة لمعالجات الصنف الرسمية
  async webSocketMessage(ws,data){
    let msg; try{msg=JSON.parse(data)}catch(e){ try{ws.send(JSON.stringify({type:"error",error:"invalid json"}))}catch(_){} return; }
    if(msg.type==="join"){
      const pid=String(msg.playerId||"").slice(0,64);
      if(!pid){ try{ws.send(JSON.stringify({type:"error",error:"playerId required"}))}catch(_){} return; }
      try{ ws.serializeAttachment({pid}); }catch(e){} // HIBERNATION — الهوية على الاتصال نفسه، تنجو من النوم
      this.lastSeen.set(pid,Date.now());
      try{
        const err=await this._process(pid,msg);
        if(err)ws.send(JSON.stringify(err));
        else ws.send(JSON.stringify(this._stateFor(pid)));
      }catch(e){ console.log("[TRACE] استثناء بمعالجة join:",e.message,e.stack); try{ws.send(JSON.stringify({type:"error",error:"خطأ داخلي — حاول ثانية"}))}catch(e2){} }
      return;
    }
    const pid=this._wsPid(ws);
    if(!pid){ try{ws.send(JSON.stringify({type:"error",error:"join first"}))}catch(_){} return; }
    this.lastSeen.set(pid,Date.now());
    try{
      const err=await this._process(pid,msg);
      if(err)ws.send(JSON.stringify(err));
    }catch(e){ console.log("[TRACE] استثناء بمعالجة",msg&&msg.type,":",e.message,e.stack); try{ws.send(JSON.stringify({type:"error",error:"خطأ داخلي — حاول ثانية"}))}catch(e2){} }
  }
  _dropWs(ws){ // HIBERNATION — منطق drop القديم حرفياً، بمصدر اتصالات المنصة
    const pid=this._wsPid(ws);
    if(pid&&this.game.status==="playing"){ // AUTO-PLAY — استلام فوري لحظة الإغلاق (المواصفة: بلا انتظار مهلة الحضور)
      const still=this._sockets().some(o=>o!==ws&&this._wsPid(o)===pid); // AUTO-PLAY
      if(!still)this._setAuto(pid,"dc"); // AUTO-PLAY — يبثّها _bump أدناه
    } // AUTO-PLAY
    // انقطع قبل ما تبدأ الجولة؟ حرّر مقعده باللوبي كي ما يعلق مكانه فاضياً على أحد
    if(pid&&this.game.status==="lobby"){
      const g=this.game, i=g.seats.indexOf(pid);
      const stillConnected=this._sockets().some(o=>o!==ws&&this._wsPid(o)===pid); // HIBERNATION — اتصال آخر لنفس اللاعب؟ (نستثني الاتصال المُغلق نفسه)
      if(i>=0&&!stillConnected){ g.seats.splice(i,1); delete g.names[pid]; this.ctx.waitUntil(this._syncActiveRoomListing()); } // NEW CODE — قائمة الجلسات النشطة: مقعد تحرّر
    }
    this._bump();
  }
  async webSocketClose(ws){ this._dropWs(ws); }
  async webSocketError(ws){ this._dropWs(ws); try{ws.close()}catch(e){} }
  async fetch(request){
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{
      "access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"}});
    const url=new URL(request.url);
    if(!this.roomId){
      const m=url.pathname.match(/\/ws\/([^\/?]+)/);
      this.roomId=m?m[1]:"";
      if(this.roomId){ try{ this.ctx.storage.put("roomId",this.roomId); }catch(e){} } // HIBERNATION — يُحفظ ليُستعاد بعد أي استيقاظ بلا طلب HTTP
    }
    if((request.headers.get("Upgrade")||"").toLowerCase()==="websocket"){
      const pair=new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]); // HIBERNATION — الاستقبال الرسمي بواجهة السُبات: الاتصال بيد المنصة، الغرفة تنام وهو حي، وأي رسالة توقظها لمعالجات الصنف أدناه (webSocketMessage/Close/Error)
      return new Response(null,{status:101,webSocket:pair[0]});
    }
    const pid=String(url.searchParams.get("pid")||"").slice(0,64);
    if(url.searchParams.get("send")==="1"&&request.method==="POST"){
      if(!pid)return json({type:"error",error:"pid required"});
      this.lastSeen.set(pid,Date.now());
      let msg; try{msg=await request.json()}catch(e){return json({type:"error",error:"invalid json"})}
      try{
        const err=await this._process(pid,msg); // FIX
        return json(err||{ok:true,seq:this.seq});
      }catch(e){ console.log("[TRACE] استثناء بمعالجة POST",msg&&msg.type,":",e.message,e.stack); return json({type:"error",error:"خطأ داخلي — حاول ثانية"}); }
    }
    if(url.searchParams.get("poll")==="1"){
      if(!pid)return json({type:"error",error:"pid required"});
      this.lastSeen.set(pid,Date.now());
      await this._catchUpOverdue(); // منبّه كلاودفلير قد يتأخر بالواقع — أي استطلاع من لاعب يعالج الحركات المستحقة فورًا
      const since=parseInt(url.searchParams.get("since")||"0",10)||0;
      // FIX — خفض فاتورة "مدة بقاء الكائن نشطاً" جذرياً: الإمساك الطويل (12ث لكل طلب استطلاع) كان يحاسبنا
      // مدةً كاملة عن كل ثانية إمساك × كل عميل مستطلع. العملاء المحدّثون يرسلون nowait=1 فيُرَدّ عليهم فوراً
      // (صفر إمساك — الإيقاع صار عندهم بفواصل قصيرة بالعميل نفسه)؛ والعملاء القدامى (كاش قديم) نمسكهم
      // 1.5ث فقط بدل 12 — يمنعهم من الدوران المحموم ويقص مدتهم 8×، مع بقاء "الدفع الفوري" داخل المهلة
      // القصيرة (أي تغيّر حالة يحرّر المنتظرين فوراً عبر _bump كما كان).
      if(this.seq<=since&&url.searchParams.get("nowait")!=="1"){ // FIX
        await new Promise(resolve=>{
          const w={resolve};
          this.waiters.push(w);
          setTimeout(()=>{const i=this.waiters.indexOf(w);if(i>=0)this.waiters.splice(i,1);resolve();},1500); // FIX — كانت POLL_WAIT_MS (12000)
        });
      }
      if(this.seq<=since)return json({seq:this.seq,msg:null});
      return json({seq:this.seq,msg:this._stateFor(pid)});
    }
    return new Response("waggif table server",{status:200});
  }
}

function json(o){return new Response(JSON.stringify(o),{status:200,headers:{"content-type":"application/json","access-control-allow-origin":"*"}})}

// ================= Worker الرئيسي: يوجّه كل طلب إلى طاولته =================
// كل غرفة (roomId) لها DurableObject خاص بها عبر idFromName — فأي لاعبَين
// يطلبان نفس roomId يصلان لنفس الطاولة تلقائياً (هذا سرّ التقاء اللاعبين).
export default {
  async scheduled(event, env, ctx){
    // يعمل حسب جدول Cron بـwrangler.toml — كل خميس 4ص UTC (7ص بتوقيت السعودية)
    ctx.waitUntil(distributeWeeklyPrizes(env).catch(e=>console.error("weekly prize error:",e.message)));
  },
  async fetch(request, env){
    const url = new URL(request.url);
    // CORS المبكّر
    if(request.method==="OPTIONS"){
      return new Response(null,{status:204,headers:{
        "access-control-allow-origin":"*",
        "access-control-allow-methods":"GET,POST,OPTIONS",
        "access-control-allow-headers":"content-type,upgrade,authorization" // FIX — أضفنا authorization: /user-mini-profile يرسلها كترويسة، والمتصفح يحجب الطلب بالكامل لو ما كانت مسموحة صراحة بردّ الـpreflight
      }});
    }
    // مسار الصحة: للتأكد أن الخادم حي + أي نسخة كود منشورة فعليًا الآن (بمعزل عن أي طاولة/Durable Object محدّد)
    if(url.pathname==="/" || url.pathname==="/health"){
      return new Response(JSON.stringify({ok:true,service:"waggif-baloot-table",version:SERVER_VERSION,ts:Date.now()}),
        {status:200,headers:{"content-type":"application/json","access-control-allow-origin":"*"}});
    }
    // اختبار يدوي لتوزيع جوائز الأسبوع (بدون انتظار موعد الخميس) — يحتاج رمز التحقق بالاستعلام
    if(url.pathname==="/admin/test-weekly-prizes"){
      if(url.searchParams.get("key")!=="wg-test-9214")
        return new Response("unauthorized",{status:401,headers:{"access-control-allow-origin":"*"}});
      try{
        const result=await distributeWeeklyPrizes(env);
        return json(result);
      }catch(e){
        return json({ok:false,error:e.message});
      }
    }
    // NEW CODE — دخول التطبيق بجوجل عبر المتصفح: الموقع (متصفح حقيقي) يسلّم هويته الموثّقة هنا مع رمز
    // الربط اللي ولّده التطبيق، فنسكّ له رمزاً مخصصاً ونخزّنه بانتظار استطلاع التطبيق — أحادي الاستخدام، ٣ دقائق
    if(url.pathname==="/auth/app-handoff"&&request.method==="POST"){ // NEW CODE
      try{ // NEW CODE
        const body=await request.json(); // NEW CODE
        const handoff=(body.handoff||"").toString(); // NEW CODE
        if(!/^[A-Za-z0-9_-]{16,64}$/.test(handoff))return json({ok:false,error:"bad-handoff"}); // NEW CODE
        const {token,projectId}=await getFirebaseAccessToken(env); // NEW CODE
        const uid=body.idToken?await verifyFirebaseIdToken(body.idToken,projectId):null; // NEW CODE — توقيع Google هو مصدر الثقة الوحيد، كالعادة
        if(!uid)return json({ok:false,error:"unauthorized"}); // NEW CODE
        const customToken=await mintCustomToken(env,uid); // NEW CODE
        await storeAppLoginToken(token,projectId,handoff,customToken); // NEW CODE
        return json({ok:true}); // NEW CODE
      }catch(e){ console.log("[TRACE] /auth/app-handoff فشلت —",e.message); return json({ok:false,error:"server-error"}); } // NEW CODE
    } // NEW CODE
    // NEW CODE — التطبيق يستطلع برمز ربطه: pending حتى يصل من الموقع، ثم الرمز مرة واحدة فقط (يُحذف فوراً)
    if(url.pathname==="/auth/app-token"){ // NEW CODE
      try{ // NEW CODE
        const handoff=(url.searchParams.get("handoff")||"").toString(); // NEW CODE
        if(!/^[A-Za-z0-9_-]{16,64}$/.test(handoff))return json({ok:false,error:"bad-handoff"}); // NEW CODE
        const {token,projectId}=await getFirebaseAccessToken(env); // NEW CODE
        const r=await takeAppLoginToken(token,projectId,handoff); // NEW CODE
        return json(r); // NEW CODE
      }catch(e){ return json({ok:true,pending:true}); } // NEW CODE — أي عطل عابر = استمر بالاستطلاع، لا تكسر التدفق
    } // NEW CODE
    // FIX — استلام هدية عامة: نقطة HTTP مستقلة (لا Durable Object، بمعزل عن أي طاولة/غرفة) — يلزم رمز
    // هوية Firebase صالح، والتحقق الفعلي من claimedBy يصير بالكامل بـclaimGlobalGift (db.js)، لا بالعميل أبداً
    if(url.pathname==="/claim-gift"&&request.method==="POST"){
      try{
        const body=await request.json();
        const giftId=(body.giftId||"").toString().slice(0,200);
        if(!giftId)return json({ok:false,error:"missing-gift-id"});
        const {token,projectId}=await getFirebaseAccessToken(env);
        const uid=body.idToken?await verifyFirebaseIdToken(body.idToken,projectId):null; // FIX — uid نص مباشرة، لا كائن
        if(!uid)return json({ok:false,error:"unauthorized"});
        const result=await claimGlobalGift(token,projectId,giftId,uid);
        return json(result);
      }catch(e){
        console.log("[TRACE] /claim-gift فشلت —",e.message);
        return json({ok:false,error:"server-error"});
      }
    }
    // FIX — مكافأة الدخول اليومية: نقطة HTTP مستقلة (لا Durable Object) — كانت بالكامل محلية بالعميل (لا
    // أي تحقق سيرفري)، وهذا كان السبب الجذري لمشاهدة "استُلمت" بلا أي زيادة فعلية بالرصيد المحفوظ فعلاً
    if(url.pathname==="/claim-daily"&&request.method==="POST"){ // FIX
      try{ // FIX
        const body=await request.json(); // FIX
        const {token,projectId}=await getFirebaseAccessToken(env); // FIX
        const uid=body.idToken?await verifyFirebaseIdToken(body.idToken,projectId):null; // FIX
        if(!uid)return json({ok:false,error:"unauthorized"}); // FIX
        const result=await claimDailyReward(token,projectId,uid); // FIX
        return json(result); // FIX
      }catch(e){ // FIX
        console.log("[TRACE] /claim-daily فشلت —",e.message); // FIX
        return json({ok:false,error:"server-error"}); // FIX
      } // FIX
    } // FIX
    // FIX — إعلان المكافأة: ٣٠٠ ذهب كل ساعة كحد أقصى، نفس نمط /claim-daily بالضبط
    if(url.pathname==="/claim-ad-reward"&&request.method==="POST"){ // FIX
      try{ // FIX
        const body=await request.json(); // FIX
        const {token,projectId}=await getFirebaseAccessToken(env); // FIX
        const uid=body.idToken?await verifyFirebaseIdToken(body.idToken,projectId):null; // FIX
        if(!uid)return json({ok:false,error:"unauthorized"}); // FIX
        const result=await claimAdReward(token,projectId,uid); // FIX
        return json(result); // FIX
      }catch(e){ // FIX
        console.log("[TRACE] /claim-ad-reward فشلت —",e.message); // FIX
        return json({ok:false,error:"server-error"}); // FIX
      } // FIX
    } // FIX
    // NEW CODE — ملف مصغّر لاعب آخر: نقطة GET مستقلة (لا Durable Object)، القراءة الفعلية بالكامل
    // بـgetMiniProfile (db.js) — هنا فقط تحقق الهوية + التوجيه، بلا أي منطق قاعدة بيانات
    if(url.pathname==="/user-mini-profile"&&request.method==="GET"){ // NEW CODE
      try{ // NEW CODE
        const targetUid=(url.searchParams.get("uid")||"").slice(0,128); // NEW CODE
        if(!targetUid)return json({ok:false,error:"missing-uid"}); // NEW CODE
        const {token,projectId}=await getFirebaseAccessToken(env); // NEW CODE
        const authHeader=request.headers.get("authorization")||""; // NEW CODE
        const idToken=authHeader.startsWith("Bearer ")?authHeader.slice(7):null; // NEW CODE
        // قد يكون null (مشاهد غير مسجّل) — لا نرفض الطلب لأجله، فقط لا نحسب حالة الصداقة له
        const viewerUid=idToken?await verifyFirebaseIdToken(idToken,projectId):null; // NEW CODE
        const result=await getMiniProfile(token,projectId,targetUid,viewerUid); // NEW CODE
        return json(result); // NEW CODE
      }catch(e){ // NEW CODE
        console.log("[TRACE] /user-mini-profile فشلت —",e.message); // NEW CODE
        return json({ok:false,error:"server-error"}); // NEW CODE
      } // NEW CODE
    } // NEW CODE
    // مسار الطاولات: /ws/<roomId> — نستخرج roomId ونوجّه لطاولته
    const m = url.pathname.match(/\/ws\/([^\/?]+)/);
    if(!m){
      return new Response("not found",{status:404,headers:{"access-control-allow-origin":"*"}});
    }
    const roomId = m[1].slice(0,64);
    // idFromName يعطي نفس المعرّف لنفس الاسم دائماً → نفس الطاولة لكل اللاعبين
    const id = env.GAME.idFromName(roomId);
    const stub = env.GAME.get(id);
    // مرّر الطلب كما هو للطاولة (تتولّى WebSocket والاستطلاع)
    return stub.fetch(request);
  }
};
