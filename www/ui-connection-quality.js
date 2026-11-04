/* V404: presentation only. Quality is measured by the server, never inferred from Wi-Fi bars. */
(function(root){
 'use strict';
 const LABELS={good:'اتصال جيد',fair:'اتصال متوسط',weak:'اتصال ضعيف',offline:'غير متصل',away:'خارج التطبيق مؤقتًا',unknown:'جودة الاتصال لم تُقَس بعد',bot:'كمبيوتر'};
 const LEVELS={good:3,fair:2,weak:1,offline:0,away:0,unknown:0,bot:0};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function describe(connection,options={}){
  const input=connection&&typeof connection==='object'?connection:{};
  let quality=options.bot===true?'bot':Object.prototype.hasOwnProperty.call(LABELS,input.quality)?input.quality:'unknown';
  // A timestamp is not itself proof of a measured connection. A stale sample loses its good/fair/weak claim.
  const now=Number(options.now),at=Number(input.updatedAt);
  if(['good','fair','weak'].includes(quality)&&Number.isFinite(now)&&Number.isFinite(at)&&now-at>75000)quality='unknown';
  const ms=typeof input.rttMs==='number'&&Number.isFinite(input.rttMs)&&input.rttMs>=0&&input.rttMs<=60000&&['good','fair','weak'].includes(quality)?Math.round(input.rttMs):null;
  const label=LABELS[quality]+(ms!==null?' · زمن الاستجابة '+ms+' مللي ثانية':'');
  return {quality,level:LEVELS[quality],rttMs:ms,label,accessible:(options.name?String(options.name)+' · ':'')+label};
 }
 function badgeHTML(connection,options){
  const d=describe(connection,options),glyph=d.quality==='bot'?'▣':d.quality==='away'?'◷':d.quality==='offline'?'×':d.quality==='unknown'?'—':'';
  return '<span class="uiConnectionBadge" data-quality="'+d.quality+'" role="img" aria-label="'+escape(d.accessible)+'" title="'+escape(d.accessible)+'">'+(glyph?'<span class="uiConnectionGlyph" aria-hidden="true">'+glyph+'</span>':'<span class="uiConnectionBars" aria-hidden="true">'+[1,2,3].map(n=>'<i'+(n<=d.level?' class="lit"':'')+'></i>').join('')+'</span>')+'</span>';
 }
 function paint(anchor,connection,options){
  if(!anchor)return;
  anchor.classList.add('uiConnectionAnchor');
  const d=describe(connection,options),key=d.quality+'|'+d.accessible;
  let badge=Array.from(anchor.children).find(el=>el.classList.contains('uiConnectionBadge'));
  if(badge?.dataset.connectionKey===key)return;
  const temp=document.createElement('template');temp.innerHTML=badgeHTML(connection,options);const next=temp.content.firstElementChild;
  next.dataset.connectionKey=key;
  if(badge)badge.replaceWith(next);else anchor.appendChild(next);
 }
 function paintMajabeed(view,you,connections,now){
  if(!view?.seats?.length)return;
  const count=view.seats.length,ids=count===6?['oIdent','oSeatR','oSixSeat2','oSeat','oSixSeat4','oSeatL']:['oIdent','oSeatR','oSeat','oSeatL'];
  const base=Math.max(0,view.seats.indexOf(you)),map=connections||view.connections||{};
  ids.forEach((id,k)=>{
   const seat=document.getElementById(id),pid=view.seats[(base+k)%count];
   if(!seat||!pid)return;
   const anchor=seat.querySelector('.avaWrap')||seat.querySelector('.ava');
   paint(anchor,map[pid],{name:view.names?.[pid]||'لاعب',bot:Array.isArray(view.humans)&&!view.humans.includes(pid),now});
  });
 }
 function paintSakka(state,connections,now){
  if(!state?.seats)return;const map=connections||state.connections||{};
  state.seats.forEach((player,seat)=>{
   if(!player)return;
   const el=document.querySelector('#blGame .blSeat[data-seat="'+seat+'"] .blAvatarFrame');
   paint(el,map[player.uid],{name:player.name||'لاعب',bot:player.bot===true,now});
  });
 }
 let prompt=null,promptTimer=0,promptSeq=0,restoreFocus=null,inerted=[];
 const clock=()=>Date.now();
 function stopPromptClock(){clearTimeout(promptTimer);promptTimer=0;}
 function hideReturnPrompt(){
  ++promptSeq;stopPromptClock();prompt?.node.remove();prompt=null;
  for(const item of inerted){if(item.node.isConnected&&!item.had)item.node.removeAttribute('inert');}inerted=[];
  if(restoreFocus?.isConnected)try{restoreFocus.focus({preventScroll:true});}catch(_){}restoreFocus=null;
 }
 function setReturnPending(pending,message){
  if(!prompt)return;
  prompt.pending=!!pending;prompt.returnButton.disabled=prompt.pending||prompt.expired;
  prompt.returnButton.textContent=prompt.pending?'جارٍ العودة…':'العودة إلى اللعب';
  prompt.message.textContent=String(message||'');
 }
 function updateReturnDeadline(deadline){
  const value=Number(deadline);
  if(!prompt||!Number.isFinite(value)||value>=prompt.deadline)return false;
  prompt.deadline=value;tickReturn();return true;
 }
 function tickReturn(){
  stopPromptClock();if(!prompt)return;
  const remaining=Math.max(0,Math.ceil((prompt.deadline-clock())/1000));
  prompt.counter.textContent=String(remaining);
  if(!remaining&&!prompt.expired){
   prompt.expired=true;prompt.returnButton.disabled=true;prompt.message.textContent='انتهت مهلة العودة';
   const fn=prompt.onExpire;try{fn?.();}catch(_){}return;
  }
  if(!document.hidden&&!prompt.expired)promptTimer=setTimeout(tickReturn,Math.min(1000,Math.max(50,prompt.deadline-clock())));
 }
 function showReturnPrompt(options={}){
  const deadline=Number(options.deadline);
  if(!Number.isFinite(deadline))return false;
  root.UISessionDetails?.close();
  hideReturnPrompt();const sequence=promptSeq;
  restoreFocus=document.activeElement;
  const host=document.getElementById('frame')||document.body,node=document.createElement('div');
  node.id='uiReturnPrompt';node.className='uiReturnPrompt';node.dir='rtl';
  node.innerHTML='<section class="uiReturnPanel" role="dialog" aria-modal="true" aria-labelledby="uiReturnTitle" aria-describedby="uiReturnDescription" tabindex="-1"><span class="uiReturnIcon" aria-hidden="true">◷</span><h2 id="uiReturnTitle">جلستك بانتظار عودتك</h2><p id="uiReturnDescription">يمكنك العودة خلال المهلة. بعد انتهائها تعود إلى الرئيسية.</p><div class="uiReturnCountdown"><span>متبقي للعودة</span><b data-return-counter>0</b><small>ثانية</small></div><p class="uiReturnMessage" role="status" aria-live="polite"></p><button type="button" class="uiReturnAccept">العودة إلى اللعب</button><button type="button" class="uiReturnLeave">الخروج للرئيسية</button></section>';
  for(const child of Array.from(host.children)){inerted.push({node:child,had:child.hasAttribute('inert')});child.setAttribute('inert','');}
  host.appendChild(node);
  prompt={node,deadline,onExpire:options.onExpire,expired:false,pending:false,counter:node.querySelector('[data-return-counter]'),message:node.querySelector('.uiReturnMessage'),returnButton:node.querySelector('.uiReturnAccept')};
  prompt.returnButton.onclick=()=>{if(!prompt||promptSeq!==sequence||prompt.pending||prompt.expired)return;if(clock()>=prompt.deadline){tickReturn();return;}setReturnPending(true);try{options.onReturn?.();}catch(_){setReturnPending(false,'تعذّر الاتصال؛ حاول مجددًا خلال المهلة.');}};
  node.querySelector('.uiReturnLeave').onclick=()=>{if(!prompt||promptSeq!==sequence)return;try{options.onLeave?.();}catch(_){}};
  tickReturn();if(prompt)(prompt.returnButton.disabled?node.querySelector('.uiReturnPanel'):prompt.returnButton).focus({preventScroll:true});return true;
 }
 if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPromptClock();else tickReturn();});
  document.addEventListener('keydown',event=>{
   if(!prompt)return;
   const inside=prompt.node.contains(event.target);
   if(!inside){event.preventDefault();event.stopImmediatePropagation();prompt.node.querySelector('.uiReturnPanel').focus();return;}
   // Keep global table shortcuts from consuming keys while the dialog owns focus.
   // Default button keyboard activation remains available unless explicitly prevented below.
   event.stopImmediatePropagation();
   if(event.key==='Tab'){
    const items=Array.from(prompt.node.querySelectorAll('button')).filter(el=>!el.disabled),index=items.indexOf(document.activeElement);
    event.preventDefault();items[(index+(event.shiftKey?-1:1)+items.length)%items.length]?.focus();
   }else if(event.key==='Escape'){event.preventDefault();}
  },true);
 }
 root.UIConnectionQuality={describe,badgeHTML,paintMajabeed,paintSakka,showReturnPrompt,hideReturnPrompt,setReturnPending,updateReturnDeadline};
})(typeof window!=='undefined'?window:globalThis);
