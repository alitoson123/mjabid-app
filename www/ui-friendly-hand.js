/* Friendly Majabeed hand size and public session details. Game rules stay on the server. */
window.MajabeedFriendlyHands=(()=>{
 'use strict';
 const root=document.getElementById('onl'),hand=document.getElementById('oHand');
 const valid=n=>Number.isInteger(n)&&n>=7&&n<=15;
 const count=n=>valid(n)?n:9;
 const number=n=>toH(n);
 const friendlyLobby=()=>!!ONL.active&&['lobby','waiting'].includes(ONL.status)&&!!ONL.room&&!ONL.room.startsWith('pub-')&&!ONL.league&&!ONL.tournament&&!ONL.lobby?.tier?.fee&&ONL.lobby?.handCardsEditable!==false;
 const friendlyPlay=()=>!!ONL.active&&ONL.status==='playing'&&!!ONL.view&&ONL.view.isFriendly!==false&&!ONL.room?.startsWith('pub-')&&(ONL.view.isFriendlySession===true||(ONL.view.isFriendlySession==null&&ONL.view.isFriendly===true))&&!ONL.league&&!ONL.tournament;
 const editable=()=>friendlyLobby()&&ONL.status==='lobby'&&!!ONL.you&&ONL.lobby?.creator===ONL.you&&ONL.lobby?.handCardsEditable===true&&!ONL.paymentPending&&!UI_SESSION_START.pending&&ONL.lobby?.handCardsLocked!==true;
 const settings=document.createElement('div');settings.id='uiFriendlyHandSettings';settings.hidden=true;
 settings.innerHTML='<div class="uiHandSettingRow"><span>عدد الأوراق لكل لاعب</span><div class="uiHandStepper" role="group" aria-label="عدد أوراق اليد"><button id="uiFriendlyHandLess" type="button" aria-label="تقليل أوراق اليد">−</button><output id="uiFriendlyHandSelect" aria-live="polite"></output><button id="uiFriendlyHandMore" type="button" aria-label="زيادة أوراق اليد">+</button></div></div><p id="uiFriendlyHandHelp"></p>';
 document.getElementById('lobbyPublic').before(settings);
 const select=settings.querySelector('output'),help=settings.querySelector('p'),less=settings.querySelector('#uiFriendlyHandLess'),more=settings.querySelector('#uiFriendlyHandMore');
 let pendingHand=null,pendingTimer=null;
 function clearPendingHand(){clearTimeout(pendingTimer);pendingTimer=null;pendingHand=null;}
 function changeHand(delta){
  const value=count(ONL.lobby?.handCards)+delta;
  if(pendingHand||!editable()||!valid(value))return;
  pendingHand={room:ONL.room,value};
  pendingTimer=setTimeout(()=>{clearPendingHand();renderLobbySetting();},2500);
  renderLobbySetting();
  try{oSend({type:'config',handCards:value});}catch(error){clearPendingHand();renderLobbySetting();throw error;}
 }
 less.onclick=()=>changeHand(-1);more.onclick=()=>changeHand(1);
 function renderLobbySetting(){
  const show=friendlyLobby();settings.hidden=!show;
  if(pendingHand&&(!show||pendingHand.room!==ONL.room||!editable()||count(ONL.lobby?.handCards)===pendingHand.value))clearPendingHand();
  if(!show)return;
  const n=count(ONL.lobby?.handCards);select.textContent=number(n);less.disabled=!!pendingHand||!editable()||n<=7;more.disabled=!!pendingHand||!editable()||n>=15;
  help.textContent='الموزّع '+number(n+1)+' ورقة. تتجدد اليد إلى '+number(n+1)+' في دورك ما دامت الرزمة متاحة.';
  if(pendingHand)help.textContent='جارٍ حفظ عدد أوراق اليد…';
  settings.dataset.handCards=String(n);
 }
 function sessionDetails(d){
  const n=count(d.handCards),score=d.currentScore,order=d.deckOrder;
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const basras=integer(order?.basraCount,5,32)?order.basraCount:order?32:null;
  const jokers=integer(order?.jokerCount,0,100)?order.jokerCount:null;
  const layout={fixed:'الرص المعتمد',custom:'رص مخصص',random:'خلط عشوائي'}[order?.mode]||'إعداد الجلسة';
  const info=[['البواصر',basras===null?'غير محدد':number(basras)],['الجواكر',jokers===null?'غير محدد':number(jokers)],['أوراق اليد',number(n)],['الموزّع',number(n+1)],['طريقة الرص',layout],['النتيجة',d.hideScore===true?'مخفية أثناء اللعب':'ظاهرة']];
  const summary='<dl class="uiSessionSettingsGrid">'+info.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>';
  if(d.hideScore===true&&d.status!=='over')return summary+'<p class="uiSessionHiddenScore">النتيجة مخفية · تظهر عند نهاية المباراة</p>';
  let body='<p class="uiSessionScorePending">'+(d.status==='lobby'?'تبدأ النتيجة عند اللعب':'النتيجة غير متاحة الآن')+'</p>';
  const sane=x=>Number.isFinite(x)&&x>=0?Math.trunc(x):0;
  if(d.status==='playing'&&score&&Array.isArray(score.players)){
   if(score.mode==='team'&&Array.isArray(score.teams)&&score.teams.length===2){
    body='<div class="uiSessionScoreGrid">'+score.teams.map((t,i)=>'<span class="uiSessionScoreItem"><span>الفريق '+number(Number.isInteger(t.index)?t.index+1:i+1)+'</span><bdi>'+number(sane(t.points))+'</bdi></span>').join('')+'</div>';
   }else if(score.mode==='solo'&&score.players.length){
    body='<div class="uiSessionScoreGrid">'+score.players.slice(0,6).map(p=>'<span class="uiSessionScoreItem"><span>'+esc(String(p.name||'لاعب'))+'</span><bdi>'+number(sane(p.points))+'</bdi></span>').join('')+'</div>';
   }
  }
  return summary+'<section class="uiSessionCurrentScore" aria-label="النتيجة الحالية بالنقاط"><span class="uiSessionScoreLabel">النتيجة الحالية</span>'+body+'</section>';
 }
 const originalSpacing=applyHandSpacing;
 function applySpacing(el,n){
  if(el!==hand||!friendlyPlay()){
   if(el===hand){el.classList.remove('uiFlexibleHand');el.style.removeProperty('--ui-hand-width');el.style.removeProperty('--ui-hand-height');el.style.removeProperty('--ui-hand-overlap');delete el.dataset.handCards;}
   return originalSpacing(el,n);
  }
  n=Math.max(0,Math.trunc(Number(n)||0));
  const w=Math.max(54,72-Math.max(0,n-8)*2.25),avail=Math.max(1,(el.clientWidth||root.clientWidth||innerWidth)-16);
  const step=n>1?Math.min(w+12,(avail-w)/(n-1)):w;
  el.classList.add('uiFlexibleHand');el.dataset.handCards=String(n);
  el.style.setProperty('--ui-hand-width',w+'px');el.style.setProperty('--ui-hand-height',(w*101/72)+'px');el.style.setProperty('--ui-hand-overlap',((step-w)/2)+'px');
 }
 applyHandSpacing=applySpacing;
 const lobbyFour=renderLobby;renderLobby=function(){const result=lobbyFour.apply(this,arguments);renderLobbySetting();return result;};
 const lobbySix=renderLobbySix;renderLobbySix=function(){const result=lobbySix.apply(this,arguments);renderLobbySetting();return result;};
 const render=renderOnl;renderOnl=function(){
  const result=render.apply(this,arguments);
  if(friendlyPlay()){
   const mode=document.getElementById('uiOnlineMode'),n=count(ONL.view.handCards);
   if(mode){const label=ONL.view.mode==='team'?(ONL.view.seats?.length===6?'3 ضد 3':'2 ضد 2'):'فردي';mode.textContent=label+' · '+number(n)+' ورقة';mode.title='التوزيع: '+number(n)+' لكل لاعب، والموزّع '+number(n+1);}
  }else if(!ONL.active||ONL.status!=='playing'){hand.classList.remove('uiFlexibleHand');}
  renderLobbySetting();return result;
 };
 let lastWidth=0,queued=false;
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{
  if(hand.clientWidth===lastWidth||queued)return;lastWidth=hand.clientWidth;queued=true;
  requestAnimationFrame(()=>{queued=false;if(friendlyPlay()&&!CardDrag.started)applySpacing(hand,hand.querySelectorAll(':scope > .card').length);});
 }).observe(hand);
 return {renderLobbySetting,sessionDetails,applySpacing};
})();
