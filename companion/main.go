package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"

	"ytdlext-companion/messaging"
)

func main() {
	// All logging goes to stderr; stdout is reserved for native messaging.
	log.SetOutput(os.Stderr)
	log.Println("ytdlext companion started")

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

		if err := handleMessage(msg); err != nil {
			log.Printf("error handling message type %q: %v", msg.Type, err)
		}
	}
}

func handleMessage(msg *messaging.Message) error {
	switch msg.Type {
	case messaging.TypePing:
		return sendResponse(messaging.TypePong, nil)

	case messaging.TypeDownload:
		return sendResponse(messaging.TypeError, &messaging.ErrorResponse{
			Message: "not implemented yet",
		})

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

	if err := messaging.WriteMessage(os.Stdout, resp); err != nil {
		return fmt.Errorf("writing response: %w", err)
	}

	return nil
}
