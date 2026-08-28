const C='waggif-v307';
const SHELL=['./','index.html','manifest.json','court_J.png','court_Q.png','court_K.png','court_JOKER.png','icon192.png','icon512.png','cards/10C.png','cards/10D.png','cards/10H.png','cards/10S.png','cards/2C.png','cards/2D.png','cards/2H.png','cards/2S.png','cards/3C.png','cards/3D.png','cards/3H.png','cards/3S.png','cards/4C.png','cards/4D.png','cards/4H.png','cards/4S.png','cards/5C.png','cards/5D.png','cards/5H.png','cards/5S.png','cards/6C.png','cards/6D.png','cards/6H.png','cards/6S.png','cards/7C.png','cards/7D.png','cards/7H.png','cards/7S.png','cards/8C.png','cards/8D.png','cards/8H.png','cards/8S.png','cards/9C.png','cards/9D.png','cards/9H.png','cards/9S.png','cards/AC.png','cards/AD.png','cards/AH.png','cards/AS.png','cards/JC.png','cards/JD.png','cards/JH.png','cards/JS.png','cards/KC.png','cards/KD.png','cards/KH.png','cards/KS.png','cards/QC.png','cards/QD.png','cards/QH.png','cards/QS.png','bg/majlis-default.jpg','bg/majlis-royal.jpg','bg/majlis-desert.jpg','bg/majlis-oasis.jpg','bg/majlis-club.jpg','bg/majlis-diwaniya.jpg','bg/majlis-default-preview.jpg','bg/majlis-royal-preview.jpg','bg/majlis-desert-preview.jpg','bg/majlis-oasis-preview.jpg','bg/majlis-club-preview.jpg','bg/majlis-diwaniya-preview.jpg','ranks/tier0.jpg','ranks/tier1.jpg','ranks/tier2.jpg','ranks/tier3.jpg','ranks/tier4.jpg','ranks/tier5.jpg','ranks/tier6.jpg','ranks/tier7.jpg','tiers/beginner.jpg','tiers/amateur.jpg','tiers/pro.jpg','tiers/elite.jpg','tiers/legend.jpg','sfx/dahek.wav','sfx/janb-warak.wav','sfx/joker.wav','sfx/ma-takhoza.wav','sfx/salam.wav','sfx/sar3.wav','sfx/waqf-taunt.wav','sfx/alaykum-salam.wav','sfx/bayyad-el-thib.wav','sfx/atahadak-takhoz-ha.wav','sfx/sahsah-yakhoy.wav'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{ if(e.data==='skipWaiting')self.skipWaiting(); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.includes('/ws/'))return; // الشبكة الحية لا تُخزَّن
  // لا تتدخّل في طلبات Firebase وGoogle (المصادقة)
  if(u.hostname.includes('firebase')||u.hostname.includes('google')||u.hostname.includes('gstatic')||u.hostname.includes('workers.dev'))return;
  const isDoc=e.request.mode==='navigate'||u.pathname.endsWith('index.html')||u.pathname==='/'||u.pathname.endsWith('/');
  if(isDoc){
    // network-first: تصل التحديثات فوراً، والكاش احتياطي عند انقطاع الشبكة
    e.respondWith(fetch(e.request).then(res=>{
      if(res&&res.status===200){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl))}
      return res;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(e.request.method==='GET'&&u.origin===location.origin){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl))}
    return res;
  }).catch(()=>caches.match('index.html'))));
});
