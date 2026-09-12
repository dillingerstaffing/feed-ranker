#!/bin/sh
# Build dist/feed-ranker.js by concatenating the src modules in
# dependency order inside one scope. No dependencies, no bundler.
set -e
cd "$(dirname "$0")"
mkdir -p dist
{
  echo "/* feed-ranker: order feed items by predicted relevance to the reader."
  echo "   Runs in the browser. No server. No tracking. No network calls. */"
  echo "(function (root) {"
  echo "'use strict';"
  echo "var FeedRanker = {};"
  grep -h -v '^var FeedRanker' src/features.js src/profile.js src/feedback.js src/ranker.js src/blog.js src/dwell.js
  echo "root.FeedRanker = FeedRanker;"
  echo "})(typeof window !== 'undefined' ? window : globalThis);"
} > dist/feed-ranker.js
echo "wrote dist/feed-ranker.js ($(wc -c < dist/feed-ranker.js) bytes)"
# The console is a separate DOM-dependent bundle: it is not part of the
# core module, which stays runnable under node for tests.
{
  echo "/* feed-ranker console: the reader's own ranking profile, editable. */"
  cat src/console.js
} > dist/feed-ranker-console.js
echo "wrote dist/feed-ranker-console.js ($(wc -c < dist/feed-ranker-console.js) bytes)"
