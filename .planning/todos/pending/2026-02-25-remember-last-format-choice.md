---
created: 2026-02-25T17:28
title: Remember last format choice
area: ui
files:
  - extension/popup.js
---

## Problem

The format picker always defaults to "Best Quality" when opening the popup. Users who consistently pick a specific resolution (e.g. 1920x1080) have to reselect it every time. The last chosen format should be remembered and preselected if available.

## Solution

Store the last selected format resolution (e.g. "1920x1080") in chrome.storage.local. On popup open, after formats load, check if a format matching that resolution exists in the list (ignore codec differences). If found, preselect it. If not available (e.g. max is 720p), fall back to "Best Quality". Match by resolution string rather than exact format ID since codecs vary across sites/videos.
