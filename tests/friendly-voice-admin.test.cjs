'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../www/admin-dashboard.js'),'utf8');
function dashboard(reports){
 const nodes=new Map(),requests=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',hidden:false,disabled:false,classList:{add(){},remove(){},toggle(){}},replaceChildren(){this.innerHTML='';},querySelector(){return null;},addEventListener(){},focus(){}});return nodes.get(id);};
 const document={getElementById:node,body:node('body'),activeElement:null,addEventListener(){}};
 const root={},sandbox={window:root,document,auth:{currentUser:{uid:'admin-fixture',getIdToken:async()=> 'offline-token'}},ADMIN_UIDS:['admin-fixture'],AbortController,setTimeout,clearTimeout,Intl,console,CSS:{escape:String},fetch:async(url,options)=>{
  const body=JSON.parse(options.body);requests.push({url,body});
  return {ok:true,json:async()=>body.action==='listReports'?{ok:true,items:reports}:{ok:true,player:null,report:reports.find(r=>r.id===body.reportId),reason:'معرّف الحساب غير متاح'}};
 }};
 vm.runInNewContext(source,sandbox);root.AdminDashboard.reset('admin-fixture');
 return {api:root.AdminDashboard,nodes,node,requests};
}
const voice={id:'voice-1',kind:'voice',game:'majabeed',roomId:'FRIENDLY-7',reportedUid:'player-b',reportedName:'بدر',reporterUid:'player-a',reporterName:'سامي',reason:'مشاركة معلومات خاصة',reasonCode:'privacy',ts:1794844800000,status:'open',audioRecorded:false};
test('voice report is targeted in existing moderation list, with context and honest evidence notice',async()=>{
 const d=dashboard([voice]);await d.api.loadReports('open');const html=d.node('reportsList').innerHTML;
 for(const value of ['بلاغ صوتي','data-ad-report-player="voice-1"','بدر','مجابيد','FRIENDLY-7','مشاركة معلومات خاصة','بلاغ عن محادثة صوتية؛ لا يوجد تسجيل صوتي.','المُبلِّغ: سامي','adReportDate','data-ad-resolve="voice-1"'])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/<audio|<video|src=|لا يوجد وصف/);assert.deepEqual(d.requests[0].body,{action:'listReports',status:'open',limit:50});
});
test('voice report codes get Arabic labels and untrusted report metadata is escaped',async()=>{
 const d=dashboard([{...voice,reason:'privacy',reportedName:'<img onerror=bad>',roomId:'<script>bad</script>',reporterName:'<svg onload=bad>'}]);await d.api.loadReports('all');const html=d.node('reportsList').innerHTML;
 assert.ok(html.includes('مشاركة معلومات خاصة'));assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(html.includes('&lt;img onerror=bad&gt;'));assert.doesNotMatch(html,/<script|<img|<svg/);
});
test('unlinked voice report retains reason and context without enabling ban by name',async()=>{
 const d=dashboard([voice]);await d.api.openPlayer({reportId:voice.id});const html=d.node('adPlayerContent').innerHTML;
 assert.ok(html.includes('بلاغ عن محادثة صوتية؛ لا يوجد تسجيل صوتي.'));assert.ok(html.includes('FRIENDLY-7'));assert.ok(html.includes('مشاركة معلومات خاصة'));assert.ok(html.includes('لا يمكن الحظر'));assert.equal(d.node('adBanForm').hidden,true);
 assert.deepEqual(d.requests[0].body,{action:'player',reportId:voice.id});
});
test('existing profile, message and complaint reports keep their existing presentation',async()=>{
 const d=dashboard([{id:'m',kind:'message',messageText:'رسالة محفوظة',reason:'سبب حر'},{id:'p',kind:'profile',reason:'الاسم'},{id:'b',category:'bug',text:'عطل سابق'}]);await d.api.loadReports('all');const html=d.node('reportsList').innerHTML;
 for(const value of ['بلاغ رسالة','رسالة محفوظة','سبب حر','بلاغ حساب','بلاغ عن الاسم أو الصورة الشخصية.','شكوى تقنية','عطل سابق'])assert.ok(html.includes(value),value);
 assert.equal((html.match(/data-ad-report-player=/g)||[]).length,2);assert.ok(!html.includes('بلاغ صوتي'));
});
