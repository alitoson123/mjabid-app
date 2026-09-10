/* DOM presentation only: keep existing IDs, click handlers and game actions. */
(() => {
  'use strict';
  const paths={
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    back:'<path d="m10 5 7 7-7 7M17 12H3"/>',
    exit:'<path d="M10 4H4v16h6M9 12h12m-5-5 5 5-5 5"/>',
    send:'<path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    star:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z"/>',
    cards:'<rect x="8" y="3" width="12" height="17" rx="2"/><path d="M5 6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10M14 7l3 4-3 4-3-4 3-4Z"/>',
    book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
    inbox:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
    gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8H8a3 3 0 1 1 4-3v3Zm0 0h4a3 3 0 1 0-4-3v3Z"/>',
    play:'<path d="m8 4 12 8-12 8V4Z"/><path d="M3 8v8"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-4-5.65"/>',
    trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v4m-4 3h8m-7 0v-3h6v3"/>',
  };
  const icon=name=>'<svg class="uiIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths[name]+'</svg>';
  for(const [id,name,label] of [
    ['hRules','book','قوانين اللعبة'],['hHelp','help','المساعدة'],
    ['hInbox','inbox','صندوق الوارد'],['hDaily','gift','المكافأة اليومية'],
    ['hOnl','play','لعب سريع، جماعي اثنان ضد اثنين'],['hSessions','people','الجلسات النشطة'],
    ['boardBtn','trophy','نتائج الطاولة']
  ]){
    const button=document.getElementById(id);if(!button)continue;
    button.setAttribute('aria-label',label);
    const old=button.querySelector('svg');if(old)old.outerHTML=icon(name);
  }
  for(const [id,label] of [['hProfBtn','ملفي الشخصي'],['hGoldBtn','رصيد الذهب والمتجر'],['sndBtn','الصوت'],['boardBtn','نتائج الطاولة'],['oBoardBtn','نتائج الطاولة']]){
    const el=document.getElementById(id);if(el)el.setAttribute('aria-label',id==='hGoldBtn'&&!SHOW_STORE?'رصيد الذهب':label);
  }
  if(typeof uiSoundButtons==='function')uiSoundButtons();
  for(const [id,name,label] of [
    ['chBack','back','رجوع'],['frX','back','رجوع'],['pfBack','back','رجوع'],
    ['chSend','send','إرسال الرسالة'],['chClearBtn','trash','مسح المحادثة'],
    ['rulesX','close','إغلاق القوانين']
  ]){
    const button=document.getElementById(id);if(!button)continue;
    button.innerHTML=icon(name);button.setAttribute('aria-label',label);
  }
  const addFriend=document.getElementById('frAdd');
  if(addFriend)addFriend.innerHTML=icon('people')+'<span>إضافة صديق</span>';
  document.querySelectorAll('.pfStatIc').forEach((el,i)=>{el.innerHTML=icon(['cards','trophy','star'][i]||'star');});
  const quit=document.getElementById('quitConfirm');
  if(quit&&!quit.querySelector('.uiQuitSurface')){
    const surface=document.createElement('div');surface.className='uiQuitSurface';
    while(quit.firstChild)surface.appendChild(quit.firstChild);
    quit.appendChild(surface);
    const emblem=surface.firstElementChild;if(emblem)emblem.innerHTML=icon('exit');
    quit.setAttribute('role','dialog');quit.setAttribute('aria-modal','true');
    quit.setAttribute('aria-label','تأكيد الخروج من الجولة');
  }
  const message=document.getElementById('chMsg');if(message)message.setAttribute('aria-label','نص الرسالة');
  const search=document.getElementById('afSearch');if(search){search.setAttribute('aria-label','ابحث عن صديق بالاسم أو اسم المستخدم');search.setAttribute('autocomplete','off');}
  const friendBack=document.getElementById('afBack');if(friendBack)friendBack.innerHTML=icon('back');
  const matchBack=document.getElementById('mBack');if(matchBack){matchBack.innerHTML=icon('back');matchBack.setAttribute('aria-label','إلغاء البحث والعودة');}
  const chatList=document.getElementById('chList'),newMessages=document.getElementById('uiNewMessages');
  if(chatList&&newMessages){
    newMessages.onclick=()=>{
      chatList.scrollTo({top:chatList.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      UI_CHAT_STATE.pending=0;newMessages.classList.add('hidden');
    };
    chatList.addEventListener('scroll',()=>{
      if(typeof chatListNearBottom==='function'&&chatListNearBottom(chatList)){UI_CHAT_STATE.pending=0;newMessages.classList.add('hidden');}
    },{passive:true});
  }
  const profileExit=document.getElementById('pfOut');
  if(profileExit&&SHOW_STORE){
    const button=document.createElement('button');button.id='uiAppearanceBtn';button.type='button';
    button.innerHTML=icon('cards')+'<span>خلفياتي في المتجر</span>';
    button.onclick=()=>openShop('themes');profileExit.before(button);
  }
  if(typeof applyEquippedTheme==='function')applyEquippedTheme();
  const toast=document.querySelector('#toastG span');if(toast){toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');}
  // Keyboard activation mirrors the existing click handler, including its guards.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const card=event.target.closest?.('#hand .card[role="button"],#oHand .card[role="button"]');
    if(!card||card.getAttribute('aria-disabled')==='true')return;
    event.preventDefault();card.click();
  });
})();
