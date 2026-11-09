/* Majabeed Cup. Presentation only: admission, money and progression belong to the server. */
(function () {
 'use strict';
 const C={open:false,view:0,tab:'journey',uid:null,data:null,leaders:null,busy:false,loading:false,error:'',confirm:false,requestId:null,autoEnter:false,entering:false,navigation:null,entryTimer:0,timer:0,seq:0,controller:null,offset:0,resultMatch:null,resultTimer:0,resultSeen:null,focus:null};
 // Official home progress belongs to the current account and is never persisted.
 const H={uid:null,data:null,at:0,offset:0,seq:0,controller:null,inflight:null,timer:0,route:null,error:false};
 let pageScroll=null;
 function lockPage(on){
  if(on&&pageScroll===null)pageScroll=window.scrollY||0;
  document.documentElement.classList.toggle('mcPageLocked',on);document.body.classList.toggle('mcPageLocked',on);
  if(!on&&pageScroll!==null){const y=pageScroll;pageScroll=null;if(y)window.scrollTo(0,y);}
 }
 const $=id=>document.getElementById(id), esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const n=value=>String(Math.max(0,Math.trunc(Number(value)||0))), delta=value=>(Number(value)>0?'+':Number(value)<0?'−':'')+n(Math.abs(Number(value)||0));
 const user=()=>typeof FB!=='undefined'?FB.user:null;
 const online=()=>typeof ONL!=='undefined'?ONL:null;
 const currentGame=()=>window.MajabeedBaloot?.state?.selected||$('frame')?.dataset.majabeedGame||'majabeed';
 const trophy='<svg viewBox="0 0 96 106" fill="none" aria-hidden="true"><path d="M24 15H10v13c0 17 12 27 26 27M72 15h14v13c0 17-12 27-26 27" stroke="#d5b466" stroke-width="6"/><path d="M25 9h46v29c0 17-9 26-23 26S25 55 25 38V9Z" fill="#f0d18c" stroke="#fff1c9" stroke-width="2"/><path d="M48 64v21M34 90h28M28 98h40" stroke="#d5b466" stroke-width="8" stroke-linecap="round"/><path d="m48 22 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1 4-9Z" fill="#275843"/><path d="M32 14v23c0 9 3 15 7 18" stroke="#fff7db" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>';
 const hearts=(lost,total)=>'<span class="mcHearts" aria-label="'+n(Math.max(0,total-lost))+' فرص متبقية">'+Array.from({length:total},(_,i)=>'<span class="'+(i<lost?'spent':'')+'" aria-hidden="true">♥</span>').join('')+'</span>';
 const avatar=(src,name)=>'<span class="mcAvatar">'+(typeof src==='string'&&/^(https:\/\/|avatars\/|ui-art\/)/.test(src)?'<img src="'+esc(src)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'')+'<span>'+esc(String(name||'م').slice(0,1))+'</span></span>';
 function rules(){return {stages:[2,3,4],lossesPerStage:3,basras:10,jokers:9,entryPrice:500,championGold:3000,rankWin:80,rankLoss:30,stageBonuses:[100,150,250],...(C.data?.rules||{})};}
 function resetIdentity(uid=user()?.uid||null){
  if(C.uid===uid&&H.uid===uid)return;
  C.controller?.abort();clearTimeout(C.timer);clearTimeout(C.resultTimer);clearTimeout(C.entryTimer);clearTimeout(C.navigation?.timer);C.seq++;
  C.open=false;$('majabeedCup')?.setAttribute('hidden','');lockPage(false);
  Object.assign(C,{uid,data:null,leaders:null,confirm:false,requestId:null,autoEnter:false,error:'',busy:false,loading:false,entering:false,navigation:null,entryIntent:null,entryPending:false,resultMatch:null,resultData:null,resultSeen:null});
  H.controller?.abort();clearTimeout(H.timer);H.seq++;
  Object.assign(H,{uid,data:null,at:0,offset:0,controller:null,inflight:null,timer:0,error:false});
  paintHome();
 }
 function homeVisible(){return !document.hidden&&!C.open&&currentGame()==='majabeed'&&(H.route===null?!$('home')?.classList.contains('hidden'):H.route==='home');}
 function homeDay(){return new Date(Date.now()+H.offset+10800000).toISOString().slice(0,10);}
 function paintHome(){
  const button=$('hTournament');if(!button)return;
  let meta=button.querySelector('.mcHomeMeta');
  if(!meta){meta=document.createElement('span');meta.className='mcHomeMeta';meta.setAttribute('aria-live','polite');button.querySelector('.cupButtonText')?.appendChild(meta);}
  button.classList.add('mcHasHomeState');
  const d=H.data,ready=H.uid&&d?.profile?.uid===H.uid,slot=button.querySelector('.cupButtonTime'),icon=button.querySelector('.cupButtonIcon');
  if(!ready){
   meta.textContent=!H.uid?'سجّل الدخول لعرض فرصك':H.error?'افتح الكأس لتحديث فرصك':'جارٍ التحقق من فرصك…';
   if(slot)slot.textContent='🏆';icon?.querySelector('.mcHomeHearts')?.remove();
   button.removeAttribute('data-cup-stage');button.removeAttribute('data-cup-remaining');return;
  }
  const p=d.progress||{},total=Math.max(1,Math.min(9,Number(d.rules?.lossesPerStage)||3)),lost=Math.max(0,Math.min(total,Number(p.losses)||0));
  const active=p.status==='active',ended=p.status==='lost',won=p.status==='won',remaining=ended?0:active?total-lost:total;
  const ratio=(a,b)=>'<bdi dir="ltr">'+n(a)+' / '+n(b)+'</bdi>';
  const status=active?'المرحلة '+n((Number(p.stage)||0)+1)+' · المتبقي '+ratio(remaining,total)+' فرص':ended?'انتهت المحاولة · ابدأ من المرحلة 1':won?'بطل الكأس · ابدأ محاولة جديدة':'محاولة جديدة · '+n(total)+' فرص لكل مرحلة';
  const free=d.entry?.freeAvailable===true,dayCurrent=d.entry?.day===homeDay();
  const entry=!dayCurrent?'جارٍ تحديث المشاركة اليومية…':active?'المتابعة مجانية · مشاركة اليوم '+ratio(free?1:0,1):free?'مشاركة اليوم المجانية '+ratio(1,1):'مشاركة اليوم '+ratio(0,1)+' · الدخول '+n(d.entry?.price)+' ذهب';
  // These two lines contain only fixed copy and normalized numeric values.
  meta.innerHTML='<span>'+status+'</span><span class="mcHomeEntry">'+entry+'</span>';
  if(slot)slot.innerHTML='<bdi>'+n(remaining)+' / '+n(total)+'</bdi><span>فرص</span>';
  if(icon){let marks=icon.querySelector('.mcHomeHearts');if(!marks){marks=document.createElement('span');marks.className='mcHomeHearts';marks.setAttribute('aria-hidden','true');icon.appendChild(marks);}marks.innerHTML=Array.from({length:total},(_,i)=>'<i class="'+(i>=remaining?'spent':'')+'">♥</i>').join('');}
  button.dataset.cupStage=n((Number(p.stage)||0)+1);button.dataset.cupRemaining=n(remaining);
 }
 function scheduleHomeDay(){
  clearTimeout(H.timer);if(!H.data||!homeVisible())return;
  const localNow=Date.now()+H.offset+10800000,delay=86400000-(localNow%86400000)+100;
  H.timer=setTimeout(()=>{paintHome();refreshHomeState(true);},delay);
 }
 function acceptHome(d,test=false){
  if(test||d?.test===true||!H.uid||user()?.uid!==H.uid||d?.profile?.uid!==H.uid||!d.entry||!d.rules)return false;
  if(H.data&&Number(d.serverNow)<Number(H.data.serverNow))return false;
  H.data=d;H.at=Date.now();H.offset=(Number(d.serverNow)||Date.now())-Date.now();H.error=false;paintHome();scheduleHomeDay();return true;
 }
 async function refreshHomeState(force=false){
  resetIdentity();paintHome();if(!H.uid||!homeVisible())return;
  if(H.inflight)return H.inflight;
  if(!force&&H.data&&Date.now()-H.at<60000&&H.data.entry?.day===homeDay()){scheduleHomeDay();return;}
  const uid=H.uid,seq=++H.seq,controller=new AbortController();H.controller=controller;
  H.inflight=(async()=>{try{const d=await api('/cup/state',null,controller.signal);if(seq===H.seq&&uid===user()?.uid)acceptHome(d);}
   catch(_){if(seq===H.seq&&!controller.signal.aborted){H.error=true;if(!H.data)paintHome();}}
   finally{if(seq===H.seq){H.inflight=null;H.controller=null;}}})();
  return H.inflight;
 }
 function homeChanged(id){
  H.route=id;clearTimeout(H.timer);
  if(id==='home')refreshHomeState();
  else{H.controller?.abort();H.seq++;H.controller=null;H.inflight=null;}
 }
 async function api(path,body,signal){
  const account=user();if(!account)throw Error('سجّل الدخول للمشاركة في كأس مجابيد');
  const controller=new AbortController();let rejectAbort;
  const interrupted=new Promise((_,reject)=>{rejectAbort=reject;}),abort=()=>{controller.abort();rejectAbort(Object.assign(Error('cup request interrupted'),{name:'AbortError'}));};
  signal?.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,12000);
  try{
   if(signal?.aborted)abort();
   return await Promise.race([interrupted,(async()=>{
    // Include token acquisition and body decoding in the same finite deadline.
    const token=await account.getIdToken();if(controller.signal.aborted)throw Object.assign(Error('request cancelled'),{name:'AbortError'});if(account.uid!==user()?.uid)throw Error('تغيّر الحساب؛ افتح الكأس مجددًا');
    const response=await fetch('https://'+GAME_SRV+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal});
    const data=await response.json();if(account.uid!==user()?.uid)throw Error('تغيّر الحساب؛ افتح الكأس مجددًا');
    if(!response.ok||data.ok===false){const e=Error(data.message||data.error||'تعذّر الاتصال بالكأس');e.code=data.code||data.error;throw e;}
    return data;
   })()]);
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
 }
 function explain(error){
  const messages={ENTRY_PRICE_CHANGED:'تغيّرت المشاركة المجانية من جهاز آخر. راجع السعر الظاهر ثم أعد المحاولة.',INSUFFICIENT_GOLD:'رصيد الذهب لا يكفي للمشاركة. يمكنك انتظار المشاركة المجانية التالية.',TEST_NOT_ALLOWED:'خيار التجربة غير متاح لهذا الحساب.',TEST_UNAVAILABLE:'انتهى خيار الاختبار المؤقت؛ حدّث للعودة إلى الكأس الرسمي.',SETTLEMENT_PENDING:'نتيجة المباراة السابقة قيد التأكيد. حدّث الكأس قبل بدء مباراة أخرى.',MATCH_STARTED:'بدأ تأكيد المباراة؛ عد إلى الطاولة لإكمالها.',QUEUE_BUSY:'البحث مشغول حاليًا؛ أعد المحاولة بعد قليل.',AUTH_REQUIRED:'سجّل الدخول لفتح كأس مجابيد.',ACCOUNT_BANNED:'هذا الحساب غير متاح للعب.',CUP_DISABLED:'كأس مجابيد غير متاح حاليًا.',ACTIVE_MATCH:'لديك مباراة كأس قائمة؛ عد إليها أولًا.'};
  if(messages[error?.code])return messages[error.code];
  return error?.name==='AbortError'?'لم يصل تأكيد الخادم. اضغط تحديث للتحقق؛ لن نبدأ طلبًا جديدًا تلقائيًا.':'تعذّر تأكيد العملية. اضغط تحديث للتحقق من حالتها.';
 }
 function accept(data){
  if(!data||!data.rules||!data.entry)return false;
  C.data=data;C.offset=(Number(data.serverNow)||Date.now())-Date.now();
  acceptHome(data);
  if(data.search?.requestId)C.requestId=data.search.requestId;
  if(!data.search&&!data.assignment&&!C.busy)C.requestId=null;
  render();renderResult();return true;
 }
 function schedule(){
  clearTimeout(C.timer);if(!C.open||document.hidden||C.busy||C.entering||C.error)return;
  const active=C.data?.search||C.data?.assignment;if(!active)return;
  C.timer=setTimeout(()=>refresh(),C.data?.search?3000:6000);
 }
 async function refresh(keepError=false){
  resetIdentity();if(!C.open||!user()||document.hidden||C.busy)return;
  C.controller?.abort();const seq=++C.seq,uid=C.uid,controller=new AbortController();C.controller=controller;C.loading=true;if(!keepError)C.error='';render();
  try{
   const d=await api('/cup/state',null,controller.signal);
   if(seq!==C.seq||uid!==user()?.uid||!C.open)return;
   if(!keepError)C.error='';accept(d);
   if(C.tab==='leaders')await leaders(controller.signal,seq,uid);
   if(C.autoEnter&&C.open&&!document.hidden&&d.assignment&&d.assignment.status!=='settling')enter(d.assignment);
  }catch(e){if(seq===C.seq&&!controller.signal.aborted)C.error=explain(e);}
  finally{if(seq===C.seq){C.loading=false;C.controller=null;render();schedule();}}
 }
 async function leaders(signal,seq=C.seq,uid=C.uid){
  const d=await api('/cup/leaders',null,signal);if(seq===C.seq&&uid===user()?.uid&&C.open&&C.tab==='leaders'){C.leaders=Array.isArray(d.leaders)?d.leaders:[];C.leadersAt=Date.now();render();}
 }
 function mount(){
  if($('majabeedCup'))return;
  const el=document.createElement('section');el.id='majabeedCup';el.hidden=true;el.dir='rtl';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','mcTitle');
  el.innerHTML='<div class="mcShell"><header class="mcHeader"><button type="button" data-mc="close" aria-label="إغلاق كأس مجابيد">×</button><div><small>مجابيد · طريق الأبطال</small><h1 id="mcTitle">كأس مجابيد</h1></div><span class="mcHeaderSpace" aria-hidden="true"></span></header><nav class="mcTabs" aria-label="أقسام الكأس"><button type="button" data-mc="journey">رحلتي</button><button type="button" data-mc="leaders">أبطال مجابيد</button><button type="button" data-mc="rules">التعليمات</button></nav><div class="mcScroll"><div id="mcMessage" role="status" aria-live="polite"></div><div id="mcBody"></div></div><footer id="mcFooter"></footer></div>';
  el.addEventListener('click',event=>{const button=event.target.closest('[data-mc]');if(button&&!button.disabled)action(button.dataset.mc);});
  el.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
  el.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();action('close');}
   if(event.key==='Tab'){const nodes=[...el.querySelectorAll('button:not(:disabled),a[href]')].filter(x=>x.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  document.body.appendChild(el);
 }
 function journey(){
  const d=C.data,r=rules(),p=d.progress||{},profile=d.profile||{},stage=Math.min(2,Math.max(0,Number(p.stage)||0)),active=p.status==='active';
  const finished=p.status==='won',lost=p.status==='lost';
  const stages=r.stages.map((target,i)=>{const complete=finished||i<stage,selected=!finished&&i===stage;
   const wins=complete?target:selected?Math.min(target,Number(p.wins)||0):0;
   return '<article class="mcStage '+(complete?'complete':selected?'current':'locked')+'"><div class="mcStageNumber">'+(complete?'✓':n(i+1))+'</div><b>المرحلة '+['الأولى','الثانية','الثالثة'][i]+'</b><span>'+n(target)+' انتصارات</span><div class="mcWins" aria-label="'+n(wins)+' من '+n(target)+' انتصارات">'+Array.from({length:target},(_,k)=>'<i class="'+(k<wins?'earned':'')+'"></i>').join('')+'</div><small><bdi>+'+n(r.stageBonuses[i])+'</bdi> تصنيف</small></article>';
  }).join('');
  return '<div class="mcHero"><div class="mcTrophy">'+trophy+'</div><div><small>جائزة بطل الكأس</small><strong><bdi>'+n(r.championGold)+'</bdi> <span>ذهب</span></strong><p>وبطولة تُضاف إلى سجل أبطالك</p></div></div>'+
   '<div class="mcProfile">'+avatar(profile.avatar,profile.name)+'<div><b>'+esc(profile.name||user()?.displayName||'رحلتك إلى الكأس')+'</b><small>'+n(profile.titles)+' بطولة مجابيد</small></div><span><bdi>'+n(profile.rank)+'</bdi><small>نقاط التصنيف</small></span></div>'+
   '<div class="mcStageIntro"><h2>طريقك إلى البطولة</h2><span>3 مراحل</span></div><div class="mcStages">'+stages+'</div>'+
   '<div class="mcAttempt"><div><b>'+(finished?'أنت بطل كأس مجابيد!':lost?'انتهت المحاولة':active?'المرحلة '+n(stage+1)+' · نكمل من هنا':'ابدأ رحلتك')+'</b><p>'+(finished?'أُضيفت البطولة والمكافأة بعد تأكيد النتيجة.':lost?'المشاركة التالية تبدأ من المرحلة الأولى.':active?'تقدّمك محفوظ؛ يمكنك إكمال الكأس لاحقًا.':'اجمع الانتصارات قبل خسارة الفرص الثلاث في المرحلة.')+'</p></div>'+hearts(lost?3:active?Number(p.losses)||0:0,3)+'</div>'+
   '<div class="mcGameRules"><span><b>'+n(r.basras)+'</b> بواصر</span><span><b>'+n(r.jokers)+'</b> جواكر</span><span><b>2 × 2</b> جماعي</span></div>'+
   '<p class="mcRankNote">الفوز <bdi>+'+n(r.rankWin)+'</bdi> · الخسارة <bdi>−'+n(r.rankLoss)+'</bdi> تصنيف<br><small>مكافأة إكمال كل مرحلة مرة واحدة يوميًا</small></p>';
 }
 function leadersView(){
  if(!C.leaders)return '<div class="mcEmpty">'+(C.error?'تعذّر عرض أبطال مجابيد. أعد المحاولة.':'جارٍ تحميل أبطال مجابيد…')+'</div>';
  if(!C.leaders.length)return '<div class="mcEmpty"><div class="mcTrophy">'+trophy+'</div><h2>الصدارة تنتظر أول أبطالها</h2><p>أكمل مراحل الكأس لتضيف أول بطولة إلى سجلك.</p></div>';
  return '<div class="mcLeadersIntro"><h2>أبطال مجابيد</h2><p>ترتيب عام حسب عدد البطولات</p></div><ol class="mcLeaders">'+C.leaders.map(p=>'<li class="'+(p.position===1?'leader':p.position===2?'runner':'')+'"><b class="mcPosition">'+n(p.position)+'</b>'+avatar(p.avatar,p.name)+'<div><strong>'+esc(p.name||'لاعب')+'</strong><small>'+esc(p.position===1?'الزعيم':p.position===2?'الوصيف':'المركز '+n(p.position))+'</small></div><span><b>'+n(p.titles)+'</b><small>بطولة</small></span></li>').join('')+'</ol>';
 }
 function rulesView(){const r=rules();return '<article class="mcRules"><h2>كل فوز يقرّبك من الكأس</h2><ol><li>المرحلة الأولى '+n(r.stages[0])+' انتصار، والثانية '+n(r.stages[1])+', والثالثة '+n(r.stages[2])+'.</li><li>لك '+n(r.lossesPerStage)+' فرص خسارة في كل مرحلة، تتجدد عند الانتقال للمرحلة التالية. الخسارة الثالثة تنهي المحاولة، والمشاركة التالية من البداية.</li><li>مشاركة مجانية كل يوم، تتجدد عند 00:00 بتوقيت السعودية. المشاركة التالية '+n(r.entryPrice)+' ذهب. مواصلة المحاولة نفسها مجانية.</li><li>تُؤكد المشاركة عند اكتمال الطاولة والبدء. إلغاء البحث قبل تثبيت المباراة لا يخصم المشاركة.</li><li>بطل الكأس يربح '+n(r.championGold)+' ذهب وبطولة مجابيد. ترتيب الأبطال يجمع كل البطولات، والأول الزعيم والثاني الوصيف.</li><li>الفوز +'+n(r.rankWin)+' والخسارة −'+n(r.rankLoss)+' تصنيف، ومكافآت المراحل '+r.stageBonuses.map(n).join(' / ')+' تصنيف. مكافأة كل مرحلة مرة واحدة يوميًا.</li><li>البحث واحد لجميع المراحل. كل مباراة جماعية 2 × 2، برزمة '+n(r.basras)+' بواصر و'+n(r.jokers)+' جواكر.</li><li>الخروج بين المباريات يحفظ تقدمك. مغادرة مباراة بدأت تُعامل وفق نتيجة الانسحاب المعتمدة من الخادم.</li></ol></article>';}
 function footer(){
  const d=C.data,disabled=C.busy||C.loading||C.entering;
  if(C.entering)return '<p class="mcEntryNote">جارٍ الاتصال بطاولة الكأس…</p><button class="mcPrimary" disabled><span class="mcSpinner"></span> جارٍ الانتقال إلى المباراة…</button>';
  if(C.error)return '<button class="mcPrimary" type="button" data-mc="refresh" '+(disabled?'disabled':'')+'>إعادة المحاولة والتحقق</button>'+(d?.search?'<button class="mcSecondary" type="button" data-mc="cancel" '+(C.busy?'disabled':'')+'>إلغاء البحث</button>':'');
  if(!d)return C.loading?'<p class="mcEntryNote">جارٍ التحقق من تقدمك والمشاركة…</p>':'<button class="mcPrimary" type="button" data-mc="refresh">إعادة المحاولة</button>';
  if(C.tab!=='journey')return '<button class="mcPrimary" type="button" data-mc="journey">العودة إلى رحلتي</button>';
  if(d.assignment){const settling=d.assignment.status==='settling';return '<p class="mcEntryNote">'+(settling?'جارٍ تأكيد نتيجة المباراة والمكافأة':'طاولتك جاهزة · الدخول بعد تأكيد المشاركة')+'</p><button class="mcPrimary" data-mc="'+(settling?'refresh':'resume')+'" '+(disabled?'disabled':'')+'>'+(settling?'التحقق من النتيجة':'العودة إلى مباراة الكأس')+'</button>';}
  if(d.search)return '<div class="mcQueue"><span class="mcSpinner"></span><div><b>'+(C.busy?'جارٍ إلغاء البحث…':'نبحث عن لاعبين للكأس')+'</b><small><bdi>'+n(d.search.humanCount||1)+' / 4</bdi> لاعبين</small></div></div><button class="mcSecondary" data-mc="cancel" '+(C.busy?'disabled':'')+'>إلغاء البحث</button>';
  if(C.confirm)return '<div class="mcConfirm"><b>تأكيد المشاركة</b><p>رسوم هذه المحاولة <bdi>'+n(d.entry.price)+'</bdi> ذهب، تُخصم عند بدء أول مباراة.</p><div><button class="mcPrimary" data-mc="join" '+(disabled?'disabled':'')+'>المشاركة مقابل '+n(d.entry.price)+' ذهب</button><button class="mcSecondary" data-mc="back" '+(C.busy?'disabled':'')+'>رجوع</button></div></div>';
  const continuation=d.entry.continuation===true,text=continuation?'أكمل الكأس':d.entry.freeAvailable?'ابدأ المشاركة المجانية':'شارك بـ '+n(d.entry.price)+' ذهب';
  return '<p class="mcEntryNote">'+(continuation?'محاولتك مستمرة · دون رسوم إضافية':d.entry.freeAvailable?'مشاركتك المجانية لهذا اليوم جاهزة':'المجانية التالية عند 00:00 بتوقيت السعودية')+'</p><button class="mcPrimary" data-mc="start" '+(disabled?'disabled':'')+'>'+(C.busy?'جارٍ تأكيد الطلب…':text)+'</button><small class="mcCommitNote">'+(C.requestId?'طلب سابق قيد التحقق؛ تحقّق من الحالة أولًا':'')+'</small>';
 }
 function render(){
  if(!C.open)return;mount();const el=$('majabeedCup');el.hidden=false;el.dataset.tab=C.tab;el.dataset.footer=C.confirm?'confirm':C.data?.search?'search':'normal';
  el.setAttribute('aria-busy',String(C.loading||C.busy||C.entering));
  el.querySelectorAll('.mcTabs button').forEach(b=>{b.classList.toggle('selected',b.dataset.mc===C.tab);b.setAttribute('aria-pressed',String(b.dataset.mc===C.tab));b.disabled=C.busy||C.entering;});
  const message=$('mcMessage');message.textContent=C.error||(C.entering?'جارٍ الاتصال بطاولة الكأس…':C.busy?'جارٍ تأكيد العملية…':C.loading?'جارٍ تحديث '+(C.tab==='leaders'?'أبطال مجابيد':'الكأس')+'…':C.data?.notice||'');message.hidden=!message.textContent;
  el.dataset.message=String(!!message.textContent);el.dataset.loading=String(C.loading||C.busy||C.entering);
  const body=$('mcBody'),markup=C.data?(C.tab==='leaders'?leadersView():C.tab==='rules'?rulesView():journey()):'<div class="mcEmpty"><div class="mcTrophy">'+trophy+'</div><h2>بطولتك القادمة تبدأ هنا</h2><p>'+(C.error?'لم نتمكن من تأكيد الحالة. يمكنك إعادة المحاولة أو إغلاق الكأس.':'نُحمّل تقدمك والمشاركة المتاحة من الخادم.')+'</p></div>';
  if(body._markup!==markup){body.innerHTML=markup;body._markup=markup;}
  const foot=$('mcFooter'),fm=footer();if(foot._markup!==fm){foot.innerHTML=fm;foot._markup=fm;}
  window.MajabeedAdIndicators?.refresh();
 }
 async function join(){
  if(C.busy||C.loading||!C.open||C.tab!=='journey'||!C.data||C.data.assignment||C.data.search||window.MajabeedEntryGate?.busy)return false;
  if(C.requestId){await refresh();return false;} // Resolve an uncertain earlier admission before requesting another.
  if(online()?.active&&!['over','closed'].includes(online().status)){C.error='أنت في طاولة أخرى. اخرج منها قبل بدء البحث عن الكأس.';render();return;}
  const uid=user()?.uid;if(!uid)return;
  const maxEntryPrice=Number(C.data.entry.price)||0;
  const intent={};C.entryIntent=intent;C.entryPending=true;C.busy=true;C.error='';C.autoEnter=false;C.confirm=false;render();
  clearTimeout(C.entryTimer);C.entryTimer=setTimeout(()=>{if(C.entryIntent===intent){C.entryIntent=null;C.entryPending=false;C.busy=false;C.autoEnter=false;C.error='لم يكتمل تأكيد الدخول. أعد المحاولة للتحقق من المشاركة.';render();}},90000);
  const current=()=>C.entryIntent===intent&&C.open&&C.tab==='journey'&&C.uid===uid&&user()?.uid===uid&&currentGame()==='majabeed'&&!C.data?.search&&!C.data?.assignment&&!(online()?.active&&!['over','closed'].includes(online().status));
  const admit=async()=>{
   if(!current()||document.hidden)return false;
   // A request ID and server reservation exist only after the shared ad gate admits entry.
   C.entryPending=false;C.autoEnter=true;C.requestId=C.requestId||('mc-'+crypto.randomUUID());const requestId=C.requestId;
   const d=await api('/cup/join',{requestId,maxEntryPrice});if(C.entryIntent!==intent||!C.open||uid!==user()?.uid)return false;
   accept(d.state||d);return true;
  };
  try{
   if(!window.MajabeedEntryGate?.run)throw Error('جارٍ تجهيز الدخول؛ حاول مرة أخرى.');
   return await window.MajabeedEntryGate.run(admit,{isCurrent:current,beforeStore:()=>{if(C.entryIntent===intent)hide();}});
  }catch(e){if(C.entryIntent===intent&&uid===user()?.uid){C.error=explain(e);C.autoEnter=false;}return false;}
  finally{if(C.entryIntent===intent&&uid===user()?.uid){clearTimeout(C.entryTimer);C.entryIntent=null;C.entryPending=false;C.busy=false;render();if(C.open)await refresh(!!C.error);}}
 }
 async function cancel(){
  if(C.busy||!C.requestId)return false;C.controller?.abort();const seq=++C.seq,uid=user()?.uid,requestId=C.requestId;C.loading=false;C.busy=true;C.autoEnter=false;C.error='';render();
  try{const d=await api('/cup/cancel',{requestId});if(seq!==C.seq||uid!==user()?.uid||!C.open)return false;accept(d.state||d);C.requestId=null;return true;}
  catch(e){if(seq===C.seq&&uid===user()?.uid)C.error=explain(e);return false;}
  finally{if(seq===C.seq&&uid===user()?.uid){C.busy=false;render();if(C.open)await refresh(!!C.error);}}
 }
 function enter(assignment){
  if(C.entering||document.hidden||!assignment||!/^cm-[a-zA-Z0-9-]+$/.test(assignment.room)||!/^cp-[a-zA-Z0-9-]{1,60}$/.test(assignment.playerId))return;
  const on=online();if(!on)return;
  if(on.active&&on.room!==assignment.room&&!['over','closed'].includes(on.status)){C.autoEnter=false;C.error='أنت في طاولة أخرى. اخرج منها ثم عد إلى مباراة الكأس.';render();return;}
  const navigation={uid:C.uid,room:assignment.room};C.navigation=navigation;C.entering=true;C.autoEnter=false;C.error='';render();
  navigation.timer=setTimeout(()=>{if(C.navigation!==navigation)return;C.navigation=null;C.entering=false;C.error='لم يكتمل الاتصال بالطاولة. تحقّق من الحالة ثم عد إلى المباراة.';render();},15000);
  try{
   if(on.active&&on.room!==assignment.room)leaveOnline();
   on.pendingTier=null;on.pendingMode='team';on.assignmentPid={room:assignment.room,pid:assignment.playerId};
   const url=new URL(location.href);url.searchParams.set('room',assignment.room);url.searchParams.delete('spectate');url.searchParams.delete('league');history.replaceState(null,'',url.pathname+url.search+url.hash);
   if(enterOnline()===false)throw Error('cup connection rejected');
   if(C.navigation===navigation&&on.active&&on.room===assignment.room&&on.cup?.room===assignment.room&&['lobby','waiting','playing','over'].includes(on.status))hide();
  }catch(_){if(C.navigation===navigation){clearTimeout(navigation.timer);C.navigation=null;C.entering=false;C.error='تعذّر فتح طاولة الكأس. تحقّق من الحالة وأعد المحاولة.';render();}}
 }
 function hide(){C.view++;C.entryIntent=null;C.entryPending=false;C.busy=false;C.loading=false;C.entering=false;clearTimeout(C.entryTimer);clearTimeout(C.navigation?.timer);C.navigation=null;C.open=false;C.autoEnter=false;C.confirm=false;C.seq++;C.controller?.abort();C.controller=null;clearTimeout(C.timer);$('majabeedCup')?.setAttribute('hidden','');lockPage(false);C.focus?.focus?.({preventScroll:true});refreshHomeState();}
 async function action(name){
  resetIdentity();if(name==='close'){if(C.busy||C.entering){hide();return;}const view=C.view;if(C.data?.search||C.requestId&&!C.data?.assignment)await cancel();if(view===C.view)hide();return;}
  if(C.busy||C.entering)return;
  if(name==='refresh'){await refresh();return;}
  if(['journey','leaders','rules'].includes(name)){if(C.tab!==name){C.controller?.abort();C.seq++;C.loading=false;}C.tab=name;C.confirm=false;render();if(!C.data||name==='leaders'&&(!C.leaders||Date.now()-(C.leadersAt||0)>60000))await refresh();else schedule();return;}
  if(name==='back'){C.confirm=false;render();return;}
  if(name==='resume'){enter(C.data?.assignment);return;}
  if(name==='cancel'){await cancel();return;}
  if(name==='start'){if(C.busy||C.loading)return;if(C.requestId){await refresh();return;}if(Number(C.data?.entry?.price)>0){C.confirm=true;render();return;}await join();return;}
  if(name==='join')await join();
 }
 function open(){
  if(C.entryPending)return;
  if(currentGame()==='baloot')return;
  if(!user()){if(typeof toast2==='function')toast2('سجّل الدخول للمشاركة في كأس مجابيد');return;}
  resetIdentity();H.controller?.abort();H.seq++;H.controller=null;H.inflight=null;clearTimeout(H.timer);C.view++;C.focus=document.activeElement;C.open=true;C.tab='journey';C.confirm=false;C.autoEnter=false;mount();lockPage(true);render();$('majabeedCup').querySelector('[data-mc="close"]').focus({preventScroll:true});refresh();
 }
 function lobby(state){
  const wait=$('onlWait');if(!wait)return;wait.dataset.majabeedCup='true';
  const title=wait.querySelector('h2'),sub=wait.querySelector('.sub');if(title)title.textContent='كأس مجابيد';if(sub)sub.textContent=(state.cup?.test?'تجربة · ':'')+'10 بواصر · 9 جواكر · جماعي 2 × 2';
  const count=$('uiLobbyCount');if(count)count.innerHTML='<bdi>'+n(state.seats?.length)+' / 4</bdi><small>لاعبون</small>';
  const help=$('uiLobbySeatHelp');if(help)help.textContent=state.cup?.entryStatus==='confirmed'?'اكتمل تأكيد المشاركة؛ تبدأ المباراة الآن.':'ننتظر اتصال اللاعبين وتأكيد المشاركة قبل بدء المباراة.';
  // The shared oHandle already escapes lobby names; decode that one layer before our own escaping.
  const nameAt=id=>String(state.lobby?.names?.[id]||'لاعب').replace(/&(amp|lt|gt|quot|#39);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[entity]));
  const players=$('lobbyPlayers');if(players){const markup=(state.seats||[]).map(id=>{const bot=state.lobby?.bots?.includes?.(id)||/^bot[-_]/.test(id);return '<div class="mcLobbyPlayer"><span>'+esc(nameAt(id))+'</span>'+(state.cup?.test&&bot?'<small>بوت · اختبار</small>':'')+'</div>';}).join('');if(players._cupMarkup!==markup){players.innerHTML=markup;players._cupMarkup=markup;}}
 }
 function renderResult(){
  const on=online(),host=$('mcResult');if(!on?.cup||on.status!=='over'||!host)return;
  const d=C.resultData||C.data,result=d?.lastResult,confirmed=result&&result.match===on.cup.match;
  if(!confirmed){host.innerHTML='<p>جارٍ تأكيد نتيجة الكأس…</p><button type="button" class="mcSecondary" data-cup-retry>تحديث النتيجة</button>';host.querySelector('button').onclick=()=>fetchResult(on.cup.match,on.cup.test);return;}
  const status=result.status==='won'?'بطل كأس مجابيد':result.status==='lost'?'انتهت المحاولة · تبدأ التالية من المرحلة الأولى':result.stageAfter>result.stageBefore?'تأهلت إلى المرحلة '+n(result.stageAfter+1):'المرحلة '+n(result.stageAfter+1)+' · '+n(result.wins)+' انتصارات';
  host.innerHTML='<h3>'+esc(status)+'</h3>'+(result.forfeited===true?'<p class="mcForfeitReason">احتُسبت هذه المباراة انسحابًا على حسابك</p>':'')+hearts(Number(result.losses)||0,3)+(on.cup.test?'<p>تجربة فقط · لم يتغير الذهب أو التصنيف</p>':'<div class="mcResultAmounts"><span><bdi>'+delta(result.rankDelta)+'</bdi> تصنيف</span><span><bdi>'+delta(result.goldDelta)+'</bdi> ذهب</span></div>'+(result.stageBonus?'<small>تشمل مكافأة المرحلة +'+n(result.stageBonus)+' تصنيف</small>':''));
  if(C.resultSeen!==result.match){C.resultSeen=result.match;if(!on.cup.test&&typeof pullServerStats==='function')pullServerStats(0);}
 }
 function showResult(){
  const on=online();if(!on?.cup||on.status!=='over'||window.MajabeedFinale?.presentation())return;
  const card=document.querySelector('#oOver #resCard')||$('oOver');if(!card)return;
  if(!$('mcResult')){const el=document.createElement('section');el.id='mcResult';el.className='mcResult';const menu=$('oMenu');card.insertBefore(el,menu?.parentElement?.parentElement===card?menu.parentElement:null);}
  if($('oMenu'))$('oMenu').textContent='متابعة الكأس';
  if($('oResultKind'))$('oResultKind').textContent=on.cup.test?'نتيجة تجربة الكأس':'نتيجة كأس مجابيد';
  renderResult();
 }
 async function fetchResult(match,test){
  if(document.hidden||online()?.cup?.match!==match||online()?.status!=='over'||C.resultFetching===match)return;const uid=user()?.uid;if(!uid)return;C.resultFetching=match;
  try{const d=await api('/cup/state'+(test?'?test=1':''));if(uid!==user()?.uid||online()?.cup?.match!==match||online()?.status!=='over')return;C.resultData=d;acceptHome(d,test);renderResult();if(d.lastResult?.match!==match){clearTimeout(C.resultTimer);C.resultTimer=setTimeout(()=>fetchResult(match,test),6000);}}
  catch(_){if(online()?.cup?.match===match){const e=$('mcResult');if(e){e.innerHTML='<p>النتيجة لم تتأكد بعد. يمكنك العودة للكأس والتحقق دون احتساب مكافأة مؤقتة.</p><button type="button" class="mcSecondary">تحديث النتيجة</button>';e.querySelector('button').onclick=()=>fetchResult(match,test);}}}
  finally{if(C.resultFetching===match)C.resultFetching=null;}
 }
 function state(msg){
  resetIdentity();
  const on=online(),root=$('onl');if(root)root.dataset.majabeedCup=msg.cup?'true':'false';
  if(C.navigation&&C.navigation.uid===user()?.uid&&msg.cup?.room===C.navigation.room&&on?.room===C.navigation.room&&['lobby','waiting','playing','over'].includes(msg.status))hide();
  if(!msg.cup){$('mcResult')?.remove();$('onlWait')?.removeAttribute('data-majabeed-cup');if(C.resultMatch&&$('oMenu'))$('oMenu').textContent='العودة للرئيسية';C.resultMatch=null;clearTimeout(C.resultTimer);return;}
  if(msg.status==='closed'){C.autoEnter=false;if(on?.active)leaveOnline();open();return;}
  if($('uiOnlineTitle'))$('uiOnlineTitle').textContent='كأس مجابيد'+(msg.cup.test?' · تجربة':'');
  if($('uiOnlineMode'))$('uiOnlineMode').textContent=msg.status==='playing'&&on?.view?uiMatchLabels(on.view).detail:'10 بواصر · 9 جواكر · جماعي 2 × 2';
  if(msg.status==='lobby'||msg.status==='waiting')lobby(on);
  if(msg.status==='over'){
   // Terminal state may arrive before the final-card presentation ends.
   // renderOver owns opening/mounting the result; data confirmation can run now.
   if(C.resultMatch!==msg.cup.match){C.resultMatch=msg.cup.match;fetchResult(msg.cup.match,!!msg.cup.test);}
  }
 }
 async function profile(uid){
  const anchor=$('pfRankProgress');if(!anchor||!uid||currentGame()==='baloot')return;$('mcProfileTitles')?.remove();
  const box=document.createElement('div');box.id='mcProfileTitles';box.className='mcProfileTitles';box.dataset.uid=uid;anchor.after(box);
  try{const d=await api('/cup/profile?uid='+encodeURIComponent(uid));if($('mcProfileTitles')!==box||box.dataset.uid!==uid)return;const titles=Number(d.profile?.titles)||0;box.textContent=titles?'🏆 '+n(titles)+' بطولة مجابيد':'';box.hidden=!titles;}catch(_){box.remove();}
 }
 window.uiCupOpen=open;window.uiCupState=state;window.uiCupLobby=lobby;window.uiCupProfile=profile;
 window.MajabeedCup={open,close:()=>action('close'),refresh,renderResult:showResult,homeChanged,refreshHome:refreshHomeState,accountChanged:uid=>resetIdentity(uid||null)};
 if($('hTournament'))$('hTournament').onclick=open;
 document.addEventListener('visibilitychange',()=>{if(document.hidden){C.autoEnter=false;C.controller?.abort();C.seq++;C.loading=false;clearTimeout(C.timer);clearTimeout(C.resultTimer);H.controller?.abort();H.seq++;H.controller=null;H.inflight=null;clearTimeout(H.timer);}else if(C.open)refresh();else if(online()?.cup&&online()?.status==='over')fetchResult(online().cup.match,!!online().cup.test);else refreshHomeState();});
 window.addEventListener('pagehide',()=>{C.autoEnter=false;clearTimeout(C.timer);clearTimeout(C.resultTimer);clearTimeout(H.timer);H.controller?.abort();});
 window.addEventListener('online',()=>{if(C.open)refresh();else refreshHomeState(true);});
 resetIdentity();paintHome();refreshHomeState();
})();
