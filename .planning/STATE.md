# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** One-click download from the browser -- no copying URLs, no switching to a terminal.
**Current focus:** Phase 2 in progress -- companion backend features complete, extension UI next

## Current Position

Phase: 2 of 3 (Full Download) -- IN PROGRESS
Plan: 02-01 complete (companion format query, audio extraction, enhanced downloads)
Status: Phase 2 plan 01 complete, plans 02+ pending
Last activity: 2026-02-24 -- Plan 02-01 complete (format querying, audio extraction, folder opening)

Progress: #####░░░░░ 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 7 min
- Total execution time: ~0.37 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2/2 | 16 min | 8 min |
| 02-full-download | 1/? | 6 min | 6 min |

**Recent Trend:**
- Last 5 plans: 01-01 (8 min), 01-02 (8 min), 02-01 (6 min)
- Trend: Improving, 6 min latest

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-24
Stopped at: Plan 02-01 complete (companion backend for Phase 2)
Resume file: .planning/phases/02-full-download/02-01-SUMMARY.md
