package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"

	"github.com/lrstanley/go-ytdlp"

	"ytdlext-companion/download"
	"ytdlext-companion/messaging"
)

// writeMu serializes all writes to stdout. Multiple goroutines (progress
// callbacks from concurrent downloads) may write simultaneously, and native
// messaging requires each length-prefixed message to be written atomically.
var writeMu sync.Mutex

func main() {
	// Log to a file in the user's temp directory for debugging native messaging issues.
	logPath := filepath.Join(os.TempDir(), "ytdlext-companion.log")
	if logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
		log.SetOutput(logFile)
	} else {
		log.SetOutput(os.Stderr)
	}

	log.Println("ytdlext companion started")

	// Check for yt-dlp availability on startup.
	if _, err := exec.LookPath("yt-dlp"); err != nil {
		log.Println("WARNING: yt-dlp not found in PATH; downloads will fail")
	}

	// Create download manager with a thread-safe message writer.
	manager := download.NewManager(func(msg *messaging.Message) {
		writeMu.Lock()
		defer writeMu.Unlock()
		if err := messaging.WriteMessage(os.Stdout, msg); err != nil {
			log.Printf("error writing message: %v", err)
		}
	})

	for {
		msg, err := messaging.ReadMessage(os.Stdin)
		if err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				log.Println("connection closed, exiting")
				return
			}
			log.Printf("error reading message: %v", err)
			return
		}

		if err := handleMessage(msg, manager); err != nil {
			log.Printf("error handling message type %q: %v", msg.Type, err)
		}
	}
}

func handleMessage(msg *messaging.Message, manager *download.Manager) error {
	switch msg.Type {
	case messaging.TypePing:
		return sendResponse(messaging.TypePong, nil)

	case messaging.TypeDownload:
		var req messaging.DownloadRequest
		if err := json.Unmarshal(msg.Data, &req); err != nil {
			return sendResponse(messaging.TypeError, &messaging.ErrorResponse{
				Message: fmt.Sprintf("invalid download request: %v", err),
			})
		}
		manager.StartDownload(&req)
		return nil

	case messaging.TypeGetFormats:
		var req messaging.GetFormatsRequest
		if err := json.Unmarshal(msg.Data, &req); err != nil {
			return sendResponse(messaging.TypeError, &messaging.ErrorResponse{
				Message: fmt.Sprintf("invalid getFormats request: %v", err),
			})
		}
		go handleGetFormats(req)
		return nil

	case messaging.TypeCancelAll:
		manager.CancelAll()
		return nil

	case messaging.TypeOpenFolder:
		var req messaging.OpenFolderRequest
		if err := json.Unmarshal(msg.Data, &req); err != nil {
			return sendResponse(messaging.TypeError, &messaging.ErrorResponse{
				Message: fmt.Sprintf("invalid openFolder request: %v", err),
			})
		}
		go handleOpenFolder(req)
		return nil

	default:
		return sendResponse(messaging.TypeError, &messaging.ErrorResponse{
			Message: fmt.Sprintf("unknown message type: %s", msg.Type),
		})
	}
}

func sendResponse(msgType string, data interface{}) error {
	resp, err := messaging.NewMessage(msgType, data)
	if err != nil {
		return fmt.Errorf("creating response: %w", err)
	}

	writeMu.Lock()
	defer writeMu.Unlock()
	if err := messaging.WriteMessage(os.Stdout, resp); err != nil {
		return fmt.Errorf("writing response: %w", err)
	}

	return nil
}

// handleGetFormats queries yt-dlp for available formats and sends them back.
func handleGetFormats(req messaging.GetFormatsRequest) {
	cmd := ytdlp.New().DumpJSON()
	result, err := cmd.Run(context.Background(), req.URL)
	if err != nil {
		_ = sendResponse(messaging.TypeError, &messaging.ErrorResponse{
			Message: "Could not fetch format info for this URL",
		})
		return
	}

	infos, err := result.GetExtractedInfo()
	if err != nil || len(infos) == 0 {
		_ = sendResponse(messaging.TypeError, &messaging.ErrorResponse{
			Message: "Could not parse format info for this URL",
		})
		return
	}

	info := infos[0]

	resp := messaging.FormatsResponse{}
	if info.Title != nil {
		resp.Title = *info.Title
	}
	if info.Duration != nil {
		resp.Duration = *info.Duration
	}
	if info.Thumbnail != nil {
		resp.Thumbnail = *info.Thumbnail
	}

	// Separate video and audio formats.
	log.Printf("getFormats: total raw formats from yt-dlp: %d", len(info.Formats))
	for _, f := range info.Formats {
		if f.FormatID == nil {
			continue
		}

		fid := *f.FormatID
		protocol := ""
		if f.Protocol != nil {
			protocol = *f.Protocol
		}

		// Skip formats with compound format IDs (e.g., "301-0") that break
		// yt-dlp format selection syntax. These are typically YouTube HLS duplicates.
		if strings.Contains(fid, "-") {
			log.Printf("getFormats: skip %s (compound ID), protocol=%s", fid, protocol)
			continue
		}

		vcodec := ""
		if f.VCodec != nil {
			vcodec = *f.VCodec
		}
		acodec := ""
		if f.ACodec != nil {
			acodec = *f.ACodec
		}

		height := 0
		if f.Height != nil {
			height = int(*f.Height)
		}

		// Skip storyboard formats.
		formatNote := ""
		if f.FormatNote != nil {
			formatNote = *f.FormatNote
		}

		log.Printf("getFormats: id=%s vcodec=%s acodec=%s height=%d note=%s protocol=%s", fid, vcodec, acodec, height, formatNote, protocol)

		if height <= 0 && vcodec != "" && vcodec != "none" {
			log.Printf("getFormats: skip %s (no height, has vcodec)", fid)
			continue // No height means storyboard or invalid
		}
		if strings.Contains(strings.ToLower(formatNote), "storyboard") {
			continue
		}

		// Determine filesize (prefer exact, fall back to approximate).
		var filesize int64
		if f.FileSize != nil {
			filesize = int64(*f.FileSize)
		} else if f.FileSizeApprox != nil {
			filesize = int64(*f.FileSizeApprox)
		}

		if (vcodec != "" && vcodec != "none") || (height > 0 && (vcodec == "" || vcodec == "none")) {
			// Video format.
			width := 0
			if f.Width != nil {
				width = int(*f.Width)
			}
			fps := 0.0
			if f.FPS != nil {
				fps = *f.FPS
			}
			resolution := ""
			if f.Resolution != nil {
				resolution = *f.Resolution
			}
			ext := ""
			if f.Extension != nil {
				ext = *f.Extension
			}
			tbr := 0.0
			if f.TBR != nil {
				tbr = *f.TBR
			}

			resp.VideoFormats = append(resp.VideoFormats, messaging.VideoFormat{
				FormatID:   *f.FormatID,
				Ext:        ext,
				Resolution: resolution,
				Width:      width,
				Height:     height,
				FPS:        fps,
				VCodec:     vcodec,
				ACodec:     acodec,
				Filesize:   filesize,
				TBR:        tbr,
			})
		} else if acodec != "" && acodec != "none" {
			// Audio-only format.
			abr := 0.0
			if f.ABR != nil {
				abr = *f.ABR
			}
			ext := ""
			if f.Extension != nil {
				ext = *f.Extension
			}

			resp.AudioFormats = append(resp.AudioFormats, messaging.AudioFormat{
				FormatID: *f.FormatID,
				Ext:      ext,
				ABR:      abr,
				ACodec:   acodec,
				Filesize: filesize,
			})
		}
	}

	// Sort video formats: height desc, then fps desc.
	sort.Slice(resp.VideoFormats, func(i, j int) bool {
		if resp.VideoFormats[i].Height != resp.VideoFormats[j].Height {
			return resp.VideoFormats[i].Height > resp.VideoFormats[j].Height
		}
		return resp.VideoFormats[i].FPS > resp.VideoFormats[j].FPS
	})

	// Deduplicate video formats: same height+fps, prefer h264/avc, then smaller filesize.
	resp.VideoFormats = deduplicateVideoFormats(resp.VideoFormats)

	// Sort audio formats: abr desc.
	sort.Slice(resp.AudioFormats, func(i, j int) bool {
		return resp.AudioFormats[i].ABR > resp.AudioFormats[j].ABR
	})

	// Extract available subtitle languages.
	subtitleCodes := make(map[string]bool)
	if info.Subtitles != nil {
		for code, subs := range info.Subtitles {
			name := code
			if len(subs) > 0 && subs[0].Name != nil {
				name = *subs[0].Name
			}
			resp.Subtitles = append(resp.Subtitles, messaging.SubtitleLang{
				Code: code,
				Name: name,
				Auto: false,
			})
			subtitleCodes[code] = true
		}
	}
	if info.AutomaticCaptions != nil {
		for code, subs := range info.AutomaticCaptions {
			if subtitleCodes[code] {
				continue // Skip if already in manual subtitles.
			}
			name := code
			if len(subs) > 0 && subs[0].Name != nil {
				name = *subs[0].Name
			}
			resp.Subtitles = append(resp.Subtitles, messaging.SubtitleLang{
				Code: code,
				Name: name,
				Auto: true,
			})
		}
	}
	// Sort subtitles by code alphabetically.
	sort.Slice(resp.Subtitles, func(i, j int) bool {
		return resp.Subtitles[i].Code < resp.Subtitles[j].Code
	})

	_ = sendResponse(messaging.TypeFormats, &resp)
}

// deduplicateVideoFormats keeps the best format for each height+fps combo.
// Prefers h264/avc for broader compatibility, then higher bitrate, then smaller filesize.
func deduplicateVideoFormats(formats []messaging.VideoFormat) []messaging.VideoFormat {
	type key struct {
		height int
		fps    int
	}
	seen := make(map[key]int) // key -> index in result
	var result []messaging.VideoFormat

	for _, f := range formats {
		k := key{height: f.Height, fps: int(f.FPS)}
		if idx, exists := seen[k]; exists {
			existing := result[idx]
			// Prefer h264/avc over other codecs for compatibility.
			existingIsH264 := isH264(existing.VCodec)
			newIsH264 := isH264(f.VCodec)
			if newIsH264 && !existingIsH264 {
				result[idx] = f
			} else if existingIsH264 == newIsH264 {
				// Same codec family: prefer higher bitrate, then smaller filesize.
				if f.TBR > existing.TBR {
					result[idx] = f
				} else if f.TBR == existing.TBR && f.Filesize > 0 && (existing.Filesize == 0 || f.Filesize < existing.Filesize) {
					result[idx] = f
				}
			}
		} else {
			seen[k] = len(result)
			result = append(result, f)
		}
	}
	return result
}

// isH264 returns true if the codec string indicates H.264/AVC.
func isH264(codec string) bool {
	lower := strings.ToLower(codec)
	return strings.HasPrefix(lower, "avc") || strings.HasPrefix(lower, "h264") || strings.HasPrefix(lower, "h.264")
}

// handleOpenFolder opens a directory in the system file manager.
func handleOpenFolder(req messaging.OpenFolderRequest) {
	dir := req.Path
	// Expand tilde.
	if strings.HasPrefix(dir, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			dir = filepath.Join(home, dir[2:])
		}
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", dir)
	case "windows":
		cmd = exec.Command("explorer", dir)
	default: // linux and others
		cmd = exec.Command("xdg-open", dir)
	}

	if err := cmd.Start(); err != nil {
		log.Printf("failed to open folder %q: %v", dir, err)
		_ = sendResponse(messaging.TypeError, &messaging.ErrorResponse{
			Message: fmt.Sprintf("Could not open folder: %v", err),
		})
	}
}
