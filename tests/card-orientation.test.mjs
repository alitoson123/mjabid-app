import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource,webSource} from './helpers/source.mjs';

const core=coreSource(),motion=webSource('ui-card-motion.js');
function cut(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,start);return source.slice(a,b);
}
function node(id=''){
 const classes=new Set(['card']);return {id,children:[],clientWidth:286,clientHeight:234,style:{},dataset:{},classList:{contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c);}},appendChild(child){child.parentElement=this;this.children.push(child);},remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);}};
}
function fixture(){
 const root=node('onl'),c=vm.createContext({window:{UICardFlow:{}},document:{getElementById:()=>root,hidden:false},Map,WeakMap,
  ONL:{active:true,room:'room-a',you:'p0',sessionMatch:'room-a|1'},G:{players:[]},JOKER:99,cardEl(card){const e=node();e.dataset.id=String(card.id);return e;}});
 vm.runInContext(cut(core,'function fieldLayout(','// اتجاهات دخول/خروج ورقة الميدان')+cut(core,'function renderScatterField(','// اتجاه دخول كومة')+cut(core,'function uiBidPoseHash(','function renderBidStack('),c);
 return {c,field:node('oField'),stack:node('oWaqfStack'),localField:node('field'),localStack:node('contested')};
}
const directions=[{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}];
const opts={prevMap:null,sel:null,myTurn:true,dirFor:()=>directions[0],lastEaterSeat:0,onMatchClick(){},emptyHtml:''};
const card=(id,by)=>({id,rank:5,suit:'♠',by});

test('a field card keeps zero degrees through capture and bids from every other seat',()=>{
 const {c,field,stack}=fixture(),first=card(1,undefined);
 c.renderScatterField(field,[first],opts);
 assert.equal(c.uiTableRestingAngles(field).get('1'),0);
 const cards=[first];
 for(let seat=1;seat<=4;seat++){
  // The authoritative capture may assign a new by; it must not replace a visible resting angle.
  first.by=seat%4;cards.push(card(10+seat,seat%4));
  assert.equal(c.uiBidRestingPose(stack,first,0,directions[seat%4],cards,x=>directions[x.by||0]).angle,0);
 }
 assert.equal(c.uiTableRestingAngles(field),c.uiTableRestingAngles(stack));
});

test('each new auction card retains its own initial heading as later bidders append cards',()=>{
 const {c,stack}=fixture(),cards=[];
 const angles=new Map();
 for(let index=0;index<4;index++){
  const item=card(index+20,index);cards.push(item);
  const first=c.uiBidRestingPose(stack,item,index,directions[index],cards,x=>directions[x.by]).angle;
  angles.set(item.id,first);
  for(let old=0;old<cards.length;old++)assert.equal(c.uiBidRestingPose(stack,cards[old],old,directions[(index+1)%4],cards,()=>directions[(index+1)%4]).angle,angles.get(cards[old].id));
 }
 assert.equal(new Set(angles.values()).size,4,'new cards keep distinct initial seat headings');
});

test('a cold auction snapshot reconstructs captured field faces flat and keeps each bidder heading',()=>{
 const {c,stack}=fixture(),cards=[card(1,1),card(2,1),card(3,1),card(4,3),card(5,2)];
 c.ONL.view={waqf:{grabs:2,contested:cards}};
 const poses=cards.map((item,index)=>c.uiBidRestingPose(stack,item,index,directions[item.by],cards,x=>directions[x.by]));
 assert.equal(poses[0].angle,0);assert.equal(poses[1].angle,0);
 assert.ok(Math.abs(poses[2].angle+90)<16);
 assert.ok(Math.abs(poses[3].angle-90)<16);
 assert.ok(Math.abs(poses[4].angle-180)<16);
 cards.push(card(6,0));c.ONL.view.waqf.grabs=3;
 for(let i=0;i<poses.length;i++)assert.equal(c.uiBidRestingPose(stack,cards[i],i,directions[cards[i].by],cards,x=>directions[x.by]).angle,poses[i].angle);
});

test('a newly appended card can shift contact positions but never changes an older base angle',()=>{
 const {c}=fixture(),first=card(1,1),list=[first];
 const before=c.uiBidCardPose(first,0,directions[1],list,x=>directions[x.by]);
 list.push(card(2,3),card(3,2));
 const after=c.uiBidCardPose(first,0,directions[1],list,x=>directions[x.by]);
 assert.equal(after.angle,before.angle);
 assert.ok(after.x!==before.x||after.y!==before.y,'small contact translations may remain');
});

test('resting angles survive equivalent redraw containers and reset for another round or viewer',()=>{
 const {c,field,stack}=fixture(),first=card(1,1);
 c.uiTableRestingAngles(field).set('1',0);
 assert.equal(c.uiBidRestingPose(stack,first,0,directions[1],[first]).angle,0);
 assert.equal(c.uiBidRestingPose(node('oWaqfStack'),first,0,directions[1],[first]).angle,0);
 c.ONL.sessionMatch='room-a|2';
 const next=c.uiBidRestingPose(stack,first,0,directions[1],[first]).angle;assert.notEqual(next,0);
 c.ONL.you='p2';assert.equal(c.uiTableRestingAngles(stack).has('1'),false);
 c.uiTableRestingAngles(stack).set('1',31);c.ONL.room='room-b';assert.equal(c.uiTableRestingAngles(stack).has('1'),false);
});

test('local pre-auction render keeps the field angle until auction, and a new game resets it',()=>{
 const {c,localField,localStack}=fixture(),first=card(6,undefined);
 c.renderScatterField(localField,[first],opts);c.G._captureView={contested:[first]};
 c.renderScatterField(localField,[],opts);
 first.by=3;
 assert.equal(c.uiBidRestingPose(localStack,first,0,directions[3],[first]).angle,0);
 assert.equal(c.uiTableRestingAngles(localStack),c.uiTableRestingAngles(localField));
 c.G={players:[]};assert.equal(c.uiTableRestingAngles(localStack).has('6'),false);
 assert.notEqual(c.uiBidRestingPose(localStack,first,0,directions[3],[first]).angle,0);
});

function motionFixture(){
 const c=vm.createContext({});
 vm.runInContext('const number=n=>Number.isFinite(n)?n:0;\n'+cut(motion,'  function transform(p,w,h){','  // v360:')+cut(motion,'  function actionFrames(','  // v358')+cut(motion,'  function focusFrames(','  function impactFrames('),c);
 return c;
}
const angles=frames=>frames.map(f=>Number(f.transform.match(/rotate\(([-+\d.e]+)deg\)/)[1]));

test('captured resting cards slide without rotating in any capture-animation keyframe',()=>{
 const c=motionFixture();
 for(const angle of [0,17,-87,180]){
  const from={x:40,y:70,w:46,h:66,angle},to={x:150,y:300,w:54,h:77,angle};
  const frames=c.actionFrames(from,to,{kind:'capture',keepAngle:true,throwDir:directions[1]},54,77);
  assert.ok(angles(frames).every(a=>a===angle));
 }
});

test('a card still has natural airborne movement but does not tilt again after landing',()=>{
 const c=motionFixture(),from={x:40,y:70,w:46,h:66,angle:12},to={x:150,y:300,w:54,h:77,angle:12};
 for(const kind of ['play','bid']){
  const airborne=angles(c.actionFrames(from,to,{kind,throwDir:directions[1]},54,77));
  assert.ok(airborne.some(a=>a!==12));assert.equal(airborne.at(-1),12);
 }
 assert.ok(angles(c.focusFrames(to,to,54,77)).every(a=>a===12));
});
