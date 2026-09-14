/* v339: avatar bytes persist in IndexedDB, including native WebViews (no SW required). */
(function(root){
  'use strict';
  const BUCKET='jops-e508d.firebasestorage.app', DAY=86400000;
  const LIMIT_BYTES=20*1024*1024, LIMIT_ITEMS=400, MAX_FILE=2*1024*1024;
  const memory=new Map(), pending=new Map(), failures=new Map();
  const stats={network:0,diskHits:0,memoryHits:0,failures:0};
  let dbPromise, active=0, pruneChain=Promise.resolve();
  const queue=[];
  function storageURL(value){
    try{const u=new URL(value);const p=decodeURIComponent(u.pathname);
      return u.protocol==='https:'&&u.hostname==='firebasestorage.googleapis.com'&&
        p.startsWith('/v0/b/'+BUCKET+'/o/avatars/')&&u.searchParams.get('alt')==='media';
    }catch(_){return false;}
  }
  function source(value,size){
    try{const u=new URL(value);const thumb=new URLSearchParams(u.hash.slice(1)).get('mj-thumb');u.hash='';
      return size<=64&&thumb&&storageURL(thumb)?thumb:u.href;
    }catch(_){return value;}
  }
  function openDB(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{
      try{const req=root.indexedDB.open('majabeed-avatar-cache',1);
        req.onupgradeneeded=()=>req.result.createObjectStore('images',{keyPath:'url'});
        req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();dbPromise=null;};resolve(db);};
        req.onerror=req.onblocked=()=>resolve(null);
      }catch(_){resolve(null);}
    });return dbPromise;
  }
  async function diskGet(url){
    const db=await openDB();if(!db)return null;
    return new Promise(resolve=>{try{const req=db.transaction('images').objectStore('images').get(url);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);
    }catch(_){resolve(null);}});
  }
  async function diskPut(row){
    const db=await openDB();if(!db)return;
    await new Promise(resolve=>{try{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(row);
      tx.oncomplete=tx.onabort=tx.onerror=()=>resolve();}catch(_){resolve();}});
    // Serialize pruning; bounded 400 records / 20 MiB, no periodic timer or server cleanup.
    pruneChain=pruneChain.then(()=>new Promise(resolve=>{try{
      const tx=db.transaction('images','readwrite'),os=tx.objectStore('images'),req=os.getAll();
      req.onsuccess=()=>{const rows=req.result.sort((a,b)=>b.saved-a.saved);let bytes=0;
        rows.forEach((r,i)=>{bytes+=r.blob.size;if(i>=LIMIT_ITEMS||bytes>LIMIT_BYTES||Date.now()>r.expires)os.delete(r.url);});};
      tx.oncomplete=tx.onabort=tx.onerror=()=>resolve();
    }catch(_){resolve();}}));
    await pruneChain;
  }
  function schedule(fn){return new Promise((resolve,reject)=>{queue.push({fn,resolve,reject});drain();});}
  function drain(){while(active<4&&queue.length){const job=queue.shift();active++;
    Promise.resolve().then(job.fn).then(job.resolve,job.reject).finally(()=>{active--;drain();});}}
  function keep(url,blob,expires){
    const old=memory.get(url);if(old)URL.revokeObjectURL(old.src);
    const item={src:URL.createObjectURL(blob),expires};memory.set(url,item);
    while(memory.size>100){const key=memory.keys().next().value;URL.revokeObjectURL(memory.get(key).src);memory.delete(key);}
    return item.src;
  }
  async function load(url){
    if(!storageURL(url))return url;
    const now=Date.now(),hit=memory.get(url);
    if(hit&&hit.expires>now){stats.memoryHits++;return hit.src;}
    if(pending.has(url))return pending.get(url);
    if((failures.get(url)||0)>now)return url;
    const task=(async()=>{
      const row=await diskGet(url);if(row&&row.expires>now){stats.diskHits++;return keep(url,row.blob,row.expires);}
      try{return await schedule(async()=>{
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
        try{stats.network++;const res=await fetch(url,{credentials:'omit',cache:'default',signal:controller.signal});
          if(!res.ok||!/^image\//i.test(res.headers.get('content-type')||''))throw Error('avatar response');
          const announced=Number(res.headers.get('content-length')||0);if(announced>MAX_FILE)throw Error('avatar size');
          const blob=await res.blob();if(!blob.size||blob.size>MAX_FILE)throw Error('avatar size');
          // Versioned v339 objects are immutable; old uid.jpg URLs expire daily locally.
          const versioned=decodeURIComponent(new URL(url).pathname).includes('/v339/');
          const expires=Date.now()+(versioned?30*DAY:DAY);
          await diskPut({url,blob,saved:Date.now(),expires});return keep(url,blob,expires);
        }finally{clearTimeout(timer);}
      });}catch(_){stats.failures++;failures.set(url,Date.now()+5*60000);
        if(failures.size>400)failures.delete(failures.keys().next().value);
        // Offline stale image is preferable. CORS/storage failures keep the browser's normal img fallback.
        return row?keep(url,row.blob,Date.now()+5*60000):url;
      }
    })().finally(()=>pending.delete(url));pending.set(url,task);return task;
  }
  const watched=new WeakSet();
  async function hydrate(img){const url=img.getAttribute('data-mj-avatar');if(!url)return;
    const src=await load(url);if(img.isConnected&&img.getAttribute('data-mj-avatar')===url){
      if(img.src!==src)img.src=src;
      if(typeof img.decode==='function')await img.decode().catch(()=>{});
    }}
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);hydrate(e.target);}});
  },{rootMargin:'80px'}):null;
  function scan(node){if(!node||node.nodeType!==1)return;
    const list=[];if(node.matches('img[data-mj-avatar]'))list.push(node);
    node.querySelectorAll('img[data-mj-avatar]').forEach(img=>list.push(img));
    list.forEach(img=>{if(watched.has(img))return;watched.add(img);if(observer)observer.observe(img);else hydrate(img);});
  }
  function init(){scan(document.body);new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(scan)))
    .observe(document.body,{childList:true,subtree:true});}
  root.MajabeedImages={source,storageURL,load,prepare:hydrate,stats};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
