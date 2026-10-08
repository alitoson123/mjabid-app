'use strict';
window.VipClient=(()=>{
 let current=null,userId=null,until=0,flight=null,profileEpoch=0,expiryTimer=null;
 const el=id=>document.getElementById(id),num=n=>Number(n).toLocaleString('ar-SA');
 const active=()=>userId===FB.user?.uid&&current?.active===true&&current.expiresAt>Date.now();
 async function request(uid){const user=FB.user;if(!user)return null;const r=await fetch('https://'+GAME_SRV+'/vip-status',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(uid?{uid}:{}),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'تعذر التحقق');if(FB.user?.uid!==user.uid)return null;return data;}
 function reset(){current=null;userId=null;until=0;flight=null;profileEpoch++;clearTimeout(expiryTimer);el('pfAva')?.classList.remove('vipAvatar');for(const b of document.querySelectorAll('[data-vip-badge]'))b.remove();const panel=el('vipProfile');if(panel)panel.remove();document.body.classList.remove('vipNoAds');}
 async function refresh(force=false){
  if(force)until=0;
  const uid=FB.user?.uid;if(!uid){reset();return null;}if(uid!==userId){reset();userId=uid;}if(current&&Date.now()<until)return current;if(flight)return flight;
  const generation=uid;
  flight=request().then(data=>{if(!data||FB.user?.uid!==generation||userId!==generation)return null;current=data;until=Date.now()+45000;document.body.classList.toggle('vipNoAds',active());clearTimeout(expiryTimer);if(active())expiryTimer=setTimeout(()=>{document.body.classList.remove('vipNoAds');current.active=false;until=0;},Math.min(2147483647,Math.max(1,current.expiresAt-Date.now())));return data;}).finally(()=>{if(userId===generation)flight=null;});return flight;
 }
 async function checkActive(){await refresh();return active();}
 function badge(value){const avatar=el('pfAva');if(!avatar)return;avatar.classList.toggle('vipAvatar',value);avatar.querySelector('[data-vip-badge]')?.remove();if(value){const b=document.createElement('span');b.dataset.vipBadge='';b.className='vipBadge';b.textContent='VIP';avatar.append(b);}}
 async function profile(uid){
  const epoch=++profileEpoch;el('vipProfile')?.remove();badge(false);if(!uid)return;
  const own=uid===FB.user?.uid,box=document.createElement('section');box.id='vipProfile';box.className='vipProfile';box.innerHTML='<div class="vipProfileHead"><span class="vipBadge">VIP</span><strong>عضوية المجلس</strong></div><p role="status">جارٍ التحقق من الاشتراك…</p>';el('pfName').after(box);
  try{
   const d=own?await refresh():await request(uid);if(epoch!==profileEpoch||!d)return;badge(d.active);if(!own){box.hidden=!d.active;box.querySelector('p').textContent='عضو VIP';return;}
   const plan=d.plans?.find(p=>p.key===d.plan);
   box.querySelector('p').textContent=d.active?(plan?.title||'عضوية VIP')+' · متبقٍ '+num(Math.max(1,Math.ceil((d.expiresAt-Date.now())/86400000)))+' يوم · حتى '+new Date(d.expiresAt).toLocaleDateString('ar-SA',{timeZone:'Asia/Riyadh'})+(d.renews?' · التجديد التلقائي مفعل':' · ينتهي الاشتراك بنهاية المدة'):'لا يوجد اشتراك نشط';
   const b=document.createElement('button');b.className='vipProfileButton';b.textContent=d.active?'تفاصيل العضوية':'تعرّف على VIP';b.onclick=open;box.append(b);
  }catch(_){if(epoch===profileEpoch)box.querySelector('p').textContent='تعذّر التحقق من الاشتراك؛ أعد فتح الملف للمحاولة مجددًا.';}
 }
 async function open(){
  if(window.Capacitor&&["ios","android"].includes(window.Capacitor.getPlatform?.())&&window.NativeShop)return window.NativeShop.openVip();
  document.getElementById('vipDialog')?.remove();const wrap=document.createElement('div');wrap.id='vipDialog';wrap.className='gcOverlay';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-labelledby','vipTitle');const prior=document.activeElement;
  wrap.innerHTML='<section class="gcDialog vipDialog"><button class="gcClose" aria-label="إغلاق">×</button><div class="gcMedallion">♛</div><small class="gcEyebrow">مجابيد VIP</small><h2 id="vipTitle">مجلسك، بمزايا أكثر</h2><p>وقت أكثر للعب، ولمسة تميّزك.</p><ul class="vipBenefits"><li>لعب بدون إعلانات</li><li>تفاعلات مجانية بلا حد للعدد</li><li>دخول جلسات الأصدقاء مجانًا</li><li>شارة VIP وإطار ذهبي للصورة</li></ul><div class="vipPlans"></div><p class="vipAvailability">الاشتراك قيد التجهيز. يتاح الدفع عبر متجر جهازك بعد اكتمال الربط.</p><small>رسوم إنشاء الجلسة والمباريات التنافسية مستقلة. يبقى الفاصل القصير بين التفاعلات لمنع الإزعاج.</small></section>';
  const plans=[['شهر واحد',12],['ثلاثة أشهر',30],['سنة كاملة',150]];for(const [label,price]of plans){const row=document.createElement('div');row.className='vipPlan';const a=document.createElement('strong'),b=document.createElement('span');a.textContent=label;b.textContent=num(price)+' ر.س';row.append(a,b);wrap.querySelector('.vipPlans').append(row);}
  const close=()=>{wrap.remove();prior?.focus?.();};wrap.querySelector('.gcClose').onclick=close;wrap.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){e.preventDefault();wrap.querySelector('.gcClose').focus();}};document.body.append(wrap);wrap.querySelector('.gcClose').focus();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(()=>{});});
 return {refresh,reset,active,checkActive,profile,open};
})();
