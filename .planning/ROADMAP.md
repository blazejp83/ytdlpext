# Roadmap: ytdlext

## Overview

Build a Chrome extension + Go companion app that enables one-click video/audio downloading from 5 supported sites via yt-dlp. Start with the native messaging foundation, layer on the full download experience (formats, audio, progress), then polish with per-site button injection and advanced features.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-02-25)
- ✅ **v1.1 Expand & Fix** — Phases 4-5 (shipped 2026-02-25)

## Completed Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) (Phases 1-3) — SHIPPED 2026-02-25

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-02-25</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 2: Full Download Experience (2/2 plans) — completed 2026-02-25
- [x] Phase 3: Site Integration + Enhancements (2/2 plans) — completed 2026-02-25

</details>

### ✅ v1.1 Expand & Fix — SHIPPED 2026-02-25

**Milestone Goal:** Broaden site support and fix core UX issues (cancel + history)

#### Phase 4: New Site Support

**Goal**: Add ok.ru, CDA, xhamster, and redgifs as supported sites (popup-only, no injected buttons)
**Depends on**: v1.0 complete

Plans:
- [x] 04-01: Add new site support (ok.ru, CDA, xhamster, redgifs)

#### Phase 5: Cancel Downloads + Fix History

**Goal**: Add cancel-all button for in-progress downloads and fix history empty list bug
**Depends on**: Phase 4

Plans:
- [x] 05-01: Cancel support with download tracking (Go companion)
- [x] 05-02: Cancel button UI + history fix (Extension)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-24 |
| 2. Full Download Experience | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. Site Integration + Enhancements | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. New Site Support | v1.1 | 1/1 | Complete | 2026-02-25 |
| 5. Cancel Downloads + Fix History | v1.1 | 2/2 | Complete | 2026-02-25 |
