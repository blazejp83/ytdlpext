---
phase: 08-history-title-fix
plan: 01
subsystem: ui
tags: [yt-dlp, go-ytdlp, native-messaging, chrome-extension]

# Dependency graph
requires:
  - phase: 05-cancel-fix-history
    provides: download history storage in chrome.storage.local
provides:
  - correct video title and filename in DownloadComplete messages
  - defensive "." filename handling in service worker
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Guard filepath.Base on empty string to avoid "." artifact

key-files:
  created: []
  modified:
    - companion/download/manager.go
    - extension/service-worker.js

key-decisions:
  - "Use PrintJSON() not DumpJSON() for download path -- PrintJSON maps to --print-json which outputs metadata after download completes, while DumpJSON would dump without downloading"
  - "Defensive guard in both companion and service worker for belt-and-suspenders reliability"

patterns-established:
  - "Empty filename guard: check before filepath.Base to avoid dot artifact"

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 8: History Title Fix Summary

**Enable yt-dlp JSON metadata output during downloads so history entries display actual video title and filename instead of garbage values**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `.PrintJSON()` to download command chain enabling `GetExtractedInfo()` to return proper title and filename metadata
- Guarded empty filename in companion to prevent `filepath.Base("")` returning `"."` in DownloadComplete messages
- Added defensive `"."` filename check in service worker complete handler for backward compatibility with older companion binaries

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PrintJSON to download command and guard empty values** - `5646277` (fix)
2. **Task 2: Add defensive filename guard in service worker** - `37a1109` (fix)

## Files Created/Modified
- `companion/download/manager.go` - Added `.PrintJSON()` to command chain; guarded empty filename before `filepath.Base()`
- `extension/service-worker.js` - Treat `"."` filename as empty in complete handler, falling through to progress filename

## Decisions Made
- Used `PrintJSON()` (maps to `--print-json`) rather than `DumpJSON()` -- `PrintJSON` outputs metadata after download completes, while `DumpJSON` dumps info without downloading. The format query path already uses `DumpJSON` correctly.
- Applied defensive guard in both companion (empty string check) and service worker ("." check) for belt-and-suspenders reliability across binary version mismatches.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- History entries will now display correct video title and filename after rebuilding the companion binary
- All pending todos for v1.2 UI Polish milestone are complete

---
*Phase: 08-history-title-fix*
*Completed: 2026-02-25*
