/* V380 — native interstitial lifecycle and alternate active-session visits.
 * No polling, reward claims, or server writes. AdMob v6 event names.
 */
(function (root) {
  'use strict';
  let presentation = null, rewardController = null;
  const pendingInterstitials = new Set();
  const claimPresentation = owner => { if (presentation) return false; presentation = owner; return true; };
  const releasePresentation = owner => { if (presentation === owner) presentation = null; };
  // Loading can be cancelled. A dispatched native presentation must finish first.
  root.MajabeedAdSafety = {
    beforeEntry() { rewardController?.cancelPending(); for (const cancel of [...pendingInterstitials]) cancel(); return presentation === null; },
    get presenting() { return presentation !== null; }
  };
  root.MajabeedRewarded = {
    create({getPlugin, adId, loadTimeoutMs = 8000}) {
      let flight = null, nativeLoading = false;
      function cancelPending() { if (flight && !flight.presenting) flight.finish(false); }
      function show({isCurrent = () => false} = {}) {
        // An unfinished native load has no request ID in AdMob's global events.
        // Do not overlap a retry with an abandoned load from the previous request.
        if (flight || nativeLoading || presentation) return Promise.resolve(false);
        const valid = () => { try { return isCurrent() === true; } catch (_) { return false; } };
        const plugin = getPlugin(); if (!plugin || !valid()) return Promise.resolve(false);
        const owner = {}, handles = []; let ended = false, rewarded = false, timer, observer;
        let resolve; const promise = new Promise(r => { resolve = r; });
        const record = {presenting:false, finish}; flight = record;
        const remove = handle => { try { Promise.resolve(handle.remove()).catch(() => {}); } catch (_) {} };
        function finish(result) {
          if (ended) return; ended = true; clearTimeout(timer); observer?.disconnect();
          root.document?.removeEventListener('visibilitychange', validate);
          root.document?.removeEventListener('pause', cancelPending);
          root.removeEventListener?.('pagehide', cancelPending);
          handles.splice(0).forEach(remove); releasePresentation(owner);
          if (flight === record) flight = null; resolve(result === true);
        }
        function validate() { if (!record.presenting && !valid()) finish(false); }
        async function listen(event, callback) {
          const handle = await plugin.addListener(event, callback);
          if (ended) { remove(handle); return false; } handles.push(handle); return true;
        }
        timer = setTimeout(() => finish(false), loadTimeoutMs);
        root.document?.addEventListener('visibilitychange', validate);
        root.document?.addEventListener('pause', cancelPending);
        root.addEventListener?.('pagehide', cancelPending);
        if (root.MutationObserver && root.document?.body) {
          observer = new root.MutationObserver(validate);
          observer.observe(root.document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
        }
        (async () => {
          if (!await listen('onRewardedVideoAdReward', () => { if (record.presenting) rewarded = true; })) return;
          if (!await listen('onRewardedVideoAdDismissed', () => finish(rewarded))) return;
          if (!await listen('onRewardedVideoAdFailedToLoad', () => { if (!record.presenting) finish(false); })) return;
          if (!await listen('onRewardedVideoAdFailedToShow', () => finish(rewarded))) return;
          if (ended || !valid()) { finish(false); return; }
          nativeLoading = true;
          try { await plugin.prepareRewardVideoAd({adId}); } finally { nativeLoading = false; }
          if (ended) return;
          if (!valid() || !claimPresentation(owner)) { finish(false); return; }
          record.presenting = true; clearTimeout(timer);
          // No timeout after native show dispatch: it could otherwise appear over a new match.
          await plugin.showRewardVideoAd();
          // Resolving show() is neither dismissal nor proof of a reward.
        })().catch(() => finish(rewarded));
        return promise;
      }
      const controller = {show, cancelPending, get busy() { return !!flight; }, get presenting() { return !!flight?.presenting; }};
      rewardController = controller; return controller;
    }
  };
  function nativePlatform() {
    const cap = root.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  }
  function bounded(work, ms) {
    let timer;
    return Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })
    ]).finally(() => clearTimeout(timer));
  }
  root.MajabeedInterstitial = {
    create({ getPlugin, adId, isExempt = () => false, isNative = nativePlatform, loadTimeoutMs = 8000 }) {
      let flight = null, nativeLoading = false;
      return function showInterstitial({isCurrent = () => true} = {}) {
        if (flight) return flight.promise;
        if (nativeLoading || presentation || !isNative()) return Promise.resolve(false);
        const valid = () => { try { return !root.document?.hidden && isCurrent() === true; } catch (_) { return false; } };
        const plugin = getPlugin(); if (!plugin || !valid()) return Promise.resolve(false);
        const owner = {}, handles = []; let ended = false, shown = false, timer, observer;
        let resolve; const promise = new Promise(r => { resolve = r; });
        const record = {promise, presenting:false}; flight = record;
        const remove = handle => { try { Promise.resolve(handle.remove()).catch(() => {}); } catch (_) {} };
        function finish(result) {
          if (ended) return; ended = true; clearTimeout(timer); observer?.disconnect();
          root.document?.removeEventListener('visibilitychange', validate);
          root.document?.removeEventListener('pause', cancelPending);
          root.removeEventListener?.('pagehide', cancelPending);
          pendingInterstitials.delete(cancelPending); handles.splice(0).forEach(remove); releasePresentation(owner);
          if (flight === record) flight = null; resolve(result === true);
        }
        function cancelPending() { if (!record.presenting) finish(false); }
        function validate() { if (!record.presenting && !valid()) finish(false); }
        async function listen(event, callback) {
          const handle = await plugin.addListener(event, callback);
          if (ended) { remove(handle); return false; } handles.push(handle); return true;
        }
        pendingInterstitials.add(cancelPending);
        timer = setTimeout(() => finish(false), loadTimeoutMs);
        root.document?.addEventListener('visibilitychange', validate);
        root.document?.addEventListener('pause', cancelPending);
        root.addEventListener?.('pagehide', cancelPending);
        if (root.MutationObserver && root.document?.body) {
          observer = new root.MutationObserver(validate);
          observer.observe(root.document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
        }
        (async () => {
          // An unknown entitlement must never turn into an ad for a paid member.
          if (await bounded(isExempt, 2500)) { finish(false); return; }
          if (ended) return;
          if (!valid() || presentation) { finish(false); return; }
          if (!await listen('interstitialAdDismissed', () => finish(shown))) return;
          if (!await listen('interstitialAdFailedToLoad', () => { if (!record.presenting) finish(false); })) return;
          if (!await listen('interstitialAdFailedToShow', () => finish(false))) return;
          if (!await listen('interstitialAdShowed', () => { if (record.presenting) shown = true; })) return;
          if (ended || !valid()) { finish(false); return; }
          nativeLoading = true;
          try { await plugin.prepareInterstitial({adId}); } finally { nativeLoading = false; }
          if (ended) return;
          if (!valid() || !claimPresentation(owner)) { finish(false); return; }
          record.presenting = true; clearTimeout(timer);
          // Native show cannot be cancelled. Only dismissal/failure releases entry now.
          await plugin.showInterstitial();
          if (!ended) shown = true;
        })().catch(() => finish(false));
        return promise;
      };
    }
  };
  root.MajabeedSessionAds = {
    create({ button, open, showAd, canOpen = () => true, isNative = nativePlatform,
      storage = () => root.localStorage }) {
      const key = 'wb-active-sessions-next-v380';
      let busy = false, next = 'ad';
      try { if (storage().getItem(key) === 'skip') next = 'skip'; } catch (_) {}
      return async function openSessions() {
        if (busy || !canOpen()) return;
        busy = true;
        if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
        try {
          if (isNative()) {
            const due = next === 'ad';
            next = due ? 'skip' : 'ad';
            try { storage().setItem(key, next); } catch (_) {}
            if (due) { try { await showAd(); } catch (_) {} }
          }
          if (canOpen()) open();
        } finally {
          busy = false;
          if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
        }
      };
    }
  };
})(window);
