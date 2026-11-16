/* V415: opt-in ranked presentation. Prices, membership, countdown and awards are authoritative. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),user=()=>typeof FB!=='undefined'?FB.user:null,on=()=>typeof ONL!=='undefined'?ONL:null;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=x=>String(Math.max(0,Math.trunc(Number(x)||0))),delta=x=>(x<0?'−':x>0?'+':'')+num(Math.abs(x));
 const ranks=['جديد','مبتدئ','صاعد','متقدم','أسطوري','فنان','نخبوي','نابغة','سيد اللعبة','شيخ المجابيد'];
 const R={uid:null,mode:'ranked',open:false,data:null,error:'',busy:false,loading:false,seq:0,view:0,timer:0,tick:0,controller:null,requestId:null,gate:null,gateTimer:0,offset:0,connecting:null,connectTimer:0,match:null,result:null,resultTimer:0,resultBusy:false,resultSeq:0,focus:null};
 const L={rows:null,cursor:null,legacy:null,loading:false,error:'',expired:false,seq:0,controller:null};
 function stopLeaders(){L.seq++;L.controller?.abort();L.controller=null;L.loading=false;}
 const legacy={open:window.MajabeedCup?.openLegacy,state:window.uiCupState,lobby:window.uiCupLobby,result:window.MajabeedCup?.renderResult,account:window.MajabeedCup?.accountChanged};
 const isNew=()=>on()?.cup?.rankedProtocol===1;
 const watching=()=>!!on()?.spectateOnly||on()?.view?.viewerStatus==='spectator';
 const key=()=> 'majabeed-ranked-request:'+R.uid;
 function remember(id){R.requestId=id;try{if(id)localStorage.setItem(key(),id);else localStorage.removeItem(key());}catch(_){}}
 function stored(){try{return localStorage.getItem(key())||null;}catch(_){return null;}}
 function game(){return window.MajabeedBaloot?.state?.selected||$('frame')?.dataset.majabeedGame||'majabeed';}
 function hide(restore=true){stopLeaders();R.open=false;R.view++;R.seq++;R.controller?.abort();R.controller=null;R.loading=false;R.busy=false;R.gate=null;clearTimeout(R.gateTimer);clearTimeout(R.timer);clearInterval(R.tick);$('mjRanked')?.setAttribute('hidden','');document.documentElement.classList.remove('mjRankedLocked');document.body.classList.remove('mjRankedLocked');if(restore)R.focus?.focus?.({preventScroll:true});}
 function account(uid=user()?.uid||null){if(uid===R.uid)return;hide(false);Object.assign(L,{rows:null,cursor:null,legacy:null,error:'',expired:false,returnTo:null});clearTimeout(R.resultTimer);clearTimeout(R.connectTimer);R.resultSeq++;Object.assign(R,{uid,data:null,error:'',requestId:null,connecting:null,match:null,result:null,resultBusy:false,tab:'journey',legacyResolved:null});R.requestId=stored();$('rankedResult')?.remove();}
 async function api(route,body,signal,cursor=null){
  const u=user(),mode=R.mode;if(!u)throw Error('سجّل الدخول للعب');const controller=new AbortController();let reject;
  const interruption=new Promise((_,r)=>{reject=r;}),abort=()=>{controller.abort();reject(Object.assign(Error('request interrupted'),{name:'AbortError'}));};
  signal?.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,12000);
  try{if(signal?.aborted)abort();return await Promise.race([interruption,(async()=>{
   const token=await u.getIdToken();if(controller.signal.aborted||user()?.uid!==u.uid)throw Error('identity changed');
   const payload=body?{...body,protocol:1,mode}:null;
   const path=route==='legacy-state'?'/cup/state?fresh=1':route==='leaders'?'/cup/leaders?pageSize=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''):'/ranked/'+route+(body?'':'?protocol=1&mode='+mode);
   const response=await fetch('https://'+GAME_SRV+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(payload)}:{}),cache:'no-store',signal:controller.signal});
   const d=await response.json();if(controller.signal.aborted||user()?.uid!==u.uid)throw Error('identity changed');
   if(!response.ok||d.ok===false)throw Object.assign(Error(d.message||d.error||'تعذّر تأكيد الحالة'),{code:d.code});
   if(route==='legacy-state'){if(d.profile?.uid!==u.uid||!d.progress||!d.entry||!d.rules)throw Error('invalid cup response');return d;}
   if(route==='leaders'){if(!Array.isArray(d.leaders))throw Error('invalid champions response');return d;}
   if(d.protocol!==1||!['ranked','cup'].includes(d.mode)||d.profile?.uid!==u.uid)throw Error('invalid ranked response');return d;
  })()]);}finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
 }
 function explain(e){return e?.name==='AbortError'?'لم يصل التأكيد. حدّث الحالة قبل إعادة المحاولة.':({LEGACY_CUP_ACTIVE:'لديك محاولة كأس قائمة؛ حدّث الحالة لمتابعتها.',LEGACY_MATCH_ACTIVE:'لديك مباراة أو بحث سابق؛ أكمله أولًا.',ACTIVE_MATCH:'نتيجة المباراة السابقة قيد التأكيد؛ حدّث الحالة.',ENTRY_PRICE_CHANGED:'تغيّرت رسوم الدخول؛ راجع السعر ثم أعد البحث.',INSUFFICIENT_GOLD:'رصيد الذهب لا يكفي للدخول.',MATCH_STARTED:'تُؤكّد المباراة الآن؛ عد إلى الطاولة.',ENTRY_PAUSED:'الدخول الجديد متوقف مؤقتًا.',AUTH_REQUIRED:'سجّل الدخول للعب.'}[e?.code]||'تعذّر تأكيد الحالة. اضغط تحديث للمحاولة مجددًا.');}
 function accept(d){const hadSearch=!!R.data?.search;R.data=d;R.mode=d.mode;R.offset=d.serverNow-Date.now();if(d.search)remember(d.search.requestId);else if(d.assignment?.requestId)remember(d.assignment.requestId);else if(hadSearch&&!d.assignment)remember(null);render();}
 function schedule(){clearTimeout(R.timer);if(R.open&&!document.hidden&&!R.busy&&!R.error&&(R.data?.search||R.data?.assignment))R.timer=setTimeout(refresh,2500);}
 async function refresh(){
  account();if(!R.open||R.busy||document.hidden)return;R.controller?.abort();const seq=++R.seq,uid=R.uid,controller=new AbortController();R.controller=controller;R.loading=true;R.error='';render();
  try{let d;const [ranked,cup]=await Promise.all([api('state',null,controller.signal),R.mode==='cup'?api('legacy-state',null,controller.signal):null]);if(seq!==R.seq||uid!==user()?.uid||!R.open)return;
   d=ranked;if(cup&&d.mode==='cup'){const resolved=reconcileCup(d,cup);if(resolved===null)return;d=resolved;}accept(d);if(d.assignment&&!['cancelled','settling'].includes(d.assignment.status))enter(d.assignment);
  }catch(e){if(seq===R.seq&&!controller.signal.aborted)R.error=explain(e);}finally{if(seq===R.seq){R.loading=false;R.controller=null;render();schedule();}}
 }
 // Both coordinators can hold an owned reservation before an attempt becomes active.
 // A terminal snapshot prevents their short profile caches from bouncing back to V1.
 function terminalCup(d){return d?.profile?.uid===R.uid&&!d.search&&!d.assignment&&['idle','won','lost'].includes(d.progress?.status);}
 function reconcileCup(d,cup){
  const previous=R.legacyResolved,same=p=>p?.progress?.attemptId===cup.progress.attemptId;
  if(terminalCup(cup))R.legacyResolved=cup;
  else if(previous&&!same(previous))R.legacyResolved=null;
  if(cup.search||cup.assignment||(cup.progress.status==='active'&&cup.progress.rulesVersion!==2&&(cup.progress.rulesVersion===1||d.legacyCup)&&!R.legacyResolved)){
   if(typeof legacy.open!=='function')throw Error('cup continuation unavailable');hide(false);legacy.open(cup);return null;
  }
  const current=R.legacyResolved||cup;
  if(current.progress.rulesVersion===2||terminalCup(current)&&(d.legacyCup||Number.isInteger(cup.progress.rulesVersion))){
   return {...d,legacyCup:false,profile:{...d.profile,...current.profile},progress:{...d.progress,...current.progress},entry:{...current.entry,continuation:current.progress.status==='active'},lastResult:d.lastResult};
  }
  if(d.legacyCup)throw Error('cup status not confirmed');
  return d;
 }
 function mount(){if($('mjRanked'))return;const el=document.createElement('section');el.id='mjRanked';el.hidden=true;el.dir='rtl';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','mjTitle');
  el.innerHTML='<article class="mj-app"><header class="mj-header"><button type="button" class="mj-back" data-rk="close" aria-label="العودة">‹</button><div class="mj-brand"><span class="mj-brand-mark" aria-hidden="true">♠</span><div><strong id="mjTitle">مجابيد</strong><small id="mjSubtitle"></small></div></div><span class="mj-wallet"><span aria-hidden="true">◈</span><bdi id="mjGold"></bdi><small>ذهب</small></span></header><div id="mjMessage" class="mj-message" role="status" aria-live="polite"></div><div id="mjBody"></div></article>';
  el.addEventListener('click',e=>{const b=e.target.closest('[data-rk]');if(b&&!b.disabled)action(b.dataset.rk);});el.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.remove();},true);
  el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();action('close');}if(e.key==='Tab'){const nodes=[...el.querySelectorAll('button:not(:disabled),summary')].filter(x=>x.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});document.body.appendChild(el);
 }
 const button=(name,text,primary=false,disabled=false)=>'<button type="button" class="'+(primary?'mj-primary':'mj-secondary')+'" data-rk="'+name+'"'+(disabled?' disabled':'')+'>'+text+'</button>';
 function avatar(p){const src=p?.avatar;return '<div class="mj-avatar'+(!p?' mj-empty':'')+'"><span>'+esc(p?String(p.name||'م').slice(0,1):'؟')+'</span>'+(typeof src==='string'&&/^(https:\/\/|avatars\/|ui-art\/)/.test(src)?'<img src="'+esc(src)+'" alt="" referrerpolicy="no-referrer">':'')+'</div>';}
 function hearts(p){const remaining=p?.status==='lost'?0:p?.status==='active'?Math.max(0,3-(Number(p.losses)||0)):3;return '<div class="mj-cup-hearts"><div><strong>الفرص المتبقية</strong><small>ثلاث فرص للمحاولة كاملة</small></div><div class="mj-heart-icons" role="img" aria-label="'+num(remaining)+' من 3 فرص متبقية">'+[0,1,2].map(i=>'<span class="'+(i>=remaining?'mj-heart-spent':'')+'" aria-hidden="true">'+(i<remaining?'♥':'♡')+'</span>').join('')+'</div></div>';}
 function leadersView(){
  const rows=L.rows||[],more=L.legacy?rows.length<L.legacy.length:!!L.cursor;
  return '<div class="mj-screen mj-champions"><div class="mj-champions-heading"><h2>أبطال مجابيد</h2><p>الترتيب حسب عدد البطولات</p></div>'+button('journey','العودة إلى رحلتي')+
   (L.error?'<p class="mj-champions-status" role="status">'+esc(L.error)+'</p>':'')+
   (!rows.length?'<p class="mj-champions-status">'+(L.loading?'جارٍ تحميل الأبطال…':L.error?'': 'الصدارة تنتظر أول أبطالها')+'</p>':'<ol class="mj-champions-list">'+rows.map(p=>'<li class="'+(p.position===1?'mj-champion-first':p.position===2?'mj-champion-second':'')+'"><bdi class="mj-champion-position">'+num(p.position)+'</bdi>'+avatar(p)+'<div class="mj-champion-name"><strong>'+esc(p.name||'لاعب')+'</strong><small>'+esc(p.position===1?'الزعيم':p.position===2?'الوصيف':'المركز '+num(p.position))+'</small></div><span class="mj-champion-titles"><bdi>'+num(p.titles)+'</bdi><small>بطولة</small></span></li>').join('')+'</ol>')+
   (L.expired?button('leaders-refresh','تحديث الترتيب',false,L.loading):more?button('leaders-more',L.loading?'جارٍ تحميل المزيد…':L.error?'إعادة محاولة تحميل المزيد':'عرض 50 بطلًا آخر',false,L.loading):L.error?button('leaders-refresh','إعادة المحاولة',false,L.loading):rows.length?'<p class="mj-champions-status">'+(L.legacy&&L.legacy.length>=100?'المتاح حاليًا: أول '+num(L.legacy.length)+' بطل':'تم عرض جميع الأبطال')+'</p>':'')+'</div>';
 }
 async function loadLeaders(more=false){
  if(!R.open||R.mode!=='cup'||R.tab!=='leaders'||L.loading)return;
  if(more&&L.legacy){L.rows=L.legacy.slice(0,L.rows.length+50);L.error='';render();return;}
  if(more&&!L.cursor)return;
  stopLeaders();const seq=L.seq,uid=R.uid,controller=new AbortController();L.controller=controller;L.loading=true;L.error='';L.expired=false;
  if(!more){L.rows=null;L.cursor=null;L.legacy=null;}render();
  try{const d=await api('leaders',null,controller.signal,more?L.cursor:null);if(seq!==L.seq||uid!==user()?.uid||!R.open||R.tab!=='leaders')return;
   const rows=d.leaders.filter(p=>p&&typeof p.uid==='string'&&Number.isSafeInteger(p.position)&&p.position>0&&Number.isSafeInteger(p.titles)&&p.titles>0);
   if(d.pagination===1){if(rows.length>50||d.hasMore&&typeof d.nextCursor!=='string')throw Error('invalid champions page');const previous=more?(L.rows||[]):[],seen=new Set(previous.map(p=>p.uid));L.rows=previous.concat(rows.filter(p=>!seen.has(p.uid)));L.cursor=d.hasMore?d.nextCursor:null;}
   else{L.legacy=rows;L.rows=rows.slice(0,50);L.cursor=null;}
  }catch(e){if(seq===L.seq&&!controller.signal.aborted){L.expired=e?.code==='LEADERS_EXPIRED';L.error=L.expired?'انتهت صلاحية عرض الترتيب؛ حدّث القائمة للمتابعة.':'تعذّر تحميل الأبطال الآن. أعد المحاولة.';}}
  finally{if(seq===L.seq){L.loading=false;L.controller=null;render();}}
 }
 // Quotes apply to a new attempt; an active attempt continues without another fee.
 function cupEntryNote(d,pending=false){
  if(d.entry?.continuation===true||d.progress?.status==='active')return 'متابعة المحاولة مجانية · بطولة مجابيد';
  const price=d.entry?.price;
  if(Number.isSafeInteger(price)&&price>=0)return price===0?'المشاركة مجانية · بطولة مجابيد':num(price)+' ذهب للمحاولة الجديدة'+(pending?' · لم تُخصم بعد':'');
  return 'بطولة مجابيد · جارٍ تأكيد المشاركة';
 }
 const cupContent=markup=>'<div class="mj-cup-content">'+markup+'</div>';
 function cupLobby(d){const p=d.progress,stage=Math.max(0,Math.min(2,p.stage||0)),won=p.status==='won',active=p.status==='active';return '<div class="mj-cup-hero"><div class="mj-hero-word">طريقك إلى اللقب</div><div class="mj-cup-emblem"><img src="ui-art/majabeed-cup.svg" alt="" /></div><h2>كأس مجابيد</h2><p>'+ (won?'أنت بطل الكأس':p.status==='lost'?'انتهت المحاولة':active?'المرحلة '+['الأولى','الثانية','الثالثة'][stage]:'ابدأ رحلتك')+'</p></div>'+hearts(p)+
  '<div class="mj-cup-route" aria-label="مراحل الكأس">'+[2,3,4].map((target,i)=>{const done=won||active&&i<stage,selected=!won&&(active?stage:0)===i;return '<div class="'+(done?'mj-stage-done':selected?'mj-stage-current':'')+'"><span>'+(done?'✓':num(i+1))+'</span><strong>'+['الأولى','الثانية','الثالثة'][i]+'</strong><small>'+(done?'مكتملة':selected?num(active?p.wins:0)+' من '+target+' انتصارات':target+' انتصارات')+'</small></div>';}).join('')+'</div>'+
  '<div class="mj-cup-reward"><div><span>مكافأة اجتياز المرحلة</span><strong><bdi>+'+num([100,150,250][active?stage:0])+'</bdi><small>نقطة</small></strong></div><small>'+(active&&d.progress.stageBonusAvailable===false?'استُلمت مكافأة هذه المرحلة اليوم':'مرة واحدة لكل مرحلة يوميًا')+'</small></div><div class="mj-cup-prize"><span>جائزة البطل</span><strong>3000 ذهب <span>+ لقب البطل</span></strong></div><details class="mj-details"><summary>قوانين الكأس</summary><div>لا تُضاف أو تُخصم نقاط التصنيف عند نتيجة المباراة نفسها. نقاط الكأس لاجتياز المراحل فقط. الفرص الثلاث لا تتجدد بين المراحل ولا بتغيّر اليوم؛ الخسارة الثالثة تنهي المحاولة. الانسحاب يستهلك فرصة، والتعادل لا يستهلك فرصة.<br>أول محاولة جديدة يوميًا مجانية، ثم 500 ذهب للمحاولة. مواصلة المحاولة مجانية.</div></details>';
 }
 function legacyPresentation(snapshot){
  const {data:d,busy,loading,entering,requestId,error}=snapshot,disabled=busy||loading||entering;
  const btn=(name,text,primary=false,off=disabled)=>button(name,text,primary,off).replace('data-rk=','data-mc=');
  if(!d)return {body:'<div class="mj-screen mj-empty-state"><h2>كأس مجابيد</h2><p>جارٍ التحقق من محاولتك…</p></div>',footer:btn('refresh','تحديث الحالة')};
  const p=d.progress||{},rules=d.rules||{},a=d.assignment,q=d.search;
  let body='',footer='';
  if(q){
   const count=Math.max(1,Number(q.humanCount)||1);
   body='<div class="mj-screen mj-search"><div class="mj-search-heading"><span class="mj-status-pill"><span></span>البحث جارٍ</span><h2>نجهّز لك التحدّي</h2><p>نبحث عن لاعبين لإكمال مباراة الكأس</p></div><div class="mj-radar" aria-hidden="true"><div class="mj-radar-ring"></div><div class="mj-radar-ring mj-ring-inner"></div><div class="mj-radar-sweep"></div><div class="mj-radar-center"><img src="ui-art/majabeed-cup.svg" alt=""></div></div><div class="mj-search-slots">'+[d.profile,null,null,null].map((person,i)=>'<div class="mj-slot '+(person?'mj-filled':'')+'">'+avatar(person)+'<strong>'+(i===0?'أنت':'لاعب')+'</strong><small>'+(i===0?'في البحث':'نبحث…')+'</small></div>').join('')+'</div><div class="mj-search-count"><bdi>'+num(count)+'</bdi> في قائمة البحث</div><div class="mj-match-policy"><strong>محاولتك مستمرة</strong></div></div>';
   footer=btn('cancel','إلغاء البحث',false,busy)+'<p class="mj-rules-note">'+cupEntryNote(d,true)+'</p>';
  }else if(a){
   const settling=a.status==='settling';
   body='<div class="mj-screen mj-empty-state"><div class="mj-cup-emblem"><img src="ui-art/majabeed-cup.svg" alt=""></div><h2>'+(settling?'جارٍ تأكيد النتيجة':'جارٍ تجهيز مباراة الكأس')+'</h2><p>'+(settling?'ستظهر نتيجتك بعد اكتمال التأكيد.':entering?'نتصل بطاولتك الآن…':'طاولتك محفوظة؛ تابع المباراة من مكانك.')+'</p></div>';
   footer=settling?btn('refresh','تحديث النتيجة'):btn('resume',entering?'جارٍ الاتصال بالطاولة…':'العودة إلى الطاولة',true);
   if(['waiting','preparing'].includes(a.status))footer+=btn('cancel','إلغاء البحث',false,busy);
  }else{
   // Reuse the complete journey layout; replace only rules that belong to this existing attempt.
   const total=Math.max(1,Number(rules.lossesPerStage)||3),left=p.status==='lost'?0:p.status==='active'?Math.max(0,total-(Number(p.losses)||0)):total;
   let journey=cupLobby(d);
   journey=journey.replace(hearts(p),'<div class="mj-cup-hearts"><div><strong>الفرص المتبقية</strong><small>لهذه المرحلة من المحاولة القائمة</small></div><div class="mj-heart-icons" role="img" aria-label="'+num(left)+' من '+num(total)+' فرص متبقية">'+Array.from({length:total},(_,i)=>'<span class="'+(i>=left?'mj-heart-spent':'')+'" aria-hidden="true">'+(i<left?'♥':'♡')+'</span>').join('')+'</div></div>');
   const instructions='تستمر هذه المحاولة بالقواعد التي بدأت بها: '+num(total)+' فرص في كل مرحلة، وتتجدد عند اجتيازها. الفوز +'+num(rules.rankWin)+' والخسارة −'+num(rules.rankLoss)+' نقطة تصنيف. مكافآت المراحل '+(rules.stageBonuses||[100,150,250]).map(num).join(' / ')+' نقطة، مرة لكل مرحلة يوميًا. مواصلة المحاولة مجانية. بعد نهايتها، تبدأ محاولتك التالية بالقواعد الجديدة.';
   journey=journey.replace(/<details class="mj-details">[\s\S]*?<\/details>/,'<details class="mj-details"><summary>قواعد المحاولة القائمة</summary><div>'+instructions+'</div></details>');
   body='<div class="mj-screen mj-lobby">'+journey+'<div class="mj-champions-entry">'+btn('leaders','أبطال مجابيد',false,busy)+'</div><div class="mj-rules"><span>2 ضد 2</span><span>'+num(rules.basras||10)+' بواصر</span><span>'+num(rules.jokers||9)+' جوكرات</span></div></div>';
   footer=(requestId?btn('cancel','إلغاء الطلب المعلّق'):btn('start','متابعة البحث',true))+'<p class="mj-rules-note">'+cupEntryNote(d)+'</p>';
  }
  if(error)footer=btn('refresh','تحديث الحالة')+((q||requestId)?btn('cancel','إلغاء البحث',false,busy):'');
  return {body,footer};
 }

 function rankedLobby(d){const t=d.tier,p=d.profile,progress=t.next?Math.max(0,Math.min(100,100*(p.rank-t.min)/(t.next-t.min))):100;return '<div class="mj-rank-hero"><div class="mj-hero-word">العب على قدّ رتبتك</div><div class="mj-crest-orbit"><span class="mj-orbit-line"></span><img class="mj-real-crest" src="ui-art/rank-'+num(t.index)+'.svg" alt=""></div><h2 class="mj-rank-name">'+esc(t.name)+'</h2><div class="mj-rank-caption">'+esc(p.name)+' · <bdi>'+num(p.rank)+'</bdi> نقطة</div></div><div class="mj-rank-progress"><div class="mj-progress-label"><span>'+(t.next?'طريقك إلى <b>'+esc(ranks[t.index+1]||t.nextName||'الرتبة التالية')+'</b>':'أعلى رتبة')+'</span><bdi>'+(t.next?num(t.next-p.rank)+' نقطة متبقية':'واصل المنافسة')+'</bdi></div><div class="mj-track" role="progressbar" aria-label="التقدم إلى الرتبة التالية" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(progress)+'"><span style="width:'+progress+'%"></span></div></div><div class="mj-stakes"><div class="mj-fee"><span>رسوم الدخول</span><strong><bdi>'+num(t.fee)+'</bdi><small>ذهب</small></strong></div><div class="mj-profit"><span>صافي ربح الفوز</span><strong><bdi>+'+num(t.win-t.fee)+'</bdi><small>ذهب</small></strong></div><div class="mj-rank-deltas"><span>نقاط الفوز <bdi class="mj-positive">+'+num(t.rankWin)+'</bdi></span><span>نقاط الخسارة <bdi>−'+num(t.rankLoss)+'</bdi></span></div></div><details class="mj-details"><summary>تفاصيل المكافآت</summary><div>عند الفوز يُضاف '+num(t.win)+' ذهب. الصافي بعد رسوم الدخول '+num(t.win-t.fee)+' ذهب. عند الخسارة لا تعود رسوم الدخول. التعادل يعيد رسوم الدخول دون تغيير نقاط التصنيف. رتبتك عند الدخول تحدد مكافأة هذه المباراة.</div></details>';}
 function lobby(d){
  const isCup=R.mode==='cup',journey=(isCup?cupLobby(d)+'<div class="mj-champions-entry">'+button('leaders','أبطال مجابيد')+'</div>':rankedLobby(d))+'<div class="mj-rules"><span>2 ضد 2</span><span>10 بواصر</span><span>9 جوكرات</span></div>';
  return '<div class="mj-screen mj-lobby">'+(isCup?cupContent(journey):journey)+'<div class="mj-action-area">'+(R.requestId?button('cancel','إلغاء الطلب المعلّق'):button('join',R.busy?'جارٍ تأكيد الدخول…':'ابحث عن مباراة',true,R.busy||R.loading||!d.enabled))+'<p>'+(isCup?cupEntryNote(d):'رسوم الدخول عند تأكيد المباراة')+'</p></div></div>';
 }
 function search(d){
  const players=d.search.players||[],isCup=R.mode==='cup',content='<div class="mj-search-heading"><span class="mj-status-pill"><span></span>البحث جارٍ</span><h2>نجهّز لك التحدّي</h2><p>'+(isCup?'بطولة مجابيد · نبحث عن لاعبين قريبين من رتبتك':'نبحث عن لاعبين قريبين من رتبتك')+'</p></div><div class="mj-radar" aria-hidden="true"><div class="mj-radar-ring"></div><div class="mj-radar-ring mj-ring-inner"></div><div class="mj-radar-sweep"></div><div class="mj-radar-center">'+(isCup?'<img src="ui-art/majabeed-cup.svg" alt="">':'♠')+'</div></div><div class="mj-time-row"><span>وقت الانتظار</span><bdi id="mjTimer" class="mj-timer">00:00</bdi></div><div class="mj-search-slots">'+[0,1,2,3].map(i=>{const p=players[i];return '<div class="mj-slot '+(p?'mj-filled':'')+'">'+avatar(p)+'<strong>'+esc(i===0?'أنت':p?.name||'لاعب')+'</strong><small>'+esc(p?.rankName||'نبحث…')+'</small></div>';}).join('')+'</div><div class="mj-search-count"><bdi>'+num(players.length)+' / 4</bdi> لاعبين في البحث</div><div class="mj-match-policy"><strong>كل لاعب ورتبته</strong></div>';
  return '<div class="mj-screen mj-search">'+(isCup?cupContent(content):content)+'<div class="mj-action-area">'+button('cancel','إلغاء البحث',false,R.busy)+'<p>'+(isCup?cupEntryNote(d,true):'لم تُخصم رسوم الدخول بعد')+'</p></div></div>';
 }
 function found(d){
  const a=d.assignment,players=a.players||[],me=players.findIndex(p=>p.pid===a.playerId),team=me<0?0:me%2,isCup=R.mode==='cup',player=p=>'<div class="mj-player">'+avatar(p)+'<strong>'+esc(p.name)+(p.pid===a.playerId?' <small>أنت</small>':'')+'</strong><span>'+esc(p.rankName||'')+'</span></div>';
  const content='<div class="mj-found-heading"><h2>فريقك جاهز</h2></div><div class="mj-versus-board">'+[team,1-team].map((t,i)=>(i?'<div class="mj-versus"><span></span><b>ضد</b><span></span></div>':'')+'<div class="mj-team '+(i?'mj-other-team':'mj-your-team')+'"><div class="mj-team-label">'+(i?'الفريق المنافس':'فريقك')+'</div><div class="mj-team-pair">'+players.filter((p,k)=>k%2===t).map(player).join('')+'</div></div>').join('')+'</div><div class="mj-found-footer"><div id="mjCountdown" class="mj-countdown" aria-live="polite"></div><p>'+(a.status==='settling'?'جارٍ تأكيد نتيجة المباراة':a.startAt?(isCup?'تم تأكيد المشاركة في بطولة مجابيد':'تم تأكيد رسوم الدخول'):'ننتظر اتصال الجميع لتأكيد المباراة')+'</p></div>';
  const action=['preparing','waiting'].includes(a.status)?button('cancel','إلغاء البحث',false,R.busy):button('resume','العودة إلى الطاولة',false,a.status==='settling');
  return '<div class="mj-screen mj-found">'+(isCup?cupContent(content)+'<div class="mj-action-area">'+action+'</div>':content+action)+'</div>';
 }
 function tick(){if(!R.open||!R.data)return;const now=Date.now()+R.offset,s=R.data.search,a=R.data.assignment,t=$('mjTimer'),c=$('mjCountdown');if(t&&s){const n=Math.max(0,Math.floor((now-s.joinedAt)/1000));t.textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}if(c&&a){const seconds=a.startAt?Math.max(0,Math.ceil((a.startAt-now)/1000)):null;c.textContent=seconds===null?'جارٍ تجهيز المباراة…':seconds?'تبدأ خلال '+seconds:'جارٍ فتح الطاولة…';}}
 function render(){if(!R.open)return;mount();const root=$('mjRanked');root.hidden=false;root.classList.toggle('mjCupPage',R.mode==='cup');root.querySelector('.mj-app').classList.toggle('mj-cup',R.mode==='cup');$('mjSubtitle').textContent=R.mode==='cup'?'كأس مجابيد':'لعب تصنيف';$('mjGold').textContent=R.data?num(R.data.profile.gold):'—';
  const message=R.error||R.data?.notice||'',host=$('mjMessage');host.hidden=!message;host.innerHTML=esc(message)+(R.error?button('refresh','تحديث الحالة',false,R.busy||R.loading):'');
  const content=R.mode==='cup'&&R.tab==='leaders'?leadersView():R.data?(R.data.assignment?found(R.data):R.data.search?search(R.data):lobby(R.data)):'<div class="mj-screen mj-empty-state"><h2>نجهّز ساحتك</h2><p>'+ (R.error?'تعذّر تحميل الحالة':'جارٍ تحميل رتبتك ومشاركتك…')+'</p>'+button('refresh','إعادة المحاولة',false,R.loading)+'</div>';
  if($('mjBody')._markup!==content){$('mjBody').innerHTML=content;$('mjBody')._markup=content;}tick();window.MajabeedAdIndicators?.refresh();
 }
 async function join(){
  if(R.busy||R.loading||R.error||!R.open||!R.data||!R.data.enabled||R.data.search||R.data.assignment||R.requestId||window.MajabeedEntryGate?.busy)return;
  if(on()?.active&&!['over','closed'].includes(on().status)){R.error='أكمل طاولتك الحالية قبل بدء البحث.';render();return;}
  const uid=R.uid,intent={},price=R.data.entry.price,mode=R.mode;R.gate=intent;R.busy=true;R.error='';render();
  const current=()=>R.gate===intent&&R.open&&R.uid===uid&&user()?.uid===uid&&R.mode===mode&&game()==='majabeed'&&!(on()?.active&&!['over','closed'].includes(on().status));
  R.gateTimer=setTimeout(()=>{if(R.gate===intent){R.gate=null;R.busy=false;R.error='لم يكتمل تأكيد الدخول؛ أعد المحاولة.';render();}},90000);
  try{if(!window.MajabeedEntryGate?.run)throw Error('entry gate unavailable');await window.MajabeedEntryGate.run(async()=>{
   if(!current()||document.hidden)return false;remember('rk-'+crypto.randomUUID());const d=await api('join',{requestId:R.requestId,maxEntryPrice:price});if(!current())return false;accept(d);if(!d.search&&!d.assignment)remember(null);return true;
  },{isCurrent:current,beforeStore:()=>{if(current())hide();}});}catch(e){if(current())R.error=explain(e);}finally{if(R.gate===intent){clearTimeout(R.gateTimer);R.gate=null;R.busy=false;render();if(!R.error)refresh();}}
 }
 async function cancel(){
  if(!R.requestId){await refresh();return false;}R.controller?.abort();const seq=++R.seq,uid=R.uid,id=R.requestId;R.loading=false;R.busy=true;R.gate=null;R.error='';render();
  try{const d=await api('cancel',{requestId:id});if(seq!==R.seq||uid!==user()?.uid)return false;remember(null);if(on()?.active&&on().room===R.data?.assignment?.room&&['lobby','waiting','closed'].includes(on().status))leaveOnline();clearTimeout(R.connectTimer);R.connecting=null;accept(d);return true;
  }catch(e){if(seq===R.seq)R.error=explain(e);return false;}finally{if(seq===R.seq){R.busy=false;render();schedule();}}
 }
 function enter(a){
  if(document.hidden||!a||!/^cm-[a-zA-Z0-9-]+$/.test(a.room)||!/^cp-[a-zA-Z0-9-]{1,60}$/.test(a.playerId)||R.connecting===a.room)return;
  const o=on();if(!o)return;if(o.active&&o.room!==a.room&&!['over','closed'].includes(o.status)){R.error='أكمل طاولتك الحالية قبل العودة لهذه المباراة.';render();return;}
  R.match={room:a.room,mode:a.mode};if(o.active&&o.room===a.room&&['playing','over'].includes(o.status)&&isNew()){hide(false);return;}
  R.connecting=a.room;clearTimeout(R.connectTimer);R.connectTimer=setTimeout(()=>{if(R.connecting===a.room){R.connecting=null;R.error='تعذّر الاتصال بالطاولة؛ اضغط تحديث للعودة.';render();}},15000);
  try{if(o.active&&o.room!==a.room)leaveOnline();o.pendingTier=null;o.pendingMode='team';o.assignmentPid={room:a.room,pid:a.playerId};const url=new URL(location.href);url.searchParams.set('room',a.room);url.searchParams.delete('spectate');url.searchParams.delete('league');history.replaceState(null,'',url.pathname+url.search+url.hash);if(enterOnline()===false)throw Error('connection rejected');}catch(_){clearTimeout(R.connectTimer);R.connecting=null;R.error='تعذّر فتح الطاولة؛ حدّث الحالة.';render();}
 }
 function open(mode='ranked',options={}){
  if(game()==='baloot')return;if(!user()){if(typeof toast2==='function')toast2('سجّل الدخول للعب');return;}account();if(terminalCup(options.legacyResolved))R.legacyResolved=options.legacyResolved;stopLeaders();L.returnTo=null;R.tab='journey';R.mode=mode==='cup'?'cup':'ranked';R.data=null;R.error='';R.focus=document.activeElement;R.open=true;R.view++;mount();document.documentElement.classList.add('mjRankedLocked');document.body.classList.add('mjRankedLocked');render();$('mjRanked').querySelector('[data-rk="close"]').focus({preventScroll:true});clearInterval(R.tick);R.tick=setInterval(tick,250);refresh();
 }
 function openChampions(returnTo=null){
  if(game()==='baloot'||!user())return;account();R.controller?.abort();R.seq++;R.loading=false;clearTimeout(R.timer);stopLeaders();L.returnTo=typeof returnTo==='function'?returnTo:null;R.mode='cup';R.tab='leaders';R.data=null;R.error='';R.focus=document.activeElement;R.open=true;R.view++;mount();document.documentElement.classList.add('mjRankedLocked');document.body.classList.add('mjRankedLocked');render();$('mjRanked').querySelector('[data-rk="close"]').focus({preventScroll:true});loadLeaders();
 }
 function leaveLeaders(){const back=L.returnTo;L.returnTo=null;stopLeaders();if(back){hide(false);back();}else{R.tab='journey';render();}}
 async function action(name){
  if((name==='close'||name==='journey')&&R.tab==='leaders'){leaveLeaders();return;}
  if(R.mode==='cup'&&!R.busy&&name==='leaders'&&!R.data?.assignment&&!R.data?.search){R.controller?.abort();R.seq++;R.loading=false;R.error='';clearTimeout(R.timer);R.tab='leaders';L.returnTo=null;render();return loadLeaders();}
  if(name==='leaders-more')return loadLeaders(true);if(name==='leaders-refresh')return loadLeaders();
  if(name==='close'){const view=R.view;if(R.gate&&!R.requestId){hide();return;}if(R.data?.assignment&&['committing','starting','playing','settling'].includes(R.data.assignment.status)){enter(R.data.assignment);return;}if(R.requestId){if(R.busy)return;if(await cancel()&&view===R.view)hide();}else hide();return;}
  if(R.busy)return;if(name==='join')return join();if(name==='cancel')return cancel();if(name==='refresh')return refresh();if(name==='resume'){R.error='';R.connecting=null;enter(R.data?.assignment);render();}
 }
 function state(msg){
  if(msg.cup?.rankedProtocol!==1){$('rankedResult')?.remove();return legacy.state?.(msg);}account();const o=on();if(!o||o.room!==msg.cup.room)return;if(watching()||msg.view?.viewerStatus==='spectator'){clearTimeout(R.resultTimer);$('rankedResult')?.remove();if(msg.status==='closed'&&o.active)leaveOnline();return;}
  $('onl')?.setAttribute('data-majabeed-cup','true');if($('uiOnlineTitle'))$('uiOnlineTitle').textContent=R.match?.mode==='cup'?'كأس مجابيد':'مجابيد';if($('uiOnlineMode'))$('uiOnlineMode').textContent=R.match?.mode==='cup'?'طريق البطولة':'لعب تصنيف';
  if(R.connecting===o.room){clearTimeout(R.connectTimer);R.connecting=null;}
  if(msg.status==='playing'||msg.status==='over'){if(R.open)hide(false);if(msg.status==='over')fetchResult();}
  else if(msg.status==='closed'){if(o.active)leaveOnline();open(R.match?.mode||R.mode);}
  else if(msg.cup.startAt&&R.data?.assignment?.room===o.room){R.data.assignment.startAt=msg.cup.startAt;R.data.assignment.status='starting';render();}
 }
 function resultView(){
  if(watching()||!isNew()||on().status!=='over'||window.MajabeedFinale?.presentation())return;const card=document.querySelector('#oOver #resCard')||$('oOver');if(!card)return;$('mcResult')?.remove();
  let host=$('rankedResult');if(!host){host=document.createElement('section');host.id='rankedResult';host.className='mcResult';card.appendChild(host);}
  const r=R.result,match=on().cup.match,ready=r?.match===match,mode=ready?r.mode:R.match?.mode||R.mode;
  if($('oMenu'))$('oMenu').textContent=mode==='cup'?'متابعة الكأس':'متابعة التصنيف';
  if($('oResultKind'))$('oResultKind').textContent=mode==='cup'?'نتيجة كأس مجابيد':'نتيجة لعب التصنيف';
  host.innerHTML=ready?'<h3>'+esc(r.champion?'بطل كأس مجابيد':r.status==='lost'?'انتهت المحاولة':r.draw?'تعادل':r.won?'فوز مستحق':'فرصة للتعويض')+'</h3>'+(r.forfeited?'<p>احتُسبت المباراة انسحابًا على حسابك</p>':'')+(mode==='cup'?'<p>الفرص المتبقية: '+num(r.status==='lost'?0:3-r.losses)+' / 3</p>':'')+'<div class="mcResultAmounts"><span><bdi>'+delta(r.rankDelta)+'</bdi> تصنيف</span><span><bdi>'+delta(r.goldDelta)+'</bdi> ذهب</span></div>'+(mode==='cup'?(r.stageBonus?'<small>مكافأة اجتياز المرحلة</small>':'<small>نتيجة المباراة لا تغيّر نقاط التصنيف</small>'):'<small>رسوم الدخول '+num(r.entryFee)+' ذهب · الصافي '+delta(r.goldDelta-r.entryFee)+' ذهب</small>'):'<p>جارٍ تأكيد النتيجة…</p><button type="button" class="mcSecondary">تحديث النتيجة</button>';
  if(!ready)host.querySelector('button').onclick=fetchResult;
 }
 async function fetchResult(){
  if(document.hidden||watching()||!isNew()||on().status!=='over'||R.resultBusy)return;const match=on().cup.match;if(R.result?.match===match){resultView();return;}R.resultBusy=true;const seq=R.resultSeq,uid=R.uid;
  try{const d=await api('state');if(watching()||uid!==user()?.uid||seq!==R.resultSeq||on()?.cup?.match!==match)return;
   if(d.lastResult?.match===match){R.result=d.lastResult;remember(null);clearTimeout(R.resultTimer);if(typeof pullServerStats==='function')pullServerStats(0);}else{clearTimeout(R.resultTimer);R.resultTimer=setTimeout(fetchResult,6000);}resultView();
  }catch(_){if(!watching()&&seq===R.resultSeq&&uid===user()?.uid){resultView();clearTimeout(R.resultTimer);R.resultTimer=setTimeout(fetchResult,6000);}}finally{if(seq===R.resultSeq)R.resultBusy=false;}
 }
 window.MajabeedRanked={legacyPresentation,open,openChampions,refresh,accountChanged:account,returnMode:()=>!watching()&&isNew()?(R.match?.mode||R.mode):null};
 window.uiCupOpen=()=>open('cup');window.uiCupState=state;window.uiCupLobby=o=>{if(o.cup?.rankedProtocol!==1)return legacy.lobby?.(o);if($('onlWait'))$('onlWait').dataset.majabeedCup='true';};
 if(window.MajabeedCup){window.MajabeedCup.renderResult=()=>isNew()?resultView():legacy.result?.();window.MajabeedCup.accountChanged=uid=>{legacy.account?.(uid);account(uid);};}
 const oldRanked=$('hOnl')?.onclick;if($('hOnl'))$('hOnl').onclick=()=>game()==='baloot'?oldRanked?.():open('ranked');if($('hTournament'))$('hTournament').onclick=()=>open('cup');
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopLeaders();R.controller?.abort();R.seq++;R.loading=false;clearTimeout(R.timer);clearTimeout(R.resultTimer);}else if(R.open){if(R.tab==='leaders'&&!L.rows)loadLeaders();else if(R.tab!=='leaders')refresh();}else fetchResult();});
 window.addEventListener('online',()=>{if(R.open){if(R.tab==='leaders'&&!L.rows)loadLeaders();else if(R.tab!=='leaders')refresh();}else fetchResult();});window.addEventListener('pagehide',()=>{clearTimeout(R.timer);clearInterval(R.tick);clearTimeout(R.resultTimer);});account();
})();
