package download

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/lrstanley/go-ytdlp"

	"ytdlext-companion/messaging"
)

// Manager handles yt-dlp downloads and streams progress back via native messaging.
type Manager struct {
	messageWriter func(*messaging.Message)
	mu            sync.Mutex
	active        map[string]context.CancelFunc
}

// NewManager creates a Manager that sends messages through the provided callback.
func NewManager(writer func(*messaging.Message)) *Manager {
	return &Manager{
		messageWriter: writer,
		active:        make(map[string]context.CancelFunc),
	}
}

// StartDownload runs a yt-dlp download in a goroutine. It streams progress
// updates and sends complete/error messages when finished.
func (m *Manager) StartDownload(req *messaging.DownloadRequest) {
	downloadID := fmt.Sprintf("dl-%d", time.Now().UnixNano())

	ctx, cancel := context.WithCancel(context.Background())
	m.mu.Lock()
	m.active[downloadID] = cancel
	m.mu.Unlock()

	go m.runDownload(ctx, downloadID, req)
}

// CancelAll cancels all active downloads.
func (m *Manager) CancelAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, cancel := range m.active {
		cancel()
	}
	m.active = make(map[string]context.CancelFunc)
}

func (m *Manager) runDownload(ctx context.Context, downloadID string, req *messaging.DownloadRequest) {
	defer func() {
		m.mu.Lock()
		delete(m.active, downloadID)
		m.mu.Unlock()
	}()

	dir := req.Directory
	if dir == "" {
		dir = "~/Downloads"
	}
	// Expand ~ to home directory for consistent path handling.
	if strings.HasPrefix(dir, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			dir = filepath.Join(home, dir[2:])
		}
	}

	outputTmpl := "%(title)s.%(ext)s"

	// Handle file-exists policy for rename: find next available counter.
	if req.FileExists == "rename" {
		if n := findNextCounter(dir); n > 0 {
			outputTmpl = fmt.Sprintf("%%(title)s (%d).%%(ext)s", n)
		}
	}

	var progressSeen bool

	cmd := ytdlp.New().
		Output(outputTmpl).
		Paths(dir).
		Progress().
		ProgressFunc(500*time.Millisecond, func(update ytdlp.ProgressUpdate) {
			progressSeen = true
			speed := humanizeBytes(m.calcSpeed(update)) + "/s"
			eta := formatETA(update.ETA())
			filename := filepath.Base(update.Filename)

			m.send(messaging.TypeProgress, &messaging.ProgressUpdate{
				DownloadID: downloadID,
				Percentage: update.Percent(),
				Speed:      speed,
				ETA:        eta,
				Filename:   filename,
			})
		})

	if req.AudioOnly {
		// Audio extraction mode.
		cmd.ExtractAudio()
		audioFmt := req.AudioFormat
		if audioFmt == "" {
			audioFmt = "mp3"
		}
		cmd.AudioFormat(audioFmt)
		if audioFmt == "mp3" {
			cmd.AudioQuality("0")
		}
	} else if req.FormatID != "" {
		// Specific format selection with original audio merge.
		formatStr := req.FormatID + "+ba[language_preference>=10]/" +
			req.FormatID + "+bestaudio/" + req.FormatID
		log.Printf("download format string: %s", formatStr)
		cmd.Format(formatStr)
		cmd.MergeOutputFormat("mp4/mkv") // MP4 if compatible, MKV otherwise.
	} else {
		// Default: best video + original audio merged.
		// ext:mp4:m4a prefers AVC+AAC where available, VP9+Opus for higher res.
		formatStr := "bv*+ba[language_preference>=10]/bv*+ba/b"
		log.Printf("download format string: %s", formatStr)
		cmd.Format(formatStr)
		cmd.MergeOutputFormat("mp4/mkv") // MP4 if compatible, MKV otherwise.
		cmd.FormatSort("lang,res,ext:mp4:m4a")
	}

	if req.EmbedMetadata {
		cmd.EmbedMetadata()
	}
	if req.EmbedThumbnail {
		cmd.EmbedThumbnail()
	}

	if req.SponsorBlockRemove != "" {
		cmd.SponsorblockRemove(req.SponsorBlockRemove)
	}

	if req.SubtitleLangs != "" {
		cmd.WriteSubs()
		cmd.SubLangs(req.SubtitleLangs)
		if req.EmbedSubs {
			cmd.EmbedSubs()
		}
	}

	if req.UseBrowserCookies {
		browser := "chrome"
		if runtime.GOOS == "linux" {
			browser = "chromium"
		}
		cmd.CookiesFromBrowser(browser)
	}

	// Apply file-exists policy flags.
	switch req.FileExists {
	case "skip":
		cmd.NoOverwrites()
	case "rename":
		cmd.ForceOverwrites()
	default: // "overwrite" or empty
		cmd.ForceOverwrites()
	}

	result, err := cmd.Run(ctx, req.URL)
	if err != nil {
		if ctx.Err() == context.Canceled {
			log.Printf("download cancelled for %s", req.URL)
			m.send(messaging.TypeCancelled, &messaging.CancelledResponse{
				DownloadID: downloadID,
			})
			return
		}
		log.Printf("yt-dlp error for %s: %v", req.URL, err)
		m.send(messaging.TypeError, &messaging.ErrorResponse{
			DownloadID: downloadID,
			Message:    friendlyError(err.Error()),
		})
		return
	}

	// If skip mode and no progress was reported, the file already existed.
	if req.FileExists == "skip" && !progressSeen {
		m.send(messaging.TypeError, &messaging.ErrorResponse{
			DownloadID: downloadID,
			Message:    "File already exists — skipped (change in Settings)",
		})
		return
	}

	// Try to extract filename and title from result.
	filename := ""
	title := ""
	if infos, infoErr := result.GetExtractedInfo(); infoErr == nil && len(infos) > 0 {
		info := infos[0]
		if info.Filename != nil {
			filename = *info.Filename
		}
		if info.Title != nil {
			title = *info.Title
		}
	}

	// Determine the directory from the resolved path, or fall back to configured dir.
	outputDir := dir
	if filename != "" {
		outputDir = filepath.Dir(filename)
	}

	m.send(messaging.TypeComplete, &messaging.DownloadComplete{
		DownloadID: downloadID,
		Filename:   filepath.Base(filename),
		Path:       filename,
		Directory:  outputDir,
		URL:        req.URL,
		Title:      title,
	})
}

// findNextCounter scans the download directory for files with counter suffixes
// like "title (1).ext" and returns the next available counter. Returns 0 if no
// files exist (no rename needed).
func findNextCounter(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}

	maxCounter := 0
	for _, e := range entries {
		name := e.Name()
		// Look for " (N)" pattern before the extension.
		idx := strings.LastIndex(name, " (")
		if idx < 0 {
			continue
		}
		rest := name[idx+2:]
		endIdx := strings.Index(rest, ")")
		if endIdx < 0 {
			continue
		}
		var n int
		if _, err := fmt.Sscanf(rest[:endIdx], "%d", &n); err == nil && n > maxCounter {
			maxCounter = n
		}
	}
	if maxCounter > 0 {
		return maxCounter + 1
	}
	// No counter files exist, but we're in rename mode so file likely exists.
	return 1
}

func (m *Manager) send(msgType string, data interface{}) {
	msg, err := messaging.NewMessage(msgType, data)
	if err != nil {
		return
	}
	m.messageWriter(msg)
}

// calcSpeed computes bytes/second from download progress.
func (m *Manager) calcSpeed(update ytdlp.ProgressUpdate) int64 {
	elapsed := update.Duration().Seconds()
	if elapsed <= 0 {
		return 0
	}
	return int64(float64(update.DownloadedBytes) / elapsed)
}

// humanizeBytes formats a byte count into a human-readable string.
func humanizeBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

// formatETA returns a human-readable ETA string.
func formatETA(d time.Duration) string {
	if d <= 0 {
		return ""
	}
	d = d.Round(time.Second)
	m := d / time.Minute
	s := (d - m*time.Minute) / time.Second
	if m > 0 {
		return fmt.Sprintf("%dm%02ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}

// friendlyError maps common yt-dlp errors to user-friendly messages.
func friendlyError(msg string) string {
	lower := strings.ToLower(msg)

	switch {
	case strings.Contains(lower, "is not a valid url"):
		return "Invalid URL"
	case strings.Contains(lower, "unsupported url"):
		return "This site or URL is not supported by yt-dlp"
	case strings.Contains(lower, "ffmpeg") && (strings.Contains(lower, "audio") || strings.Contains(lower, "extract")):
		return "ffmpeg is required for audio extraction. Install it: https://ffmpeg.org/download.html"
	case strings.Contains(lower, "ffmpeg") && (strings.Contains(lower, "mux") || strings.Contains(lower, "merge")):
		return "ffmpeg is required to merge video and audio. Install it: https://ffmpeg.org/download.html"
	case strings.Contains(lower, "ffmpeg"):
		return "ffmpeg is required but not found. Install it: https://ffmpeg.org/download.html"
	case strings.Contains(lower, "requested format") && strings.Contains(lower, "not available"):
		return "The selected format is no longer available. Try refreshing formats."
	case strings.Contains(lower, "sign in"), strings.Contains(lower, "age"):
		return "This video requires authentication. Try enabling 'Use browser cookies' in the extension and make sure you're logged in on the site."
	case strings.Contains(lower, "connection") || strings.Contains(lower, "network") ||
		strings.Contains(lower, "timed out") || strings.Contains(lower, "unable to download"):
		return "Network error \u2014 check your internet connection"
	case strings.Contains(lower, "too many requests") || strings.Contains(lower, "429") ||
		strings.Contains(lower, "rate limit"):
		return "Too many requests \u2014 wait a moment and try again"
	default:
		return msg
	}
}
