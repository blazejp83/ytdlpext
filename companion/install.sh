#!/usr/bin/env bash
set -euo pipefail

EXTENSION_ID="${1:-}"
if [ -z "$EXTENSION_ID" ]; then
    echo "Usage: $0 <chrome-extension-id>"
    echo ""
    echo "  The extension ID can be found at chrome://extensions after loading"
    echo "  the extension in developer mode."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building ytdlext-companion..."
go build -o ytdlext-companion .
BINARY_PATH="$(pwd)/ytdlext-companion"
echo "Built: $BINARY_PATH"

echo "Generating host manifest..."
MANIFEST=$(cat host-manifest.json \
    | sed "s|PLACEHOLDER_BINARY_PATH|$BINARY_PATH|g" \
    | sed "s|PLACEHOLDER_EXTENSION_ID|$EXTENSION_ID|g")

MANIFEST_NAME="com.ytdlext.companion.json"
INSTALLED=0

# Chrome
CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
if [ -d "$HOME/.config/google-chrome" ]; then
    mkdir -p "$CHROME_DIR"
    echo "$MANIFEST" > "$CHROME_DIR/$MANIFEST_NAME"
    echo "Installed manifest to: $CHROME_DIR/$MANIFEST_NAME"
    INSTALLED=1
fi

# Chromium
CHROMIUM_DIR="$HOME/.config/chromium/NativeMessagingHosts"
if [ -d "$HOME/.config/chromium" ]; then
    mkdir -p "$CHROMIUM_DIR"
    echo "$MANIFEST" > "$CHROMIUM_DIR/$MANIFEST_NAME"
    echo "Installed manifest to: $CHROMIUM_DIR/$MANIFEST_NAME"
    INSTALLED=1
fi

if [ "$INSTALLED" -eq 0 ]; then
    echo "Warning: Neither Chrome nor Chromium config directory found."
    echo "Creating Chrome directory and installing..."
    mkdir -p "$CHROME_DIR"
    echo "$MANIFEST" > "$CHROME_DIR/$MANIFEST_NAME"
    echo "Installed manifest to: $CHROME_DIR/$MANIFEST_NAME"
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Load the extension at chrome://extensions (developer mode)"
echo "  2. Copy the extension ID"
echo "  3. Re-run this script if the extension ID has changed"
echo "  4. Restart Chrome to pick up the native messaging host"
