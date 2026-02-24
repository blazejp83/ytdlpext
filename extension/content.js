// ytdlext content script — detects supported pages and notifies the service worker.

(function () {
  "use strict";

  function notifyPageDetected() {
    chrome.runtime.sendMessage({
      type: "pageDetected",
      url: location.href,
      title: document.title,
    });
  }

  // Initial detection on page load.
  notifyPageDetected();

  // YouTube SPA navigation handling.
  // YouTube fires a custom event when navigating within the SPA.
  document.addEventListener("yt-navigate-finish", () => {
    notifyPageDetected();
  });

  // Generic SPA navigation handling.
  if (typeof navigation !== "undefined" && navigation.addEventListener) {
    // Modern Navigation API (Chrome 102+).
    navigation.addEventListener("navigateSuccess", () => {
      notifyPageDetected();
    });
  } else {
    // Fallback: popstate and hashchange for older SPA patterns.
    let lastUrl = location.href;

    function checkUrlChange() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        notifyPageDetected();
      }
    }

    window.addEventListener("popstate", checkUrlChange);
    window.addEventListener("hashchange", checkUrlChange);
  }
})();
