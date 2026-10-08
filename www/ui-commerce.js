'use strict';
// v373: purchase UI never increments a balance or treats a redirect as payment proof.
window.GoldShop=(()=>{
 const names=['حفنة ذهب','رصّة ذهب','كيس المجلس','صندوق الذهب','خزنة المجلس'];
 const number=n=>Number(n).toLocaleString('ar-SA');
 const native=()=>!!window.Capacitor&&['ios','android'].includes(window.Capacitor.getPlatform?.());
 let catalog=null,flight=null,modal=null,serial=0,busy=false,previousFocus=null;
 const el=id=>document.getElementById(id);
 async function api(path,body){
  const user=FB.user,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const headers={'content-type':'application/json'};if(body)headers.authorization='Bearer '+await user.getIdToken();
   const r=await fetch('https://'+GAME_SRV+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal});
   const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'تعذّر الاتصال');
   if(body&&FB.user?.uid!==user.uid)throw Error('تغير الحساب؛ افتح الطلب بالحساب الذي اشتراه');return data;
  }finally{clearTimeout(timer);}
 }
 async function load(){
  if(flight)return flight;
  flight=api('/commerce').then(data=>{catalog=data;const text=el('uiCreationPrice');if(text)text.textContent=number(data.creatorFee);return data;}).finally(()=>{flight=null;});return flight;
 }
 async function render(){
  const wrap=el('goldPkgList');if(!wrap)return;
  if(native()&&window.NativeShop)return window.NativeShop.renderGold(wrap);
  wrap.innerHTML='<p class="gcNotice" role="status">جارٍ تحميل الباقات والعروض…</p>';
  try{await load();draw(wrap);}catch(_){wrap.innerHTML='<p class="gcNotice">تعذّر تحميل المتجر. حاول مرة أخرى.</p>';const b=document.createElement('button');b.className='btn';b.textContent='إعادة المحاولة';b.onclick=render;wrap.append(b);}
 }
 function draw(wrap){
  wrap.replaceChildren();
  if(native()){const note=document.createElement('p');note.className='gcNotice';note.textContent='شراء الذهب داخل التطبيق قيد التجهيز. ستظهر أسعار المتجر عند تفعيل الخدمة.';wrap.append(note);}
  for(const [i,p] of catalog.packages.entries()){
   const card=document.createElement('button');card.type='button';card.className='uiGoldPackage gcPackage'+(p.offer?' gcSpecial':'');
   card.innerHTML=(typeof uiGoldArt==='function'?uiGoldArt(i):'<span class="gcCoin">✦</span>')+'<span class="uiGoldPackageName"></span><strong></strong><small class="gcBonus"></small><span class="uiGoldPackagePrice"></span>';
   card.querySelector('.uiGoldPackageName').textContent=p.offer?.title||names[i];
   card.querySelector('strong').textContent=number(p.gold)+' ذهب';
   card.querySelector('.gcBonus').textContent=p.offer?'يشمل '+number(p.offer.bonusGold)+' ذهب إضافي · حتى '+new Date(p.offer.endsAt).toLocaleDateString('ar-SA',{timeZone:'Asia/Riyadh'}):'تُضاف بعد تأكيد الدفع';
   card.querySelector('.uiGoldPackagePrice').textContent=native()?'قريبًا':number(p.sar)+' ر.س';
   if(p.offer){const badge=document.createElement('span');badge.className='gcOfferBadge';badge.textContent='عرض خاص للكوينز';card.prepend(badge);}
   card.onclick=()=>open(p.key);wrap.append(card);
  }
 }
 function close(){window.NativeShop?.close();serial++;modal?.remove();modal=null;busy=false;previousFocus?.focus?.();}
 function shell(){
  close();previousFocus=document.activeElement;modal=document.createElement('div');modal.className='gcOverlay';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','gcTitle');
  modal.innerHTML='<section class="gcDialog"><button class="gcClose" type="button" aria-label="إغلاق">×</button><div id="gcMark" class="gcMedallion" aria-hidden="true">✦</div><small class="gcEyebrow">متجر مجابيد</small><h2 id="gcTitle"></h2><p id="gcDescription" role="status" aria-live="polite"></p><div id="gcDetails"></div><div id="gcActions"></div><small id="gcFootnote"></small></section>';
  document.body.append(modal);modal.querySelector('.gcClose').onclick=close;
  modal.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}};
  modal.querySelector('.gcClose').focus();return serial;
 }
 function state(title,description,mark='✦',loading=false){
  if(!modal)return;el('gcTitle').textContent=title;el('gcDescription').textContent=description;el('gcMark').textContent=mark;el('gcMark').classList.toggle('gcLoading',loading);el('gcDetails').replaceChildren();el('gcActions').replaceChildren();el('gcFootnote').textContent='';
 }
 function button(text,fn,secondary=false){const b=document.createElement('button');b.className=secondary?'gcSecondary':'gcPrimary';b.textContent=text;b.onclick=fn;el('gcActions').append(b);return b;}
 function detail(label,value){const r=document.createElement('div');r.className='gcDetail';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=value;r.append(a,b);el('gcDetails').append(r);}
 async function open(key){
  if(native()&&window.NativeShop){close();return window.NativeShop.openGold(key);}
  const gen=shell();state('نجهز باقتك','جارٍ التحقق من السعر والعرض…','✦',true);
  try{
   await load();if(gen!==serial)return;const p=catalog.packages.find(p=>p.key===key);if(!p)throw Error('الباقة غير متاحة');
   state(p.offer?.title||'زادك للجولة',number(p.gold)+' ذهب لحسابك');detail('ذهب الباقة',number(p.baseGold));if(p.offer)detail('هدية العرض','+ '+number(p.offer.bonusGold));
   if(native()){el('gcFootnote').textContent='الدفع عبر متجر جهازك سيتاح بعد اكتمال الربط.';button('حسنًا',close);return;}
   detail('الإجمالي',number(p.sar)+' ر.س');button('متابعة الدفع · '+number(p.sar)+' ر.س',()=>pay(p,gen));button('رجوع',close,true);el('gcFootnote').textContent='تُضاف الكمية كاملة بعد وصول تأكيد الدفع.';
  }catch(e){if(gen===serial){state('تعذّر تحميل الباقة',e.message,'!');button('إعادة المحاولة',()=>open(key));}}
 }
 async function pay(p,gen){
  if(busy)return;if(!FB.user){state('سجّل الدخول أولًا','اربط عملية الشراء بحسابك لتحفظ ذهبك.','↗');button('حسنًا',close);return;}
  busy=true;state('جارٍ تجهيز الدفع','لحظات وننقلك إلى صفحة الدفع الآمنة…','✦',true);
  const uid=FB.user.uid;
  try{
   const r=await api('/paymob/create-payment',{idToken:await FB.user.getIdToken(),tierKey:p.key,catalogGold:p.gold});
   if(gen!==serial||FB.user?.uid!==uid)return;
   const url=new URL(r.checkoutUrl);if(url.origin!=='https://ksa.paymob.com'||!r.orderId)throw Error('تعذر فتح صفحة الدفع');
   localStorage.setItem('wb-purchase-'+uid,r.orderId);location.assign(url.href);
  }catch(e){if(gen===serial){state('لم نبدأ الدفع',e.message||'تحقق من اتصالك ثم حاول مجددًا','!');button('العودة للباقة',()=>open(p.key));}}
  finally{if(gen===serial)busy=false;}
 }
 async function track(orderId){
  if(!FB.user)return;const uid=FB.user.uid,gen=shell();
  state('نتحقق من عملية الشراء','ننتظر تأكيد الدفع وإضافة الذهب إلى حسابك. يمكنك إغلاق النافذة والعودة لاحقًا.','✦',true);
  detail('رقم الطلب',orderId);
  for(let attempt=0;attempt<12;attempt++){
   if(gen!==serial||FB.user?.uid!==uid)return;
   try{
    const r=await api('/purchase-status',{orderId});if(gen!==serial||FB.user?.uid!==uid)return;
    if(r.status==='completed'){
     state('وصل ذهبك!','تم تأكيد الشراء وإضافة '+number(r.gold)+' ذهب إلى حسابك.','✓');detail('الذهب المضاف','+ '+number(r.gold));detail('رصيدك المؤكد',number(r.wallet.gold)+' ذهب');
     localStorage.removeItem('wb-purchase-'+uid);await freshGold();if(gen!==serial||FB.user?.uid!==uid)return;refreshHome();button('العودة للمجلس',()=>{close();goHome();});return;
    }
   }catch(e){if(attempt===11&&gen===serial){state('التأكيد لم يصل بعد','تعذّر التحقق الآن. لا تحتاج لإعادة الشراء؛ سنراجع الطلب نفسه عند المحاولة مجددًا.','…');button('تحقق مجددًا',()=>track(orderId));button('لاحقًا',close,true);return;}}
   if(attempt<11)await new Promise(resolve=>setTimeout(resolve,2500));
  }
  if(gen===serial){state('طلبك قيد التحقق','لم يصل تأكيد نهائي بعد. لا تعِد الدفع لنفس الطلب.','…');detail('رقم الطلب',orderId);button('تحقق مجددًا',()=>track(orderId));button('لاحقًا',close,true);}
 }
 function resume(){if(native()&&window.NativeShop)return window.NativeShop.resume();if(!FB.user)return;const params=new URLSearchParams(location.search),id=params.get('payment')==='return'?params.get('order'):localStorage.getItem('wb-purchase-'+FB.user.uid);if(params.get('payment')==='return'){params.delete('payment');params.delete('order');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}if(id&&/^pm-[a-f0-9-]{36}$/.test(id))track(id);}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().catch(()=>{});});
 load().catch(()=>{});
 return {render,open,resume,load,close};
})();
