/* feed-ranker: profile load/save. Affinity tables and blend weights,
   persisted in localStorage. Falls back to memory when storage is
   unavailable (private mode, non-browser runtimes). */
(function (ns) {
  'use strict';

  var KEY = 'feed-ranker/profile/v1';

  var DEFAULT_WEIGHTS = {
    recency: 0.25,
    topic: 0.25,
    source: 0.15,
    kind: 0.10,
    novelty: 0.10,
    prior: 0.15
  };

  var memory = {};

  function storage() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.getItem(KEY);
        return localStorage;
      }
    } catch (e) { /* fall through to memory */ }
    return {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
      },
      setItem: function (k, v) { memory[k] = String(v); },
      removeItem: function (k) { delete memory[k]; }
    };
  }

  function blank() {
    return {
      version: 1,
      weights: {
        recency: DEFAULT_WEIGHTS.recency,
        topic: DEFAULT_WEIGHTS.topic,
        source: DEFAULT_WEIGHTS.source,
        kind: DEFAULT_WEIGHTS.kind,
        novelty: DEFAULT_WEIGHTS.novelty,
        prior: DEFAULT_WEIGHTS.prior
      },
      halfLifeHours: 72,
      maxAgeDays: 90,
      diversity: { decay: 0.5, floor: 0.2 },
      learningRate: 0.1,
      topicAffinity: {},
      sourceAffinity: {},
      kindAffinity: {},
      seen: {},
      updatedAt: 0
    };
  }

  function load() {
    var p = blank();
    try {
      var raw = storage().getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.version === 1) {
          for (var k in p) {
            if (Object.prototype.hasOwnProperty.call(saved, k)) p[k] = saved[k];
          }
          p.weights = {};
          for (var w in DEFAULT_WEIGHTS) {
            p.weights[w] = (saved.weights && typeof saved.weights[w] === 'number')
              ? saved.weights[w] : DEFAULT_WEIGHTS[w];
          }
          p.topicAffinity = saved.topicAffinity || {};
          p.sourceAffinity = saved.sourceAffinity || {};
          p.kindAffinity = saved.kindAffinity || {};
          p.seen = saved.seen || {};
        }
      }
    } catch (e) { /* corrupted or unreadable: return blank */ }
    return p;
  }

  function save(p) {
    p.updatedAt = Date.now();
    try {
      storage().setItem(KEY, JSON.stringify(p));
    } catch (e) { /* storage full or blocked: keep in-memory state */ }
  }

  function reset() {
    try {
      storage().removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  ns.profile = {
    load: load,
    save: save,
    reset: reset,
    blank: blank,
    KEY: KEY,
    defaultWeights: function () {
      var w = {};
      for (var k in DEFAULT_WEIGHTS) w[k] = DEFAULT_WEIGHTS[k];
      return w;
    }
  };
})(FeedRanker);
