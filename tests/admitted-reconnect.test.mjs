import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource} from './helpers/source.mjs';
const source=coreSource(),flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
function cut(a,b){const s=source.indexOf(a),e=source.indexOf(b,s+a.length);assert.ok(s>=0&&e>s,a);return source.slice(s,e);}
function fixture(){
 let now=100000,serial=0;const jobs=new Map(),nodes=new Map(),sockets=[],requests=[],calls={poll:0,leave:0,disconnected:0,states:0};
 function node(id){if(nodes.has(id))return nodes.get(id);const children=new Map(),classes=new Set();const e={id,value:'Alice',style:{},dataset:{},textContent:'',hidden:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(){}},setAttribute(){},querySelector:s=>{if(!children.has(s))children.set(s,node(id+s));return children.get(s);},appendChild:x=>{x.parentNode=e;nodes.set(x.id,x);},remove(){nodes.delete(this.id);}};nodes.set(id,e);return e;}
 class WebSocket {constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}send(data){this.sent.push(JSON.parse(data));}close(){this.readyState=3;this.onclose?.();}async open(){this.readyState=1;await this.onopen?.();}message(msg){this.onmessage?.({data:JSON.stringify(msg)});}}
 const ONL={active:true,status:'playing',stateReady:true,generation:1,room:'cm-test',transport:'ws',pid:'alice',you:'alice',wsFails:0,queue:[],pollGen:0,pollSeq:0,namedSent:true,sessionToken:'stable-token',sessionMatch:'cm-test|1',_loaderHiddenOnce:true,view:{seats:['alice']}};
 const state={type:'state',status:'playing',you:'alice',sessionMatch:'cm-test|1',seats:['alice'],view:{names:{alice:'Alice'},seats:['alice'],humans:['alice'],me:'alice'}};
 const user={uid:'alice',getIdToken:async()=> 'valid-token'};
 const c=vm.createContext({ONL,FB:{user,authReadyPromise:Promise.resolve()},window:{UISessionReturn:{blocked:()=>false,handle:()=>false,resumeFields:()=>({token:'stable-token',match:'cm-test|1',awayId:'same-away'}),disconnected:()=>calls.disconnected++}},document:{hidden:false,getElementById:id=>nodes.get(id)||null,createElement:()=>node('new-'+(++serial))},location:{},GAME_SRV:'offline.invalid',Date:{now:()=>now},WebSocket,JSON,Promise,AbortController,URLSearchParams,Error,
  setTimeout:(fn,ms)=>{const id=++serial;jobs.set(id,{fn,at:now+ms,ms});return id;},clearTimeout:id=>jobs.delete(id),clearInterval(){},setInterval:()=>++serial,$:s=>node(s.slice(1)),localStorage:{getItem:()=>''},onSrvHost:()=>false,myAvatar:()=>'',
  oPollLoop:()=>calls.poll++,oBase:()=> 'https://offline.invalid/ws/'+ONL.room,oToast(){},uiConnectionMessage:()=>false,uiSpectatorJoinPending:()=>false,uiFinishSpectatorJoin(){},uiSessionStartFailed(){},uiStopVoices(){},uiWalletSyncStop(){},uiConnectionPaint(){},uiConnectionStart(){},uiFriendlyStateContext(){},uiSyncSpectatorJoin(){},esc:x=>x,uiSessionHandleReceipt(){},uiSessionReturnConfigure(){},renderOnl:()=>calls.states++,MATCH:{on:false},uiWalletSyncPlan(){},leaveOnline:()=>calls.leave++,
  fetch:async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});return {ok:true,json:async()=>state};}});
 node('onl');
 vm.runInContext(cut('function oSessionCurrent(','function oToast(')+cut('async function uiBoundedIdToken(','// ===== إعداد خادم الطاولات =====')+cut('function oWatchQuery(','async function oPollLoop(){')+cut('async function switchToPoll(){','function oAction(a){')+cut('function oHandle(msg){','function oReceiveChat('),c);
 function fire(ms){const entry=[...jobs].find(([,j])=>j.ms===ms);assert.ok(entry,'missing timer '+ms);jobs.delete(entry[0]);now=entry[1].at;entry[1].fn();}
 return {c,ONL,user,jobs,nodes,node,sockets,requests,calls,state,fire,get now(){return now;},set now(v){now=v;},async start(){c.oConnect();await sockets.at(-1).open();await flush();},panel:()=>nodes.get('uiOnlineReconnect'),retry:()=>nodes.get('uiOnlineReconnect')?.querySelector('button')};
}

test('transient token failure closes an unjoined socket and retries with unchanged return identity',async()=>{
 const f=fixture();f.user.getIdToken=async()=>{throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});};await f.start();
 assert.equal(f.sockets[0].readyState,3);assert.equal(f.sockets[0].sent.length,0);assert.equal(f.ONL.stateReady,false);assert.ok(f.panel());assert.equal(f.calls.leave,0);
 f.user.getIdToken=async()=> 'renewed';f.fire(1200);await f.sockets.at(-1).open();
 const join=f.sockets.at(-1).sent[0];assert.equal(join.type,'join');assert.equal(join.playerId,'alice');assert.equal(join.sessionToken,'stable-token');assert.deepEqual(join.sessionResume,{token:'stable-token',match:'cm-test|1',awayId:'same-away'});
 f.sockets.at(-1).message(f.state);assert.equal(f.ONL.stateReady,true);assert.equal(f.ONL.wsFails,0);assert.equal(f.panel(),undefined);assert.equal(f.ONL.reconnectAttempts,0);assert.equal(f.ONL.joinTimer,null);
});
test('open socket without a state has a bounded handshake and does not reset failures',async()=>{
 const f=fixture();f.ONL.wsFails=1;await f.start();assert.equal(f.ONL.wsFails,1);f.fire(15000);assert.equal(f.sockets[0].readyState,3);assert.equal(f.ONL.wsFails,2);assert.equal(f.calls.leave,0);assert.equal(f.retry().hidden,true);
});
test('two failed WebSockets fall back to authenticated HTTP and preserve queued messages',async()=>{
 const f=fixture();f.ONL.queue.push({type:'chat',text:'hello'});f.c.oConnect();f.sockets[0].close();f.fire(1200);f.sockets[1].close();f.fire(2500);await flush();await flush();
 assert.equal(f.ONL.transport,'poll');assert.equal(f.calls.poll,1);assert.equal(f.ONL.stateReady,true);assert.deepEqual(f.requests.map(r=>r.body.type),['join','chat']);assert.equal(f.requests[0].body.idToken,'valid-token');assert.equal(f.requests[0].body.sessionResume.awayId,'same-away');assert.equal(f.calls.leave,0);
});
test('real HTTP contract accepts a join acknowledgement then obtains state from the polling envelope',async()=>{
 const f=fixture();let gets=0;f.c.document.addEventListener=()=>{};
 f.c.fetch=async(url,options={})=>{if(options.method==='POST'){f.requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true,seq:5})};}gets++;return {ok:true,json:async()=>({seq:6,msg:f.state})};};
 vm.runInContext(cut('async function oPollLoop(){','async function switchToPoll(){'),f.c);
 await f.c.switchToPoll();await flush();await flush();
 assert.equal(f.requests[0].body.type,'join');assert.equal(gets,1);assert.equal(f.ONL.stateReady,true);assert.equal(f.ONL.pollSeq,6);assert.equal(f.ONL.reconnectTimer,null);assert.equal(f.panel(),undefined);assert.equal(f.calls.leave,0);
});
for(const [label,response] of [['negative acknowledgement',{ok:false}],['join rejection',{type:'error',error:'يلزم تسجيل الدخول'}],['lease rejection',{type:'sessionReturnRejected',error:'انتهت مهلة العودة'}]])test('HTTP '+label+' cannot complete admission or flush the queue',async()=>{
 const f=fixture();f.ONL.queue.push({type:'sync'});f.c.fetch=async()=>({ok:true,json:async()=>response});await f.c.switchToPoll();assert.equal(f.ONL.stateReady,false);assert.equal(f.calls.poll,0);assert.equal(f.ONL.queue.length,1);assert.ok(f.panel());assert.equal(f.calls.leave,0);if(response.type)assert.equal(f.ONL.reconnectTimer,null);
});
test('poll token failure schedules recovery without starting an unauthenticated poll loop',async()=>{
 const f=fixture();f.user.getIdToken=async()=>{throw Error('network');};await f.c.switchToPoll();assert.equal(f.calls.poll,0);assert.equal(f.requests.length,0);assert.ok(f.panel());assert.equal(f.retry().hidden,true);assert.equal(f.calls.leave,0);
});
for(const failure of ['network','bad-json','http-503'])test('HTTP join '+failure+' is retried without flushing queued actions',async()=>{
 const f=fixture();f.ONL.queue.push({type:'action',action:{t:'pass'}});f.c.fetch=async()=>{if(failure==='network')throw Error('offline');return {ok:failure!=='http-503',status:503,json:async()=>{throw SyntaxError('bad JSON');}};};await f.c.switchToPoll();
 assert.equal(f.calls.poll,0);assert.equal(f.ONL.queue.length,1);assert.equal(f.retry().hidden,true);assert.equal(f.calls.leave,0);
});
for(const status of [401,403])test('HTTP '+status+' is an authorization rejection, not an automatic reconnect loop',async()=>{
 const f=fixture();f.c.fetch=async()=>({ok:false,status});await f.c.switchToPoll();assert.equal(f.calls.poll,0);assert.equal(f.retry().hidden,false);assert.equal(f.ONL.reconnectTimer,null);assert.equal(f.calls.leave,0);
 f.c.fetch=async()=>({ok:true,json:async()=>f.state});f.retry().onclick();await f.sockets.at(-1).open();f.sockets.at(-1).message(f.state);assert.equal(f.ONL.stateReady,true);
});
test('a permanent Firebase token rejection stops automatic retry and is never serialized',async()=>{
 const f=fixture();f.user.getIdToken=async()=>{throw Object.assign(Error('disabled'),{code:'auth/user-disabled'});};await f.start();assert.equal(f.retry().hidden,false);assert.equal(f.ONL.reconnectTimer,null);const payload=await f.c.withIdToken({type:'join'});assert.equal(payload.authRetryable,false);assert.equal(JSON.stringify(payload).includes('authRetryable'),false);assert.equal(f.calls.leave,0);
});
test('explicit server join rejection shows its reason and permits a deliberate retry',async()=>{
 const f=fixture();await f.start();f.sockets[0].message({type:'error',error:'المقعد غير متاح'});assert.equal(f.retry().hidden,false);assert.equal(f.panel().querySelector('p').textContent,'المقعد غير متاح');assert.equal(f.ONL.reconnectTimer,null);f.retry().onclick();assert.equal(f.sockets.length,2);assert.equal(f.calls.leave,0);
});
test('a rejected spectator seat request still releases its pending UI',async()=>{
 const f=fixture();let finished;f.c.uiSpectatorJoinPending=()=>true;f.c.uiFinishSpectatorJoin=reason=>finished=reason;f.c.fetch=async()=>({ok:true,json:async()=>({type:'error',error:'المقعد ممتلئ'})});const result=await f.c.oPost({type:'join'});assert.equal(finished,'المقعد ممتلئ');assert.equal(result.retry,false);assert.equal(f.calls.leave,0);
});
test('automatic reconnect stops after three retries without sending leave or changing the fixed lease',async()=>{
 const f=fixture();f.user.getIdToken=async()=>{throw Error('offline');};await f.start();const until=f.ONL.reconnectUntil;
 f.fire(1200);await f.sockets.at(-1).open();f.fire(2500);await flush();f.fire(5000);await flush();
 assert.equal(f.ONL.reconnectAttempts,4);assert.equal(f.ONL.reconnectUntil,until);assert.equal(f.ONL.reconnectTimer,null);assert.equal(f.retry().hidden,false);assert.equal(f.ONL.sessionToken,'stable-token');assert.equal(f.ONL.sessionMatch,'cm-test|1');assert.equal(f.calls.leave,0);
});
test('the whole automatic recovery budget includes token stalls and stops within forty seconds',async()=>{
 const f=fixture();f.c.withIdToken=()=>new Promise(()=>{});f.c.oConnect();void f.sockets[0].open();const until=f.ONL.reconnectUntil;f.fire(15000);f.fire(1200);void f.sockets[1].open();f.fire(15000);f.fire(2500);await flush();
 const remaining=until-f.now;assert.equal(remaining,6300);f.fire(remaining);assert.equal(f.now,until);assert.equal(f.ONL.reconnectTimer,null);assert.equal(f.retry().hidden,false);assert.equal(f.calls.leave,0);
});
test('late HTTP join cannot overwrite a newer recovery attempt',async()=>{
 const f=fixture();let resolve;f.c.fetch=()=>new Promise(r=>resolve=r);const pending=f.c.switchToPoll();await flush();f.fire(15000);resolve({ok:true,json:async()=>f.state});await pending;assert.equal(f.ONL.stateReady,false);assert.equal(f.calls.states,0);assert.equal(f.calls.poll,0);assert.ok(f.panel());
});
test('a late HTTP action state cannot cancel the recovery of a newer connection',async()=>{
 const f=fixture();let resolve;f.c.fetch=()=>new Promise(r=>resolve=r);const pending=f.c.oPost({type:'action',action:{t:'pass'}});await flush();f.c.oReconnectJoinFailed();resolve({ok:true,json:async()=>f.state});await pending;assert.equal(f.ONL.stateReady,false);assert.equal(f.calls.states,0);assert.ok(f.panel());assert.ok(f.ONL.reconnectTimer);
});
test('old displayed cards cannot send a new action before admission is restored; sync waits in the queue',async()=>{
 const f=fixture();f.c.uiOnlineCanPlay=()=>true;vm.runInContext(cut('function oSend(obj){','// يرفق idToken')+cut('function oAction(a){','function enterOnline('),f.c);f.ONL.transport='poll';f.ONL.stateReady=false;f.c.oAction({t:'pass'});f.c.oSend({type:'sync'});await flush();assert.equal(f.requests.length,0);assert.deepEqual(JSON.parse(JSON.stringify(f.ONL.queue)),[{type:'sync'}]);assert.equal(f.ONL.lastSent,undefined);
});
for(const change of ['account','room','generation','leave'])test('scheduled reconnect is discarded after '+change+' changes',async()=>{
 const f=fixture();f.c.oConnect();f.sockets[0].close();if(change==='account')f.c.FB.user={uid:'bob'};if(change==='room')f.ONL.room='different';if(change==='generation')f.ONL.generation++;if(change==='leave')f.ONL.active=false;f.fire(1200);assert.equal(f.sockets.length,1);assert.equal(f.calls.poll,0);assert.equal(f.calls.leave,0);
});
test('late token acquisition after timeout cannot send a stale join',async()=>{
 const f=fixture();let resolve;f.c.withIdToken=()=>new Promise(r=>resolve=r);f.c.oConnect();const pending=f.sockets[0].open();f.fire(15000);resolve({type:'join',idToken:'late'});await pending;assert.equal(f.sockets[0].sent.length,0);assert.equal(f.ONL.stateReady,false);
});
test('spectator recovery preserves watch intent and does not claim a player seat',async()=>{
 const f=fixture();f.ONL.spectateOnly=true;f.c.oConnect();f.sockets[0].close();f.fire(1200);f.sockets[1].close();f.fire(2500);await flush();assert.equal(f.requests[0].body.spectate,true);assert.match(f.requests[0].url,/spectate=1/);assert.equal(f.calls.leave,0);
});
test('a new explicit Return request can retry after the automatic budget, without changing session identity',async()=>{
 const f=fixture();let adapter;f.c.window.UISessionReturn.configure=(_,a)=>adapter=a;f.c.uiSessionReturnIdentity=()=>({uid:'alice'});vm.runInContext(cut('function uiSessionReturnConfigure(){','function uiConnectionMessage('),f.c);f.c.uiSessionReturnConfigure();
 f.ONL.reconnectAttempts=4;f.ONL.reconnectUntil=f.now-1;f.ONL.stateReady=false;f.ONL.transport='poll';adapter.reconnect();await flush();assert.equal(f.ONL.stateReady,true);assert.equal(f.requests[0].body.sessionResume.awayId,'same-away');assert.equal(f.calls.leave,0);
});
test('leaving clears handshake/recovery timers and the recovery card',async()=>{
 const f=fixture();f.c.oConnect();f.sockets[0].close();assert.ok(f.panel());f.c.oDisconnectTransport();assert.equal(f.panel(),undefined);assert.equal(f.ONL.joinTimer,null);assert.equal(f.ONL.reconnectTimer,null);assert.equal(f.ONL.reconnectUntil,0);
});
