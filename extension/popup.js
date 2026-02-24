// ytdlext popup — shows page info, download action, and real-time progress.

document.addEventListener("DOMContentLoaded", () => {
  const pageTitle = document.getElementById("page-title");
  const pageUrl = document.getElementById("page-url");
  const actionSection = document.getElementById("action-section");
  const downloadBtn = document.getElementById("download-btn");
  const progressSection = document.getElementById("progress-section");
  const progressFill = document.getElementById("progress-fill");
  const progressPct = document.getElementById("progress-pct");
  const progressSpeed = document.getElementById("progress-speed");
  const progressEta = document.getElementById("progress-eta");
  const progressFilename = document.getElementById("progress-filename");
  const completeSection = document.getElementById("complete-section");
  const completeFilename = document.getElementById("complete-filename");
  const downloadAnotherBtn = document.getElementById("download-another-btn");
  const errorSection = document.getElementById("error-section");
  const errorText = document.getElementById("error-text");
  const retryBtn = document.getElementById("retry-btn");
  const unsupportedSection = document.getElementById("unsupported-section");
  const settingsBtn = document.getElementById("settings-btn");

  let currentUrl = "";
  let currentTitle = "";

  // Query the service worker for page info.
  chrome.runtime.sendMessage({ type: "getPageInfo" }, (response) => {
    if (chrome.runtime.lastError) {
      showUnsupported();
      return;
    }

    if (response && response.supported) {
      currentUrl = response.url;
      currentTitle = response.title || "";
      const title = response.title || "Untitled";
      pageTitle.textContent =
        title.length > 60 ? title.substring(0, 57) + "..." : title;
      pageUrl.textContent = truncateUrl(response.url);
      pageUrl.title = response.url;

      // Check for in-progress download before showing download button.
      chrome.runtime.sendMessage({ type: "getDownloadState" }, (state) => {
        if (chrome.runtime.lastError || !state?.download) {
          showIdle();
          return;
        }

        const dl = state.download;
        switch (dl.status) {
          case "starting":
          case "downloading":
            showProgress(dl);
            break;
          case "complete":
            showComplete(dl.filename);
            break;
          case "error":
            showError(dl.errorMessage);
            break;
          default:
            showIdle();
        }
      });
    } else {
      showUnsupported();
    }
  });

  // Download button click handler.
  downloadBtn.addEventListener("click", startDownload);

  // Retry button click handler.
  retryBtn.addEventListener("click", startDownload);

  // Download another button click handler.
  downloadAnotherBtn.addEventListener("click", () => {
    showIdle();
  });

  // Settings button opens the options page.
  settingsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open("settings.html");
    }
  });

  // Listen for messages from service worker.
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "downloadProgress") {
      showProgress(message);
    }

    if (message.type === "downloadComplete") {
      showComplete(message.filename);
    }

    if (message.type === "downloadError") {
      showError(message.errorMessage || "Unknown error");
    }
  });

  function startDownload() {
    if (!currentUrl) return;

    hideAll();
    progressSection.hidden = false;
    progressFill.style.width = "0%";
    progressPct.textContent = "0%";
    progressSpeed.textContent = "";
    progressEta.textContent = "";
    progressFilename.textContent = "Starting download...";

    chrome.runtime.sendMessage({
      type: "startDownload",
      url: currentUrl,
      title: currentTitle,
    });
  }

  function showIdle() {
    hideAll();
    actionSection.hidden = false;
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download Best Quality";
  }

  function showProgress(dl) {
    hideAll();
    progressSection.hidden = false;

    const pct = Math.round(dl.percentage || 0);
    progressFill.style.width = pct + "%";
    progressPct.textContent = pct + "%";
    progressSpeed.textContent = dl.speed || "";
    progressEta.textContent = dl.eta ? "ETA " + dl.eta : "";
    if (dl.filename) {
      progressFilename.textContent = dl.filename;
    }
  }

  function showComplete(filename) {
    hideAll();
    completeSection.hidden = false;
    if (filename) {
      completeFilename.textContent = filename;
    }
  }

  function showError(message) {
    hideAll();
    errorSection.hidden = false;
    errorText.textContent = message || "An unknown error occurred";
  }

  function showUnsupported() {
    hideAll();
    unsupportedSection.hidden = false;
    pageTitle.textContent = "ytdlext";
    pageUrl.textContent = "";
  }

  function hideAll() {
    actionSection.hidden = true;
    progressSection.hidden = true;
    completeSection.hidden = true;
    errorSection.hidden = true;
    unsupportedSection.hidden = true;
  }

  function truncateUrl(url) {
    if (url.length > 50) {
      return url.substring(0, 47) + "...";
    }
    return url;
  }
});
