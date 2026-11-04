/* Temporary app departure. RAM only: cold starts never restore an old table. */
(function(root){
 'use strict';
 const adapters=new Map(),records=new Map(),automatic=new Map(),GRACE_MS=60000;
 const ui=()=>root.UIConnectionQuality;
 const random=()=>root.crypto.randomUUID().replace(/-/g,'');
 const hidden=()=>document.hidden;
 function same(a,b){return !!a&&!!b&&a.uid===b.uid&&a.room===b.room&&a.match===b.match&&a.token===b.token;}
 function current(kind,record){return same(record,adapters.get(kind)?.identity());}
 function reset(kind){const r=records.get(kind);if(r)clearTimeout(r.timer);records.delete(kind);automatic.delete(kind);if(r?.shown)ui()?.hideReturnPrompt();}
 function expire(kind,reason){const r=records.get(kind),adapter=adapters.get(kind);if(!r)return;const valid=current(kind,r);reset(kind);if(valid)adapter.expire(reason||'انتهت مهلة العودة');}
 function arm(kind,r){clearTimeout(r.timer);r.timer=setTimeout(()=>{if(records.get(kind)!==r)return;if(Date.now()<r.deadline){arm(kind,r);return;}expire(kind);},Math.max(0,r.deadline-Date.now()));}
 function background(kind){
  const adapter=adapters.get(kind),old=records.get(kind);
  if(old){if(current(kind,old)){old.shown=false;old.sent=false;old.requested=false;ui()?.hideReturnPrompt();adapter.suspend();return true;}reset(kind);}
  const identity=adapter?.identity();if(!identity?.uid||!identity.room||!identity.match||!identity.token||!adapter.eligible())return false;
  const r={...identity,awayId:random(),deadline:Date.now()+GRACE_MS,lease:null,requested:false,sent:false,shown:false,timer:null};
  records.set(kind,r);automatic.delete(kind);arm(kind,r);
  adapter.away({type:'sessionAway',token:r.token,match:r.match,awayId:r.awayId});adapter.suspend();return true;
 }
 function sendConfirmation(kind,r){
  if(!r.requested||!r.lease||r.sent||hidden()||!current(kind,r))return;
  if(Date.now()>=r.deadline){expire(kind);return;}
  r.sent=adapters.get(kind).sendReturn({type:'sessionReturn',token:r.token,match:r.match,awayId:r.lease.awayId})===true;
  ui()?.setReturnPending(r.sent,r.sent?'جارٍ تأكيد عودتك إلى الطاولة…':'ننتظر الاتصال بالطاولة؛ المهلة مستمرة.');
 }
 function request(kind){const r=records.get(kind);if(!r)return;if(!current(kind,r)){reset(kind);return;}if(Date.now()>=r.deadline){expire(kind);return;}r.requested=true;ui()?.setReturnPending(true,'جارٍ الاتصال بالطاولة…');adapters.get(kind).reconnect();sendConfirmation(kind,r);}
 function show(kind,r){
  if(hidden())return;r.shown=true;
  ui()?.showReturnPrompt({deadline:r.deadline,onReturn:()=>request(kind),onLeave:()=>expire(kind,'غادرت الجلسة'),onExpire:()=>expire(kind)});
  if(r.requested)ui()?.setReturnPending(true,'جارٍ تأكيد عودتك إلى الطاولة…');
 }
 function foreground(kind){
  const r=records.get(kind);if(!r)return false;
  if(!current(kind,r)){reset(kind);adapters.get(kind)?.invalidated?.();return true;}
  if(hidden())return true;
  if(Date.now()>=r.deadline){expire(kind);return true;}
  if(!r.shown)show(kind,r);adapters.get(kind).reconnect();sendConfirmation(kind,r);return true;
 }
 function handle(kind,msg){
  const adapter=adapters.get(kind),identity=adapter?.identity();if(!identity)return false;
  const r=records.get(kind);
  if(msg.type==='sessionReturnRejected'||msg.type==='sessionReturnExpired'){
   if(r&&msg.token===r.token&&msg.match===r.match&&(!msg.awayId||msg.awayId===(r.lease?.awayId||r.awayId)))expire(kind,msg.error||msg.reason||'انتهت مهلة العودة');
   else if(!r&&msg.token===identity.token&&msg.match===identity.match){automatic.delete(kind);adapter.expire(msg.error||msg.reason||'انتهت مهلة العودة');}
   return true;
  }
  if(msg.type==='sessionReturned'){
   if(msg.token!==identity.token||msg.match!==identity.match)return true;
   if(r){if(!r.requested||!r.lease||msg.awayId!==r.lease.awayId)return true;reset(kind);adapter.resumed();}
   else if(automatic.get(kind)===msg.awayId){automatic.delete(kind);adapter.resumed();}
   return true;
  }
  if(msg.type!=='state')return false;
  const lease=msg.sessionReturn;
  if(r&&!current(kind,r)){reset(kind);adapter.invalidated?.();return true;}
  if(!lease||lease.token!==identity.token||lease.match!==identity.match||typeof lease.awayId!=='string')return false;
  if(r){
   const remaining=Number(lease.until)-Number(lease.serverNow||msg.now);
   if(Number.isFinite(remaining))r.deadline=Math.min(r.deadline,Date.now()+Math.max(0,remaining));
   if(r.shown)ui()?.updateReturnDeadline?.(r.deadline);
   const changed=r.lease?.awayId!==lease.awayId;r.lease=lease;if(changed)r.sent=false;
   if(Date.now()>=r.deadline){expire(kind);return true;}
   arm(kind,r);sendConfirmation(kind,r);
  }else if(!hidden()&&automatic.get(kind)!==lease.awayId){
   if(adapter.sendReturn({type:'sessionReturn',token:identity.token,match:identity.match,awayId:lease.awayId})===true)automatic.set(kind,lease.awayId);
  }
  return false;
 }
 function disconnected(kind){const r=records.get(kind);if(r){r.sent=false;if(r.shown)ui()?.setReturnPending(false,'تعذّر الاتصال؛ حاول مجددًا خلال المهلة.');}automatic.delete(kind);}
 function resumeFields(kind,token,match){if(!token||!match)return undefined;const r=records.get(kind);return {token,match,...(r&&r.token===token&&r.match===match?{awayId:r.lease?.awayId||r.awayId,remainingMs:Math.max(0,r.deadline-Date.now())}:{})};}
 root.UISessionReturn={configure:(kind,adapter)=>adapters.set(kind,adapter),background,foreground,handle,disconnected,reset,resumeFields,blocked:kind=>records.has(kind),token:random,GRACE_MS};
})(window);
