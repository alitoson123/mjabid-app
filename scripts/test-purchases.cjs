const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');let count=0;
function setup(){
 const dom=new JSDOM('<button id="home">Home</button><div id="goldPkgList"></div>',{url:'https://localhost',runScripts:'outside-only'}),w=dom.window;
 let enabled=true,status='awaiting_confirmation',vip=false,buys=0,refreshes=0,cancel=false,switchDuring=false;
 const product={identifier:'mjabid.gold.500',priceString:'€1.49'};
 w.Capacitor={getPlatform:()=> 'ios'};w.FB={user:{uid:'u1',getIdToken:async()=> 'token'},auth:{currentUser:{uid:'u1'}}};w.GAME_SRV='example.test';w.AbortController=AbortController;
 w.freshGold=async()=>refreshes++;w.refreshHome=()=>{};w.VipClient={refresh:async()=>({active:vip})};
 w.setTimeout=(fn,ms)=>{if(ms===4000)queueMicrotask(fn);return 1;};w.clearTimeout=()=>{};
 w.fetch=async(url)=>({ok:true,json:async()=>url.endsWith('/native/readiness')?{ok:true,enabled,stores:{ios:enabled}}:url.endsWith('/commerce')?{ok:true,packages:[{key:'tier1',baseGold:500,gold:500,sar:5}]}:url.endsWith('/vip-status')?{ok:true,active:vip}:{ok:true,status,kind:product.identifier.includes('.vip.')?'vip':'gold',gold:500,wallet:{gold:700}}});
 w.Purchases={configure:async()=>{},logIn:async()=>{},getProducts:async()=>({products:[product]}),restorePurchases:async()=>({customerInfo:{entitlements:{active:{vip:{isActive:true}}}}}),purchaseStoreProduct:async()=>{buys++;if(cancel)throw {userCancelled:true};if(switchDuring){w.FB.user={uid:'u2',getIdToken:async()=> 'token2'};w.FB.auth.currentUser.uid='u2';}return {transaction:{transactionIdentifier:'tx1'}};}};
 const adapter=fs.readFileSync(root+'/native/purchases-adapter.js','utf8').replace(/^import .*;$/gm,'').replace('export function','function');
 const entry=fs.readFileSync(root+'/native/shop-entry.js','utf8').replace(/^import .*;$/gm,'');w.eval(adapter+'\n'+entry);
 const button=t=>[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes(t));
 return {w,dom,product,button,text:()=>w.document.body.textContent,setReady:x=>enabled=x,setStatus:x=>status=x,setVip:x=>vip=x,cancel:()=>cancel=true,switchUser:()=>switchDuring=true,buys:()=>buys,refreshes:()=>refreshes};
}
async function test(name,fn){const t=setup();try{await fn(t);count++;console.log('PASS '+name);}finally{t.dom.window.close();}}
(async()=>{
 await test('disabled backend never offers payment',async t=>{t.setReady(false);await t.w.NativeShop.openGold('tier1');assert.match(t.text(),/قيد التجهيز/);assert.equal(t.button('شراء'),undefined);assert.equal(t.buys(),0);});
 await test('gold displays localized store price, not planned SAR',async t=>{await t.w.NativeShop.openGold('tier1');assert.match(t.text(),/€1.49/);assert.doesNotMatch(t.text(),/5 ر.س/);});
 await test('pending purchase only retries verification',async t=>{await t.w.NativeShop.openGold('tier1');await t.button('شراء').onclick();assert.match(t.text(),/قيد التحقق/);assert.equal(t.buys(),1);assert.equal(t.refreshes(),0);await t.button('تحقق مجددًا').onclick();assert.equal(t.buys(),1);});
 await test('confirmed gold refreshes wallet and shows success',async t=>{t.setStatus('completed');await t.w.NativeShop.openGold('tier1');await t.button('شراء').onclick();assert.match(t.text(),/وصل ذهبك/);assert.equal(t.refreshes(),1);});
 await test('cancelled store sheet never shows success',async t=>{t.cancel();await t.w.NativeShop.openGold('tier1');await t.button('شراء').onclick();assert.match(t.text(),/أُلغيت/);assert.equal(t.refreshes(),0);});
 await test('account switch suppresses success and retains original receipt',async t=>{t.switchUser();t.setStatus('completed');await t.w.NativeShop.openGold('tier1');await t.button('شراء').onclick();assert.doesNotMatch(t.text(),/وصل ذهبك/);assert.equal(t.refreshes(),0);assert.match(t.w.localStorage.getItem('mjabid-native-pending-u1'),/tx1/);});
 await test('readiness is checked again immediately before payment',async t=>{await t.w.NativeShop.openGold('tier1');t.setReady(false);await t.button('شراء').onclick();assert.equal(t.buys(),0);});
 await test('VIP ledger record alone does not activate benefits',async t=>{t.product.identifier='mjabid.vip.monthly';t.setStatus('subscription_recorded');await t.w.NativeShop.openVip();await t.button('شهر واحد').onclick();assert.match(t.text(),/يتجدد تلقائيًا/);assert.equal(t.w.document.querySelectorAll('.nativeLegal a').length,2);await t.button('اشتراك ·').onclick();assert.match(t.text(),/قيد التحقق/);assert.doesNotMatch(t.text(),/عضويتك مفعّلة/);});
 await test('VIP becomes successful only after server reports active',async t=>{t.product.identifier='mjabid.vip.monthly';t.setStatus('subscription_recorded');t.setVip(true);await t.w.NativeShop.openVip();await t.button('شهر واحد').onclick();await t.button('اشتراك ·').onclick();assert.match(t.text(),/عضويتك مفعّلة/);});
 await test('restore ignores SDK active flag and follows server',async t=>{await t.w.NativeShop.openVip();await t.button('استعادة').onclick();assert.match(t.text(),/لا يظهر اشتراك نشط/);assert.equal(t.buys(),0);});
 console.log(count+' native UI cases passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
