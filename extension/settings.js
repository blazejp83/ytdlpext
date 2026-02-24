// ytdlext settings — download directory configuration.

document.addEventListener("DOMContentLoaded", () => {
  const downloadDir = document.getElementById("download-dir");
  const saveBtn = document.getElementById("save-btn");
  const saveStatus = document.getElementById("save-status");

  let fadeTimer = null;

  // Load saved directory on open.
  chrome.storage.local.get("downloadDirectory", (result) => {
    if (result.downloadDirectory) {
      downloadDir.value = result.downloadDirectory;
    }
  });

  // Save button click handler.
  saveBtn.addEventListener("click", () => {
    const value = downloadDir.value.trim();
    if (!value) {
      downloadDir.focus();
      return;
    }

    chrome.storage.local.set({ downloadDirectory: value }, () => {
      // Show "Saved!" confirmation.
      saveStatus.classList.add("visible");

      if (fadeTimer) {
        clearTimeout(fadeTimer);
      }
      fadeTimer = setTimeout(() => {
        saveStatus.classList.remove("visible");
        fadeTimer = null;
      }, 2000);
    });
  });

  // Allow saving with Enter key.
  downloadDir.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    }
  });
});
