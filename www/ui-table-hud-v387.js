/* V387: table presentation only. No rules, rewards or network timers. */
window.UITableHUD=(()=>{
 const byId=id=>document.getElementById(id),root=byId('onl'),bar=root.querySelector('#topbar');
 const deck=byId('oDeckStack'),deckHome=deck.parentNode,deckNext=deck.nextSibling;
 const score=document.createElement('div');score.id='uiTeamScore';score.hidden=true;score.setAttribute('aria-label','نتيجة الفريقين والرزمة المتبقية');
 score.innerHTML='<div class="uiTeamChip" data-team="0"><span></span><bdi></bdi></div><div class="uiStockSlot"></div><div class="uiTeamChip" data-team="1"><span></span><bdi></bdi></div>';
 root.appendChild(score);
 const inset=document.createElement('div');inset.style.cssText='position:absolute;visibility:hidden;pointer-events:none;height:var(--ui-safe-bottom,0px);width:0';root.appendChild(inset);
 let pendingTeamRoom=null,requestedTeam=false,frame=0;
 const active=()=>ONL.active&&ONL.status==='playing'&&ONL.view?.mode==='team'&&!ONL.league&&!ONL.tournament;
 const set=(name,n)=>{const value=Math.round(n*10)/10+'px';if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value);};
 const text=(el,t)=>{if(el.textContent!==String(t))el.textContent=String(t);};
 function prepare(){
  const on=!!active();root.classList.toggle('uiTeamHUD',on);score.hidden=!on;
  if(on){
   if(deck.parentNode!==score.children[1])score.children[1].appendChild(deck);
   const v=ONL.view,my=Math.max(0,v.seats.indexOf(ONL.you))%2;
   for(const [i,team]of [my,1-my].entries()){
    const chip=score.children[i===0?0:2],total=v.seats.filter((_,k)=>k%2===team).reduce((n,p)=>n+(Number(v.piles[p]?.points)||0),0);
    chip.dataset.team=String(team);text(chip.querySelector('span'),'الفريق '+(team+1));text(chip.querySelector('bdi'),toH(total));chip.setAttribute('aria-label','الفريق '+(team+1)+': '+toH(total)+' نقطة');
   }
   header();layout();
  }else if(deck.parentNode!==deckHome){deckHome.insertBefore(deck,deckNext?.parentNode===deckHome?deckNext:null);deck.classList.remove('uiHudStock');}
  if(pendingTeamRoom&&ONL.room!==pendingTeamRoom){pendingTeamRoom=null;requestedTeam=false;}
  if(pendingTeamRoom===ONL.room&&ONL.status==='lobby'&&ONL.lobby?.creator===ONL.you){
   if(ONL.lobby.mode==='team'){pendingTeamRoom=null;requestedTeam=false;}
   else if(!requestedTeam){requestedTeam=true;oSend({type:'config',mode:'team'});}
  }
 }
 function header(){
  if(!active())return;
  const labels=uiMatchLabels(ONL.view);
  text(byId('uiOnlineTitle'),labels.title==='جلسة ودية'?'طاولة ودية':labels.title);
  text(byId('uiOnlineMode'),ONL.view.tableFormat==='3v3'?'3 ضد 3':'2 ضد 2');
 }
 function layout(){
  if(!active()||!root.clientHeight)return;
  const rect=root.getBoundingClientRect(),scale=rect.height/root.clientHeight||1;
  const headerBottom=(bar.getBoundingClientRect().bottom-rect.top)/scale;
  const top=headerBottom+8,hudBottom=top+36,bottom=inset.offsetHeight;
  set('--ui-score-y',top);set('--ui-score-bottom',hudBottom);
  if(!window.MajabeedSix?.active())return;
  const width=root.clientWidth,height=root.clientHeight,available=height-bottom-hudBottom-12;
  const compact=available<570,tight=available<420;
  // Larger hand only. Seats stay compact to reserve the physical table for field cards.
  const handW=tight?70:compact?80:88,handH=Math.round(handW*1.42);
  const own=tight?32:52,hint=tight?12:20,handRow=handH+16,actions=tight?38:44;
  const selfH=own+hint+handRow+actions,selfTop=height-bottom-selfH;
  const seatH=Math.min(tight?74:110,Math.max(66,Math.floor((available-selfH-16)/2)));
  const seatW=width<350?72:82,y=hudBottom+10,lower=selfTop-8-seatH;
  const offset=Math.min(40,Math.max(0,lower-y-seatH-8));
  const pileH=Math.min(48,seatH-52),pileW=Math.round(pileH/1.42);
  root.classList.add('uiSixCompact');
  root.classList.toggle('uiSixTight',tight);
  // The field and the illustrated table share one center; neither drifts with the card count.
  const tableW=Math.min(420,width-16),tableTop=Math.max(hudBottom+70,y+seatH-30),tableBottom=selfTop-8;
  const tableH=Math.max(60,tableBottom-tableTop),centerY=tableTop+tableH/2;
  const fieldH=Math.max(24,Math.min(tableH*.68,2*(centerY-y-seatH-8)));
  const fieldW=Math.max(96,width-2*(seatW+12));
  for(const [k,v]of Object.entries({'--six-seat-w':seatW,'--six-center-y':y,'--six-upper-y':y+offset,'--six-lower-y':lower,'--six-seat-h':seatH,'--six-pile-w':pileW,'--six-pile-h':pileH,'--six-self-h':selfH+bottom,'--six-own-h':own,'--six-hint-h':hint,'--six-hand-row':handRow,'--six-hand-w':handW,'--six-hand-h':handH,'--six-actions-h':actions,'--six-safe-bottom':bottom,'--six-table-y':tableTop,'--six-table-w':tableW,'--six-table-h':tableH,'--six-field-y':centerY-fieldH/2,'--six-field-w':fieldW,'--six-field-h':fieldH,'--six-caption-y':tight?selfTop-26:Math.max(y+seatH+5,centerY-fieldH/2-28)}))set(k,v);
 }
 function placeStock(){
  if(!active())return null;
  deck.classList.remove('uiStockHidden');deck.classList.add('uiStockBadge','uiHudStock');
  if(!deck.querySelector('.uiStockLabel')){const label=document.createElement('span');label.className='uiStockLabel';label.textContent='الرزمة';deck.prepend(label);}
  const count=Number(ONL.view.deckCount)||0;deck.setAttribute('aria-label','الرزمة المتبقية: '+count+' ورقة');
  const r=deck.getBoundingClientRect(),rr=root.getBoundingClientRect();return{x:r.x-rr.x,y:r.y-rr.y,w:r.width,h:r.height};
 }
 function handSpacing(hand,count){
  if(!window.MajabeedSix?.active())return false;
  const w=parseFloat(getComputedStyle(root).getPropertyValue('--six-hand-w'))||88,avail=hand.clientWidth-16;
  const step=count>1?Math.min(w+10,(avail-w)/(count-1)):w;
  hand.style.setProperty('--ov',(Math.max(10,step)-w)/2+'px');return true;
 }
 function fieldLayout(total,width,height){
  if(!total)return [];
  const w=Math.max(1,width),h=Math.max(1,height-8),desired=46;
  // Four columns on normal phones: 12 cards become three rows, at the usual field-card size.
  const cols=Math.max(1,Math.min(6,Math.floor((w+6)/(desired+6)))),rows=Math.ceil(total/cols);
  const gap=Math.min(6,h/(rows*5));
  const scale=Math.min(1,w/desired,(h-(rows-1)*gap)/(rows*66)),cw=desired*scale,ch=66*scale,out=[];
  const base=Math.floor(total/rows),extra=total%rows;
  for(let row=0;row<rows;row++){const count=base+(row<extra?1:0),step=count>1?Math.min(cw+8,(w-cw)/(count-1)):0;for(let col=0;col<count;col++)out.push({x:(col-(count-1)/2)*step,y:(row-(rows-1)/2)*(ch+gap),w:cw,h:ch,r:0,scale:1,lift:Math.min(3,gap)});}
  return out;
 }
 function finish(){
  if(active()){header();placeStock();handSpacing(byId('oHand'),byId('oHand').querySelectorAll('.card').length);}
  if(pendingTeamRoom===ONL.room&&ONL.status==='lobby'&&ONL.lobby?.mode!=='team'){byId('lobbyStart').disabled=true;text(byId('lobbyHint'),'جارٍ تجهيز طاولة 2 ضد 2…');}
  chatLayer();
 }
 function chatLayer(){const opened=!byId('oChatPanel').classList.contains('hidden');root.classList.toggle('uiChatOpen',opened);document.body.classList.toggle('uiOnlineChatOpen',opened&&!root.classList.contains('hidden'));}
 const observeChat=new MutationObserver(chatLayer);observeChat.observe(byId('oChatPanel'),{attributes:true,attributeFilter:['class']});
 const observeVisibility=new MutationObserver(()=>{const opened=!byId('oChatPanel').classList.contains('hidden');document.body.classList.toggle('uiOnlineChatOpen',opened&&!root.classList.contains('hidden'));});observeVisibility.observe(root,{attributes:true,attributeFilter:['class']});
 const resize=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(active()){layout();renderOnl();}});};
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(resize);observer.observe(root);observer.observe(bar);observer.observe(inset);}
 window.addEventListener('resize',resize);
 const original=renderOnl;renderOnl=function(){prepare();const result=original.apply(this,arguments);finish();return result;};
 return {active,prepare,layout,placeStock,handSpacing,fieldLayout,chooseFour(){pendingTeamRoom=ONL.room;requestedTeam=false;}};
})();
