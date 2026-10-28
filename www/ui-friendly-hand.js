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
 settings.innerHTML='<div class="uiHandSettingRow"><label for="uiFriendlyHandSelect">عدد الأوراق لكل لاعب</label><select id="uiFriendlyHandSelect" aria-describedby="uiFriendlyHandHelp">'+Array.from({length:9},(_,i)=>'<option value="'+(i+7)+'">'+number(i+7)+'</option>').join('')+'</select></div><p id="uiFriendlyHandHelp"></p>';
 document.getElementById('lobbyPublic').before(settings);
 const select=settings.querySelector('select'),help=settings.querySelector('p');
 select.onchange=()=>{
  const value=Number(select.value);
  if(!editable()||!valid(value)){renderLobbySetting();return;}
  oSend({type:'config',handCards:value});
 };
 function renderLobbySetting(){
  const show=friendlyLobby();settings.hidden=!show;
  if(!show)return;
  const n=count(ONL.lobby?.handCards);select.value=String(n);select.disabled=!editable();
  help.textContent='الموزّع '+number(n+1)+' ورقة. تتجدد اليد إلى '+number(n+1)+' في دورك ما دامت الرزمة متاحة.';
  settings.dataset.handCards=String(n);
 }
 function sessionDetails(d){
  const n=count(d.handCards),score=d.currentScore;
  let body='<p class="uiSessionScorePending">'+(d.status==='lobby'?'تبدأ النتيجة عند اللعب':'النتيجة غير متاحة الآن')+'</p>';
  const sane=x=>Number.isFinite(x)&&x>=0?Math.trunc(x):0;
  if(d.status==='playing'&&score&&Array.isArray(score.players)){
   if(score.mode==='team'&&Array.isArray(score.teams)&&score.teams.length===2){
    body='<div class="uiSessionScoreGrid">'+score.teams.map((t,i)=>'<span class="uiSessionScoreItem"><span>الفريق '+number(Number.isInteger(t.index)?t.index+1:i+1)+'</span><bdi>'+number(sane(t.points))+'</bdi></span>').join('')+'</div>';
   }else if(score.mode==='solo'&&score.players.length){
    body='<div class="uiSessionScoreGrid">'+score.players.slice(0,6).map(p=>'<span class="uiSessionScoreItem"><span>'+esc(String(p.name||'لاعب'))+'</span><bdi>'+number(sane(p.points))+'</bdi></span>').join('')+'</div>';
   }
  }
  return '<div class="uiSessionHandInfo"><span>لكل لاعب <bdi>'+number(n)+'</bdi> ورقة</span><small>الموزّع <bdi>'+number(n+1)+'</bdi></small></div><section class="uiSessionCurrentScore" aria-label="النتيجة الحالية بالنقاط"><span class="uiSessionScoreLabel">النتيجة الحالية</span>'+body+'</section>';
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
