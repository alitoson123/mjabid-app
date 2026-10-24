'use strict';
// V383: Plus uses server-priced game gold. No store checkout or client entitlement writes.
window.VipClient=(()=>{
 const el=id=>document.getElementById(id),num=n=>Number(n).toLocaleString('en');
 const plans=[{key:'daily',title:'يومي',days:1,gold:800},{key:'monthly',title:'شهري',days:30,gold:10000},{key:'yearly',title:'سنوي',days:365,gold:90000}];
 let current=null,userId=null,until=0,flight=null,epoch=0,statusSerial=0,profileEpoch=0,expiryTimer=null,offset=0,dialog=null,selected=null,busy=false;
 const memory=new Map(),now=()=>Date.now()+offset;
 const active=()=>userId===FB.user?.uid&&current?.active===true&&current.expiresAt>now();
 const pendingKey=uid=>'wb-plus-pending-v382-'+uid;
 function pending(uid){try{return JSON.parse(localStorage.getItem(pendingKey(uid))||'null')||memory.get(uid)||null;}catch(_){return memory.get(uid)||null;}}
 function savePending(uid,value){if(value)memory.set(uid,value);else memory.delete(uid);try{if(value)localStorage.setItem(pendingKey(uid),JSON.stringify(value));else localStorage.removeItem(pendingKey(uid));}catch(_){}}
 function validPending(p){return p&&plans.some(x=>x.key===p.plan)&&typeof p.requestId==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(p.requestId);}
 function available(){return current?.purchaseEnabled===true&&current.catalogVersion===382&&current.currency==='gold'&&plans.every(p=>current.plans?.some(x=>x.key===p.key&&x.gold===p.gold&&x.days===p.days));}
 function summary(data=current){
  if(!data?.active||data.expiresAt<=now())return 'لا يوجد اشتراك نشط';
  return 'البلس مفعّل · ينتهي '+new Date(data.expiresAt).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'});
 }
 function paintState(){
  document.body.classList.toggle('vipNoAds',active());
  const note=el('uiPlusStoreStatus');if(note)note.textContent=active()?summary():'يومي، شهري أو سنوي من رصيد الذهب';
  clearTimeout(expiryTimer);
  if(active())expiryTimer=setTimeout(()=>{paintState();if(dialog)draw();},Math.min(2147483647,Math.max(1,current.expiresAt-now())));
 }
 function apply(data,uid){
  if(FB.user?.uid!==uid)return false;
  current=data;userId=uid;if(Number.isFinite(data.serverTime))offset=data.serverTime-Date.now();until=Date.now()+45000;paintState();return true;
 }
 function close(){if(dialog){const {wrap,prior}=dialog;dialog=null;wrap.remove();prior?.focus?.();}selected=null;}
 function reset(){epoch++;statusSerial++;profileEpoch++;current=null;userId=null;until=0;flight=null;busy=false;offset=0;clearTimeout(expiryTimer);close();el('pfAva')?.classList.remove('vipAvatar');for(const b of document.querySelectorAll('[data-vip-badge]'))b.remove();el('vipProfile')?.remove();document.body.classList.remove('vipNoAds');}
 async function api(path,body,user){
  const controller=new AbortController();let timer;
  const operation=(async()=>{const token=await user.getIdToken();if(controller.signal.aborted||FB.user?.uid!==user.uid)throw Error('تغيّر الحساب');
   const r=await fetch('https://'+GAME_SRV+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:controller.signal});
   const data=await r.json();if(!data||typeof data!=='object')throw Error('استجابة غير صالحة');return data;
  })();
  try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('تعذّر تأكيد الاتصال؛ أعد التحقق'));},18000);})]);}
  finally{clearTimeout(timer);}
 }
 async function refresh(force=false){
  const user=FB.user,uid=user?.uid;if(!uid){reset();return null;}if(uid!==userId){reset();userId=uid;}
  if(busy)return current;if(!force&&current&&Date.now()<until)return current;if(flight&&!force)return flight;
  const gen=epoch,serial=++statusSerial;
  const work=api('/vip-status',{},user).then(data=>{if(gen!==epoch||serial!==statusSerial||FB.user?.uid!==uid)return null;if(!data.ok)throw Error(data.error||'تعذّر التحقق');apply(data,uid);return data;}).finally(()=>{if(flight===work)flight=null;});
  flight=work;return work;
 }
 async function checkActive(){await refresh();return active();}
 function badge(value){const avatar=el('pfAva');if(!avatar)return;avatar.classList.toggle('vipAvatar',value);avatar.querySelector('[data-vip-badge]')?.remove();if(value){const b=document.createElement('span');b.dataset.vipBadge='';b.className='vipBadge';b.textContent='PLUS';avatar.append(b);}}
 async function profile(uid){
  const gen=++profileEpoch;el('vipProfile')?.remove();badge(false);if(!uid||!FB.user)return;
  const user=FB.user,own=uid===user.uid,box=document.createElement('section');box.id='vipProfile';box.className='vipProfile';box.innerHTML='<strong>مجابيد بلس</strong><p role="status">جارٍ التحقق من الاشتراك…</p>';el('pfName')?.after(box);
  try{const data=own?await refresh():await api('/vip-status',{uid},user);if(gen!==profileEpoch||FB.user?.uid!==user.uid||!data)return;if(!data.ok)throw Error('unavailable');badge(data.active);if(!own){box.hidden=!data.active;box.querySelector('p').textContent='عضو بلس';return;}
   box.querySelector('p').textContent=summary(data);const b=document.createElement('button');b.className='vipProfileButton';b.textContent='عرض اشتراك البلس';b.onclick=open;box.append(b);
  }catch(_){if(gen===profileEpoch)box.querySelector('p').textContent='تعذّر التحقق من الاشتراك الآن';}
 }
 function draw(message){
  if(!dialog)return;const w=dialog.wrap,p=pending(FB.user?.uid),retry=validPending(p);
  const status=w.querySelector('.vipStatus');status.textContent=message||summary();
  const rows=w.querySelector('.vipPlans');rows.replaceChildren();
  for(const plan of plans){
   const b=document.createElement('button');b.type='button';b.className='vipPlan';b.dataset.plan=plan.key;b.setAttribute('aria-pressed',String(selected===plan.key));
   b.innerHTML='<span><strong>'+plan.title+'</strong><small>'+plan.days+' '+(plan.days===1?'يوم':'يومًا')+'</small></span><span><bdi>'+num(plan.gold)+'</bdi> ذهب</span>';
   b.disabled=busy||active()||!available()||retry;b.onclick=()=>{selected=plan.key;draw();};rows.append(b);
  }
  const chosen=plans.find(x=>x.key===(retry?p.plan:selected)),confirm=w.querySelector('.vipConfirm');
  confirm.hidden=active()&&!retry;confirm.disabled=busy||(!retry&&(!chosen||!available()));
  confirm.textContent=busy?'جارٍ تأكيد الاشتراك…':retry?'إعادة التحقق من الطلب السابق':chosen?'تأكيد الاشتراك · '+num(chosen.gold)+' ذهب':'اختر مدة الاشتراك';
  w.querySelector('.vipTerms').textContent=retry?'الطلب السابق لم يُحسم. نتحقق منه دون إنشاء عملية خصم جديدة.':active()?'اشتراكك محفوظ حتى انتهاء مدته. يمكنك الاشتراك مجددًا بعد انتهائه.':'يُخصم الذهب مرة واحدة بعد التأكيد. لا يوجد تجديد تلقائي.';
  const reload=w.querySelector('.vipReload');reload.hidden=available()||busy;reload.disabled=busy;
 }
 function wallet(data,uid){
  if(FB.user?.uid!==uid||!Number.isSafeInteger(data.goldAfter))return;
  // Version-guard the confirmed balance against newer match/reward updates.
  const version=typeof uiWalletTimestamp==='function'?uiWalletTimestamp(data.walletUpdatedAt):'';
  if(!version){freshGold().catch(()=>{});return;}
  uiWalletForAccount(uid);if(version<UI_WALLET.version)return;
  UI_WALLET.version=version;UI_WALLET.revision++;UI_WALLET.expectedGold=data.goldAfter;UI_WALLET.lastSnapshot=null;
  localStorage.setItem('wb-gold',String(data.goldAfter));uiWalletRender();
 }
 async function purchase(){
  const user=FB.user;if(!user||busy)return;
  let p=pending(user.uid);if(!validPending(p)){
   if(active()||!available()||!plans.some(x=>x.key===selected))return;
   const requestId=crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
   p={plan:selected,requestId,catalogVersion:382};savePending(user.uid,p);
  }
  const gen=epoch;statusSerial++;flight=null;busy=true;draw();
  try{
   const data=await api('/plus-purchase',p,user);if(gen!==epoch||FB.user?.uid!==user.uid)return;
   if(data.ok){
    savePending(user.uid,null);apply(data,user.uid);wallet(data,user.uid);selected=null;
    draw(data.alreadyActive?'البلس مفعّل بالفعل؛ لم يُخصم ذهب إضافي':data.active?'تم تفعيل البلس وحفظه في حسابك':'الطلب السابق مؤكد، وانتهت مدته؛ اختر مدة جديدة');
    toast2(data.active?'البلس مفعّل في حسابك':'تم التحقق من الطلب السابق');
   }else{
    if(['BAD_REQUEST','REQUEST_ID_USED','INSUFFICIENT_GOLD','PROFILE_REQUIRED','ACCOUNT_RESTRICTED'].includes(data.code))savePending(user.uid,null);
    wallet(data,user.uid);draw(data.error||'تعذّر التأكيد؛ أعد التحقق من الطلب نفسه');
   }
  }catch(e){if(gen===epoch&&FB.user?.uid===user.uid)draw(e.message||'تعذّر التأكيد؛ أعد التحقق من الطلب نفسه');}
  finally{if(gen===epoch){busy=false;if(dialog)draw(dialog.wrap.querySelector('.vipStatus').textContent);}}
 }
 async function open(){
  if(!FB.user){toast2('سجّل دخولك لعرض البلس');return;}
  if(userId!==FB.user.uid){reset();userId=FB.user.uid;}
  close();const wrap=document.createElement('div');wrap.id='vipDialog';wrap.className='vipOverlay';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-labelledby','vipTitle');
  wrap.innerHTML='<section class="vipDialog"><button class="vipClose" aria-label="إغلاق">×</button><div class="vipEmblem" aria-hidden="true">♛</div><small>مجابيد بلس</small><h2 id="vipTitle">مجلسك، بمزايا أكثر</h2><ul class="vipBenefits"><li>بدون إعلانات بينية</li><li>تفاعلات مجانية</li><li>الانضمام لطاولات الأصدقاء مجانًا</li><li>شارة بلس وإطار ذهبي</li></ul><p class="vipStatus" role="status" aria-live="polite">جارٍ التحقق من الاشتراك…</p><div class="vipPlans"></div><button class="vipConfirm" type="button"></button><button class="vipReload" type="button">تحديث حالة الاشتراك</button><p class="vipTerms"></p><small class="vipFoot">إعلان المكافأة اختياري ومتاح للمشتركين. رسوم إنشاء الجلسة والمباريات التنافسية مستقلة. يبقى الفاصل بين التفاعلات لمنع الإزعاج.</small></section>';
  const session={wrap,prior:document.activeElement};dialog=session;document.body.append(wrap);wrap.querySelector('.vipClose').onclick=close;wrap.querySelector('.vipConfirm').onclick=purchase;
  const reload=async()=>{try{await refresh(true);if(dialog===session)draw();}catch(_){if(dialog===session)draw('تعذّر تحميل الاشتراك؛ اضغط تحديث الحالة للمحاولة');}};
  wrap.querySelector('.vipReload').onclick=reload;
  wrap.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const items=[...wrap.querySelectorAll('button:not(:disabled):not([hidden])')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
  draw('جارٍ التحقق من الاشتراك…');wrap.querySelector('.vipClose').focus();await reload();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(()=>{});});
 return {refresh,reset,active,checkActive,profile,open};
})();
