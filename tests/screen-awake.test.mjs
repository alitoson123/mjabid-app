import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webSource} from './helpers/source.mjs';

const source=webSource('ui-screen-awake.js'),factory={module:{exports:{}}};vm.runInNewContext(source,factory);
const {createController}=factory.module.exports;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function lock(){let callback;return {released:false,releaseCount:0,addEventListener(_name,fn){callback=fn;},release(){this.releaseCount++;this.released=true;callback?.();return Promise.resolve();},systemRelease(){this.released=true;callback?.();}};}
function fixture({request,native}={}){
 let active=false,visible=true;const requests=[],nativeCalls=[];
 const c=createController({active:()=>active,visible:()=>visible,native:()=>({setEnabled:async value=>{nativeCalls.push(value.enabled);return native?.(value);}}),wakeLock:{request:async type=>{requests.push(type);return request?request():lock();}}});
 return {c,requests,nativeCalls,active(value){active=value;c.sync();},visible(value){visible=value;c.sync();}};
}
test('only active foreground play holds the display; idle, home and repeated paints issue no extra work',async()=>{
 const f=fixture();f.c.sync();await flush();assert.deepEqual(f.nativeCalls,[false]);assert.equal(f.requests.length,0);
 f.active(true);await flush();assert.equal(f.c.snapshot().held,true);assert.deepEqual(f.nativeCalls,[false,true]);
 for(let i=0;i<30;i++)f.c.sync();await flush();assert.equal(f.requests.length,1);assert.equal(f.nativeCalls.length,2);
 f.active(false);await flush();assert.equal(f.c.snapshot().held,false);assert.equal(f.nativeCalls.at(-1),false);
});
test('background releases display lock and returning to active play requests a fresh lock',async()=>{
 const locks=[],f=fixture({request:()=>{const l=lock();locks.push(l);return l;}});f.active(true);await flush();
 f.visible(false);await flush();assert.equal(locks[0].released,true);assert.equal(f.nativeCalls.at(-1),false);
 f.visible(true);await flush();assert.equal(locks.length,2);assert.equal(f.c.snapshot().held,true);assert.equal(f.nativeCalls.at(-1),true);
});
test('a delayed browser acquisition cannot keep the screen awake after leaving',async()=>{
 const p=deferred(),f=fixture({request:()=>p.promise});f.active(true);await flush();f.active(false);const l=lock();p.resolve(l);await flush();
 assert.equal(l.releaseCount,1);assert.equal(f.c.snapshot().held,false);assert.equal(f.nativeCalls.at(-1),false);
});
test('background-return race releases the old pending lock before reacquiring for the new visible session',async()=>{
 const p=deferred();let count=0;const f=fixture({request:()=>++count===1?p.promise:lock()});f.active(true);await flush();f.visible(false);f.visible(true);
 const old=lock();p.resolve(old);await flush();assert.equal(old.released,true);assert.equal(count,2);assert.equal(f.c.snapshot().held,true);
});
test('browser denial or system release never loops; explicit foreground/user retry can recover',async()=>{
 let count=0,l;const f=fixture({request:()=>{if(++count===1)throw Error('OS policy');return l=lock();}});f.active(true);await flush();
 for(let i=0;i<30;i++)f.c.sync();await flush();assert.equal(count,1);assert.equal(f.nativeCalls.at(-1),true);
 f.c.retry();await flush();assert.equal(count,2);l.systemRelease();for(let i=0;i<30;i++)f.c.sync();await flush();assert.equal(count,2);
 f.visible(false);f.visible(true);await flush();assert.equal(count,3);
});
test('native completion is ordered so a late enable is followed by the current home disable',async()=>{
 const p=deferred(),f=fixture({native:({enabled})=>enabled?p.promise:undefined});f.active(true);await flush();f.active(false);
 p.resolve();await flush();assert.deepEqual(f.nativeCalls,[true,false]);assert.equal(f.c.snapshot().wanted,false);
});
test('browser fallback survives a missing or failing native plugin',async()=>{
 const f=fixture({native:()=>{throw Error('Plugin unavailable');}});f.active(true);await flush();assert.equal(f.c.snapshot().held,true);f.active(false);await flush();assert.equal(f.c.snapshot().held,false);
 const c=createController({active:()=>true,visible:()=>true,native:()=>null,wakeLock:undefined});assert.doesNotThrow(()=>c.sync());assert.equal(c.snapshot().wanted,true);
});
function runtime(){
 const callbacks={},events={},calls=[],elements=new Map(['game','onl','blGame','home','welcome','login','signup','gcomplete'].map(id=>[id,{hidden:id==='blGame',classList:{contains:()=>id!=='blGame'}}]));
 const c={document:{hidden:false,getElementById:id=>elements.get(id)||null,addEventListener:(name,fn)=>callbacks[name]=fn},addEventListener:(name,fn)=>events[name]=fn,navigator:{},G:{},ONL:{},Capacitor:{Plugins:{ScreenAwake:{setEnabled:async({enabled})=>calls.push(enabled)},FriendlyVoice:new Proxy({}, {get(){throw Error('Screen policy must not use voice or microphone');}})}}};c.window=c;
 vm.runInNewContext(source,c);
 const shown=(id,value)=>{elements.get(id).hidden=false;elements.get(id).classList.contains=()=>!value;};
 return {c,calls,callbacks,events,shown,sync:()=>c.MajabeedScreenAwake.sync()};
}
test('actual scene policy covers Majabeed player, spectator and local play while excluding lobby and results',async()=>{
 const f=runtime();f.shown('onl',true);f.c.ONL={active:true,status:'lobby'};f.sync();await flush();assert.equal(f.calls.at(-1),false);
 for(const spectateOnly of [false,true]){f.c.ONL={active:true,status:'playing',spectateOnly};f.sync();await flush();assert.equal(f.calls.at(-1),true);f.c.ONL.status='over';f.sync();await flush();assert.equal(f.calls.at(-1),false);}
 f.shown('onl',false);f.shown('game',true);f.c.G={players:[{}],phase:'turn'};f.sync();await flush();assert.equal(f.calls.at(-1),true);
 f.c.G.phase='end';f.sync();await flush();assert.equal(f.calls.at(-1),false);f.shown('game',false);f.shown('home',true);f.sync();await flush();assert.equal(f.calls.at(-1),false);
});
test('actual Sakka scene policy treats players and spectators equally and releases on lobby, exit or logout',async()=>{
 const f=runtime();f.shown('blGame',true);f.c.MajabeedBaloot={state:{room:{},state:{game:null}}};f.sync();await flush();assert.equal(f.calls.at(-1),false);
 for(const me of [0,-1]){f.c.MajabeedBaloot.state.state={me,game:{phase:'play'}};f.sync();await flush();assert.equal(f.calls.at(-1),true);f.c.MajabeedBaloot.state.state.game.phase='matchEnd';f.sync();await flush();assert.equal(f.calls.at(-1),false);}
 f.c.MajabeedBaloot.state.state.game.phase='play';f.sync();await flush();f.shown('welcome',true);f.sync();await flush();assert.equal(f.calls.at(-1),false);
 f.shown('welcome',false);f.c.MajabeedBaloot.state.room=null;f.sync();await flush();assert.equal(f.calls.at(-1),false);
});
test('page and native pause events release and restore only the display, without voice lifecycle calls',async()=>{
 const f=runtime();f.shown('onl',true);f.c.ONL={active:true,status:'playing',spectateOnly:true};f.sync();await flush();
 for(const [off,on] of [[()=>{f.c.document.hidden=true;f.callbacks.visibilitychange();},()=>{f.c.document.hidden=false;f.callbacks.visibilitychange();}],[f.callbacks.pause,f.callbacks.resume],[f.events.pagehide,f.events.pageshow]]){off();await flush();assert.equal(f.calls.at(-1),false);on();await flush();assert.equal(f.calls.at(-1),true);}
});
