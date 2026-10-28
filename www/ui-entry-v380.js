/* V380 — actual boot states, one slow-start timer, no network requests. */
(function (root) {
  'use strict';
  let stage = 'prepare', slow = false, timer;
  const el = id => document.getElementById(id);
  const text = {
    prepare: ['نجهّز لك المجلس', 'لحظات وتبدأ الحكاية'],
    connecting: ['جارٍ الاتصال باللعبة', 'نجهّز اتصالك بمجابيد و صكة'],
    account: ['نجهّز حسابك', 'نستعيد بياناتك المحفوظة'],
    ready: ['مجلسك جاهز', 'حيّاك، خذ مكانك'],
    error: ['تعذّر الاتصال', 'تحقّق من الإنترنت ثم أعد المحاولة']
  };
  function paint() {
    if (!el('welcome')) return;
    const offline = navigator.onLine === false && stage !== 'ready';
    const labels = offline ? ['أنت غير متصل', 'اتصل بالإنترنت لنجهّز مجلسك'] : text[stage];
    el('welcome').dataset.bootStage = stage;
    el('welcome').dataset.bootWaiting = String(offline || slow || stage === 'error');
    el('entryStatus').textContent = slow && !offline && stage !== 'error' && stage !== 'ready'
      ? 'الاتصال يأخذ وقتًا أطول' : labels[0];
    el('entryDetail').textContent = slow && !offline && stage !== 'error' && stage !== 'ready'
      ? 'تحقّق من اتصالك، أو أعد المحاولة' : labels[1];
    el('entryRetry').hidden = !(offline || slow || stage === 'error') || stage === 'ready';
    const at = { prepare: 0, connecting: 1, account: 2, ready: 3, error: -1 }[stage];
    document.querySelectorAll('.entryStep').forEach((step, i) => {
      step.classList.toggle('done', i < at);
      step.classList.toggle('current', i === at);
    });
  }
  root.MajabeedBoot = {
    init() {
      el('entryRetry').onclick = () => { el('entryRetry').disabled = true; location.reload(); };
      timer = setTimeout(() => { slow = true; paint(); }, 12000);
      root.addEventListener('online', paint);
      root.addEventListener('offline', paint);
      paint();
    },
    set(value) {
      if (!text[value]) return;
      stage = value;
      if (value === 'ready' || value === 'error') clearTimeout(timer);
      paint();
    }
  };
})(window);
