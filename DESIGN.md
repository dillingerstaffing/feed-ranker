# feed-ranker: design

## Goal

A JavaScript module that orders items in a personal news wire. Input: the
wire's items. Output: the same items ordered by predicted relevance to the
reader. Runs in the browser. No server. No tracking. No network calls.

## Non-goals

Reproducing the scoring behavior of any production recommendation system is
not possible and not attempted. The trained model weights behind such systems
are not public, and the engagement data they learn from does not exist here.
What is reused is the pipeline shape: gather candidates, attach features,
compute a score, apply ordering rules. That shape is independent of any
particular system.

## The four stages

### 1. Candidates

The wire holds tens to hundreds of items. At this scale the candidate set is
the whole wire; no retrieval step is needed. Each item carries: id, url,
title, topics, source, publishedAt, kind.

### 2. Features

For each item, compute:

- recency: exponential decay on age,
  recency = exp(-ageHours / halfLifeHours), halfLife default 72.
- topicScore: mean of the reader's topic affinities over the item's topics;
  0 when unknown.
- sourceScore: the reader's affinity for the item's source; 0 when unknown.
- kindScore: the reader's affinity for the item's kind; 0 when unknown.
- novelty: 1 if the item has not been seen, lower if seen and skipped.
- prior: the wire's own signal score, normalized to 0..1. Used as the
  starting signal before the reader has history.

### 3. Scoring

    base = wRecency*recency + wTopic*topicScore + wSource*sourceScore
         + wKind*kindScore + wNovelty*novelty + wPrior*prior

The blend weights (wRecency, wTopic, ...) are fixed numbers stored in the
profile, visible and editable. The learned parameters are the affinity
tables (topic, source, kind), updated from reader feedback:

- On read: affinity moves toward 1: a += lr * (1 - a).
- On skip: affinity moves toward 0 with a smaller step.
- On dismiss: affinity moves toward -1, and the item is excluded by the
  rules stage.

lr is the learning rate, default 0.1. Affinities are moving averages, so
they stay bounded and the updates cannot diverge. The blend weights stay
fixed because updating them from sparse binary feedback would be unstable;
learning lives in the affinity tables, which is also what keeps the model
inspectable: every number that changes has a name (a topic, a source, a
kind) and a readable value.

Diversity adjustment: sort by base score descending, then walk the order.
For each item, let k be the number of already placed items sharing its
primary topic. For base >= 0:

    final = base * ((1 - floor) * decay^k + floor)

Defaults: decay 0.5, floor 0.2. This keeps one topic from filling
consecutive slots while still letting strong items rise.

### 4. Rules

Applied before scoring, in this order:

1. Drop items the reader dismissed.
2. Drop duplicate urls (keep the first occurrence).
3. Drop items older than maxAgeDays (default 90).

Then score, apply the diversity adjustment, and return the ordered list.

## Module layout

    src/
      features.js   feature extraction: item -> feature vector
      profile.js    profile load/save, affinity tables, blend weights
                    (persisted in localStorage)
      feedback.js   recordRead / recordSkip / recordDismiss, affinity updates
      ranker.js     pipeline: rules -> features -> score -> diversity
                    -> ordered list

One entry point: `rank(items)` reads the profile, runs the pipeline, returns
a new array. The `feedback` functions mutate the profile.

## Data shapes

Item (input, from the wire):

    {
      id: string,          // stable id
      url: string,         // canonical link, used for dedup
      title: string,
      topics: string[],
      source: string,
      publishedAt: number, // epoch ms
      kind: string         // article, guide, project, paper, video
    }

Profile (persisted in localStorage under feed-ranker/profile/v1):

    {
      version: 1,
      weights: { recency, topic, source, kind, novelty, prior },
      topicAffinity:  { [topic]: number },
      sourceAffinity: { [source]: number },
      kindAffinity:   { [kind]: number },
      seen: { [id]: 'read' | 'skipped' | 'dismissed' },
      updatedAt: number
    }

## Page integration

The wire page already sorts by newest and by signal. This module adds a
third sort option. The page calls `rank(items)` for that option and calls
`feedback.recordRead(item)` when the reader opens an item. Nothing else on
the page changes.

## Cold start

With no history, affinity terms are 0 and ordering falls back to recency,
novelty, and the wire's signal prior. The ranking becomes personal as
feedback accumulates.

## Why not WebAssembly

Scoring a few hundred items with a weighted sum is microseconds of
JavaScript. WebAssembly would add build and loading complexity with no
measured benefit. Revisit only if profiling shows otherwise.

## Status

Design only. No code has been written.
