package anki

import (
	"fmt"
)

// NoteInfo is a note as AnkiConnect's notesInfo returns it, with plain field values.
type NoteInfo struct {
	ID     int64
	Fields map[string]string
	Tags   []string
}

// NotesOfType returns every note of a note type, in any deck.
func (c *AnkiClient) NotesOfType(modelName string) ([]NoteInfo, error) {
	var ids []int64
	if err := c.call("findNotes", map[string]any{"query": fmt.Sprintf(`"note:%s"`, modelName)}, &ids); err != nil {
		return nil, fmt.Errorf("failed to find %s notes: %w", modelName, err)
	}
	if len(ids) == 0 {
		return nil, nil
	}

	var infos []struct {
		NoteID int64 `json:"noteId"`
		Fields map[string]struct {
			Value string `json:"value"`
		} `json:"fields"`
		Tags []string `json:"tags"`
	}
	if err := c.call("notesInfo", map[string]any{"notes": ids}, &infos); err != nil {
		return nil, fmt.Errorf("failed to read %s notes: %w", modelName, err)
	}

	notes := make([]NoteInfo, 0, len(infos))
	for _, info := range infos {
		fields := make(map[string]string, len(info.Fields))
		for name, f := range info.Fields {
			fields[name] = f.Value
		}
		notes = append(notes, NoteInfo{ID: info.NoteID, Fields: fields, Tags: info.Tags})
	}
	return notes, nil
}

// CreateNote adds a note with the given fields and tags and returns its ID. Duplicates of the
// first field are allowed: callers match notes on their own key.
func (c *AnkiClient) CreateNote(deckName, modelName string, fields map[string]string, tags []string) (int64, error) {
	params := map[string]any{"note": map[string]any{
		"deckName":  deckName,
		"modelName": modelName,
		"fields":    fields,
		"tags":      tags,
		"options":   map[string]any{"allowDuplicate": true},
	}}
	var id int64
	if err := c.call("addNote", params, &id); err != nil {
		return 0, fmt.Errorf("failed to add note: %w", err)
	}
	return id, nil
}

// UpdateNote replaces a note's fields and tags. Review history is not affected.
func (c *AnkiClient) UpdateNote(noteID int64, fields map[string]string, tags []string) error {
	params := map[string]any{"note": map[string]any{"id": noteID, "fields": fields, "tags": tags}}
	if err := c.call("updateNote", params, nil); err != nil {
		return fmt.Errorf("failed to update note %d: %w", noteID, err)
	}
	return nil
}
