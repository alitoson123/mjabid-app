/* v329 — presentation only. No game state writes, actions, network or server timers. */
'use strict';
window.UICardFlow=(()=>{
  const contexts=new Map(), reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const number=n=>Number.isFinite(n)?n:0;
  const key=c=>String(c.id);
  const copy=c=>c?{id:c.id,rank:c.rank,suit:c.suit,by:c.by}:null;
  const list=cards=>(cards||[]).map(copy);
  const visible=el=>!!(el&&el.isConnected&&!el.closest('.hidden')&&el.getClientRects().length);
  let layer=null;

  function rect(el){
    if(!visible(el))return null;
    const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return null;
    let angle=0;
    try{const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);angle=Math.atan2(m.b,m.a)*180/Math.PI;}catch(_){}
    const rad=angle*Math.PI/180,w=el.offsetWidth||r.width,h=el.offsetHeight||r.height;
    const scale=r.width/(Math.abs(Math.cos(rad))*w+Math.abs(Math.sin(rad))*h||1);
    return {x:r.left+r.width/2,y:r.top+r.height/2,w:w*scale,h:h*scale,angle};
  }
  function at(el,w=44,h=62){const r=rect(el);return r?{x:r.x,y:r.y,w,h,angle:0}:null;}
  function nodes(selector){const out=new Map();document.querySelectorAll(selector).forEach(el=>{const r=rect(el);if(r)out.set(el.dataset.id,{...r,el});});return out;}
  function context(id){if(!contexts.has(id))contexts.set(id,{id,previous:null,geometry:null,capture:null,flights:new Map(),frame:0});return contexts.get(id);}
  function clear(ctx){for(const flight of [...ctx.flights.values()])flight.stop();ctx.previous=null;ctx.geometry=null;ctx.capture=null;ctx.frame=0;}
  function online(){
    if(typeof ONL==='undefined'||!ONL.active||ONL.status!=='playing'||!ONL.view)return null;
    const v=ONL.view, seats=v.seats||[];if(seats.length!==4)return null;
    const bottom=seats.includes(ONL.you)?ONL.you:seats[0], index=seats.indexOf(bottom);
    return {id:'online',identity:ONL.room+'|'+ONL.you+'|'+bottom,root:'onl',bottom,
      seats:[0,1,2,3].map(k=>seats[(index+k)%4]),field:list(v.field),hand:list(v.myHand),
      piles:Object.fromEntries(seats.map(pid=>[pid,{count:v.piles[pid]?.count||0,top:copy(v.piles[pid]?.top)}])),
      handCounts:{...v.handCounts},waqf:v.waqf?{cards:list(v.waqf.contested),holder:v.waqf.holder,from:[...(v.waqf.fromPids||[])],grabs:v.waqf.grabs||0}:null,
      settle:v.lastSettle?{seq:v.lastSettle.seq,holder:v.lastSettle.holder,cards:list(v.lastSettle.cards),from:[...(v.lastSettle.fromPids||[])]}:null,lastEater:v.lastEater};
  }
  function local(){
    if(typeof G==='undefined'||!G.players||(!visible(document.getElementById('game'))&&!visible(document.getElementById('waqf'))))return null;
    const w=G.waqf;
    return {id:'local',identity:G,root:'game',bottom:0,seats:[0,1,2,3],field:list(G.field),hand:list(G.players[0].hand),
      piles:Object.fromEntries(G.players.map(p=>[p.i,{count:p.pile.length,top:copy(p.pile[p.pile.length-1])}])),
      handCounts:Object.fromEntries(G.players.map(p=>[p.i,p.hand.length])),
      waqf:w?{cards:list(w.contested),holder:w.holder,from:[],grabs:0}:null,settle:null,lastEater:G.lastEater};
  }
  function geometry(model,fallback){
    const on=model.id==='online', g={field:nodes(on?'#oField > .card[data-id]':'#field > .card[data-id]'),
      hand:nodes(on?'#oHand > .card[data-id]':'#hand > .card[data-id]'),stack:nodes(on?'#oWaqfStack > .card[data-id]':'#contested > .card[data-id]'),
      hands:new Map(),piles:new Map(),pileCards:new Map()};
    g.center=at(document.getElementById(on?'oWaqfStack':'contested'),51,72)||at(document.getElementById(on?'oField':'field'),51,72)||fallback?.center;
    g.deck=at(document.getElementById(on?'oDeckStack':'deckStack'))||fallback?.deck;
    model.seats.forEach((pid,k)=>{
      const seat=document.getElementById(on?['oIdent','oSeatR','oSeat','oSeatL'][k]:['meIdent','seatR','seatT','seatL'][k]);
      const pile=k===0?document.getElementById(on?'oMyPile':'myPile'):seat?.querySelector('.pileBox');
      const top=pile?.querySelector('.card[data-id]'), pr=rect(top)||at(pile)||fallback?.piles.get(pid);
      if(pr)g.piles.set(pid,{...pr,el:top||null});
      if(top&&pr)g.pileCards.set(top.dataset.id,{...pr,el:top,pid});
      // Opponent cards start at their visible fan, not at an invented offset near the field.
      const fan=seat?.querySelector('.oppHandFan'), avatar=seat?.querySelector('.ava');
      const hr=at(fan)||at(avatar)||at(seat)||fallback?.hands.get(pid);
      if(hr)g.hands.set(pid,{...hr,angle:k===1?12:k===3?-12:0});
    });
    return g;
  }
  function layerFor(){
    if(!layer||!layer.isConnected){layer=document.createElement('div');layer.className='uiCardFlightLayer';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);}
    return layer;
  }
  function transform(p,w,h){return `translate3d(${number(p.x-w/2)}px,${number(p.y-h/2)}px,0) rotate(${number(p.angle)}deg) scale(${number(p.w/w)||1},${number(p.h/h)||1})`;}
  function source(ctx,id,fallback){
    const active=ctx.flights.get(String(id));if(!active)return fallback;
    const current=rect(active.el)||fallback;active.stop();return current;
  }
  function fly(ctx,card,from,to,options={}){
    if(!from||!to||reduced.matches||document.hidden||typeof Element.prototype.animate!=='function')return;
    from=source(ctx,key(card),from);
    const target=options.target||null, distance=Math.hypot(to.x-from.x,to.y-from.y);
    if(distance<2&&Math.abs(to.w-from.w)<2)return;
    const el=cardEl(card,'sm');el.classList.add('uiCardFlight');el.removeAttribute('data-id');el.removeAttribute('data-rank');el.removeAttribute('aria-label');el.setAttribute('aria-hidden','true');
    el.dataset.motionKind=options.kind||'play';el.dataset.motionPlayer=String(options.pid??'');
    const w=to.w||44,h=to.h||62;el.style.width=w+'px';el.style.height=h+'px';
    el.style.zIndex=String(options.order||1);layerFor().appendChild(el);
    const duration=options.duration||Math.round(Math.min(470,Math.max(330,280+distance*.3))), delay=options.delay||0;
    const mid={x:from.x+(to.x-from.x)*.62,y:from.y+(to.y-from.y)*.62-Math.min(20,distance*.06),w:from.w+(w-from.w)*.62,h:from.h+(h-from.h)*.62,angle:from.angle+(to.angle-from.angle)*.62};
    let stopped=false,animation=null,timeout=null;
    const flight={el,card,to,target,area:options.area,options,stop(){
      if(stopped)return;stopped=true;clearTimeout(timeout);animation?.cancel();flight.target?.classList.remove('uiCardFlightTarget');el.remove();
      if(ctx.flights.get(key(card))===flight)ctx.flights.delete(key(card));
    }};
    ctx.flights.set(key(card),flight);target?.classList.add('uiCardFlightTarget');
    try{
      const frames=options.via?
        [{transform:transform(from,w,h),opacity:1},{transform:transform(options.via,w,h),opacity:1,offset:.46},{transform:transform(to,w,h),opacity:options.merge?0:1}]:
        [{transform:transform(from,w,h),opacity:1},{transform:transform(mid,w,h),opacity:1,offset:.62},{transform:transform(to,w,h),opacity:options.merge?0:1}];
      animation=el.animate(frames,
        {duration,delay,easing:'cubic-bezier(.22,.6,.3,1)',fill:'both'});
      animation.onfinish=flight.stop;animation.oncancel=flight.stop;
      timeout=setTimeout(flight.stop,duration+delay+160);
    }catch(_){flight.stop();}
  }
  function origin(model,geo,c,actor,played){
    const id=key(c);
    // The server marks captured cards with the current holder. Original locations come from the previous DOM.
    if(geo.hand.has(id))return geo.hand.get(id);
    if(geo.field.has(id))return geo.field.get(id);
    if(geo.stack.has(id))return geo.stack.get(id);
    if(geo.pileCards.has(id))return geo.pileCards.get(id);
    if(model.captureSources?.has(id))return model.captureSources.get(id);
    if(!played){
      const victims=model.waqf?.from||model.settle?.from||[];
      const pid=victims.find(p=>model.previous?.piles[p]?.top?.rank===c.rank)||victims[0];
      if(pid!==undefined&&geo.piles.has(pid))return geo.piles.get(pid);
    }
    return geo.hands.get(actor)||geo.center;
  }
  function capturedSources(before,model,geo,cards){
    const sources=new Map();
    for(const pid of before.seats){
      const old=before.piles[pid],count=(old?.count||0)-(model.piles[pid]?.count||0),anchor=geo.piles.get(pid);
      if(count<=0||!old?.top||!anchor)continue;
      // Each captured run ends with its previously visible top card. Counts distinguish multiple victims.
      const end=cards.findIndex(c=>key(c)===key(old.top));
      if(end<0)continue;
      for(let i=Math.max(0,end-count+1);i<=end;i++)sources.set(key(cards[i]),anchor);
    }
    return sources;
  }
  function rebind(ctx,geo){
    for(const f of [...ctx.flights.values()]){
      const target=f.area==='field'?geo.field.get(key(f.card)):f.area==='stack'?geo.stack.get(key(f.card)):f.area==='pile'?geo.piles.get(f.options.pid):null;
      if(!target?.el)continue;
      f.target?.classList.remove('uiCardFlightTarget');f.target=target.el;target.el.classList.add('uiCardFlightTarget');
      if(Math.hypot(target.x-f.to.x,target.y-f.to.y)>3){const from=rect(f.el);f.stop();fly(ctx,f.card,from,target,{...f.options,target:target.el,delay:0,duration:230});}
    }
  }
  function present(ctx,before,geo,model,now){
    if(!before||before.identity!==model.identity){for(const f of [...ctx.flights.values()])f.stop();ctx.capture=null;return;}
    const previousFields=new Set(before.field.map(key)), currentFields=new Set(model.field.map(key));
    const previousStack=new Set((before.waqf?.cards||[]).map(key));
    let settlement=model.id==='online'&&model.settle&&(model.settle.seq!==(before.settle?.seq||0))?model.settle:null;
    if(model.id==='local'&&before.waqf&&!model.waqf&&model.piles[model.lastEater]?.count>before.piles[model.lastEater]?.count)settlement={cards:before.waqf.cards,holder:model.lastEater};
    const capturePending=!model.waqf&&!settlement&&(before.field.some(c=>!currentFields.has(key(c)))||model.seats.some(p=>model.piles[p]?.count<before.piles[p]?.count));
    if(capturePending)ctx.capture={model:before,geo};
    const captureGeo=ctx.capture?.geo||geo;
    model.previous=before;
    model.captureSources=capturedSources(ctx.capture?.model||before,model,captureGeo,model.waqf?.cards||settlement?.cards||[]);
    if(settlement){
      const dest=now.piles.get(settlement.holder);
      const top=model.piles[settlement.holder]?.top;
      const cards=settlement.cards.slice(-6);
      if(top&&!cards.some(c=>key(c)===key(top)))cards.unshift(top);
      const finalPlayed=settlement.cards[settlement.cards.length-1];
      const atomicBid=before.waqf&&finalPlayed&&!geo.stack.has(key(finalPlayed));
      cards.forEach((c,i)=>{
        const wasContested=before.waqf?.cards.some(old=>key(old)===key(c));
        const start=geo.stack.get(key(c))||(wasContested?geo.center:origin({...model,settle:settlement},captureGeo,c,c.by??settlement.holder,i===cards.length-1));
        const lands=top&&key(c)===key(top);
        const via=atomicBid&&key(c)===key(finalPlayed)?geo.center:null;
        fly(ctx,c,start,dest,{kind:'collect',pid:settlement.holder,area:lands?'pile':null,target:lands?dest?.el:null,delay:via?0:(atomicBid?210:0)+i*12,order:i+1,merge:!lands,...(via?{via,duration:640}:{})});
      });
      if(model.id==='online'&&!document.hidden)GameSoundManager.playCardArrive();
      ctx.capture=null;
    }
    if(model.waqf){
      const cards=model.waqf.cards, fresh=cards.filter(c=>!previousStack.has(key(c)));
      // Limit simultaneous visual copies while keeping every played card and every captured source represented.
      const chosen=fresh.length<=12?fresh:[...fresh.filter(c=>captureGeo.field.has(key(c))||captureGeo.pileCards.has(key(c))).slice(0,7),...fresh.slice(-5)];
      const unique=new Map(chosen.map(c=>[key(c),c]));let order=0;
      for(const c of unique.values()){
        const last=key(c)===key(cards[cards.length-1]), pid=last?model.waqf.holder:c.by??model.waqf.holder;
        const to=now.stack.get(key(c))||now.center;
        const start=origin(model,captureGeo,c,pid,last);
        fly(ctx,c,start,to,{kind:last?(before.waqf?'bid':'play'):'capture',pid,area:'stack',target:now.stack.get(key(c))?.el,delay:last?0:Math.min(order*12,60),order:++order,merge:!now.stack.has(key(c))});
      }
      ctx.capture=null;
    }
    for(const c of model.field){
      const dest=now.field.get(key(c));if(!dest)continue;
      if(!previousFields.has(key(c))&&!settlement){
        const start=c.by===undefined?geo.deck:geo.hand.get(key(c))||geo.hands.get(c.by);
        fly(ctx,c,start,dest,{kind:'play',pid:c.by,area:'field',target:dest.el,order:20});
      }else if(previousFields.has(key(c))&&geo.field.has(key(c))&&!ctx.flights.has(key(c))){
        const start=geo.field.get(key(c));if(Math.hypot(dest.x-start.x,dest.y-start.y)>3)fly(ctx,c,start,dest,{kind:'shift',area:'field',target:dest.el,duration:210});
      }
    }
    rebind(ctx,now);
  }
  function around(id,read,renderFn,self,args){
    const ctx=context(id), model=read();
    if(!model){clear(ctx);return renderFn.apply(self,args);}
    const before=ctx.previous, geo=before?geometry(before,ctx.geometry):null;
    if(geo&&before?.waqf&&geo.stack.size===0&&ctx.geometry?.stack.size)geo.stack=ctx.geometry.stack;
    let result;
    try{result=renderFn.apply(self,args);}catch(e){clear(ctx);throw e;}
    const current=read();if(!current){clear(ctx);return result;}
    const now=geometry(current,geo);
    if(reduced.matches||document.hidden){for(const f of [...ctx.flights.values()])f.stop();ctx.capture=null;}
    else present(ctx,before,geo,current,now);
    delete current.previous;delete current.captureSources;ctx.previous=current;ctx.geometry=now;ctx.frame=Date.now();
    return result;
  }
  const originalOnline=renderOnl, originalLocal=render, originalWaqf=renderWaqf;
  renderOnl=function(){return around('online',online,originalOnline,this,arguments);};
  render=function(){return around('local',local,originalLocal,this,arguments);};
  renderWaqf=function(){return around('local',local,originalWaqf,this,arguments);};
  const reset=()=>{for(const ctx of contexts.values())clear(ctx);};
  document.addEventListener('visibilitychange',reset);
  window.addEventListener('pagehide',reset);
  window.addEventListener('resize',reset);
  reduced.addEventListener?.('change',reset);
  if(typeof MutationObserver==='function'){
    const observer=new MutationObserver(()=>{
      if(!visible(document.getElementById('onl')))clear(context('online'));
      if(!visible(document.getElementById('game'))&&!visible(document.getElementById('waqf')))clear(context('local'));
    });
    for(const id of ['onl','game','waqf']){const el=document.getElementById(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class']});}
  }
  return {reset};
})();
