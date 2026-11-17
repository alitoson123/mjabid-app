import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource} from './helpers/source.mjs';
const core=coreSource(),start=core.indexOf('function uiFriendlyEntryCancel('),end=core.indexOf('\nconst ONL=',start),code=core.slice(start,end);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(overrides={}){
 const nodes=new Map(),toasts=[],joins=[],timers=new Map(),location={pathname:'/index.html',search:'?room=friends',hash:''};let serial=0,calls=0;
 const state={info:{ok:true,room:'friends',exists:true,status:'lobby',entryAmount:100,friendlyEconomy:{version:369,entryFee:100,winGold:250},friendlyMatchId:'session',friendlyParticipationId:'visit',admission:{allowed:false,code:'insufficient_gold',amount:100,balance:99,shortfall:1},...overrides},fetchHook:null};
 function element(){const e={id:'',dataset:{},style:{},hidden:false,disabled:false,onclick:null,textContent:'',setAttribute(){},classList:{add(){},remove(){}}};Object.defineProperty(e,'innerHTML',{set(html){e.html=html;for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const child=element();child.id=m[1];child.hidden=/\bhidden(?:\s|>)/.test(m[0]);nodes.set(child.id,child);}},get(){return e.html||'';}});e.remove=()=>{nodes.delete(e.id);for(const key of [...nodes.keys()])if(key.startsWith('uiFriendlyEntry'))nodes.delete(key);};return e;}
 const document={hidden:false,getElementById:id=>nodes.get(id)||null,addEventListener(){},createElement:element,body:{appendChild(e){nodes.set(e.id,e);}}};
 const context=vm.createContext({document,location,URLSearchParams,AbortController,Promise,Number,
  window:{addEventListener(){}},history:{replaceState(_a,_b,url){const u=new URL(url,'https://test.invalid');location.search=u.search;location.hash=u.hash;}},
  localStorage:{getItem:()=> 'p1',setItem(){}},sessionStorage:{getItem:()=>null},FB:{user:{uid:'u1',getIdToken:async()=> 'test-id-token'}},ONL:{active:false,room:'friends',generation:1,spectateOnly:false},MATCH:{on:false},
  UI_FRIENDLY_ENTRY:{serial:0,room:null,controller:null,approval:null,viewerReturn:null},GAME_SRV:'offline.invalid',uiFriendlyEconomy:p=>p?.version===369?p:null,toH:x=>String(x),
  uiSpectatorCanJoin:()=>true,uiRenderSpectatorJoin(){},uiRequestSpectatorSeat:approval=>joins.push({seat:true,approval}),goHome(){},show(){},uiRememberRoom(){},toast2:m=>toasts.push(m),enterOnline:()=>joins.push({route:location.search,approval:context.UI_FRIENDLY_ENTRY.approval}),
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  fetch:async()=>{calls++;return state.fetchHook?state.fetchHook():{ok:true,json:async()=>structuredClone(state.info)};}});
 vm.runInContext(code,context);
 return {state,context,nodes,joins,toasts,location,timers,calls:()=>calls,node:id=>nodes.get(id),open:options=>context.uiFriendlyEntryOpen('friends',options)};
}

test('insufficient gold is shown before lobby entry with no play handler or admission approval',async()=>{
 const f=fixture();await f.open();assert.match(f.node('uiFriendlyEntryText').textContent,/رصيدك لا يكفي/);assert.match(f.node('uiFriendlyEntryText').textContent,/100.*99/);assert.equal(f.node('uiFriendlyEntryPlay').hidden,true);assert.equal(f.node('uiFriendlyEntryPlay').disabled,true);assert.equal(f.node('uiFriendlyEntryPlay').onclick,null);assert.equal(f.node('uiFriendlyEntryRetry').hidden,false);assert.equal(f.context.UI_FRIENDLY_ENTRY.approval,null);assert.equal(f.joins.length,0);
 f.node('uiFriendlyEntryWatch').onclick();assert.equal(f.joins.length,1);assert.match(f.joins[0].route,/spectate=1/);assert.equal(f.joins[0].approval,null);
});
test('wallet pending stays outside the lobby and retry obtains a fresh allowed quote',async()=>{
 const f=fixture({admission:{allowed:false,code:'wallet_pending',amount:100}});await f.open();assert.match(f.node('uiFriendlyEntryText').textContent,/تعذّر التحقق من رصيدك/);assert.equal(f.joins.length,0);
 f.state.info.admission={allowed:true,code:'allowed',amount:100,balance:100};f.node('uiFriendlyEntryRetry').onclick();await flush();assert.equal(f.calls(),2);assert.equal(f.node('uiFriendlyEntryPlay').hidden,false);assert.equal(f.joins.length,0);f.node('uiFriendlyEntryPlay').onclick();assert.equal(f.joins.length,1);assert.equal(f.joins[0].approval.version,369);assert.equal(f.joins[0].approval.participationId,'visit');
});
test('room-change denial is explicit and cannot auto-restore a falsely marked paid quote',async()=>{
 const f=fixture({paid:true,entryAmount:0,admission:{allowed:false,code:'room_changed',amount:0}});await f.open({restore:true});assert.match(f.node('uiFriendlyEntryText').textContent,/تغيّرت الجلسة/);assert.equal(f.joins.length,0);assert.equal(f.node('uiFriendlyEntryPlay').hidden,true);
});
test('verified free VIP participation and trusted paid restoration preserve their existing flows',async()=>{
 const vip=fixture({vip:true,entryAmount:0,admission:{allowed:true,code:'allowed',amount:0}});await vip.open();assert.equal(vip.node('uiFriendlyEntryPlay').textContent,'الانضمام مجانًا');assert.equal(vip.joins.length,0);vip.node('uiFriendlyEntryPlay').onclick();assert.equal(vip.joins.length,1);
 const paid=fixture({paid:true,entryAmount:0,admission:{allowed:true,code:'allowed',amount:0}});await paid.open({restore:true});assert.equal(paid.joins.length,1);assert.equal(paid.node('uiFriendlyEntry'),undefined);
});
test('old server quotes without the additive admission field remain compatible',async()=>{
 const f=fixture({admission:undefined});await f.open();assert.equal(f.node('uiFriendlyEntryPlay').hidden,false);f.node('uiFriendlyEntryPlay').onclick();assert.equal(f.joins.length,1);
});
test('malformed admission or failed transport never enables participation and offers retry',async()=>{
 for(const admission of [{allowed:'true',code:'allowed',amount:100},{allowed:true,code:'insufficient_gold',amount:100},{allowed:true,code:'allowed',amount:0},null]){const f=fixture({admission});await f.open();assert.equal(f.joins.length,0);assert.equal(f.node('uiFriendlyEntryPlay').hidden,true);assert.equal(f.node('uiFriendlyEntryRetry').hidden,false);}
 const f=fixture();f.state.fetchHook=()=>{throw Error('offline');};await f.open();assert.match(f.node('uiFriendlyEntryText').textContent,/تعذّر التحقق/);assert.equal(f.node('uiFriendlyEntryRetry').hidden,false);assert.equal(f.joins.length,0);
});
test('an account change discards a late positive admission and stale button handlers cannot enter',async()=>{
 const f=fixture({admission:{allowed:true,code:'allowed',amount:100,balance:100}});await f.open();const stale=f.node('uiFriendlyEntryPlay').onclick;f.state.info.admission={allowed:false,code:'insufficient_gold',amount:100,balance:0};await f.open();stale();assert.equal(f.joins.length,0);
 let resolve;const pending=new Promise(r=>{resolve=r;});f.state.fetchHook=()=>pending;const opening=f.open();await flush();f.context.FB.user={uid:'u2',getIdToken:async()=> 'other'};resolve({ok:true,json:async()=>({...f.state.info,admission:{allowed:true,code:'allowed',amount:100,balance:100}})});await opening;assert.equal(f.joins.length,0);assert.equal(f.node('uiFriendlyEntryPlay').hidden,true);
});
test('an insufficient spectator stays on the same viewing session and can dismiss the quote',async()=>{
 const f=fixture();Object.assign(f.context.ONL,{active:true,spectateOnly:true,view:{},generation:7});f.location.search='?room=friends&spectate=1';await f.open({fromSpectator:true});assert.equal(f.joins.length,0);f.node('uiFriendlyEntryWatch').onclick();assert.equal(f.context.ONL.active,true);assert.equal(f.context.ONL.spectateOnly,true);assert.equal(f.context.ONL.generation,7);assert.equal(f.joins.length,0);assert.equal(f.node('uiFriendlyEntry'),undefined);
});
