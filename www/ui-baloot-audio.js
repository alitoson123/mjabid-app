/* V398 AUDIO_V4: one current announcement, with click-free starts, ends and interruptions. */
(function(){
 'use strict';
 const A={context:null,muted:localStorage.getItem('mj-baloot-muted')==='1',buffers:new Map(),sources:new Set(),cursor:null,generation:0,voiceGeneration:0,voiceSource:null,group:null,snapshot:null,discardNext:false};
 const assets=window.MAJABEED_BALOOT_SOUNDS||{};
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
 function stopVoices(){A.voiceGeneration++;A.group=null;const entry=A.voiceSource;A.voiceSource=null;fadeStop(entry);}
 function stop(){A.generation++;stopVoices();for(const entry of A.sources)fadeStop(entry);A.snapshot=null;}
 function muted(value){A.muted=!!value;if(value)stop();}
 async function unlock(){
  if(A.muted)return;try{if(!A.context){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;A.context=new Context();}if(A.context.state==='suspended')await A.context.resume();
   // Decode local speech before the first bid; fetch failures remain retryable.
   if(!A.preloading){A.preloading=true;const ids=[...new Set(['pass','wala','hokm','sun','first','second','hokm_second','card_deal','card_play','turn_alert',...Object.keys(assets)])];
    await Promise.all(Array.from({length:4},async()=>{while(ids.length){const id=ids.shift();try{await buffer(id)}catch(_){}}}));A.preloading=false;}
  }catch(_){A.preloading=false;}
 }
 function buffer(id){
  if(!assets[id]||!A.context)return Promise.reject(Error('audio unavailable'));
  if(!A.buffers.has(id))A.buffers.set(id,fetch(assets[id].src).then(r=>{if(!r.ok)throw Error('audio missing');return r.arrayBuffer()}).then(b=>A.context.decodeAudioData(b)).catch(e=>{A.buffers.delete(id);throw e;}));
  return A.buffers.get(id);
 }
 function valid(group){return !A.muted&&!document.hidden&&A.context?.state==='running'&&(!group||A.group===group&&group.generation===A.voiceGeneration&&Date.now()<group.until&&(group.started||Date.now()<=group.startBy));}
 async function output(id,generation,volume,group){
  if(!valid(group))return;
  const requested=Date.now();try{const data=await buffer(id);if(!valid(group)||generation!==A.generation||!group&&Date.now()-requested>600)return;
   const source=A.context.createBufferSource(),gain=A.context.createGain(),startAt=A.context.currentTime,endAt=startAt+data.duration;
   const entry={source,gain,startAt,endAt,volume,speech:!!group,stopping:false};source.buffer=data;
   if(group){gain.gain.setValueAtTime(0,startAt);gain.gain.linearRampToValueAtTime(volume,startAt+Math.min(.005,data.duration/4));gain.gain.setValueAtTime(volume,Math.max(startAt+data.duration/4,endAt-.020));gain.gain.linearRampToValueAtTime(0,endAt);}
   else gain.gain.value=volume;
   source.connect(gain).connect(A.context.destination);A.sources.add(entry);if(group){A.voiceSource=entry;group.started=true;}
   await new Promise(resolve=>{source.onended=()=>{A.sources.delete(entry);if(A.voiceSource===entry)A.voiceSource=null;source.disconnect();gain.disconnect();resolve()};source.start(startAt);});
  }catch(_){}
 }
 function speak(ids,event={},startIn=1200){
  ids=ids.filter(id=>assets[id]?.speech);if(!ids.length||A.muted||document.hidden)return;
  stopVoices();const now=Date.now(),group={ids,event,scope:A.snapshot,started:false,startBy:now+Math.max(0,startIn),until:now+Math.max(1500,ids.reduce((n,id)=>n+assets[id].duration*1000,0)+1200),generation:A.voiceGeneration};A.group=group;
  (async()=>{const generation=A.generation;for(const id of ids){if(!valid(group)||generation!==A.generation)break;await output(id,generation,.85,group);}if(A.group===group)A.group=null;})();
 }
 function play(id){
  if(A.muted||document.hidden||!assets[id])return;
  if(id==='card_play'&&window.GameSoundManager){window.GameSoundManager.playActionSound();return;}
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
  if(!g)return;const key='mj-baloot-audio-cursor',currentScope=scope(g);let cursor=A.cursor;
  if(!cursor||cursor.match!==g.id){try{cursor=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}if(cursor?.match!==g.id)cursor={match:g.id,seq:previous||g.round===1&&g.cues?.length===1?0:g.cueSeq};A.cursor=cursor;}
  const unseen=(g.cues||[]).filter(e=>e.id>cursor.seq),latest=unseen.at(-1);
  cursor.seq=Math.max(cursor.seq,g.cueSeq||0);try{localStorage.setItem(key,JSON.stringify(cursor))}catch(_){}
  const group=A.group,ownProject=group?.event.type==='project'&&previous?.id===g.id&&previous.round===g.round&&['play','collect'].includes(g.phase)&&unseen.every(e=>e.type==='collect'||e.type==='card'&&e.seat===group.event.seat&&!e.baloot&&!e.akka);
  if(group&&(group.scope!==currentScope||latest)&&!ownProject)stopVoices();
  if(ownProject)group.scope=currentScope;A.snapshot=currentScope;
  if(A.discardNext){A.discardNext=false;stopVoices();return;}
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
  const spoken=plan(event.type==='result'?{buyer:g.roundResult?.contract?.buyer,...event,matchWinner:g.winner}:event,me).filter(id=>assets[id]?.speech);
  if(spoken.length)speak(spoken,event,1200-Math.max(0,serverNow-(event.at||serverNow)));
 }
 document.addEventListener('pointerdown',e=>{if(e.target.closest('#blGame,#blModal,#blSelector,#blHomeMenu,#blGamePicker'))unlock();},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();A.discardNext=true;}});
 window.addEventListener('pagehide',()=>{stop();A.discardNext=true;});
 window.BalootAudio={unlock,play,sync,muted,stop,plan,assets};
})();
