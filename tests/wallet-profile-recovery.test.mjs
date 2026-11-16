import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource} from './helpers/source.mjs';
const source=coreSource();
function cut(a,b){const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return source.slice(x,y);}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture({profile={gold:880,rank:120},deferProfile=false}={}){
 const saved=new Map([['wb-gold','500'],['wb-rank','100']]),elements=new Map(),timers=new Map();let next=0,reads=0,resolveProfile;
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,innerHTML:'',attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}});return elements.get(id);};
 const doc={exists:true,metadata:{fromCache:false},data:()=>profile};
 const context=vm.createContext({window:{},document:{hidden:false,getElementById:el,querySelector:()=>null},navigator:{onLine:true},AbortController,Date,Promise,Number,JSON,
  setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},queueMicrotask,
  localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)},ST:{n:k=>Number(saved.get('wb-'+k))||0},
  FB:{user:{uid:'u',getIdToken:async()=> 'token'},db:{collection:()=>({doc:()=>({get:()=>{reads++;return deferProfile?new Promise(r=>resolveProfile=r):Promise.resolve(doc)}})})}},
  ensureFB:async()=>true,$:s=>el(s.slice(1)),rankBadgeHTML:()=>'',refreshRankCard(){},showRankChangeToast(){},animateResultsScreenCounters(){},
  GAME_SRV:'offline.invalid',fetch:()=>new Promise(()=>{}),uiBoundedIdToken:async user=>user.getIdToken(),UI_COST:{statsAt:0},
  avatarHTML:()=>'',myAvatar:()=>'',adRewardRemainingMs:()=>0,renderAdRewardBtn(){},checkDaily:()=>({due:false}),refreshInboxBadge(){},SFX:{tick(){}},openShop(){context.openedShop=true}
 });
 vm.runInContext(cut('const UI_WALLET={','// v368:')+'\n'+cut('const UI_HOME_WALLET={',"window.addEventListener('online',")+'\nlet _pullingStats=false,_statsQueued=false;\n'+cut('async function pullServerStats(retriesLeft){','function refreshRankCard(){')+'\n'+cut('function refreshHome(){','// NEW CODE ================= صندوق الوارد')+'\n'+cut("$('#hGoldBtn').onclick=",'if(!SHOW_GOLD_PURCHASES)')+'\nwindow.wallet=UI_WALLET;window.home=UI_HOME_WALLET;',context);
 const pending={uid:'u',room:'old-room',playerId:'p-user',matchId:'old-room:round:1',kind:'friendly',participationId:'visit-1',at:Date.now(),attempt:0,nextAt:0};
 context.window.home.uid='u';context.window.home.items=[pending];context.uiHomeWalletSave();
 return {context,saved,el,timers,pending,reads:()=>reads,resolve:()=>resolveProfile(doc)};
}
test('an unresolved old departure cannot block a fresh balance while its settlement remains pending',async()=>{
 const f=fixture();await f.context.pullServerStats(0);
 assert.equal(f.reads(),1);assert.equal(f.saved.get('wb-gold'),'880');assert.equal(f.el('hGold').textContent,'880');
 assert.equal(f.context.window.home.items[0],f.pending);assert.ok(f.saved.has('wb-competitive-wallet-pending-u'));
 assert.ok(f.el('hWalletPending').textContent.includes('تسوية سابقة'));
 assert.equal(f.context.uiHomeWalletLeavingRoom('old-room'),true);
});
test('home refresh and manual pending retry both request the current profile without clearing the intent',async()=>{
 const f=fixture();f.context.refreshHome();await flush();assert.equal(f.reads(),1);
 f.el('hGoldBtn').onclick();await flush();assert.equal(f.reads(),2);assert.equal(f.context.window.home.items.length,1);assert.equal(f.context.openedShop,undefined);
});
test('late profile from another account cannot overwrite the selected account or clear its pending settlement',async()=>{
 const f=fixture({deferProfile:true});const request=f.context.pullServerStats(0);await flush();assert.equal(f.reads(),1);
 f.context.FB.user={uid:'other'};f.saved.set('wb-gold','300');f.resolve();await request;
 assert.equal(f.saved.get('wb-gold'),'300');assert.equal(f.context.window.home.items.length,1);
});
test('a newer wallet revision prevents a delayed profile from rolling the balance back',async()=>{
 const f=fixture({deferProfile:true});const request=f.context.pullServerStats(0);await flush();
 f.context.window.wallet.revision++;f.saved.set('wb-gold','990');f.resolve();await request;
 assert.equal(f.saved.get('wb-gold'),'990');assert.equal(f.context.window.home.items.length,1);
});
test('profile timeout releases the read lock so manual retry can recover without dropping the settlement',async()=>{
 const f=fixture({deferProfile:true});const request=f.context.pullServerStats(0);await flush();
 const deadline=[...f.timers.values()].find(t=>t.ms===7000);assert.ok(deadline);deadline.fn();await request;
 const retry=f.context.pullServerStats(0);await flush();assert.equal(f.reads(),2);f.resolve();await retry;
 assert.equal(f.saved.get('wb-gold'),'880');assert.equal(f.context.window.home.items.length,1);
});
