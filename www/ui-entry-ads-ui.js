/* One shared entry allowance, presented by the same gate that authorizes entry. */
(function(root){
 'use strict';
 if(!root.MajabeedEntryAds?.create)return;
 const selectors='#hOnl,#hSessions,#blHomeMenu [data-bl="competitive"],#blHomeMenu [data-bl="sessions"],#blHomeMenu [data-bl="createDialog"],#blModal [data-bl="create"]';
 const account=()=>typeof FB!=='undefined'?FB.user?.uid||null:null;
 let gate=null,queued=false,serial=0;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
 gate=root.MajabeedEntryAds.create({
  getUser:account,
  isNative:()=>!!root.Capacitor?.isNativePlatform?.(),
  isExempt:async()=>{if(!root.VipClient?.checkActive)throw Error('Membership not ready');return root.VipClient.checkActive();},
  exempt:()=>!!root.VipClient?.active?.(),
  showAd:()=>root.showInterstitialAd?.(),
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
   if(!badge){
    badge=document.createElement('span');badge.className='mjEntryAdBadge';badge.id='mj-entry-ad-'+(++serial);badge.setAttribute('role','img');button.append(badge);
    const described=(button.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);described.push(badge.id);button.setAttribute('aria-describedby',[...new Set(described)].join(' '));
   }
   button.classList.toggle('mjHasEntryAd',!!uid);badge.hidden=!uid;
   if(button.dataset.entryBusy!==String(!!state.busy))button.dataset.entryBusy=String(!!state.busy);
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
