import {createNativePurchases} from './purchases-adapter.js';

// This is an SDK public key, not an App Store/private API key.
const KEYS={ios:'appl_DaFDRgTQyjQCUPyelvtRtyklBBC',android:''};
const PRODUCTS={
 'mjabid.gold.500':{kind:'gold',tierKey:'tier1'},
 'mjabid.gold.1100':{kind:'gold',tierKey:'tier2'},
 'mjabid.gold.3000':{kind:'gold',tierKey:'tier3'},
 'mjabid.gold.6500':{kind:'gold',tierKey:'tier4'},
 'mjabid.gold.14000':{kind:'gold',tierKey:'tier5'},
 'mjabid.vip.monthly':{kind:'vip',title:'شهر واحد',period:'شهر'},
 'mjabid.vip.quarterly':{kind:'vip',title:'ثلاثة أشهر',period:'3 أشهر'},
 'mjabid.vip.yearly':{kind:'vip',title:'سنة كاملة',period:'سنة'}
};
const platform=()=>window.Capacitor?.getPlatform?.();
const native=()=>['ios','android'].includes(platform());
// Firebase auth changes before profile loading. Both identities must match.
const user=()=>typeof FB!=='undefined'&&FB.user&&FB.auth?.currentUser?.uid===FB.user.uid?FB.user:null;
const number=n=>Number(n).toLocaleString('ar-SA');
let adapter=null,dialog=null,epoch=0,renderEpoch=0,previousFocus=null;
async function api(path,body){
 const u=user();if(body&&(!u||u.isAnonymous))throw Error('سجّل الدخول بحساب محفوظ أولًا');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const headers={'content-type':'application/json'};
  if(body)headers.authorization='Bearer '+await u.getIdToken();
  const r=await fetch('https://'+GAME_SRV+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal});
  const d=await r.json();if(body&&user()?.uid!==u.uid)throw Error('تغير الحساب؛ عُد بالحساب الذي بدأ الشراء');
  if(!r.ok||!d.ok)throw Error('تعذّر الاتصال بخدمة المشتريات. حاول لاحقًا.');return d;
 }finally{clearTimeout(timer);}
}
async function ready(){
 if(!native()||!KEYS[platform()])throw Error('المشتريات غير متاحة على هذا الجهاز بعد.');
 const d=await api('/native/readiness');
 if(!d.enabled||d.stores?.[platform()]!==true)throw Error('المتجر قيد التجهيز. حاول لاحقًا.');
 return d;
}
function client(){
 if(adapter)return adapter;
 adapter=createNativePurchases({getUser:user,platform:platform(),publicApiKey:KEYS[platform()],products:PRODUCTS,api,beforePurchase:ready,
  onConfirmed:async r=>{
   if(r.kind==='gold'){await freshGold();refreshHome();}
   if(r.kind==='vip')await window.VipClient?.refresh(true);
  }});return adapter;
}
function close(){epoch++;dialog?.remove();dialog=null;previousFocus?.focus?.();}
function shell(){
 close();previousFocus=document.activeElement;dialog=document.createElement('div');dialog.className='gcOverlay';dialog.id='nativePurchaseDialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','nativePurchaseTitle');
 dialog.innerHTML='<section class="gcDialog"><button class="gcClose" type="button" aria-label="إغلاق">×</button><div class="gcMedallion" aria-hidden="true">✦</div><small class="gcEyebrow">متجر مجابيد</small><h2 id="nativePurchaseTitle"></h2><p class="nativeStatus" role="status" aria-live="polite"></p><div class="nativeDetails"></div><div class="nativeActions"></div><small class="nativeFootnote"></small></section>';
 document.body.append(dialog);dialog.querySelector('.gcClose').onclick=close;
 dialog.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button:not(:disabled),a[href]')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}};
 dialog.querySelector('.gcClose').focus();return {generation:epoch,uid:user()?.uid};
}
const live=c=>dialog&&epoch===c.generation&&user()?.uid===c.uid;
function state(title,message,loading=false){
 if(!dialog)return;dialog.querySelector('h2').textContent=title;dialog.querySelector('.nativeStatus').textContent=message;dialog.querySelector('.gcMedallion').classList.toggle('gcLoading',loading);dialog.querySelector('.nativeDetails').replaceChildren();dialog.querySelector('.nativeActions').replaceChildren();dialog.querySelector('.nativeFootnote').textContent='';
}
function action(label,fn,secondary=false){const b=document.createElement('button');b.type='button';b.className=secondary?'gcSecondary':'gcPrimary';b.textContent=label;b.onclick=fn;dialog.querySelector('.nativeActions').append(b);return b;}
function detail(label,value){const row=document.createElement('div');row.className='gcDetail';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=value;row.append(a,b);dialog.querySelector('.nativeDetails').append(row);}
function foot(text){dialog.querySelector('.nativeFootnote').textContent=text;}
function unavailable(e){state('تعذّر فتح المتجر',e.message);action('إغلاق',close,true);}
async function renderGold(wrap){
 const gen=++renderEpoch,uid=user()?.uid;wrap.textContent='جارٍ تحميل أسعار متجر جهازك…';
 try{
  await ready();const [catalog,products]=await Promise.all([api('/commerce'),client().list('gold')]);
  if(gen!==renderEpoch||uid!==user()?.uid||!wrap.isConnected)return;wrap.replaceChildren();
  for(const p of catalog.packages){const id=Object.keys(PRODUCTS).find(id=>PRODUCTS[id].tierKey===p.key),store=products.find(x=>x.identifier===id);const b=document.createElement('button');b.type='button';b.className='uiGoldPackage gcPackage';b.disabled=!store;
   const name=document.createElement('strong'),price=document.createElement('span');name.textContent=number(p.gold)+' ذهب';price.className='uiGoldPackagePrice';price.textContent=store?.priceString||'غير متاح حاليًا';b.append(name,price);b.onclick=()=>openGold(p.key);wrap.append(b);}
 }catch(e){if(gen!==renderEpoch||uid!==user()?.uid||!wrap.isConnected)return;wrap.textContent=e.message;const retry=document.createElement('button');retry.className='btn';retry.textContent='إعادة المحاولة';retry.onclick=()=>renderGold(wrap);wrap.append(retry);}
}
async function openGold(key){
 const ctx=shell();state('نجهز باقتك','جارٍ تحميل السعر من متجر جهازك…',true);
 try{
  await ready();const [catalog,products]=await Promise.all([api('/commerce'),client().list('gold')]);if(!live(ctx))return;
  const pkg=catalog.packages.find(x=>x.key===key),id=Object.keys(PRODUCTS).find(id=>PRODUCTS[id].tierKey===key),p=products.find(x=>x.identifier===id);if(!pkg||!p)throw Error('الباقة غير متاحة في متجر جهازك.');
  state(pkg.offer?.title||'زادك للجولة',number(pkg.gold)+' ذهب لحسابك');detail('ذهب الباقة',number(pkg.baseGold));if(pkg.offer)detail('هدية العرض','+ '+number(pkg.offer.bonusGold));detail('الإجمالي',p.priceString);
  action('شراء · '+p.priceString,()=>buy(p,ctx));action('رجوع',close,true);foot(pkg.offer?'بونص العرض يعتمد على وقت إتمام الشراء في المتجر. يُضاف الذهب بعد تأكيد السيرفر.':'يُضاف الذهب بعد تأكيد الشراء من السيرفر.');
 }catch(e){if(live(ctx))unavailable(e);}
}
function legal(){
 const row=document.createElement('p');row.className='nativeLegal';for(const [title,href]of [['سياسة الخصوصية','privacy.html'],['شروط الاستخدام','terms.html']]){const a=document.createElement('a');a.textContent=title;a.href=href;a.target='_blank';a.rel='noopener';row.append(a,document.createTextNode(' · '));}dialog.querySelector('.nativeDetails').append(row);
}
async function openVip(){
 const ctx=shell();state('عضوية مجابيد VIP','لعب بدون إعلانات، تفاعلات مجانية، دخول جلسات الأصدقاء، وشارة VIP.',true);
 try{
  await ready();const products=await client().list('vip');if(!live(ctx))return;
  state('اختر مدة عضويتك','نفس المزايا لجميع المدد. رسوم إنشاء الجلسة والتنافسي مستقلة.');
  for(const [id,info]of Object.entries(PRODUCTS).filter(([,p])=>p.kind==='vip')){const p=products.find(p=>p.identifier===id);const b=action(info.title+' · '+(p?.priceString||'غير متاح حاليًا'),()=>{if(!live(ctx))return;state('تأكيد الاشتراك',info.title+' في عضوية مجابيد VIP');detail('السعر',p.priceString+' / '+info.period);action('اشتراك · '+p.priceString,()=>buy(p,ctx));action('رجوع',openVip,true);foot('اشتراك يتجدد تلقائيًا كل '+info.period+' بالسعر المعروض ما لم تُلغِه. يمكنك إدارة الاشتراك وإلغاؤه من إعدادات متجر جهازك.');legal();});b.disabled=!p;}
  action('استعادة المشتريات',()=>restore(ctx),true);foot('يتجدد الاشتراك تلقائيًا. يمكنك إلغاؤه من إعدادات متجر جهازك.');legal();
 }catch(e){if(live(ctx)){unavailable(e);if(native()&&KEYS[platform()])action('استعادة المشتريات',()=>restore(ctx),true);}}
}
async function showResult(results,ctx){
 if(!live(ctx))return true;
 const done=results.find(r=>r.status==='completed'&&r.kind==='gold');
 if(done){state('وصل ذهبك!','تم تأكيد إضافة '+number(done.gold)+' ذهب إلى حسابك.');detail('رصيدك',number(done.wallet?.gold??0)+' ذهب');action('العودة للمجلس',close);return true;}
 if(results.some(r=>r.status==='subscription_recorded')){const vip=await window.VipClient?.refresh(true);if(!live(ctx))return true;if(vip?.active){state('عضويتك مفعّلة','تم تأكيد اشتراك VIP من السيرفر.');action('العودة للمجلس',close);return true;}}
 if(results.some(r=>['refund_review','subscription_cancelled'].includes(r.status))){state('راجع حالة العملية','العملية مسجلة للمراجعة أو الإلغاء؛ لن نطلب منك الدفع مجددًا.');action('إغلاق',close);return true;}
 return false;
}
async function confirm(ctx,initial=[]){
 if(!live(ctx))return;state('نتحقق من عملية الشراء','ننتظر تأكيد المتجر والسيرفر. يمكنك إغلاق النافذة؛ لا تعِد الدفع لنفس العملية.',true);
 let results=initial;
 for(let i=0;i<20&&live(ctx);i++){
  try{if(await showResult(results,ctx))return;const resumed=await client().resume();results=[...results.filter(x=>x.status==='subscription_recorded'),...resumed];if(await showResult(results,ctx))return;}catch(_){/* Retry verification, never repeat the purchase. */}
  if(i<19)await new Promise(r=>setTimeout(r,4000));
 }
 if(live(ctx)){state('طلبك قيد التحقق','لم يصل التأكيد النهائي بعد. لا تحتاج لإعادة الدفع.');action('تحقق مجددًا',()=>confirm(ctx,results));action('لاحقًا',close,true);}
}
async function buy(p,ctx){
 if(!live(ctx)||client().isBusy())return;state('جارٍ فتح الدفع','أكمل العملية في متجر جهازك…',true);
 try{const r=await client().purchase(p);if(!live(ctx))return;if(r.status==='cancelled'){state('أُلغيت العملية','لم يكتمل الشراء.');action('إغلاق',close);return;}await confirm(ctx,[r]);}
 catch(e){if(live(ctx)){state('تعذّر إكمال التحقق',e.message);action('تحقق من المشتريات',()=>confirm(ctx));action('إغلاق',close,true);}}
}
async function restore(ctx){
 if(!live(ctx))return;state('نستعيد اشتراكك','جارٍ التحقق من متجر جهازك والسيرفر…',true);
 try{const status=await client().restore();if(!live(ctx))return;await window.VipClient?.refresh(true);if(!live(ctx))return;state(status.active?'عضويتك مفعّلة':'اكتملت مراجعة الاستعادة',status.active?'تم تأكيد الاشتراك من السيرفر.':'لا يظهر اشتراك نشط حاليًا. إذا اشتريت للتو، أعد التحقق بعد قليل.');action('تحقق مجددًا',()=>restore(ctx));action('إغلاق',close,true);foot('الذهب المستهلك لا يُصرف مرة أخرى عند الاستعادة.');}
 catch(e){if(live(ctx))unavailable(e);}
}
async function resume(){if(!native()||!user()||!KEYS[platform()])return;try{await client().resume();}catch(_){}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
window.NativeShop={renderGold,openGold,openVip,resume,close};
