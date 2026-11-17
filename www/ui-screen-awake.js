/* Screen display only: no audio session, microphone, CPU wake lock or background service. */
(function(root){
 'use strict';
 function createController({active,visible,native,wakeLock}){
  let wanted=false,generation=0,sentinel=null,pending=null,denied=false,nativeTarget,nativeTail=Promise.resolve();
  const release=lock=>{if(lock)try{Promise.resolve(lock.release()).catch(()=>{});}catch(_){}};
  function applyNative(){
   let bridge;try{bridge=native?.();}catch(_){}if(!bridge?.setEnabled){nativeTarget=undefined;return;}
   if(nativeTarget===wanted)return;nativeTarget=wanted;
   // Coalesce transitions to the latest screen state. A delayed enable must
   // finish before the matching disable; native lifecycle also clears on pause.
   nativeTail=nativeTail.catch(()=>{}).then(()=>bridge.setEnabled({enabled:wanted})).catch(()=>{nativeTarget=undefined;});
  }
  function sync(){
   const next=!!active()&&!!visible();if(next!==wanted){wanted=next;generation++;denied=false;}
   applyNative();
   if(!wanted){const old=sentinel;sentinel=null;release(old);return;}
   if(sentinel||pending||denied||!wakeLock?.request)return;
   const ticket=generation;
   pending=Promise.resolve().then(()=>wakeLock.request('screen')).then(lock=>{
    if(ticket!==generation||!wanted||!visible()){release(lock);return;}
    sentinel=lock;
    lock.addEventListener?.('release',()=>{if(sentinel===lock){sentinel=null;denied=true;}},{once:true});
   }).catch(()=>{if(ticket===generation)denied=true;}).finally(()=>{pending=null;if(ticket!==generation&&wanted)sync();});
  }
  function retry(){denied=false;sync();}
  function snapshot(){return {wanted,held:!!sentinel,pending:!!pending,denied};}
  return Object.freeze({sync,retry,snapshot,settled:()=>nativeTail});
 }
 function sceneActive(){
  const shown=id=>{const el=document.getElementById(id);return !!el&&!el.hidden&&!el.classList.contains('hidden');};
  try{
   if(['welcome','login','signup','gcomplete'].some(shown))return false;
   const local=shown('game')&&typeof G!=='undefined'&&!!G.players&&G.phase!=='end';
   const online=shown('onl')&&typeof ONL!=='undefined'&&ONL.active&&ONL.status==='playing';
   const sakka=root.MajabeedBaloot?.state;
   const other=shown('blGame')&&!!sakka?.room&&!sakka.room.closed&&!sakka.leaving&&!!sakka.state?.game&&
    (sakka.state.game.phase!=='matchEnd'||!!sakka.state.game.claimReviewUntil);
   return local||online||other;
  }catch(_){return false;}
 }
 if(typeof module==='object'&&module.exports)module.exports={createController};
 if(typeof document!=='object')return;
 let paused=false,pageHidden=false,bridge;
 function native(){
  if(bridge)return bridge;const cap=root.Capacitor;
  if(cap?.Plugins?.ScreenAwake)bridge=cap.Plugins.ScreenAwake;
  else if(cap?.isPluginAvailable?.('ScreenAwake'))bridge=cap.registerPlugin?.('ScreenAwake');
  return bridge;
 }
 const controller=createController({active:sceneActive,visible:()=>!document.hidden&&!paused&&!pageHidden,native,wakeLock:root.navigator?.wakeLock});
 document.addEventListener('visibilitychange',()=>document.hidden?controller.sync():controller.retry());
 document.addEventListener('pause',()=>{paused=true;controller.sync();});
 document.addEventListener('resume',()=>{paused=false;controller.retry();});
 root.addEventListener('pagehide',()=>{pageHidden=true;controller.sync();});
 root.addEventListener('pageshow',()=>{pageHidden=false;controller.retry();});
 document.addEventListener('pointerup',()=>{if(controller.snapshot().denied)controller.retry();},{passive:true});
 root.MajabeedScreenAwake=Object.freeze({sync:controller.sync,snapshot:controller.snapshot});
 controller.sync();
})(typeof window==='object'?window:globalThis);
