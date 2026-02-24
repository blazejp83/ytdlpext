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
      filename: msg.data.filename || currentDownload?.filename || "",
      path: msg.data.path || "",
    };
    broadcastToPopup({ type: "downloadComplete", ...currentDownload });

    // Reset download state after 30 seconds.
    setTimeout(() => {
      if (currentDownload?.status === "complete") {
        currentDownload = null;
      }
    }, 30000);
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

  // Popup: get page info for the active tab.
  if (message.type === "getPageInfo") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs.length === 0) {
          sendResponse({ supported: false });
          return;
        }
        const tabId = tabs[0].id;
        const info = pageInfo.get(tabId);
        if (info) {
          sendResponse({ url: info.url, title: info.title, supported: true });
        } else {
          sendResponse({ supported: false });
        }
      })
      .catch(() => {
        sendResponse({ supported: false });
      });
    return true; // Will respond asynchronously.
  }

  // Popup: start a download.
  if (message.type === "startDownload") {
    chrome.storage.local.get("downloadDirectory", (result) => {
      const directory = result.downloadDirectory || "~/Downloads";
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
      sendToHost({
        type: "download",
        data: { url: message.url, directory: directory },
      });
      sendResponse({ ok: true });
    });
    return true; // Will respond asynchronously.
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

// --- Initialization ---

connectToHost();
