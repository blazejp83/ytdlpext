---
created: 2026-02-25T17:32
title: Fix history missing video titles
area: ui
files:
  - extension/service-worker.js
  - extension/popup.js
  - companion/download/manager.go
---

## Problem

YouTube download history entries show "youtube" as the title and "." as the URL/description instead of the actual video title and URL. The v1.1 history fix added a fallback chain (companion url/title > currentDownload > empty string), but the companion-provided title for YouTube appears to be wrong — likely returning the site name or a truncated/incorrect value from yt-dlp metadata.

## Solution

Investigate what title/URL the companion sends in the DownloadComplete message for YouTube downloads. The issue is likely in how the title is extracted from yt-dlp output — may need to use the video metadata title from DumpJSON rather than relying on yt-dlp's download output. Also check if the URL being sent is the full YouTube URL or just a fragment.
