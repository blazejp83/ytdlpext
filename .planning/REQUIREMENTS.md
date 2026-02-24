# Requirements: ytdlext

**Defined:** 2026-02-24
**Core Value:** One-click download from the browser — no copying URLs, no switching to a terminal.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FNDTN-01**: Go companion app communicates with extension via Chrome native messaging
- [ ] **FNDTN-02**: Extension detects supported sites and shows badge/icon on toolbar
- [ ] **FNDTN-03**: Extension supports YouTube, Vimeo, Pornhub, Bandcamp, and SoundCloud

### Download

- [ ] **DL-01**: User can download best quality with one click (no config needed)
- [ ] **DL-02**: User can pick video format/quality before downloading (resolution, codec, file size)
- [ ] **DL-03**: Downloaded videos have audio and video merged automatically (no silent videos)
- [ ] **DL-04**: Downloaded files are named after the video/track title
- [ ] **DL-05**: User sees actionable error messages when downloads fail (ffmpeg missing, auth required, format unavailable)

### Audio

- [ ] **AUDIO-01**: User can extract audio as MP3 at 320kbps
- [ ] **AUDIO-02**: User can download audio in FLAC, WAV, and Ogg formats
- [ ] **AUDIO-03**: Downloaded audio files include embedded metadata (artist, album, track number)
- [ ] **AUDIO-04**: Downloaded audio files include embedded cover art thumbnail

### Progress & Notifications

- [ ] **PROG-01**: User sees real-time progress bar with download speed and ETA
- [ ] **PROG-02**: User receives Chrome notification when download completes
- [ ] **PROG-03**: User can click notification to open the containing folder

### Site Integration

- [ ] **SITE-01**: Extension injects download buttons on YouTube pages
- [ ] **SITE-02**: Extension injects download buttons on SoundCloud pages
- [ ] **SITE-03**: Extension injects download buttons on Bandcamp pages
- [ ] **SITE-04**: Bandcamp and SoundCloud default to audio-primary download UI

### Configuration

- [ ] **CFG-01**: User can set download directory in extension settings

### YouTube Enhancements

- [ ] **YT-01**: User can remove sponsor segments from YouTube downloads via SponsorBlock
- [ ] **YT-02**: User can download and embed subtitles with language selection

### Advanced

- [ ] **ADV-01**: User can download age-restricted content using browser cookies
- [ ] **ADV-02**: User can view download history in extension popup
- [ ] **ADV-03**: User can trigger download via keyboard shortcut (Ctrl+Shift+D)

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
| FNDTN-01 | — | Pending |
| FNDTN-02 | — | Pending |
| FNDTN-03 | — | Pending |
| DL-01 | — | Pending |
| DL-02 | — | Pending |
| DL-03 | — | Pending |
| DL-04 | — | Pending |
| DL-05 | — | Pending |
| AUDIO-01 | — | Pending |
| AUDIO-02 | — | Pending |
| AUDIO-03 | — | Pending |
| AUDIO-04 | — | Pending |
| PROG-01 | — | Pending |
| PROG-02 | — | Pending |
| PROG-03 | — | Pending |
| SITE-01 | — | Pending |
| SITE-02 | — | Pending |
| SITE-03 | — | Pending |
| SITE-04 | — | Pending |
| CFG-01 | — | Pending |
| YT-01 | — | Pending |
| YT-02 | — | Pending |
| ADV-01 | — | Pending |
| ADV-02 | — | Pending |
| ADV-03 | — | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 (awaiting roadmap)

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
