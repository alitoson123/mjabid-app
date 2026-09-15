/* v365 — presentation only: spectator tools and measured draw-stock placement.
 * No game-state fields, network calls, periodic timers, or server alarms. */
'use strict';
function uiOnlineCanPlay(){
  if(typeof ONL==='undefined'||!ONL.active||ONL.status!=='playing')return false;
  const v=ONL.view,pid=ONL.you;
  return !!(v&&pid&&v.me===pid&&Array.isArray(v.seats)&&v.seats.includes(pid)&&
    Array.isArray(v.humans)&&v.humans.includes(pid)&&
    (v.viewerStatus==null||v.viewerStatus==='seated'));
}
function uiSyncOnlineAudience(){
  const root=document.getElementById('onl');if(!root)return;
  const canPlay=uiOnlineCanPlay();
  root.classList.toggle('uiSpectating',!canPlay);
  const live=typeof ONL!=='undefined'&&ONL.active&&ONL.status==='playing'&&!!ONL.view;
  const bar=document.getElementById('uiSpectatorBar');if(bar)bar.hidden=!live||canPlay;
  if(canPlay){
    const pass=document.getElementById('oPass');if(pass)pass.disabled=false;
    return;
  }
  if(typeof ONL!=='undefined')ONL.sel=null;
  // A demotion can arrive while a pointer is captured. Reset the drag before
  // renderOnl decides whether to retain the old hand DOM.
  if(typeof CardDrag!=='undefined'){
    // CardDrag is used only by attachHandCardDrag in the online hand. A
    // detached old element must be reset too, or promotion can keep skipping it.
    const el=CardDrag.el;
    if(el){
      try{if(CardDrag.pid!=null)el.releasePointerCapture(CardDrag.pid);}catch(e){}
      el.classList.remove('dragging','sel');el.style.transform=CardDrag.origT||'';
      if(CardDrag.hoverEl)CardDrag.hoverEl.classList.remove('dropHighlight');
    }
    Object.assign(CardDrag,{pid:null,started:false,card:null,el:null,ox:0,oy:0,origT:'',hoverEl:null});
  }
  for(const id of ['oChatPanel','oChatBubble'])document.getElementById(id)?.classList.add('hidden');
  document.getElementById('reactBackdrop')?.remove();
  const hand=document.getElementById('oHand');if(hand)hand.replaceChildren();
  for(const id of ['oThrow','oPass']){const b=document.getElementById(id);if(b)b.disabled=true;}
}

// Coordinates are measured relative to the game screen, including a scaled
// preview frame. CSS keeps the original safe-area anchors as the fallback.
function uiPlaceDrawStock(online){
  const get=id=>document.getElementById(id);
  const root=get(online?'onl':'game'),deck=get(online?'oDeckStack':'deckStack');
  if(!root||!deck||root.classList.contains('hidden')||!root.clientWidth||!root.clientHeight)return null;
  const frame=root.getBoundingClientRect(),sx=frame.width/root.clientWidth,sy=frame.height/root.clientHeight;
  if(!(sx>0&&sy>0))return null;
  const rect=el=>{
    if(!el)return null;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)return null;
    return {x:(r.left-frame.left)/sx,y:(r.top-frame.top)/sy,w:r.width/sx,h:r.height/sy};
  };
  const bottom=r=>r.y+r.h,right=r=>r.x+r.w;
  const left=get(online?'oSeatL':'seatL'),leftPile=left?.querySelector('.pileBox');
  const seat=rect(left),pile=rect(leftPile),own=rect(get(online?'oMyPile':'myPile')),
    ident=rect(get(online?'oIdent':'meIdent')),selfRow=rect(get(online?'oMeTop':'meTop'));
  if(!seat||!selfRow)return null;
  const field=get(online?'oField':'field'),auction=get(online?'oWaqfStack':'contested');
  const hint=get(online?'oHint':'hint');
  const obstacles=[seat,pile,own,ident,rect(get(online?'oSeat':'seatT')),rect(get(online?'oSeatR':'seatR')),
    hint?.textContent?.trim()?rect(hint):null,
    ...Array.from(field?.querySelectorAll('.card')||[],rect),
    ...Array.from(auction?.querySelectorAll('.card')||[],rect)].filter(Boolean);
  const width=root.clientWidth,height=root.clientHeight;
  const x=Math.max(10,Math.min(width-54,seat.x+10));
  const floor=Math.max(bottom(seat),pile?bottom(pile):0)+12;
  const fits=(p,gap=6)=>p.x>=6&&p.y>=6&&p.x+p.w<=width-6&&p.y+p.h<=height-6&&
    !obstacles.some(o=>p.x-(p.badge?0:4)<right(o)+gap&&p.x+p.w>o.x-gap&&p.y-(p.badge?0:5)<bottom(o)+gap&&p.y+p.h>o.y-gap);
  let chosen=null;
  // Prefer below the left opponent. A compact stock uses the same location
  // when the normal stock would reach the bottom player's identity row.
  for(const size of [[44,62],[30,42]]){
    const p={x,y:floor,w:size[0],h:size[1],badge:false};
    if(p.y+p.h<=selfRow.y-8&&fits(p)){chosen=p;break;}
  }
  // On short screens use only a measured free gap between bottom identity and
  // pile; never move or scale the player's cards to make room for this stock.
  if(!chosen&&own&&ident){
    const pair=[own,ident].sort((a,b)=>a.x-b.x),a=right(pair[0])+10,b=pair[1].x-10;
    for(const size of [[30,42],[30,24]]){
      const p={x:a+(b-a-size[0])/2,y:selfRow.y+Math.max(0,(selfRow.h-size[1])/2),w:size[0],h:size[1],badge:size[1]===24};
      if(b-a>=size[0]&&fits(p)){chosen=p;break;}
    }
  }
  // Last resort is a compact count below the left pile. This remains legible
  // without drawing a full-sized deck over another participant on tiny views.
  if(!chosen){
    const p={x,y:floor,w:30,h:24,badge:true};
    if(p.y+p.h<=selfRow.y-6&&fits(p))chosen=p;
  }
  if(!chosen){
    // A wide central auction may occupy the self-row gap. Try the remaining
    // clear table strip as a count badge, checking both other seats as well.
    for(let yy=floor;yy+24<=selfRow.y-8&&!chosen;yy+=12){
      for(let xx=10;xx+30<=width-10;xx+=16){
        const p={x:xx,y:yy,w:30,h:24,badge:true};if(fits(p)){chosen=p;break;}
      }
    }
  }
  if(!chosen){
    // Search the reserved gap below the self profile and above hand controls.
    const hand=rect(get(online?'oHand':'hand'));
    const y=bottom(selfRow)+10,limit=hand?hand.y-8:height-80;
    for(const xx of [x,width/2-15,width-46]){
      const p={x:xx,y,w:30,h:24,badge:true};if(y+24<=limit&&fits(p)){chosen=p;break;}
    }
  }
  deck.setAttribute('aria-label','رزمة السحب، '+(deck.querySelector('.cnt')?.textContent||'0')+' ورقة');
  deck.classList.toggle('uiStockHidden',!chosen);
  if(!chosen)return null; // No stale overlapping placement after an extreme resize.
  for(const [key,value] of Object.entries({x:chosen.x,y:chosen.y,w:chosen.w,h:chosen.h}))
    deck.style.setProperty('--ui-stock-'+key,Math.round(value*10)/10+'px');
  deck.classList.toggle('uiStockBadge',chosen.badge);
  return chosen;
}
const UI_DRAW_STOCK_FRAMES={local:null,online:null};
function uiScheduleDrawStock(online){
  const key=online?'online':'local';if(UI_DRAW_STOCK_FRAMES[key]!=null)return;
  UI_DRAW_STOCK_FRAMES[key]=requestAnimationFrame(()=>{UI_DRAW_STOCK_FRAMES[key]=null;uiPlaceDrawStock(online);});
}
window.addEventListener('resize',()=>{uiScheduleDrawStock(false);uiScheduleDrawStock(true);});
