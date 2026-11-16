import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource} from './helpers/source.mjs';
const source=coreSource(),flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function cut(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
function fixture(){
 const timers=new Map(),nodes=new Map(),calls={connect:0,poll:0,leave:0};let serial=0;
 function node(id){if(nodes.has(id))return nodes.get(id);const classes=new Set(),children=new Map();const e={id,style:{},textContent:'',dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},setAttribute(){},querySelector:s=>{if(!children.has(s))children.set(s,node(id+s));return children.get(s);},appendChild:el=>{el.parentNode=e;nodes.set(el.id,el);},remove(){nodes.delete(this.id);}};nodes.set(id,e);return e;}
 const ONL={active:true,status:null,stateReady:false,generation:1,room:'room',transport:'ws',ws:null,pollGen:0},user={uid:'alice',getIdToken:async()=> 'token'};
 node('onl');
 const c=vm.createContext({window:{},ONL,FB:{user,authReadyPromise:Promise.resolve()},Promise,AbortController,URLSearchParams,JSON,Error,document:{getElementById:id=>nodes.get(id)||null,createElement:()=>node('new-'+(++serial))},$:s=>node(s.slice(1)),
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),clearInterval(){},
  oConnect:()=>calls.connect++,switchToPoll:async()=>{calls.poll++;ONL.transport='poll';},leaveOnline:()=>calls.leave++,uiStopVoices(){},uiFinishSpectatorJoin(){},uiWalletSyncStop(){},
  fetch:async()=>({ok:true,json:async()=>({ok:true})})});
 vm.runInContext(cut('function oSessionCurrent(','function oToast(')+cut('async function uiBoundedIdToken(','// ===== إعداد خادم الطاولات =====')+cut('function oWatchQuery(','async function oPost('),c);
 const fire=ms=>{const entry=[...timers].find(([,x])=>x.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();};
 return {c,ONL,user,nodes,node,timers,calls,fire};
}
test('entry tries polling and presents retry/home instead of revealing an empty lobby',async()=>{
 const f=fixture();f.c.uiOnlineEntryBegin(1,'room');f.fire(7000);await flush();assert.equal(f.calls.poll,1);f.fire(18000);
 assert.ok(f.node('onlWait').classList.contains('hidden'));assert.ok(f.node('pageLoader').classList.contains('hidden'));assert.ok(f.nodes.has('uiOnlineEntryError'));
 const panel=f.nodes.get('uiOnlineEntryError');panel.querySelector('[data-entry-retry]').onclick();assert.equal(f.calls.connect,1);assert.equal(f.nodes.has('uiOnlineEntryError'),false);assert.equal(f.ONL.transport,'ws');
 f.fire(18000);f.nodes.get('uiOnlineEntryError').querySelector('[data-entry-back]').onclick();assert.equal(f.calls.leave,1);
});
test('entry recovery ignores old-room timers and never replaces an admitted match',()=>{
 const f=fixture();f.c.uiOnlineEntryBegin(1,'room');f.ONL.generation++;f.fire(7000);f.fire(18000);assert.equal(f.calls.poll,0);assert.equal(f.nodes.has('uiOnlineEntryError'),false);
 f.ONL.status='playing';f.ONL.stateReady=true;assert.equal(f.c.uiOnlineEntryFailed('late error'),false);assert.equal(f.nodes.has('uiOnlineEntryError'),false);
});
test('authentication and HTTP body stalls have bounded deadlines even if abort is ignored',async()=>{
 const f=fixture();f.user.getIdToken=()=>new Promise(()=>{});const token=f.c.uiBoundedIdToken(f.user);const rejected=assert.rejects(token,/auth-timeout/);await flush();f.fire(6000);await rejected;
 f.c.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})});const http=f.c.uiOnlineJSON('https://test'),failed=assert.rejects(http,/table-timeout/);await flush();f.fire(12000);await failed;
});
test('account changes invalidate delayed tokens and signed-out guests remain explicit',async()=>{
 const f=fixture();let resolve;f.user.getIdToken=()=>new Promise(r=>resolve=r);const token=f.c.uiBoundedIdToken(f.user),failed=assert.rejects(token,/auth-changed/);await flush();f.c.FB.user={uid:'bob'};resolve('old-token');await failed;
 f.c.FB.user=null;assert.equal((await f.c.withIdToken({type:'join'})).idToken,null);
});
test('only an explicit Cup watch uses the spectator polling query',()=>{
 const f=fixture();f.ONL.room='cm-match';f.ONL.spectateOnly=true;assert.equal(f.c.oWatchQuery(),'&spectate=1');f.ONL.spectateOnly=false;assert.equal(f.c.oWatchQuery(),'');f.ONL.room='friendly';f.ONL.spectateOnly=true;assert.equal(f.c.oWatchQuery(),'');
});
test('an empty server lobby cannot complete entry or replace the recovery view',()=>{
 const f=fixture();vm.runInContext(cut('function oHandle(msg){','function oConnect(){'),f.c);
 f.c.oHandle({type:'state',status:'lobby',seats:[],lobby:{names:{}}});
 assert.equal(f.ONL.stateReady,false);assert.equal(f.ONL.status,null);assert.ok(f.nodes.has('uiOnlineEntryError'));assert.ok(f.node('onlWait').classList.contains('hidden'));
});
test('Cup token renewal preserves spectator intent and ignores stale room authentication',async()=>{
 const f=fixture(),sent=[];let listener,resolve;
 f.c.FB.auth={onIdTokenChanged:fn=>listener=fn};f.c.oSend=msg=>sent.push(msg);
 const start=source.indexOf('  FB.auth.onIdTokenChanged(async(user)=>{'),end=source.indexOf('\n  });',start)+6;assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),f.c);
 f.ONL.spectateOnly=true;await listener(f.user);assert.equal(sent[0].spectate,true);assert.equal(sent[0].type,'auth');
 f.user.getIdToken=()=>new Promise(r=>resolve=r);const pending=listener(f.user);await flush();f.ONL.generation++;resolve('stale');await pending;assert.equal(sent.length,1);
});
test('late polling and POST states are discarded after an account switch',async()=>{
 for(const poll of [false,true]){
  const f=fixture();let resolve,handled=0;
  Object.assign(f.c,{oBase:()=> 'https://test/ws/room',oHandle:()=>handled++,uiConnectionMessage(){},uiSpectatorJoinPending:()=>false,document:{...f.c.document,addEventListener(){},hidden:false},ONL:f.ONL});
  f.ONL.pid='p-alice';f.ONL.pollSeq=0;f.ONL.transport='poll';
  vm.runInContext(cut(poll?'async function oPollLoop(){':'async function oPost(obj){',poll?'async function switchToPoll(){':'async function oPollLoop(){'),f.c);
  f.c.uiOnlineJSON=()=>new Promise(r=>resolve=r);
  const pending=poll?f.c.oPollLoop():f.c.oPost({type:'join'});await flush();assert.ok(resolve);
  f.c.FB.user={uid:'bob'};resolve(poll?{seq:1,msg:{type:'state',status:'playing'}}:{type:'state',status:'playing'});await pending;
  assert.equal(handled,0);assert.equal(f.ONL.pollSeq,0);
 }
});
test('poll fallback cannot send a join prepared for a previous account',async()=>{
 const f=fixture();let resolve,sent=0;f.ONL.queue=[];
 Object.assign(f.c,{withIdToken:()=>new Promise(r=>resolve=r),myAvatar:()=>'',localStorage:{getItem:()=>''},window:{},oPost:async()=>sent++,oPollLoop:()=>sent++});
 vm.runInContext(cut('async function switchToPoll(){','function oAction(a){'),f.c);
 const pending=f.c.switchToPoll();await flush();f.c.FB.user={uid:'bob'};resolve({type:'join',idToken:'alice-token'});await pending;assert.equal(sent,0);
});
test('fee recovery stays outside the hidden hand hint and clears on confirmation or leave',()=>{
 const f=fixture();let retries=0;f.c.uiRequestWalletSync=()=>retries++;f.node('oHint').style.display='none';f.ONL.paymentPending=true;
 f.c.uiRenderOnlineFeePending();const card=f.nodes.get('uiOnlineFeePending');assert.equal(card.parentNode,f.node('onl'));card.querySelector('button').onclick();assert.equal(retries,1);assert.equal(f.node('oThrow').disabled,true);
 f.ONL.paymentPending=false;f.c.uiRenderOnlineFeePending();assert.equal(f.nodes.has('uiOnlineFeePending'),false);
 f.ONL.paymentPending=true;f.c.uiRenderOnlineFeePending();f.c.oDisconnectTransport();assert.equal(f.nodes.has('uiOnlineFeePending'),false);
});
test('the Cup result exit returns a spectator home but keeps participant Cup navigation',()=>{
 for(const watching of [true,false]){
  const f=fixture();let cup=0;Object.assign(f.c,{window:{MajabeedRanked:{returnMode:()=>null}},uiCupOpen:()=>cup++});f.ONL.cup={match:'cm-watch'};f.ONL.spectateOnly=watching;f.ONL.view={viewerStatus:watching?'spectator':'seated'};
  const start=source.indexOf("$('#oMenu').onclick="),end=source.indexOf('\n',start);assert.ok(start>=0);vm.runInContext(source.slice(start,end),f.c);f.node('oMenu').onclick();assert.equal(f.calls.leave,1);assert.equal(cup,watching?0:1);
 }
});
