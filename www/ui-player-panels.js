/* v365 — player identity presentation only; no fields are added to game state.
 * Real ranks reuse the loaded self profile or one bounded, cached document read.
 * No listeners, timers, alarms, collection scans, or writes are introduced.
 */
'use strict';
const UI_PLAYER_PANELS={
  account:null,generation:0,room:'',roomGeneration:0,profileUid:null,
  cache:new Map(),pending:new Map(),queue:[],serial:0,
  cacheLimit:64,concurrency:2,successAge:600000,failureAge:60000
};
function uiPlayerPanelUid(value){
  return typeof value==='string'&&value.length>0&&value.length<=128&&!value.includes('/')?value:null;
}
function uiPlayerPanelRank(value){
  if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))return null;
  const rank=Number(value);return Number.isSafeInteger(rank)&&rank>=0?rank:null;
}
function uiPlayerPanelsAccount(){
  try{return uiPlayerPanelUid(FB.user&&FB.user.uid);}catch(e){return null;}
}
function uiPlayerPanelsReset(uid=null){
  const state=UI_PLAYER_PANELS;
  state.account=uiPlayerPanelUid(uid);state.generation++;state.profileUid=null;
  state.room='';state.roomGeneration++;state.queue=[];state.cache.clear();
  // Firestore get() cannot be cancelled. Keep outstanding slots counted until
  // they settle, even across logout, so rapid account changes cannot fan out.
}
function uiPlayerPanelsRoom(room){
  const state=UI_PLAYER_PANELS,next=typeof room==='string'?room:'';
  const account=uiPlayerPanelsAccount();
  if(state.account!==account)uiPlayerPanelsReset(account);
  if(next===state.room)return;
  state.room=next;state.roomGeneration++;state.queue=[];
}
function uiPlayerPanelsRemember(uid,rank){
  const state=UI_PLAYER_PANELS;
  state.cache.delete(uid);state.cache.set(uid,{rank,at:Date.now()});
  while(state.cache.size>state.cacheLimit)state.cache.delete(state.cache.keys().next().value);
}
function uiPlayerPanelsProfileLoaded(uid,data){
  if(uid!==uiPlayerPanelsAccount())return;
  const state=UI_PLAYER_PANELS;
  if(state.account!==uid)uiPlayerPanelsReset(uid);
  const rank=uiPlayerPanelRank(data&&data.rank);
  state.profileUid=rank===null?null:uid;
  uiPlayerPanelsRemember(uid,rank);
  uiPlayerPanelsPaintCurrent(uid,rank);
}
function uiPlayerPanelsSelfRank(uid){
  const state=UI_PLAYER_PANELS;
  if(uid!==state.account||uid!==state.profileUid||uid!==uiPlayerPanelsAccount())return null;
  try{
    // Validate the raw value first: ST.n defaults absent data to 0 and accepts
    // partial strings. Neither is evidence of a real competitive rank.
    const raw=localStorage.getItem('wb-rank'),rank=uiPlayerPanelRank(raw);
    return rank!==null&&uiPlayerPanelRank(ST.n('rank'))===rank?rank:null;
  }catch(e){return null;}
}
function uiPlayerPanelsWriteRank(el,rank,bot){
  const target=el.querySelector('.uiSeatRank');if(!target)return;
  const key=bot?'bot':rank===null?'unknown':'rank:'+rank;
  if(target.dataset.playerRankKey===key)return;
  target.dataset.playerRankKey=key;
  if(!bot&&rank!==null&&typeof rankBadgeHTML==='function'){
    target.innerHTML=rankBadgeHTML(rank,8);
    target.removeAttribute('title');target.setAttribute('aria-label','الرتبة التنافسية');
  }else{
    const role=document.createElement('span');role.className='uiSeatRole';
    role.textContent=bot?'كمبيوتر':'—';target.replaceChildren(role);
    target.setAttribute('title',bot?'لاعب كمبيوتر':'الرتبة غير متاحة');
    target.setAttribute('aria-label',bot?'لاعب كمبيوتر':'الرتبة غير متاحة');
  }
}
function uiPlayerPanelsPaintCurrent(uid,rank){
  const state=UI_PLAYER_PANELS;
  if(!state.room||state.account!==uiPlayerPanelsAccount())return;
  // Re-query current panels; asynchronous reads retain no detached DOM nodes.
  for(const el of document.querySelectorAll('.uiPlayerPanel')){
    if(el.isConnected&&el.dataset.playerUid===uid&&el.dataset.playerBot!=='true'&&
      el.dataset.playerGeneration===String(state.generation)&&
      el.dataset.playerRoom===String(state.roomGeneration))uiPlayerPanelsWriteRank(el,rank,false);
  }
}
function uiPlayerPanelsDrain(){
  const state=UI_PLAYER_PANELS;
  while(state.pending.size<state.concurrency&&state.queue.length){
    const task=state.queue.shift();
    if(task.generation!==state.generation||task.room!==state.roomGeneration||
      !state.room||state.account!==uiPlayerPanelsAccount())continue;
    let db;try{if(!FB.ready||!FB.db)continue;db=FB.db;}catch(e){continue;}
    const token=++state.serial;state.pending.set(token,task);
    Promise.resolve().then(()=>{
      if(task.generation!==state.generation||task.room!==state.roomGeneration||
        !state.room||state.account!==uiPlayerPanelsAccount())return null;
      return db.collection('players').doc(task.uid).get();
    }).then(doc=>{
      if(!doc||task.generation!==state.generation||state.account!==uiPlayerPanelsAccount())return;
      const rank=doc.exists?uiPlayerPanelRank(doc.data().rank):null;
      uiPlayerPanelsRemember(task.uid,rank);
      // A previous room may populate the cache, but never paint the new room.
      if(task.room===state.roomGeneration)uiPlayerPanelsPaintCurrent(task.uid,rank);
    }).catch(()=>{
      if(task.generation===state.generation&&state.account===uiPlayerPanelsAccount()){
        uiPlayerPanelsRemember(task.uid,null);
        if(task.room===state.roomGeneration)uiPlayerPanelsPaintCurrent(task.uid,null);
      }
    }).finally(()=>{state.pending.delete(token);uiPlayerPanelsDrain();});
  }
}
function uiPlayerPanelsRequest(uid){
  const state=UI_PLAYER_PANELS;
  if(!state.room||!state.account||state.account!==uiPlayerPanelsAccount())return;
  if(state.queue.some(task=>task.uid===uid&&task.generation===state.generation))return;
  if(Array.from(state.pending.values()).some(task=>task.uid===uid&&task.generation===state.generation))return;
  // Only four current seats can request a rank. The small queue also caps
  // work if a malformed room sends many identities before requests finish.
  if(state.queue.length>=4)return;
  state.queue.push({uid,generation:state.generation,room:state.roomGeneration});
  uiPlayerPanelsDrain();
}
function uiPaintPlayerPanel(el,options={}){
  if(!el)return;
  const state=UI_PLAYER_PANELS,account=uiPlayerPanelsAccount();
  if(state.account!==account)uiPlayerPanelsReset(account);
  const tone=Number.isInteger(options.tone)&&options.tone>=0&&options.tone<4?options.tone:0;
  const uid=uiPlayerPanelUid(options.uid),bot=options.bot===true;
  el.classList.add('uiPlayerPanel');el.dataset.playerTone=String(tone);
  el.dataset.playerUid=uid||'';el.dataset.playerBot=String(bot);
  el.dataset.playerGeneration=String(state.generation);el.dataset.playerRoom=String(state.roomGeneration);
  const name=el.querySelector('.nm');if(!name)return;
  if(!name.querySelector('.uiPlayerName')){
    const label=document.createElement('span');label.className='uiPlayerName';
    while(name.firstChild)label.appendChild(name.firstChild);name.appendChild(label);
  }
  if(!name.querySelector('.uiSeatRank')){
    const badge=document.createElement('span');badge.className='uiSeatRank';name.appendChild(badge);
  }
  if(bot){uiPlayerPanelsWriteRank(el,null,true);return;}
  const selfRank=options.self===true&&uid?uiPlayerPanelsSelfRank(uid):null;
  if(selfRank!==null){uiPlayerPanelsWriteRank(el,selfRank,false);return;}
  const cached=uid&&state.cache.get(uid);
  if(cached&&Date.now()-cached.at<(cached.rank===null?state.failureAge:state.successAge)){
    uiPlayerPanelsWriteRank(el,cached.rank,false);return;
  }
  uiPlayerPanelsWriteRank(el,null,false);
  if(uid)uiPlayerPanelsRequest(uid);
}
