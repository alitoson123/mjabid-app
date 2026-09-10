/* v320 presentation: reads existing rewards; never grants gold, XP or rank. */
'use strict';
const UI_RESULT={online:null,local:null};
const UI_SHOP={tab:'themes',preview:null,busy:false};
let uiArtSerial=0;
function uiGoldCoin(){return '<img class="uiGoldCoin" src="ui-art/gold-coin.svg" alt="" aria-hidden="true" width="32" height="32">';}
function uiShopIcon(kind){
  const paths={themes:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="m12 7 3 5-3 5-3-5 3-5Z"/>',gold:'<ellipse cx="12" cy="7" rx="8" ry="4"/><path d="M4 7v5c0 2 4 4 8 4s8-2 8-4V7M4 12v5c0 2 4 4 8 4s8-2 8-4v-5"/>'};
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+paths[kind]+'</svg>';
}
function uiGoldArt(size){
  const id='uiGold'+(++uiArtSerial),n=Math.max(0,Math.min(4,size));
  const coin=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="3" rx="14" ry="7" fill="#9b5717"/><ellipse rx="14" ry="7" fill="url(#${id})" stroke="#ffe2a0"/><ellipse rx="9" ry="4" fill="none" stroke="#b87b26"/><path d="m-2-3 4 3-4 3-3-3Z" fill="#c28b32"/></g>`;
  const stack=(x,y,h)=>Array.from({length:h},(_,i)=>coin(x,y-i*5)).join('');
  let shape=stack(56,76,2)+coin(80,80,.8);
  if(n===1)shape=stack(39,78,4)+stack(69,80,6)+coin(88,83,.8);
  if(n===2)shape='<path d="m43 28 10 9-15 26Q28 91 61 91t24-28L69 37l10-9-10-5-8 5-8-5Z" fill="#b98132" stroke="#edc572" stroke-width="2"/><path d="M50 39h22M47 45q14 5 28 0" stroke="#624923" stroke-width="4"/><path d="m61 53 12 16-12 14-12-14Z" fill="#f3d28b"/>'+stack(29,85,3)+coin(83,88);
  if(n>=3)shape='<path d="M24 51V35q38-22 76 0v19" fill="#714428" stroke="#d4a252" stroke-width="3"/><path d="M24 34q38-17 76 0M39 28v26m45-26v26" fill="none" stroke="#e2b568" stroke-width="4"/>'+stack(41,57,4)+stack(66,56,n===4?7:4)+stack(89,58,3)+'<path d="M19 56h87l-7 36H25Z" fill="#64462a" stroke="#e1b974" stroke-width="3"/><path d="m32 57 5 35m50-35-5 35M20 63h84" stroke="#bb863c" stroke-width="4"/><rect x="54" y="60" width="17" height="19" rx="3" fill="#f2d48b"/><path d="m62 64 4 6-4 5-4-5Z" fill="#8f6225"/>'+(n===4?coin(20,87)+coin(105,87,.8)+coin(86,99,.7):'');
  return `<svg class="uiGoldArt" viewBox="0 0 124 110" aria-hidden="true"><defs><linearGradient id="${id}" x2=".6" y2="1"><stop stop-color="#fff1b7"/><stop offset=".5" stop-color="#efc563"/><stop offset="1" stop-color="#bd7b22"/></linearGradient></defs><ellipse cx="62" cy="96" rx="48" ry="8" fill="#000" opacity=".1"/>${shape}<path d="m99 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#d6a450" opacity="${n?1:.4}"/></svg>`;
}
function uiResultArt(kind){
  const friendly=kind==='friendly';
  return '<svg viewBox="0 0 160 120" aria-hidden="true"><circle cx="80" cy="61" r="48" fill="none" stroke="currentColor" opacity=".25"/><circle cx="80" cy="61" r="41" fill="none" stroke="currentColor" opacity=".12"/><g fill="none" stroke="currentColor" stroke-width="2"><path d="M35 89q-22-18-11-41m101 41q22-18 11-41M29 78l-10-2m8-8-10-4m12-5-9-6m111 25 10-2m-8-8 10-4m-12-5 9-6"/></g><g fill="#fff1d3" stroke="#d2af6e" stroke-width="1.5"><rect x="48" y="25" width="43" height="65" rx="6" transform="rotate(-17 70 60)"/><rect x="69" y="25" width="43" height="65" rx="6" transform="rotate(15 90 60)"/></g><path d="m88 43 12 18-12 18-12-18Z" fill="#285442"/><path d="M62 40c-5-9-14-1-6 7l6 6 6-6c8-8-1-16-6-7Z" fill="#ad694b"/>'+(friendly?'<path d="M62 96q18 12 36-1" fill="none" stroke="currentColor" stroke-width="2"/>':'<path d="m59 89 7-13 14 9 14-9 7 13-4 16H63Z" fill="#eac77f" stroke="#cba464"/><path d="M66 100h28" stroke="#937239"/>')+'</svg>';
}
function uiRewardSnapshot(){return {gold:ST.n('gold'),xp:ST.n('xp'),rank:ST.n('rank'),level:ST.n('level')||1};}
function uiRewardDelta(value){return (value>0?'+':value<0?'−':'')+toH(Math.abs(value));}
function uiAnimateRewardNumber(el,value,format=toH){
  if(!el||!Number.isFinite(value))return;
  if(el._uiFrame&&el._uiTarget===value)return;
  const from=Number.isFinite(el._uiValue)?el._uiValue:value;
  if(el._uiFrame)cancelAnimationFrame(el._uiFrame);
  el._uiTarget=value;
  const finish=()=>{el._uiValue=value;el.textContent=format(value);el._uiFrame=0;};
  if(from===value||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  const start=performance.now();
  const step=now=>{const p=Math.min(1,(now-start)/850),n=Math.round(from+(value-from)*(1-Math.pow(1-p,3)));el._uiValue=n;el.textContent=format(n);if(p<1)el._uiFrame=requestAnimationFrame(step);else finish();};
  el._uiFrame=requestAnimationFrame(step);
}
function uiShowResultRewards(scope){
  const model=UI_RESULT[scope];if(!model||!model.seated)return;
  const p=scope==='online'?'o':'l';
  for(const [field,label] of [['gold','Gold'],['rank','Rank']]){
    const total=document.getElementById(p+'My'+label+'Num');
    const delta=document.getElementById(p+'My'+label+'Delta');
    if(!total)continue;
    if(scope==='online'&&model.preparing&&!model.revealed)total.textContent=toH(model.current[field]);
    else uiAnimateRewardNumber(total,model.current[field]);
    if(delta){
      const amount=scope==='online'?model.delta[field]:model.current[field]-model.base[field];
      delta.classList.toggle('is-pending',amount===null);delta.classList.toggle('is-negative',amount<0);
      if(amount===null){delta.textContent='بانتظار التأكيد';delta._uiValue=0;}
      else if(scope==='online'&&model.preparing&&!model.revealed)delta.textContent=uiRewardDelta(amount);
      else uiAnimateRewardNumber(delta,amount,uiRewardDelta);
    }
  }
  const fill=document.getElementById(p+'XpFill');if(fill)fill.style.width=((Math.max(0,model.current.xp)%100))+'%';
  const level=document.getElementById(p+'XpLevel');if(level)level.textContent='المستوى '+toH(model.current.level);
  const note=document.getElementById(p+'RewardNote');
  if(note)note.textContent=scope!=='online'?'رصيدك بعد الجولة':model.synced?'تم تأكيد النتيجة · رصيدك الحالي':model.fetching?'جارٍ التحقق من المكافأة…':model.exhausted?'لم يكتمل تأكيد المكافأة بعد. حدّث الرصيد للتحقق.':'بانتظار تأكيد مكافأة الجولة…';
  if(scope==='online')uiResultFeeLine(model);
  const refresh=document.getElementById('oRewardRefresh');
  if(scope==='online'&&refresh){refresh.hidden=model.synced||!model.competitive;refresh.disabled=!!model.fetching;refresh.onclick=()=>pullServerStats(0);}
}
function uiSetupResult(scope,opts){
  const online=scope==='online',p=online?'o':'l',root=document.getElementById(online?'oOver':'results');
  root.dataset.outcome=opts.draw?'draw':opts.won?'win':'loss';
  root.dataset.kind=online&&ONL.league?'league':online&&ONL.tournament?'tournament':opts.competitive?'competitive':online?'friendly':'practice';
  const kind=document.getElementById(p+'ResultKind');
  if(kind)kind.textContent=online&&ONL.league?'مباراة دوري':online&&ONL.tournament?'بطولة التاسعة · نتيجة المباراة':opts.watching?'مشاهدة · نهاية الجولة':opts.competitive?'نتيجة اللعب التنافسي':online?'جمعتكم أحلى · جلسة ودية':'تدريب · نهاية الجولة';
  const art=document.getElementById(p+'ResultArt');if(art)art.innerHTML=uiResultArt(online&&!opts.competitive?'friendly':'competitive');
  const goldIcon=document.querySelector('#'+p+'GoldReward .uiRewardIcon');if(goldIcon)goldIcon.innerHTML=uiGoldCoin();
  const title=document.getElementById(online?'oResTtl':'resTtl');
  title.textContent=opts.watching?'اكتملت الجولة':opts.draw?'تعادل يليق بكم':opts.won?'يا سلام على الفوز!':'نعوّضها الجاية';
  document.getElementById(p+'MyStats').classList.toggle('hidden',!!opts.watching||(online&&!opts.competitive));
  const rank=document.getElementById('oRankReward');if(online&&rank)rank.classList.toggle('hidden',!opts.competitive);
}
function uiBeginOnlineResult(r,seated,key){
  if(UI_RESULT.online&&UI_RESULT.online.key===key){uiReceiveResultReward(ONL.reward);return;}
  uiCancelResultPreparation();
  const base=uiRewardSnapshot();
  const draw=!!r.draw||r.winnerTeam==='draw',won=r.mode==='team'?r.teams?.[r.winnerTeam]?.includes(ONL.you):r.winner===ONL.you;
  UI_RESULT.online={key,seated,uid:FB.user?.uid,rewardKey:ONL.reward?.key||null,base,current:{...base},synced:false,competitive:!ONL.league&&!ONL.tournament&&!!r.tier?.fee,won:!!won&&!draw,
    received:{entry:null,gold:draw||!won||r.tier?.win===0?0:null,rank:draw?0:null},entry:null,payout:null,delta:{gold:null,rank:null},applied:{},revision:0,lastReadRevision:-1,fetching:false,exhausted:false};
  for(const label of ['Gold','Xp','Rank'])for(const suffix of ['Num','Delta']){const el=document.getElementById('oMy'+label+suffix);if(el){if(el._uiFrame)cancelAnimationFrame(el._uiFrame);el._uiFrame=0;el._uiValue=suffix==='Num'?base[label.toLowerCase()]:0;}}
  uiReceiveResultReward(ONL.reward);
  uiShowResultRewards('online');
}
function uiReceiveResultReward(receipt){
  const m=UI_RESULT.online;
  if(!m||!m.seated||!receipt||receipt.key!==m.rewardKey||FB.user?.uid!==m.uid)return;
  let changed=false;
  for(const field of ['entry','gold','rank'])if(Number.isSafeInteger(receipt[field]?.delta)&&(field!=='entry'||receipt[field].delta<=0)&&m.received[field]!==receipt[field].delta){m.received[field]=receipt[field].delta;changed=true;}
  if(changed){m.revision++;m.synced=false;m.exhausted=false;}
}
function uiResultReadToken(){
  const m=UI_RESULT.online;if(!m?.seated||!m.competitive||ONL.status!=='over'||FB.user?.uid!==m.uid)return null;
  m.lastReadRevision=m.revision;m.fetching=true;m.exhausted=false;uiShowResultRewards('online');
  return {key:m.key,uid:m.uid,revision:m.revision};
}
function uiResultNeedsRead(){const m=UI_RESULT.online;return !!(m?.seated&&m.competitive&&ONL.status==='over'&&FB.user?.uid===m.uid&&m.lastReadRevision<m.revision);}
function uiResultReadFinished(token){
  const m=UI_RESULT.online;if(!token||!m||m.key!==token.key||FB.user?.uid!==token.uid)return;
  m.fetching=false;m.exhausted=!m.synced;uiShowResultRewards('online');
}
function uiPresentOnlineResult(r,seated){
  if(UI_RESULT.online&&UI_RESULT.online.presented)return;
  if(UI_RESULT.online)UI_RESULT.online.presented=true;
  const won=r.mode==='team'?r.winnerTeam===r.teams.findIndex(t=>t.includes(ONL.you)):r.winner===ONL.you;
  uiSetupResult('online',{competitive:!ONL.league&&!ONL.tournament&&!!(r.tier&&r.tier.fee),won,draw:r.draw||r.winnerTeam==='draw',watching:!seated});
}
function uiResultLocalXp(){
  const model=UI_RESULT.online;if(!model||!model.seated)return;
  model.current.xp=ST.n('xp');model.current.level=ST.n('level')||1;
  uiShowResultRewards('online');
}
function uiResultServerStats(gold,rank,token){
  const model=UI_RESULT.online;
  if(!model||!model.seated||ONL.status!=='over'||!token||token.key!==model.key||token.uid!==FB.user?.uid||token.revision!==model.revision)return;
  if(!Number.isSafeInteger(gold)||!Number.isSafeInteger(rank))return;
  model.current.gold=gold;model.current.rank=rank;
  model.entry=model.received.entry;model.payout=model.received.gold;
  const netGold=model.entry!==null&&model.payout!==null?model.entry+model.payout:null;
  for(const [field,label] of [['gold','Gold'],['rank','Rank']]){
    const amount=field==='gold'?netGold:model.received[field];if(amount===null)continue;
    model.delta[field]=amount;
    if(!model.applied[field]){
      model.applied[field]=true;
      const total=document.getElementById('oMy'+label+'Num');
      if(total){if(total._uiFrame)cancelAnimationFrame(total._uiFrame);total._uiFrame=0;total._uiValue=Math.max(0,model.current[field]-amount);}
      const box=document.getElementById('o'+label+'Reward');
      if(amount>0&&box){box.classList.remove('is-gaining');void box.offsetWidth;box.classList.add('is-gaining');}
    }
  }
  model.current.xp=ST.n('xp');model.current.level=ST.n('level')||1;
  model.synced=model.delta.gold!==null&&model.delta.rank!==null;
  uiShowResultRewards('online');uiTryRevealOnlineResult();
}
// v332: prepare one complete result off-screen; the only deadline belongs to this visible client.
function uiResultFeeLine(m){
  const line=document.getElementById('oFeeWinLine');if(!line)return;
  const visible=m.competitive&&m.seated;line.classList.toggle('hidden',!visible);if(!visible)return;
  const amount=n=>n===null?'غير مؤكد':uiRewardDelta(n);
  line.innerHTML='<span>رسوم الدخول <bdi>'+amount(m.entry)+'</bdi>'+uiGoldCoin()+'</span>'+(m.won?'<span>الجائزة <bdi>'+amount(m.payout)+'</bdi>'+uiGoldCoin()+'</span>':'');
}
function uiResultIsCurrent(m){return !!(m&&UI_RESULT.online===m&&ONL.status==='over'&&FB.user?.uid===m.uid);}
function uiCancelResultPreparation(){
  const m=UI_RESULT.online;if(!m)return;
  if(m.prepareTimer)clearTimeout(m.prepareTimer);m.prepareTimer=null;
  for(const done of m.assetCleanups||[])done();m.assetCleanups=[];m.preparing=false;
}
function uiPrepareOnlineResult(){
  const m=UI_RESULT.online;if(!m||m.preparing||m.revealed)return;
  m.preparing=true;m.contentReady=false;m.assetCleanups=[];
  const root=document.getElementById('oOver'),loading=document.getElementById('oResultLoading');
  root.dataset.ready='false';root.setAttribute('aria-busy','true');loading.hidden=false;
  document.getElementById('oResultLoadingBack').onclick=()=>document.getElementById('oMenu').click();
  m.prepareTimer=setTimeout(()=>{if(uiResultIsCurrent(m)){m.timedOut=true;uiTryRevealOnlineResult();}},8000);
}
function uiFinishOnlineResultContent(ranksReady){
  const m=UI_RESULT.online;if(!m?.preparing||m.contentStarted)return;m.contentStarted=true;
  Promise.resolve(ranksReady).catch(()=>{}).then(()=>{if(uiResultIsCurrent(m)&&m.preparing){m.rowsReady=true;uiTryRevealOnlineResult();}});
}
function uiWaitResultImages(m){
  m.assetsStarted=true;
  const badge=document.getElementById('oRankBadge_'+ONL.you);if(badge&&m.competitive&&m.synced)badge.innerHTML=rankBadgeHTML(m.current.rank,10);
  const images=Array.from(document.querySelectorAll('#oOver #resCard img'));
  const assets=images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
    const done=()=>{img.removeEventListener('load',done);img.removeEventListener('error',done);resolve();};
    img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});m.assetCleanups.push(done);
  }));
  Promise.allSettled(assets).then(()=>{if(uiResultIsCurrent(m)&&m.preparing){m.contentReady=true;uiTryRevealOnlineResult();}});
}
function uiDeferResultRankToast(from,to){
  const m=UI_RESULT.online;if(!uiResultIsCurrent(m)||!m.preparing||m.revealed)return false;
  m.rankChange={from:m.rankChange?.from??from,to};return true;
}
function uiTryRevealOnlineResult(){
  const m=UI_RESULT.online;if(!uiResultIsCurrent(m)||!m.preparing||m.revealed)return;
  if(!m.timedOut){
    if(!m.rowsReady||(m.seated&&m.competitive&&!m.synced))return;
    if(!m.assetsStarted){uiWaitResultImages(m);return;}
    if(!m.contentReady)return;
  }
  m.revealed=true;
  if(m.timedOut&&!m.synced)m.exhausted=true;
  uiCancelResultPreparation();
  const root=document.getElementById('oOver');root.dataset.ready='true';root.setAttribute('aria-busy','false');root.scrollTop=0;
  document.getElementById('oResultLoading').hidden=true;
  uiShowResultRewards('online');
  if(m.seated&&m.won&&typeof SFX!=='undefined')SFX.win();
  if(m.rankChange)showRankChangeToast(m.rankChange.from,m.rankChange.to);
}
function uiPresentLocalResult(won,draw){
  const base=G._uiRewardBase||uiRewardSnapshot();
  UI_RESULT.local={seated:true,base,current:uiRewardSnapshot(),synced:true};
  for(const label of ['Gold','Xp']){const el=document.getElementById('lMy'+label+'Num');if(el){if(el._uiFrame)cancelAnimationFrame(el._uiFrame);el._uiValue=base[label.toLowerCase()];}}
  uiSetupResult('local',{won,draw,competitive:!!G._tierResult,watching:false});
  uiShowResultRewards('local');
  if(UI_RESULT.local.current.gold>base.gold){const box=document.getElementById('lGoldReward');box.classList.remove('is-gaining');void box.offsetWidth;box.classList.add('is-gaining');}
}

// One catalog and one active theme, including migration of the older local picker.
function uiMigrateThemeChoice(){
  if(localStorage.getItem('wb-theme-catalog-v320'))return;
  const legacy=localStorage.getItem('wb-ui-table'),equipped=localStorage.getItem('wb-eq-theme');
  let next=equipped;
  if(['emerald','midnight','royal'].includes(legacy))next='theme-'+legacy;
  else if(!legacy&&!equipped)next='theme-emerald';
  if(!SHOP_THEMES.some(t=>t.id===next))next='theme-emerald';
  localStorage.setItem('wb-eq-theme',next);
  localStorage.setItem('wb-ui-table','original');
  localStorage.setItem('wb-theme-catalog-v320','1');
}
function uiOpenShop(tab){
  if(!SHOW_STORE)return;
  UI_SHOP.tab=tab==='gold'?'gold':'themes';
  uiMigrateThemeChoice();renderShop();renderAdRewardBtn();show('shop');mountNav('shop','shop');
}
function uiSelectShopTab(tab){
  if(!SHOW_STORE)return;
  UI_SHOP.tab=tab==='gold'?'gold':'themes';uiRenderShop();
}
function uiRenderThemePreview(){
  const theme=SHOP_THEMES.find(t=>t.id===UI_SHOP.preview)||SHOP_THEMES[0];
  const owned=theme.price===0||shopOwned().includes(theme.id),active=shopEquipped('theme')===theme.id;
  const scene=document.getElementById('uiShopScene');
  scene.style.backgroundImage=`linear-gradient(0deg,#071c17aa,transparent 75%),url("${theme.preview||theme.bg}")`;
  scene.innerHTML='<img class="uiPreviewTable" src="'+(theme.table||'bg/table-center.png'+BGV)+'" alt=""><div class="uiPreviewCards" aria-hidden="true"><i>♦</i><i>♣</i><i>♥</i></div><span class="uiSceneBadge">'+(active?'خلفيتك الحالية':owned?'ضمن مجموعتك':'تُشترى بذهب اللعبة')+'</span>';
  document.getElementById('uiShopSceneName').textContent=theme.name;
  document.getElementById('uiShopSceneNote').textContent=theme.price===0?'مجانية · اختر جوّك المفضل':owned?'مملوكة · جاهزة لطاولتك':'تفاصيل من المجلس، على طاولتك';
  const button=document.getElementById('uiShopActivate');
  button.disabled=active||UI_SHOP.busy;
  button.textContent=UI_SHOP.busy?'جارٍ التفعيل…':active?'مُفعّلة ✓':owned?'استخدم الخلفية':'شراء وتفعيل · '+toH(theme.price)+' ذهب';
  button.onclick=()=>uiActivateTheme(theme.id);
}
function uiRenderShop(){
  if(!SHOW_STORE)return;
  uiMigrateThemeChoice();
  const gold=UI_SHOP.tab==='gold',eq=shopEquipped('theme'),owned=shopOwned();
  if(!UI_SHOP.preview)UI_SHOP.preview=eq;
  document.getElementById('shopGold').textContent=toH(ST.n('gold'));
  for(const name of ['themes','gold']){
    const tab=document.getElementById(name==='gold'?'uiGoldTab':'uiThemesTab');
    tab.setAttribute('aria-selected',String(UI_SHOP.tab===name));tab.classList.toggle('active',UI_SHOP.tab===name);
    tab.onclick=()=>uiSelectShopTab(name);
  }
  document.getElementById('uiThemesPanel').classList.toggle('hidden',gold);
  document.getElementById('uiGoldPanel').classList.toggle('hidden',!gold);
  const list=document.getElementById('shopList');list.innerHTML='';
  for(const theme of SHOP_THEMES){
    const isOwned=owned.includes(theme.id)||theme.price===0,isEq=eq===theme.id;
    const card=document.createElement('button');card.type='button';card.className='uiCatalogCard';card.dataset.theme=theme.id;
    card.setAttribute('aria-pressed',String(UI_SHOP.preview===theme.id));
    card.innerHTML='<span class="uiCatalogImage" style="background-image:url(\''+(theme.preview||theme.bg)+'\')"><span class="uiCatalogStatus">'+(isEq?'مُفعّلة':isOwned?(theme.price===0?'مجانية':'مملوكة'):'مميزة')+'</span></span><span class="uiCatalogName">'+esc(theme.name)+'</span><small>'+(isEq?'على طاولتك الآن':isOwned?'معاينة وتفعيل':toH(theme.price)+' ذهب')+'</small>';
    card.onclick=()=>{UI_SHOP.preview=theme.id;uiRenderShop();document.getElementById('uiShopShowcase').scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
    list.appendChild(card);
  }
  uiRenderThemePreview();
  if(gold)renderGoldPackages();
}
async function uiActivateTheme(id){
  if(!SHOW_STORE||UI_SHOP.busy)return;
  const theme=SHOP_THEMES.find(t=>t.id===id);if(!theme)return;
  UI_SHOP.busy=true;uiRenderThemePreview();
  try{
    const owned=shopOwned();
    if(theme.price>0&&!owned.includes(id)){
      if(ST.n('gold')<theme.price){toast2('ذهبك لا يكفي لهذه الخلفية');return;}
      // Keep the existing theme purchase amount and account-saving path.
      ST.set('gold',ST.n('gold')-theme.price);
      owned.push(id);localStorage.setItem('wb-owned',JSON.stringify(owned));
    }
    localStorage.setItem('wb-eq-theme',id);localStorage.setItem('wb-ui-table','original');
    try{fbSaveProfile()}catch(_){}
    applyEquippedTheme();refreshHome();toast2('تم تفعيل '+theme.name);
  }finally{UI_SHOP.busy=false;uiRenderShop();}
}
function uiRenderGoldPackages(){
  const wrap=document.getElementById('goldPkgList');if(!wrap)return;wrap.innerHTML='';if(!SHOW_STORE)return;
  const names=['حفنة ذهب','رصّة ذهب','كيس المجلس','صندوق الذهب','خزنة المجلس'];
  GOLD_PACKAGES_DISPLAY.forEach((pkg,i)=>{
    const card=document.createElement('button');card.type='button';card.className='uiGoldPackage';card.dataset.package=pkg.key;
    card.innerHTML=uiGoldArt(i)+'<span class="uiGoldPackageName">'+names[i]+'</span><strong>'+pkg.label.replace(/ ذهب$/,'')+' <small>ذهب</small></strong><span class="uiGoldPackagePrice">'+toH(pkg.sar)+' ر.س</span>';
    card.onclick=()=>buyGoldPackage(pkg.key);wrap.appendChild(card);
  });
}
