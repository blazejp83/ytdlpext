---
phase: 01-foundation
plan: 02
subsystem: download
tags: [go-ytdlp, yt-dlp, chrome-extension, progress-streaming, native-messaging]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: Native messaging host, extension shell, service worker connection
provides:
  - Go download manager using go-ytdlp with progress streaming
  - Real-time popup UI with progress bar, speed, ETA
  - Settings page for download directory configuration
  - User-friendly error messages for common yt-dlp failures
  - Thread-safe stdout writes for concurrent downloads
affects: [02-01]

# Tech tracking
tech-stack:
  added: [go-ytdlp, go-crypto, xz]
  patterns: [goroutine-download, mutex-stdout, progress-callback-to-native-msg]

key-files:
  created:
    - companion/download/manager.go
    - extension/settings.html
    - extension/settings.js
  modified:
    - companion/main.go
    - companion/go.mod
    - companion/go.sum
    - extension/service-worker.js
    - extension/popup.html
    - extension/popup.js
    - extension/popup.css
    - extension/manifest.json

key-decisions:
  - "go-ytdlp (lrstanley/go-ytdlp) as yt-dlp Go binding library"
  - "500ms progress update frequency for smooth UI without overhead"
  - "sync.Mutex for stdout serialization across download goroutines"
  - "yt-dlp availability check on startup via exec.LookPath"
  - "Download directory defaults to ~/Downloads, persisted in chrome.storage.local"
  - "30-second auto-reset for completed download state in service worker"

patterns-established:
  - "Download manager pattern: messageWriter callback for decoupled I/O"
  - "Progress pipeline: go-ytdlp callback -> messaging.ProgressUpdate -> native msg -> service worker -> popup"
  - "UI state machine: idle -> downloading -> complete/error with state restoration on popup reopen"
  - "Settings via chrome.storage.local with options_page in manifest"

# Metrics
duration: 8min
completed: 2026-02-24
---

# Plan 01-02: Download Pipeline + Progress UI Summary

**End-to-end yt-dlp download via go-ytdlp with real-time progress bar (speed/ETA) and configurable download directory**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-24
- **Completed:** 2026-02-24
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Go download manager executes yt-dlp via go-ytdlp library with goroutine-based concurrency
- Progress streams at 500ms intervals with percentage, humanized speed, and formatted ETA
- User-friendly error messages for invalid URLs, unsupported sites, missing ffmpeg, and auth-gated videos
- Popup shows live progress bar with smooth CSS transitions between idle/downloading/complete/error states
- Settings page persists download directory to chrome.storage.local
- Mutex-protected stdout writes prevent garbled output from concurrent goroutines

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement yt-dlp download handler in Go companion** - `2c82de5` (feat)
2. **Task 2: Build download UI with progress and settings page** - `5da233d` (feat)

## Files Created/Modified
- `companion/download/manager.go` - Download manager with go-ytdlp integration and progress streaming
- `companion/main.go` - Wired download handler, mutex stdout, yt-dlp availability check
- `companion/go.mod` - Added go-ytdlp dependency
- `companion/go.sum` - Dependency checksums
- `extension/service-worker.js` - Download state management with progress/complete/error routing
- `extension/popup.html` - Progress bar, completion, error, and settings UI sections
- `extension/popup.js` - Full download flow with state restoration on reopen
- `extension/popup.css` - Progress bar, completion checkmark, error styling
- `extension/settings.html` - Download directory configuration page
- `extension/settings.js` - Load/save directory to chrome.storage.local
- `extension/manifest.json` - Added options_page for settings

## Decisions Made
- Used lrstanley/go-ytdlp as the Go binding (well-maintained, fluent API, progress callbacks)
- 500ms progress update frequency balances UI smoothness with message overhead
- sync.Mutex on stdout writes (simpler than channel approach, sufficient for this use case)
- Download state auto-resets 30 seconds after completion in service worker
- Tilde expansion in Go for consistent path handling (yt-dlp also expands ~, but we expand for the completion Path field)

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
- GetExtractedInfo() returns `[]*ExtractedInfo` (slice), not a single struct -- adjusted code to index first element

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full download pipeline operational: click -> companion -> yt-dlp -> progress -> popup
- Foundation phase complete -- ready for Phase 2 (polish, error handling, format selection)
- yt-dlp and ffmpeg must be installed on user's system for downloads to work

---
*Phase: 01-foundation*
*Completed: 2026-02-24*
