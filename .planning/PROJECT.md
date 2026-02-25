# ytdlext

## What This Is

A Chrome extension with a Go companion app that downloads videos and audio from supported sites using yt-dlp. Click a button on any supported page — or use the injected per-site button or Ctrl+Shift+D — to download in your preferred format with real-time progress, or let it pick the best quality automatically.

## Core Value

One-click download from the browser — no copying URLs, no switching to a terminal.

## Requirements

### Validated

- ✓ Chrome extension detects supported sites and shows download action — v1.0
- ✓ Go companion app that manages yt-dlp execution and streams progress — v1.0
- ✓ One-click "best quality" default download — v1.0
- ✓ Format/quality picker (video resolutions, audio-only) — v1.0
- ✓ Audio-only extraction (MP3/FLAC/WAV/Ogg) as format options — v1.0
- ✓ Real-time download progress display (progress bar, speed, ETA) — v1.0
- ✓ Configurable download directory via extension settings — v1.0
- ✓ Support for: YouTube, Vimeo, Pornhub, Bandcamp, SoundCloud — v1.0
- ✓ Per-site download button injection (YouTube, SoundCloud, Bandcamp) — v1.0
- ✓ SponsorBlock removal for YouTube — v1.0
- ✓ Subtitle embedding for YouTube — v1.0
- ✓ Cookie-based auth for age-restricted content — v1.0
- ✓ Download history (50 entries) — v1.0
- ✓ Keyboard shortcut Ctrl+Shift+D — v1.0
- ✓ Support for: ok.ru, CDA, xhamster (+ mirrors), redgifs — v1.1
- ✓ Cancel in-progress downloads from popup — v1.1
- ✓ Reliable history entries with URL/title fallback — v1.1

### Active

(None — planning next milestone)

### Out of Scope

- Playlist/batch downloads — complexity explosion, start with single items
- Browser downloads integration — yt-dlp handles file writing directly
- Automatic yt-dlp updates — user manages their own yt-dlp install
- Cloud/remote downloads — local only
- Per-site button injection for new sites — popup-only is sufficient for ok.ru, CDA, xhamster, redgifs

## Context

Shipped v1.1 with 2,949 LOC across Go + JS + HTML + CSS.
Tech stack: Go (companion), Chrome MV3 (extension), go-ytdlp (yt-dlp binding), native messaging protocol.
5 phases, 9 plans, 18 tasks completed across v1.0 and v1.1.
11 supported hostnames: YouTube, Vimeo, Pornhub, Bandcamp, SoundCloud, ok.ru, CDA, xhamster (3 domains), redgifs.
Per-site button injection on YouTube, SoundCloud, and Bandcamp; popup-only for remaining sites.
Cancel support with context-based cancellation and optimistic UI reset.

## Constraints

- **Runtime**: Requires yt-dlp installed locally on user's system
- **Platform**: Chrome/Chromium browsers (Manifest V3)
- **Companion**: Go binary — user runs it as a background service or it auto-starts
- **Communication**: Extension ↔ companion via native messaging with 4-byte LE length prefix

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Go for companion app | Easy single-binary distribution, good concurrency for progress streaming | ✓ Good |
| Multi-site from the start | User wants YouTube, Vimeo, Pornhub, Bandcamp, SoundCloud | ✓ Good |
| yt-dlp as subprocess via go-ytdlp | Go binding avoids embedding Python, fluent API | ✓ Good |
| Native messaging protocol | 4-byte LE uint32 length prefix + JSON body, Chrome standard | ✓ Good |
| 25s heartbeat interval | Keeps MV3 service worker alive during long downloads | ✓ Good |
| 500ms progress update frequency | Smooth UI without message overhead | ✓ Good |
| sync.Mutex for stdout | Simpler than channels, sufficient for concurrent downloads | ✓ Good |
| DumpJSON() for format querying | Returns per-URL JSON with formats array | ✓ Good |
| Video format deduplication (h264/avc) | Broader browser/device compatibility | ✓ Good |
| Per-site MutationObserver injection | Reliable button placement across SPA navigations | ✓ Good |
| Download history 50-entry cap | Prevents unbounded storage growth | ✓ Good |
| CookiesFromBrowser: chrome/chromium | Platform-appropriate browser cookie source | ✓ Good |
| Popup-only for new sites | No injected buttons needed for ok.ru, CDA, xhamster, redgifs | ✓ Good |
| context.WithCancel for downloads | Clean cancellation vs process killing | ✓ Good |
| Optimistic cancel UI | Reset immediately on cancel, don't wait for companion | ✓ Good |
| History fallback chain | companion url/title > currentDownload > empty string | ✓ Good |

---
*Last updated: 2026-02-25 after v1.1 milestone*
