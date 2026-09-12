/* feed-ranker: reader feedback. Bounded moving-average updates to the
   affinity tables. Every number that changes has a name (a topic, a
   source, a kind) and a readable value. */
(function (ns) {
  'use strict';

  function clampAffinity(a) {
    return a < -1 ? -1 : a > 1 ? 1 : a;
  }

  function moveToward(table, key, target, step) {
    var cur = table[key] || 0;
    table[key] = clampAffinity(cur + step * (target - cur));
  }

  function touchAffinities(profile, item, target, step) {
    var topics = item.topics || [];
    for (var i = 0; i < topics.length; i++) {
      moveToward(profile.topicAffinity, topics[i], target, step);
    }
    if (item.source) moveToward(profile.sourceAffinity, item.source, target, step);
    if (item.kind) moveToward(profile.kindAffinity, item.kind, target, step);
  }

  // Read: affinity moves toward 1 at the full learning rate.
  function recordRead(item) {
    var p = ns.profile.load();
    var lr = p.learningRate || 0.1;
    touchAffinities(p, item, 1, lr);
    p.seen[item.id] = 'read';
    ns.profile.save(p);
    return p;
  }

  // Skip: affinity moves toward 0 with a smaller step.
  function recordSkip(item) {
    var p = ns.profile.load();
    var lr = p.learningRate || 0.1;
    touchAffinities(p, item, 0, lr * 0.5);
    p.seen[item.id] = 'skipped';
    ns.profile.save(p);
    return p;
  }

  // Dismiss: affinity moves toward -1, and the rules stage excludes
  // the item from future rankings.
  function recordDismiss(item) {
    var p = ns.profile.load();
    var lr = p.learningRate || 0.1;
    touchAffinities(p, item, -1, lr);
    p.seen[item.id] = 'dismissed';
    ns.profile.save(p);
    return p;
  }

  ns.feedback = {
    recordRead: recordRead,
    recordSkip: recordSkip,
    recordDismiss: recordDismiss
  };
})(FeedRanker);
