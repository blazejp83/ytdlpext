package messaging

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
)

// ReadMessage reads a single native messaging message from the reader.
// The format is a 4-byte uint32 little-endian length prefix followed by
// that many bytes of JSON.
func ReadMessage(r io.Reader) (*Message, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return nil, fmt.Errorf("reading message length: %w", err)
	}

	if length == 0 {
		return nil, fmt.Errorf("message length is zero")
	}

	// Chrome native messaging has a 1MB message limit.
	const maxMessageSize = 1024 * 1024
	if length > maxMessageSize {
		return nil, fmt.Errorf("message too large: %d bytes (max %d)", length, maxMessageSize)
	}

	data := make([]byte, length)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, fmt.Errorf("reading message body: %w", err)
	}

	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("unmarshaling message: %w", err)
	}

	return &msg, nil
}

// WriteMessage writes a single native messaging message to the writer.
// The format is a 4-byte uint32 little-endian length prefix followed by
// the JSON-encoded message bytes.
func WriteMessage(w io.Writer, msg *Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshaling message: %w", err)
	}

	length := uint32(len(data))
	if err := binary.Write(w, binary.LittleEndian, length); err != nil {
		return fmt.Errorf("writing message length: %w", err)
	}

	if _, err := w.Write(data); err != nil {
		return fmt.Errorf("writing message body: %w", err)
	}

	// Flush if the writer supports it.
	if f, ok := w.(interface{ Flush() error }); ok {
		if err := f.Flush(); err != nil {
			return fmt.Errorf("flushing writer: %w", err)
		}
	}

	return nil
}
