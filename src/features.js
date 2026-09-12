/* feed-ranker: feature extraction. Item -> feature vector. */
(function (ns) {
  'use strict';

  var MS_PER_HOUR = 3600000;

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function recency(item, nowMs, halfLifeHours) {
    var ageHours = Math.max(0, (nowMs - item.publishedAt) / MS_PER_HOUR);
    return Math.exp(-ageHours / halfLifeHours);
  }

  function meanAffinity(values) {
    if (!values.length) return 0;
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
  }

  // novelty: 1 when the item has not been seen, lower once it has.
  function novelty(item, profile) {
    var state = profile.seen[item.id];
    if (state === 'skipped') return 0.3;
    if (state === 'read') return 0.6;
    return 1;
  }

  // profile: { topicAffinity, sourceAffinity, kindAffinity, seen }
  function extract(item, profile, opts) {
    opts = opts || {};
    var halfLife = opts.halfLifeHours || profile.halfLifeHours || 72;
    var now = opts.nowMs || Date.now();
    var topics = item.topics || [];
    var topicVals = [];
    for (var i = 0; i < topics.length; i++) {
      topicVals.push(profile.topicAffinity[topics[i]] || 0);
    }
    return {
      recency: recency(item, now, halfLife),
      topic: meanAffinity(topicVals),
      source: profile.sourceAffinity[item.source] || 0,
      kind: profile.kindAffinity[item.kind] || 0,
      novelty: novelty(item, profile),
      prior: clamp01((item.signal || 0) / 5)
    };
  }

  ns.features = { extract: extract, recency: recency, novelty: novelty };
})(FeedRanker);
