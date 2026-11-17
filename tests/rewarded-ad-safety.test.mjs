import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webSource,coreSource} from './helpers/source.mjs';
const source=webSource('ui-session-ads-v380.js'),core=coreSource();
const defer=()=>{let resolve,reject;return {promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};};
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
function fixture({app=false}={}){
 let serial=0,now=100000,valid=true;const jobs=new Map(),events=new Map(),listeners=new Map(),nodes=new Map(),observers=new Set(),values=new Map(),loads=[],claims=[];
 const observed={prepare:0,show:0,removed:0,entry:0,interstitial:0,toasts:[]};
 const el=(hidden=true)=>{const classes=new Set(hidden?['hidden']:[]);return {hidden:false,dataset:{},classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k)},setAttribute(){},querySelector:()=>el(),querySelectorAll:()=>[],focus(){},remove(){},innerHTML:'',textContent:''};};
 for(const id of ['home','rewardScr','shop','sessionsModal','blModal','shopGold','mjRanked','mjBody','mjGold','mjSubtitle','mjMessage'])nodes.set(id,el(!['home','rewardScr'].includes(id)));
 const document={hidden:false,body:el(false),documentElement:el(false),getElementById:id=>nodes.get(id)||null,querySelector:()=>null,addEventListener:(k,fn)=>{if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn);},removeEventListener:(k,fn)=>listeners.get(k)?.delete(fn)};
 const c={document,console,AbortController,URL,Date:class extends Date{static now(){return now;}},location:{href:'https://fixture.invalid/'},history:{replaceState(){}},crypto:{randomUUID:()=>String(++serial).padStart(24,'0')},FB:{ready:true,user:{uid:'alice',getIdToken:async()=>'token-alice'}},ONL:{active:false},MATCH:{on:false},QUICK_SEARCH:{wanted:false},UI_FRIENDLY_ENTRY:{room:null},GAME_SRV:'fixture.invalid',MajabeedBaloot:{state:{selected:'majabeed',room:null,queue:false,loading:null}},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},setTimeout:(fn,ms)=>{const id=++serial;jobs.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>jobs.delete(id),setInterval:()=>0,clearInterval(){},addEventListener:document.addEventListener,removeEventListener:document.removeEventListener,MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.add(this);}disconnect(){observers.delete(this);}},renderAdRewardBtn(){},adRewardRemainingMs:()=>0,toast2:m=>observed.toasts.push(m),toH:String,refreshHome(){},claimAdRewardClient:async user=>{claims.push(user);return {ok:true,goldAfter:1200,amount:200};}};
 c.window=c;
 const plugin={addListener:async(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);return {remove:()=>{observed.removed++;events.get(name)?.delete(fn);}};},prepareRewardVideoAd:()=>{observed.prepare++;const d=defer();loads.push(d);return d.promise;},showRewardVideoAd:async()=>{observed.show++;},prepareInterstitial:async()=>{},showInterstitial:async()=>{observed.interstitial++;}};
 vm.createContext(c);vm.runInContext(source,c);
 const controller=c.MajabeedRewarded.create({getPlugin:()=>plugin,adId:'fixture'});c.MajabeedRewardedAd=controller;c.showRewardedAd=options=>controller.show(options);
 if(app){const start=core.indexOf('function uiRewardAdCanPresent('),end=core.indexOf("$('#adRewardBtn').onclick=watchAdForGold;",start);assert.ok(start>0&&end>start);vm.runInContext('let _adRewardBusy=false;'+core.slice(start,end),c);}
 return {c,plugin,controller,observed,claims,loads,jobs,nodes,values,show:()=>controller.show({isCurrent:()=>valid&&!document.hidden}),set valid(v){valid=v;},emit:(name)=>{for(const fn of [...(events.get(name)||[])])fn();},event:name=>{for(const fn of [...(listeners.get(name)||[])])fn();},mutation:()=>{for(const o of [...observers])o.fn();},advance:async ms=>{now+=ms;for(const [id,j]of [...jobs])if(j.at<=now){jobs.delete(id);j.fn();}await flush();},listenerCount:()=>[...events.values()].reduce((n,v)=>n+v.size,0),busy:()=>vm.runInContext('_adRewardBusy',c),el};
}
async function dispatch(f){const p=f.show();await flush();f.loads[0].resolve();await flush();assert.equal(f.observed.show,1);return {promise:p};}
test('gold load cancelled by leaving its offer never appears over a later Cup game',async()=>{
 const f=fixture({app:true}),p=f.c.watchAdForGold();await flush();assert.equal(f.busy(),true);
 f.nodes.get('rewardScr').classList.add('hidden');f.mutation();await p;
 f.c.ONL.active=true;f.c.ONL.status='playing';f.loads[0].resolve();await flush();assert.equal(f.observed.show,0);assert.equal(f.busy(),false);assert.equal(f.claims.length,0);
});
for(const origin of ['reward','shop'])test('an ordinary '+origin+' ad still awards only the confirmed server balance',async()=>{
 const f=fixture({app:true});if(origin==='shop'){f.nodes.get('home').classList.add('hidden');f.nodes.get('rewardScr').classList.add('hidden');f.nodes.get('shop').classList.remove('hidden');}
 const p=f.c.watchAdForGold();await flush();f.loads[0].resolve();await flush();assert.equal(f.observed.show,1);f.emit('onRewardedVideoAdReward');f.emit('onRewardedVideoAdDismissed');await p;
 assert.equal(f.claims.length,1);assert.equal(f.values.get('wb-gold'),'1200');assert.equal(f.values.get('wb-lastAdRewardTime'),'100000');assert.equal(f.busy(),false);
});
for(const [name,change] of Object.entries({rankedSearch:f=>f.c.document.documentElement.classList.add('mjRankedLocked'),legacyCup:f=>f.c.document.documentElement.classList.add('mcPageLocked'),lobby:f=>Object.assign(f.c.ONL,{active:true,status:'lobby'}),playing:f=>Object.assign(f.c.ONL,{active:true,status:'playing'}),spectating:f=>Object.assign(f.c.ONL,{active:true,spectateOnly:true}),sakkaQueue:f=>f.c.MajabeedBaloot.state.queue=true,sakkaTable:f=>f.c.MajabeedBaloot.state.room={},invitedTable:f=>f.c.UI_FRIENDLY_ENTRY.room='fixture-room',accountChange:f=>f.c.FB.user={uid:'bob'}})){
 test('late native load rechecks '+name+' before calling show',async()=>{const f=fixture({app:true}),p=f.c.watchAdForGold();await flush();change(f);f.loads[0].resolve();await p;assert.equal(f.observed.show,0);assert.equal(f.claims.length,0);assert.equal(f.busy(),false);});
}
test('loading timeout unlocks UI, ignores late callbacks and prevents overlapping an abandoned SDK load',async()=>{
 const f=fixture(),p=f.show();await flush();await f.advance(8000);assert.equal(await p,false);assert.equal(f.controller.busy,false);assert.equal(f.listenerCount(),0);
 assert.equal(await f.show(),false);assert.equal(f.observed.prepare,1);f.loads[0].resolve();await flush();assert.equal(f.observed.show,0);
 const retry=f.show();await flush();assert.equal(f.observed.prepare,2);f.loads[1].resolve();await flush();f.emit('onRewardedVideoAdDismissed');assert.equal(await retry,false);
});
test('pause or pagehide cancels only the pending load and never resumes an expired offer',async()=>{
 for(const event of ['pause','pagehide']){const f=fixture(),p=f.show();await flush();f.event(event);assert.equal(await p,false);f.loads[0].resolve();await flush();assert.equal(f.observed.show,0);assert.equal(f.listenerCount(),0);}
});
test('visibility loss and DOM cancellation remove all listeners',async()=>{
 for(const mode of ['hidden','dom']){const f=fixture(),p=f.show();await flush();if(mode==='hidden'){f.c.document.hidden=true;f.event('visibilitychange');}else{f.valid=false;f.mutation();}assert.equal(await p,false);assert.equal(f.listenerCount(),0);f.loads[0].resolve();await flush();assert.equal(f.observed.show,0);}
});
test('listener registration failure settles cleanly without loading or showing',async()=>{
 const f=fixture();f.plugin.addListener=async()=>{throw Error('native unavailable');};assert.equal(await f.show(),false);assert.equal(f.observed.prepare,0);assert.equal(f.controller.busy,false);
});
test('a late listener handle after timeout is removed and cannot begin SDK loading',async()=>{
 const f=fixture(),d=defer();let removed=0;f.plugin.addListener=()=>d.promise;const p=f.show();await f.advance(8000);assert.equal(await p,false);d.resolve({remove:()=>removed++});await flush();assert.equal(removed,1);assert.equal(f.observed.prepare,0);
});
test('prepare rejection and failed-load event release guards without rewards',async()=>{
 for(const mode of ['reject','event']){const f=fixture(),p=f.show();await flush();if(mode==='reject')f.loads[0].reject(Error('offline'));else{f.emit('onRewardedVideoAdFailedToLoad');f.loads[0].resolve();}assert.equal(await p,false);assert.equal(f.listenerCount(),0);assert.equal(f.c.MajabeedAdSafety.presenting,false);}
});
test('show rejection or failed-show event release presentation guard',async()=>{
 for(const mode of ['reject','event']){const f=fixture();if(mode==='reject')f.plugin.showRewardVideoAd=async()=>{throw Error('native reject');};const p=f.show();await flush();f.loads[0].resolve();await flush();if(mode==='event')f.emit('onRewardedVideoAdFailedToShow');assert.equal(await p,false);assert.equal(f.c.MajabeedAdSafety.presenting,false);assert.equal(f.listenerCount(),0);}
});
test('show promise completion, timeout and foreground changes do not unlock a dispatched native ad',async()=>{
 const f=fixture(),{promise}=await dispatch(f);assert.equal(f.c.MajabeedAdSafety.beforeEntry(),false);await f.advance(120000);f.c.document.hidden=true;f.event('pause');f.event('visibilitychange');f.valid=false;f.mutation();assert.equal(f.controller.presenting,true);assert.equal(f.c.MajabeedAdSafety.beforeEntry(),false);
 f.emit('onRewardedVideoAdReward');f.emit('onRewardedVideoAdDismissed');assert.equal(await promise,true);assert.equal(f.c.MajabeedAdSafety.beforeEntry(),true);assert.equal(f.listenerCount(),0);
});
test('dismissal without native Rewarded proof earns nothing; early or late stray reward events earn nothing',async()=>{
 const f=fixture(),p=f.show();await flush();f.emit('onRewardedVideoAdReward');f.loads[0].resolve();await flush();f.emit('onRewardedVideoAdDismissed');f.emit('onRewardedVideoAdReward');assert.equal(await p,false);
});
test('a verified reward is claimed once for its captured account after an auth change and does not overwrite current-account UI',async()=>{
 const f=fixture({app:true}),user=f.c.FB.user,p=f.c.watchAdForGold();await flush();f.loads[0].resolve();await flush();f.emit('onRewardedVideoAdReward');f.c.FB.user={uid:'bob'};f.event('pause');f.emit('onRewardedVideoAdDismissed');f.emit('onRewardedVideoAdDismissed');await p;assert.deepEqual(f.claims,[user]);assert.equal(f.values.has('wb-gold'),false);assert.equal(f.values.has('wb-lastAdRewardTime'),false);
});
test('actual reward claim uses the captured signed identity, independent of a later current account',async()=>{
 const f=fixture({app:true});let sent;f.c.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {json:async()=>({ok:true,goldAfter:1200,amount:200})};};
 const start=core.indexOf('async function claimAdRewardClient('),end=core.indexOf('// V398:',start);vm.runInContext(core.slice(start,end),f.c);const alice=f.c.FB.user;f.c.FB.user={uid:'bob',getIdToken:async()=>'token-bob'};assert.equal((await f.c.claimAdRewardClient(alice)).ok,true);assert.equal(sent.idToken,'token-alice');
});
test('server rejection after an earned ad cannot mint local gold or a cooldown',async()=>{
 const f=fixture({app:true});f.c.claimAdRewardClient=async()=>({ok:false,error:'network-error'});const p=f.c.watchAdForGold();await flush();f.loads[0].resolve();await flush();f.emit('onRewardedVideoAdReward');f.emit('onRewardedVideoAdDismissed');await p;assert.equal(f.values.size,0);
});
test('shared entry cancels a loading reward immediately and still enters, but cannot enter during presentation',async()=>{
 for(const presenting of [false,true]){const f=fixture(),p=f.show();await flush();if(presenting){f.loads[0].resolve();await flush();}vm.runInContext(webSource('ui-entry-ads.js'),f.c);const gate=f.c.MajabeedEntryAds.create({getUser:()=> 'alice',isNative:()=>true,isExempt:async()=>false,storage:()=>f.c.localStorage});assert.equal(await gate.run(()=>{f.observed.entry++;return true;}),!presenting);assert.equal(f.observed.entry,presenting?0:1);if(presenting)f.emit('onRewardedVideoAdDismissed');else{f.loads[0].resolve();await flush();assert.equal(f.observed.show,0);}assert.equal(await p,false);}
});
test('the real Cup join handler can cancel a pending gold load and create its request without any late presentation',async()=>{
 const f=fixture({app:true}),reward=f.c.watchAdForGold();await flush();let joins=0;
 const state={ok:true,protocol:1,mode:'cup',enabled:true,serverNow:100000,profile:{uid:'alice',rank:20000,gold:4800},tier:{index:9,min:20000,next:null,name:'شيخ المجابيد',fee:1000,win:1600,rankWin:150,rankLoss:100},entry:{price:0},progress:{status:'active',rulesVersion:2,stage:4,wins:1,losses:0},search:null,assignment:null};
 f.c.fetch=async(url,options={})=>{if(url.includes('/ranked/join')){joins++;state.search={requestId:JSON.parse(options.body).requestId,players:[{name:'Audit',rank:20000}],humanCount:1};}return {ok:true,json:async()=>url.includes('/cup/state')?{ok:true,profile:state.profile,rules:{},entry:state.entry,progress:state.progress}:structuredClone(state)};};
 vm.runInContext(webSource('ui-entry-ads.js'),f.c);f.c.MajabeedEntryGate=f.c.MajabeedEntryAds.create({getUser:()=> 'alice',isNative:()=>true,isExempt:async()=>false,storage:()=>f.c.localStorage});
 vm.runInContext(webSource('ui-ranked.js').replace(' window.MajabeedRanked={',' window.__adTest={R,account,join};window.MajabeedRanked={'),f.c);
 const h=f.c.__adTest;h.account('alice');Object.assign(h.R,{open:true,data:structuredClone(state),mode:'cup'});await h.join();await reward;assert.equal(joins,1);assert.equal(f.busy(),false);
 f.loads[0].resolve();await flush();assert.equal(f.observed.show,0);assert.equal(f.claims.length,0);
});
test('interstitial and rewarded native presentations cannot overlap',async()=>{
 const f=fixture(),{promise}=await dispatch(f);const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true,isExempt:()=>false});assert.equal(await inter(),false);assert.equal(f.observed.interstitial,0);f.emit('onRewardedVideoAdDismissed');await promise;
 const p=inter();await flush();assert.equal(f.observed.interstitial,1);assert.equal(await f.show(),false);f.emit('interstitialAdDismissed');assert.equal(await p,true);assert.equal(f.c.MajabeedAdSafety.presenting,false);
});
test('direct entry cancels a delayed interstitial load and it can never show over the new table',async()=>{
 const f=fixture(),load=defer();let prepares=0;f.plugin.prepareInterstitial=()=>{prepares++;return load.promise;};const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true});
 const p=inter();await flush();assert.equal(prepares,1);assert.equal(f.c.MajabeedAdSafety.beforeEntry(),true);assert.equal(await p,false);assert.equal(f.listenerCount(),0);assert.equal(await inter(),false);
 f.c.ONL.active=true;load.resolve();await flush();assert.equal(f.observed.interstitial,0);
});
test('direct entry cancels interstitial even while the asynchronous Plus check has not returned',async()=>{
 const f=fixture(),membership=defer();let prepares=0;f.plugin.prepareInterstitial=async()=>prepares++;const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true,isExempt:()=>membership.promise});
 const p=inter();await flush();assert.equal(f.c.MajabeedAdSafety.beforeEntry(),true);assert.equal(await p,false);membership.resolve(false);await flush();assert.equal(prepares,0);assert.equal(f.observed.interstitial,0);
});
test('expired interstitial entry identity is checked both after membership and after native loading',async()=>{
 for(const stage of ['membership','native']){const f=fixture(),pending=defer();let valid=true,prepares=0;f.plugin.prepareInterstitial=()=>{prepares++;return stage==='native'?pending.promise:Promise.resolve();};const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true,isExempt:()=>stage==='membership'?pending.promise:Promise.resolve(false)});const p=inter({isCurrent:()=>valid});await flush();valid=false;pending.resolve(false);assert.equal(await p,false);assert.equal(prepares,stage==='native'?1:0);assert.equal(f.observed.interstitial,0);assert.equal(f.listenerCount(),0);}
});
test('the actual entry allowance passes its account guard into delayed native interstitial loading',async()=>{
 const f=fixture(),load=defer();f.plugin.prepareInterstitial=()=>load.promise;const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true});
 vm.runInContext(webSource('ui-entry-ads.js'),f.c);f.values.set('mj-entry-ads-v398:alice','0');const gate=f.c.MajabeedEntryAds.create({getUser:()=>f.c.FB.user.uid,isNative:()=>true,isExempt:async()=>false,showAd:inter,storage:()=>f.c.localStorage});
 const p=gate.run(()=>{f.observed.entry++;return true;});await flush();f.c.FB.user={uid:'bob'};load.resolve();assert.equal(await p,false);assert.equal(f.observed.interstitial,0);assert.equal(f.observed.entry,0);assert.equal(f.values.get('mj-entry-ads-v398:alice'),'0');assert.match(webSource('ui-entry-ads-ui.js'),/showAd:options=>root\.showInterstitialAd\?\.\(options\)/);
});
test('interstitial deadline cancels load, ignores its late completion and does not unlock a dispatched ad',async()=>{
 const f=fixture(),load=defer();f.plugin.prepareInterstitial=()=>load.promise;const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true});const p=inter();await flush();await f.advance(8000);assert.equal(await p,false);load.resolve();await flush();assert.equal(f.observed.interstitial,0);
 f.plugin.prepareInterstitial=async()=>{};const shown=inter();await flush();assert.equal(f.observed.interstitial,1);assert.equal(f.c.MajabeedAdSafety.beforeEntry(),false);await f.advance(120000);f.event('pause');assert.equal(f.c.MajabeedAdSafety.beforeEntry(),false);f.emit('interstitialAdDismissed');assert.equal(await shown,true);assert.equal(f.c.MajabeedAdSafety.beforeEntry(),true);
});
test('hidden interstitial load cannot survive pause and resurface on resume',async()=>{
 const f=fixture(),load=defer();f.plugin.prepareInterstitial=()=>load.promise;const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true});const p=inter();await flush();f.event('pause');assert.equal(await p,false);load.resolve();await flush();assert.equal(f.observed.interstitial,0);assert.equal(f.listenerCount(),0);
});
test('unknown Plus membership and native interstitial failure release pending promises without entry',async()=>{
 for(const event of ['membership','interstitialAdFailedToLoad','interstitialAdFailedToShow']){const f=fixture(),load=defer();f.plugin.prepareInterstitial=()=>load.promise;const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true,isExempt:async()=>{if(event==='membership')throw Error('offline membership');return false;}});const p=inter();await flush();if(event!=='membership')f.emit(event);assert.equal(await p,false);load.resolve();await flush();assert.equal(f.listenerCount(),0);assert.equal(f.c.MajabeedAdSafety.presenting,false);assert.equal(f.observed.interstitial,0);}
});
test('a completed interstitial admits the original valid entry only after native dismissal',async()=>{
 const f=fixture(),inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true});vm.runInContext(webSource('ui-entry-ads.js'),f.c);f.values.set('mj-entry-ads-v398:alice','0');const gate=f.c.MajabeedEntryAds.create({getUser:()=> 'alice',isNative:()=>true,isExempt:async()=>false,showAd:inter,storage:()=>f.c.localStorage});
 const p=gate.run(()=>{f.observed.entry++;return true;});await flush();assert.equal(f.observed.interstitial,1);assert.equal(f.observed.entry,0);f.emit('interstitialAdDismissed');assert.equal(await p,true);assert.equal(f.observed.entry,1);assert.equal(f.values.get('mj-entry-ads-v398:alice'),'2');
});
test('late Plus check cannot prepare an interstitial once a rewarded presentation has started',async()=>{
 const f=fixture(),membership=defer();let prepares=0;f.plugin.prepareInterstitial=async()=>prepares++;const inter=f.c.MajabeedInterstitial.create({getPlugin:()=>f.plugin,adId:'fixture',isNative:()=>true,isExempt:()=>membership.promise});const p=inter();await flush();const {promise}=await dispatch(f);membership.resolve(false);assert.equal(await p,false);assert.equal(prepares,0);f.emit('onRewardedVideoAdDismissed');await promise;
});
test('direct Majabeed and Sakka joins reject presentation before any transport or lobby effects',async()=>{
 const f=fixture(),{promise}=await dispatch(f);let sideEffects=0;f.c.ac=()=>sideEffects++;
 const start=core.indexOf('function enterOnline('),end=core.indexOf('// NEW CODE ================= قائمة الجلسات النشطة',start);vm.runInContext(core.slice(start,end),f.c);assert.equal(f.c.enterOnline(),false);assert.equal(sideEffects,0);
 const sakka=webSource('ui-baloot.js'),s=sakka.indexOf('  async function join(')>=0?sakka.indexOf('  async function join('):sakka.indexOf(' async function join('),e=sakka.indexOf(' function requestLeave()',s);assert.ok(s>=0&&e>s);vm.runInContext(sakka.slice(s,e),f.c);assert.equal(await f.c.join('ABCDEFGH',true),false);f.emit('onRewardedVideoAdDismissed');await promise;
});
