/* Friendly-room communication policy. Only accepted server snapshots change it. */
(function(root){
 'use strict';
 const MESSAGE='الشات مغلق في هذه الجلسة';
 const records={majabeed:null,baloot:null};
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h6"/></svg>';
 function allows(game,state){
  if(game==='majabeed'&&state?.active===true&&state?.cup)return false;
  if(game==='majabeed'&&state?.active!==true)return true;
  return state?.friendlyChatEnabled!==false&&state?.lobby?.friendlyChatEnabled!==false&&state?.view?.friendlyChatEnabled!==false;
 }
 function describe(game,state){
  const sakka=game==='baloot',room=typeof state?.room==='string'?state.room:'';
  const friendly=!!room&&(sakka?state?.mode==='friendly':state?.active===true&&!room.startsWith('pub-')&&!state.cup&&!state.league&&!state.tournament&&!state.lobby?.tier?.fee&&state.view?.isFriendlySession!==false&&state.view?.isFriendly!==false);
  const lobby=sakka?!state?.game:['lobby','waiting'].includes(state?.status);
  const capability=(sakka?state?.friendlyChatEditable:state?.lobby?.friendlyChatEditable)===true;
  const owner=sakka?state?.me>=0&&!!state?.owner&&state?.seats?.[state.me]?.uid===state.owner:!!state?.you&&state?.lobby?.creator===state.you;
  const blocked=root.UISessionReturn?.blocked(game)===true;
  const busy=blocked||(sakka?!!state?.rematch?.startAt:!!state?.paymentPending||(typeof UI_SESSION_START!=='undefined'&&UI_SESSION_START.pending===true));
  const known=typeof state?.friendlyChatEnabled==='boolean'||typeof state?.lobby?.friendlyChatEnabled==='boolean';
  return {show:friendly&&lobby&&(known||capability),editable:friendly&&lobby&&capability&&owner&&!busy,enabled:allows(game,state),key:game+':'+room+':'+(sakka?(state?.seats?.[state.me]?.uid||'spectator'):(state?.you||'spectator'))};
 }
 function maySendMajabeed(){
  const enabled=allows('majabeed',typeof ONL!=='undefined'?ONL:null);
  if(!enabled&&typeof oToast==='function')oToast(MESSAGE);
  return enabled;
 }
 function clearPending(r){clearTimeout(r?.timer);if(r){r.timer=null;r.pending=null;}}
 function failed(r,serial,message){if(records[r.game]!==r||r.serial!==serial||r.pending===null)return;clearPending(r);r.error=message;paint(r);}
 function choose(r,enabled){
  const info=describe(r.game,r.state);
  if(!info.editable||r.pending!==null||typeof enabled!=='boolean'||enabled===info.enabled||typeof r.send!=='function')return false;
  r.pending=enabled;r.error='';const serial=++r.serial;
  r.timer=setTimeout(()=>failed(r,serial,'لم يصل تأكيد إعداد الشات؛ حاول مجددًا.'),5000);paint(r);
  try{
   const sent=r.send({type:r.game==='baloot'?'roomSettings':'config',friendlyChatEnabled:enabled});
   if(sent===false){failed(r,serial,'تعذّر إرسال الإعداد؛ تحقق من الاتصال.');return false;}
   if(sent&&typeof sent.then==='function')sent.catch(()=>failed(r,serial,'تعذّر حفظ إعداد الشات.'));
  }catch(_){failed(r,serial,'تعذّر حفظ إعداد الشات.');return false;}
  return true;
 }
 function paint(r){
  if(!r.node?.isConnected)return;
  const info=describe(r.game,r.state);r.node.hidden=!info.show;if(!info.show)return;
  const model=JSON.stringify([info.enabled,info.editable,r.pending,r.error]);if(r.node.dataset.model===model)return;r.node.dataset.model=model;
  const focused=r.node.contains(document.activeElement)?document.activeElement?.dataset.roomChatEnabled:null;
  r.node.innerHTML='<div class="uiRoomChatRow"><span class="uiRoomChatTitle">'+icon+'<span><b>شات الجلسة</b><small>النص والاختصارات والتعبيرات</small></span></span><div class="uiRoomChatChoices" role="group" aria-label="حالة شات الجلسة">'+[[true,'مفتوح'],[false,'مغلق']].map(([value,label])=>'<button type="button" data-room-chat-enabled="'+value+'" aria-pressed="'+(info.enabled===value)+'"'+(!info.editable||r.pending!==null?' disabled':'')+'>'+label+'</button>').join('')+'</div></div><p class="uiRoomChatHelp" role="'+(r.error?'alert':'status')+'">'+(r.pending!==null?'جارٍ تأكيد إعداد الشات…':r.error||(info.enabled?'يسمح بالمحادثة والاختصارات بين لاعبي الجلسة.':'المحادثة مغلقة؛ أصوات اللعب والإعلانات مستمرة.'))+'</p>';
  r.node.setAttribute('aria-busy',String(r.pending!==null));
  r.node.onclick=e=>{const b=e.target.closest('[data-room-chat-enabled]');if(b&&r.node.contains(b)&&!b.disabled){e.preventDefault();e.stopPropagation();choose(r,b.dataset.roomChatEnabled==='true');}};
  if(focused!==null)r.node.querySelector('[data-room-chat-enabled="'+focused+'"]')?.focus({preventScroll:true});
 }
 function sync(game,state,send){
  const info=describe(game,state);let r=records[game];
  if(!r||r.key!==info.key){clearPending(r);r?.node?.remove();r={game,key:info.key,state,send,accepted:info.enabled,pending:null,timer:null,serial:0,error:'',node:null};records[game]=r;}
  if(r.accepted!==info.enabled){r.accepted=info.enabled;r.error='';}
  r.state=state;r.send=send;
  if(r.pending!==null&&(info.enabled===r.pending||!info.editable)){clearPending(r);r.error='';}
  if(!info.show){if(r.node)r.node.hidden=true;return;}
  if(!r.node?.isConnected){
   const anchor=game==='baloot'?document.querySelector('#blGame .blLobbyCode'):document.getElementById('lobbyPublic');if(!anchor)return;
   r.node=document.createElement('section');r.node.className='uiRoomChatSetting';r.node.dataset.game=game;r.node.setAttribute('aria-label','إعداد شات الجلسة');
   if(game==='baloot')anchor.after(r.node);else anchor.before(r.node);
  }
  paint(r);
 }
 function paintMajabeed(state){
  const closed=!allows('majabeed',state),panel=document.getElementById('oChatPanel');
  const cup=state?.active===true&&!!state?.cup,table=document.getElementById('onl');
  // The Cup has no chat, including retained panels from a previous friendly room.
  if(table)table.dataset.cupChatDisabled=String(cup);
  if(cup){panel?.classList.add('hidden');document.getElementById('oChatBubble')?.classList.add('hidden');document.body.classList.remove('uiOnlineChatOpen');table?.classList.remove('uiChatOpen');}
  if(panel){
   let note=panel.querySelector('.uiRoomChatClosed');
   if(!note){note=document.createElement('p');note.className='uiRoomChatClosed';note.setAttribute('role','status');note.textContent=MESSAGE;panel.prepend(note);}note.hidden=!closed;
   panel.querySelectorAll('#oChatInput,#oChatSendBtn,#oChatQuickTab button').forEach(el=>{el.disabled=closed;});
  }
  const chat=document.getElementById('oChatBtn');if(chat){chat.dataset.chatClosed=String(closed);chat.setAttribute('aria-label',closed?'الشات مغلق؛ عرض سجل المحادثة':'شات الجلسة');}
  const react=document.getElementById('oReactBtn');if(react){react.disabled=closed;react.title=closed?MESSAGE:'التعبيرات';}
  if(closed){document.getElementById('reactBackdrop')?.remove();document.querySelectorAll('#onl .oppBubble,#oChatBubble').forEach(el=>{clearTimeout(el._t);el.classList.add('hidden');});}
 }
 function syncMajabeed(state){sync('majabeed',state,m=>typeof oSend==='function'?oSend(m):false);paintMajabeed(state);}
 function syncSakka(state,send){
  sync('baloot',state,send);
  const closed=!allows('baloot',state);
  document.querySelectorAll('#blGame [data-bl="chat"]').forEach(el=>{el.dataset.chatClosed=String(closed);el.setAttribute('aria-label',closed?'الشات مغلق؛ عرض سجل المحادثة':'شات الجلسة');});
 }
 root.MajabeedSessionChat=Object.freeze({MESSAGE,allows,describe,maySendMajabeed,syncMajabeed,syncSakka});
 // Six-player lobby has its own renderer and participates in the same policy.
 if(typeof renderLobbySix==='function'){const old=renderLobbySix;renderLobbySix=function(){const result=old.apply(this,arguments);syncMajabeed(ONL);return result;};}
})(window);
