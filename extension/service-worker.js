// ytdlext service worker — manages native host connection and message routing.

const NATIVE_HOST = "com.ytdlext.companion";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 25000;

let port = null;
let reconnectAttempts = 0;
let heartbeatTimer = null;

// Page info keyed by tab ID.
const pageInfo = new Map();

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

    // Forward progress/complete/error messages to popup.
    if (msg.type === "progress" || msg.type === "complete" || msg.type === "error") {
      chrome.runtime.sendMessage(msg).catch(() => {
        // Popup may be closed; ignore.
      });
    }
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
    sendToHost({
      type: "download",
      data: { url: message.url, directory: message.directory || "" },
    });
    sendResponse({ ok: true });
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
