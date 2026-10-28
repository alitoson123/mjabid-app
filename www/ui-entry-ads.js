/* Shared entry allowance. Interstitial completion is reported by the native ad bridge. */
(function(root){
 'use strict';
 root.MajabeedEntryAds={
  create({getUser,isNative=()=>!!root.Capacitor?.isNativePlatform?.(),isExempt=async()=>false,exempt=()=>false,showAd=async()=>false,storage=()=>root.localStorage,onChange=()=>{}}){
   const memory=new Map(),unsaved=new Set(),prefix='mj-entry-ads-v398:';let busy=false;
   const user=()=>{try{const uid=getUser();return typeof uid==='string'&&uid?uid:null;}catch(_){return null;}};
   const native=()=>{try{return isNative()===true;}catch(_){return false;}};
   const freeMember=()=>{try{return exempt()===true;}catch(_){return false;}};
   function remaining(uid){
    if(!uid)return 2;if(unsaved.has(uid))return memory.get(uid)??2;
    try{const value=storage().getItem(prefix+uid),count=/^[012]$/.test(value??'')?Number(value):2;memory.set(uid,count);return count;}
    catch(_){return memory.get(uid)??2;}
   }
   function notify(){try{onChange();}catch(_){}}
   function save(uid,count){memory.set(uid,count);try{storage().setItem(prefix+uid,String(count));unsaved.delete(uid);}catch(_){unsaved.add(uid);}notify();}
   function snapshot(){const uid=user(),count=remaining(uid),platform=native(),member=freeMember();return {remaining:count,due:!!uid&&platform&&!member&&count===0,exempt:member,native:platform,busy};}
   async function run(work,{isCurrent=()=>true}={}){
    const uid=user(),current=()=>{try{return user()===uid&&isCurrent()!==false;}catch(_){return false;}};
    if(busy||!uid||typeof work!=='function'||!current())return false;
    busy=true;notify();
    try{
     const platform=native();let member=false,known=true;
     if(platform){try{member=(await isExempt())===true;}catch(_){known=false;}}
     if(!current())return false;
     const count=remaining(uid),charged=platform&&known&&!member;
     if(charged&&count===0){
      let shown=false;try{shown=(await showAd())===true;}catch(_){}
      if(user()!==uid)return false;
      // A completed ad earns two future entries, including when the pending
      // destination was cancelled while it played. A failed ad earns none.
      if(shown)save(uid,2);
      if(!current())return false;
      return (await work())!==false&&user()===uid;
     }
     const accepted=(await work())!==false;
     if(!accepted||user()!==uid)return false;
     // The destination may now be a live game or an open list; do not use its
     // pre-entry guard after acceptance. Rejected work must return false.
     if(charged)save(uid,Math.max(0,count-1));
     return true;
    }finally{busy=false;notify();}
   }
   return {snapshot,run,get busy(){return busy;}};
  }
 };
})(window);
