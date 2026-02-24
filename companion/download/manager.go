package download

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/lrstanley/go-ytdlp"

	"ytdlext-companion/messaging"
)

// Manager handles yt-dlp downloads and streams progress back via native messaging.
type Manager struct {
	messageWriter func(*messaging.Message)
}

// NewManager creates a Manager that sends messages through the provided callback.
func NewManager(writer func(*messaging.Message)) *Manager {
	return &Manager{messageWriter: writer}
}

// StartDownload runs a yt-dlp download in a goroutine. It streams progress
// updates and sends complete/error messages when finished.
func (m *Manager) StartDownload(req *messaging.DownloadRequest) {
	downloadID := fmt.Sprintf("dl-%d", time.Now().UnixNano())

	go m.runDownload(downloadID, req)
}

func (m *Manager) runDownload(downloadID string, req *messaging.DownloadRequest) {
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

	cmd := ytdlp.New().
		Format("bv*+ba/b").
		FormatSort("res,ext:mp4:m4a").
		Output("%(title)s.%(ext)s").
		Paths(dir).
		Progress().
		ProgressFunc(500*time.Millisecond, func(update ytdlp.ProgressUpdate) {
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

	result, err := cmd.Run(context.Background(), req.URL)
	if err != nil {
		m.send(messaging.TypeError, &messaging.ErrorResponse{
			DownloadID: downloadID,
			Message:    friendlyError(err.Error()),
		})
		return
	}

	// Try to extract filename from result.
	filename := ""
	if infos, infoErr := result.GetExtractedInfo(); infoErr == nil && len(infos) > 0 {
		info := infos[0]
		if info.Filename != nil {
			filename = *info.Filename
		}
	}

	m.send(messaging.TypeComplete, &messaging.DownloadComplete{
		DownloadID: downloadID,
		Filename:   filepath.Base(filename),
		Path:       filename,
	})
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
	case strings.Contains(lower, "ffmpeg"):
		return "ffmpeg is required but not found. Install ffmpeg to enable video+audio merging."
	case strings.Contains(lower, "sign in"), strings.Contains(lower, "age"):
		return "This video requires authentication. Cookie support coming in a future update."
	default:
		return msg
	}
}
