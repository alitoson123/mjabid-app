'use strict';
const CUP={data:null,open:false,busy:false,timer:null};
async function cupRequest(action='status',extra={}){
 if(!FB.user){toast2('سجّل دخولك للمشاركة في البطولة');return;}
 if(CUP.busy)return;CUP.busy=true;
 try{
  let pid=localStorage.getItem('wb-player-id');if(!pid){pid='p-'+Math.random().toString(36).slice(2,12);localStorage.setItem('wb-player-id',pid);}
  const idToken=await FB.user.getIdToken();
  const res=await fetch('https://'+GAME_SRV+'/tournament',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,idToken,pid,name:localStorage.getItem('wb-name')||'لاعب',avatar:myAvatar(),...extra})});
  if(!res.ok)throw Error('تعذّر الاتصال بالبطولة');const data=await res.json();if(!data.ok)throw Error(data.error||'تعذّر تحديث البطولة');CUP.data=data;cupRender();
 }catch(e){toast2(e.message);}finally{CUP.busy=false;}
}
function cupOpen(){CUP.open=true;document.getElementById('cupBackdrop').classList.remove('hidden');cupRequest();clearInterval(CUP.timer);CUP.timer=setInterval(()=>{if(CUP.open&&!document.hidden)cupRequest();},15000);}
function cupClose(){CUP.open=false;clearInterval(CUP.timer);document.getElementById('cupBackdrop').classList.add('hidden');document.getElementById('hTournament').focus();}
function cupDate(t){return new Date(t).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function cupRender(){
 const x=CUP.data;if(!x)return;const d=x.day,r=x.rules;const body=document.getElementById('cupBody');
 const drafts={team:document.getElementById('cupTeamName')?.value,code:document.getElementById('cupCode')?.value,focus:document.activeElement?.id};
 const status={scheduled:'التسجيل يفتح قريبًا',registration:'التسجيل مفتوح',starting:'تجهيز القرعة',playing:'البطولة جارية',finished:'مبروك لأبطال الليلة',cancelled:'لم تكتمل بطولة اليوم'}[d.status]||d.status;
 const count=d.teams.filter(t=>t.members.length===2).length;
 const names=id=>d.teams.find(t=>t.id===id)?.name||'بانتظار المتأهل';
 body.innerHTML=`<div class="cupHero"><span class="cupTrophy"><svg viewBox="0 0 64 64" width="54" height="54" fill="none" aria-hidden="true"><path d="M20 10h24v14c0 12-5 18-12 18s-12-6-12-18V10Z" fill="#e6c279" stroke="#a7772e" stroke-width="2"/><path d="M20 15H10v8c0 8 6 13 13 13m21-21h10v8c0 8-6 13-13 13M32 42v10m-12 4h24" stroke="#b68a40" stroke-width="4" stroke-linecap="round"/><path d="m32 17 6 9-6 9-6-9 6-9Z" fill="#28533e"/></svg></span><span>كل يوم · ٩ مساءً بتوقيت السعودية</span><h2>${status}</h2><p>${esc(cupDate(d.start))} · ٨ فرق · خروج المغلوب</p></div>
 <div class="cupPrizes"><div><small>المركز الأول · لكل لاعب</small><b>${toH(r.first)} ${uiGoldCoin()}</b></div><div><small>المركز الثاني · لكل لاعب</small><b>${toH(r.second)} ${uiGoldCoin()}</b></div></div>
 ${x.previous?`<div class="cupTomorrow"><h3>نتيجة البطولة السابقة</h3><p>${esc(x.previous.id)}</p>${x.previous.status==='cancelled'?'<p>لم تكتمل البطولة</p>':`<p>البطل: ${esc(x.previous.champion||'—')}</p><p>الوصيف: ${esc(x.previous.runnerUp||'—')}</p>`}${x.previous.paymentPending?'<p role="status">جارٍ استكمال تسوية المدفوعات السابقة.</p>':''}</div>`:''}
 ${d.retrying||d.paymentPending?'<p class="cupNote" role="status">جارٍ استكمال المزامنة وتسوية المدفوعات؛ لا يلزم إعادة الدفع.</p>':''}
 <p class="cupNote">${d.status==='scheduled'?(d.open===null?'يفتح التسجيل بعد ساعة من نهاية البطولة السابقة.':'يفتح التسجيل '+esc(cupDate(d.open))):d.status==='registration'?'سجّل الآن؛ التسجيل مستمر إلى بداية البطولة الساعة ٩ مساءً.':'التسجيل للبطولة التالية يفتح بعد ساعة من نهاية هذه البطولة.'}</p>
 <p class="cupFee">الدخول ${toH(r.fee)} ذهب لكل لاعب · الخصم عند بدء البطولة</p>
 <p>اكتمل ${toH(count)} من ٨ فرق</p><div class="cupTeams">${d.teams.map(t=>`<article><b>${esc(t.name)}</b><span>${t.members.map(p=>esc(p.name)+(p.ready?' ✓':'')).join(' + ')}</span><small>${t.members.length===1?'حجز مؤقت ٣ دقائق لإكمال الفريق':'فريق مكتمل'}</small></article>`).join('')||'<p>كن أول فريق يحجز مكانه</p>'}</div>
 ${x.mine?`<div class="cupMine"><b>فريقك: ${esc(names(x.mine.id))}</b><p>رمز انضمام شريكك: <strong>${esc(x.mine.code)}</strong></p>${d.status==='registration'?`<button data-cup="ready">${x.mine.ready?'أكدت حضورك ✓':'تأكيد حضوري — من ٨:٥٥'}</button><button data-cup="cancel">إلغاء تسجيل الفريق</button>`:''}</div>`:''}
 ${!x.mine&&d.status==='registration'?'<div class="cupSignup"><input id="cupTeamName" aria-label="اسم الفريق" maxlength="30" placeholder="اسم فريقك"><button data-cup="create">احجز فريقًا وادعُ شريكك</button><input id="cupCode" aria-label="رمز الفريق" maxlength="8" placeholder="رمز فريق صديقك"><button data-cup="join">انضم لفريق صديقك</button></div>':''}
 ${!x.mine&&['registration','playing'].includes(d.status)?`<button data-cup="${x.waiting?'unwait':'wait'}">${x.waiting?'إلغاء الانتظار':'دخول قائمة البدلاء · ٣٠٠ ذهب عند إسناد المقعد'}</button><p class="cupNote">الانتظار موافقة على دخول أي فريق يحتاج بديلًا. أبقِ هذه الصفحة مفتوحة وتابع إسناد مقعدك. المنسحب لا يعود ولا يستلم جائزة؛ البديل يستحق جائزة مقعده إن تأهل فريقه.</p>`:''}
 ${x.assignment?`<button class="cupEnter" data-cup="enter">ادخل مباراة فريقك</button>`:''}
 ${d.matches.length?`<h3>طريق الكأس</h3>${d.matches.map(m=>`<div class="cupMatch"><small>المرحلة ${toH(m.round)}</small><span>${esc(names(m.teams[0]))} × ${esc(names(m.teams[1]))}</span>${m.winner?'<b>تأهل '+esc(names(m.winner))+'</b>':'<small>بانتظار الحسم</small>'}</div>`).join('')}`:''}
 ${['finished','cancelled'].includes(d.status)?`<div class="cupTomorrow"><h3>بطولة الغد جاهزة</h3><p>${esc(x.tomorrow.id)} · التسجيل بعد ساعة من النهاية · البداية ٩ مساءً</p>${d.champion?'<b>البطل: '+esc(names(d.champion))+'</b>':''}</div>`:''}
 <p class="cupNote">أكد حضورك أنت وشريكك بين ٨:٥٥ و٩. نبدأ بـ٨ فرق أو ٤ فرق مكتملة؛ خلاف ذلك تُلغى البطولة دون رسوم. عند شغور مقعد تتوقف الطاولة حتى دخول بديل؛ المهلة ٩٠ ثانية ثم حسم بالانسحاب. الانسحاب بعد البدء لا يعيد الرسوم.</p>`;
 for(const [id,val] of [['cupTeamName',drafts.team],['cupCode',drafts.code]]){const el=document.getElementById(id);if(el&&val!==undefined)el.value=val;}
 if(['cupTeamName','cupCode'].includes(drafts.focus))document.getElementById(drafts.focus)?.focus();
 body.querySelectorAll('[data-cup]').forEach(b=>b.onclick=()=>{const a=b.dataset.cup;if(a==='enter'){cupClose();ONL.pendingTier=null;ONL.pendingMode='team';const params=new URLSearchParams();params.set('room',x.assignment);history.replaceState(null,'',location.pathname+'?'+params);enterOnline();return;}cupRequest(a,{teamName:document.getElementById('cupTeamName')?.value,code:document.getElementById('cupCode')?.value});});
}
document.getElementById('hTournament').onclick=cupOpen;
document.getElementById('cupClose').onclick=cupClose;
document.getElementById('cupRefresh').onclick=()=>cupRequest();
document.getElementById('cupBackdrop').addEventListener('click',e=>{if(e.target.id==='cupBackdrop')cupClose();});

document.getElementById('cupBackdrop').addEventListener('keydown',e=>{if(e.key==='Escape')cupClose();});
