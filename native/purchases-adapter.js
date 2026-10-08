// Bundle this source with the installed @revenuecat/purchases-capacitor version compatible
// with the actual native project. Do not load this bare-import source directly in index.html.
import {Purchases} from '@revenuecat/purchases-capacitor';

// Server confirmation is the only authority for granting coins or VIP benefits.
export function createNativePurchases({getUser,platform,publicApiKey,products,api,onConfirmed,beforePurchase}) {
 let configured=false,identity=null,inFlight=false,queue=Promise.resolve();
 if(!['ios','android'].includes(platform))throw Error('native platform required');
 const store=platform==='ios'?'APP_STORE':'PLAY_STORE';
 const user=()=>{const u=getUser();if(!u?.uid||u.isAnonymous)throw Error('سجّل الدخول بحساب محفوظ قبل الشراء');return u;};
 const guard=uid=>{if(getUser()?.uid!==uid)throw Error('تغير الحساب؛ تُسجل العملية للحساب الذي بدأ الشراء');};
 function serial(fn){const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;}
 async function identify(uid){
  guard(uid);
  if(!configured){
   if(typeof publicApiKey!=='string'||!(platform==='ios'?publicApiKey.startsWith('appl_'):publicApiKey.startsWith('goog_')))throw Error('المشتريات لم تُجهز بعد');
   await Purchases.configure({apiKey:publicApiKey,appUserID:uid});configured=true;identity=uid;
  }else if(identity!==uid){await Purchases.logIn({appUserID:uid});identity=uid;}
  guard(uid);
 }
 async function list(kind){return serial(async()=>{
  const uid=user().uid;await identify(uid);
  const ids=Object.entries(products).filter(([,p])=>p.kind===kind).map(([id])=>id);
  const result=await Purchases.getProducts({productIdentifiers:ids,type:kind==='gold'?'NON_SUBSCRIPTION':'SUBSCRIPTION'});guard(uid);
  // Use priceString returned by Apple/Google. Never substitute planned SAR prices.
  return result.products.filter(p=>ids.includes(p.identifier));
 });}
 const pendingKey=uid=>'mjabid-native-pending-'+uid;
 function pending(uid){try{return JSON.parse(localStorage.getItem(pendingKey(uid))||'[]');}catch(_){return [];}}
 function remember(uid,transactionId){const all=pending(uid);if(!all.includes(transactionId)){all.push(transactionId);localStorage.setItem(pendingKey(uid),JSON.stringify(all));}}
 async function verify(uid,transactionId){
  guard(uid);const result=await api('/native/purchase-status',{store,transactionId});guard(uid);
  if(['completed','subscription_recorded','refund_review','subscription_cancelled'].includes(result.status)){
   localStorage.setItem(pendingKey(uid),JSON.stringify(pending(uid).filter(id=>id!==transactionId)));
   if(['completed','subscription_recorded'].includes(result.status))await onConfirmed?.(result);
  }
  return result;
 }
 async function purchase(product){
  if(inFlight)throw Error('توجد عملية شراء قيد التنفيذ');
  const uid=user().uid;if(!Object.prototype.hasOwnProperty.call(products,product?.identifier||''))throw Error('باقة غير معروفة');
  inFlight=true;
  try{return await serial(async()=>{
   await identify(uid);guard(uid);await beforePurchase?.();guard(uid);
   // Always purchase a freshly fetched store object, not arbitrary UI-supplied pricing.
   const kind=products[product.identifier].kind;
   const result=await Purchases.getProducts({productIdentifiers:[product.identifier],type:kind==='gold'?'NON_SUBSCRIPTION':'SUBSCRIPTION'});
   const found=result.products.find(p=>p.identifier===product.identifier);guard(uid);if(!found)throw Error('الباقة غير متاحة في متجر جهازك');
   if(found.priceString!==product.priceString)throw Error('تغير السعر؛ أعد فتح الباقة لمراجعته');
   const paid=await Purchases.purchaseStoreProduct({product:found});
   const transactionId=paid.transaction?.transactionIdentifier;
   if(typeof transactionId!=='string'||!transactionId)return {status:'awaiting_confirmation'};
   remember(uid,transactionId);guard(uid);
   return await verify(uid,transactionId);
  });}catch(e){if(e?.userCancelled===true||String(e?.code)==='1')return {status:'cancelled'};throw e;}finally{inFlight=false;}
 }
 async function resume(){return serial(async()=>{const uid=user().uid;await identify(uid);const results=[];for(const id of pending(uid))results.push(await verify(uid,id));return results;});}
 async function restore(){if(inFlight)throw Error('انتظر اكتمال عملية الشراء');return serial(async()=>{
  const uid=user().uid;await identify(uid);await Purchases.restorePurchases();guard(uid);
  // SDK customerInfo is not accepted as server authority, and consumed gold isn't reissued.
  return api('/vip-status',{});
 });}
 return {list,purchase,resume,restore,isBusy:()=>inFlight};
}
