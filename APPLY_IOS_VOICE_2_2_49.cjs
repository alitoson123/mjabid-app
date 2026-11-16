#!/usr/bin/env node
'use strict';
// Local native patch only. No npm, CocoaPods, Xcode, network, signing or credential access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const VERSION='2.2.49',BUNDLE_ID='com.mjabid.play';
const FILES={pod:'ios/App/Podfile',plist:'ios/App/App/Info.plist',story:'ios/App/App/Base.lproj/Main.storyboard',project:'ios/App/App.xcodeproj/project.pbxproj'};
const PAYLOAD_HASHES={'FriendlyVoicePlugin.swift':'fa9183bdfc5f143a04d42e9129fd8ae5153bee1baf709d85f1d48ea2b2750573','FriendlyVoiceViewController.swift':'3ff28f0df0ee7f0a98c81016a63613f2cccac6ee96cae62517c72b29169432ff'};
const MIC='نستخدم الميكروفون عند تشغيله للتحدث مع لاعبي جلستك الودية. يمكنك اللعب والاستماع دون تشغيله.';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function need(ok,message){if(!ok)throw Error(message);}
function one(rows,label){need(rows.length===1,'Unknown or ambiguous '+label+'. No native files changed.');return rows[0];}
function edits(text,changes){let last=text.length+1;for(const e of [...changes].sort((a,b)=>b.start-a.start)){need(e.end<=last&&e.start<=e.end,'Overlapping native edits.');text=text.slice(0,e.start)+e.text+text.slice(e.end);last=e.start;}return text;}
const newline=text=>text.includes('\r\n')?'\r\n':'\n';

// A small OpenStep reader keeps original bytes and locates values; it never serializes the project.
function parsePbx(text){
 let i=0;
 function token(){
  for(;;){while(/\s/.test(text[i]||'')&&i<text.length)i++;if(text.startsWith('/*',i)){const e=text.indexOf('*/',i+2);need(e>=0,'Unclosed project comment.');i=e+2;}else if(text.startsWith('//',i)){const e=text.indexOf('\n',i+2);i=e<0?text.length:e+1;}else break;}
  const start=i;if(i===text.length)return {value:null,start,end:i};
  if('{}()=;,'.includes(text[i]))return {value:text[i++],start,end:i,punctuation:true};
  if(text[i]==='"'){i++;let value='';while(i<text.length&&text[i]!=='"'){if(text[i]==='\\'){need(i+1<text.length,'Invalid project string.');value+=text[i+1];i+=2;}else value+=text[i++];}need(text[i]==='"','Unclosed project string.');i++;return {value,start,end:i};}
  while(i<text.length&&!/[\s{}()=;,]/.test(text[i]))i++;need(i>start,'Invalid project token.');return {value:text.slice(start,i),start,end:i};
 }
 let current=token();function take(value){need(current.value===value,'Unsupported project syntax near '+value+'.');const t=current;current=token();return t;}
 function node(){const first=current;if(first.value==='{'){take('{');const entries=new Map();while(current.value!=='}'){need(current.value!==null&&!current.punctuation,'Invalid project key.');const key=current.value;current=token();take('=');need(!entries.has(key),'Duplicate project key: '+key);entries.set(key,node());take(';');}const end=take('}').end;return {kind:'dict',entries,start:first.start,end};}
  if(first.value==='('){take('(');const items=[];while(current.value!==')'){items.push(node());if(current.value!==')')take(',');}return {kind:'array',items,start:first.start,end:take(')').end};}
  need(first.value!==null&&!first.punctuation,'Invalid project value.');current=token();return {...first,kind:'value'};
 }
 const root=node();need(current.value===null,'Unexpected project content.');return root;
}
const get=(node,key)=>{need(node?.kind==='dict','Expected project dictionary.');return node.entries.get(key);};
const value=(node,key)=>key===undefined?node?.value:get(node,key)?.value;
const array=node=>{need(node?.kind==='array','Expected project array.');return node.items.map(x=>value(x));};
function patchProject(text,requestedBuild){
 const root=parsePbx(text),objects=get(root,'objects');need(objects?.kind==='dict','Missing project objects.');
 const rows=[...objects.entries],ofType=type=>rows.filter(([,o])=>value(o,'isa')===type);
 const [targetId,target]=one(ofType('PBXNativeTarget').filter(([,o])=>value(o,'name')==='App'),'App target');
 need(value(target,'productType')==='com.apple.product-type.application','App target is not an application.');
 const appProject=get(objects,value(root,'rootObject'));need(value(appProject,'isa')==='PBXProject'&&array(get(appProject,'targets')).includes(targetId),'Unknown application project.');
 const configurations=array(get(get(objects,value(target,'buildConfigurationList')),'buildConfigurations')).map(id=>get(objects,id));
 need(configurations.length>=2,'Missing App build configurations.');const versions=[],builds=[],changes=[];
 for(const config of configurations){need(value(config,'isa')==='XCBuildConfiguration','Invalid App configuration.');const s=get(config,'buildSettings');
  need(value(s,'PRODUCT_BUNDLE_IDENTIFIER')===BUNDLE_ID,'This patch is only for com.mjabid.play.');need(value(s,'INFOPLIST_FILE')==='App/Info.plist','Custom Info.plist location needs manual review.');
  need(!get(s,'PRODUCT_MODULE_NAME')||value(s,'PRODUCT_MODULE_NAME')==='App','Custom Swift module needs manual review.');
  const ver=value(s,'MARKETING_VERSION'),build=value(s,'CURRENT_PROJECT_VERSION');need(/^2\.2\.(?:3[3-9]|4[0-9])$/.test(ver||''),'Native version must be 2.2.33 through 2.2.49.');
  need(/^[1-9][0-9]*$/.test(build||'')&&Number.isSafeInteger(Number(build)),'App build number must be a positive integer.');versions.push(ver);builds.push(Number(build));
 }
 need(new Set(versions).size===1&&new Set(builds).size===1,'App configurations have inconsistent versions or builds.');
 const upgrading=versions[0]!==VERSION,minBuild=Math.max(44,builds[0]+(upgrading?1:0)),build=requestedBuild===undefined?minBuild:requestedBuild;
 need(Number.isSafeInteger(build)&&build>=minBuild,'Build must be at least '+minBuild+'; existing builds cannot be lowered or reused for a version upgrade.');
 for(const config of configurations){const s=get(config,'buildSettings');for(const [key,newValue]of [['CURRENT_PROJECT_VERSION',String(build)],['MARKETING_VERSION',VERSION]]){const n=get(s,key);if(n.value!==newValue)changes.push({start:n.start,end:n.end,text:newValue});}}
 const sourceIds=array(get(target,'buildPhases')).filter(id=>value(get(objects,id),'isa')==='PBXSourcesBuildPhase'),source=get(objects,one(sourceIds,'App Sources phase'));
 const [groupId,group]=one(ofType('PBXGroup').filter(([,o])=>value(o,'path')==='App'),'App source group');
 need(array(get(get(objects,value(appProject,'mainGroup')),'children')).includes(groupId),'App source group is not in the main group.');
 const children=array(get(group,'children')),sources=array(get(source,'files'));
 const [delegateId]=one(ofType('PBXFileReference').filter(([,o])=>value(o,'path')==='AppDelegate.swift'),'AppDelegate reference');
 need(children.includes(delegateId),'AppDelegate is outside the App group.');need(ofType('PBXBuildFile').some(([id,o])=>value(o,'fileRef')===delegateId&&sources.includes(id)),'AppDelegate is absent from App Sources.');
 const definitions=[['FriendlyVoicePlugin.swift','A90000000000000000000001','A90000000000000000000002'],['FriendlyVoiceViewController.swift','A90000000000000000000003','A90000000000000000000004']];
 const named=ofType('PBXFileReference').filter(([,o])=>definitions.some(([name])=>value(o,'path')===name));let installed=false;
 if(named.length){need(named.length===2,'Partial native voice file references.');for(const [name]of definitions){const [refId,ref]=one(named.filter(([,o])=>value(o,'path')===name),name);need(value(ref,'lastKnownFileType')==='sourcecode.swift'&&value(ref,'sourceTree')==='<group>','Unexpected voice file reference.');need(children.filter(id=>id===refId).length===1,'Voice file is not exactly once in App group.');const [buildId]=one(ofType('PBXBuildFile').filter(([,o])=>value(o,'fileRef')===refId),'voice compile reference');need(sources.filter(id=>id===buildId).length===1,'Voice file is not exactly once in App Sources.');}installed=true;}
 else{
  for(const [,bid,rid]of definitions)need(!objects.entries.has(bid)&&!objects.entries.has(rid),'Voice object ID collision.');need(!text.includes('FriendlyVoice'),'Partial or unknown voice project entries.');const nl=newline(text);
  for(const [section,lines]of [['PBXBuildFile',definitions.map(([n,b,r])=>'\t\t'+b+' /* '+n+' in Sources */ = {isa = PBXBuildFile; fileRef = '+r+' /* '+n+' */; };')],['PBXFileReference',definitions.map(([n,,r])=>'\t\t'+r+' /* '+n+' */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = '+n+'; sourceTree = "<group>"; };')]]){
   const marker='/* End '+section+' section */',start=text.indexOf(marker);need(start>=0&&start===text.lastIndexOf(marker),'Missing or repeated '+section+' section.');changes.push({start,end:start,text:lines.join(nl)+nl});
  }
  for(const [list,lines]of [[get(group,'children'),definitions.map(([n,,r])=>'\t\t\t\t'+r+' /* '+n+' */,')],[get(source,'files'),definitions.map(([n,b])=>'\t\t\t\t'+b+' /* '+n+' in Sources */,')]]){const close=list.end-1,start=text.lastIndexOf('\n',close)+1;need(/^\s*$/.test(text.slice(start,close)),'Unsupported App list layout.');changes.push({start,end:start,text:lines.join(nl)+nl});}
 }
 const next=edits(text,changes);parsePbx(next);return {text:next,installed,build,oldVersion:versions[0],oldBuild:builds[0]};
}

// XML reader used only to locate direct plist keys and the initial storyboard controller.
function parseXml(text){
 need(!/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(text),'Custom XML entities are not supported.');const roots=[],stack=[],nodes=[];
 const re=/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<[^>]+>|[^<]+/g;let end=0,m;
 while((m=re.exec(text))){need(m.index===end,'Malformed XML.');end=re.lastIndex;const raw=m[0];if(raw.startsWith('<!--')||raw.startsWith('<?')||raw.startsWith('<!DOCTYPE'))continue;
  if(raw.startsWith('</')){const name=raw.match(/^<\/([\w:.-]+)\s*>$/)?.[1],node=stack.pop();need(node&&name===node.name,'Unbalanced XML.');node.close=m.index;node.end=end;continue;}
  if(raw.startsWith('<')){const head=raw.match(/^<([\w:.-]+)\b/);need(head,'Unsupported XML markup.');const attrs=new Map(),ar=/([\w:.-]+)\s*=\s*(["'])(.*?)\2/gs;ar.lastIndex=head[0].length;let a,last=ar.lastIndex;
   while((a=ar.exec(raw))){need(/^\s*$/.test(raw.slice(last,a.index))&&!attrs.has(a[1]),'Invalid XML attributes.');attrs.set(a[1],{value:a[3],start:m.index+a.index,end:m.index+ar.lastIndex,raw:a[0]});last=ar.lastIndex;}need(/^\s*\/?\s*>$/.test(raw.slice(last)),'Unknown XML attribute syntax.');
   const node={name:head[1],attrs,children:[],start:m.index,openEnd:end,end:/\/\s*>$/.test(raw)?end:null,close:null,text:''};(stack.length?stack.at(-1).children:roots).push(node);nodes.push(node);if(node.end===null)stack.push(node);continue;
  }if(stack.length)stack.at(-1).text+=raw;else need(/^\s*$/.test(raw),'Text outside XML root.');
 }
 need(end===text.length&&stack.length===0&&roots.length===1,'Incomplete XML document.');return {root:roots[0],nodes};
}
function patchPlist(text){
 const xml=parseXml(text);need(xml.root.name==='plist'&&xml.root.children.length===1,'Unknown Info.plist.');const dict=xml.root.children[0];need(dict.name==='dict'&&dict.children.length%2===0,'Info.plist must have a root dictionary.');const keys=new Map();
 for(let i=0;i<dict.children.length;i+=2){const k=dict.children[i],v=dict.children[i+1];need(k.name==='key'&&!keys.has(k.text),'Duplicate or invalid Info.plist key.');keys.set(k.text,v);}
 for(const [k,v]of [['CFBundleShortVersionString','$(MARKETING_VERSION)'],['CFBundleVersion','$(CURRENT_PROJECT_VERSION)'],['UIMainStoryboardFile','Main']])need(keys.get(k)?.name==='string'&&keys.get(k).text===v,'Custom '+k+' requires manual review.');
 const mic=keys.get('NSMicrophoneUsageDescription');if(mic){need(mic.name==='string'&&mic.text.trim().length>0,'Empty or invalid microphone purpose text.');return text;}
 const nl=newline(text),next=text.slice(0,dict.close)+'\t<key>NSMicrophoneUsageDescription</key>'+nl+'\t<string>'+MIC+'</string>'+nl+text.slice(dict.close);parseXml(next);return next;
}
function patchStoryboard(text){
 const xml=parseXml(text),initial=xml.root.attrs.get('initialViewController')?.value;need(xml.root.name==='document'&&initial,'Missing initial storyboard controller.');
 const controller=one(xml.nodes.filter(n=>n.name==='viewController'&&n.attrs.get('id')?.value===initial),'initial storyboard controller'),attrs=controller.attrs,klass=attrs.get('customClass'),module=attrs.get('customModule'),provider=attrs.get('customModuleProvider');
 if(klass?.value==='FriendlyVoiceViewController'){need(module?.value==='App'&&provider?.value==='target','Unexpected installed voice controller module.');return {text,installed:true};}
 need(klass?.value==='CAPBridgeViewController'&&module?.value==='Capacitor'&&!provider,'Custom bridge controller requires manual review.');
 const next=edits(text,[{start:klass.start,end:klass.end,text:'customClass="FriendlyVoiceViewController"'},{start:module.start,end:module.end,text:'customModule="App" customModuleProvider="target"'}]);parseXml(next);return {text:next,installed:false};
}
function patchPodfile(text){
 const targets=[...text.matchAll(/^target[ \t]+(['"])App\1[ \t]+do[ \t]*(?:#[^\r\n]*)?\r?$/gm)],target=one(targets,'Podfile App target');const bodyStart=text.indexOf('\n',target.index)+1;need(bodyStart>0,'Invalid App target.');const close=/^end[ \t]*(?:#[^\r\n]*)?\r?$/gm;close.lastIndex=bodyStart;const end=close.exec(text);need(end,'Unclosed Podfile App target.');const body=text.slice(bodyStart,end.index);
 need(!/^\s*(?:target|abstract_target)\b/m.test(body)&&!/^\s*end\b/m.test(body),'Nested Podfile App target requires manual review.');need(/^\s*capacitor_pods\s*$/m.test(body),'Missing App capacitor_pods.');
 const agora=[...text.matchAll(/^[ \t]*pod[ \t]+['"]Agora[^\r\n]*/gm)];if(agora.length){const row=one(agora,'Agora pod');need(row.index>=bodyStart&&row.index<end.index&&/^\s*pod\s+(['"])AgoraAudio_iOS\1\s*,\s*(['"])4\.7\.0\2\s*(?:#[^\r\n]*)?$/.test(row[0]),'Unexpected Agora dependency or version.');return {text,installed:true};}
 return {text:text.slice(0,bodyStart)+"  pod 'AgoraAudio_iOS', '4.7.0'"+newline(text)+text.slice(bodyStart),installed:false};
}

function safePath(root,relative,allowMissing=false){
 need(typeof relative==='string'&&!/[\\:<>"|?*\p{C}]/u.test(relative),'Unsafe installer path.');const pieces=relative.split('/');need(pieces.every(p=>p&&!/[ .]$/u.test(p)),'Unsafe installer path.');let current=root;
 for(let i=0;i<pieces.length;i++){current=path.join(current,pieces[i]);if(!fs.existsSync(current)){need(allowMissing&&i===pieces.length-1,'Missing '+relative);return current;}const st=fs.lstatSync(current);need(!st.isSymbolicLink()&&(i===pieces.length-1?st.isFile():st.isDirectory()),'Symlink or unexpected path: '+relative);}
 return current;
}
function verifyWeb(target){
 const checks=[],read=relative=>{const bytes=fs.readFileSync(safePath(target,relative));checks.push({root:target,relative,digest:hash(bytes)});return bytes.toString('utf8');};
 const core=read('www/game-core.js'),versions=[...core.matchAll(/\bconst\s+APP_VERSION\s*=\s*(['"])([^'"]+)\1\s*;/g)];need(versions.length===1&&versions[0][2]===VERSION,'Merge the 2.2.49 www update before applying the native patch.');
 const index=read('www/index.html'),scripts=[...index.matchAll(/<script\b[^>]*\bsrc\s*=\s*(['"])([^'"]+)\1[^>]*>/gi)].map(m=>m[2].replace(/^\.\//,'').split('?')[0]);
 need(scripts.includes('ui-friendly-voice-config.js')&&scripts.includes('ui-friendly-voice.js')&&scripts.indexOf('ui-friendly-voice-config.js')<scripts.indexOf('ui-friendly-voice.js'),'The merged web page is missing the voice scripts or their load order.');
 const manifestRoots=[...new Set([path.resolve(__dirname),target])].filter(root=>fs.existsSync(path.join(root,'UPDATE_MANIFEST.json')));let seen;
 for(const root of manifestRoots){const bytes=fs.readFileSync(safePath(root,'UPDATE_MANIFEST.json')),manifest=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));checks.push({root,relative:'UPDATE_MANIFEST.json',digest:hash(bytes)});
  need(manifest.fromVersion==='2.2.33'&&manifest.toVersion===VERSION,'Unexpected web update manifest version.');const hashes=manifest.targetWebHashes;need(hashes&&typeof hashes==='object'&&!Array.isArray(hashes),'Missing targetWebHashes.');const names=Object.keys(hashes);need(names.length>=2&&names.length<=10000&&Object.hasOwn(hashes,'game-core.js')&&Object.hasOwn(hashes,'index.html'),'Incomplete or oversized web manifest.');
  if(seen)need(JSON.stringify(Object.entries(hashes).sort())===seen,'Package and project web manifests disagree.');seen=JSON.stringify(Object.entries(hashes).sort());
  for(const relative of names){need(!relative.startsWith('www/')&&/^[0-9a-f]{64}$/.test(hashes[relative]),'Invalid www-relative manifest entry.');const webPath='www/'+relative,actual=fs.readFileSync(safePath(target,webPath));need(hash(actual)===hashes[relative],'The web update is incomplete or modified: '+relative);checks.push({root:target,relative:webPath,digest:hashes[relative]});}
 }
 return checks;
}
function planInstall({targetDir=process.cwd(),payloadDir=path.join(__dirname,'ios-voice-native'),build}={}){
 const target=fs.realpathSync(path.resolve(targetDir));need(fs.statSync(target).isDirectory(),'Project root is not a directory.');const config=fs.readFileSync(safePath(target,'capacitor.config.json'),'utf8');need(JSON.parse(config.replace(/^\uFEFF/,'' )).appId===BUNDLE_ID,'Select the original Majabeed project root.');
 const checks=verifyWeb(target);checks.push({root:target,relative:'capacitor.config.json',digest:hash(config)});
 const entries=Object.fromEntries(Object.entries(FILES).map(([name,relative])=>{const file=safePath(target,relative),before=fs.readFileSync(file);need(!before.includes(0),'Native file is not UTF-8 text: '+relative);return [name,{relative,file,before,mode:fs.statSync(file).mode&0o777}];}));
 const p=patchProject(entries.project.before.toString('utf8'),build),pod=patchPodfile(entries.pod.before.toString('utf8')),story=patchStoryboard(entries.story.before.toString('utf8')),plist=patchPlist(entries.plist.before.toString('utf8'));
 need(p.installed===pod.installed&&p.installed===story.installed,'Partial voice integration detected. Restore a complete native backup or review the partial edits first.');
 for(const [key,text]of Object.entries({project:p.text,pod:pod.text,story:story.text,plist}))entries[key].after=Buffer.from(text);
 for(const [name,digest]of Object.entries(PAYLOAD_HASHES)){const payloadRoot=fs.realpathSync(path.resolve(payloadDir)),bytes=fs.readFileSync(safePath(payloadRoot,name));need(hash(bytes)===digest,'Voice payload changed or is incomplete: '+name);checks.push({root:payloadRoot,relative:name,digest});const relative='ios/App/App/'+name,file=safePath(target,relative,true),exists=fs.existsSync(file),before=exists?fs.readFileSync(file):null;
  need(exists===p.installed,'Partial native Swift installation: '+name);if(exists)need(hash(before)===digest,'Unrecognized existing voice source; do not overwrite it: '+name);entries[name]={relative,file,before,after:bytes,mode:exists?fs.statSync(file).mode&0o777:0o644};
 }
 const files=Object.values(entries),changed=files.filter(e=>!e.before||!e.before.equals(e.after));for(const e of changed){fs.accessSync(path.dirname(e.file),fs.constants.W_OK);if(e.before)fs.accessSync(e.file,fs.constants.R_OK|fs.constants.W_OK);}
 return {target,files,changed,checks,build:p.build,oldBuild:p.oldBuild,oldVersion:p.oldVersion,version:VERSION};
}
function unchanged(plan){for(const e of plan.files){safePath(plan.target,e.relative,!e.before);need(e.before?fs.existsSync(e.file)&&fs.readFileSync(e.file).equals(e.before):!fs.existsSync(e.file),'Native files changed after preflight. Stop and run the check again.');}for(const e of plan.checks)need(hash(fs.readFileSync(safePath(e.root,e.relative)))===e.digest,'Web update, configuration or payload changed after preflight.');}
function applyInstall(options={}){
 const plan=planInstall(options);if(options.check||plan.changed.length===0)return {version:VERSION,build:plan.build,changed:plan.changed.map(e=>e.relative),check:!!options.check,alreadyInstalled:plan.changed.length===0,backup:null};
 const lock=path.join(plan.target,'.majabeed-ios-voice-install.lock');need(!fs.existsSync(lock),'An earlier native installation is incomplete or running. Inspect its lock and backup before continuing.');
 const lockFd=fs.openSync(lock,'wx',0o600);let backup,committed=[],temps=[],keepLock=false;
 try{
  fs.writeFileSync(lockFd,'Majabeed '+VERSION+' native installation\n');fs.closeSync(lockFd);unchanged(plan);
  const base=path.join(plan.target,'.majabeed-ios-voice-backups');if(fs.existsSync(base))need(fs.lstatSync(base).isDirectory()&&!fs.lstatSync(base).isSymbolicLink(),'Invalid backup directory.');else fs.mkdirSync(base,{mode:0o700});
  backup=fs.mkdtempSync(path.join(base,VERSION+'-'));const manifest={version:VERSION,build:plan.build,status:'prepared',files:[]};
  for(const e of plan.changed){if(e.before){const dest=path.join(backup,e.relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,e.before,{flag:'wx',mode:0o600});need(fs.readFileSync(dest).equals(e.before),'Backup verification failed.');}manifest.files.push({path:e.relative,beforeSHA256:e.before?hash(e.before):null,afterSHA256:hash(e.after)});}
  fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});fs.writeFileSync(lock,'Backup: '+backup+'\n');unchanged(plan);
  for(const e of plan.changed){const temp=e.file+'.mjvoice-'+crypto.randomBytes(8).toString('hex')+'.tmp';fs.writeFileSync(temp,e.after,{flag:'wx',mode:e.mode});temps.push(temp);need(fs.readFileSync(temp).equals(e.after),'Staged native file verification failed.');}
  unchanged(plan);
  for(let i=0;i<plan.changed.length;i++){fs.renameSync(temps[i],plan.changed[i].file);committed.push(plan.changed[i]);}
  for(const e of plan.files)need(fs.readFileSync(e.file).equals(e.after),'Final native file verification failed.');manifest.status='complete';fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {version:VERSION,build:plan.build,changed:plan.changed.map(e=>e.relative),alreadyInstalled:false,backup};
 }catch(error){
  for(const e of committed.reverse()){try{need(fs.readFileSync(e.file).equals(e.after),'File changed during rollback.');if(e.before)fs.writeFileSync(e.file,e.before,{mode:e.mode});else fs.unlinkSync(e.file);}catch{keepLock=true;}}
  if(keepLock)throw Error('Installation stopped; automatic rollback was incomplete. Restore native files from '+backup+'. The installation lock was retained.');
  throw Error('Installation stopped; original native files were preserved/restored. '+error.message+(backup?' Backup: '+backup:''));
 }finally{for(const temp of temps)if(fs.existsSync(temp))fs.unlinkSync(temp);if(!keepLock&&fs.existsSync(lock))fs.unlinkSync(lock);}
}
function parseArgs(args){let targetDir,build,check=false;for(let i=0;i<args.length;i++){if(args[i]==='--check'){need(!check,'Repeated --check.');check=true;}else if(args[i]==='--build'){need(build===undefined&&/^[1-9][0-9]*$/.test(args[i+1]||''),'Use --build followed by an integer.');build=Number(args[++i]);need(Number.isSafeInteger(build)&&build>=44,'Build must be 44 or higher.');}else{need(!args[i].startsWith('--')&&targetDir===undefined,'Usage: node APPLY_IOS_VOICE_2_2_49.cjs [project-root] [--build NUMBER] [--check]');targetDir=args[i];}}return {targetDir,build,check};}
module.exports={VERSION,FILES,PAYLOAD_HASHES,parsePbx,planInstall,applyInstall,parseArgs};
if(require.main===module){try{const result=applyInstall(parseArgs(process.argv.slice(2)));console.log(JSON.stringify(result,null,2));console.log(result.check?'Native preflight passed. No files changed.':result.alreadyInstalled?'Native voice integration is already installed. No files changed.':'Native patch complete. Signing, Firebase, entitlements and custom settings were preserved. Run the normal CocoaPods/Xcode steps on the Mac.');}catch(error){console.error('IOS_VOICE_PATCH_STOPPED: '+error.message);process.exitCode=1;}}
