/* v320 presentation: reads existing rewards; never grants gold, XP or rank. */
'use strict';
const UI_RESULT={online:null,local:null};
const UI_SHOP={tab:'themes',preview:null,busy:false};
let uiArtSerial=0;
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
function uiAnimateRewardNumber(el,value){
  if(!el||!Number.isFinite(value))return;
  const from=Number.isFinite(el._uiValue)?el._uiValue:value;
  if(el._uiFrame)cancelAnimationFrame(el._uiFrame);
  el._uiValue=value;
  const finish=()=>{el.textContent=toH(value);el._uiFrame=0;};
  if(from===value||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  const start=performance.now();
  const step=now=>{const p=Math.min(1,(now-start)/850),n=Math.round(from+(value-from)*(1-Math.pow(1-p,3)));el.textContent=toH(n);if(p<1)el._uiFrame=requestAnimationFrame(step);else finish();};
  el._uiFrame=requestAnimationFrame(step);
}
function uiShowResultRewards(scope){
  const model=UI_RESULT[scope];if(!model||!model.seated)return;
  const p=scope==='online'?'o':'l';
  for(const [field,label] of [['gold','Gold'],['rank','Rank']]){
    const total=document.getElementById(p+'My'+label+'Num');
    const delta=document.getElementById(p+'My'+label+'Delta');
    if(!total)continue;
    uiAnimateRewardNumber(total,model.current[field]);
    if(delta){delta.textContent=uiRewardDelta(model.current[field]-model.base[field]);delta.classList.toggle('is-negative',model.current[field]<model.base[field]);}
  }
  const fill=document.getElementById(p+'XpFill');if(fill)fill.style.width=((Math.max(0,model.current.xp)%100))+'%';
  const level=document.getElementById(p+'XpLevel');if(level)level.textContent='المستوى '+toH(model.current.level);
  const note=document.getElementById(p+'RewardNote');if(note)note.textContent=scope==='online'&&!model.synced?'جارٍ تحديث رصيدك…':'رصيدك ونقاط رتبتك بعد الجولة';
}
function uiSetupResult(scope,opts){
  const online=scope==='online',p=online?'o':'l',root=document.getElementById(online?'oOver':'results');
  root.dataset.outcome=opts.draw?'draw':opts.won?'win':'loss';
  root.dataset.kind=online&&ONL.tournament?'tournament':opts.competitive?'competitive':online?'friendly':'practice';
  const kind=document.getElementById(p+'ResultKind');
  if(kind)kind.textContent=online&&ONL.tournament?'بطولة التاسعة · نتيجة المباراة':opts.watching?'مشاهدة · نهاية الجولة':opts.competitive?'نتيجة اللعب التنافسي':online?'جمعتكم أحلى · جلسة ودية':'تدريب · نهاية الجولة';
  const art=document.getElementById(p+'ResultArt');if(art)art.innerHTML=uiResultArt(online&&!opts.competitive?'friendly':'competitive');
  const goldIcon=document.querySelector('#'+p+'GoldReward .uiRewardIcon');if(goldIcon)goldIcon.innerHTML=uiGoldArt(0);
  const title=document.getElementById(online?'oResTtl':'resTtl');
  title.textContent=opts.watching?'اكتملت الجولة':opts.draw?'تعادل يليق بكم':opts.won?'يا سلام على الفوز!':'نعوّضها الجاية';
  document.getElementById(p+'MyStats').classList.toggle('hidden',!!opts.watching||(online&&!opts.competitive));
  const rank=document.getElementById('oRankReward');if(online&&rank)rank.classList.toggle('hidden',!opts.competitive);
}
function uiBeginOnlineResult(r,seated,key){
  if(UI_RESULT.online&&UI_RESULT.online.key===key)return;
  const base=uiRewardSnapshot();
  UI_RESULT.online={key,seated,base,current:{...base},synced:false};
  for(const label of ['Gold','Xp','Rank']){const el=document.getElementById('oMy'+label+'Num');if(el){if(el._uiFrame)cancelAnimationFrame(el._uiFrame);el._uiValue=base[label.toLowerCase()];}}
  uiShowResultRewards('online');
}
function uiPresentOnlineResult(r,seated){
  if(UI_RESULT.online&&UI_RESULT.online.presented)return;
  if(UI_RESULT.online)UI_RESULT.online.presented=true;
  const won=r.mode==='team'?r.winnerTeam===r.teams.findIndex(t=>t.includes(ONL.you)):r.winner===ONL.you;
  uiSetupResult('online',{competitive:!!(r.tier&&r.tier.fee),won,draw:r.draw||r.winnerTeam==='draw',watching:!seated});
}
function uiResultLocalXp(){
  const model=UI_RESULT.online;if(!model||!model.seated)return;
  model.current.xp=ST.n('xp');model.current.level=ST.n('level')||1;
  uiShowResultRewards('online');
}
function uiResultServerStats(gold,rank){
  const model=UI_RESULT.online;
  if(!model||!model.seated||ONL.status!=='over')return;
  const previous=model.current.gold;
  model.current.gold=gold;model.current.rank=rank;
  model.current.xp=ST.n('xp');model.current.level=ST.n('level')||1;model.synced=true;
  uiShowResultRewards('online');
  if(gold>previous){const box=document.getElementById('oGoldReward');box.classList.remove('is-gaining');void box.offsetWidth;box.classList.add('is-gaining');}
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
    card.innerHTML=uiGoldArt(i)+'<span class="uiGoldPackageName">'+names[i]+'</span><strong>'+pkg.label.replace(' 🪙','')+' <small>ذهب</small></strong><span class="uiGoldPackagePrice">'+toH(pkg.sar)+' ر.س</span>';
    card.onclick=()=>buyGoldPackage(pkg.key);wrap.appendChild(card);
  });
}
