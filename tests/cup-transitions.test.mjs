import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webSource} from './helpers/source.mjs';

const source=webSource('ui-cup.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const data=()=>({ok:true,rules:{},profile:{uid:'alice'},entry:{price:0,freeAvailable:true},progress:{status:'idle'},search:null,assignment:null,serverNow:Date.now()});
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function fixture(){
 const timers=new Map(),elements=new Map();let serial=0;
 const element=()=>({dataset:{},classList:{toggle(){},contains:()=>false},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},querySelectorAll:()=>[],querySelector:()=>({focus(){}}),focus(){},innerHTML:'',textContent:''});
 for(const id of ['majabeedCup','mcMessage','mcBody','mcFooter'])elements.set(id,element());
 const document={hidden:false,documentElement:element(),body:element(),getElementById:id=>elements.get(id)||null,addEventListener(){},querySelector:()=>null};
 const context={window:{addEventListener(){},scrollTo(){},MajabeedBaloot:{state:{selected:'majabeed'}}},document,FB:{user:null},ONL:{active:false},GAME_SRV:'test',AbortController,URL,history:{replaceState(){}},location:{href:'https://test/'},crypto:{randomUUID:()=>String(++serial).padStart(12,'0')},fetch:async()=>({ok:true,json:async()=>data()}),setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),clearInterval(){},setInterval(){},enterOnline:()=>true,leaveOnline(){}};
 vm.createContext(context);vm.runInContext(source.replace(' window.uiCupOpen=open;', ' window.__cup={C,H,api,action,footer,render,enter,resetIdentity,hide,open,openLegacy,accept,join,handoffFresh,fetchResult,showResult};window.uiCupOpen=open;'),context);
 context.FB.user={uid:'alice',getIdToken:async()=>'token'};const hooks=context.window.__cup;hooks.resetIdentity();hooks.C.open=true;hooks.C.data=data();
 const fire=async ms=>{const entries=[...timers].filter(([,x])=>x.ms===ms);for(const [id,x]of entries){timers.delete(id);x.fn();}await flush();};
 return {context,hooks,elements,timers,fire};
}

test('Cup removes the header reload and experimental entry controls',()=>{
 assert.doesNotMatch(source,/aria-label="تحديث الكأس"|data-mc="test"|تجربة البحث|botFillAt|mcCountdown/);
 const f=fixture();assert.doesNotMatch(f.hooks.footer(),/data-mc="refresh"|تجربة/);
});

test('a stalled identity token reaches a finite retry state and cannot fetch after its deadline',async()=>{
 const f=fixture(),token=deferred();let requests=0;f.context.FB.user.getIdToken=()=>token.promise;f.context.fetch=async()=>{requests++;return {ok:true,json:async()=>data()};};
 f.hooks.C.data=null;const pending=f.context.window.MajabeedCup.refresh();assert.equal(f.hooks.C.loading,true);
 await f.fire(12000);await pending;assert.equal(f.hooks.C.loading,false);assert.match(f.hooks.footer(),/إعادة المحاولة/);assert.doesNotMatch(f.hooks.footer(),/disabled/);
 token.resolve('late-token');await flush();assert.equal(requests,0);
});

test('closing a pending load unlocks immediately and ignores its late response',async()=>{
 const f=fixture(),body=deferred();f.context.fetch=async()=>({ok:true,json:()=>body.promise});
 const pending=f.context.window.MajabeedCup.refresh();await flush();await f.hooks.action('close');assert.equal(f.hooks.C.open,false);assert.equal(f.hooks.C.loading,false);
 body.resolve({...data(),notice:'stale'});await pending;assert.notEqual(f.hooks.C.data?.notice,'stale');
});

test('leaving leaders cancels loading and rejects the old tab response',async()=>{
 const f=fixture(),body=deferred();f.context.fetch=async url=>({ok:true,json:()=>url.endsWith('/leaders')?body.promise:Promise.resolve(data())});
 const pending=f.hooks.action('leaders');await flush();assert.equal(f.hooks.C.loading,true);await f.hooks.action('journey');assert.equal(f.hooks.C.loading,false);
 body.resolve({ok:true,leaders:[{name:'late'}]});await pending;assert.equal(f.hooks.C.tab,'journey');assert.equal(f.hooks.C.leaders,null);
});

test('a late cancellation cannot close a newly reopened Cup',async()=>{
 const f=fixture(),body=deferred();f.hooks.C.requestId='request-alice';f.hooks.C.data.search={requestId:'request-alice'};
 f.context.fetch=async url=>({ok:true,json:()=>url.endsWith('/cancel')?body.promise:Promise.resolve(data())});
 const closing=f.hooks.action('close');await flush();await f.hooks.action('close');f.hooks.open();await flush();assert.equal(f.hooks.C.open,true);
 body.resolve(data());await closing;assert.equal(f.hooks.C.open,true);assert.equal(f.hooks.C.busy,false);
});

test('table navigation waits for its matching server state and times out to retry',async()=>{
 const f=fixture(),assignment={room:'cm-00000000-0000-4000-8000-000000000001',playerId:'cp-alice'};f.hooks.C.data.assignment=assignment;
 f.hooks.enter(assignment);assert.equal(f.hooks.C.entering,true);assert.match(f.hooks.footer(),/جارٍ الانتقال/);
 f.context.ONL.room='another-room';f.context.window.uiCupState({cup:{room:'another-room'},status:'playing'});assert.equal(f.hooks.C.open,true);
 await f.fire(15000);assert.equal(f.hooks.C.entering,false);assert.match(f.hooks.footer(),/إعادة المحاولة/);
 f.hooks.enter(assignment);f.context.ONL.room=assignment.room;f.context.window.uiCupState({cup:{room:assignment.room},status:'playing'});assert.equal(f.hooks.C.open,false);assert.equal(f.hooks.C.entering,false);
});

test('closing an admitted request prevents late state from reopening or mutating the Cup',async()=>{
 const f=fixture(),body=deferred();let joins=0;f.context.window.MajabeedEntryGate={run:fn=>fn()};
 f.context.fetch=async url=>{if(url.endsWith('/join'))joins++;return {ok:true,json:()=>url.endsWith('/join')?body.promise:Promise.resolve(data())};};
 const pending=f.hooks.action('start');await flush();assert.equal(joins,1);const requestId=f.hooks.C.requestId;assert.ok(requestId);
 await f.hooks.action('close');body.resolve({...data(),notice:'late join'});await pending;
 assert.equal(f.hooks.C.open,false);assert.notEqual(f.hooks.C.data?.notice,'late join');assert.equal(f.hooks.C.requestId,requestId);
});

test('stalled response decoding stops polling and presents an explicit retry',async()=>{
 const f=fixture(),body=deferred();f.hooks.C.data.search={requestId:'request-alice'};f.context.fetch=async()=>({ok:true,json:()=>body.promise});
 const pending=f.context.window.MajabeedCup.refresh();await flush();await f.fire(12000);await pending;
 assert.equal(f.hooks.C.loading,false);assert.ok(f.hooks.C.error);assert.equal([...f.timers.values()].some(t=>t.ms===3000),false);assert.match(f.hooks.footer(),/إعادة المحاولة/);
});

test('a stalled entry gate releases Cup controls and cannot admit after its deadline',async()=>{
 const f=fixture(),gate=deferred();let admitted;f.context.window.MajabeedEntryGate={run:fn=>{admitted=fn;return gate.promise;}};
 const pending=f.hooks.action('start');await flush();assert.equal(f.hooks.C.busy,true);await f.fire(90000);
 assert.equal(f.hooks.C.busy,false);assert.equal(f.hooks.C.entryPending,false);assert.match(f.hooks.footer(),/إعادة المحاولة/);assert.equal(await admitted(),false);assert.equal(f.hooks.C.requestId,null);gate.resolve(false);await pending;
});

test('resuming the already connected Cup table needs no new server event',()=>{
 const f=fixture(),assignment={room:'cm-00000000-0000-4000-8000-000000000001',playerId:'cp-alice'};
 Object.assign(f.context.ONL,{active:true,room:assignment.room,status:'playing',cup:{room:assignment.room}});f.hooks.enter(assignment);assert.equal(f.hooks.C.open,false);assert.equal(f.hooks.C.entering,false);
});
test('legacy cup spectators receive no personal rewards request or closed-room cup redirect',async()=>{
 const f=fixture();let calls=0,leaves=0;f.context.fetch=async()=>{calls++;return {ok:true,json:async()=>data()};};f.context.leaveOnline=()=>leaves++;
 f.hooks.C.open=false;Object.assign(f.context.ONL,{active:true,spectateOnly:true,room:'cm-watch',status:'over',cup:{room:'cm-watch',match:'cm-watch'},view:{viewerStatus:'spectator'}});
 f.context.window.uiCupState({status:'over',cup:f.context.ONL.cup,view:f.context.ONL.view});await f.hooks.fetchResult('cm-watch',false);f.hooks.showResult();assert.equal(calls,0);assert.equal(f.hooks.C.resultMatch,null);
 f.context.window.uiCupState({status:'closed',cup:f.context.ONL.cup,view:f.context.ONL.view});assert.equal(f.hooks.C.open,false);assert.equal(leaves,1);
});
test('legacy champions button delegates to the shared pages and returns to its original journey',async()=>{
 const f=fixture();let opened=0,returnTo;f.context.window.MajabeedRanked={openChampions:back=>{opened++;returnTo=back;}};await f.hooks.action('leaders');assert.equal(opened,1);assert.equal(f.hooks.C.open,false);returnTo();await flush();assert.equal(f.hooks.C.open,true);assert.equal(f.hooks.C.tab,'journey');
});
const activeData=extra=>({...data(),progress:{status:'active',stage:1,wins:1,losses:2,attemptId:'persisted-attempt-alice'},...extra});
test('new client sends terminal idle/won/lost states to modern Cup before any legacy admission',async()=>{
 for(const status of ['idle','won','lost'])for(const action of ['start','join']){
  const f=fixture(),calls=[];let posted=0;f.context.window.MajabeedRanked={open:(mode,options)=>calls.push({mode,options})};f.context.fetch=async(url,options)=>{if(options.method==='POST')posted++;return {ok:true,json:async()=>data()};};
  f.hooks.C.data={...data(),progress:{status},entry:{price:500}};await f.hooks.action(action);
  assert.equal(posted,0);assert.equal(calls.length,1);assert.equal(calls[0].mode,'cup');assert.equal(calls[0].options.legacyResolved.progress.status,status);assert.equal(f.hooks.C.open,false);
 }
});
test('fresh terminal acceptance hands off once while a pending old queue or assignment stays owned',()=>{
 const f=fixture(),calls=[];f.context.window.MajabeedRanked={open:(mode,options)=>calls.push(options)};
 f.hooks.accept({...data(),search:{requestId:'old-search',humanCount:2}});assert.equal(calls.length,0);assert.equal(f.hooks.C.requestId,'old-search');
 f.hooks.accept({...data(),assignment:{room:'cm-existing',playerId:'cp-alice',status:'waiting'}});assert.equal(calls.length,0);assert.equal(f.hooks.C.open,true);
 f.hooks.accept({...data(),progress:{status:'lost'},lastResult:{match:'old-finished'}});assert.equal(calls.length,1);assert.equal(calls[0].legacyResolved.lastResult.match,'old-finished');assert.equal(f.hooks.C.open,false);
 f.hooks.accept(data());assert.equal(calls.length,1,'background acceptance cannot reopen the modal');
});
test('legacy presentation receives authoritative snapshots and renders through the original controls',()=>{
 const f=fixture(),before=activeData({search:{requestId:'old-search',humanCount:2,joinedAt:123}});let snapshot;
 f.context.window.MajabeedRanked={legacyPresentation:value=>{snapshot=value;return {body:'<div class="mj-search">حديث</div>',footer:'<button data-mc="cancel">إلغاء البحث</button>'};}};f.hooks.C.data=before;f.hooks.C.busy=true;f.hooks.render();
 assert.equal(snapshot.data,before);assert.equal(snapshot.busy,true);assert.equal(snapshot.data.search.humanCount,2);assert.equal(snapshot.data.search.players,undefined);assert.match(f.elements.get('mcBody').innerHTML,/mj-search/);assert.match(f.elements.get('mcFooter').innerHTML,/data-mc="cancel"/);assert.equal(before.progress.losses,2);
});
test('active legacy continuation keeps its endpoint, explicit attempt identity and existing ad gate',async()=>{
 const f=fixture(),calls=[],modern=[];f.hooks.C.data=activeData();f.context.window.MajabeedRanked={open:(...args)=>modern.push(args)};f.context.window.MajabeedEntryGate={run:fn=>fn()};
 f.context.fetch=async(url,options)=>{calls.push({url,body:options.body?JSON.parse(options.body):null});return {ok:true,json:async()=>activeData({search:{requestId:'existing-request',humanCount:1}})};};
 await f.hooks.join();const join=calls.find(x=>x.url.endsWith('/cup/join'));assert.ok(join);assert.equal(join.body.continuationOnly,true);assert.equal(join.body.expectedAttemptId,'persisted-attempt-alice');assert.equal(join.body.maxEntryPrice,0);assert.equal(modern.length,0);
});
test('attempt ending while an ad gate is open cannot post a replacement legacy attempt',async()=>{
 const f=fixture(),gate=deferred();let admit,posts=0,opened=0;f.hooks.C.data=activeData();f.context.window.MajabeedRanked={open:()=>opened++};f.context.window.MajabeedEntryGate={run:fn=>{admit=fn;return gate.promise;}};f.context.fetch=async(url,options)=>{if(options.method==='POST')posts++;return {ok:true,json:async()=>data()};};
 const pending=f.hooks.join();await flush();f.hooks.C.data={...data(),progress:{status:'lost'}};assert.equal(await admit(),false);assert.equal(posts,0);assert.equal(opened,1);gate.resolve(false);await pending;assert.equal(f.hooks.C.open,false);
});
test('server continuation rejection fetches fresh ownership then returns modern without another old POST',async()=>{
 const f=fixture(),calls=[],modern=[];f.hooks.C.data=activeData();f.context.window.MajabeedRanked={open:(mode,options)=>modern.push(options)};f.context.window.MajabeedEntryGate={run:fn=>fn()};
 f.context.fetch=async(url,options)=>{calls.push({url,method:options.method});return url.endsWith('/join')?{ok:false,json:async()=>({ok:false,code:'CUP_CONTINUATION_ENDED'})}:{ok:true,json:async()=>({...data(),progress:{status:'won'}})};};
 await f.hooks.join();assert.equal(calls.filter(x=>x.method==='POST').length,1);assert.ok(calls[1].url.endsWith('/cup/state?fresh=1'));assert.equal(modern.length,1);assert.equal(modern[0].legacyResolved.progress.status,'won');assert.equal(f.hooks.C.requestId,null);assert.equal(f.hooks.C.open,false);
});
test('public and closed-room navigation always use modern Cup; opening it invalidates a pending old ad gate',async()=>{
 const f=fixture(),gate=deferred();let admit,opened=0;f.hooks.C.data=activeData();f.context.window.MajabeedRanked={open:()=>opened++};f.context.window.MajabeedEntryGate={run:fn=>{admit=fn;return gate.promise;}};
 const pending=f.hooks.join();await flush();f.context.window.MajabeedCup.open();assert.equal(opened,1);assert.equal(await admit(),false);gate.resolve(false);await pending;
 f.context.ONL={active:true,room:'cm-old',cup:{room:'cm-old'}};f.context.window.uiCupState({status:'closed',cup:{room:'cm-old'}});assert.equal(opened,2);
});
test('commit-time continuation notice reconciles once without looping on an active replacement attempt',()=>{
 const f=fixture(),calls=[];f.context.window.MajabeedRanked={open:(mode,options)=>calls.push(options)};
 const changed=activeData({noticeCode:'CUP_CONTINUATION_ENDED',progress:{status:'active',attemptId:'replacement-attempt',stage:0,wins:0,losses:0}});
 f.hooks.accept(changed);assert.equal(calls.length,1);assert.equal(calls[0].legacyResolved,changed);assert.equal(f.hooks.C.open,false);
 f.hooks.C.open=true;f.hooks.accept(changed,true);f.hooks.accept(changed);assert.equal(calls.length,1);assert.equal(f.hooks.C.open,true);
 f.hooks.accept({...changed,noticeCode:undefined});f.hooks.accept(changed);assert.equal(calls.length,2,'a subsequent cancellation can reconcile again');
});
test('modern continuation reads bypass the profile cache while standalone legacy requests keep their path',async()=>{
 const f=fixture(),urls=[];f.context.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>activeData()};};
 await f.hooks.api('/cup/state');assert.equal(urls.at(-1),'https://test/cup/state');
 f.context.window.MajabeedRanked={open(){}};await f.hooks.api('/cup/state');assert.equal(urls.at(-1),'https://test/cup/state?fresh=1');
 await f.hooks.api('/cup/state?test=1');assert.equal(urls.at(-1),'https://test/cup/state?test=1&fresh=1');
 await f.hooks.api('/cup/state?fresh=1');assert.equal(urls.at(-1),'https://test/cup/state?fresh=1');
});
test('active V2 progress hands back to modern before admission but never abandons an owned legacy reservation',async()=>{
 for(const phase of ['accept','start','join']){
  const f=fixture(),opened=[];let posts=0;f.context.window.MajabeedRanked={open:(mode,options)=>opened.push(options)};f.context.fetch=async(url,options)=>{if(options.method==='POST')posts++;return {ok:true,json:async()=>data()};};
  const fresh=activeData({progress:{status:'active',rulesVersion:2,stage:0,wins:1,losses:1,attemptId:'modern-attempt'}});f.hooks.C.data=fresh;
  if(phase==='accept')f.hooks.accept(fresh);else await f.hooks.action(phase);
  assert.equal(posts,0);assert.equal(opened.length,1);assert.equal(opened[0].legacyResolved.progress.rulesVersion,2);
 }
 const f=fixture();let opened=0;f.context.window.MajabeedRanked={open:()=>opened++};
 const owned=activeData({progress:{status:'active',rulesVersion:2,attemptId:'modern-attempt'},assignment:{room:'cm-persisted',playerId:'cp-alice',status:'starting'}});f.hooks.accept(owned);await f.hooks.action('join');assert.equal(opened,0);assert.equal(f.hooks.C.open,true);assert.equal(f.hooks.C.data.assignment.room,'cm-persisted');
});
test('modern legacy continuation stays on modern waiting screen until its matching match starts',async()=>{
 for(const status of ['lobby','waiting']){
  const f=fixture(),assignment={room:'cm-00000000-0000-4000-8000-000000000001',playerId:'cp-alice',status:'waiting'};f.context.window.MajabeedRanked={open(){}};f.hooks.C.data=activeData({assignment});
  f.hooks.enter(assignment);assert.equal(f.hooks.C.entering,true);const timer=f.hooks.C.navigation.timer;
  Object.assign(f.context.ONL,{active:true,room:assignment.room,status,cup:{room:assignment.room}});f.context.window.uiCupState({status,cup:{room:assignment.room}});
  assert.equal(f.hooks.C.open,true);assert.equal(f.hooks.C.entering,false);assert.equal(f.timers.has(timer),false);assert.equal(f.hooks.C.navigation.room,assignment.room);
  await f.fire(15000);assert.equal(f.hooks.C.open,true);assert.equal(f.hooks.C.error,'');
  f.context.window.uiCupState({status:'playing',cup:{room:'cm-unrelated'}});assert.equal(f.hooks.C.open,true);
  f.context.ONL.status='playing';f.context.window.uiCupState({status:'playing',cup:{room:assignment.room}});assert.equal(f.hooks.C.open,false);assert.equal(f.hooks.C.navigation,null);
 }
});
test('already connected modern Cup waiting clears entry spinner but keeps modal, and missing state still times out',async()=>{
 const f=fixture(),assignment={room:'cm-00000000-0000-4000-8000-000000000001',playerId:'cp-alice',status:'waiting'};f.context.window.MajabeedRanked={open(){}};f.hooks.C.data=activeData({assignment});Object.assign(f.context.ONL,{active:true,room:assignment.room,status:'lobby',cup:{room:assignment.room}});
 f.hooks.enter(assignment);assert.equal(f.hooks.C.open,true);assert.equal(f.hooks.C.entering,false);assert.equal(f.hooks.C.navigation.timer,null);
 f.context.ONL.status='over';f.context.window.uiCupState({status:'over',cup:{room:assignment.room}});assert.equal(f.hooks.C.open,false);
 const stalled=fixture();stalled.context.window.MajabeedRanked={open(){}};stalled.hooks.C.data=activeData({assignment});stalled.hooks.enter(assignment);await stalled.fire(15000);assert.equal(stalled.hooks.C.open,true);assert.equal(stalled.hooks.C.entering,false);assert.equal(stalled.hooks.C.navigation,null);assert.match(stalled.hooks.C.error,/الاتصال/);
});
