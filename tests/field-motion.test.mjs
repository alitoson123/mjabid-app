import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource,webSource} from './helpers/source.mjs';

const core=coreSource(),motion=webSource('ui-card-motion.js');
function cut(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
// Frozen output of the pre-V416 fieldLayout function from the verified backup.
const FIELD_BASELINE={"4":[{"x":-81,"y":0,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-27,"y":0,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":27,"y":0,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":81,"y":0,"r":0,"scale":1,"w":46,"h":66,"lift":10}],"8":[{"x":-81,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-27,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":27,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":81,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-81,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-27,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":27,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":81,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10}],"9":[{"x":-108,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-54,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":0,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":54,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":108,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-81,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-27,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":27,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":81,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10}],"12":[{"x":-120,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-72,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-24,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":24,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":72,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":120,"y":-39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-120,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-72,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":-24,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":24,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":72,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10},{"x":120,"y":39,"r":0,"scale":1,"w":46,"h":66,"lift":10}],"13":[{"x":-104.28282828282828,"y":-75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":-52.14141414141414,"y":-75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":0,"y":-75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":52.14141414141414,"y":-75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":104.28282828282828,"y":-75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":-78.2121212121212,"y":0,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":-26.07070707070707,"y":0,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":26.07070707070707,"y":0,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":78.2121212121212,"y":0,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":-78.2121212121212,"y":75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":-26.07070707070707,"y":75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":26.07070707070707,"y":75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10},{"x":78.2121212121212,"y":75.33333333333333,"r":0,"scale":1,"w":44.14141414141414,"h":63.33333333333333,"lift":10}]};
test('field positions and rows match the pre-V416 opening layout exactly',()=>{
 const c=vm.createContext({});vm.runInContext(cut(core,'function fieldLayout(','const FIELD_DIR_XY='),c);
 const rows={4:[4],8:[4,4],9:[5,4],12:[6,6],13:[5,4,4]};
 for(const [count,expected]of Object.entries(FIELD_BASELINE)){
  const actual=JSON.parse(JSON.stringify(c.fieldLayout(Number(count),286,234)));
  assert.deepEqual(actual,expected,'card count '+count);
  const ys=[...new Set(actual.map(p=>p.y))];assert.deepEqual(ys.map(y=>actual.filter(p=>p.y===y).length),rows[count]);
 }
});

const card=(id,by)=>({id,rank:5,suit:'♦',by});
const point=(x,y,angle=0)=>({x,y,w:54,h:77,angle,el:{}});
function model(overrides={}){return {id:'online',identity:'same-match',field:[],seats:['p0','p1','p2','p3'],piles:Object.fromEntries(['p0','p1','p2','p3'].map(p=>[p,{count:0,top:null}])),waqf:null,settle:null,lastEater:'p0',...overrides};}
function geometry(){return {field:new Map(),hand:new Map(),stack:new Map(),pileCards:new Map(),hands:new Map([['p0',point(200,650)],['p1',point(360,250,12)]]),piles:new Map([['p0',point(55,560)],['p1',point(360,430)]]),directions:new Map([['p0',{x:0,y:1}],['p1',{x:1,y:0}]]),center:point(200,360),deck:point(200,120)};}
function fixture(){
 const calls=[];let arrivals=0;
 const c=vm.createContext({document:{hidden:false},GameSoundManager:{playCardArrive(){arrivals++;}},
  fly(_ctx,card,from,to,options){calls.push({card,from,to,options});},capturedSources:()=>new Map(),rebind(){},
  bidLanding:(card,_cards,geo)=>geo.stack.get(String(card.id))||geo.center,
  impactVector:(from,to)=>({x:to.x-from.x,y:to.y-from.y,angle:0})});
 vm.runInContext("const key=c=>String(c.id);\n"+cut(motion,'  const claims=w=>','  const visible=')+
  cut(motion,'  function origin(','  // The bidder')+cut(motion,'  function bidOrigin(','  function bidLanding(')+
  cut(motion,'  function present(','  function around('),c);
 return {calls,arrivals:()=>arrivals,run:(before,geo,current,now)=>c.present({capture:null,paint:0,flights:new Map()},before,geo,current,now)};
}
function auction(cards,holder='p0'){return {cards,holder,from:[],grabs:Math.max(0,cards.length-2),capturePiles:[]};}

test('the newly played capture card uses the original drop while field receivers stay fixed',()=>{
 for(const id of ['online','local']){
  const f=fixture(),field=card(10),played=card(20,'p0'),geo=geometry(),now=geometry();
  geo.field.set('10',point(175,350,0));geo.hand.set('20',point(240,650));
  now.stack.set('10',point(200,360,0));now.stack.set('20',point(201,380,8));
  f.run(model({id,field:[field]}),geo,model({id,waqf:auction([field,played])}),now);
  const drop=f.calls.find(x=>x.card.id===20),receiver=f.calls.find(x=>x.card.id===10);
  assert.equal(drop.options.kind,'play');assert.equal(drop.options.duration,480);assert.equal(drop.options.spin,true);assert.equal(drop.options.land,true);
  assert.equal(drop.from,geo.hand.get('20'));assert.equal(drop.to,now.stack.get('20'));
  assert.equal(receiver.options.kind,'capture');assert.equal(receiver.options.keepAngle,true);assert.notEqual(receiver.options.spin,true);assert.equal(receiver.from.angle,receiver.to.angle);
 }
});

test('a new bid spins on entry while the two existing receivers hold their old angles',()=>{
 const f=fixture(),old=[card(10),card(20,'p0')],played=card(30,'p1'),geo=geometry(),now=geometry();
 for(const [i,c]of old.entries()){geo.stack.set(String(c.id),point(200+i,360+i,[-2,8][i]));now.stack.set(String(c.id),point(198+i,360+i,[-2,8][i]));}
 now.stack.set('30',point(204,360,-82));
 f.run(model({waqf:auction(old)}),geo,model({waqf:auction([...old,played],'p1')}),now);
 const drop=f.calls.find(x=>x.card.id===30),receivers=f.calls.filter(x=>x.card.id!==30);
 assert.equal(drop.options.kind,'bid');assert.equal(drop.options.duration,480);assert.equal(drop.options.spin,true);assert.equal(drop.from,geo.hands.get('p1'));
 assert.equal(receivers.length,2);for(const receiver of receivers){assert.equal(receiver.options.kind,'impact-hold');assert.equal(receiver.from,receiver.to);assert.notEqual(receiver.options.spin,true);assert.equal(receiver.options.receiverTo.angle,receiver.from.angle);}
});

test('an atomic final bid keeps the original entry-through-table animation only on its new card',()=>{
 const f=fixture(),old=[card(10),card(20,'p0')],played=card(30,'p1'),geo=geometry(),now=geometry();
 for(const [i,c]of old.entries())geo.stack.set(String(c.id),point(200+i,360,8*i));
 const current=model({settle:{seq:2,cards:[...old,played],holder:'p1',capturePiles:[]}});current.piles.p1={count:3,top:played};
 f.run(model({waqf:auction(old)}),geo,current,now);
 const drop=f.calls.find(x=>x.card.id===30);assert.equal(drop.options.kind,'collect');assert.equal(drop.options.duration,860);assert.equal(drop.options.spin,true);assert.equal(drop.options.viaAt,.60);assert.equal(drop.options.via,geo.center);assert.equal(drop.from,geo.hands.get('p1'));
 for(const receiver of f.calls.filter(x=>x.card.id!==30)){assert.equal(receiver.options.via,undefined);assert.notEqual(receiver.options.spin,true);}
 assert.equal(f.arrivals(),1);
});

test('a final presentation already shown never replays the airborne bid at collection',()=>{
 const f=fixture(),old=[card(10),card(20,'p0')],played=card(30,'p1'),geo=geometry(),now=geometry();
 for(const [i,c]of old.entries())geo.stack.set(String(c.id),point(200+i,360,8*i));
 const current=model({settle:{seq:2,finalPresentation:true,cards:[...old,played],holder:'p1',capturePiles:[]}});current.piles.p1={count:3,top:played};
 f.run(model({waqf:auction(old)}),geo,current,now);
 assert.equal(f.calls.length,3);for(const flight of f.calls){assert.equal(flight.options.via,undefined);assert.notEqual(flight.options.spin,true);}
});

test('an unchanged auction redraw does not replay any card drop',()=>{
 const f=fixture(),cards=[card(10),card(20,'p0')],geo=geometry(),now=geometry();
 for(const c of cards){geo.stack.set(String(c.id),point(200,360));now.stack.set(String(c.id),point(200,360));}
 f.run(model({waqf:auction(cards)}),geo,model({waqf:auction(cards)}),now);assert.equal(f.calls.length,0);
});
