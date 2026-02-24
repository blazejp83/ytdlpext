package messaging

import "encoding/json"

// Message type constants for the native messaging protocol.
const (
	TypePing     = "ping"
	TypePong     = "pong"
	TypeDownload = "download"
	TypeProgress = "progress"
	TypeComplete = "complete"
	TypeError    = "error"
)

// Message is the top-level envelope for all native messaging communication.
// Type is used for routing before unmarshaling Data.
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// DownloadRequest is sent from the extension to start a download.
type DownloadRequest struct {
	URL       string `json:"url"`
	Directory string `json:"directory"`
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
}

// ErrorResponse is sent when an error occurs.
type ErrorResponse struct {
	DownloadID string `json:"downloadId,omitempty"`
	Message    string `json:"message"`
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
