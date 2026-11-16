import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {coreSource,webSource} from './helpers/source.mjs';
const source=coreSource();
const ranks=source.slice(source.indexOf('const PLAYER_RANKS='),source.indexOf('function hexToRgba'));
const render=source.slice(source.indexOf('function renderRanksList(){'),source.indexOf('/* ================= المكافأة اليومية المتصاعدة'));
const badge=source.slice(source.indexOf('function rankBadgeHTML('),source.indexOf('// فرق النقاط عند نهاية الجولة'));
function fixture(points=0){
 const elements=new Map(),document={activeElement:null};
 function el(){const classes=new Set(['hidden']);return {isConnected:true,innerHTML:'',scrollTop:11,style:{setProperty(){}},classList:{contains:v=>classes.has(v),add:v=>classes.add(v),remove:v=>classes.delete(v)},focus(){document.activeElement=this;}};}
 for(const id of ['ranksModal','ranksList','ranksClose'])elements.set(id,el());
 const trigger=el();document.activeElement=trigger;
 const context={document,ST:{n:()=>points},$:s=>elements.get(s.slice(1))};vm.createContext(context);vm.runInContext(ranks+render+badge+';globalThis.api={PLAYER_RANKS,rankFor,renderRanksList,openRanksModal,closeRanksModal,ranksModalKeydown,rankBadgeHTML};',context);
 return {api:context.api,elements,document,trigger,setPoints:p=>points=p};
}
const original=[
 [0,'جديد',200,300,50,30],[1000,'مبتدئ',200,300,55,33],[2000,'صاعد',300,500,61,36],[3000,'متقدم',400,700,67,40],
 [4000,'أسطوري',400,700,73,44],[6000,'فنان',500,900,81,48],[7000,'نخبوي',500,900,89,53],[10000,'نابغة',1000,1500,97,58]
];
test('level display preserves the previous eight ranks and appends both exact thresholds and terms',()=>{
 const {api}=fixture();
 const actual=Array.from(api.PLAYER_RANKS,r=>[r.min,r.name,r.fee,r.win,r.rankWin,r.rankLoss]);
 assert.deepEqual(actual.slice(0,8),original);
 assert.deepEqual(actual.slice(8),[[15000,'سيد اللعبة',1100,1650,107,64],[20000,'شيخ المجابيد',1210,1815,118,71]]);
 for(const [points,name]of [[9999,'نخبوي'],[10000,'نابغة'],[14999,'نابغة'],[15000,'سيد اللعبة'],[19999,'سيد اللعبة'],[20000,'شيخ المجابيد'],[250000,'شيخ المجابيد']])assert.equal(api.rankFor(points).name,name);
});
test('current and future cards identify the correct tier and next target without changing stats',()=>{
 const f=fixture(15000);f.api.renderRanksList();const html=f.elements.get('ranksList').innerHTML;
 assert.match(html,/plSummaryTop[\s\S]*?<h3>سيد اللعبة<\/h3>/);assert.match(html,/الرتبة التالية · شيخ المجابيد/);assert.match(html,/<bdi>5,000<\/bdi> نقطة متبقية/);
 assert.equal((html.match(/aria-current="step"/g)||[]).length,1);assert.match(html,/is-current" data-rank="8"/);assert.match(html,/is-future" data-rank="9"/);
 assert.match(html,/صافي الفوز/);assert.match(html,/>\+550<\/bdi>/);assert.match(html,/>\+605<\/bdi>/);assert.match(html,/>\+107<\/bdi>/);assert.match(html,/>−71<\/bdi>/);
 assert.equal((html.match(/class="plRankRow /g)||[]).length,10);assert.doesNotMatch(html,/undefined|NaN/);
});
test('new accounts and the highest rank render accurate progress instead of an invented next tier',()=>{
 const f=fixture();f.api.renderRanksList();let html=f.elements.get('ranksList').innerHTML;
 assert.match(html,/aria-valuenow="0"/);assert.match(html,/<bdi>1,000<\/bdi> نقطة متبقية/);
 f.setPoints(20500);f.api.renderRanksList();html=f.elements.get('ranksList').innerHTML;
 assert.match(html,/وصلت إلى قمة الرتب/);assert.match(html,/aria-valuenow="100"/);assert.match(html,/>20,500<\/bdi>/);assert.doesNotMatch(html,/الرتبة التالية ·|نقطة متبقية|is-future/);
});
test('rank emblems extend through the new tiers in every shared player badge',()=>{
 const {api}=fixture();assert.match(api.rankBadgeHTML(15000),/rank-8\.svg[\s\S]*سيد اللعبة/);assert.match(api.rankBadgeHTML(20000),/rank-9\.svg[\s\S]*شيخ المجابيد/);
});
test('levels modal resets its own scroll, contains keyboard focus and restores its trigger on Escape',()=>{
 const f=fixture(18000),modal=f.elements.get('ranksModal'),list=f.elements.get('ranksList'),close=f.elements.get('ranksClose');
 f.api.openRanksModal();assert.equal(modal.classList.contains('hidden'),false);assert.equal(list.scrollTop,0);assert.equal(f.document.activeElement,close);
 let prevented=0,stopped=0;f.api.ranksModalKeydown({key:'Tab',shiftKey:true,preventDefault:()=>prevented++});assert.equal(f.document.activeElement,list);
 f.api.ranksModalKeydown({key:'Tab',shiftKey:false,preventDefault:()=>prevented++});assert.equal(f.document.activeElement,close);
 f.api.ranksModalKeydown({key:'Escape',preventDefault:()=>prevented++,stopPropagation:()=>stopped++});assert.equal(modal.classList.contains('hidden'),true);assert.equal(f.document.activeElement,f.trigger);assert.equal(prevented,3);assert.equal(stopped,1);
 const html=webSource('index.html');assert.match(html,/id="ranksModal"[^>]*role="dialog"[^>]*aria-modal="true"/);
});
