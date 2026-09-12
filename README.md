# feed-ranker

Ranks items in a personal news wire by predicted relevance to the reader.
Runs in the browser. No server, no tracking, no network calls.

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

## Status

Design phase. See DESIGN.md. No code has been written yet.

## Use

The module plugs into the wire page as an additional sort option alongside
the existing ones. The page passes items in and gets an ordered list back;
it reports reads back so the ranking adjusts over time.
