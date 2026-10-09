'use strict';
// Run BEFORE cap sync ios. Never embeds server credentials in the client.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mode=process.argv[2];
assert(['sandbox','production'].includes(mode),'Usage: node scripts/select-environment.cjs sandbox|production');
const configDir=path.join(root,'config/environments');
const cfg=JSON.parse(fs.readFileSync(path.join(configDir,mode+'.json'),'utf8'));
assert.equal(cfg.environment,mode.toUpperCase());
assert(/^[a-z0-9.-]+$/.test(cfg.workerHost),'Invalid Worker hostname');
const plist=fs.readFileSync(path.join(configDir,'GoogleService-Info.'+mode+'.plist'),'utf8');
assert(plist.includes('<string>'+cfg.firebase.projectId+'</string>'),'Native Firebase project mismatch');
assert(plist.includes('<string>com.mjabid.play</string>'),'Bundle ID mismatch');
if(mode==='sandbox'){
  assert.equal(cfg.firebase.projectId,'majabeed-sandbox');
  assert.notEqual(cfg.firebase.projectId,cfg.productionFirebaseProject);
  assert.equal(cfg.purchaseSetupVerified,true,'Sandbox webhook and purchase readiness must be verified before building TestFlight');
  assert.equal(cfg.workerHostVerified,true,'Sandbox Worker must be deployed and verified before building TestFlight');
  assert.notEqual(cfg.workerHost,'waggif-baloot.samisalimhdmaol.workers.dev');
}else{
  assert.equal(cfg.firebase.projectId,'jops-e508d');
  assert.equal(cfg.workerHost,'waggif-baloot.samisalimhdmaol.workers.dev');
}
const index=path.join(root,'www/index.html');
let html=fs.readFileSync(index,'utf8');
assert.equal((html.match(/const FIREBASE_CONFIG\s*=\s*\{[\s\S]*?\};/g)||[]).length,1);
assert.equal((html.match(/const GAME_SRV='[^']+';/g)||[]).length,1);
html=html.replace(/const FIREBASE_CONFIG\s*=\s*\{[\s\S]*?\};/,'const FIREBASE_CONFIG = '+JSON.stringify(cfg.firebase,null,2)+';');
html=html.replace(/const GAME_SRV='[^']+';/,"const GAME_SRV='"+cfg.workerHost+"';");
fs.writeFileSync(index,html);
fs.writeFileSync(path.join(root,'ios/App/App/GoogleService-Info.plist'),plist);
if(fs.existsSync(path.join(root,'GoogleService-Info.plist')))fs.writeFileSync(path.join(root,'GoogleService-Info.plist'),plist);
console.log('Selected '+cfg.environment+'; Firebase '+cfg.firebase.projectId+'; Worker '+cfg.workerHost+'. Run cap sync ios next.');
