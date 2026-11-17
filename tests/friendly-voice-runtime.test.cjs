'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../www/ui-friendly-voice.js'),'utf8'),configSource=fs.readFileSync(path.join(__dirname,'../www/ui-friendly-voice-config.js'),'utf8');
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function browser({config,installed=true,response,getToken,loadConfig=true}={}){
 const nodes=new Map(),requests=[],calls=[],intervals=[],timeouts=new Map(),listeners=new Map();let nextTimer=0,available=installed;
 const listen=(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]),emit=(name,event={})=>{for(const fn of listeners.get(name)||[])fn(event);};
 const classes=()=>{const names=new Set();return {add:name=>names.add(name),remove:name=>names.delete(name),contains:name=>names.has(name),toggle(name,value){if(value??!names.has(name))names.add(name);else names.delete(name);}};};
 const node=tag=>({tag,dataset:{},classList:classes(),isConnected:false,firstChild:null,parentElement:null,setAttribute(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},getClientRects(){return [{}];},append(child){child.parentElement=this;child.isConnected=true;nodes.set(child.id,child);},remove(){this.isConnected=false;if(nodes.get(this.id)===this)nodes.delete(this.id);},focus(){},get innerHTML(){return this._html||'';},set innerHTML(value){this._html=value;this.firstChild=value?{}:null;}});
 const frame=node('main');frame.id='frame';frame.isConnected=true;nodes.set(frame.id,frame);
 for(const id of ['onl','blGame']){const table=node('section');table.id=id;table.hidden=false;frame.append(table);}
 const actions=node('div');actions.id='oActions';actions.isConnected=true;nodes.set(actions.id,actions);
 const document={body:frame,hidden:false,activeElement:null,getElementById:id=>nodes.get(id)||null,createElement:node,querySelector:s=>s.includes('#oActions')||s.includes('.blActions')?actions:null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listen('document:'+name,fn)};
 const bridge={addListener:async(_,fn)=>{bridge.event=fn;return {remove:async()=>calls.push(['remove'])};}};
 bridge.getMicrophonePermission=async()=>({granted:true});
 for(const method of ['join','leave','cancel','setMicrophone','setPlayback','muteParticipant','renewToken'])bridge[method]=async body=>{calls.push([method,body]);};
 const status={ok:true,available:true,enabled:true,sessionId:'voice-room-session',canManage:true,participants:[{playerId:'p-A',uid:1,name:'أ',joined:true},{playerId:'p-B',uid:2,name:'ب',joined:true}]};
 const root={document,FB:{user:{uid:'account-A',getIdToken:getToken||(async()=> 'test-auth-token')}},crypto:{randomUUID:()=> '10000000-0000-4000-8000-000000000001'},Capacitor:{isPluginAvailable:()=>available,Plugins:{FriendlyVoice:bridge}},addEventListener:(name,fn)=>listen('window:'+name,fn),dispatchEvent:event=>emit('window:'+event.type,event),CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}};
 if(config!==undefined)root.MJ_FRIENDLY_VOICE_CONFIG=config;
 const sandbox={window:root,document,FB:root.FB,URL,AbortController,console,setInterval:fn=>{intervals.push(fn);return intervals.length;},setTimeout:(fn,ms)=>{const id=++nextTimer;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id),fetch:async(url,options)=>{
  requests.push({url,body:JSON.parse(options.body),headers:options.headers});if(response)return response(url,options,status);
  const action=new URL(url).pathname.split('/').at(-1),data=['join','renew'].includes(action)?{...status,appId:'a'.repeat(32),channel:'voice-room',uid:1,token:'007-fixture',expiresAt:Date.now()+180000}:status;
  return {ok:true,status:200,json:async()=>data};
 }};
 vm.createContext(sandbox);if(loadConfig)vm.runInContext(configSource,sandbox);vm.runInContext(source,sandbox);
 const s={active:true,room:'friendly-room',you:'p-A',seats:['p-A','p-B'],stateReady:true};
 return {root,nodes,requests,calls,intervals,bridge,status,sandbox,emit,shown:()=>nodes.has('mjFriendlyVoice'),sync:()=>root.MajabeedFriendlyVoice.syncMajabeed(s),controller:()=>root.MajabeedFriendlyVoice.getController(),setInstalled:value=>available=value,tick:()=>intervals.forEach(fn=>fn())};
}
const enabled={enabled:true,endpoint:'https://voice.example.test'};
test('missing runtime config creates no voice controller, UI or requests',async()=>{
 const b=browser({loadConfig:false});b.sync();await flush();assert.equal(b.root.MJ_FRIENDLY_VOICE_CONFIG,undefined);assert.equal(b.controller(),null);assert.equal(b.shown(),false);assert.equal(b.requests.length,0);assert.equal(b.calls.length,0);
});
test('public release config probes only the explicitly approved origin and still starts muted',async()=>{
 const b=browser();b.sync();await flush();assert.equal(b.root.MJ_FRIENDLY_VOICE_CONFIG.enabled,true);assert.equal(b.root.MJ_FRIENDLY_VOICE_CONFIG.allowLocalhost,false);assert.equal(b.requests.length,1);assert.equal(b.requests[0].url,'https://waggif-baloot.samisalimhdmaol.workers.dev/voice/status');assert.equal(b.shown(),true);assert.equal(b.controller().snapshot().microphone,false);assert.equal(b.calls.some(x=>x[0]==='join'),false);
});
test('public release config remains invisible against the old server even though probing is enabled',async()=>{
 const b=browser({response:async()=>({ok:false,status:404,json:async()=>({ok:false})})});b.sync();await flush();assert.equal(b.root.MJ_FRIENDLY_VOICE_CONFIG.enabled,true);assert.equal(b.shown(),false);assert.equal(b.calls.some(x=>x[0]==='join'),false);
});
test('explicit disabled config overrides presence of native bridge',async()=>{
 const b=browser({config:{...enabled,enabled:false}});b.sync();await flush();assert.equal(b.shown(),false);assert.equal(b.requests.length,0);assert.equal(b.calls.length,0);
});
test('native absence hides controls even with enabled endpoint and never asks the server',async()=>{
 const b=browser({config:enabled,installed:false});b.sync();await flush();assert.equal(b.shown(),false);assert.equal(b.controller(),null);assert.equal(b.requests.length,0);
});
test('configuration without endpoint cannot accidentally fall back to existing game server',async()=>{
 const b=browser({config:{enabled:true}});b.root.GAME_SRV='production.example.test';b.sync();await flush();assert.equal(b.requests.length,0);assert.equal(b.controller(),null);
});
test('UI waits for the actual successful capability response instead of optimistic room eligibility',async()=>{
 const response=deferred(),b=browser({config:enabled,response:()=>response.promise});b.sync();await flush();assert.equal(b.shown(),false);assert.equal(b.requests.length,1);response.resolve({ok:true,status:200,json:async()=>b.status});await flush();assert.equal(b.shown(),true);assert.equal(b.requests[0].url,'https://voice.example.test/voice/status');
});
for(const failure of ['old-html-404','disabled','not-configured','unavailable','legacy-json'])test('actual paint stays hidden for '+failure,async()=>{
 const b=browser({config:enabled,response:async()=>failure==='old-html-404'?{ok:false,status:404,json:async()=>{throw SyntaxError('HTML response');}}:{ok:!['disabled','not-configured'].includes(failure),status:['disabled','not-configured'].includes(failure)?503:200,json:async()=>failure==='disabled'?{ok:false,code:'VOICE_DISABLED'}:failure==='not-configured'?{ok:false,code:'VOICE_NOT_CONFIGURED'}:failure==='unavailable'?{ok:true,available:false,enabled:false}:{ok:true,enabled:true}}});
 b.sync();await flush();assert.equal(b.shown(),false);assert.equal(b.controller().snapshot().available,false);assert.equal(b.calls.some(x=>x[0]==='join'),false);
});
test('disabling runtime during a live voice session cancels native audio and removes controls',async()=>{
 const b=browser({config:enabled});b.sync();await flush();const c=b.controller();c.acceptRules();assert.equal(await c.join(),true);await c.microphone(true);b.root.MJ_FRIENDLY_VOICE_CONFIG={...enabled,enabled:false};b.tick();await flush();assert.equal(b.shown(),false);assert.equal(b.controller(),null);assert.ok(b.calls.some(x=>x[0]==='cancel'));assert.equal(c.snapshot().microphone,false);
});
test('bridge removal invalidates an active controller and hides stale controls',async()=>{
 const b=browser({config:enabled});b.sync();await flush();const c=b.controller();c.acceptRules();await c.join();b.setInstalled(false);b.tick();await flush();assert.equal(b.shown(),false);assert.equal(b.controller(),null);assert.ok(b.calls.some(x=>x[0]==='cancel'));
});
test('late server response after runtime disabled cannot restore controls',async()=>{
 const response=deferred(),b=browser({config:enabled,response:()=>response.promise});b.sync();await flush();b.root.MJ_FRIENDLY_VOICE_CONFIG={...enabled,enabled:false};b.tick();response.resolve({ok:true,status:200,json:async()=>b.status});await flush();assert.equal(b.shown(),false);assert.equal(b.controller(),null);
});
test('changing endpoints while authentication is pending never sends credentials to the stale origin',async()=>{
 const token=deferred(),b=browser({config:enabled,getToken:()=>token.promise});b.sync();await flush();b.root.MJ_FRIENDLY_VOICE_CONFIG={enabled:true,endpoint:'https://new-voice.example.test'};b.sync();token.resolve('fake-token');await flush();assert.equal(b.requests.length,1);assert.equal(b.requests[0].url,'https://new-voice.example.test/voice/status');assert.equal(b.shown(),true);
});
test('sign-out removes controls and cancels the current native session',async()=>{
 const b=browser({config:enabled});b.sync();await flush();const c=b.controller();c.acceptRules();await c.join();b.root.FB.user=null;b.tick();await flush();assert.equal(b.shown(),false);assert.ok(b.calls.some(x=>x[0]==='cancel'));
});
test('service worker never intercepts voice membership or token requests on custom hostnames',()=>{
 const listeners={},sw=fs.readFileSync(path.join(__dirname,'../www/sw.js'),'utf8');let touchedCache=false,responded=false;
 const sandbox={self:{addEventListener:(name,fn)=>listeners[name]=fn},URL,location:{origin:'https://game.example.test'},caches:{match:()=>{touchedCache=true;throw Error('voice must not use cache');}}};vm.createContext(sandbox);vm.runInContext(sw,sandbox);
 for(const method of ['GET','POST'])for(const endpoint of ['status','join','renew','leave','report'])listeners.fetch({request:{url:'https://voice.example.test/voice/'+endpoint,method,mode:'cors'},respondWith:()=>responded=true});
 assert.equal(touchedCache,false);assert.equal(responded,false);
});

// Execute the actual lifecycle functions and event registrations from both game
// engines alongside the actual voice runtime. Only unrelated renderer/server
// dependencies are stubbed; these tests would fail with the old unconditional
// Cordova pause handlers even if the controller tests passed.
function installGameLifecycle(b,game){
 const callbacks=[],sandbox=b.sandbox,noop=()=>{};
 b.root.UISessionReturn={background:name=>{callbacks.push(name);return true;},foreground:()=>true,blocked:()=>false};sandbox.clearInterval=noop;
 if(game==='majabeed'){
  sandbox.ONL={room:'friendly-room',active:true};sandbox.uiSessionReturnConfigure=noop;
  const src=fs.readFileSync(path.join(__dirname,'../www/game-core.js'),'utf8');vm.runInContext(src.slice(src.indexOf('let UI_SESSION_RETURN_HOME='),src.indexOf('function oHandle(')),sandbox);
 }else{
  sandbox.B={state:{room:'friendly-room'},room:{ready:true}};sandbox.user=()=>b.root.FB.user;
  for(const method of ['cancelPublicProfile','cancelDrag','clearCardMotion','hideChat','paintPreselect','configureReturn','closeLink'])sandbox[method]=noop;
  const src=fs.readFileSync(path.join(__dirname,'../www/ui-baloot.js'),'utf8');vm.runInContext(src.slice(src.indexOf(' function background('),src.indexOf(' const choiceKey=')),sandbox);
  const listeners=src.slice(src.indexOf("  document.addEventListener('visibilitychange'"),src.indexOf('  home();if(B.selected',src.indexOf("  document.addEventListener('visibilitychange'")));
  vm.runInContext(listeners,sandbox);
 }
 return callbacks;
}
async function joinRuntime(b,game){
 if(game==='majabeed')b.sync();else {b.status.participants[0].playerId='account-A';b.root.MajabeedFriendlyVoice.syncSakka({room:'friendly-room',mode:'friendly',me:0,seats:[{uid:'account-A'}]},true);}
 await flush();const c=b.controller();c.acceptRules();assert.equal(await c.join(),true);return c;
}
for(const game of ['majabeed','sakka'])for(const granted of [true,false])test(`${game} real JS pause/hidden handlers preserve the room on first permission ${granted?'grant':'denial'}`,async()=>{
 const b=browser({config:enabled}),backgrounds=installGameLifecycle(b,game),c=await joinRuntime(b,game),pending=deferred();b.bridge.getMicrophonePermission=async()=>({granted:false});b.bridge.setMicrophone=()=>pending.promise;
 const enabling=c.microphone(true);await flush();b.emit('document:pause');b.root.document.hidden=true;b.emit('document:visibilitychange');assert.deepEqual(backgrounds,[]);assert.equal(c.snapshot().phase,'joined');
 if(granted)pending.resolve({});else pending.reject(Object.assign(Error('denied'),{code:'E_MIC_PERMISSION'}));await enabling;assert.deepEqual(backgrounds,[]);b.emit('document:resume');b.root.document.hidden=false;b.emit('document:visibilitychange');assert.equal(c.deferLifecycle('pause'),false);assert.equal(c.snapshot().phase,'joined');assert.equal(c.snapshot().microphone,granted);
 // Once permission is over, normal background behavior immediately applies.
 b.emit('document:pause');await flush();assert.equal(backgrounds.length,1);assert.equal(c.snapshot().phase,'idle');assert.equal(c.snapshot().microphone,false);
});
for(const game of ['majabeed','sakka'])for(const trigger of ['native-background','rtc-failure','pagehide'])test(`${game} ${trigger} forces real game cleanup during the permission prompt`,async()=>{
 const b=browser({config:enabled}),backgrounds=installGameLifecycle(b,game),c=await joinRuntime(b,game),pending=deferred();b.bridge.getMicrophonePermission=async()=>({granted:false});b.bridge.setMicrophone=()=>pending.promise;
 const enabling=c.microphone(true);await flush();b.emit('document:pause');assert.deepEqual(backgrounds,[]);const nativeSession=b.calls.findLast(x=>x[0]==='join')[1].sessionId;
 if(trigger==='pagehide')b.emit('window:pagehide');else b.bridge.event({type:trigger==='rtc-failure'?'error':'interrupted',reason:'background',sessionId:nativeSession});
 assert.ok(backgrounds.length>0);assert.equal(c.snapshot().phase,'idle');assert.ok(b.calls.some(x=>x[0]==='cancel'));pending.resolve({});assert.equal(await enabling,false);await flush();assert.equal(c.deferLifecycle('pause'),false);
});
for(const game of ['majabeed','sakka'])test(`${game} forced cleanup ignores identities from a previous room or account`,async()=>{
 const b=browser({config:enabled}),backgrounds=installGameLifecycle(b,game);await joinRuntime(b,game);
 for(const detail of [{game,roomId:'old-room',accountId:'account-A'},{game,roomId:'friendly-room',accountId:'old-account'},{game:game==='sakka'?'majabeed':'sakka',roomId:'friendly-room',accountId:'account-A'}])b.root.dispatchEvent(new b.root.CustomEvent('mj-voice-background',{detail}));
 assert.deepEqual(backgrounds,[]);assert.equal(b.controller().snapshot().phase,'joined');
});

for(const game of ['majabeed','sakka'])for(const hidden of ['hidden','class','absent'])test(`${game} hidden lobby (${hidden}) disconnects audio and cannot resurrect from stale render`,async()=>{
 const b=browser({config:enabled}),c=await joinRuntime(b,game),table=b.nodes.get(game==='majabeed'?'onl':'blGame');await c.microphone(true);
 if(hidden==='hidden')table.hidden=true;else if(hidden==='class')table.classList.add('hidden');else b.nodes.delete(table.id);
 if(game==='majabeed')b.sync();else b.root.MajabeedFriendlyVoice.syncSakka({room:'friendly-room',mode:'friendly',me:0,seats:[{uid:'account-A'}]},true);
 assert.equal(c.snapshot().context,null);assert.equal(c.snapshot().microphone,false);assert.equal(b.shown(),false);await flush();assert.ok(b.calls.some(x=>x[0]==='cancel'));assert.equal(c.snapshot().context,null);
});
for(const phase of ['status','join'])test('late '+phase+' response after lobby exit cannot restore the toolbar or native channel',async()=>{
 const pending=deferred(),b=browser({config:enabled,response:(url,options,status)=>new URL(url).pathname.endsWith('/'+phase)?pending.promise:Promise.resolve({ok:true,status:200,json:async()=>status})});
 b.sync();await flush();const c=b.controller();let joining;if(phase==='join'){c.acceptRules();joining=c.join();await flush();}
 b.nodes.get('onl').classList.add('hidden');b.sync();assert.equal(c.snapshot().context,null);
 pending.resolve({ok:true,status:200,json:async()=>({...b.status,appId:'a'.repeat(32),channel:'voice-room',uid:1,token:'007-fixture',expiresAt:Date.now()+180000})});if(joining)assert.equal(await joining,false);await flush();
 assert.equal(c.snapshot().context,null);assert.equal(b.shown(),false);assert.equal(b.calls.some(x=>x[0]==='join'),false);if(phase==='join')assert.equal(b.requests.filter(x=>x.url.endsWith('/leave')).length,1);
});
test('central game transport disconnect cancels voice immediately and invalidates late voice callbacks',async()=>{
 const b=browser({config:enabled}),c=await joinRuntime(b,'majabeed'),s=b.sandbox,noop=()=>{};await c.microphone(true);
 const recovery=b.root.document.createElement('section');recovery.id='uiOnlineReconnect';b.root.document.body.append(recovery);
 Object.assign(s,{ONL:{generation:1,pollGen:1,joinTimer:s.setTimeout(noop,15000),reconnectTimer:s.setTimeout(noop,1200),reconnectUntil:40000,reconnectAttempts:2},clearInterval:noop,uiOnlineEntryClear:noop,uiStopVoices:noop,uiFinishSpectatorJoin:noop,uiWalletSyncStop:noop});
 const src=fs.readFileSync(path.join(__dirname,'../www/game-core.js'),'utf8');vm.runInContext(src.slice(src.indexOf('function oReconnectClear(){'),src.indexOf('function oArmJoinDeadline('))+src.slice(src.indexOf('function oDisconnectTransport(){'),src.indexOf('function oToast(')),s);s.oDisconnectTransport();
 assert.equal(s.ONL.joinTimer,null);assert.equal(s.ONL.reconnectTimer,null);assert.equal(s.ONL.reconnectUntil,0);assert.equal(b.nodes.has('uiOnlineReconnect'),false);
 assert.equal(c.snapshot().context,null);assert.equal(c.snapshot().microphone,false);assert.ok(b.calls.some(x=>x[0]==='cancel'));await flush();assert.equal(b.shown(),false);
});
test('home navigation disconnects voice before the animated navigation callback runs',async()=>{
 const b=browser({config:enabled}),c=await joinRuntime(b,'majabeed'),s=b.sandbox;await c.microphone(true);let transition;
 Object.assign(s,{goHome:()=>{},transitionTo:(_,fn)=>{transition=fn;}});
 const src=fs.readFileSync(path.join(__dirname,'../www/ui-baloot.js'),'utf8'),start=src.indexOf('  const oldHome=goHome;');vm.runInContext(src.slice(start,src.indexOf('\n',start)),s);s.goHome();assert.equal(typeof transition,'function');assert.equal(c.snapshot().context,null);assert.ok(b.calls.some(x=>x[0]==='cancel'));await flush();assert.equal(b.shown(),false);
});
test('Sakka leave request immediately removes audio before server acknowledgement and subsequent state cannot resync it',async()=>{
 const b=browser({config:enabled}),c=await joinRuntime(b,'sakka'),s=b.sandbox,noop=()=>{};await c.microphone(true);
 Object.assign(s,{B:{room:{ready:true,closed:false,ws:{readyState:1}}},closeModal:noop,beginLoad:noop,sendRoom:()=>true});
 const src=fs.readFileSync(path.join(__dirname,'../www/ui-baloot.js'),'utf8'),start=src.indexOf(' function requestLeave(){');vm.runInContext(src.slice(start,src.indexOf(' function connection()',start)),s);s.requestLeave();assert.equal(s.B.leaving,true);assert.equal(c.snapshot().context,null);
 s.m=s.d={room:'friendly-room',mode:'friendly',me:0,seats:[{uid:'account-A'}]};const calls=src.match(/window\.MajabeedFriendlyVoice\?\.syncSakka\([md],[^;]+\)/g);assert.equal(calls.length,3);for(const call of calls)vm.runInContext(call,s);
 await flush();assert.equal(c.snapshot().context,null);assert.equal(b.shown(),false);assert.ok(b.calls.some(x=>x[0]==='cancel'));
});
for(const game of ['majabeed','sakka'])test(`${game} voice survives an obsolete render of the other hidden game`,async()=>{
 const b=browser({config:enabled}),c=await joinRuntime(b,game);await c.microphone(true);const cancelled=b.calls.filter(x=>x[0]==='cancel').length;
 if(game==='sakka'){b.nodes.get('onl').classList.add('hidden');b.sync();}else {b.nodes.get('blGame').hidden=true;b.root.MajabeedFriendlyVoice.syncSakka({room:'old-room',mode:'friendly',me:0,seats:[{uid:'account-A'}]},true);}
 assert.equal(c.snapshot().context.game,game);assert.equal(c.snapshot().phase,'joined');assert.equal(c.snapshot().microphone,true);assert.equal(b.calls.filter(x=>x[0]==='cancel').length,cancelled);
});
