'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../www/admin-commerce.js'),'utf8');
const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture({value={creatorFee:500,voiceCreatorFee:800,offers:[]},response}={}){
 const nodes=new Map(),requests=[],timers=new Map(),buttons=[{disabled:false},{disabled:false}];let timerId=0,token=async()=> 'offline-admin-token',changed;
 const node=tag=>({tag,children:[],dataset:{},value:'',checked:false,disabled:false,textContent:'',innerHTML:'',fields:new Map(),append(child){this.children.push(child);},replaceChildren(){this.children=[];},reset(){},addEventListener(name,fn){this['on'+name]=fn;},querySelectorAll(selector){return selector==='button'?buttons:[...this.fields.values()];},querySelector(selector){const match=/data-f="([^"]+)"/.exec(selector);return match?this.fields.get(match[1]):null;}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node('div'));return nodes.get(id);};
 const document={getElementById:get,querySelector:()=>get('tab-commerce'),createElement(tag){const n=node(tag);if(tag==='fieldset')for(const key of ['enabled','title','bonusGold','startsAt','endsAt'])n.fields.set(key,{dataset:{f:key},checked:false,value:''});return n;}};
 const auth={currentUser:{uid:'admin-test',getIdToken:()=>token()},onAuthStateChanged:fn=>changed=fn};
 const sandbox={document,auth,ADMIN_UIDS:['admin-test','admin-other'],AbortController,console,setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),fetch:async(url,options)=>{
  const body=JSON.parse(options.body);requests.push({url,body});if(response){const r=await response(body);if(r)return r;}if(body.action==='save')value=body.value;return {ok:true,json:async()=>({ok:true,revision:'rev-2',value})};
 }};
 vm.runInNewContext(source,sandbox);
 return {get,nodes,requests,timers,buttons,auth,setToken:fn=>token=fn,change:uid=>{auth.currentUser=uid?{uid,getIdToken:()=>token()}:null;changed();},load:async()=>{get('cmReload').onclick();await flush();},save:async()=>{get('cmForm').onsubmit({preventDefault(){}});await flush();}};
}
test('server commerce prices populate distinct normal and voice controls and save exact revision',async()=>{
 const b=fixture();await b.load();assert.equal(b.get('cmCreatorFee').value,500);assert.equal(b.get('cmVoiceCreatorFee').value,800);assert.equal(b.get('cmVoiceCreatorFee').disabled,false);b.get('cmVoiceCreatorFee').value='950';await b.save();assert.deepEqual(b.requests[1].body,{action:'save',revision:'rev-2',value:{creatorFee:500,voiceCreatorFee:950,offers:[]}});assert.match(b.get('cmStatus').textContent,/حُفظت/);
});
test('older server omits unsupported voice field on save instead of replacing configured backend price',async()=>{
 const b=fixture({value:{creatorFee:500,offers:[]}});await b.load();assert.equal(b.get('cmVoiceCreatorFee').disabled,true);assert.equal(b.get('cmVoiceCreatorFee').value,'');assert.match(b.get('cmVoiceFeeNote').textContent,/تحديث السيرفر/);b.get('cmCreatorFee').value='600';await b.save();assert.deepEqual(b.requests[1].body.value,{creatorFee:600,offers:[]});
});
for(const invalid of ['',-1,1.5,100001,'<script>x</script>'])test('invalid voice fee '+JSON.stringify(invalid)+' never sends a write',async()=>{
 const b=fixture();await b.load();b.get('cmVoiceCreatorFee').value=invalid;await b.save();assert.equal(b.requests.length,1);assert.match(b.get('cmStatus').textContent,/رسومًا صحيحة/);
});
test('zero price and existing promotion configuration survive save',async()=>{
 const startsAt=Date.parse('2026-11-17T10:00:00+03:00'),endsAt=Date.parse('2026-11-18T10:00:00+03:00');const offer={tierKey:'tier2',enabled:true,title:'عرض آمن',bonusGold:123,startsAt,endsAt};
 const b=fixture({value:{creatorFee:500,voiceCreatorFee:800,offers:[offer]}});await b.load();b.get('cmVoiceCreatorFee').value='0';await b.save();assert.equal(b.requests[1].body.value.voiceCreatorFee,0);assert.deepEqual(b.requests[1].body.value.offers,[offer]);
});
test('malformed server price blocks save and does not inject server HTML',async()=>{
 const b=fixture({value:{creatorFee:500,voiceCreatorFee:'<img onerror=x>',offers:[]}});await b.load();assert.match(b.get('cmStatus').textContent,/تعذّر التحقق/);await b.save();assert.equal(b.requests.length,1);assert.match(b.get('cmStatus').textContent,/أعد تحميل/);assert.equal(b.get('cmVoiceCreatorFee').innerHTML,'');
});
test('save before successful load cannot overwrite settings',async()=>{const b=fixture();await b.save();assert.equal(b.requests.length,0);assert.match(b.get('cmStatus').textContent,/أعد تحميل/);});
test('duplicate save clicks are serialized while preserving existing server revision',async()=>{
 const pending=deferred(),b=fixture({response:body=>body.action==='save'?pending.promise:null});await b.load();await b.save();await b.save();assert.equal(b.requests.filter(r=>r.body.action==='save').length,1);assert.ok(b.buttons.every(x=>x.disabled));pending.resolve({ok:true,json:async()=>({ok:true,revision:'next',value:{creatorFee:500,voiceCreatorFee:800,offers:[]}})});await flush();assert.ok(b.buttons.every(x=>!x.disabled));
});
test('expired token wait releases buttons and cannot send late admin save',async()=>{
 const b=fixture();await b.load();const pending=deferred();b.setToken(()=>pending.promise);await b.save();assert.equal(b.requests.length,1);[...b.timers.values()].find(t=>t.ms===15000).fn();await flush();assert.ok(b.buttons.every(x=>!x.disabled));assert.match(b.get('cmStatus').textContent,/أعد المحاولة/);pending.resolve('late');await flush();assert.equal(b.requests.length,1);
});
test('account change during token wait cancels old write and unlocks new account controls',async()=>{
 const b=fixture();await b.load();const pending=deferred();b.setToken(()=>pending.promise);await b.save();b.change('admin-other');pending.resolve('old-token');await flush();assert.equal(b.requests.length,1);assert.equal(b.get('cmVoiceCreatorFee').disabled,true);assert.ok(b.buttons.every(x=>!x.disabled));
});
test('old response cannot repaint another admin account after reset',async()=>{
 const pending=deferred(),b=fixture({response:()=>pending.promise});await b.load();b.change('admin-other');pending.resolve({ok:true,json:async()=>({ok:true,revision:'old',value:{creatorFee:777,voiceCreatorFee:888,offers:[]}})});await flush();assert.notEqual(b.get('cmVoiceCreatorFee').value,888);assert.equal(b.get('cmVoiceCreatorFee').disabled,true);assert.equal(b.get('cmStatus').textContent,'');
});
test('current admin HTML explains total price, consent, VIP exception and Sakka boundary',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../www/admin.html'),'utf8');for(const text of ['cmVoiceCreatorFee','إجمالي رسوم الإنشاء','بعد موافقة المنشئ','إعفاء مشتركي VIP','رسوم صكة لا تتغير','admin-commerce.js?v=429-voice-fees-1'])assert.ok(html.includes(text),text);
});
