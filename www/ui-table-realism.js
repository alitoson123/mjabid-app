/* V416: presentation only. Existing card input and server rules remain authoritative. */
window.MajabeedTableRealism=(()=>{
 'use strict';
 function handMetrics(count,width=innerWidth,height=innerHeight){
  if(count>10){
   const tiny=height<=620,short=height<=740,cardW=tiny?52:short||width<350?58:62;
   const cardH=Math.round(cardW*101/72*10)/10,stepY=tiny?31:short?44:54,top=tiny?1:short?3:4,bottom=tiny?4:short?5:6;
   return {cardW,cardH,stepY,top,block:Math.ceil(top+stepY+cardH+bottom),zoom:tiny?1.04:1.06};
  }
  return {cardW:72,cardH:101,stepY:0,block:117};
 }
 const rowHeight=(count=ONL.view?.myHand?.length||16,width=document.getElementById('oHand')?.clientWidth||innerWidth)=>handMetrics(count,width).block;
 function handCorner(el,card){
  let corner=el.querySelector(':scope > .uiHandCorner');
  if(!corner){corner=document.createElement('span');corner.className='uiHandCorner';corner.setAttribute('aria-hidden','true');corner.append(document.createElement('b'),document.createElement('small'));el.append(corner);}
  const rank=Number(el.dataset.rank),name=rank===99?'★':({11:'J',12:'Q',13:'K',14:'A'}[rank]||String(rank));
  corner.children[0].textContent=name;corner.children[1].textContent=rank===99?'★':card?.suit||'';
 }
 function overlapLayout(el,count,cards,host){
  const width=el.clientWidth||host?.clientWidth||innerWidth,m=handMetrics(count,width),topCount=Math.ceil(count/2),rows=[topCount,count-topCount];
  for(const [name,value]of Object.entries({'--ui-hand-card-w':m.cardW,'--ui-hand-card-h':m.cardH,'--ui-hand-block':m.block}))host?.style.setProperty(name,value+'px');
  host?.style.setProperty('--ui-hand-zoom',String(m.zoom));
  const handRect=el.getBoundingClientRect(),scale=handRect.width/(el.clientWidth||1)||1;
  const avoidRails=innerHeight<=740&&!host?.classList.contains('uiSixTable');
  const piles=avoidRails?[...host.querySelectorAll(host.id==='onl'?'#oSeatL .pileBox,#oSeatR .pileBox':'#seatL .pileBox,#seatR .pileBox')].filter(p=>p.querySelector('.card')).map(p=>p.getBoundingClientRect()):[];
  const bounds=rows.map((n,row)=>{
   let left=12,right=width-12;const top=handRect.top+(m.top+row*m.stepY)*scale,bottom=top+m.cardH*scale;
   for(const pile of piles){
    if(bottom<=pile.top-4||top>=pile.bottom+4)continue;
    if(pile.left+pile.width/2<handRect.left+handRect.width/2)left=Math.max(left,(pile.right-handRect.left)/scale+8);
    else right=Math.min(right,(pile.left-handRect.left)/scale-8);
   }
   return {left,right,step:n>1?Math.min(44,(right-left-m.cardW)/(n-1)):0};
  });
  const source=host?.id==='onl'?(window.MajabeedFinale?.presentation()?.view?.myHand||ONL.view?.myHand||[]):G.players?.[0]?.hand||[];
  const byId=new Map(source.map(c=>[String(c.id),c]));
  cards.forEach((c,i)=>{const row=i<topCount?0:1,col=row?i-topCount:i,n=rows[row],b=bounds[row];
   c.style.setProperty('--ui-row-x',((b.left+b.right-m.cardW)/2+((n-1)/2-col)*b.step)+'px');
   c.style.setProperty('--ui-row-y',(m.top+row*m.stepY)+'px');
   // In RTL, the first/right card is painted above its left neighbour, leaving its rank corner exposed.
   c.style.setProperty('--ui-row-order',String(row*30+n-col));
   c.style.setProperty('--ui-card-selected-order',String(row?500:29));
   c.style.setProperty('--ui-card-lift',(row?Math.max(0,Math.min(18,m.stepY-32)):20)+'px');
   c.style.setProperty('--ui-card-bid-lift',(row?Math.max(0,Math.min(10,m.stepY-32)):10)+'px');
   handCorner(c,byId.get(c.dataset.id));
  });
 }
 function handLayout(el,count){
  const cards=[...el.querySelectorAll(':scope > .card')],double=count>10,host=el.closest('#onl,#game');
  el.classList.toggle('uiFullHand',double);host?.classList.toggle('uiFullHand',double);
  el.classList.toggle('uiTwoRowHand',double);host?.classList.toggle('uiDoubleHand',double);
  if(double){overlapLayout(el,count,cards,host);return;}
  // Restore the original one-row cards, including friendly-room sizing and overlap.
  for(const name of ['--ui-hand-card-w','--ui-hand-card-h','--ui-hand-block','--ui-hand-lift','--ui-hand-zoom'])host?.style.removeProperty(name);
  for(const name of ['--ui-hand-inset-left','--ui-hand-inset-right'])el.style.removeProperty(name);
  for(const c of cards){for(const name of ['--ui-row-x','--ui-row-y','--ui-row-order','--ui-card-lift','--ui-card-bid-lift','--ui-card-selected-order'])c.style.removeProperty(name);c.querySelector(':scope > .uiHandCorner')?.remove();}
  oldSpacing(el,count);
 }
 const oldSpacing=applyHandSpacing;
 applyHandSpacing=function(el,n){oldSpacing(el,n);handLayout(el,n);};
 const seen={identity:null,key:null};
 function audio(){
  const v=ONL.view,identity=ONL.active?ONL.room+'|'+ONL.you:null,w=ONL.status==='playing'?v?.waqf:null,c=w?.contested?.at(-1);
  const key=w&&c?String(c.id)+'|'+String(w.holder)+'|'+String(w.grabs||0):null;
  if(identity!==seen.identity){uiStopJoker();seen.identity=identity;seen.key=key;return;}
  if(key===seen.key)return;seen.key=key;uiStopJoker();
  if(c?.rank===99)uiPlayJoker(()=>ONL.active&&ONL.room+'|'+ONL.you===identity&&ONL.status==='playing'&&ONL.view?.waqf?.contested?.at(-1)?.id===c.id);
 }
 window.MajabeedRenderPipeline.registerOnline('table-realism',15,next=>function(){
  document.getElementById('onl').classList.toggle('uiDoubleHand',(ONL.view?.myHand?.length||0)>10);
  audio();const result=next.apply(this,arguments);const hand=document.getElementById('oHand');handLayout(hand,hand.querySelectorAll(':scope > .card').length);return result;
 });
 const localRender=render;render=function(){if(!G.waqf&&!G._captureView&&G.phase!=='waqf')uiStopJoker();const value=localRender.apply(this,arguments);const hand=document.getElementById('hand');handLayout(hand,hand.querySelectorAll(':scope > .card').length);return value;};
 return {handLayout,handMetrics,rowHeight};
})();
