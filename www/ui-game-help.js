/* Shared feedback form: keep the current table and its live connection intact. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s),form=$('#helpModal'),text=$('#helpText'),submit=$('#helpSubmit');
 if(!form||!text||!submit)return;
 const state={busy:false,account:null,kind:'bug',returnTo:null,serial:0};
 const account=()=>typeof FB!=='undefined'?FB.user?.uid||null:null;
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .4c0 1.7-2.5 2-2.5 3.6M12 16.5v.1"/></svg>';
 const status=document.createElement('p');status.id='helpStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');submit.before(status);
 const count=document.createElement('small');count.id='helpCount';text.after(count);text.maxLength=500;text.setAttribute('aria-label','تفاصيل الاقتراح أو الشكوى');text.setAttribute('aria-describedby','helpCount helpStatus');
 form.firstElementChild.classList.add('mjHelpPanel');const title=form.firstElementChild.querySelector('span');title.id='helpTitle';title.textContent='الاقتراحات والشكاوى';form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-labelledby','helpTitle');
 $('#helpClose').setAttribute('type','button');$('#helpClose').setAttribute('aria-label','العودة إلى اللعب');submit.setAttribute('type','button');
 const tabs=[...form.querySelectorAll('[data-hk]')];tabs.forEach(b=>{b.type='button';b.textContent=b.dataset.hk==='bug'?'شكوى أو مشكلة':'اقتراح';b.onclick=()=>{if(state.busy)return;state.kind=b.dataset.hk;paint();};});
 function paint(){
  text.disabled=state.busy;submit.disabled=state.busy;submit.textContent=state.busy?'جارٍ الإرسال…':'إرسال';count.textContent=text.value.length+' / 500';
  tabs.forEach(b=>{b.disabled=state.busy;b.classList.toggle('on',b.dataset.hk===state.kind);b.setAttribute('aria-pressed',String(b.dataset.hk===state.kind));});
 }
 function activeGame(){return ['blGame','onl','game'].map(id=>$('#'+id)).find(el=>el&&!el.hidden&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none');}
 function identity(){const uid=account();if(state.account!==uid){state.account=uid;text.value='';state.kind='bug';status.textContent='';}return uid;}
 function open(trigger){
  identity();state.returnTo=trigger instanceof HTMLElement?trigger:document.activeElement;form.classList.remove('hidden');
  if(!state.busy)status.textContent=activeGame()?'اللعبة مستمرة؛ أغلق النافذة للعودة إلى ورقك.':'اكتب اقتراحك أو شكواك وسنراجعها.';
  $('#helpClose').setAttribute('aria-label',activeGame()?'العودة إلى اللعب':'إغلاق المساعدة');paint();$('#helpClose').focus({preventScroll:true});
 }
 function close(){form.classList.add('hidden');if(state.returnTo?.isConnected)state.returnTo.focus({preventScroll:true});}
 $('#hHelp').onclick=e=>open(e.currentTarget);$('#helpClose').onclick=close;text.addEventListener('input',paint);
 form.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;const list=[...form.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')],first=list[0],last=list.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 });
 submit.onclick=async()=>{
  if(state.busy)return;identity();const message=text.value.trim();if(!message){status.textContent='اكتب رسالتك أولًا.';text.focus();return;}
  state.busy=true;const serial=++state.serial,uid=account(),kind=state.kind;paint();status.textContent='جارٍ إرسال رسالتك…';
  try{
   if(!(await ensureFB())||!account()||account()!==uid)throw Error('تعذّر التحقق من الدخول؛ حاول مجددًا.');
   const ok=await WBMsg.sendReport('feedback',{category:kind,text:message.slice(0,500)});
   if(account()!==uid)return;
   if(!ok)throw Error('تعذّر الإرسال؛ رسالتك محفوظة هنا، حاول مجددًا.');
   text.value='';status.textContent='وصلتنا رسالتك، شكرًا لك.';
  }catch(e){if(account()===uid)status.textContent=e.message||'تعذّر الإرسال؛ حاول مجددًا.';}
  finally{if(state.serial===serial){state.busy=false;identity();paint();}}
 };
 function mount(){
  for(const id of ['game','onl','blGame']){
   const host=$('#'+id),anchor=id==='blGame'?host?.querySelector('.blTop'):host?.querySelector('#topbar');if(!anchor||host.querySelector('[data-game-help]'))continue;
   const button=document.createElement('button');button.type='button';button.className='mjGameHelp';button.dataset.gameHelp=id;button.setAttribute('aria-label','مساعدة · الاقتراحات والشكاوى');button.title='مساعدة';button.innerHTML=icon;button.onclick=()=>open(button);
   if(id==='blGame'){
    // Put both controls in the same alignment row. Reserving their width also
    // keeps the help target clear of three-digit scores on narrow screens.
    const sound=anchor.querySelector('.blMute');
    if(!sound)continue;
    const controls=document.createElement('div');controls.className='mjSakkaTools';
    sound.before(controls);controls.append(sound,button);
   }else anchor.append(button);
  }
 }
 let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;mount();});}).observe($('#frame')||document.body,{childList:true,subtree:true});
 window.MajabeedHelp={open,close,refresh:mount};paint();mount();
})();
