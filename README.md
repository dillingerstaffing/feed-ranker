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
      blog.js       blog adapter: article -> rankable item, topic mapping
                    onto the shared vocabulary
      dwell.js      dwell-gated reads: visible-time tracker and outbound
                    bounce decision
      console.js    ranking console: profile snapshot, manual affinity
                    edits, pause/resume, per-item why-ranked. DOM only.
    dist/
      feed-ranker.js  concatenated build of src/, the file pages load
      feed-ranker-console.js  console bundle (src/console.js), loaded
                    alongside the core on pages with the console

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

## Blog posts

Blog articles adapt to the same item shape, so one profile ranks both
the wire and the blog:

    var articles = [ { slug: "div-by-zero", title: "...", date: "2026-09-12",
                       description: "...", paragraphs: ["..."] } ];
    var items = FeedRanker.blog.adaptAll(articles);
    var ordered = FeedRanker.rank(items);
    FeedRanker.feedback.recordRead(items[0]);  // updates the shared profile

`FeedRanker.blog.topicsFor(article)` maps article text onto the wire's
topic vocabulary. The profile storage key is unchanged: reads and skips
on either page shape the ranking on both.

## Dwell-gated reads

A click alone is not a read. On article pages, `FeedRanker.dwell.track`
records a read only after 15 seconds of visible dwell; a quick
open-and-back records nothing. For outbound links, `FeedRanker.dwell`
`.absenceResult` treats an absence under 10 seconds as a bounce (no
signal) and a longer one as a read.
