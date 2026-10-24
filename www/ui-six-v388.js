/* V385: independent friendly six-seat UI. No local/four-seat rule changes. */
window.MajabeedSix=(()=>{
 const ids=['oIdent','oSeatR','oSixSeat2','oSeat','oSixSeat4','oSeatL'];
 const bubbles=['oChatBubble','oChatBubbleR','oSixBubble2','oChatBubbleT','oSixBubble4','oChatBubbleL'];
 const dirs=[{x:0,y:1},{x:.87,y:.5},{x:.87,y:-.5},{x:0,y:-1},{x:-.87,y:-.5},{x:-.87,y:.5}];
 const active=()=>typeof ONL!=='undefined'&&ONL.active&&ONL.room?.startsWith('f6-');
 const relative=pid=>{const seats=ONL.view?.seats||[],i=seats.indexOf(pid);return i<0?-1:(i-Math.max(0,seats.indexOf(ONL.you))+6)%6;};
 const avatar=pid=>document.querySelector('#'+ids[relative(pid)]+' .ava');
 function avatarArt(av,bot){
  if(bot&&(!av||av==='🤖'))return '<svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true"><path d="M20 10V6" stroke="#526e74" stroke-width="2"/><circle cx="20" cy="5" r="2.5" fill="#bb7f43"/><rect x="5" y="17" width="30" height="10" rx="3" fill="#648f9b"/><rect x="8" y="11" width="24" height="23" rx="7" fill="#9dced7" stroke="#526e74" stroke-width="1.5"/><rect x="11" y="16" width="18" height="9" rx="4" fill="#f8f0d6"/><circle cx="15" cy="20.5" r="2.3" fill="#284d59"/><circle cx="25" cy="20.5" r="2.3" fill="#284d59"/><path d="M15 29h10" stroke="#456875" stroke-width="2" stroke-linecap="round"/></svg>';
  return avatarHTML(av,32);
 }
 function timer(ava,pct,secs,urgent){
  if(!ava)return;
  const clock=ava.closest('.uiPlayerPanel')?.querySelector('.uiSixClock');
  let ring=ava.querySelector('.avaRing');
  if(!ring){ring=document.createElement('div');ring.className='avaRing';ava.appendChild(ring);}
  ring.classList.toggle('on',pct!=null);
  if(clock){const auto=pct==null&&clock.dataset.auto==='1';clock.classList.toggle('on',pct!=null||auto);clock.textContent=auto?'تلقائي':pct==null?'':secs+' ث';clock.setAttribute('aria-label',auto?'تحكم تلقائي':pct==null?'':'الوقت المتبقي: '+secs+' ثانية');clock.classList.toggle('urgent',pct!=null&&!!urgent);clock.classList.toggle('isAuto',auto);}
  if(pct==null)return;
  ring.style.setProperty('--timerPct',Math.max(0,Math.min(100,pct))+'%');
  ring.style.setProperty('--timerColor',urgent?'#e2604a':'#f6c14d');
 }
 function identity(el){
  const name=el.querySelector('.nm');
  if(name&&!name.querySelector('.uiSixClock')){const clock=document.createElement('span');clock.className='uiSixClock';name.appendChild(clock);}
  const auto=el.querySelector('.uiAutoBadge'),clock=name?.querySelector('.uiSixClock');
  if(auto&&clock){clock.dataset.auto='1';clock.classList.add('on','isAuto');clock.textContent='تلقائي';clock.setAttribute('aria-label','تحكم تلقائي');auto.remove();}
  el.classList.toggle('uiSixResuming',!!el.querySelector('#uiResumeControl'));
  const count=el.querySelector('.handCountBadge'),stats=el.querySelector('.inf');
  if(count&&stats){count.setAttribute('aria-label','عدد أوراق اليد: '+count.textContent);count.title='أوراق اليد';stats.appendChild(count);}
 }
 const root=document.getElementById('onl');
 for(const k of [2,4]){
  const seat=document.createElement('div');seat.id=ids[k];seat.className='seat sixOnly';root.appendChild(seat);
  const b=document.createElement('div');b.id=bubbles[k];b.className='hidden oppBubble sixOnly';root.appendChild(b);
 }
 const score=document.createElement('div');score.id='sixTeamScore';score.className='sixOnly';root.appendChild(score);
 function syncMode(){root.classList.toggle('uiSixTable',!!active());}
 function paintTeams(v){
  const my=Math.max(0,v.seats.indexOf(ONL.you))%2;
  const total=t=>v.seats.filter((_,i)=>i%2===t).reduce((n,p)=>n+(v.piles[p]?.points||0),0);
  score.hidden=true;
  ids.forEach((id,k)=>{const el=document.getElementById(id);el.dataset.sixTeam=String((my+k)%2);el.setAttribute('aria-label',uiPlayerName(v,v.seats[(Math.max(0,v.seats.indexOf(ONL.you))+k)%6])+' · الفريق '+(((my+k)%2)+1));});
 }
 function lobbySeats(lb){
  const slots=lb.sixSlots||Array(6).fill(null);
  return [0,1].map(t=>`<section class="sixLobbyTeam" data-six-team="${t}"><h3>الفريق ${t+1}</h3>${[t,t+2,t+4].map(i=>{
   const pid=slots[i],name=pid?(lb.names?.[pid]||'لاعب'):'مقعد متاح';
   return `<button type="button" data-six-slot="${i}" ${!ONL.seats?.includes(ONL.you)?'disabled':''} class="sixLobbySeat ${pid===ONL.you?'isYou':''}"><span>${pid?avatarHTML(lb.avatars?.[pid],36):'＋'}</span><b>${name}</b><small>${pid===ONL.you?'أنت':pid?'تبديل المقعد':'ينضم لاعب أو كمبيوتر'}</small></button>`;
  }).join('')}</section>`).join('');
 }
 function placeStock(){
  if(window.UITableHUD?.active())return UITableHUD.placeStock();
  const d=document.getElementById('oDeckStack');d.classList.remove('uiStockHidden');d.classList.add('uiStockBadge');
  const pos={x:root.clientWidth/2-19,y:Math.max(205,root.clientHeight-230),w:38,h:25};
  for(const [k,v]of Object.entries(pos))d.style.setProperty('--ui-stock-'+k,v+'px');return pos;
 }
 const originalCreate=document.getElementById('hGroup').onclick;
 document.getElementById('hGroup').onclick=()=>{
  if(!FB.user){toast2('سجّل الدخول لإنشاء الجلسة');return;}
  if(document.getElementById('sixCreateDialog'))return;
  const overlay=document.createElement('div');overlay.id='sixCreateDialog';
  overlay.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="sixCreateTitle"><button class="sixClose" aria-label="إغلاق">×</button><h2 id="sixCreateTitle">طاولة ودية</h2><p>اختر عدد اللاعبين</p><button data-format="four"><b>2 ضد 2</b><span>٤ لاعبين · فريقان</span></button><button data-format="six"><b>3 ضد 3</b><span>٦ لاعبين · فريقان · كومة مستقلة لكل لاعب</span></button><p class="sixCreateNote">تظهر رسوم الجلسة قبل البدء.</p></section>';
  const close=()=>{overlay.remove();document.getElementById('hGroup').focus();};
  overlay.querySelector('.sixClose').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close();};
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  overlay.querySelector('[data-format="four"]').onclick=()=>{close();const previousRoom=ONL.active?ONL.room:null;originalCreate();if(ONL.active&&ONL.room!==previousRoom)window.UITableHUD?.chooseFour();};
  overlay.querySelector('[data-format="six"]').onclick=async e=>{
   const btn=e.currentTarget;btn.disabled=true;overlay.querySelector('.sixCreateNote').textContent='جارٍ التحقق من جاهزية الجلسة…';
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
   try{
    const response=await fetch('https://'+GAME_SRV+'/health',{cache:'no-store',signal:controller.signal});const health=await response.json();
    if(health.tableProtocol!==385)throw Error('يجب رفع تحديث السيرفر V385 قبل إنشاء جلسات 3 ضد 3');
    if(!overlay.isConnected)return;
    close();SFX.tick();history.replaceState(null,'',location.pathname);ONL.pendingTier=null;ONL.pendingMode=null;enterOnline({createSix:true});
   }catch(err){if(overlay.isConnected){overlay.querySelector('.sixCreateNote').textContent=err.message.includes('V385')?err.message:'تعذّر التحقق من الاتصال؛ حاول مرة أخرى';btn.disabled=false;}}finally{clearTimeout(timeout);}
  };
  document.body.appendChild(overlay);overlay.querySelector('.sixClose').focus();
 };
 return {active,syncMode,ids,dirs,timer,identity,avatarArt,fieldDirs:dirs.map(d=>({x:d.x*24,y:d.y*24})),avatar,bubbleId:pid=>bubbles[relative(pid)],paintTeams,lobbySeats,placeStock};
})();

function renderOnlSix(){
  if(typeof uiSyncOnlineAudience==='function')uiSyncOnlineAudience();
  if(!ONL.active)return;
  if(typeof uiPlayerPanelsRoom==='function')uiPlayerPanelsRoom('online:'+ONL.room);
  const st=ONL.status;
  if(st==='lobby'||st==='waiting'){renderLobbySix();return}
  $('#onlWait').classList.add('hidden');
  if(st==='over'){renderOver();return}
  let v=ONL.view; if(!v)return;
  if(v.phase==='waqf'&&ONL._lastPhase!=='waqf')closeChatPanels();
  ONL._lastPhase=v.phase;
  const chatWrapEl=$('#oChatWrap'); if(chatWrapEl)chatWrapEl.style.display=(v.isFriendly&&!!v.me)?'':'none';
  if(v.lastSettle&&v.lastSettle.seq!==ONL._lastSettleSeq){
    const firstSighting=ONL._lastSettleSeq===undefined;
    ONL._lastSettleSeq=v.lastSettle.seq;
    if(!firstSighting&&!window.UICardFlow){
    ONL._holdUntil=Date.now()+380;
    GameSoundManager.playCardArrive();
    const holder=v.lastSettle.holder;
    try{
      const myI=Math.max(0,v.seats.indexOf(ONL.you));
      const rel=((v.seats.indexOf(holder)-myI)%6+6)%6;
      const u=MajabeedSix.dirs[rel]||{x:0,y:1};
      const wrap=$('#oWaqfStack')||$('#oField');
      const wr=wrap?wrap.getBoundingClientRect():{left:innerWidth/2-40,top:innerHeight/2-60,width:80,height:120};
      const cx=wr.left+wr.width/2, cy=wr.top+wr.height/2-18;
      const cardsArr=(v.lastSettle.cards||[]).slice(-6);
      cardsArr.forEach((c,i)=>{
        const j=i-(cardsArr.length-1)/2;
        const g=cardEl(c,'sm');
        g.style.position='fixed'; g.style.left=(cx-25+j*7)+'px'; g.style.top=(cy-36)+'px';
        g.style.width='51px'; g.style.height='72px'; g.style.zIndex='400'; g.style.pointerEvents='none';
        g.style.transform='rotate('+(j*4)+'deg)';
        document.body.appendChild(g);
        const anim=uiCardMotion(g,[
          {transform:'translate(0,0) rotate('+(j*4)+'deg) scale(1)',opacity:1},
          {transform:'translate('+(u.x*240)+'px,'+(u.y*240)+'px) rotate('+(j*4)+'deg) scale(.55)',opacity:0}
        ],{duration:360,easing:'cubic-bezier(.4,0,.7,1)',fill:'forwards'},true);
        if(anim)anim.onfinish=()=>{try{g.remove()}catch(_){}};
        setTimeout(()=>{try{g.remove()}catch(_){}} ,800);
      });
    }catch(e){}
    ONL._settleInfo={holder,name:v.names[holder]||'لاعب',pts:v.lastSettle.pts};
    ONL._settleWaqf={contested:v.lastSettle.cards||[],rank:v.lastSettle.rank,holder:v.lastSettle.holder,endgame:v.lastSettle.endgame};
    setTimeout(()=>{ if(ONL._holdUntil&&Date.now()>=ONL._holdUntil){ONL._holdUntil=0;ONL._settleInfo=null;ONL._settleWaqf=null;renderOnl();} },400);
    }
  }
  if(ONL._holdUntil&&Date.now()<ONL._holdUntil){
    v={...v,phase:'waqf',waqf:ONL._settleWaqf};
  }else if(ONL._holdUntil){
    ONL._holdUntil=0;
  }
  const seated=uiOnlineCanPlay();
  uiRenderSpectatorStatus(v,seated);
  ONL.viaInviteJoin=false;
  oSfxFromLog(v.log);
  {
    const fc=(v.field||[]).length;
    if(ONL._prevFieldCount!=null&&fc===ONL._prevFieldCount+1&&!(v.lastSettle&&v.lastSettle.seq!==ONL._prevSettleSeqForThrow))GameSoundManager.playActionSound();
    ONL._prevFieldCount=fc; ONL._prevSettleSeqForThrow=v.lastSettle?v.lastSettle.seq:null;
  }
  uiRenderMatchHeader(v,true);$('#uiOnlineMode').textContent='جماعي ٣ ضد ٣';
  const specEl=$('#oSpecCount');
  if(ONL.spectators>0){ $('#oSpecN').textContent=ONL.spectators; specEl.classList.remove('hidden'); }
  else specEl.classList.add('hidden');
  $('#oGoalBanner').classList.add('hidden');
  const me=ONL.you;
  const myTurn=!ONL.paymentPending&&seated&&v.phase==='turn'&&v.turn===me&&st==='playing';
  const myIdx=v.seats.indexOf(me)>=0?v.seats.indexOf(me):0;
  const seatAt=k=>v.seats[(myIdx+k)%6];
  const seatEls=Object.fromEntries([1,2,3,4,5].map(k=>[k,$('#'+MajabeedSix.ids[k])]));
  const isBot=pid=>v.humans.indexOf(pid)<0;
  const teamOf=pid=>v.seats.indexOf(pid)%2;
  const teamCombinedPts=pid=>v.mode==='team'?v.seats.filter(q=>teamOf(q)===teamOf(pid)).reduce((s,q)=>s+(v.piles[q]?v.piles[q].points:0),0):v.piles[pid].points;
  for(const k of [1,2,3,4,5]){
    const pid=seatAt(k), el=seatEls[k];
    const p=uiAuctionPile(v.phase==='waqf'?v.waqf:null,pid,v.piles[pid]);
    const hisTurn=v.phase==='turn'&&v.turn===pid;
    const mate=seated&&(v.mode==='team'&&teamOf(pid)===teamOf(me));
    const isHolder=v.phase==='waqf'&&v.waqf&&v.waqf.holder===pid;
    const holderVal=isHolder?v.waqf.contested.reduce((s,c)=>s+cardVal(c),0):0;
    const seatUid=isBot(pid)?null:(v.uids&&v.uids[pid]);
    const seatName=uiPlayerName(v,pid), seatAva=v.avatars&&v.avatars[pid];
    const pb=renderSeatCard(el,{
      turn:hisTurn,
      holderBadgeHtml:isHolder?`<div class="holderVal">${toH(holderVal)}</div>`:'',
      avaHtml:MajabeedSix.avatarArt(v.avatars&&v.avatars[pid],isBot(pid)),
      nameHtml:`${esc(seatName)}${mate?' <span style="color:var(--peach2)">(شريكك)</span>':''}`,
      autoControlled:!!(v.autoControlled&&v.autoControlled[pid]),teamScore:false,
      handCount:v.handCounts[pid],
      pts:toH(v.piles[pid]?.points||0),
      pct:goalPct(teamCombinedPts(pid),v.tierGoal),
      pileTopCard:p.top,pileCount:p.count,
      pileBadgeHtml:uiPileCountHTML(p.count),
      onAvaClick:seatUid?(()=>MiniProfile.open(seatUid,seatName,seatAva)):null
    });
    uiMarkAuctionPile(pb,p);
    if(typeof uiPaintPlayerPanel==='function')uiPaintPlayerPanel(el,{tone:v.seats.indexOf(pid),uid:seatUid,bot:isBot(pid),self:pid===ONL.you});
    MajabeedSix.identity(el);
    pb.classList.remove('stealable');pb.onclick=null;
    if(myTurn&&ONL.sel&&p.top){
      const t=p.top, opp=(v.mode!=='team')||teamOf(pid)!==teamOf(me);
      const match=(ONL.sel.rank===JOKER||t.rank===ONL.sel.rank);
      if(match&&(opp||v.allowPartner)){
        pb.classList.add('stealable');
        pb.onclick=()=>{oAction({t:'steal',cardId:ONL.sel.id,from:pid});ONL.sel=null};
      }
    }
  }
  const ds=$('#oDeckStack');ds.classList.toggle('empty',v.deckCount===0);
  ds.querySelectorAll('.card,.cnt,.lbl').forEach(e=>e.remove());
  const layers=v.deckCount===0?0:Math.min(3,Math.ceil(v.deckCount/34));
  for(let i=0;i<layers;i++){const bk=cardEl(null,'sm');bk.style.position='absolute';bk.style.top=(-i*2.5)+'px';bk.style.right=(i*2)+'px';ds.appendChild(bk)}
  if(!layers){const ph=document.createElement('div');ph.className='card sm';ph.style.opacity='.25';ds.appendChild(ph)}
  ds.insertAdjacentHTML('beforeend',`<div class="cnt">${v.deckCount}</div>`);
  if(typeof uiScheduleDrawStock==='function')uiScheduleDrawStock(true);
  const fld=$('#oField');
  const waqfActive=v.phase==='waqf'&&v.waqf;
  $('#oWaqfStack').classList.toggle('hidden',!waqfActive);
  $('#oWaqfValR').classList.add('hidden');
  $('#oWaqfCntL').classList.toggle('hidden',!waqfActive);
  $('#oWaqfBanner').classList.toggle('hidden',!waqfActive);
  if(!waqfActive)ONL._lastWaqfBannerTxt=null;
  $('#oWaqfActionWrap').classList.add('hidden');
  const kOf=pid=>{const idx=v.seats.indexOf(pid);return idx<0?0:((idx-myIdx+6)%6)};
  if(waqfActive){
    fld.innerHTML='';
    fld.style.visibility='hidden';
    clearTimeout(ONL._fieldHideTimeout);
    ONL._lastFieldMap=new Map();
    const stk=$('#oWaqfStack');stk.innerHTML='';
    const all=uiAuctionCards(v.waqf);
    ONL._stackJitter=ONL._stackJitter||new Map();
    ONL._lastStackIds=renderBidStack(stk,all,{
      jitterMap:ONL._stackJitter,
      prevIds:ONL._lastStackIds||new Set(),
      size:{w:54,h:77},
      dirForCard:c=>{
        const targetPid=c.by!=null?c.by:v.waqf.holder;
        return MajabeedSix.dirs[kOf(targetPid)];
      }
    });
  }else{
  fld.style.visibility='visible';
  ONL._lastFieldMap=renderScatterField(fld,v.field,{
    prevMap:ONL._lastFieldMap, sel:ONL.sel, myTurn,
    dirFor:seat=>MajabeedSix.fieldDirs[kOf(seat)]||MajabeedSix.fieldDirs[0],
    lastEaterSeat:v.lastEater,
    onMatchClick:f=>{const r=ONL.sel.rank===JOKER?(f.rank!==JOKER?f.rank:((v.field.find(x=>x.rank!==JOKER)||{rank:JOKER}).rank)):ONL.sel.rank;
      oAction({t:'eat',cardId:ONL.sel.id,rank:r});ONL.sel=null},
    emptyHtml:'<div id="fieldEmpty"></div>'
  });
  }
  const bottomPid=seatAt(0);
  const id=$('#oIdent');
  const bottomTurn=v.phase==='turn'&&v.turn===bottomPid;
  id.classList.toggle('turnGlow',bottomTurn);
  const auto=!!(v.autoControlled&&v.autoControlled[bottomPid]);
  const resume=seated&&auto&&v.canResumeControl===true;
  id.innerHTML=`${bottomTurn?'<div class="bubble">'+(seated?'دورك':'دوره')+'</div>':''}<div class="uiSelfName"><div class="nm">${esc(uiPlayerName(v,bottomPid))}</div>${resume?'<button id="uiResumeControl" type="button" title="إلغاء التحكم التلقائي والعودة للعب اليدوي">أستعيد التحكم</button>':auto?'<span class="uiAutoText">تحكم تلقائي</span>':''}</div><div class="ava">${seated?avatarHTML(myAvatar(),52):MajabeedSix.avatarArt(v.avatars&&v.avatars[bottomPid],isBot(bottomPid))}</div>`;
  if(typeof uiPaintPlayerPanel==='function')uiPaintPlayerPanel(id,{tone:v.seats.indexOf(bottomPid),uid:v.uids&&v.uids[bottomPid],bot:isBot(bottomPid),self:seated});
  MajabeedSix.identity(id);
  syncTargetExpressions();MajabeedSix.paintTeams(v);
  if(resume)$('#uiResumeControl').onclick=()=>{
    if(ONL.transport!=='poll'&&(!ONL.ws||ONL.ws.readyState!==1)){oToast('انتظر عودة الاتصال لاستعادة التحكم');return;}
    oSend({type:'resume-control'});
    $('#uiResumeControl').textContent='جارٍ الاستعادة…';
  };
  const myPile=uiAuctionPile(v.phase==='waqf'?v.waqf:null,bottomPid,v.piles[bottomPid]||{points:0,count:0,top:null});
  const myDisplayPts=v.piles[bottomPid]?.points||0;
  const mp=$('#oMyPile');mp.innerHTML=`<span class="pts"><i class="ptsFill" style="width:${goalPct(myDisplayPts,v.tierGoal)}%"></i><b>${toH(myDisplayPts)} <small>نقطة</small></b></span>`;
  if(myPile.top){const w2=document.createElement('div');w2.className='uiSixOwnPile';w2.appendChild(uiPileCard(myPile.top,myPile.count));
    w2.insertAdjacentHTML('beforeend',uiPileCountHTML(myPile.count));uiMarkAuctionPile(w2,myPile);mp.appendChild(w2)}else mp.insertAdjacentHTML('beforeend','<span class="sixEmpty">كومة فاضية</span>');
  const hd=$('#oHand');
  const anyTop=k=>{const pid=seatAt(k);const t=v.piles[pid].top;if(!t)return false;
    const opp=(v.mode!=='team')||teamOf(pid)!==teamOf(me);return (opp||v.allowPartner)?t:false};
  if(!(CardDrag.started&&CardDrag.pid!=null)){
  hd.innerHTML='';
  const cardTargets=c=>{
    const out=[];
    if(c.rank!==JOKER){ if(v.field.some(f=>f.rank===c.rank))out.push({t:'eat',cardId:c.id,rank:c.rank}); }
    else{ const rs=[...new Set(v.field.filter(f=>f.rank!==JOKER).map(f=>f.rank))]; for(const r of rs)out.push({t:'eat',cardId:c.id,rank:r}); if(!rs.length&&v.field.length)out.push({t:'eat',cardId:c.id,rank:JOKER}); }
    for(let k=1;k<=5;k++){const t=anyTop(k);if(t&&(c.rank===JOKER||t.rank===c.rank))out.push({t:'steal',cardId:c.id,from:seatAt(k)});}
    return out;
  };
  if(seated){
  const mh=sortHandPriority(v.myHand||[]);
  applyHandSpacing(hd,mh.length);
  for(const [i,c] of mh.entries()){
    const el=cardEl(c);
    el.style.zIndex=mh.length-i;
    if(ONL.sel&&ONL.sel.id===c.id)el.classList.add('sel');
    let canEat=false;
    if(c.rank===JOKER)canEat=v.field.length>0||[1,2,3,4,5].some(k=>anyTop(k));
    else{
      canEat=v.field.some(f=>f.rank===c.rank)
        ||[1,2,3,4,5].some(k=>{const t=anyTop(k);return t&&t.rank===c.rank});
    }
    if(myTurn&&canEat)el.classList.add('eatable');
    if(v.phase==='waqf'&&v.waqf&&seated&&v.canBid){
      const ok=c.rank===v.waqf.rank||c.rank===JOKER;
      el.classList.add(ok?'waqfPlayable':'dimmed-card');
      if(ok){
        el.onclick=()=>{SFX.tick();oAction({t:'bid',cardId:c.id})};
        attachHandCardDrag(el,c,()=>true,{waqfBid:true});
      }
      else{hd.appendChild(el);continue}
    }else{
      el.onclick=()=>{
        if(!myTurn)return;SFX.tick();
        const tg=cardTargets(c);
        if(tg.length===1&&!(ONL.sel&&ONL.sel.id===c.id)){ONL.sel=null;oAction(tg[0]);return}
        const wasSel=ONL.sel&&ONL.sel.id===c.id;
        ONL.sel=wasSel?null:c;
        if(!wasSel)closeChatPanels();
        renderOnl();
      };
      attachHandCardDrag(el,c,()=>myTurn);
    }
    hd.appendChild(el);
  }
  }
  uiPresentHand(hd);
  }
  const hint=$('#oHint'),tb=$('#oThrow'),pb2=$('#oPass');
  pb2.style.display=(myTurn&&v.canPass)?'block':'none';
  pb2.onclick=()=>oAction({t:'pass'});
  $('#oOver').classList.add('hidden');
  if(!seated){hint.innerHTML='';tb.disabled=true}
  else if(!myTurn){hint.innerHTML=v.phase==='waqf'?'':'دور <b>'+(v.names[v.turn]||'لاعب')+'</b>...';tb.disabled=true}
  else if(!ONL.sel){
    hint.innerHTML=v.forced?'<b>الأكل إجباري</b> — كل ورقك ياكل':'اختر ورقة من يدك';
    tb.disabled=true;
  }else{
    const fM=v.field.some(f=>f.rank===ONL.sel.rank)||(ONL.sel.rank===JOKER&&v.field.length>0);
    const sM=[1,2,3,4,5].some(k=>{const t=anyTop(k);return t&&(ONL.sel.rank===JOKER||t.rank===ONL.sel.rank)});
    if(fM&&sM)hint.innerHTML='المس الميدان لتاكل أو كومة مضيئة لتسرق كل مكشوفها';
    else if(fM)hint.innerHTML='المس المطابقة في الميدان لتاكلها';
    else if(sM)hint.innerHTML='المس الكومة المضيئة لتسرق كل مكشوفها';
    else if(ONL.sel.rank===JOKER)hint.innerHTML='<b>الجوكر لا يُرمى</b> — يأكل ويوقّف فقط';
    else hint.innerHTML='ما تطابق شيئاً — تقدر ترميها';
    const canThrow=ONL.sel.rank!==JOKER&&!fM&&!sM;
    tb.disabled=!canThrow;
    if((fM||sM)&&ONL.sel.rank!==JOKER)hint.innerHTML+=' · <b>الرمي مقفول لهذه الورقة</b>';
  }
  tb.onclick=()=>{if(ONL.sel&&!tb.disabled){oAction({t:'throw',cardId:ONL.sel.id});ONL.sel=null}};
  const w=v.waqf;
  const settling=!!ONL._settleInfo;
  $('#oSettleBanner').classList.add('hidden');
  if(v.phase==='waqf'&&w){
    $('#oWaqf').classList.remove('hidden');
    if(settling){
      $('#oWaqfBanner').classList.add('hidden');
      ONL._lastWaqfBannerTxt=null;
      $('#oWaqfActionWrap').classList.add('hidden');
      $('#oWaqfValR').classList.add('hidden');
      $('#oWaqfCntL').classList.add('hidden');
      $('#oWaqfStack').style.transition='opacity .2s,transform .35s';
      $('#oWaqfStack').style.opacity='0'; /* FIX — كانت .35: نسخة باهتة تبقى بمكانها تزامناً مع المستنسخات الطائرة للفائز = ازدواج بصري. صارت تختفي فوراً — الطيران وحده هو مشهد الاستقرار الآن */
      $('#oWaqfStack').style.transform='translate(-50%,-52%) scale(.82)';
      return;
    }
    $('#oWaqfStack').style.opacity='1';
    $('#oWaqfStack').style.transform='translate(-50%,-52%) scale(1)';
    const hn=v.names[w.holder]||'لاعب';
    const nmStyle='font-family:var(--fh);font-weight:400;font-size:19px;color:#ffe9b8;text-shadow:0 2px 0 rgba(0,0,0,.35);unicode-bidi:isolate';
    let srcTxt;
    if(w.grabs>0&&w.prevHolder)srcTxt=`<b style="${nmStyle}">${hn}</b> خطفها من <b style="${nmStyle}">${v.names[w.prevHolder]||'لاعب'}</b>`;
    else if(w.src==='pile')srcTxt=`<b style="${nmStyle}">${hn}</b> أكل كومة <b style="${nmStyle}">${(w.fromPids||[]).map(p=>v.names[p]).join(' و')||'خصمه'}</b>`;
    else if(w.src==='both')srcTxt=`<b style="${nmStyle}">${hn}</b> أكل من الميدان ومعها كومة <b style="${nmStyle}">${(w.fromPids||[]).map(p=>v.names[p]).join(' و')}</b>`;
    else srcTxt=`<b style="${nmStyle}">${hn}</b> أكل من الميدان`;
    if(w.endgame)srcTxt=`<div style="display:inline-block;background:#c0392b;color:#fff7ef;font-weight:800;font-size:12px;border-radius:999px;padding:2px 12px;margin-left:8px;box-shadow:0 2px 6px rgba(0,0,0,.4)">⚡ جولة ختامية</div>${srcTxt}`;
    if(srcTxt!==ONL._lastWaqfBannerTxt){
      ONL._lastWaqfBannerTxt=srcTxt;
      $('#oWaqfBannerTxt').innerHTML=srcTxt;
    }
    $('#oWaqfCntL').innerHTML=uiPileCountHTML(w.contested.length);
    const canB=seated&&v.canBid;
    hint.innerHTML=canB?'<b>وقّف!</b> — انقر أو اسحب ورقتك المُضاءة للميدان':'';
  }else $('#oWaqf').classList.add('hidden');
}
function renderLobbySix(){
  $('#onlWait').classList.remove('hidden');
  $('#oOver').classList.add('hidden');$('#oWaqf').classList.add('hidden');
  const wait=$('#onlWait');wait.classList.toggle('uiLobbyCompact',!ONL.league);
  const paidNotice=document.getElementById('uiFriendlyLobbyEconomy');if(paidNotice)paidNotice.hidden=true;
  if(ONL.league&&typeof lgRenderLobby==='function'){$('#lobbyPlayers')._uiSeatFingerprint='';uiLobbySetTab('seats');lgRenderLobby(ONL);return;}
  if(wait.dataset.uiLobbyRoom!==ONL.room){wait.dataset.uiLobbyRoom=ONL.room||'';uiLobbySetTab('seats');}
  const lb=ONL.lobby||{mode:'solo',creator:null,names:{}};
  const seats=ONL.seats||[],isCreator=!!ONL.you&&lb.creator===ONL.you;
  wait.querySelector('h2').textContent=ONL.tournament?'انتظار المباراة':'طاولة ودية · ٣ ضد ٣';
  wait.querySelector('.sub').textContent=(lb.mode==='team'?'جماعي 3×3':'فردي')+' · '+(lb.tier?.goal?'الهدف '+toH(lb.tier.goal)+' نقطة':'الرزمة كاملة');
  $('#uiLobbyCount').innerHTML='<bdi>'+seats.length+' / 6</bdi><small>لاعبون</small>';
  $('#uiLobbySeatHelp').textContent=lb.mode==='team'
    ?(seats.includes(ONL.you)&&seats.length>2?'اضغط المقعد الذي تريده لتنتقل إليه أو تتبادل المكان مع صاحبه.':'لكل فريق ثلاثة لاعبين. اضغط مقعدًا لاختيار فريقك.')
    :'كل لاعب ينافس منفردًا.';
  if(isCreator&&ONL.pendingTier&&(!lb.tier||lb.tier.key!==ONL.pendingTier.key)){
    withIdToken({type:'config',mode:ONL.pendingMode||'solo',tier:ONL.pendingTier}).then(oSend);
  }
  if(lb.tier&&lb.tier.fee){
    let tb=$('#lobbyTierTag');
    if(!tb){tb=document.createElement('div');tb.id='lobbyTierTag';tb.style.cssText='margin-top:10px;background:var(--clay);color:#fff;border-radius:99px;padding:6px 16px;font-family:var(--fh);font-size:15px;display:flex;align-items:center;gap:8px';
      const anchor=$('#lobbyMode');if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(tb,anchor.nextSibling);}
    tb.innerHTML=`الساحة ${lb.tier.name} · دخول <bdi>${toH(lb.tier.fee)}</bdi> ${uiGoldCoin()} · صافي الربح عند الفوز <bdi dir="ltr">${tierNetLabel(lb.tier.fee,lb.tier.win)}</bdi> ${uiGoldCoin()} · يُضاف عند الفوز <bdi>${toH(lb.tier.win)}</bdi> ذهب إجمالًا`;
    tb.style.display='flex';
  }else if(lb.tier&&lb.tier.goal){
    let tb=$('#lobbyTierTag');
    if(!tb){tb=document.createElement('div');tb.id='lobbyTierTag';tb.style.cssText='margin-top:10px;background:var(--sage);color:#fff;border-radius:99px;padding:6px 16px;font-family:var(--fh);font-size:15px;display:flex;align-items:center;gap:8px';
      const anchor=$('#lobbyMode');if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(tb,anchor.nextSibling);}
    tb.innerHTML=`🎯 الهدف: ${toH(lb.tier.goal)} نقطة`;
    tb.style.display='flex';
  }else{const tb=$('#lobbyTierTag');if(tb)tb.style.display='none';}
  let economy=document.getElementById('uiFriendlyLobbyEconomy');
  const friendlyPolicy=!ONL.league&&!ONL.tournament&&!lb.tier?.fee&&uiFriendlyEconomy(lb.friendlyEconomy||ONL.friendlyEconomy);
  if(friendlyPolicy){
    if(!economy){economy=document.createElement('div');economy.id='uiFriendlyLobbyEconomy';economy.style.cssText='padding:12px 14px;margin:10px 0;border:1px solid #d5ba7455;border-radius:16px;background:#082c24;color:#f7e7ba;font-size:12px;line-height:1.9;text-align:center';const start=document.getElementById('lobbyStart');start.parentNode.insertBefore(economy,start);}
    economy.innerHTML='<b>رسوم الجلسة مرة واحدة</b><br>المنشئ <bdi>'+toH(friendlyPolicy.creatorFee)+'</bdi> ذهب وتشمل مقعده · كل لاعب آخر <bdi>'+toH(friendlyPolicy.entryFee)+'</bdi> ذهب<br><small>تُخصم عند أول مشاركة. لكل فائز <bdi>'+toH(friendlyPolicy.winGold)+'</bdi> ذهب في كل جولة · بلا نقاط تنافسية</small>';economy.hidden=false;
  }else if(economy)economy.hidden=true;
  for(const b of document.querySelectorAll('#lobbyMode .lmBtn')){
    b.classList.toggle('on',b.dataset.m===lb.mode);
    b.disabled=!isCreator;
    b.onclick=()=>{if(isCreator)oSend({type:'config',mode:b.dataset.m})};
  }
  const curGoalMode=(lb.tier&&lb.tier.goal)?'points':'deck';
  for(const b of document.querySelectorAll('#lobbyGoal .lmBtn')){
    b.classList.toggle('on',b.dataset.g===curGoalMode);
    b.disabled=!isCreator;
    b.onclick=()=>{
      if(!isCreator)return;
      if(b.dataset.g==='points') oSend({type:'config',tier:{key:'group-goal',name:'هدف نقاط',fee:0,win:0,goal:600}});
      else oSend({type:'config',tier:null});
    };
  }
  $('#lobbyPublic').style.display=(ONL.room&&ONL.room.startsWith('pub-'))?'none':'flex';
  for(const b of document.querySelectorAll('#lobbyPublic .lmBtn')){
    b.classList.toggle('on',(b.dataset.p==='1')===!!lb.isPublic);
    b.disabled=!isCreator;
    b.onclick=()=>{if(isCreator)oSend({type:'config',isPublic:b.dataset.p==='1'})};
  }
  const lp=$('#lobbyPlayers'),fingerprint=JSON.stringify([ONL.room,ONL.you,lb.mode,lb.creator,lb.names,lb.avatars,seats,lb.sixSlots]);
  if(lp._uiSeatFingerprint!==fingerprint){
    lp.innerHTML=MajabeedSix.lobbySeats(lb);lp._uiSeatFingerprint=fingerprint;
    lp.querySelectorAll('[data-six-slot]').forEach(b=>b.onclick=()=>oSend({type:'moveSeat',toIndex:Number(b.dataset.sixSlot)}));
  }
  $('#lobbyStart').classList.toggle('hidden',!isCreator);
  $('#lobbyHint').textContent=isCreator
    ?(seats.length<6?'يكمل الكمبيوتر المقاعد المتاحة عند البدء.':'اكتملت الطاولة. يمكنك بدء المباراة.')
    :'بانتظار بدء المباراة من منشئ الجلسة…';
  if(ONL.tournament)$('#lobbyStart').classList.add('hidden');
  if(ONL.tournament)$('#lobbyHint').textContent='مباراة البطولة تبدأ تلقائيًا عند اتصال اللاعبين الأربعة';
  uiSessionRenderStart(lb);
  const pubBtn=$('#pubInviteBtn');
  pubBtn.onclick=async()=>{
    if(pubBtn.disabled)return;
    pubBtn.disabled=true; pubBtn.textContent='...جارٍ الإرسال';
    const ok=await WBMsg.sendPublicInvite(ONL.room, lb.mode||'solo');
    if(ok){ pubBtn.textContent='✓ تم إرسال الدعوة'; setTimeout(()=>{pubBtn.textContent='دعوة في العام';pubBtn.disabled=false;},20000); }
    else { pubBtn.textContent='دعوة في العام'; pubBtn.disabled=false; toast2('تعذّر الإرسال'); }
  };
  $('#onlineFriendsBtn').onclick=showOnlineFriendsPanel;
}
function oTickSix(){
  if(!ONL.active||!ONL.view||ONL.status!=='playing'||ONL.paymentPending)return;
  const v=ONL.view;
  const avaElFor=pid=>MajabeedSix.avatar(pid);
  const allAvas=MajabeedSix.ids.map(id=>$('#'+id+' .ava'));
  let activePid=null,activeDeadline=null,activeTotal=10000;
  if(v.phase==='waqf'&&v.waqf){activePid=v.waqf.holder;activeDeadline=v.waqf.deadline-1000;activeTotal=5000}
  else if(v.phase==='turn'){activePid=v.turn;activeDeadline=v.turnDeadline;activeTotal=10000}
  const activeEl=activePid?avaElFor(activePid):null;
  for(const a of allAvas)if(a&&a!==activeEl)MajabeedSix.timer(a,null);
  if(activePid&&activeEl){
    const left=activeDeadline-oNow();
    const pct=Math.max(0,Math.min(100,left/activeTotal*100));
    const secs=Math.max(0,Math.ceil(left/1000));
    MajabeedSix.timer(activeEl,pct,secs,left<=activeTotal*0.3);
  }
  if(v.phase==='waqf'&&v.waqf){
    const left=v.waqf.deadline-oNow();
    if(left<=3200&&left>0){const s2=Math.ceil(left/1000);if(oTick._w!==s2){oTick._w=s2;SFX.tickdown()}}
    if(left<=-150&&ONL.lastAuto.settle!==v.waqf.deadline){
      ONL.lastAuto.settle=v.waqf.deadline;
      oAction({t:'settle'});
    }
  }
  const myTurn=v.phase==='turn'&&v.turn===ONL.you;
  const tl=v.turnDeadline-oNow();
  const pct=Math.max(0,tl/10000*100);
  const bar=myTurn?$('#oTimer'):$('#oTimerTop');
  const off=myTurn?$('#oTimerTop'):$('#oTimer');
  off.classList.remove('on');off.style.opacity=0;
  if(v.phase==='turn'){
    bar.classList.add('on');bar.style.opacity=1;
    bar.querySelector('.fill').style.width=pct+'%';
    bar.querySelector('.fill').style.background=tl<=3000?'var(--red)':'var(--clay3)';
    if(myTurn&&tl<=5200&&tl>0){const s2=Math.ceil(tl/1000);if(oTick._t!==s2){oTick._t=s2;SFX.tickdown()}}
    if(tl<=-250&&ONL.lastAuto.timeout!==v.turnDeadline){
      ONL.lastAuto.timeout=v.turnDeadline;
      oAction({t:'timeout'});
    }
  }else{bar.classList.remove('on');bar.style.opacity=0}
}
