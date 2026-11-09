/* A room's accepted cosmetic choice; never changes deck rules or personal equipment. */
(function(root){
 'use strict';
 const IDS=Object.freeze(['theme-persian','theme-midnight','theme-emerald','theme-royal','theme-popular','theme-hijaz','theme-flight','theme-oasis','theme-najd']);
 const FREE=new Set(['theme-persian','theme-midnight']);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const valid=id=>typeof id==='string'&&IDS.includes(id);
 const records={majabeed:null,baloot:null};

 // Scene selection is cosmetic. Majabeed has one portrait surface; the
 // original integrated scene surface is retained for Sakka and store previews.
 const SCENE_IDS=new Set(['theme-hijaz','theme-flight','theme-oasis','theme-najd']);
 function applySurface(host,theme){
  if(!host?.style||!host?.dataset)return false;
  const scene=SCENE_IDS.has(theme?.id)&&theme?.surface==='scene';
  if(scene){host.dataset.sceneTheme=theme.id;host.style.backgroundSize='100% 100%';host.style.backgroundPosition='center';}
  else if(host.dataset.sceneTheme){delete host.dataset.sceneTheme;host.style.backgroundSize='cover';host.style.backgroundPosition=host.id==='uiShopScene'?'center 40%':'center';}
  // Majabeed alone uses Najd's portrait playing area. Sakka and store scenes
  // keep the original catalog art. Separate room layers prevent a second rim
  // showing behind the unified rectangular surface in Hijaz and Oasis.
  if(host.id==='game'||host.id==='onl'){
   const id=valid(theme?.id)?theme.id:'theme-persian';
   host.dataset.majabeedTable=id;
   const room=id==='theme-hijaz'?'ui-art/rooms-v412/hijaz-room-majabeed.png':id==='theme-oasis'?'ui-art/rooms-v412/oasis-room-majabeed.png':theme?.bg;
   if(room)host.style.setProperty('background-image','url("'+room+'")','important');
  }
  return scene;
 }

 function catalog(){return typeof SHOP_THEMES!=='undefined'?IDS.map(id=>SHOP_THEMES.find(t=>t.id===id)).filter(Boolean):[];}
 function allowed(id){try{return valid(id)&&(FREE.has(id)||typeof uiThemeAccess==='function'&&uiThemeAccess(id).active===true);}catch(_){return false;}}
 function preferred(){try{const id=typeof uiThemeResolve==='function'?uiThemeResolve():'theme-persian';return allowed(id)?id:'theme-persian';}catch(_){return 'theme-persian';}}
 function friendly(game,s){
  if(!s?.room)return false;
  if(game==='baloot')return s.mode==='friendly';
  return game==='majabeed'&&s.active===true&&!s.room.startsWith('pub-')&&!s.cup&&!s.league&&!s.tournament&&!s.lobby?.tier?.fee&&s.view?.isFriendlySession!==false&&s.view?.isFriendly!==false;
 }
 function resolve(game,s,fallback){return friendly(game,s)&&valid(s.sessionTheme)?s.sessionTheme:fallback;}
 function describe(game,s){
  const inRoom=friendly(game,s),lobby=game==='baloot'?!s?.game:!!s&&['lobby','waiting'].includes(s.status);
  const capability=game==='baloot'?s?.sessionThemeEditable===true:s?.lobby?.sessionThemeEditable===true;
  const owner=game==='baloot'?s?.me>=0&&!!s?.owner&&s?.seats?.[s.me]?.uid===s.owner:!!s?.you&&s?.lobby?.creator===s.you;
  const busy=game==='baloot'?!!s?.rematch?.startAt:!!s?.paymentPending||root.UISessionReturn?.blocked('majabeed')===true||(typeof UI_SESSION_START!=='undefined'&&UI_SESSION_START.pending===true);
  return {show:inRoom&&lobby&&(capability||valid(s.sessionTheme)),editable:inRoom&&lobby&&capability&&owner&&!busy,owner,choice:valid(s?.sessionTheme)?s.sessionTheme:null,key:game+':'+(s?.room||'')+':'+(game==='baloot'?(s?.seats?.[s.me]?.uid||'spectator'):(s?.you||'spectator'))};
 }
 function clearPending(r){if(r?.timer)clearTimeout(r.timer);if(r){r.timer=null;r.pending=null;}}
 function fail(r,message,serial){if(records[r.game]!==r||!r.pending||r.serial!==serial)return;clearPending(r);r.error=message;paint(r);}
 function choose(r,id){
  const info=describe(r.game,r.state);
  if(!info.editable||r.pending||!valid(id)||!allowed(id)||id===info.choice||typeof r.send!=='function')return false;
  r.error='';r.pending=id;const serial=++r.serial;
  r.timer=setTimeout(()=>fail(r,'لم يصل تأكيد الثيم. جرّب الاختيار مرة أخرى.',serial),5000);
  paint(r);
  try{
   const result=r.send({type:r.game==='baloot'?'roomSettings':'config',sessionTheme:id});
   if(result===false){fail(r,'تعذّر إرسال الاختيار. تحقق من الاتصال وحاول مجددًا.',serial);return false;}
   if(result&&typeof result.then==='function')result.catch(()=>fail(r,'تعذّر إرسال الاختيار. حاول مجددًا.',serial));
  }catch(_){fail(r,'تعذّر إرسال الاختيار. حاول مجددًا.',serial);return false;}
  return true;
 }
 function paint(r){
  const node=r.node;if(!node?.isConnected)return;
  const info=describe(r.game,r.state);node.hidden=!info.show;if(!info.show)return;
  const choices=catalog(),selected=choices.find(t=>t.id===info.choice),status=r.pending?'جارٍ تأكيد الثيم…':r.error||(!selected?'اختر ثيمًا يظهر لجميع المشاركين.':info.owner?'اختيارك يظهر للجميع، وعلى بطاقة الجلسة.':'ثيم اختاره منشئ الجلسة لجميع المشاركين.');
  const model=JSON.stringify([info.choice,info.editable,r.pending,r.error,choices.map(t=>[t.id,allowed(t.id)])]);
  if(node.dataset.model===model)return;
  const open=node.querySelector('details')?.open===true,focused=node.contains(document.activeElement)?document.activeElement?.dataset.sessionTheme:null;
  node.dataset.model=model;
  node.innerHTML='<details class="uiSessionThemeDetails"'+(open&&info.editable?' open':'')+'><summary'+(!info.editable?' aria-disabled="true"':'')+'>'+(selected?'<img class="uiSessionThemeThumb" src="'+esc(selected.preview||selected.bg)+'" alt="" draggable="false">':'<span class="uiSessionThemeThumb uiSessionThemeUnselected" aria-hidden="true">♠</span>')+'<span class="uiSessionThemeTitle"><small>ثيم الجلسة</small><b>'+esc(selected?.name||'اختيار المنشئ')+'</b></span>'+(info.editable?'<span class="uiSessionThemeEdit">تغيير <span aria-hidden="true">⌄</span></span>':'<span class="uiSessionThemeShared">للجميع</span>')+'</summary>'+(info.editable?'<div class="uiSessionThemeGrid" role="group" aria-label="اختر ثيم الجلسة">'+choices.map(t=>{const access=allowed(t.id),current=t.id===info.choice;return '<button type="button" class="uiSessionThemeOption'+(current?' isSelected':'')+'" data-session-theme="'+esc(t.id)+'" aria-pressed="'+current+'" '+(!access||r.pending?'disabled ':'')+'aria-label="'+esc(t.name+(access?'':' · غير مملوك'))+'"><span class="uiSessionThemeArt"><img src="'+esc(t.preview||t.bg)+'" alt="" loading="lazy" draggable="false">'+(!access?'<i aria-hidden="true">⌑</i>':current?'<i aria-hidden="true">✓</i>':'')+'</span><b>'+esc(t.name)+'</b><small>'+(access?(FREE.has(t.id)?'مجاني':'متاح لك'):'غير مملوك')+'</small></button>';}).join('')+'</div>':'')+'</details><p class="uiSessionThemeStatus" '+(r.error?'role="alert"':'role="status"')+'>'+esc(status)+'</p>';
  node.setAttribute('aria-busy',String(!!r.pending));
  const details=node.querySelector('details'),summary=details.querySelector('summary');
  summary.onclick=e=>{if(!describe(r.game,r.state).editable)e.preventDefault();};
  node.onclick=e=>{const button=e.target.closest('[data-session-theme]');if(button&&node.contains(button)){e.preventDefault();e.stopPropagation();choose(r,button.dataset.sessionTheme);}};
  if(focused)node.querySelector('[data-session-theme="'+focused+'"]')?.focus({preventScroll:true});
 }
 function sync(game,state,send){
  const info=describe(game,state);let r=records[game];
  if(!r||r.key!==info.key){clearPending(r);r?.node?.remove();r={game,key:info.key,state,send,pending:null,timer:null,serial:0,error:'',node:null,initialized:false};records[game]=r;}
  r.state=state;r.send=send;
  if(r.pending&&(info.choice===r.pending||!info.editable)){clearPending(r);r.error='';}
  if(!info.show){if(r.node)r.node.hidden=true;return;}
  if(!r.node?.isConnected){
   const anchor=game==='baloot'?document.querySelector('#blGame .blLobbyCode'):document.getElementById('lobbyPublic');
   if(!anchor)return;
   r.node=document.createElement('section');r.node.className='uiSessionThemePicker';r.node.dataset.game=game;r.node.setAttribute('aria-label','ثيم الجلسة');
   if(game==='baloot')anchor.after(r.node);else anchor.before(r.node);
  }
  paint(r);
  // On supported waiting rooms, publish the owner's equipped theme once. Do not
  // repeatedly resend while awaiting the authoritative snapshot or after failure.
  if(info.editable&&!info.choice&&!r.initialized){r.initialized=true;choose(r,preferred());}
 }
 function syncMajabeed(state){sync('majabeed',state,message=>typeof oSend==='function'?oSend(message):false);}
 function syncSakka(state,send){sync('baloot',state,send);}
 function applyMajabeed(state){
  const id=resolve('majabeed',state,preferred()),host=document.getElementById('onl'),theme=catalog().find(t=>t.id===id);
  if(!host||!theme)return false;
  // This is scoped to the online room. The personal theme and offline table are untouched.
  host.style.setProperty('background-image','url("'+theme.bg+'")','important');host.style.backgroundPosition='center';host.style.backgroundSize='cover';host.style.backgroundRepeat='no-repeat';
  applySurface(host,theme);
  host.querySelectorAll('.tableWood').forEach(el=>{el.style.backgroundImage='url("'+(theme.table||'ui-art/rooms-v362/cafe-table.webp')+'")';el.classList.toggle('uiPersianTable',id==='theme-persian');});
  return true;
 }
 root.MajabeedSessionTheme=Object.freeze({IDS,valid,resolve,describe,preferred,syncMajabeed,syncSakka,applyMajabeed,applySurface});
})(window);
