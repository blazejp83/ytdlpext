// ytdlext popup — shows page info and download action.

document.addEventListener("DOMContentLoaded", () => {
  const pageTitle = document.getElementById("page-title");
  const pageUrl = document.getElementById("page-url");
  const actionSection = document.getElementById("action-section");
  const downloadBtn = document.getElementById("download-btn");
  const statusSection = document.getElementById("status-section");
  const statusText = document.getElementById("status-text");
  const unsupportedSection = document.getElementById("unsupported-section");

  let currentUrl = "";

  // Query the service worker for page info.
  chrome.runtime.sendMessage({ type: "getPageInfo" }, (response) => {
    if (chrome.runtime.lastError) {
      showUnsupported();
      return;
    }

    if (response && response.supported) {
      currentUrl = response.url;
      const title = response.title || "Untitled";
      pageTitle.textContent =
        title.length > 60 ? title.substring(0, 57) + "..." : title;
      pageUrl.textContent = truncateUrl(response.url);
      pageUrl.title = response.url;
      actionSection.hidden = false;
      unsupportedSection.hidden = true;
    } else {
      showUnsupported();
    }
  });

  // Download button click handler.
  downloadBtn.addEventListener("click", () => {
    if (!currentUrl) return;

    downloadBtn.disabled = true;
    downloadBtn.textContent = "Starting...";

    chrome.runtime.sendMessage({
      type: "startDownload",
      url: currentUrl,
      directory: "",
    });

    statusSection.hidden = false;
    statusText.textContent = "Download request sent";
  });

  // Listen for progress/complete/error updates from the service worker.
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "progress") {
      statusSection.hidden = false;
      const pct = Math.round(message.data?.percentage || 0);
      const speed = message.data?.speed || "";
      const eta = message.data?.eta || "";
      statusText.textContent = `${pct}% ${speed} ${eta}`.trim();
    }

    if (message.type === "complete") {
      statusSection.hidden = false;
      statusText.textContent = "Download complete!";
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download Best Quality";
    }

    if (message.type === "error") {
      statusSection.hidden = false;
      statusText.textContent = `Error: ${message.data?.message || "Unknown error"}`;
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download Best Quality";
    }
  });

  function showUnsupported() {
    actionSection.hidden = true;
    unsupportedSection.hidden = false;
    pageTitle.textContent = "ytdlext";
    pageUrl.textContent = "";
  }

  function truncateUrl(url) {
    if (url.length > 50) {
      return url.substring(0, 47) + "...";
    }
    return url;
  }
});
