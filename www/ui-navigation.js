/* v364 — shared navigation. Existing destination functions own data loading. */
const UI_NAV={screen:'home',active:'home',open:false,trigger:null,locked:[],badges:{chat:0,friends:0,inbox:0},animation:null};
const UI_NAV_ICONS={
 home:'<rect x="3" y="5" width="11" height="16" rx="2" transform="rotate(-12 8 13)"/><rect x="10" y="3" width="11" height="16" rx="2" transform="rotate(10 15 11)"/><path d="m15.5 7 2.5 4-2.5 4-2.5-4 2.5-4Z"/>',
 chat:'<path d="M21 11a8 8 0 0 1-8 8H7l-5 3V11a9 9 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/>',
 leagues:'<path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 12v7m-4 2h8M3 17h3m12 0h3"/>',
 friends:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-4-5.65"/>',
 more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
 profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 board:'<path d="M9 21V3h6v18M3 21V10h6m6-6h6v17M1 21h22"/>',
 shop:'<path d="M3 9 5 3h14l2 6M4 10v11h16V10M9 21v-7h6v7"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
 sessions:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M8 3v3m8-3v3M8 18v3m8-3v3M3 12H1m22 0h-2"/>',
 inbox:'<path d="M3 5h18v15H3zM3 7l9 6 9-6"/>',
 awards:'<path d="m8 3 4 6 4-6M5 3h14M9 17l-1 5 4-2 4 2-1-5"/><circle cx="12" cy="13" r="5"/>',
 rules:'<path d="M12 5c-3-2-6-2-9-1v16c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v16"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const NAV_ITEMS=[
 {k:'chat',label:'الدردشة',go:()=>openChat()},
 {k:'leagues',label:'الدوريات',go:()=>lgOpen()},
 {k:'home',label:'الرئيسية',go:()=>goHome()},
 {k:'friends',label:'الأصدقاء',go:()=>openFriends()},
 {k:'more',label:'المزيد',go:trigger=>uiNavOpenMore(trigger)}
];
function uiNavIcon(key){return '<svg class="ic" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(UI_NAV_ICONS[key]||UI_NAV_ICONS.more)+'</svg>';}
function uiNavActive(key){return NAV_ITEMS.some(it=>it.k===key)?key:'more';}
function uiNavActions(){return [
 {k:'profile',label:'الملف الشخصي',go:()=>openProfile()},
 {k:'board',label:'الصدارة',go:()=>openBoard()},
 ...(SHOW_STORE?[{k:'shop',label:'المتجر',go:()=>openShop()}]:[]),
 {k:'sessions',label:'الجلسات النشطة',go:()=>document.getElementById('hSessions')?.click(),modal:'sessionsModal'},
 {k:'inbox',label:'صندوق الوارد',go:()=>document.getElementById('hInbox')?.click(),modal:'inboxModal'},
 {k:'awards',label:'الأوسمة',go:()=>openAwards()},
 {k:'rules',label:'تعليمات اللعب',go:()=>document.getElementById('hRules')?.click(),modal:'rules'},
 {k:'help',label:'المساعدة',go:()=>document.getElementById('hHelp')?.click(),modal:'helpModal'}
];}
function navHTML(active){
 const selected=uiNavActive(active);
 return '<div class="navBar" role="navigation" aria-label="القائمة الرئيسية">'+NAV_ITEMS.map(it=>
  '<button type="button" class="navBtn'+(it.k===selected?' on':'')+'" data-nav="'+it.k+'" aria-label="'+it.label+'"'+(it.k===selected?' aria-current="page"':'')+(it.k==='more'?' aria-haspopup="dialog" aria-controls="uiMoreMenu" aria-expanded="false"':'')+'><span class="uiNavIcon">'+uiNavIcon(it.k)+'<span class="uiNavBadge" hidden></span></span><span class="uiNavLabel">'+it.label+'</span></button>'
 ).join('')+'</div>';
}
function mountNav(screenId,active){
 const sc=document.getElementById(screenId);if(!sc)return;
 UI_NAV.screen=screenId;UI_NAV.active=active;
 const holder=screenId==='home'?sc:(sc.querySelector('[data-navholder]')||sc);
 let bar=sc.querySelector('.navBar');
 if(!bar){const wrap=document.createElement('div');wrap.innerHTML=navHTML(active);bar=wrap.firstElementChild;holder.appendChild(bar);}
 if(bar.parentElement!==holder)holder.appendChild(bar);
 const selected=uiNavActive(active);
 bar.querySelectorAll('.navBtn').forEach(button=>{
  const key=button.dataset.nav,on=key===selected;button.classList.toggle('on',on);
  if(on)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  if(key==='more')button.setAttribute('aria-expanded',String(UI_NAV.open));
  button.onclick=()=>{
   const item=NAV_ITEMS.find(it=>it.k===key);if(!item||(on&&key!=='more'))return;
   SFX.tick();uiNavCloseMore(false);item.go(button);
   if(key!=='more'&&key!=='leagues')uiNavFocusCurrent();
  };
 });
 uiNavRefreshBadges();
}
function uiNavFocusCurrent(){
 const screen=document.getElementById(UI_NAV.screen);
 screen?.querySelector('.navBtn.on')?.focus({preventScroll:true});
}
function uiNavRefreshBadges(){
 document.querySelectorAll('.navBtn').forEach(button=>{
  const key=button.dataset.nav,n=UI_NAV.badges[key]||0,badge=button.querySelector('.uiNavBadge');if(!badge)return;
  badge.hidden=n<=0;
  // Chat and friend-request reads are paginated: dots avoid claiming global totals.
  const dot=key==='chat'||key==='friends';
  badge.textContent=dot?'':n>99?'99+':String(n);
  badge.classList.toggle('is-dot',dot);
  const label=NAV_ITEMS.find(it=>it.k===key)?.label||key;
  button.setAttribute('aria-label',label+(n>0?(key==='chat'?'، توجد رسائل خاصة غير مقروءة':'، توجد طلبات صداقة'):''));
 });
 const badge=document.querySelector('#uiMoreMenu [data-nav-action="inbox"] .uiMoreBadge');
 if(badge){const n=UI_NAV.badges.inbox||0;badge.hidden=n<=0;badge.textContent=n>99?'99+':String(n);}
}
function uiNavSetBadge(key,count){
 if(!Object.prototype.hasOwnProperty.call(UI_NAV.badges,key))return;
 const value=Number(count);UI_NAV.badges[key]=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;uiNavRefreshBadges();
}
function uiNavMoreMount(){
 let menu=document.getElementById('uiMoreMenu');if(menu)return menu;
 menu=document.createElement('section');menu.id='uiMoreMenu';menu.hidden=true;
 menu.setAttribute('role','dialog');menu.setAttribute('aria-modal','true');menu.setAttribute('aria-labelledby','uiMoreTitle');
 menu.innerHTML='<button class="uiMoreBackdrop" type="button" data-nav-close aria-label="إغلاق المزيد" tabindex="-1"></button><div class="uiMorePanel"><header><div><small>مجابيد</small><h2 id="uiMoreTitle">المزيد</h2></div><button id="uiMoreClose" type="button" aria-label="إغلاق المزيد">'+uiNavIcon('close')+'</button></header><div class="uiMoreGrid"></div></div>';
 (document.getElementById('frame')||document.body).appendChild(menu);
 menu.addEventListener('click',event=>{
  if(event.target.closest('[data-nav-close],#uiMoreClose')){uiNavCloseMore();return;}
  const tile=event.target.closest('[data-nav-action]');if(!tile)return;
  const action=uiNavActions().find(it=>it.k===tile.dataset.navAction);if(!action)return;
  SFX.tick();uiNavCloseMore(false);action.go();
  if(action.modal)document.getElementById(action.modal)?.querySelector('button,input,textarea')?.focus({preventScroll:true});
  else uiNavFocusCurrent();
 });
 return menu;
}
function uiNavOpenMore(trigger){
 if(['game','onl','waqf','match','results'].includes(UI_NAV.screen))return;
 const menu=uiNavMoreMount();if(UI_NAV.open)return;
 UI_NAV.trigger=trigger||document.activeElement;
 menu.querySelector('.uiMoreGrid').innerHTML=uiNavActions().map(it=>'<button class="uiMoreAction" type="button" data-nav-action="'+it.k+'"'+(UI_NAV.active===it.k?' aria-current="page"':'')+'><span class="uiMoreIcon">'+uiNavIcon(it.k)+(it.k==='inbox'?'<span class="uiMoreBadge" hidden></span>':'')+'</span><span class="uiMoreLabel">'+it.label+'</span></button>').join('');
 UI_NAV.locked=Array.from(menu.parentElement.children).filter(el=>el!==menu).map(el=>({el,inert:el.inert,aria:el.getAttribute('aria-hidden')}));
 for(const record of UI_NAV.locked){record.el.inert=true;record.el.setAttribute('aria-hidden','true');}
 UI_NAV.open=true;menu.hidden=false;
 document.querySelectorAll('.navBtn[data-nav="more"]').forEach(el=>el.setAttribute('aria-expanded','true'));
 uiNavRefreshBadges();document.getElementById('uiMoreClose')?.focus({preventScroll:true});
}
function uiNavCloseMore(restore=true){
 if(!UI_NAV.open)return;
 UI_NAV.open=false;const menu=document.getElementById('uiMoreMenu');if(menu)menu.hidden=true;
 for(const record of UI_NAV.locked){record.el.inert=record.inert;if(record.aria===null)record.el.removeAttribute('aria-hidden');else record.el.setAttribute('aria-hidden',record.aria);}
 UI_NAV.locked=[];
 document.querySelectorAll('.navBtn[data-nav="more"]').forEach(el=>el.setAttribute('aria-expanded','false'));
 const trigger=UI_NAV.trigger;UI_NAV.trigger=null;
 if(restore&&trigger?.isConnected&&!trigger.closest('.hidden'))trigger.focus({preventScroll:true});
}
function uiNavRoute(id,overlay=false){
 uiNavCloseMore(false);UI_NAV.animation?.cancel();UI_NAV.animation=null;
 if(overlay)return;
 UI_NAV.screen=id;
 if(['profile','awardsScr','shop','lboard'].includes(id))mountNav(id,{profile:'profile',awardsScr:'awards',shop:'shop',lboard:'board'}[id]);
 const screen=document.getElementById(id);
 if(['home','chat','friends','profile','shop','lboard','awardsScr'].includes(id)&&screen?.animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  // Paint transition only: dispatch/navigation never waits for this animation.
  UI_NAV.animation=screen.animate([{opacity:.88},{opacity:1}],{duration:150,easing:'ease-out'});
 }
}
function uiNavReset(){uiNavCloseMore(false);UI_NAV.animation?.cancel();UI_NAV.animation=null;UI_NAV.badges={chat:0,friends:0,inbox:0};uiNavRefreshBadges();}
document.addEventListener('keydown',event=>{
 if(!UI_NAV.open)return;
 if(event.key==='Escape'){event.preventDefault();uiNavCloseMore();return;}
 if(event.key!=='Tab')return;
 const menu=document.getElementById('uiMoreMenu'),buttons=Array.from(menu.querySelectorAll('.uiMorePanel button:not(:disabled)')),first=buttons[0],last=buttons[buttons.length-1];
 if(!first)return;
 if(!menu.contains(document.activeElement)||(event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){
  event.preventDefault();(event.shiftKey?last:first).focus();
 }
});
window.addEventListener('pagehide',()=>uiNavCloseMore(false));
