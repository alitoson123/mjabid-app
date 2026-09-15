/* v329 — presentation only. No game state writes, actions, network or server timers. */
'use strict';
window.UICardFlow=(()=>{
  const contexts=new Map(), masks=new WeakMap(), reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const number=n=>Number.isFinite(n)?n:0;
  const key=c=>String(c.id);
  const copy=c=>c?{id:c.id,rank:c.rank,suit:c.suit,by:c.by}:null;
  const list=cards=>(cards||[]).map(copy);
  const claims=w=>(Array.isArray(w?.capturePiles)?w.capturePiles:[]).filter(p=>p?.pid!=null&&Array.isArray(p.ids)).map(p=>({pid:p.pid,ids:p.ids.map(String)}));
  const heldBy=w=>new Map(claims(w).flatMap(p=>p.ids.map(id=>[id,p])));
  const tableCards=w=>{const held=heldBy(w);return (w?.cards||[]).filter(c=>!held.has(key(c)));};
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
  function context(id){if(!contexts.has(id))contexts.set(id,{id,previous:null,geometry:null,capture:null,flights:new Map(),frame:0,paint:0});return contexts.get(id);}
  function clear(ctx){for(const flight of [...ctx.flights.values()])flight.stop();ctx.previous=null;ctx.geometry=null;ctx.capture=null;ctx.frame=0;ctx.paint=0;}
  function online(){
    if(typeof ONL==='undefined'||!ONL.active||ONL.status!=='playing'||!ONL.view)return null;
    const v=ONL.view, seats=v.seats||[];if(seats.length!==4)return null;
    const bottom=seats.includes(ONL.you)?ONL.you:seats[0], index=seats.indexOf(bottom);
    return {id:'online',identity:ONL.room+'|'+ONL.you+'|'+bottom,root:'onl',bottom,
      seats:[0,1,2,3].map(k=>seats[(index+k)%4]),field:list(v.field),hand:list(v.myHand),
      piles:Object.fromEntries(seats.map(pid=>[pid,{count:v.piles[pid]?.count||0,top:copy(v.piles[pid]?.top)}])),
      handCounts:{...v.handCounts},waqf:v.waqf?{cards:list(v.waqf.contested),holder:v.waqf.holder,from:[...(v.waqf.fromPids||[])],grabs:v.waqf.grabs||0,capturePiles:claims(v.waqf)}:null,
      settle:v.lastSettle?{seq:v.lastSettle.seq,holder:v.lastSettle.holder,cards:list(v.lastSettle.cards),from:[...(v.lastSettle.fromPids||[])],capturePiles:claims(v.lastSettle)}:null,lastEater:v.lastEater};
  }
  function local(){
    if(typeof G==='undefined'||!G.players||(!visible(document.getElementById('game'))&&!visible(document.getElementById('waqf'))))return null;
    const w=G.waqf;
    return {id:'local',identity:G,root:'game',bottom:0,seats:[0,1,2,3],field:list(G.field),hand:list(G.players[0].hand),
      piles:Object.fromEntries(G.players.map(p=>[p.i,{count:p.pile.length,top:copy(p.pile[p.pile.length-1])}])),
      handCounts:Object.fromEntries(G.players.map(p=>[p.i,p.hand.length])),
      waqf:w?{cards:list(w.contested),holder:w.holder,from:[],grabs:0,capturePiles:claims(w)}:null,settle:null,lastEater:G.lastEater};
  }
  function geometry(model,fallback){
    const on=model.id==='online', g={field:nodes(on?'#oField > .card[data-id]':'#field > .card[data-id]'),
      hand:nodes(on?'#oHand > .card[data-id]':'#hand > .card[data-id]'),stack:nodes(on?'#oWaqfStack > .card[data-id]':'#contested > .card[data-id]'),
      hands:new Map(),piles:new Map(),pileCards:new Map(),directions:new Map()};
    g.center=at(document.getElementById(on?'oWaqfStack':'contested'),54,77)||at(document.getElementById(on?'oField':'field'),54,77)||fallback?.center;
    g.deck=at(document.getElementById(on?'oDeckStack':'deckStack'))||fallback?.deck;
    model.seats.forEach((pid,k)=>{
      g.directions.set(pid,[{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}][k]);
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
  // v360: keep unwrapped turns across redraws; DOMMatrix reports only the principal angle.
  const unwrapAngle=(angle,reference)=>angle+360*Math.round((reference-angle)/360);
  function flightProgress(f){
    const timing=f.animation?.effect?.getComputedTiming?.();
    if(Number.isFinite(timing?.progress))return Math.max(0,Math.min(1,timing.progress));
    const clock=Number.isFinite(f.animation?.currentTime)?f.animation.currentTime:Date.now()-f.startedAt;
    return Math.max(0,Math.min(1,(clock-f.delay)/f.duration));
  }
  function flightPosition(f,fallback){
    const p=rect(f.el)||fallback;if(!p)return p;
    const progress=flightProgress(f),angles=f.angles||[];
    let angle=angles[0]?.angle??p.angle;
    for(let i=1;i<angles.length;i++){
      const a=angles[i-1],b=angles[i],part=Math.max(0,Math.min(1,(progress-a.offset)/(b.offset-a.offset||1)));
      angle=a.angle+(b.angle-a.angle)*part;if(progress<=b.offset)break;
    }
    return {...p,angle:unwrapAngle(p.angle,angle)};
  }
  function recordAngles(f,frames){
    f.angles=frames.map((frame,i)=>({offset:frame.offset??i/(frames.length-1),
      angle:Number((frame.transform.match(/rotate\(([-+\d.e]+)deg\)/)||[])[1]||0)}));
  }
  function source(ctx,id,fallback){
    const active=ctx.flights.get(String(id));if(!active)return fallback;
    const current=flightPosition(active,fallback);active.stop();return current;
  }
  // v356: mask ownership belongs to one visual flight, never to a seat or game state.
  function unmask(flight){
    const target=flight.target;
    if(target&&masks.get(target)===flight){target.classList.remove('uiCardFlightTarget');masks.delete(target);}
    flight.target=null;
  }
  function mask(flight,target){
    if(flight.target!==target)unmask(flight);
    flight.target=target||null;
    if(target){masks.set(target,flight);target.classList.add('uiCardFlightTarget');}
  }
  // v361: the played card turns in the air and stops at contact; receiving faces absorb the impact.
  function actionFrames(from,to,options,w,h){
    const pose=(a,b,t,raised)=>{
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),scale=(b.w||54)/54;
      const dir=options.throwDir;
      const turn=options.spin?0:dir?(dir.x?-dir.x*18:dir.y<0?-32:8):
        (Math.abs(dx)>1?Math.sign(dx):Math.sign(dy)||1)*Math.min(7,d*.055);
      const lift=raised?Math.min(8*scale,d*.04):0;
      return {x:a.x+dx*t,y:a.y+dy*t-lift,w:(a.w+(b.w-a.w)*t)*(raised?1.025:1),
        h:(a.h+(b.h-a.h)*t)*(raised?1.025:1),angle:a.angle+(b.angle-a.angle)*t+(raised?turn:turn*.12)};
    };
    const frame=(p,offset,opacity=1)=>({transform:transform(p,w,h),opacity,offset});
    if(options.via){
      const via=options.via,at=options.viaAt??.46,left=1-at;
      return [frame(from,0),frame(pose(from,via,.48,true),at*.58),frame(via,at),
        frame(pose(via,to,.48,true),at+left*.44),frame(pose(via,to,.9,false),at+left*.84,options.merge ? .82 : 1),
        frame(to,1,options.merge?0:1)];
    }
    return [frame(from,0),frame(pose(from,to,.44,true),.4),frame(pose(from,to,.9,false),.84,options.merge ? .82 : 1),
      frame(to,1,options.merge?0:1)];
  }
  // v358 — contact happens on the airborne animation's actual finish, not an estimated timer.
  // The final card pose remains the renderer's pose; no cumulative drift or state writes.
  function impactVector(from,to){
    const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy)||1,scale=(to.w||54)/54;
    return {x:dx/d*2.4*scale,y:dy/d*2.4*scale,angle:(Math.abs(dx)>1?Math.sign(dx):Math.sign(dy)||1)*.85};
  }
  function landingContact(to,options){
    const v=options.landingDirection;
    return options.area!=='stack'&&options.land&&!options._landed&&v?
      {...to,x:to.x-v.x*1.75,y:to.y-v.y*1.75,angle:to.angle-(options.spin?options.spinSign*Math.abs(v.angle):v.angle)*1.4}:to;
  }
  function settleFrames(from,to,w,h){
    // Friction slows a single forward glide; the new top never overshoots and springs back.
    return [{transform:transform(from,w,h),opacity:1,offset:0,easing:'cubic-bezier(.16,.65,.3,1)'},
      {transform:transform(to,w,h),opacity:1,offset:1}];
  }
  function impactFrames(from,to,impact,w,h){
    // A small friction-limited rearrangement remains in the renderer's committed pose.
    return [{transform:transform(from,w,h),opacity:1,offset:0,easing:'cubic-bezier(.16,.7,.25,1)'},
      {transform:transform(to,w,h),opacity:1,offset:1}];
  }
  function nudgeReceivers(ctx,flight){
    const cards=tableCards(ctx.previous?.waqf),index=cards.findIndex(c=>key(c)===key(flight.card));
    // A superseded arrival cannot apply a late contact to a newer auction face.
    if(flight.area!=='stack'||index<1||index!==cards.length-1)return;
    const underneath=cards.slice(Math.max(0,index-2),index);
    underneath.forEach((c,i)=>{
      const target=ctx.geometry?.stack.get(key(c)),held=ctx.flights.get(key(c));
      if(!target?.el||!visible(target.el)||held?.options.holdFor!==key(flight.card))return;
      if(!held.options.hold&&!held.options.settling&&!held.options.impact)return;
      const from=flightPosition(held,target);
      fly(ctx,c,from,target,{kind:'impact',area:'stack',target:target.el,duration:160,
        paintOrder:flight.paint-underneath.length+i,impact:true,_landed:true});
    });
  }
  function fly(ctx,card,from,to,options={}){
    if(!from||!to||reduced.matches||document.hidden||typeof Element.prototype.animate!=='function')return;
    from=source(ctx,key(card),from);
    // Only the actual played card turns. Captured table faces and held pile packets keep their plane.
    const dir=options.throwDir,sign=dir?(dir.x?Math.sign(dir.x):dir.y<0?-1:1):1;
    const via=options.via;
    const rotateVia=via?(options.rotateVia??unwrapAngle(via.angle,from.angle+(options.spin?sign*330:0))):undefined;
    const rotateTo=options.rotateTo??unwrapAngle(to.angle,via?rotateVia:from.angle+(options.spin?sign*330:0));
    to={...to,angle:unwrapAngle(to.angle,rotateTo)};
    options={...options,spinSign:options.spinSign??sign,rotateTo:to.angle,...(via?{via:{...via,angle:unwrapAngle(via.angle,rotateVia)},rotateVia}:{})};
    const target=options.target||null, distance=Math.hypot(to.x-from.x,to.y-from.y);
    if(distance<2&&Math.abs(to.w-from.w)<2&&Math.abs(to.angle-from.angle)<2&&!options.impact&&!options.settling&&!options.hold&&!options.holdFor)return;
    const el=cardEl(card,'sm');el.classList.add('uiCardFlight');el.removeAttribute('data-id');el.removeAttribute('data-rank');el.removeAttribute('aria-label');el.setAttribute('aria-hidden','true');
    el.dataset.motionKind=options.kind||'play';el.dataset.motionPlayer=String(options.pid??'');
    const action=options.area==='stack'||options.kind==='collect';
    if(action)el.classList.add('uiCardFlightAction');
    if(options.merge)el.classList.add('uiCardFlightMerged');
    if(options.packetCount>1){
      el.classList.add('uiCardFlightPacket');
      if(typeof uiPileMetrics==='function')el.style.setProperty('--ui-pile-shadow',uiPileMetrics(options.packetCount).shadow);
    }
    const w=to.w||44,h=to.h||62;el.style.width=w+'px';el.style.height=h+'px';
    // Reserve two lower paint slots for receiving faces, keeping them under their new top card.
    const paint=options.paintOrder||(ctx.paint+=4);
    el.style.zIndex=String(paint);layerFor().appendChild(el);
    const duration=options.duration||(action?(options.kind==='collect'?380:options.kind==='capture'?300:400):Math.round(Math.min(470,Math.max(330,280+distance*.3)))), delay=options.delay||0;
    const arrival=landingContact(to,options);
    const mid={x:from.x+(arrival.x-from.x)*.62,y:from.y+(arrival.y-from.y)*.62-Math.min(20,distance*.06),w:from.w+(w-from.w)*.62,h:from.h+(h-from.h)*.62,angle:from.angle+(arrival.angle-from.angle)*.62};
    let stopped=false,animation=null,timeout=null;
    const flight={el,card,to,target:null,area:options.area,options,paint,duration,delay,startedAt:Date.now(),animation:null,
      reserveContact(actor,target,until){
        options={...options,holdFor:actor,receiverTo:target,holdUntil:until};flight.options=options;
        // Extend the existing flight cleanup, without introducing another timer.
        arm(Math.max(160,until-Date.now()+160));
      },stop(){
      if(stopped)return;stopped=true;clearTimeout(timeout);animation?.cancel();unmask(flight);el.remove();
      if(ctx.flights.get(key(card))===flight)ctx.flights.delete(key(card));
    }};
    ctx.flights.set(key(card),flight);mask(flight,target);
    function arm(ms){clearTimeout(timeout);timeout=setTimeout(flight.stop,ms);}
    function waitForContact(){
      if(stopped||!options.holdFor||Date.now()>=(options.holdUntil||0)||reduced.matches||document.hidden)return flight.stop();
      // Preserve an arriving captured field card's entry flight before holding it still.
      const position=flight.to,holdDuration=Math.max(160,(options.holdUntil||Date.now()+160)-Date.now());
      animation.onfinish=null;animation.oncancel=null;animation.cancel();
      options={...options,hold:true,_landed:true};flight.options=options;
      flight.duration=holdDuration;flight.delay=0;flight.startedAt=Date.now();
      const frames=settleFrames(position,position,w,h);recordAngles(flight,frames);
      try{
        animation=el.animate(frames,{duration:holdDuration,easing:'linear',fill:'both'});
        flight.animation=animation;animation.onfinish=()=>options.holdFor?waitForContact():flight.stop();animation.oncancel=flight.stop;arm(holdDuration+160);
      }catch(_){flight.stop();}
    }
    function land(){
      const current=ctx.geometry?.[options.area]?.get(key(card));
      if(stopped||!options.land||options._landed||reduced.matches||document.hidden||!current?.el||!visible(current.el))return flight.stop();
      clearTimeout(timeout);animation.onfinish=null;animation.oncancel=null;animation.cancel();
      const onStack=options.area==='stack';
      // The new top stays stationary above the moving receiving clones; it never glides or bounces.
      const resting=onStack?{...arrival}:{...current,angle:unwrapAngle(current.angle,arrival.angle)};
      const contactDuration=onStack?160:140;
      flight.to=resting;flight.duration=contactDuration;flight.delay=0;flight.startedAt=Date.now();
      options={...options,_landed:true,settling:true,spin:false,via:null,rotateVia:undefined,rotateTo:resting.angle};
      flight.options=options;mask(flight,current.el);
      try{
        const frames=settleFrames(arrival,resting,w,h);recordAngles(flight,frames);
        animation=el.animate(frames,{duration:contactDuration,easing:'linear',fill:'both'});
        flight.animation=animation;animation.onfinish=()=>options.holdFor?waitForContact():flight.stop();animation.oncancel=flight.stop;
        arm(Math.max(300,(options.holdUntil||0)-Date.now()+160));
        if(onStack)nudgeReceivers(ctx,flight);
      }catch(_){flight.stop();}
    }
    try{
      const frames=options.hold?settleFrames(from,from,w,h):options.settling?settleFrames(from,to,w,h):options.impact?impactFrames(from,to,options.impact,w,h):action?actionFrames(from,arrival,options,w,h):options.via?
        [{transform:transform(from,w,h),opacity:1},{transform:transform(options.via,w,h),opacity:1,offset:.46},{transform:transform(to,w,h),opacity:options.merge?0:1}]:
        [{transform:transform(from,w,h),opacity:1},{transform:transform(mid,w,h),opacity:1,offset:.62},{transform:transform(arrival,w,h),opacity:options.merge?0:1}];
      recordAngles(flight,frames);
      animation=el.animate(frames,
        {duration,delay,easing:options.impact||options.settling?'linear':'cubic-bezier(.22,.6,.3,1)',fill:'both'});
      flight.animation=animation;
      animation.onfinish=()=>options.land&&!options._landed?land():options.holdFor?waitForContact():flight.stop();animation.oncancel=flight.stop;
      arm(Math.max(duration+delay,(options.holdUntil||0)-Date.now())+160);
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
  // The bidder's measured hand/fan is the start, including for an atomic final bid.
  function bidOrigin(from,to){return from||to;}
  function bidLanding(c,cards,geo){
    const center=geo.center;if(!center)return null;
    const pose=typeof uiBidCardPose==='function'?uiBidCardPose(c,Math.max(0,cards.findIndex(x=>key(x)===key(c))),geo.directions?.get(c.by),cards,x=>geo.directions?.get(x.by)):{x:0,y:0,angle:0};
    const sample=[...geo.stack.values()].at(-1),scale=(sample?.w||54)/54;
    return {x:center.x+pose.x*scale,y:center.y+pose.y*scale,w:54*scale,h:77*scale,angle:pose.angle};
  }
  function capturedSources(before,model,geo,cards){
    const sources=new Map(),known=claims(model.waqf||model.settle||before.waqf);
    if(known.length){
      for(const p of known){const anchor=geo.piles.get(p.pid);if(anchor)for(const id of p.ids)sources.set(id,anchor);}
      return sources;
    }
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
      // A seat may already own a different top card. An older flight must never hide/reveal that new face.
      if(f.area==='pile'&&(!target?.el||String(target.el.dataset.id)!==key(f.card))){f.stop();continue;}
      if(!target?.el){if(f.target)f.stop();continue;}
      // Rendering the committed overlap must not move a receiver before actual contact.
      if(f.options.holdFor){f.options.receiverTo=target;mask(f,target.el);continue;}
      if(Math.hypot(target.x-f.to.x,target.y-f.to.y)>3){
        const from=flightPosition(f),clock=Number.isFinite(f.animation?.currentTime)?f.animation.currentTime:Date.now()-f.startedAt;
        const elapsed=Math.max(0,Math.min(f.duration,clock-f.delay)),remaining=Math.max(f.options.impact?60:f.options.settling?80:120,f.duration-elapsed);
        // WAAPI progress already includes effect easing; elapsed time alone can replay a passed waypoint.
        const progress=flightProgress(f);
        const viaPoint=f.options.viaAt??.46,via=f.options.via&&progress<viaPoint?f.options.via:null;
        const viaAt=via?Math.max(.05,Math.min(.8,(viaPoint-progress)/(1-progress))):undefined;
        const impactAt=f.options.impact?Math.min(.999,(f.options.impactAt||0)+(1-(f.options.impactAt||0))*progress):undefined;
        f.stop();fly(ctx,f.card,from,target,{...f.options,target:target.el,delay:0,duration:remaining,via,viaAt,impactAt,paintOrder:f.paint});
      }else mask(f,target.el);
    }
  }
  function present(ctx,before,geo,model,now){
    if(!before||before.identity!==model.identity){for(const f of [...ctx.flights.values()])f.stop();ctx.capture=null;return;}
    const previousFields=new Set(before.field.map(key)), currentFields=new Set(model.field.map(key));
    const previousStack=new Set((before.waqf?.cards||[]).map(key));
    let settlement=model.id==='online'&&model.settle&&(model.settle.seq!==(before.settle?.seq||0))?model.settle:null;
    if(model.id==='local'&&before.waqf&&!model.waqf&&model.piles[model.lastEater]?.count>before.piles[model.lastEater]?.count)settlement={cards:before.waqf.cards,holder:model.lastEater,capturePiles:claims(before.waqf)};
    const capturePending=!model.waqf&&!settlement&&(before.field.some(c=>!currentFields.has(key(c)))||model.seats.some(p=>model.piles[p]?.count<before.piles[p]?.count));
    if(capturePending)ctx.capture={model:before,geo};
    const captureGeo=ctx.capture?.geo||geo;
    model.previous=before;
    model.captureSources=capturedSources(ctx.capture?.model||before,model,captureGeo,model.waqf?.cards||settlement?.cards||[]);
    if(settlement){
      const dest=now.piles.get(settlement.holder),top=model.piles[settlement.holder]?.top;
      const held=heldBy(settlement),table=tableCards(settlement),cards=table.slice(-6);
      // One visible packet per targeted pile, plus at most six table faces and the actual final top.
      for(const p of claims(settlement)){
        if(String(p.pid)===String(settlement.holder))continue;
        const face=settlement.cards.find(c=>key(c)===p.ids[0]);if(face)cards.unshift(face);
      }
      if(top&&!cards.some(c=>key(c)===key(top)))cards.push(top);
      const finalPlayed=settlement.cards[settlement.cards.length-1];
      const atomicBid=finalPlayed&&!held.has(key(finalPlayed))&&!geo.stack.has(key(finalPlayed));
      cards.forEach((c,i)=>{
        const owner=held.get(key(c)),lands=top&&key(c)===key(top);
        if(owner&&String(owner.pid)===String(settlement.holder))return;
        const wasContested=before.waqf?.cards.some(old=>key(old)===key(c));
        let start=owner?geo.piles.get(owner.pid)||captureGeo.piles.get(owner.pid):
          geo.stack.get(key(c))||(wasContested?bidLanding(c,table,geo):origin({...model,settle:settlement},captureGeo,c,c.by??settlement.holder,key(c)===key(finalPlayed)));
        const via=atomicBid&&key(c)===key(finalPlayed)?bidLanding(c,table,geo):null;
        if(via)start=bidOrigin(start,via);
        fly(ctx,c,start,dest,{kind:'collect',pid:settlement.holder,area:lands?'pile':null,target:lands?dest?.el:null,
          delay:via?0:(atomicBid?400:0)+i*20,merge:!lands,packetCount:owner&&owner.ids[0]===key(c)?owner.ids.length:0,
          ...(via?{via,viaAt:.60,duration:860,spin:true,throwDir:geo.directions.get(c.by??settlement.holder)}:{})});
      });
      if(model.id==='online'&&!document.hidden)GameSoundManager.playCardArrive();
      ctx.capture=null;
    }
    if(model.waqf){
      const cards=tableCards(model.waqf), fresh=cards.filter(c=>!previousStack.has(key(c)));
      const played=cards.at(-1),newContact=played&&fresh.some(c=>key(c)===key(played));
      const receivers=newContact?cards.slice(Math.max(0,cards.length-3),-1):[];
      const receiverIds=new Set(receivers.map(key)),contactUntil=Date.now()+640;
      const contactPaint=newContact?(ctx.paint+=64):null;
      // Keep the two actual receiving faces at their old positions until the new card arrives.
      // A targeted player pile is excluded by tableCards and remains at its owner's seat.
      for(const c of receivers){
        if(fresh.some(next=>key(next)===key(c)))continue;
        const target=now.stack.get(key(c)),active=ctx.flights.get(key(c));if(!target?.el)continue;
        if(active){active.reserveContact(key(played),target,contactUntil);continue;}
        const old=geo.stack.get(key(c));if(!old)continue;
        fly(ctx,c,old,old,{kind:'impact-hold',area:'stack',target:target.el,hold:true,
          holdFor:key(played),holdUntil:contactUntil,receiverTo:target,duration:640,
          paintOrder:contactPaint-receivers.length+receivers.indexOf(c)});
      }
      // Limit simultaneous visual copies while keeping every played card and every captured source represented.
      const chosen=fresh.length<=12?fresh:[...fresh.filter(c=>captureGeo.field.has(key(c))||captureGeo.pileCards.has(key(c))).slice(0,7),...fresh.slice(-5)];
      const unique=new Map(chosen.map(c=>[key(c),c]));let order=0;
      for(const c of unique.values()){
        const last=key(c)===key(cards[cards.length-1]), pid=last?model.waqf.holder:c.by??model.waqf.holder;
        const receiver=receiverIds.has(key(c)),target=now.stack.get(key(c));
        const to=receiver?bidLanding(c,cards.slice(0,-1),now):(target||now.center);
        const isBid=last&&!!before.waqf;
        const originalStart=origin(model,captureGeo,c,pid,last),start=isBid?bidOrigin(originalStart,to):originalStart;
        fly(ctx,c,start,to,{kind:last?(isBid?'bid':'play'):'capture',pid,area:'stack',target:target?.el,delay:last?0:Math.min(order*20,80),order:++order,merge:!now.stack.has(key(c)),land:last&&now.stack.has(key(c)),landingDirection:start&&to?impactVector(start,to):null,throwDir:last?now.directions.get(pid):null,
          ...(contactPaint?{paintOrder:contactPaint-unique.size+order}:{}),
          ...(receiver?{holdFor:key(played),holdUntil:contactUntil,receiverTo:target,paintOrder:contactPaint-receivers.length+receivers.indexOf(c)}:{}),
          ...(last?{duration:480,spin:true,paintOrder:contactPaint}:{})});
      }
      ctx.capture=null;
    }
    for(const c of model.field){
      const dest=now.field.get(key(c));if(!dest)continue;
      if(!previousFields.has(key(c))&&!settlement){
        const start=c.by===undefined?geo.deck:geo.hand.get(key(c))||geo.hands.get(c.by);
        fly(ctx,c,start,dest,{kind:'play',pid:c.by,area:'field',target:dest.el,order:20,land:c.by!==undefined,landingDirection:start?impactVector(start,dest):null});
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
    window.UITablePresentation?.refresh();
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

/* v344 — field depth, capture caption and seat-anchored speech. DOM only. */
window.UITablePresentation=(()=>{
  const byId=id=>document.getElementById(id);
  const visible=el=>!!(el&&el.isConnected&&!el.closest('.hidden')&&el.getClientRects().length);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const entries=[
    ['chatBubble','meIdent','game','bottom'],
    ['oChatBubble','oIdent','onl','bottom'],
    ['oChatBubbleR','oSeatR','onl','right'],
    ['oChatBubbleT','oSeat','onl','top'],
    ['oChatBubbleL','oSeatL','onl','left']
  ].map(([id,seat,root,side])=>({bubble:byId(id),seat:byId(seat),root:byId(root),side}))
    .filter(e=>e.bubble&&e.seat&&e.root);
  let frame=0;

  function overlap(a,b){
    return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
      Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  }
  function chooseSpeechBox(anchor,size,bounds,obstacles,side){
    const gap=10,w=Math.min(size.w,bounds.w),h=Math.min(size.h,bounds.h);
    const cx=anchor.x+anchor.w/2,cy=anchor.y+anchor.h/2;
    const candidates=[
      {x:cx-w/2,y:anchor.y-h-gap,tail:'bottom'},
      {x:cx-w/2,y:anchor.y+anchor.h+gap,tail:'top'},
      {x:anchor.x-w-gap,y:cy-h/2,tail:'right'},
      {x:anchor.x+anchor.w+gap,y:cy-h/2,tail:'left'}
    ];
    // Extra lanes allow simultaneous messages to separate without covering cards.
    for(const p of candidates.slice(0,2)){
      candidates.push({...p,x:bounds.x},{...p,x:bounds.x+bounds.w-w});
    }
    let best=null,bestCost=Infinity;
    candidates.forEach((p,i)=>{
      const x=Math.max(bounds.x,Math.min(bounds.x+bounds.w-w,p.x));
      const y=Math.max(bounds.y,Math.min(bounds.y+bounds.h-h,p.y));
      const box={x,y,w,h,tail:p.tail};
      const cost=obstacles.reduce((s,o)=>s+overlap(box,o)*(o.weight||1),0)+
        overlap(box,anchor)*12+Math.hypot(x+w/2-cx,y+h/2-cy)*.4+i*.1+
        ((side==='bottom'&&p.tail!=='bottom')?15:0);
      if(cost<bestCost){best=box;bestCost=cost;}
    });
    return best;
  }
  function layout(){
    frame=0;
    const occupied=new Map();
    for(const e of entries){
      if(!visible(e.bubble)||!visible(e.seat)||!visible(e.root))continue;
      const r=e.root.getBoundingClientRect();
      const sx=r.width/e.root.offsetWidth,sy=r.height/e.root.offsetHeight;
      if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<=0||sy<=0)continue;
      const local=el=>{const q=el.getBoundingClientRect();return {x:(q.left-r.left)/sx,y:(q.top-r.top)/sy,w:q.width/sx,h:q.height/sy};};
      const anchor=local(e.seat.querySelector('.ava')||e.seat);
      const online=e.root.id==='onl';
      const hud=e.root.querySelector('#topbar');
      const hand=byId(online?'oHand':'hand');
      const top=visible(hud)?Math.max(8,local(hud).y+local(hud).h+6):8;
      const bottom=visible(hand)?Math.min(e.root.offsetHeight-8,local(hand).y-8):e.root.offsetHeight-8;
      const bounds={x:8,y:top,w:Math.max(1,e.root.offsetWidth-16),h:Math.max(1,bottom-top)};
      e.bubble.style.maxWidth=Math.min(164,Math.max(112,bounds.w*.44))+'px';
      e.bubble.style.maxHeight=Math.min(86,bounds.h)+'px';
      const size={w:e.bubble.offsetWidth,h:e.bubble.offsetHeight};
      const obstacles=[...e.root.querySelectorAll('.seat .ava,.seat .pts,.pileBox,#oIdent .ava,#meIdent .ava,.card[data-id]')]
        .filter(visible).map(el=>({...local(el),weight:el.classList.contains('card')?12:8}));
      const used=occupied.get(e.root)||[];
      const box=chooseSpeechBox(anchor,size,bounds,[...obstacles,...used],e.side);
      e.bubble.style.left=box.x+'px';e.bubble.style.top=box.y+'px';
      e.bubble.dataset.uiTail=box.tail;
      const vertical=box.tail==='top'||box.tail==='bottom';
      const target=vertical?anchor.x+anchor.w/2-box.x:anchor.y+anchor.h/2-box.y;
      e.bubble.style.setProperty('--ui-speech-tail',Math.max(12,Math.min((vertical?box.w:box.h)-12,target))+'px');
      used.push({...box,weight:30});occupied.set(e.root,used);
    }
  }
  function refresh(){
    if(frame||document.hidden||!entries.some(e=>visible(e.bubble)&&visible(e.root)))return;
    frame=requestAnimationFrame(layout);
  }
  for(const e of entries){
    e.bubble.classList.add('uiTableSpeech');
    // Keep every existing ID and element; remove self speech from the hand's flex row.
    e.root.appendChild(e.bubble);
  }
  if(entries.length&&typeof MutationObserver==='function'){
    const observer=new MutationObserver(refresh);
    for(const e of entries)observer.observe(e.bubble,{attributes:true,attributeFilter:['class'],childList:true,characterData:true,subtree:true});
    for(const root of new Set(entries.map(e=>e.root)))observer.observe(root,{attributes:true,attributeFilter:['class']});
  }
  if(entries.length&&typeof ResizeObserver==='function'){
    const observer=new ResizeObserver(refresh);
    for(const el of new Set(entries.flatMap(e=>[e.root,e.seat])))observer.observe(el);
  }
  window.addEventListener('resize',refresh);
  const clearCaptions=()=>{
    if(frame){cancelAnimationFrame(frame);frame=0;}
    for(const id of ['field','oField']){
      const layer=byId(id)?.parentElement?.querySelector(':scope > .uiEatLayer');
      if(layer){clearTimeout(layer._uiEatTimer);layer.replaceChildren();}
    }
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearCaptions();else refresh();});
  window.addEventListener('pagehide',clearCaptions);
  if(typeof showEatFx==='function')showEatFx=function(fieldSelId,points){
    const field=document.querySelector(fieldSelId),value=Number(points);
    if(!visible(field)||document.hidden||!Number.isFinite(value)||value<=0)return;
    const host=field.parentElement||field;
    let layer=host.querySelector(':scope > .uiEatLayer');
    if(!layer){layer=document.createElement('div');layer.className='uiEatLayer';host.appendChild(layer);}
    layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:310';
    clearTimeout(layer._uiEatTimer);layer.replaceChildren();
    const badge=document.createElement('div');badge.className='eatFxPts uiEatCaption';
    const amount=document.createElement('b');amount.className='uiEatAmount';amount.setAttribute('dir','ltr');amount.textContent='+'+String(Math.trunc(value));
    const label=document.createElement('span');label.className='uiEatLabel';label.textContent='نقاط الأكلة';
    badge.appendChild(amount);badge.appendChild(label);layer.appendChild(badge);
    if(!reduced.matches){const ring=document.createElement('div');ring.className='eatFxRing';layer.appendChild(ring);}
    // One replacement-safe UI expiry per field; no polling or server alarm.
    layer._uiEatTimer=setTimeout(()=>layer.replaceChildren(),1300);
  };
  refresh();
  return {refresh};
})();
