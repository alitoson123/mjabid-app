/* V411: a read-only final-action presentation. ONL and the server result stay authoritative. */
'use strict';
window.MajabeedFinale=(()=>{
  const SPEED={lastCardMs:3000,collectMs:650,maxEventAgeMs:8000};
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  let current=null,serial=0;
  const seen=new Set();
  const localDone=new WeakSet(),localPending=new Map();
  const account=()=>typeof FB==='undefined'?'':FB.user?.uid||'';
  const state=()=>typeof ONL==='undefined'?null:ONL;
  const identity=s=>s?[s.room,s.generation,s.you,typeof FB==='undefined'?'':FB.user?.uid||''].join('|'):'';
  const root=()=>document.getElementById('onl');
  const visible=()=>!document.hidden&&!!root()&&!root().classList.contains('hidden');
  function cleanup(){
    if(current)clearTimeout(current.timer);
    current=null;serial++;
    const el=root();if(el)delete el.dataset.finale;
    document.getElementById('uiFinaleNotice')?.remove();
  }
  function presentation(){
    const s=state();
    if(!current)return null;
    if(!s?.active||identity(s)!==current.identity||s.status!=='over'||!visible()){cleanup();return null;}
    // Identity/name escaping and private cards come from this viewer's normal state only.
    const v=current.view,official=s.view;
    if(official){for(const k of ['names','avatars','uids','viewerStatus','me'])v[k]=clone(official[k]);}
    return current;
  }
  function render(){if(typeof renderOnl==='function')renderOnl();}
  function finish(){const valid=presentation();cleanup();if(valid)render();}
  function label(event,stage){
    const name=event.beforeView.names?.[event.actor]||'لاعب';
    if(stage==='last-card')return event.kind==='bid'?'خطفة ختامية · '+name:'الورقة الأخيرة · '+name;
    if(!event.settle)return 'اكتملت الجولة · تجهيز النتيجة';
    const holder=event.beforeView.names?.[event.settle?.holder]||name;
    return event.sweptField?.length?'جُمعت الأكلة وورق الميدان عند '+holder:'جُمعت الأكلة عند '+holder;
  }
  function paint(){
    const p=presentation(),el=root();if(!p||!el)return;
    el.dataset.finale=p.stage;
    let note=document.getElementById('uiFinaleNotice');
    if(!note){note=document.createElement('div');note.id='uiFinaleNotice';note.setAttribute('role','status');note.setAttribute('aria-live','polite');el.appendChild(note);}
    note.textContent=label(p.event,p.stage);
    // Timers and action handlers continue to use ONL.status='over'; only presentation is prolonged.
    document.querySelectorAll('#onl .ava').forEach(avatar=>{if(typeof setAvaRing==='function')setAvaRing(avatar,null);});
    document.getElementById('oOver')?.classList.add('hidden');
  }
  function collectionView(event,official){
    const view=clone(official);
    view.phase='finale';view.canBid=false;view.waqf=null;
    if(event.settle){
      const cards=new Map([...(event.settle.cards||[]),...(event.sweptField||[])].map(c=>[String(c.id),clone(c)]));
      view.lastSettle={...clone(event.settle),cards:[...cards.values()],finalPresentation:true};
    }
    return view;
  }
  function collect(){
    const p=presentation();if(!p)return;
    if(!p.event.settle){finish();return;}
    p.stage='collect';p.view=collectionView(p.event,state().view);
    render();paint();p.timer=setTimeout(finish,SPEED.collectMs);
  }
  function validEvent(event,msg){
    const seats=event?.beforeView?.seats;
    const card=c=>!!c&&typeof c==='object'&&(typeof c.id==='string'||typeof c.id==='number')&&Number.isFinite(c.rank)&&typeof c.suit==='string';
    const cards=value=>Array.isArray(value)&&value.every(card);
    const settle=value=>!!value&&typeof value==='object'&&Number.isFinite(value.seq)&&seats.includes(value.holder)&&cards(value.cards);
    if(event?.version!==1||typeof event.id!=='string'||!event.id||!Number.isFinite(event.at)||
      !Array.isArray(seats)||![4,6].includes(seats.length)||new Set(seats).size!==seats.length||!seats.includes(event.actor)||
      !msg.view||JSON.stringify(seats)!==JSON.stringify(msg.view.seats)||
      !['bid','throw','settle','pass'].includes(event.kind)||
      !event.beforeView.handCounts||!event.beforeView.piles||!cards(event.fieldBeforeCleanup)||!cards(event.sweptField)||
      event.card!=null&&!card(event.card)||event.settle!=null&&!settle(event.settle)||
      event.beforeView.lastSettle!=null&&!settle(event.beforeView.lastSettle))return false;
    if(event.kind==='bid')return card(event.card)&&settle(event.settle)&&!!event.waqfFinal&&
      seats.includes(event.waqfFinal.holder)&&cards(event.waqfFinal.contested);
    if(event.kind==='throw')return card(event.card)&&!event.settle;
    return !event.card&&(event.kind==='pass'||settle(event.settle));
  }
  function receiveState(msg){
    if(msg?.type!=='state')return;
    const s=state(),event=msg.finalAction,key=identity(s)+'|'+(event?.id||'');
    if(current&&(!s?.active||s.stateReady===false||s.status!=='over'||identity(s)!==current.identity||!visible()))cleanup();
    if(current&&msg.status==='over'&&event?.id===current.event.id&&identity(s)===current.identity)return;
    if(current)cleanup();
    if(msg.status!=='over'||!event||seen.has(key))return;
    seen.add(key);if(seen.size>80)seen.delete(seen.values().next().value);
    // First snapshot after reconnect, stale finals, and background arrivals go straight to the result.
    const age=(msg.now||msg.view?.now||0)-event.at;
    if(!s?.active||s.status!=='playing'||s.stateReady===false||!s.view||!visible()||
      !Number.isFinite(age)||age< -1000||age>SPEED.maxEventAgeMs||!validEvent(event,msg))return;
    const before=clone(event.beforeView);
    // A viewer's remaining hand is never derived from public metadata.
    before.myHand=clone(msg.view.myHand||[]);before.me=msg.view.me;
    before.canBid=false;before.turnDeadline=0;
    if(event.card&&before.handCounts?.[event.actor]>0)before.handCounts[event.actor]--;
    before.field=clone(event.fieldBeforeCleanup||before.field||[]);
    if(event.kind==='bid'&&event.waqfFinal){before.phase='waqf';before.waqf=clone(event.waqfFinal);}
    else{before.phase='finale';before.waqf=null;}
    const stage=event.card?'last-card':'collect';
    current={identity:identity(s),event:clone(event),stage,
      view:event.card?before:collectionView(event,msg.view),timer:null,serial:++serial};
    const token=serial;
    current.timer=setTimeout(()=>{if(current?.serial!==token)return;if(event.card)collect();else finish();},event.card?SPEED.lastCardMs:SPEED.collectMs);
  }
  function receive(msg){try{receiveState(msg);}catch(_){cleanup();}}
  function deferLocalEnd(game,complete){
    if(!game||localDone.has(game))return false;
    if(localPending.has(game))return true;
    const job={game,complete,account:account(),busy:game.busy,timer:null};
    localPending.set(game,job);game.busy=true;
    if(typeof stopTurnTimer==='function')stopTurnTimer();
    if(typeof window.render==='function')window.render();
    const delay=Date.now()-(game._lastThrowAt||0)<500?SPEED.lastCardMs:SPEED.collectMs;
    job.timer=setTimeout(()=>finishLocal(job),delay);
    game.timers?.push(job.timer);return true;
  }
  function clearLocalTimer(job){
    clearTimeout(job.timer);
    const index=job.game.timers?.indexOf(job.timer)??-1;
    if(index>=0)job.game.timers.splice(index,1);
    job.timer=null;
  }
  function cancelLocal(job){
    clearLocalTimer(job);localPending.delete(job.game);
    if(job.game.phase!=='end')job.game.busy=job.busy;
  }
  function finishLocal(job){
    if(localPending.get(job.game)!==job)return;
    const el=document.getElementById('game');
    if(typeof G==='undefined'||G!==job.game||job.account!==account()||job.game.phase==='end'||!el||el.classList.contains('hidden')){cancelLocal(job);return;}
    if(document.hidden){clearLocalTimer(job);return;}
    cancelLocal(job);localDone.add(job.game);job.complete();
  }
  function pauseLocal(){for(const job of localPending.values())clearLocalTimer(job);}
  function resumeLocal(){for(const job of [...localPending.values()])finishLocal(job);}
  function cancel(){cleanup();for(const job of [...localPending.values()])cancelLocal(job);}
  // Do not replay a completed animation after backgrounding, navigation, or transport reconnect.
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cleanup();pauseLocal();}else{resumeLocal();if(state()?.active&&state().status==='over'&&visible())render();}});
  window.addEventListener('pagehide',()=>{cleanup();pauseLocal();});
  window.addEventListener('pageshow',resumeLocal);
  for(const name of ['oDisconnectTransport','leaveOnline','goHome'])if(typeof window[name]==='function'){
    const original=window[name];window[name]=function(){cancel();return original.apply(this,arguments);};
  }
  // Render pipeline hook: finale. Draw the final-card overlay after motion preparation.
  if(typeof window.renderOnl==='function')window.MajabeedRenderPipeline.registerOnline('finale',30,next=>function(){
    const result=next.apply(this,arguments);
    paint();
    return result;
  });
  return {receive,presentation,paint,cancel,deferLocalEnd,speed:SPEED};
})();
