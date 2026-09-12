/* feed-ranker: dwell-gated reads. A click alone is not a read; only
   sustained attention counts. Two pieces:

   1. track(item, opts): watches one item while its page is open.
      Accumulates only the time the tab is actually visible (hidden time
      never accrues). When accrued visible time reaches thresholdMs
      (default 15000), records a read through onRead (default
      feedback.recordRead) exactly once. Returns { cancel(), accrued() }.

   2. absenceResult(departedAtMs, returnedAtMs, bounceMs): pure bounce
      decision for outbound links. The page notes the departure time when
      the reader clicks out and checks it when the tab becomes visible
      again. Away for bounceMs (default 10000) or longer counts as a
      read; a shorter absence is a bounce and records nothing; no
      departure on record means 'none'. */
(function (ns) {
  'use strict';

  function track(item, opts) {
    opts = opts || {};
    var thresholdMs = typeof opts.thresholdMs === 'number' ? opts.thresholdMs : 15000;
    var onRead = opts.onRead || function (it) { ns.feedback.recordRead(it); };
    var now = opts.now || function () { return Date.now(); };
    var setT = opts.setTimeout || function (fn, ms) { return setTimeout(fn, ms); };
    var clearT = opts.clearTimeout || function (id) { clearTimeout(id); };
    var doc = opts.document || (typeof document !== 'undefined' ? document : null);
    var visibleFn = opts.isVisible || null;

    var accrued = 0;
    var visibleSince = null;
    var timer = null;
    var done = false;
    var unsub = null;

    function isVisible() {
      if (visibleFn) return visibleFn();
      if (doc && typeof doc.visibilityState === 'string') return doc.visibilityState === 'visible';
      return true;
    }
    // Fold the current visible stretch into accrued.
    function settle() {
      if (visibleSince !== null) {
        accrued += Math.max(0, now() - visibleSince);
        visibleSince = null;
      }
    }
    function clearTimer() {
      if (timer !== null) { clearT(timer); timer = null; }
    }
    function finish() {
      if (done) return;
      done = true;
      clearTimer();
      if (unsub) { unsub(); unsub = null; }
      // Paused: the timer may have run, but nothing is recorded.
      var paused = ns.profile && ns.profile.isPaused ? ns.profile.isPaused() : false;
      if (!paused) onRead(item);
    }
    function arm() {
      clearTimer();
      if (done || visibleSince === null) return;
      var remaining = thresholdMs - accrued - (now() - visibleSince);
      if (remaining <= 0) { settle(); finish(); return; }
      timer = setT(function () {
        timer = null;
        settle();
        if (accrued >= thresholdMs) { finish(); return; }
        // Timer fired early (throttled while hidden): resume only if visible.
        if (isVisible()) { visibleSince = now(); arm(); }
      }, remaining);
    }
    function onVisibility() {
      if (done) return;
      if (isVisible()) {
        if (visibleSince === null) { visibleSince = now(); arm(); }
      } else {
        settle();
        clearTimer();
      }
    }

    if (isVisible()) { visibleSince = now(); arm(); }
    if (doc && doc.addEventListener && !visibleFn) {
      var handler = onVisibility;
      doc.addEventListener('visibilitychange', handler);
      unsub = function () { doc.removeEventListener('visibilitychange', handler); };
    }

    return {
      // Stop tracking without recording. A quick open-and-back is a
      // bounce: the reader never stayed, so nothing is learned.
      cancel: function () {
        if (done) return;
        done = true;
        clearTimer();
        if (unsub) { unsub(); unsub = null; }
      },
      accrued: function () {
        return accrued + (visibleSince !== null ? Math.max(0, now() - visibleSince) : 0);
      }
    };
  }

  function absenceResult(departedAtMs, returnedAtMs, bounceMs) {
    if (departedAtMs === null || departedAtMs === undefined) return 'none';
    var bounce = typeof bounceMs === 'number' ? bounceMs : 10000;
    var away = (returnedAtMs || Date.now()) - departedAtMs;
    return away >= bounce ? 'read' : 'bounce';
  }

  ns.dwell = {
    track: track,
    absenceResult: absenceResult
  };
})(FeedRanker);
