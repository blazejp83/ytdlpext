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

// Download button injection for supported sites.
(function () {
  "use strict";

  const DL_BTN_CLASS = "ytdlext-dl-btn";

  let stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
      .${DL_BTN_CLASS} {
        transition: background-color 0.15s ease;
      }
      .${DL_BTN_CLASS}:hover {
        background-color: #333 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function createButton(label, audioOnly) {
    injectStyles();
    const btn = document.createElement("button");
    btn.className = DL_BTN_CLASS;
    btn.style.cssText =
      "display:inline-flex;align-items:center;gap:4px;padding:6px 12px;" +
      "background:#1a1a1a;opacity:0.9;color:#fff;font-size:12px;font-family:inherit;" +
      "border:none;border-radius:20px;cursor:pointer;line-height:1;white-space:nowrap;" +
      "margin-left:8px;vertical-align:middle;";

    // Inline SVG download arrow icon.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML =
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>';
    btn.appendChild(svg);

    const span = document.createElement("span");
    span.textContent = label;
    btn.appendChild(span);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: "quickDownload",
        url: location.href,
        title: document.title,
        audioOnly: audioOnly,
      });
    });

    return btn;
  }

  // --- YouTube injection ---
  function injectYouTube() {
    function tryInject() {
      if (document.querySelector("." + DL_BTN_CLASS)) return;
      const owner = document.querySelector("#owner");
      if (!owner) return;
      owner.appendChild(createButton("Download", false));
    }

    // Observe for #owner appearing (YouTube loads dynamically).
    const observer = new MutationObserver(() => {
      tryInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // On SPA navigation, remove old button and re-observe.
    document.addEventListener("yt-navigate-finish", () => {
      const old = document.querySelector("." + DL_BTN_CLASS);
      if (old) old.remove();
      // Re-try injection after navigation settles.
      setTimeout(tryInject, 500);
    });

    // Initial attempt.
    tryInject();
  }

  // --- SoundCloud injection ---
  function injectSoundCloud() {
    function tryInject() {
      if (document.querySelector("." + DL_BTN_CLASS)) return;
      const actions = document.querySelector(".soundActions");
      if (!actions) return;
      actions.appendChild(createButton("Download", true));
    }

    const observer = new MutationObserver(() => {
      tryInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    tryInject();
  }

  // --- Bandcamp injection ---
  function injectBandcamp() {
    function tryInject() {
      if (document.querySelector("." + DL_BTN_CLASS)) return;
      const target =
        document.querySelector(".tralbumCommands") ||
        document.querySelector(".buyButtons") ||
        document.querySelector("#trackInfoInner");
      if (!target) return;
      target.appendChild(createButton("Download", true));
    }

    const observer = new MutationObserver(() => {
      tryInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    tryInject();
  }

  // Determine site and inject.
  const hostname = location.hostname;
  if (hostname.includes("youtube.com")) {
    injectYouTube();
  } else if (hostname.includes("soundcloud.com")) {
    injectSoundCloud();
  } else if (hostname.includes("bandcamp.com")) {
    injectBandcamp();
  }
})();
