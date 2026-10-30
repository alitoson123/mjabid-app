/* V380 — native interstitial lifecycle and alternate active-session visits.
 * No polling, reward claims, or server writes. AdMob v6 event names.
 */
(function (root) {
  'use strict';
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
      let flight = null;
      return function showInterstitial() {
        if (flight) return flight;
        if (!isNative()) return Promise.resolve(false);
        const plugin = getPlugin();
        if (!plugin) return Promise.resolve(false);
        flight = (async () => {
          // An unknown entitlement must never turn into an ad for a paid member.
          try { if (await bounded(isExempt, 2500)) return false; }
          catch (_) { return false; }
          return new Promise(resolve => {
            let ended = false, shown = false;
            const handles = [];
            let timer = setTimeout(() => finish(false), loadTimeoutMs);
            function remove(handle) {
              try { Promise.resolve(handle.remove()).catch(() => {}); } catch (_) {}
            }
            function finish(result) {
              if (ended) return;
              ended = true;
              clearTimeout(timer);
              handles.splice(0).forEach(remove);
              resolve(result);
            }
            async function listen(event, callback) {
              const handle = await plugin.addListener(event, callback);
              if (ended) { remove(handle); return false; }
              handles.push(handle);
              return true;
            }
            (async () => {
              if (!await listen('interstitialAdDismissed', () => finish(shown))) return;
              if (!await listen('interstitialAdFailedToLoad', () => finish(false))) return;
              if (!await listen('interstitialAdFailedToShow', () => finish(false))) return;
              if (!await listen('interstitialAdShowed', () => { shown = true; clearTimeout(timer); })) return;
              await plugin.prepareInterstitial({ adId });
              // A late load after the deadline must never show over the sessions list.
              if (ended) return;
              clearTimeout(timer);
              // Once presentation is dispatched the native operation cannot be
              // cancelled here. A timeout would admit the player to a table
              // while this same ad can still appear later over the match.
              // Only native dismissal/failure may release the entry gate now.
              await plugin.showInterstitial();
              // Native show() is not dismissal. Keep navigation waiting for Dismissed.
              if (!ended) { shown = true; clearTimeout(timer); }
            })().catch(() => finish(false));
          });
        })().finally(() => { flight = null; });
        return flight;
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
