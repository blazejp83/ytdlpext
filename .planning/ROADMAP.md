# Roadmap: ytdlext

## Overview

Build a Chrome extension + Go companion app that enables one-click video/audio downloading from 5 supported sites via yt-dlp. Start with the native messaging foundation, layer on the full download experience (formats, audio, progress), then polish with per-site button injection and advanced features.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Expand & Fix** — Phases 4-5 (shipped 2026-02-25)
- 🚧 **v1.2 UI Polish** — Phases 6-8 (in progress)

## Completed Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) (Phases 1-3) — SHIPPED 2026-02-25
- ✅ [v1.1 Expand & Fix](milestones/v1.1-ROADMAP.md) (Phases 4-5) — SHIPPED 2026-02-25

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-02-25</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 2: Full Download Experience (2/2 plans) — completed 2026-02-25
- [x] Phase 3: Site Integration + Enhancements (2/2 plans) — completed 2026-02-25

</details>

<details>
<summary>✅ v1.1 Expand & Fix (Phases 4-5) — SHIPPED 2026-02-25</summary>

- [x] Phase 4: New Site Support (1/1 plans) — completed 2026-02-25
- [x] Phase 5: Cancel Downloads + Fix History (2/2 plans) — completed 2026-02-25

</details>

### 🚧 v1.2 UI Polish (In Progress)

**Milestone Goal:** Polish the popup UX with format caching, preference memory, auto-close behavior, and fix history title display.

#### Phase 6: Format UX

**Goal**: Cache format queries across popup view switches and remember last chosen resolution
**Depends on**: Previous milestone complete
**Research**: Unlikely (internal patterns, chrome.storage.local)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD (run /gsd:plan-phase 6 to break down)

#### Phase 7: Download Completion UX

**Goal**: Auto-close popup with visible countdown after download completes
**Depends on**: Phase 6
**Research**: Unlikely (internal UI patterns)
**Plans**: TBD

Plans:
- [x] 07-01: Auto-close countdown on download complete

#### Phase 8: History Title Fix

**Goal**: Fix YouTube history entries showing wrong title/URL by using yt-dlp metadata correctly
**Depends on**: Phase 7
**Research**: Unlikely (internal debugging, yt-dlp metadata parsing)
**Plans**: TBD

Plans:
- [x] 08-01: Fix history entries showing wrong title/filename via PrintJSON metadata

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-24 |
| 2. Full Download Experience | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. Site Integration + Enhancements | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. New Site Support | v1.1 | 1/1 | Complete | 2026-02-25 |
| 5. Cancel Downloads + Fix History | v1.1 | 2/2 | Complete | 2026-02-25 |
| 6. Format UX | v1.2 | 1/1 | Complete | 2026-02-25 |
| 7. Download Completion UX | v1.2 | 1/1 | Complete | 2026-02-25 |
| 8. History Title Fix | v1.2 | 1/1 | Complete | 2026-02-25 |
