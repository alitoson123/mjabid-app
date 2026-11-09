/* One shared entry allowance, presented by the same gate that authorizes entry. */
(function(root){
 'use strict';
 if(!root.MajabeedEntryAds?.create)return;
 const selectors='#hOnl,#hSessions,#hTournament,#majabeedCup [data-mc="start"],#majabeedCup [data-mc="join"],#blHomeMenu [data-bl="competitive"],#blHomeMenu [data-bl="sessions"],#blHomeMenu [data-bl="createDialog"],#blModal [data-bl="create"]';
 const plusBadgeSelectors='#hOnl,#blHomeMenu [data-bl="competitive"]';
 const account=()=>typeof FB!=='undefined'?FB.user?.uid||null:null;
 let gate=null,queued=false,serial=0;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
 function chooseEntry({isCurrent}){
  if(document.hidden||!isCurrent())return Promise.resolve('cancel');
  return new Promise(resolve=>{
   const previous=document.activeElement,host=document.getElementById('frame'),wasInert=host?.inert;
   const overlay=document.createElement('section');overlay.className='mjEntryOffer';overlay.id='mjEntryOffer';
   overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','mjEntryOfferTitle');overlay.setAttribute('aria-describedby','mjEntryOfferText');
   overlay.innerHTML='<div class="mjEntryOfferPanel" dir="rtl"><button type="button" class="mjEntryOfferClose" aria-label="إغلاق">×</button><span class="mjEntryOfferMark" aria-hidden="true">♠</span><span class="mjEntryOfferPlus">مجابيد بلس</span><h2 id="mjEntryOfferTitle">هل تريد اللعب دون إعلانات؟</h2><p id="mjEntryOfferText">انتهى رصيد الدخول دون إعلانات. اشترك في بلس، أو شاهد الإعلان وتابع اللعب.</p><button type="button" class="mjEntryOfferSubscribe">اشترك والعب دون إعلانات</button><button type="button" class="mjEntryOfferWatch">شاهد الإعلان والعب</button></div>';
   document.body.append(overlay);if(host)host.inert=true;
   let done=false,timer;
   const valid=()=>!document.hidden&&isCurrent();
   function finish(choice){
    if(done)return;done=true;
    if(!valid())choice='cancel';
    clearInterval(timer);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pause',cancel);
    root.removeEventListener('pagehide',cancel);root.removeEventListener('popstate',cancel);root.removeEventListener('keydown',keyboard,true);
    overlay.remove();if(host)host.inert=wasInert;
    if(choice!=='store'&&previous?.isConnected&&!document.hidden)previous.focus?.({preventScroll:true});
    resolve(choice);
   }
   function cancel(){finish('cancel');}
   function visibility(){if(document.hidden)cancel();}
   function keyboard(event){
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();return;}
    if(event.key!=='Tab')return;
    const controls=[...overlay.querySelectorAll('button')],first=controls[0],last=controls.at(-1);
    if(!overlay.contains(document.activeElement)||event.shiftKey&&document.activeElement===first){event.preventDefault();(event.shiftKey?last:first).focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
   overlay.querySelector('.mjEntryOfferClose').onclick=cancel;
   overlay.querySelector('.mjEntryOfferSubscribe').onclick=()=>finish('store');
   overlay.querySelector('.mjEntryOfferWatch').onclick=()=>finish('watch');
   overlay.onclick=event=>{if(event.target===overlay)cancel();};
   document.addEventListener('visibilitychange',visibility);document.addEventListener('pause',cancel);
   root.addEventListener('pagehide',cancel);root.addEventListener('popstate',cancel);root.addEventListener('keydown',keyboard,true);
   // A changed account or destination invalidates this choice, even without a click.
   timer=setInterval(()=>{if(!valid())cancel();},200);
   overlay.querySelector('.mjEntryOfferSubscribe').focus({preventScroll:true});
  });
 }
 gate=root.MajabeedEntryAds.create({
  getUser:account,
  isNative:()=>!!root.Capacitor?.isNativePlatform?.(),
  isExempt:async()=>{if(!root.VipClient?.checkActive)throw Error('Membership not ready');return root.VipClient.checkActive();},
  exempt:()=>!!root.VipClient?.active?.(),
  chooseEntry,
  openStore:()=>{goHome();openShop('gold');},
  showAd:()=>root.showInterstitialAd?.(),
  onAdUnavailable:()=>{if(typeof toast2==='function')toast2('تعذّر عرض الإعلان. لم يتم بدء اللعب؛ حاول مرة أخرى.');},
  storage:()=>root.localStorage,
  onChange:schedule
 });
 root.MajabeedEntryGate=gate;
 function refresh(){
  if(!gate)return;
  const uid=account(),state=gate.snapshot(),kind=state.exempt?'exempt':!state.native?'web':state.due?'due':'free';
  const remaining=Math.max(0,Math.min(2,Number(state.remaining)||0));
  const label=kind==='free'?(remaining===2?'متبقي دخولان بلا إعلان':'متبقي دخول واحد بلا إعلان')+'؛ الرصيد مشترك بين خيارات اللعب.':kind==='due'?'الدخول التالي بعد الإعلان؛ بعد عرضه يعود رصيد دخولين بلا إعلان.':kind==='exempt'?'بلس · دخول دون إعلان':'الدخول من المتصفح دون إعلان';
  for(const button of document.querySelectorAll(selectors)){
   let badge=button.querySelector(':scope > .mjEntryAdBadge');
   const visible=!!uid&&(kind!=='exempt'||button.matches(plusBadgeSelectors));
   button.classList.add('mjEntryGateTarget');
   button.classList.toggle('mjHasEntryAd',visible);
   if(button.dataset.entryBusy!==String(!!state.busy))button.dataset.entryBusy=String(!!state.busy);
   if(!visible){
    if(badge){badge.hidden=true;const ids=(button.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==badge.id);if(ids.length)button.setAttribute('aria-describedby',ids.join(' '));else button.removeAttribute('aria-describedby');}
    continue;
   }
   if(!badge){
    badge=document.createElement('span');badge.className='mjEntryAdBadge';badge.id='mj-entry-ad-'+(++serial);badge.setAttribute('role','img');button.append(badge);
   }
   badge.hidden=false;
   const described=(button.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);described.push(badge.id);button.setAttribute('aria-describedby',[...new Set(described)].join(' '));
   const renderKey=[kind,remaining,uid||''].join(':');
   if(badge.dataset.renderKey===renderKey)continue;
   badge.dataset.renderKey=renderKey;badge.dataset.state=kind;badge.dataset.remaining=String(remaining);badge.setAttribute('aria-label',label);badge.title=label;
   if(kind==='free')badge.innerHTML=[0,1].map(i=>'<i class="mjEntryAdDot'+(i<remaining?' available':'')+'" aria-hidden="true"></i>').join('');
   else badge.textContent=kind==='due'?'بعد الإعلان':kind==='exempt'?'بلس · دون إعلان':'دون إعلان';
  }
 }
 const host=document.getElementById('frame')||document.body;
 new MutationObserver(schedule).observe(host,{childList:true,subtree:true});
 new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
 root.addEventListener('storage',event=>{if(event.key===null||event.key?.startsWith('mj-entry-ads-v398:'))schedule();});
 root.addEventListener('focus',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 root.MajabeedAdIndicators={refresh};refresh();
})(window);
