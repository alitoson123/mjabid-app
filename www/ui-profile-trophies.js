/* V419: read-only, account-bound presentation of confirmed championship records. */
(function(){
 'use strict';
 const CATALOG=Object.freeze([
  {id:'cup',title:'كأس مجابيد',detail:'بطل الكأس',group:'cup'},
  {id:'weekly-gold',title:'الأول أسبوعيًا',detail:'الصدارة الأسبوعية',group:'weekly'},
  {id:'weekly-silver',title:'الثاني أسبوعيًا',detail:'الصدارة الأسبوعية',group:'weekly'},
  {id:'weekly-bronze',title:'الثالث أسبوعيًا',detail:'الصدارة الأسبوعية',group:'weekly'},
  {id:'monthly-gold',title:'الأول شهريًا',detail:'الصدارة الشهرية',group:'monthly'},
  {id:'monthly-silver',title:'الثاني شهريًا',detail:'الصدارة الشهرية',group:'monthly'},
  {id:'monthly-bronze',title:'الثالث شهريًا',detail:'الصدارة الشهرية',group:'monthly'}
 ]);
 const OLD_BEST=Object.freeze({'المركز الأول':'weekly-gold','المركز الثاني':'weekly-silver','المركز الثالث':'weekly-bronze','من أفضل 10':null,'من أفضل 20':null,'من أفضل 30':null});
 const T={epoch:0,context:null,controller:null,flight:null,state:'hidden',data:null,root:null};
 const user=()=>typeof FB!=='undefined'?FB.user:null;
 const viewed=()=>typeof viewedProfile!=='undefined'?viewedProfile:null;
 const $=id=>document.getElementById(id);
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function selected(){try{return window.MajabeedBaloot?.state?.selected||$('frame')?.dataset.majabeedGame||localStorage.getItem('mj-game')||'majabeed';}catch(_){return 'majabeed';}}
 function identity(player=viewed()){
  const selection=selected(),other=!!player;
  return {account:user()?.uid||null,target:other?(typeof player.uid==='string'&&player.uid?player.uid:null):user()?.uid||null,other,selection,game:other?(player.game==='baloot'?'baloot':'majabeed'):selection};
 }
 const same=(a,b)=>!!a&&!!b&&['account','target','other','selection','game'].every(k=>a[k]===b[k]);
 const validTime=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&Number.isFinite(new Date(value).getTime())?value:null;
 function date(value,monthOnly=false){const at=validTime(value);if(!at)return '';try{return new Date(at).toLocaleDateString('ar-SA-u-ca-gregory',{...(monthOnly?{}:{day:'numeric'}),month:'long',year:'numeric'});}catch(_){return '';}}
 function period(value,group){
  const pattern=group==='weekly'?/^\d{4}-\d{2}-\d{2}$/:/^\d{4}-\d{2}$/;
  if(typeof value!=='string'||!pattern.test(value))return '';
  const iso=value+(group==='monthly'?'-01':''),at=Date.parse(iso+'T00:00:00Z');
  if(!Number.isFinite(at)||new Date(at).toISOString().slice(0,10)!==iso)return '';
  return date(at,group==='monthly');
 }
 function normalize(data,target){
  if(data?.ok!==true||data.uid!==target||!Array.isArray(data.trophies)||data.trophies.length!==CATALOG.length)throw Error('invalid trophies');
  const seen=new Map();
  for(const row of data.trophies){
   if(!CATALOG.some(item=>item.id===row?.id)||seen.has(row.id)||!Number.isSafeInteger(row.count)||row.count<0)throw Error('invalid trophy count');
   seen.set(row.id,{count:row.count,lastEarnedAt:validTime(row.lastEarnedAt)});
  }
  const trophies=CATALOG.map(item=>({...item,...seen.get(item.id)}));
  let legacy=null;const old=data.legacyBest;
  if(old&&Object.prototype.hasOwnProperty.call(OLD_BEST,old.name)){
   const matching=OLD_BEST[old.name];
   if(!matching||!seen.get(matching).count)legacy={name:old.name,date:validTime(old.date)};
  }
  return {trophies,legacy,coverage:{weekly:period(data.coverage?.weekly?.firstPeriod,'weekly'),monthly:period(data.coverage?.monthly?.firstPeriod,'monthly')}};
 }
 function clear(){
  T.epoch++;T.controller?.abort();T.controller=null;T.flight=null;T.context=null;T.data=null;T.state='hidden';
  $('mcProfileTitles')?.remove();
  const el=$('pfAchievementsList');if(el){el.innerHTML='';el.hidden=true;el.removeAttribute('aria-busy');el.removeAttribute('data-trophy-target');}
 }
 function root(){
  const el=$('pfAchievementsList');if(!el)return null;
  if(T.root!==el){T.root=el;el.addEventListener('click',event=>{if(event.target?.closest?.('[data-trophies-retry]'))retry();});}
  el.classList.add('ptGallery');el.hidden=false;return el;
 }
 function markup(){
  const heading='<div class="ptHeading"><div><span class="ptEyebrow">مجابيد</span><h3>البطولات</h3></div><span class="ptHeadingMark" aria-hidden="true">✦</span></div>';
  if(T.state==='loading')return heading+'<div class="ptState ptLoading" role="status"><span class="ptLoadingMark" aria-hidden="true"></span><strong>جارٍ تحميل البطولات…</strong><p>نراجع سجل هذا اللاعب</p></div>';
  if(T.state==='signin')return heading+'<div class="ptState" role="status"><strong>سجّل الدخول لعرض البطولات</strong></div>';
  if(T.state==='missing')return heading+'<div class="ptState" role="status"><strong>سجل البطولات غير متاح لهذا اللاعب</strong></div>';
  if(T.state==='error')return heading+'<div class="ptState ptError" role="status"><strong>تعذّر تحميل البطولات الآن</strong><p>أعد المحاولة للتحقق من السجل.</p><button type="button" data-trophies-retry>إعادة المحاولة</button></div>';
  const d=T.data,earned=d.trophies.filter(t=>t.count>0);
  const cards=earned.map(t=>'<li class="ptCard'+(t.id==='cup'?' ptCup':'')+'" data-trophy="'+t.id+'"><div class="ptArt"><img src="ui-art/trophies-v419/'+t.id+'.png" width="112" height="112" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false"></div><div class="ptCardCopy"><small>'+t.detail+'</small><h4>'+t.title+'</h4><div class="ptCount"><bdi>'+t.count.toLocaleString('en-US')+'</bdi><span>'+(t.count===1?'مرة واحدة':'مرات التتويج')+'</span></div>'+(t.lastEarnedAt?'<p class="ptDate">آخر تتويج · '+esc(date(t.lastEarnedAt))+'</p>':'')+'</div></li>').join('');
  const empty='<div class="ptState ptEmpty"><span aria-hidden="true">✧</span><strong>لا توجد بطولات مسجلة بعد</strong><p>'+(T.context.other?'تظهر هنا البطولات التي حققها اللاعب.':'أولى بطولاتك تنتظرك. تظهر هنا كؤوسك ومراكزك في الصدارة.')+'</p></div>';
  const legacy=d.legacy?'<aside class="ptLegacy"><span class="ptLegacyMark" aria-hidden="true">✦</span><div><small>إنجاز سابق</small><strong>'+esc(d.legacy.name)+'</strong><p>في الصدارة الأسبوعية'+(d.legacy.date?' · '+esc(date(d.legacy.date)):'')+'</p></div></aside>':'';
  const coverage=['weekly','monthly'].filter(group=>earned.some(t=>t.group===group)).map(group=>'<span>'+(group==='weekly'?'سجل الأسبوعية':'سجل الشهرية')+(d.coverage[group]?' منذ '+esc(d.coverage[group]):' بحسب السجلات المحفوظة')+'</span>').join('');
  return heading+(earned.length?'<ul class="ptGrid" aria-label="البطولات المحققة">'+cards+'</ul>':empty)+legacy+(coverage?'<p class="ptCoverage">'+coverage+'</p>':'');
 }
 function paint(){const el=root();if(!el||T.state==='hidden')return;el.setAttribute('aria-busy',String(T.state==='loading'));if(T.context?.target)el.dataset.trophyTarget=T.context.target;el.innerHTML=markup();}
 async function load(){
  if(T.flight)return T.flight;
  const context=T.context,epoch=T.epoch,account=user();
  if(!context||!same(context,identity())||!account||context.game!=='majabeed')return false;
  const controller=new AbortController();T.controller=controller;T.state='loading';T.data=null;paint();
  const current=()=>T.epoch===epoch&&T.context===context&&same(context,identity())&&!controller.signal.aborted;
  const flight=(async()=>{
   let timer,abort;
   try{
    const interrupted=new Promise((_,reject)=>{abort=()=>reject(Error('trophies request interrupted'));controller.signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>controller.abort(),12000);});
    const operation=(async()=>{
     const token=await account.getIdToken();if(!current())throw Error('stale trophy request');
     const response=await fetch('https://'+GAME_SRV+'/profile/trophies?uid='+encodeURIComponent(context.target),{method:'GET',headers:{authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
     const data=await response.json();if(!current())throw Error('stale trophy response');
     if(!response.ok)throw Error('trophies unavailable');return normalize(data,context.target);
    })();
    const data=await Promise.race([operation,interrupted]);if(!current())return false;
    T.data=data;T.state='ready';paint();return true;
   }catch(_){if(T.epoch===epoch&&T.context===context&&same(context,identity())){T.data=null;T.state='error';paint();}return false;}
   finally{clearTimeout(timer);if(abort)controller.signal.removeEventListener('abort',abort);if(T.epoch===epoch){T.controller=null;T.flight=null;}}
  })();T.flight=flight;return flight;
 }
 function render(player){
  clear();const context=identity(player);T.context=context;
  if(context.game!=='majabeed')return false;
  if(!context.account){T.state='signin';paint();return false;}
  if(!context.target){T.state='missing';paint();return false;}
  T.state='loading';paint();return load();
 }
 function route(id){
  if(id!=='profile'){clear();return;}
  const context=identity();
  if(!same(context,T.context)||T.state==='hidden')return render(viewed()||undefined);
 }
 function contextChanged(){if(T.context&&!same(T.context,identity()))clear();$('mcProfileTitles')?.remove();}
 function retry(){if(T.state!=='error'||!same(T.context,identity()))return false;return load();}
 window.MajabeedTrophies={render,route,clear,contextChanged,retry,accountChanged:clear};
 window.addEventListener('pagehide',clear);
 window.addEventListener('pageshow',()=>{if(!$('profile')?.classList.contains('hidden'))route('profile');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&T.flight)clear();else if(!document.hidden&&!$('profile')?.classList.contains('hidden'))route('profile');});
})();
