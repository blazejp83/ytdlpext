package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"

	"ytdlext-companion/download"
	"ytdlext-companion/messaging"
)

// writeMu serializes all writes to stdout. Multiple goroutines (progress
// callbacks from concurrent downloads) may write simultaneously, and native
// messaging requires each length-prefixed message to be written atomically.
var writeMu sync.Mutex

func main() {
	// All logging goes to stderr; stdout is reserved for native messaging.
	log.SetOutput(os.Stderr)
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
