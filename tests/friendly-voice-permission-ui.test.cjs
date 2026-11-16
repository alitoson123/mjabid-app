'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../www/ui-friendly-voice.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../www/ui-friendly-voice.css'),'utf8');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const people=['A','B','C','D'].map((id,i)=>({playerId:'p-'+id,uid:i+1,name:'لاعب '+id,joined:true,muted:false,blocked:false}));

function fixture({game='majabeed',lobby=true,owner=true}={}){
 const nodes=new Map(),selectors=new Map(),all=[],calls=[];let reportResult=true;
 function node(tag='div',id=''){
  const attrs=new Map(),classes=new Set(),listeners=new Map();
  const n={tag,id,dataset:{},hidden:false,children:[],parentElement:null,parentNode:null,isConnected:false,scrollTop:0,
   classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,v)=>v?classes.add(x):classes.delete(x)},
   setAttribute(k,v){attrs.set(k,String(v));},removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k),
   addEventListener:(k,v)=>listeners.set(k,v),listeners,
   append(child){child.remove();this.children.push(child);child.parentElement=child.parentNode=this;child.isConnected=true;if(child.id)nodes.set(child.id,child);},
   insertBefore(child,before){this.append(child);this.children.splice(this.children.indexOf(child),1);this.children.splice(this.children.indexOf(before),0,child);},
   remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=this.parentNode=null;this.isConnected=false;if(nodes.get(this.id)===this)nodes.delete(this.id);},
   closest(){return this.hidden||classes.has('hidden')?this:this.parentElement?.closest()||null;},
   getClientRects(){return this.closest()?[]:[{}];},
   querySelector(selector){if(selector==='.uiLobbyFooter')return this.footer||null;if(selector==='.blLobbyStart')return this.start||null;if(selector==='.avaWrap,.ava')return this.avatar||null;if(selector==='button')return node('button');if(selector==='[data-voice-reason]'&&this.innerHTML.includes('data-voice-reason'))return this.reasonNode||(this.reasonNode=node('select'));if(selector==='.mjVoiceCard')return this.card||(this.card=node());return null;},
   querySelectorAll(){return [];},contains(other){return !!other&&other.parentElement===this;},focus(){document.activeElement=this;},
   get innerHTML(){return this.html||'';},set innerHTML(value){this.html=value;this.firstChild=value?{}:null;}
  };all.push(n);if(id)nodes.set(id,n);return n;
 }
 const frame=node('main','frame');frame.isConnected=true;
 const onl=node('section','onl'),sakka=node('section','blGame'),wait=node('section','onlWait'),actions=node('div','oActions'),sakkaActions=node();
 frame.append(onl);frame.append(sakka);onl.append(wait);onl.append(actions);sakka.append(sakkaActions);
 if(game==='majabeed')sakka.hidden=true;else onl.classList.add('hidden');
 const shell=node(),footer=node('footer'),sakkaFooter=node(),start=node();shell.footer=footer;sakkaFooter.start=start;
 wait.append(shell);shell.append(footer);sakka.append(sakkaFooter);sakkaFooter.append(start);
 if(!lobby){wait.classList.add('hidden');sakkaFooter.hidden=true;}
 selectors.set('#onlWait:not(.hidden) .uiLobbyShell',lobby&&game==='majabeed'?shell:null);
 selectors.set('#onl:not(.hidden) #oActions',actions);
 selectors.set('#blGame[data-phase="lobby"] .blLobbyFooter',lobby&&game==='sakka'?sakkaFooter:null);
 selectors.set('#blGame[data-phase="lobby"]',lobby&&game==='sakka'?sakka:null);
 selectors.set('#blGame:not([hidden]) .blActions',sakkaActions);
 const document={body:frame,hidden:false,activeElement:null,getElementById:id=>nodes.get(id)||null,createElement:tag=>node(tag),querySelector:s=>selectors.get(s)||null,querySelectorAll:s=>s==='[data-mj-voice-speaking]'?all.filter(n=>n.getAttribute('data-mj-voice-speaking')):[],addEventListener(){}};
 const bridge=Object.fromEntries(['join','leave','cancel','getMicrophonePermission','setMicrophone','setPlayback','muteParticipant','renewToken','addListener'].map(name=>[name,()=>Promise.resolve()]));
 const root={document,FB:{user:{uid:'account-A'}},MJ_FRIENDLY_VOICE_CONFIG:{enabled:true,endpoint:'https://voice.invalid.test'},Capacitor:{isPluginAvailable:()=>true,Plugins:{FriendlyVoice:bridge}},addEventListener(){}};
 const sandbox={window:root,document,FB:root.FB,URL,console,setInterval(){},setTimeout(){},clearTimeout(){}};
 // Expose lexical UI functions only inside this isolated test VM, never in shipped code.
 const instrumented=source.replace(' root.MajabeedFriendlyVoice=Object.freeze',' root.__ui={paint,handle,changeReport,paintSpeakers,setController:c=>controller=c,setView:(g,v)=>views[g]=v,draft:()=>reportDraft};\n root.MajabeedFriendlyVoice=Object.freeze');
 assert.notEqual(instrumented,source);vm.runInNewContext(instrumented,sandbox);
 let state={context:{game,roomId:'friendly-1',accountId:'account-A',playerId:'p-A'},available:true,capability:true,enabled:true,accepted:false,canManage:owner,pending:false,phase:'idle',microphone:false,playback:true,speaking:[],participants:structuredClone(people),error:'',notice:''};
 const controller={snapshot:()=>state,action:async(action,body)=>{calls.push({action,body:JSON.parse(JSON.stringify(body))});return action==='report'?reportResult:true;},mute:(id,muted)=>calls.push({action:'mute',id,muted}),playback:enabled=>calls.push({action:'playback',enabled}),join:()=>calls.push({action:'join'}),leave:()=>calls.push({action:'leave'}),acceptRules(){},microphone(){},setContext:c=>{calls.push({action:'context',context:c});}};
 root.__ui.setController(controller);
 const click=(action,extra={})=>{const b=node('button');b.dataset={voice:action,...extra};b.closest=()=>b;root.__ui.handle({target:b,preventDefault(){},stopPropagation(){}});};
 const reason=value=>root.__ui.changeReport({target:{value,matches:s=>s==='[data-voice-reason]'}});
 const paint=()=>root.__ui.paint(state);
 const open=()=>{paint();click('panel');};
 return {root,node,nodes,selectors,all,calls,frame,onl,sakka,wait,shell,footer,sakkaFooter,start,actions,sakkaActions,paint,open,click,reason,state:()=>state,setState:patch=>state={...state,...patch},draft:()=>root.__ui.draft(),html:()=>nodes.get('mjVoicePanel')?.innerHTML||'',setReportResult:x=>reportResult=x};
}

test('Majabeed lobby uses an independent row even with gameplay actions laid out underneath',()=>{
 const f=fixture();f.paint();const bar=f.nodes.get('mjFriendlyVoice');assert.equal(bar.parentElement,f.shell);assert.equal(bar.dataset.inline,'lobby');assert.ok(f.shell.children.indexOf(bar)<f.shell.children.indexOf(f.footer));assert.equal(f.actions.children.length,0);assert.match(bar.innerHTML,/المجموعة الصوتية/);assert.match(bar.innerHTML,/data-voice="settings"/);
});
test('Sakka lobby controls use their own row before start and chat',()=>{
 const f=fixture({game:'sakka'});f.paint();const bar=f.nodes.get('mjFriendlyVoice');assert.equal(bar.parentElement,f.sakkaFooter);assert.ok(f.sakkaFooter.children.indexOf(bar)<f.sakkaFooter.children.indexOf(f.start));assert.equal(f.sakkaActions.children.length,0);
});
test('gameplay keeps a single 44px icon slot and never mounts an overlay after its host disappears',()=>{
 const f=fixture({lobby:false});f.paint();let bar=f.nodes.get('mjFriendlyVoice');assert.equal(bar.parentElement,f.actions);assert.equal(bar.dataset.inline,'true');assert.doesNotMatch(bar.innerHTML,/data-voice="settings"/);
 f.open();f.actions.hidden=true;f.paint();assert.equal(f.nodes.has('mjFriendlyVoice'),false);assert.equal(f.nodes.has('mjVoicePanel'),false);assert.equal(f.frame.children.some(n=>n.id==='mjFriendlyVoice'),false);
 assert.match(css,/#mjFriendlyVoice\{position:static/);assert.match(css,/width:44px;height:44px;min-width:44px/);
});
test('founder controls are visible and actionable before consent or voice join; ordinary players have no toggle',()=>{
 const f=fixture();f.open();assert.match(f.html(),/السماح بالمحادثة الصوتية/);assert.match(f.html(),/الانضمام للمجموعة الصوتية/);f.click('settings');assert.deepEqual(f.calls.at(-1),{action:'settings',body:{enabled:false}});assert.equal(f.state().accepted,false);assert.equal(f.calls.some(x=>x.action==='join'),false);
 const ordinary=fixture({owner:false});ordinary.open();assert.doesNotMatch(ordinary.html(),/data-voice="settings"/);assert.doesNotMatch(ordinary.nodes.get('mjFriendlyVoice').innerHTML,/data-voice="settings"/);
});
test('report opens inline for the selected player and sends only after valid reason plus explicit submit',async()=>{
 const f=fixture();f.open();assert.doesNotMatch(f.html(),/data-voice-reason/);f.click('report',{player:'p-B'});assert.equal(f.calls.length,0);assert.match(f.html(),/سبب البلاغ عن لاعب B/);assert.match(f.html(),/إرسال البلاغ/);f.click('report-submit');assert.equal(f.calls.length,0);
 f.reason('privacy');f.click('report-submit');await flush();assert.deepEqual(f.calls,[{action:'report',body:{targetPlayerId:'p-B',reason:'privacy'}}]);assert.equal(f.draft(),null);assert.doesNotMatch(f.html(),/data-voice-reason/);
});
test('failed report retains its selected reason, prevents duplicate submission and allows retry',async()=>{
 const f=fixture();f.open();f.click('report',{player:'p-C'});f.reason('threat');let resolve;f.setReportResult(new Promise(r=>resolve=r));f.click('report-submit');f.click('report-submit');assert.equal(f.calls.length,1);resolve(false);await flush();assert.equal(f.draft().reason,'threat');assert.equal(f.draft().submitting,false);assert.match(f.html(),/value="threat" selected/);assert.match(f.html(),/احتفظنا بالسبب/);
 f.setReportResult(true);f.click('report-submit');await flush();assert.equal(f.calls.length,2);assert.equal(f.draft(),null);
});
test('report draft is cleared by room/account/participant changes and stale completion cannot affect a new draft',async()=>{
 for(const change of [s=>({context:{...s.context,roomId:'friendly-2'}}),s=>({context:{...s.context,accountId:'account-B'}}),s=>({participants:s.participants.filter(p=>p.playerId!=='p-B')})]){
  const f=fixture();f.open();f.click('report',{player:'p-B'});f.reason('abuse');f.setState(change(f.state()));f.paint();assert.equal(f.draft(),null);f.click('report-submit');assert.equal(f.calls.length,0);
 }
 const f=fixture();f.open();f.click('report',{player:'p-B'});f.reason('privacy');let resolve;f.setReportResult(new Promise(r=>resolve=r));f.click('report-submit');f.setState({context:{...f.state().context,roomId:'new-room'}});f.paint();f.click('report',{player:'p-C'});f.reason('spam');resolve(false);await flush();assert.equal(f.draft().playerId,'p-C');assert.equal(f.draft().reason,'spam');assert.equal(f.draft().error,'');
});
test('report input is allowlisted and player display fields remain escaped',()=>{
 const f=fixture();f.setState({participants:[people[0],{...people[1],name:'<img src=x onerror=bad>',playerId:'p-" onclick="bad'}]});f.open();assert.doesNotMatch(f.html(),/<img| onclick="bad/);assert.match(f.html(),/&lt;img/);f.click('report',{player:'p-" onclick="bad'});f.reason('constructor');f.click('report-submit');assert.equal(f.calls.length,0);assert.equal(f.draft().reason,'');
 assert.match(f.html(),/value="hate"/);assert.match(f.html(),/value="sexual"/);assert.match(f.html(),/value="spam"/);f.click('report',{player:'not-in-roster'});assert.equal(f.draft().playerId,'p-" onclick="bad');
});
test('individual mute is beside the name and global playback controls remain separate',()=>{
 const f=fixture();f.setState({phase:'joined',accepted:true});f.open();assert.match(f.html(),/mjVoicePersonHead[\s\S]*?data-voice="mute"/);assert.match(f.html(),/كتم الجميع/);f.click('mute',{player:'p-B',muted:'false'});f.click('sound');assert.deepEqual(f.calls,[{action:'mute',id:'p-B',muted:true},{action:'playback',enabled:false}]);
 f.setState({playback:false,participants:people.map(p=>({...p,muted:p.playerId==='p-B'}))});f.paint();assert.match(f.html(),/سماع الجميع/);assert.match(f.html(),/إلغاء الكتم/);
});
for(const game of ['majabeed','sakka'])test(game+' speaking rings target all four lobby/game avatars only and respect mute/block/playback',()=>{
 const f=fixture({game}),avatars=[],rows=[];f.root.__ui.setView(game,game==='majabeed'?{you:'p-A',seats:people.map(p=>p.playerId)}:{seats:people.map(p=>({uid:p.playerId}))});
 people.forEach((p,i)=>{
  const lobby=f.node(),play=f.node(),row=f.node();avatars.push(lobby,play);rows.push(row);
  if(game==='majabeed'){
   f.selectors.set('#lobbyPlayers .lobbyRow[data-seat="'+i+'"] .lr-ava',lobby);const seat=f.node('div',['oIdent','oSeatR','oSeat','oSeatL'][i]);seat.avatar=play;
  }else{
   f.selectors.set('#blGame .blLobbySeat[data-seat="'+i+'"] .blAvatar',lobby);f.selectors.set('#blGame .blSeat[data-seat="'+i+'"] .blAvatarFrame',play);
  }
 });
 f.setState({speaking:[1,2,3,4],phase:'joined'});f.root.__ui.paintSpeakers(f.state());assert.equal(avatars.filter(n=>n.getAttribute('data-mj-voice-speaking')).length,8);assert.ok(rows.every(n=>!n.getAttribute('data-mj-voice-speaking')));
 f.setState({participants:people.map(p=>({...p,muted:p.uid===2,blocked:p.uid===3}))});f.root.__ui.paintSpeakers(f.state());assert.equal(avatars.filter(n=>n.getAttribute('data-mj-voice-speaking')).length,4);
 f.setState({playback:false});f.root.__ui.paintSpeakers(f.state());assert.equal(avatars.filter(n=>n.getAttribute('data-mj-voice-speaking')).length,0);
});
