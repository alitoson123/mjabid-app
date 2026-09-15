/* v363 — Cosmetic access only. No game state or server alarm. */
const UI_THEME_RENTALS={uid:null,data:null,verified:false,receivedAt:0,monoAt:0,flight:null,generation:0,revision:0,renting:false,lastAttempt:0,error:'',route:'',tick:null,expiry:null};
const UI_FREE_THEME='theme-midnight';
function uiThemeNow(){
  const r=UI_THEME_RENTALS;
  if(!r.data)return Date.now();
  return r.data.serverNow+Math.max(0,Date.now()-r.receivedAt,performance.now()-r.monoAt);
}
function uiThemeRead(key){try{return localStorage.getItem(key);}catch(_){return null;}}
function uiThemeWrite(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(_){}}
function uiThemeSetAccount(uid){
  const r=UI_THEME_RENTALS;if(r.uid===uid)return;
  clearTimeout(r.tick);clearTimeout(r.expiry);r.tick=null;r.expiry=null;
  r.generation++;r.revision++;r.renting=false;r.uid=uid||null;r.data=null;r.verified=false;r.flight=null;r.error='';r.lastAttempt=0;
  if(typeof UI_SHOP!=='undefined'){UI_SHOP.busy=false;UI_SHOP.preview=null;}
  // The profile load that follows supplies this account's chosen theme.
  uiThemeWrite('wb-eq-theme',UI_FREE_THEME);
  if(uid){
    try{
      const cache=JSON.parse(uiThemeRead('wb-theme-access-v363:'+uid)||'null');
      if(cache&&cache.uid===uid&&Array.isArray(cache.data?.themes)&&Number.isFinite(cache.data.serverNow)&&Number.isFinite(cache.receivedAt)&&cache.receivedAt<=Date.now()){
        r.data=cache.data;r.receivedAt=cache.receivedAt;r.monoAt=performance.now();
      }
    }catch(_){}
  }
}
function uiThemeAccess(id){
  if(id===UI_FREE_THEME)return {id,active:true,permanent:true,expiresAt:0,source:'free'};
  const r=UI_THEME_RENTALS,entry=r.uid===FB.user?.uid?r.data?.themes.find(t=>t.id===id):null;
  if(!entry)return {id,active:false,permanent:false,expiresAt:0,source:'none'};
  return {...entry,active:entry.permanent===true||Number(entry.expiresAt)>uiThemeNow()};
}
function uiThemeRemaining(expiresAt){
  const ms=Math.max(0,Number(expiresAt)-uiThemeNow());if(!ms)return 'انتهت المدة';
  const minutes=Math.ceil(ms/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
  if(days)return days+' يوم · '+hours+' ساعة';
  if(hours)return hours+' ساعة · '+mins+' دقيقة';
  return minutes+' دقيقة';
}
function uiThemeAccessText(id){
  const a=uiThemeAccess(id);
  if(a.source==='free')return 'مجانية للجميع · الخلفية الأساسية';
  if(a.permanent)return 'ملكية سابقة محفوظة · دائمة';
  if(a.active)return (a.source==='legacy-gift'?'هدية انتقالية · ':'متبقٍ · ')+uiThemeRemaining(a.expiresAt);
  return (a.expiresAt?'انتهت المدة · ':'')+'2000 كوينز · 7 أيام';
}
function uiThemeResolve(){
  const selected=shopEquipped('theme');
  if(uiThemeAccess(selected).active)return selected;
  // Do not discard a saved choice while account verification is still pending.
  if(UI_THEME_RENTALS.verified)uiThemeWrite('wb-eq-theme',UI_FREE_THEME);
  return UI_FREE_THEME;
}
async function uiThemeRequest(body){
  const user=FB.user;if(!user)throw Error('سجّل دخولك لاستئجار الخلفية');
  const idToken=await user.getIdToken();
  if(FB.user?.uid!==user.uid||UI_THEME_RENTALS.uid!==user.uid)throw Error('تغير الحساب؛ أعد المحاولة');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  let response,data;
  try{
    response=await fetch('https://'+GAME_SRV+'/theme-rentals',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+idToken},body:JSON.stringify(body),signal:controller.signal});
    data=await response.json();
  }catch(_){throw Error('تعذّر التحقق من الإيجار؛ حاول مجددًا');}
  finally{clearTimeout(timeout);}

  if(!response.ok||!data?.ok)throw Error(data?.error||'تعذّر التحقق من الإيجار؛ حاول مجددًا');
  if(!Number.isFinite(data.serverNow)||!Array.isArray(data.themes)||data.freeThemeId!==UI_FREE_THEME)throw Error('حدّث خدمة الخلفيات ثم أعد المحاولة');
  return data;
}
function uiThemeAccept(data,uid,generation){
  const r=UI_THEME_RENTALS;if(r.uid!==uid||r.generation!==generation||FB.user?.uid!==uid)return false;
  r.data=data;r.verified=true;r.receivedAt=Date.now();r.monoAt=performance.now();r.error='';
  uiThemeWrite('wb-theme-access-v363:'+uid,JSON.stringify({uid,data,receivedAt:r.receivedAt}));
  applyEquippedTheme();uiThemeRenderStatus();uiThemePlan();return true;
}
async function uiThemeSync(force=false){
  const r=UI_THEME_RENTALS,user=FB.user;if(!user)return false;
  uiThemeSetAccount(user.uid);
  if(r.renting)return false;
  if(r.flight)return r.flight;
  if(!force&&r.lastAttempt&&Date.now()-r.lastAttempt<300000)return !!r.data;
  const uid=user.uid,generation=r.generation,revision=r.revision;r.lastAttempt=Date.now();
  const flight=(async()=>{
    try{const data=await uiThemeRequest({action:'sync'});return r.revision===revision&&uiThemeAccept(data,uid,generation);}
    catch(e){if(r.uid===uid&&r.generation===generation&&r.revision===revision){r.error=e.message;uiThemeRenderStatus();}return false;}
    finally{if(r.generation===generation){r.flight=null;if(r.route==='shop'&&typeof uiRenderShop==='function')uiRenderShop();}}
  })();r.flight=flight;return flight;
}
function uiThemeRequestId(uid,id){
  const key='wb-theme-request-v363:'+uid+':'+id;
  let value=uiThemeRead(key);if(!/^[A-Za-z0-9_-]{16,80}$/.test(value||'')){
    value=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');uiThemeWrite(key,value);
  }
  return value;
}
async function uiThemeRent(id){
  const r=UI_THEME_RENTALS,user=FB.user;if(!user)throw Error('سجّل دخولك لاستئجار الخلفية');
  uiThemeSetAccount(user.uid);
  r.revision++;r.renting=true;
  const uid=user.uid,generation=r.generation;
  try{
    const requestId=uiThemeRequestId(uid,id);
    const data=await uiThemeRequest({action:'rent',themeId:id,requestId});
    if(!uiThemeAccept(data,uid,generation))return false;
    uiThemeWrite('wb-theme-request-v363:'+uid+':'+id,null);
    if(Number.isFinite(data.gold))ST.set('gold',data.gold);
    if(!uiThemeAccess(id).active)throw Error('انتهى الإيجار السابق؛ اضغط للاستئجار مجددًا');
    return true;
  }finally{if(r.generation===generation)r.renting=false;}
}
function uiThemeRenderStatus(){
  const r=UI_THEME_RENTALS,box=document.getElementById('uiThemeStatus');
  if(box){
    const id=uiThemeResolve(),theme=SHOP_THEMES.find(t=>t.id===id);
    box.textContent=(theme?.name||'قهوة الأولين')+' — '+uiThemeAccessText(id);
  }
  document.querySelectorAll('[data-theme-remaining]').forEach(el=>{el.textContent=uiThemeAccessText(el.dataset.themeRemaining);});
  const error=document.getElementById('uiThemeServiceNote');
  if(error){error.hidden=!r.error;error.textContent=r.error;}
}
function uiThemePlan(){
  const r=UI_THEME_RENTALS;clearTimeout(r.tick);clearTimeout(r.expiry);r.tick=null;r.expiry=null;
  if(document.hidden)return;
  if(['shop','profile'].includes(r.route))r.tick=setTimeout(()=>{uiThemeRenderStatus();uiThemePlan();},60000);
  const soon=(r.data?.themes||[]).filter(t=>!t.permanent&&Number(t.expiresAt)>uiThemeNow()).map(t=>Number(t.expiresAt)-uiThemeNow());
  if(soon.length)r.expiry=setTimeout(()=>{
    applyEquippedTheme();uiThemeRenderStatus();
    if(r.route==='shop')uiRenderShop();
    uiThemePlan();
  },Math.min(2147483647,Math.max(50,Math.min(...soon)+20)));
}
function uiThemeRoute(id){
  UI_THEME_RENTALS.route=id;
  uiThemeRenderStatus();uiThemePlan();
  if(['shop','profile'].includes(id))uiThemeSync();
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearTimeout(UI_THEME_RENTALS.tick);clearTimeout(UI_THEME_RENTALS.expiry);return;}
  applyEquippedTheme();uiThemeRenderStatus();uiThemePlan();
  if(['shop','profile','home'].includes(UI_THEME_RENTALS.route))uiThemeSync();
});
window.addEventListener('pagehide',()=>{clearTimeout(UI_THEME_RENTALS.tick);clearTimeout(UI_THEME_RENTALS.expiry);});
