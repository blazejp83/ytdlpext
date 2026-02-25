package messaging

import "encoding/json"

// Message type constants for the native messaging protocol.
const (
	TypePing       = "ping"
	TypePong       = "pong"
	TypeDownload   = "download"
	TypeProgress   = "progress"
	TypeComplete   = "complete"
	TypeError      = "error"
	TypeGetFormats = "getFormats"
	TypeFormats    = "formats"
	TypeOpenFolder = "openFolder"
	TypeCancelAll  = "cancelAll"
	TypeCancelled  = "cancelled"
)

// Message is the top-level envelope for all native messaging communication.
// Type is used for routing before unmarshaling Data.
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// DownloadRequest is sent from the extension to start a download.
type DownloadRequest struct {
	URL                string `json:"url"`
	Directory          string `json:"directory"`
	FormatID           string `json:"formatId,omitempty"`
	AudioOnly          bool   `json:"audioOnly,omitempty"`
	AudioFormat        string `json:"audioFormat,omitempty"`
	EmbedMetadata      bool   `json:"embedMetadata,omitempty"`
	EmbedThumbnail     bool   `json:"embedThumbnail,omitempty"`
	FileExists         string `json:"fileExists,omitempty"` // "overwrite", "rename", or "skip"
	SponsorBlockRemove string `json:"sponsorBlockRemove,omitempty"`
	SubtitleLangs      string `json:"subtitleLangs,omitempty"`
	EmbedSubs          bool   `json:"embedSubs,omitempty"`
	UseBrowserCookies  bool   `json:"useBrowserCookies,omitempty"`
}

// ProgressUpdate is sent from the companion to report download progress.
type ProgressUpdate struct {
	DownloadID string  `json:"downloadId"`
	Percentage float64 `json:"percentage"`
	Speed      string  `json:"speed"`
	ETA        string  `json:"eta"`
	Filename   string  `json:"filename"`
}

// DownloadComplete is sent when a download finishes successfully.
type DownloadComplete struct {
	DownloadID string `json:"downloadId"`
	Filename   string `json:"filename"`
	Path       string `json:"path"`
	Directory  string `json:"directory"`
	URL        string `json:"url"`
	Title      string `json:"title"`
}

// ErrorResponse is sent when an error occurs.
type ErrorResponse struct {
	DownloadID string `json:"downloadId,omitempty"`
	Message    string `json:"message"`
}

// GetFormatsRequest is sent from the extension to query available formats.
type GetFormatsRequest struct {
	URL string `json:"url"`
}

// SubtitleLang describes an available subtitle language.
type SubtitleLang struct {
	Code string `json:"code"`
	Name string `json:"name"`
	Auto bool   `json:"auto"` // true if auto-generated caption
}

// FormatsResponse is sent back to the extension with available formats.
type FormatsResponse struct {
	Title        string         `json:"title"`
	Duration     float64        `json:"duration"`
	Thumbnail    string         `json:"thumbnail"`
	VideoFormats []VideoFormat  `json:"videoFormats"`
	AudioFormats []AudioFormat  `json:"audioFormats"`
	Subtitles    []SubtitleLang `json:"subtitles,omitempty"`
}

// VideoFormat describes a single video format option.
type VideoFormat struct {
	FormatID   string  `json:"formatId"`
	Ext        string  `json:"ext"`
	Resolution string  `json:"resolution"`
	Width      int     `json:"width"`
	Height     int     `json:"height"`
	FPS        float64 `json:"fps"`
	VCodec     string  `json:"vcodec"`
	ACodec     string  `json:"acodec"`
	Filesize   int64   `json:"filesize"`
	TBR        float64 `json:"tbr"`
}

// AudioFormat describes a single audio-only format option.
type AudioFormat struct {
	FormatID string  `json:"formatId"`
	Ext      string  `json:"ext"`
	ABR      float64 `json:"abr"`
	ACodec   string  `json:"acodec"`
	Filesize int64   `json:"filesize"`
}

// CancelledResponse is sent when a download is cancelled via cancelAll.
type CancelledResponse struct {
	DownloadID string `json:"downloadId"`
}

// OpenFolderRequest is sent from the extension to open a directory in the file manager.
type OpenFolderRequest struct {
	Path string `json:"path"`
}

// NewMessage creates a Message with the given type and marshaled data.
func NewMessage(msgType string, data interface{}) (*Message, error) {
	msg := &Message{Type: msgType}
	if data != nil {
		raw, err := json.Marshal(data)
		if err != nil {
			return nil, err
		}
		msg.Data = raw
	}
	return msg, nil
}
