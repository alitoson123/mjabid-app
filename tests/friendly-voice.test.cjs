'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createController,allowed,readRuntimeConfig,visible}=require('../www/ui-friendly-voice.js');
const tick=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const context=(id='A',roomId='friendly-1',game='majabeed')=>({game,roomId,accountId:'account-'+id,playerId:'p-'+id,eligible:true,connected:true});
const people=['A','B','C','D','E','F'].map((id,i)=>({uid:i+1,playerId:'p-'+id,name:'لاعب '+id,joined:true,blocked:false}));
function fixture(overrides={}){
 let sequence=0,enabled=true,now=100000;const log=[],requests=[],timers=new Map(),changes=[],backgrounds=[];
 const status=()=>({ok:true,enabled,available:true,sessionId:'session-one',ownerPlayerId:'p-A',canManage:true,participants:people});
 const bridge=Object.fromEntries(['join','leave','cancel','setMicrophone','setPlayback','muteParticipant','renewToken'].map(method=>[method,async body=>{log.push([method,body]);return overrides.native?.(method,body);}]));
 bridge.getMicrophonePermission=async()=>{log.push(['getMicrophonePermission']);return await overrides.native?.('getMicrophonePermission')??{granted:true};};
 bridge.addListener=async(name,fn)=>{bridge.event=fn;return {remove:async()=>{log.push(['remove']);}};};
 const request=async(action,body,accountId)=>{requests.push({action,body,accountId});if(overrides.request){const value=await overrides.request(action,body,accountId);if(value!==undefined)return value;}if(action==='settings')enabled=body.enabled;if(['join','renew'].includes(action))return {...status(),appId:'a'.repeat(32),channel:'voice-channel',uid:people.find(p=>p.playerId==='p-'+accountId.at(-1))?.uid||1,token:'007-test-token',expiresAt:now+180000};return status();};
 const c=createController({bridge,request,onChange:s=>changes.push(s),onBackground:c=>{backgrounds.push(c);overrides.onBackground?.(c);},now:()=>now,randomId:()=>`test-lease-${++sequence}`,setTimer:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;},clearTimer:id=>timers.delete(id)});
 return {c,bridge,requests,log,changes,backgrounds,timers,status,setNow:n=>now=n,setEnabled:v=>enabled=v,async ready(id='A'){c.setContext(context(id));await tick();c.acceptRules();},async joined(id='A'){await this.ready(id);assert.equal(await c.join(),true);return log.findLast(x=>x[0]==='join')[1];}};
}
test('spectator, missing account, competitive game and disconnected state cannot request voice',async()=>{
 const f=fixture();for(const c of [null,{}, {...context(),eligible:false},{...context(),accountId:''},{...context(),connected:false},{...context(),game:'ranked'},{...context(),returnBlocked:true}]){assert.equal(allowed(c),false);f.c.setContext(c);await tick();assert.equal(await f.c.join(),false);}assert.equal(f.requests.length,0);assert.equal(f.log.filter(x=>x[0]==='join').length,0);
});
test('joining requires explicit consent and server enablement',async()=>{
 const f=fixture();f.c.setContext(context());await tick();assert.equal(await f.c.join(),false);f.c.acceptRules();f.setEnabled(false);await f.c.refresh();assert.equal(await f.c.join(),false);await f.c.action('settings',{enabled:true});assert.equal(await f.c.join(),true);assert.equal(f.c.snapshot().microphone,false);
});
test('four accounts join the same channel under individual UIDs, without capturing audio',async()=>{
 const fs=['A','B','C','D'].map(()=>fixture()),joins=[];for(const [i,f] of fs.entries())joins.push(await f.joined(['A','B','C','D'][i]));assert.equal(new Set(joins.map(x=>x.channel)).size,1);assert.equal(new Set(joins.map(x=>x.uid)).size,4);for(const f of fs){assert.equal(f.log.filter(x=>x[0]==='setMicrophone').length,0);assert.equal(f.c.snapshot().microphone,false);await f.c.destroy();}
});
test('six-seat roster includes seated people who have not joined voice',async()=>{
 const f=fixture({request:(a)=>a==='status'?{ok:true,enabled:true,available:true,sessionId:'session-one',participants:people.map(p=>({...p,uid:null,joined:false})),canManage:true}:undefined});await f.ready();assert.equal(f.c.snapshot().participants.length,6);assert.ok(f.c.snapshot().participants.every(p=>p.uid===null));assert.equal(await f.c.mute('p-B',true),false);
});
test('microphone denial preserves listening and playable session',async()=>{
 const f=fixture({native:(a,b)=>{if(a==='setMicrophone'&&b.enabled)throw Object.assign(Error('denied'),{code:'E_MIC_PERMISSION'});}});await f.joined();assert.equal(await f.c.microphone(true),false);assert.equal(f.c.snapshot().phase,'joined');assert.equal(f.c.snapshot().microphone,false);assert.match(f.c.snapshot().error,/إذن المايك/);assert.equal(f.log.filter(x=>x[0]==='leave').length,1); // initial context cleanup only
});
test('microphone is enabled only by explicit action and toggles independently of playback',async()=>{
 const f=fixture();await f.joined();await f.c.microphone(true);assert.equal(f.c.snapshot().microphone,true);await f.c.playback(false);assert.equal(f.c.snapshot().microphone,true);assert.equal(f.c.snapshot().playback,false);await f.c.microphone(false);assert.equal(f.c.snapshot().microphone,false);
});
test('leave while token request is pending never reaches native join',async()=>{
 const d=deferred(),f=fixture({request:a=>a==='join'?d.promise:undefined});await f.ready();const joining=f.c.join();await tick();await f.c.leave();d.resolve({...f.status(),appId:'a'.repeat(32),channel:'old',uid:1,token:'007-old',expiresAt:280000});assert.equal(await joining,false);await tick();assert.equal(f.log.some(x=>x[0]==='join'),false);assert.equal(f.requests.filter(r=>r.action==='leave').length,1);assert.equal(f.c.snapshot().phase,'idle');
});
test('leave while native join is pending is serialized after native completion',async()=>{
 const d=deferred(),f=fixture({native:a=>a==='join'?d.promise:undefined});await f.ready();const joining=f.c.join();await tick();const leaving=f.c.leave();await tick();assert.equal(f.c.snapshot().microphone,false);d.resolve({});await Promise.all([joining,leaving]);assert.equal(f.log.at(-1)[0],'leave');assert.equal(f.c.snapshot().phase,'idle');
});
test('new voice join gets a new lease ID so stale leave cannot revoke it',async()=>{
 const f=fixture();const first=await f.joined();await f.c.leave();assert.equal(await f.c.join(),true);const second=f.log.findLast(x=>x[0]==='join')[1];assert.notEqual(first.sessionId,second.sessionId);const joins=f.requests.filter(r=>r.action==='join');assert.notEqual(joins[0].body.clientId,joins[1].body.clientId);assert.equal(f.requests.find(r=>r.action==='leave').body.clientId,joins[0].body.clientId);
});
test('switch account invalidates an old token response and requires consent anew',async()=>{
 const d=deferred(),f=fixture({request:(a,b,uid)=>a==='join'&&uid==='account-A'?d.promise:undefined});await f.ready();const joining=f.c.join();await tick();f.c.setContext(context('B'));await tick();assert.equal(f.c.snapshot().accepted,false);d.resolve({...f.status(),appId:'a'.repeat(32),channel:'old',uid:1,token:'old',expiresAt:280000});await joining;assert.equal(f.log.some(x=>x[0]==='join'),false);f.c.acceptRules();assert.equal(await f.c.join(),true);assert.equal(f.log.findLast(x=>x[0]==='join')[1].uid,2);
});
test('switch room disconnects old audio and requires explicit new join',async()=>{
 const f=fixture();await f.joined();f.c.setContext(context('A','friendly-2'));await tick();assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.log.at(-1)[0],'leave');assert.equal(f.requests.find(r=>r.action==='leave').body.roomId,'friendly-1');assert.equal(f.c.snapshot().context.roomId,'friendly-2');
});
test('account identity is included in updates for lifecycle guard',async()=>{const f=fixture();await f.ready();assert.equal(f.changes.at(-1).context.accountId,'account-A');});
test('expired join token is rejected before touching Agora',async()=>{
 const f=fixture({request:a=>a==='join'?{ok:true,enabled:true,appId:'app',channel:'x',uid:1,token:'x',sessionId:'expired',expiresAt:1}:undefined});await f.ready();assert.equal(await f.c.join(),false);assert.equal(f.log.some(x=>x[0]==='join'),false);
});
test('token-expiring event refreshes token on current native session',async()=>{
 const f=fixture();const joined=await f.joined();f.bridge.event({type:'token-expiring',sessionId:joined.sessionId});await tick();const renew=f.log.find(x=>x[0]==='renewToken');assert.ok(renew);assert.equal(renew[1].sessionId,joined.sessionId);assert.equal(f.requests.find(r=>r.action==='renew').body.sessionId,'session-one');
});
test('events from a stale native session cannot change microphone or speakers',async()=>{
 const f=fixture();await f.joined();await f.c.microphone(true);f.bridge.event({type:'interrupted',sessionId:'old'});f.bridge.event({type:'speaking',sessionId:'old',uids:[2]});await tick();assert.equal(f.c.snapshot().microphone,true);assert.deepEqual(f.c.snapshot().speaking,[]);
});
test('renewal denial closes audio rather than retaining stale room access',async()=>{
 const f=fixture({request:a=>{if(a==='renew')throw Object.assign(Error('removed'),{status:403});}});await f.joined();await f.c.microphone(true);assert.equal(await f.c.renew(),false);assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.c.snapshot().microphone,false);
});
test('room incarnation change closes the old channel',async()=>{
 let rotated=false;const f=fixture({request:a=>a==='status'&&rotated?{...f.status(),sessionId:'new-session'}:undefined});await f.joined();rotated=true;await f.c.refresh();assert.equal(f.c.snapshot().phase,'idle');assert.match(f.c.snapshot().notice,/المحادثة السابقة/);
});
test('owner disabling voice terminates listener and microphone',async()=>{
 const f=fixture();await f.joined();await f.c.microphone(true);f.setEnabled(false);await f.c.refresh();assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.c.snapshot().enabled,false);assert.equal(f.c.snapshot().microphone,false);
});
test('native reconnect disables mic and never silently restores capture',async()=>{
 const f=fixture(),joined=await f.joined();await f.c.microphone(true);f.bridge.event({type:'connection',state:'reconnecting',sessionId:joined.sessionId});await tick();assert.equal(f.c.snapshot().phase,'reconnecting');assert.equal(f.c.snapshot().microphone,false);f.bridge.event({type:'connection',state:'connected',sessionId:joined.sessionId});await tick();assert.equal(f.c.snapshot().phase,'joined');assert.equal(f.c.snapshot().microphone,false);assert.equal(f.log.filter(x=>x[0]==='setMicrophone'&&x[1].enabled).length,1);
});
test('reconnect during pending permission response does not mark mic active',async()=>{
 const d=deferred(),f=fixture({native:(a,b)=>a==='setMicrophone'&&b.enabled?d.promise:undefined}),joined=await f.joined();const enabling=f.c.microphone(true);await tick();f.bridge.event({type:'connection',state:'reconnecting',sessionId:joined.sessionId});assert.equal(f.log.findLast(x=>x[0]==='cancel')[1].sessionId,joined.sessionId);d.resolve({});await enabling;await tick();assert.equal(f.c.snapshot().microphone,false);assert.equal(f.c.snapshot().phase,'idle');
});
test('background and native interruption both stop transmission and listening',async()=>{
 const f=fixture(),joined=await f.joined();await f.c.microphone(true);await f.c.suspend();assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.c.snapshot().microphone,false);await f.c.join();f.bridge.event({type:'interrupted',sessionId:f.log.findLast(x=>x[0]==='join')[1].sessionId});await tick();assert.equal(f.c.snapshot().phase,'idle');
});
test('blocking and per-player mute are distinct and blocked audio cannot be locally unmuted',async()=>{
 const f=fixture({request:a=>['join','status'].includes(a)?{...f.status(),participants:people.map(p=>({...p,blocked:p.playerId==='p-B'})),appId:'app',channel:'x',uid:1,token:'x',expiresAt:280000}:undefined});await f.joined();await f.c.mute('p-B',false);assert.equal(f.log.some(x=>x[0]==='muteParticipant'&&x[1].uid===2&&x[1].muted===false),false);await f.c.mute('p-C',true);assert.equal(f.c.snapshot().participants.find(p=>p.playerId==='p-C').muted,true);
});
test('non-owner cannot toggle room voice or issue kick',async()=>{
 const f=fixture({request:a=>a==='status'?{...f.status(),canManage:false}:undefined});await f.ready();assert.equal(await f.c.action('settings',{enabled:false}),false);assert.equal(await f.c.action('kick',{targetPlayerId:'p-B'}),false);assert.ok(!f.requests.some(r=>['settings','kick'].includes(r.action)));
});
test('report carries a current participant and reason, never audio or recordings',async()=>{
 const f=fixture();await f.ready();assert.equal(await f.c.action('report',{targetPlayerId:'stranger',reason:'abuse'}),false);assert.equal(await f.c.action('report',{targetPlayerId:'p-A',reason:'abuse'}),false);assert.equal(await f.c.action('report',{targetPlayerId:'p-B',reason:'abuse'}),true);const report=f.requests.find(r=>r.action==='report');assert.deepEqual(Object.keys(report.body).sort(),['game','reason','roomId','targetPlayerId']);assert.equal(f.c.snapshot().notice,'تم تسجيل البلاغ.');
});
test('service not configured leaves gameplay context intact and no native connection',async()=>{
 const f=fixture({request:()=>{throw Object.assign(Error('not configured'),{code:'VOICE_DISABLED',status:503});}});await f.ready();assert.equal(f.c.snapshot().context.roomId,'friendly-1');assert.equal(f.c.snapshot().available,false);assert.equal(await f.c.join(),false);assert.equal(f.log.some(x=>x[0]==='join'),false);
});
test('Sakka uses the same consent and native lifecycle',async()=>{
 const f=fixture();f.c.setContext(context('A','S4TABLE1','sakka'));await tick();f.c.acceptRules();assert.equal(await f.c.join(),true);assert.equal(f.requests.find(r=>r.action==='join').body.game,'sakka');await f.c.leave();assert.equal(f.c.snapshot().microphone,false);
});
test('destroy clears membership polling, renewal and native event listener',async()=>{
 const f=fixture();await f.joined();assert.ok(f.timers.size>0);await f.c.destroy();assert.equal(f.timers.size,0);assert.equal(f.log.at(-1)[0],'remove');assert.equal(await f.c.join(),false);
});
test('personal block stops local playback immediately when server reports left',async()=>{
 const f=fixture({request:a=>a==='block'?{ok:true,left:true}:undefined});await f.joined();await f.c.microphone(true);await f.c.action('block',{targetPlayerId:'p-B',blocked:true});assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.c.snapshot().microphone,false);assert.match(f.c.snapshot().notice,/غادرت الصوت/);
});
test('pending remote kick is not falsely presented as immediate removal',async()=>{
 const f=fixture({request:a=>a==='kick'?{ok:true,kicked:true,enforced:false}:undefined});await f.ready();await f.c.action('kick',{targetPlayerId:'p-B'});assert.match(f.c.snapshot().notice,/تعذّر تأكيد الفصل الفوري/);
});
test('native auto-disable microphone event keeps indicator honest',async()=>{
 const f=fixture(),joined=await f.joined();await f.c.microphone(true);f.bridge.event({type:'microphone',enabled:false,sessionId:joined.sessionId});assert.equal(f.c.snapshot().microphone,false);
});
test('join keeps playback off until participant mute settings have been applied',async()=>{
 const f=fixture();await f.joined();const index=f.log.findIndex(x=>x[0]==='join');assert.equal(f.log[index][1].playbackEnabled,false);assert.equal(f.log.slice(0,index).some(x=>x[0]==='muteParticipant'),false);const restored=f.log.findIndex(x=>x[0]==='setPlayback'&&x[1].enabled);assert.ok(restored>index);assert.ok(f.log.slice(index+1,restored).some(x=>x[0]==='muteParticipant'));
});
test('remote join event refreshes server roster promptly',async()=>{
 const f=fixture(),joined=await f.joined(),before=f.requests.filter(x=>x.action==='status').length;f.bridge.event({type:'participant-joined',uid:9,sessionId:joined.sessionId});await tick();assert.ok(f.requests.filter(x=>x.action==='status').length>before);
});
for(const trigger of ['leave','account-switch','reconnect'])test('permission grant after '+trigger+' never starts native capture',async()=>{
 const permission=deferred(),cancelled=new Set();let captureStarted=0;
 const f=fixture({native:async(method,body)=>{
  if(method==='cancel'){cancelled.add(body.sessionId);permission.reject(Object.assign(Error('cancelled'),{code:'E_VOICE_SESSION'}));}
  if(method==='setMicrophone'&&body.enabled){await permission.promise;if(cancelled.has(body.sessionId))throw Error('cancelled generation');captureStarted++;}
 }}),joined=await f.joined();const enabling=f.c.microphone(true);await tick();
 let stopping;if(trigger==='leave')stopping=f.c.leave();else if(trigger==='account-switch')f.c.setContext(context('B'));else f.bridge.event({type:'connection',state:'reconnecting',sessionId:joined.sessionId});
 // This must happen before granting permission; a queued leave would deadlock here.
 assert.ok(cancelled.has(joined.sessionId));assert.equal(f.log.findLast(x=>x[0]==='cancel')[1].sessionId,joined.sessionId);
 permission.resolve({granted:true});await enabling;await stopping;await tick();assert.equal(captureStarted,0);assert.equal(f.c.snapshot().microphone,false);
});
test('native cancel tombstones a delayed join before native accepts it',async()=>{
 const dispatch=deferred(),cancelled=new Set();let acceptedJoins=0;
 const f=fixture({native:async(method,body)=>{if(method==='cancel')cancelled.add(body.sessionId);if(method==='join'){await dispatch.promise;if(cancelled.has(body.sessionId))throw Error('cancelled before native dispatch');acceptedJoins++;}}});
 await f.ready();const joining=f.c.join();await tick();const nativeSession=f.log.findLast(x=>x[0]==='join')[1].sessionId,leaving=f.c.leave();assert.ok(cancelled.has(nativeSession));dispatch.resolve();await Promise.all([joining,leaving]);assert.equal(acceptedJoins,0);assert.equal(f.c.snapshot().phase,'idle');
});
test('UID rotation mutes the previously subscribed UID before unmuting its replacement',async()=>{
 let roster=people;const f=fixture({request:a=>a==='status'?{...f.status(),participants:roster}:undefined});await f.joined();const before=f.log.length;roster=people.map(p=>p.uid===2?{...p,uid:22}:p);await f.c.refresh();await tick();const calls=f.log.slice(before),removed=calls.findIndex(x=>x[0]==='muteParticipant'&&x[1].uid===2&&x[1].muted===true),added=calls.findIndex(x=>x[0]==='muteParticipant'&&x[1].uid===22&&x[1].muted===false);assert.ok(removed>=0);assert.ok(added>removed);
});
test('departed UID is unsubscribed even if server-side Agora revocation failed',async()=>{
 let roster=people;const f=fixture({request:a=>a==='status'?{...f.status(),participants:roster}:undefined});await f.joined();roster=people.filter(p=>p.uid!==2);await f.c.refresh();await tick();assert.ok(f.log.some(x=>x[0]==='muteParticipant'&&x[1].uid===2&&x[1].muted));assert.equal(f.c.snapshot().phase,'joined');
});
test('privacy mute failure cancels the native session rather than continuing to hear revoked UID',async()=>{
 let roster=people;const f=fixture({request:a=>a==='status'?{...f.status(),participants:roster}:undefined,native:(method,body)=>{if(method==='muteParticipant'&&body.uid===2&&body.muted)throw Error('failed to unsubscribe');}}),joined=await f.joined();roster=people.filter(p=>p.uid!==2);await f.c.refresh();await tick();assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.log.findLast(x=>x[0]==='cancel')[1].sessionId,joined.sessionId);assert.match(f.c.snapshot().notice,/خصوصيتك/);
});
test('revoked UID while permission is pending triggers immediate cancel, not a queued mute',async()=>{
 const permission=deferred(),cancelled=new Set();let roster=people,captureStarted=0;
 const f=fixture({request:a=>a==='status'?{...f.status(),participants:roster}:undefined,native:async(method,body)=>{if(method==='cancel'){cancelled.add(body.sessionId);permission.reject(Error('cancelled'));}if(method==='setMicrophone'&&body.enabled){await permission.promise;if(cancelled.has(body.sessionId))throw Error('cancelled');captureStarted++;}}}),joined=await f.joined();const enabling=f.c.microphone(true);await tick();roster=people.filter(p=>p.uid!==2);await f.c.refresh();assert.ok(cancelled.has(joined.sessionId));permission.resolve();await enabling;await tick();assert.equal(captureStarted,0);assert.equal(f.c.snapshot().phase,'idle');
});
test('own revoked voice lease stops immediately on status even while game seat remains',async()=>{
 let revoked=false;const f=fixture({request:a=>a==='status'&&revoked?{...f.status(),participants:people.map(p=>p.playerId==='p-A'?{...p,uid:null,joined:false}:p)}:undefined}),joined=await f.joined();revoked=true;await f.c.refresh();assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.log.findLast(x=>x[0]==='cancel')[1].sessionId,joined.sessionId);assert.equal(f.c.snapshot().context.playerId,'p-A');
});
test('replacement device UID cancels old native channel instead of renewing its old access',async()=>{
 let replaced=false;const f=fixture({request:a=>a==='status'&&replaced?{...f.status(),participants:people.map(p=>p.playerId==='p-A'?{...p,uid:99}:p)}:undefined}),joined=await f.joined();replaced=true;await f.c.refresh();assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.log.findLast(x=>x[0]==='cancel')[1].sessionId,joined.sessionId);assert.equal(f.requests.some(r=>r.action==='renew'),false);
});
test('real game entry/leave and native isolation hooks exist on both engines',()=>{
 const base=path.resolve(__dirname,'../www'),game=fs.readFileSync(path.join(base,'game-core.js'),'utf8'),sakka=fs.readFileSync(path.join(base,'ui-baloot.js'),'utf8'),voice=fs.readFileSync(path.join(base,'ui-friendly-voice.js'),'utf8');
 assert.match(game,/MajabeedFriendlyVoice\?\.syncMajabeed\(ONL\)/);assert.match(game,/MajabeedFriendlyVoice\?\.disconnect\('majabeed'\)/);assert.match(sakka,/MajabeedFriendlyVoice\?\.syncSakka\(m,/);assert.match(sakka,/MajabeedFriendlyVoice\?\.disconnect\('sakka'\)/);assert.match(voice,/MJ_FRIENDLY_VOICE_CONFIG/);assert.doesNotMatch(voice,/MJ_FRIENDLY_VOICE_TEST|MJ_FRIENDLY_VOICE_ENDPOINT|waggif-baloot\./);
});
test('release runtime is off unless an explicit enabled configuration supplies a valid origin',()=>{
 for(const config of [undefined,null,{},false,{enabled:false,endpoint:'https://voice.example.test'},{enabled:true},{enabled:true,endpoint:''}])assert.equal(readRuntimeConfig(config),null);
 assert.deepEqual(readRuntimeConfig({enabled:true,endpoint:'https://voice.example.test/'}),{endpoint:'https://voice.example.test'});
});
test('runtime refuses credential URLs, paths, query routing, plaintext remote and implicit relative endpoints',()=>{
 for(const endpoint of ['https://user:secret@voice.example.test','https://voice.example.test/voice','https://voice.example.test?production=true','https://voice.example.test#route','http://voice.example.test','/voice','//voice.example.test','javascript:alert(1)'])assert.equal(readRuntimeConfig({enabled:true,endpoint,allowLocalhost:true}),null,endpoint);
 assert.equal(readRuntimeConfig({enabled:true,endpoint:'http://127.0.0.1:8793'}),null);
 assert.deepEqual(readRuntimeConfig({enabled:true,endpoint:'http://127.0.0.1:8793',allowLocalhost:true}),{endpoint:'http://127.0.0.1:8793'});
 assert.equal(readRuntimeConfig({enabled:true,endpoint:'http://localhost.evil.test:8793',allowLocalhost:true}),null);
});
test('capability starts hidden and must be confirmed by valid status before joining or showing controls',async()=>{
 const d=deferred(),f=fixture({request:a=>a==='status'?d.promise:undefined});f.c.setContext(context());f.c.acceptRules();assert.equal(visible(f.c.snapshot()),false);assert.equal(await f.c.join(),false);d.resolve(f.status());await tick();assert.equal(visible(f.c.snapshot()),true);
});
for(const failure of [{status:404},{status:503,code:'VOICE_DISABLED'},{status:503,code:'VOICE_NOT_CONFIGURED'}])test('old or disabled server hides voice and terminates active audio '+JSON.stringify(failure),async()=>{
 let rejected=false;const f=fixture({request:a=>{if(a==='status'&&rejected)throw Object.assign(Error('unavailable'),failure);}}),joined=await f.joined();assert.equal(visible(f.c.snapshot()),true);rejected=true;await f.c.refresh();assert.equal(visible(f.c.snapshot()),false);assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.log.findLast(x=>x[0]==='cancel')[1].sessionId,joined.sessionId);assert.equal(await f.c.join(),false);
});
test('server unavailable response cannot preserve a cached capability from the previous request',async()=>{
 let unavailable=false;const f=fixture({request:a=>a==='status'&&unavailable?{ok:true,available:false,enabled:false}:undefined});await f.joined();unavailable=true;await f.c.refresh();assert.equal(visible(f.c.snapshot()),false);assert.equal(f.c.snapshot().phase,'idle');
});
test('malformed legacy successful response does not advertise voice capability',async()=>{
 const f=fixture({request:a=>a==='status'?{ok:true,enabled:true}:undefined});await f.ready();assert.equal(visible(f.c.snapshot()),false);assert.equal(await f.c.join(),false);
});
test('feature disabling between status and join hides the cached button',async()=>{
 const f=fixture({request:a=>{if(a==='join')throw Object.assign(Error('disabled'),{status:503,code:'VOICE_DISABLED'});}});await f.ready();assert.equal(visible(f.c.snapshot()),true);assert.equal(await f.c.join(),false);assert.equal(visible(f.c.snapshot()),false);
});
test('successful capability can recover after an old-server response without automatically enabling mic',async()=>{
 let old=true;const f=fixture({request:a=>{if(a==='status'&&old)throw Object.assign(Error('old server'),{status:404});}});await f.ready();assert.equal(visible(f.c.snapshot()),false);old=false;await f.c.refresh();assert.equal(visible(f.c.snapshot()),true);assert.equal(f.c.snapshot().microphone,false);assert.equal(f.log.some(x=>x[0]==='join'),false);
});

for(const granted of [true,false])for(const resumeFirst of [true,false])test(`first microphone permission ${granted?'grant':'deny'} with resume ${resumeFirst?'before':'after'} result preserves game and clears deferral`,async()=>{
 const permission=deferred(),f=fixture({native:(method,body)=>method==='getMicrophonePermission'?{granted:false}:method==='setMicrophone'&&body.enabled?permission.promise:undefined});
 await f.joined();const enabling=f.c.microphone(true);await tick();assert.equal(f.c.deferLifecycle('pause'),true);assert.equal(f.c.deferLifecycle('hidden'),true);
 assert.equal(f.c.deferLifecycle('pagehide'),false);assert.equal(f.c.deferLifecycle('native-background'),false);
 if(resumeFirst)f.c.resumeLifecycle();
 if(granted)permission.resolve({});else permission.reject(Object.assign(Error('denied'),{code:'E_MIC_PERMISSION'}));
 assert.equal(await enabling,granted);assert.equal(f.c.snapshot().phase,'joined');assert.equal(f.c.snapshot().microphone,granted);assert.equal(f.backgrounds.length,0);
 if(!resumeFirst){assert.equal(f.c.deferLifecycle('hidden'),true);f.c.resumeLifecycle();}
 assert.equal(f.c.deferLifecycle('pause'),false);assert.equal(f.c.snapshot().pending,false);
});
test('permission already granted never suppresses an ordinary pause even during the native operation',async()=>{
 const pending=deferred(),f=fixture({native:(a,b)=>a==='setMicrophone'&&b.enabled?pending.promise:undefined});await f.joined();const enabling=f.c.microphone(true);await tick();
 assert.equal(f.c.deferLifecycle('pause'),false);const stopping=f.c.suspend();assert.ok(f.log.some(x=>x[0]==='cancel'));pending.resolve({});assert.equal(await enabling,false);await stopping;assert.equal(f.c.snapshot().microphone,false);
});
test('permission without lifecycle events cannot leave a deferral after native rejection',async()=>{
 const f=fixture({native:(method,body)=>{if(method==='getMicrophonePermission')return {granted:false};if(method==='setMicrophone'&&body.enabled)throw Object.assign(Error('denied'),{code:'E_MIC_PERMISSION'});}});await f.joined();assert.equal(await f.c.microphone(true),false);assert.equal(f.c.deferLifecycle('pause'),false);assert.equal(f.c.snapshot().phase,'joined');
});
test('cancel during permission query prevents creation of a stale permission gate or microphone call',async()=>{
 const query=deferred(),f=fixture({native:method=>method==='getMicrophonePermission'?query.promise:undefined});await f.joined();const enabling=f.c.microphone(true);await tick();assert.equal(f.c.deferLifecycle('pause'),false);
 const leaving=f.c.leave();query.resolve({granted:false});assert.equal(await enabling,false);await leaving;assert.equal(f.log.some(x=>x[0]==='setMicrophone'),false);assert.equal(f.c.deferLifecycle('hidden'),false);
});
for(const trigger of ['leave','suspend','rtc-error','real-background','roster-revoke'])test('deferred permission pause is replayed exactly once on '+trigger,async()=>{
 const pending=deferred();let roster=people;const f=fixture({native:(a,b)=>a==='getMicrophonePermission'?{granted:false}:a==='setMicrophone'&&b.enabled?pending.promise:undefined,request:a=>a==='status'?{...f.status(),participants:roster}:undefined,onBackground:()=>{f.c.suspend();}}),joined=await f.joined();
 const enabling=f.c.microphone(true);await tick();assert.equal(f.c.deferLifecycle('pause'),true);
 if(trigger==='leave')f.c.leave();else if(trigger==='suspend')f.c.suspend();else if(trigger==='roster-revoke'){roster=people.filter(p=>p.uid!==2);await f.c.refresh();}else f.bridge.event({type:trigger==='rtc-error'?'error':'interrupted',reason:'background',sessionId:joined.sessionId});
 assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.c.deferLifecycle('hidden'),false);assert.equal(f.log.findLast(x=>x[0]==='cancel')[1].sessionId,joined.sessionId);assert.deepEqual(f.backgrounds,[{game:'majabeed',roomId:'friendly-1',accountId:'account-A'}]);
 pending.resolve({});assert.equal(await enabling,false);await tick();f.bridge.event({type:'interrupted',reason:'background',sessionId:joined.sessionId});assert.equal(f.backgrounds.length,1);assert.equal(f.c.snapshot().microphone,false);
});
test('denied permission followed by cancellation before resume replays the deferred game background',async()=>{
 const pending=deferred(),f=fixture({native:(a,b)=>a==='getMicrophonePermission'?{granted:false}:a==='setMicrophone'&&b.enabled?pending.promise:undefined});await f.joined();const enabling=f.c.microphone(true);await tick();f.c.deferLifecycle('pause');pending.reject(Object.assign(Error('denied'),{code:'E_MIC_PERMISSION'}));assert.equal(await enabling,false);assert.equal(f.c.snapshot().pending,false);await f.c.leave();assert.equal(f.backgrounds.length,1);f.c.resumeLifecycle();assert.equal(f.c.deferLifecycle('pause'),false);
});
test('native actual background forces cleanup even when no JS pause arrived; stale session does not',async()=>{
 const f=fixture(),joined=await f.joined();f.bridge.event({type:'interrupted',reason:'background',sessionId:'stale-session'});assert.equal(f.backgrounds.length,0);f.bridge.event({type:'interrupted',reason:'background',sessionId:joined.sessionId});assert.equal(f.backgrounds.length,1);assert.equal(f.c.snapshot().phase,'idle');await tick();
});
test('lobby exit invalidates a late status and prevents controls or membership returning',async()=>{
 const pending=deferred(),f=fixture({request:a=>a==='status'?pending.promise:undefined});f.c.setContext(context());await tick();f.c.setContext(null);pending.resolve(f.status());await tick();assert.equal(f.c.snapshot().context,null);assert.equal(visible(f.c.snapshot()),false);assert.equal(await f.c.join(),false);assert.equal(f.log.some(x=>x[0]==='join'),false);
});
test('lobby exit invalidates late join response and revokes its unused lease',async()=>{
 const pending=deferred(),f=fixture({request:a=>a==='join'?pending.promise:undefined});await f.ready();const joining=f.c.join();await tick();f.c.setContext(null);pending.resolve({...f.status(),appId:'a'.repeat(32),channel:'room',uid:1,token:'007-test',expiresAt:280000});assert.equal(await joining,false);await tick();assert.equal(f.c.snapshot().context,null);assert.equal(visible(f.c.snapshot()),false);assert.equal(f.log.some(x=>x[0]==='join'),false);assert.equal(f.requests.filter(x=>x.action==='leave').length,1);
});
test('pending revocation explains the previous connection and leaves only an explicit join retry available',async()=>{
 let pending=true;const f=fixture({request:a=>{if(a==='join'&&pending)throw Object.assign(Error('pending'),{code:'VOICE_REVOCATION_PENDING',status:503});}});await f.ready();assert.equal(await f.c.join(),false);
 assert.equal(f.c.snapshot().error,'جارٍ إنهاء الاتصال السابق؛ انتظر قليلًا ثم أعد الانضمام.');assert.equal(f.c.snapshot().phase,'idle');assert.equal(f.c.snapshot().pending,false);assert.equal(visible(f.c.snapshot()),true);assert.equal(f.c.snapshot().enabled,true);assert.equal(f.log.some(x=>x[0]==='join'),false);
 await f.c.refresh();assert.equal(f.requests.filter(x=>x.action==='join').length,1);pending=false;assert.equal(await f.c.join(),true);assert.equal(f.requests.filter(x=>x.action==='join').length,2);assert.equal(f.c.snapshot().microphone,false);
});
