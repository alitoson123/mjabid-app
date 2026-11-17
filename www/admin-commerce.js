'use strict';
(()=>{
 const panel=document.getElementById('panel-commerce'),status=document.getElementById('cmStatus'),form=document.getElementById('cmForm');let revision=null,loaded=false,epoch=0,busy=false,voiceSupported=false;
 const el=id=>document.getElementById(id);
 const rows=el('cmOffers');
 for(let i=1;i<=5;i++){
  const row=document.createElement('fieldset');row.className='cmOffer';row.innerHTML='<legend>الباقة '+i+'</legend><label><input type="checkbox" data-f="enabled"> تفعيل العرض</label><label>اسم العرض<input data-f="title" maxlength="60" value="عرض خاص للكوينز"></label><label>ذهب إضافي بنفس السعر<input data-f="bonusGold" type="number" min="1" max="100000" step="1" value="100"></label><label>البداية — توقيت الرياض<input data-f="startsAt" type="datetime-local"></label><label>النهاية — توقيت الرياض<input data-f="endsAt" type="datetime-local"></label>';row.dataset.tier='tier'+i;rows.append(row);
 }
 const local=ts=>ts?new Date(ts+10800000).toISOString().slice(0,16):'';
 async function api(body){
  const user=auth.currentUser,version=epoch;if(!user||!ADMIN_UIDS.includes(user.uid))throw Error('سجّل دخول الإدارة');
  const abort=new AbortController();let timer;const current=()=>!abort.signal.aborted&&version===epoch&&auth.currentUser?.uid===user.uid;
  try{return await Promise.race([new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('تعذّر الاتصال؛ أعد المحاولة.'));},15000);}),(async()=>{
   const token=await user.getIdToken();if(!current())throw Error('تغير الحساب أو انتهت مهلة الطلب');
   const r=await fetch('https://waggif-baloot.samisalimhdmaol.workers.dev/commerce',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:abort.signal});const d=await r.json();if(!current())throw Error('تغير الحساب أو انتهت مهلة الطلب');if(!r.ok||!d.ok)throw Error(d.error||'تعذر التنفيذ');return d;
  })()]);}finally{clearTimeout(timer);}
 }
 const validFee=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000;
 function show(d){if(!d?.value||!validFee(d.value.creatorFee)||!Array.isArray(d.value.offers)||d.value.voiceCreatorFee!==undefined&&!validFee(d.value.voiceCreatorFee))throw Error('تعذّر التحقق من إعدادات الرسوم؛ أعد التحميل.');revision=d.revision;el('cmCreatorFee').value=d.value.creatorFee;voiceSupported=d.value.voiceCreatorFee!==undefined;el('cmVoiceCreatorFee').disabled=!voiceSupported;el('cmVoiceCreatorFee').value=voiceSupported?d.value.voiceCreatorFee:'';el('cmVoiceFeeNote').textContent=voiceSupported?'تسري الأسعار على الجلسات الجديدة؛ الجلسات القائمة تحتفظ بسعرها.':'يلزم تحديث السيرفر لتعديل رسوم المجموعة الصوتية.';for(const row of rows.children){const o=d.value.offers.find(o=>o.tierKey===row.dataset.tier);for(const f of row.querySelectorAll('[data-f]')){if(f.dataset.f==='enabled')f.checked=!!o?.enabled;else if(f.dataset.f.endsWith('At'))f.value=local(o?.[f.dataset.f]);else f.value=o?.[f.dataset.f]??(f.dataset.f==='title'?'عرض خاص للكوينز':100);}}loaded=true;}
 async function act(fn){if(busy)return;const version=epoch;busy=true;for(const b of panel.querySelectorAll('button'))b.disabled=true;status.textContent='جارٍ الاتصال…';try{await fn();}catch(e){if(version===epoch)status.textContent=e.message;}finally{if(version===epoch){busy=false;for(const b of panel.querySelectorAll('button'))b.disabled=false;}}}
 const load=()=>act(async()=>{loaded=false;show(await api({action:'read'}));status.textContent='الإعدادات محدثة.';});
 el('cmReload').onclick=load;document.querySelector('[data-tab="commerce"]').addEventListener('click',load);
 el('cmPurchasesReload').onclick=()=>act(async()=>{const d=await api({action:'purchases'}),tbody=el('cmPurchases');tbody.replaceChildren();for(const p of d.purchases){const row=document.createElement('tr');for(const v of [new Date(p.createdAt).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'}),p.uid,({ios:'آيفون',android:'أندرويد',web:'الموقع',legacy:'سجل قديم — المنصة غير مسجلة'})[p.platform]||p.platform,p.kind==='vip'?'اشتراك VIP':p.gold,p.currency&&p.amount!==null?p.amount+' '+p.currency:p.sar!=null?p.sar+' ر.س':'غير متاح',p.offerTitle||p.productId||'—',({completed:'تمت الإضافة',pending:'بانتظار التأكيد',subscription_recorded:'اشتراك مسجل',subscription_cancelled:'إلغاء اشتراك — الصلاحية حسب تاريخ الانتهاء',refund_review:'استرداد — يتطلب مراجعة الذهب'})[p.status]||p.status,p.id+(p.transactionId?' · '+p.transactionId:'')]){const td=document.createElement('td');td.textContent=String(v??'');row.append(td);}tbody.append(row);}status.textContent=d.purchases.length?'عُرضت أحدث '+d.purchases.length+' عملية شراء.':'لا توجد عمليات شراء مسجلة.';});
 form.onsubmit=e=>{e.preventDefault();act(async()=>{
  if(!loaded)throw Error('أعد تحميل الإعدادات أولًا');const offers=[];
  for(const row of rows.children){const get=k=>row.querySelector('[data-f="'+k+'"]');if(!get('enabled').checked)continue;offers.push({tierKey:row.dataset.tier,enabled:true,title:get('title').value,bonusGold:Number(get('bonusGold').value),startsAt:Date.parse(get('startsAt').value+':00+03:00'),endsAt:Date.parse(get('endsAt').value+':00+03:00')});}
  const readFee=id=>{const raw=String(el(id).value).trim(),value=Number(raw);if(!raw||!validFee(value))throw Error('أدخل رسومًا صحيحة من 0 إلى 100000 ذهب.');return value;};
  const value={creatorFee:readFee('cmCreatorFee'),offers};if(voiceSupported)value.voiceCreatorFee=readFee('cmVoiceCreatorFee');
  show(await api({action:'save',revision,value}));status.textContent='حُفظت الرسوم والعروض. رسوم الجلسات القائمة لا تتغير.';
 });};
 auth.onAuthStateChanged(()=>{epoch++;loaded=false;revision=null;busy=false;voiceSupported=false;status.textContent='';form.reset();el('cmVoiceCreatorFee').disabled=true;el('cmVoiceFeeNote').textContent='يظهر السعر الصوتي بعد تحميل الإعدادات من السيرفر.';for(const b of panel.querySelectorAll('button'))b.disabled=false;el('cmPurchases').replaceChildren();});
})();
