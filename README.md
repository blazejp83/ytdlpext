# ytdlext

Chrome extension + Go companion for one-click video/audio downloads via yt-dlp.

Supports YouTube, Vimeo, Pornhub, Bandcamp, and SoundCloud.

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

### Settings

Right-click the extension icon → **Options** to configure the download directory (defaults to `~/Downloads`).

## Project Structure

```
extension/          Chrome MV3 extension
  manifest.json     Extension manifest
  service-worker.js Background script (native host connection, message routing)
  content.js        Content script (site detection, SPA navigation)
  popup.html/js/css Download UI
  settings.html/js  Settings page

companion/          Go native messaging host
  main.go           Entry point, message routing
  messaging/        Chrome native messaging protocol (length-prefixed JSON)
  download/         yt-dlp download manager with progress streaming
  install.sh        Linux installer
  install.ps1       Windows installer (PowerShell)
```
