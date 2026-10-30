/* Sakka card presentation. Server state, input confirmation and game deadlines stay authoritative. */
(function () {
  'use strict';

  // All tuning values are in milliseconds, CSS pixels or degrees. No game timer uses these values.
  const DEFAULTS = {
    selectMs: 100,
    selectLiftPx: 14,
    playMs: 340,
    settleMs: 72,
    handMs: 210,
    collectMs: 390,
    gatherMs: 140,
    curvePx: 24,
    settlePx: 1.8,
    settleTilt: 1.2,
    landingJitterPx: 2.2,
    landingJitterDeg: 2,
    fieldSpreadX: 0.64,
    fieldSpreadY: 0.48,
    compactFieldHeightPx: 580,
    compactFieldSpreadY: 0.40,
    compactFieldShiftPx: 9,
    maxQueuedEvents: 8,
    maxTimelineMs: 1800,
    staleCueMs: 1800
  };
  const config = window.SAKKA_CARD_MOTION_CONFIG = Object.assign({}, DEFAULTS, window.SAKKA_CARD_MOTION_CONFIG || {});
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const roundKey = state => state?.game ? [state.room, state.game.id, state.game.round, state.me].join(':') : '';
  const eventKey = (game, trick, play) => [game.id, game.round, trick, play.seat, play.card].join(':');
  const position = (seat, me) => (seat - (me >= 0 ? me : 0) + 4) % 4;
  const cardSelector = card => '[data-card="' + CSS.escape(String(card)) + '"]';

  function randomUnit(key, salt) {
    let hash = 2166136261;
    const input = key + ':' + salt;
    for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    return (hash >>> 0) / 4294967295;
  }

  function variation(key) {
    return {
      x: (randomUnit(key, 1) * 2 - 1) * config.landingJitterPx,
      y: (randomUnit(key, 2) * 2 - 1) * config.landingJitterPx,
      angle: (randomUnit(key, 3) * 2 - 1) * config.landingJitterDeg,
      curve: (0.55 + randomUnit(key, 4) * 0.45) * config.curvePx,
      lean: (randomUnit(key, 5) * 2 - 1) * 2.5
    };
  }

  function rotation(el) {
    let angle = 0;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      try {
        const style = getComputedStyle(node);
        if (style.transform !== 'none') {
          const matrix = new DOMMatrixReadOnly(style.transform);
          angle += Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
        }
        if (style.rotate && style.rotate !== 'none') angle += parseFloat(style.rotate) || 0;
      } catch (_) { /* A detached or unsupported transform falls back to the rendered bounds. */ }
    }
    return angle;
  }

  function geometry(el) {
    if (!el?.isConnected) return null;
    const face = el.matches('button') ? el.querySelector('img') || el : el;
    const rect = face.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const angle = rotation(el), radians = angle * Math.PI / 180;
    const style = getComputedStyle(face), padding = style.boxSizing !== 'border-box';
    const width = (parseFloat(style.width) || face.offsetWidth || rect.width) + (padding ?
      (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0) : 0);
    const height = (parseFloat(style.height) || face.offsetHeight || rect.height) + (padding ?
      (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0) : 0);
    const envelope = Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height;
    const scale = rect.width / (envelope || 1);
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: width * scale, h: height * scale, angle };
  }

  function transform(point, width, height) {
    // A single scale preserves the card's aspect ratio throughout the flight.
    return 'translate3d(' + (point.x - width / 2).toFixed(3) + 'px,' +
      (point.y - height / 2).toFixed(3) + 'px,0) rotate(' + point.angle.toFixed(3) +
      'deg) scale(' + (point.w / width).toFixed(6) + ')';
  }

  function curvePoint(start, end, control, t) {
    const u = 1 - t;
    return {
      x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      w: lerp(start.w, end.w, t), h: lerp(start.h, end.h, t), angle: lerp(start.angle, end.angle, t)
    };
  }

  function create(root, options = {}) {
    const records = new Map(), seen = new Set(), collections = new Set(), handAnimations = new Map(), handLayouts = new WeakMap(), variations = new Map();
    const activeAnimations = new Set();
    let latest = null, scope = '', generation = 0, jobs = [], running = false, activeJob = null;
    let activeSince = 0, skipNext = false, destroyed = false, layer = null, rootSize = null, variationScope = '';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function timing(name, min, max) { return clamp(number(config[name], DEFAULTS[name]), min, max); }
    function motionEnabled() { return !document.hidden && !reduced.matches && typeof Element.prototype.animate === 'function'; }
    function safeSound(key) { if (!document.hidden) { try { options.sound?.(key); } catch (_) {} } }
    function idle() { try { options.onIdle?.(); } catch (_) {} }
    function busy() { return running || jobs.length > 0; }

    function eventVariation(game, key) {
      const current = game.id + ':' + game.round;
      if (variationScope !== current) { variationScope = current; variations.clear(); }
      if (!variations.has(key)) {
        variations.set(key, Object.freeze(variation(key)));
        // A normal round has 32 cards. The bound also tolerates diagnostic/legacy snapshots.
        if (variations.size > 64) variations.delete(variations.keys().next().value);
      }
      return variations.get(key);
    }

    function getLayer() {
      if (!layer?.isConnected) {
        layer = document.createElement('div');
        layer.className = 'blMotionLayer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.append(layer);
      }
      return layer;
    }

    function setHidden(node, hidden) {
      if (node) {
        if (hidden) node.dataset.blMotionHidden = '1';
        else delete node.dataset.blMotionHidden;
      }
    }

    function visibleNode(record) {
      if (!latest?.game || record.trick !== latest.game.history.length) return null;
      return root.querySelector('.blField .blPlayed' + cardSelector(record.card));
    }

    function cardNode(card, point, key, depth) {
      const node = document.createElement('div');
      node.className = 'blMotionCard';
      node.dataset.motionEvent = key;
      node.dataset.card = card;
      node.style.width = point.w + 'px';
      node.style.height = point.h + 'px';
      node.style.zIndex = String(10 + depth);
      const shadow = document.createElement('span');
      shadow.className = 'blMotionShadow';
      const image = document.createElement('img');
      image.className = 'blCardFace';
      image.alt = '';
      image.draggable = false;
      image.src = 'cards/' + encodeURIComponent(card) + '.png';
      node.append(shadow, image);
      node.style.transform = transform(point, point.w, point.h);
      getLayer().append(node);
      return node;
    }

    function ensureVisual(record, at = record.end) {
      if (!record.node?.isConnected) {
        record.node = cardNode(record.card, record.end, record.key, record.order);
        record.node.style.transform = transform(at, record.end.w, record.end.h);
      }
      return record.node;
    }

    function removeVisual(record) {
      record.node?.remove();
      record.node = null;
    }

    function animateNode(node, frames, duration, token, easing = 'linear') {
      return new Promise(resolve => {
        if (token !== generation || !node?.isConnected || !motionEnabled()) { resolve(false); return; }
        let animation, done = false;
        const finish = success => {
          if (done) return;
          done = true;
          activeAnimations.delete(animation);
          if (success && token === generation && node.isConnected) {
            const final = frames[frames.length - 1];
            if (final.transform !== undefined) node.style.transform = final.transform;
            if (final.opacity !== undefined) node.style.opacity = String(final.opacity);
          }
          animation.onfinish = animation.oncancel = null;
          animation.cancel();
          resolve(success && token === generation);
        };
        animation = node.animate(frames, { duration, easing, fill: 'both' });
        activeAnimations.add(animation);
        animation.onfinish = () => finish(true);
        animation.oncancel = () => finish(false);
      });
    }

    function fieldStyle(node, game, trick, play, me, order = 0) {
      const key = eventKey(game, trick, play), v = eventVariation(game, key), pos = position(play.seat, me);
      const width = node.offsetWidth || parseFloat(getComputedStyle(root).getPropertyValue('--bl-field-w')) || 68;
      const height = node.offsetHeight || width * 1.4;
      const compact = root.clientHeight <= config.compactFieldHeightPx;
      const spreadY = compact ? config.compactFieldSpreadY : config.fieldSpreadY;
      const offsets = [
        [0, height * spreadY, -6],
        [width * config.fieldSpreadX, 0, 8],
        [0, -height * spreadY, 3],
        [-width * config.fieldSpreadX, 0, -8]
      ][pos];
      node.style.setProperty('--px', (offsets[0] + v.x).toFixed(3) + 'px');
      node.style.setProperty('--py', (offsets[1] + v.y).toFixed(3) + 'px');
      node.style.setProperty('--angle', (offsets[2] + v.angle).toFixed(3) + 'deg');
      node.style.setProperty('--bl-motion-center-shift', (compact ? config.compactFieldShiftPx : 0) + 'px');
      // The server trick order owns stacking, independent of the viewer's seat.
      // Match the flying card depth so landing cannot reverse the overlap.
      node.style.zIndex = String(10 + order);
      node.dataset.blMotionKey = key;
      node.dataset.seat = String(play.seat);
      node.dataset.pos = String(pos);
      return key;
    }

    function layout(state) {
      const game = state?.game;
      if (!game) return;
      const current = new Map((game.trick || []).map((play, index) => [play.card, { play, index }]));
      for (const node of root.querySelectorAll('.blField .blPlayed')) {
        const entry = current.get(node.dataset.card);
        if (!entry) continue;
        const key = fieldStyle(node, game, game.history.length, entry.play, state.me, entry.index);
        const record = records.get(key);
        setHidden(node, !!record && record.phase !== 'settled');
      }
      root.style.setProperty('--bl-motion-select-ms', timing('selectMs', 0, 300) + 'ms');
      root.style.setProperty('--bl-motion-select-lift', clamp(number(config.selectLiftPx, 14), 0, 28) + 'px');
      root.style.setProperty('--bl-motion-hand-ms', timing('handMs', 0, 600) + 'ms');
    }

    function fieldGeometry(state, trick, play, order) {
      const game = state.game;
      const current = trick === game.history.length ? root.querySelector('.blField .blPlayed' + cardSelector(play.card)) : null;
      if (current) {
        fieldStyle(current, game, trick, play, state.me, order);
        return geometry(current);
      }
      const field = root.querySelector('.blField');
      if (!field) return null;
      // A skipped snapshot can contain the fourth card only in history. Measure its normal slot.
      const probe = document.createElement('img');
      probe.className = 'blPlayed blCardFace';
      probe.style.visibility = 'hidden';
      probe.dataset.pos = String(position(play.seat, state.me));
      field.append(probe);
      fieldStyle(probe, game, trick, play, state.me, order);
      const result = geometry(probe);
      probe.remove();
      return result;
    }

    function markSnapshot(state) {
      const game = state?.game;
      if (!game) return;
      (game.history || []).forEach((trick, index) => (trick.plays || []).forEach(play => seen.add(eventKey(game, index, play))));
      (game.trick || []).forEach(play => seen.add(eventKey(game, game.history.length, play)));
    }

    function capture(state) {
      const snapshot = { scope: roundKey(state), hands: new Map(), field: new Map(), backs: new Map(), seats: new Map(), at: performance.now() };
      for (const node of root.querySelectorAll('.blHand button[data-card]')) {
        const point = geometry(node);
        if (point) snapshot.hands.set(node.dataset.card, { point, node });
      }
      const game = state?.game;
      if (game) for (const node of root.querySelectorAll('.blField .blPlayed[data-card]')) {
        const play = game.trick.find(item => item.card === node.dataset.card);
        if (!play) continue;
        const key = eventKey(game, game.history.length, play), record = records.get(key);
        const point = record?.node?.isConnected ? geometry(record.node) : geometry(node);
        if (point) snapshot.field.set(key, point);
      }
      for (const seat of root.querySelectorAll('.blSeat[data-seat]')) {
        const seatNumber = Number(seat.dataset.seat);
        const backs = [...seat.querySelectorAll('.blBacks i')];
        const back = backs.at(-1) || seat.querySelector('.blBacks') || seat.querySelector('.blAvatar');
        const point = geometry(back);
        if (point) snapshot.backs.set(seatNumber, point);
        const destination = geometry(seat.querySelector('.blTaken') || seat.querySelector('.blAvatar') || seat);
        if (destination) snapshot.seats.set(seatNumber, destination);
      }
      return snapshot;
    }

    function cancelHandAnimations() {
      for (const animation of handAnimations.values()) animation.cancel();
      handAnimations.clear();
    }

    function arrangeHand(snapshot) {
      if (!snapshot || !motionEnabled()) { cancelHandAnimations(); return; }
      for (const [node, animation] of handAnimations) if (!node.isConnected || !root.contains(node)) { animation.cancel(); handAnimations.delete(node); }
      for (const node of root.querySelectorAll('.blHand button[data-card]')) {
        const earlier = snapshot.hands.get(node.dataset.card);
        const priorAnimation = handAnimations.get(node);
        // An unrelated timer/chat/score patch must not restart a reflow already in progress.
        const bounds = node.parentElement.getBoundingClientRect();
        const layoutKey = [node.offsetLeft, node.offsetTop, node.offsetWidth, node.offsetHeight,
          node.style.getPropertyValue('--ha'), node.style.getPropertyValue('--hy'), bounds.left, bounds.top, bounds.width, bounds.height].join(':');
        if (handLayouts.get(node) === layoutKey) continue;
        handLayouts.set(node, layoutKey);
        priorAnimation?.cancel();
        handAnimations.delete(node);
        if (!earlier || earlier.node !== node) continue;
        const last = geometry(node), first = earlier.point;
        if (!last || Math.hypot(first.x - last.x, first.y - last.y) < 0.35 && Math.abs(first.angle - last.angle) < 0.15 && Math.abs(first.w - last.w) < 0.2) continue;
        try {
          const style = getComputedStyle(node), matrix = new DOMMatrixReadOnly(style.transform);
          const origin = style.transformOrigin.split(' ').map(parseFloat);
          const ownScale = Math.hypot(matrix.a, matrix.b) || 1;
          const ancestorScale = last.w / ((node.offsetWidth || last.w) * ownScale);
          const ownAngle = Math.atan2(matrix.b, matrix.a);
          const ancestorAngle = last.angle * Math.PI / 180 - ownAngle;
          const cosine = Math.cos(ancestorAngle), sine = Math.sin(ancestorAngle);
          const deltaX = (cosine * (first.x - last.x) + sine * (first.y - last.y)) / ancestorScale;
          const deltaY = (-sine * (first.x - last.x) + cosine * (first.y - last.y)) / ancestorScale;
          const angle = first.angle * Math.PI / 180 - ancestorAngle;
          const scale = ownScale * first.w / last.w;
          const a = Math.cos(angle) * scale, b = Math.sin(angle) * scale, c = -b, d = a;
          const centerX = node.offsetWidth / 2 - origin[0], centerY = node.offsetHeight / 2 - origin[1];
          const x = matrix.e + deltaX - (a - matrix.a) * centerX - (c - matrix.c) * centerY;
          const y = matrix.f + deltaY - (b - matrix.b) * centerX - (d - matrix.d) * centerY;
          const from = 'matrix(' + [a, b, c, d, x, y].join(',') + ')';
          const animation = node.animate([{ transform: from }, { transform: style.transform }], {
            duration: timing('handMs', 0, 600), easing: 'cubic-bezier(.2,.72,.25,1)', fill: 'none'
          });
          handAnimations.set(node, animation);
          animation.onfinish = animation.oncancel = () => { if (handAnimations.get(node) === animation) handAnimations.delete(node); };
        } catch (_) { /* Static layout is a complete fallback on older WebViews. */ }
      }
    }

    function sourceGeometry(play, state, snapshot, origin, end) {
      const submitted = origin && origin.match === state.game.id && origin.round === state.game.round && origin.seat === play.seat && origin.card === play.card && origin.geometry;
      if (submitted && origin.ghost?.isConnected) return origin.geometry;
      const own = play.seat === state.me && snapshot?.hands.get(play.card)?.point;
      if (own) return own;
      if (submitted) return origin.geometry;
      const saved = snapshot?.backs.get(play.seat);
      if (saved) return saved;
      const seat = root.querySelector('.blSeat[data-seat="' + play.seat + '"]');
      const cards = [...(seat?.querySelectorAll('.blBacks i') || [])];
      return geometry(cards.at(-1) || seat?.querySelector('.blBacks') || seat?.querySelector('.blAvatar')) || end;
    }

    function newRecord(state, trick, play, order, snapshot, origin, alreadyLanded = false) {
      const key = eventKey(state.game, trick, play);
      let record = records.get(key);
      if (record) return record;
      const end = snapshot?.field.get(key) || fieldGeometry(state, trick, play, order);
      if (!end) return null;
      const start = sourceGeometry(play, state, snapshot, origin, end);
      record = { key, card: play.card, seat: play.seat, trick, order, start, end, variation: eventVariation(state.game, key), phase: alreadyLanded ? 'settled' : 'queued', node: null, collectRequested: false };
      records.set(key, record);
      if (!alreadyLanded) {
        ensureVisual(record, start);
        if (origin?.card === play.card && origin.ghost?.isConnected) origin.ghost.remove();
      }
      return record;
    }

    async function playRecord(record, token) {
      if (token !== generation) return;
      record.phase = 'play';
      const node = ensureVisual(record, record.start), start = record.start, end = record.end;
      const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      const dx = (end.x - start.x) / distance, dy = (end.y - start.y) / distance;
      const v = record.variation, direction = position(record.seat, latest?.me) % 2 ? -1 : 1;
      const contact = { ...end, x: end.x - dx * config.settlePx, y: end.y - dy * config.settlePx, angle: end.angle + config.settleTilt * direction };
      const control = { x: (start.x + contact.x) / 2 - dy * v.curve * direction, y: (start.y + contact.y) / 2 + dx * v.curve * direction };
      const phases = [[0, 0], [.22, .36], [.52, .77], [.78, .94], [1, 1]];
      const frames = phases.map(([offset, progress]) => {
        const point = curvePoint(start, contact, control, progress);
        point.angle += Math.sin(progress * Math.PI) * v.lean;
        return { offset, transform: transform(point, end.w, end.h) };
      });
      const playMs = timing('playMs', 120, 900), settleMs = Math.min(timing('settleMs', 0, 180), playMs / 2);
      const shadow = node.querySelector('.blMotionShadow');
      if (shadow) void animateNode(shadow, [{ opacity: .26 }, { opacity: .34 }, { opacity: .2 }], playMs - settleMs, token);
      if (!await animateNode(node, frames, playMs - settleMs, token)) return;
      safeSound('card');
      if (shadow) void animateNode(shadow, [{ opacity: .2 }, { opacity: .11 }], settleMs, token);
      if (!await animateNode(node, [{ transform: transform(contact, end.w, end.h) }, { transform: transform(end, end.w, end.h) }], settleMs, token, 'cubic-bezier(.2,.7,.3,1)')) return;
      record.phase = 'settled';
      const target = visibleNode(record);
      if (!record.collectRequested && target) {
        setHidden(target, false);
        removeVisual(record);
      }
    }

    async function collectRecords(group, winner, snapshot, token) {
      if (token !== generation || !group.length) return;
      const points = group.map(record => geometry(record.node) || record.end);
      const center = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
      const seat = root.querySelector('.blSeat[data-seat="' + winner + '"]');
      const destination = geometry(seat?.querySelector('.blTaken') || seat?.querySelector('.blAvatar') || seat) || snapshot?.seats.get(winner);
      if (!destination) { group.forEach(record => { removeVisual(record); records.delete(record.key); }); return; }
      const collectMs = timing('collectMs', 180, 900), gatherMs = Math.min(timing('gatherMs', 0, 300), collectMs * .6);
      const stacks = group.map((record, index) => ({ ...record.end, x: center.x + (index - (group.length - 1) / 2) * 2.1, y: center.y + index * .7, angle: (index - (group.length - 1) / 2) * 1.5 }));
      safeSound('collect');
      const gathered = await Promise.all(group.map((record, index) => {
        record.phase = 'collect';
        const node = ensureVisual(record, points[index]);
        node.style.zIndex = String(30 + index);
        return animateNode(node, [{ transform: transform(points[index], record.end.w, record.end.h) }, { transform: transform(stacks[index], record.end.w, record.end.h) }], gatherMs, token, 'cubic-bezier(.25,.65,.3,1)');
      }));
      if (token !== generation || gathered.some(value => !value)) return;
      await Promise.all(group.map((record, index) => {
        const stack = stacks[index], small = { ...stack, x: destination.x + (index - 1.5) * .5, y: destination.y, w: Math.max(12, record.end.w * .22), h: Math.max(12, record.end.w * .22) * 1.4, angle: stack.angle * .3 };
        const control = { x: (stack.x + small.x) / 2, y: (stack.y + small.y) / 2 - 12 };
        const frames = [[0, 0, 1], [.45, .25, 1], [.82, .78, .95], [1, 1, 0]].map(([offset, progress, opacity]) => ({ offset, opacity, transform: transform(curvePoint(stack, small, control, progress), record.end.w, record.end.h) }));
        return animateNode(record.node, frames, collectMs - gatherMs, token);
      }));
      if (token !== generation) return;
      group.forEach(record => { removeVisual(record); records.delete(record.key); });
    }

    function pump() {
      if (running || !jobs.length || destroyed) return;
      running = true;
      activeSince = performance.now();
      const token = generation;
      (async () => {
        while (token === generation && jobs.length) {
          activeJob = jobs.shift();
          try { await activeJob.run(token); } catch (_) { if (token === generation) reset(); }
          activeJob = null;
        }
        if (token !== generation) return;
        running = false;
        layer?.remove(); layer = null;
        // Landed history cards exist only until their corresponding collect job finishes.
        for (const record of records.values()) if (record.phase === 'settled' && !record.collectRequested) removeVisual(record);
        layout(latest);
        idle();
      })();
    }

    function reset(settings = {}) {
      generation++;
      jobs = [];
      running = false;
      activeJob = null;
      activeSince = 0;
      skipNext = !!settings.skipNext;
      for (const animation of [...activeAnimations]) animation.cancel();
      activeAnimations.clear();
      cancelHandAnimations();
      records.clear(); seen.clear(); collections.clear();
      layer?.remove(); layer = null;
      root.querySelectorAll('[data-bl-motion-hidden]').forEach(node => delete node.dataset.blMotionHidden);
      if (latest) { markSnapshot(latest); layout(latest); }
    }

    function changes(before, after) {
      const prior = before?.game, game = after?.game;
      if (!prior || !game) return [];
      const output = [];
      const oldCount = prior.history?.length || 0, newCount = game.history?.length || 0;
      for (let index = oldCount; index < newCount; index++) {
        const trick = game.history[index];
        if (!trick?.plays?.length) continue;
        for (let order = 0; order < trick.plays.length; order++) {
          const play = trick.plays[order];
          const existed = index === oldCount && prior.trick.some(item => item.card === play.card && item.seat === play.seat);
          if (!existed) output.push({ type: 'play', trick: index, play, order });
        }
        output.push({ type: 'collect', trick: index, value: trick });
      }
      (game.trick || []).forEach((play, order) => {
        const existed = newCount === oldCount && prior.trick.some(item => item.card === play.card && item.seat === play.seat);
        if (!existed) output.push({ type: 'play', trick: newCount, play, order });
      });
      return output;
    }

    function update(before, after, snapshot, settings = {}) {
      if (destroyed) return;
      const nextScope = roundKey(after), game = after?.game;
      latest = after;
      const boundary = !game || !before?.game || nextScope !== scope || nextScope !== roundKey(before) || skipNext || document.hidden || ['kasho', 'sawa', 'claim'].includes(game?.phase);
      if (boundary) {
        scope = nextScope;
        reset();
        markSnapshot(after);
        layout(after);
        settings.origin?.ghost?.remove();
        return;
      }
      scope = nextScope;
      layout(after);
      arrangeHand(snapshot);
      const events = changes(before, after);
      const deltaHistory = game.history.length - before.game.history.length;
      const latestCue = [...(game.cues || [])].reverse().find(cue => cue.type === 'card' || cue.type === 'collect');
      const oldCue = latestCue?.at && after.now && after.now - latestCue.at > config.staleCueMs;
      const overload = deltaHistory > 1 || jobs.length + events.length > config.maxQueuedEvents || busy() && performance.now() - activeSince > config.maxTimelineMs;
      if (overload || oldCue && events.length) {
        reset(); markSnapshot(after); layout(after); settings.origin?.ghost?.remove(); return;
      }
      if (!motionEnabled()) {
        reset();
        // Reduced-motion users still hear one current card/collection sound; stale snapshots are silent.
        for (const event of events) if (event.type === 'play') safeSound('card'); else safeSound('collect');
        markSnapshot(after); layout(after); settings.origin?.ghost?.remove(); return;
      }
      for (const event of events) {
        if (event.type === 'play') {
          const key = eventKey(game, event.trick, event.play);
          if (seen.has(key)) continue;
          seen.add(key);
          const record = newRecord(after, event.trick, event.play, event.order, snapshot, settings.origin);
          if (record) jobs.push({ type: 'play', key, run: token => playRecord(record, token) });
        } else {
          const key = [game.id, game.round, event.trick, 'collect'].join(':');
          if (collections.has(key)) continue;
          collections.add(key);
          const group = event.value.plays.map((play, order) => newRecord(after, event.trick, play, order, snapshot, settings.origin, true)).filter(Boolean);
          for (const record of group) {
            record.collectRequested = true;
            if (record.phase === 'settled') ensureVisual(record, snapshot?.field.get(record.key) || record.end);
          }
          jobs.push({ type: 'collect', key, run: token => collectRecords(group, event.value.winner, snapshot, token) });
        }
      }
      layout(after);
      pump();
    }

    function suspend() { reset({ skipNext: true }); }
    function onVisibility() { if (document.hidden) suspend(); }
    function onResize() {
      const bounds = root.getBoundingClientRect(), size = [bounds.width, bounds.height];
      if (rootSize && (Math.abs(size[0] - rootSize[0]) > .75 || Math.abs(size[1] - rootSize[1]) > .75)) { reset({ skipNext: true }); layout(latest); }
      rootSize = size;
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('resize', onResize, { passive: true });
    window.visualViewport?.addEventListener('resize', onResize, { passive: true });
    reduced.addEventListener?.('change', suspend);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
    observer?.observe(root);

    return {
      capture, update, reset, geometry, busy,
      // Diagnostics expose counts and keys only, never game decisions or hidden cards.
      inspect: () => ({ scope, running, queued: jobs.length, active: activeJob?.type || null, flights: [...records.values()].filter(record => record.node?.isConnected).map(record => ({ key: record.key, card: record.card, phase: record.phase })), handAnimations: handAnimations.size }),
      destroy() {
        destroyed = true; reset(); observer?.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', suspend);
        window.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('resize', onResize);
        reduced.removeEventListener?.('change', suspend);
      }
    };
  }

  window.SakkaCardMotion = { create, geometry, config, eventKey, variation };
})();
