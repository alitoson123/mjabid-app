import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webSource,coreSource} from './helpers/source.mjs';
const source=webSource('ui-profile-trophies.js');
const IDS=['cup','weekly-gold','weekly-silver','weekly-bronze','monthly-gold','monthly-silver','monthly-bronze'];
const reply=(uid='alice',counts={},extra={})=>({ok:true,uid,trophies:IDS.map(id=>({id,count:counts[id]||0,lastEarnedAt:Date.UTC(2026,10,12)})),coverage:{weekly:{scope:'recorded-periods',firstPeriod:'2026-10-01'},monthly:{scope:'recorded-periods',firstPeriod:'2026-09'}},legacyBest:null,asOf:Date.now(),...extra});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture(){
 const nodes=new Map(),timers=new Map(),listeners=new Map(),requests=[];let serial=0,removed=0;
 const element=()=>({innerHTML:'',hidden:false,dataset:{},attributes:{},events:{},classList:{classes:new Set(),add(x){this.classes.add(x);},contains(x){return this.classes.has(x);}},setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},addEventListener(k,fn){this.events[k]=fn;},remove(){removed++;}});
 for(const id of ['profile','pfAchievementsList','mcProfileTitles','frame'])nodes.set(id,element());
 const c={FB:{user:{uid:'alice',getIdToken:async()=> 'fixture-token'}},viewedProfile:null,GAME_SRV:'fixture.invalid',AbortController,URL,
  MajabeedBaloot:{state:{selected:'majabeed'}},localStorage:{getItem:()=>null},
  document:{hidden:false,getElementById:id=>nodes.get(id)||null,addEventListener:(key,fn)=>listeners.set('document:'+key,fn)},
  addEventListener:(key,fn)=>listeners.set('window:'+key,fn),
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>{throw Error('Gallery must not poll');},
  fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>reply(new URL(url).searchParams.get('uid'))};}};
 c.window=c;vm.runInNewContext(source,c);
 return {c,nodes,timers,requests,listeners,api:c.MajabeedTrophies,html:()=>nodes.get('pfAchievementsList').innerHTML,hidden:()=>nodes.get('pfAchievementsList').hidden,removed:()=>removed,
  render:async player=>{c.viewedProfile=player||null;return c.MajabeedTrophies.render(player);},
  fire:async ms=>{for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}await flush();}};
}

test('all seven verified trophies use fixed transparent assets with counts and recorded-history coverage',async()=>{
 const f=fixture();f.c.fetch=async(url,options)=>{f.requests.push({url,options});return {ok:true,json:async()=>reply('alice',Object.fromEntries(IDS.map((id,i)=>[id,i+1])))};};
 await f.render();const html=f.html();for(const id of IDS)assert.match(html,new RegExp('ui-art/trophies-v419/'+id+'\\.png'));
 assert.equal((html.match(/data-trophy=/g)||[]).length,7);assert.match(html,/كأس مجابيد/);assert.match(html,/سجل الأسبوعية منذ/);assert.match(html,/سجل الشهرية منذ/);assert.doesNotMatch(html,/لا توجد بطولات|إنجاز سابق/);
 assert.equal(f.requests[0].options.method,'GET');assert.equal(f.requests[0].options.headers.authorization,'Bearer fixture-token');assert.ok(f.requests[0].url.endsWith('/profile/trophies?uid=alice'));assert.equal(f.timers.size,0);assert.ok(f.removed()>0);
});
test('confirmed zero is an honest empty state with no locked or unearned trophies',async()=>{
 const f=fixture();f.c.localStorage.getItem=()=> 'المركز الأول';await f.render();assert.match(f.html(),/لا توجد بطولات مسجلة بعد/);assert.doesNotMatch(f.html(),/<img|ptCard|المركز الأول|سجل الأسبوعية/);assert.equal(f.hidden(),false);
});
test('old top10 achievement remains separate from verified Cup trophies and never invents a counter',async()=>{
 const f=fixture();f.c.fetch=async()=>({ok:true,json:async()=>reply('alice',{cup:3},{legacyBest:{name:'من أفضل 10',date:Date.UTC(2026,8,8)}})});await f.render();
 assert.equal((f.html().match(/data-trophy=/g)||[]).length,1);assert.match(f.html(),/إنجاز سابق/);assert.match(f.html(),/من أفضل 10/);assert.doesNotMatch(f.html(),/weekly-gold\.png/);
});
test('an old first-place text can remain without a receipt but does not duplicate a verified weekly trophy',async()=>{
 for(const count of [0,2]){const f=fixture();f.c.fetch=async()=>({ok:true,json:async()=>reply('alice',{'weekly-gold':count},{legacyBest:{name:'المركز الأول',date:null}})});await f.render();assert.equal(f.html().includes('إنجاز سابق'),count===0);assert.equal(f.html().includes('weekly-gold.png'),count>0);}
});
test('invalid counters or incomplete/duplicate categories fail closed instead of painting partial or zero awards',async()=>{
 for(const change of [d=>d.trophies[0].count=-1,d=>d.trophies[0].count=1.5,d=>d.trophies[0].count=Number.MAX_SAFE_INTEGER+1,d=>d.trophies[0].count='2',d=>d.trophies.pop(),d=>d.trophies[1].id='cup']){
  const f=fixture(),data=reply('alice',{cup:5});change(data);f.c.fetch=async()=>({ok:true,json:async()=>data});await f.render();assert.match(f.html(),/تعذّر تحميل البطولات/);assert.doesNotMatch(f.html(),/<img|لا توجد بطولات/);
 }
});
test('wrong response UID and missing target UID cannot display another profile or fall back to own awards',async()=>{
 const f=fixture();f.c.fetch=async()=>({ok:true,json:async()=>reply('alice',{cup:9})});await f.render({uid:'bob'});assert.match(f.html(),/تعذّر تحميل البطولات/);assert.doesNotMatch(f.html(),/<img/);
 const g=fixture();await g.render({name:'Unknown',pid:'p-seat-id'});assert.equal(g.requests.length,0);assert.match(g.html(),/غير متاح لهذا اللاعب/);assert.doesNotMatch(g.html(),/<img/);
});
test('opening another player discards a late previous profile response',async()=>{
 const f=fixture(),first=defer();f.c.fetch=async url=>({ok:true,json:()=>new URL(url).searchParams.get('uid')==='bob'?first.promise:Promise.resolve(reply('carol',{'monthly-gold':2}))});
 const pending=f.render({uid:'bob'});await flush();await f.render({uid:'carol'});assert.match(f.html(),/monthly-gold\.png/);first.resolve(reply('bob',{cup:99}));await pending;assert.doesNotMatch(f.html(),/cup\.png|>99</);assert.equal(f.nodes.get('pfAchievementsList').dataset.trophyTarget,'carol');
});
test('logout or account switch clears visible trophies and a late token cannot start a request',async()=>{
 const f=fixture(),token=defer();f.c.FB.user.getIdToken=()=>token.promise;const pending=f.render();await flush();f.c.FB.user={uid:'bob',getIdToken:async()=> 'b'};f.api.accountChanged('bob');assert.equal(f.hidden(),true);assert.equal(f.html(),'');token.resolve('late');await pending;assert.equal(f.requests.length,0);
 await f.render();assert.equal(f.hidden(),false);f.c.FB.user=null;f.api.accountChanged(null);assert.equal(f.html(),'');await f.render();assert.match(f.html(),/سجّل الدخول/);assert.equal(f.requests.length,1);
});
test('Sakka switch synchronously clears the gallery and rejects a late Majabeed response',async()=>{
 const f=fixture(),body=defer();f.c.fetch=async()=>({ok:true,json:()=>body.promise});const pending=f.render();await flush();f.c.MajabeedBaloot.state.selected='baloot';f.api.contextChanged();assert.equal(f.hidden(),true);body.resolve(reply('alice',{cup:4}));await pending;assert.equal(f.html(),'');assert.equal(await f.render(),false);assert.equal(f.hidden(),true);
});
test('another Sakka player never requests Majabeed awards, while an explicitly Majabeed profile can be viewed from Sakka',async()=>{
 const f=fixture();await f.render({uid:'bob',game:'baloot'});assert.equal(f.requests.length,0);assert.equal(f.hidden(),true);
 f.c.MajabeedBaloot.state.selected='baloot';await f.render({uid:'bob',game:'majabeed'});assert.equal(f.requests.length,1);assert.ok(f.requests[0].url.endsWith('uid=bob'));assert.equal(f.hidden(),false);
});
test('leaving profile cancels unresolved work and cannot repaint another screen',async()=>{
 const f=fixture(),body=defer();f.c.fetch=async()=>({ok:true,json:()=>body.promise});const pending=f.render();await flush();f.api.route('home');assert.equal(f.hidden(),true);body.resolve(reply('alice',{cup:10}));await pending;assert.equal(f.html(),'');assert.equal(f.timers.size,0);
});
test('token deadline displays retry and a late token never reaches the endpoint',async()=>{
 const f=fixture(),token=defer();f.c.FB.user.getIdToken=()=>token.promise;const pending=f.render();await flush();assert.match(f.html(),/جارٍ تحميل/);await f.fire(12000);await pending;assert.match(f.html(),/تعذّر تحميل/);assert.doesNotMatch(f.html(),/لا توجد بطولات/);token.resolve('late');await flush();assert.equal(f.requests.length,0);
});
test('body decoding deadline permits a fresh manual retry and ignores late old counts',async()=>{
 const f=fixture(),body=defer();f.c.fetch=async()=>({ok:true,json:()=>body.promise});const pending=f.render();await flush();await f.fire(12000);await pending;assert.match(f.html(),/إعادة المحاولة/);
 f.c.fetch=async()=>({ok:true,json:async()=>reply('alice',{'weekly-silver':1})});assert.equal(await f.api.retry(),true);body.resolve(reply('alice',{cup:80}));await flush();assert.match(f.html(),/weekly-silver\.png/);assert.doesNotMatch(f.html(),/cup\.png|>80</);assert.equal(f.timers.size,0);
});
test('server failures remain distinct from zero, reopening or retry performs only an explicit read',async()=>{
 const f=fixture();let reads=0;f.c.fetch=async()=>{reads++;return {ok:false,json:async()=>({ok:false,code:'TROPHIES_UNAVAILABLE'})};};await f.render();assert.match(f.html(),/تعذّر تحميل/);f.api.route('profile');assert.equal(reads,1);assert.equal(f.timers.size,0);
 await f.api.retry();assert.equal(reads,2);assert.match(f.html(),/تعذّر تحميل/);
});
test('bad dates and unknown historic labels never produce Invalid Date or untrusted markup',async()=>{
 const f=fixture(),data=reply('alice',{cup:1},{legacyBest:{name:'<script>fake</script>',date:1},coverage:{weekly:{firstPeriod:'2026-99-99'}}});data.trophies[0].lastEarnedAt=1e30;f.c.fetch=async()=>({ok:true,json:async()=>data});await f.render();assert.match(f.html(),/cup\.png/);assert.doesNotMatch(f.html(),/Invalid Date|آخر تتويج|script|إنجاز سابق/);
});
test('integration replaces milestone awards with championships and preserves profile recovery hooks',()=>{
 assert.match(coreSource(),/if\(window\.MajabeedTrophies\)return window\.MajabeedTrophies\.render\(player\)/);
 assert.match(coreSource(),/function uiCostReset\(uid\)\{\s*window\.MajabeedTrophies\?\.accountChanged/);
 assert.match(webSource('ui-community.js'),/window\.MajabeedTrophies\?\.route\(id\)/);
 assert.match(webSource('ui-cup.js'),/async function profile\(uid\)\{\s*\$\('mcProfileTitles'\)\?\.remove\(\);\s*if\(window\.MajabeedTrophies\)return/);
 assert.match(webSource('ui-baloot.js'),/B.selected=game;window\.MajabeedTrophies\?\.contextChanged\(\)/);
 assert.match(webSource('index.html'),/id="pfTabAchievements"[^>]*>البطولات</);
 for(const name of ['game-core.js','index.html','ui-navigation.js','ui-polish.css'])assert.doesNotMatch(webSource(name),/\b(?:AWARDS|openAwards|awardsScr|awardsBack|awardsGrid|awardsBar|awardsProg)\b/,name);
 assert.doesNotMatch(coreSource(),/FOUNDING_CUTOFF|first-game|ten-games|ثري المجلس|ضربة معلم/);
});

test('More championships opens own gallery after profile initialization and discards the previous player response',async()=>{
 const f=fixture(),old=defer();
 f.c.fetch=async(url,options)=>{f.requests.push({url,options});const uid=new URL(url).searchParams.get('uid');return {ok:true,json:()=>uid==='bob'?old.promise:Promise.resolve(reply(uid,{cup:2}))};};
 const previous=f.render({uid:'bob'});await flush();
 f.c.SHOW_STORE=false;const order=[];
 f.c.openProfile=()=>{order.push('profile');f.c.viewedProfile=null;f.api.render();f.c.selectedTab='overview';};
 f.c.uiProfileSelect=(key,focus)=>{order.push(key);f.c.selectedTab=key;f.c.focused=focus;};
 vm.runInNewContext(webSource('ui-navigation.js'),f.c);
 vm.runInNewContext("uiNavActions().find(it=>it.k==='championships').go()",f.c);await flush();
 assert.deepEqual(order,['profile','achievements']);assert.equal(f.c.selectedTab,'achievements');assert.equal(f.c.focused,true);
 assert.equal(f.nodes.get('pfAchievementsList').dataset.trophyTarget,'alice');assert.match(f.html(),/>2</);
 old.resolve(reply('bob',{cup:80}));await previous;assert.doesNotMatch(f.html(),/>80</);assert.equal(f.c.viewedProfile,null);
 assert.equal(f.requests.length,2);assert.ok(f.requests[1].url.endsWith('uid=alice'));
 assert.equal(vm.runInNewContext("uiNavActions().find(it=>it.k==='championships').label",f.c),'البطولات');
});

test('More championships respects game context and signed-out accounts without fetching another player',async()=>{
 const f=fixture();f.c.SHOW_STORE=false;let opened=0;
 f.c.openProfile=()=>{opened++;f.c.viewedProfile=null;f.api.render();};f.c.uiProfileSelect=()=>{};
 vm.runInNewContext(webSource('ui-navigation.js'),f.c);
 f.c.MajabeedBaloot.state.selected='baloot';
 assert.equal(vm.runInNewContext("uiNavActions().some(it=>it.k==='championships')",f.c),false);
 vm.runInNewContext('uiOpenChampionships()',f.c);assert.equal(opened,0);assert.equal(f.requests.length,0);
 f.c.MajabeedBaloot.state.selected='majabeed';f.c.FB.user=null;f.c.viewedProfile={uid:'bob'};
 vm.runInNewContext('uiOpenChampionships()',f.c);await flush();assert.equal(opened,1);assert.equal(f.c.viewedProfile,null);
 assert.match(f.html(),/سجّل الدخول لعرض البطولات/);assert.equal(f.requests.length,0);
});
