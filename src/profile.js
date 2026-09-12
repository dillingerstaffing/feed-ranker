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
      paused: false,
      topicAffinity: {},
      sourceAffinity: {},
      kindAffinity: {},
      // Basis tracking: keys the reader set by hand in the console.
      // Anything not listed here was learned from reads and skips.
      manualTopics: {},
      manualSources: {},
      manualKinds: {},
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
          p.manualTopics = saved.manualTopics || {};
          p.manualSources = saved.manualSources || {};
          p.manualKinds = saved.manualKinds || {};
          p.paused = !!saved.paused;
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

  function clamp11(v) {
    v = Number(v);
    if (isNaN(v)) return 0;
    return v < -1 ? -1 : v > 1 ? 1 : v;
  }

  function affinityTable(p, group) {
    if (group === 'topic') return p.topicAffinity;
    if (group === 'source') return p.sourceAffinity;
    if (group === 'kind') return p.kindAffinity;
    return null;
  }

  function manualTable(p, group) {
    if (group === 'topic') return p.manualTopics;
    if (group === 'source') return p.manualSources;
    if (group === 'kind') return p.manualKinds;
    return null;
  }

  // Explicit edit from the console. Marks the key's basis as
  // "set by you" so the panel can say what was measured and what
  // was set by hand.
  function setAffinity(group, key, value) {
    var p = load();
    var table = affinityTable(p, group);
    var manual = manualTable(p, group);
    if (!table || !manual || !key) return p;
    table[key] = clamp11(value);
    manual[key] = true;
    save(p);
    return p;
  }

  // Release a pinned row back to "measured". The value stays where
  // the user left it; learning resumes nudging from there. This is
  // the per-row counterpart to reset: editing pins one axis, release
  // unpins it, reset clears everything.
  function releaseAffinity(group, key) {
    var p = load();
    var manual = manualTable(p, group);
    if (!manual || !key) return p;
    delete manual[key];
    save(p);
    return p;
  }

  function setPaused(on) {
    var p = load();
    p.paused = !!on;
    save(p);
    return p;
  }

  function isPaused() {
    return !!load().paused;
  }

  function resetProfile() {
    reset();
    return blank();
  }

  // Snapshot for the console: every signal as a row with its value
  // and basis, plus status and counts for the header.
  function getSnapshot() {
    var p = load();
    function rows(table, manual) {
      var out = [];
      for (var k in table) {
        if (Object.prototype.hasOwnProperty.call(table, k)) {
          out.push({
            key: k,
            value: table[k],
            basis: manual[k] ? 'set by you' : 'measured'
          });
        }
      }
      out.sort(function (a, b) { return b.value - a.value; });
      return out;
    }
    var reads = 0, skips = 0, dismissed = 0;
    for (var id in p.seen) {
      if (!Object.prototype.hasOwnProperty.call(p.seen, id)) continue;
      var s = p.seen[id];
      if (s === 'read') reads++;
      else if (s === 'skipped') skips++;
      else if (s === 'dismissed') dismissed++;
    }
    return {
      paused: !!p.paused,
      weights: defaultWeights(),
      topics: rows(p.topicAffinity, p.manualTopics),
      sources: rows(p.sourceAffinity, p.manualSources),
      kinds: rows(p.kindAffinity, p.manualKinds),
      counts: { reads: reads, skips: skips, dismissed: dismissed }
    };
  }

  function defaultWeights() {
    var w = {};
    for (var k in DEFAULT_WEIGHTS) w[k] = DEFAULT_WEIGHTS[k];
    return w;
  }

  ns.profile = {
    load: load,
    save: save,
    reset: reset,
    blank: blank,
    KEY: KEY,
    setAffinity: setAffinity,
    releaseAffinity: releaseAffinity,
    setPaused: setPaused,
    isPaused: isPaused,
    resetProfile: resetProfile,
    getSnapshot: getSnapshot,
    defaultWeights: defaultWeights
  };
})(FeedRanker);
