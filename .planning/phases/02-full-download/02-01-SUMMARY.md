---
phase: 02-full-download
plan: 01
subsystem: download
tags: [go-ytdlp, yt-dlp, format-query, audio-extraction, folder-open, native-messaging]

# Dependency graph
requires:
  - phase: 01-foundation/01-02
    provides: Download manager, native messaging protocol, message types
provides:
  - Format querying via getFormats/formats message types
  - Format-specific downloads with auto audio merge
  - Audio-only extraction with MP3/FLAC/WAV/Ogg support
  - Metadata and thumbnail embedding
  - Folder opening via openFolder message type
  - Enhanced error messages for ffmpeg, format, network, rate-limit failures
affects: [02-02, 02-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [format-deduplication, platform-file-manager, audio-extraction-pipeline]

key-files:
  created: []
  modified:
    - companion/messaging/types.go
    - companion/main.go
    - companion/download/manager.go

key-decisions:
  - "DumpJSON() for format querying (simulates download, returns JSON with formats array)"
  - "Video format deduplication: same height+fps keeps h264/avc for broader compatibility"
  - "Audio quality: AudioQuality('0') for MP3 (VBR best quality), omit for lossless formats"
  - "Format merge strategy: FormatID+bestaudio/FormatID with MergeOutputFormat(mp4)"
  - "Platform folder open: xdg-open (Linux), open (macOS), explorer (Windows)"

patterns-established:
  - "Format query pattern: DumpJSON -> GetExtractedInfo -> filter/sort/deduplicate -> respond"
  - "Conditional yt-dlp command construction based on DownloadRequest options"
  - "Error message cascading: most specific match first (ffmpeg+audio, ffmpeg+merge, ffmpeg generic)"

# Metrics
duration: 6min
completed: 2026-02-24
---

# Plan 02-01: Companion Format Query, Audio Extraction, and Enhanced Downloads Summary

**Format querying with deduplication, audio-only extraction (MP3/FLAC/WAV/Ogg), format-specific downloads with auto merge, and OS folder opening**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-24
- **Completed:** 2026-02-24
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- getFormats handler queries yt-dlp and returns sorted, deduplicated video/audio format lists
- Downloads support specific format ID selection with automatic audio merging for video-only formats
- Audio-only extraction with configurable format (MP3, FLAC, WAV, Ogg) and quality settings
- Metadata and thumbnail embedding via EmbedMetadata/EmbedThumbnail flags
- openFolder handler opens directories in platform-appropriate file manager
- Enhanced error messages cover ffmpeg (audio/merge), format unavailability, network errors, and rate limiting

## Task Commits

Each task was committed atomically:

1. **Task 1: Add format querying and folder opening** - `df2149f` (feat)
2. **Task 2: Extend download with format selection, audio extraction, and enhanced errors** - `c049b07` (feat)

## Files Created/Modified
- `companion/messaging/types.go` - New message type constants (getFormats, formats, openFolder), GetFormatsRequest, FormatsResponse, VideoFormat, AudioFormat, OpenFolderRequest structs, extended DownloadRequest and DownloadComplete
- `companion/main.go` - handleGetFormats with format parsing/sorting/deduplication, handleOpenFolder with OS detection, new message routing
- `companion/download/manager.go` - Conditional yt-dlp command construction for format/audio/metadata options, Directory in completion, enhanced friendlyError mappings

## Decisions Made
- Used DumpJSON() (not DumpSingleJSON) since we query single URLs and DumpJSON returns per-URL JSON
- Video format deduplication prefers h264/avc codecs for broader browser/device compatibility
- Audio quality set to "0" (best VBR) for MP3; omitted for lossless formats where quality flag is irrelevant
- Format merge: `FormatID+bestaudio/FormatID` pattern lets yt-dlp auto-merge audio when format is video-only
- Used exec.Command Start() (not Run()) for folder opening to avoid blocking on the file manager process

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All companion backend features for Phase 2 are implemented
- Extension UI can now use getFormats, enhanced download options, and openFolder messages
- Ready for extension-side format picker UI and audio download UI

---
*Phase: 02-full-download*
*Completed: 2026-02-24*
