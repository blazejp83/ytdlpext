# Roadmap: ytdlext

## Overview

Build a Chrome extension + Go companion app that enables one-click video/audio downloading from 5 supported sites via yt-dlp. Start with the native messaging foundation, layer on the full download experience (formats, audio, progress), then polish with per-site button injection and advanced features.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-02-25)
- 🚧 **v1.1 Expand & Fix** — Phases 4-5 (in progress)

## Completed Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) (Phases 1-3) — SHIPPED 2026-02-25

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-02-25</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 2: Full Download Experience (2/2 plans) — completed 2026-02-25
- [x] Phase 3: Site Integration + Enhancements (2/2 plans) — completed 2026-02-25

</details>

### 🚧 v1.1 Expand & Fix (In Progress)

**Milestone Goal:** Broaden site support and fix core UX issues (cancel + history)

#### Phase 4: New Site Support

**Goal**: Add ok.ru, CDA, xhamster, and redgifs as supported sites (popup-only, no injected buttons)
**Depends on**: v1.0 complete
**Research**: Unlikely (yt-dlp already supports all 4 sites; work is extension-side site matching)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD (run /gsd:plan-phase 4 to break down)

#### Phase 5: Cancel Downloads + Fix History

**Goal**: Add cancel-all button for in-progress downloads and fix history empty list bug
**Depends on**: Phase 4
**Research**: Unlikely (internal patterns, bug fix)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD (run /gsd:plan-phase 5 to break down)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-24 |
| 2. Full Download Experience | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. Site Integration + Enhancements | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. New Site Support | v1.1 | 0/? | Not started | - |
| 5. Cancel Downloads + Fix History | v1.1 | 0/? | Not started | - |
