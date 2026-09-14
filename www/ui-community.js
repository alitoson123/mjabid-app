'use strict';
// v347: profile subpages and event-driven public notices; no game state or polling.
const UI_COMMUNITY={data:{home:null,chat:null},loaded:0,pending:null,retryAfter:0};
function uiProfileSelect(key,focus=false){
 const tabs=Array.from(document.querySelectorAll('#pfTabs [data-pf-tab]'));
 const tab=tabs.find(t=>t.dataset.pfTab===key&&!t.hidden)||tabs[0];
 for(const t of tabs){const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;}
 const pages=document.getElementById('pfPages');if(pages)pages.scrollTop=0;
 if(tab.dataset.pfTab!=='account'&&typeof uiClearProfilePassword==='function')uiClearProfilePassword();
 if(focus)tab.focus();
}
function uiProfileOpen(){
 const other=!!viewedProfile;
 document.getElementById('pfTabHistory').hidden=other;
 document.getElementById('pfTabAccount').hidden=other;
 const league=document.getElementById('lgProfile');
 if(league)document.getElementById('pfPanelAchievements').prepend(league);
 const actions=document.getElementById('pfProfileActions');actions.hidden=!other;
 for(const id of ['pfAddFriend','pfReport']){const button=document.getElementById(id);if(button)actions.appendChild(button);}
 document.getElementById('pfHistoryEmpty').hidden=document.getElementById('pfHistory').style.display!=='none';
 uiProfileSelect('overview');
}
document.querySelectorAll('#pfTabs [data-pf-tab]').forEach(tab=>{
 tab.onclick=()=>uiProfileSelect(tab.dataset.pfTab);
 tab.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const tabs=Array.from(document.querySelectorAll('#pfTabs [data-pf-tab]')).filter(t=>!t.hidden),i=tabs.indexOf(tab);
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length;
  e.preventDefault();uiProfileSelect(tabs[next].dataset.pfTab,true);
 };
});
function uiNoticeValue(v){
 if(!v||v.enabled!==true||typeof v.title!=='string'||!v.title.trim()||v.title.length>70||typeof v.body!=='string'||!v.body.trim()||v.body.length>300)return null;
 let url='';try{const u=new URL(v.url);if(u.protocol==='https:'&&!u.username&&!u.password&&v.url.length<=500)url=u.href;}catch(_){}
 return {title:v.title,body:v.body,url,button:typeof v.button==='string'?v.button.slice(0,30):''};
}
function uiNoticesRender(){
 for(const slot of ['home','chat']){
  const prefix=slot==='home'?'uiHomeNotice':'uiChatNotice',el=document.getElementById(prefix);
  if(!el)continue;
  const v=uiNoticeValue(UI_COMMUNITY.data[slot]);
  el.hidden=!v||(slot==='chat'&&CHAT_MODE!=='public');
  if(slot==='home')el.parentElement.classList.toggle('uiHasNotice',!el.hidden);
  if(el.hidden)continue;
  document.getElementById(prefix+'Title').textContent=v.title;
  document.getElementById(prefix+'Body').textContent=v.body;
  const link=document.getElementById(prefix+'Link');link.hidden=!v.url||!v.button;
  link.removeAttribute('href');if(!link.hidden){link.href=v.url;link.textContent=v.button;}
 }
}
async function uiNoticesLoad(){
 const m=UI_COMMUNITY,now=Date.now();
 if(document.hidden||m.pending||now-m.loaded<60000||now<m.retryAfter)return;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 m.pending=(async()=>{
  await Promise.resolve();
  try{
   const res=await fetch('https://'+GAME_SRV+'/site-notices',{signal:controller.signal});
   if(!res.ok)throw Error('notices unavailable');const data=await res.json();if(data.ok!==true)throw Error('notices unavailable');
   m.data={home:data.home||null,chat:data.chat||null};m.loaded=Date.now();
   // At most one small public record, with a fixed key; no profile or password data.
   try{localStorage.setItem('mj-site-notices-v347',JSON.stringify({data:m.data,loaded:m.loaded}));}catch(_){}
  }catch(_){m.retryAfter=Date.now()+60000;}
  finally{clearTimeout(timer);m.pending=null;uiNoticesRender();}
 })();
 return m.pending;
}
function uiCommunityRoute(id){
 if(id==='profile')uiProfileOpen();else if(typeof uiClearProfilePassword==='function')uiClearProfilePassword();
 uiNoticesRender();
 if(id==='home'||(id==='chat'&&CHAT_MODE==='public'))uiNoticesLoad();
}
try{const cached=JSON.parse(localStorage.getItem('mj-site-notices-v347')||'null');if(cached&&Number.isFinite(cached.loaded)&&Date.now()-cached.loaded>=0&&Date.now()-cached.loaded<60000){UI_COMMUNITY.data=cached.data||{};UI_COMMUNITY.loaded=cached.loaded;}}catch(_){}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){uiClearProfilePassword();return;}
 const active=document.querySelector('.screen:not(.hidden)');if(active&&['home','chat'].includes(active.id))uiCommunityRoute(active.id);
});
window.addEventListener('pagehide',()=>uiClearProfilePassword());
uiNoticesRender();

{const active=document.querySelector(".screen:not(.hidden)");if(active&&["home","chat","profile"].includes(active.id))uiCommunityRoute(active.id);}
