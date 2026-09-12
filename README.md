# feed-ranker

Orders items in a personal news wire by predicted relevance to the reader.
Runs in the browser. No server. No tracking. No network calls.

## How it works

Four stages:

1. Candidates: the wire's items.
2. Features: recency, topic/source/kind affinity learned from the reader's
   own read and skip history, and the wire's signal score as a starting
   point.
3. Scoring: a weighted sum of the features, with a diversity adjustment so
   one topic does not fill consecutive slots. Affinities update from
   feedback; the blend weights are fixed and inspectable.
4. Rules: dismissed items, duplicates, and items past the age limit are
   removed before scoring.

## Layout

    src/
      features.js   feature extraction: item -> feature vector
      profile.js    profile load/save, affinity tables, blend weights
                    (persisted in localStorage)
      feedback.js   recordRead / recordSkip / recordDismiss, affinity updates
      ranker.js     pipeline: rules -> features -> score -> diversity
                    -> ordered list
    dist/
      feed-ranker.js  concatenated build of src/, the file pages load

Build with `./build.sh`. No dependencies.

## Use

    <script src="feed-ranker.js"></script>
    <script>
      var items = [
        { id: "a1", url: "https://example.com/a", title: "Example",
          topics: ["riscv-isa"], source: "Example", kind: "article",
          signal: 5, publishedAt: Date.parse("2026-09-10") }
      ];
      var ordered = FeedRanker.rank(items);          // best first
      FeedRanker.feedback.recordRead(items[0]);     // reader opened it
      FeedRanker.feedback.recordSkip(items[1]);     // reader skipped it
      FeedRanker.feedback.recordDismiss(items[2]);  // reader dismissed it
    </script>

`FeedRanker.rank(items)` reads the stored profile, runs the pipeline, and
returns a new array. The feedback functions update the profile. With no
history, ordering falls back to recency and the item's signal score, and
becomes personal as feedback accumulates. See DESIGN.md for the pipeline,
the scoring function, and the update rules.
