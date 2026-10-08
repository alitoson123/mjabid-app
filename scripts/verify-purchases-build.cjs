const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('www/index.html'),sw=read('www/sw.js');
assert(html.includes("APP_VERSION='1.7.0'"));assert(sw.includes("waggif-v375"));
assert(read('www/ui-results-store.js').includes('window.GoldShop?.render()'));
assert(read('www/ui-navigation.js').includes('الإنجازات'));
const shell=vm.runInNewContext(sw.match(/const SHELL=(\[.*?\]);/s)[1]);
for(const asset of shell){if(asset==='./')continue;assert(fs.existsSync(path.join(root,'www',asset.split('?')[0])),'Missing cache asset '+asset);}
for(const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"#:]+\.(?:js|css)(?:\?[^"#]*)?)"/g)){
 if(m[1].startsWith('http'))continue;
 assert(fs.existsSync(path.join(root,'www',m[1].split('?')[0])),'Missing script/style '+m[1]);
}
for(const file of ['native-shop.js','ui-commerce.js','ui-vip.js'])new vm.Script(read('www/'+file));
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc=/.test(m[1]))new vm.Script(m[2]);
assert(read('ios/App/Podfile').includes("pod 'RevenuecatPurchasesCapacitor'"));
assert(read('ios/App/App.xcodeproj/project.pbxproj').includes('com.apple.InAppPurchase'));
if(process.argv.includes('--copied'))for(const f of ['index.html','native-shop.js','ui-commerce.js','ui-vip.js','ui-results-store.js','sw.js'])assert.equal(read('www/'+f),read('ios/App/App/public/'+f),'Stale native asset '+f);
console.log('PASS: native scripts, subscription plugin, v375 cache, inline syntax, and asset copying');
