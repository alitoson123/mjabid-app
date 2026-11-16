import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webSource,coreSource} from './helpers/source.mjs';
const source=webSource('ui-ranked.js'),defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const data=(extra={})=>({ok:true,protocol:1,mode:'ranked',enabled:true,serverNow:Date.now(),profile:{uid:'alice',name:'سامي',rank:2450,gold:4800},tier:{index:2,min:2000,next:3000,name:'صاعد',fee:300,win:500,rankWin:61,rankLoss:36},entry:{price:300},progress:{status:'idle',stage:0,wins:0,losses:0},search:null,assignment:null,...extra});
const cupData=(extra={})=>({ok:true,profile:{uid:'alice',gold:4800},rules:{rankWin:80,rankLoss:30,lossesPerStage:3},progress:{attemptId:null,status:'idle',stage:0,wins:0,losses:0},entry:{price:0},serverNow:Date.now(),search:null,assignment:null,...extra});
function fixture(){
 const elements=new Map(),timers=new Map(),storage=new Map();let serial=0,legacyCalls=0,entered=0;
 const element=()=>({dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v;},querySelector:()=>element(),querySelectorAll:()=>[],focus(){},remove(){},innerHTML:'',textContent:''});
 for(const id of ['mjRanked','mjBody','mjGold','mjSubtitle','mjMessage'])elements.set(id,element());
 const document={hidden:false,documentElement:element(),body:element(),getElementById:id=>elements.get(id)||null,addEventListener(){},querySelector:()=>null};
 const context={window:{addEventListener(){},uiCupOpen:()=>legacyCalls++,MajabeedBaloot:{state:{selected:'majabeed'}},MajabeedCup:{openLegacy:()=>legacyCalls++}},document,FB:{user:{uid:'alice',getIdToken:async()=>'token'}},ONL:{active:false},GAME_SRV:'fixture',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=>String(++serial).padStart(12,'0')},AbortController,URL,location:{href:'https://fixture/'},history:{replaceState(){}},fetch:async()=>({ok:true,json:async()=>data()}),setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,clearInterval(){},enterOnline(){entered++;return true;},leaveOnline(){context.ONL.active=false;}};
 vm.createContext(context);vm.runInContext(source.replace(' window.MajabeedRanked={',' window.__ranked={R,L,api,reconcileCup,legacyPresentation,action,accept,join,hide,render,rankedLobby,cupLobby,lobby,search,found,enter,state,account,loadLeaders,leadersView,fetchResult,resultView};window.MajabeedRanked={'),context);
 const h=context.window.__ranked;h.R.open=true;h.R.data=data();
 return {context,h,elements,timers,storage,legacyCalls:()=>legacyCalls,entered:()=>entered,fire:async ms=>{for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}await flush();}};
}
test('ranked uses real rank assets and the approved copy; cup has attempt-wide remaining chances',()=>{
 const f=fixture(),rank=f.h.rankedLobby(data()),cup=f.h.cupLobby(data({mode:'cup',progress:{status:'active',stage:2,wins:1,losses:2}}));
 assert.match(rank,/صافي ربح الفوز/);assert.match(rank,/rank-2.svg/);assert.match(cup,/الفرص المتبقية/);assert.match(cup,/1 من 3 فرص متبقية/);assert.doesNotMatch(source,/قلوب المحاولة|منافسة واحدة للجميع|أربعة لاعبين · قوانين واحدة/);
 assert.doesNotMatch(f.h.found(data({assignment:{playerId:'p0',players:[0,1,2,3].map(i=>({pid:'p'+i,name:'اسم',rankName:'صاعد',mode:i%2?'cup':'ranked'}))}})),/cup|ranked|بطولة|أربعة لاعبين/);
});
test('entry uses the shared ad gate and creates no request until admission',async()=>{
 const f=fixture(),hold=defer();let admit,calls=0;f.context.window.MajabeedEntryGate={run:fn=>{admit=fn;return hold.promise;}};f.context.fetch=async()=>{calls++;return {ok:true,json:async()=>data()};};
 const pending=f.h.join();await flush();assert.equal(calls,0);assert.equal(f.h.R.requestId,null);f.h.hide();assert.equal(await admit(),false);hold.resolve(false);await pending;assert.equal(calls,0);
});
test('an uncertain join retains its request and cannot start another charged request',async()=>{
 const f=fixture();let calls=0;f.context.window.MajabeedEntryGate={run:fn=>fn()};f.context.fetch=async()=>{calls++;throw Error('offline');};await f.h.join();const id=f.h.R.requestId;assert.ok(id);assert.equal(f.storage.get('majabeed-ranked-request:alice'),id);await f.h.join();assert.equal(calls,1);assert.ok(f.h.R.error);
});
test('stalled tokens have a bounded deadline and late resolution cannot fetch',async()=>{
 const f=fixture(),token=defer();let requests=0;f.context.FB.user.getIdToken=()=>token.promise;f.context.fetch=async()=>{requests++;return {ok:true,json:async()=>data()};};
 const pending=f.context.window.MajabeedRanked.refresh();await f.fire(12000);await pending;assert.equal(f.h.R.loading,false);assert.ok(f.h.R.error);token.resolve('late');await flush();assert.equal(requests,0);
});
test('switching account or closing ignores a late lobby response',async()=>{
 const f=fixture(),body=defer();f.context.fetch=async()=>({ok:true,json:()=>body.promise});const pending=f.context.window.MajabeedRanked.refresh();await flush();f.context.FB.user={uid:'bob',getIdToken:async()=>'b'};f.h.account('bob');body.resolve(data());await pending;assert.equal(f.h.R.data,null);assert.equal(f.h.R.open,false);assert.equal(f.h.R.uid,'bob');
});
test('legacy active cup continues its owned attempt with modern presentation and no new admission',async()=>{
 const f=fixture(),urls=[];f.context.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('/cup/state')?cupData({progress:{status:'active',attemptId:'old-attempt',stage:1,wins:2,losses:1}}):data({mode:'cup',legacyCup:true})};};f.h.R.mode='cup';await f.context.window.MajabeedRanked.refresh();assert.equal(f.legacyCalls(),1);assert.equal(f.h.R.open,false);assert.equal(f.entered(),0);assert.equal(urls.filter(u=>u.includes('/join')).length,0);
});
test('fresh or terminal cup always shows new rules, including stale ranked legacy flag',async()=>{
 for(const status of ['idle','lost','won']){
  const f=fixture(),urls=[];f.h.R.mode='cup';f.context.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('/cup/state')?cupData({progress:{status,attemptId:status==='idle'?null:'finished-attempt',stage:2,wins:0,losses:3},entry:{price:500}}):data({mode:'cup',legacyCup:true})};};
  await f.context.window.MajabeedRanked.refresh();assert.equal(f.legacyCalls(),0);assert.equal(f.h.R.open,true);assert.equal(f.h.R.data.entry.price,500);assert.equal(f.h.R.data.legacyCup,false);assert.match(f.elements.get('mjBody').innerHTML,/الفرص الثلاث لا تتجدد/);assert.match(f.elements.get('mjBody').innerHTML,/لا تُضاف أو تُخصم نقاط التصنيف/);assert.ok(urls.every(u=>!u.includes('/join')));
 }
});
test('an old reservation is retained even before its attempt is active',async()=>{
 for(const owned of [{search:{requestId:'legacy-owned',humanCount:7}},{assignment:{room:'cup-owned',playerId:'own-seat',status:'waiting'}}]){
  const f=fixture();f.h.R.mode='cup';f.context.fetch=async url=>({ok:true,json:async()=>url.includes('/cup/state')?cupData(owned):data({mode:'cup',legacyCup:false})});await f.context.window.MajabeedRanked.refresh();assert.equal(f.legacyCalls(),1);assert.equal(f.h.R.open,false);assert.equal(f.entered(),0);
 }
});
test('confirmed terminal attempt cannot bounce back through either profile cache',()=>{
 const f=fixture(),terminal=cupData({progress:{status:'won',attemptId:'a',stage:2,wins:4,losses:1}}),stale=cupData({progress:{status:'active',attemptId:'a',stage:2,wins:3,losses:1}}),rank=data({mode:'cup',legacyCup:true});
 f.h.reconcileCup(rank,terminal);assert.equal(f.h.reconcileCup(rank,stale).progress.status,'won');assert.equal(f.legacyCalls(),0);
 f.h.reconcileCup(rank,cupData({progress:{status:'active',attemptId:'b'}}));assert.equal(f.legacyCalls(),1);f.h.account('bob');assert.equal(f.h.R.legacyResolved,null);
});
test('a new active attempt is not confused with its historical completed result',()=>{
 const f=fixture(),d=data({mode:'cup',legacyCup:false,progress:{status:'active',attemptId:'new',stage:1,losses:1},lastResult:{status:'won',attemptId:'previous'}}),legacy=cupData({progress:{status:'active',attemptId:'new'}});
 assert.equal(f.h.reconcileCup(d,legacy),d);assert.equal(f.legacyCalls(),0);
});
test('fresh attempt version resolves cached ranked state in both directions',()=>{
 const old=fixture(),active=cupData({progress:{status:'active',rulesVersion:1,attemptId:'old'}});
 assert.equal(old.h.reconcileCup(data({mode:'cup',legacyCup:false}),active),null);assert.equal(old.legacyCalls(),1);
 const current=fixture(),v2=cupData({progress:{status:'active',rulesVersion:2,attemptId:'new',stage:2,wins:1,losses:2}});
 const resolved=current.h.reconcileCup(data({mode:'cup',legacyCup:true}),v2);assert.equal(current.legacyCalls(),0);assert.equal(resolved.progress.rulesVersion,2);assert.equal(resolved.progress.losses,2);assert.equal(resolved.legacyCup,false);
});
test('paused entry or failed ownership refresh cannot post a stale join',async()=>{
 for(const blocked of [{enabled:false},{error:'لم تصل حالة الكأس'}]){
  const f=fixture();f.h.R.mode='cup';f.h.R.data=data({mode:'cup',enabled:blocked.enabled??true});f.h.R.error=blocked.error||'';let posts=0;f.context.window.MajabeedEntryGate={run:fn=>fn()};f.context.fetch=async()=>{posts++;throw Error('unexpected admission');};await f.h.join();assert.equal(posts,0);assert.equal(f.h.R.requestId,null);
 }
});
test('unconfirmed cup ownership blocks new entry instead of hiding a failed lookup',async()=>{
 const f=fixture();f.h.R.mode='cup';f.h.R.data=null;f.context.fetch=async url=>{if(url.includes('/cup/state'))throw Error('offline');return {ok:true,json:async()=>data({mode:'cup'})};};await f.context.window.MajabeedRanked.refresh();assert.equal(f.h.R.data,null);assert.ok(f.h.R.error);assert.equal(f.legacyCalls(),0);
});
test('continuation presentation preserves actual rules and never fabricates a roster or countdown',()=>{
 const f=fixture(),active=cupData({progress:{status:'active',stage:1,wins:2,losses:1,attemptId:'a'}}),before=JSON.stringify(active),view=f.h.legacyPresentation({data:active});
 assert.match(view.body,/قواعد المحاولة القائمة/);assert.match(view.body,/الفوز \+80 والخسارة −30/);assert.doesNotMatch(view.body,/الفرص الثلاث لا تتجدد/);assert.equal(JSON.stringify(active),before);assert.match(view.footer,/data-mc="start"/);
 const queue=f.h.legacyPresentation({data:{...active,search:{humanCount:9,joinedAt:1,requestId:'q'}}});assert.match(queue.body,/>9<\/bdi> في قائمة البحث/);assert.doesNotMatch(queue.body,/قريبين من رتبتك|9 \/ 4|فريقك جاهز|mjCountdown/);
 const found=f.h.legacyPresentation({data:{...active,assignment:{room:'cup-a',playerId:'p',status:'settling'}}});assert.match(found.body,/تأكيد النتيجة/);assert.doesNotMatch(found.footer,/data-mc="resume"/);
});
test('own assignment restores cancellation identity; roster never chooses another player seat',async()=>{
 const f=fixture(),assignment={room:'cm-abc',playerId:'cp-alice',requestId:'request-alice',mode:'cup',status:'waiting',players:[]};f.h.accept(data({mode:'cup',assignment}));assert.equal(f.h.R.requestId,'request-alice');f.h.enter(assignment);assert.deepEqual({...f.context.ONL.assignmentPid},{room:'cm-abc',pid:'cp-alice'});assert.equal(f.entered(),1);
 f.context.ONL.room='cm-abc';f.context.ONL.cup={rankedProtocol:1,room:'cm-abc'};f.h.state({cup:{rankedProtocol:1,room:'cm-abc',startAt:Date.now()+3000},status:'lobby'});assert.equal(f.h.R.open,true);f.h.state({cup:{rankedProtocol:1,room:'cm-abc'},status:'playing'});assert.equal(f.h.R.open,false);
});
test('cancel failure preserves the reservation and never reports a successful refund',async()=>{
 const f=fixture();f.h.R.requestId='request-alice';f.context.fetch=async()=>({ok:false,json:async()=>({ok:false,code:'MATCH_STARTED'})});const result=await f.h.action('cancel');assert.equal(result,false);assert.equal(f.h.R.requestId,'request-alice');assert.match(f.h.R.error,/المباراة/);
});
test('all game join transports and reauthentication carry the new capability; old result hooks ignore it',()=>{
 const core=coreSource();const joins=[...core.matchAll(/\{type:'join',([^\n]+)/g)].filter(j=>j[1].includes('features:'));assert.ok(joins.length>=4);for(const j of joins)assert.match(j[1],/rankedProtocol:1/);assert.match(core,/type:'auth',rankedProtocol:1/);assert.match(core,/MajabeedRanked\?\.returnMode/);assert.match(webSource('ui-cup.js'),/if\(msg.cup\?\.rankedProtocol===1\)return/);
});
const champions=(start,count)=>Array.from({length:count},(_,i)=>({uid:'champ-'+(start+i),position:start+i,name:'بطل '+(start+i),avatar:'',titles:200-start-i}));
test('cup champions are accessible and continue beyond50 and100 without admission',async()=>{
 const f=fixture(),calls=[];f.h.R.mode='cup';f.h.R.data=data({mode:'cup'});assert.match(f.h.lobby(f.h.R.data),/data-rk="leaders"/);
 f.context.fetch=async url=>{calls.push(url);const cursor=new URL(url).searchParams.get('cursor'),start=cursor==='page3'?101:cursor==='page2'?51:1;return {ok:true,json:async()=>({ok:true,pagination:1,leaders:champions(start,start===101?13:50),hasMore:start<101,nextCursor:start===1?'page2':start===51?'page3':null})};};
 await f.h.action('leaders');assert.equal(f.h.L.rows.length,50);assert.match(f.h.leadersView(),/الزعيم/);await f.h.action('leaders-more');assert.equal(f.h.L.rows.length,100);await f.h.action('leaders-more');assert.equal(f.h.L.rows.length,113);assert.equal(f.h.L.cursor,null);assert.equal(new Set(f.h.L.rows.map(p=>p.uid)).size,113);assert.ok(calls.every(url=>url.includes('/cup/leaders?pageSize=50')));assert.equal(f.entered(),0);assert.equal(f.h.R.requestId,null);
 await f.h.action('journey');assert.equal(f.h.R.tab,'journey');assert.equal(f.h.R.open,true);
});
test('old server top100 response remains browsable50 at a time without claiming all champions',async()=>{
 const f=fixture();f.h.R.mode='cup';let calls=0;f.context.fetch=async()=>{calls++;return {ok:true,json:async()=>({ok:true,leaders:champions(1,100)})};};
 await f.h.action('leaders');assert.equal(f.h.L.rows.length,50);await f.h.action('leaders-more');assert.equal(f.h.L.rows.length,100);assert.equal(calls,1);assert.match(f.h.leadersView(),/المتاح حاليًا: أول 100 بطل/);assert.doesNotMatch(f.h.leadersView(),/تم عرض جميع الأبطال/);
});
test('champion page failure preserves loaded rows and account changes discard late data',async()=>{
 const f=fixture();f.h.R.mode='cup';let fail=false;f.context.fetch=async()=>fail?{ok:false,json:async()=>({ok:false,code:'LEADERS_EXPIRED'})}:{ok:true,json:async()=>({ok:true,pagination:1,leaders:champions(1,50),hasMore:true,nextCursor:'next'})};
 await f.h.action('leaders');fail=true;await f.h.action('leaders-more');assert.equal(f.h.L.rows.length,50);assert.equal(f.h.L.expired,true);assert.match(f.h.leadersView(),/تحديث الترتيب/);
 const late=defer();f.context.fetch=async()=>({ok:true,json:()=>late.promise});const pending=f.h.loadLeaders();await flush();f.context.FB.user={uid:'bob',getIdToken:async()=>'b'};f.h.account('bob');late.resolve({ok:true,pagination:1,leaders:champions(1,50),hasMore:false,nextCursor:null});await pending;assert.equal(f.h.L.rows,null);assert.equal(f.h.R.open,false);
});
test('legacy cup opens shared champions directly and returns without a ranked request',async()=>{
 const f=fixture();let back=0;const urls=[];f.context.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>({ok:true,pagination:1,leaders:[],hasMore:false,nextCursor:null})};};
 f.context.window.MajabeedRanked.openChampions(()=>back++);await flush();assert.equal(f.h.R.tab,'leaders');assert.equal(urls.length,1);assert.match(urls[0],/\/cup\/leaders/);await f.h.action('close');assert.equal(back,1);assert.equal(f.h.R.open,false);assert.match(webSource('ui-cup.js'),/name==='leaders'&&window\.MajabeedRanked\?\.openChampions/);
});
test('cup spectators never fetch a personal result or acquire a participant return mode',async()=>{
 const f=fixture();let calls=0;f.context.fetch=async()=>{calls++;return {ok:true,json:async()=>data()};};Object.assign(f.context.ONL,{active:true,room:'cm-watch',status:'over',spectateOnly:true,cup:{rankedProtocol:1,room:'cm-watch',match:'cm-watch'},view:{viewerStatus:'spectator'}});
 f.h.state({status:'over',cup:f.context.ONL.cup,view:f.context.ONL.view});await f.h.fetchResult();assert.equal(calls,0);assert.equal(f.context.window.MajabeedRanked.returnMode(),null);assert.equal(f.h.R.result,null);
 f.h.R.open=false;f.h.state({status:'closed',cup:f.context.ONL.cup,view:f.context.ONL.view});assert.equal(f.context.ONL.active,false);assert.equal(f.h.R.open,false);assert.equal(calls,0);
});

test('Cup search quotes free, continuing and paid attempts without changing entry economics',()=>{
 const f=fixture();f.h.R.mode='cup';
 for(const [entry,progress,expected] of [
  [{price:0},{status:'idle'},'المشاركة مجانية · بطولة مجابيد'],
  [{price:0,continuation:true},{status:'active'},'متابعة المحاولة مجانية · بطولة مجابيد'],
  [{price:500},{status:'lost'},'500 ذهب للمحاولة الجديدة · لم تُخصم بعد']
 ]){
  const d=data({mode:'cup',entry,progress,search:{players:[]}}),before=JSON.stringify(d),markup=f.h.search(d);
  assert.ok(markup.includes(expected));assert.doesNotMatch(markup,/لم تُخصم رسوم الدخول بعد/);assert.match(markup,/data-rk="cancel"/);assert.match(markup,/بطولة مجابيد/);assert.equal(JSON.stringify(d),before);
  if(entry.price>0)assert.doesNotMatch(markup,/المشاركة مجانية|متابعة المحاولة مجانية/);
 }
 const unknown=f.h.search(data({mode:'cup',entry:{},search:{players:[]}}));assert.doesNotMatch(unknown,/المشاركة مجانية|0 ذهب/);assert.match(unknown,/جارٍ تأكيد المشاركة/);
});
test('committed Cup participation never claims a paid attempt was free from its new continuation quote',()=>{
 const f=fixture();f.h.R.mode='cup';
 const markup=f.h.found(data({mode:'cup',entry:{price:0,continuation:true},progress:{status:'active'},assignment:{startAt:Date.now(),status:'starting',players:[]}}));
 assert.match(markup,/تم تأكيد المشاركة في بطولة مجابيد/);assert.doesNotMatch(markup,/رسوم الدخول|المشاركة مجانية|متابعة المحاولة مجانية/);assert.match(markup,/data-rk="resume"/);
});
test('ranked admission copy and layout remain separate from the fixed Cup content',()=>{
 const f=fixture();f.h.R.mode='ranked';const queue=f.h.search(data({search:{players:[]}}));
 assert.match(queue,/لم تُخصم رسوم الدخول بعد/);assert.doesNotMatch(queue,/mj-cup-content|بطولة مجابيد|المشاركة مجانية/);
 const found=f.h.found(data({assignment:{startAt:Date.now(),status:'starting',players:[]}}));assert.match(found,/تم تأكيد رسوم الدخول/);assert.doesNotMatch(found,/mj-cup-content/);
});
test('legacy Cup queue uses its own truthful participation quote',()=>{
 const f=fixture();
 for(const [entry,progress,expected] of [[{price:0},{status:'idle'},'المشاركة مجانية'],[{price:500},{status:'active'},'متابعة المحاولة مجانية'],[{price:500},{status:'lost'},'500 ذهب للمحاولة الجديدة · لم تُخصم بعد']]){
  const result=f.h.legacyPresentation({data:cupData({entry,progress,search:{humanCount:1}})});
  assert.ok(result.footer.includes(expected));assert.doesNotMatch(result.footer,/لم تُخصم رسوم الدخول بعد/);assert.match(result.footer,/data-mc="cancel"/);
 }
});


test('ranked presentation uses the two new crests and actual server quotes, with accurate next-tier text',()=>{
 const f=fixture();
 for(const tier of [{index:8,min:15000,next:20000,name:'سيد اللعبة',fee:1100,win:1650,rankWin:107,rankLoss:64},{index:9,min:20000,next:null,name:'شيخ المجابيد',fee:1210,win:1815,rankWin:118,rankLoss:71}]){
  const html=f.h.rankedLobby(data({tier,profile:{uid:'alice',name:'سامي',gold:9000,rank:tier.min}}));
  assert.match(html,new RegExp('rank-'+tier.index+'\\.svg'));assert.ok(html.includes(tier.name));assert.ok(html.includes('>'+tier.fee+'</bdi>'));assert.ok(html.includes('>+'+(tier.win-tier.fee)+'</bdi>'));assert.ok(html.includes('>'+tier.rankWin+'</bdi>')||html.includes('>+'+tier.rankWin+'</bdi>'));
  if(tier.next)assert.match(html,/طريقك إلى <b>شيخ المجابيد<\/b>/);else assert.match(html,/أعلى رتبة/);assert.doesNotMatch(html,/undefined|NaN/);
 }
 const legacy=f.h.rankedLobby(data({tier:{index:7,min:10000,next:null,name:'نابغة',fee:1000,win:1500,rankWin:97,rankLoss:58},profile:{uid:'alice',name:'سامي',gold:9000,rank:20000}}));
 assert.match(legacy,/rank-7\.svg/);assert.match(legacy,/>1000<\/bdi>/);assert.match(legacy,/>\+500<\/bdi>/);assert.doesNotMatch(legacy,/شيخ المجابيد/);
});
