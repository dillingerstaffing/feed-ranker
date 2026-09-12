/* feed-ranker: the pipeline. Rules -> features -> score -> diversity
   -> ordered list. Entry point: rank(items). */
(function (ns) {
  'use strict';

  var MS_PER_DAY = 86400000;

  // Rules, applied before scoring, in order:
  // 1. drop items the reader dismissed
  // 2. drop duplicate urls (keep the first occurrence)
  // 3. drop items older than maxAgeDays
  function applyRules(items, profile, opts) {
    opts = opts || {};
    var now = opts.nowMs || Date.now();
    var maxAgeMs = (profile.maxAgeDays || 90) * MS_PER_DAY;
    var out = [];
    var seenUrls = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (profile.seen[it.id] === 'dismissed') continue;
      if (seenUrls[it.url]) continue;
      seenUrls[it.url] = true;
      if (now - it.publishedAt > maxAgeMs) continue;
      out.push(it);
    }
    return out;
  }

  function score(item, profile, opts) {
    var f = ns.features.extract(item, profile, opts);
    var w = profile.weights;
    return w.recency * f.recency +
           w.topic * f.topic +
           w.source * f.source +
           w.kind * f.kind +
           w.novelty * f.novelty +
           w.prior * f.prior;
  }

  // Diversity adjustment: sort by base score descending, then walk the
  // order. For each item, k is the number of already placed items
  // sharing its primary topic. For base >= 0:
  //   final = base * ((1 - floor) * decay^k + floor)
  // This keeps one topic from filling consecutive slots while still
  // letting strong items rise.
  function diversify(scored, profile) {
    var div = profile.diversity || { decay: 0.5, floor: 0.2 };
    var topicCount = {};
    var out = [];
    for (var i = 0; i < scored.length; i++) {
      var it = scored[i].item;
      var base = scored[i].base;
      var primary = (it.topics && it.topics[0]) || '';
      var k = topicCount[primary] || 0;
      var finalScore = base;
      if (base >= 0) {
        finalScore = base * ((1 - div.floor) * Math.pow(div.decay, k) + div.floor);
      }
      topicCount[primary] = k + 1;
      out.push({ item: it, base: base, score: finalScore });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  function rank(items, opts) {
    opts = opts || {};
    var profile = ns.profile.load();
    var kept = applyRules(items, profile, opts);
    var scored = [];
    for (var i = 0; i < kept.length; i++) {
      scored.push({ item: kept[i], base: score(kept[i], profile, opts) });
    }
    scored.sort(function (a, b) { return b.base - a.base; });
    var final = diversify(scored, profile);
    var out = [];
    for (var j = 0; j < final.length; j++) out.push(final[j].item);
    return out;
  }

  // Why-ranked: the top 3 affinity signals behind an item's base
  // score. Each entry names the console row it belongs to
  // (group + key), its value, and its contribution to the score
  // (weight * value; the topic weight is split across the item's
  // topics so the entries sum to the topic dimension's share).
  // Sorted by contribution, strongest first.
  function explain(item, opts) {
    opts = opts || {};
    var profile = ns.profile.load();
    var w = profile.weights;
    var topics = item.topics || [];
    var n = topics.length || 1;
    var entries = [];
    for (var i = 0; i < topics.length; i++) {
      var t = topics[i];
      var tv = profile.topicAffinity[t] || 0;
      entries.push({ group: 'topic', key: t, value: tv, contribution: w.topic * tv / n });
    }
    if (item.source) {
      var sv = profile.sourceAffinity[item.source] || 0;
      entries.push({ group: 'source', key: item.source, value: sv, contribution: w.source * sv });
    }
    if (item.kind) {
      var kv = profile.kindAffinity[item.kind] || 0;
      entries.push({ group: 'kind', key: item.kind, value: kv, contribution: w.kind * kv });
    }
    entries.sort(function (a, b) { return b.contribution - a.contribution; });
    return entries.slice(0, 3);
  }

  ns.ranker = {
    rank: rank,
    score: score,
    applyRules: applyRules,
    diversify: diversify,
    explain: explain
  };
  ns.rank = rank;
})(FeedRanker);
