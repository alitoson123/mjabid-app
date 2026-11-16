'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const defaultRoot=process.env.MAJABEED_WEB_ROOT||path.resolve(__dirname,'../../www');
function virtualClock(start=1800000000000){
 let time=start,id=0;const timers=new Map();
 class DateClock extends Date{static now(){return time;}}
 const setTimeout=(fn,ms=0)=>{const key=++id;timers.set(key,{at:time+Math.max(0,ms),fn});return key;};
 const clearTimeout=key=>timers.delete(key);
 const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
 async function advance(ms){const target=time+ms;await flush();for(;;){const pair=[...timers.entries()].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!pair)break;time=pair[1].at;timers.delete(pair[0]);pair[1].fn();await flush();}time=target;await flush();}
 return {Date:DateClock,now:()=>time,setTimeout,clearTimeout,advance,flush};
}
function installedAudio(clock,previous,me=0,root=defaultRoot,options={}){
 const source=fs.readFileSync(path.join(root,'ui-baloot-audio.js'),'utf8');
 const manifest=fs.readFileSync(path.join(root,'ui-baloot-sounds.js'),'utf8');
 const store=new Map([['mj-baloot-audio-cursor',JSON.stringify({match:previous.id,seq:previous.cueSeq})]]);
 const records=[],fakeContext={window:{}};vm.runInNewContext(manifest,fakeContext);const assets=fakeContext.window.MAJABEED_BALOOT_SOUNDS;
 const bySrc=new Map(Object.entries(assets).map(([id,a])=>[a.src,{...a,id}]));
 class AudioContext {
  state='running';sampleRate=48000;destination={};
  get currentTime(){return clock.now()/1000;}
  addEventListener(){}removeEventListener(){}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},cancelAndHoldAtTime(){}},connect(){return this;},disconnect(){}};}
  createBuffer(){return {id:'silent',duration:1/48000};}
  decodeAudioData(bytes){const a=bySrc.get(Buffer.from(bytes).toString());return Promise.resolve({id:a.id,duration:a.duration});}
  createBufferSource(){
   const ctx=this;let timer=null,record=null,ended=false;
   const finish=(kind)=>{if(ended)return;ended=true;if(record){record.endedAt=clock.now();record.endKind=kind;}source.onended?.();};
   const source={buffer:null,onended:null,connect(){return this;},disconnect(){},
    start(at=ctx.currentTime){const begin=Math.max(clock.now(),at*1000);record={id:source.buffer.id,startAt:begin,durationMs:source.buffer.duration*1000};records.push(record);timer=clock.setTimeout(()=>finish('natural'),begin-clock.now()+record.durationMs);},
    stop(at=ctx.currentTime){if(timer)clock.clearTimeout(timer);timer=clock.setTimeout(()=>finish('stop'),Math.max(0,at*1000-clock.now()));}
   };return source;
  }
 }
 const context=vm.createContext({Date:clock.Date,Map,Set,URL,Buffer,Promise,structuredClone,
  setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},
  fetch:async src=>{if(options.bufferDelayMs)await new Promise(resolve=>clock.setTimeout(resolve,options.bufferDelayMs));return {ok:true,arrayBuffer:async()=>Buffer.from(src)};},
  document:{hidden:false,addEventListener(){}},window:{MAJABEED_BALOOT_SOUNDS:assets,AudioContext,addEventListener(){}}});
 vm.runInContext(source,context);let prior=previous;
 return {records,assets,hash:crypto.createHash('sha256').update(source).digest('hex'),
  async sync(g){context.window.BalootAudio.sync(g,me,prior,clock.now(),{motionEffects:true});prior=g;await clock.flush();},
  api:context.window.BalootAudio};
}

module.exports={virtualClock,installedAudio};
