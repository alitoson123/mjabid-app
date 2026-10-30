/* V398: Baloot integration. Shared account/social/store; isolated gameplay DOM and transport. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const N={sira:'سرا',fifty:'خمسين',hundred:'مئة',fourHundred:'أربعمئة',baloot:'بلوت'},C={cut:'قاطع',noTrump:'ما دق بحكم',underTrump:'ما كبّر بحكم',closedLead:'ربع في الدبل',project:'مشروع غلط',akka:'تأكيك غير صحيح',sawa:'سوا غير صحيحة'},S={S:'♠',H:'♥',D:'♦',C:'♣'};
 const suitHTML=s=>'<span class="blSuit '+(['H','D'].includes(s)?'red':'black')+'" aria-label="'+({S:'سبيت',H:'هاص',D:'دايمن',C:'شيريا'}[s]||'')+'">'+(S[s]||'')+'</span>';
 const B={selected:localStorage.getItem('mj-game')==='baloot'?'baloot':'majabeed',hub:null,room:null,state:null,pending:null,seq:-1,signature:'',offset:0,profile:null,modal:null,board:'all',queue:false,queueAt:0,clock:null,first:null,second:null,slot:'first',projectType:'sira',projectDraft:null,projectCards:[],projectItems:[],declareItems:[],muted:localStorage.getItem('mj-baloot-muted')==='1',generation:0,preselect:null,akka:false,chatOpen:false,chatTab:'free',chatSeen:new Set(),lastTap:null,revealUntil:0,revealSeat:null,declareUntil:{},notice:null,loading:null,loadSerial:0,profileUid:null,profileLoading:false,profileError:false,queuePlayers:[],queueCount:0,suspendedRoom:null,restoring:false};
 const sessionChoices=new Map(),friendRequests=new Map();
 const user=()=>typeof FB!=='undefined'?FB.user:null;
 const frame=()=>$('#frame')||document.body;
 const btn=(label,action,cls='',attrs='')=>'<button type="button" class="blBtn '+cls+'" data-bl="'+action+'" '+attrs+'>'+label+'</button>';
 const img=(id,cls='')=>'<img class="blCardFace '+cls+'" src="cards/'+E(id)+'.png" alt="'+E(id)+'" draggable="false">';
 const legacyAvatar=p=>p?.avatar&&/^(avatars\/|ui-art\/|https:\/\/)/.test(p.avatar)?'<img class="blAvatar" src="'+E(p.avatar)+'" alt="">':'<span class="blAvatar" style="display:inline-grid;place-items:center;font-size:25px">♠</span>';
 const avatar=p=>'<span class="blAvatar">'+(typeof avatarHTML==='function'?avatarHTML(p?.avatar||'avatars/avatar_1.png',46):legacyAvatar(p))+'</span>';
 const toast=text=>{let el=$('#blToast');if(!el){el=document.createElement('div');el.id='blToast';el.style.cssText='position:absolute;left:20px;right:20px;bottom:24%;z-index:3000;background:#10291ff5;border:1px solid #d9bc7b;padding:13px;border-radius:14px;color:#ffe5ac;text-align:center;font:13px var(--fb);pointer-events:none';frame().append(el)}el.textContent=text;el.hidden=false;clearTimeout(B.toast);B.toast=setTimeout(()=>el.hidden=true,4200);};
 function sound(key){if(B.muted)return;if(key==='click'){if(typeof SFX!=='undefined')SFX.tick();return;}window.BalootAudio?.play(({click:'ui_click',deal:'card_deal',card:'card_play',collect:'trick_collect',project:'project_show',win:'round_win',lose:'round_lose'})[key]||key);}
 // Retain mounted controls, scroll and focus while live room snapshots arrive.
 function patchModalNode(current,next){
  const identity=n=>n.nodeType===1?[n.tagName,n.id,...['bl','card','seat','slot','reason'].map(k=>n.dataset[k]||'')].join(':'):n.nodeType;
  if(identity(current)!==identity(next)){current.replaceWith(next.cloneNode(true));return;}
  if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name)&&!(current.tagName==='DETAILS'&&attr.name==='open'))current.removeAttribute(attr.name);
  for(const attr of next.attributes)if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  if(current.hasAttribute('data-bl-clock'))return;
  const before=[...current.childNodes],after=[...next.childNodes];
  for(let i=0;i<Math.max(before.length,after.length);i++){if(!after[i])before[i].remove();else if(!before[i])current.append(after[i].cloneNode(true));else patchModalNode(before[i],after[i]);}
 }
 function modal(title,body,kind='custom',close=true){
  hideChat();if(B.modal==='sessions')closeModal();let el=$('#blModal');if(!el){el=document.createElement('section');el.id='blModal';el.className='blModal';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');frame().append(el);el.addEventListener('click',click);el.addEventListener('pointerup',advanceTap);}
  const same=B.modal===kind&&!el.hidden,markup='<div class="blPanel"><header><h2 id="blModalTitle">'+E(title)+'</h2>'+(close?btn('×','close','','aria-label="إغلاق"'):'')+'</header><div id="blModalBody">'+body+'</div></div>',focused=document.activeElement,hadFocus=el.contains(focused);
  if(!same)el.classList.remove('blMatchResult','blClaimResultReview','blCompetitiveResult','blRoundResult');
  B.modal=kind;el.dataset.kind=kind;el.hidden=false;el.setAttribute('aria-labelledby','blModalTitle');
  if(!same)el.innerHTML=markup;
  else if(el._blMarkup!==markup){const template=document.createElement('template');template.innerHTML=markup;patchModalNode(el.firstElementChild,template.content.firstElementChild);}
  el._blMarkup=markup;
  el.onkeydown=e=>{if(e.key==='Escape'&&close)closeModal();if(e.key==='Tab'){const list=[...el.querySelectorAll('button:not(:disabled),input,select,summary')];if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
  if(!same||hadFocus&&!focused.isConnected)requestAnimationFrame(()=>{if(!el.hidden&&B.modal===kind)el.querySelector('button:not(:disabled),input,summary')?.focus({preventScroll:true});});return el;
 }
 function closeModal(){clearTimeout(B.viewTimer);B.viewRequest=null;if(B.modal==='sessions'){$('#sessionsModal').classList.add('hidden');if(B.hub?.ready)B.hub.ws.send(JSON.stringify({type:'closeSessions'}));}B.modal=null;const el=$('#blModal');if(el)el.hidden=true;}

 function active(){const g=B.state?.game;return !!g&&(g.phase!=='matchEnd'||!!g.claimReviewUntil);}
 function select(game){const uid=user()?.uid;if(!uid||!['baloot','majabeed'].includes(game)||B.pickerUid&&B.pickerUid!==uid)return;if(active()||B.queue||typeof ONL!=='undefined'&&ONL.active||typeof MATCH!=='undefined'&&MATCH.on){toast('أنهِ الجلسة أو غادرها قبل تغيير اللعبة');return;}transitionTo('ننتقل إلى '+(game==='baloot'?'صكة':'مجابيد')+'…',()=>{if(user()?.uid!==uid)return;WBMsg.pubUnsub?.();rememberGame(game);closePicker();closeModal();home();try{mountNav('home','home')}catch(_){}if(game==='baloot')loadProfile();else closeLink('hub');});}


 const RANKS=window.MAJABEED_BALOOT_RANKS;
 const ICONS={home:'<rect x="3" y="5" width="11" height="16" rx="2" transform="rotate(-12 8 13)"/><rect x="10" y="3" width="11" height="16" rx="2" transform="rotate(10 15 11)"/>',more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',board:'<path d="M9 21V3h6v18M3 21V10h6m6-6h6v17M1 21h22"/>',sessions:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M8 3v3m8-3v3M8 18v3m8-3v3M3 12H1m22 0h-2"/>',friends:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-4-5.65"/>',inbox:'<path d="M3 5h18v15H3zM3 7l9 6 9-6"/>'};
 const icon=k=>'<svg class="uiIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[k]||ICONS.more)+'</svg>';
 function rankInfo(profile=B.profile){const p=profile,points=p?.points||0,days=p?.days||0,ranks=p?.ranks||RANKS,current=p?.rank||ranks.filter(r=>r.at<=points&&(r.days||0)<=days).at(-1)||ranks[0],tier=current.tier??ranks.findIndex(r=>r.at===current.at),next=ranks[tier+1],band=p?.band||ranks.filter(r=>r.at<=points).at(-1);return {p,points,days,current,next,band,pct:next?Math.max(0,Math.min(100,100*(points-current.at)/(next.at-current.at))):100,tier};}
 function crestHTML(tier=0){tier=Math.max(0,Math.min(9,Number(tier)||0));return '<span class="blCrest" data-tier="'+tier+'" aria-hidden="true"><img src="ui-art/baloot-ranks/rank-'+tier+'.svg?v=398" alt="" draggable="false"></span>';}
 function rankJourney(r,mine=true){if(!r.next)return mine?'وصلت إلى شيخ البلوت؛ نقاطك تستمر والصدارة تنتظرك':'وصل إلى شيخ البلوت';return (r.points<r.next.at?'باقي <b>'+(r.next.at-r.points)+'</b> نقطة إلى '+E(r.next.name):'نقاط '+E(r.next.name)+' مكتملة')+(r.next.days&&r.days<r.next.days?' · <b>'+r.days+' / '+r.next.days+'</b> يوم لعب مؤهل':'');}
 function rankResult(){
  const d=B.state,r=d?.progression,g=d?.game;
  if(!r||r.match&&r.match!==g?.id)return '<div class="blRankPending" role="status">'+(d?.settled?'تفاصيل نقاط هذه الصكة غير متاحة حاليًا':'جارٍ اعتماد نقاط هذه الصكة…')+'</div>';
  const current=r.rank||RANKS.filter(x=>x.at<=r.after&&(x.days||0)<=(r.days||0)).at(-1)||RANKS[0],tier=current.tier??RANKS.findIndex(x=>x.at===current.at),next=RANKS[tier+1],promoted=!!r.beforeRank&&tier>r.beforeRank.tier,demoted=!!r.beforeRank&&tier<r.beforeRank.tier;
  const pct=next?Math.max(0,Math.min(100,100*(r.after-current.at)/(next.at-current.at))):100,remaining=next?Math.max(0,next.at-r.after):0,daysKnown=Number.isFinite(r.days),daysLeft=next&&daysKnown?Math.max(0,(next.days||0)-r.days):0;
  const number=n=>Math.max(0,Math.trunc(n)).toLocaleString('en-US'),delta=(r.delta>0?'+':r.delta<0?'−':'')+number(Math.abs(r.delta));
  const status=promoted?'ترقيت من '+r.beforeRank.name:demoted?'تغيّر مستواك من '+r.beforeRank.name:'مستواك الحالي',change=r.delta>0?'نقطة مكتسبة':r.delta<0?'نقطة مخصومة':r.protected?'حماية حد الرتبة':'لم تتغير نقاطك';
  const notices=[r.protected?(r.delta===0?'حماية حد الرتبة منعت خصم النقاط.':'حماية حد الرتبة حدّت الخصم إلى '+number(Math.abs(r.delta))+' نقطة.'):null,r.didNotJoin?'لم تدخل الصكة؛ لا تُمنح نقاط أو يوم لعب.':r.exempt?'أُعفيت عقوبة الانسحاب بسبب عطل مؤكد.':r.forfeited?'انتهت مهلة العودة؛ طُبقت نتيجة الانسحاب.':null,r.legacy?'هذه الصكة بدأت بنظام النقاط السابق.':null].filter(Boolean);
  const journey=next?'<div class="blRankDestination">'+crestHTML(next.tier)+'<div><small>هدفك التالي · المستوى '+(next.tier+1)+'</small><b>'+E(next.name)+'</b></div><span>'+number(next.at)+' نقطة</span></div><div class="blRankMeter" role="progressbar" aria-label="التقدم بالنقاط إلى '+E(next.name)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(pct)+'"><i style="width:'+pct+'%"></i></div><p class="blRankRemaining">'+(remaining?'باقي <b>'+number(remaining)+'</b> نقطة':'اكتملت نقاط المستوى التالي')+'</p>'+(next.days?'<p class="blRankDays">'+(daysKnown?'أيام اللعب المؤهلة <bdi>'+number(r.days)+' / '+number(next.days)+'</bdi>'+(daysLeft?' · باقي '+number(daysLeft)+' يوم': ' · مكتملة'):'يتطلب هذا المستوى '+number(next.days)+' يوم لعب مؤهل')+'</p>':''):'<p class="blRankSummit">وصلت إلى أعلى مستوى · استمر في جمع النقاط والمنافسة على الصدارة</p>';
  return '<section class="blRankResult" aria-label="نتيجة التقدم التنافسي"><div class="blRankIdentity '+(promoted?'promoted':'')+'">'+crestHTML(tier)+'<div><small>'+E(status)+'</small><strong>'+E(current.name)+'</strong><span>المستوى '+(tier+1)+(promoted?' · ترقية جديدة':'')+'</span></div></div><div class="blRankChange '+(r.delta<0?'loss':r.delta>0?'gain':'neutral')+'"><strong dir="ltr">'+delta+'</strong><span>'+change+'</span></div><div class="blRankBalances"><div><small>قبل الصكة</small><bdi>'+number(r.before)+'</bdi></div><span aria-hidden="true">←</span><div><small>رصيدك الآن</small><bdi>'+number(r.after)+'</bdi></div></div><div class="blRankJourney">'+journey+'</div>'+notices.map(t=>'<p class="blRankNotice">'+E(t)+'</p>').join('')+'</section>';
 }
 function ranksDialog(){const r=rankInfo();modal('رتب صكة','<p class="blNote">نقاط ترقية مستقلة عن نتيجة الصكة والذهب. الفوز والخسارة بحسب رصيدك عند البداية؛ كل شريك يأخذ قيمته كاملة.</p><div class="blRankList">'+RANKS.map((t,i)=>'<article class="blRankRow '+(i===r.tier?'current':'')+'">'+crestHTML(i)+'<div><b>'+E(t.name)+'</b><span><bdi dir="ltr">'+t.at.toLocaleString('en-US')+(RANKS[i+1]?'–'+(RANKS[i+1].at-1).toLocaleString('en-US'):'')+'</bdi>'+(RANKS[i+1]?'':' فأكثر')+' نقطة</span><small>فوز <bdi dir="ltr">+'+t.win+'</bdi> · خسارة <bdi dir="ltr">'+(t.loss?'−'+t.loss:'٠')+'</bdi>'+(t.days?' · '+t.days+' يوم لعب':'')+'</small></div></article>').join('')+'</div><p class="blNote">كل حد تصل إليه يصبح محميًا، حتى أثناء انتظار أيام الشارة. الأيام غير متتالية وتُحسب بإكمال صكة تنافسية مؤهلة، ولا تتصفر النقاط أو الأيام. الودي والكمبيوتر لا يمنحان نقاطًا.</p>','ranks');}
 function syncNavigation(){
  const baloot=B.selected==='baloot';frame().dataset.majabeedGame=B.selected;
  if(typeof NAV_ITEMS==='undefined')return;
  if(!B.originalLeague)B.originalLeague=NAV_ITEMS.find(x=>x.k==='leagues');
  if(B.navMode===B.selected)return;B.navMode=B.selected;
  const i=NAV_ITEMS.findIndex(x=>x===B.originalLeague||x.blProfile);if(i>=0)NAV_ITEMS.splice(i,1,baloot?{k:'shop',label:'المتجر',blProfile:true,go:()=>openShop()}:B.originalLeague);
  document.querySelectorAll('.navBar').forEach(el=>el.remove());
  if(baloot&&typeof lgAutoStop==='function')lgAutoStop();
  if(typeof mountNav==='function')mountNav(typeof UI_NAV!=='undefined'?UI_NAV.screen:'home',typeof UI_NAV!=='undefined'?UI_NAV.active:'home');
 }
 function home(){
  const uid=user()?.uid||null;accountChoice(uid);if(B.profileUid!==uid){B.profile=null;B.profileAt=0;B.profileUid=uid;B.overview=null;B.sessionRows=null;B.publicCallback=null;B.invitation=null;$('#blInviteBar')?.setAttribute('hidden','');B.profileLoading=false;B.profileError=false;}
  if(B.room&&B.room.uid!==uid){closeLink('room');B.state=null;$('#blGame').hidden=true;endLoad();closeModal();}if(B.hub&&B.hub.uid!==uid)closeLink('hub');
  const h=$('#home');if(!h)return;paintOverview();$('#sessionsModal').classList.toggle('blSessions',B.selected==='baloot');$('#sessionsModal > div > div > span').textContent=B.selected==='baloot'?'جلسات صكة':'الجلسات النشطة';h.classList.toggle('blHome',B.selected==='baloot');syncNavigation();
  $('#blSelector').setAttribute('aria-label','تغيير اللعبة · الحالية '+(B.selected==='baloot'?'صكة':'مجابيد'));$('#blSelector').innerHTML='<span class="blSwitchGames"><span class="blSwitchGame '+(B.selected==='baloot'?'current':'')+'">♠ <b>صكة</b></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/></svg><span class="blSwitchGame '+(B.selected==='majabeed'?'current':'')+'">♣ <b>مجابيد</b></span></span><small class="blSwitchHint">تغيير اللعبة</small>';
  const mark=h.querySelector('.uiHomeWordmark');if(mark)mark.textContent='مجابيد';
  if(B.selected==='baloot'){
   const r=rankInfo(),text=r.p?r.current.name:B.profileError?'تعذّر تحميل الرتبة':'جارٍ تحميل الرتبة…';
   $('#blHomeRank').innerHTML=(r.p?crestHTML(r.tier):'')+'<span>'+E(text)+'</span>'+(r.p?'<b>'+r.points+' نقطة</b><i><em style="width:'+r.pct+'%"></em></i>':'');
   $('#hProfBtn').setAttribute('aria-label','ملفي · '+(localStorage.getItem('wb-name')||'لاعب')+' · '+text);$('#blResume').hidden=!readResume();
  }else{$('#hProfBtn').removeAttribute('aria-label');if(typeof rankBadgeHTML==='function')$('#hRankBadge').innerHTML=rankBadgeHTML(ST.n('rank'),12);}
  welcomeChoice();
 }
 function profileView(){
  if(B.profileUid!==(user()?.uid||null)){B.profile=null;B.profileUid=user()?.uid||null;B.profileAt=0;B.profileLoading=false;B.profileError=false;}
  const el=$('#profile'),other=typeof viewedProfile!=='undefined'&&viewedProfile,mine=!other,on=B.selected==='baloot'&&(mine||other.game==='baloot');el?.classList.toggle('blProfile',on);if($('#pfGameLabel'))$('#pfGameLabel').textContent=on?'صكة':'مجابيد';
  const label=$('#stBest')?.parentElement?.querySelector('span:last-child');if(label){B.bestLabel=B.bestLabel||label.textContent;label.textContent=on?'نقاط الترتيب':B.bestLabel;}
  const achievements=$('#pfAchievements');if(achievements)achievements.hidden=on;
  const historyEmpty=$('#pfHistoryEmpty');if(historyEmpty){B.historyEmptyText=B.historyEmptyText||historyEmpty.textContent;if(!on)historyEmpty.textContent=B.historyEmptyText;}if(!on||!el||el.classList.contains('hidden'))return;
  let box=$('#blProfileRank');if(!box){box=document.createElement('section');box.id='blProfileRank';$('#pfStats').before(box);box.addEventListener('click',click);}
  const r=rankInfo(mine?B.profile:other.balootProfile),p=r.p;box.innerHTML=p?'<div class="blRankHeading">'+crestHTML(r.tier)+'<div><small>'+(mine?'رتبتك في صكة':'رتبته في صكة')+'</small><h2>'+E(r.current.name)+'</h2><b><bdi dir="ltr">'+r.points+(r.next&&r.points<r.next.at?' / '+r.next.at:'')+'</bdi> <span>نقاط الترقية</span></b></div></div><div class="blRankTrack" role="progressbar" aria-label="التقدم للرتبة التالية" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(r.pct)+'"><i style="width:'+r.pct+'%"></i></div><p>'+rankJourney(r,mine)+'</p><div class="blRankRates"><span>فوز <b>+'+r.band.win+'</b></span><span>خسارة <b>'+(r.band.loss?'−'+r.band.loss:'٠')+'</b></span><span>أيام اللعب <b>'+r.days+'</b></span></div>'+(p.weeklyChampion?'<p class="blWeeklyTitle">♛ بطل الأسبوع <small>لقب مؤقت للأسبوع الحالي</small></p>':'')+btn('استعرض الرتب','ranks','blRankLink'):loadingHTML(B.profileError?'تعذّر تحديث رتبتك':'نحدّث رتبتك وإحصاءاتك')+(B.profileError?btn('إعادة المحاولة','profileRetry'):'');
  $('#pfRankBadge').textContent=p?r.current.name:'';$('#stGames').textContent=p?p.played||0:'—';$('#stWins').textContent=p?p.wins||0:'—';$('#stBest').textContent=p?r.points:'—';
  const rate=p?.played?Math.round(p.wins/p.played*100):0;$('#stRate').textContent=p?rate+'%':'—';$('#pfBar i').style.width=rate+'%';$('#pfHistory').style.display='none';
  const empty=$('#pfHistoryEmpty');if(empty){empty.textContent=mine?'إحصاءات مباريات صكة في تبويب نظرة عامة.':'إحصاءات هذا اللاعب في صكة معروضة في نظرة عامة؛ سجل الجولات التفصيلي خاص بصاحبه.';empty.hidden=false;}
 }
 function loadingHTML(text){return '<div class="blLoading" role="status"><div class="blLoadingCards" aria-hidden="true">'+img('KH')+img('AS')+img('QD')+'</div><p>'+E(text)+'</p><span class="uiEntryRail"></span></div>';}
 function beginLoad(kind,text,retry){
  endLoad();const id=++B.loadSerial;B.loading={kind,id,retry};const el=$('#pageLoader');if(!el)return;
  let actions=$('#blLoadActions');if(!actions){actions=document.createElement('div');actions.id='blLoadActions';actions.innerHTML=btn('إعادة المحاولة','loadRetry','blPrimary')+btn('رجوع','loadBack');el.append(actions);actions.addEventListener('click',click);}
  actions.querySelector('[data-bl="loadBack"]').textContent='رجوع';actions.hidden=kind==='navigation'||kind==='leave';actions.querySelector('[data-bl="loadRetry"]').hidden=true;el.dataset.blLoading='true';el.classList.remove('hidden');el.style.opacity='1';$('#pageLoaderTxt').textContent=text;
  B.loadTimer=setTimeout(()=>{if(B.loading?.id===id)loadError(navigator.onLine===false?'أنت غير متصل بالإنترنت':'الاتصال يأخذ وقتًا أطول؛ يمكنك إعادة المحاولة');},12000);
 }
 function loadError(text){if(!B.loading)return;clearTimeout(B.loadTimer);$('#pageLoaderTxt').textContent=text;$('#blLoadActions [data-bl="loadRetry"]').hidden=false;if(B.loading.kind==='leave'){$('#blLoadActions').hidden=false;$('#blLoadActions [data-bl="loadBack"]').textContent='الرئيسية';}}
 function endLoad(kind){if(!B.loading||kind&&B.loading.kind!==kind)return;clearTimeout(B.loadTimer);B.loading=null;const el=$('#pageLoader');if(el?.dataset.blLoading){delete el.dataset.blLoading;el.classList.add('hidden');el.style.opacity='1';}}
 function viewError(request){
  if(B.viewRequest!==request||B.modal!==request.kind)return;clearTimeout(B.viewTimer);
  const target=request.kind==='board'?$('#blModalBody'):$('#sessionsList');if(target)target.innerHTML='<p class="blEmpty">تعذّر تحميل القائمة. تحقق من الاتصال وأعد المحاولة.</p>'+btn('إعادة المحاولة',request.kind,'blPrimary',request.kind==='board'?'data-period="'+B.board+'"':'');
 }
 function requestView(kind){if(kind==='board')board();else{B.sessionRows=null;sessions();}clearTimeout(B.viewTimer);const request={kind,uid:user()?.uid};B.viewRequest=request;B.viewTimer=setTimeout(()=>viewError(request),12000);sendHub({type:kind,...(kind==='board'?{period:B.board}:{})}).then(ok=>{if(!ok)viewError(request);});return true;}
 function finishView(kind){if(B.viewRequest?.kind===kind){clearTimeout(B.viewTimer);B.viewRequest=null;}}
 function queueView(){
  const el=$('#blQueue');if(!el||!B.queue)return;el.hidden=false;const connected=!!B.hub?.ready,count=connected?Math.min(4,B.queueCount):0;
  $('#blQueueStatus').textContent=connected?'نبحث لك عن منافسين…':B.hub?.closed?'تعذّر الاتصال بالبحث':'نجهّز اتصالك بالطاولة…';
  $('#blQueueCount').innerHTML=connected?'<bdi dir="ltr">'+count+' / 4</bdi> لاعبين جاهزين':'بانتظار الاتصال';
  $('#blQueueRetry').hidden=connected;$('#blQueueSteps').innerHTML=[0,1,2,3].map(i=>'<i class="'+(i<count?'ready':'')+'"></i>').join('');
  const players=connected?B.queuePlayers:[];
  $('#blQueueSeats').innerHTML=[0,1,2,3].map(i=>{const p=players[i];return '<div class="blWaitingSeat '+(p?(p.uid===user()?.uid?'me':'ready'):'empty')+'">'+(p?avatar(p):'<span class="blEmptySeat" aria-hidden="true">'+icon('profile')+'</span>')+'<b>'+E(p?.name||(connected&&i<count?'لاعب جاهز':'بانتظار لاعب'))+'</b><small>'+(p?.uid===user()?.uid?'أنت':p?'جاهز':'نكمّل اللمّة')+'</small></div>';}).join('');
 }
 function openQueue(){
  if(B.queue)return false;if(B.queueBlockedUntil>Date.now()){receive('hub',{type:'queueBlocked',until:B.queueBlockedUntil});return false;}if(!user()){toast('سجّل دخولك للعب صكة');return false;}closeModal();B.queue=true;B.queueAt=Date.now();B.queueCount=0;B.queuePlayers=[];queueView();startClock();
  if(B.hub?.ready)B.hub.ws.send(JSON.stringify({type:'queue'}));else connect('hub','/baloot/hub').catch(()=>queueView());return true;
 }
 function stopQueue(){B.queue=false;$('#blQueue').hidden=true;if(B.hub?.ready)B.hub.ws.send(JSON.stringify({type:'cancelQueue'}));}
 function background(){
  cancelPublicProfile();cancelDrag();clearCardMotion();
  clearTimeout(B.syncTimer);
  B.preselect=null;B.akka=false;B.restoring=false;clearTimeout(B.restoreTimer);hideChat();paintPreselect();
  if(B.room?.ready&&B.state?.me>=0)sendRoom({type:'presence',visible:false});
  // Leaving the app ends this view's intent. Only an explicit new entry may reopen it.
  // Closing the transport keeps the server's existing disconnect/auto-play rules.
  if(B.room||B.queue||B.loading?.kind==='create'||B.resumeRequested||B.publicJoin||B.inviteAfterCreate){
   B.returnHome=true;B.inviteAfterCreate=null;if(B.publicJoin)clearPublicJoin();leaveLocal({navigate:false,refresh:false});
  }
  closeLink('hub');
 }
 function foreground(){
  if(document.hidden)return;
  if(B.returnHome){B.returnHome=false;goHome();if(B.selected==='baloot'&&user())loadProfile(true);return;}
  if(B.room||B.queue)startClock();if(B.selected==='baloot'&&user()&&!B.hub)loadProfile(true);
  if(B.room?.ready){
   const link=B.room,id=B.state?.room,spectate=B.state?.me<0;clearTimeout(B.syncTimer);
   if(B.state?.me>=0)sendRoom({type:'presence',visible:true});sendRoom({type:'sync'});
   B.syncTimer=setTimeout(()=>{if(B.room===link&&id&&!document.hidden){closeLink('room');join(id,spectate);}},5000);
  }else if(B.room&&!B.room.closed){clearTimeout(B.room.retry);B.room.open();}
 }
 const choiceKey=uid=>'mj-game-choice:'+uid;
 function rememberedGame(uid){if(!uid)return null;if(sessionChoices.has(uid))return sessionChoices.get(uid);try{const v=localStorage.getItem(choiceKey(uid));return ['majabeed','baloot'].includes(v)?v:null;}catch(_){return null;}}
 function needsChoice(){const uid=user()?.uid;return !!uid&&!rememberedGame(uid);}
 function routeFor(id,overlay){if(!overlay&&needsChoice()&&!active()&&!(typeof ONL!=='undefined'&&ONL.active)&&!['home','welcome','login','signup','gcomplete'].includes(id))return 'home';return id;}
 function accountChoice(uid){
  if(B.choiceUid===uid)return;cancelPublicProfile();closePicker(false);B.choiceUid=uid;B.dailyAfterChoice=null;B.queueBlockedUntil=0;
  B.resume=null;B.resumeRequested=false;try{localStorage.removeItem('mj-baloot-room:'+uid);}catch(_){}
  B.selected=rememberedGame(uid)||'majabeed';
 }
 function rememberGame(game){const uid=user()?.uid;if(!uid)return;if(B.selected!==game)cancelPublicProfile();sessionChoices.set(uid,game);B.choiceUid=uid;B.selected=game;try{localStorage.setItem('mj-game',game);if(uid)localStorage.setItem(choiceKey(uid),game);}catch(_){} }
 function closePicker(restoreFocus=true){const el=$('#blGamePicker');if(el)el.hidden=true;$('#home')?.removeAttribute('inert');B.pickerUid=null;B.firstChoice=false;if(restoreFocus)$('#blSelector')?.focus({preventScroll:true});}
 function selector(first=false){
  const uid=user()?.uid;if(!uid||B.room||B.queue||typeof ONL!=='undefined'&&ONL.active||typeof MATCH!=='undefined'&&MATCH.on)return;
  closeModal();B.pickerUid=uid;B.firstChoice=first;let el=$('#blGamePicker');
  if(!el){el=document.createElement('section');el.id='blGamePicker';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','blPickerTitle');el.addEventListener('click',click);frame().append(el);}
  const card=(game,title,detail,cards)=>'<button class="blGameChoice" data-bl="select" data-game="'+game+'"><span class="blChoiceArt" aria-hidden="true">'+cards.map(id=>img(id)).join('')+'</span><span class="blChoiceCopy"><span class="blChoiceTag">'+(game==='majabeed'?'المزايدة والكومات':'الصن والحكم')+'</span><strong>'+title+'</strong><span class="blChoiceDetail">'+detail+'</span><span class="blChoiceStart">ابدأ '+(game==='majabeed'?'بمجابيد':'بصكة')+' <b aria-hidden="true">←</b></span></span></button>';
  el.innerHTML='<div class="blPickerPage"><header><span class="blPickerBrand">'+icon('home')+' مجابيد</span>'+(first?'<span class="blPickerStep">بدايتك من هنا</span>':btn('رجوع','pickerClose','','aria-label="الرجوع للرئيسية"'))+'</header><div class="blPickerIntro"><span class="blPickerEyebrow">'+(first?'حيّاك معنا':'اللعبة على كيفك')+'</span><h1 id="blPickerTitle">وش نلعب اليوم؟</h1><p>اختر لعبتك… والطاولة تنتظرك</p></div><div class="blPickerChoices">'+card('majabeed','مجابيد','٢ ضد ٢ أو ٣ ضد ٣',['QD','JS','KC'])+card('baloot','صكة','جلسات ودية ولعب تنافسي',['KH','QS','AS'])+'</div><footer><div>'+icon('profile')+'<p>حسابك وذهبك وأصدقاؤك<br><strong>معك في اللعبتين</strong></p></div><small>تقدر تغيّر اللعبة من الرئيسية بأي وقت</small></footer></div>';
  el.hidden=false;$('#home').setAttribute('inert','');
  el.onkeydown=e=>{if(e.key==='Escape'&&!B.firstChoice)closePicker();if(e.key==='Tab'){const buttons=[...el.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
  requestAnimationFrame(()=>{if(B.pickerUid===uid&&!el.hidden)el.querySelector('[data-game]')?.focus({preventScroll:true});});
 }
 function welcomeChoice(){
  const uid=user()?.uid;if(!uid||!localStorage.getItem('wb-username')||rememberedGame(uid)||B.room||B.queue||B.suspendedRoom||active()||typeof ONL!=='undefined'&&ONL.active||$('#home').classList.contains('hidden'))return;
  if(B.pickerUid!==uid)selector(true);
 }

 const resumeKey=()=> 'mj-baloot-room:'+user()?.uid;
 function readResume(){const v=B.resume;return v&&v.uid===user()?.uid&&/^[A-Z0-9]{8}$/.test(v.id)&&Date.now()-v.at<7200000?v:null;}
 function closeLink(kind){const link=B[kind];if(!link)return;link.closed=true;if(!link.ready)link.reject?.(Error('cancelled'));if(kind==='hub'&&B.profileLoading){B.profileLoading=false;B.profileAt=0;clearTimeout(B.profileTimer);}clearTimeout(link.retry);clearTimeout(link.timeout);clearInterval(link.ping);try{link.ws?.close()}catch(_){}B[kind]=null;}
 async function connect(kind,path,options={}){
  const u=user();if(!u){toast('سجّل دخولك للعب صكة');throw Error('login required');}
  const existing=B[kind];if(existing?.path===path&&existing.uid===u.uid&&existing.options.spectate===options.spectate&&existing.options.watchUid===options.watchUid){if(existing.ready)return existing;return existing.promise;}
  closeLink(kind);const link={path,uid:u.uid,ready:false,closed:false,tries:0,options};B[kind]=link;
  link.promise=new Promise((resolve,reject)=>{link.resolve=resolve;link.reject=reject;});
  // Attach rejection handler immediately; callers still receive the actual rejection.
  link.promise.catch(()=>{});
  link.open=async()=>{
   if(link.closed||link.connecting||user()?.uid!==link.uid)return;link.connecting=true;
   try{
    if(kind==='room'&&typeof fbSaveProfile==='function'&&FB.ready)await fbSaveProfile(true);
    const idToken=await u.getIdToken();if(link.closed||user()?.uid!==link.uid){link.connecting=false;return;}
    const old=link.ws;if(old){old.onclose=null;try{old.close()}catch(_){}}clearTimeout(link.timeout);const ws=new WebSocket('wss://'+GAME_SRV+path);link.ws=ws;link.ready=false;
    link.timeout=setTimeout(()=>{if(!link.ready){link.connecting=false;link.reject(Error('تعذّر الاتصال؛ تأكد من رفع سيرفر صكة'));toast('تعذّر الاتصال بخدمة صكة؛ أعد المحاولة');ws.close()}},12000);
    ws.onopen=()=>{if(link.closed||B[kind]!==link||ws!==link.ws||user()?.uid!==link.uid||ws.readyState!==1)return;ws.send(JSON.stringify({type:'auth',idToken,spectate:options.spectate===true,...(options.watchUid?{watchUid:options.watchUid}:{}),features:{sawa:2,qablak:1}}));};
    ws.onmessage=event=>{
     if(link.closed||ws!==link.ws||user()?.uid!==link.uid)return;let m;try{m=JSON.parse(event.data)}catch(_){return;}
     if(m.type==='ready'||m.type==='state'){
      if(!link.ready){link.connecting=false;link.ready=true;link.tries=0;clearTimeout(link.timeout);link.resolve(link);clearInterval(link.ping);link.ping=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'ping'}))},25000);}
     }
     receive(kind,m);
    };
    ws.onclose=event=>{
     if(ws!==link.ws||link.closed)return;link.connecting=false;if(kind==='room'){clearCardMotion();B.preselect=null;B.akka=false;paintPreselect();}link.ready=false;clearInterval(link.ping);clearTimeout(link.timeout);
     if(event.code===4001){link.closed=true;link.reject(Error('فتحت اللعبة في اتصال آخر'));toast('فتحت اللعبة في اتصال آخر');connection();return;}
     if(event.code===4004){link.closed=true;link.reject(Error('انتهت الجلسة'));toast('انتهت الجلسة');leaveLocal();return;}
     link.tries++;connection();if(link.tries<=6)link.retry=setTimeout(link.open,Math.min(15000,1000*2**(link.tries-1)));else{link.reject(Error('تعذّر الاتصال'));toast('تعذّر الاتصال؛ اضغط إعادة الاتصال');}
    };
    ws.onerror=()=>{};
   }catch(e){link.connecting=false;if(link.closed||B[kind]!==link||user()?.uid!==link.uid)return;link.reject(e);if(B.loading)loadError('تعذّر تسجيل الاتصال');else toast('تعذّر تسجيل الاتصال');}
  };link.open();return link.promise;
 }
 async function sendHub(m){const intent=B.loading?.id,uid=user()?.uid;try{const link=await connect('hub','/baloot/hub');if(!link.closed&&link.uid===user()?.uid&&link.ws.readyState===1){link.ws.send(JSON.stringify(m));return true;}}catch(e){if(e.message==='cancelled'||user()?.uid!==uid)return;if(B.loading?.id===intent)loadError('تعذّر الاتصال؛ أعد المحاولة');if(B.profileLoading){B.profileLoading=false;B.profileError=true;profileView();}}}
 function sendRoom(m){if(!B.room?.ready||B.room.ws.readyState!==1){connection();return false;}B.room.ws.send(JSON.stringify(m));return true;}
 function move(a){if(B.pending||!B.state?.game)return false;const id=crypto.randomUUID().replace(/-/g,'');B.pending=id;if(!sendRoom({type:'action',action:a,id,seq:B.state.game.seq})){B.pending=null;return false;}clearTimeout(B.pendingTimer);B.pendingTimer=setTimeout(()=>{B.pending=null;clearPlayVisual();paintPreselect();sendRoom({type:'sync'});},8000);return true;}
 function loadProfile(force=false){if(user()&&!B.profileLoading&&(force||Date.now()-(B.profileAt||0)>30000)){B.profileLoading=true;B.profileError=false;B.profileAt=Date.now();sendHub({type:'profile'});clearTimeout(B.profileTimer);B.profileTimer=setTimeout(()=>{if(B.profileLoading){B.profileLoading=false;B.profileError=true;profileView();home();}},12000);}}
 function friendRequest(type,data){
  const requestId=crypto.randomUUID(),uid=user()?.uid;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{friendRequests.delete(requestId);reject(Error('تعذّر تحديث حالة الصديق'));},12000);friendRequests.set(requestId,{uid,resolve,reject,timer});sendHub({type,requestId,...data}).then(ok=>{if(!ok){const pending=friendRequests.get(requestId);if(pending){clearTimeout(timer);friendRequests.delete(requestId);reject(Error('تعذّر الاتصال'));}}});});
 }
 async function friendActivity(uids){if(B.selected!=='baloot'||!user())return [];try{return await friendRequest('friendsActivity',{uids:[...new Set(uids)].slice(0,50)});}catch(_){return [];}}
 async function watchFriend(uid){
  if(B.friendWatchBusy||B.selected!=='baloot'||!user())return;
  if(B.room||B.queue||typeof ONL!=='undefined'&&ONL.active||typeof MATCH!=='undefined'&&MATCH.on){toast('غادر الجلسة الحالية قبل المشاهدة');return;}
  const account=user().uid;B.friendWatchBusy=true;
  try{const rows=await friendRequest('friendWatch',{uid});if(B.selected==='baloot'&&user()?.uid===account&&!$('#friends').classList.contains('hidden')&&!B.room&&!B.queue&&!(typeof ONL!=='undefined'&&ONL.active)&&!(typeof MATCH!=='undefined'&&MATCH.on)&&rows[0]?.uid===uid)await join(rows[0].room,true,uid);}catch(e){if(user()?.uid===account&&B.selected==='baloot')toast(e.message);}finally{B.friendWatchBusy=false;}
 }
 function receive(kind,m){
  if(m.type==='error')clearPlayVisual();
  if(m.type==='friendResponse'){const request=friendRequests.get(m.requestId);if(!request)return;clearTimeout(request.timer);friendRequests.delete(m.requestId);if(request.uid!==user()?.uid){request.reject(Error('تغيّر الحساب'));return;}if(m.error)request.reject(Error(m.error));else request.resolve(m.rows||[]);return;}

  if(m.type==='queueBlocked'){stopQueue();B.queueBlockedUntil=m.until;modal('البحث متوقف مؤقتًا','<p>انتهت مهلة العودة إلى الصكة التنافسية.</p><p>يمكنك البحث مجددًا بعد <b data-bl-ban="'+m.until+'"></b></p>'+btn('الرئيسية','close','blPrimary'),'queueBlocked');startClock();clock();return;}
  if(m.type==='overview'){B.overview={searching:Math.max(0,Number(m.searching)||0),sessions:Math.max(0,Number(m.sessions)||0)};paintOverview();return;}
  if(m.type==='publicChat'){if(B.selected==='baloot'&&B.publicUid===user()?.uid&&typeof CHAT_MODE!=='undefined'&&CHAT_MODE==='public'&&!$('#chat').classList.contains('hidden'))B.publicCallback?.(m.rows||[]);return;}
  if(m.type==='publicSent'){if(B.publicInvitePending&&B.publicInvitePending.id===m.id)finishPublicInvite(true);return;}
  if(m.type==='onlinePlayers'){const request=B.inviteLookup;if(B.modal==='invites'&&B.inviteTab==='online'&&request&&request.id===m.requestId&&request.uid===user()?.uid&&request.room===B.state?.room){clearTimeout(B.inviteLookupTimer);B.inviteRows=m.rows||[];B.inviteError='';paintInvites();}return;}
  if(m.type==='inviteSent'){B.sentInvites=B.sentInvites||new Set();B.sentInvites.add(m.toUid);if(B.modal==='invites')paintInvites();toast('أُرسلت الدعوة');return;}
  if(m.type==='invitation'){offerInvite(m);return;}
  if(m.type==='inviteAccepted'){if(!B.room&&!B.queue)join(m.room);return;}
  if(m.type==='publicInviteAccepted'){const pending=B.publicJoin;if(!pending||pending.id!==m.id||pending.room!==m.room||pending.uid!==user()?.uid)return;clearPublicJoin();if(!B.room&&!B.queue&&!(typeof ONL!=='undefined'&&ONL.active)&&!(typeof MATCH!=='undefined'&&MATCH.on))join(m.room);return;}
  if(m.type==='inviteReply'){toast(m.name+(m.accepted?' قبل الدعوة':' اعتذر عن الدعوة'));return;}
  if(m.type==='error'){if(kind==='room'){B.leaving=false;clearPlayVisual();}if(kind==='hub'&&B.viewRequest)viewError(B.viewRequest);if(kind==='hub'){clearPublicJoin();if(B.publicInvitePending)finishPublicInvite(false);if(B.modal==='invites'){B.inviteError=m.error;paintInvites();}}if(B.projectDraft?.sent){B.projectDraft=null;toast('تعذّر إعلان المشاريع؛ افتحها وحاول مجددًا');}B.evidencePending=false;B.claimKey=null;B.pending=null;B.restoring=false;clearTimeout(B.pendingTimer);clearTimeout(B.restoreTimer);if(B.loading)loadError(m.error);else toast(m.error);if(kind==='hub'&&B.profileLoading){B.profileLoading=false;B.profileError=true;profileView();}if(B.state)render();return;}
  if(m.type==='ready'&&kind==='hub'){if(B.selected==='baloot')B.hub?.ws.send(JSON.stringify({type:'overview'}));if(B.publicCallback)B.hub?.ws.send(JSON.stringify({type:'chatSubscribe'}));if(B.queue)B.hub?.ws.send(JSON.stringify({type:'queue'}));queueView();return;}
  if(m.type==='profile'){if(B.hub?.uid!==user()?.uid)return;B.profile=m;B.queueBlockedUntil=m.queueBlockedUntil||0;B.profileUid=user()?.uid;B.profileLoading=false;B.profileError=false;B.profileAt=Date.now();home();profileView();return;}
  if(m.type==='ack'){if(B.pending===m.id){B.pending=null;clearTimeout(B.pendingTimer);}return;}
  if(m.type==='assigned'){B.queue=false;$('#blQueue').hidden=true;endLoad();const invite=B.inviteAfterCreate;B.inviteAfterCreate=null;join(m.room).then(()=>{if(invite&&invite.account===user()?.uid&&B.state?.room===m.room)sendFriendInvite(invite.uid,invite.name);});return;}
  if(m.type==='resume'){const requested=B.resumeRequested;B.resumeRequested=false;if(requested&&m.room&&!document.hidden)join(m.room);return;}
  if(m.type==='queue'){if(!B.queue)return;B.queueAt=m.since;B.queueCount=m.count;B.queuePlayers=Array.isArray(m.players)?m.players:[];queueView();return;}
  if(m.type==='sessions'){finishView('sessions');endLoad('sessions');if(B.modal==='sessions')sessions(m.rows);return;}
  if(m.type==='board'){if(m.period===B.board){finishView('board');endLoad('board');if(B.modal==='board')board(m);}return;}
  if(m.type==='left'){leaveLocal();return;}
  if(m.type==='ejected'){leaveLocal();toast(m.reason||'أُتيح المقعد بعد عدم اللعب');return;}
  if(m.type!=='state')return;
  if(B.state?.room===m.room&&m.seq<B.state.seq)return;
  if(B.drag&&(!['play','collect'].includes(m.game?.phase)||m.me!==B.state?.me||m.game?.id!==B.drag.match||m.game?.round!==B.drag.round||m.game?.turn!==B.drag.turn||m.auto[m.me]||!m.game?.myHand.includes(B.drag.card)))cancelDrag();endLoad('room');clearTimeout(B.syncTimer);B.restoring=false;clearTimeout(B.restoreTimer);const previous=B.state;B.state=m;if(m.me>=0&&FB.ready&&user()&&B.friendPresence!==user().uid+':'+m.room){const key=user().uid+':'+m.room;B.friendPresence=key;FB.db.collection('players').doc(user().uid).set({activeGame:'baloot',activeRoom:null},{merge:true}).catch(()=>{if(B.friendPresence===key)B.friendPresence=null;});}B.offset=m.now-Date.now();B.pending=null;clearTimeout(B.pendingTimer);
  if(m.game?.phase==='matchEnd'&&!m.game.claimReviewUntil){B.profileAt=0;B.resume=null;}else B.resume={uid:user()?.uid,id:m.room,at:Date.now(),spectate:m.me<0};
  updateExtras(previous,m);
  const signature=JSON.stringify([m.room,m.seats,m.owner,m.me,m.game?.seq,m.auto,m.settled,m.progression,m.seatChoice,m.seatSwap,m.rematch]);
  if(signature!==B.signature){B.signature=signature;if(B.drag)B.renderAfterDrag=true;else render();}
  if(m.game)window.BalootAudio?.sync(m.game,m.me,previous?.game,m.now,{motionEffects:!!B.motion});if(m.me>=0&&m.auto[m.me]&&!previous?.auto?.[m.me])sound('auto_play');if(m.game?.turn===m.me&&['play','bid','double'].includes(m.game.phase)&&previous?.game?.turn!==m.me)sound('turn_alert');renderChat();connection();clock();flushPreparedProjects();flushPreselect();
 }
 async function join(id,spectate=false,watchUid){
  if(document.hidden)return false;
  clearCardMotion();
  if(needsChoice()){goHome();return;}
  id=String(id||'').trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(id)){toast('رمز الجلسة من 8 أحرف وأرقام');return;}
  if(typeof ONL!=='undefined'&&ONL.active){toast('غادر جلسة مجابيد أولًا');return;}
  cancelDrag();window.BalootAudio?.stop();closePicker(false);WBMsg.pubUnsub?.();closeModal();if(B.queue)stopQueue();B.friendPresence=null;B.sentInvites=new Set();rememberGame('baloot');B.state=null;B.signature='';B.pending=null;B.preselect=null;B.akka=false;B.chatSeen.clear();hideChat();B.first=null;B.second=null;B.queue=false;home();loadProfile();
  $('#blGame').hidden=false;$('#blGame').innerHTML='<div class="blConnection">جارٍ دخول طاولة صكة…</div><div class="blActions">'+btn('رجوع','leaveLocal')+'</div>';
  beginLoad('room','نجهّز جلستك في صكة…',()=>{closeLink('room');join(id,spectate,watchUid);});try{await connect('room','/baloot/room/'+id,{spectate,watchUid});}catch(e){if(e.message!=='cancelled')loadError('تعذّر دخول الطاولة؛ أعد المحاولة');}if(B.room)startClock();
 }
 function requestLeave(){
  if(B.leaving)return;
  if(!B.room?.ready||B.room.ws.readyState!==1){if(!active())leaveLocal();else connection();return;}
  closeModal();B.leaving=true;beginLoad('leave','جارٍ الخروج من الطاولة…',()=>{B.leaving=false;requestLeave();});
  if(!sendRoom({type:'leave'})){B.leaving=false;endLoad('leave');connection();}
 }
 function connection(){const el=$('#blConnection');if(el)el.innerHTML=B.room?.ready?'':'<span>جارٍ استعادة الاتصال بالطاولة…</span>'+btn('إعادة الاتصال','reconnect');queueView();}
 function leaveLocal({navigate=true,refresh=true}={}){clearCardMotion();B.leaving=false;clearTimeout(B.publicInviteTimer);clearTimeout(B.inviteLookupTimer);B.publicInvitePending=null;B.publicInviteAck=null;B.inviteLookup=null;cancelDrag();endLoad();clearTimeout(B.syncTimer);B.suspendedRoom=null;B.resume=null;B.resumeRequested=false;B.restoring=false;if(B.queue)stopQueue();B.preselect=null;B.akka=false;hideChat();window.BalootAudio?.stop();try{localStorage.removeItem(resumeKey());}catch(_){}closeLink('room');B.state=null;B.pending=null;B.projectDraft=null;B.first=null;B.second=null;B.claimKey=null;B.evidencePending=false;clearTimeout(B.pendingTimer);clearTimeout(B.restoreTimer);B.signature='';$('#blGame').hidden=true;closeModal();clearInterval(B.clock);B.clock=null;if(navigate)goHome();if(refresh)loadProfile();}
 function startClock(){if(!B.clock)B.clock=setInterval(clock,250);}
 function clock(){
  document.querySelectorAll('[data-bl-rematch-clock]').forEach(el=>el.textContent=Math.max(0,Math.ceil((+el.dataset.blRematchClock-Date.now()-B.offset)/1000))+' ث');
  document.querySelectorAll('[data-bl-seat-clock]').forEach(el=>el.textContent=Math.max(0,Math.ceil((+el.dataset.blSeatClock-Date.now()-B.offset)/1000))+' ث');
  document.querySelectorAll('[data-bl-ban],[data-bl-return]').forEach(el=>{const seconds=Math.max(0,Math.ceil((+(el.dataset.blBan||el.dataset.blReturn)-Date.now()-(el.dataset.blReturn?B.offset:0))/1000));el.textContent=el.dataset.blBan?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):seconds+' ث';});
  const g=B.state?.game;if(g?.deadline){const left=Math.max(0,Math.ceil((g.deadline-Date.now()-B.offset)/1000));document.querySelectorAll('[data-bl-clock]').forEach(el=>el.textContent=left+' ث');const turnKey=g.id+':'+g.round+':'+g.turn+':'+g.deadline+':'+left;if(B.room?.ready&&g.turn===B.state.me&&g.phase==='play'&&left<=5&&left>0&&B.lastClockSound!==turnKey){B.lastClockSound=turnKey;sound(left===5?'five_seconds':'countdown_tick');}}
  if(B.queue){const el=$('#blQueueTime');if(el){const secs=Math.max(0,Math.floor((Date.now()-(B.queueAt||Date.now()))/1000));el.textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');}}
  // Project badges stay visible through the round, including the announcing player.
  if(B.revealUntil&&Date.now()>B.revealUntil){B.revealUntil=0;$('#blSpread')?.remove();}if(B.notice&&Date.now()>B.notice.until){B.notice=null;$('#blProjectNotice')?.remove();}paintChatBubbles();
  const week=$('#blWeekTime');if(week?.dataset.end){const n=Math.max(0,+week.dataset.end-Date.now());week.textContent='يتجدد خلال '+Math.floor(n/86400000)+' يوم و'+Math.floor(n/3600000)%24+' ساعة';}
 }
 function pos(seat){const me=B.state?.me>=0?B.state.me:0;return (seat-me+4)%4;}
 const contractText=g=>g.contract?(g.contract.mode==='sun'?'صن':(g.contract.pendingTrump?'حكم ثاني':'حكم '+suitHTML(g.contract.trump)))+(g.contract.multiplier>1?' · '+({2:'دبل',3:'ثري',4:'فور',5:'قهوة'})[g.contract.multiplier]:'')+(g.contract.closed?' مقفل':''):g.bidRound===2?'الشراء الثاني':'الشراء الأول';
 function verifiedSawa(g){return g?.phase==='sawa'&&g.sawa?.verified===true;}
 function canRequestSawa(g){const d=B.state;return !!d&&g?.canSawa===true&&g.phase==='play'&&d.me>=0&&g.turn===d.me&&!d.auto[d.me]&&[2,3,4].includes(g.myHand.length)&&!g.trick.length&&!B.pending&&!B.playVisual&&!B.drag;}

 // The server owns the match. This controller owns only card presentation.
 function cardMotion(){
  const root=$('#blGame');if(!root||!window.SakkaCardMotion)return null;
  if(!B.motion){
   B.motion=window.SakkaCardMotion.create(root,{sound,onIdle:()=>flushPreselect()});
   if(typeof ResizeObserver==='function'){
    let size=root.clientWidth+':'+root.clientHeight;
    B.motionResize=new ResizeObserver(()=>{const next=root.clientWidth+':'+root.clientHeight;if(next===size)return;size=next;cancelAnimationFrame(B.resizeFrame);B.resizeFrame=requestAnimationFrame(()=>{if(B.state?.game&&!root.hidden){cancelDrag();clearCardMotion();render();}});});B.motionResize.observe(root);
   }
  }
  return B.motion;
 }
 // Keyed reconciliation keeps hand buttons, field cards and their animations alive.
 // Clocks and chat can update without replacing a card or restarting its motion.
 function gameNodeKey(node){
  if(node.nodeType!==1)return '#'+node.nodeType;
  return node.tagName+':'+(node.id?'id:'+node.id:node.dataset.card?'card:'+node.dataset.card:node.classList.contains('blSeat')?'seat:'+node.dataset.seat:node.dataset.bl?'action:'+node.dataset.bl:node.classList[0]||'');
 }
 function patchGameNode(current,next){
  if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  const card=current.matches('.blPlayed,.blHand [data-card]'),selected=current.classList.contains('selected'),sending=current.classList.contains('blSendingCard');
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name)&&!(card&&(attr.name==='style'||attr.name.startsWith('data-bl-motion'))))current.removeAttribute(attr.name);
  for(const attr of next.attributes){
   if(card&&attr.name==='style'){for(const name of ['--ha','--hy']){const value=next.style.getPropertyValue(name);if(value)current.style.setProperty(name,value);}continue;}
   if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  }
  if(card){if(selected)current.classList.add('selected');if(sending)current.classList.add('blSendingCard');}
  if(current.hasAttribute('data-bl-clock'))return;
  patchGameChildren(current,next);
 }
 function patchGameChildren(current,next){
  const available=new Map();for(const node of [...current.childNodes]){const key=gameNodeKey(node);if(!available.has(key))available.set(key,[]);available.get(key).push(node);}
  const retained=new Set();let cursor=current.firstChild;
  for(const wanted of [...next.childNodes]){
   const existing=available.get(gameNodeKey(wanted))?.shift(),node=existing||wanted.cloneNode(true);
   if(node!==cursor)current.insertBefore(node,cursor);
   if(existing)patchGameNode(node,wanted);retained.add(node);cursor=node.nextSibling;
  }
  for(const node of [...current.childNodes])if(!retained.has(node))node.remove();
 }
 function patchGame(root,markup){const template=document.createElement('template');template.innerHTML=markup;patchGameChildren(root,template.content);}

 function render(){
  const d=B.state,root=$('#blGame');if(!d)return;root.hidden=false;const motion=cardMotion(),before=B.motionState||null,captured=motion?.capture(before);reconcileCardMotion();
  if(d.me<0){hideChat();if(['declare','projects','claimReason','kasho'].includes(B.modal))closeModal();}
  if(!d.game){clearCardMotion();if(['result','claim','double','sawa','claimReason','declare','projectReview'].includes(B.modal)||B.modal==='invites'&&!lobbyInviteAvailable())closeModal();renderLobby();return;}const g=d.game;root.dataset.phase=g.phase;root.dataset.spectator=String(d.me<0);root.classList.toggle('blSawaReveal',verifiedSawa(g));const me=d.me,mine=me>=0?me%2:0,turn=g.turn===me&&!d.auto[me],sorted=g.myHand.slice().sort((a,b)=>'CSHD'.indexOf(a.at(-1))-'CSHD'.indexOf(b.at(-1))||rank(b)-rank(a)).reverse();
  const phaseText={kasho:'كاشو · كشف أوراق الجميع',bid:g.sunResponse?.pending?'طلبك صن · بانتظار حسم الأولوية':g.sunResponse&&g.bidOptions?.includes('sun')&&!d.auto[me]?'يمكنك طلب الصن الآن':g.bidStage==='priority'?(turn?'دورك في قبلك':'قبلك · بانتظار '+(d.seats[g.turn]?.name||'اللاعب')):turn?'دورك في الشراء':'بانتظار شراء '+(d.seats[g.turn]?.name||'اللاعب'),double:turn?'دورك في التدبيل':'بانتظار رد '+(d.seats[g.turn]?.name||'اللاعب'),trump:turn?'سمِّ الحكم':'بانتظار تسمية الحكم من '+(d.seats[g.turn]?.name||'المشتري'),play:turn?'دورك · اختر ورقتك':'دور '+(d.seats[g.turn]?.name||''),collect:'الأكلة لـ '+(d.seats[g.turn]?.name||''),review:'مهلة القيد قبل احتساب النتيجة',sawa:verifiedSawa(g)?'سوا · كشف أوراق الجميع':'عرض السوا · انتظار الخصم',claim:'طلب قيد',roundEnd:'نتيجة التوزيعة',matchEnd:'انتهت الصكة'}[g.phase]||'';
  patchGame(root,'<div class="blTable"></div><div class="blTop">'+btn($('#oExit')?.innerHTML||'خروج','leave','blExit exitLike','aria-label="مغادرة الجلسة"')+'<div class="blScore"><span>لنا<b>'+g.scores[mine]+'</b></span><span>لهم<b>'+g.scores[1-mine]+'</b></span></div>'+btn(soundIcon(),'mute','blMute','aria-label="'+(B.muted?'تشغيل الصوت':'كتم الصوت')+'" aria-pressed="'+!B.muted+'"')+'</div><div class="blRound">'+(d.mode==='competitive'?'تنافسي':'ودية')+' · '+contractText(g)+' · التوزيعة '+g.round+'</div><div id="blConnection" class="blConnection"></div>'+d.seats.map((p,i)=>seatHTML(p,i,g)).join('')+'<div class="blField">'+g.trick.map(p=>'<img class="blPlayed blCardFace" data-card="'+p.card+'" data-seat="'+p.seat+'" data-pos="'+pos(p.seat)+'" src="cards/'+p.card+'.png" alt="'+p.card+'">').join('')+'</div>'+
   (['bid','double','trump'].includes(g.phase)?'<div class="blPurchase">'+img(g.up)+'<small>'+contractText(g)+'</small></div>':'')+
   '<div class="blStatus '+(['bid','double','trump'].includes(g.phase)?'blPurchaseStatus':verifiedSawa(g)?'blSawaStatus':'')+'" role="status">'+E(phaseText)+(g.phase==='review'?' · <b data-bl-clock></b>':'')+'</div><div class="blHandLabel">'+(me<0?'مشاهد':'')+'</div><div class="blHand '+(turn&&g.phase==='play'?'':'waiting')+'" style="--overlap:'+overlap(sorted.length)+'px">'+sorted.map((id,i)=>'<button data-bl="card" data-card="'+id+'" style="--ha:'+((i-(sorted.length-1)/2)*2.6)+'deg;--hy:'+Math.round(Math.abs(i-(sorted.length-1)/2)*2)+'px" aria-label="العب '+id+'">'+img(id)+'</button>').join('')+'</div>'+(me>=0?'<div class="blActions">'+btn('قيدها','claim','',(!['play','collect','review'].includes(g.phase)&&!verifiedSawa(g))||me<0||d.auto[me]?'disabled':'')+btn(B.projectDraft?'المشاريع · جاهزة':'المشاريع','projects','',!(canPrepareProjects(g,me)||turn&&g.phase==='play'&&g.history.length===1&&g.projectContest?.eligible.includes(me)&&!g.revealed[me].length)?'disabled':'')+(canRequestSawa(g)?btn('سوا','sawa','blPrimary'):'')+btn($('#oChatBtn')?.innerHTML||'💬','chat','blChatButton','aria-label="الشات"')+'</div>':'')+
   '');
  root.insertAdjacentHTML('beforeend',collectHTML()+(g.canKasho&&me>=0&&!d.auto[me]?'<div class="blKashoAction">'+btn('كاشو · إعادة التوزيع','kasho')+'</div>':'')+spreadHTML()+noticeHTML()+(g.phase==='review'?advanceHTML():verifiedSawa(g)?sawaPromptHTML():''));paintPreselect();paintChatBubbles();
  if(g.phase==='bid'&&me>=0&&!d.auto[me]&&g.bidOptions?.length){const choices=g.bidOptions.map(k=>btn({pass:g.bidRound===2&&!g.offer?'ولا':'بس',qablak:'قبلك',sun:'صن',hokum:g.bidStage==='confirm'?'تأكيد الحكم':g.bidRound===2?'حكم ثاني':'حكم',ashkal:'أشكل'}[k],'bid',k==='sun'?'blPrimary':'','data-kind="'+k+'"')).join('');root.insertAdjacentHTML('beforeend','<div class="blBidActions">'+(g.bidStage==='priority'?'<p class="blBidHint">'+E(d.seats[g.offer.seat]?.name)+(g.offer.qablak?' قال قبلك':' طلب صن')+(turn?' · دورك في الرجوع':' · يمكنك طلب صن الآن')+(turn&&g.priority?.seats?.length>1?' · بعدك '+E(d.seats[g.priority.seats[1]]?.name):turn&&g.priority?' · آخر أولوية':'')+'</p>':g.bidStage==='confirm'?'<p class="blBidHint">'+(g.bidOptions.includes('sun')?'تأكيد الحكم أو تحويله صن':'تأكيد الحكم')+'</p>':g.offer?'<p class="blBidHint">'+E(d.seats[g.offer.seat]?.name)+(g.bidRound===2?' طلب حكم ثاني':' طلب حكم '+suitHTML(g.offer.trump))+(g.bidOptions.includes('sun')?' · يمكنك أخذها صن':/^A[SHDC]$/.test(g.up)&&me!==(g.dealer+1)%4?' · صن الآكة لـ '+E(d.seats[(g.dealer+1)%4]?.name)+' فقط (يمين الموزّع)':'')+'</p>':'')+choices+'</div>');}
  if(g.phase==='trump'&&turn)root.insertAdjacentHTML('beforeend','<div class="blBidActions blTrumpActions"><p class="blBidHint">'+(g.counts.every(n=>n===5)?'سمِّ الحكم قبل تكملة التوزيع':'سمِّ الحكم')+'</p>'+Object.keys(S).filter(x=>x!==g.up.at(-1)).map(x=>btn(suitHTML(x)+' '+({S:'سبيت',H:'هاص',D:'دايمن',C:'شيريا'})[x],'trump','blPrimary','data-suit="'+x+'"')).join('')+'</div>');
  if(g.phase==='double'&&turn)root.insertAdjacentHTML('beforeend','<div class="blBidActions">'+btn('بس','double','','data-raise="0"')+btn(({1:'دبل',2:'ثري',3:'فور',4:'قهوة'})[g.contract.multiplier],'double','blPrimary','data-raise="1"')+'</div>');
  root.classList.toggle('blHokum',g.contract?.mode==='hokum');
  if(B.modal==='kasho'&&(!g.canKasho||d.auto[me]))closeModal();
  if(B.modal==='sawaConfirm'&&(!turn||!g.canSawa))closeModal();
  if(g.phase==='kasho')renderKasho();
  else if(g.phase==='sawa'){if(verifiedSawa(g)){if(['sawa','sawaConfirm','result','kashoReveal','declare','reveal','projects','double'].includes(B.modal))closeModal();}else renderSawa();}
  else if(g.phase==='claim')renderClaim();
  else if(['roundEnd','matchEnd'].includes(g.phase))renderResult();
  else if(B.modal==='declare'&&canPrepareProjects(g,me))revealDialog();
  else if(B.modal==='projectReview'&&['play','collect','review'].includes(g.phase)&&g.declared[B.reviewProjectSeat]?.length)projectReview(B.reviewProjectSeat);
  else if(['claim','result','projects','declare','reveal','sawa','projectReview','kashoReveal'].includes(B.modal)||B.modal==='double'&&(!turn||g.phase!=='double')||B.modal==='claimReason'&&!['play','collect','review'].includes(g.phase)&&!verifiedSawa(g)||B.modal==='invites'&&!lobbyInviteAvailable())closeModal();
  paintPreselect();applyTheme();connection();clock();motion?.update(before,d,captured,{origin:B.playVisual});B.motionState=d;const visual=B.playVisual;if(visual&&!g.myHand.includes(visual.card))clearPlayVisual();
 }
 function applyTheme(){try{const theme=SHOP_THEMES.find(t=>t.id===uiThemeResolve());if(theme?.bg)$('#blGame').style.backgroundImage='url("'+theme.bg+'")';const table=$('#blGame .blTable');if(table)table.style.backgroundImage='url("'+(theme?.table||'ui-art/rooms-v362/cafe-table.webp')+'")';}catch(_){}}
 function rank(id){const r=id.slice(0,-1);return {J:11,Q:12,K:13,A:14}[r]||+r;}
 function overlap(n){const root=$('#blGame'),width=Math.max(0,root.clientWidth-56),w=root.querySelector('.blHand button')?.offsetWidth||(innerHeight<=580?66:innerHeight<=720?74:Math.min(86,Math.max(64,innerWidth*.2)));return n<2?0:Math.min(-12,(width-w*n)/(n-1));}
 function purchaseAnnouncement(g,seat){
  if(g.contract)return g.contract.buyer===seat?(g.contract.mode==='sun'?'صن':g.contract.pendingTrump?'حكم ثاني':'حكم '+suitHTML(g.contract.trump)):'';
  return g.phase==='bid'&&g.offer?.seat===seat?(['sun','ashkal'].includes(g.offer.kind)?(g.offer.kind==='ashkal'?'أشكل':g.offer.qablak?'قبلك · صن':'صن'):g.bidRound===2?'حكم ثاني':'حكم '+suitHTML(g.offer.trump)):'';
 }
 function unspreadProjects(g,seat){
  if(g.projectContest?.resolved===true&&Array.isArray(g.projectContest.eligible)&&!g.projectContest.eligible.includes(seat))return [];
  const shown=(g.revealed[seat]||[]).filter(p=>p.cards?.length).map(p=>p.type);
  return (g.declared[seat]||[]).filter(type=>{const index=shown.indexOf(type);if(index<0)return true;shown.splice(index,1);return false;});
 }
 function takenHTML(g,seat){
  const count=(g.history||[]).filter(h=>h.winner===seat).length+(g.sawa?.complete&&!g.sawa.verified&&g.sawa.by===seat?g.sawa.cards.length:0);
  return count?'<span class="blTaken" data-taken="'+seat+'" role="img" aria-label="'+E(B.state.seats[seat]?.name)+' لديه '+count+' أكلات" title="'+count+' أكلات"><i aria-hidden="true"></i><b aria-hidden="true">'+count+'</b></span>':'';
 }
 function seatHTML(p,i,g){if(!p)return '';const here=pos(i),current=g.turn===i&&['bid','play','double','trump'].includes(g.phase),decl=unspreadProjects(g,i).length?unspreadProjects(g,i).map((x,j)=>'<span class="blProjectPart">'+(j?'<span class="blProjectPlus" aria-hidden="true"> + </span>':'')+'<span>'+E(N[x])+'</span></span>').join(''):'',shown=decl||purchaseAnnouncement(g,i);return '<div class="blSeat '+(current?'active':'')+'" data-pos="'+here+'" data-seat="'+i+'"'+(current?' aria-current="true"':'')+'>'+(!decl&&shown?'<div class="blBubble">'+shown+'</div>':'')+(here?'<div class="blBacks">'+Array.from({length:g.counts[i]},(_,j)=>'<i style="--tilt:'+((j-(g.counts[i]-1)/2)*10)+'deg"></i>').join('')+'</div>':'')+'<span class="blAvatarFrame">'+avatar(p)+(current?'<span class="blTurnRing" aria-hidden="true"></span><span class="blCountdown" data-bl-clock aria-label="الوقت المتبقي للدور"></span>':'')+'</span>'+('<span class="blName">')+(p.balootRank?crestHTML(p.balootRank.tier):'')+E(p.name)+(i===B.state.me?' · أنت':'')+('</span>')+(decl&&['play','collect','review'].includes(g.phase)?'<div class="blProjectLabel" data-project-seat="'+i+'" aria-label="مشاريع '+E(p.name)+'">'+decl+'</div>':'')+'<span class="blRole">'+(p.bot?'كمبيوتر':B.state.auto[i]?'تحكم تلقائي':i%2===(B.state.me>=0?B.state.me%2:0)?'فريقنا':'الفريق الآخر')+(i===g.dealer?' · الموزع':'')+'</span>'+takenHTML(g,i)+sawaFanHTML(g,i)+(i===B.state.me&&B.state.auto[i]&&!['matchEnd','roundEnd'].includes(g.phase)?btn(B.restoring?'جارٍ الاستعادة…':'أستعيد التحكم','takeControl','blResumeControl',B.restoring?'disabled':'')+(B.state.returnUntil?'<small class="blReturnTime">مهلة العودة <b data-bl-return="'+B.state.returnUntil+'"></b></small>':''):'')+'</div>';}
 function renderLobby(){
  const d=B.state,r=d.rematch,owner=d.me>=0&&d.owner===user()?.uid,canChoose=d.seatChoice&&d.me>=0&&!r?.startAt,swap=d.seatSwap,uid=user()?.uid;
  const request=swap?'<aside class="blSeatRequest" role="status"><b>'+E(d.seats[swap.fromSeat]?.name)+' يطلب تبديل المقعد مع '+E(d.seats[swap.toSeat]?.name)+'</b><small>ينتهي الطلب خلال <span data-bl-seat-clock="'+swap.expiresAt+'"></span></small>'+(swap.toUid===uid?'<div class="blInline">'+btn('أوافق','seatReply','blPrimary','data-id="'+E(swap.id)+'" data-accept="1"')+btn('أرفض','seatReply','','data-id="'+E(swap.id)+'" data-accept="0"')+'</div>':swap.fromUid===uid?btn('إلغاء الطلب','seatReply','','data-id="'+E(swap.id)+'" data-accept="0"'):'')+'</aside>':'';
  const team=t=>'<section class="blLobbyTeam" data-team="'+t+'"><div class="blTeamHeading"><h3>الفريق '+(t===0?'الأول':'الثاني')+'</h3><small>شريكان متقابلان</small></div>'+[t,t+2].map(i=>{const p=d.seats[i],self=i===d.me,ready=r?.ready.includes(i);return '<div class="blLobbySeat '+(self?'isMe':'')+'" data-seat="'+i+'"><div class="blSeatIdentity">'+(p?avatar(p):'<span class="blEmptySeat" aria-hidden="true">＋</span>')+'<div><b title="'+E(p?.name||'مقعد متاح')+'">'+(p?E(p.name)+(self?' · أنت':''):'مقعد متاح')+'</b><small>المقعد '+(i+1)+(p?.bot?' · كمبيوتر':p?.uid===d.owner?' · صاحب الطاولة':'')+'</small></div></div>'+(r&&p?'<span class="blReadyStatus '+(ready?'ready':'')+'">'+(ready?'✓ جاهز':'بانتظار الاستعداد')+'</span>':'')+'<div class="blSeatTools">'+(canChoose&&!self?btn(p&&!p.bot?'طلب تبديل':'أجلس هنا','chooseSeat','','data-seat="'+i+'" aria-label="'+(p&&!p.bot?'طلب تبديل مع '+E(p.name):'أجلس في المقعد '+(i+1))+'" '+(swap?'disabled':'')):'')+(owner&&(!p||p.bot)?btn(p?'إزالة':'＋ كمبيوتر','bot','blBotSeat','data-seat="'+i+'" data-remove="'+(p?1:0)+'" aria-label="'+(p?'إزالة الكمبيوتر من':'إضافة كمبيوتر إلى')+' المقعد '+(i+1)+'" '+(swap||r?.startAt?'disabled':'')):'')+'</div></div>';}).join('')+'</section>';
  const readiness=r?'<section class="blRematchStatus" role="status">'+(r.startAt?'<small>الجميع جاهز</small><b>تبدأ الصكة خلال <span data-bl-rematch-clock="'+r.startAt+'"></span></b>':'<b>استعداد '+r.ready.length+' من 4</b><small>بعد اكتمال الاستعداد · عدّاد 5 ثوانٍ</small>')+'</section>':'';
  const start=r?(d.me>=0?btn(r.ready.includes(d.me)?'إلغاء الاستعداد':'أنا جاهز','rematchReady',r.ready.includes(d.me)?'':'blPrimary','aria-pressed="'+r.ready.includes(d.me)+'"'):'<p>بانتظار استعداد اللاعبين</p>'):owner?btn('ابدأ الصكة','start','blPrimary',d.seats.some(p=>!p)||swap?'disabled':''):'<p role="status">بانتظار بدء '+E(d.seats.find(p=>p?.uid===d.owner)?.name||'صاحب الطاولة')+'</p>';
  const root=$('#blGame');root.classList.remove('blSawaReveal');root.dataset.phase='lobby';root.dataset.spectator=String(d.me<0);
  root.innerHTML='<div class="blModal blLobby blLobbyCompact"><div class="blPanel"><header><div><small>'+(r?'صكة جديدة مع ربعك':'طاولة صكة ودية')+'</small><h2>'+(r?'قائمة الاستعداد':'اجمع ربعك')+'</h2></div>'+btn('خروج','leave')+'</header><div class="blLobbyCode"><span>رمز الدعوة</span><b>'+E(d.room)+'</b>'+btn('نسخ','copyCode')+'</div><p class="blNote blLobbyNote">'+(r?'راجع فريقك ثم اضغط أنا جاهز.':canChoose?'اختر فريقك ومقعدك · التبديل بموافقة اللاعب':d.me<0?'أنت تشاهد الطاولة؛ ننتظر اكتمال اللاعبين.':'بانتظار تجهيز الطاولة.')+'</p>'+request+'<div class="blLobbyTeams">'+team(0)+team(1)+'</div><div class="blLobbyFooter">'+readiness+'<div class="blInline blLobbyStart">'+start+(d.me>=0?btn($('#oChatBtn')?.innerHTML||'💬','chat','blChatButton','aria-label="الشات"'):'')+'</div>'+lobbyInvitations()+'</div><p id="blConnection" class="blError"></p></div></div>';connection();clock();paintPublicInviteButtons();
 }


 // Geometry is measured in viewport pixels, including the rotated hand and any
 // app-frame scaling. The visual copy starts at the exact face already shown.
 function cardGeometry(el){
  if(window.SakkaCardMotion?.geometry)return window.SakkaCardMotion.geometry(el);
  if(!el?.isConnected)return null;const face=el.matches('button')?el.querySelector('img')||el:el,r=face.getBoundingClientRect();if(!r.width||!r.height)return null;
  let angle=0;try{const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);angle=Math.atan2(m.b,m.a)*180/Math.PI;}catch(_){}
  const rad=angle*Math.PI/180,w=face.offsetWidth||r.width,h=face.offsetHeight||r.height,scale=r.width/(Math.abs(Math.cos(rad))*w+Math.abs(Math.sin(rad))*h||1);
  return {x:r.left+r.width/2,y:r.top+r.height/2,w:w*scale,h:h*scale,angle};
 }
 function clearPlayVisual(){const v=B.playVisual;B.playVisual=null;B.cardOrigin=null;clearTimeout(v?.timer);v?.ghost?.remove();document.querySelectorAll('#blGame .blHand button.blSendingCard').forEach(b=>{b.classList.remove('blSendingCard');b.style.visibility='';});}
 function clearCardMotion(){clearPlayVisual();B.motion?.reset({skipNext:true});B.motionState=null;}
 function reconcileCardMotion(){
  const d=B.state,g=d?.game,v=B.playVisual;
  if(v&&(!g||v.match!==g.id||v.round!==g.round||v.seat!==d.me||d.auto[d.me]||!['play','collect'].includes(g.phase)))clearPlayVisual();
 }
 function submitCard(a){
  const g=B.state?.game;if(!g||B.pending||B.playVisual)return false;const button=$('#blGame .blHand [data-card="'+a.card+'"]'),origin=B.cardOrigin;
  const drag=origin?.card===a.card&&origin.ghost?.isConnected?origin:null,geometry=drag?.geometry||cardGeometry(button);
  B.playVisual={match:g.id,round:g.round,seat:B.state.me,card:a.card,geometry,ghost:drag?.ghost||null};
  if(!move(a)){clearPlayVisual();paintPreselect();return false;}const visual=B.playVisual;visual.timer=setTimeout(()=>{if(B.playVisual===visual){clearPlayVisual();paintPreselect();sendRoom({type:'sync'});}},8000);return true;
 }
 function resultLedgerHTML(d,g,r,me){
  const c=r.contract,m=Number(c.multiplier)||1,committed=m>1&&m%2===0&&Number.isInteger(c.doubler)?c.doubler:c.buyer,committedTeam=committed%2;
  const teamName=t=>d.me<0?'الفريق '+(t+1):t===me?'فريقنا':'فريقهم',teams=[me,1-me],projects=r.projects||[[],[]];
  const pair=values=>Array.isArray(values)&&values.length===2&&values.every(Number.isFinite);
  const projectRaw=pair(r.projectRaw)?r.projectRaw:projects.map(list=>list.reduce((sum,p)=>sum+({sira:20,fifty:50,hundred:100,fourHundred:200,baloot:20}[p.type]||0),0));
  // Raw card totals already include the final trick bonus; separate it only for display.
  const raw=r.raw||[0,0],last=g.history?.length===8?g.history[7].winner:r.sawa?.accepted?r.sawa.by:null,ground=pair(r.lastTrickRaw)?r.lastTrickRaw.slice():[0,0];
  if(!pair(r.lastTrickRaw)&&Number.isInteger(last)&&raw[last%2]>=10)ground[last%2]=10;
  const tricks=pair(r.trickRaw)?r.trickRaw:raw.map((v,t)=>v-ground[t]),purchaseWon=r.winner===committedTeam;
  const cells=values=>teams.map(t=>'<td data-ledger-team="'+t+'" data-ledger-value="'+values[t]+'"><bdi>'+values[t]+'</bdi></td>').join('');
  const projectCells=teams.map(t=>'<td data-ledger-team="'+t+'" data-ledger-value="'+projectRaw[t]+'"><div class="blLedgerProjects">'+(projects[t]?.length?projects[t].map(p=>'<div><b>'+E(N[p.type]||p.type)+'</b><small>'+E(d.seats[p.seat]?.name)+'</small></div>').join(''):'<span class="blLedgerEmpty">—</span>')+'</div>'+(projectRaw[t]?'<bdi class="blProjectRaw">'+projectRaw[t]+'</bdi>':'')+'</td>').join('');
  const notes=[r.claim?'تُعتمد نتيجة القيد الموضّحة أدناه':m===5?'القهوة تحسم الصكة':m>1?'النتيجة تشمل '+({2:'الدبل',3:'الثري',4:'الفور'})[m]:r.reverseSweep?'كبوت مقلوب':r.sweep?'كبوت':null].filter(Boolean);
  return '<div class="blPurchaseSummary"><div><span>اللعبة</span><strong>'+contractText({contract:c})+'</strong></div><div><span>'+(m>1?'المشتري أو المدبل':'المشتري')+'</span><strong>'+E(teamName(committedTeam))+'</strong><small>'+E(d.seats[committed]?.name)+'</small></div><p data-purchase-result="'+(purchaseWon?'won':'lost')+'">نتيجة الشراء <b>'+(purchaseWon?'رابحة':'خاسرة')+'</b></p></div><table class="blScoreLedger" aria-label="نشرة حساب التوزيعة"><thead><tr><th scope="col">النشرة</th><th scope="col">'+(d.me<0?'الفريق ١':'لنا')+'</th><th scope="col">'+(d.me<0?'الفريق ٢':'لهم')+'</th></tr></thead><tbody><tr data-ledger-row="tricks"><th scope="row">الأكلات</th>'+cells(tricks)+'</tr><tr data-ledger-row="ground"><th scope="row">الأرض</th>'+cells(ground)+'</tr><tr data-ledger-row="projects"><th scope="row">المشاريع</th>'+projectCells+'</tr><tr class="blLedgerRaw" data-ledger-row="raw"><th scope="row">الأبناط</th>'+cells(raw.map((v,t)=>v+projectRaw[t]))+'</tr><tr class="blLedgerFinal" data-ledger-row="points"><th scope="row">النتيجة</th>'+cells(r.won)+'</tr></tbody></table>'+(notes.length?'<p class="blLedgerNote">'+notes.map(E).join(' · ')+'</p>':'');
 }
 function renderResult(){
  const d=B.state,g=d.game,r=g.roundResult;if(!r)return;if(g.claimReviewUntil&&r.claim?.valid){renderClaimReview();return;}const me=d.me>=0?d.me%2:0,end=g.phase==='matchEnd',won=end?g.winner===me:r.winner===me;
  const round=resultLedgerHTML(d,g,r,me)+(r.claim?'<div class="blClaimResult"><b>'+E(r.reason)+'</b><br>'+E(r.claim.explanation)+(r.claim.first&&r.claim.second?'<div class="blClaimProof">'+img(r.claim.first)+img(r.claim.second)+'</div>':'')+'</div>':'');
  const total=end?'<p class="blFinalCaption">النتيجة النهائية للصكة</p><div class="blFinalScore">'+[me,1-me].map(t=>'<div class="'+(t===g.winner?'winner':'')+'"><span>'+(d.me<0?'الفريق '+(t+1):t===me?'فريقنا':'الفريق الآخر')+'</span><strong>'+g.scores[t]+'</strong><small>'+[t,t+2].map(i=>E(d.seats[i]?.name)).join(' · ')+'</small>'+(t===g.winner?'<b>الفائز</b>':'')+'</div>').join('')+'</div>':'';
  const runningTotal='<div class="blRunningTotal"><span>مجموع الصكة</span><b>لنا '+g.scores[me]+'</b><b>لهم '+g.scores[1-me]+'</b></div>';
  const competitive=end&&d.mode==='competitive'&&(d.me>=0||d.progression?.forfeited);
  const footer=end?'<div class="blNote">'+(d.mode==='competitive'?'':'جلسة ودية · لا تؤثر على الترتيب')+'</div><div class="blInline blResultActions">'+btn('الرئيسية','leave')+(d.me>=0&&d.mode==='friendly'?btn('صكة جديدة · استعداد','rematchLobby','blPrimary',d.settled?'':'disabled'):'')+'</div>':'<div class="blResultContinue">'+advanceHTML('المتابعة بنقرتين')+'<p>التوزيعة التالية خلال <b data-bl-clock></b></p></div>';
  const el=modal(end?(d.me<0?'انتهت الصكة':won?'فزتم بالصكة':'خسرتم الصكة'):'نشرة التوزيعة '+g.round,'<div class="blResult blClassicResult">'+(competitive?'<p class="blCompetitiveKicker">صكة تنافسية · '+(d.me<0?'انتهت مشاركتك':won?'فوز مستحق':'فرصة جديدة في الصكة القادمة')+'</p>'+rankResult():'')+total+(end?'<details class="blLastRound"><summary>تفاصيل الجولة الأخيرة</summary>'+round+'</details>':round+runningTotal)+footer+'</div>','result',false);el.classList.toggle('blMatchResult',end);el.classList.toggle('blRoundResult',!end);el.classList.toggle('blCompetitiveResult',!!competitive);el.dataset.result=competitive?(d.me<0?'departed':won?'win':'loss'):'';el.classList.remove('blClaimResultReview');
 }
 function sawaCardsHTML(g){return '<div class="blSawaCards">'+(g.sawa?.cards||[]).map(id=>img(id)).join('')+'</div>';}
 function sawaLineHTML(line){if(!line?.length)return '';let html='';for(let i=0;i<line.length;i+=4){const plays=line.slice(i,i+4);html+='<div class="blTrick"><small>مسار التحقق · أكلة '+(i/4+1)+'</small><div class="blTrickCards">'+plays.map(p=>'<div>'+img(p.card)+'<small>'+E(B.state.seats[p.seat]?.name)+'</small></div>').join('')+'</div></div>';}return html;}
 function sawaFanHTML(g,seat){if(!verifiedSawa(g)||!g.exposedHands?.[seat])return '';const cards=g.exposedHands[seat];return '<div class="blSawaFan" aria-label="أوراق '+E(B.state.seats[seat]?.name)+'">'+cards.map((id,i)=>'<img class="blCardFace" src="cards/'+E(id)+'.png" alt="'+E(id)+'" draggable="false" style="--sawa-x:'+((i-(cards.length-1)/2)*14)+'px;--sawa-a:'+((i-(cards.length-1)/2)*9)+'deg;--sawa-y:'+Math.abs(i-(cards.length-1)/2)*2+'px">').join('')+'</div>';}
 function sawaPromptHTML(){return '<div class="blSawaPrompt"><strong>سوا · '+E(B.state.seats[B.state.game.sawa.by]?.name)+'</strong><p>النتيجة خلال <b data-bl-clock></b></p>'+advanceHTML()+'</div>';}
 function renderSawa(){
  const g=B.state.game,s=g.sawa,me=B.state.me,reply=me>=0&&me%2!==s.by%2&&!s.accepted.includes(me)&&!B.state.auto[me];
  modal('سوا · '+E(B.state.seats[s.by]?.name),'<p class="blNote">يعلن أنه سيأخذ كل الأكلات المتبقية بنفسه.</p>'+sawaCardsHTML(g)+'<p>للرد <b data-bl-clock></b></p><div class="blInline">'+(reply?btn('موافق','sawaAccept','blPrimary')+btn('قيد · سوا غير صحيحة','sawaChallenge'):'<p class="blNote">'+(s.accepted.includes(me)?'تم قبولك؛ بانتظار الخصم الآخر':'بانتظار رد الخصمين')+'</p>')+'</div><p class="blNote">القبول أو انتهاء مهلة الرد يمنح صاحب السوا باقي الأكلات. القيد الخاطئ يُحسب على طالبه.</p>','sawa',false);clock();
 }
 function renderSawaClaim(){
  const g=B.state.game,c=g.claim,mine=c.by===B.state.me&&!c.automatic,p=c.presentation;
  modal('قيد · سوا غير صحيحة','<p>'+E(B.state.seats[c.by]?.name)+' يطلب التحقق من سوا '+E(B.state.seats[g.sawa.by]?.name)+'</p>'+sawaCardsHTML(g)+(c.automatic?'<p class="blClaimStep">'+(p?.stage==='reason'?'الكمبيوتر اختار قيد السوا…':p?.stage==='confirm'?'يعرض مسار الإثبات قبل التأكيد…':'يتحقق من الردود القانونية والورق المتبقي…')+'</p>':'<p class="blNote">التحقق يشمل جميع خيارات النزول والردود القانونية، دون الاعتماد على ترتيب الصور.</p>')+sawaLineHTML(g.sawaLine)+(mine?btn('تأكيد القيد','sawaJudge','blPrimary'):'')+'<details class="blReviewHistory"><summary>مراجعة الأكلات والورق المتبقي</summary>'+historyHTML()+'</details><p class="blNote">متبقي <b data-bl-clock></b> · فتح القيد يلزم إكماله.</p>','claim',false);clock();
 }
 function renderClaimReview(){
  const g=B.state.game,c=g.roundResult.claim,target=B.state.seats[c.target]?.name,team=B.state.me>=0?B.state.me%2:0;
  const proof=(c.first?'<div><b>الورقة المخالفة</b>'+img(c.first)+'</div>':'')+(c.second?'<div><b>ورقة الإثبات</b>'+img(c.second)+'</div>':'');
  const el=modal('قيد صحيح','<div class="blClaimReview"><div class="blClaimReviewDetails"><p class="blClaimSummary"><b>'+E(C[c.reason]||'')+'</b>'+(target?' · على '+E(target):'')+'</p><p class="blNote">طلب القيد: '+E(B.state.seats[c.by]?.name)+'</p>'+(proof?'<div class="blReviewProof">'+proof+'</div>':'')+'<p>'+E(c.explanation)+'</p>'+sawaLineHTML(c.line)+'<div class="blReviewScore"><span>نقاط الجولة</span><b>لنا '+g.roundResult.won[team]+'</b><b>لهم '+g.roundResult.won[1-team]+'</b></div><details class="blReviewHistory"><summary>مراجعة الأكلات والمشاريع</summary>'+revealedHTML()+historyHTML()+'</details></div><div class="blClaimContinue"><p>متبقي للتأكد <b data-bl-clock></b></p>'+advanceHTML()+'</div></div>','result',false);el.classList.add('blClaimResultReview');el.classList.remove('blRoundResult');
 }
 function canAdvance(g){return !!g&&(verifiedSawa(g)||['review','roundEnd'].includes(g.phase)||g.phase==='matchEnd'&&!!g.claimReviewUntil);}
 function claimSelection(){const g=B.state.game;if(g.claimReviewUntil)return g.roundResult.claim;if(g.phase!=='claim')return {};if(g.claim.automatic)return g.claim.presentation||{};return g.claim.by===B.state.me?{first:B.first,second:B.second}:g.claim.selection||{};}
 function historyHTML(selectable=false){
  const g=B.state.game,selected=claimSelection();
  const entry=(plays,label)=>'<div class="blTrick"><small>'+E(label)+'</small><div class="blTrickCards">'+plays.map(p=>{const slot=p.card===selected.first?'first':p.card===selected.second?'second':null;return '<button class="'+(slot?'blEvidenceSelected':'')+'" '+(slot?'data-evidence-slot="'+slot+'" ':'')+(selectable?'data-bl="evidence" data-card="'+p.card+'" aria-pressed="'+!!slot+'"':'')+'>'+img(p.card)+(slot?'<b class="blEvidenceNumber">'+(slot==='first'?'١ · المخالفة':'٢ · الإثبات')+'</b>':'')+'<small>'+E(p.name||B.state.seats[p.seat]?.name)+'</small></button>';}).join('')+'</div></div>';
  return g.history.map((h,i)=>entry(h.plays,'الأكلة '+(i+1))).join('')+(g.trick.length?entry(g.trick,'الأكلة الحالية'):'')+(g.exposedHands?g.exposedHands.map((h,i)=>entry(h.map(card=>({card,seat:i})),'المتبقي مع '+B.state.seats[i].name)).join(''):'');
 }
 function autoClaimHTML(g){
  const p=g.claim.presentation||{stage:'reason'},selected=p.reason,first=p.first,second=p.second;
  if(g.claim.reason==='project'){const target=Number.isInteger(p.target)?p.target:null,items=target===null?[]:g.revealed[target];return '<p class="blClaimStep" role="status">'+({reason:'الكمبيوتر يختار سبب القيد…',first:'اختار مشروع غلط؛ يحدد صاحب المشروع…',second:'يراجع أوراق المشروع المفروش…',confirm:'الدليل مكتمل؛ جارٍ تأكيد القيد…'}[p.stage]||'جارٍ التحقق')+'</p>'+(selected?'<div class="blClaimReasons"><span class="selected">مشروع غلط</span></div>':'')+(target===null?'':'<section class="blProjectEvidence"><h3>مشروع '+E(B.state.seats[target]?.name)+'</h3>'+projectCardsHTML(items)+(items.length?'':'<p class="blNote">لم يُفرش المشروع في الأكلة الثانية.</p>')+'</section>')+'<p class="blNote">يعرض الاختيار نفسه لجميع اللاعبين والمشاهدين.</p>';}
  return '<p class="blClaimStep" role="status">'+({reason:'الكمبيوتر يختار سبب القيد…',first:'اختار السبب؛ يحدد الورقة المخالفة…',second:'حدد الورقة المخالفة؛ يحدد ورقة الإثبات…',confirm:'الدليل مكتمل؛ جارٍ تأكيد القيد…'}[p.stage]||'جارٍ التحقق')+'</p><div class="blClaimReasons">'+Object.entries(C).filter(([k])=>k!=='sawa'&&(g.contract.mode==='hokum'||['cut','project'].includes(k))).map(([k,n])=>'<span class="'+(selected===k?'selected':'')+'" data-reason="'+k+'">'+E(n)+'</span>').join('')+'</div><div class="blEvidence blAutoEvidence"><div data-evidence="first"><b>الورقة المخالفة</b>'+(first?img(first):'<span>بانتظار التحديد</span>')+'</div><div data-evidence="second"><b>ورقة الإثبات</b>'+(second?img(second):'<span>'+(p.stage==='confirm'?'المخالفة ثابتة بموضع الإعلان':'بانتظار التحديد')+'</span>')+'</div></div><p class="blNote">يعرض الاختيار نفسه لجميع اللاعبين والمشاهدين.</p>';
 }
 function renderClaim(){
  if(B.state.game.claim.reason==='sawa'){renderSawaClaim();return;}
  const g=B.state.game,automatic=g.claim.automatic,mine=!automatic&&g.claim.by===B.state.me;const oldBody=$('#blClaimHistory')?.scrollTop||0,key=g.id+':'+g.round+':'+g.claim.startedAt;
  if(B.claimKey!==key){B.claimKey=key;B.evidencePending=false;B.slot='first';B.first=g.claim.selection?.first||null;B.second=g.claim.selection?.second||null;}
  if(mine&&!B.evidencePending){B.first=g.claim.selection?.first||null;B.second=g.claim.selection?.second||null;}
  if(mine&&B.evidencePending&&g.claim.selection?.first===B.first&&g.claim.selection?.second===B.second)B.evidencePending=false;
  modal(automatic&&g.claim.presentation?.stage==='reason'?'قيد الكمبيوتر':'قيد · '+C[g.claim.reason],'<p class="blClaimOwner">'+E(B.state.seats[g.claim.by].name)+(automatic?' · عرض القيد للجميع':' · متبقي <b data-bl-clock></b>')+'</p>'+(automatic?autoClaimHTML(g):mine?(g.claim.reason==='project'?'<p>راجع المشاريع ثم اختر صاحب المشروع المخالف</p>'+projectClaimChoices():'<p class="blNote">١ اختر المخالفة · ٢ اختر ورقة الإثبات · ٣ أكّد القيد</p><div class="blEvidence blManualEvidence"><button data-bl="slot" data-slot="first" class="'+(B.slot==='first'?'on':'')+'">'+(B.first?img(B.first):'<span>١</span><small>الورقة المخالفة</small>')+'</button><button data-bl="slot" data-slot="second" class="'+(B.slot==='second'?'on':'')+'">'+(B.second?img(B.second):'<span>٢</span><small>ورقة الإثبات</small>')+'</button></div>'+btn('تأكيد القيد','judge','blPrimary',!B.evidencePending&&B.first&&(B.second||g.claim.reason==='akka')?'':'disabled')):'<p>اللاعب يحدد القيد…</p><div class="blEvidence blAutoEvidence">'+['first','second'].map(k=>'<div><b>'+(k==='first'?'الورقة المخالفة':'ورقة الإثبات')+'</b>'+(g.claim.selection?.[k]?img(g.claim.selection[k]):'<span>بانتظار التحديد</span>')+'</div>').join('')+'</div>')+'<h3 class="blHistoryHeading">الأكلات والورق المتبقي</h3><div id="blClaimHistory" tabindex="0" aria-label="سجل الأكلات وأوراق الإثبات">'+historyHTML(mine&&g.claim.reason!=='project')+'</div><p class="blNote">فتح القيد يكشف الورق ويلزم إكمال الطلب. القيد الخاطئ أو انتهاء المهلة يُحسب على فريق طالب القيد.</p>','claim',false);$('#blClaimHistory').scrollTop=oldBody;clock();
 }
 function projectCardsHTML(items){return items.map(p=>'<div class="blChosenProject"><b>'+E(N[p.type])+'</b><div>'+p.cards.map(c=>img(c)).join('')+'</div></div>').join('');}
 function projectClaimChoices(){const d=B.state,g=d.game;return d.seats.map((p,i)=>i%2!==d.me%2&&g.declared[i]?.length?'<section class="blProjectEvidence"><h3>'+E(p.name)+' · '+E(g.declared[i].map(k=>N[k]).join(' + '))+'</h3>'+projectCardsHTML(g.revealed[i])+(g.revealed[i].length?'':'<p class="blNote">لم تُفرش أوراق المشروع بعد.</p>')+btn('تأكيد القيد على '+E(p.name),'judgeProject','','data-seat="'+i+'"')+'</section>':'').join('');}
 function projectReview(seat){
  const d=B.state,g=d?.game;if(!g||!Number.isInteger(seat)||!g.declared[seat]?.length)return;
  B.reviewProjectSeat=seat;const shown=g.revealed[seat]||[],own=seat===d.me,items=shown.length?shown:own?g.myProjectSelections||[]:[],canClaim=d.me>=0&&!d.auto[d.me]&&seat%2!==d.me%2&&['play','collect','review'].includes(g.phase);
  modal('مشروع '+d.seats[seat].name,'<p>'+E(g.declared[seat].map(k=>N[k]).join(' + '))+'</p>'+projectCardsHTML(items)+(!shown.length?'<p class="blNote">'+(own?'هذه أوراقك المختارة. تُفرش مع ورقتك في الأكلة الثانية إذا كان فريقك صاحب المشروع الأكبر.':'لم تُفرش أوراق هذا اللاعب بعد؛ تُعرض مشاريع الفريق صاحب المشروع الأكبر في الأكلة الثانية.')+'</p>':'')+(canClaim?btn('قيد · مشروع غلط','claimReason','blPrimary','data-kind="project"')+'<p class="blNote">القيد الخاطئ يُحسب على فريق طالب القيد.</p>':''),'projectReview');
 }
 function canPrepareProjects(g,me){return !!g&&me>=0&&!B.state.auto[me]&&['play','double','trump'].includes(g.phase)&&!g.history.concat({plays:g.trick}).some(h=>h.plays.some(p=>p.seat===me));}
 function projectsDialog(){const g=B.state.game;if(!canPrepareProjects(g,B.state.me)&&g.myProjectSelections?.length){projectReview(B.state.me);return;}if(g.history.length===1&&!g.projectContest?.eligible.includes(B.state.me)){toast('الفرش للفريق صاحب المشروع الأكبر');return;}B.projectItems=(B.projectDraft?.items||g.myProjectSelections||[]).map(p=>({type:p.type,cards:p.cards.slice()}));B.projectCards=[];B.projectType='sira';revealDialog();}
 function flushPreparedProjects(){const d=B.projectDraft,g=B.state?.game;if(!d||d.sent||!g||B.pending||B.modal||document.hidden||!B.room?.ready)return;if(d.match!==g.id||d.round!==g.round||!canPrepareProjects(g,B.state.me)){B.projectDraft=null;return;}if(g.phase==='play'&&g.turn===B.state.me){d.sent=true;move({type:'declare',items:d.items});}}
 function revealDialog(){
  const g=B.state.game,declaring=canPrepareProjects(g,B.state.me),stored=!declaring&&Array.isArray(g.myProjectSelections),played=g.history.flatMap(h=>h.plays).filter(p=>p.seat===B.state.me).map(p=>p.card),cards=[...g.myHand,...played].sort((a,b)=>'CSHD'.indexOf(a.at(-1))-'CSHD'.indexOf(b.at(-1))||rank(b)-rank(a));
  const chosen='<div class="blProjectsList">'+B.projectItems.map((p,i)=>'<div class="blChosenProject"><b>'+E(N[p.type])+'</b><div>'+p.cards.map(c=>img(c)).join('')+'</div>'+(!stored?btn('حذف','projectRemove','','data-index="'+i+'"'):'')+'</div>').join('')+'</div>';
  modal(declaring?'حدد أوراق المشروع':'فرش المشاريع','<p class="blNote">'+(declaring?'حدد أوراق كل مشروع، ثم نوعه واضغط «أضف المشروع». يمكنك التجهيز قبل دورك؛ يُرسل الإعلان عند بدء دورك ويظهر للجميع، وتُفرش الأوراق المختارة تلقائيًا مع ورقتك في الأكلة الثانية إذا كان فريقك صاحب المشروع الأكبر، حتى لو كان المشروع غير صحيح.':'تُعرض أوراقك المختارة كما أعلنتها، ويستطيع الخصم طلب القيد على المشروع المخالف.')+'</p>'+(!stored?'<div class="blSelectCards">'+cards.map(c=>'<button data-bl="projectCard" data-card="'+c+'" class="'+(B.projectCards.includes(c)?'on':'')+'">'+img(c)+'</button>').join('')+'</div><div id="blProjectType" class="blProjectTypes" role="group" aria-label="نوع المشروع">'+Object.entries(N).filter(([k])=>k!=='baloot'&&(k!=='fourHundred'||g.contract.mode==='sun')).map(([k,n])=>btn(n,'projectType',B.projectType===k?'blPrimary':'','data-type="'+k+'" aria-pressed="'+(B.projectType===k)+'"')).join('')+'</div><div class="blInline">'+btn('أضف المشروع','projectAdd')+'</div>':'')+chosen+btn(declaring?(g.turn===B.state.me&&g.phase==='play'?'أعلن المشاريع':'حفظ لدوري'):'افرش المشاريع',declaring?'declareSave':'revealSave','blPrimary',B.projectItems.length?'':'disabled'),declaring?'declare':'reveal');
 }


 function board(data){
  const body='<div class="blTabs">'+btn('العام','board','','data-period="all"')+btn('الأسبوعي','board','','data-period="week"')+'</div>'+(data?.endAt?'<p class="blNote" id="blWeekTime" data-end="'+data.endAt+'"></p>':'<p class="blNote">ترتيب صكة المستقل · العام لا يتصفر</p>')+(data?(data.rows.length?data.rows.map(r=>'<div class="blLine"><span>'+r.position+'</span>'+avatar(r)+'<b>'+E(r.name)+(r.weeklyChampion?'<small class="blWeeklyTitle">بطل الأسبوع</small>':'')+'</b>'+crestHTML(r.rank?.tier)+'<span>'+r.points+'</span></div>').join(''):'<p class="blEmpty">لم تُسجّل نتائج بعد</p>'):loadingHTML('نجهّز صدارة صكة…'));
  modal('صدارة صكة',body,'board');$('#blModal [data-period="'+B.board+'"]').classList.add('on');startClock();clock();
 }
 function rules(){modal('صكة · لعب البلوت الحر','<p>أربعة لاعبين، كل لاعبين متقابلين فريق. الصكة إلى 152، والأعلى يفوز إذا تجاوزها الفريقان؛ التعادل يستكمل اللعب. حساب الأبناط وفق لائحة هيئة الترفيه السعودية. الشراء صن أو حكم، ثم التدبيل والمشاريع واللعب.</p><p>الأوراق متاحة في دورك حتى لو كانت مخالفة. الخصم يطلب «قيدها» ويحدد السبب والورقتين. فتح القيد يكشف الورق؛ القيد الخاطئ أو تركه حتى تنتهي المهلة يُحسب على فريق طالبه.</p><p>حدد أوراق مشروعك ونوعه قبل ورقتك الأولى؛ تُفرش الأوراق المختارة كما هي حتى لو كانت مخالفة، ولا يُلغى مشروع خاطئ إلا بالقيد عليه. في الأكلة الثانية تُفرش المشاريع المختارة تلقائيًا مع نزول ورقة صاحبها إذا كان فريقه صاحب أكبر مشروع، وتبقى أوراق الخصم مخفية. تختفي أسماء مشاريع الفريق الآخر بعد حسم أفضلية الفرش، ويختفي إعلان المشروع بعد فرشه. الأسماء للعرض فقط ولا تفتح أوراقًا عند الضغط عليها؛ طلب قيد «مشروع غلط» من زر «قيدها». عند التعادل تُقارن أعلى ورقة ثم ترتيب المقاعد من يمين الموزع. البلوت يُذكر تلقائيًا لصاحبه مع الورقة الثانية من الشايب والبنت من الحكم، بأي ترتيب، مرة واحدة ودون اختيار إعلان. ويُحتسب تلقائيًا إذا ظهر مع مشروع متسلسل. أكّه: في الحكم، قبل افتتاح الأكلة بورقة غير حكم هي الأعلى الباقية من نوعها؛ الأكة مؤككة بنفسها دون ضغط الزر، وإذا لم يملك خويك نوعها وكانت الأكلة لكم فلا يجب عليه ضربها بحكم. التأكيك المخالف قابل للقيد، ولا يُعلن في الأكلة الأخيرة. إذا كانت الأكلة لخويك بحكم فلا يلزمك التكبير عليه، لكن تتبع الحكم إذا بدأ به اللعب. وإذا كان الخصم هو الآكل بحكم يجب التكبير عند توفر الأعلى؛ وعند غياب لون البداية وعدم وجود حكم أعلى يجوز الحرق. في الشراء الأول، عند طلب الصن يرجع «قبلك / بس» إلى اللاعب الذي يسبقه مباشرة، ثم الذي قبله حتى يمين الموزع؛ يشمل الخوي ومن قال بس. يستمر الرجوع حتى لو قال أحدهم «قبلك»، ولا تُستكمل الأوراق إلا بعد رد جميع أصحاب الأولوية؛ يكون آخر من أخذها صاحب أولوية أعلى والمشتري النهائي وصاحب ورقة المشترى. الشراء المباشر للصن في الثاني لا يفتح رجوعًا جديدًا. في صكة، الحكم الأول والثاني يفتحان فرصة جديدة للصن لكل لاعب فور الإعلان، بما في ذلك الشريك ومن مرّر في الشراء الأساسي. رفض الصن بقول بس في هذه الفرصة يسقط حق الرد عليها. إذا طلب لاعب الصن تُحسم قبلك حسب أولوية المقاعد قبل إكمال التوزيع، وإذا رفض الجميع يُسمّي مشتري الحكم الثاني نوع الحكم وهو يحمل الخمس الأولى، ثم تُستكمل الأوراق ويبدأ التدبيل؛ أما الحكم على آكة في الدورتين فلا يقلبه صنًا إلا يمين الموزع. لا سحب بعد إكمال التوزيع. الأشكال بعد حكم الخصم وللموزع أو اللاعب عن يساره، وفي الدورة الثانية لا يحق لمن قال ولا أن يعود للأشكال. إذا مرّ الجميع في دورتي الشراء تُعاد التوزيعة بلا نقاط وينتقل الموزع.</p><p>كاشو (البوشات) في صكة: يظهر لصاحب الخمس الأولى إذا كانت كلها من ٧ و٨ و٩، أثناء الشراء وقبل تكملة التوزيع. العشرة ليست بوش. بالضغط تُكشف الخمس الموزعة لكل لاعب مدة خمس ثوانٍ، ثم يعيد الموزع نفسه التوزيع بلا نقاط. لا يتاح الكاشو بعد تكملة الأوراق. الأكلة تبقى خمس ثوانٍ على الأرض أو يجمعها صاحبها بنقرتين. الورقة في يدك تُحدد بلمسة وتؤكد بالثانية؛ إذا كانت الأكلة لك تجمعها اللمسة الثانية وتلعب الورقة معًا. أول ورقة لكل لاعب لها ٢٠ ثانية لترتيب المشاريع، ثم ١٠ ثوانٍ لكل دور.</p><p>السوا من يد واحدة: يظهر زرها في دورك قبل افتتاح أكلة جديدة عندما تبقى معك ورقتان أو ثلاث أو أربع أوراق وتضمن أخذ جميع الأكلات المتبقية بنفسك بترتيب لعب قانوني، مهما كانت ردود اللاعبين؛ لا يكفي أن يأخذها شريكك. بالضغط تُكشف أوراق اللاعبين الأربعة بجوار مقاعدهم لمدة خمس ثوانٍ. يمكن اختصار العرض إذا نقر كل لاعب يتحكم بيده مرتين للمتابعة؛ وإلا ينتهي العرض تلقائيًا. تُحتسب الأكلات المتبقية وعشرة الأرض بالحسبة المعتادة، ثم تظهر نتيجة التوزيعة أولًا قبل الانتقال للتالية. لا تحتاج السوا المضمونة إلى قبول الخصمين، ولا يُطلب القيد على السوا نفسها، لكن يبقى القيد على مخالفة سابقة متاحًا أثناء العرض. لا تُحتسب كبوتًا إلا إذا جمع فريقك الأكلات الثماني. تظهر الخاصية عندما يستخدم جميع اللاعبين نسخة تدعم السوا الجديدة.</p><p>الأسبوعي يتجدد الخميس الساعة 7 صباحًا بتوقيت السعودية، والعام مستمر. نقاط الترقية تُعتمد بعد الصكة الكاملة بحسب شريحتك عند البداية، وحدود الرتب محمية. آخر ثلاث شارات تتطلب ٦٠ و٩٠ و١٢٠ يوم لعب مؤهل. الأسبوعي مستقل: ١٠ نقاط لكل فوز، وصاحب صدارة الأسبوع السابق يحمل لقب «بطل الأسبوع» حتى التجديد التالي. الودي والكمبيوتر لا يمنحان نقاطًا. مهلة العودة للتنافسي ٦٠ ثانية؛ بعدها خصم ٥٠ نقطة مع حماية حد الرتبة وإيقاف البحث ١٠ دقائق، ويُستثنى العطل المؤكد.</p><p>هذه النسخة بلا رسوم أو جوائز ذهب للبلوت. رصيدك ومتجرك واشتراكك وأصدقاؤك مشتركون مع مجابيد.</p>','rules');}
 function soundIcon(){return '<svg class="uiIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/>'+(B.muted?'<path d="m16 9 6 6m0-6-6 6"/>':'<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>')+'</svg>';}
 function canArmAkka(g,me){return !!g&&g.contract?.mode==='hokum'&&g.phase==='play'&&me>=0&&g.turn===me&&!g.trick.length&&g.history.length<7;}
 function naturalAkka(g,id){return g?.contract?.mode==='hokum'&&/^A[SHDC]$/.test(id||'')&&id.at(-1)!==g.contract.trump;}
 function canPrepareAkka(g,me){return canArmAkka(g,me)&&!B.state.auto[me]&&!B.pending&&!B.playVisual;}
 function queueOrPlay(card){
  const g=B.state?.game;if(!g||!g.myHand.includes(card)||B.state.me<0||B.state.auto[B.state.me]||B.pending||B.playVisual)return;
  const akka=B.preselect?.card===card?B.preselect.akka:B.akka;B.akka=false;
  if(g.turn===B.state.me&&(g.phase==='play'||g.phase==='collect'&&g.canCollect)){if(submitCard({type:'play',card,akka:akka===true&&(canArmAkka(g,B.state.me)||g.phase==='collect'&&g.contract?.mode==='hokum'&&g.history.length<6),...(g.phase==='collect'?{collect:{match:g.id,round:g.round,trick:g.history.length}}:{})}))B.preselect=null;paintPreselect();}
  else if(['play','collect'].includes(g.phase)){B.preselect={match:g.id,round:g.round,card,akka:!!akka,confirmed:true};paintPreselect();}
 }
 function paintPreselect(){
  reconcileCardMotion();const g=B.state?.game;document.querySelectorAll('#blGame .blHand button').forEach(b=>{const sending=b.dataset.card===B.playVisual?.card,selected=b.dataset.card===B.preselect?.card||sending;b.classList.toggle('selected',selected);b.classList.toggle('blSendingCard',sending);b.style.visibility=sending&&B.playVisual?.ghost?.isConnected?'hidden':'';b.disabled=verifiedSawa(g);b.setAttribute('aria-pressed',String(selected));b.setAttribute('aria-label',(verifiedSawa(g)?'ورقة مكشوفة ':sending?'جارٍ تنزيل الورقة ':selected?'تأكيد الورقة ':'تحديد الورقة ')+b.dataset.card);});
  let toggle=$('#blGame [data-bl="akka"]');if(canPrepareAkka(g,B.state?.me??-1)){if(!toggle){$('#blGame').insertAdjacentHTML('beforeend',btn('تأكيك','akka','blAkka','aria-pressed="false"'));toggle=$('#blGame [data-bl="akka"]');}toggle.setAttribute('aria-label',B.preselect?'تأكيك الورقة المحددة عند افتتاح الأكلة':'تأكيك الورقة التالية');}else{toggle?.remove();toggle=null;}if(toggle){const automatic=naturalAkka(g,B.preselect?.card),armed=automatic||(B.preselect?B.preselect.akka:B.akka);toggle.textContent=automatic?'الأكة مؤككة تلقائيًا':'تأكيك';toggle.setAttribute('aria-label',automatic?'الأكة مؤككة تلقائيًا ولا تحتاج إعلانًا':B.preselect?'تأكيك الورقة المحددة عند افتتاح الأكلة':'تأكيك الورقة التالية');toggle.setAttribute('aria-pressed',String(!!armed));toggle.classList.toggle('on',!!armed);toggle.classList.toggle('automatic',automatic);}
  const label=$('#blGame .blHandLabel');if(label&&g)label.textContent=B.preselect?(B.preselect.confirmed?'جاهزة لدورك · اضغط للإلغاء':g.phase==='collect'&&g.canCollect?'محددة · اضغط ثانية للجمع وتنزيلها':g.phase==='play'&&g.turn===B.state.me?'محددة · اضغط ثانية لتنزيلها':'محددة · اضغط ثانية لتجهيزها لدورك')+(naturalAkka(g,B.preselect.card)?' · الأكة مؤككة':B.preselect.akka?' · أكّه':''):B.state.me<0?'مشاهد':'';
 }
 function flushPreselect(){if(B.projectDraft)return;const q=B.preselect,g=B.state?.game;if(q?.confirmed===true&&q.match===g?.id&&q.round===g?.round&&g.myHand.includes(q.card)&&(g.phase==='play'||g.phase==='collect'&&g.canCollect)&&g.turn===B.state.me&&B.room?.ready&&!B.state.auto[B.state.me]&&!document.hidden&&!B.pending&&!B.playVisual&&!B.modal)queueOrPlay(q.card);}
 function updateExtras(previous,m){
  const g=m.game,q=B.preselect;if(previous?.game?.phase!==g?.phase){B.lastTap=null;B.readySent=null;B.collectTap=null;}if(verifiedSawa(g)){B.preselect=null;B.akka=false;B.projectDraft=null;B.revealUntil=0;B.revealSeat=null;cancelDrag();clearCardMotion();}if(q&&(!g||q.match!==g.id||q.round!==g.round||!g.myHand.includes(q.card)||!['play','collect'].includes(g.phase)))B.preselect=null;
  if(previous?.game?.id!==g?.id||previous?.game?.round!==g?.round){B.projectDraft=null;B.projectItems=[];B.projectCards=[];B.claimKey=null;B.evidencePending=false;B.revealUntil=0;B.revealSeat=null;B.declareUntil={};B.notice=null;B.lastTap=null;B.readySent=null;B.akka=false;}
  if(B.projectDraft&&g?.myProjectSelections&&JSON.stringify(g.myProjectSelections)===JSON.stringify(B.projectDraft.items))B.projectDraft=null;
  if(m.auto[m.me]){B.projectDraft=null;B.preselect=null;B.akka=false;}if(!canArmAkka(g,m.me)){B.akka=false;if(B.preselect)B.preselect.akka=false;}
  if(B.modal&&['bid','double'].includes(B.modal)&&(!g||g.id!==previous?.game?.id||g.round!==previous?.game?.round||g.turn!==m.me||B.modal==='bid'&&g.phase!=='bid'||B.modal==='double'&&g.phase!=='double'))closeModal();
  if(g){const fresh=(g.cues||[]).filter(e=>e.id>(previous?.game?.cueSeq||g.cueSeq)&&m.now-e.at<4000);
   for(const e of fresh){if(e.type==='kasho')B.notice={text:(m.seats[e.seat]?.name||'لاعب')+' · كاشو · كشف الأوراق',until:Date.now()+4500};if(e.type==='project'&&e.items?.length){B.declareUntil[e.seat]=Date.now()+3500;}if(e.type==='reveal'){B.revealUntil=Date.now()+4200;B.revealSeat=e.seat;}}
  }
  for(const msg of m.chat||[]){const id=msg.id||String(msg.at)+msg.uid;if(B.chatSeen.has(id))continue;B.chatSeen.add(id);if(previous?.room===m.room&&m.now-msg.at<4000&&!B.muted){if(msg.phraseId&&typeof playVoice==='function')playVoice(msg.phraseId);else sound('click');}}
  if(B.chatSeen.size>100)B.chatSeen=new Set((m.chat||[]).map(x=>x.id||String(x.at)+x.uid));
 }
 function noticeHTML(){return B.notice&&Date.now()<B.notice.until?'<div id="blProjectNotice" role="status">'+E(B.notice.text)+'</div>':'';}
 function revealedHTML(onlySeat=null){const g=B.state?.game;return g?g.revealed.map((ps,i)=>ps.length&&(onlySeat===null||onlySeat===i)?'<div class="blSpreadRow"><b>'+E(B.state.seats[i].name)+' · '+ps.map(p=>N[p.type]).join(' + ')+'</b><div>'+ps.flatMap(p=>p.cards).map(c=>img(c)).join('')+'</div></div>':'').join(''):'';}
 function spreadHTML(){const g=B.state?.game,html=revealedHTML(B.revealSeat),name=B.state?.seats[B.revealSeat]?.name||'';return html&&Date.now()<B.revealUntil&&['play','collect','review'].includes(g.phase)?'<aside id="blSpread" aria-label="المشاريع المفروشة"><p class="blSpreadReason">'+E(name?'مشروع '+name:'المشاريع المفروشة')+'</p>'+html+'</aside>':'';}
 function advanceKey(){const g=B.state?.game;return g?g.id+':'+g.round+':'+g.phase:'';}
 function advanceHTML(label='انقر مرتين للمتابعة'){const g=B.state.game;if(!canAdvance(g)||B.state.me<0||verifiedSawa(g)&&B.state.auto[B.state.me])return '';const yes=(g.advanceReady||[]).includes(B.state.me),text=yes?'جاهز · بانتظار البقية':label;return '<div class="blAdvance"><button type="button" data-bl="advance" aria-label="'+E(text)+'">'+E(text)+'</button><small>موافقة <bdi dir="ltr">'+(g.advanceReady||[]).length+' / 4</bdi></small></div>';}
 function sendReady(){const g=B.state?.game,key=advanceKey();if(!canAdvance(g)||B.state.me<0||verifiedSawa(g)&&B.state.auto[B.state.me]||(g.advanceReady||[]).includes(B.state.me)||B.readySent===key)return;if(sendRoom({type:'ready',match:g.id,round:g.round,phase:g.phase})){B.readySent=key;setTimeout(()=>{if(B.readySent===key)B.readySent=null;},1800);}}
 function renderKasho(){
  const d=B.state,g=d.game;modal('كاشو · '+E(d.seats[g.kasho?.by]?.name||'لاعب'),'<p class="blKashoCountdown">إعادة التوزيع خلال <b data-bl-clock></b></p><div class="blKashoHands">'+[0,1,2,3].map(i=>'<section data-kasho-seat="'+i+'"><header>'+avatar(d.seats[i])+'<b>'+E(d.seats[i]?.name)+(i===d.me?' · أنت':'')+'</b>'+(i===g.kasho?.by?'<small>طلب الكاشو</small>':'')+'</header><div class="blKashoCards">'+(g.exposedHands?.[i]||[]).map(c=>img(c)).join('')+'</div></section>').join('')+'</div><p class="blNote">الأوراق مكشوفة للجميع · التوزيعة بلا نقاط</p>','kashoReveal',false);
 }
 function collectHTML(){
  const d=B.state,g=d?.game;if(g?.phase!=='collect')return '';
  const mine=g.canCollect===true&&d.me===g.turn&&!d.auto[d.me];
  return '<div class="blCollectPrompt">'+(d.seats[g.turn]?.bot||d.auto[g.turn]?'<span>يجمع الكمبيوتر الأكلة…</span>':'<span>تُجمع الأكلة خلال <b data-bl-clock></b></span>')+(mine?'<button type="button" data-bl="collectTrick" aria-label="انقر مرتين لجمع الأكلة">انقر مرتين لجمعها</button>':'<small>الأكلة لـ '+E(d.seats[g.turn]?.name)+'</small>')+'</div>';
 }
 function collectTap(e){
  const d=B.state,g=d?.game;if(g?.phase!=='collect'||g.canCollect!==true||g.turn!==d.me||d.auto[d.me]||B.modal||B.pending||e.button!==undefined&&e.button!==0||e.target.closest('button:not([data-bl="collectTrick"]),input,select,#blChatDock'))return;
  const key=g.id+':'+g.round+':'+g.history.length,now=Date.now(),last=B.collectTap;
  if(last?.key===key&&now-last.at<420&&Math.hypot((e.clientX||0)-last.x,(e.clientY||0)-last.y)<38){B.collectTap=null;move({type:'collect'});}else B.collectTap={key,at:now,x:e.clientX||0,y:e.clientY||0};
 }
 function advanceTap(e){
  const g=B.state?.game;if(g?.phase==='collect'){collectTap(e);return;}if(!canAdvance(g)||e.button!==undefined&&e.button!==0||e.target.closest('button:not([data-bl="advance"]),input,select,summary,.blReviewHistory,#blChatDock')||B.modal&&B.modal!=='result')return;
  const key=advanceKey(),now=Date.now(),last=B.lastTap;
  if(last&&last.key===key&&now-last.at<420&&Math.hypot((e.clientX||0)-last.x,(e.clientY||0)-last.y)<38){B.lastTap=null;sendReady();}else B.lastTap={key,at:now,x:e.clientX||0,y:e.clientY||0};
 }
 function hideChat(){B.chatOpen=false;const dock=$('#blChatDock');if(dock)dock.hidden=true;$('#blGame')?.classList.remove('blChatOpen');}
 function renderChat(){
  if(B.state?.me<0){hideChat();$('#blChatDock')?.remove();document.querySelectorAll('#blGame .blSeatChat').forEach(e=>e.remove());return;}
  let dock=$('#blChatDock');if(!B.chatOpen){if(dock)dock.hidden=true;paintChatBubbles();return;}
  if(!dock){dock=document.createElement('section');dock.id='blChatDock';dock.setAttribute('aria-label','شات الطاولة');dock.innerHTML='<header><div id="blChatTabs"><button class="oChatTab" data-bl="chatTab" data-tab="free">محادثة حرة</button><button class="oChatTab" data-bl="chatTab" data-tab="quick">اختصارات</button></div><button data-bl="chatClose" aria-label="إغلاق الشات">×</button></header><div id="blChatFreeTab"><div id="blChatLog"></div><form id="blChatForm"><input id="blChatInput" maxlength="200" placeholder="اكتب رسالتك..." aria-label="رسالتك" autocomplete="off"><button type="submit" aria-label="إرسال">➤</button></form></div><div id="blChatQuickTab"></div>';frame().append(dock);dock.addEventListener('click',click);dock.querySelector('form').onsubmit=e=>{e.preventDefault();const input=$('#blChatInput'),text=input.value.trim();if(text&&sendRoom({type:'chat',text})){input.value='';hideChat();}};
   $('#blChatQuickTab').innerHTML=(typeof QUICK_PHRASES!=='undefined'?QUICK_PHRASES:[]).map(p=>'<button class="qpBtn" data-bl="quickChat" data-phrase="'+E(p.v)+'">'+E(p.t)+'</button>').join('');
  }
  dock.hidden=false;$('#blGame')?.classList.add('blChatOpen');$('#blChatFreeTab').hidden=B.chatTab!=='free';$('#blChatQuickTab').hidden=B.chatTab!=='quick';dock.querySelectorAll('.oChatTab').forEach(b=>b.classList.toggle('on',b.dataset.tab===B.chatTab));
  const log=$('#blChatLog'),near=log.scrollHeight-log.scrollTop-log.clientHeight<40,rows=B.state?.chat||[],key=JSON.stringify(rows);if(log.dataset.key!==key){log.dataset.key=key;log.innerHTML=rows.map(m=>'<div class="oChatMsgRow"><span class="oChatMsgAva">'+avatar(m)+'</span><div class="oChatMsgBody"><div class="oChatMsgName">'+E(m.name)+(m.uid===user()?.uid?' (أنت)':'')+'</div><span class="oChatMsgText">'+E(m.text)+'</span></div>'+(m.uid!==user()?.uid?'<button class="blReport" data-bl="chatReport" data-message="'+E(m.id||String(m.at)+m.uid)+'" aria-label="إبلاغ عن الرسالة">🚩</button>':'')+'</div>').join('')||'<p class="blChatEmpty">لا رسائل بعد</p>';if(near)log.scrollTop=log.scrollHeight;}
  paintChatBubbles();
 }
 function paintChatBubbles(){
  const d=B.state;if(!d)return;for(let seat=0;seat<4;seat++){const el=$('#blGame .blSeat[data-seat="'+seat+'"]');if(!el)continue;let bubble=el.querySelector('.blSeatChat');const msg=(d.me<0?[]:d.chat||[]).filter(m=>m.uid===d.seats[seat]?.uid&&Date.now()+B.offset-m.at<4000).at(-1);if(!msg||B.chatOpen){bubble?.remove();continue;}if(!bubble){bubble=document.createElement('div');bubble.className='blSeatChat';el.append(bubble);}bubble.textContent=msg.text;}
 }
 async function click(event){
  const b=event.target.closest('[data-bl]');if(!b||b.disabled)return;event.preventDefault();sound('click');const a=b.dataset.bl,g=B.state?.game;if(B.state?.me<0&&['chat','chatTab','quickChat','projects','claim','claimReason','declareSave','revealSave','sawa','kasho'].includes(a))return;
  if(a==='pickerClose'){if(!B.firstChoice)closePicker();}
  else if(a==='close'){closeModal();flushPreparedProjects();flushPreselect();}
  else if(a==='profile')openProfile();
  else if(a==='sessionsTab'){B.sessionsTab=b.dataset.tab;sessions();}
  else if(a==='invitePlayers')invitePlayers(b.dataset.tab||'online');
  else if(a==='invitePlayer'){const p=B.inviteRows?.find(p=>p.uid===b.dataset.uid);if(!p||B.inviteTab!=='friends'||!lobbyInviteAvailable()||typeof FR==='undefined'||!FR.list().some(f=>f.uid===p.uid))return;b.disabled=true;try{await sendFriendInvite(p.uid,p.name);}catch(_){toast('تعذّر إرسال الدعوة؛ حاول مجددًا');}finally{b.disabled=false;if(B.modal==='invites')paintInvites();}}
  else if(a==='publicJoin')await joinPublicInvitation(b);
  else if(a==='publicInvite')await sendPublicInvite();
  else if(a==='acceptInvite')answerInvite(true);
  else if(a==='declineInvite')answerInvite(false);
  else if(a==='profileRetry'){loadProfile(true);profileView();}
  else if(a==='loadRetry'){const retry=B.loading?.retry;retry?.();}
  else if(a==='loadBack'){const kind=B.loading?.kind;endLoad();if(kind==='room'||kind==='leave')leaveLocal();else{closeLink('hub');closeModal();}}
  else if(a==='queueCancel')stopQueue();
  else if(a==='queueRetry'){closeLink('hub');queueView();connect('hub','/baloot/hub').catch(()=>queueView());}
  else if(a==='reconnect'){const r=B.state?.room;if(r){closeLink('room');join(r,B.state.me<0);}}else if(a==='selector')selector();else if(a==='select')select(b.dataset.game);
  else if(a==='sessions')openSessionsWithAd();
  else if(a==='createDialog')modal('طاولة ودية','<p>اختر ظهور الطاولة. يمكنك مشاركة رمز الدعوة في الحالتين.</p><div class="blInline">'+btn('للأصدقاء بالرمز','create','','data-public="0"')+btn('طاولة عامة','create','blPrimary','data-public="1"')+'</div>','create');
  else if(a==='create'){const m={type:'create',public:b.dataset.public==='1'};await enterWithAd('create',async()=>{beginLoad('create','نجهّز طاولتك…',()=>sendHub(m));return !!(await sendHub(m));});}
  else if(a==='joinDialog')modal('دخول طاولة صكة','<div class="blInline"><input id="blJoinCode" placeholder="رمز الجلسة" maxlength="8" dir="ltr" autocomplete="off" aria-label="رمز الجلسة">'+btn('دخول','joinCode','blPrimary')+'</div>','join');
  else if(a==='joinCode')join($('#blJoinCode').value);else if(a==='join')join(b.dataset.room,b.dataset.spectate==='1');
  else if(a==='resume'){const r=readResume();if(r)join(r.id,r.spectate===true);else{B.resumeRequested=true;sendHub({type:'resume'});}}
  else if(a==='competitive')enterWithAd('quick',openQueue);
  else if(a==='board'){B.board=b.dataset.period||'all';requestView('board');}
  else if(a==='ranks')ranksDialog();
  else if(a==='rules')rules();else if(a==='mute'){B.muted=!B.muted;localStorage.setItem('mj-baloot-muted',B.muted?'1':'0');window.BalootAudio?.muted(B.muted);if(typeof muted!=='undefined')muted=B.muted;if(B.muted&&typeof _voiceCache!=='undefined')Object.values(_voiceCache).forEach(a=>{a.pause();a.currentTime=0;});if(typeof uiSoundButtons==='function')uiSoundButtons();if(!B.muted)window.BalootAudio?.unlock();render();}
  else if(a==='kasho'){if(g?.canKasho&&g.phase==='bid')move({type:'kasho'});}
  else if(a==='collectTrick'){if(event.detail===0)collectTap(event);}
  else if(a==='bot')sendRoom({type:'bot',seat:+b.dataset.seat,remove:b.dataset.remove==='1'});
  else if(a==='chooseSeat')sendRoom({type:'chooseSeat',seat:+b.dataset.seat});
  else if(a==='seatReply')sendRoom({type:'seatReply',id:b.dataset.id,accepted:b.dataset.accept==='1'});
  else if(a==='rematchLobby')sendRoom({type:'rematchLobby',match:g?.id||B.state.rematch?.id});
  else if(a==='rematchReady')sendRoom({type:'rematchReady',match:B.state.rematch?.id,revision:B.state.rematch?.revision,ready:!B.state.rematch?.ready.includes(B.state.me)});
  else if(a==='start')sendRoom({type:'start'});
  else if(a==='takeControl'){if(B.restoring)return;if(sendRoom({type:'takeControl'})){B.restoring=true;b.disabled=true;b.textContent='جارٍ الاستعادة…';B.restoreTimer=setTimeout(()=>{B.restoring=false;render();},8000);}}
  else if(a==='leave'){if(B.state?.me<0){requestLeave();}else if(active())modal('مغادرة الطاولة','<p>سيكمل الكمبيوتر مكانك.'+(B.state.mode==='competitive'?' لديك ٦٠ ثانية لاستعادة التحكم؛ بعدها يُخصم ٥٠ نقطة مع حماية رتبتك ويتوقف البحث ١٠ دقائق.':' يمكنك العودة إلى مقعدك عند الاتصال مجددًا.')+'</p><div class="blInline">'+btn('البقاء','close','blPrimary')+btn('مغادرة','leaveConfirm')+'</div>','leave');else requestLeave();}
  else if(a==='leaveConfirm')requestLeave();else if(a==='leaveLocal')leaveLocal();
  else if(a==='copyCode'){try{await navigator.clipboard.writeText(B.state.room);toast('نُسخ الرمز')}catch(_){toast('رمز الجلسة: '+B.state.room)}}
  else if(a==='share'){const text='تعال نلعب صكة، رمز الطاولة: '+B.state.room;try{if(navigator.share)await navigator.share({title:'طاولة صكة',text});else{await navigator.clipboard.writeText(text);toast('نُسخت الدعوة')}}catch(_){}}
  else if(a==='bid')move({type:'bid',kind:b.dataset.kind,...(B.state?.game?.sunResponse?{responseId:B.state.game.sunResponse.id}:{})});
  else if(a==='trump'){closeModal();move({type:'trump',trump:b.dataset.suit});}
  else if(a==='double'){if(b.dataset.raise==='1'&&g.contract.mode==='hokum'&&[1,3].includes(g.contract.multiplier))modal((g.contract.multiplier===3?'فور':'دبل')+' · اختر نوع اللعب','<p class="blNote">اختر مفتوح أو مقفل لهذه المزايدة. الثري والقهوة مفتوحان دون اختيار.</p><div class="blInline">'+btn('مقفل','doubleChoice','','data-closed="1"')+btn('مفتوح','doubleChoice','blPrimary','data-closed="0"')+'</div>','double');else move({type:'double',raise:b.dataset.raise==='1',closed:false});}
  else if(a==='doubleChoice'){closeModal();move({type:'double',raise:true,closed:b.dataset.closed==='1'});}
  else if(a==='card'){
   if(Date.now()<(B.ignoreCardClick||0))return;const rect=b.getBoundingClientRect();B.cardOrigin={card:b.dataset.card,left:rect.left,top:rect.top,width:rect.width,height:rect.height,at:Date.now()};selectCard(b.dataset.card);
  }
  else if(a==='akka'){if(canPrepareAkka(g,B.state.me)){if(naturalAkka(g,B.preselect?.card)){B.preselect.akka=false;toast('الأكة مؤككة تلقائيًا؛ لا يحتاج خويك للحكم إذا لم يملك النوع وكانت الأكلة لكم');}else if(B.preselect)B.preselect.akka=!B.preselect.akka;else B.akka=!B.akka;paintPreselect();}}
  else if(a==='sawa'){if(canRequestSawa(g)&&!B.modal){B.preselect=null;B.akka=false;if(move({type:'sawa'}))b.disabled=true;paintPreselect();}}
  else if(a==='sawaConfirm'){closeModal();if(canRequestSawa(g))move({type:'sawa'});}
  else if(a==='sawaAccept'){if(g?.phase==='sawa'&&!verifiedSawa(g))move({type:'sawaReply',accept:true});}
  else if(a==='sawaChallenge'){if(g?.phase==='sawa'&&!verifiedSawa(g))move({type:'sawaReply',accept:false});}
  else if(a==='sawaJudge')move({type:'judge'});
  else if(a==='claim'&&g&&!B.state.auto[B.state.me]&&(['play','collect','review'].includes(g.phase)||verifiedSawa(g)))modal('سبب القيد','<p class="blNote">اختر السبب بعد التأكد. كشف الورق يلزم إكمال الطلب خلال دقيقة.</p><div class="blChoices">'+Object.entries(C).filter(([k])=>k!=='sawa'&&(g.contract.mode==='hokum'||['cut','project'].includes(k))).map(([k,n])=>btn(n,'claimReason','','data-kind="'+k+'"')).join('')+'</div>','claimReason');
  else if(a==='claimReason'&&g&&!B.state.auto[B.state.me]&&(['play','collect','review'].includes(g.phase)||verifiedSawa(g))){B.first=null;B.second=null;B.slot='first';closeModal();move({type:'claim',reason:b.dataset.kind});}
  else if(a==='slot'){B.slot=b.dataset.slot;renderClaim();}
  else if(a==='evidence'){const slot=B.slot,id=b.dataset.card;B[slot]=id;if(B.first===B.second)B[slot==='first'?'second':'first']=null;if(slot==='first')B.slot='second';B.evidencePending=sendRoom({type:'claimEvidence',match:g.id,round:g.round,startedAt:g.claim.startedAt,slot,card:id});renderClaim();}
  else if(a==='judge')move({type:'judge',first:B.first,second:B.second});else if(a==='judgeProject')move({type:'judge',target:+b.dataset.seat});
  else if(a==='projects')projectsDialog();else if(a==='declareAdd')return;
  else if(a==='declareClear'){B.projectItems=[];revealDialog();}else if(a==='declareSave'){B.projectDraft={match:g.id,round:g.round,items:structuredClone(B.projectItems),sent:false};closeModal();flushPreparedProjects();if(!B.projectDraft?.sent)toast('مشاريعك جاهزة؛ تُعلن عند بدء دورك');render();}
  else if(a==='projectCard'){const c=b.dataset.card;B.projectCards=B.projectCards.includes(c)?B.projectCards.filter(x=>x!==c):B.projectCards.concat(c);revealDialog();}
  else if(a==='projectType'){B.projectType=b.dataset.type;revealDialog();}
  else if(a==='projectAdd'){if(B.projectItems.length>=4){toast('الحد الأقصى أربعة مشاريع');return;}if(B.projectCards.length<3||B.projectCards.length>5){toast('حدد 3 إلى 5 أوراق للمشروع');return;}B.projectItems.push({type:B.projectType,cards:B.projectCards.slice()});B.projectCards=[];revealDialog();}
  else if(a==='projectRemove'){B.projectItems.splice(+b.dataset.index,1);revealDialog();}else if(a==='revealSave'){closeModal();move({type:'reveal',items:B.projectItems});}
  else if(a==='chat'){B.chatOpen=!B.chatOpen;renderChat();}
  else if(a==='chatTab'){B.chatTab=b.dataset.tab;renderChat();}
  else if(a==='chatClose')hideChat();
  else if(a==='quickChat'){if(sendRoom({type:'chat',phraseId:b.dataset.phrase}))hideChat();}
  else if(a==='chatReport'){const m=B.state.chat.find(m=>(m.id||String(m.at)+m.uid)===b.dataset.message);if(m&&typeof reportChatMessage==='function')reportChatMessage(m.uid,m.name,m.text);}
  else if(a==='advance'&&event.detail===0)sendReady();

 }
 async function enterWithAd(kind,work){
  if(B.adBusy||window.MajabeedEntryGate?.busy||active()||B.queue||!user())return false;
  if(kind==='quick'&&B.queueBlockedUntil>Date.now()){openQueue();return false;}
  const uid=user().uid,game=B.selected;B.adBusy=true;
  const controls=[...document.querySelectorAll('[data-bl="competitive"],[data-bl="sessions"],[data-bl="create"],#hSessions')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>{el.disabled=true;el.setAttribute('aria-busy','true');});
  try{
   return await window.MajabeedEntryGate.run(work,{isCurrent:()=>user()?.uid===uid&&B.selected===game&&!active()&&!B.queue&&!(kind==='quick'&&B.queueBlockedUntil>Date.now())});
  }finally{B.adBusy=false;controls.forEach((el,i)=>{el.disabled=disabled[i];el.removeAttribute('aria-busy');});}
 }
 function openSessionsWithAd(){if(B.modal==='sessions'){requestView('sessions');return;}return enterWithAd('sessions',()=>requestView('sessions'));}
 function transitionTo(text,work){
  endLoad('navigation');work();
 }
 function paintOverview(){
  const o=B.overview,search=$('#blSearchingCount'),sessions=$('#blSessionCount');
  if(search)search.textContent=o?o.searching+' يبحثون الآن':'جارٍ تحديث عدد الباحثين…';
  if(sessions)sessions.textContent=o?o.sessions+' جلسة نشطة':'جارٍ تحديث الجلسات…';
 }
 function sessions(rows){
  if(rows)B.sessionRows=rows;if(!B.sessionsTab)B.sessionsTab='join';
  const panel=$('#sessionsModal');panel.classList.add('blSessions');panel.classList.remove('hidden');B.modal='sessions';$('#blModal')?.setAttribute('hidden','');
  const list=$('#sessionsList');$('#sessionsEmpty').classList.add('hidden');
  const all=B.sessionRows,filtered=all?.filter(r=>B.sessionsTab==='watch'||r.openSeats?.length>0||r.status==='lobby'&&(r.players?r.players.some(p=>!p||p.bot):r.seats<4));
  const team=(r,t)=>'<div class="blSessionTeam" data-team="'+t+'"><header><span>الفريق '+(t+1)+'</span><b>'+Math.max(0,Number(r.scores?.[t])||0)+'</b></header>'+[t,t+2].map(i=>{const p=r.players?.[i];return '<div class="blSessionPlayer">'+(p?avatar(p):'<span class="blEmptySeat">+</span>')+'<span>'+E(p?.name||'مقعد متاح')+'</span></div>';}).join('')+'</div>';
  list.innerHTML='<div class="blSessionTools">'+btn('أنشئ طاولة','createDialog')+btn('دخول برمز','joinDialog')+btn('تحديث','sessions')+'</div><div class="blSessionTabs" role="tablist">'+['join','watch'].map(k=>'<button role="tab" aria-selected="'+(B.sessionsTab===k)+'" data-bl="sessionsTab" data-tab="'+k+'">'+(k==='join'?'جلسات':'مشاهدة')+'</button>').join('')+'</div>'+(filtered?filtered.length?filtered.map(r=>'<article class="sessCard blSessionCard"><header><b>'+E(r.name)+'</b><small>'+(r.status==='playing'?'يلعبون الآن':'بانتظار البداية')+'</small></header><div class="blSessionTeams">'+team(r,0)+'<span class="blVersus">ضد</span>'+team(r,1)+'</div><button class="'+(B.sessionsTab==='watch'?'sessSpecBtn':'sessJoinBtn')+'" data-bl="join" data-room="'+E(r.id)+'" data-spectate="'+(B.sessionsTab==='watch'?1:0)+'">'+(B.sessionsTab==='watch'?'مشاهدة المباراة':'انضم للطاولة')+'</button></article>').join(''):'<p class="blSessionEmpty">'+(B.sessionsTab==='watch'?'لا توجد جلسات للمشاهدة الآن':'لا توجد طاولات بمقاعد متاحة الآن')+'</p>':loadingHTML('نجهّز جلسات صكة…'));
 }
 function selectCard(id,confirmedDrop=false){
  const g=B.state?.game;if(!g||!['play','collect'].includes(g.phase)||B.pending||B.playVisual||B.state.me<0||!g.myHand.includes(id))return;
  if(B.state.auto[B.state.me])return;hideChat();
  const q=B.preselect;
  if(!confirmedDrop&&(!q||q.card!==id||q.match!==g.id||q.round!==g.round)){B.preselect={match:g.id,round:g.round,card:id,akka:B.akka&&canArmAkka(g,B.state.me),confirmed:false};B.akka=false;paintPreselect();return;}
  if(!confirmedDrop&&q.confirmed&&!(g.turn===B.state.me&&(g.phase==='play'||g.phase==='collect'&&g.canCollect))){B.preselect=null;paintPreselect();return;}
  queueOrPlay(id);
 }
 function paintDrag(d){if(!d.ghost)return;d.ghost.style.transform='translate3d('+(d.x-d.grabX)+'px,'+(d.y-d.grabY)+'px,0) rotate('+(d.geometry?.angle||0)+'deg)';}
 function cancelDrag(returnCard=false,keepGhost=false){
  const d=B.drag;if(!d)return;B.drag=null;if(d.frame)cancelAnimationFrame(d.frame);
  const finish=()=>{if(!keepGhost){d.ghost?.remove();d.button.style.visibility='';}};
  if(returnCard===true&&d.ghost&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const a=d.ghost.animate([{transform:d.ghost.style.transform},{transform:'translate3d('+d.rect.left+'px,'+d.rect.top+'px,0) rotate('+(d.geometry?.angle||0)+'deg)'}],{duration:100,easing:'ease-out'});a.onfinish=finish;a.oncancel=finish;}else finish();
  $('#blGame')?.classList.remove('blDragging');try{d.button.releasePointerCapture(d.pointer);}catch(_){}
  if(d.moved)B.ignoreCardClick=Date.now()+250;
  if(B.renderAfterDrag){B.renderAfterDrag=false;queueMicrotask(()=>{if(B.state)render();});}
 }
 function installCardDrag(root){
  root.addEventListener('pointerdown',e=>{const button=e.target.closest('.blHand [data-bl="card"]'),g=B.state?.game;if(!button||e.button!==0||!e.isPrimary||B.drag||B.pending||B.playVisual||B.modal||B.state.me<0||B.state.auto[B.state.me]||!['play','collect'].includes(g?.phase))return;
   const geometry=cardGeometry(button),bounds=button.getBoundingClientRect(),rect=geometry?{left:geometry.x-geometry.w/2,top:geometry.y-geometry.h/2,width:geometry.w,height:geometry.h}:bounds;B.drag={pointer:e.pointerId,card:button.dataset.card,button,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,grabX:e.clientX-rect.left,grabY:e.clientY-rect.top,rect,geometry,match:g.id,round:g.round,turn:g.turn};button.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove',e=>{const d=B.drag;if(!d||d.pointer!==e.pointerId)return;d.x=e.clientX;d.y=e.clientY;if(!d.moved&&Math.hypot(d.x-d.startX,d.y-d.startY)<5)return;
   if(!d.moved){d.moved=true;d.ghost=d.button.querySelector('img').cloneNode();d.ghost.className='blDragCard blCardFace';d.ghost.style.width=d.rect.width+'px';d.ghost.style.height=d.rect.height+'px';paintDrag(d);document.body.append(d.ghost);d.button.style.visibility='hidden';root.classList.add('blDragging');}
   e.preventDefault();if(!d.frame)d.frame=requestAnimationFrame(()=>{d.frame=0;if(B.drag===d)paintDrag(d);});
  },{passive:false});
  root.addEventListener('pointerup',e=>{const d=B.drag;if(!d||d.pointer!==e.pointerId)return;const g=B.state?.game,zone=root.querySelector('.blTable')?.getBoundingClientRect();d.x=e.clientX;d.y=e.clientY;
   const valid=d.moved&&zone&&e.clientX>=zone.left-15&&e.clientX<=zone.right+15&&e.clientY>=zone.top-15&&e.clientY<=zone.bottom+25&&g?.id===d.match&&g.round===d.round&&g.turn===d.turn&&['play','collect'].includes(g.phase)&&!B.state.auto[B.state.me];
   if(valid){paintDrag(d);sound('click');B.cardOrigin={card:d.card,geometry:{x:d.x-d.grabX+d.rect.width/2,y:d.y-d.grabY+d.rect.height/2,w:d.rect.width,h:d.rect.height,angle:d.geometry?.angle||0},ghost:d.ghost,at:Date.now()};selectCard(d.card,true);}cancelDrag(!valid,!!d.ghost&&B.playVisual?.ghost===d.ghost);
  });
  root.addEventListener('pointercancel',()=>cancelDrag(true));root.addEventListener('lostpointercapture',()=>{if(B.drag)cancelDrag(true);});
 }
 function lobbyInviteAvailable(){return B.state?.mode==='friendly'&&B.state.me>=0&&!B.state.rematch?.startAt&&(!B.state.game||B.state.game.phase==='matchEnd'&&!B.state.game.claimReviewUntil)&&B.state.seats.some(p=>!p||p.bot);}
 function lobbyInvitations(){
  if(B.state?.mode!=='friendly'||B.state.me<0)return '';
  if(!lobbyInviteAvailable())return '<p class="blInviteUnavailable">'+(B.state.rematch?.startAt?'اكتمل الاستعداد · نبدأ الصكة قريبًا':'المقاعد مكتملة · تُتاح الدعوات عند توفر مقعد')+'</p>';
  return '<section class="blLobbyInvites" aria-label="ادعُ ربعك"><b>ادعُ ربعك</b><div class="blInviteMain">'+btn('دعوة في عام صكة','publicInvite')+btn('أصدقائي المتصلون','invitePlayers','blPrimary','data-tab="friends"')+'</div></section>';
 }
 function paintPublicInviteButtons(){
  const room=B.state?.room,pending=!!B.publicInvitePending&&B.publicInvitePending.room===room,ack=!!B.publicInviteAck&&B.publicInviteAck.room===room&&B.publicInviteAck.uid===user()?.uid&&B.publicInviteAck.until>Date.now();
  document.querySelectorAll('[data-bl="publicInvite"]').forEach(b=>{b.disabled=!!pending||!!ack||!lobbyInviteAvailable();b.textContent=pending?'جارٍ الإرسال…':ack?'أُرسلت في العام ✓':'دعوة في عام صكة';});
 }
 function finishPublicInvite(ok){
  const request=B.publicInvitePending;clearTimeout(B.publicInviteTimer);B.publicInvitePending=null;
  if(ok&&request?.uid===user()?.uid&&request.room===B.state?.room){B.publicInviteAck={room:request.room,uid:request.uid,until:Date.now()+20000};B.publicInviteTimer=setTimeout(paintPublicInviteButtons,20020);}
  paintPublicInviteButtons();
 }
 async function sendPublicInvite(){
  if(!lobbyInviteAvailable()){toast('الدعوة تحتاج طاولة ودية فيها مقعد متاح');return;}
  if(B.publicInvitePending||B.publicInviteAck?.room===B.state.room&&B.publicInviteAck.uid===user()?.uid&&B.publicInviteAck.until>Date.now())return;
  const request={id:crypto.randomUUID(),uid:user()?.uid,room:B.state.room};B.publicInvitePending=request;paintPublicInviteButtons();
  B.publicInviteTimer=setTimeout(()=>{if(B.publicInvitePending!==request)return;finishPublicInvite(false);if(request.uid===user()?.uid&&request.room===B.state?.room)toast('تعذّر تأكيد إرسال الدعوة؛ حاول مجددًا');},10000);
  if(!await sendHub({type:'publicInvite',room:request.room,id:request.id})&&B.publicInvitePending===request){finishPublicInvite(false);if(request.uid===user()?.uid&&request.room===B.state?.room)toast('تعذّر إرسال الدعوة؛ حاول مجددًا');}
 }
 async function invitePlayers(){
  const tab='friends';
  if(!lobbyInviteAvailable()){toast('الدعوة تحتاج طاولة ودية فيها مقعد متاح');return;}
  const request={id:crypto.randomUUID(),uid:user()?.uid,room:B.state.room,tab};B.inviteLookup=request;clearTimeout(B.inviteLookupTimer);B.inviteTab=tab;B.inviteRows=null;B.inviteError='';paintInvites();
  const current=()=>B.inviteLookup===request&&request.uid===user()?.uid&&request.room===B.state?.room&&B.modal==='invites'&&B.inviteTab===tab&&lobbyInviteAvailable();
  const friends=typeof FR!=='undefined'?[...new Map(FR.list().filter(f=>f.uid&&f.uid!==request.uid).map(f=>[f.uid,f])).values()].slice(0,60):[];
  if(!friends.length){B.inviteRows=[];paintInvites();return;}
  let docErrors=0;
  const [live,stored]=await Promise.allSettled([friendRequest('friendsOnline',{uids:friends.map(f=>f.uid)}),Promise.all(friends.map(async f=>{try{const doc=await uiCostDoc('players/'+f.uid),p=doc.exists?doc.data():null;return p?.activeSince&&Date.now()-p.activeSince>=0&&Date.now()-p.activeSince<180000?{uid:f.uid,name:f.name,avatar:p.avatar||f.ava}:null;}catch(_){docErrors++;return null;}}))]);
  if(!current())return;
  const rows=new Map((stored.status==='fulfilled'?stored.value:[]).filter(Boolean).map(p=>[p.uid,p]));
  if(live.status==='fulfilled')for(const p of live.value){const f=friends.find(f=>f.uid===p.uid);if(f)rows.set(p.uid,{uid:p.uid,name:f.name||p.name,avatar:p.avatar||f.ava});}
  B.inviteRows=[...rows.values()];B.inviteError=live.status==='rejected'?'تعذّر تحديث متصلي صكة؛ أعد المحاولة':docErrors?'تعذّر تحديث بعض الأصدقاء؛ أعد المحاولة':'';paintInvites();
 }
 function paintInvites(){
  if(!lobbyInviteAvailable()){if(B.modal==='invites')closeModal();return;}
  const rows=B.inviteRows?.filter(p=>!B.state?.seats.some(s=>s?.uid===p.uid));
  modal('أصدقائي المتصلون','<p class="blNote">ادعُ صديقك إلى طاولة صكة</p>'+(B.inviteError?'<div class="blInviteError" role="status"><p>'+E(B.inviteError)+'</p>'+btn('إعادة المحاولة','invitePlayers','','data-tab="friends"')+'</div>':'')+(rows?rows.length?rows.map(p=>'<div class="blLine">'+avatar(p)+'<b>'+E(p.name)+'</b>'+btn(B.sentInvites?.has(p.uid)?'أُرسلت ✓':'دعوة','invitePlayer','','data-uid="'+E(p.uid)+'" '+(B.sentInvites?.has(p.uid)?'disabled':''))+'</div>').join(''):'<p class="blEmpty">'+(B.inviteError?'لا توجد نتائج مؤكدة حاليًا':'لا يوجد أصدقاء متصلون الآن')+'</p>':loadingHTML('نحدّث أصدقاءك المتصلين…'))+'<div class="blInline">'+btn('دعوة في عام صكة','publicInvite')+'</div>','invites');paintPublicInviteButtons();
 }
 async function sendFriendInvite(uid,name){
  if(!lobbyInviteAvailable())return false;const room=B.state.room,account=user()?.uid;
  let ok=false;try{ok=await WBMsg.sendInvite(uid,room,'baloot');}catch(_){}
  if(B.state?.room!==room||user()?.uid!==account)return false;
  if(ok){B.sentInvites=B.sentInvites||new Set();B.sentInvites.add(uid);toast('أُرسلت الدعوة إلى '+name);WBMsg.watchInviteReply(uid,status=>{if(user()?.uid===account&&B.state?.room===room)toast(name+(status==='accepted'?' قبل الدعوة':' اعتذر عن الدعوة'));});}else toast('تعذّر إرسال الدعوة؛ حاول مجددًا');return ok;
 }
 function offerInvite(invite,via='hub'){
  if(!/^[A-Z0-9]{8}$/.test(invite.room)||B.room||B.queue||typeof ONL!=='undefined'&&ONL.active||typeof MATCH!=='undefined'&&MATCH.on)return;
  const uid=user()?.uid;if(!uid)return;B.invitation={...invite,via,uid};clearTimeout(B.invitationTimer);
  let el=$('#blInviteBar');if(!el){el=document.createElement('aside');el.id='blInviteBar';el.setAttribute('role','alert');el.addEventListener('click',click);frame().append(el);}
  el.hidden=false;el.innerHTML='<div><b>'+E(invite.fromName)+'</b><span>يدعوك إلى طاولة صكة</span></div>'+btn('قبول','acceptInvite','blPrimary')+btn('اعتذار','declineInvite');
  B.invitationTimer=setTimeout(()=>answerInvite(false),Math.max(0,Math.min(20000,(invite.expiresAt||Date.now()+20000)-Date.now())));
 }
 async function answerInvite(accepted){
  const inv=B.invitation;if(!inv)return;clearTimeout(B.invitationTimer);B.invitation=null;$('#blInviteBar').hidden=true;
  if(inv.uid!==user()?.uid)return;if(accepted&&(B.room||B.queue||typeof ONL!=='undefined'&&ONL.active)){toast('غادر جلستك الحالية أولًا');accepted=false;}
  if(inv.via==='hub')sendHub({type:'inviteReply',id:inv.id,accepted});
  else{await WBMsg.replyInvite(inv.fromUid,accepted);await WBMsg.clearInvite(inv.fromUid);if(accepted)join(inv.room);}
 }
 function clearPublicJoin(){clearTimeout(B.publicJoinTimer);B.publicJoin=null;refreshPublicInvitations();}
 function refreshPublicInvitations(){
  const rows=document.querySelectorAll('.blPublicInvitation');
  for(const row of rows){const b=row.querySelector('[data-bl="publicJoin"]'),seconds=Math.max(0,Math.ceil((Number(row.dataset.expires)-Date.now())/1000));
   if(!seconds){row.remove();continue;}
   const pending=B.publicJoin?.id===b.dataset.invite;b.disabled=!!B.publicJoin;b.textContent=pending?'جارٍ التحقق…':b.dataset.label;
   row.querySelector('.blInviteTime').textContent='متبقي '+seconds+' ث';
  }
  if(!document.querySelector('.blPublicInvitation')){clearInterval(B.publicInviteClock);B.publicInviteClock=null;}
 }
 function publicInvitation(m){
  const expires=Number(m.ts)+20000;if(!Number.isFinite(expires)||expires<=Date.now()||!/^[A-Z0-9]{8}$/.test(m.room)||typeof m.id!=='string')return '';
  if(!B.publicInviteClock)B.publicInviteClock=setInterval(refreshPublicInvitations,1000);
  const own=m.uid===user()?.uid,label=own?'افتح الطاولة':'انضم للصكة',ava=avatar({name:m.name,avatar:m.ava});
  return '<article class="blPublicInvitation" data-expires="'+expires+'" aria-label="دعوة إلى صكة"><div class="blInviteTop"><span>دعوة لصكة</span><span aria-hidden="true">♠ ♦ ♣ ♥</span></div><div class="blInviteHost">'+ava+'<div><b>'+E(m.name||'لاعب')+'</b><p>'+(own?'دعوتك للربع':'يدعوك تلعب معه')+'</p></div><span class="blInviteGame">2 ضد 2</span></div><div class="blInviteDetails"><span>طاولة ودية</span><span>رمز الطاولة <b dir="ltr">'+E(m.room)+'</b></span></div>'+btn(label,'publicJoin','blInviteJoin','data-room="'+E(m.room)+'" data-invite="'+E(m.id)+'" data-expires="'+expires+'" data-label="'+label+'"')+'<small class="blInviteTime">متبقي '+Math.max(1,Math.ceil((expires-Date.now())/1000))+' ث</small></article>';
 }
 async function joinPublicInvitation(b){
  if(B.publicJoin)return;
  if(Date.now()>=Number(b.dataset.expires)){refreshPublicInvitations();toast('انتهت الدعوة؛ اطلب دعوة جديدة');return;}
  const room=b.dataset.room;if(!/^[A-Z0-9]{8}$/.test(room)||!b.dataset.invite)return;
  if(B.room&&B.state?.room===room){goHome();$('#blGame').hidden=false;render();return;}
  if(B.room||B.queue||typeof ONL!=='undefined'&&ONL.active||typeof MATCH!=='undefined'&&MATCH.on){toast('أنهِ جلستك أو غادرها قبل الانضمام للدعوة');return;}
  B.publicJoin={id:b.dataset.invite,room,uid:user()?.uid};refreshPublicInvitations();
  B.publicJoinTimer=setTimeout(()=>{clearPublicJoin();toast('تعذّر التحقق من الدعوة؛ حاول مجددًا');},10000);
  if(!await sendHub({type:'publicInviteJoin',id:b.dataset.invite,room}))clearPublicJoin();
 }

 // A viewed player's Sakka record comes from the hub, never the shared Majabeed counters.
 function cancelPublicProfile(){const request=B.publicProfileRequest;B.publicProfileRequest=null;request?.cancel?.();}
 function publicProfileCurrent(request){return B.publicProfileRequest===request&&B.selected==='baloot'&&user()?.uid===request.account&&!document.hidden;}
 async function openBalootPublicProfile(uid){
  cancelPublicProfile();if(typeof uid!=='string'||!uid||uid.length>128||/[\/\x00-\x1f]/.test(uid)||!user())return;
  const request={uid,account:user().uid};B.publicProfileRequest=request;let timer;
  const deadline=new Promise((_,reject)=>{request.cancel=()=>reject(Error('cancelled'));timer=setTimeout(()=>reject(Error('تعذّر تحميل ملف صكة؛ أعد المحاولة')),12000);});
  toast('جارٍ فتح ملف صكة…');
  try{
   const load=async()=>{if(!(await ensureFB())||!publicProfileCurrent(request))throw Error('cancelled');return Promise.all([FB.db.collection('players').doc(uid).get(),friendRequest('publicProfile',{uid})]);};
   const [doc,rows]=await Promise.race([load(),deadline]);if(!publicProfileCurrent(request))return;
   if(!doc?.exists)throw Error('الملف غير متاح');const progress=rows?.[0];
   if(progress?.uid!==uid||progress.game!=='baloot'||['points','played','wins','days'].some(k=>!Number.isSafeInteger(progress[k])||progress[k]<0)||progress.wins>progress.played)throw Error('تعذّر تحميل إحصاءات صكة؛ أعد المحاولة');
   const d=doc.data();B.publicProfileRequest=null;
   viewProfile({name:d.name||'لاعب',ava:d.avatar||'🎭',lv:d.level||1,username:d.username_lc||'',pid:'p-'+uid.slice(0,10),uid,game:'baloot',balootProfile:progress});
  }catch(e){if(publicProfileCurrent(request)&&e.message!=='cancelled')toast(e.message||'تعذّر فتح الملف');}
  finally{clearTimeout(timer);if(B.publicProfileRequest===request)B.publicProfileRequest=null;}
 }

 function socialHooks(){
  const oldListen=WBMsg.listenPublic,oldSend=WBMsg.sendPublic,oldPublicInvite=WBMsg.sendPublicInvite;
  const oldPublicProfile=viewPublicProfile;viewPublicProfile=function(uid){if(B.selected==='baloot')return openBalootPublicProfile(uid);cancelPublicProfile();return oldPublicProfile.apply(this,arguments);};
  const oldViewedProfile=viewProfile;viewProfile=function(){cancelPublicProfile();const result=oldViewedProfile.apply(this,arguments);profileView();return result;};
  WBMsg.listenPublic=function(callback){if(B.selected!=='baloot')return oldListen.call(this,callback);if(this.pubUnsub)this.pubUnsub();this._pubCallback=callback;B.publicCallback=callback;B.publicUid=user()?.uid;this.pubUnsub=()=>{B.publicCallback=null;if(B.hub?.ready)B.hub.ws.send(JSON.stringify({type:'chatUnsubscribe'}));};sendHub({type:'chatSubscribe'});};
  WBMsg.sendPublic=function(text){if(B.selected!=='baloot')return oldSend.call(this,text);sendHub({type:'publicChat',text});};
  WBMsg.sendPublicInvite=function(room,mode){if(B.selected!=='baloot'&&mode!=='baloot')return oldPublicInvite.call(this,room,mode);return sendHub({type:'publicInvite',room});};
  const oldChat=openChat;openChat=function(){oldChat.apply(this,arguments);$('#chTitle').textContent=B.selected==='baloot'?'دردشة صكة':'الدردشة';if(B.selected==='baloot')$('#chMsg').placeholder='اكتب لعام صكة…';};
  const oldBubble=inviteBubble;inviteBubble=function(m){if(m.mode!=='baloot')return oldBubble(m);return publicInvitation(m);};
  $('#chList').addEventListener('click',e=>{if(e.target.closest('.blPublicInvitation'))click(e);});
  const oldInvite=showFbInvite;showFbInvite=function(d){if(d.mode==='baloot')return offerInvite(d,'firebase');if(B.room)return;return oldInvite.apply(this,arguments);};
  const oldSendInvite=fbSendInvite;fbSendInvite=async function(pid,name,uid){if(B.selected!=='baloot')return oldSendInvite.apply(this,arguments);if(!uid){toast('أضف اللاعب إلى أصدقائك أولًا');return;}if(lobbyInviteAvailable())return sendFriendInvite(uid,name);if(B.room||B.queue)return toast('غادر جلستك الحالية أولًا');B.inviteAfterCreate={uid,name,account:user()?.uid};sendHub({type:'create',public:false});};
 }

 function init(){
  const logo=$('#home .hLogo');if(!logo)return;
  const switcher=document.createElement('button');switcher.id='blSelector';switcher.type='button';switcher.dataset.bl='selector';switcher.setAttribute('aria-haspopup','dialog');logo.prepend(switcher);switcher.addEventListener('click',click);

  const rank=document.createElement('span');rank.id='blHomeRank';$('#hName').parentElement.append(rank);
  const hero=document.createElement('div');hero.id='blHomeHero';hero.innerHTML='<div class="blHeroArt" aria-hidden="true">'+img('KH')+img('AS')+img('QD')+'</div><h1>صكة</h1><p>ورقة بذكاء… وجولة مع الربع</p>';logo.append(hero);
  const menu=document.createElement('div');menu.id='blHomeMenu';menu.innerHTML='<button class="blPlayCard" data-bl="competitive"><span class="blPlayTop">تنافسي <i></i> 2 ضد 2</span><strong>العب الآن</strong><span class="blPlayBottom"><span id="blSearchingCount">جارٍ تحديث عدد الباحثين…</span> '+icon('home')+'</span><span class="blPlaySuit" aria-hidden="true">♠</span></button><div class="blMenuSection"><span>على كيفك</span><i></i></div><div class="blTwo"><button class="blCta" data-bl="sessions"><span class="blTileIcon">'+icon('sessions')+'</span><strong>جلسات ودية</strong><small id="blSessionCount">جارٍ تحديث الجلسات…</small></button><button class="blCta" data-bl="createDialog"><span class="blTileIcon">'+icon('friends')+'</span><strong>اجمع ربعك</strong><small>أنشئ طاولة خاصة</small></button></div><div class="blHomeShortcuts"><button data-bl="board">'+icon('board')+'<span>الصدارة</span></button><button data-bl="joinDialog">'+icon('inbox')+'<span>دخول برمز</span></button></div><button id="blResume" class="blBtn blResumeSession" data-bl="resume" hidden>جلستك بانتظارك <span>متابعة اللعب ←</span></button>';$('#home .hMenu').append(menu);menu.addEventListener('click',click);
  const queue=document.createElement('section');queue.id='blQueue';queue.hidden=true;queue.setAttribute('aria-label','البحث عن لاعبي صكة');queue.innerHTML='<div class="blQueueWrap"><header>'+btn('→','queueCancel','','aria-label="إلغاء البحث والرجوع"')+'<h2>البحث عن لاعبين</h2><span>صكة · 2 ضد 2</span></header><div class="blSearchCards" aria-hidden="true"><span class="uiMatchCard">♠</span><span class="uiMatchCard">♦</span><span class="uiMatchCard">♣</span></div><h3 id="blQueueStatus" role="status">نجهّز طاولتك…</h3><p>تبدأ المباراة عند اكتمال أربعة لاعبين</p><div class="blQueueProgress"><b id="blQueueCount"></b><span id="blQueueSteps" aria-hidden="true"></span></div><div id="blQueueSeats"></div><div class="blSearchTime">وقت البحث <b id="blQueueTime" dir="ltr">00:00</b></div><button id="blQueueRetry" class="blBtn" data-bl="queueRetry" hidden>إعادة الاتصال</button>'+btn('إلغاء البحث','queueCancel','blQueueCancel')+'</div>';frame().append(queue);queue.addEventListener('click',click);
  const root=document.createElement('section');root.id='blGame';root.hidden=true;root.setAttribute('aria-label','طاولة صكة');frame().append(root);root.addEventListener('click',e=>{if(!e.target.closest('[data-bl="chat"]'))hideChat();click(e);});root.addEventListener('pointerup',advanceTap);installCardDrag(root);
  new ResizeObserver(()=>{const hand=$('#blGame .blHand');if(hand&&B.state?.game)hand.style.setProperty('--overlap',overlap(B.state.game.myHand.length)+'px');}).observe(root);
  socialHooks();
  const oldDaily=showDailyReward;showDailyReward=function(){if(B.pickerUid||needsChoice()){B.dailyAfterChoice=user()?.uid;return false;}return oldDaily.apply(this,arguments);};
  const releaseDaily=()=>{const uid=B.dailyAfterChoice;if(uid&&!B.pickerUid&&uid===user()?.uid&&!$('#home').classList.contains('hidden')){B.dailyAfterChoice=null;showDailyReward();}};
  // Delay a pending daily reward until the player's first game choice is complete.
  new MutationObserver(releaseDaily).observe(frame(),{attributes:true,attributeFilter:['hidden'],subtree:true});
  const oldHome=goHome;goHome=function(){transitionTo('نجهّز الرئيسية…',()=>{closeModal();oldHome.apply(this,arguments);welcomeChoice();});};
  const oldEnterOnline=enterOnline;enterOnline=function(){if(needsChoice()){goHome();return;}rememberGame('majabeed');home();return oldEnterOnline.apply(this,arguments);};
  const oldSessionsRender=renderSessionsList;renderSessionsList=function(){if(B.selected==='baloot'){if(B.modal==='sessions')sessions();return;}return oldSessionsRender.apply(this,arguments);};
  const oldSessionsClose=$('#sessionsClose').onclick;$('#sessionsClose').onclick=function(){if(B.modal==='sessions')closeModal();else oldSessionsClose?.call(this);};
  $('#sessionsList').addEventListener('click',e=>{if(B.selected==='baloot')click(e);});
  $('#sessionsModal').addEventListener('keydown',e=>{if(e.key==='Escape'&&B.modal==='sessions')closeModal();});
  const oldRefresh=refreshHome;refreshHome=function(){const r=oldRefresh.apply(this,arguments);home();if(B.selected==='baloot')loadProfile();return r;};
  const oldProfile=openProfile;openProfile=function(){cancelPublicProfile();oldProfile.apply(this,arguments);profileView();if(B.selected==='baloot')loadProfile();};
  const oldBoard=openBoard;openBoard=function(){if(B.selected==='baloot'){B.board='all';requestView('board');return;}return oldBoard.apply(this,arguments);};
  const originalRules=$('#hRules').onclick;$('#hRules').onclick=function(){if(B.selected==='baloot')rules();else originalRules?.call(this);};
  $('#hSessions').addEventListener('click',e=>{if(B.selected==='baloot'){e.preventDefault();e.stopImmediatePropagation();openSessionsWithAd();}},true);

  function installNavigationHooks(){if(B.shellHooks||typeof uiNavRoute!=='function')return;B.shellHooks=true;
   const oldRoute=uiNavRoute;uiNavRoute=function(id,overlay){if(!overlay)cancelPublicProfile();oldRoute.apply(this,arguments);accountChoice(user()?.uid||null);if(id==='home'){home();welcomeChoice();}else closePicker(false);if(id==='profile')profileView();if(id!=='chat'&&B.publicCallback){WBMsg.pubUnsub?.();WBMsg.pubUnsub=null;}};
   if(typeof uiNavOpenMore==='function'){const oldMore=uiNavOpenMore;uiNavOpenMore=function(){oldMore.apply(this,arguments);const label=$('#uiMoreMenu header small');if(label)label.textContent=B.selected==='baloot'?'صكة · مجابيد':'مجابيد';};}
   B.navMode=null;syncNavigation();
  }
  installNavigationHooks();document.addEventListener('DOMContentLoaded',installNavigationHooks,{once:true});
  if(typeof lgAutoAllowed==='function'){const oldAllowed=lgAutoAllowed;lgAutoAllowed=function(){return B.selected!=='baloot'&&oldAllowed.apply(this,arguments);};}
  if(typeof uiLeagueProfile==='function'){const oldLeagueProfile=uiLeagueProfile;uiLeagueProfile=function(){if(B.selected==='baloot')return;return oldLeagueProfile.apply(this,arguments);};}
  if(typeof lgOpen==='function'){const oldLeagueOpen=lgOpen;lgOpen=function(){if(B.selected==='baloot')return;return oldLeagueOpen.apply(this,arguments);};}
  document.addEventListener('visibilitychange',()=>document.hidden?background():foreground());
  document.addEventListener('pause',background);document.addEventListener('resume',foreground);
  window.addEventListener('online',()=>{foreground();if(B.queue&&!B.hub?.ready){closeLink('hub');connect('hub','/baloot/hub').catch(()=>queueView());}});
  window.addEventListener('offline',()=>{clearCardMotion();B.preselect=null;B.akka=false;paintPreselect();if(B.loading)loadError('أنت غير متصل بالإنترنت');connection();});
  window.addEventListener('pagehide',()=>{background();closeLink('hub');closeLink('room');clearInterval(B.clock);B.clock=null;});
  window.addEventListener('pageshow',foreground);
  home();if(B.selected==='baloot')loadProfile();window.MajabeedBaloot={state:B,select,join,receive,render,close:leaveLocal,needsChoice,routeFor,friendActivity,watchFriend};
 }
 init();
})();
