// ytdlext popup — shows page info, format picker, download action, and real-time progress.

document.addEventListener("DOMContentLoaded", () => {
  const pageTitle = document.getElementById("page-title");
  const pageUrl = document.getElementById("page-url");
  const formatPicker = document.getElementById("format-picker");
  const loadingSection = document.getElementById("loading-section");
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

  // Format picker elements.
  const tabVideo = document.getElementById("tab-video");
  const tabAudio = document.getElementById("tab-audio");
  const tabContentVideo = document.getElementById("tab-content-video");
  const tabContentAudio = document.getElementById("tab-content-audio");
  const formatList = document.getElementById("format-list");
  const videoDownloadBtn = document.getElementById("video-download-btn");
  const audioDownloadBtn = document.getElementById("audio-download-btn");
  const embedMetadata = document.getElementById("embed-metadata");
  const embedThumbnail = document.getElementById("embed-thumbnail");

  // Options section elements.
  const youtubeOptions = document.getElementById("youtube-options");
  const sponsorblockCheck = document.getElementById("sponsorblock");
  const subtitleLangSelect = document.getElementById("subtitle-lang");
  const embedSubsCheck = document.getElementById("embed-subs");
  const useCookiesCheck = document.getElementById("use-cookies");

  const AUDIO_PRIMARY_HOSTS = ["soundcloud.com", "bandcamp.com"];

  let currentUrl = "";
  let currentTitle = "";
  let isAudioPrimary = false;
  let selectedAudioFormat = "mp3";
  let lastDownloadOptions = {};

  // Query the service worker for page info.
  chrome.runtime.sendMessage({ type: "getPageInfo" }, (response) => {
    if (chrome.runtime.lastError) {
      showUnsupported();
      return;
    }

    if (response && response.supported) {
      currentUrl = response.url;
      currentTitle = response.title || "";
      try {
        const hostname = new URL(currentUrl).hostname;
        isAudioPrimary = AUDIO_PRIMARY_HOSTS.some(
          (h) => hostname === h || hostname.endsWith("." + h)
        );
        // Show YouTube-specific options only on YouTube.
        if (hostname.includes("youtube.com")) {
          youtubeOptions.hidden = false;
        }
      } catch {}

      const title = response.title || "Untitled";
      pageTitle.textContent =
        title.length > 60 ? title.substring(0, 57) + "..." : title;
      pageUrl.textContent = truncateUrl(response.url);
      pageUrl.title = response.url;

      // Check for in-progress download before showing format picker.
      chrome.runtime.sendMessage({ type: "getDownloadState" }, (state) => {
        if (chrome.runtime.lastError || !state?.download) {
          loadFormats();
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
            loadFormats();
        }
      });
    } else {
      showUnsupported();
    }
  });

  // Load formats from companion.
  function loadFormats() {
    hideAll();
    loadingSection.hidden = false;

    chrome.runtime.sendMessage(
      { type: "getFormats", url: currentUrl },
      (response) => {
        if (chrome.runtime.lastError || !response || response.error) {
          // Fallback to simple "Best Quality" button if format query fails.
          showIdle();
          return;
        }

        populateFormats(response);
        hideAll();
        formatPicker.hidden = false;

        const hasVideoFormats = (response.videoFormats || []).length > 0;
        if (isAudioPrimary || !hasVideoFormats) {
          // Audio-primary site or no video formats: show Audio tab only.
          tabVideo.hidden = true;
          tabAudio.classList.add("active");
          tabVideo.classList.remove("active");
          tabContentVideo.hidden = true;
          tabContentAudio.hidden = false;
        }
      }
    );
  }

  // Populate format list from companion response.
  function populateFormats(data) {
    // Clear existing format rows (keep "Best Quality" default).
    const bestQualityRow = formatList.querySelector(".format-row");
    formatList.innerHTML = "";
    formatList.appendChild(bestQualityRow);

    // Add video formats.
    const videoFormats = data.videoFormats || [];
    videoFormats.forEach((fmt) => {
      const row = document.createElement("label");
      row.className = "format-row";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "video-format";
      radio.value = fmt.formatId || "";

      const label = document.createElement("span");
      label.className = "format-label";
      label.textContent = fmt.resolution || fmt.formatId || "Unknown";

      const detail = document.createElement("span");
      detail.className = "format-detail";
      const parts = [];
      if (fmt.vcodec) parts.push(fmt.vcodec);
      if (fmt.fps && fmt.fps > 30) parts.push(fmt.fps + "fps");
      if (fmt.filesize) parts.push(formatFileSize(fmt.filesize));
      detail.textContent = parts.join(" | ");

      row.appendChild(radio);
      row.appendChild(label);
      row.appendChild(detail);
      formatList.appendChild(row);
    });

    // Attach click handlers for format row highlighting.
    formatList.querySelectorAll(".format-row").forEach((row) => {
      row.addEventListener("click", () => {
        formatList
          .querySelectorAll(".format-row")
          .forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
      });
    });

    // Populate subtitle language dropdown.
    const subtitles = data.subtitles || [];
    subtitleLangSelect.innerHTML = '<option value="">None</option>';
    subtitles.forEach((sub) => {
      const opt = document.createElement("option");
      opt.value = sub.code;
      opt.textContent = sub.auto ? sub.name + " (auto)" : sub.name;
      subtitleLangSelect.appendChild(opt);
    });
  }

  // Format file size for display.
  function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  // Tab switching.
  tabVideo.addEventListener("click", () => {
    tabVideo.classList.add("active");
    tabAudio.classList.remove("active");
    tabContentVideo.hidden = false;
    tabContentAudio.hidden = true;
  });

  tabAudio.addEventListener("click", () => {
    tabAudio.classList.add("active");
    tabVideo.classList.remove("active");
    tabContentAudio.hidden = false;
    tabContentVideo.hidden = true;
  });

  // Audio format chip selection.
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document
        .querySelectorAll(".chip")
        .forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectedAudioFormat = chip.dataset.format;
    });
  });

  // Video download button.
  videoDownloadBtn.addEventListener("click", () => {
    const selected = formatList.querySelector(
      'input[name="video-format"]:checked'
    );
    const formatId = selected ? selected.value : "";
    startDownload({ formatId });
  });

  // Audio download button.
  audioDownloadBtn.addEventListener("click", () => {
    startDownload({
      audioOnly: true,
      audioFormat: selectedAudioFormat,
      embedMetadata: embedMetadata.checked,
      embedThumbnail: embedThumbnail.checked,
    });
  });

  // Fallback download button click handler.
  downloadBtn.addEventListener("click", () => startDownload({}));

  // Retry button click handler.
  retryBtn.addEventListener("click", () => startDownload(lastDownloadOptions));

  // Download another button click handler.
  downloadAnotherBtn.addEventListener("click", () => {
    loadFormats();
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

  function startDownload(options) {
    if (!currentUrl) return;
    lastDownloadOptions = options;

    hideAll();
    progressSection.hidden = false;
    progressFill.style.width = "0%";
    progressPct.textContent = "0%";
    progressSpeed.textContent = "";
    progressEta.textContent = "";
    progressFilename.textContent = "Starting download...";

    // Include Phase 3 options.
    const phase3Options = {};
    if (sponsorblockCheck.checked) phase3Options.sponsorBlockRemove = "all";
    const subLang = subtitleLangSelect.value;
    if (subLang) phase3Options.subtitleLangs = subLang;
    phase3Options.embedSubs = embedSubsCheck.checked;
    phase3Options.useBrowserCookies = useCookiesCheck.checked;

    chrome.runtime.sendMessage({
      type: "startDownload",
      url: currentUrl,
      title: currentTitle,
      ...options,
      ...phase3Options,
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
    formatPicker.hidden = true;
    loadingSection.hidden = true;
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
