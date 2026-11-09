/* V404: read-only details of the currently dealt Majabeed match, never lobby draft settings. */
(function(root){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>String(n);
 const validInt=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 function describe(view){
  if(!view||!Array.isArray(view.seats)||![4,6].includes(view.seats.length)||!validInt(view.handCards,7,15))return null;
  const order=view.deckOrder&&typeof view.deckOrder==='object'?view.deckOrder:null;
  const mode=order&&['fixed','custom','random'].includes(order.mode)?order.mode:null;
  const ranks=order&&Array.isArray(order.ranks)&&order.ranks.length===13&&new Set(order.ranks).size===13&&order.ranks.every(n=>validInt(n,2,14))?order.ranks.slice():null;
  const jokerCount=order&&validInt(order.jokerCount,0,100)?order.jokerCount:null;
  const basras=order&&validInt(order.basraCount,5,32)?order.basraCount:null;
  return {handCards:view.handCards,dealerCards:view.handCards+1,players:view.seats.length,jokerCount,basras,mode,ranks,hideScore:view.hideScore===true,chatEnabled:view.friendlyChatEnabled!==false};
 }
 function detailsHTML(info){
  if(!info)return '';
  const rows=[['عدد الورق',num(info.dealerCards)],['الجواكر',info.jokerCount===null?'غير متاح':num(info.jokerCount)],['اللاعبون',num(info.players)],['النتيجة',info.hideScore?'مخفية حتى النهاية':'ظاهرة'],['شات الجلسة',info.chatEnabled?'مفتوح':'مغلق']];
  if(info.basras!==null)rows.splice(3,0,['البواصر',num(info.basras)]);
  const mode={fixed:'الرص المعتمد',custom:'رص مخصص',random:'خلط عشوائي'}[info.mode]||'غير متاح لهذه الجلسة';
  const pattern=info.mode==='random'?'<p class="uiSessionPatternNote">الأوراق مخلوطة؛ لا يوجد ترتيب ثابت للرتب.</p>':info.ranks?'<ol class="uiSessionRankPattern" aria-label="ترتيب الرص من البداية">'+info.ranks.map((rank,index)=>'<li'+(rank>=10?' class="isPicture"':'')+' aria-label="الموضع '+num(index+1)+': '+(rank>=10?'صورة':num(rank))+'">'+(rank>=10?'صورة':num(rank))+'</li>').join('')+'</ol><p class="uiSessionPatternNote">الصورة: عشرة، ولد، بنت، شايب أو آكة. الجواكر موزعة تلقائيًا بين أوراق الرزمة.</p>':'<p class="uiSessionPatternNote">تفاصيل الرص غير متاحة لهذه الجلسة القديمة.</p>';
  return '<dl class="uiSessionDetailGrid">'+rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl><section class="uiSessionOrder"><h3>طريقة الرص <span>'+esc(mode)+'</span></h3>'+pattern+'</section><p class="uiSessionDetailsLive">اللعبة مستمرة؛ أغلق النافذة للعودة إلى ورقك.</p>';
 }
 let button=null,dialog=null,identity='',openedRoom='',returnFocus=null,inerted=[];
 function state(){try{return typeof ONL!=='undefined'?ONL:null;}catch(_){return null;}}
 function active(){const s=state();return !!(s?.active&&s.status==='playing'&&describe(s.view)&&!root.UISessionReturn?.blocked('majabeed'));}
 function close(){
  dialog?.remove();dialog=null;openedRoom='';identity='';button?.setAttribute('aria-expanded','false');
  for(const item of inerted){if(item.node.isConnected&&!item.had)item.node.removeAttribute('inert');}inerted=[];
  if(returnFocus?.isConnected)try{returnFocus.focus({preventScroll:true});}catch(_){}returnFocus=null;
 }
 function open(){
  const s=state(),info=active()?describe(s.view):null;if(!info)return;
  close();returnFocus=document.activeElement;openedRoom=s.room;
  dialog=document.createElement('div');dialog.className='uiSessionDetailsBackdrop';dialog.id='uiSessionDetailsDialog';dialog.dir='rtl';
  dialog.innerHTML='<section class="uiSessionDetailsPanel" role="dialog" aria-modal="true" aria-labelledby="uiSessionDetailsTitle"><header><h2 id="uiSessionDetailsTitle">تفاصيل الجلسة</h2><button type="button" data-session-details-close aria-label="إغلاق تفاصيل الجلسة">×</button></header><div class="uiSessionDetailsBody"></div></section>';
  const host=document.getElementById('frame')||document.body;
  for(const child of Array.from(host.children)){inerted.push({node:child,had:child.hasAttribute('inert')});child.setAttribute('inert','');}
  host.appendChild(dialog);button?.setAttribute('aria-expanded','true');dialog.querySelector('[data-session-details-close]').onclick=close;
  dialog.onclick=e=>{if(e.target===dialog)close();};
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){e.preventDefault();dialog.querySelector('button').focus();}e.stopPropagation();});
  refresh();dialog?.querySelector('button').focus({preventScroll:true});
 }
 function refresh(){
  const s=state(),host=document.getElementById('onl'),on=active()&&!!host&&!host.hidden&&!host.classList.contains('hidden'),bar=host?.querySelector('#topbar');
  if(!button&&bar){button=document.createElement('button');button.type='button';button.id='uiSessionDetailsButton';button.className='uiSessionDetailsButton';button.title='تفاصيل الجلسة';button.setAttribute('aria-label','تفاصيل الجلسة: التوزيع والجواكر وطريقة الرص');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','uiSessionDetailsDialog');button.setAttribute('aria-expanded','false');button.textContent='!';button.onclick=open;bar.appendChild(button);}
  if(button)button.hidden=!on;
  if(!dialog)return;
  if(!on||s.room!==openedRoom){close();return;}
  const info=describe(s.view),key=JSON.stringify(info);if(key!==identity){dialog.querySelector('.uiSessionDetailsBody').innerHTML=detailsHTML(info);identity=key;}
 }
 root.UISessionDetails={describe,detailsHTML,open,close,refresh};
 if(typeof document==='undefined')return;
 // A single presentation hook follows the existing 4/6-seat render path. No sockets or timers.
 // Render pipeline hook: session-details (outermost presentation layer).
 if(typeof renderOnl==='function')root.MajabeedRenderPipeline.registerOnline('session-details',70,next=>function(){
  const result=next.apply(this,arguments);
  refresh();
  const s=state();
  if(s?.active)root.UIConnectionQuality?.paintMajabeed(s.view,s.you,s.connections,Date.now()+(s.offset||0));
  return result;
 });
 document.addEventListener('keydown',event=>{
  if(!dialog)return;
  event.stopImmediatePropagation();
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Tab'||!dialog.contains(event.target)){event.preventDefault();dialog.querySelector('button').focus();}
 },true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
 const host=document.getElementById('onl');
 if(host&&typeof MutationObserver!=='undefined')new MutationObserver(refresh).observe(host,{attributes:true,attributeFilter:['class','hidden']});
 refresh();
})(typeof window!=='undefined'?window:globalThis);
