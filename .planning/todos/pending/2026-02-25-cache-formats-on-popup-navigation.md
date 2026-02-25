---
created: 2026-02-25T17:25
title: Cache formats on popup navigation
area: ui
files:
  - extension/popup.js
  - extension/service-worker.js
---

## Problem

When the popup is opened and formats are loaded (queried from companion via yt-dlp), clicking History and then navigating back to the download view re-fetches formats from scratch. This is unnecessary if the user hasn't navigated away from the current page or reloaded it — the formats for that URL haven't changed.

## Solution

Cache the format query results in the popup (or service worker) keyed by URL. On popup view switch (History → back), check cache first and skip the companion round-trip if formats for the current URL are already available. Invalidate on page navigation or tab URL change.
