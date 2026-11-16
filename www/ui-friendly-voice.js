/* Friendly voice. Explicit runtime configuration and confirmed server capability.
 * Native capture is opt-in; game and wallet state are never mutated here. */
(function(root){
 'use strict';
 const ERROR='تعذّر الاتصال بالصوت؛ يمكنك مواصلة اللعب والمحاولة مجددًا.';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const uuid=()=>root.crypto.randomUUID();
 const key=c=>c?[c.game,c.roomId,c.accountId,c.playerId].join('|'):'';
 const allowed=c=>!!c&&['majabeed','sakka'].includes(c.game)&&!!c.roomId&&!!c.accountId&&!!c.playerId&&c.eligible===true&&c.connected===true&&!c.returnBlocked;
 function readRuntimeConfig(value){
  if(!value||value.enabled!==true||typeof value.endpoint!=='string'||!value.endpoint.trim())return null;
  try{
   const url=new URL(value.endpoint),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
   if(url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))return null;
   if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local&&value.allowLocalhost===true))return null;
   return Object.freeze({endpoint:url.origin});
  }catch(_){return null;}
 }
 function validCapability(data){return !!data&&data.ok===true&&data.available===true&&typeof data.enabled==='boolean'&&typeof data.sessionId==='string'&&data.sessionId.length>0&&data.sessionId.length<=128&&typeof data.canManage==='boolean'&&Array.isArray(data.participants)&&data.participants.length<=6;}
 const visible=state=>!!state?.context&&state.available===true&&state.capability===true;
 const unavailableError=e=>[404,410].includes(e?.status)||['VOICE_DISABLED','VOICE_NOT_CONFIGURED','VOICE_NOT_FOUND'].includes(e?.code);
 function createController(options){
  const bridge=options.bridge,request=options.request,changed=options.onChange||(()=>{}),clock=options.now||Date.now;
  const later=options.setTimer||setTimeout,cancel=options.clearTimer||clearTimeout,random=options.randomId||uuid;
  let context=null,epoch=0,queue=Promise.resolve(),poll=null,renewal=null,listener=null,destroyed=false,refreshing=false;
  let lease=null,acceptedFor='',micRequest=0,micPending=false,permissionGate=null,subscribed=new Set(),state=initial();
  function initial(){return {phase:'idle',capability:false,available:false,enabled:false,microphone:false,playback:true,canManage:false,participants:[],speaking:[],error:'',notice:'',accepted:false,pending:false};}
  function emit(){try{changed(clone({...state,context:context?{game:context.game,roomId:context.roomId,accountId:context.accountId,playerId:context.playerId}:null}));}catch(_){}}
  function current(n,c){return !destroyed&&n===epoch&&allowed(context)&&key(c)===key(context);}
  function serial(fn){const next=queue.catch(()=>{}).then(fn);queue=next.catch(()=>{});return next;}
  function clearTimers(){cancel(poll);cancel(renewal);poll=renewal=null;}
  function payload(c,l,extra){return {game:c.game,roomId:c.roomId,...(l?{sessionId:l.sessionId,clientId:l.clientId}:{}),...extra};}
  async function api(path,c,l,extra){return request(path,payload(c,l,extra),c.accountId);}
  function safeLeaveRemote(c,l){if(c&&l?.sessionId)Promise.resolve(api('leave',c,l)).catch(()=>{});}
  // Only a native permission prompt can defer pause/hidden. Explicit exits and
  // pagehide always stop; native onStop/didEnterBackground forces game cleanup.
  function deferLifecycle(source){
   const g=permissionGate;if(!['pause','hidden'].includes(source)||!g||g.epoch!==epoch||g.request!==micRequest||g.lease!==lease)return false;
   g.deferred=true;g.resumed=false;return true;
  }
  function settlePermission(g){if(permissionGate===g&&g?.settled&&(!g.deferred||g.resumed))permissionGate=null;}
  function resumeLifecycle(){const g=permissionGate;if(g){g.resumed=true;settlePermission(g);}}
  async function stop(reason='',remote=true,forceBackground=false){
   const oldContext=context,oldLease=lease,relayBackground=forceBackground||!!(permissionGate?.deferred&&!permissionGate.resumed);
   ++epoch;++micRequest;lease=null;micPending=false;permissionGate=null;subscribed=new Set();refreshing=false;clearTimers();
   // Never queue cancellation behind an OS permission dialog. Native cancel
   // tombstones this session, including a join that has not reached native yet.
   if(oldLease?.nativeSessionId){
    try{Promise.resolve(bridge.cancel({sessionId:oldLease.nativeSessionId})).catch(()=>bridge.leave({sessionId:oldLease.nativeSessionId})).catch(()=>{});}catch(_){try{Promise.resolve(bridge.leave({sessionId:oldLease.nativeSessionId})).catch(()=>{});}catch(_) {}}
   }
   state={...initial(),capability:state.capability,available:state.available,enabled:state.enabled,canManage:state.canManage,participants:state.participants,accepted:acceptedFor===context?.accountId,notice:reason};emit();
   // Cancellation can erase the native session before a later background event.
   // Replay any deferred game cleanup now, with its old identity and gate cleared
   // first, so the handler can safely call suspend/disconnect without recursion.
   if(relayBackground&&oldContext)try{options.onBackground?.({game:oldContext.game,roomId:oldContext.roomId,accountId:oldContext.accountId});}catch(_){}
   // Native calls are serialized so a pending join cannot re-enable audio after leave.
   const cleanup=serial(()=>bridge?.leave({...(oldLease?{sessionId:oldLease.nativeSessionId}:{})})).catch(()=>{});
   if(remote)safeLeaveRemote(oldContext,oldLease);
   await cleanup;
  }
  function schedule(){cancel(poll);if(!allowed(context)||destroyed)return;poll=later(()=>{poll=null;refresh();},state.capability?15000:60000);}
  function setContext(next){
   if(!allowed(next))next=null;
   if(key(next)!==key(context)){
    stop();context=next?{...next}:null;state=initial();state.accepted=acceptedFor===context?.accountId;emit();
    if(context)refresh();return;
   }
   context=next?{...next}:null;
   if(context&&!poll&&!refreshing)refresh();
  }
  function applyStatus(data){
   state.available=data.available===true;state.enabled=data.enabled===true;state.canManage=data.canManage===true;
   state.participants=Array.isArray(data.participants)?data.participants.filter(p=>typeof p.playerId==='string').map(p=>({uid:Number.isSafeInteger(p.uid)&&p.uid>0?p.uid:null,playerId:p.playerId,name:String(p.name||'لاعب').slice(0,80),joined:p.joined===true,blocked:p.blocked===true,muted:!!state.participants.find(x=>x.playerId===p.playerId)?.muted})):[];
   if(lease&&['joined','reconnecting'].includes(state.phase)){
    const l=lease,n=epoch,c={...context},wanted=authorizedSpeakers(c);
    // Revoked audio cannot wait for an unanswered microphone permission prompt.
    if(micPending&&[...subscribed].some(uid=>!wanted.has(uid))){stop('تغيّر المشاركون؛ توقف الصوت لحماية خصوصيتك.');return;}
    serial(()=>syncSubscriptions(l,n,c)).catch(()=>{if(current(n,c)&&lease===l)stop('تعذّر تطبيق كتم الصوت؛ أُغلق الاتصال لحماية خصوصيتك.');});
   }
  }
  function authorizedSpeakers(c){return new Set(state.participants.filter(p=>p.uid&&p.playerId!==c.playerId&&!p.blocked&&!p.muted).map(p=>p.uid));}
  async function syncSubscriptions(l,n,c){
   const valid=()=>current(n,c)&&lease===l;if(!valid())return false;
   const wanted=authorizedSpeakers(c);
   // First unsubscribe UIDs removed, rotated, blocked or muted by the roster.
   for(const uid of [...subscribed])if(!wanted.has(uid)){
    if(!valid())return false;await bridge.muteParticipant({uid,muted:true,sessionId:l.nativeSessionId});if(!valid())return false;subscribed.delete(uid);
   }
   for(const uid of wanted)if(!subscribed.has(uid)){
    if(!valid())return false;await bridge.muteParticipant({uid,muted:false,sessionId:l.nativeSessionId});if(!valid())return false;subscribed.add(uid);
   }
   return valid();
  }
  async function refresh(){
   if(!allowed(context)||destroyed||refreshing)return false;const n=epoch,c={...context};refreshing=true;
   try{
    const data=await api('status',c,lease);if(!current(n,c))return false;
    if(!validCapability(data)){state.capability=false;state.available=false;state.enabled=false;if(lease)await stop('الصوت غير متاح لهذه الجلسة.');emit();return false;}
    if(lease&&data.sessionId!==lease.sessionId){await stop('انتهت المحادثة السابقة؛ انضم مجددًا.');return false;}
    if(lease&&!data.participants?.some(p=>p.playerId===c.playerId&&p.uid===lease.uid)){await stop('انتهى تصريحك لهذه المحادثة الصوتية.');return false;}
    state.capability=true;applyStatus(data);state.error='';emit();
    if(lease&&(!data.enabled||!data.available)){await stop('أُغلقت المحادثة الصوتية لهذه الجلسة.');return false;}
    return true;
   }catch(e){
    if(current(n,c)){
     state.capability=false;state.available=false;state.enabled=false;
     if(lease)await stop(ERROR);
     state.error=e?.code==='VOICE_DISABLED'?'الصوت غير متاح حاليًا.':ERROR;emit();
    }return false;
   }finally{if(n===epoch)refreshing=false;schedule();}
  }
  function acceptRules(){if(context){acceptedFor=context.accountId;state.accepted=true;emit();}}
  async function join(){
   if(!allowed(context)||!state.capability||!state.available||!state.enabled||!state.accepted||state.pending||lease||destroyed)return false;
   const n=epoch,c={...context},candidate={clientId:random(),sessionId:null,nativeSessionId:null};
   state.phase='connecting';state.pending=true;state.error='';state.notice='';emit();
   try{
    const data=await api('join',c,candidate);
    candidate.sessionId=data.sessionId;candidate.nativeSessionId=data.sessionId+':'+candidate.clientId;candidate.uid=data.uid;
    if(!current(n,c)){safeLeaveRemote(c,candidate);return false;}
    if(!data.enabled||!data.appId||!data.channel||!data.token||!Number.isSafeInteger(data.uid)||!data.sessionId||!Number.isFinite(data.expiresAt)||data.expiresAt<=clock())throw Error('Invalid voice lease');
    lease=candidate;applyStatus(data);
    await serial(async()=>{
     if(!current(n,c)||lease!==candidate)return;
     await bridge.join({appId:data.appId,channel:data.channel,uid:data.uid,token:data.token,sessionId:candidate.nativeSessionId,playbackEnabled:false});
     if(!current(n,c)||lease!==candidate)return;
     if(!await syncSubscriptions(candidate,n,c))return;
     if(current(n,c)&&lease===candidate)await bridge.setPlayback({enabled:true,sessionId:candidate.nativeSessionId});
    });
    if(!current(n,c)||lease!==candidate)return false;
    state.phase='joined';state.pending=false;state.microphone=false;state.playback=true;state.error='';emit();armRenew(data.expiresAt,n,c);schedule();return true;
   }catch(e){
    if(current(n,c)){if(unavailableError(e)){state.capability=false;state.available=false;state.enabled=false;}await stop();state.error=e?.code==='VOICE_DISABLED'?'المحادثة مغلقة حاليًا.':e?.code==='VOICE_REVOCATION_PENDING'?'جارٍ إنهاء الاتصال السابق؛ انتظر قليلًا ثم أعد الانضمام.':ERROR;emit();}
    else safeLeaveRemote(c,candidate);return false;
   }
  }
  function armRenew(expiresAt,n,c){cancel(renewal);renewal=later(()=>{renewal=null;if(current(n,c))renew();},Math.max(1000,expiresAt-clock()-60000));}
  let renewing=false;
  async function renew(){
   if(!lease||renewing||!allowed(context))return false;renewing=true;const n=epoch,c={...context},l=lease;
   try{
    const data=await api('renew',c,l);if(!current(n,c)||lease!==l)return false;
    if(data.sessionId!==l.sessionId||data.uid!==l.uid||!data.token||data.expiresAt<=clock())throw Error('Lease changed');
    await serial(()=>current(n,c)&&lease===l?bridge.renewToken({token:data.token,sessionId:l.nativeSessionId}):undefined);
    if(!current(n,c)||lease!==l)return false;applyStatus(data);armRenew(data.expiresAt,n,c);emit();return true;
   }catch(e){if(current(n,c)&&lease===l){if(unavailableError(e)){state.capability=false;state.available=false;state.enabled=false;}await stop('انتهى اتصال الصوت؛ انضم مجددًا والمايك مغلق.');}return false;}
   finally{renewing=false;}
  }
  async function microphone(enabled){
   if(state.phase!=='joined'||state.pending||permissionGate||!lease||typeof enabled!=='boolean')return false;
   const n=epoch,c={...context},l=lease,m=++micRequest;let gate=null;micPending=true;state.pending=true;state.error='';emit();
   const valid=()=>current(n,c)&&lease===l&&m===micRequest&&state.phase==='joined';
   try{
    await serial(async()=>{
     if(!valid())return;
     if(enabled){
      const permission=await bridge.getMicrophonePermission();if(!valid())return;
      if(permission?.granted!==true){gate={epoch:n,request:m,lease:l,deferred:false,resumed:false,settled:false};permissionGate=gate;}
     }
     if(valid())await bridge.setMicrophone({enabled,sessionId:l.nativeSessionId});
    });
    if(!valid())return false;state.microphone=enabled;return true;
   }catch(e){if(current(n,c)){state.microphone=false;state.error=e?.code==='E_MIC_PERMISSION'?'إذن المايك غير متاح؛ يمكنك الاستماع ومواصلة اللعب.':'تعذّر تشغيل المايك؛ حاول مجددًا.';}return false;}
   finally{if(gate){gate.settled=true;settlePermission(gate);}if(current(n,c)&&m===micRequest){micPending=false;state.pending=false;emit();}}
  }
  async function playback(enabled){
   if(state.phase!=='joined'||!lease||typeof enabled!=='boolean')return false;const n=epoch,c={...context},l=lease;
   try{await serial(()=>current(n,c)&&lease===l?bridge.setPlayback({enabled,sessionId:l.nativeSessionId}):undefined);if(!current(n,c)||lease!==l)return false;state.playback=enabled;emit();return true;}catch(_){if(current(n,c)){state.error='تعذّر تغيير صوت اللاعبين.';emit();}return false;}
  }
  async function mute(playerId,muted){
   const p=state.participants.find(p=>p.playerId===playerId);if(!p?.uid||p.playerId===context?.playerId||!lease||typeof muted!=='boolean')return false;
   const n=epoch,c={...context},l=lease;p.muted=muted;emit();
   if(muted&&micPending){await stop('توقف الصوت لتطبيق الكتم بأمان أثناء طلب إذن المايك.');return true;}
   try{await serial(()=>syncSubscriptions(l,n,c));if(!current(n,c)||lease!==l)return false;emit();return true;}catch(_){if(current(n,c)&&lease===l)await stop('تعذّر كتم اللاعب؛ أُغلق الصوت لحماية خصوصيتك.');return false;}
  }
  async function action(type,extra){
   if(!allowed(context)||!state.capability||state.pending||!['settings','block','report','kick'].includes(type))return false;
   if(['settings','kick'].includes(type)&&!state.canManage)return false;
   if(type!=='settings'&&!state.participants.some(p=>p.playerId===extra.targetPlayerId&&p.playerId!==context.playerId))return false;
   const n=epoch,c={...context};state.pending=true;state.error='';emit();
   try{
    const result=await api(type,c,lease,extra);if(!current(n,c))return false;
    if(result.left&&lease){await stop('حُظر اللاعب وغادرت الصوت لمنع التواصل معه.',false);await refresh();return true;}
    state.notice=type==='report'?'تم تسجيل البلاغ.':type==='block'?(extra.blocked?'حُظر صوت هذا اللاعب.':'أُلغي حظر صوت اللاعب.'):type==='kick'&&result.enforced===false?'سُجل المنع؛ تعذّر تأكيد الفصل الفوري، ويجري إيقاف الوصول للصوت.':'تم حفظ إعداد الصوت.';await refresh();return true;
   }
   catch(e){if(current(n,c)){if(unavailableError(e)){state.capability=false;state.available=false;state.enabled=false;if(lease)await stop();}state.error='تعذّر تنفيذ الطلب؛ حاول مجددًا.';emit();}return false;}
   finally{if(current(n,c)){state.pending=false;emit();}}
  }
  function nativeEvent(e){
   if(!lease||e?.sessionId!==lease.nativeSessionId)return;
   if(e.type==='speaking'){state.speaking=Array.isArray(e.uids)?e.uids.filter(Number.isSafeInteger):[];emit();}
   else if(e.type==='microphone'&&e.enabled===false){state.microphone=false;emit();}
   else if(e.type==='token-expiring')renew();
   else if(['participant-joined','participant-left'].includes(e.type))refresh();
   else if(e.type==='interrupted'){stop('توقف الصوت بسبب مقاطعة؛ انضم مجددًا عند العودة.',true,e.reason==='background');}
   else if(e.type==='left'||e.type==='error'||e.type==='connection'&&['failed','disconnected'].includes(e.state)){stop('انقطع الصوت؛ يمكنك إعادة الانضمام.');}
   else if(e.type==='connection'&&['reconnecting','connecting'].includes(e.state)&&state.phase!=='connecting'){
    if(micPending){stop('انقطع الاتصال أثناء طلب إذن المايك؛ انضم مجددًا عند العودة.');return;}
    const l=lease;++micRequest;state.phase='reconnecting';state.microphone=false;state.speaking=[];emit();
    serial(()=>lease===l?bridge.setMicrophone({enabled:false,sessionId:l.nativeSessionId}):undefined).catch(()=>stop(ERROR));
   }else if(e.type==='connection'&&e.state==='connected'&&state.phase==='reconnecting'){
    state.phase='joined';state.microphone=false;state.notice='عاد اتصال الصوت؛ المايك مغلق.';emit();renew();
   }
  }
  async function listen(){if(bridge?.addListener){try{const result=await bridge.addListener('voiceEvent',nativeEvent);if(destroyed)result?.remove?.();else listener=result;}catch(_){}}}
  listen();
  async function destroy(){await stop();destroyed=true;context=null;clearTimers();await listener?.remove?.();}
  return Object.freeze({setContext,refresh,acceptRules,join,leave:()=>stop('غادرت المحادثة الصوتية.'),microphone,playback,mute,action,renew,nativeEvent,destroy,deferLifecycle,resumeLifecycle,snapshot:()=>clone({...state,context}),suspend:()=>stop('توقف الصوت؛ انضم مجددًا عند العودة.')});
 }

 root.MajabeedVoiceCore=Object.freeze({createController,allowed,readRuntimeConfig,validCapability,visible});
 if(typeof module==='object'&&module.exports)module.exports=root.MajabeedVoiceCore;
 if(!root.document)return;
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons={mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',off:'<path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2M9 5V4a3 3 0 0 1 6 0v7M5 10v2a7 7 0 0 0 12 5M19 10v2M12 19v3M8 22h8"/>',sound:'<path d="M11 4 6 8H2v8h4l5 4V4ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16"/>',people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>'};
 icons.group='<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="11" width="4" height="8" rx="2"/><rect x="17.5" y="11" width="4" height="8" rx="2"/><path d="M9 13v4m3-7v10m3-7v4"/>';
 const icon=k=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[k]+'</svg>';
 const reportReasons=Object.freeze({abuse:'إساءة أو ألفاظ غير لائقة',harassment:'مضايقة',hate:'خطاب كراهية',sexual:'محتوى جنسي',threat:'تهديد',spam:'إزعاج أو تكرار',privacy:'كشف معلومات خاصة',other:'مخالفة أخرى'});
 let controller=null,last=null,toolbar=null,panel=null,opened=false,lastFocus=null,bound=false,panelModel='',toolbarModel='',activeEndpoint='',reportDraft=null;
 const views={majabeed:null,sakka:null};
 const account=()=>typeof FB!=='undefined'?FB.user:null;
 const runtime=()=>readRuntimeConfig(root.MJ_FRIENDLY_VOICE_CONFIG);
 function plugin(){try{if(root.Capacitor?.isPluginAvailable?.('FriendlyVoice')!==true)return null;const bridge=root.Capacitor?.Plugins?.FriendlyVoice||(root.Capacitor?.registerPlugin?root.Capacitor.registerPlugin('FriendlyVoice'):null);return bridge&&['join','leave','cancel','getMicrophonePermission','setMicrophone','setPlayback','muteParticipant','renewToken','addListener'].every(method=>typeof bridge[method]==='function')?bridge:null;}catch(_){return null;}}
 function resetController(){const previous=controller;controller=null;activeEndpoint='';if(previous)Promise.resolve(previous.destroy()).catch(()=>{});paint({context:null,participants:[]});}
 function ensure(){
  const config=runtime();if(!config){if(controller)resetController();return null;}
  const bridge=plugin();if(!bridge){if(controller)resetController();return null;}
  if(controller&&activeEndpoint!==config.endpoint)resetController();
  if(controller)return controller;
  activeEndpoint=config.endpoint;let created;
  created=createController({bridge,request:async(action,body,accountId)=>{
   if(runtime()?.endpoint!==config.endpoint||!plugin())throw Error('Voice unavailable');
   const user=account();if(!user||user.uid!==accountId)throw Error('Account changed');
   const token=await user.getIdToken();if(account()?.uid!==accountId)throw Error('Account changed');
   if(runtime()?.endpoint!==config.endpoint||!plugin())throw Error('Voice unavailable');
   // No GAME_SRV fallback; credentials are sent only to the explicitly configured origin.
   const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
   try{const result=await fetch(config.endpoint+'/voice/'+action,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:abort.signal,cache:'no-store'});let data;try{data=await result.json();}catch(_){const error=Error(ERROR);error.status=result.status;throw error;}if(!result.ok||data?.ok!==true){const error=Error(ERROR);error.code=data?.code;error.status=result.status;throw error;}return data;}finally{clearTimeout(timeout);}
  },onChange:state=>{if(controller===created)paint(state);},onBackground:detail=>root.dispatchEvent(new root.CustomEvent('mj-voice-background',{detail}))});controller=created;
  if(!bound){bound=true;document.addEventListener('visibilitychange',()=>{if(document.hidden){if(!controller?.deferLifecycle('hidden'))controller?.suspend();}else controller?.resumeLifecycle();});document.addEventListener('pause',()=>{if(!controller?.deferLifecycle('pause'))controller?.suspend();});document.addEventListener('resume',()=>controller?.resumeLifecycle());root.addEventListener('pagehide',()=>controller?.suspend());
   // Authentication changes also happen outside the room render lifecycle.
   setInterval(()=>{if(controller&&(!runtime()||runtime().endpoint!==activeEndpoint||!plugin()))resetController();else if(last?.context&&account()?.uid!==last.context.accountId)controller?.setContext(null);},1000);
  }return controller;
 }
 function syncMajabeed(s){
  const table=document.getElementById('onl');if(!table||table.hidden||table.classList.contains?.('hidden')){if(controller?.snapshot().context?.game==='majabeed')controller.setContext(null);return;}
  const c=ensure();if(!c)return;views.majabeed=s;const user=account(),friendly=!!s?.room&&s.active===true&&!/^(pub-|cm-|lg-|tourn)/.test(s.room)&&!s.cup&&!s.league&&!s.tournament&&!s.pendingTier&&!s.lobby?.tier?.fee&&s.view?.isFriendlySession!==false&&s.view?.isFriendly!==false;
  const seated=!!s?.you&&Array.isArray(s.seats)&&s.seats.includes(s.you)&&!s.spectateOnly;
  c.setContext({game:'majabeed',roomId:s?.room,accountId:user?.uid,playerId:s?.you,eligible:friendly&&seated,connected:s?.stateReady===true,returnBlocked:root.UISessionReturn?.blocked('majabeed')===true});paint(c.snapshot());
 }
 function syncSakka(s,connected=true){
  const table=document.getElementById('blGame');if(!table||table.hidden||table.classList.contains?.('hidden')){if(controller?.snapshot().context?.game==='sakka')controller.setContext(null);return;}
  const c=ensure();if(!c)return;views.sakka=s;const user=account(),seat=s?.seats?.[s?.me];
  c.setContext({game:'sakka',roomId:s?.room,accountId:user?.uid,playerId:seat?.uid,eligible:s?.mode==='friendly'&&s.me>=0&&seat?.uid===user?.uid&&!seat?.bot&&!seat?.vacant,connected:connected===true,returnBlocked:root.UISessionReturn?.blocked('baloot')===true});paint(c.snapshot());
 }
 function button(label,action,svg='',disabled=false,pressed){return '<button type="button" data-voice="'+action+'"'+(disabled?' disabled':'')+(typeof pressed==='boolean'?' aria-pressed="'+pressed+'"':'')+' aria-label="'+E(label)+'">'+(svg?icon(svg):'')+'<span>'+E(label)+'</span></button>';}
 function closePanel(){opened=false;reportDraft=null;panel?.remove();panel=null;panelModel='';lastFocus?.focus?.({preventScroll:true});lastFocus=null;}
 function reportTarget(s,id){return s.participants?.find(p=>p.playerId===id&&p.playerId!==s.context?.playerId);}
 function validReport(s,draft=reportDraft){return !!draft&&draft.contextKey===key(s.context)&&!!reportTarget(s,draft.playerId);}
 function changeReport(e){
  if(!e.target?.matches?.('[data-voice-reason]')||!controller)return;
  const s=controller.snapshot();if(!validReport(s)||reportDraft.submitting)return;
  reportDraft.reason=Object.hasOwn(reportReasons,e.target.value)?e.target.value:'';reportDraft.error='';paint(s);
 }
 async function submitReport(s){
  const draft=reportDraft;if(!validReport(s,draft)||draft.submitting||s.pending||!Object.hasOwn(reportReasons,draft.reason))return;
  draft.submitting=true;draft.error='';paint(s);
  const ok=await controller.action('report',{targetPlayerId:draft.playerId,reason:draft.reason});
  if(reportDraft!==draft||!validReport(controller.snapshot(),draft))return;
  if(ok)reportDraft=null;else{draft.submitting=false;draft.error='تعذّر إرسال البلاغ؛ احتفظنا بالسبب لتعيد المحاولة.';}
  paint(controller.snapshot());
 }
 function handle(e){
  const b=e.target.closest('[data-voice]');if(!b||b.disabled||!controller)return;e.preventDefault();e.stopPropagation();
  const s=controller.snapshot(),action=b.dataset.voice;
  if(action==='panel'){opened=true;lastFocus=b;paint(s);panel?.querySelector('button')?.focus();}
  else if(action==='close')closePanel();
  else if(action==='join')controller.join();else if(action==='leave')controller.leave();
  else if(action==='mic')controller.microphone(!s.microphone);else if(action==='sound')controller.playback(!s.playback);
  else if(action==='accept')controller.acceptRules();else if(action==='settings')controller.action('settings',{enabled:!s.enabled});
  else if(action==='mute')controller.mute(b.dataset.player,b.dataset.muted!=='true');
  else if(action==='block')controller.action('block',{targetPlayerId:b.dataset.player,blocked:b.dataset.blocked!=='true'});
  else if(action==='report'&&reportTarget(s,b.dataset.player)){
   reportDraft={contextKey:key(s.context),playerId:b.dataset.player,reason:'',submitting:false,error:''};paint(s);panel?.querySelector('[data-voice-reason]')?.focus();
  }else if(action==='report-cancel'){reportDraft=null;paint(s);}
  else if(action==='report-submit')submitReport(s);
  else if(action==='kick')controller.action('kick',{targetPlayerId:b.dataset.player});
 }
 const shown=el=>!!el&&!el.hidden&&!el.closest?.('[hidden],.hidden')&&!!el.getClientRects().length;
 function placeToolbar(s){
  const majabeed=s.context.game==='majabeed',lobby=majabeed?document.querySelector('#onlWait:not(.hidden) .uiLobbyShell'):document.querySelector('#blGame[data-phase="lobby"] .blLobbyFooter');
  let host=null,anchor=null,lobbyRow=false;
  if(shown(lobby)){host=lobby;anchor=lobby.querySelector(majabeed?'.uiLobbyFooter':'.blLobbyStart');lobbyRow=true;}
  else{
   // Gameplay controls may still have a layout box behind the lobby overlay.
   const lobbyVisible=majabeed?shown(document.getElementById('onlWait')):shown(document.querySelector('#blGame[data-phase="lobby"]'));
   if(!lobbyVisible)host=majabeed?document.querySelector('#onl:not(.hidden) #oActions'):document.querySelector('#blGame:not([hidden]) .blActions');
   if(!shown(host))host=null;
  }
  if(toolbar.parentElement!==host)toolbar.parentElement?.classList.remove('mjVoiceHost');
  if(!host){toolbar.remove();closePanel();return false;}
  if(toolbar.parentElement!==host){if(anchor&&host.insertBefore)host.insertBefore(toolbar,anchor);else host.append(toolbar);}
  if(!lobbyRow)host.classList.add('mjVoiceHost');
  toolbar.dataset.inline=lobbyRow?'lobby':'true';return true;
 }
 function isSpeaking(s,p){return s.playback!==false&&p.uid>0&&!p.blocked&&!p.muted&&(s.speaking||[]).includes(p.uid);}
 function personButton(p,action,label,disabled=false,pressed){
  return '<button type="button" data-voice="'+action+'" data-player="'+E(p.playerId)+'" data-muted="'+(p.muted===true)+'" data-blocked="'+(p.blocked===true)+'"'+(disabled?' disabled':'')+(typeof pressed==='boolean'?' aria-pressed="'+pressed+'"':'')+' aria-label="'+E(label+' · '+p.name)+'">'+(action==='mute'?icon('sound'):'')+'<span>'+E(label)+'</span></button>';
 }
 function reportHTML(s,p){
  if(!validReport(s)||reportDraft.playerId!==p.playerId)return '';
  const d=reportDraft;
  return '<div class="mjVoiceReport" role="group" aria-label="بلاغ عن '+E(p.name)+'"><label for="mjVoiceReportReason">سبب البلاغ عن '+E(p.name)+'</label><select id="mjVoiceReportReason" data-voice-reason'+(d.submitting?' disabled':'')+'><option value="">اختر سبب البلاغ</option>'+Object.entries(reportReasons).map(([value,label])=>'<option value="'+value+'"'+(value===d.reason?' selected':'')+'>'+label+'</option>').join('')+'</select><p class="mjVoiceReportHint">اختر السبب ثم اضغط إرسال البلاغ.</p>'+(d.error?'<p role="status" class="mjVoiceReportError">'+E(d.error)+'</p>':'')+'<div>'+button(d.submitting?'جارٍ الإرسال…':'إرسال البلاغ','report-submit','',d.submitting||s.pending||!Object.hasOwn(reportReasons,d.reason))+button('إلغاء','report-cancel','',d.submitting)+'</div></div>';
 }
 function personHTML(s,p,joined){
  const mine=p.playerId===s.context.playerId,status=mine?'أنت':p.blocked?'محظور صوتيًا':p.muted?'صوته مكتوم لديك':p.joined?'في المجموعة':'لم ينضم بعد';
  return '<article data-voice-user="'+(p.uid||'')+'"><div class="mjVoicePersonHead"><span class="mjVoicePersonAvatar'+(isSpeaking(s,p)?' speaking':'')+'" aria-hidden="true">'+E(Array.from(p.name||'لاعب')[0])+'</span><div class="mjVoicePersonName"><b>'+E(p.name)+'</b><small>'+E(status)+'</small></div>'+(!mine?personButton(p,'mute',p.muted?'إلغاء الكتم':'كتم الصوت',s.pending||!joined||!p.uid||p.blocked,p.muted):'')+'</div>'+(!mine?'<nav aria-label="خيارات '+E(p.name)+'">'+personButton(p,'block',p.blocked?'إلغاء الحظر':'حظر الصوت',s.pending,p.blocked)+personButton(p,'report','إبلاغ',s.pending)+(s.canManage?personButton(p,'kick','إزالة من الصوت',s.pending):'')+'</nav>':'')+reportHTML(s,p)+'</article>';
 }
 function paint(s){
  last=s;if(reportDraft&&!validReport(s))reportDraft=null;
  if(!visible(s)||!runtime()||!plugin()){toolbar?.parentElement?.classList.remove('mjVoiceHost');toolbar?.remove();toolbar=null;toolbarModel='';closePanel();paintSpeakers({participants:[]});return;}
  if(!toolbar){toolbar=document.createElement('aside');toolbar.id='mjFriendlyVoice';toolbar.setAttribute('aria-label','المجموعة الصوتية');toolbar.addEventListener('click',handle);}
  toolbar.dataset.game=s.context.game;
  if(!placeToolbar(s)){paintSpeakers({participants:[]});return;}
  const joined=['joined','reconnecting'].includes(s.phase),lobby=toolbar.dataset.inline==='lobby';
  const nextToolbar=JSON.stringify([joined,s.microphone,s.canManage,s.enabled,s.pending,lobby]);
  if(toolbarModel!==nextToolbar||!toolbar.firstChild){
   toolbarModel=nextToolbar;
   toolbar.innerHTML=button('المجموعة الصوتية','panel','group',false,joined)+(lobby?'<div class="mjVoiceLobbyLabel"><b>المجموعة الصوتية</b><small>'+(s.enabled?(joined?'أنت متصل':'متاحة للاعبي الطاولة'):'المحادثة مغلقة')+'</small></div>'+(s.canManage?button(s.enabled?'إيقاف المحادثة':'السماح بالمحادثة','settings','',s.pending,s.enabled):''):'');
  }
  toolbar.dataset.live=String(s.microphone);toolbar.dataset.connected=String(joined);paintSpeakers(s);
  if(!opened)return;
  if(!panel?.isConnected){
   panel=document.createElement('section');panel.id='mjVoicePanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','mjVoiceTitle');panel.addEventListener('click',handle);panel.addEventListener('change',changeReport);(document.getElementById('frame')||document.body).append(panel);
   panel.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel();if(e.key==='Tab'){const list=[...panel.querySelectorAll('button:not(:disabled),select:not(:disabled)')],first=list[0],end=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end?.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first?.focus();}}});
  }
  const nextPanel=JSON.stringify({...s,speaking:[],context:s.context,reportDraft});
  if(panelModel===nextPanel){for(const el of panel.querySelectorAll('[data-voice-user]')){const p=s.participants.find(p=>p.uid===Number(el.dataset.voiceUser));el.querySelector('.mjVoicePersonAvatar')?.classList.toggle('speaking',!!p&&isSpeaking(s,p));}return;}panelModel=nextPanel;
  const active=document.activeElement,focus=active&&panel.contains(active)?{action:active.dataset.voice,player:active.dataset.player,reason:active.matches?.('[data-voice-reason]')}:null,scroll=panel.querySelector('.mjVoiceCard')?.scrollTop||0;
  panel.innerHTML='<div class="mjVoiceCard"><header><div><small>مع لاعبي طاولتك</small><h2 id="mjVoiceTitle">المجموعة الصوتية</h2></div>'+button('إغلاق','close')+'</header><p class="mjVoiceHelp">يبدأ المايك مغلقًا. تحكّم في صوتك وصوت اللاعبين، وغادر المجموعة متى أردت.</p>'+(s.canManage?'<div class="mjVoiceSetting"><div><b>السماح بالمحادثة الصوتية</b><small>أنت منشئ الجلسة</small></div>'+button(s.enabled?'إيقاف':'السماح','settings','',s.pending,s.enabled)+'</div>':'')+
   (!s.accepted?'<div class="mjVoiceConsent"><p>أوافق على تجنّب الإساءة والتهديد ومشاركة المعلومات الخاصة، وعلى قواعد المحادثة. يمكن الإبلاغ عن المخالفات وحظر أصحابها.</p>'+button('أوافق على قواعد المحادثة','accept')+'</div>':'')+
   '<div class="mjVoiceMain">'+(joined?button(s.microphone?'إغلاق المايك':'تشغيل المايك','mic',s.microphone?'mic':'off',s.pending||s.phase!=='joined',s.microphone)+button(s.playback?'كتم الجميع':'سماع الجميع','sound','sound',s.phase!=='joined',s.playback)+button('مغادرة المجموعة','leave'):button(s.phase==='connecting'?'جارٍ الاتصال…':'الانضمام للمجموعة الصوتية','join','group',!s.accepted||!s.enabled||!s.available||s.pending))+'</div><p class="mjVoiceStatus" role="status">'+E(s.error||s.notice||(s.phase==='reconnecting'?'إعادة الاتصال بالصوت…':!s.enabled?'المحادثة مغلقة؛ يستطيع منشئ الجلسة السماح بها.':joined?(s.microphone?'المايك يعمل؛ يسمعك لاعبو الطاولة.':'أنت في المجموعة؛ المايك مغلق.'):'انضم عند رغبتك في سماع اللاعبين.'))+'</p><div class="mjVoicePeople">'+s.participants.map(p=>personHTML(s,p,joined)).join('')+'</div></div>';
  if(focus?.reason)panel.querySelector('[data-voice-reason]')?.focus({preventScroll:true});
  else if(focus?.action)for(const el of panel.querySelectorAll('[data-voice]'))if(el.dataset.voice===focus.action&&el.dataset.player===focus.player){el.focus({preventScroll:true});break;}
  const card=panel.querySelector('.mjVoiceCard');if(card)card.scrollTop=scroll;
 }
 function paintSpeakers(s){
  document.querySelectorAll('[data-mj-voice-speaking]').forEach(el=>el.removeAttribute('data-mj-voice-speaking'));
  for(const p of s.participants||[]){if(!isSpeaking(s,p))continue;
   if(s.context?.game==='majabeed'){
    const v=views.majabeed,seats=v?.view?.seats||v?.seats||[],seat=seats.indexOf(p.playerId),count=seats.length,base=Math.max(0,seats.indexOf(v?.you)),index=(seat-base+count)%count;
    const ids=count===6?['oIdent','oSeatR','oSixSeat2','oSeat','oSixSeat4','oSeatL']:['oIdent','oSeatR','oSeat','oSeatL'];
    if(seat>=0){
     document.getElementById(ids[index])?.querySelector('.avaWrap,.ava')?.setAttribute('data-mj-voice-speaking','true');
     document.querySelector('#lobbyPlayers .lobbyRow[data-seat="'+seat+'"] .lr-ava')?.setAttribute('data-mj-voice-speaking','true');
    }
   }else if(s.context?.game==='sakka'){
    const seat=views.sakka?.seats?.findIndex(p2=>p2?.uid===p.playerId);
    if(seat>=0)for(const selector of ['.blSeat[data-seat="'+seat+'"] .blAvatarFrame','.blLobbySeat[data-seat="'+seat+'"] .blAvatar'])document.querySelector('#blGame '+selector)?.setAttribute('data-mj-voice-speaking','true');
   }
  }
 }
 root.MajabeedFriendlyVoice=Object.freeze({syncMajabeed,syncSakka,disconnect:game=>{if(!controller)return;const s=controller.snapshot();if(!game||s.context?.game===game)controller.setContext(null);},suspend:()=>controller?.suspend(),deferLifecycle:source=>controller?.deferLifecycle(source)===true,resumeLifecycle:()=>controller?.resumeLifecycle(),getController:()=>controller});
})(typeof window==='object'?window:globalThis);
