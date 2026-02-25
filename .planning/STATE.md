# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** One-click download from the browser -- no copying URLs, no switching to a terminal.
**Current focus:** Phase 3 in progress -- Site Integration + Enhancements

## Current Position

Phase: 3 of 3 (Site Integration + Enhancements) -- IN PROGRESS
Plan: 03-01 complete (Go companion SponsorBlock/subtitles/cookies + per-site download buttons)
Status: Phase 3 plan 1 of 2 done
Last activity: 2026-02-25 -- Plan 03-01 complete

Progress: #########░ 90%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 6 min
- Total execution time: ~0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2/2 | 16 min | 8 min |
| 02-full-download | 2/2 | ~12 min | ~6 min |
| 03-site-integration-enhancements | 1/2 | 5 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-02 (8 min), 02-01 (6 min), 02-02 (~6 min), 03-01 (5 min)
- Trend: Stable ~5-6 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Go module name: `ytdlext-companion`
- Native messaging: 4-byte LE uint32 length prefix + JSON body
- Message envelope: `Type` string for routing, `Data` as json.RawMessage for deferred unmarshal
- Service worker heartbeat: 25s interval to keep alive during downloads
- Reconnect logic: max 5 attempts, 1s delay, reset on success
- Content script SPA detection: YouTube `yt-navigate-finish` + Navigation API + popstate/hashchange fallback
- go-ytdlp (lrstanley/go-ytdlp) as yt-dlp Go binding library
- 500ms progress update frequency for smooth UI without overhead
- sync.Mutex for stdout serialization across download goroutines
- Download directory defaults to ~/Downloads, persisted in chrome.storage.local
- yt-dlp availability check on startup via exec.LookPath
- DumpJSON() for format querying (returns per-URL JSON with formats array)
- Video format deduplication: same height+fps keeps h264/avc for compatibility
- Audio quality: AudioQuality("0") for MP3 best VBR, omit for lossless
- Format merge: FormatID+bestaudio/FormatID with MergeOutputFormat(mp4)
- Platform folder open: xdg-open (Linux), open (macOS), explorer (Windows)
- CookiesFromBrowser: "chrome" on macOS/Windows, "chromium" on Linux (runtime.GOOS)
- SubtitleLang type with Auto bool for manual vs auto-generated distinction
- Per-site button injection via MutationObserver (YouTube #owner, SoundCloud .soundActions, Bandcamp .tralbumCommands)
- quickDownload message type: content script -> service worker -> native host, bypassing popup
- Orange "DL..." badge for active quick downloads, reset to blue "DL" on complete/error

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Plan 03-01 complete, ready for plan 03-02
Resume file: .planning/phases/03-site-integration-enhancements/03-01-SUMMARY.md
