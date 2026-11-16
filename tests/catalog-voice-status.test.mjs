import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webSource} from './helpers/source.mjs';

const source=webSource('ui-sessions-catalog.js');
function fixture(){
 const listeners={},sections=[],joins=[];
 const classes=()=>{const values=new Set();return {add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v)};};
 const panel={dataset:{},classList:classes(),addEventListener:(name,fn)=>listeners[name]=fn,append:node=>sections.push(node)};
 const tools={dataset:{},querySelector:()=>({hidden:false})};
 const list={children:[],querySelectorAll:()=>[...list.children],insertBefore(node,before){const old=this.children.indexOf(node);if(old>=0)this.children.splice(old,1);const at=this.children.indexOf(before);this.children.splice(at<0?this.children.length:at,0,node);}};
 function article(html){return {html,dataset:{sessionId:html.match(/data-session-id="([^"]+)"/)[1]},replaceWith(next){list.children[list.children.indexOf(this)]=next;},remove(){list.children.splice(list.children.indexOf(this),1);}};}
 const document={body:{},getElementById:id=>({sessionsModal:panel,sessionsTools:tools,sessionsList:list})[id]||null,querySelectorAll:()=>[],createElement(tag){
  if(tag==='template')return {content:{},set innerHTML(html){this.content.firstElementChild=article(html);}};
  assert.equal(tag,'section');const content={innerHTML:''},button={focus(){}};
  return {dataset:{},setAttribute(){},set innerHTML(html){content.innerHTML=html.split('<div class="scDetailContent">')[1].slice(0,-6);},querySelector:s=>s==='button'?button:content,remove(){sections.splice(sections.indexOf(this),1);}};
 }};
 const c={document,URL,MutationObserver:class{observe(){}},fetch:()=>{throw Error('Catalog status must reuse directory data');},setInterval:()=>{throw Error('Catalog status must not poll voice endpoints');}};c.window=c;
 vm.runInNewContext(source,c);
 const render=(game,rows)=>c.MajabeedSessionsCatalog.render({game,rows,uid:'viewer',onJoin:(...args)=>joins.push(args)});
 const click=(action,id)=>{const button={dataset:{scAction:action,room:id},isConnected:true,focus(){}};listeners.click({target:{closest:selector=>selector==='[data-sc-action]'?button:null}});};
 return {catalog:c.MajabeedSessionsCatalog,list,sections,joins,render,click};
}
function row(game,extra={}){
 return {id:'TABLE001',name:'جلسة الأصدقاء',mode:game==='baloot'?'friendly':'team',status:'playing',seats:[{name:'صديق'},null,null,null],players:[{name:'صديق'},null,null,null],openSeats:[1,2,3],friendlyEconomy:{entryFee:100},...extra};
}

for(const game of ['majabeed','baloot']){
 test(game+': authoritative voice permission is distinct from text chat and preserved in details',()=>{
  const f=fixture(),open=row(game,{friendlyVoiceEnabled:true,friendlyChatEnabled:false});f.render(game,[open]);
  let html=f.list.children[0].html;
  assert.match(html,/scVoiceStatus isAllowed/);assert.match(html,/المحادثة الصوتية مسموحة/);assert.match(html,/الشات مغلق/);
  assert.match(html,/المشاركة 100 ذهب/);assert.match(html,/data-sc-action="join"/);assert.match(html,/data-sc-action="watch"/);
  f.click('details',open.id);assert.match(f.sections[0].querySelector('.scDetailContent').innerHTML,/المحادثة الصوتية مسموحة/);
  const closed={...open,friendlyVoiceEnabled:false,friendlyChatEnabled:true};f.render(game,[closed]);html=f.list.children[0].html;
  assert.match(html,/scVoiceStatus isBlocked/);assert.match(html,/المحادثة الصوتية غير مسموحة/);assert.match(html,/الشات مفتوح/);
  assert.match(f.sections[0].querySelector('.scDetailContent').innerHTML,/المحادثة الصوتية غير مسموحة/);
  assert.doesNotMatch(f.sections[0].querySelector('.scDetailContent').innerHTML,/scVoiceStatus isAllowed/);
  f.click('join',closed.id);f.click('watch',closed.id);assert.deepEqual(f.joins,[[closed.id,false],[closed.id,true]]);
 });
 test(game+': legacy or malformed metadata never invents a voice permission',()=>{
  const f=fixture();
  for(const friendlyVoiceEnabled of [undefined,null,'true','false',0,1,{}]){
   const old=row(game,{friendlyVoiceEnabled});assert.equal(f.catalog.model(old,game,'viewer').voiceEnabled,null);
   const html=f.catalog.card(old,game,'viewer');assert.doesNotMatch(html,/scVoiceStatus|المحادثة الصوتية/);assert.match(html,/data-sc-action="join"/);
  }
  f.render(game,[row(game,{friendlyVoiceEnabled:true})]);f.click('details','TABLE001');
  f.render(game,[row(game)]);assert.doesNotMatch(f.list.children[0].html,/scVoiceStatus/);assert.doesNotMatch(f.sections[0].querySelector('.scDetailContent').innerHTML,/scVoiceStatus/);
 });
 test(game+': receiving a complete directory record adds the badge without mutating the record',()=>{
  const f=fixture(),old=row(game);f.render(game,[old]);
  const fresh=Object.freeze({...old,friendlyVoiceEnabled:false}),snapshot=JSON.stringify(fresh);f.render(game,[fresh]);
  assert.match(f.list.children[0].html,/المحادثة الصوتية غير مسموحة/);assert.equal(JSON.stringify(fresh),snapshot);
  const unchanged=f.list.children[0];f.render(game,[fresh]);assert.equal(f.list.children[0],unchanged);
 });
}
