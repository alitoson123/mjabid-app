import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource,webSource} from './helpers/source.mjs';
const core=coreSource(),table=webSource('ui-table-realism.js');
function cut(s,a,b){const x=s.indexOf(a),y=s.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return s.slice(x,y);}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function audioFixture(){
 let now=1000;const sources=[];
 const audio={state:'running',destination:{},createBufferSource(){const s={playbackRate:{value:1},connect(){},disconnect(){},start(){s.started=true;},stop(){s.stopped=true;}};sources.push(s);return s;}};
 const c=vm.createContext({window:{},UI_AUDIO:{gestured:true,generation:0},uiAudioBlocked:()=>false,uiResumeAudioContext:async()=>true,Date:{now:()=>now},setInterval,clearInterval,ONL:{active:true,room:'r',you:'p0',status:'playing',view:{waqf:null}}});
 vm.runInContext(cut(core,'class SoundManager {','const _voiceCache=')+'\nconst GameSoundManager=window.GameSoundManager;\n'+cut(core,'let uiJokerSequence=','function playVoice(')+'\nconst seen={identity:null,key:null};\n'+cut(table,' function audio(){',' window.MajabeedRenderPipeline.registerOnline')+'\nwindow.observe=audio;',c);
 const manager=c.window.GameSoundManager;manager.ctx=audio;manager.buffers={joker:{},drop1:{},drop2:{}};
 return {c,manager,sources,advance:n=>now+=n,observe:()=>c.window.observe(),bid(id,rank=99){c.ONL.view.waqf={holder:'p1',grabs:id,contested:[{id,rank}]};}};
}
test('Joker plays immediately, duplicate renders stay silent, capture end stops the voice',()=>{
 const f=audioFixture();f.observe();f.bid(1);f.observe();assert.equal(f.sources.length,1);assert.ok(f.sources[0].started);f.observe();assert.equal(f.sources.length,1);
 f.c.ONL.view.waqf=null;f.observe();assert.ok(f.sources[0].stopped);f.observe();assert.equal(f.sources.length,1);
});
test('Joker history on first snapshot or another room is not announced',()=>{
 const f=audioFixture();f.bid(1);f.observe();assert.equal(f.sources.length,0);f.c.ONL.room='other';f.bid(2);f.observe();assert.equal(f.sources.length,0);
 f.bid(3);f.observe();assert.equal(f.sources.length,1);f.c.ONL.status='ended';f.observe();assert.ok(f.sources[0].stopped);
});
test('late audio decode cannot speak after capture or after the 450ms freshness window',async()=>{
 for(const ended of [true,false]){const f=audioFixture();delete f.manager.buffers.joker;let resolve;f.manager._load=()=>new Promise(r=>resolve=r);f.observe();f.bid(1);f.observe();
  if(ended){f.c.ONL.view.waqf=null;f.observe();}else f.advance(451);
  f.manager.buffers.joker={};resolve({});await flush();assert.equal(f.sources.length,0);
 }
});
test('a newer bid cancels the previous Joker and a drop sound cannot cancel fresh decoding',async()=>{
 const f=audioFixture();f.observe();f.bid(1);f.observe();f.bid(2,5);f.observe();assert.ok(f.sources[0].stopped);
 delete f.manager.buffers.joker;let resolve;f.manager._load=()=>new Promise(r=>resolve=r);f.bid(3);f.observe();f.manager.playActionSound();f.manager.buffers.joker={};resolve({});await flush();assert.equal(f.sources.length,3);assert.ok(f.sources[2].started);
});
function rentalFixture(){
 const calls=[],store=new Map();const c=vm.createContext({window:{addEventListener(){}},document:{addEventListener(){},hidden:true},FB:{user:{uid:'u'}},Date,performance:{now:()=>0},clearTimeout(){},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000000'},ST:{set:(...x)=>calls.push(x)}});
 vm.runInContext(webSource('ui-theme-rentals.js')+'\nwindow.state=UI_THEME_RENTALS;',c);
 vm.runInContext('applyEquippedTheme=()=>{};uiThemeRenderStatus=()=>{};uiThemePlan=()=>{};',c);
 c.uiThemeSetAccount('u');const quote=price=>({price,serverNow:Date.now(),themes:[{id:'theme-royal',active:true,permanent:false,expiresAt:Date.now()+100000}],gold:400});
 c.uiThemeRequest=async body=>{calls.push(body);return quote(600);};return {c,calls,quote};
}
test('theme rent verifies 600 quote then submits a price cap and updates balance once',async()=>{
 const f=rentalFixture();assert.equal(await f.c.uiThemeRent('theme-royal'),true);assert.equal(f.calls[0].action,'sync');assert.equal(f.calls[1].maxPrice,600);assert.deepEqual(f.calls[2],['gold',400]);
});
test('old 2000 server and failed fresh quote cannot debit even with cached 600 price',async()=>{
 for(const fail of [true,false]){const f=rentalFixture();Object.assign(f.c.window.state,{verified:true,data:f.quote(600)});f.c.uiThemeRequest=async body=>{f.calls.push(body);if(fail)throw Error('offline');return f.quote(2000);};await assert.rejects(f.c.uiThemeRent('theme-royal'));assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'sync');}
});
test('account switch during price verification cannot purchase for either account',async()=>{
 const f=rentalFixture();f.c.uiThemeRequest=async body=>{f.calls.push(body);f.c.FB.user={uid:'other'};return f.quote(600);};await assert.rejects(f.c.uiThemeRent('theme-royal'));assert.equal(f.calls.length,1);
});
