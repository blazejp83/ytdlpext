// ytdlext service worker — manages native host connection, download state, and message routing.

const NATIVE_HOST = "com.ytdlext.companion";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 25000;

let port = null;
let reconnectAttempts = 0;
let heartbeatTimer = null;

// Page info keyed by tab ID.
const pageInfo = new Map();

// Active download state.
let currentDownload = null;

// Pending format request callback.
let pendingFormatsCallback = null;

// Notification ID -> download directory mapping for "Open Folder" on click.
const notificationDirs = new Map();

// Supported site hostnames (mirrors manifest content_scripts matches).
const SUPPORTED_HOSTS = [
  "youtube.com",
  "vimeo.com",
  "pornhub.com",
  "bandcamp.com",
  "soundcloud.com",
  "ok.ru",
  "cda.pl",
  "xhamster.com",
  "xhamster2.com",
  "xhamster3.com",
  "redgifs.com",
];

function isSupportedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_HOSTS.some(
      (h) => hostname === h || hostname.endsWith("." + h)
    );
  } catch {
    return false;
  }
}

// --- Native host connection ---

function connectToHost() {
  if (port !== null) return;

  try {
    port = chrome.runtime.connectNative(NATIVE_HOST);
  } catch (err) {
    console.error("Failed to connect to native host:", err);
    scheduleReconnect();
    return;
  }

  port.onMessage.addListener((msg) => {
    reconnectAttempts = 0; // Reset on successful message exchange.
    handleNativeMessage(msg);
  });

  port.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.warn("Native host disconnected:", error.message);
    } else {
      console.warn("Native host disconnected");
    }
    port = null;
    stopHeartbeat();
    scheduleReconnect();
  });

  startHeartbeat();
  console.log("Connected to native host");
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(
      `Native host reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts`
    );
    return;
  }
  reconnectAttempts++;
  setTimeout(connectToHost, RECONNECT_DELAY_MS);
}

function sendToHost(message) {
  if (port === null) {
    connectToHost();
  }
  if (port !== null) {
    port.postMessage(message);
  }
}

// --- Native message handling ---

// Reset download badge on the active tab to the default "DL" indicator.
function resetDownloadBadge() {
  chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        const info = pageInfo.get(tabId);
        if (info) {
          chrome.action.setBadgeText({ text: "DL", tabId: tabId });
          chrome.action.setBadgeBackgroundColor({
            color: "#4A90D9",
            tabId: tabId,
          });
        }
      }
    })
    .catch(() => {});
}

function handleNativeMessage(msg) {
  if (msg.type === "progress" && msg.data) {
    currentDownload = {
      ...currentDownload,
      id: msg.data.downloadId || currentDownload?.id,
      status: "downloading",
      percentage: msg.data.percentage || 0,
      speed: msg.data.speed || "",
      eta: msg.data.eta || "",
      filename: msg.data.filename || currentDownload?.filename || "",
    };
    broadcastToPopup({ type: "downloadProgress", ...currentDownload });
    return;
  }

  if (msg.type === "complete" && msg.data) {
    currentDownload = {
      ...currentDownload,
      id: msg.data.downloadId || currentDownload?.id,
      status: "complete",
      percentage: 100,
      url: msg.data.url || currentDownload?.url || "",
      title: msg.data.title || currentDownload?.title || "",
      filename: msg.data.filename || currentDownload?.filename || "",
      path: msg.data.path || "",
      directory: msg.data.directory || "",
    };
    broadcastToPopup({ type: "downloadComplete", ...currentDownload });
    resetDownloadBadge();

    // Create Chrome notification for download completion.
    const notifId = "dl-complete-" + Date.now();
    chrome.notifications.create(notifId, {
      type: "basic",
      title: "Download Complete",
      message: currentDownload.filename || "Download finished",
      iconUrl: "icons/icon128.png",
    });

    // Store directory for "Open Folder" on notification click.
    if (currentDownload.directory) {
      notificationDirs.set(notifId, currentDownload.directory);
    }

    // Store download in history.
    chrome.storage.local.get(["downloadHistory"], (result) => {
      const history = result.downloadHistory || [];
      history.unshift({
        url: currentDownload.url,
        title: currentDownload.title,
        filename: currentDownload.filename,
        directory: currentDownload.directory,
        timestamp: Date.now(),
      });
      // Keep max 50 entries.
      if (history.length > 50) history.length = 50;
      chrome.storage.local.set({ downloadHistory: history });
    });

    // Reset download state after 30 seconds.
    setTimeout(() => {
      if (currentDownload?.status === "complete") {
        currentDownload = null;
      }
    }, 30000);
    return;
  }

  if (msg.type === "cancelled") {
    currentDownload = null;
    broadcastToPopup({ type: "downloadCancelled" });
    resetDownloadBadge();
    return;
  }

  if (msg.type === "error" && msg.data) {
    currentDownload = {
      ...currentDownload,
      id: msg.data.downloadId || currentDownload?.id,
      status: "error",
      errorMessage: msg.data.message || "Unknown error",
    };
    broadcastToPopup({ type: "downloadError", ...currentDownload });
    resetDownloadBadge();
    return;
  }

  // Formats response from companion.
  if (msg.type === "formats" && msg.data) {
    if (pendingFormatsCallback) {
      pendingFormatsCallback(msg.data);
      pendingFormatsCallback = null;
    }
    return;
  }
}

function broadcastToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup may be closed; ignore.
  });
}

// --- Heartbeat ---

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    sendToHost({ type: "ping" });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// --- Notification click handler ---

chrome.notifications.onClicked.addListener((notifId) => {
  const dir = notificationDirs.get(notifId);
  if (dir) {
    sendToHost({ type: "openFolder", data: { path: dir } });
    notificationDirs.delete(notifId);
  }
  chrome.notifications.clear(notifId);
});

// --- Message listeners ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Content script: page detected on a supported site.
  if (message.type === "pageDetected" && sender.tab) {
    pageInfo.set(sender.tab.id, {
      url: message.url,
      title: message.title,
    });

    chrome.action.setBadgeText({ text: "DL", tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({
      color: "#4A90D9",
      tabId: sender.tab.id,
    });
    return;
  }

  // Content script: quick download from injected button.
  if (message.type === "quickDownload") {
    chrome.storage.local.get(["downloadDirectory", "fileExists"], (result) => {
      const directory = result.downloadDirectory || "~/Downloads";
      const fileExists = result.fileExists || "overwrite";
      currentDownload = {
        id: null,
        url: message.url,
        title: message.title || "",
        status: "starting",
        percentage: 0,
        speed: "",
        eta: "",
        filename: "",
      };

      const downloadData = {
        url: message.url,
        directory: directory,
        fileExists: fileExists,
        audioOnly: !!message.audioOnly,
      };
      if (message.audioOnly) downloadData.audioFormat = "mp3";

      // Set badge to indicate active download.
      if (sender.tab) {
        chrome.action.setBadgeText({ text: "DL...", tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({
          color: "#E67E22",
          tabId: sender.tab.id,
        });
      }

      sendToHost({ type: "download", data: downloadData });
      sendResponse({ ok: true });
    });
    return true; // Will respond asynchronously.
  }

  // Popup: get page info for the active tab.
  if (message.type === "getPageInfo") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs.length === 0) {
          sendResponse({ supported: false });
          return;
        }
        const tab = tabs[0];
        const info = pageInfo.get(tab.id);
        if (info) {
          sendResponse({ url: info.url, title: info.title, supported: true });
        } else if (tab.url && isSupportedUrl(tab.url)) {
          // Fallback: content script may not have reported yet (SPA race).
          pageInfo.set(tab.id, { url: tab.url, title: tab.title || "" });
          sendResponse({ url: tab.url, title: tab.title || "", supported: true });
        } else {
          sendResponse({ supported: false });
        }
      })
      .catch(() => {
        sendResponse({ supported: false });
      });
    return true; // Will respond asynchronously.
  }

  // Popup: get formats for a URL.
  if (message.type === "getFormats") {
    pendingFormatsCallback = (data) => {
      sendResponse(data);
    };
    sendToHost({ type: "getFormats", data: { url: message.url } });

    // Timeout after 30 seconds if companion doesn't respond.
    setTimeout(() => {
      if (pendingFormatsCallback) {
        pendingFormatsCallback = null;
        sendResponse({ error: "Format query timed out" });
      }
    }, 30000);

    return true; // Will respond asynchronously.
  }

  // Popup: start a download.
  if (message.type === "startDownload") {
    chrome.storage.local.get(["downloadDirectory", "fileExists"], (result) => {
      const directory = result.downloadDirectory || "~/Downloads";
      const fileExists = result.fileExists || "overwrite";
      currentDownload = {
        id: null,
        url: message.url,
        title: message.title || "",
        status: "starting",
        percentage: 0,
        speed: "",
        eta: "",
        filename: "",
      };

      const downloadData = { url: message.url, directory: directory, fileExists: fileExists };

      // Pass format options if provided.
      if (message.formatId) downloadData.formatId = message.formatId;
      if (message.audioOnly) downloadData.audioOnly = message.audioOnly;
      if (message.audioFormat) downloadData.audioFormat = message.audioFormat;
      if (message.embedMetadata !== undefined)
        downloadData.embedMetadata = message.embedMetadata;
      if (message.embedThumbnail !== undefined)
        downloadData.embedThumbnail = message.embedThumbnail;

      // Pass Phase 3 options if provided.
      if (message.sponsorBlockRemove)
        downloadData.sponsorBlockRemove = message.sponsorBlockRemove;
      if (message.subtitleLangs)
        downloadData.subtitleLangs = message.subtitleLangs;
      if (message.embedSubs !== undefined)
        downloadData.embedSubs = message.embedSubs;
      if (message.useBrowserCookies)
        downloadData.useBrowserCookies = message.useBrowserCookies;

      sendToHost({
        type: "download",
        data: downloadData,
      });
      sendResponse({ ok: true });
    });
    return true; // Will respond asynchronously.
  }

  // Popup: open folder.
  if (message.type === "openFolder") {
    sendToHost({ type: "openFolder", data: { path: message.path } });
    return;
  }

  // Popup: cancel the current download.
  if (message.type === "cancelDownload") {
    sendToHost({ type: "cancelAll" });
    currentDownload = null;
    resetDownloadBadge();
    sendResponse({ ok: true });
    return true;
  }

  // Popup: get current download state (for reopening mid-download).
  if (message.type === "getDownloadState") {
    sendResponse({ download: currentDownload });
    return;
  }
});

// --- Tab lifecycle ---

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    pageInfo.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pageInfo.delete(tabId);
});

// --- Keyboard shortcut ---

chrome.commands.onCommand.addListener((command) => {
  if (command !== "download-current") return;
  chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs.length === 0) return;
    const tab = tabs[0];
    const info = pageInfo.get(tab.id);
    if (!info) return;
    if (!isSupportedUrl(info.url)) return;

    // Determine if audio-primary site.
    const hostname = new URL(info.url).hostname;
    const audioOnly = ["soundcloud.com", "bandcamp.com"].some(
      (h) => hostname === h || hostname.endsWith("." + h)
    );

    // Trigger quick download with defaults.
    chrome.storage.local.get(["downloadDirectory", "fileExists"], (result) => {
      const directory = result.downloadDirectory || "~/Downloads";
      const fileExists = result.fileExists || "overwrite";
      currentDownload = {
        id: null,
        url: info.url,
        title: info.title || "",
        status: "starting",
        percentage: 0,
        speed: "",
        eta: "",
        filename: "",
      };
      const downloadData = {
        url: info.url,
        directory,
        fileExists,
        audioOnly,
      };
      if (audioOnly) downloadData.audioFormat = "mp3";
      sendToHost({ type: "download", data: downloadData });
    });
  });
});

// --- Initialization ---

connectToHost();
