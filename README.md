# ytdlext

Chrome extension + Go companion for one-click video/audio downloads via yt-dlp.

## Supported Sites

| Site | Popup Download | Injected Button |
|------|:-:|:-:|
| YouTube | ✓ | ✓ |
| Vimeo | ✓ | |
| Bandcamp | ✓ | ✓ |
| SoundCloud | ✓ | ✓ |
| CDA | ✓ | |


## Features

- **One-click download** — best quality by default, or pick a format
- **Format picker** — video resolutions (h264) and audio-only (MP3, FLAC, WAV, Ogg)
- **Real-time progress** — speed, ETA, and percentage in the popup
- **Per-site buttons** — injected download buttons on YouTube, SoundCloud, Bandcamp
- **Cancel downloads** — cancel all in-progress downloads from the popup
- **Download history** — last 50 downloads with clickable links
- **Keyboard shortcut** — `Ctrl+Shift+D` to download the current page
- **YouTube extras** — SponsorBlock segment removal, subtitle embedding, cookie auth for age-restricted content
- **Configurable download directory** — set via extension options

## Prerequisites

- [Go](https://go.dev/dl/) 1.21+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) in PATH
- [ffmpeg](https://ffmpeg.org/) in PATH (for video+audio merging)
- Chrome or Chromium-based browser

## Setup

### 1. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` directory
4. Copy the **Extension ID** shown on the card

### 2. Install the companion

#### Windows (PowerShell)

```powershell
cd companion
.\install.ps1 -ExtensionId "your-extension-id"
```

This builds `ytdlext-companion.exe` and registers the native messaging host in the Windows Registry for Chrome and Edge.

#### Linux

```bash
cd companion
./install.sh "your-extension-id"
```

This builds the binary and installs the native messaging host manifest for Chrome/Chromium.

### 3. Restart the browser

Chrome needs a restart to detect the newly registered native messaging host.

## Usage

Navigate to a supported site. The extension icon activates automatically. Click it to open the popup, then hit **Download Best Quality**.

Download progress (speed, ETA, percentage) displays in the popup in real time.

Use `Ctrl+Shift+D` to start a best-quality download without opening the popup.

### Settings

Right-click the extension icon → **Options** to configure the download directory (defaults to `~/Downloads`).

## Architecture

```
extension/          Chrome MV3 extension
  manifest.json     Extension manifest
  service-worker.js Background script (native host connection, message routing)
  content.js        Content script (site detection, button injection, SPA navigation)
  popup.html/js/css Download UI (format picker, progress, history, cancel)
  settings.html/js  Settings page

companion/          Go native messaging host
  main.go           Entry point, message routing
  messaging/        Chrome native messaging protocol (4-byte LE length-prefixed JSON)
  download/         yt-dlp download manager with progress streaming and cancel support
  install.sh        Linux installer
  install.ps1       Windows installer (PowerShell)
```

### How it works

1. Extension detects supported sites via URL matching and activates the popup
2. User clicks download — extension sends a message to the service worker
3. Service worker forwards the request to the Go companion via native messaging
4. Companion runs yt-dlp, streams progress back as JSON messages (every 500ms)
5. Service worker broadcasts progress to the popup for real-time display
6. On completion, the download is added to history in Chrome storage

The service worker sends heartbeats every 25 seconds to stay alive during long downloads (MV3 constraint).
