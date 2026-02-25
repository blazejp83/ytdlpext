---
phase: 03-site-integration-enhancements
plan: 01
subsystem: api, ui
tags: [go-ytdlp, sponsorblock, subtitles, cookies, content-script, mutation-observer]

# Dependency graph
requires:
  - phase: 02-full-download
    provides: Go download manager, service worker message routing, content script SPA detection
provides:
  - SponsorBlock removal support in download pipeline
  - Subtitle language extraction and embedding support
  - Browser cookie authentication for age-restricted content
  - Per-site download button injection (YouTube, SoundCloud, Bandcamp)
  - Quick-download message handling in service worker
affects: [03-site-integration-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-site button injection via MutationObserver, quickDownload message type]

key-files:
  created: []
  modified:
    - companion/messaging/types.go
    - companion/download/manager.go
    - companion/main.go
    - extension/content.js
    - extension/service-worker.js

key-decisions:
  - "CookiesFromBrowser uses 'chrome' on macOS/Windows, 'chromium' on Linux per runtime.GOOS"
  - "SubtitleLang type includes Auto bool to distinguish manual vs auto-generated captions"
  - "Download buttons use inline styles with no external CSS dependency for cross-site consistency"
  - "YouTube button targets #owner element; SoundCloud targets .soundActions; Bandcamp targets .tralbumCommands"
  - "Quick downloads use orange badge (DL...) to distinguish from idle blue badge (DL)"

patterns-established:
  - "Per-site injection: hostname check -> dedicated injector function with MutationObserver"
  - "quickDownload message: content script -> service worker -> native host, bypassing popup"

# Metrics
duration: 5min
completed: 2026-02-25
---

# Plan 03-01: Site Integration & Enhancements Summary

**Go companion gains SponsorBlock, subtitle, and cookie auth options; download buttons injected on YouTube, SoundCloud, and Bandcamp**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- DownloadRequest extended with SponsorBlockRemove, SubtitleLangs, EmbedSubs, and UseBrowserCookies fields
- FormatsResponse now includes available subtitle languages (manual and auto-generated) sorted alphabetically
- Download pipeline conditionally applies SponsorBlock removal, subtitle writing/embedding, and browser cookie auth
- Download buttons injected on YouTube (#owner), SoundCloud (.soundActions), and Bandcamp (.tralbumCommands) via MutationObserver
- Service worker handles quickDownload messages with badge feedback during active downloads

## Task Commits

Each task was committed atomically:

1. **Task 1: Go companion - SponsorBlock, subtitles, cookie auth support** - `3904161` (feat)
2. **Task 2: Content script download button injection + quick-download handler** - `0597a9f` (feat)

## Files Created/Modified
- `companion/messaging/types.go` - Added SubtitleLang type, 4 new DownloadRequest fields, Subtitles to FormatsResponse
- `companion/download/manager.go` - SponsorBlock/subtitle/cookie flags in runDownload, updated friendlyError message
- `companion/main.go` - Subtitle language extraction from info.Subtitles and info.AutomaticCaptions
- `extension/content.js` - Download button injection IIFE for YouTube, SoundCloud, Bandcamp
- `extension/service-worker.js` - quickDownload handler, resetDownloadBadge helper, badge on complete/error

## Decisions Made
- CookiesFromBrowser uses "chrome" on macOS/Windows, "chromium" on Linux (per runtime.GOOS)
- SubtitleLang type includes Auto bool to distinguish manual vs auto-generated captions
- Download buttons use inline styles (no external CSS dependency) for cross-site consistency
- Quick downloads show orange "DL..." badge, reset to blue "DL" on complete/error

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Go companion ready for Phase 3 plan 02 (UI integration for new options)
- Extension download buttons functional on 3 target sites
- No blockers

---
*Phase: 03-site-integration-enhancements*
*Completed: 2026-02-25*
