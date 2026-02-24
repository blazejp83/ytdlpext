---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [go, chrome-extension, native-messaging, mv3]

# Dependency graph
requires:
  - phase: none
    provides: first plan
provides:
  - Go native messaging host with ping/pong protocol
  - Chrome MV3 extension shell with site detection
  - Service worker with native host connection management
  - Content script with SPA navigation handling
  - Popup UI shell with download button
  - Install script for native host registration
affects: [01-02, 02-01]

# Tech tracking
tech-stack:
  added: [go, go-ytdlp, chrome-mv3, native-messaging]
  patterns: [length-prefixed-json, service-worker-heartbeat, content-script-spa-detection]

key-files:
  created:
    - companion/main.go
    - companion/messaging/io.go
    - companion/messaging/types.go
    - companion/host-manifest.json
    - companion/install.sh
    - extension/manifest.json
    - extension/service-worker.js
    - extension/content.js
    - extension/popup.html
    - extension/popup.js
    - extension/popup.css

key-decisions:
  - "Module name ytdlext-companion for Go binary"
  - "1MB max message size matching Chrome native messaging limit"
  - "Reconnect with max 5 attempts, 1s delay, reset on successful message"
  - "25s heartbeat interval to keep service worker alive"

patterns-established:
  - "Native messaging: 4-byte LE uint32 length prefix + JSON body"
  - "Message routing: Type field for dispatch, RawMessage Data for deferred unmarshal"
  - "Service worker: connectToHost/sendToHost pattern with reconnect"
  - "Content script: notify on load + SPA event listeners"

# Metrics
duration: 8min
completed: 2026-02-24
---

# Plan 01-01: Native Messaging + Extension Shell Summary

**Go native messaging host with ping/pong and Chrome MV3 extension detecting 5 sites with badge and popup UI**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-24
- **Completed:** 2026-02-24
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Go companion binary that speaks Chrome's native messaging protocol (4-byte LE length-prefixed JSON)
- Main loop routes ping to pong, stubs download as "not implemented", rejects unknown types
- Chrome MV3 extension with content scripts matching all 5 supported domains
- Service worker manages native host connection with reconnect logic and heartbeat keepalive
- Content script handles SPA navigation for YouTube and generic SPAs
- Popup shows page title and download button on supported sites, "not supported" otherwise
- Install script generates host manifest and registers with Chrome/Chromium

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Go native messaging host** - `1295e1f` (feat)
2. **Task 2: Build Chrome extension with site detection and popup** - `990a3f5` (feat)

## Files Created/Modified
- `companion/go.mod` - Go module definition with go-ytdlp dependency
- `companion/go.sum` - Go dependency checksums
- `companion/main.go` - Entry point with message routing loop
- `companion/messaging/io.go` - Native messaging read/write with length prefix
- `companion/messaging/types.go` - Message types, structs, and NewMessage helper
- `companion/host-manifest.json` - Template for Chrome native host registration
- `companion/install.sh` - Build + install script for Chrome/Chromium
- `extension/manifest.json` - MV3 manifest with nativeMessaging permission
- `extension/service-worker.js` - Background worker with connection management
- `extension/content.js` - Site detection with SPA navigation handling
- `extension/popup.html` - Popup markup
- `extension/popup.js` - Popup logic (page info query, download action)
- `extension/popup.css` - Popup styling (350px, system fonts, blue theme)
- `extension/icons/icon16.png` - Placeholder 16x16 blue icon
- `extension/icons/icon48.png` - Placeholder 48x48 blue icon
- `extension/icons/icon128.png` - Placeholder 128x128 blue icon

## Decisions Made
- Used `ytdlext-companion` as Go module name for clarity
- Added 1MB message size limit matching Chrome's native messaging constraint
- Service worker heartbeat at 25s interval to prevent idle shutdown during long downloads
- Reconnect logic: max 5 attempts, 1s delay, counter resets on successful message exchange
- Content script uses YouTube-specific `yt-navigate-finish` event plus generic Navigation API / popstate fallback

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Native messaging foundation ready for Plan 01-02 to add real yt-dlp download pipeline
- go-ytdlp dependency already added to go.mod
- Extension popup has status section ready for progress display
- Service worker forwards progress/complete/error messages to popup

---
*Phase: 01-foundation*
*Completed: 2026-02-24*
