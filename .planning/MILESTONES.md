# Project Milestones: ytdlext

## v1.1 Expand & Fix (Shipped: 2026-02-25)

**Delivered:** Broadened site support to 11 hostnames (ok.ru, CDA, xhamster + mirrors, redgifs) and fixed core UX issues — cancel button for in-progress downloads and history entries missing URL/title.

**Phases completed:** 4-5 (3 plans total)

**Key accomplishments:**

- Added 4 new sites (ok.ru, CDA, xhamster + mirrors, redgifs) as popup-only download targets — 11 total hostnames
- Cancellable download contexts using context.WithCancel per download with CancelAll method
- Cancel button in popup UI with full message routing (popup → service worker → companion → back)
- Fixed history entries missing URL/title after service worker restart via fallback chain

**Stats:**

- 8 files modified
- 129 lines added (2,949 LOC total)
- 2 phases, 3 plans, 6 tasks
- 1 day (same day as v1.0 ship)

**Git range:** `d90d156` → `cc68de7`

**What's next:** TBD — milestone complete, plan next iteration

---

## v1.0 MVP (Shipped: 2026-02-25)

**Delivered:** Chrome extension + Go companion app for one-click video/audio downloading from 5 supported sites via yt-dlp, with format selection, progress tracking, per-site button injection, and advanced YouTube features.

**Phases completed:** 1-3 (6 plans total)

**Key accomplishments:**

- Go native messaging companion with Chrome MV3 extension communication
- Full yt-dlp download pipeline with real-time progress streaming (speed, ETA, percentage)
- Format/quality picker with video resolution selection and audio-only extraction (MP3/FLAC/WAV/Ogg)
- Per-site download button injection on YouTube, SoundCloud, and Bandcamp via MutationObserver
- SponsorBlock removal, subtitle embedding, and cookie auth for YouTube age-restricted content
- Download history (50 entries), keyboard shortcut (Ctrl+Shift+D), and configurable download directory

**Stats:**

- 40 files created
- 2,834 lines of Go + JS + HTML + CSS
- 3 phases, 6 plans, 12 tasks
- 2 days from project init to ship

**Git range:** `bac5dec` → `19d7505`

**What's next:** TBD — milestone complete, plan next iteration

---
