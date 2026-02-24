# Project Research Summary

**Project:** ytdlext
**Domain:** Chrome Extension + Go Native Companion (yt-dlp download utility)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

ytdlext sits in a well-established domain — browser video download extensions — but with a significant architectural advantage: a Go native companion app that delegates to yt-dlp, bypassing the limitations that plague sniffing-based competitors. The research reveals that native messaging (not WebSocket) is the correct communication pattern, that automatic audio/video muxing is the single biggest competitive differentiator (solving the #1 user complaint across all competing extensions), and that companion app installation friction is the greatest adoption risk.

The recommended stack is lean: Chrome Manifest V3 with vanilla TypeScript + esbuild for the extension, Go with `go-ytdlp` and `qrtz/nativemessaging` for the companion, and Chrome's native messaging protocol (`connectNative`) for communication. No frameworks needed — the extension UI is small enough that vanilla TS with DOM manipulation is sufficient. The native messaging approach is strongly preferred over WebSocket because `connectNative()` keeps the MV3 service worker alive during downloads (Chrome 105+), Chrome manages the companion process lifecycle, and there's no localhost port exposure.

The critical risks are: (1) MV3 service worker lifecycle killing downloads mid-stream (requires heartbeat protocol from day one), (2) cross-platform native messaging host registration failures (the #1 support burden for all native messaging extensions), (3) yt-dlp progress output buffering defeating real-time streaming (requires `stdbuf -oL` or pty), and (4) Chrome Web Store rejection for download extensions (requires careful permission scoping and generic listing language).

## Key Findings

### Recommended Stack

The stack is split between the Chrome extension (TypeScript) and the Go companion.

**Core technologies:**
- **Go 1.23+**: Companion app — single static binary, no runtime deps, excellent subprocess management
- **Chrome Manifest V3** (min Chrome 116): Extension platform — required for Web Store, 116+ needed for side panel + native messaging keepalive
- **TypeScript 5.x + esbuild**: Extension source — type safety at zero runtime cost, fastest bundler (<50ms builds)
- **go-ytdlp v1.3.1** (`github.com/lrstanley/go-ytdlp`): yt-dlp CLI bindings with auto-install of yt-dlp/ffmpeg binaries, type-safe flag API
- **qrtz/nativemessaging** (`github.com/qrtz/nativemessaging`): Lightweight native messaging protocol encoder/decoder

### Expected Features

**Must have (table stakes):**
- One-click best-quality download — every competitor offers this
- Format/quality picker — users expect resolution choices
- Audio-only MP3 extraction — essential for Bandcamp/SoundCloud
- Real-time progress display (bar, speed, ETA) — users hate uncertainty
- Configurable download directory
- Site detection with badge/icon
- Automatic video+audio muxing — yt-dlp + ffmpeg handles this for free
- Download completion notification

**Should have (competitive):**
- SponsorBlock integration — unique to yt-dlp ecosystem
- Subtitle download/embed
- Metadata + thumbnail embedding (critical for music files)
- High-quality Bandcamp audio (FLAC, WAV — not just 128kbps previews)

**Defer (v2+):**
- Playlist/batch downloads — complexity explosion
- Additional sites beyond initial five
- Download queue system

### Architecture Approach

Four-layer system: content scripts (per-site detection + button injection) → service worker (central message router + native port manager) → Go companion (native messaging host + yt-dlp process manager) → yt-dlp subprocess. Chrome manages the companion's lifecycle via `connectNative()`. All state persisted to `chrome.storage.session`/`chrome.storage.local` to survive service worker restarts.

**Major components:**
1. **Content Scripts** — site-specific URL detection, page button injection, metadata extraction
2. **Service Worker** — message routing, native port lifecycle, download state, badge updates
3. **Go Native Host** — native messaging protocol I/O, yt-dlp spawning, progress parsing, concurrent download management
4. **Popup/Side Panel** — format picker UI, progress display, settings

### Critical Pitfalls

1. **MV3 service worker kills native messaging mid-download** — 30s idle timeout closes port, orphans yt-dlp. Requires heartbeat protocol from day one.
2. **Native messaging 1 MB response limit** — Chrome silently disconnects on oversized messages. Cap at 750KB, strip metadata before sending.
3. **yt-dlp progress buffering** — non-TTY stdout is fully buffered. Requires `stdbuf -oL` on Linux/macOS or pty approach.
4. **Zombie yt-dlp/ffmpeg processes** — `cmd.Process.Kill()` only kills direct child. Requires process group management (`Setpgid` on Linux, Job Objects on Windows).
5. **Cross-platform NMH registration** — different paths/mechanisms per OS. Extension ID mismatch between dev and production is the #1 failure mode.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Companion + Native Messaging Protocol
**Rationale:** Everything depends on the companion ↔ extension communication working reliably. The heartbeat protocol, message correlation IDs, and security boundaries must be right before building any features on top.
**Delivers:** Go companion binary that speaks native messaging, service worker that manages the port, verified on all 3 platforms
**Addresses:** One-click download (basic), format listing
**Avoids:** Pitfall #1 (SW lifecycle), #2 (message size), #6 (security), #7 (Web Store permissions planning)

### Phase 2: Core Download Experience
**Rationale:** With the communication layer solid, build the actual download pipeline — yt-dlp integration, progress streaming, format picker UI.
**Delivers:** Working downloads with progress, format picker, audio extraction
**Implements:** yt-dlp subprocess management, progress parsing (with stdbuf/pty), popup UI
**Uses:** go-ytdlp for subprocess management, --progress-template for structured output
**Avoids:** Pitfall #3 (progress buffering), #4 (zombie processes)

### Phase 3: Multi-Site Support + Polish
**Rationale:** Extend to all 5 sites, add site-specific content scripts with download buttons, handle edge cases (auth, missing ffmpeg, error messages).
**Delivers:** Support for YouTube, Vimeo, Pornhub, Bandcamp, SoundCloud with site-appropriate defaults
**Addresses:** Site detection, audio-primary UI for Bandcamp/SoundCloud, error handling

### Phase 4: Packaging + Distribution
**Rationale:** Cross-platform installers are complex (NMH registration differs per OS). This must be a dedicated phase, not an afterthought.
**Delivers:** Platform installers (Linux/macOS/Windows), companion verification (`--verify`), Chrome Web Store listing
**Avoids:** Pitfall #5 (NMH registration), #7 (Web Store rejection)

### Phase Ordering Rationale

- **Phase 1 before 2:** You cannot test downloads without working native messaging. The protocol design (message types, correlation IDs, chunking, heartbeat) constrains everything else.
- **Phase 2 before 3:** Core download logic must work for one site before extending to five. Per-site content scripts depend on the download pipeline being solid.
- **Phase 3 before 4:** Can't package what isn't built. But Web Store permission planning happens in Phase 1 to avoid rejection surprises.
- **Phase 4 last:** Packaging is a separate concern. Cross-platform NMH registration is complex enough to deserve its own phase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Native messaging keepalive edge cases — the `connectNative()` keepalive is documented but unreliable in some configurations (GitHub issue #2688). May need belt-and-suspenders approach.
- **Phase 4:** Chrome Web Store review process for download extensions — rejection criteria are partially automated and opaque. Need to study successful download extension listings.

Phases with standard patterns (skip research-phase):
- **Phase 2:** yt-dlp integration is well-documented. go-ytdlp library handles most complexity.
- **Phase 3:** Content script injection is standard Chrome extension development. Per-site URL patterns are straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified with official Chrome docs, Go package docs, yt-dlp docs. go-ytdlp and coder/websocket confirmed actively maintained. |
| Features | HIGH | Based on competitor analysis (5+ extensions), Chrome Web Store reviews, Reddit threads, yt-dlp feature docs. Clear consensus on table stakes. |
| Architecture | HIGH | Native messaging is well-documented by Chrome. Multiple reference implementations exist (browserpass, Video DownloadHelper CoApp, yt_dlp_firefox). Protocol is simple and well-specified. |
| Pitfalls | HIGH | Sourced from official bug trackers (Chromium issues, yt-dlp GitHub), CVE database, and community post-mortems. Service worker lifecycle issues independently confirmed by multiple sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **go-ytdlp auto-install reliability:** The library claims to auto-install yt-dlp and ffmpeg binaries, but this hasn't been verified in a native messaging host context (where the process may have limited permissions). Test early in Phase 1.
- **Windows binary mode for native messaging:** Multiple sources mention the need for `_setmode` on Windows stdin/stdout, but the exact Go implementation varies. Needs testing on Windows in Phase 1.
- **Chrome Web Store review timeline:** Download extensions reportedly face extra scrutiny. Actual review times and rejection rates are anecdotal. Plan for 1-2 rejection cycles in Phase 4.

## Sources

### Primary (HIGH confidence)
- [Chrome Native Messaging Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [yt-dlp GitHub Repository](https://github.com/yt-dlp/yt-dlp)
- [go-ytdlp GitHub](https://github.com/lrstanley/go-ytdlp) (v1.3.1)
- [coder/websocket GitHub](https://github.com/coder/websocket) (v1.8.14)
- [CVE-2024-22423](https://nvd.nist.gov/vuln/detail/cve-2024-22423) — yt-dlp command injection

### Secondary (MEDIUM confidence)
- [Video DownloadHelper Chrome Web Store](https://chromewebstore.google.com/detail/video-downloadhelper/lmjnegcaeklhafolokijcfjliaokphfk) — competitor analysis
- [FetchV Official Site](https://fetchv.net/) — competitor analysis
- [developer.chrome.com Issue #2688](https://github.com/GoogleChrome/developer.chrome.com/issues/2688) — connectNative keepalive edge cases
- [yt-dlp Issue #1215](https://github.com/yt-dlp/yt-dlp/issues/1215) — progress buffering
- [browserpass/browserpass-native](https://deepwiki.com/browserpass/browserpass-native/5.3-native-messaging-host-registration) — NMH registration reference

### Tertiary (LOW confidence)
- [Extension Radar: 15 Rejection Reasons](https://www.extensionradar.com/blog/chrome-extension-rejected) — Web Store rejection statistics (approximate)
- [Chromium Issue #40733525](https://issues.chromium.org/issues/40733525) — service worker 5-minute shutdown tracking

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
