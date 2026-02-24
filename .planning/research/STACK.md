# Technology Stack Research: Chrome Extension + Go Companion App

**Research Date:** 2025-02-24
**Domain:** Chrome Manifest V3 Extension with Go Native Companion App (yt-dlp download utility)
**Communication:** Native Messaging (primary) / WebSocket (alternative)

---

## Core Technologies

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| **Go** | 1.23+ | Companion app language | Static binary compilation, excellent subprocess management, cross-platform via `GOOS`/`GOARCH`. No runtime dependencies to install on user machines. |
| **Chrome Manifest V3** | MV3 (min_chrome_version: "116") | Extension platform | Required for all new Chrome Web Store submissions as of 2024. MV2 is disabled in Chrome stable. Version 116+ needed for WebSocket service worker keep-alive support. |
| **TypeScript** | 5.x | Extension source language | Type safety for Chrome extension APIs, zero-cost at runtime (compiles to JS). Vanilla TS is sufficient for a small download utility popup/sidepanel. |
| **yt-dlp** | 2026.02.21 (rolling) | Video/audio download engine | De facto standard CLI downloader. 100k+ GitHub stars. Supports 1800+ sites. Active development with frequent releases. |

## Supporting Libraries

### Go Libraries

| Package | Version | Purpose | Notes |
|---|---|---|---|
| **github.com/lrstanley/go-ytdlp** | v1.3.1 | yt-dlp CLI bindings | Auto-installs yt-dlp/ffmpeg binaries. Fully generated from yt-dlp CLI flags with type mappings. Stdout/stderr parsing with timestamps and JSON post-processing. `FlagConfig` enables JSON-to-CLI flag conversion (ideal for HTTP/WebSocket APIs). MIT license. 285 stars. Published Feb 2026. |
| **github.com/coder/websocket** | v1.8.14 | WebSocket server (if WebSocket variant chosen) | Successor to nhooyr/websocket, maintained by Coder. Zero dependencies, zero-alloc reads/writes, full context.Context support, concurrent writes, net.Conn wrapper. 1.75x faster masking than gorilla. Idiomatic Go API. |
| **github.com/qrtz/nativemessaging** | untagged (HEAD) | Native messaging protocol encoding/decoding | Provides `NewNativeJSONDecoder` (stdin) and `NewNativeJSONEncoder` (stdout) for Chrome's length-prefixed JSON protocol. Handles endianness per-platform. Lightweight. 12 stars. MIT license. |

### Alternative Go Libraries (evaluated but not primary)

| Package | Version | Purpose | Why Not Primary |
|---|---|---|---|
| **github.com/gorilla/websocket** | v1.5.3 | WebSocket server | Was archived Dec 2022, partially re-maintained. Stable API but callback-based pong handling, no context.Context support. Use coder/websocket instead for new projects. |
| **github.com/wader/goutubedl** | latest | yt-dlp wrapper | Requires yt-dlp pre-installed in PATH. No auto-install of binaries. Less type-safe CLI mapping. Use go-ytdlp instead for better DX. |
| **github.com/rickypc/native-messaging-host** | latest | Native messaging with auto-update | Feature-rich (manifest install/uninstall, auto-update via Chrome update manifests). Last published Sep 2022. More opinionated than qrtz. Consider if you need built-in manifest management. |
| **github.com/LegendaryB/go-native-messaging** | latest | Native messaging host | Provides `NativeMessagingHost` struct with Read/Write/ReadBytes/WriteBytes. Supports debug stderr output. Decent alternative to qrtz. |

### Chrome Extension (no framework needed)

| Package/Tool | Version | Purpose | Notes |
|---|---|---|---|
| **chrome.runtime.connectNative()** | MV3 built-in | Persistent native messaging connection | Opens a long-lived port to the Go companion app. Chrome manages the native host process lifecycle. |
| **chrome.runtime.sendNativeMessage()** | MV3 built-in | One-shot native messaging | Spawns a new native host process per message. Use for simple request/response patterns only. |
| **chrome.sidePanel** | Chrome 114+ | Side panel UI | Persistent UI that stays open while browsing. Ideal for showing download progress. Declared via `"side_panel"` in manifest. |
| **chrome.action** | MV3 built-in | Toolbar button + popup | Small popup for quick format selection. Can also trigger side panel opening. |
| **chrome.downloads** | MV3 built-in | Manage downloads shelf | Optional: show completed downloads in Chrome's download shelf. Requires `"downloads"` permission. |

## Development Tools

| Tool | Version | Purpose | Notes |
|---|---|---|---|
| **esbuild** | 0.24+ | TypeScript/JS bundler | Fastest bundler. No framework overhead. Ideal for vanilla TS extension builds. Simple config for popup + sidepanel + background + content script entry points. |
| **GoReleaser** | 2.x | Go binary cross-compilation + distribution | Builds for Windows/macOS/Linux. Generates .deb/.rpm. Publishes to GitHub Releases, Homebrew, Scoop, Winget. Built-in code signing and notarization. |
| **web-ext** | 8.x | Extension dev/testing CLI | Mozilla tool that also works for Chrome. Live reload during development. Lint manifest. |
| **create-chrome-ext** | latest | Scaffolding (optional) | `pnpm create chrome-ext -- --template vanilla-ts` for quick project setup with popup + sidepanel support. |
| **Chrome DevTools** | built-in | Extension debugging | `chrome://extensions` with Developer Mode. Inspect popup, service worker, content scripts separately. |

## Installation Commands

### Go Companion App

```bash
# Initialize Go module
go mod init github.com/youruser/ytdlext-companion

# yt-dlp CLI bindings with auto-install of yt-dlp/ffmpeg binaries
go get -u github.com/lrstanley/go-ytdlp@v1.3.1

# Native messaging protocol encoding/decoding (primary communication)
go get -u github.com/qrtz/nativemessaging@latest

# WebSocket (alternative communication, only if choosing Variant B)
go get -u github.com/coder/websocket@v1.8.14

# Cross-platform build and release tooling
go install github.com/goreleaser/goreleaser/v2@latest
```

### Chrome Extension

```bash
npm init -y
npm install -D typescript esbuild chrome-types
```

Optional scaffolding (creates full project structure):

```bash
npx create-chrome-ext@latest --template vanilla-ts
```

---

## Alternatives Considered

### Communication: Native Messaging vs WebSocket

| Aspect | Native Messaging | WebSocket (localhost) |
|---|---|---|
| **Setup complexity** | Higher (requires host manifest registration in OS-specific paths) | Lower (just connect to ws://localhost:PORT) |
| **Security** | Higher (Chrome validates extension ID in host manifest, no network exposure) | Lower (any local process could connect to the WS port) |
| **Service worker compatibility** | Excellent (chrome.runtime.connectNative keeps SW alive) | Fragile (requires keep-alive pings every <30s; Chrome 116+ improved but still unreliable per developer reports) |
| **Process lifecycle** | Chrome manages host process (starts on connect, kills on disconnect) | Must manage companion app lifecycle separately (system service, tray app, etc.) |
| **Message size limit** | 1 MB per message | No practical limit |
| **Bidirectional streaming** | Yes via connectNative port | Yes, native to WebSocket |
| **Browser support** | Chrome, Firefox, Edge (all use same protocol) | Any browser with WebSocket support |
| **Progress updates** | Send JSON progress messages over the port | Send JSON progress messages over the WS connection |

**Recommendation:** Use **Native Messaging** as the primary communication channel. It provides better security, automatic process lifecycle management, and reliable service worker persistence. The 1 MB message limit is not a concern for progress updates and metadata exchange. Reserve WebSocket as a fallback or future option if you need to support web apps beyond the extension.

### yt-dlp Wrapper: go-ytdlp vs goutubedl vs raw os/exec

| Approach | Pros | Cons |
|---|---|---|
| **go-ytdlp (lrstanley)** | Auto-installs binaries, type-safe flags, generated from CLI, stdout parsing, JSON post-processing, FlagConfig for API integration | Relatively new, 285 stars (growing) |
| **goutubedl (wader)** | Simpler API, lighter weight | Requires yt-dlp pre-installed, less type safety, no auto-install |
| **Raw os/exec** | Full control, no dependencies | Must implement progress parsing, flag building, binary management manually |

**Recommendation:** Use **go-ytdlp**. The auto-install of yt-dlp/ffmpeg binaries is critical for a companion app that end users install. The generated type-safe flag API prevents CLI argument errors. FlagConfig JSON serialization is ideal for receiving download configurations from the extension.

### WebSocket Library: coder/websocket vs gorilla/websocket

| Aspect | coder/websocket | gorilla/websocket |
|---|---|---|
| **Maintenance** | Actively maintained by Coder (2024+) | Was archived Dec 2022; minimal maintenance |
| **API style** | Idiomatic Go, context.Context native | Callback-based, no context support |
| **Performance** | Zero-alloc reads/writes, 1.75x faster masking | Configurable buffer sizes, prepared writes |
| **Dependencies** | Zero | Zero |
| **Adoption** | Growing (nhooyr lineage) | Massive (42k+ importers) |

**Recommendation:** Use **coder/websocket** for new projects. It is actively maintained, has a cleaner API, and better performance characteristics. gorilla/websocket is still reliable but its maintenance future is uncertain.

### Extension Bundler: esbuild vs Vite+CRXJS vs Webpack

| Bundler | Pros | Cons |
|---|---|---|
| **esbuild** | Fastest builds (<50ms), minimal config, handles multiple entry points easily | No HMR for extensions (but fast enough for manual reload) |
| **Vite + @crxjs/vite-plugin** | Full HMR, Vite ecosystem, framework support | Heavier setup, CRXJS plugin can lag behind Chrome API changes, overkill for vanilla TS |
| **Webpack** | Most documented for extensions, mature | Slowest builds, complex configuration, heavy |

**Recommendation:** Use **esbuild** for a vanilla TypeScript extension. It is the fastest bundler, has trivial configuration for multiple entry points (background, content, popup, sidepanel), and introduces no unnecessary complexity. If you later add React/Preact, switch to Vite+CRXJS.

---

## What NOT to Use

| Technology | Reason |
|---|---|
| **Manifest V2** | Deprecated. Disabled in Chrome stable since late 2024. Chrome Web Store no longer accepts MV2 submissions. |
| **Background pages** (persistent) | Replaced by service workers in MV3. No equivalent exists. |
| **Remotely-hosted code** | Banned in MV3. All code must be bundled within the extension package. |
| **gorilla/websocket** for new projects | Archived since Dec 2022. Use coder/websocket instead. |
| **youtube-dl** (original) | Abandoned. Use yt-dlp which is the actively maintained fork. |
| **Raw os/exec for yt-dlp** | Reinvents binary management, flag building, progress parsing. Use go-ytdlp. |
| **Heavy JS frameworks (React, Vue)** for this extension | Overkill for a download button popup + progress sidepanel. Vanilla TS with DOM manipulation is sufficient and keeps the extension lightweight. Consider Preact (3KB) if you want JSX. |
| **Electron/Tauri** for companion | Massive overkill. A single Go binary is all that is needed for a native messaging host. |
| **chrome.downloads API** as primary mechanism | Cannot download arbitrary streams. yt-dlp manages its own downloads. Use chrome.downloads only optionally to register completed files in Chrome's download shelf. |
| **WebSocket for MV3 service worker keep-alive** | Unreliable. Developer reports indicate service workers still die despite Chrome 116+ improvements. Native messaging is more robust. |
| **Node.js companion app** | Requires Node.js runtime on user machine. Go produces a single static binary with no runtime dependencies. |

---

## Stack Patterns by Variant

### Variant A: Native Messaging (RECOMMENDED)

```
[Chrome Extension (MV3)]
  |-- popup.html/ts         -> Quick format selection UI
  |-- sidepanel.html/ts     -> Download progress, history
  |-- background.ts         -> Service worker: manages native messaging port
  |-- content.ts            -> Detects supported URLs on page, shows download button
  |-- manifest.json         -> permissions: ["nativeMessaging", "sidePanel", "activeTab"]
  |
  | chrome.runtime.connectNative("com.ytdlext.companion")
  | (length-prefixed JSON over stdin/stdout)
  v
[Go Companion Binary]
  |-- main.go               -> Native messaging host: reads stdin, writes stdout
  |-- downloader.go         -> go-ytdlp wrapper: starts downloads, streams progress
  |-- protocol.go           -> JSON message types (DownloadRequest, ProgressUpdate, etc.)
  |
  | os/exec (managed by go-ytdlp)
  v
[yt-dlp binary]            -> Auto-installed by go-ytdlp Install() helpers
[ffmpeg binary]            -> Auto-installed by go-ytdlp Install() helpers
```

**Native Messaging Host Manifest** (registered at OS-specific path):
```json
{
  "name": "com.ytdlext.companion",
  "description": "ytdlext companion app",
  "path": "/usr/local/bin/ytdlext-companion",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://EXTENSION_ID_HERE/"]
}
```

**Host Manifest Locations:**
- Linux: `~/.config/google-chrome/NativeMessagingHosts/com.ytdlext.companion.json`
- macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.ytdlext.companion.json`
- Windows: Registry key `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.ytdlext.companion` pointing to manifest path

### Variant B: WebSocket (ALTERNATIVE)

```
[Chrome Extension (MV3)]
  |-- popup.html/ts         -> Quick format selection UI
  |-- sidepanel.html/ts     -> Download progress, history (WebSocket client)
  |-- background.ts         -> Service worker: WebSocket client to localhost
  |-- content.ts            -> Detects supported URLs on page
  |-- manifest.json         -> permissions: ["sidePanel", "activeTab"]
  |                            host_permissions: ["http://localhost:PORT/*"]
  |
  | WebSocket ws://localhost:9160
  v
[Go Companion Binary]
  |-- main.go               -> HTTP/WebSocket server on localhost:9160
  |-- server.go             -> coder/websocket: handles connections, broadcasts progress
  |-- downloader.go         -> go-ytdlp wrapper
  |
  v
[yt-dlp + ffmpeg]
```

**Tradeoffs vs Variant A:**
- Must run companion as a background service/tray app (Chrome does not manage lifecycle)
- Must implement auth token or origin checking to prevent other local apps from connecting
- Service worker may die if WebSocket goes idle >30s without messages (mitigate with ping/pong)
- Simpler initial setup (no native messaging host manifest registration)
- Can serve a local web UI in addition to the extension

### Variant C: Hybrid (Native Messaging + WebSocket)

Use native messaging for command/control (start download, get formats, cancel) and WebSocket only for high-frequency progress streaming. This avoids the 1MB native messaging limit concern for large metadata while keeping the security and lifecycle benefits.

**Recommendation:** Start with Variant A. It is simpler, more secure, and Chrome handles all process management. The 1MB message limit is irrelevant for this use case (progress JSON is ~200 bytes). Only consider Variant B/C if you need to support non-extension clients (e.g., a web UI at localhost).

---

## yt-dlp Progress Parsing Pattern

For streaming download progress from yt-dlp to the extension, use the `--progress-template` flag with `--newline`:

```bash
yt-dlp \
  --newline \
  --progress-template "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str)s" \
  URL
```

**Available progress fields:**
- `%(progress._percent_str)s` - Download percentage (e.g., "45.2%")
- `%(progress._speed_str)s` - Download speed (e.g., "5.23MiB/s")
- `%(progress._eta_str)s` - Estimated time remaining (e.g., "00:32")
- `%(progress._total_bytes_str)s` - Total file size (e.g., "234.5MiB")
- `%(progress.downloaded_bytes)s` - Bytes downloaded (raw number)
- `%(progress.total_bytes)s` - Total bytes (raw number, may be N/A)
- `%(progress.speed)s` - Speed in bytes/sec (raw number)
- `%(progress.eta)s` - ETA in seconds (raw number)

**With go-ytdlp**, stdout parsing is built-in. Use the library's event/callback mechanism or parse the structured output directly. The `FlagConfig` type can serialize download options from the extension's JSON message into yt-dlp CLI flags.

---

## Chrome Extension Manifest (Minimal Example)

```json
{
  "manifest_version": 3,
  "name": "ytdlext",
  "version": "1.0.0",
  "minimum_chrome_version": "116",
  "description": "Download videos and audio from supported sites via yt-dlp",
  "permissions": [
    "nativeMessaging",
    "activeTab",
    "sidePanel"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*", "*://*.vimeo.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Permission Notes:**
- `nativeMessaging`: Required. Warning shown: "Communicate with cooperating native applications."
- `activeTab`: Grants access to the current tab when user clicks the extension. No warning shown. Preferred over broad `<all_urls>` host permission.
- `sidePanel`: Required for side panel API. No warning shown.
- `downloads`: Optional. Add only if you want to register completed files in Chrome's downloads shelf. Warning: "Manage your downloads."
- `tabs`: Avoid. Warning: "Read your browsing history." Use `activeTab` instead.

---

## Native Messaging Protocol Design

### Message Format (both directions)

Each message is a UTF-8 JSON object, preceded by a 4-byte little-endian uint32 indicating the message length in bytes. Maximum message size: 1 MB.

### Extension -> Companion Messages

```typescript
// Request format metadata for a URL
{ "type": "get_formats", "id": "uuid", "url": "https://youtube.com/watch?v=..." }

// Start a download
{ "type": "download", "id": "uuid", "url": "...", "format": "bestvideo+bestaudio", "output_dir": "/home/user/Downloads" }

// Cancel a download
{ "type": "cancel", "id": "uuid" }

// Check companion health
{ "type": "ping" }
```

### Companion -> Extension Messages

```typescript
// Format metadata response
{ "type": "formats", "id": "uuid", "formats": [...], "title": "...", "thumbnail": "..." }

// Download progress
{ "type": "progress", "id": "uuid", "percent": 45.2, "speed": "5.23MiB/s", "eta": "00:32", "total_size": "234.5MiB" }

// Download complete
{ "type": "complete", "id": "uuid", "file_path": "/home/user/Downloads/video.mp4", "file_size": 245366784 }

// Error
{ "type": "error", "id": "uuid", "message": "Video is unavailable" }

// Pong
{ "type": "pong" }
```

---

## Version Compatibility Matrix

| Component | Minimum Version | Recommended Version | Notes |
|---|---|---|---|
| Chrome | 116 | Latest stable | 116+ for WebSocket SW keep-alive. 114+ for side panel API. |
| Go | 1.21 | 1.23+ | Required by coder/websocket and go-ytdlp dependencies. |
| yt-dlp | 2024.01.01 | Latest stable (2026.02.21) | Auto-installed by go-ytdlp. Frequent releases. |
| ffmpeg | 6.0 | 7.x | Auto-installed by go-ytdlp. Required for format merging. |
| Node.js | 18 | 22 LTS | Dev dependency only (for esbuild/TypeScript). Not shipped to users. |
| TypeScript | 5.0 | 5.7+ | Dev dependency only. |
| esbuild | 0.20 | 0.24+ | Dev dependency only. |

---

## Sources

### HIGH Confidence (official documentation, primary sources)

- [Chrome Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate) - Official Chrome developer documentation for MV3
- [Chrome Native Messaging Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) - Official native messaging protocol specification
- [Chrome Side Panel API Reference](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) - Official side panel API docs
- [Chrome Extension Permissions Reference](https://developer.chrome.com/docs/extensions/reference/permissions-list) - Official permissions list with user-facing warnings
- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Official service worker timeout behavior
- [WebSocket in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) - Official Chrome guidance on WebSocket keep-alive
- [coder/websocket GitHub](https://github.com/coder/websocket) - Primary source for coder/websocket library (v1.8.14)
- [coder/websocket pkg.go.dev](https://pkg.go.dev/github.com/coder/websocket) - Go package documentation
- [gorilla/websocket GitHub](https://github.com/gorilla/websocket) - Primary source for gorilla/websocket (v1.5.3)
- [gorilla/websocket pkg.go.dev](https://pkg.go.dev/github.com/gorilla/websocket) - Go package documentation
- [lrstanley/go-ytdlp GitHub](https://github.com/lrstanley/go-ytdlp) - Primary source for go-ytdlp (v1.3.1)
- [lrstanley/go-ytdlp pkg.go.dev](https://pkg.go.dev/github.com/lrstanley/go-ytdlp) - Go package documentation
- [qrtz/nativemessaging GitHub](https://github.com/qrtz/nativemessaging) - Primary source for native messaging library
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp) - Primary source for yt-dlp (2026.02.21)
- [yt-dlp Releases](https://github.com/yt-dlp/yt-dlp/releases/) - Release history and changelog
- [Go os/exec Package](https://pkg.go.dev/os/exec) - Standard library subprocess management
- [GoReleaser](https://goreleaser.com/) - Official GoReleaser documentation

### MEDIUM Confidence (community sources, well-maintained references)

- [MDN Native Messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging) - Mozilla documentation (cross-browser native messaging)
- [wader/goutubedl GitHub](https://github.com/wader/goutubedl) - Alternative yt-dlp Go wrapper
- [rickypc/native-messaging-host GitHub](https://github.com/rickypc/native-messaging-host) - Alternative native messaging Go library
- [LegendaryB/go-native-messaging](https://pkg.go.dev/github.com/LegendaryB/go-native-messaging) - Alternative native messaging Go library
- [jfarleyx/chrome-native-messaging-golang](https://github.com/jfarleyx/chrome-native-messaging-golang) - Sample Go native messaging host
- [Coder Blog: A New Home for nhooyr/websocket](https://coder.com/blog/websocket) - Context on coder/websocket adoption
- [Go Forum: WebSocket in 2025](https://forum.golangbridge.org/t/websocket-in-2025/38671) - Community discussion on WebSocket library choices
- [Chrome Extension Development Guide (DEV Community)](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l) - MV3 development overview
- [create-chrome-ext](https://github.com/guocaoyi/create-chrome-ext) - Scaffolding tool for Chrome extensions
- [Native Messaging as Bridge (Medium)](https://medium.com/fme-developer-stories/native-messaging-as-bridge-between-web-and-desktop-d288ea28cfd7) - Practical native messaging guide
- [yt-dlp Progress Template Issues](https://github.com/yt-dlp/yt-dlp/issues/6555) - Progress template field availability

### LOW Confidence (anecdotal, potentially outdated)

- [Hacker News: localhost communication](https://news.ycombinator.com/item?id=23171176) - Discussion on security of localhost WS servers
- [Chrome Extension Service Worker Timeout Reports](https://issues.chromium.org/issues/40733525) - Bug reports on SW shutdown behavior
- [Chrome Groups: WebSocket Integration](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/23pCzk69Ueo/m/z9GH0J7WBQAJ) - Chromium extension developer discussions
