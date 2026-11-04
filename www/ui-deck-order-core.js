var MajabeedDeckCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // connection-return-update/deck32/staged/deckOrder.js
  var deckOrder_exports = {};
  __export(deckOrder_exports, {
    DECK_RANKS: () => DECK_RANKS,
    DECK_SUITS: () => DECK_SUITS,
    DEFAULT_JOKERS: () => DEFAULT_JOKERS,
    DEFAULT_RANK_ORDER: () => DEFAULT_RANK_ORDER,
    MAX_BASRA_COUNT: () => MAX_BASRA_COUNT,
    MAX_JOKERS: () => MAX_JOKERS,
    MIN_BASRA_COUNT: () => MIN_BASRA_COUNT,
    buildDeck: () => buildDeck,
    normalizeDeckSettings: () => normalizeDeckSettings,
    validateFriendlyDeckCapacity: () => validateFriendlyDeckCapacity
  });
  var DEFAULT_RANK_ORDER = Object.freeze([5, 12, 8, 3, 11, 2, 14, 9, 10, 4, 6, 13, 7]);
  var DEFAULT_JOKERS = 27;
  var MAX_JOKERS = 100;
  var MIN_BASRA_COUNT = 5;
  var MAX_BASRA_COUNT = 32;
  var DECK_RANKS = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  var DECK_SUITS = Object.freeze(["\u2660", "\u2665", "\u2666", "\u2663"]);
  function validRanks(value) {
    return Array.isArray(value) && value.length === 13 && value.every((rank) => Number.isInteger(rank) && rank >= 2 && rank <= 14) && new Set(value).size === 13;
  }
  function normalizeDeckSettings(value) {
    if (value === void 0)
      value = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0631\u0635 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629");
    }
    const mode = value.mode === void 0 ? "fixed" : value.mode;
    if (!["fixed", "custom", "random"].includes(mode))
      throw new Error("\u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629 \u0631\u0635 \u0635\u062D\u064A\u062D\u0629");
    const jokerCount = value.jokerCount === void 0 ? DEFAULT_JOKERS : value.jokerCount;
    if (!Number.isInteger(jokerCount) || jokerCount < 0 || jokerCount > MAX_JOKERS) {
      throw new Error("\u0627\u062E\u062A\u0631 \u0639\u062F\u062F \u062C\u0648\u0627\u0643\u0631 \u0635\u062D\u064A\u062D\u064B\u0627 \u0645\u0646 0 \u0625\u0644\u0649 " + MAX_JOKERS);
    }
    if (mode === "custom" && value.ranks === void 0)
      throw new Error("\u0623\u0643\u0645\u0644 \u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0631\u062A\u0628 \u0627\u0644\u062B\u0644\u0627\u062B \u0639\u0634\u0631\u0629");
    const ranks = value.ranks === void 0 ? DEFAULT_RANK_ORDER : value.ranks;
    if (!validRanks(ranks))
      throw new Error("\u064A\u062C\u0628 \u0623\u0646 \u064A\u062D\u062A\u0648\u064A \u0627\u0644\u0631\u0635 \u0643\u0644 \u0631\u062A\u0628\u0629 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0645\u0646 2 \u0625\u0644\u0649 \u0627\u0644\u0622\u0643\u0629");
    if (mode === "fixed" && ranks.some((rank, index) => rank !== DEFAULT_RANK_ORDER[index])) {
      throw new Error("\u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0631\u0635 \u0627\u0644\u0645\u062E\u0635\u0635 \u0644\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0645\u0639\u062A\u0645\u062F");
    }
    const result = { mode, ranks: ranks.slice(), jokerCount };
    if (value.basraCount !== void 0) {
      if (!Number.isInteger(value.basraCount) || value.basraCount < MIN_BASRA_COUNT || value.basraCount > MAX_BASRA_COUNT) {
        throw new Error("\u0627\u062E\u062A\u0631 \u0639\u062F\u062F \u0628\u0648\u0627\u0635\u0631 \u0635\u062D\u064A\u062D\u064B\u0627 \u0645\u0646 " + MIN_BASRA_COUNT + " \u0625\u0644\u0649 " + MAX_BASRA_COUNT);
      }
      result.basraCount = value.basraCount;
    }
    return result;
  }
  function validateFriendlyDeckCapacity(value, handCards, seatCount) {
    const settings = normalizeDeckSettings(value);
    if (settings.basraCount === void 0)
      return settings;
    if (!Number.isInteger(handCards) || handCards < 7 || handCards > 15)
      throw new Error("\u0627\u062E\u062A\u0631 \u0639\u062F\u062F \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u064A\u062F \u0645\u0646 7 \u0625\u0644\u0649 15");
    if (seatCount !== 4 && seatCount !== 6)
      throw new Error("\u0639\u062F\u062F \u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 4 \u0623\u0648 6");
    const available = 13 * settings.basraCount + settings.jokerCount;
    const required = 13 + seatCount * handCards + 1;
    if (available < required) {
      throw new RangeError("\u0639\u062F\u062F \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0631\u0632\u0645\u0629 \u0644\u0627 \u064A\u0643\u0641\u064A: \u0627\u0644\u0645\u062A\u0627\u062D " + available + " \u0648\u0627\u0644\u0645\u0637\u0644\u0648\u0628 " + required + ". \u0632\u062F \u0639\u062F\u062F \u0627\u0644\u0628\u0648\u0627\u0635\u0631 \u0623\u0648 \u0627\u0644\u062C\u0648\u0627\u0643\u0631\u060C \u0623\u0648 \u0642\u0644\u0644 \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u064A\u062F");
    }
    return settings;
  }
  function permutations(values) {
    if (!values.length)
      return [[]];
    return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map((rest) => [value, ...rest]));
  }
  var PICTURE_ORDERS = permutations([10, 11, 12, 13, 14]);
  function shuffleCopy(values, random) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function addJokers(ordinary, jokers, random) {
    if (!jokers.length)
      return ordinary;
    const total = ordinary.length + jokers.length, gap = total / jokers.length;
    const positions = [];
    for (let i = 0; i < jokers.length; i++) {
      const candidate = Math.floor((i + 0.25 + random() * 0.5) * gap);
      const minimum = i ? positions[i - 1] + 1 : 0;
      const maximum = total - (jokers.length - i);
      positions.push(Math.max(minimum, Math.min(maximum, candidate)));
    }
    const orderedJokers = shuffleCopy(jokers, random), deck = [];
    let cardIndex = 0, jokerIndex = 0;
    for (let i = 0; i < total; i++) {
      if (jokerIndex < positions.length && positions[jokerIndex] === i)
        deck.push(orderedJokers[jokerIndex++]);
      else
        deck.push(ordinary[cardIndex++]);
    }
    return deck;
  }
  function buildDeck(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options))
      throw new Error("\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0631\u0632\u0645\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629");
    const blocks = options.blocks === void 0 ? 8 : options.blocks;
    if (!Number.isInteger(blocks) || blocks < 1 || blocks > 64)
      throw new Error("\u0639\u062F\u062F \u062D\u0632\u0645 \u0627\u0644\u0631\u0632\u0645\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    const reserveField = options.reserveField === void 0 ? false : options.reserveField;
    if (typeof reserveField !== "boolean")
      throw new Error("\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0645\u064A\u062F\u0627\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    const sourceRandom = options.random === void 0 ? Math.random : options.random;
    if (typeof sourceRandom !== "function")
      throw new Error("\u0645\u0648\u0644\u062F \u0627\u0644\u0639\u0634\u0648\u0627\u0626\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    const random = () => {
      const value = sourceRandom();
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1) {
        throw new Error("\u0642\u064A\u0645\u0629 \u0627\u0644\u0639\u0634\u0648\u0627\u0626\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629");
      }
      return value;
    };
    const settings = normalizeDeckSettings({ mode: options.mode, ranks: options.ranks, jokerCount: options.jokerCount, basraCount: options.basraCount });
    const jokerCount = options.jokerCount === void 0 && settings.basraCount === void 0 ? Math.max(1, Math.round(DEFAULT_JOKERS * blocks / 8)) : settings.jokerCount;
    const byRank = new Map(DECK_RANKS.map((rank) => [rank, []])), packs = [];
    let id = 0;
    if (settings.basraCount === void 0) {
      for (let block = 0; block < blocks; block++) {
        const pack = [];
        for (const rank of DECK_RANKS)
          for (const suit of DECK_SUITS) {
            const card = { id: id++, rank, suit };
            pack.push(card);
            byRank.get(rank).push(card);
          }
        packs.push(pack);
      }
    } else {
      const count = settings.basraCount, remainder = count % 4;
      const suitCycle = shuffleCopy(DECK_SUITS, random), rankSuits = /* @__PURE__ */ new Map();
      shuffleCopy(DECK_RANKS, random).forEach((rank, rankIndex) => {
        const suits = Array.from({ length: Math.floor(count / 4) }, () => DECK_SUITS).flat();
        for (let i = 0; i < remainder; i++)
          suits.push(suitCycle[(rankIndex * remainder + i) % 4]);
        rankSuits.set(rank, shuffleCopy(suits, random));
      });
      for (let basra = 0; basra < count; basra++) {
        const pack = [];
        for (const rank of DECK_RANKS) {
          const card = { id: id++, rank, suit: rankSuits.get(rank)[basra] };
          pack.push(card);
          byRank.get(rank).push(card);
        }
        packs.push(pack);
      }
    }
    for (const rank of DECK_RANKS)
      byRank.set(rank, shuffleCopy(byRank.get(rank), random));
    const field = reserveField ? DECK_RANKS.map((rank) => byRank.get(rank).pop()) : [];
    let ordinary;
    if (settings.mode === "random") {
      const reserved = new Set(field.map((card) => card.id));
      ordinary = settings.basraCount === void 0 ? shuffleCopy(packs.map((pack) => shuffleCopy(pack.filter((card) => !reserved.has(card.id)), random)), random).flat() : shuffleCopy(packs.flat().filter((card) => !reserved.has(card.id)), random);
    } else {
      ordinary = [];
      let previousPictures = null;
      const cycles = (settings.basraCount === void 0 ? blocks * 4 : settings.basraCount) - (reserveField ? 1 : 0);
      for (let cycle = 0; cycle < cycles; cycle++) {
        const choices = previousPictures ? PICTURE_ORDERS.filter((order) => order.every((rank, index) => rank !== previousPictures[index])) : PICTURE_ORDERS;
        const pictures = choices[Math.floor(random() * choices.length)];
        let pictureIndex = 0;
        for (const slot of settings.ranks) {
          const rank = slot >= 10 ? pictures[pictureIndex++] : slot;
          ordinary.push(byRank.get(rank).pop());
        }
        previousPictures = pictures;
      }
    }
    const jokers = Array.from({ length: jokerCount }, () => ({ id: id++, rank: 99, suit: "\u2605" }));
    return { deck: addJokers(ordinary, jokers, random), field };
  }
  return __toCommonJS(deckOrder_exports);
})();
