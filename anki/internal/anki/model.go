package anki

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"

	"github.com/atselvan/ankiconnect"
)

// ModelSpec describes a note type: its fields in display order, card templates and styling.
type ModelSpec struct {
	Name      string
	Fields    []string
	Templates []ankiconnect.CardTemplate
	CSS       string
	IsCloze   bool
}

// EnsureModel creates a note type, or brings an existing one up to date: missing fields and card
// templates are added, and every template's HTML and the styling are replaced. Nothing is removed,
// so review history is not affected. Whether a note type is a cloze type can't change after it's created.
func (c *AnkiClient) EnsureModel(spec ModelSpec) error {
	var names []string
	if err := c.call("modelNames", nil, &names); err != nil {
		return fmt.Errorf("failed to list note types: %w", err)
	}
	if slices.Contains(names, spec.Name) {
		return c.updateModel(spec)
	}

	templates := make([]map[string]string, len(spec.Templates))
	for i, t := range spec.Templates {
		templates[i] = map[string]string{"Name": t.Name, "Front": t.Front, "Back": t.Back}
	}
	params := map[string]any{
		"modelName":     spec.Name,
		"inOrderFields": spec.Fields,
		"css":           spec.CSS,
		"isCloze":       spec.IsCloze,
		"cardTemplates": templates,
	}
	if err := c.call("createModel", params, nil); err != nil {
		return fmt.Errorf("failed to create note type %s: %w", spec.Name, err)
	}
	return nil
}

func (c *AnkiClient) updateModel(spec ModelSpec) error {
	var fields []string
	if err := c.call("modelFieldNames", map[string]any{"modelName": spec.Name}, &fields); err != nil {
		return fmt.Errorf("failed to get fields of note type %s: %w", spec.Name, err)
	}
	for _, field := range spec.Fields {
		if slices.Contains(fields, field) {
			continue
		}
		params := map[string]any{"modelName": spec.Name, "fieldName": field, "index": len(fields)}
		if err := c.call("modelFieldAdd", params, nil); err != nil {
			return fmt.Errorf("failed to add field %s to note type %s: %w", field, spec.Name, err)
		}
		fields = append(fields, field)
	}

	var existing map[string]any
	if err := c.call("modelTemplates", map[string]any{"modelName": spec.Name}, &existing); err != nil {
		return fmt.Errorf("failed to get templates of note type %s: %w", spec.Name, err)
	}
	templates := make(map[string]map[string]string, len(spec.Templates))
	for _, t := range spec.Templates {
		if _, ok := existing[t.Name]; !ok {
			params := map[string]any{
				"modelName": spec.Name,
				"template":  map[string]string{"Name": t.Name, "Front": t.Front, "Back": t.Back},
			}
			if err := c.call("modelTemplateAdd", params, nil); err != nil {
				return fmt.Errorf("failed to add template %s to note type %s: %w", t.Name, spec.Name, err)
			}
			continue
		}
		templates[t.Name] = map[string]string{"Front": t.Front, "Back": t.Back}
	}
	if len(templates) > 0 {
		params := map[string]any{"model": map[string]any{"name": spec.Name, "templates": templates}}
		if err := c.call("updateModelTemplates", params, nil); err != nil {
			return fmt.Errorf("failed to update templates of note type %s: %w", spec.Name, err)
		}
	}

	params := map[string]any{"model": map[string]any{"name": spec.Name, "css": spec.CSS}}
	if err := c.call("updateModelStyling", params, nil); err != nil {
		return fmt.Errorf("failed to update styling of note type %s: %w", spec.Name, err)
	}
	return nil
}

// call invokes an AnkiConnect action directly, with retries, for actions the ankiconnect library
// does not expose. If result is non-nil, the response's result is decoded into it.
func (c *AnkiClient) call(action string, params any, result any) error {
	request := map[string]any{"action": action, "version": 6}
	if params != nil {
		request["params"] = params
	}
	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to encode %s request: %w", action, err)
	}

	return retryWithBackoff(action, 3, func() error {
		resp, err := http.Post(c.url, "application/json", bytes.NewReader(body))
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		var response struct {
			Result json.RawMessage `json:"result"`
			Error  *string         `json:"error"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
			return fmt.Errorf("failed to decode %s response: %w", action, err)
		}
		if response.Error != nil {
			return fmt.Errorf("%s", *response.Error)
		}
		if result != nil {
			if err := json.Unmarshal(response.Result, result); err != nil {
				return fmt.Errorf("failed to decode %s result: %w", action, err)
			}
		}
		return nil
	})
}
