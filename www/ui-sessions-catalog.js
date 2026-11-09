/* Shared, presentational session directory. Membership, ads and room state remain authoritative elsewhere. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const N=v=>String(v);
 const paths={cards:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m5 6-3 1 3 14m5-12 2-3 2 3-2 3z"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',hidden:'<path d="m3 3 18 18M10 5c6-1 12 7 12 7s-2 4-6 6M6 6C3 9 2 12 2 12s4 7 10 7l2-1"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0M12 14v3"/>',open:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0M12 14v3"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 4c2 1 3 3 3 6"/>',order:'<path d="M4 6h16M4 12h11M4 18h16m-3-9 3 3-3 3"/>',chat:'<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h6"/>',refresh:'<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L3 9.6l6.2-.9Z"/>'};
 const icon=(k,cls='')=>'<svg class="scIcon '+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[k]||paths.cards)+'</svg>';
 const themes=Object.freeze({
  'theme-persian':{name:'السجّاد الفارسي',tone:'persian',image:'bg/majlis-persian-preview.jpg'},
  'theme-midnight':{name:'قهوة الأولين',tone:'cafe',image:'ui-art/rooms-v362/cafe-room.webp'},
  'theme-emerald':{name:'ديوانية الرفاق',tone:'diwaniya',image:'ui-art/rooms-v362/diwaniya-room.webp'},
  'theme-royal':{name:'كشتة البر',tone:'camp',image:'ui-art/rooms-v362/camp-room.webp'},
  'theme-popular':{name:'بيت الشعر',tone:'sadu',image:'ui-art/rooms-v362/sadu-room.webp'},
  'theme-hijaz':{name:'حارة الحجاز',tone:'hijaz',image:'ui-art/rooms-v409/hijaz-scene.webp'},
  'theme-flight':{name:'رحلة السحاب',tone:'flight',image:'ui-art/rooms-v409/flight-scene.webp'},
  'theme-oasis':{name:'ظل النخيل',tone:'oasis',image:'ui-art/rooms-v409/oasis-scene.webp'},
  'theme-najd':{name:'مجلس نجد',tone:'najd',image:'ui-art/rooms-v409/najd-scene.webp'}
 });
 const layout={fixed:'رص معتمد',custom:'رص مخصص',random:'خلط عشوائي'};
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 function model(row,game,uid){
  const sakka=game==='baloot',six=!sakka&&row.tableFormat==='3v3',count=six?6:4;
  const input=sakka?row.players:row.seats,seats=Array.from({length:count},(_,i)=>input?.[i]||null);
  const humans=seats.filter(p=>p&&!p.bot&&!p.isBot).length,playing=row.status==='playing';
  const joinable=sakka?Array.isArray(row.openSeats)?row.openSeats.length>0:!playing&&humans<count:humans<count;
  const order=row.deckOrder,hidden=row.hideScore===true,team=sakka||row.mode==='team';
  const mine=uid?seats.findIndex(p=>p&&(p.uid===uid||p.id===uid)):-1,us=mine<0?0:mine%2;
  const score=sakka?row.scores:row.currentScore?.teams?.map(p=>p.points);
  const scores=hidden?null:Array.isArray(score)&&score.length===2?score.map(v=>Number.isFinite(v)&&v>=0?Math.trunc(v):null):null;
  return {id:String(row.id||''),name:String(row.name||'جلسة الربع'),sakka,seats,humans,count,joinable,playing,hidden,team,us,scores,
   private:row.isPublic===false||row.public===false,chatEnabled:row.friendlyChatEnabled!==false,theme:themes[row.sessionTheme]||null,
   basras:integer(order?.basraCount,5,32)?order.basraCount:order?32:null,jokers:integer(order?.jokerCount,0,100)?order.jokerCount:null,
   hand:integer(row.handCards,7,15)?row.handCards:null,order:layout[order?.mode]||'رص الجلسة',mode:order?.mode,
   solo:hidden?[]:Array.isArray(row.currentScore?.players)?row.currentScore.players:[],economy:row.friendlyEconomy,raw:row};
 }
 function safeImage(value){
  if(typeof value!=='string')return '';
  if(/^(?:avatars|ranks|tiers)\/[\w./-]+(?:\?[^<>"']*)?$/.test(value))return value;
  try{const u=new URL(value);if(u.protocol==='https:')return u.href;}catch(_){}return '';
 }
 function avatar(p){
  const src=safeImage(p?.avatarThumb||p?.avatar||p?.photoURL);
  if(src&&typeof avatarHTML==='function')return '<span class="scAvatar">'+avatarHTML(src,48)+'</span>';
  if(p?.avatar&&typeof AV_PRO!=='undefined'&&AV_PRO.some(a=>a.id===p.avatar)&&typeof avatarHTML==='function')return '<span class="scAvatar">'+avatarHTML(p.avatar,48)+'</span>';
  return '<span class="scAvatar">'+(src?'<img src="'+E(src)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'<span aria-hidden="true">'+(p?E(String(p.name||'ل').slice(0,1)):'+')+'</span>')+'</span>';
 }
 function seatHTML(p,i,m){
  const name=p?String(p.name||'لاعب'):'مقعد متاح';
  const points=p&&!m.team&&!m.hidden?m.solo[i]?.points:null;
  return '<div class="scSeat '+(!p?'isEmpty':'')+'">'+avatar(p)+'<span title="'+E(name)+'">'+E(name)+'</span>'+(Number.isFinite(points)?'<small>'+N(points)+' نقطة</small>':'')+'</div>';
 }
 function chip(kind,value,label,extra=''){
  const art=kind==='joker'?'<img src="court_JOKER_v352.png" class="scJoker" alt="" loading="lazy">':icon(kind);
  return '<span class="scChip '+extra+'">'+art+'<span><b>'+E(value)+'</b><small>'+E(label)+'</small></span></span>';
 }
 function chips(m){
  let html='';
  if(!m.sakka){
   html+=chip('cards',m.basras===null?'—':N(m.basras),'باصرة');
   html+=chip('joker',m.jokers===null?'—':N(m.jokers),'جوكر');
   html+=chip('cards',m.hand===null?'—':N(m.hand+1),'عدد الورق');
  }else html+=chip('cards','32','ورقة الرزمة')+chip('users','2 × 2','جماعي');
  html+=chip(m.hidden?'hidden':'eye',m.hidden?'مخفية':'ظاهرة','النتيجة',m.hidden?'isHiddenScore':'');
  return html;
 }
 function card(row,game,uid){
  const m=model(row,game,uid),t=m.theme,split=[m.us,1-m.us];
  const badge=t?'<span class="scThemeSeal"><img src="'+t.image+'" alt=""><span>'+t.name+'</span></span>':'<span class="scThemeSeal scThemeFallback">'+icon('cards')+'<span>مجلس الربع</span></span>';
  const score=m.hidden?'<span class="scScoreHidden" aria-label="النتيجة مخفية">'+icon('hidden')+'</span>':m.scores?split.map(i=>'<bdi>'+ (m.scores[i]===null?'—':N(m.scores[i]))+'</bdi>').join('<span>:</span>'):'<span class="scScoreWaiting">'+(m.playing?'—':'لم تبدأ')+'</span>';
  const teams=m.team?split.map((side,index)=>'<section class="scTeam"><b class="scTeamName">'+(index===0?'لنا':'لهم')+'</b><div class="scSeats">'+m.seats.map((p,i)=>i%2===side?seatHTML(p,i,m):'').join('')+'</div></section>').join(''):'<div class="scSoloSeats">'+m.seats.map((p,i)=>seatHTML(p,i,m)).join('')+'</div>';
  let fee='';if(m.economy&&Number.isFinite(m.economy.entryFee)&&m.economy.entryFee>=0)fee='<small class="scFee">'+(m.economy.entryFee===0||root.VipClient?.active?.()===true?'الانضمام مجاني':'المشاركة '+N(m.economy.entryFee)+' ذهب مرة للجلسة')+'</small>';
  return '<article class="scCard" data-tone="'+(t?.tone||'classic')+'" data-session-id="'+E(m.id)+'"><header class="scCardHead"><div class="scRoomIdentity"><h3>'+E(m.name)+'</h3><span>'+icon(m.private?'lock':'open')+(m.private?'خاصة':'عامة')+' · '+N(m.count)+' لاعبين</span></div>'+badge+'</header><div class="scCardBody"><div class="scMatch">'+teams+(m.team?'<div class="scScore" aria-label="'+(m.hidden?'النتيجة مخفية':'النتيجة الحالية')+'">'+score+'</div>':'')+'</div><div class="scChips">'+chips(m)+'</div><div class="scRoomMeta"><span class="scStatus '+(m.playing?'isPlaying':'')+'"><i></i>'+(m.playing?'يلعبون الآن':'بانتظار الربع')+'</span>'+(!m.sakka?'<span>'+icon('order')+E(m.order)+'</span>':'<span>صكة · ودية</span>')+'<span class="scChatStatus">'+icon('chat')+(m.chatEnabled?'الشات مفتوح':'الشات مغلق')+'</span></div><footer>'+fee+'<div class="scActions">'+(m.joinable?'<button type="button" class="scJoin" data-sc-action="join" data-room="'+E(m.id)+'">انضم للجلسة <span>←</span></button>':'')+'<button type="button" class="scWatch" data-sc-action="watch" data-room="'+E(m.id)+'" '+(!m.playing?'disabled':'')+'>'+icon('eye')+'<span>شاهد</span></button><button type="button" class="scDetails" data-sc-action="details" data-room="'+E(m.id)+'" aria-label="تفاصيل '+E(m.name)+'">ⓘ</button></div></footer></div></article>';
 }
 const filters={majabeed:{status:'all'},baloot:{status:'all'}};
 let context=null,returnFocus=null,detail=null;
 let vipActive=root.VipClient?.active?.()===true;
 // VipClient updates the body class after verification, account reset and
 // expiry. Repaint the existing rows only; no directory request is needed.
 if(document.body)new MutationObserver(()=>{
  const next=root.VipClient?.active?.()===true;if(next===vipActive)return;vipActive=next;
  const panel=document.getElementById('sessionsModal');if(context&&panel&&!panel.classList.contains('hidden'))paint();
 }).observe(document.body,{attributes:true,attributeFilter:['class']});
 function render(options){
  context=options;const panel=document.getElementById('sessionsModal');if(!panel)return;
  panel.classList.add('scCatalog');panel.dataset.game=options.game;
  const title=document.getElementById('sessionsTitle');if(title)title.textContent=options.game==='baloot'?'جلسات صكة':'جلسات مجابيد';
  const tools=document.getElementById('sessionsTools');
  if(tools&&!tools.dataset.initialized){
   tools.dataset.initialized='1';tools.innerHTML='<div class="scFilterBar"><div class="scFilters" aria-label="تصفية الجلسات">'+[['all','الكل'],['open','مقاعد متاحة'],['playing','تلعب الآن']].map(([v,t])=>'<button type="button" data-sc-status="'+v+'" aria-pressed="false">'+t+'</button>').join('')+'</div><button type="button" class="scRefresh" data-sc-action="refresh" aria-label="تحديث الجلسات">'+icon('refresh')+'</button></div><div class="scDirectoryActions"><button type="button" data-sc-action="create">+ أنشئ جلسة</button><button type="button" data-sc-action="code">'+icon('lock')+' دخول بالرمز</button><span id="scCount"></span></div>';
   panel.addEventListener('click',event=>{
    const status=event.target.closest('[data-sc-status]');if(status){filters[context.game].status=status.dataset.scStatus;paint();return;}
    const b=event.target.closest('[data-sc-action]');if(!b||b.disabled)return;
    const action=b.dataset.scAction,id=b.dataset.room;
    if(action==='refresh')context.onRefresh?.();else if(action==='create')context.onCreate?.();else if(action==='code')context.onCode?.();
    else if(action==='join'||action==='watch')context.onJoin?.(id,action==='watch');else if(action==='details')openDetails(id,b);
   });
   panel.addEventListener('keydown',event=>{if(event.key==='Escape'){if(detail)closeDetails();else document.getElementById('sessionsClose')?.click();event.preventDefault();event.stopPropagation();}else if(event.key==='Tab'){const active=detail||panel,buttons=[...active.querySelectorAll('button:not(:disabled),input')].filter(n=>n.getClientRects().length);if(!buttons.length)return;const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
   panel.addEventListener('error',event=>{if(event.target.tagName==='IMG'){const node=event.target;node.hidden=true;node.parentElement.classList.add('imageMissing');}},true);
   new MutationObserver(()=>{if(panel.classList.contains('hidden'))closeDetails();}).observe(panel,{attributes:true,attributeFilter:['class']});
  }
  if(tools){tools.querySelector('[data-sc-action="create"]').hidden=!options.onCreate;tools.querySelector('[data-sc-action="code"]').hidden=!options.onCode;}
  paint();
 }
 function paint(){
  if(!context)return;const list=document.getElementById('sessionsList'),empty=document.getElementById('sessionsEmpty'),f=filters[context.game];
  document.querySelectorAll('[data-sc-status]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scStatus===f.status)));
  const rows=Array.isArray(context.rows)?context.rows:null;
  const filtered=rows?.filter(r=>{const m=model(r,context.game,context.uid);return(f.status!=='open'||m.joinable)&&(f.status!=='playing'||m.playing);});
  const count=document.getElementById('scCount');if(count)count.textContent=rows?N(filtered.length)+' جلسة':'';
  empty?.classList.add('hidden');
  if(!context.error&&filtered?.length){
   const existing=new Map([...list.querySelectorAll(':scope > .scCard')].map(n=>[n.dataset.sessionId,n])),keep=new Set();
   let position=0;
   for(const row of filtered){const html=card(row,context.game,context.uid),id=String(row.id||'');let node=existing.get(id);if(!node||node._scHTML!==html){const template=document.createElement('template');template.innerHTML=html;const next=template.content.firstElementChild;next._scHTML=html;if(node)node.replaceWith(next);node=next;}keep.add(node);if(list.children[position]!==node)list.insertBefore(node,list.children[position]||null);position++;}
   for(const node of [...list.children])if(!keep.has(node))node.remove();
  }else{
   const markup=context.error?'<div class="scEmpty" role="status">تعذّر تحديث الجلسات. حاول مرة أخرى.<button type="button" data-sc-action="refresh">إعادة المحاولة</button></div>':!rows?'<div class="scLoading" role="status"><i></i>نجهّز مجالس الربع…</div>':'<div class="scEmpty">'+icon('cards')+'<h3>'+(f.status!=='all'?'لا توجد جلسة مطابقة':'المجلس ينتظر ربعك')+'</h3><p>'+(f.status!=='all'?'غيّر خيارات التصفية.':'أنشئ جلسة وادعُ أصدقاءك للعب.')+'</p></div>';
   if(list.innerHTML!==markup)list.innerHTML=markup;
  }
  if(detail){const row=rows?.find(r=>r.id===detail.dataset.room);if(!row)closeDetails();else detail.querySelector('.scDetailContent').innerHTML=details(model(row,context.game,context.uid));}
 }
 function details(m){
  const ranks=m.raw.deckOrder?.ranks,valid=Array.isArray(ranks)&&ranks.length===13&&new Set(ranks).size===13&&ranks.every(r=>integer(r,2,14));
  return '<div class="scDetailHero" data-tone="'+(m.theme?.tone||'classic')+'">'+(m.theme?'<img src="'+m.theme.image+'" alt="">':'')+'<span>'+E(m.theme?.name||'مجلس الربع')+'</span></div><h2>'+E(m.name)+'</h2><div class="scChips">'+chips(m)+'</div>'+(!m.sakka?'<h3>'+E(m.order)+'</h3>'+(!valid||m.mode==='random'?'<p>'+(m.mode==='random'?'تتوزع الأوراق بخلط عشوائي.':'تفاصيل الرص غير متاحة لهذه الجلسة.')+'</p>':'<ol class="scPattern">'+ranks.map((r,i)=>'<li aria-label="الموضع '+N(i+1)+': '+(r>=10?'صورة':N(r))+'"><small>'+N(i+1)+'</small>'+(r>=10?'<span>♠<b>صورة</b></span>':'<img src="cards/'+r+'D.png" alt="'+N(r)+'">')+'</li>').join('')+'</ol><p>خانة الصورة تتبدل بين العشرة والولد والبنت والشايب والآكة. الجواكر موزعة تلقائيًا.</p>'):'<p>صكة جماعية · لاعبان في كل فريق.</p>')+'<p>'+(m.hidden?'النتيجة مخفية أثناء اللعب وتظهر عند نهاية الجولة.':'النتيجة ظاهرة أثناء اللعب.')+'</p><p class="scChatStatus">'+icon('chat')+(m.chatEnabled?'الشات مفتوح: المحادثة والاختصارات متاحة.':'الشات مغلق: أصوات اللعب والإعلانات مستمرة.')+'</p><p class="scPrivacyNote">'+(m.private?'جلسة خاصة: الدخول بالرابط أو الرمز.':'جلسة عامة: تظهر في قائمة الجلسات.')+'</p>';
 }
 function closeDetails(){if(!detail)return;detail.remove();detail=null;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
 function openDetails(id,button){
  const row=context.rows?.find(r=>r.id===id);if(!row)return;closeDetails();returnFocus=button;
  detail=document.createElement('section');detail.className='scDetail';detail.dataset.room=id;detail.setAttribute('role','dialog');detail.setAttribute('aria-modal','true');detail.setAttribute('aria-label','تفاصيل الجلسة');
  detail.innerHTML='<header><strong>تفاصيل الجلسة</strong><button type="button" aria-label="إغلاق تفاصيل الجلسة">×</button></header><div class="scDetailContent">'+details(model(row,context.game,context.uid))+'</div>';
  document.getElementById('sessionsModal').append(detail);detail.querySelector('button').onclick=closeDetails;detail.querySelector('button').focus();
 }
 root.MajabeedSessionsCatalog={render,card,model,themes,closeDetails};
})(window);
