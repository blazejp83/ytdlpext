# Architecture Research: Chrome Extension + Go Native Companion (ytdlext)

Research Date: 2026-02-24
Domain: Chrome Extension (MV3) + Go companion app + yt-dlp

---

## System Overview

```
+------------------------------------------------------------------+
|                        CHROME BROWSER                            |
|                                                                  |
|  +------------------+     +------------------+                   |
|  |  Content Script  |     |     Popup UI     |                   |
|  |  (per-tab)       |     |  (format picker) |                   |
|  |                  |     |                  |                   |
|  |  - Detect site   |     |  - Show formats  |                   |
|  |  - Inject button |     |  - Show progress |                   |
|  |  - Relay msgs    |     |  - Download mgmt |                   |
|  +--------+---------+     +--------+---------+                   |
|           |                        |                             |
|           |  chrome.runtime.sendMessage / ports                  |
|           |                        |                             |
|  +--------v------------------------v---------+                   |
|  |           Service Worker (MV3)            |                   |
|  |                                           |                   |
|  |  - Central message router                 |                   |
|  |  - Native messaging port lifecycle        |                   |
|  |  - Download state management              |                   |
|  |  - Badge/icon updates                     |                   |
|  +---------------------+---------------------+                   |
|                         |                                        |
+-------------------------|----------------------------------------+
                          | chrome.runtime.connectNative()
                          | (stdin/stdout, 4-byte length-prefixed JSON)
                          |
+-------------------------|----------------------------------------+
|                         v                                        |
|  +---------------------+---------------------+                   |
|  |         Go Native Messaging Host          |                   |
|  |         (companion binary)                |                   |
|  |                                           |                   |
|  |  - Read/write native messaging protocol   |                   |
|  |  - Spawn yt-dlp subprocess                |                   |
|  |  - Parse progress from yt-dlp stdout      |                   |
|  |  - Stream progress back to extension      |                   |
|  |  - Manage concurrent downloads            |                   |
|  +---------------------+---------------------+                   |
|                         |                                        |
|  NATIVE HOST PROCESS    | exec.Command + StdoutPipe              |
|                         |                                        |
|  +---------------------v---------------------+                   |
|  |              yt-dlp subprocess             |                   |
|  |                                           |                   |
|  |  --progress-template (JSON per line)      |                   |
|  |  --newline (parseable output)             |                   |
|  |  --no-colors                              |                   |
|  |  -j (metadata as JSON)                    |                   |
|  +-------------------------------------------+                   |
|                                                                  |
+------------------------------------------------------------------+
    OS PROCESS SPACE
```

---

## Component Responsibilities

| Component | Responsibility | Runs When | Technology |
|---|---|---|---|
| **Content Script** | Detect supported sites via URL match; inject download button into page DOM; capture page metadata (title, URL); relay user actions to service worker | When user visits matched site | JS/TS, injected per-tab |
| **Popup UI** | Format selection (video/audio, quality); display active downloads and progress; download history; settings | When user clicks extension icon | HTML/CSS/JS (or framework) |
| **Service Worker** | Central message bus; manage native messaging port; track download state; update badge/icon; persist state to chrome.storage | Event-driven, kept alive by native port | JS/TS (MV3 background) |
| **Go Companion** | Native messaging protocol I/O; spawn and manage yt-dlp processes; parse yt-dlp progress output; stream progress JSON to extension; handle concurrent downloads | Started by Chrome on connectNative() | Go binary |
| **yt-dlp** | Actual media downloading; format extraction and selection; metadata retrieval | Spawned by Go companion per download | Python CLI (external dep) |

---

## Recommended Project Structure

```
ytdlext/
|
+-- extension/                      # Chrome extension source
|   +-- manifest.json               # MV3 manifest
|   +-- src/
|   |   +-- background/
|   |   |   +-- service-worker.ts   # Service worker entry point
|   |   |   +-- native-port.ts      # Native messaging port management
|   |   |   +-- download-manager.ts # Download state tracking
|   |   |   +-- message-router.ts   # Internal message routing
|   |   |
|   |   +-- content/
|   |   |   +-- detector.ts         # Site detection logic
|   |   |   +-- injector.ts         # DOM button injection
|   |   |   +-- sites/
|   |   |   |   +-- youtube.ts      # YouTube-specific logic
|   |   |   |   +-- vimeo.ts
|   |   |   |   +-- pornhub.ts
|   |   |   |   +-- bandcamp.ts
|   |   |   |   +-- soundcloud.ts
|   |   |   |   +-- index.ts        # Site registry
|   |   |
|   |   +-- popup/
|   |   |   +-- popup.html
|   |   |   +-- popup.ts
|   |   |   +-- components/         # UI components (if using framework)
|   |   |
|   |   +-- shared/
|   |       +-- types.ts            # Shared type definitions
|   |       +-- messages.ts         # Message type constants/schemas
|   |       +-- constants.ts        # Site patterns, config defaults
|   |
|   +-- assets/
|   |   +-- icons/                  # Extension icons (16, 32, 48, 128)
|   |   +-- styles/                 # CSS for popup and injected UI
|   |
|   +-- tsconfig.json
|   +-- package.json
|   +-- esbuild.config.js           # Or webpack/rollup/vite config
|
+-- companion/                      # Go native messaging host
|   +-- cmd/
|   |   +-- ytdlext-host/
|   |       +-- main.go             # Entry point: native messaging loop
|   |
|   +-- internal/
|   |   +-- messaging/
|   |   |   +-- protocol.go         # 4-byte length prefix read/write
|   |   |   +-- types.go            # Request/response message types
|   |   |
|   |   +-- ytdlp/
|   |   |   +-- executor.go         # yt-dlp subprocess management
|   |   |   +-- progress.go         # Progress output parsing
|   |   |   +-- formats.go          # Format listing and selection
|   |   |   +-- metadata.go         # Video metadata extraction
|   |   |
|   |   +-- downloads/
|   |       +-- manager.go          # Concurrent download tracking
|   |       +-- state.go            # Download state machine
|   |
|   +-- go.mod
|   +-- go.sum
|
+-- native-host-manifest/           # Platform-specific manifest configs
|   +-- com.ytdlext.host.json       # NM host manifest template
|
+-- scripts/
|   +-- install.sh                  # Linux/macOS installer
|   +-- install.bat                 # Windows installer
|   +-- install.ps1                 # Windows PowerShell installer
|   +-- uninstall.sh
|
+-- Makefile                        # Build targets for both components
+-- README.md
```

---

## Architectural Patterns: Native Messaging vs WebSocket

### Recommendation: Native Messaging (connectNative)

For this project, **native messaging is the correct choice**. Here is the detailed comparison:

### Native Messaging

| Aspect | Detail |
|---|---|
| **Communication** | stdin/stdout with 4-byte length-prefixed JSON |
| **Lifecycle** | Chrome spawns host process on connectNative(), kills on port.disconnect() |
| **Service worker** | connectNative() keeps MV3 service worker alive (Chrome 105+) |
| **Security** | No open ports; only allowed extension IDs can connect |
| **Installation** | Host manifest registered in OS-specific location |
| **Message limit** | 1 MB from host to extension; 64 MiB from extension to host |
| **Concurrency** | Single process per port; can manage multiple downloads internally |

**Advantages for this project:**
- Chrome manages the host process lifecycle -- no daemon to start/stop
- connectNative() keeps the service worker alive during downloads, which is critical
- No network ports exposed -- no attack surface for other local apps
- Standard Chrome API with well-documented protocol
- No firewall or localhost binding issues
- Extension ID allowlist prevents unauthorized access

**Disadvantages:**
- 1 MB response limit requires progress messages to be small (not a problem -- progress updates are tiny)
- Binary protocol (length-prefixed) needs careful implementation
- Host process exits when port closes -- state must be carefully managed
- Single stdio channel means all communication is serialized

### WebSocket

| Aspect | Detail |
|---|---|
| **Communication** | ws://localhost:PORT with JSON messages |
| **Lifecycle** | Companion must run as a standalone daemon |
| **Service worker** | WebSocket keepalive needed every 20s (Chrome 116+) |
| **Security** | Open localhost port; any local process can connect |
| **Installation** | Daemon must be started separately (systemd, launchd, Windows service) |
| **Message limit** | No practical limit |
| **Concurrency** | Multiple clients can connect |

**Disadvantages for this project:**
- Requires a separate daemon lifecycle (installation, autostart, crash recovery)
- Open localhost port is a security concern -- other local apps or malicious pages could connect
- WebSocket keepalive is fragile (must send messages every 20s to prevent service worker death)
- User must ensure the companion is running before using the extension
- Firewall/antivirus software may block localhost connections
- More complex error handling for connection loss and reconnection

**When WebSocket would be better (not applicable here):**
- Multiple browser instances or different browsers need to share state
- Messages regularly exceed 1 MB
- The companion needs to push unsolicited updates independent of browser lifecycle
- The companion serves other clients beyond the browser extension

### Decision Matrix

| Criterion | Native Messaging | WebSocket | Winner |
|---|---|---|---|
| Service worker lifetime | Keeps alive automatically | Requires 20s keepalive | Native |
| Security | Extension ID allowlist | Open port | Native |
| Installation simplicity | Manifest file + binary | Daemon + service mgmt | Native |
| Process lifecycle | Chrome manages it | Self-managed daemon | Native |
| Message size | 1 MB limit (sufficient) | Unlimited | WebSocket (but irrelevant) |
| Bidirectional streaming | Supported via port | Natively supported | Tie |
| Cross-browser support | Per-browser manifests | One server, any client | WebSocket |
| Debugging ease | stdio tracing | Standard WS tools | WebSocket |

---

## Data Flow Diagrams

### Flow 1: User Initiates Download

```
Content Script          Service Worker           Go Host              yt-dlp
     |                       |                      |                    |
     |  1. User clicks       |                      |                    |
     |     download btn      |                      |                    |
     |                       |                      |                    |
     |  2. sendMessage({     |                      |                    |
     |     type: "download", |                      |                    |
     |     url, format })    |                      |                    |
     |---------------------->|                       |                    |
     |                       |  3. port.postMessage( |                    |
     |                       |     { action:         |                    |
     |                       |       "download",     |                    |
     |                       |       id, url,        |                    |
     |                       |       format })       |                    |
     |                       |--------------------->|                    |
     |                       |                      |  4. exec.Command(  |
     |                       |                      |     "yt-dlp",      |
     |                       |                      |     "--newline",   |
     |                       |                      |     "--progress-   |
     |                       |                      |      template",   |
     |                       |                      |     url)           |
     |                       |                      |------------------>|
     |                       |                      |                    |
     |                       |                      |  5. stdout lines:  |
     |                       |                      |     progress JSON  |
     |                       |                      |<------------------|
     |                       |                      |                    |
     |                       |  6. postMessage({    |                    |
     |                       |     type: "progress", |                    |
     |                       |     id, percent,     |                    |
     |                       |     speed, eta })    |                    |
     |                       |<---------------------|                    |
     |                       |                      |                    |
     |  7. Update badge/     |                      |                    |
     |     notify popup      |                      |                    |
     |<----------------------|                      |                    |
     |                       |                      |                    |
     |                       |                      |  8. yt-dlp exits   |
     |                       |                      |<------------------|
     |                       |  9. postMessage({    |                    |
     |                       |     type: "complete", |                    |
     |                       |     id, filepath })  |                    |
     |                       |<---------------------|                    |
     |  10. Show complete    |                      |                    |
     |<----------------------|                      |                    |
```

### Flow 2: Format Listing

```
Popup UI                Service Worker           Go Host              yt-dlp
  |                          |                      |                    |
  |  1. Request formats      |                      |                    |
  |     for current URL      |                      |                    |
  |------------------------->|                       |                    |
  |                          |  2. port.postMessage( |                    |
  |                          |     { action:         |                    |
  |                          |       "list_formats", |                    |
  |                          |       url })          |                    |
  |                          |--------------------->|                    |
  |                          |                      |  3. exec.Command(  |
  |                          |                      |     "yt-dlp",      |
  |                          |                      |     "-j", url)     |
  |                          |                      |------------------>|
  |                          |                      |                    |
  |                          |                      |  4. JSON metadata  |
  |                          |                      |     with formats[] |
  |                          |                      |<------------------|
  |                          |                      |                    |
  |                          |  5. postMessage({    |                    |
  |                          |     type: "formats",  |                    |
  |                          |     id, formats })   |                    |
  |                          |<---------------------|                    |
  |  6. Display format list  |                      |                    |
  |<-------------------------|                      |                    |
```

### Flow 3: Progress Streaming (Detail)

```
yt-dlp stdout              Go Host                    Service Worker
     |                        |                             |
     | [download]  0.1% of    |                             |
     | 150.32MiB at 5.2MiB/s  |                             |
     | ETA 00:29               |                             |
     |------------------------>| (scanner.Scan() in          |
     |                        |  goroutine)                  |
     |                        |                              |
     |                        | Parse progress line:         |
     |                        |  percent=0.1                 |
     |                        |  total=150.32MB              |
     |                        |  speed=5.2MB/s               |
     |                        |  eta=29                      |
     |                        |                              |
     |                        | Write to stdout:             |
     |                        | [4-byte len][JSON msg]       |
     |                        |----------------------------->|
     |                        |                              |
     | (next progress line)   |                              |
     |----------------------->| (throttle: max 1 msg/500ms)  |
     |                        |                              |
     |                        | Write to stdout:             |
     |                        | [4-byte len][JSON msg]       |
     |                        |----------------------------->|
```

---

## Integration Points

### External Boundaries

| Boundary | Protocol | Notes |
|---|---|---|
| Extension <-> Content Script | chrome.runtime message passing | Internal Chrome IPC |
| Service Worker <-> Go Host | Native messaging (stdio) | 4-byte length prefix + JSON |
| Go Host <-> yt-dlp | exec.Command + StdoutPipe | Line-buffered stdout with --newline |
| yt-dlp <-> Internet | HTTPS | yt-dlp handles all network I/O |

### Internal Message Schema

All messages between service worker and Go host should follow a typed envelope:

```typescript
// Extension side (TypeScript)
interface NativeMessage {
  id: string;          // Request/correlation ID (UUID)
  action: string;      // "download" | "list_formats" | "cancel" | "status"
  payload: unknown;    // Action-specific data
}

interface NativeResponse {
  id: string;          // Correlates to request
  type: string;        // "progress" | "formats" | "complete" | "error"
  payload: unknown;    // Response-specific data
}

// Progress payload
interface ProgressPayload {
  downloadId: string;
  percent: number;         // 0.0 - 100.0
  totalBytes: number;
  downloadedBytes: number;
  speed: number;           // bytes/sec
  eta: number;             // seconds remaining
  status: "downloading" | "postprocessing" | "complete" | "error";
}
```

```go
// Go companion side
type Request struct {
    ID      string          `json:"id"`
    Action  string          `json:"action"`
    Payload json.RawMessage `json:"payload"`
}

type Response struct {
    ID      string      `json:"id"`
    Type    string      `json:"type"`
    Payload interface{} `json:"payload"`
}

type ProgressPayload struct {
    DownloadID      string  `json:"downloadId"`
    Percent         float64 `json:"percent"`
    TotalBytes      int64   `json:"totalBytes"`
    DownloadedBytes int64   `json:"downloadedBytes"`
    Speed           int64   `json:"speed"`
    ETA             int     `json:"eta"`
    Status          string  `json:"status"`
}
```

### Native Messaging Host Manifest

File: `com.ytdlext.host.json`

```json
{
  "name": "com.ytdlext.host",
  "description": "ytdlext companion - downloads media via yt-dlp",
  "path": "/usr/local/bin/ytdlext-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID_HERE/"
  ]
}
```

Platform-specific manifest locations:

| Platform | System-wide | User-level |
|---|---|---|
| **Linux (Chrome)** | `/etc/opt/chrome/native-messaging-hosts/` | `~/.config/google-chrome/NativeMessagingHosts/` |
| **Linux (Chromium)** | `/etc/chromium/native-messaging-hosts/` | `~/.config/chromium/NativeMessagingHosts/` |
| **macOS (Chrome)** | `/Library/Google/Chrome/NativeMessagingHosts/` | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` |
| **Windows (Chrome)** | Registry: `HKLM\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.ytdlext.host` | Registry: `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.ytdlext.host` |

---

## Key Implementation Details

### 1. Native Messaging Protocol in Go

The native messaging protocol uses a 4-byte little-endian length prefix followed by a UTF-8 JSON payload on stdin/stdout.

```go
package messaging

import (
    "encoding/binary"
    "encoding/json"
    "io"
    "os"
)

// ReadMessage reads a single native messaging message from stdin.
// Protocol: [4-byte LE uint32 length][JSON payload]
func ReadMessage(r io.Reader) (json.RawMessage, error) {
    var length uint32
    if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
        return nil, err // EOF means Chrome closed the port
    }

    if length > 1024*1024 { // 1 MB sanity check
        return nil, fmt.Errorf("message too large: %d bytes", length)
    }

    msg := make([]byte, length)
    if _, err := io.ReadFull(r, msg); err != nil {
        return nil, err
    }
    return json.RawMessage(msg), nil
}

// WriteMessage writes a single native messaging message to stdout.
func WriteMessage(w io.Writer, v interface{}) error {
    data, err := json.Marshal(v)
    if err != nil {
        return err
    }

    // 1 MB limit for host -> extension messages
    if len(data) > 1024*1024 {
        return fmt.Errorf("message exceeds 1MB limit: %d bytes", len(data))
    }

    length := uint32(len(data))
    if err := binary.Write(w, binary.LittleEndian, length); err != nil {
        return err
    }
    _, err = w.Write(data)
    return err
}
```

### 2. Go Host Main Loop

```go
package main

import (
    "log"
    "os"
)

func main() {
    // Log to stderr (stdout is reserved for native messaging protocol)
    log.SetOutput(os.Stderr)

    host := NewHost(os.Stdin, os.Stdout)

    // Block on message loop until stdin closes (Chrome disconnects)
    if err := host.Run(); err != nil {
        log.Fatalf("host error: %v", err)
    }
}

type Host struct {
    reader io.Reader
    writer io.Writer
    mu     sync.Mutex // Serialize writes to stdout
    mgr    *DownloadManager
}

func (h *Host) Run() error {
    for {
        raw, err := messaging.ReadMessage(h.reader)
        if err != nil {
            if err == io.EOF {
                return nil // Chrome closed connection, exit cleanly
            }
            return err
        }

        var req Request
        if err := json.Unmarshal(raw, &req); err != nil {
            h.sendError("", "invalid request: "+err.Error())
            continue
        }

        // Handle each request in a goroutine for concurrency
        go h.handleRequest(req)
    }
}

func (h *Host) send(resp Response) error {
    h.mu.Lock()
    defer h.mu.Unlock()
    return messaging.WriteMessage(h.writer, resp)
}
```

### 3. yt-dlp Progress Parsing in Go

Use `--progress-template` with a JSON format and `--newline` for line-buffered output:

```go
package ytdlp

import (
    "bufio"
    "context"
    "encoding/json"
    "fmt"
    "os/exec"
    "strings"
)

type ProgressInfo struct {
    Status          string  `json:"status"`
    Percent         float64 `json:"percent"`
    TotalBytes      int64   `json:"total_bytes"`
    DownloadedBytes int64   `json:"downloaded_bytes"`
    Speed           float64 `json:"speed"`
    ETA             int     `json:"eta"`
}

// ProgressTemplate is the format string passed to yt-dlp
// This outputs one JSON object per line for easy parsing.
const ProgressTemplate = `download:{"status":"downloading","percent":%(progress._percent_str|strip)s,"downloaded_bytes":%(progress.downloaded_bytes|default(0))s,"total_bytes":%(progress.total_bytes|default(0))s,"speed":%(progress.speed|default(0))s,"eta":%(progress.eta|default(0))s}`

func Download(ctx context.Context, url string, format string, outputDir string, onProgress func(ProgressInfo)) error {
    args := []string{
        "--newline",
        "--no-colors",
        "--progress-template", ProgressTemplate,
        "-f", format,
        "-o", outputDir + "/%(title)s.%(ext)s",
        url,
    }

    cmd := exec.CommandContext(ctx, "yt-dlp", args...)

    stdout, err := cmd.StdoutPipe()
    if err != nil {
        return fmt.Errorf("stdout pipe: %w", err)
    }

    // Capture stderr for error reporting
    stderr, err := cmd.StderrPipe()
    if err != nil {
        return fmt.Errorf("stderr pipe: %w", err)
    }

    if err := cmd.Start(); err != nil {
        return fmt.Errorf("start yt-dlp: %w", err)
    }

    // Read progress lines in a goroutine
    go func() {
        scanner := bufio.NewScanner(stdout)
        for scanner.Scan() {
            line := scanner.Text()

            // Progress template lines start with our JSON
            if strings.HasPrefix(line, "{") {
                var info ProgressInfo
                if err := json.Unmarshal([]byte(line), &info); err == nil {
                    onProgress(info)
                }
            }
        }
    }()

    // Collect stderr
    var stderrBuf strings.Builder
    go func() {
        scanner := bufio.NewScanner(stderr)
        for scanner.Scan() {
            stderrBuf.WriteString(scanner.Text() + "\n")
        }
    }()

    if err := cmd.Wait(); err != nil {
        return fmt.Errorf("yt-dlp failed: %w\nstderr: %s", err, stderrBuf.String())
    }
    return nil
}
```

### 4. Service Worker Native Port Management

```typescript
// service-worker.ts

let port: chrome.runtime.Port | null = null;
const pendingRequests = new Map<string, (response: NativeResponse) => void>();

function ensurePort(): chrome.runtime.Port {
  if (port) return port;

  port = chrome.runtime.connectNative("com.ytdlext.host");

  port.onMessage.addListener((msg: NativeResponse) => {
    // Route response to appropriate handler
    if (msg.type === "progress") {
      handleProgress(msg);
    } else {
      // Resolve pending request promise
      const resolver = pendingRequests.get(msg.id);
      if (resolver) {
        resolver(msg);
        if (msg.type !== "progress") {
          pendingRequests.delete(msg.id);
        }
      }
    }
  });

  port.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError;
    console.error("Native host disconnected:", error?.message);
    port = null;

    // Reject all pending requests
    for (const [id, resolver] of pendingRequests) {
      resolver({ id, type: "error", payload: { message: "Host disconnected" } });
    }
    pendingRequests.clear();
  });

  return port;
}

function sendNativeRequest(action: string, payload: unknown): Promise<NativeResponse> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const p = ensurePort();
    pendingRequests.set(id, resolve);
    p.postMessage({ id, action, payload });
  });
}
```

### 5. Content Script Site Detection

Use static content script declarations in manifest.json for known sites:

```json
{
  "manifest_version": 3,
  "name": "ytdlext",
  "version": "1.0.0",
  "permissions": ["nativeMessaging", "storage"],
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.youtube.com/watch*",
        "*://*.youtube.com/playlist*",
        "*://*.youtube.com/shorts/*"
      ],
      "js": ["src/content/sites/youtube.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["*://*.vimeo.com/*"],
      "js": ["src/content/sites/vimeo.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["*://*.pornhub.com/view_video*"],
      "js": ["src/content/sites/pornhub.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "*://*.bandcamp.com/track/*",
        "*://*.bandcamp.com/album/*"
      ],
      "js": ["src/content/sites/bandcamp.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["*://soundcloud.com/*"],
      "js": ["src/content/sites/soundcloud.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon-16.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png"
    }
  },
  "icons": {
    "16": "assets/icons/icon-16.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  }
}
```

**Why static content_scripts over declarativeContent:**
- Content scripts can inject UI (download button) directly into the page
- declarativeContent can only show/hide the extension action icon
- For this use case, we need both: the icon always shows, and content scripts inject buttons
- Static matches are simpler, faster, and require no host permissions

---

## MV3 Service Worker Lifecycle Considerations

### Key Constraints

| Constraint | Value | Impact |
|---|---|---|
| Idle timeout | 30 seconds | Service worker dies if no events/messages |
| Max single request | 5 minutes | Long downloads need streaming, not single request |
| connectNative keepalive | Yes (Chrome 105+) | Native port keeps SW alive during downloads |
| State persistence | None (no globals survive) | Must use chrome.storage for state |

### How connectNative() Solves the Lifecycle Problem

When the service worker opens a native messaging port via `connectNative()`:
1. Chrome keeps the service worker alive as long as the port is open
2. Messages received on the port reset the idle timer
3. Progress messages from the Go host continuously reset the timer
4. The service worker stays alive for the entire download duration

This is the primary reason to choose native messaging over WebSocket for this project. With WebSocket, you would need a keepalive ping every 20 seconds, and the connection is more fragile.

### State Recovery Pattern

Despite connectNative() keeping the worker alive, always design for recovery:

```typescript
// On service worker startup, restore state from chrome.storage
chrome.runtime.onStartup.addListener(async () => {
  const { activeDownloads } = await chrome.storage.local.get("activeDownloads");
  if (activeDownloads?.length > 0) {
    // Reconnect to host and check status of in-progress downloads
    const port = ensurePort();
    for (const dl of activeDownloads) {
      port.postMessage({ id: dl.id, action: "status", payload: { downloadId: dl.downloadId } });
    }
  }
});

// Persist state on every change
function updateDownloadState(downloads: DownloadState[]) {
  chrome.storage.local.set({ activeDownloads: downloads });
}
```

---

## Anti-Patterns to Avoid

### 1. Writing Debug Output to stdout

**Wrong:** Using `fmt.Println()` or `log.Println()` in the Go host for debugging.
stdout is exclusively for the native messaging protocol. Any non-protocol bytes on stdout will corrupt the message stream and crash the connection.

**Correct:** Direct all logging to stderr: `log.SetOutput(os.Stderr)`.

### 2. Relying on Global Variables in the Service Worker

**Wrong:** Storing download state in module-level variables.
The service worker can be terminated at any time. All global state is lost.

**Correct:** Use `chrome.storage.local` for all state that must survive restarts. Read it on startup, write it on every change.

### 3. Using sendNativeMessage() Instead of connectNative()

**Wrong:** Using `chrome.runtime.sendNativeMessage()` for downloads.
This starts a new host process per message and only returns the first response. It cannot stream progress.

**Correct:** Use `chrome.runtime.connectNative()` to create a persistent port. The host process stays alive and can send multiple progress messages.

### 4. Spawning One yt-dlp Process Per Message

**Wrong:** Creating a new native messaging connection for each download.

**Correct:** Use a single persistent native messaging connection. The Go host manages multiple concurrent yt-dlp subprocesses internally, routing progress by download ID.

### 5. Not Throttling Progress Messages

**Wrong:** Forwarding every yt-dlp progress line immediately to the extension.
yt-dlp can emit progress updates very rapidly. Each native message has serialization overhead.

**Correct:** Throttle progress messages in the Go host (e.g., max one per 500ms per download). Batch or skip intermediate updates.

### 6. Blocking the Native Messaging Read Loop

**Wrong:** Processing downloads synchronously in the message read loop.
This blocks reading new messages (like cancel requests) while a download is running.

**Correct:** Handle each request in a separate goroutine. The read loop should only read and dispatch.

### 7. Not Handling Host Disconnection

**Wrong:** Assuming the native port stays connected forever.

**Correct:** Always listen for `port.onDisconnect`, check `chrome.runtime.lastError`, and implement reconnection logic. Show the user a clear error ("Companion app not found -- please install ytdlext-host").

### 8. Hardcoding the Extension ID

**Wrong:** Embedding the extension ID in the native host manifest during development.
The ID changes between development (unpacked) and production (Chrome Web Store).

**Correct:** The install script should accept the extension ID as a parameter, or the companion can provide a setup command that registers the correct ID.

### 9. Ignoring Windows Binary Mode

**Wrong:** Not setting stdin/stdout to binary mode on Windows.
Windows will mangle \n to \r\n in text mode, corrupting the 4-byte length prefix.

**Correct:** On Windows, set stdin and stdout to binary mode at startup:
```go
// +build windows

import "golang.org/x/sys/windows"

func init() {
    // Set stdin/stdout to binary mode
    windows.SetConsoleMode(windows.Handle(os.Stdin.Fd()), 0)
    windows.SetConsoleMode(windows.Handle(os.Stdout.Fd()), 0)
}
```

### 10. Not Validating Message Origins

**Wrong:** The Go host blindly trusting all input.

**Correct:** While Chrome enforces allowed_origins in the manifest, the Go host should still validate message structure, sanitize URLs (reject non-HTTP(S) schemes), and enforce limits on concurrent downloads.

---

## yt-dlp Integration Details

### Format Listing

```bash
# Get all available formats as JSON
yt-dlp -j "URL"

# The JSON output includes a "formats" array with objects like:
# {
#   "format_id": "137",
#   "ext": "mp4",
#   "resolution": "1920x1080",
#   "fps": 30,
#   "vcodec": "avc1.640028",
#   "acodec": "none",
#   "filesize": 150000000,
#   "format_note": "1080p"
# }
```

### Recommended yt-dlp Flags for This Project

```bash
yt-dlp \
  --newline           # Line-buffered progress (critical for parsing)
  --no-colors         # No ANSI escape codes
  --no-mtime          # Don't set file mtime to upload date
  --progress-template "download:{\"status\":\"downloading\",\"percent\":%(progress._percent_str|strip)s,\"downloaded_bytes\":%(progress.downloaded_bytes|default(0))s,\"total_bytes\":%(progress.total_bytes|default(0))s,\"speed\":%(progress.speed|default(0))s,\"eta\":%(progress.eta|default(0))s}" \
  --progress-template "postprocess:{\"status\":\"postprocessing\"}" \
  -f "$FORMAT"        # User-selected format
  -o "$OUTPUT_DIR/%(title)s.%(ext)s" \
  "$URL"
```

### Audio-Only Downloads (Bandcamp, SoundCloud)

```bash
yt-dlp \
  -x                          # Extract audio only
  --audio-format mp3          # Convert to mp3 (or flac, opus, etc.)
  --audio-quality 0           # Best quality
  --embed-thumbnail           # Embed album art
  --add-metadata              # Add metadata tags
  "$URL"
```

---

## Sources

### Primary (Official Documentation) -- High Confidence

- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) -- Authoritative reference for the native messaging protocol, manifest format, message limits, and platform-specific locations.
- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- Official docs on service worker idle timeouts, keepalive mechanisms, and what extends lifetime.
- [WebSocket in Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) -- Official guide on WebSocket usage in MV3 with keepalive pattern.
- [chrome.declarativeContent API](https://developer.chrome.com/docs/extensions/reference/api/declarativeContent) -- API reference for conditional action handling.
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp) -- Official repository with full documentation of --progress-template, --newline, and output template fields.
- [yt-dlp Man Page](https://man.archlinux.org/man/extra/yt-dlp/yt-dlp.1.en) -- Comprehensive reference for all yt-dlp flags and template variables.

### Secondary (Implementation Examples) -- Medium-High Confidence

- [chrome-native-messaging-golang](https://github.com/jfarleyx/chrome-native-messaging-golang) -- Working Go sample of Chrome native messaging with connectNative() persistent port.
- [rickypc/native-messaging-host](https://pkg.go.dev/github.com/rickypc/native-messaging-host) -- Go library with Host struct, PostMessage/OnMessage methods, and auto-install support.
- [lrstanley/go-ytdlp](https://github.com/lrstanley/go-ytdlp) -- Go yt-dlp wrapper with subprocess management, progress parsing, and JSON output handling.
- [yt_dlp_firefox](https://github.com/tyilo/yt_dlp_firefox) -- Firefox extension using native messaging with yt-dlp; demonstrates the companion architecture pattern.
- [youtube-downloader-yt-dlp-local](https://github.com/CosmiX-6/youtube-downloader-yt-dlp-local) -- Chrome extension with local HTTP server pattern for yt-dlp; demonstrates the WebSocket alternative.

### Tertiary (Community Discussion) -- Medium Confidence

- [Chromium Extensions Group: WebSocket vs Native Messaging](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/23pCzk69Ueo/m/z9GH0J7WBQAJ) -- Developer discussion on MV3 WebSocket integration challenges.
- [Service Worker Timeout Issues](https://medium.com/@bhuvan.gandhi/chrome-extension-v3-mitigate-service-worker-timeout-issue-in-the-easiest-way-fccc01877abd) -- Practical workarounds for MV3 service worker lifecycle issues.
- [Native Messaging as Bridge](https://medium.com/fme-developer-stories/native-messaging-as-bridge-between-web-and-desktop-d288ea28cfd7) -- Architecture discussion comparing native messaging vs WebSocket approaches.
- [connectNative keepalive issue #2688](https://github.com/GoogleChrome/developer.chrome.com/issues/2688) -- Documents edge cases where connectNative() keepalive may not work as expected with onConnectExternal.
- [Chromium Issue #40733525](https://issues.chromium.org/issues/40733525) -- Service worker 5-minute shutdown behavior tracking.
