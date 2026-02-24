# Feature Research: yt-dlp Chrome Extension + Go Companion

Research date: 2026-02-24
Methodology: Web search across Chrome Web Store listings, user reviews, Reddit threads, yt-dlp documentation, competitor feature pages. Cross-verified across multiple sources.

---

## Table Stakes (Features users expect from any download extension)

These are non-negotiable. Users will uninstall without them.

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| **One-click download (best quality)** | Every major competitor (SaveFrom, FetchV, Video DownloadHelper) offers this. Users want zero-friction; copying URLs to a terminal is the pain point we solve. | Low | Default to `yt-dlp -f bv*+ba/b` (best video+audio merged). Companion picks format, muxes, writes file. Single button in popup/page overlay. |
| **Format/quality picker** | SaveFrom shows a dropdown on the page; FetchV shows multi-resolution list with preview; Video DownloadHelper lists all detected streams. Users expect to choose 1080p vs 720p vs 480p. | Medium | Run `yt-dlp -F --dump-json <url>` to get available formats. Parse JSON, present grouped by resolution. Must show: resolution, codec, file size estimate, fps. Merge-required formats need clear labeling. |
| **Audio-only extraction (MP3)** | Explicitly expected for music sites (Bandcamp, SoundCloud). Addoncrop SoundCloud extension and Bandcamp downloaders all offer MP3. Even on YouTube, "download as MP3" is a top search query. | Low | `yt-dlp -x --audio-format mp3 --audio-quality 0`. Also support: m4a, opus, flac for advanced users. Default to MP3 320kbps for simplicity. |
| **Real-time progress display** | FetchV shows download speed and progress bar. Users hate uncertainty during large downloads. Chrome Web Store reviews specifically complain about extensions that show no progress. | Medium | yt-dlp outputs progress to stderr: `[download] 45.2% of 150.00MiB at 5.23MiB/s ETA 00:15`. Parse this regex in the Go companion, stream via native messaging or WebSocket to extension. Display: percentage bar, speed, ETA, file size. |
| **Configurable download directory** | Standard expectation. Video DownloadHelper, FetchV, and desktop GUIs all offer this. Users want downloads in ~/Videos not a random temp dir. | Low | Store path in extension settings (chrome.storage.sync). Pass `--output <dir>/%(title)s.%(ext)s` to yt-dlp. Need a directory picker in companion (native file dialog or text input). |
| **Supported-site detection** | Extensions light up or show a badge when on a downloadable page. Video DownloadHelper icon animates; SaveFrom injects buttons directly on the page. | Low | Content scripts match against URL patterns for the 5 supported sites. Set badge text/color via chrome.action API. Can also inject download buttons into page DOM for YouTube/SoundCloud/Bandcamp. |
| **Video+audio muxing (no silent videos)** | The #1 complaint across ALL download extensions. Video Downloader Plus, Video DownloadHelper, and generic sniffers frequently produce silent video. DASH streams separate audio and video; users expect a merged file. | Low (yt-dlp handles it) | yt-dlp automatically muxes with ffmpeg. This is our biggest advantage over sniffing-based extensions. Requires ffmpeg on system. Companion should verify ffmpeg exists at startup. |
| **Filename from video title** | Users expect the downloaded file to be named after the video, not `videoplayback.mp4` or a random hash. | Low | yt-dlp default output template `%(title)s.%(ext)s` handles this. Apply `--restrict-filenames` optionally for cross-platform safety. Sanitize for OS filesystem limits. |
| **Download completion notification** | Users may switch tabs during download. Need to know when done. | Low | Chrome notifications API (`chrome.notifications.create`). Trigger on download-complete message from companion. Include filename, click-to-open-folder action. |

---

## Differentiators (Competitive advantages of yt-dlp-powered approach)

These features set us apart from sniffing-based extensions and web-based downloaders.

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| **Automatic audio/video muxing** | Sniffing extensions (FetchV, Video DownloadHelper without coapp) often produce silent video or require manual merge with ffmpeg. yt-dlp + ffmpeg handles this transparently. This solves the single most complained-about issue. | None (built into yt-dlp) | Just works. Need to document ffmpeg as a dependency. Companion checks for ffmpeg at startup and surfaces clear error if missing. |
| **True format intelligence** | yt-dlp understands each site's format hierarchy. It knows YouTube offers separate DASH streams that must be merged, Bandcamp offers FLAC/MP3/WAV natively, SoundCloud has HLS streams at various bitrates. Sniffing extensions just grab whatever network requests they see. | Low | `--dump-json` returns structured format data per-site. Present this intelligently: group video by resolution, show audio-only options separately, indicate which formats need muxing. |
| **SponsorBlock integration** | Skip/remove sponsored segments from YouTube downloads. No sniffing extension offers this. Unique to yt-dlp ecosystem. | Low | `--sponsorblock-remove sponsor,selfpromo` removes sponsor segments. `--sponsorblock-mark all` adds chapter markers. Expose as a checkbox: "Remove sponsor segments". Only shown for YouTube URLs. |
| **Subtitle download and embedding** | Download and embed subtitles directly into video file. Competitors require separate subtitle download tools. | Low | `--write-subs --embed-subs --sub-lang en`. Expose language picker in advanced options. Can auto-detect available subtitle languages from `--dump-json`. |
| **Metadata and thumbnail embedding** | Embedded metadata (title, artist, album, date) and thumbnail as cover art in the downloaded file. Critical for music (Bandcamp/SoundCloud) where files go into music libraries. | Low | `--embed-metadata --embed-thumbnail`. Always-on for audio downloads. Optional for video. Bandcamp metadata is excellent (artist, album, track number). |
| **High-quality Bandcamp downloads** | Bandcamp offers lossless FLAC, WAV, AIFF through yt-dlp that web-based downloaders cannot access (they typically only get 128kbps MP3 from the streaming preview). | Low | yt-dlp accesses the actual download URLs (not just the stream preview). Expose format picker: MP3 320, FLAC, WAV, Ogg Vorbis. Tag with full metadata. |
| **No third-party servers** | FetchV processes locally but SaveFrom routes through their servers. Many web-based downloaders (ssyoutube, y2mate) are ad-riddled and privacy-hostile. Our extension never sends URLs or data to any third party. | None (architectural) | Marketing differentiator. All processing is local: extension -> companion -> yt-dlp -> file on disk. Zero network calls except to the source site. |
| **Cookie passthrough for age-restricted content** | yt-dlp can use `--cookies-from-browser chrome` to access age-restricted or login-required content. Sniffing extensions already have cookies implicitly (they intercept browser requests), but web-based tools cannot. | Medium | Companion invokes `yt-dlp --cookies-from-browser chrome`. Needs careful UX: only offer when download fails with auth error. Privacy implications need clear communication. Chrome may lock cookie DB on some platforms. |
| **Consistent cross-site behavior** | Same UI, same format picker, same progress display across all 5 sites. Competitors like SaveFrom work well on YouTube but poorly on Vimeo; Video DownloadHelper skips YouTube entirely. | Low (architectural) | yt-dlp normalizes the interface. Our extension just passes URLs; yt-dlp handles per-site extraction. The extension UI is site-agnostic (with minor per-site customizations like showing SponsorBlock only for YouTube). |

---

## Anti-Features (Commonly requested but problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|--------------|-----------------|-------------|
| **Playlist/batch downloads** | Power users want to download entire YouTube playlists or Bandcamp albums at once. | Complexity explosion: queue management, partial failure handling, UI for 50+ simultaneous items, disk space warnings, rate limiting. YouTube actively throttles bulk downloads. | v1: Single-item only. v2+: Consider queue with sequential downloads and basic playlist support. |
| **Automatic yt-dlp updates** | Users want "set and forget". yt-dlp updates frequently to keep up with site changes. | Companion would need write access to system PATH, admin/sudo privileges, signature verification. Update failures could break the entire tool. Platform-specific package managers (brew, scoop, pip) already handle this. | Show "yt-dlp outdated" warning in extension when companion detects old version. Link to update instructions. |
| **Browser downloads integration** | Users want downloads to appear in Chrome's download shelf/manager for consistency. | Chrome downloads API requires the extension to provide a URL to download. yt-dlp writes files directly to disk (it handles its own HTTP, muxing, conversion). Bridging these models is architecturally awkward and loses progress streaming. | Show our own download manager in the popup/side panel. Offer "Open in folder" when complete. |
| **In-browser video conversion** | Users want to convert downloaded files to different formats after download (e.g., MKV to MP4). | Post-download conversion is a separate concern. Would require ffmpeg invocation, large temp file handling, and a full transcoding UI. Scope creep. | Offer format selection before download (yt-dlp can remux with `--remux-video mp4`). Cover 90% of use cases pre-download. |
| **Cloud/remote downloads** | Users want to download to Google Drive, Dropbox, or a remote NAS. | Requires cloud API integration, OAuth flows, upload progress tracking, network reliability handling. Completely different architecture. | Local downloads only. Users can set download directory to a cloud-synced folder (e.g., ~/Dropbox/Downloads). |
| **Download from any site** | Users want generic "download any video on any page" capability. | Generic video sniffing is unreliable (the exact problem competitors have). yt-dlp supports 1800+ sites but many have spotty support. Promising "any site" and failing is worse than scoping to 5 reliable sites. | Clearly communicate supported sites. Consider expanding curated site list over time (Reddit, Twitter/X, Instagram as v2 candidates). |
| **Built-in media player/preview** | Some extensions (FetchV) offer media preview before download. | Adds significant UI complexity. Browser already plays videos on the page. Preview adds memory overhead. | Show thumbnail and metadata (title, duration, resolution) in the popup. User is already watching the video on the page. |
| **Ad/tracker blocking during download** | Users assume download tools also block ads on the source page. | Out of scope; separate concern handled by uBlock Origin etc. Implementing this invites cat-and-mouse with ad networks. | Not our problem. Recommend users install an ad blocker separately. |

---

## Feature Dependencies

```
                    +-----------------------+
                    |  Chrome Extension     |
                    |  (Manifest V3)        |
                    +-----------+-----------+
                                |
                    Native Messaging / WebSocket
                                |
                    +-----------v-----------+
                    |  Go Companion App     |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |  yt-dlp (subprocess)  |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |  ffmpeg (for muxing/  |
                    |  conversion/extract)  |
                    +-----------------------+

Feature Dependency Graph:

  Site Detection ──> Badge/Icon Update
        |
        v
  URL Extraction ──> Format Listing ──> Format Picker UI
        |                  |                    |
        v                  v                    v
  One-Click Download    Quality Info       User Selection
        |                  |                    |
        +--------+---------+--------------------+
                 |
                 v
        Download Execution (yt-dlp)
                 |
        +--------+--------+
        |                 |
        v                 v
  Progress Parsing    Muxing/Convert
        |              (ffmpeg)
        v                 |
  Progress UI             v
  (bar, speed,      File Written
   ETA)                   |
        |                 v
        v           Completion
  Live Updates      Notification
                         |
                         v
                   Open in Folder

Audio-Specific Flow (Bandcamp/SoundCloud):

  Site Detection ──> Audio-Primary UI
        |                  |
        v                  v
  Format Listing     Format Picker
  (MP3/FLAC/WAV/     (audio formats
   Ogg/ALAC)          only, bitrate)
        |                  |
        +--------+---------+
                 |
                 v
        Audio Extraction (yt-dlp -x)
                 |
                 v
        Metadata + Thumbnail Embed
        (--embed-metadata --embed-thumbnail)
                 |
                 v
        File Written ──> Notification

Optional Feature Dependencies:

  SponsorBlock ──> requires: YouTube URL detection
  Subtitles    ──> requires: Format listing (to get available languages)
  Cookie Auth  ──> requires: Download failure detection, user consent flow
```

---

## MVP Definition

### v1.0 — Core Download Experience

Ship this first. Validates core value proposition: "one-click download from browser, no terminal needed."

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Go companion with native messaging | P0 | High | Foundation. Manages yt-dlp subprocess, streams progress, handles file output. Must register as native messaging host on install. |
| Site detection (5 sites) | P0 | Low | Content scripts with URL pattern matching. Badge update on supported pages. |
| One-click best-quality download | P0 | Medium | Default format selection. Button in popup triggers download. Companion picks best format per yt-dlp defaults. |
| Format/quality picker | P0 | Medium | Run `yt-dlp --dump-json`, parse formats, present in popup dropdown. Group: video (by resolution), audio-only. Show file size estimates. |
| Audio-only MP3 extraction | P0 | Low | `-x --audio-format mp3 --audio-quality 0`. Prominent option for Bandcamp/SoundCloud. Also available for YouTube/Vimeo. |
| Real-time progress display | P0 | Medium | Parse yt-dlp stderr progress lines. Stream to extension via native messaging. Render progress bar, speed, ETA in popup. |
| Download directory config | P0 | Low | Settings page with path input. Stored in chrome.storage.sync. Passed as `--output` to yt-dlp. |
| Automatic muxing (silent) | P0 | None | yt-dlp + ffmpeg handles this. Companion checks for ffmpeg at startup. |
| Download complete notification | P1 | Low | Chrome notifications API. Click action opens containing folder. |
| Error handling and display | P0 | Medium | Surface yt-dlp errors in UI. Common: "ffmpeg not found", "format not available", "video unavailable", "sign-in required". Actionable error messages. |

### v1.x — Polish and Power Features

After v1.0 is stable and validated with users.

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Subtitle download/embed | P1 | Low | `--write-subs --embed-subs`. Language picker from available subs in `--dump-json` output. |
| SponsorBlock removal | P1 | Low | `--sponsorblock-remove sponsor`. Checkbox in YouTube download UI. |
| Metadata + thumbnail embed | P1 | Low | `--embed-metadata --embed-thumbnail`. Always-on for audio, toggle for video. |
| Download history | P2 | Medium | Store completed downloads in chrome.storage.local. List view in popup: thumbnail, title, date, file path. Cap at 100 entries. |
| Filename template config | P2 | Low | Advanced setting: `%(title)s.%(ext)s` default, allow `%(uploader)s - %(title)s.%(ext)s` etc. |
| In-page download buttons | P2 | Medium | Content scripts inject download buttons directly into YouTube, SoundCloud, Bandcamp pages (like SaveFrom does). Requires per-site DOM knowledge, fragile to site redesigns. |
| Dark mode / theme support | P3 | Low | CSS variables. Follow `prefers-color-scheme`. |
| Keyboard shortcuts | P3 | Low | `chrome.commands` API. Ctrl+Shift+D for quick download. |
| Advanced audio format options | P2 | Low | Expose FLAC, WAV, Ogg, ALAC, M4A in format picker. Bitrate selection for MP3 (128/192/256/320). Relevant for Bandcamp/SoundCloud power users. |
| Cookie-based auth for restricted content | P2 | Medium | `--cookies-from-browser chrome`. Triggered on auth failure. Needs user consent dialog. Platform-specific cookie DB access issues. |

### v2+ — Expansion

Only after core is rock-solid.

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Additional sites (Reddit, Twitter/X, Instagram, Twitch, Dailymotion) | P2 | Low per site | yt-dlp already supports these. Just add URL patterns and test. |
| Queue / sequential multi-download | P2 | High | Download queue UI, retry logic, partial failure handling. Prerequisite for playlist support. |
| Basic playlist support | P3 | High | Album download for Bandcamp, playlist for YouTube. Needs queue system first. Per-track progress, total progress. |
| Remux options (MKV to MP4, etc.) | P3 | Low | `--remux-video mp4`. Dropdown in format picker. |
| yt-dlp version check + update prompt | P2 | Medium | Companion checks yt-dlp version, compares to latest release via GitHub API. Shows banner if outdated. Does NOT auto-update. |
| Speed/bandwidth limiting | P3 | Low | `--limit-rate 500K`. Settings option. Useful for users on metered connections. |
| Custom yt-dlp arguments (advanced) | P3 | Low | Text field in advanced settings for power users to pass arbitrary yt-dlp flags. Dangerous but requested by power users. |

---

## Feature Prioritization Matrix

```
                    HIGH VALUE
                        |
    SponsorBlock        |  One-Click Download
    Subtitle Embed      |  Format Picker
    Cookie Auth         |  Progress Display
    Download History    |  Audio Extraction
                        |  Site Detection
                        |  Muxing (auto)
                        |  Download Dir Config
                        |  Error Handling
                        |  Notifications
   ─────────────────────+──────────────────────
    Bandwidth Limit     |  Metadata Embed
    Custom yt-dlp Args  |  Thumbnail Embed
    Remux Options       |  Filename Template
    Dark Mode           |  Keyboard Shortcuts
    In-page Buttons     |
                        |
                    LOW VALUE

        HIGH EFFORT ────────── LOW EFFORT
```

Note: "Muxing" is listed as high-value/low-effort because yt-dlp handles it automatically. It is our single biggest advantage over competitors and costs us nothing to implement.

---

## Competitor Feature Analysis

| Feature | Video DownloadHelper | SaveFrom | FetchV | Addoncrop | **ytdlext (planned)** |
|---------|---------------------|----------|--------|-----------|----------------------|
| **YouTube support** | No (Chrome policy) | Yes (external) | No (Chrome policy) | Yes (external) | Yes (companion bypasses Chrome restriction) |
| **One-click download** | Yes | Yes | Yes | Yes | Yes (v1.0) |
| **Format/quality picker** | Yes (stream list) | Yes (dropdown) | Yes (multi-res) | Yes (dropdown) | Yes (v1.0, grouped by resolution) |
| **Audio extraction** | Yes (with coapp) | Limited | No | Yes (MP3) | Yes (v1.0, MP3/FLAC/WAV) |
| **Progress display** | Basic | No | Yes (speed+progress) | No | Yes (v1.0, bar+speed+ETA) |
| **Auto muxing** | Yes (with coapp) | No | No | No | Yes (v1.0, always) |
| **Subtitle embed** | No | No | No | No | Yes (v1.x) |
| **SponsorBlock** | No | No | No | No | Yes (v1.x) |
| **Metadata embed** | No | No | No | ID3 tags | Yes (v1.x, full metadata) |
| **Companion app required** | Yes (coapp) | No (but limited) | No | No | Yes (Go binary) |
| **Privacy (no 3rd party)** | Yes (local) | No (routes through servers) | Yes (local) | Unclear | Yes (fully local) |
| **Sites supported** | 1000+ (no YT on Chrome) | 40+ | Generic (standards-based) | YouTube-focused | 5 (curated, reliable) |
| **Lossless audio** | No | No | No | No | Yes (FLAC, WAV via Bandcamp) |
| **Age-restricted content** | No | No | No | No | Yes (v1.x, cookie auth) |
| **Price** | Free (limits) / $28.50 license | Free (limits) / Premium | Free | Free (limits) | Free (open source) |
| **Companion install friction** | High (many complaints) | None | None | None | Medium (Go binary, must reduce) |

### Key Competitive Insights

1. **YouTube on Chrome is the elephant in the room.** Chrome Web Store policy prohibits YouTube download extensions. Video DownloadHelper and FetchV do not work on YouTube in Chrome. SaveFrom and Addoncrop work via external sites/workarounds. Our companion app architecture bypasses this entirely because the extension just sends a URL to a local process -- no Chrome policy violation for the extension itself, as the extension does not download the video.

2. **Silent video is the #1 pain point.** Across reviews for Video Downloader Plus, Video DownloadHelper, and generic sniffers, "no sound" is the most frequent complaint. yt-dlp + ffmpeg solves this automatically. This is our strongest differentiator with zero implementation cost.

3. **Companion app friction is real.** Video DownloadHelper's CoApp has extensive documentation for troubleshooting recognition failures, antivirus blocking, and platform-specific issues. Our Go companion must have: (a) dead-simple installer, (b) clear first-run setup in the extension, (c) excellent error messages when companion is unreachable.

4. **Privacy matters.** SaveFrom routing through third-party servers is a common complaint. Web-based downloaders (y2mate, ssyoutube) are ad-riddled. Our local-only architecture is a genuine differentiator worth marketing.

5. **Music site users want quality.** Bandcamp fans specifically seek FLAC downloads. SoundCloud users want 320kbps MP3 minimum. Most extensions only offer low-quality stream rips. yt-dlp accesses actual download endpoints, not just streaming previews.

---

## Sources

### High Confidence (primary sources, multiple corroborations)

- [Video DownloadHelper Chrome Web Store listing](https://chromewebstore.google.com/detail/video-downloadhelper/lmjnegcaeklhafolokijcfjliaokphfk) - Feature list, ratings, limitations confirmed across multiple review sites
- [Video DownloadHelper official site](https://www.downloadhelper.net/) - CoApp architecture, supported formats
- [FetchV official site](https://fetchv.net/) - Multi-threading, recording mode, privacy claims
- [yt-dlp GitHub repository](https://github.com/yt-dlp/yt-dlp) - Format selection, postprocessors, SponsorBlock, metadata, output templates, cookies-from-browser
- [yt-dlp PyPI page](https://pypi.org/project/yt-dlp/) - Feature list, supported audio formats for extraction
- [Chrome Native Messaging documentation](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) - Architecture, message size limits, connection management
- [Bandcamp Help Center - download formats](https://get.bandcamp.help/hc/en-us/articles/23020648367255) - Official format list: MP3 V0, MP3 320, FLAC, AAC, Ogg, ALAC, WAV, AIFF
- [Video DownloadHelper CoApp issues (Google Groups)](https://groups.google.com/g/video-downloadhelper-q-and-a/c/yzMRcVPDAJc) - Installation and recognition failures documented by users
- [Video DownloadHelper CoApp GitHub wiki](https://github.com/aclap-dev/vdhcoapp) - Open-source companion, platform-specific issues

### Medium Confidence (aggregated reviews, may reflect bias)

- [Wondershare Best Video Downloader Guide 2026](https://videoconverter.wondershare.com/video-converters/download-video-chrome-extension.html) - Competitor comparison, feature expectations
- [SaveFrom.net Helper Softonic page](https://savefrom-net-helper.en.softonic.com/) - Feature overview, limitations
- [Chrome-stats.com extension analytics](https://chrome-stats.com/d/nfmmmhanepmpifddlkkmihkalkoekpfd) - FetchV usage data, ratings
- [Cisdem Top 10 Video Downloader Extensions](https://www.cisdem.com/resource/video-downloader-chrome.html) - Common complaints across extensions
- [Hollyland "9 Fixes to Video Downloader Plus No Sound"](https://www.hollyland.com/blog/tips/video-downloader-plus-no-sound) - Documents the silent video problem extensively
- [Addoncrop YouTube Downloader](https://addoncrop.com/v27/youtube-downloader/) and [SoundCloud Downloader](https://addoncrop.com/exension/soundcloud-music-downloader/) - Feature lists, ID3 tag support, dark mode
- [BrightCoding GUI front-ends guide 2025](https://www.blog.brightcoding.dev/2025/12/06/the-ultimate-guide-to-gui-front-ends-for-youtube-dl-yt-dlp-download-videos-like-a-pro-2025-edition/) - Desktop GUI comparison showing market expectations
- [RapidSeedbox yt-dlp Complete Guide 2026](https://www.rapidseedbox.com/blog/yt-dlp-complete-guide) - yt-dlp capabilities, format selection syntax

### Lower Confidence (single source, potentially outdated)

- [sf-helper.net SaveFrom features](https://sf-helper.net/) - Self-reported features, may overstate capabilities
- [yt-dlp-cbuilder Chrome extension](https://chromewebstore.google.com/detail/yt-dlp-cbuilder-chrome-ex/goajopknohinlcjdkdnlanimiplmdeeg) - Niche extension, limited user base
- [NoteBurner Bandcamp Downloaders 2026](https://www.noteburner.com/topic-tips/top-bandcamp-music-downloader.html) - Promotional content mixed with genuine comparison
- [AudiFab SoundCloud Downloaders](https://www.audifab.com/topics/best-soundcloud-to-mp3-downloader.html) - Promotional but useful for feature expectations
- [FastestTube merge guide](https://kwizzu.com/construct.html) - Documents manual muxing workflow users currently endure
