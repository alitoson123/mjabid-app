/* V398 AUDIO_V4: one current announcement, with click-free starts, ends and interruptions. */
(function(){
 'use strict';
 const A={context:null,muted:localStorage.getItem('mj-baloot-muted')==='1',buffers:new Map(),sources:new Set(),cursor:null,generation:0,voiceGeneration:0,voiceSource:null,group:null,snapshot:null,discardNext:false,waiters:new Set(),primer:null,clockProbe:null,stalled:null,paused:false};
 const assets=window.MAJABEED_BALOOT_SOUNDS||{};
 // Capacitor 6 iOS serves bundled WAVs with URLResponse (status 0), not HTTPURLResponse.
 // Accept only readable local app audio; real HTTP failures and opaque responses stay rejected.
 function nativeAudioResponse(response,src){
  if(response.status!==0||!['basic','default'].includes(response.type)||response.redirected)return false;
  try{
   const cap=window.Capacitor;if(cap?.isNativePlatform?.()!==true||cap.getPlatform?.()!=='ios')return false;
   const page=new URL(window.location.href),request=new URL(src,document.baseURI||page.href);
   if(page.protocol!=='capacitor:'||request.protocol!==page.protocol||request.host!==page.host||!request.pathname.startsWith('/sfx/'))return false;
   if(response.url){const resolved=new URL(response.url,page.href);if(resolved.protocol!==request.protocol||resolved.host!==request.host||resolved.pathname!==request.pathname)return false;}
   return true;
  }catch(_){return false;}
 }

 function fadeStop(entry){
  if(!entry||entry.stopping)return;entry.stopping=true;
  const now=A.context.currentTime,param=entry.gain.gain,end=Math.min(entry.endAt,now+.012);
  try{
   if(A.context.state!=='running'||end<=now){param.cancelScheduledValues(now);param.setValueAtTime(0,now);entry.source.stop();return;}
   if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);
   else{const level=entry.volume*(entry.speech?Math.max(0,Math.min(1,(now-entry.startAt)/.005,(entry.endAt-now)/.020)):1);param.cancelScheduledValues(now);param.setValueAtTime(level,now);}
   param.linearRampToValueAtTime(0,end);entry.source.stop(end);
  }catch(_){try{entry.gain.gain.value=0;entry.source.stop()}catch(_){}}
 }
 function hardStop(entry){
  if(!entry)return;entry.stopping=true;
  try{entry.source.stop(0);}catch(_){}
  try{entry.source.disconnect();entry.gain.disconnect();}catch(_){}
  A.sources.delete(entry);entry.finish?.();
 }
 function stopVoices(immediate=false){A.voiceGeneration++;A.group=null;const entry=A.voiceSource;A.voiceSource=null;(immediate?hardStop:fadeStop)(entry);wake();}
 function stop(immediate=false){A.generation++;stopVoices(immediate);for(const entry of A.sources)(immediate?hardStop:fadeStop)(entry);
  if(immediate&&A.primer){const source=A.primer;A.primer=null;try{source.stop(0);source.disconnect();}catch(_){}}
  A.snapshot=null;wake();}
 function muted(value){A.muted=!!value;if(value)stop(true);}
 // A gesture can retry resume even if a previous resume Promise is still pending.
 function wake(){for(const check of [...A.waiters])check();}
 function context(rebuild=false){
  if(A.context&&(rebuild||A.context.state==='closed')){
   const snapshot=A.snapshot;stop(true);A.snapshot=snapshot;
   if(A.clockProbe)A.clockProbe.finish();A.stalled=null;
   try{if(A.context.state!=='closed')Promise.resolve(A.context.close()).catch(()=>{});}catch(_){}
   A.context.removeEventListener?.('statechange',wake);A.context=null;
   A.buffers.clear();A.preloading=null;A.primer=null;
  }
  if(!A.context){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return null;
   A.context=new Context();A.context.addEventListener?.('statechange',wake);
  }return A.context;
 }
 function resume(ctx){
  if(!ctx||ctx.state==='closed')return;
  if(ctx.state!=='running'){
   try{Promise.resolve(ctx.resume()).then(wake,wake);}catch(_){wake();}
  }else wake();
 }
 function prime(ctx){
  if(A.primer||!ctx||ctx.state==='closed')return;
  try{const source=ctx.createBufferSource();source.buffer=ctx.createBuffer(1,1,ctx.sampleRate||44100);
   A.primer=source;source.onended=()=>{if(A.primer===source)A.primer=null;try{source.disconnect()}catch(_){}};
   source.connect(ctx.destination);source.start(0);
  }catch(_){A.primer=null;}
 }
 function preload(ctx){
  if(A.preloading||!ctx)return;
  const ids=[...new Set(['pass','wala','hokm','sun','first','second','hokm_second','card_deal','card_play','turn_alert',...Object.keys(assets)])].filter(id=>!A.buffers.has(id));
  if(!ids.length)return;
  const task=Promise.all(Array.from({length:4},async()=>{while(ids.length&&A.context===ctx){const id=ids.shift();try{await buffer(id)}catch(_){}}}));
  A.preloading=task;task.finally(()=>{if(A.preloading===task)A.preloading=null;});
 }
 function probeClock(ctx){
  if(!ctx||A.clockProbe?.ctx===ctx)return;
  const probe={ctx,generation:A.generation,timer:null,listener:null};A.clockProbe=probe;
  const usable=()=>A.clockProbe===probe&&A.context===ctx&&A.generation===probe.generation&&!A.paused&&!A.muted&&!document.hidden;
  const clear=()=>{clearTimeout(probe.timer);if(probe.listener)ctx.removeEventListener?.('statechange',probe.listener);probe.listener=null;};
  const finish=()=>{clear();if(A.clockProbe===probe)A.clockProbe=null;};probe.finish=finish;
  const sample=next=>{
   clear();if(!usable()){finish();return;}
   const begin=()=>{if(!usable()){finish();return;}if(ctx.state!=='running')return;
    clear();const time=ctx.currentTime;
    probe.timer=setTimeout(()=>{if(!usable()||ctx.state!=='running'){finish();return;}next(ctx.currentTime-time>=.005);},250);
   };
   if(ctx.state==='running')begin();
   else{probe.listener=begin;ctx.addEventListener?.('statechange',begin);probe.timer=setTimeout(finish,1200);}
  };
  sample(advanced=>{
   if(advanced){finish();return;}
   // WebKit can report running while its audio clock is frozen after an interruption.
   // Try one bounded same-context repair; never create a recurring recovery timer.
   probe.timer=setTimeout(finish,1200);
   try{Promise.resolve(ctx.suspend()).then(()=>{if(!usable()){finish();return;}resume(ctx);sample(repaired=>{
    if(!repaired)A.stalled={ctx,time:ctx.currentTime};finish();
   });},finish);}catch(_){finish();}
  });
 }
 function unlock(options={}){
  if(A.muted||document.hidden)return;A.paused=false;
  try{const old=A.context,stalled=A.stalled;
   const rebuild=!!options.gesture&&stalled?.ctx===old&&old?.state==='running'&&old.currentTime-stalled.time<.005;
   if(options.gesture&&stalled&&!rebuild)A.stalled=null;
   const ctx=context(rebuild);if(!ctx)return;
   // Resume and a silent one-sample source are invoked inside the gesture, before async work.
   resume(ctx);prime(ctx);preload(ctx);if(options.probe)probeClock(ctx);
  }catch(_){}
 }
 function buffer(id){
  const ctx=A.context;if(!assets[id]||!ctx)return Promise.reject(Error('audio unavailable'));
  if(!A.buffers.has(id)){
   const task=fetch(assets[id].src).then(r=>{if(!r.ok&&!nativeAudioResponse(r,assets[id].src))throw Error('audio missing');return r.arrayBuffer()}).then(bytes=>{if(!bytes.byteLength)throw Error('audio empty');return bytes;})
    .then(b=>ctx.decodeAudioData(b)).then(data=>{if(A.context!==ctx)throw Error('audio replaced');return data;})
    .catch(e=>{if(A.buffers.get(id)===task)A.buffers.delete(id);throw e;});
   A.buffers.set(id,task);
  }return A.buffers.get(id);
 }
 function eligible(group){return !A.muted&&!A.paused&&!document.hidden&&(!group||A.group===group&&group.generation===A.voiceGeneration&&Date.now()<group.until&&(group.started||Date.now()<=group.startBy));}
 function running(ctx,generation,group,deadline){
  // Wait only for this fresh event, not a backlog. A later gesture/statechange can wake it.
  if(ctx?.state==='running')return Promise.resolve(true);
  return new Promise(resolve=>{
   let timer,finished=false;
   const finish=ok=>{if(finished)return;finished=true;clearTimeout(timer);A.waiters.delete(check);resolve(ok);};
   const check=()=>{
    if(A.context!==ctx||!eligible(group)||generation!==A.generation||Date.now()>deadline||ctx?.state==='closed')finish(false);
    else if(ctx?.state==='running')finish(true);
   };
   A.waiters.add(check);timer=setTimeout(()=>finish(false),Math.max(0,deadline-Date.now()));
   resume(ctx);check();
  });
 }
 function valid(group){return eligible(group)&&A.context?.state==='running';}
 async function output(id,generation,volume,group){
  if(!eligible(group))return;
  const requested=Date.now(),ctx=A.context,deadline=group?(group.started?group.until:group.startBy):requested+600;
  try{if(!ctx||!await running(ctx,generation,group,deadline))return;
   const data=await buffer(id);if(!valid(group)||A.context!==ctx||generation!==A.generation||!group&&Date.now()-requested>600)return;
   const source=A.context.createBufferSource(),gain=A.context.createGain(),startAt=A.context.currentTime,endAt=startAt+data.duration;
   const entry={source,gain,startAt,endAt,volume,speech:!!group,stopping:false};source.buffer=data;
   if(group){gain.gain.setValueAtTime(0,startAt);gain.gain.linearRampToValueAtTime(volume,startAt+Math.min(.005,data.duration/4));gain.gain.setValueAtTime(volume,Math.max(startAt+data.duration/4,endAt-.020));gain.gain.linearRampToValueAtTime(0,endAt);}
   else gain.gain.value=volume;
   source.connect(gain).connect(A.context.destination);A.sources.add(entry);if(group){A.voiceSource=entry;group.started=true;}
   await new Promise(resolve=>{entry.finish=()=>{A.sources.delete(entry);if(A.voiceSource===entry)A.voiceSource=null;source.disconnect();gain.disconnect();resolve()};source.onended=entry.finish;try{source.start(startAt);}catch(_){entry.finish();}});
  }catch(_){}
 }
 function speak(ids,event={},startIn=1200){
  ids=ids.filter(id=>assets[id]?.speech);if(!ids.length||A.muted||A.paused||document.hidden)return;
  if(!context())return;stopVoices();const now=Date.now(),group={ids,event,match:A.cursor?.match,round:event.round,scope:A.snapshot,started:false,startBy:now+Math.max(0,startIn),until:now+Math.max(1500,ids.reduce((n,id)=>n+assets[id].duration*1000,0)+1200),generation:A.voiceGeneration};A.group=group;
  (async()=>{const generation=A.generation;for(const id of ids){if(!eligible(group)||generation!==A.generation)break;await output(id,generation,.85,group);}if(A.group===group)A.group=null;})();
 }
 // Consecutive automatic project taps are independent server cues. Keep their
 // validated deltas in one bounded group rather than cutting the first word.
 function sameProject(group,event,match,round){return !!group&&group.event.type==='project'&&event.type==='project'&&Number.isInteger(event.seat)&&event.seat===group.event.seat&&group.match===match&&group.round===round&&eligible(group);}
 function speakProjects(fresh,event,g,me,startIn){
  const index=fresh.indexOf(event),events=[];
  for(let i=index;i>=0;i--){const e=fresh[i];if(e.type!=='project'||e.seat!==event.seat)break;events.unshift(e);}
  const group=A.group,append=sameProject(group,event,g.id,g.round),pending=append?events.filter(e=>!group.projectCues?.includes(e.id)):events;
  if(!pending.length)return;
  const ids=pending.flatMap(e=>plan(e,me).filter(id=>assets[id]?.speech));if(!ids.length)return;
  // Four is the existing server declaration limit. Never grow a stale backlog
  // by repeatedly replacing legacy declarations; normal newer bids still win.
  if(append&&group.ids.length+ids.length<=4){group.ids.push(...ids);group.projectCues=(group.projectCues||[]).concat(pending.map(e=>e.id));group.until+=ids.reduce((n,id)=>n+assets[id].duration*1000,0);wake();return;}
  const bounded=pending.slice(-4);speak(bounded.flatMap(e=>plan(e,me).filter(id=>assets[id]?.speech)).slice(-4),{...event,round:g.round},startIn);
  if(A.group)A.group.projectCues=bounded.map(e=>e.id);
 }
 function play(id){
  if(A.muted||A.paused||document.hidden||!assets[id])return;
  if(id==='card_play'&&window.GameSoundManager){window.GameSoundManager.playActionSound();return;}
  if(!context())return;
  if(assets[id].speech){if(!A.group)speak([id],{type:'status'});}
  else output(id,A.generation,id==='ui_click'?.35:.65);
 }
 function projectVoice(items){const order={fourHundred:4,hundred:3,fifty:2,sira:1};return items.slice().sort((a,b)=>(order[b]||0)-(order[a]||0)).map(k=>({sira:'sara',fourHundred:'four_hundred'})[k]||k);}
 function plan(e,me){
  if(e.type==='deal')return [...(e.passedAuctionRound?[e.passedAuctionRound===2?'wala':'pass']:[]),'card_deal','first'];
  if(e.type==='second')return ['pass','second'];
  if(e.type==='trump')return [({S:'spades',H:'hearts',D:'diamonds',C:'clubs'})[e.trump]].filter(Boolean);
  if(e.type==='purchase'&&e.kind==='hokum'&&e.bidRound===2)return [];
  if(['bid','purchase'].includes(e.type))return [e.kind==='pass'?(e.bidRound===2?'wala':'pass'):e.kind==='hokum'?(e.bidRound===2?'hokm_second':'hokm'):e.kind];
  if(e.type==='doublePass')return ['pass'];
  if(e.type==='double')return [e.multiplier===2?(e.mode==='sun'?'double':e.closed?'double_closed':'double_open'):e.multiplier===3?'triple':e.multiplier===4?(e.closed?'four_closed':'four_open'):'gahwa'];
  if(e.type==='project')return projectVoice(e.items||[]);
  if(e.type==='reveal')return ['project_show'];
  if(e.type==='card')return ['card_play',...(e.baloot?['baloot']:[]),...(e.akka?['akka']:[])];
  if(e.type==='collect')return ['trick_collect'];
  if(e.type==='kasho')return ['kasho'];
  // The verified reveal announces any newly earned Baloot before Sawa in one voice group.
  if(e.type==='sawa')return [...new Set((Array.isArray(e.balootSeats)?e.balootSeats:[]).filter(seat=>Number.isInteger(seat)&&seat>=0&&seat<4))].map(()=>'baloot').concat('sawa');
  if(e.type==='sawaReply'||e.type==='sawaAccepted')return ['agree'];
  if(e.type==='claim'&&e.reason==='sawa')return ['qaid'];
  if(e.type==='claim')return ['qaid',...(e.seat===me?['choose_card']:[])];
  if(e.type==='result'){
   const mine=me>=0?me%2:null,buyerTeam=Number.isInteger(e.buyer)?e.buyer%2:null,buyerWon=e.buyerWon??e.winner===buyerTeam;
   const personal=mine===null?null:e.matchEnd?([0,1].includes(e.matchWinner)?(e.matchWinner===mine?'win':'lose'):null):buyerTeam===null?null:mine===buyerTeam?(buyerWon?'win':'lose'):!buyerWon?'win':null;
   return [...(e.claim===null?[]:[e.claim?'qaid_valid':'qaid_invalid']),...(e.sweep?['kaboot']:[]),...(e.matchEnd?['match_end']:[]),...(personal?[personal==='win'?'round_win':'round_lose',personal]:[])];
  }
  return [];
 }
 function scope(g){return [g.id,g.round,g.phase,g.turn,g.deadline].join(':');}
 function sync(g,me,previous,serverNow=Date.now(),options={}){
  if(!g)return;const key='mj-baloot-audio-cursor',currentScope=scope(g);let cursor=A.cursor,newMatch=false;
  if(!cursor||cursor.match!==g.id){try{cursor=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}if(cursor?.match!==g.id){newMatch=true;cursor={match:g.id,seq:previous||g.round===1&&g.cues?.length===1?0:g.cueSeq};}A.cursor=cursor;}
  const unseen=(g.cues||[]).filter(e=>e.id>cursor.seq),latest=unseen.at(-1);
  cursor.seq=Math.max(cursor.seq,g.cueSeq||0);try{localStorage.setItem(key,JSON.stringify(cursor))}catch(_){}
  const group=A.group,ownProject=group?.event.type==='project'&&group.match===g.id&&group.round===g.round&&previous?.id===g.id&&previous.round===g.round&&['play','collect'].includes(g.phase)&&unseen.every(e=>e.type==='collect'||e.type==='card'&&e.seat===group.event.seat&&!e.baloot&&!e.akka||sameProject(group,e,g.id,g.round)&&(e.round===undefined||e.round===g.round)&&(!e.at||serverNow-e.at<1200));
  if(group&&(group.scope!==currentScope||latest)&&!ownProject)stopVoices();
  if(ownProject)group.scope=currentScope;A.snapshot=currentScope;
  // An ad before entering a brand-new match must not discard its fresh first deal.
  if(A.discardNext){A.discardNext=false;stopVoices();if(!(newMatch&&g.round===1&&g.cues?.length===1&&latest?.type==='deal'))return;}
  // Reconnection consumes past announcements. Only a genuinely new initial deal is spoken on entry.
  if(!previous&&!(g.round===1&&g.cues?.length===1&&latest?.type==='deal')){stopVoices();return;}
  if(!latest||latest.at&&serverNow-latest.at>=1200)return;
  const fresh=unseen.filter(e=>(e.round===undefined||e.round===g.round)&&(!e.at||serverNow-e.at<1200));
  let event=fresh.at(-1);if(!event)return;
  if(event.type==='result')event={buyer:g.roundResult?.contract?.buyer,...event,matchWinner:g.winner};
  const effects=plan(event,me).filter(id=>assets[id]&&!assets[id].speech);for(const id of effects)if(!options.motionEffects||!['card_play','trick_collect'].includes(id))play(id);
  // A purchase and its bid share a single move. Second-hokum confirmation must not repeat the buyer.
  if(event.type==='purchase'&&event.kind==='hokum'&&event.bidRound===2){const bid=fresh.at(-2);event=bid?.type==='bid'?bid:null;}
  if(event?.type==='card'&&!event.baloot&&!event.akka){const project=fresh.at(-2);if(project?.type==='project'&&project.seat===event.seat)event=project;}
  if(!event)return;
  if(event.type==='project'){speakProjects(fresh,event,g,me,1200-Math.max(0,serverNow-(event.at||serverNow)));return;}
  const spoken=plan(event.type==='result'?{buyer:g.roundResult?.contract?.buyer,...event,matchWinner:g.winner}:event,me).filter(id=>assets[id]?.speech);
  if(spoken.length)speak(spoken,event,1200-Math.max(0,serverNow-(event.at||serverNow)));
 }
 document.addEventListener('pointerdown',e=>{if(e.target.closest('#blGame,#blModal,#blSelector,#blHomeMenu,#blGamePicker'))unlock({gesture:true});},{passive:true});
 function suspend(){A.paused=true;stop(true);if(A.clockProbe)A.clockProbe.finish();A.discardNext=true;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
 window.addEventListener('pagehide',suspend);
 window.BalootAudio={unlock,play,sync,muted,stop,suspend,plan,assets};
})();
