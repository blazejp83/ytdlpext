# Requirements: ytdlext

**Defined:** 2026-02-24
**Core Value:** One-click download from the browser — no copying URLs, no switching to a terminal.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FNDTN-01**: Go companion app communicates with extension via Chrome native messaging
- [x] **FNDTN-02**: Extension detects supported sites and shows badge/icon on toolbar
- [x] **FNDTN-03**: Extension supports YouTube, Vimeo, Pornhub, Bandcamp, and SoundCloud

### Download

- [x] **DL-01**: User can download best quality with one click (no config needed)
- [x] **DL-02**: User can pick video format/quality before downloading (resolution, codec, file size)
- [x] **DL-03**: Downloaded videos have audio and video merged automatically (no silent videos)
- [x] **DL-04**: Downloaded files are named after the video/track title
- [x] **DL-05**: User sees actionable error messages when downloads fail (ffmpeg missing, auth required, format unavailable)

### Audio

- [x] **AUDIO-01**: User can extract audio as MP3 at 320kbps
- [x] **AUDIO-02**: User can download audio in FLAC, WAV, and Ogg formats
- [x] **AUDIO-03**: Downloaded audio files include embedded metadata (artist, album, track number)
- [x] **AUDIO-04**: Downloaded audio files include embedded cover art thumbnail

### Progress & Notifications

- [x] **PROG-01**: User sees real-time progress bar with download speed and ETA
- [x] **PROG-02**: User receives Chrome notification when download completes
- [x] **PROG-03**: User can click notification to open the containing folder

### Site Integration

- [x] **SITE-01**: Extension injects download buttons on YouTube pages
- [x] **SITE-02**: Extension injects download buttons on SoundCloud pages
- [x] **SITE-03**: Extension injects download buttons on Bandcamp pages
- [x] **SITE-04**: Bandcamp and SoundCloud default to audio-primary download UI

### Configuration

- [x] **CFG-01**: User can set download directory in extension settings

### YouTube Enhancements

- [x] **YT-01**: User can remove sponsor segments from YouTube downloads via SponsorBlock
- [x] **YT-02**: User can download and embed subtitles with language selection

### Advanced

- [x] **ADV-01**: User can download age-restricted content using browser cookies
- [x] **ADV-02**: User can view download history in extension popup
- [x] **ADV-03**: User can trigger download via keyboard shortcut (Ctrl+Shift+D)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Configuration

- **CFG-02**: User can customize filename output template

### UX Polish

- **UX-01**: Extension supports dark mode / follows system theme

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Playlist/batch downloads | Complexity explosion: queue management, partial failures, rate limiting |
| Automatic yt-dlp updates | Needs admin privileges, platform-specific package managers handle this |
| Browser downloads integration | Architectural mismatch — yt-dlp writes files directly |
| Cloud/remote downloads | Completely different architecture, local only |
| Download from any site | Unreliable; better to curate 5 reliable sites |
| In-browser video conversion | Scope creep; format selection pre-download covers 90% of use cases |
| Built-in media player/preview | Browser already plays video on page; adds memory overhead |
| Ad/tracker blocking | Separate concern handled by uBlock Origin etc. |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDTN-01 | Phase 1 | Complete |
| FNDTN-02 | Phase 1 | Complete |
| FNDTN-03 | Phase 1 | Complete |
| DL-01 | Phase 1 | Complete |
| DL-02 | Phase 2 | Complete |
| DL-03 | Phase 2 | Complete |
| DL-04 | Phase 2 | Complete |
| DL-05 | Phase 2 | Complete |
| AUDIO-01 | Phase 2 | Complete |
| AUDIO-02 | Phase 2 | Complete |
| AUDIO-03 | Phase 2 | Complete |
| AUDIO-04 | Phase 2 | Complete |
| PROG-01 | Phase 1 | Complete |
| PROG-02 | Phase 2 | Complete |
| PROG-03 | Phase 2 | Complete |
| SITE-01 | Phase 3 | Complete |
| SITE-02 | Phase 3 | Complete |
| SITE-03 | Phase 3 | Complete |
| SITE-04 | Phase 3 | Complete |
| CFG-01 | Phase 1 | Complete |
| YT-01 | Phase 3 | Complete |
| YT-02 | Phase 3 | Complete |
| ADV-01 | Phase 3 | Complete |
| ADV-02 | Phase 3 | Complete |
| ADV-03 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-25 after Phase 3 completion*
