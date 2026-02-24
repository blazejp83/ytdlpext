# Roadmap: ytdlext

## Overview

Build a Chrome extension + Go companion app that enables one-click video/audio downloading from 5 supported sites via yt-dlp. Start with the native messaging foundation, layer on the full download experience (formats, audio, progress), then polish with per-site button injection and advanced features.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation** - Companion + native messaging + one-click download with progress
- [ ] **Phase 2: Full Download Experience** - Format picker, audio extraction, metadata, notifications
- [ ] **Phase 3: Site Integration + Enhancements** - Per-site buttons, YouTube features, advanced options

## Phase Details

### Phase 1: Foundation
**Goal**: Working extension ↔ Go companion communication via native messaging, with one-click best-quality download, real-time progress, and configurable download directory
**Depends on**: Nothing (first phase)
**Requirements**: FNDTN-01, FNDTN-02, FNDTN-03, DL-01, PROG-01, CFG-01
**Research**: Likely (native messaging protocol, MV3 service worker lifecycle)
**Research topics**: Chrome native messaging setup and keepalive patterns, MV3 service worker lifecycle management, go-ytdlp in native host context, heartbeat protocol design
**Plans**: TBD

Plans:
- [ ] 01-01: Native messaging + extension shell (Wave 1)
- [ ] 01-02: Download pipeline + UI (Wave 2, depends: 01-01)

### Phase 2: Full Download Experience
**Goal**: Complete download pipeline with format/quality picker, audio extraction in multiple formats with metadata and cover art, automatic muxing, meaningful error messages, and download completion notifications
**Depends on**: Phase 1
**Requirements**: DL-02, DL-03, DL-04, DL-05, AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, PROG-02, PROG-03
**Research**: Unlikely (yt-dlp well-documented, go-ytdlp handles complexity)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Site Integration + Enhancements
**Goal**: Per-site download button injection on all 5 sites, audio-primary UI for Bandcamp/SoundCloud, SponsorBlock and subtitle support for YouTube, cookie-based auth for age-restricted content, download history, and keyboard shortcut
**Depends on**: Phase 2
**Requirements**: SITE-01, SITE-02, SITE-03, SITE-04, YT-01, YT-02, ADV-01, ADV-02, ADV-03
**Research**: Unlikely (content script injection is standard, yt-dlp CLI flags well-documented)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Full Download Experience | 0/TBD | Not started | - |
| 3. Site Integration + Enhancements | 0/TBD | Not started | - |
