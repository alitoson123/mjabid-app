'use strict';
// Run from the root of Ali's mjabid-app repository, before/after cap sync ios.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'FILES_V325.json'),'utf8'));
for(const f of manifest.files){
 const p=path.resolve(f.path);assert(fs.existsSync(p),'Missing update file: '+f.path);
 const actual=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(actual,f.sha256,'Unexpected content: '+f.path);
}
const sw=fs.readFileSync('www/sw.js','utf8');assert(sw.includes("waggif-v325"));
const shell=JSON.parse(sw.match(/const SHELL=(\[.*?\]);/s)[1].replace(/'/g,'"'));
for(const asset of shell)if(asset!=='./')assert(fs.existsSync(path.join('www',asset)),'Missing precache asset: '+asset);
for(const asset of ['admob-plugin.js','firebase-auth-plugin.js'])assert(fs.existsSync(path.join('www',asset)),'Missing generated plugin: '+asset);
const cfg=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));assert.equal(cfg.appId,'com.mjabid.play');assert.equal(cfg.webDir,'www');assert.deepEqual(cfg.plugins.FirebaseAuthentication.providers,['apple.com']);
if(process.argv.includes('--synced')){
 for(const f of manifest.files.filter(f=>f.path.startsWith('www/'))){
  const p=path.join('ios/App/App/public',f.path.slice(4));assert(fs.existsSync(p),'Not copied by Capacitor: '+p);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),f.sha256,'Native copy differs: '+p);
 }
 const native=JSON.parse(fs.readFileSync('ios/App/App/capacitor.config.json','utf8'));assert.deepEqual(native.plugins.FirebaseAuthentication.providers,['apple.com']);
}
console.log('PASS: v325 files, Apple config, plugins and '+shell.length+' precache entries'+(process.argv.includes('--synced')?' including native iOS assets':'')+'.');
