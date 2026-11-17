/* Bounded, server-confirmed admin lookup. Never enumerate players to find a username. */
(function(global){
  'use strict';
  const text=value=>typeof value==='string'?value:'';
  const validId=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[\/\p{C}]/u.test(value)&&value!=='.'&&value!=='..';
  function input(value,manual){
    const raw=text(value).trim(),username=raw.replace(/^@/,'').trim(),lower=username.toLowerCase();
    if(!raw)return {empty:true};
    if(raw.length>128||/[\/\p{C}]/u.test(raw))return {invalid:true};
    if(manual)return raw.length>=2?{kind:'name',raw,lower:raw.normalize('NFKC').toLowerCase().replace(/\s+/g,' ')}:{invalid:true};
    if(/^[a-z0-9_]{3,16}$/.test(lower))return {kind:'username',raw:username,lower,explicitUsername:raw.startsWith('@')};
    if(!raw.startsWith('@')&&/^[A-Za-z0-9_-]{20,128}$/.test(raw))return {kind:'uid',raw};
    if(!raw.startsWith('@')&&raw.length>=2&&raw.length<=80)return {kind:'name',raw,lower:raw.normalize('NFKC').toLowerCase().replace(/\s+/g,' ')};
    return {invalid:true};
  }
  function profileMatches(data,field,target){
    const primary=text(data?.[field]).trim(),candidate=primary||text(data?.[field+'_lc']).trim();
    const normalized=field==='name'?candidate.normalize('NFKC').toLowerCase().replace(/\s+/g,' '):candidate.toLowerCase();
    return !!candidate&&normalized===target;
  }
  async function lookup(db,query,live,convert){
    const check=()=>{if(!live())throw Error('stale');};
    const get=async ref=>{check();const value=await ref.get({source:'server'});check();return value;};
    const players=db.collection('players');
    if(query.kind==='uid'){const doc=await get(players.doc(query.raw));return doc.exists?[convert(doc)]:[];}
    if(query.kind==='username'){
      const reserved=await get(db.collection('usernames').doc(query.lower));
      const uid=reserved.exists?reserved.data()?.uid:null;
      if(validId(uid)){
        const doc=await get(players.doc(uid));
        if(doc.exists){const p=doc.data()||{};
          // A renamed/stale reservation must not identify the wrong account.
          if(profileMatches(p,'username',query.lower))return [convert(doc)];
        }
      }
    }
    const field=query.kind==='name'?'name':'username',fields=[[field+'_lc',query.lower]];
    for(const value of new Set([query.raw,query.lower]))fields.push([field,value]);
    const snapshots=await Promise.all(fields.map(([field,value])=>get(players.where(field,'==',value).limit(10))));
    check();const seen=new Set(),items=[];
    for(const snap of snapshots)for(const doc of snap.docs){if(seen.has(doc.id)||!profileMatches(doc.data(),field,query.lower))continue;seen.add(doc.id);items.push(convert(doc));if(items.length===10)return items;}
    if(!items.length&&query.kind==='username'&&!query.explicitUsername)return lookup(db,{kind:'name',raw:query.raw,lower:query.raw.normalize('NFKC').toLowerCase().replace(/\s+/g,' ')},live,convert);
    return items;
  }
  function create(options){
    let run=0,timer=null,timeout=null;
    const delay=options.delay??280,wait=options.wait??15000,set=options.setTimer||setTimeout,clear=options.clearTimer||clearTimeout;
    function cancel(){run++;if(timer!==null)clear(timer);if(timeout!==null)clear(timeout);timer=null;timeout=null;}
    function search(value,{manual=false,immediate=false}={}){
      cancel();let settled=false;const id=run,context=options.context(),query=input(value,manual),live=()=>!settled&&id===run&&options.current(context);
      const emit=state=>{if(live())options.onState({...state,manual});};
      if(!live())return;
      if(query.empty){emit({phase:'empty',items:[]});return;}
      if(query.invalid){emit({phase:'invalid',items:[]});return;}
      emit({phase:'waiting',items:[]});
      timer=set(async()=>{
        timer=null;if(!live())return;emit({phase:'loading',items:[]});
        try{
          const failure=new Promise((_,reject)=>{timeout=set(()=>{timeout=null;reject(Error('timeout'));},wait);});
          const items=await Promise.race([lookup(options.db,query,live,options.convert),failure]);
          emit({phase:'done',items,kind:query.kind});
        }catch(_){emit({phase:'error',items:[]});}
        finally{settled=true;if(id===run&&timeout!==null){clear(timeout);timeout=null;}}
      },immediate?0:delay);
    }
    return {search,cancel};
  }
  const api={create,input,lookup};if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.AdminPlayerSearch=api;
})(typeof window!=='undefined'?window:globalThis);
