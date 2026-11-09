/*
 * Majabeed table rendering middleware.
 * Load after the base/six-seat renderer and before its presentation features.
 * The public renderOnl function has one stable owner; features register named
 * layers instead of replacing that global function themselves.
 */
(function installRenderPipeline(root) {
  'use strict';

  if (root.MajabeedRenderPipeline) return;
  if (typeof root.renderOnl !== 'function') {
    throw new Error('Majabeed render pipeline requires the base renderer.');
  }

  const baseRenderer = root.renderOnl;
  const layers = new Map();
  let composedRenderer = baseRenderer;

  // Lower orders are closest to the base renderer. Higher orders surround
  // them, matching the previous order of the seven presentation wrappers.
  function registerOnline(id, order, wrap) {
    if (typeof id !== 'string' || !id || !Number.isFinite(order) || typeof wrap !== 'function') {
      throw new TypeError('A render layer needs an id, a numeric order and a wrapper.');
    }
    if (layers.has(id)) return false;
    if ([...layers.values()].some(layer => layer.order === order)) {
      throw new Error('Render layer order is already registered: ' + order);
    }

    const pending = [...layers.values(), { id, order, wrap }].sort((a, b) => a.order - b.order);
    let next = baseRenderer;
    for (const layer of pending) {
      next = layer.wrap(next);
      if (typeof next !== 'function') {
        throw new TypeError('Render layer must return a function: ' + layer.id);
      }
    }

    // Publish only a complete composition. Errors above leave the live
    // renderer intact, and duplicate script evaluation cannot add a layer twice.
    layers.set(id, { id, order, wrap });
    composedRenderer = next;
    return true;
  }

  function renderOnline() {
    return composedRenderer.apply(this, arguments);
  }

  root.renderOnl = renderOnline;
  root.MajabeedRenderPipeline = Object.freeze({
    registerOnline,
    onlineLayers() {
      return [...layers.values()]
        .sort((a, b) => a.order - b.order)
        .map(({ id, order }) => ({ id, order }));
    }
  });
})(window);
