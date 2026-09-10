'use strict';
// Real server data only. No demo roster, simulated results or client balance writes.
const LG={open:false,screen:'list',kind:'official',tab:'overview',data:null,league:null,busy:false,timer:null,requestId:null,clockOffset:0,drafts:{},chatId:null,chatLast:null,viewportCleanup:null,routeSeq:0,readSeq:0,readController:null,animation:null,actionError:'',registration:null};
const lgNewId=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
const lgNum=n=>new Intl.NumberFormat('en-US').format(Number(n)||0),lgEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lgStatus={scheduled:'التسجيل يفتح قريبًا',funding:'جارٍ تأكيد الإنشاء',registration:'التسجيل مفتوح',playing:'الدوري جارٍ',paying:'جارٍ صرف الجوائز',finished:'انتهى الدوري',cancelled:'أُلغي الدوري',cancelling:'جارٍ إعادة الرسوم'};
const lgDate=t=>new Intl.DateTimeFormat('ar-SA-u-nu-latn',{timeZone:'Asia/Riyadh',calendar:'gregory',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
function lgTime(t){const d=Math.max(0,Math.ceil((t-Date.now()-LG.clockOffset)/1000));return [Math.floor(d/3600),Math.floor(d/60)%60,d%60].map(x=>String(x).padStart(2,'0')).join(':');}
const lgPaths={cup:'M8 3h8v5a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-6-3h4v3',chat:'M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0ZM7 10h10M7 14h6',bracket:'M3 3h6v4H3zM3 17h6v4H3zM15 10h6v4h-6zM9 5h3v14H9m3-7h3',people:'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2m0-17a4 4 0 0 1 0 8m3 3a6 6 0 0 1 3 5',lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4m-4 5v2',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v1',copy:'M9 9h12v12H9zM5 15H3V3h12v2',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14',refresh:'M20 5v6h-6m6 0a8 8 0 1 0-2 7',back:'m9 5 7 7-7 7'};
function lgSvg(name){return '<svg class="lg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(lgPaths[name]||lgPaths.cup)+'"/></svg>';}
const lgIcon=()=>'<span class="lg-trophy" aria-hidden="true">'+lgSvg('cup')+'</span>';
function lgPerson(p){return `<div class="lg-person"><span class="lg-avatar">${p.bot?lgSvg('people'):avatarHTML(String(p.avatar||'').replace(/[<>"']/g,''),36)}</span><div><strong>${lgEsc(p.name)}</strong><small>${p.bot?'كمبيوتر · مقعد متاح':lgEsc(typeof rankFor==='function'?rankFor(p.rank||0).name:'')}</small></div></div>`;}
function lgRankName(points){
 const ranks=LG.data?.ranks;
 const rank=Array.isArray(ranks)?ranks.filter(r=>points>=r[1]).slice(-1)[0]:null;
 return rank?rank[0]:typeof rankFor==='function'?rankFor(points).name:'';
}
function lgRankRule(l,personal=false){
 const min=Number(l.minRank)||0,max=l.maxRank!=null&&Number.isFinite(Number(l.maxRank))?Number(l.maxRank):100000000;
 const limited=max<100000000,label=min===0&&!limited?'متاح لجميع الرتب':lgRankName(min)+(limited?' إلى '+lgRankName(max):' فأعلى');
 const range='الحد الأدنى: '+lgNum(min)+' نقطة'+(limited?' · الحد الأعلى: '+lgNum(max)+' نقطة':'');
 let note='';
 // Local rank is a visible hint only. Admission always rechecks the server's current rank.
 if(personal&&typeof ST!=='undefined'&&FB.user){
  const points=ST.n('rank'),below=points<min,above=points>max;
  note='<p class="lg-rank-status'+(below||above?' is-outside':'')+'">رتبتك الحالية: '+lgEsc(lgRankName(points))+' · '+lgNum(points)+' نقطة'+(below?'<br>تحتاج '+lgNum(min-points)+' نقطة إضافية لبلوغ الحد الأدنى.':above?'<br>رتبتك أعلى من الحد المسموح لهذا الدوري.':'')+'</p>';
 }
 return '<div class="lg-rank-rule"><strong>رتب المشاركة · '+lgEsc(label)+'</strong><small>'+range+'</small>'+note+'</div>';
}
function lgActionError(message=''){
 LG.actionError=message;let box=document.getElementById('lgActionError');
 if(!box&&message){const hub=document.getElementById('leagueHub');box=document.createElement('p');box.id='lgActionError';box.setAttribute('role','alert');hub.insertBefore(box,document.getElementById('lgScroll'));}
 if(box){box.textContent=message;box.hidden=!message;if(message&&LG.open){box.setAttribute('tabindex','-1');box.focus?.();}}
}
function lgRegistrationNote(l){
 const r=LG.registration;if(!r||r.id===l?.id)return '';
 const status=r.registrationStatus==='refund'?'جارٍ إلغاء مشاركتك في':r.registrationStatus==='pending'?'جارٍ تأكيد تسجيلك في':'أنت مسجل في';
 return '<aside class="lg-registration-note"><p>'+status+' «'+lgEsc(r.name)+'». يمكنك التسجيل في دوري واحد فقط. '+(r.status==='registration'&&r.registrationStatus==='paid'?'ألغِ تسجيلك قبل البداية أو انتظر انتهاء الدوري.':'انتظر اكتمال المشاركة أو العملية الحالية.')+'</p><button data-lg="detail" data-id="'+lgEsc(r.id)+'">عرض دوريّك</button></aside>';
}
function lgRememberRegistration(registration){
 if(registration===undefined)return;
 const uid=FB.user?.uid;
 if(uid&&LG_AUTO.uid!==uid)lgAutoReset(uid);
 LG.registration=registration||null;if(!uid)return;
 if(registration&&(['registration','playing'].includes(registration.status)||['pending','refund'].includes(registration.registrationStatus))){
  if(!LG_AUTO.entry||LG_AUTO.entry.id!==registration.id){LG_AUTO.entry={...registration};LG_AUTO.checked=false;LG_AUTO.nextAt=0;LG_AUTO.errors=0;LG_AUTO.blocked=false;LG_AUTO.blockedReason=null;}
 }else{const wasHome=LG_AUTO.wasHome;lgAutoStop();LG_AUTO.wasHome=wasHome;LG_AUTO.entry=null;LG_AUTO.nextAt=0;LG_AUTO.checked=true;LG_AUTO.blocked=false;LG_AUTO.blockedReason=null;}
 lgAutoLabel();
}
async function lgApi(action,extra={},signal){
 const user=FB.user;if(!user)throw Error('سجّل دخولك أولاً');
 const controller=new AbortController(),cancel=()=>controller.abort(),timeout=setTimeout(cancel,15000);
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 let abort;const stopped=new Promise((_,reject)=>{abort=()=>{const e=Error(signal?.aborted?'أُلغي التحديث':'الاتصال تأخر؛ حدّث الحالة قبل إعادة المحاولة');e.name='AbortError';reject(e);};controller.signal.addEventListener('abort',abort,{once:true});if(controller.signal.aborted)abort();});
 try{return await Promise.race([stopped,(async()=>{
  const token=await user.getIdToken();if(controller.signal.aborted)throw Error('أُلغي الطلب');
  if(FB.user?.uid!==user.uid)throw Error('تغيّر الحساب؛ افتح الصفحة مجددًا');
  const r=await fetch('https://'+GAME_SRV+'/leagues',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,idToken:token,...extra}),signal:controller.signal});
  const x=await r.json().catch(()=>null);if(!r.ok||!x?.ok){const e=Error(x?.error||'تعذّر الاتصال بالدوريات');e.code=x?.code;e.registration=x?.registration;throw e;}
  if(controller.signal.aborted)throw Error('أُلغي الطلب');if(FB.user?.uid!==user.uid)throw Error('تغيّر الحساب؛ افتح الصفحة مجددًا');if(x.now)LG.clockOffset=x.now-Date.now();return x;
 })()]);}finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',abort);}
}
function lgCancelRead(){LG.readSeq++;LG.readController?.abort();LG.readController=null;lgReading(false);}
function lgReading(value){const b=document.getElementById('lgRefresh');if(b){b.dataset.loading=String(value);b.setAttribute('aria-busy',String(value));}const status=document.getElementById('lgHeadStatus');if(status)status.textContent=value?'جارٍ التحديث…':'دوريات مجابيد';}
function lgTransition(){
 const body=document.getElementById('lgBody');LG.animation?.cancel();LG.animation=null;
 if(!body?.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 LG.animation=body.animate([{opacity:.45,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)'});
 // No animation event, timeout or network response can lock navigation.
}
function lgNavigate(screen,extra={},refresh=false){
 lgActionError();
 lgCancelRead();LG.routeSeq++;Object.assign(LG,{screen},extra);LG.chatId=null;
 if(refresh){lgShellLoading();lgRefresh();}else lgRender();lgTransition();lgAutoWake();
}
function lgShellLoading(){
 lgDock('');document.getElementById('lgTabs').hidden=LG.screen!=='list';
 document.getElementById('lgTitle').textContent=LG.screen==='detail'?'تفاصيل الدوري':LG.screen==='leaders'?'متصدرو الشهر':'الدوريات';
 document.getElementById('lgBody').innerHTML='<div class="lg-loading" role="status"><span class="lg-loading-mark">'+lgSvg('cup')+'</span>جارٍ تحميل الصفحة…</div>';
 document.getElementById('lgScroll').scrollTop=0;
 // Old controls must not act on a newly selected league while it loads.
 document.getElementById('lgTabs').innerHTML='';document.getElementById('lgNav').innerHTML='<button data-lg="list">'+lgSvg('cup')+'<span>الدوريات</span></button><button data-lg="leaders">'+lgSvg('people')+'<span>المتصدرون</span></button><button data-lg="help">'+lgSvg('info')+'<span>المساعدة</span></button>';
}
function lgViewport(){
 const e=document.getElementById('leagueHub'),v=globalThis.visualViewport;
 if(!e||!LG.open)return;
 e.style.setProperty('--lg-height',(v?v.height:innerHeight)+'px');
 e.style.setProperty('--lg-offset',(v?v.offsetTop:0)+'px');
 e.dataset.keyboard=v&&innerHeight-v.height>140?'true':'false';
}
function lgDock(html){const d=document.getElementById('lgDock');d.hidden=!html;d.innerHTML=html;}
function lgChatMessages(l){return l.chat.map(m=>`<article class="lg-message ${m.uid===FB.user.uid?'mine':''}"><div class="lg-message-meta"><strong>${lgEsc(m.name)}</strong><time>${lgEsc(new Date(m.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))}</time></div><p>${lgEsc(m.text)}</p></article>`).join('')||'<p class="lg-chat-empty">بداية السوالف عندك…</p>';}
function lgSyncChat(first=false,force=false){
 const log=document.getElementById('lgChatLog'),sc=document.getElementById('lgScroll');if(!log||!sc)return;
 const key=JSON.stringify(LG.league.chat),near=sc.scrollHeight-sc.clientHeight-sc.scrollTop<72,top=sc.scrollTop;
 if(first||key!==LG.chatLast){log.innerHTML=lgChatMessages(LG.league);if(first||near||force)sc.scrollTop=sc.scrollHeight;else sc.scrollTop=top;const b=document.getElementById('lgNewChat');if(b)b.hidden=first||near||force;LG.chatLast=key;}
 if(force){sc.scrollTop=sc.scrollHeight;const b=document.getElementById('lgNewChat');if(b)b.hidden=true;}
}
async function lgCopyCode(){
 const value=LG.league?.code;if(!value)return;
 try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(value);toast2('تم نسخ كود المشاركة');}
 catch(e){const input=document.getElementById('lgShareCode');input?.focus();input?.select();toast2('اضغط مطولًا لنسخ الكود المحدد');}
}
function lgMount(){if(document.getElementById('leagueHub'))return;const e=document.createElement('section');e.id='leagueHub';e.hidden=true;e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');e.setAttribute('aria-label','دوريات مجابيد');e.innerHTML='<header class="lg-head"><button id="lgBack" aria-label="عودة" title="عودة">'+lgSvg('back')+'<span>عودة</span></button><div class="lg-head-title"><small id="lgHeadStatus" role="status">دوريات مجابيد</small><h1 id="lgTitle">الدوريات</h1></div><button id="lgRefresh" aria-label="تحديث الحالة" title="تحديث الحالة">'+lgSvg('refresh')+'</button></header><div id="lgTabs" class="lg-tabs"></div><p id="lgActionError" role="alert" tabindex="-1" hidden></p><main id="lgScroll" class="lg-body"><div id="lgBody" class="lg-wrap"></div></main><div id="lgDock" class="lg-dock" hidden></div><nav id="lgNav" class="lg-nav" aria-label="تنقل الدوريات"></nav>';document.body.appendChild(e);e.addEventListener('click',lgClick);e.addEventListener('submit',lgSubmit);e.addEventListener('input',ev=>{if(ev.target.name==='message'&&LG.league)LG.drafts[LG.league.id]=ev.target.value;});e.addEventListener('keydown',ev=>{if(ev.key==='Escape')lgClose();if(ev.key==='Tab'){const els=[...e.querySelectorAll('button,input,select')].filter(x=>!x.disabled&&x.offsetParent!==null),first=els[0],last=els[els.length-1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last?.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first?.focus();}}});}
async function lgOpen(id){
 lgMount();if(!LG.open)LG.focus=document.activeElement;LG.open=true;
 document.getElementById('leagueHub').hidden=false;LG.viewportCleanup?.();
 const resize=()=>lgViewport();globalThis.visualViewport?.addEventListener('resize',resize);globalThis.visualViewport?.addEventListener('scroll',resize);globalThis.addEventListener?.('resize',resize);
 LG.viewportCleanup=()=>{globalThis.visualViewport?.removeEventListener('resize',resize);globalThis.visualViewport?.removeEventListener('scroll',resize);globalThis.removeEventListener?.('resize',resize);};
 lgViewport();document.getElementById('leagueHub').querySelector('#lgBack')?.focus();lgNavigate(id?'detail':'list',{tab:'overview',...(id?{league:{id}}:{})},true);
 if(LG_AUTO.entry&&LG_AUTO.errors)lgAutoWake(true);
 clearInterval(LG.timer);LG.tick=0;LG.timer=setInterval(()=>{
  if(!LG.open||document.hidden||LG.busy)return;
  document.querySelectorAll('[data-lg-time]').forEach(e=>e.textContent=lgTime(Number(e.dataset.lgTime)));
  if(++LG.tick%15===0&&!['create','help'].includes(LG.screen)&&(LG.tab==='chat'||!document.querySelector('#leagueHub input:focus')))lgRefresh(true);
 },1000);
}
function lgClose(){
 LG.open=false;LG.routeSeq++;lgCancelRead();LG.animation?.cancel();LG.animation=null;LG.viewportCleanup?.();LG.viewportCleanup=null;clearInterval(LG.timer);
 const hub=document.getElementById('leagueHub');if(hub)hub.hidden=true;LG.focus?.focus?.();lgAutoWake();
}
async function lgRefresh(silent=false){
 if(!LG.open||['create','help'].includes(LG.screen))return;
 if(silent&&LG.readController)return;lgCancelRead();
 const controller=new AbortController(),seq=LG.readSeq,route=LG.routeSeq,uid=FB.user?.uid,screen=LG.screen;
 LG.readController=controller;lgReading(true);
 const current=()=>LG.open&&seq===LG.readSeq&&route===LG.routeSeq&&FB.user?.uid===uid;
 try{
  const x=await lgApi(screen==='leaders'?'leaders':screen==='detail'?'detail':'list',screen==='detail'?{id:LG.league.id}:{},controller.signal);
  if(!current())return;
  if(screen==='leaders')LG.leaders=x;else if(screen==='detail')LG.league=x.league;else LG.data=x;
  lgRememberRegistration(screen==='detail'?x.league?.registration:x.registration);
  lgRender();lgLockActions();lgAutoWake();
 }catch(e){if(current()&&!silent&&!controller.signal.aborted){lgDock('');document.getElementById('lgBody').innerHTML=`<div class="lg-empty"><h2>تعذّر التحديث</h2><p>${lgEsc(e.message)}</p><button data-lg="retry">حاول مجددًا</button></div>`;}}
 finally{if(seq===LG.readSeq){LG.readController=null;lgReading(false);}}
}
function lgCard(l){return `<article class="lg-card"><div class="lg-kicker"><span>${lgEsc(l.kind==='official'?'دوريات مجابيد':l.kind==='private'?'دوري خاص':'دوري عام')}</span><span class="lg-badge">${lgStatus[l.status]||''}</span></div><h3>${lgEsc(l.name)}</h3>${lgRankRule(l)}<div class="lg-prizes"><div>🥇 لكل لاعب<b>${lgNum(l.prizes.firstEach)}</b><small>ذهب · البطل</small></div><div>🥈 لكل لاعب<b>${lgNum(l.prizes.secondEach)}</b><small>ذهب · الوصيف</small></div></div><div class="lg-data"><div><b>${lgNum(l.count)}/${lgNum(l.capacity)}</b><small>لاعبون مسجّلون</small></div><div><b>${lgNum(l.fee)}</b><small>رسم الدخول</small></div><div><b>${l.goal?lgNum(l.goal):'رزمة'}</b><small>نهاية المباراة</small></div></div><p class="lg-note">${lgEsc(lgDate(l.start))} · توقيت السعودية<br>الجوائز الحالية من الرسوم المحصّلة؛ تتحدث مع التسجيل.</p><footer><button class="lg-strong" data-lg="detail" data-id="${l.id}">دخول الدوري</button></footer></article>`;}
function lgRender(){
 const chat=LG.screen==='detail'&&LG.tab==='chat'&&LG.league?.canChat;document.getElementById('leagueHub').dataset.view=chat?'chat':LG.screen;const scroll=document.getElementById('lgScroll');
 if(chat&&LG.chatId===LG.league.id&&document.getElementById('lgChatForm')){lgSyncChat();return;}
 LG.chatId=null;lgDock('');const view=LG.screen+':'+(LG.league?.id||'')+':'+LG.tab+':'+LG.kind;if(LG.view!==view){scroll.scrollTop=0;LG.view=view;}
 const tabs=document.getElementById('lgTabs'),body=document.getElementById('lgBody'),nav=document.getElementById('lgNav');document.getElementById('lgTitle').textContent=LG.screen==='detail'?LG.league.name:LG.screen==='leaders'?'متصدرو الشهر':LG.screen==='create'?'إنشاء دوري':LG.screen==='help'?'المساعدة':'الدوريات';
 tabs.innerHTML=LG.screen==='list'?[['public','people','دوريات عامة'],['official','cup','دوريات مجابيد'],['private','lock','دوريات خاصة']].map(([k,i,t])=>`<button class="${LG.kind===k?'selected':''}" data-lg="kind" data-kind="${k}">${lgSvg(i)}<span>${t}</span></button>`).join(''):'';
 nav.innerHTML=LG.screen==='detail'?[['bracket','bracket','المخطط'],['overview','eye','نظرة عامة'],['chat','chat','دردشة']].map(([k,i,t])=>`<button class="${LG.tab===k?'selected':''}" data-lg="tab" data-tab="${k}">${lgSvg(i)}<span>${t}</span></button>`).join(''):`<button data-lg="list" class="${LG.screen==='list'?'selected':''}">${lgSvg('cup')}<span>الدوريات</span></button><button data-lg="leaders" class="${LG.screen==='leaders'?'selected':''}">${lgSvg('cup')}<span>المتصدرون</span></button><button data-lg="help">${lgSvg('info')}<span>المساعدة</span></button>`;
 tabs.hidden=LG.screen!=='list';
 if(LG.screen==='list'){
  const x=LG.data;if(!x)return;const list=x.leagues.filter(l=>l.kind===LG.kind&&['scheduled','registration','playing'].includes(l.status)).sort((a,b)=>a.start-b.start);body.innerHTML=`<section class="lg-hero lg-welcome">${lgIcon()}<h2>مكانك بين الأبطال</h2><p>سجّل فرديًا، والقرعة تختار شريكك.<br>كل دوري تفوز به يُضاف إلى ملفك وصدارة الشهر.</p></section>${LG.kind==='private'?'<form id="lgCodeForm" class="lg-code-form"><input name="code" placeholder="كود الدوري الخاص" aria-label="كود الدوري" maxlength="12" required><button>انضم بالكود</button></form>':''}${lgRegistrationNote()}<div class="lg-grid">${list.map(lgCard).join('')||`<div class="lg-empty">${lgSvg(LG.kind==='private'?'lock':'cup')}<h2>لا توجد دوريات هنا الآن</h2><p>${LG.kind==='official'?'ستظهر هنا دوريات مجابيد عند إعلانها.':'ابدأ دوريًا واجمع اللاعبين على طاولتك.'}</p></div>`}</div>${LG.kind!=='official'||x.admin?`<p><button class="lg-strong" style="width:100%" data-lg="create">إنشاء ${LG.kind==='official'?'دوري مجابيد':LG.kind==='private'?'دوري خاص':'دوري عام'}</button></p>`:''}`;
 }else if(LG.screen==='detail')lgDetail(body);else if(LG.screen==='leaders')lgLeaders(body);else if(LG.screen==='create')lgForm(body);else if(LG.screen==='help')lgHelp();
 lgLockActions();
}
function lgTeam(l,id){const t=l.teams.find(t=>t.id===id);return t?t.members.map(lgPerson).join(''):'<p class="lg-note">بانتظار المتأهل</p>';}
// v333 — use the current authenticated table view; the server still owns eligibility and payment.
function lgCanRequestSeat(msg){
 const v=msg.view;
 return !!(msg.league&&msg.status==='playing'&&v&&v.viewerStatus==='spectator'&&Array.isArray(v.seats)&&Array.isArray(v.humans)&&!v.seats.includes(msg.you)&&v.seats.some(pid=>!v.humans.includes(pid)));
}
function lgUpdateSeatButton(msg){
 const b=document.getElementById('lgSeatJoin');if(!b)return;
 const visible=lgCanRequestSeat(msg);b.hidden=!visible;
 document.getElementById('onl').dataset.lgCanSeat=String(visible);
 b.onclick=visible?()=>lgOpen(msg.league.id):null;
}
function lgSeatOptions(l,watching){
 if(!watching||watching.done||l.assignment||!ONL.active||ONL.league?.id!==l.id||!lgCanRequestSeat(ONL))return '';
 const v=ONL.view;
 return `<section class="lg-card lg-seat-options"><h3>انضم مكان الكمبيوتر</h3><p class="lg-note">اختر المقعد؛ تكمل بنفس الفريق واليد والكومة. رسوم الدخول ${lgNum(l.fee)} ذهب. يُراجع السيرفر رتبتك وتسجيلك وتوفر المقعد قبل الخصم.</p>${lgRankRule(l,true)}${v.seats.map((pid,index)=>v.humans.includes(pid)?'':`<button data-lg="seat" data-match="${lgEsc(watching.id)}" data-index="${index}">انضم إلى المقعد ${lgNum(index+1)} · الفريق ${lgNum(index%2+1)} · ${lgNum(l.fee)} ذهب</button>`).join('')}</section>`;
}
function lgDetail(body){const l=LG.league,registered=l.mine==='paid',canJoin=l.status==='registration'&&!registered;
 if(LG.tab==='chat'){
  body.innerHTML=l.canChat?'<div id="lgChatLog" class="lg-chat" role="log" aria-live="polite" aria-relevant="additions text"></div><button id="lgNewChat" class="lg-new-chat" data-lg="chatBottom" hidden>رسائل جديدة ↓</button>':`<div class="lg-empty">${lgSvg('lock')}<h2>الدردشة للمشاركين فقط</h2><p>سجّل في الدوري لتشاركهم الحديث.</p></div>`;
  if(l.canChat){lgDock(`<form id="lgChatForm" class="lg-chat-send"><input name="message" maxlength="240" required autocomplete="off" placeholder="رسالتك للمشاركين" aria-label="رسالتك"><button type="submit" aria-label="إرسال الرسالة">${lgSvg('send')}</button></form><p id="lgChatError" class="lg-chat-error" role="status"></p>`);document.querySelector('#lgChatForm input').value=LG.drafts[l.id]||'';LG.chatId=l.id;lgSyncChat(true);}
  return;
 }
 if(LG.tab==='bracket'){
  const rounds=l.teams.length?Array.from({length:Math.ceil(Math.log2(l.teams.length))},(_,i)=>i+1):[];body.innerHTML=rounds.length?`<p class="lg-note">اسحب المخطط لمتابعة التأهل. الجلسة التالية تبدأ بعد انتهاء مباريات الدور وفاصل 30 ثانية.</p><div class="lg-bracket">${rounds.map(r=>`<section class="lg-round"><h3>${r===rounds.length?'النهائي':r===rounds.length-1?'نصف النهائي':'الدور '+lgNum(r)}</h3>${l.matches.filter(m=>m.round===r).map(m=>`<article class="lg-match"><div class="lg-team ${m.winner===m.teams[0]?'winner':''}">${lgTeam(l,m.teams[0])}</div><div class="lg-score">${m.bye?'تأهل مباشر':(m.snapshot?.points||[0,0]).map(lgNum).join(' : ')}</div>${m.bye?'':`<div class="lg-team ${m.winner===m.teams[1]?'winner':''}">${lgTeam(l,m.teams[1])}</div>`}<p class="lg-note">${m.done?'انتهت':Date.now()+LG.clockOffset<m.readyAt?'تبدأ بعد <b data-lg-time="'+m.readyAt+'">'+lgTime(m.readyAt)+'</b>':'المباراة جارية أو تنتظر اكتمال الحضور'}</p>${!m.done?`<button data-lg="watch" data-match="${m.id}" style="width:100%">${lgSvg('eye')} شاهد المباراة</button>`:''}</article>`).join('')||'<article class="lg-match"><p>بانتظار الفرق المتأهلة</p><p class="lg-note">لم يبدأ هذا الدور بعد</p></article>'}</section>`).join('')}</div>`:`<div class="lg-empty">${lgSvg('bracket')}<h2>القرعة عند إغلاق التسجيل</h2><p>الشركاء والفرق يُختارون تلقائيًا؛ كل فريق يضم لاعبين.</p></div>`;return;
 }
 const mine=l.assignment,watching=typeof ONL!=='undefined'&&ONL.active?l.matches.find(m=>m.id===ONL.room):null;
 body.innerHTML=lgSeatOptions(l,watching)+`<section class="lg-hero lg-detail-hero">${lgIcon()}<span class="lg-badge">${lgStatus[l.status]}</span><h2>${lgEsc(l.name)}</h2><p>${lgEsc(lgDate(l.start))} · السعودية</p>${l.status==='registration'?`<b data-lg-time="${l.start}">${lgTime(l.start)}</b>`:''}</section>${l.openAt&&l.status==='scheduled'?'<p class="lg-alert">يفتح التسجيل '+lgEsc(lgDate(l.openAt))+'</p>':''}${l.pending?'<p class="lg-alert">جارٍ استكمال المزامنة. المدفوعات محفوظة ولا تحتاج دفعًا جديدًا.</p>':''}<div class="lg-card">${lgRankRule(l,true)}<div class="lg-prizes"><div>🥇 لكل بطل<b>${lgNum(l.prizes.firstEach)}</b>ذهب + 1 دوري</div><div>🥈 لكل وصيف<b>${lgNum(l.prizes.secondEach)}</b>ذهب</div></div><div class="lg-data"><div><b>${lgNum(l.count)}/${lgNum(l.capacity)}</b><small>لاعبون مسجّلون</small></div><div><b>${lgNum(l.fee)}</b><small>الدخول · ذهب</small></div><div><b>${l.goal?lgNum(l.goal):'رزمة'}</b><small>هدف المباراة · نقاط</small></div></div>${l.botCount?'<p class="lg-note">أكمل الكمبيوتر '+lgNum(l.botCount)+' مقاعد في القرعة؛ يمكن شغل مقعد متاح من صفحة المشاهدة.</p>':''}<details class="lg-rules"><summary>نظام المشاركة والجوائز</summary><p class="lg-note">شريكك تختاره القرعة. عند الموعد يُكمل الكمبيوتر المقاعد الناقصة، ويمكن لمشاهد مؤهل الدخول مكانه أثناء المباراة. يبدأ الدوري بوجود مسجل واحد على الأقل. الجوائز: 60% للفريق البطل و30% للوصيف، بالتساوي بين المقعدين. حصة الكمبيوتر لا تُصرف، ولا يحصل على لقب. رسوم الإنشاء خارج الجوائز.</p></details>${l.code?`<div class="lg-share"><label for="lgShareCode">كود المشاركة</label><input id="lgShareCode" readonly dir="ltr" value="${lgEsc(l.code)}"><button data-lg="copyCode" aria-label="نسخ كود المشاركة">${lgSvg('copy')}</button></div>`:''}${mine?`<p class="lg-alert">فريقك جاهز. ${Date.now()+LG.clockOffset<mine.readyAt?'الفاصل المتبقي <b data-lg-time="'+mine.readyAt+'">'+lgTime(mine.readyAt)+'</b>':'ادخل طاولتك الآن · مهلة الحضور 90 ثانية'}</p><button data-lg="enter" class="lg-strong" style="width:100%">العودة إلى مباراة فريقك</button>`:''}${['finished','paying'].includes(l.status)?'<h3>أبطال الدوري</h3>'+lgTeam(l,l.champion):''}${l.owner===FB.user?.uid&&l.status==='registration'?'<p><button data-lg="cancelLeague">إلغاء الدوري · رسوم الإنشاء لا تُسترد</button></p>':''}</div><h3>المشاركون</h3><div class="lg-people">${l.entries.map(p=>'<div class="lg-card">'+lgPerson(p)+'</div>').join('')||'<p>لا يوجد مسجلون بعد.</p>'}</div>`;
 if(canJoin)lgDock(lgRegistrationNote(l)+'<p class="lg-dock-note">الحد الأدنى '+lgNum(l.minRank)+' نقطة'+(l.maxRank!=null&&Number(l.maxRank)<100000000?' · الحد الأعلى '+lgNum(l.maxRank)+' نقطة':'')+'<br>تُراجع رتبتك الحالية عند التسجيل</p><button class="lg-strong" data-lg="join">تسجيل فردي · '+lgNum(l.fee)+' ذهب</button>');
 else if(registered&&l.status==='registration')lgDock('<p class="lg-dock-note">مقعدك محجوز · البداية في '+lgEsc(lgDate(l.start))+'</p><button data-lg="cancelJoin">إلغاء التسجيل واسترداد الرسوم</button>');
 else if(mine)lgDock('<button class="lg-strong" data-lg="enter">العودة إلى مباراة فريقك</button>');
}
function lgLeaders(body){const x=LG.leaders;if(!x)return;body.innerHTML=`<section class="lg-hero"><span class="lg-trophy">♛</span><h2>أبطال الشهر</h2><p dir="ltr">${lgEsc(x.month)}</p><p>عدد الدوريات الفائزة يحدد ترتيبك.<br>جوائز الشهر تُصرف تلقائيًا، والألقاب الإجمالية تبقى في ملفك.</p></section><div class="lg-data"><div><b>30,000</b><small>الأول</small></div><div><b>20,000</b><small>الثاني</small></div><div><b>15,000</b><small>الثالث</small></div></div><p class="lg-note">المراكز 4–10: لكل مركز 5,000 ذهب. عند تعادل الألقاب: الأسبق إلى العدد نفسه، ثم قرعة ثابتة عند تساوي الوقت. الجوائز لأعلى 10 لاعبين فقط.</p>${x.leaders.map(p=>`<article class="lg-leader"><em>${lgNum(p.position)}</em>${lgPerson(p)}<b>${lgNum(p.titles)}<small>دوريات</small></b><b>${lgNum(p.prize)}<small>الجائزة المتوقعة</small></b></article>`).join('')||'<div class="lg-empty">الصدارة تنتظر أول أبطال الشهر.</div>'}`;}
function lgForm(body){const official=LG.kind==='official';const ranks=LG.data.ranks;body.innerHTML=`<form id="lgCreateForm" class="lg-form"><section class="lg-hero">${lgIcon()}<h2>صمّم طريق الكأس</h2><p>${official?'دوري مجابيد · إعدادات الإدارة':'إنشاء الدوري: 4,000 ذهب · دخول اللاعب: 300 ذهب'}<br>تقدر تشارك؛ سجّل لنفسك بعد الإنشاء، مثل باقي اللاعبين.</p></section><label>اسم الدوري<input name="name" maxlength="40" required placeholder="اسم يليق بالأبطال"></label><label>موعد البداية · توقيت السعودية<input type="datetime-local" name="start" required value="${new Date(Date.now()+10800000+3600000).toISOString().slice(0,16)}"></label><div class="lg-pair"><label>عدد المقاعد<select name="capacity">${[4,8,12,14,16,24,32,64].map(n=>`<option ${n===16?'selected':''}>${n}</option>`).join('')}</select></label><label>نهاية المباراة<select name="goal"><option value="0">جلسة كاملة · الرزمة</option><option>800</option><option>1200</option></select></label></div><div class="lg-pair"><label>من رتبة<select name="minRank">${ranks.map(r=>`<option value="${r[1]}">${r[0]}</option>`).join('')}</select></label><label>إلى رتبة<select name="maxRank">${ranks.map((r,i)=>`<option value="${ranks[i+1]?ranks[i+1][1]-1:100000000}" ${i===ranks.length-1?'selected':''}>${r[0]}</option>`).join('')}</select></label></div>${official?'<label>رسوم دخول دوري النظام · للإدارة فقط<input type="number" name="fee" min="0" max="10000" value="300" required></label><label>التكرار<select name="repeat"><option value="false">مرة واحدة</option><option value="true">يوميًا بنفس الموعد</option></select></label>':'<div class="lg-fixed-fee"><strong>رسوم الدخول لكل لاعب: 300 ذهب</strong><p>ثابتة للدوريات العامة والخاصة، ولا يمكن للمنشئ تغييرها. رسوم دوريات النظام تحددها الإدارة.</p></div>'}<p class="lg-note">الإلغاء قبل البدء يعيد رسوم المشاركة. رسم إنشاء الدوري العام أو الخاص لا يُسترد. البطولة تلعب بقواعد مجابيد نفسها، والقرعة تحدد الشركاء تلقائيًا.</p><button class="lg-strong" type="submit">${official?'إنشاء دوري مجابيد':'تأكيد الإنشاء · 4,000 ذهب'}</button><p id="lgFormError" role="alert"></p></form>`;}
function lgLockActions(){
 document.querySelectorAll('#leagueHub [data-lg="join"],#leagueHub [data-lg="cancelJoin"],#leagueHub [data-lg="cancelLeague"],#leagueHub [data-lg="seat"],#leagueHub [data-lg="watch"],#leagueHub [data-lg="enter"],#leagueHub form button').forEach(b=>b.disabled=LG.busy);
}
async function lgAct(action,extra={}){
 if(LG.busy)return;LG.busy=true;lgActionError();lgCancelRead();lgLockActions();
 const uid=FB.user?.uid,route=LG.routeSeq,id=LG.league?.id;
 const current=()=>LG.open&&LG.routeSeq===route&&FB.user?.uid===uid;
 try{
  const x=await lgApi(action,{id,...extra});if(FB.user?.uid!==uid)return null;
  lgRememberRegistration(Object.prototype.hasOwnProperty.call(x.league||{},'registration')?x.league.registration:(x.league?.mine==='paid'&&['registration','playing'].includes(x.league.status)?{id:x.league.id,name:x.league.name,status:x.league.status,start:x.league.start,registrationStatus:'paid'}:undefined));
  if(['create','join','cancelJoin','cancelLeague','seat'].includes(action))fbLoadProfile(uid).then(()=>{if(FB.user?.uid===uid)refreshHome();}).catch(()=>{});
  if(action==='chat'&&x.league){
   if(LG.drafts[x.league.id]===String(extra.message))LG.drafts[x.league.id]='';
   const input=current()?document.querySelector('#lgChatForm input'):null;if(input&&input.value===String(extra.message))input.value='';
  }
  if(action==='create')localStorage.removeItem('lg-create-'+uid);
  if(!current())return x;
  if(x.league){LG.league=x.league;LG.screen='detail';if(action!=='chat'){LG.tab='overview';lgTransition();}}
  if(x.room){lgEnter(x.room,action==='watch');return x;}
  lgRender();if(action==='chat')lgSyncChat(false,true);return x;
 }catch(e){if(current()){if(action==='chat'){const error=document.getElementById('lgChatError');if(error)error.textContent=e.message;}else{if(e.registration){lgRememberRegistration(e.registration);lgRender();}lgActionError((action==='join'?'تعذّر التسجيل: ':'')+e.message);}toast2(e.message);}return null;}
 finally{LG.busy=false;lgLockActions();if(FB.user?.uid===uid)lgAutoWake(['join','cancelJoin','cancelLeague','seat'].includes(action));}
}
function lgEnter(room,spectate=false){lgClose();if(ONL.active&&ONL.room!==room)leaveOnline();ONL.pendingTier=null;ONL.pendingMode='team';const p=new URLSearchParams({room});if(spectate)p.set('spectate','1');history.replaceState(null,'',location.pathname+'?'+p);if(ONL.active&&ONL.room===room){const wasSpectator=ONL.spectateOnly;ONL.spectateOnly=spectate;show('onl');if(wasSpectator&&!spectate)withIdToken({type:'join',playerId:ONL.pid,name:localStorage.getItem('wb-name')||'',avatar:myAvatar()}).then(oSend);return;}enterOnline();}
function lgHelp(){document.getElementById('lgBody').innerHTML='<section class="lg-card"><h3>طريقك إلى اللقب</h3><p>يمكنك التسجيل في دوري واحد فقط. ألغِ مشاركتك قبل بدايته أو انتظر انتهاءه لتسجل في دوري آخر.</p><p>تسجل فرديًا، وتُختار الفرق بالقرعة. كل فريق لاعبان، والخاسر يخرج. المقاعد الناقصة يكملها الكمبيوتر عند الموعد، ويستطيع المشاهدون شغلها لاحقًا. إذا كان عدد الفرق لا يملأ المخطط، تمنح القرعة تأهلًا مباشرًا لبعض الفرق.</p><p>بين الأدوار 30 ثانية. مهلة دخول الطاولة 90 ثانية؛ إذا انتهت يكمل الكمبيوتر مكانك ولا تعود للجولة نفسها. أثناء اللعب، الغياب يتحول إلى تحكم تلقائي، وبعد 3 أدوار لعب يستبدلك الكمبيوتر. يستطيع مشاهد مؤهل دخول مقعد الكمبيوتر برسوم الدخول.</p><p>الشريك الموجود يكمل مع الكمبيوتر. إذا غاب الفريق كاملًا، مهلة 90 ثانية قبل الخسارة بالانسحاب.</p><p>تبدأ صدارة جديدة الساعة 00:00 السعودية أول كل شهر. إجمالي ألقابك يبقى دائمًا.</p></section>';}
function lgClick(ev){
 const b=ev.target.closest('button');if(!b||b.disabled)return;const a=b.dataset.lg;
 if(b.id==='lgBack'){if(LG.screen==='list')lgClose();else lgNavigate('list',{},true);return;}
 if(b.id==='lgRefresh'||a==='retry'){lgRefresh();return;}
 if(a==='kind')lgNavigate('list',{kind:b.dataset.kind},!LG.data);
 else if(a==='list'||a==='leaders')lgNavigate(a,{},true);
 else if(a==='detail')lgNavigate('detail',{league:{id:b.dataset.id},tab:'overview'},true);
 else if(a==='tab'){if(LG.league?.name)lgNavigate('detail',{tab:b.dataset.tab});}
 else if(a==='copyCode')lgCopyCode();
 else if(a==='chatBottom')lgSyncChat(false,true);
 else if(a==='create'){
  if(LG.busy)return;LG.requestId=localStorage.getItem('lg-create-'+FB.user.uid)||lgNewId();localStorage.setItem('lg-create-'+FB.user.uid,LG.requestId);lgNavigate('create');
 }else if(a==='help')lgNavigate('help');
 else if(!LG.busy&&a==='enter')lgEnter(LG.league.assignment.room);
 else if(['watch','seat','join','cancelJoin','cancelLeague'].includes(a))lgAct(a,{match:b.dataset.match,index:Number(b.dataset.index)});
}
async function lgSubmit(ev){ev.preventDefault();if(LG.busy)return;const f=ev.target,v=Object.fromEntries(new FormData(f));if(f.id==='lgCodeForm')return lgAct('code',{code:v.code});if(f.id==='lgChatForm'){const error=document.getElementById('lgChatError');if(error)error.textContent='';await lgAct('chat',{message:v.message});return;}if(f.id==='lgCreateForm'){v.start=Date.parse(v.start+':00+03:00');for(const k of ['capacity','goal','minRank','maxRank','fee'])if(v[k]!==undefined)v[k]=Number(v[k]);v.repeat=v.repeat==='true';await lgAct('create',{...v,kind:LG.kind,requestId:LG.requestId});}}
async function uiLeagueProfile(uid){let box=document.getElementById('lgProfile');if(!box){box=document.createElement('div');box.id='lgProfile';box.className='lg-profile';document.getElementById('pfRankProgress').insertAdjacentElement('afterend',box);}box.dataset.uid=uid||'';box.innerHTML='<span>🏆</span><div>ألقاب الدوريات<small>جارٍ التحديث…</small></div>';if(!uid){box.hidden=true;return;}box.hidden=false;try{const {profile:p}=await lgApi('profile',{uid});if(box.dataset.uid!==uid)return;box.innerHTML=`<span>🏆</span><div><b>${lgNum(p.total)} دوري</b><small>${lgNum(p.monthly)} خلال الشهر الحالي</small></div>`;}catch(e){if(box.dataset.uid===uid)box.innerHTML='<span>🏆</span><div>ألقاب الدوريات<small>تعذّر تحديث العدد</small></div>';}}
function uiLeagueState(msg){
 lgUpdateSeatButton(msg);
 const t=msg.league,e=document.getElementById('onl');e.dataset.league=t?'true':'false';if(!t){document.getElementById('uiOnlineTitle').onclick=null;document.getElementById('lgResultBack')?.remove();if(e._lgLobbyChanged){const wait=document.getElementById('onlWait');wait.querySelector('h2').textContent='طاولة الأصدقاء';wait.querySelector('.sub').textContent='أرسل الرابط لأصدقائك (حتى 3) — والبوتات تكمّل الناقص';e._lgLobbyChanged=false;}return;}
 document.getElementById('uiOnlineTitle').textContent=t.name;document.getElementById('uiOnlineTitle').onclick=()=>lgOpen(t.id);document.getElementById('uiOnlineMode').textContent='دوري · الدور '+t.round+' · '+(t.goal?lgNum(t.goal)+' نقطة':'الرزمة كاملة');
 if(msg.status==='lobby'){e._lgLobbyChanged=true;const wait=document.getElementById('onlWait');wait.querySelector('h2').textContent='طاولة الدوري';wait.querySelector('.sub').textContent='شريكك ومقعدك تحددهما القرعة';document.getElementById('lobbyHint').textContent=Date.now()+LG.clockOffset<t.readyAt?'استراحة بين الأدوار · '+lgTime(t.readyAt):'بانتظار حضور اللاعبين · المهلة 90 ثانية';}
 if(msg.status==='over'){const card=document.querySelector('#oOver #resCard');let b=document.getElementById('lgResultBack');if(!b){b=document.createElement('button');b.id='lgResultBack';b.textContent='متابعة الدوري والمخطط';card.appendChild(b);}b.onclick=()=>lgOpen(t.id);document.getElementById('oResultKind').textContent='نتيجة مباراة الدوري';document.getElementById('oResSub').textContent='تابع التأهل والجوائز من صفحة الدوري. الجوائز تُصرف بعد النهائي.';}
}
document.getElementById('hTournament').onclick=()=>lgOpen();

// Home-only admission checks. Timers belong to the visible client, never to a room alarm.
const LG_AUTO={uid:null,seq:0,controller:null,timer:null,nextAt:0,checked:false,entry:null,blocked:false,blockedReason:null,wasHome:false,lastRoom:null,lastAttempt:0,entering:false,errors:0};
function lgAutoReset(uid){lgAutoStop();Object.assign(LG_AUTO,{uid,nextAt:0,checked:false,entry:null,blocked:false,blockedReason:null,lastRoom:null,lastAttempt:0,errors:0});LG.registration=null;}
function lgAutoAllowed(){
 const home=document.getElementById('home');
 const ownLeague=ONL.room?.startsWith('lg-')&&ONL.league&&(!LG_AUTO.entry||ONL.league.id===LG_AUTO.entry.id);
 return !!(FB.user&&home&&!home.classList.contains('hidden')&&!document.hidden&&!LG.busy&&!(LG.open&&LG.screen==='create')&&!(ONL.active&&!ONL.spectateOnly&&!['over','closed'].includes(ONL.status)&&!ownLeague));
}
function lgAutoStop(){clearTimeout(LG_AUTO.timer);LG_AUTO.timer=null;LG_AUTO.seq++;LG_AUTO.controller?.abort();LG_AUTO.controller=null;LG_AUTO.wasHome=false;}
function lgAutoLabel(){
 const small=document.getElementById('hTournament')?.querySelector('.cupButtonText small');if(!small)return;
 small.textContent=LG_AUTO.blocked?(LG_AUTO.blockedReason==='league-arrival'?'انتهت مهلة حضور الجولة · تتابع الدوري':'تتابع الدوري · بانتظار الجولة التالية'):LG_AUTO.entry?(LG_AUTO.errors?'تعذّر الاتصال بالدوري · افتحه لإعادة المحاولة':LG_AUTO.entry.registrationStatus==='pending'?'جارٍ تأكيد تسجيلك في الدوري':LG_AUTO.entry.registrationStatus==='refund'?'جارٍ إلغاء التسجيل واسترداد الرسوم':LG_AUTO.entry.status==='registration'?'مسجل · دخول تلقائي عند بداية الدوري':'مسجل · بانتظار مباراة فريقك'):'دوريات مجابيد · عامة · خاصة';
}
function lgAutoSchedule(delay){
 clearTimeout(LG_AUTO.timer);LG_AUTO.timer=setTimeout(()=>{LG_AUTO.timer=null;lgAutoWake();},Math.min(86400000,Math.max(1000,delay)));
}
function lgAutoWake(force=false){
 const uid=FB.user?.uid||null;
 if(uid!==LG_AUTO.uid){lgAutoReset(uid);lgAutoLabel();}
 if(!lgAutoAllowed()){lgAutoStop();return;}
 const returned=!LG_AUTO.wasHome;LG_AUTO.wasHome=true;
 if(force){LG_AUTO.seq++;LG_AUTO.controller?.abort();LG_AUTO.controller=null;LG_AUTO.checked=false;LG_AUTO.nextAt=0;}
 else if(returned){LG_AUTO.checked=false;LG_AUTO.nextAt=0;}
 if(LG_AUTO.controller||LG_AUTO.entering)return;
 if(LG_AUTO.checked&&!LG_AUTO.nextAt)return;
 if(LG_AUTO.nextAt>Date.now()){lgAutoSchedule(LG_AUTO.nextAt-Date.now());return;}
 lgAutoCheck();
}
async function lgAutoCheck(){
 if(!lgAutoAllowed()||LG_AUTO.controller)return;
 clearTimeout(LG_AUTO.timer);LG_AUTO.timer=null;
 const uid=FB.user.uid,seq=++LG_AUTO.seq,controller=new AbortController();LG_AUTO.controller=controller;
 const current=()=>seq===LG_AUTO.seq&&FB.user?.uid===uid&&lgAutoAllowed();
 try{
  const x=await lgApi('myMatch',{},controller.signal);if(!current())return;
  LG_AUTO.checked=true;LG_AUTO.errors=0;LG_AUTO.entry=x.entry;LG_AUTO.blocked=!!x.blocked;LG_AUTO.blockedReason=x.blockedReason||null;if(x.registration!==undefined)LG.registration=x.registration;
  LG_AUTO.nextAt=x.entry?Math.max(Date.now()+1000,Number(x.nextCheckAt||Date.now()+LG.clockOffset+15000)-LG.clockOffset):0;lgAutoLabel();
  const room=x.assignment?.room;
  if(room&&/^lg-[A-Za-z0-9-]+$/.test(room)){
   if(ONL.active&&!ONL.spectateOnly&&!['over','closed'].includes(ONL.status)&&ONL.room!==room)return;
   if(LG_AUTO.lastRoom===room&&Date.now()-LG_AUTO.lastAttempt<15000){LG_AUTO.nextAt=LG_AUTO.lastAttempt+15000;return;}
   LG_AUTO.entering=true;LG_AUTO.lastRoom=room;LG_AUTO.lastAttempt=Date.now();LG_AUTO.nextAt=0;
   try{toast2('مباراة الدوري جاهزة · ندخلك إلى طاولتك');lgEnter(room);}finally{LG_AUTO.entering=false;}
  }
 }catch(e){
  if(!current()||controller.signal.aborted)return;
  LG_AUTO.checked=true;LG_AUTO.errors++;
  // Remember paid/pending acknowledgements even when the first lookup fails.
  // Upcoming members wait for their known start; due members retry at the normal 15s client cadence.
  LG_AUTO.nextAt=LG_AUTO.entry?Math.max(Date.now()+15000,LG_AUTO.entry.status==='registration'?Number(LG_AUTO.entry.start)-LG.clockOffset:0):LG_AUTO.errors<3?Date.now()+Math.min(60000,15000*2**(LG_AUTO.errors-1)):0;lgAutoLabel();
 }finally{
  if(seq===LG_AUTO.seq){LG_AUTO.controller=null;if(lgAutoAllowed()&&LG_AUTO.nextAt)lgAutoSchedule(LG_AUTO.nextAt-Date.now());}
 }
}
if(typeof MutationObserver==='function'){
 const home=document.getElementById('home');if(home){const observer=new MutationObserver(()=>lgAutoWake());observer.observe(home,{attributes:true,attributeFilter:['class','style']});}
}
globalThis.addEventListener?.('online',()=>lgAutoWake(true));
globalThis.addEventListener?.('pageshow',()=>lgAutoWake());
globalThis.addEventListener?.('pagehide',()=>lgAutoStop());
document.addEventListener?.('visibilitychange',()=>lgAutoWake());
document.addEventListener?.('resume',()=>lgAutoWake(true));
lgAutoWake();

const lgLinkedId=new URLSearchParams(location.search).get('league');
if(lgLinkedId&&/^lg-[A-Za-z0-9-]+$/.test(lgLinkedId)){
 document.getElementById('hTournament').onclick=()=>lgOpen(lgLinkedId);
 if(typeof MutationObserver==='function'){
  const home=document.getElementById('home');let observer;
  const openLinked=()=>{if(!FB.user||home.classList.contains('hidden'))return;observer?.disconnect();document.getElementById('hTournament').onclick=()=>lgOpen();const url=new URL(location.href);url.searchParams.delete('league');history.replaceState(null,'',url.pathname+url.search+url.hash);lgOpen(lgLinkedId);};
  observer=new MutationObserver(openLinked);observer.observe(home,{attributes:true,attributeFilter:['class','style']});openLinked();
 }
}
