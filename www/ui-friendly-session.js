/* Only the server's per-match flag controls hidden friendly results. */
window.MajabeedFriendlySession=(()=>{
 'use strict';
 const root=document.getElementById('onl');if(!root)return {};
 const hidden=()=>typeof ONL!=='undefined'&&ONL.active===true&&ONL.status==='playing'&&ONL.view?.hideScore===true;
 const notice=document.createElement('span');notice.id='uiHiddenScoreNotice';notice.hidden=true;notice.textContent='النتيجة مخفية';notice.title='تظهر النتيجة النهائية بعد انتهاء المباراة';
 const anchor=document.getElementById('oHeaderGoal');if(anchor)anchor.after(notice);
 function refresh(){
  const on=hidden();root.classList.toggle('uiFriendlyScoreHidden',on);notice.hidden=!on;
  root.querySelectorAll('.seat .pts,#oMyPile>.pts').forEach(el=>{
   if(on){el.setAttribute('aria-hidden','true');el.dataset.uiHiddenScore='1';}
   else if(el.dataset.uiHiddenScore){el.removeAttribute('aria-hidden');delete el.dataset.uiHiddenScore;}
  });
 }
 const previous=renderOnl;renderOnl=function(){
  // Set visibility before the existing renderer runs, including its early returns.
  refresh();const value=previous.apply(this,arguments);refresh();return value;
 };
 refresh();return {hidden,refresh};
})();
