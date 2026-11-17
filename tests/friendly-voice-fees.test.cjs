'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../www/ui-friendly-voice.js'),'utf8');
const flush=async()=>{for(let i=0;i<90;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const quote=(extra={})=>({version:1,quoteId:'server-quote-1',amount:800,total:800,paid:false,status:'ready',canConfirm:true,...extra});
function fixture({fee=quote(),game='majabeed',owner=true,response}={}){
 const nodes=new Map(),requests=[],native=[],timers=new Map(),events=new Map();let timerId=0,token=async()=> 'offline-token';
 const listen=(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]);
 const node=tag=>({tag,dataset:{},children:[],classList:{add(){},remove(){},contains(){return false;},toggle(){}},parentElement:null,isConnected:false,firstChild:null,hidden:false,
  setAttribute(){},removeAttribute(){},addEventListener(name,fn){this['on'+name]=fn;},getClientRects(){return [{}];},closest(){return null;},querySelector(){return null;},querySelectorAll(){return [];},contains(){return false;},focus(){},
  append(child){this.children.push(child);child.parentElement=this;child.isConnected=true;nodes.set(child.id,child);},remove(){this.isConnected=false;nodes.delete(this.id);},get innerHTML(){return this._html||'';},set innerHTML(value){this._html=value;this.firstChild=value?{}:null;}});
 const frame=node('main');frame.id='frame';frame.isConnected=true;nodes.set('frame',frame);
 for(const id of ['onl','blGame','oActions']){const n=node('div');n.id=id;frame.append(n);}
 const document={body:frame,hidden:false,activeElement:null,getElementById:id=>nodes.get(id)||null,createElement:node,querySelector:selector=>selector.includes('#oActions')||selector.includes('.blActions')?nodes.get('oActions'):null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listen(name,fn)};
 const bridge={addListener:async()=>({remove(){}}),getMicrophonePermission:async()=>({granted:true})};for(const method of ['join','leave','cancel','setMicrophone','setPlayback','muteParticipant','renewToken'])bridge[method]=async body=>native.push({method,body});
 const state={ok:true,available:true,enabled:false,sessionId:'voice-session',canManage:owner,participants:[{playerId:game==='sakka'?'account-A':'p-A',uid:1,name:'سامي',joined:false},{playerId:'p-B',uid:2,name:'علي',joined:false}],...(fee===null?{}:{voiceFee:fee})};
 const user={uid:'account-A',getIdToken:()=>token()},root={document,FB:{user},MJ_FRIENDLY_VOICE_CONFIG:{enabled:true,endpoint:'https://voice.invalid'},crypto:{randomUUID:()=> 'fixture-id'},Capacitor:{isPluginAvailable:()=>true,Plugins:{FriendlyVoice:bridge}},addEventListener:listen,dispatchEvent(){},CustomEvent:class{}};
 const sandbox={window:root,document,FB:root.FB,URL,AbortController,console,setInterval:()=>0,setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),fetch:async(url,options)=>{
  const action=new URL(url).pathname.split('/').at(-1),body=JSON.parse(options.body);requests.push({action,body});if(response){const r=await response(action,body,state);if(r)return r;}
  if(action==='settings'){state.enabled=body.enabled;if(body.feeConfirmation)state.voiceFee=quote({paid:true,status:'paid',amount:0});}
  return {ok:true,status:200,json:async()=>['join','renew'].includes(action)?{...state,appId:'a'.repeat(32),channel:'fixture',uid:1,token:'offline-lease',expiresAt:Date.now()+180000}:state};
 }};
 vm.runInNewContext(source,sandbox);const sync=(room='friendly-room')=>game==='sakka'?root.MajabeedFriendlyVoice.syncSakka({mode:'friendly',room,me:0,seats:[{uid:'account-A'}]},true):root.MajabeedFriendlyVoice.syncMajabeed({active:true,room,you:'p-A',seats:['p-A','p-B'],stateReady:true});
 const click=action=>{const host=nodes.get(action==='panel'?'mjFriendlyVoice':'mjVoicePanel')||nodes.get('mjFriendlyVoice'),button={dataset:{voice:action},disabled:false,focus(){}};host.onclick({target:{closest:()=>button},preventDefault(){},stopPropagation(){}});};
 return {root,state,requests,native,bridge,nodes,timers,sync,click,controller:()=>root.MajabeedFriendlyVoice.getController(),html:()=>nodes.get('mjVoicePanel')?.innerHTML||'',setToken:fn=>token=fn,emit:name=>(events.get(name)||[]).forEach(fn=>fn())};
}
async function open(options){const b=fixture(options);b.sync();await flush();b.click('panel');return b;}
const settings=b=>b.requests.filter(r=>r.action==='settings');

test('owner sees actual 800 total before explicit confirmation; opening, rule consent and joining do not pay',async()=>{
 const b=await open();assert.match(b.html(),/800/);assert.match(b.html(),/تأكيد التفعيل مقابل 800 ذهب/);assert.match(b.html(),/تشمل مقعدك/);assert.equal(settings(b).length,0);b.click('accept');b.click('join');await flush();assert.equal(settings(b).length,0);assert.equal(b.native.some(x=>x.method==='join'),false);
 b.click('fee-confirm');await flush();assert.equal(settings(b).length,1);assert.deepEqual(settings(b)[0].body,{game:'majabeed',roomId:'friendly-room',enabled:true,feeConfirmation:{version:1,quoteId:'server-quote-1',amount:800}});assert.match(b.html(),/رسوم الجلسة الصوتية مدفوعة/);assert.equal(b.native.some(x=>x.method==='getMicrophonePermission'||x.method==='setMicrophone'),false);
});
test('already paid base shows only frozen 300 upgrade and 800 total',async()=>{
 const b=await open({fee:quote({amount:300})});assert.match(b.html(),/تأكيد التفعيل مقابل 300 ذهب/);assert.match(b.html(),/800/);assert.match(b.html(),/الفرق فقط/);b.click('fee-confirm');await flush();assert.equal(settings(b)[0].body.feeConfirmation.amount,300);
});
test('zero upgrade still requires explicit consent and no assumed payment',async()=>{
 const b=await open({fee:quote({amount:0,total:0})});assert.match(b.html(),/تفعيل دون رسوم إضافية/);assert.equal(settings(b).length,0);assert.equal(await b.controller().action('settings',{enabled:true}),false);b.click('fee-confirm');await flush();assert.equal(settings(b)[0].body.feeConfirmation.amount,0);
});
test('server custom fee is rendered instead of hardcoded 800',async()=>{const b=await open({fee:quote({amount:1250,total:1250})});assert.match(b.html(),/تأكيد التفعيل مقابل 1250 ذهب/);assert.doesNotMatch(b.html(),/>800</);});
test('paid voice off/on uses existing toggle without a second fee confirmation',async()=>{
 const b=await open({fee:quote({amount:0,paid:true,status:'paid'})});b.state.enabled=true;await b.controller().refresh();b.click('settings');await flush();b.click('settings');await flush();assert.deepEqual(settings(b).map(r=>r.body.enabled),[false,true]);assert.ok(settings(b).every(r=>!r.body.feeConfirmation));
});
for(const variant of ['legacy','sakka'])test(variant+' retains free settings flow without showing new Majabeed price',async()=>{
 const b=await open(variant==='legacy'?{fee:null}:{game:'sakka'});assert.doesNotMatch(b.html(),/تأكيد رسوم|رسوم إنشاء الجلسة|800 ذهب/);b.click('settings');await flush();assert.equal(settings(b).length,1);assert.equal(settings(b)[0].body.feeConfirmation,undefined);
});
test('non-owner cannot see or submit fee confirmation',async()=>{const b=await open({owner:false});assert.doesNotMatch(b.html(),/fee-confirm|800 ذهب/);assert.equal(await b.controller().action('settings',{enabled:true,feeConfirmation:{version:1,quoteId:'server-quote-1',amount:800}}),false);assert.equal(settings(b).length,0);});
test('stale displayed quote cannot silently confirm updated price',async()=>{
 const b=await open();b.state.voiceFee=quote({quoteId:'changed',amount:900,total:900});await b.controller().refresh();assert.match(b.html(),/مراجعة السعر الحالي/);b.click('fee-confirm');await flush();assert.equal(settings(b).length,0);b.click('fee-review');b.click('fee-confirm');await flush();assert.equal(settings(b)[0].body.feeConfirmation.amount,900);
});
test('pending resolvable receipt can be retried with exact same quote',async()=>{
 const b=await open({fee:quote({status:'pending',canConfirm:true})});assert.match(b.html(),/إعادة تأكيد العملية/);b.click('fee-confirm');await flush();assert.equal(settings(b).length,1);assert.equal(settings(b)[0].body.feeConfirmation.quoteId,'server-quote-1');
});
test('pending active operation disables confirmation without relying on status alone',async()=>{
 const b=await open({fee:quote({status:'pending',canConfirm:false})});assert.match(b.html(),/data-voice="fee-confirm" disabled/);b.click('fee-confirm');await flush();assert.equal(settings(b).length,0);
});
test('double confirmation and on/off while payment request pending send one operation',async()=>{
 const wait=deferred(),b=await open({response:action=>action==='settings'?wait.promise:null});b.click('fee-confirm');await flush();b.click('fee-confirm');b.click('settings');assert.equal(await b.controller().action('settings',{enabled:false}),false);assert.equal(settings(b).length,1);wait.resolve({ok:true,status:200,json:async()=>({ok:true})});await flush();
});
for(const reason of ['leave','change-room','change-account','same-room-new-generation'])test('fee confirmation waiting for token is cancelled by '+reason,async()=>{
 const b=await open(),pending=deferred();b.setToken(()=>pending.promise);b.click('fee-confirm');await flush();
 if(reason==='leave')b.root.MajabeedFriendlyVoice.disconnect();else if(reason==='change-room')b.sync('other-room');else if(reason==='change-account')b.root.FB.user={uid:'account-B',getIdToken:async()=> 'new-token'};else {b.root.MajabeedFriendlyVoice.disconnect();b.sync();}
 pending.resolve('late-token');await flush();assert.equal(settings(b).length,0);
});
test('auth timeout releases pending and resolving old token cannot dispatch payment',async()=>{
 const b=await open(),pending=deferred();b.setToken(()=>pending.promise);b.click('fee-confirm');await flush();const timer=[...b.timers.values()].find(t=>t.ms===10000);assert.ok(timer);b.setToken(async()=> 'new-token');timer.fn();await flush();assert.equal(b.controller().snapshot().pending,false);assert.match(b.html(),/تعذّر تأكيد النتيجة/);pending.resolve('late-token');await flush();assert.equal(settings(b).length,0);
});
test('lost response refreshes paid receipt and offers no new charge',async()=>{
 const b=await open({response:(action,body,state)=>{if(action==='settings'){state.enabled=true;state.voiceFee=quote({paid:true,status:'paid',amount:0});throw Error('lost response');}}});b.click('fee-confirm');await flush();assert.equal(settings(b).length,1);assert.equal(b.controller().snapshot().voiceFee.paid,true);assert.doesNotMatch(b.html(),/data-voice="fee-confirm"/);
});
for(const code of ['VOICE_FEE_QUOTE_CHANGED','VOICE_FEE_INSUFFICIENT_GOLD','VOICE_FEE_PENDING','VOICE_FEE_CONFIRMATION_REQUIRED'])test(code+' preserves safe price confirmation and displays actionable error',async()=>{
 const b=await open({response:action=>action==='settings'?{ok:false,status:409,json:async()=>({ok:false,code})}:null});b.click('fee-confirm');await flush();assert.equal(settings(b).length,1);assert.equal(b.controller().snapshot().pending,false);assert.ok(b.controller().snapshot().error.length>10);assert.ok(b.requests.filter(r=>r.action==='status').length>=2);assert.equal(b.controller().snapshot().voiceFee.paid,false);
});
test('invalid fee metadata never creates consent or interpolates untrusted quote into markup',async()=>{
 const b=await open({fee:quote({amount:'<img src=x onerror=bad>'})});assert.match(b.html(),/تعذّر التحقق من السعر/);assert.doesNotMatch(b.html(),/<img|fee-confirm/);assert.equal(await b.controller().action('settings',{enabled:true,feeConfirmation:{version:1,quoteId:'server-quote-1',amount:800}}),false);assert.equal(settings(b).length,0);
 const parse=b.root.MajabeedVoiceCore.readVoiceFee;for(const bad of [quote({paid:false,status:'paid'}),quote({paid:true,amount:800}),quote({amount:-1}),quote({total:0}),quote({quoteId:''})])assert.equal(parse(bad).invalid,true);
});
test('permission denial after paid enable leaves fee paid and allows a later microphone retry',async()=>{
 const b=await open();b.click('fee-confirm');await flush();b.controller().acceptRules();assert.equal(await b.controller().join(),true);b.bridge.getMicrophonePermission=async()=>({granted:false});b.bridge.setMicrophone=async()=>{throw Object.assign(Error('denied'),{code:'E_MIC_PERMISSION'});};assert.equal(await b.controller().microphone(true),false);assert.equal(b.controller().snapshot().voiceFee.paid,true);assert.equal(settings(b).length,1);b.bridge.getMicrophonePermission=async()=>({granted:true});b.bridge.setMicrophone=async()=>{};assert.equal(await b.controller().microphone(true),true);assert.equal(settings(b).length,1);
});
test('4 and 6 player lobbies display paid creation separately from other player admission',()=>{
 const core=fs.readFileSync(path.join(__dirname,'../www/game-core.js'),'utf8'),six=fs.readFileSync(path.join(__dirname,'../www/ui-six-v388.js'),'utf8'),sandbox={toH:String};vm.runInNewContext(core.slice(core.indexOf('function uiFriendlyLobbyFeeText('),core.indexOf('function uiSessionFeeModel(')),sandbox);
 const paid=sandbox.uiFriendlyLobbyFeeText({creationFee:{paid:true}},{creatorFee:800,entryFee:100,winGold:250});assert.match(paid,/رسوم الإنشاء مدفوعة/);assert.match(paid,/دخول كل لاعب آخر <bdi>100<\/bdi> ذهب عند أول مشاركة/);assert.match(paid,/إعفاء مشتركي VIP/);assert.doesNotMatch(paid,/تُخصم رسوم الإنشاء عند بدء/);
 const unpaid=sandbox.uiFriendlyLobbyFeeText({creationFee:{paid:false}},{creatorFee:500,entryFee:100,winGold:250});assert.match(unpaid,/تُخصم رسوم الإنشاء عند بدء الجلسة/);assert.doesNotMatch(unpaid,/رسوم الإنشاء مدفوعة/);assert.ok(core.includes('economy.innerHTML=uiFriendlyLobbyFeeText(lb,friendlyPolicy)'));assert.ok(six.includes('economy.innerHTML=uiFriendlyLobbyFeeText(lb,friendlyPolicy)'));
});
