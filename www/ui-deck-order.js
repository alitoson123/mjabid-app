/* Friendly Majabeed deck settings. The accepted server state is authoritative. */
window.MajabeedDeckSettings=(()=>{
 'use strict';
 const DEFAULT=[5,12,8,3,11,2,14,9,10,4,6,13,7];
 const ALL=[2,3,4,5,6,7,8,9,10,11,12,13,14];
 const number=n=>typeof toH==='function'?toH(n):String(n);
 const validRanks=r=>Array.isArray(r)&&r.length===13&&new Set(r).size===13&&r.every(n=>Number.isInteger(n)&&ALL.includes(n));
 const validBasras=n=>Number.isInteger(n)&&n>=5&&n<=32;
 function settingsOf(value){
  const mode=['fixed','custom','random'].includes(value?.mode)?value.mode:'fixed';
  return {mode,ranks:mode==='fixed'?DEFAULT.slice():validRanks(value?.ranks)?value.ranks.slice():DEFAULT.slice(),jokerCount:Number.isInteger(value?.jokerCount)&&value.jokerCount>=0&&value.jokerCount<=100?value.jokerCount:27,...(validBasras(value?.basraCount)?{basraCount:value.basraCount}:{})};
 }
 const friendly=()=>typeof ONL!=='undefined'&&ONL.active&&['lobby','waiting'].includes(ONL.status)&&ONL.room&&!ONL.room.startsWith('pub-')&&!ONL.cup&&!ONL.league&&!ONL.tournament&&!ONL.lobby?.tier?.fee&&ONL.lobby?.deckOrderEditable===true&&!!ONL.lobby.deckOrder;
 const editable=()=>friendly()&&ONL.status==='lobby'&&ONL.you&&ONL.lobby.creator===ONL.you&&!ONL.paymentPending&&!(typeof UI_SESSION_START!=='undefined'&&UI_SESSION_START.pending)&&ONL.lobby.deckOrderLocked!==true;
 const scoreEditable=()=>ONL.lobby?.hideScoreEditable===true;
 const label=rank=>rank>=10?'صورة':number(rank);
 const layoutLabel=s=>s.mode==='random'?'خلط عشوائي':s.mode==='custom'?'رص مخصص':'الرص المعتمد';
 const handCount=()=>Number.isInteger(ONL.lobby?.handCards)&&ONL.lobby.handCards>=7&&ONL.lobby.handCards<=15?ONL.lobby.handCards:9;
 const tableLabel=()=>ONL.lobby.mode==='team'?(ONL.room.startsWith('f6-')||ONL.lobby.tableFormat==='3v3'?'جماعي 3 ضد 3':'جماعي 2 ضد 2'):'فردي';
 const glyph=(kind)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({
  basras:'<rect x="8" y="3" width="12" height="17" rx="2"/><path d="m8 7-4 1v13l12-1M12 8l4 4-4 4-2-4Z"/>',
  hand:'<path d="m6 18-3-9 6-2 2 3M9 18V5h6v13m0 0 2-11 5 2-3 11Z"/><path d="M6 20h13"/>',
  dealer:'<circle cx="12" cy="7" r="3"/><path d="M6 19v-2a6 6 0 0 1 12 0v2M18 3l1 2 2 .5-2 1L18 9l-1-2.5-2-1 2-.5Z"/>',
  order:'<path d="M4 6h16M4 12h11M4 18h7m6-3 3 3-3 3m3-3h-7"/>',
  score:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M12 5v15M7 10h1m-1 5h1m8-5h1m-1 5h1"/>'
 }[kind]||'')+'</svg>';
 function summaryChip(kind,value,title,hidden=false){
  const art=kind==='joker'?'<img src="court_JOKER_v352.png" alt="" aria-hidden="true">':glyph(kind);
  return '<div class="uiDeckInfoChip'+(hidden?' isConcealed':'')+'"><span class="uiDeckChipArt" aria-hidden="true">'+art+'</span><span class="uiDeckChipText"><strong>'+value+'</strong><span>'+title+'</span></span></div>';
 }
 function rankFace(rank){
  if(rank>=10)return '<span class="uiDeckPictureArt" aria-hidden="true"><span class="uiDeckPictureSymbol">♠</span><b>صورة</b><span class="uiDeckPictureRanks" dir="ltr">10 · J · Q<br>K · A</span></span>';
  return '<img class="uiDeckCardFace" src="cards/'+rank+'D.png" alt="" aria-hidden="true" draggable="false">';
 }
 const section=document.createElement('section');section.id='uiDeckSettings';section.hidden=true;section.setAttribute('aria-label','رص الرزمة والجواكر');
 section.innerHTML='<div class="uiDeckSettingHead"><div><small>قبل البداية</small><b>تفاصيل الجلسة</b></div><button type="button" id="uiDeckEdit">تعديل الرزمة</button></div><div id="uiDeckSettingSummary" class="uiDeckSummaryGrid"></div><p id="uiDeckSettingDetails"></p><p id="uiDeckSettingHelp"></p>';
 const anchor=document.getElementById('lobbyPublic');if(!anchor)return {};
 anchor.before(section);
 const edit=section.querySelector('#uiDeckEdit'),summaryNode=section.querySelector('#uiDeckSettingSummary'),help=section.querySelector('#uiDeckSettingHelp');
 const overlay=document.createElement('div');overlay.id='uiDeckDialog';overlay.hidden=true;overlay.dir='rtl';
 overlay.innerHTML='<section class="uiDeckSheet" role="dialog" aria-modal="true" aria-labelledby="uiDeckTitle">'+
 '<header><div><small>على كيفك</small><h2 id="uiDeckTitle">جهّز رزمة اللعب</h2></div><button type="button" id="uiDeckClose" aria-label="إغلاق إعدادات الرص">×</button></header>'+
 '<div class="uiDeckSheetBody"><p id="uiDeckLegacyNote" hidden></p><div class="uiDeckOptions"><div class="uiDeckOption"><span id="uiDeckBasraLabel">عدد البواصر <small>('+number(5)+'–'+number(32)+')</small></span><div class="uiDeckStepper" role="group" aria-labelledby="uiDeckBasraLabel"><button type="button" id="uiDeckMinus" aria-label="إنقاص عدد البواصر">−</button><output id="uiDeckBasras" aria-live="polite" aria-describedby="uiDeckSizeHelp uiDeckError"></output><button type="button" id="uiDeckPlus" aria-label="زيادة عدد البواصر">+</button></div></div><label for="uiDeckJokers">عدد الجواكر<input id="uiDeckJokers" type="text" inputmode="numeric" maxlength="3" autocomplete="off" aria-describedby="uiDeckJokerHelp uiDeckError"></label><div class="uiDeckWideOption"><span id="uiDeckModeLabel">طريقة الرص</span><div id="uiDeckMode" role="group" aria-labelledby="uiDeckModeLabel"><button type="button" data-deck-mode="fixed" aria-pressed="false">المعتمد</button><button type="button" data-deck-mode="custom" aria-pressed="false">مخصص</button><button type="button" data-deck-mode="random" aria-pressed="false">عشوائي</button></div></div></div>'+
 '<p id="uiDeckSizeHelp"></p><p id="uiDeckJokerHelp">الباصرة '+number(13)+' ورقة من '+number(2)+' إلى الآكة. الجواكر من '+number(0)+' إلى '+number(100)+'، موزعة تلقائيًا.</p>'+
 '<div id="uiDeckOrderArea"><p id="uiDeckOrderHelp"></p><div id="uiDeckRanks" role="group" aria-label="ترتيب الرصة"></div><div id="uiDeckMove"><button type="button" id="uiDeckEarlier">تقديم الورقة</button><span id="uiDeckSelected" aria-live="polite"></span><button type="button" id="uiDeckLater">تأخير الورقة</button></div><button type="button" id="uiDeckReset">إعادة الترتيب المعتمد</button></div>'+
 '<p class="uiDeckExplanation" id="uiDeckExplanation"></p><label id="uiDeckScoreSetting" hidden><span><b>إخفاء النقاط أثناء اللعب</b><small>تظهر النتيجة النهائية عند نهاية الجولة.</small></span><input id="uiDeckHideScore" type="checkbox"><span class="uiDeckSwitch" aria-hidden="true"></span></label><p id="uiDeckError" role="alert"></p></div>'+
 '<footer><button type="button" id="uiDeckCancel">إلغاء</button><button type="button" id="uiDeckSave">حفظ إعدادات الجلسة</button></footer></section>';
 (document.getElementById('frame')||document.body).append(overlay);
 const get=id=>overlay.querySelector('#'+id),mode=get('uiDeckMode'),basras=get('uiDeckBasras'),jokers=get('uiDeckJokers'),ranks=get('uiDeckRanks'),move=get('uiDeckMove'),earlier=get('uiDeckEarlier'),later=get('uiDeckLater'),selectedLabel=get('uiDeckSelected'),save=get('uiDeckSave'),error=get('uiDeckError');
 let draft=null,selected=0,room=null,returnFocus=null,basraValue=10,scoreSupported=false;
 function setBasras(value){basraValue=value;basras.value=number(value);get('uiDeckMinus').disabled=value<=5;get('uiDeckPlus').disabled=value>=32;}
 function jokerValue(){
  const raw=jokers.value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
  if(!/^\d{1,3}$/.test(raw))return null;const value=Number(raw);return Number.isInteger(value)&&value>=0&&value<=100?value:null;
 }
 function validate(){
  const j=jokerValue(),b=basraValue,invalidJoker=j===null,invalidBasra=!validBasras(b);
  const seats=ONL.room?.startsWith('f6-')||ONL.lobby?.tableFormat==='3v3'?6:4,hand=ONL.lobby?.handCards;
  const perHand=Number.isInteger(hand)&&hand>=7&&hand<=15?hand:9,required=13+seats*perHand+1,total=invalidJoker||invalidBasra?null:13*b+j,short=total!==null&&total<required;
  get('uiDeckSizeHelp').textContent=total===null?'':number(b)+' بواصر = '+number(13*b)+' ورقة + '+number(j)+' جوكر = '+number(total)+' ورقة.';
  error.textContent=invalidBasra?'اختر عدد البواصر من '+number(5)+' إلى '+number(32)+'.':invalidJoker?'اكتب عدد جواكر صحيحًا من '+number(0)+' إلى '+number(100)+'.':short?'هذه الطاولة تحتاج '+number(required)+' ورقة على الأقل للميدان و'+number(seats)+' لاعبين. زِد البواصر أو الجواكر، أو قلّل عدد الورق لكل لاعب.':'';
  jokers.setAttribute('aria-invalid',String(invalidJoker));basras.setAttribute('aria-invalid',String(invalidBasra));
  const invalid=invalidJoker||invalidBasra||short;save.disabled=invalid||!editable();return !invalid;
 }
 function renderDraft(refocus=false){
  if(!draft)return;
  const custom=draft.mode==='custom';
  for(const button of mode.querySelectorAll('[data-deck-mode]'))button.setAttribute('aria-pressed',String(button.dataset.deckMode===draft.mode));
  get('uiDeckOrderArea').hidden=draft.mode==='random';move.hidden=!custom;get('uiDeckReset').hidden=!custom;
  get('uiDeckOrderHelp').textContent=custom?'اختر ورقة، ثم قدّمها أو أخّرها. خانات الصور تتبدل فيها الصور كل رصة.':'يتكرر ترتيب الأرقام وخانات الصور التالي:';
  ranks.innerHTML=draft.ranks.map((rank,i)=>'<button type="button" data-deck-rank="'+i+'" class="uiDeckRank '+(rank>=10?'isPicture ':'')+(custom&&i===selected?'isSelected':'')+'" '+(!custom?'disabled ':'')+'aria-pressed="'+(custom&&i===selected)+'" aria-label="الموضع '+number(i+1)+': '+label(rank)+'"><small class="uiDeckRankPosition" aria-hidden="true">'+number(i+1)+'</small><span class="uiDeckRankFace">'+rankFace(rank)+'</span></button>').join('');
  earlier.disabled=selected<=0;later.disabled=selected>=draft.ranks.length-1;
  selectedLabel.textContent='الموضع '+number(selected+1);
  get('uiDeckExplanation').textContent=draft.mode==='random'?'الأوراق بخلط عشوائي. يتوزع الجوكر تلقائيًا بحسب العدد الذي اخترته.':'في كل رصة عشرة وولد وبنت وشايب وآكة، وتتبدل كل صورة عن موضعها في الرصة السابقة. أشكال الأوراق عشوائية، وكل الرتب موجودة بنفس عددها.';
  validate();if(refocus)ranks.querySelector('[data-deck-rank="'+selected+'"]')?.focus();
 }
 function close(restore=true){overlay.hidden=true;draft=null;room=null;scoreSupported=false;if(restore&&returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
 function open(){
  if(!editable())return;
  returnFocus=document.activeElement;room=ONL.room;draft=settingsOf(ONL.lobby.deckOrder);selected=0;
  setBasras(draft.basraCount||10);jokers.value=String(draft.jokerCount);
  scoreSupported=scoreEditable();get('uiDeckScoreSetting').hidden=!scoreSupported;get('uiDeckHideScore').checked=ONL.lobby.hideScore===true;
  const legacy=get('uiDeckLegacyNote');legacy.hidden=validBasras(draft.basraCount);legacy.textContent='الرزمة الحالية '+number(32)+' باصرة'+(ONL.lobby.tier?.goal?'، وهدف الجلسة السابق '+number(ONL.lobby.tier.goal)+' نقطة':'')+'. عند الحفظ تعتمد البواصر المختارة وتستمر الجولة حتى نهاية اللعب بالرزمة.';
  overlay.hidden=false;renderDraft();overlay.querySelector('.uiDeckSheetBody').scrollTop=0;get('uiDeckClose').focus({preventScroll:true});
 }
 function shift(delta){
  if(!draft||draft.mode!=='custom'||!editable())return;
  const to=selected+delta;if(to<0||to>=draft.ranks.length)return;
  [draft.ranks[selected],draft.ranks[to]]=[draft.ranks[to],draft.ranks[selected]];selected=to;renderDraft(true);
 }
 function render(){
  const show=friendly();section.hidden=!show;
  const configured=show&&validBasras(ONL.lobby.deckOrder.basraCount);
  for(const id of ['lobbyGoal','lobbyGoalMode','lobbyGoalValue','lobbyTierTag']){
   const control=document.getElementById(id);if(!control)continue;
   if(show)control.setAttribute('data-ui-deck-goal-hidden','1');else control.removeAttribute('data-ui-deck-goal-hidden');
  }
  if(!show){if(!overlay.hidden)close(false);return;}
  const current=settingsOf(ONL.lobby.deckOrder),n=handCount(),b=current.basraCount||32;edit.disabled=!editable();
  summaryNode.innerHTML=summaryChip('basras',number(b),'باصرة')+summaryChip('joker',number(current.jokerCount),'جوكر')+summaryChip('hand',number(n),'لكل لاعب')+summaryChip('dealer',number(n+1),'للموزّع')+summaryChip('order',current.mode==='random'?'عشوائي':current.mode==='custom'?'مخصص':'المعتمد','الرص')+summaryChip('score',ONL.lobby.hideScore===true?'مخفية':'ظاهرة','النتيجة',ONL.lobby.hideScore===true);
  section.querySelector('#uiDeckSettingDetails').textContent=tableLabel()+' · '+layoutLabel(current)+' · '+(ONL.lobby.isPublic?'جلسة عامة':'جلسة خاصة')+' · '+(ONL.lobby.hideScore===true?'النقاط مخفية':'النقاط ظاهرة');
  help.textContent='الموزّع '+number(n+1)+' ورقة · الرزمة '+number(b*13)+' ورقة عادية + '+number(current.jokerCount)+' جوكر.'+(configured?'':ONL.lobby.tier?.goal?' جلسة سابقة بهدف '+number(ONL.lobby.tier.goal)+' نقطة؛ يُستبدل بالبواصر عند الحفظ.':' تبقى الرزمة الحالية حتى تحفظ اختيار البواصر.')+(ONL.lobby.deckOrderLocked?' اعتمدت الإعدادات لهذه الجلسة.':ONL.lobby.creator!==ONL.you?' يحددها منشئ الجلسة.':'');
  const sub=document.querySelector('#onlWait .sub');if(sub)sub.textContent=tableLabel()+' · '+number(b)+' باصرة';
  if(!overlay.hidden&&(room!==ONL.room||!editable()||(scoreSupported&&!scoreEditable())))close(false);
  else if(!overlay.hidden)validate();
 }
 edit.onclick=open;get('uiDeckClose').onclick=get('uiDeckCancel').onclick=()=>close();
 overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
 mode.addEventListener('click',event=>{const button=event.target.closest('[data-deck-mode]');if(!button||!draft||!editable()){render();return;}const value=button.dataset.deckMode;if(!['fixed','custom','random'].includes(value))return;draft.mode=value;if(draft.mode==='fixed')draft.ranks=DEFAULT.slice();selected=0;renderDraft();});
 jokers.addEventListener('input',validate);
 get('uiDeckMinus').onclick=()=>{if(!draft||!editable()||basraValue<=5)return;setBasras(basraValue-1);validate();};
 get('uiDeckPlus').onclick=()=>{if(!draft||!editable()||basraValue>=32)return;setBasras(basraValue+1);validate();};
 ranks.addEventListener('click',event=>{const button=event.target.closest('[data-deck-rank]');if(!button||!draft||draft.mode!=='custom')return;selected=Number(button.dataset.deckRank);renderDraft(true);});
 ranks.addEventListener('keydown',event=>{if(!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();shift(event.key==='ArrowUp'?-1:1);});
 earlier.onclick=()=>shift(-1);later.onclick=()=>shift(1);
 get('uiDeckReset').onclick=()=>{if(!draft)return;draft.ranks=DEFAULT.slice();selected=0;renderDraft();};
 save.onclick=()=>{
  if(!draft||room!==ONL.room||!editable()||!validate())return;
  const value={mode:draft.mode,ranks:(draft.mode==='fixed'?DEFAULT:draft.ranks).slice(),jokerCount:jokerValue(),basraCount:basraValue};
  if(!validRanks(value.ranks))return;
  const message={type:'config',tier:null,deckOrder:value};if(scoreSupported&&scoreEditable())message.hideScore=get('uiDeckHideScore').checked;
  oSend(message);close();render();
 };
 overlay.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key!=='Tab')return;
  const controls=[...overlay.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled])')].filter(node=>!node.closest('[hidden]'));
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 });
 const four=renderLobby;renderLobby=function(){const result=four.apply(this,arguments);render();return result;};
 const six=renderLobbySix;renderLobbySix=function(){const result=six.apply(this,arguments);render();return result;};
 // Render pipeline hook: deck-order.
 window.MajabeedRenderPipeline.registerOnline('deck-order',50,next=>function(){
  const result=next.apply(this,arguments);
  render();
  return result;
 });
 render();return {render,open,close,settingsOf};
})();
