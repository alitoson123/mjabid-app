/* Majabeed admin v366. One-shot, bounded reads; no presence polling or listeners. */
(function(global){
  'use strict';
  const BASE='https://waggif-baloot.samisalimhdmaol.workers.dev';
  const state={uid:null,generation:0,controllers:new Set(),metrics:null,metricsAt:0,metricsJob:null,reportRun:0,reportFilter:'open',reportCursor:null,reports:[],reportBusy:false,bulk:false,bulkCancel:false,playerRun:0,player:null,playerRequest:null,unlinkedReportName:null,playerBusy:false,focus:null,roomsRun:0};
  const el=id=>document.getElementById(id);
  const escape=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('en-US').format(Number(value));
  const count=(value,lower)=>value==null?'—':(lower?'≥ ':'')+number(value);
  const stamp=value=>{if(value?.toMillis)return value.toMillis();if(value&&typeof value==='object')return Number(value.seconds||value._seconds||0)*1000;return Number(value)||0;};
  const date=value=>{const n=stamp(value);return n?new Intl.DateTimeFormat('ar-SA-u-nu-latn',{timeZone:'Asia/Riyadh',calendar:'gregory',dateStyle:'medium',timeStyle:'short',hour12:false}).format(n):'وقت غير متاح';};
  function text(id,value){const node=el(id);if(node)node.textContent=value;}
  function notice(id,message,error){const node=el(id);if(node){node.textContent=message||'';node.classList.toggle('adError',!!error);}}
  function localError(error){return /[\u0600-\u06ff]/.test(error?.message||'')?error.message:'تعذّر الاتصال. تأكد من تحديث السيرفر ثم أعد المحاولة.';}
  function empty(message){return '<div class="empty">'+escape(message)+'</div>';}
  function current(uid,generation){return state.uid===uid&&state.generation===generation&&typeof auth!=='undefined'&&auth.currentUser?.uid===uid;}
  async function api(path,body){
    const user=typeof auth!=='undefined'?auth.currentUser:null;
    if(!user||!ADMIN_UIDS.includes(user.uid))throw Error('سجّل الدخول بحساب الإدارة.');
    const uid=user.uid,generation=state.generation,controller=new AbortController();state.controllers.add(controller);
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const token=await user.getIdToken();if(!current(uid,generation))throw Error('تغير الحساب؛ افتح الصفحة من جديد.');
      const response=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:controller.signal});
      let data;try{data=await response.json();}catch(_){throw Error('خدمة الإدارة غير متاحة؛ تحقق من نشر ملفات السيرفر الجديدة.');}
      if(!current(uid,generation))throw Error('تغير الحساب؛ افتح الصفحة من جديد.');
      if(!response.ok||!data.ok){const error=Error(data.error||'تعذّر تنفيذ الطلب.');error.code=data.code;throw error;}
      return data;
    }catch(error){if(error.name==='AbortError')throw Error('تأخر الرد. حدّث البيانات للتحقق من النتيجة قبل تكرار الإجراء.');throw error;}
    finally{clearTimeout(timeout);state.controllers.delete(controller);}
  }
  function reset(uid){
    if(state.uid===uid)return;
    state.controllers.forEach(c=>c.abort());state.controllers.clear();state.uid=uid;state.generation++;
    state.metrics=null;state.metricsAt=0;state.metricsJob=null;state.reportRun++;state.reportBusy=false;state.reportCursor=null;state.reports=[];state.roomsRun++;
    state.bulkCancel=true;state.bulk=false;closePlayer(true);
    for(const id of ['adPlusActive','adCupToday','adCupTotal','adSakkaMatchesToday','adSakkaMatchesTotal','adSakkaToday','adSakkaCurrent','adSakkaPlaying','adSakkaSearching','adSakkaRooms','statTotal','statActive','statBanned','adCompetitive','adCompleted','adSearching','adRoomsPlaying','adObservedToday','adObservedWeek','adReturning','adGrowthDelta'])text(id,'—');
    for(const id of ['adPlusNote','adCupNote','adSakkaMatchesNote'])text(id,'');
    for(const id of ['adMatchesChart','adGrowthChart','reportsList','roomsList','visitsCards','visitsList']){const node=el(id);if(node)node.replaceChildren();}
    for(const id of ['adBulkBox','adReportsMore'])if(el(id))el(id).hidden=true;
    for(const id of ['adMetricsRefresh','adReportsRefresh','adReportsMore','adRoomsRefresh','adCloseAll','adPlayerClose','adPlayerReload'])if(el(id))el(id).disabled=false;
  }
  async function dashboard(force){
    if(!force&&state.metrics&&Date.now()-state.metricsAt<30000)return state.metrics;
    if(state.metricsJob)return state.metricsJob;
    const generation=state.generation;
    const job=api('/admin/metrics',{action:'dashboard'}).then(data=>{if(generation===state.generation){state.metrics=data;state.metricsAt=Date.now();}return data;});
    state.metricsJob=job;try{return await job;}finally{if(state.metricsJob===job)state.metricsJob=null;}
  }
  function chart(rows,key,label){
    const days=(rows||[]).slice(0,14).reverse();
    if(!days.length)return empty('لا توجد بيانات متاحة بعد.');
    const values=days.map(r=>r.recorded===false?null:r[key]);
    const max=Math.max(1,...values.filter(v=>v!=null).map(Number));
    const width=660,height=178,margin=20,gap=8,slot=(width-margin*2)/days.length,bar=Math.min(32,slot-gap);
    const svg=days.map((row,i)=>{const value=values[i],x=margin+i*slot+(slot-bar)/2,h=value==null?0:Math.max(2,Number(value)/max*112),y=134-h;return '<g><title>'+escape(row.day+': '+number(value))+'</title>'+(value==null?'<line x1="'+x+'" x2="'+(x+bar)+'" y1="133" y2="133" stroke="#a8b6ae" stroke-dasharray="3 3"/>':'<rect x="'+x+'" y="'+y+'" width="'+bar+'" height="'+h+'" rx="5" fill="'+(i===days.length-1?'#bd9343':'#356d57')+'"/>')+'<text x="'+(x+bar/2)+'" y="'+(value==null?119:y-6)+'" text-anchor="middle" font-size="11" fill="#536b5e">'+escape(number(value))+'</text><text x="'+(x+bar/2)+'" y="158" text-anchor="middle" font-size="11" fill="#708476">'+escape(String(row.day).slice(5))+'</text></g>';}).join('');
    return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape(label)+'" xmlns="http://www.w3.org/2000/svg"><title>'+escape(label)+'</title><line x1="16" x2="644" y1="136" y2="136" stroke="#dde7df"/>'+svg+'</svg><details class="adDataDetails"><summary>عرض الأرقام</summary><div class="adTableScroll"><table><thead><tr><th>اليوم</th><th>'+escape(label)+'</th></tr></thead><tbody>'+days.map((row,i)=>'<tr><td dir="ltr">'+escape(row.day)+'</td><td dir="ltr">'+number(values[i])+'</td></tr>').join('')+'</tbody></table></div></details>';
  }
  function paintDashboard(data){
    const live=data.live,accounts=data.accounts,matches=data.matches,growth=data.growth;
    text('statTotal',count(accounts?.total));text('statBanned',count(accounts?.banned));
    text('statActive',count(live?.activePlayers,true));text('adCompetitive',count(live?.competitivePlayers,true));text('adSearching',count(live?.searchingPlayers,true));text('adRoomsPlaying',count(live?.roomsPlaying,true));
    text('adCompleted',count(matches?.today?.completed));
    text('adCompletedNote',matches?.today?.partialDay?'من بدء التتبع اليوم · توقيت السعودية':'من 00:00 بتوقيت السعودية');
    const membership=data.memberships;
    const membershipKnown=membership?.activePlus!=null&&membership.completeCoverage===true;
    text('adPlusActive',membership?count(membershipKnown?membership.activePlus:membership.activeGold,!membershipKnown):'—');
    text('adPlusNote',membership?(membershipKnown?'إجمالي الاشتراكات السارية. ':'حد أدنى من اشتراكات الذهب المرصودة؛ الإجمالي الكامل غير متاح. ')+(membership.definition||'ينتهي احتساب الاشتراك عند انتهاء صلاحيته.'):'إحصاء الاشتراكات غير متاح حاليًا.');
    for(const [key,todayId,totalId,noteId]of [['cup','adCupToday','adCupTotal','adCupNote'],['sakka','adSakkaMatchesToday','adSakkaMatchesTotal','adSakkaMatchesNote']]){
      const metric=data.matchTypes?.[key],started=metric?.trackingStartedAt;
      text(todayId,number(started?metric.today:null));text(totalId,number(started?metric.total:null));
      text(noteId,!metric?'إحصاءات المباريات غير متاحة حاليًا.':!started?'لم تُسجّل مباراة بعد بدء هذا الرصد. البيانات القديمة غير مكتملة.':
        'بدأ الرصد في '+date(started)+'. '+(metric.earliestEndedAt&&metric.earliestEndedAt<started?'تشمل البيانات نتائج محفوظة أقدم تم التحقق منها. ':'')+'الإجمالي يخص النتائج المرصودة؛ لا يمثل كامل التاريخ.'+(metric.definition?' '+metric.definition:''));
    }
    text('adLiveCoverage',live?'حد أدنى للرصد · فُحصت '+number(live.sampledRooms)+' طاولة و'+number(live.sampledPlayers)+' سجلًا حديثًا. '+(live.failedRooms?'تعذر التحقق من '+number(live.failedRooms)+' طاولة. ':'')+'لا يشمل من يوجد في الرئيسية فقط.':'مؤشرات الاتصال غير متاحة حاليًا؛ لم تُستبدل بأرقام تقديرية.');
    el('adMatchesChart').innerHTML=matches?chart(matches.days,'completed','مباريات مكتملة'):empty('تعذّر تحميل سجل المباريات.');
    el('adGrowthChart').innerHTML=growth?chart(growth.days,'unique','حسابات مرصودة'):empty('تعذّر تحميل رصد الزيارات.');
    const today=matches?.today;
    el('adMatchBreakdown').innerHTML=today?['competitive','friendly','league','tournament'].map((key,i)=>'<span>'+['تنافسي','ودي','دوري','بطولة'][i]+' <b>'+number(today[key])+'</b></span>').join(''):'';
    text('adTrackingNote',matches?.trackingStartedAt?'بدأ التتبع في '+date(matches.trackingStartedAt)+'. الأيام السابقة تظهر دون قيمة.':'يبدأ تسجيل المباريات بعد نشر تحديث السيرفر؛ لا تُحسب المباريات السابقة بأثر رجعي.');
    text('adObservedToday',number(growth?.todayObserved));text('adObservedWeek',number(growth?.weekObserved));text('adReturning',number(growth?.returningObserved));
    const change=growth?.weekChangePct;
    text('adGrowthDelta',change==null?'المقارنة غير متاحة':(change>0?'+':'')+number(Math.round(change*10)/10)+'%');
    el('adGrowthDelta').classList.toggle('adNegative',change!=null&&change<0);
    text('adGrowthNote',growth?'الرصد متاح في '+number(growth.weekRecordedDays)+' من 7 أيام، مقابل '+number(growth.previousWeekRecordedDays)+' أيام للفترة السابقة. الفترة السابقة: '+number(growth.previousWeekObserved)+' حسابًا. العودة بين الفترتين: '+(growth.returningPct==null?'غير متاحة':number(Math.round(growth.returningPct*10)/10)+'%')+'. تعتمد المقارنة على سجلات الزيارات المتاحة، وليست إجمالي الحسابات الجديدة.':'مقارنة النمو غير متاحة حاليًا.');
    const sakka=data.baloot;
    text('adSakkaToday',number(sakka?.todayPlayers));text('adSakkaCurrent',count(sakka?.currentPlayers,sakka?.partial));text('adSakkaPlaying',count(sakka?.playingPlayers,sakka?.partial));text('adSakkaSearching',number(sakka?.searchingPlayers));text('adSakkaRooms',count(sakka?.roomsPlaying,sakka?.partial));
    text('adSakkaNote',sakka?(sakka.partial?'الرصد الحالي جزئي؛ ≥ تعني حدًا أدنى. ':'')+(sakka.trackingStartedAt?(sakka.partialDay?'بدأ رصد اليوم في '+date(sakka.trackingStartedAt)+'. ':'اليوم من 00:00 بتوقيت السعودية. '):'يبدأ الرصد مع أول اتصال بعد نشر السيرفر. ')+sakka.definition:'إحصاءات صكة غير متاحة؛ حدّث السيرفر وأعد تحميل المؤشرات.');
    const errors=(data.errors||[]).length;
    notice('adMetricsStatus','آخر تحديث: '+date(data.asOf)+(errors?' · بعض المؤشرات غير متاحة؛ أعد التحديث لاحقًا.':' · الأرقام تُحدّث عند الطلب.'),errors>0);
  }
  async function loadOverview(force){
    const generation=state.generation,button=el('adMetricsRefresh');button.disabled=true;notice('adMetricsStatus','جارٍ تحديث المؤشرات…');
    try{const data=await dashboard(force);if(generation!==state.generation)return;paintDashboard(data);}
    catch(error){if(generation===state.generation)notice('adMetricsStatus',localError(error)+(state.metrics?' الأرقام المعروضة من آخر تحديث ناجح.':''),true);}
    finally{if(generation===state.generation)button.disabled=false;}
  }
  function voiceReason(reason){return ({abuse:'إساءة لفظية',harassment:'مضايقة',hate:'خطاب كراهية',sexual:'محتوى جنسي',threat:'تهديد',spam:'إزعاج متكرر',privacy:'مشاركة معلومات خاصة',other:'مخالفة أخرى'})[reason]||reason||'لم يُذكر سبب';}
  function voiceEvidence(report){
    const game=report.game==='sakka'?'صكة':report.game==='majabeed'?'مجابيد':'';
    return '<p class="adNote">بلاغ عن محادثة صوتية؛ لا يوجد تسجيل صوتي.</p>'+((game||report.roomId)?'<p class="adNote">'+(game?'اللعبة: '+game+' · ':'')+(report.roomId?'الطاولة: <bdi>'+escape(report.roomId)+'</bdi>':'')+'</p>':'');
  }
  function reportCard(report){
    const message=report.kind==='message',profile=report.kind==='profile',voice=report.kind==='voice',targeted=message||profile||voice;
    const title=message?'بلاغ رسالة':profile?'بلاغ حساب':voice?'بلاغ صوتي':report.category==='bug'?'شكوى تقنية':'اقتراح';
    const target='<button class="adReportTarget" data-ad-report-player="'+escape(report.id)+'"><span class="adReportAva" aria-hidden="true">'+(message?'✉':'◎')+'</span><span><small>المُبلَّغ عليه</small><b>'+escape(report.reportedName||'حساب غير معروف')+'</b><span class="adLinkHint">فتح الحساب والإجراء ←</span></span></button>';
    return '<article class="adReport"><div class="adReportTop"><span class="adTag">'+title+'</span><span class="adReportDate">'+escape(date(report.ts))+'</span><span class="adReportState '+(report.status==='resolved'?'isClosed':'')+'">'+(report.status==='resolved'?'مغلق':'مفتوح')+'</span></div>'+(targeted?target:'')+(message?'<blockquote class="adMessageEvidence">'+escape(report.messageText||'نص الرسالة غير محفوظ')+'</blockquote>':profile?'<p class="adNote">بلاغ عن الاسم أو الصورة الشخصية.</p>':voice?voiceEvidence(report):'<p class="adComplaint">'+escape(report.text||'لا يوجد وصف')+'</p>')+(report.reason?'<p class="adReason"><b>سبب البلاغ:</b> '+escape(voice?voiceReason(report.reason):report.reason)+'</p>':'')+'<footer><div><span class="adReporter">المُبلِّغ: '+escape(report.reporterName||'لاعب')+'</span>'+(targeted?'<small class="adEvidenceNote">'+(voice?'هذا البلاغ وصف من المُبلِّغ؛ راجع الحساب وتحقق من المخالفة قبل اتخاذ إجراء.':'المحتوى واسم المرسل من بيانات البلاغ؛ راجع الحساب قبل الحظر.')+'</small>':'')+'</div>'+(report.status!=='resolved'?'<button class="miniBtn" data-ad-resolve="'+escape(report.id)+'">إغلاق البلاغ</button>':'')+'</footer></article>';
  }
  function paintReports(){el('reportsList').innerHTML=state.reports.length?state.reports.map(reportCard).join(''):empty(state.reportFilter==='open'?'لا توجد بلاغات مفتوحة.':'لا توجد بلاغات.');el('adReportsMore').hidden=!state.reportCursor;}
  async function loadReports(filter,append){
    if(append&&state.reportBusy)return;
    const run=++state.reportRun,generation=state.generation;state.reportFilter=filter==='all'?'all':'open';state.reportBusy=true;
    if(!append){state.reports=[];state.reportCursor=null;el('adReportsMore').hidden=true;el('reportsList').innerHTML=empty('جارٍ تحميل البلاغات…');}
    el('adReportsMore').disabled=true;el('adReportsRefresh').disabled=true;notice('adReportsStatus','');
    try{
      const data=await api('/admin/moderation',{action:'listReports',status:state.reportFilter,limit:50,...(append&&state.reportCursor?{cursor:state.reportCursor}:{})});
      if(run!==state.reportRun||generation!==state.generation)return;
      const known=new Set(state.reports.map(r=>r.id));state.reports=state.reports.concat((data.items||[]).filter(r=>!known.has(r.id)));state.reportCursor=data.nextCursor||null;paintReports();
      notice('adReportsStatus','المعروض '+number(state.reports.length)+' بلاغ'+(state.reportCursor?' · تتوفر بلاغات أخرى.':'.'));
    }catch(error){if(run===state.reportRun&&generation===state.generation){notice('adReportsStatus',localError(error),true);if(!append)el('reportsList').innerHTML=empty('تعذّر تحميل البلاغات.');}}
    finally{if(run===state.reportRun&&generation===state.generation){state.reportBusy=false;el('adReportsMore').disabled=false;el('adReportsRefresh').disabled=false;}}
  }
  async function resolveReport(id){
    const generation=state.generation,button=el('reportsList').querySelector('[data-ad-resolve="'+CSS.escape(id)+'"]');if(button)button.disabled=true;
    try{await api('/admin/moderation',{action:'resolveReport',reportId:id});if(generation!==state.generation)return;const report=state.reports.find(r=>r.id===id);if(report)report.status='resolved';if(state.reportFilter==='open')state.reports=state.reports.filter(r=>r.id!==id);paintReports();notice('adReportsStatus','تم إغلاق البلاغ.');}
    catch(error){if(generation===state.generation)notice('adReportsStatus',localError(error),true);}
    finally{if(button)button.disabled=false;}
  }
  function showBulk(){if(state.bulk)return;el('adBulkBox').hidden=false;text('adBulkText','سيُغلق كل بلاغ مفتوح موجود حتى لحظة بدء العملية. تبقى البلاغات الجديدة مفتوحة، وتُحفظ السجلات دون حذف.');el('adBulkConfirm').hidden=false;el('adBulkConfirm').disabled=false;text('adBulkCancel','إلغاء');}
  async function closeAll(){
    if(state.bulk)return;const generation=state.generation;state.bulk=true;state.bulkCancel=false;
    el('adBulkConfirm').disabled=true;el('adBulkConfirm').hidden=true;el('adCloseAll').disabled=true;text('adBulkCancel','إيقاف بعد الدفعة الحالية');
    let closed=0,cutoff,cursor,done=false;
    try{
      while(!done&&!state.bulkCancel&&generation===state.generation){
        text('adBulkText','جارٍ إغلاق البلاغات… تم إغلاق '+number(closed)+'.');
        const data=await api('/admin/moderation',{action:'closeAll',...(cutoff!=null?{cutoff}:{}),...(cursor?{cursor}:{})});
        if(generation!==state.generation)return;
        closed+=Number(data.closed)||0;cutoff=data.cutoff;done=data.done===true;cursor=data.nextCursor;
        if(!done&&(!cursor||cutoff==null))throw Error('تعذّر متابعة الدفعات؛ حدّث القائمة للتحقق مما أُغلق.');
      }
      text('adBulkText',(done?'اكتمل الإغلاق.':'توقفت العملية. تم حفظ ما أُنجز.')+' أُغلق '+number(closed)+' بلاغ.');
      await loadReports(state.reportFilter);
    }catch(error){if(generation===state.generation)text('adBulkText',localError(error)+' أُكد إغلاق '+number(closed)+' بلاغ. حدّث القائمة قبل المحاولة مجددًا.');}
    finally{if(generation===state.generation){state.bulk=false;el('adCloseAll').disabled=false;text('adBulkCancel','إغلاق');}}
  }
  function closePlayer(force){
    if(state.playerBusy&&!force)return;
    state.playerRun++;state.player=null;state.playerRequest=null;state.unlinkedReportName=null;state.playerBusy=false;
    if(el('adPlayerDialog'))el('adPlayerDialog').hidden=true;
    document.body.classList.remove('adModalOpen');if(state.focus?.isConnected)state.focus.focus();state.focus=null;
  }
  function renderUnlinkedReport(data,request){
    const report=data.report,clean=value=>typeof value==='string'?value:'';
    if(!request.reportId||!report||typeof report!=='object'){
      el('adPlayerContent').innerHTML=empty(data.reason||'تعذّر تحديد حساب المُبلَّغ عليه. لا يمكن الحظر بالاسم وحده.');return;
    }
    const name=clean(report.reportedName).trim().slice(0,80),message=clean(report.messageText).slice(0,6000),reason=clean(report.kind==='voice'?voiceReason(report.reason):report.reason).slice(0,3000),savedId=clean(report.reportedUid).slice(0,128);
    let time='وقت غير متاح';try{time=date(report.ts);}catch(_){}
    state.unlinkedReportName=name||null;
    el('adPlayerContent').innerHTML='<section class="adUnlinkedReport"><span class="adEyebrow">بيانات البلاغ المحفوظة</span><h3>'+escape(name||'اسم غير محفوظ')+'</h3><p class="adNote">وقت البلاغ: '+escape(time)+'</p>'+(savedId?'<label class="adUID">المعرّف المحفوظ في البلاغ — ليس حسابًا مؤكّدًا <code>'+escape(savedId)+'</code></label>':'')+(report.kind==='voice'?voiceEvidence(report):message?'<blockquote class="adMessageEvidence">'+escape(message)+'</blockquote>':'')+(reason?'<p class="adReason"><b>سبب البلاغ:</b> '+escape(reason)+'</p>':'')+'<p class="adReason"><b>الحساب غير مرتبط بهذا البلاغ.</b> '+escape(data.reason||'لم يُحفظ معرّف حساب موثوق في هذا البلاغ.')+'</p><p class="adNote">الاسم قد يتشابه مع حسابات أخرى. لا يمكن الحظر من هذه البيانات وحدها؛ تحقّق يدويًا من معرّف الحساب قبل أي إجراء.</p>'+(name?'<button class="miniBtn" type="button" data-ad-report-search>بحث يدوي عن الاسم في اللاعبين</button>':'')+'</section>';
    el('adBanForm').hidden=true;
  }
  function searchUnlinkedReport(){
    const name=state.unlinkedReportName,search=el('searchBox'),tab=document.querySelector('#tabs [data-tab="players"]');
    if(!name||state.player||el('adPlayerDialog').hidden||!search||!tab||!current(state.uid,state.generation))return;
    closePlayer(false);search.value=name;search.dataset.lookupMode='name';tab.click();
    const hint=el('adManualLookupHint');if(hint){hint.textContent='بحث يدوي عن الاسم المحفوظ «'+name+'». قد تظهر حسابات متشابهة؛ طابق معرّف الحساب بمصدر موثوق قبل أي إجراء. لم يُحدَّد أو يُربط أي حساب تلقائيًا.';hint.hidden=false;}
    search.focus();
  }
  async function openPlayer(request){
    if(state.playerBusy)return;
    const run=++state.playerRun,generation=state.generation;state.focus=document.activeElement;state.player=null;state.playerRequest=request;state.unlinkedReportName=null;
    el('adPlayerDialog').hidden=false;document.body.classList.add('adModalOpen');el('adPlayerContent').innerHTML=empty('جارٍ التحقق من حساب اللاعب…');el('adBanForm').hidden=true;notice('adPlayerStatus','');el('adPlayerClose').focus();
    try{
      const data=await api('/admin/moderation',{action:'player',...(request.reportId?{reportId:request.reportId}:{uid:request.uid})});
      if(run!==state.playerRun||generation!==state.generation)return;
      const player=data.player;state.player=player;
      if(!player){renderUnlinkedReport(data,request);return;}
      const avatar=typeof avaHtml==='function'?avaHtml(player):escape('◎');
      el('adPlayerContent').innerHTML='<div class="adProfile"><div class="pAva">'+avatar+'</div><div><h3>'+escape(player.name||'لاعب')+'</h3><p>'+escape(player.username?'@'+player.username:'اسم مستخدم غير متاح')+'</p><span class="adReportState '+(player.banned?'adIsBanned':'isClosed')+'">'+(player.banned?'محظور':'الحساب متاح')+'</span></div></div><label class="adUID">معرّف الحساب <code>'+escape(player.uid)+'</code></label>'+(player.banReason?'<p class="adReason"><b>سبب الحظر الحالي:</b> '+escape(player.banReason)+'</p>':'')+(request.reportId?'<p class="adNote">الحساب مرتبط بالمعرّف المحفوظ في البلاغ. قد يختلف الاسم الحالي عن الاسم وقت البلاغ.</p>':'');
      if(global.MajabeedImages?.hydrate)global.MajabeedImages.hydrate(el('adPlayerContent'));
      if(!data.canBan){state.player=null;notice('adPlayerStatus',data.reason||'لا يمكن اتخاذ إجراء على هذا الحساب.',true);return;}
      el('adBanForm').hidden=false;el('adBanReason').value=request.reason||'';el('adBanReason').required=!player.banned;
      text('adBanSubmit',(player.banned?'تأكيد رفع الحظر عن ':'تأكيد حظر ')+(player.name||'اللاعب'));
      el('adBanSubmit').classList.toggle('danger',!player.banned);el('adBanSubmit').classList.toggle('ok',!!player.banned);el('adBanSubmit').disabled=false;
      text('adBanScope',player.banned?'رفع الحظر يسمح للحساب بالدخول مجددًا.':'حظر الحساب ومنع دخوله. يُطلب فصل الطاولة الحالية، وقد يتأخر تطبيق الحظر على اتصال قديم حتى 60 ثانية.');
    }catch(error){if(run===state.playerRun&&generation===state.generation){state.player=null;el('adPlayerContent').innerHTML=empty('تعذّر فتح ملف اللاعب. يمكنك إعادة التحقق من الحساب.');el('adBanForm').hidden=true;notice('adPlayerStatus',localError(error),true);}}
  }
  async function submitBan(event){
    event.preventDefault();if(state.playerBusy||!state.player)return;
    const generation=state.generation,player=state.player,banned=!player.banned,reason=el('adBanReason').value.trim();
    if(banned&&!reason){notice('adPlayerStatus','اكتب سبب الحظر.',true);el('adBanReason').focus();return;}
    state.playerBusy=true;el('adBanSubmit').disabled=true;el('adPlayerClose').disabled=true;el('adPlayerReload').disabled=true;notice('adPlayerStatus','جارٍ حفظ الإجراء…');
    try{
      const data=await api('/admin/moderation',{action:'setBan',uid:player.uid,banned,reason,...(state.playerRequest?.reportId?{reportId:state.playerRequest.reportId}:{})});
      if(generation!==state.generation)return;
      state.player=data.player||{...player,banned,banReason:reason};state.metrics=null;state.metricsAt=0;
      if(typeof ALL_PLAYERS!=='undefined'){const stored=ALL_PLAYERS.find(p=>p.uid===player.uid);if(stored)Object.assign(stored,state.player);if(typeof applyPlayersFilter==='function')applyPlayersFilter();}
      el('adBanForm').hidden=true;
      const failed=data.immediate?.failed?.length||0;
      notice('adPlayerStatus',banned?'تم حظر «'+(player.name||'اللاعب')+'».'+(failed?' تعذر فصل بعض الاتصالات فورًا؛ يُطبق الحظر عند التحقق التالي.':''):'تم رفع الحظر عن «'+(player.name||'اللاعب')+'».');
      const badge=el('adPlayerContent').querySelector('.adReportState');if(badge){badge.textContent=banned?'محظور':'الحساب متاح';badge.classList.toggle('adIsBanned',banned);badge.classList.toggle('isClosed',!banned);}
    }catch(error){if(generation===state.generation)notice('adPlayerStatus',localError(error)+' حدّث ملف اللاعب قبل إعادة الإجراء إذا تأخر الرد.',true);}
    finally{if(generation===state.generation){state.playerBusy=false;el('adBanSubmit').disabled=false;el('adPlayerClose').disabled=false;el('adPlayerReload').disabled=false;}}
  }
  async function loadRooms(){
    const run=++state.roomsRun,generation=state.generation;el('roomsList').innerHTML=empty('جارٍ تحميل الطاولات…');el('adRoomsRefresh').disabled=true;
    try{
      const snap=await db.collection('active_rooms').orderBy('updatedAt','desc').limit(100).get();if(run!==state.roomsRun||generation!==state.generation)return;
      const rooms=snap.docs.map(doc=>({...doc.data(),id:doc.id}));
      const botOnly=rooms.filter(room=>(room.seats||[]).length&&(room.seats||[]).every(seat=>seat&&seat.isBot));
      const header=(botOnly.length?'<button class="miniBtn" data-ad-delete-bot-rooms>حذف إعلانات الطاولات الخالية من البشر</button>':'')+'<p class="adCoverage">آخر '+number(rooms.length)+' إعلانًا لطاولات ودية عامة. هذه القائمة لا تشمل التنافسي أو كل الجلسات الخاصة، وعدد المقاعد فيها لا يثبت الاتصال الآن.</p>';
      el('roomsList').innerHTML=header+(rooms.length?rooms.map(room=>{const seats=room.seats||[];return '<article class="adRoom"><header><div><span class="adTag">'+(room.status==='playing'?'جارية':'بانتظار البدء')+'</span><h3>'+escape(room.name||room.id)+'</h3><small>'+escape(room.id)+'</small></div><button class="miniBtn danger" data-ad-delete-room="'+escape(room.id)+'">حذف الإعلان</button></header><div class="adRoomSeats">'+seats.map(seat=>'<span>'+escape(seat?(seat.isBot?'كمبيوتر':seat.name||'لاعب'):'مقعد فارغ')+'</span>').join('')+'</div><p class="adNote">آخر تحديث للإعلان: '+date(room.updatedAt)+' · حذف الإعلان لا ينهي المباراة.</p></article>';}).join(''):empty('لا توجد إعلانات طاولات.'))+(rooms.length===100?'<p class="adNote">بلغت القائمة حد 100 إعلان؛ قد توجد طاولات أخرى.</p>':'');
    }catch(error){if(run===state.roomsRun&&generation===state.generation)el('roomsList').innerHTML=empty(localError(error));}
    finally{if(run===state.roomsRun&&generation===state.generation)el('adRoomsRefresh').disabled=false;}
  }
  async function loadVisits(){
    const generation=state.generation;el('visitsCards').innerHTML=empty('جارٍ تحميل الرصد…');
    try{const data=await dashboard(false);if(generation!==state.generation)return;const growth=data.growth;if(!growth)throw Error('رصد الزيارات غير متاح حاليًا.');
      el('visitsCards').innerHTML='<div class="statCard"><div class="num">'+number(growth.todayObserved)+'</div><div class="lbl">حسابات مرصودة اليوم</div></div><div class="statCard"><div class="num">'+number(growth.weekObserved)+'</div><div class="lbl">حسابات مرصودة آخر 7 أيام</div></div>';
      el('visitsList').innerHTML='<div class="adTableScroll"><table><thead><tr><th>اليوم</th><th>الزيارات المسجلة</th><th>الحسابات المرصودة</th></tr></thead><tbody>'+(growth.days||[]).slice(0,14).map(row=>'<tr><td dir="ltr">'+escape(row.day)+'</td><td dir="ltr">'+number(row.recorded===false?null:row.total)+'</td><td dir="ltr">'+number(row.recorded===false?null:row.unique)+'</td></tr>').join('')+'</tbody></table></div>';
    }catch(error){if(generation===state.generation){el('visitsCards').innerHTML=empty(localError(error));el('visitsList').replaceChildren();}}
  }
  function bind(){
    el('adMetricsRefresh').onclick=()=>loadOverview(true);el('adReportsRefresh').onclick=()=>loadReports(state.reportFilter);el('adRoomsRefresh').onclick=loadRooms;
    el('adReportsMore').onclick=()=>loadReports(state.reportFilter,true);el('adCloseAll').onclick=showBulk;el('adBulkConfirm').onclick=closeAll;
    el('adBulkCancel').onclick=()=>{if(state.bulk){state.bulkCancel=true;text('adBulkCancel','جارٍ إيقاف العملية…');}else el('adBulkBox').hidden=true;};
    el('adPlayerClose').onclick=()=>closePlayer(false);el('adPlayerReload').onclick=()=>{if(state.playerRequest)openPlayer({...state.playerRequest});};el('adBanForm').onsubmit=submitBan;
    el('adPlayerDialog').addEventListener('click',event=>{if(event.target===el('adPlayerDialog'))closePlayer(false);});
    el('adOpenReports').onclick=()=>document.querySelector('#tabs [data-tab="reports"]').click();
    document.addEventListener('click',event=>{const target=event.target.closest('[data-ad-report-player],[data-ad-player],[data-ad-resolve],[data-ad-delete-room],[data-ad-delete-bot-rooms],[data-ad-report-search]');if(!target)return;if(target.hasAttribute('data-ad-report-search'))searchUnlinkedReport();else if(target.dataset.adReportPlayer)openPlayer({reportId:target.dataset.adReportPlayer});else if(target.dataset.adPlayer)openPlayer({uid:target.dataset.adPlayer});else if(target.dataset.adResolve)resolveReport(target.dataset.adResolve);else if(target.dataset.adDeleteRoom)deleteRoom(target.dataset.adDeleteRoom);else if(target.hasAttribute('data-ad-delete-bot-rooms'))deleteBotOnlyRooms();});
    document.addEventListener('keydown',event=>{if(el('adPlayerDialog').hidden)return;if(event.key==='Escape'){event.preventDefault();closePlayer(false);}if(event.key==='Tab'){const nodes=[...el('adPlayerDialog').querySelectorAll('button:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(node=>node.offsetParent!==null);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.metrics&&Date.now()-state.metricsAt>60000)notice('adMetricsStatus','البيانات من '+date(state.metrics.asOf)+' · اضغط تحديث المؤشرات لقراءة أحدث.');});
  }
  global.AdminDashboard={reset,loadOverview,loadReports,resolveReport,openPlayer,loadRooms,loadVisits};
  bind();
})(window);
