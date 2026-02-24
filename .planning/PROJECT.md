# ytdlext

## What This Is

A Chrome extension with a Go companion app that downloads videos and audio from supported sites using yt-dlp. Click a button on any supported page to download in your preferred format, or let it pick the best quality automatically.

## Core Value

One-click download from the browser — no copying URLs, no switching to a terminal.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Chrome extension detects supported sites and shows download action
- [ ] Go companion app that manages yt-dlp execution and streams progress
- [ ] One-click "best quality" default download
- [ ] Format/quality picker (video resolutions, audio-only MP3)
- [ ] Audio-only extraction (MP3) as a format option
- [ ] Real-time download progress display (progress bar, speed, ETA)
- [ ] Configurable download directory via extension settings
- [ ] Support for: YouTube, Vimeo, Pornhub, Bandcamp, SoundCloud

### Out of Scope

- Playlist/batch downloads — complexity explosion, start with single items
- Browser downloads integration — yt-dlp handles file writing directly
- Automatic yt-dlp updates — user manages their own yt-dlp install
- Cloud/remote downloads — local only
- Sites beyond the initial five — can expand later

## Context

- yt-dlp is a CLI tool; it cannot run in the browser. A local companion bridges the gap.
- Go companion will shell out to the user's installed yt-dlp binary.
- Communication between extension and companion needs to support streaming progress updates (WebSocket or native messaging).
- Bandcamp and SoundCloud are primarily audio sites — audio-only download is the natural default there.
- The extension needs content scripts or page action detection to know when the user is on a supported site.

## Constraints

- **Runtime**: Requires yt-dlp installed locally on user's system
- **Platform**: Chrome/Chromium browsers (Manifest V3)
- **Companion**: Go binary — user runs it as a background service or it auto-starts
- **Communication**: Extension ↔ companion must support progress streaming

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Go for companion app | Easy single-binary distribution, good concurrency for progress streaming | — Pending |
| Multi-site from the start | User wants YouTube, Vimeo, Pornhub, Bandcamp, SoundCloud | — Pending |
| yt-dlp as subprocess (not library) | Go shells out to yt-dlp CLI; avoids embedding Python | — Pending |

---
*Last updated: 2026-02-24 after initialization*
