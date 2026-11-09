// Package verbs builds the verb deck: "Greek verb" notes (produce a verb's past and future forms,
// and recognise hard aorists) and "Greek aspect" cloze notes (choose the past continuous or the
// aorist in a sentence).
//
// The forms, groups, highlighted letters and sentences come from greek-notes' exports/anki-verbs.json
// (`make anki-verbs` there), which runs the same JavaScript as its verb tables and aspect forks
// pages, so the cards always agree with the site. This package only lays them out as notes.
package verbs

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Export is the content of anki-verbs.json.
type Export struct {
	Groups []Group `json:"groups"`
	Verbs  []Verb  `json:"verbs"`
	Cloze  []Cloze `json:"cloze"`
}

// Group is one of the aspect forks page's groups: how the present stem turns into the perfective one.
type Group struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Rule string `json:"rule"`
	Note string `json:"note"`
}

// Verb is an active verb with its 1st singular forms. Verbs are listed in learning order:
// regular groups first, irregular last.
type Verb struct {
	Greek     string   `json:"greek"`
	English   string   `json:"english"`
	Group     string   `json:"group"`
	GroupName string   `json:"groupName"`
	GroupRule string   `json:"groupRule"`
	GroupNote string   `json:"groupNote"`
	Present   string   `json:"present"`
	Imperfect string   `json:"imperfect"`
	Aorist    string   `json:"aorist"` // empty for verbs with no perfective (έχω)
	Future    string   `json:"future"` // with θα
	Marked    Marked   `json:"marked"`
	Notes     []string `json:"notes"`
	Recognize string   `json:"recognize"` // the past form for the recognition card, or empty for none
	Example   *Example `json:"example"`
}

// Marked holds the forms as HTML, with the augment and changed letters in spans
// (aug, chg, drop, ins, pre) that the note type's CSS colours like the aspect forks page.
type Marked struct {
	Present   string `json:"present"`
	Imperfect string `json:"imperfect"`
	Aorist    string `json:"aorist"`
	Future    string `json:"future"`
}

// Example is a Greek sentence and its translation.
type Example struct {
	El string `json:"el"`
	En string `json:"en"`
}

// Cloze is a past-tense sentence with its verb blanked, from the tense and aspect drill.
type Cloze struct {
	Verb   string `json:"verb"`
	Group  string `json:"group"`
	Aspect string `json:"aspect"` // continuous or simple
	Reason string `json:"reason"` // why this aspect, e.g. "a single, finished action"
	El     string `json:"el"`
	En     string `json:"en"`   // the verb is marked: "I *swept* the kitchen"
	Text   string `json:"text"` // El with the answer as {{c1::answer::dictionary form}}
	Note   string `json:"note"`
}

// Load reads anki-verbs.json. A leading ~ in the path is expanded.
func Load(path string) (*Export, error) {
	path, err := expandHome(path)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read verb cards (run `make anki-verbs` in greek-notes): %w", err)
	}
	var export Export
	if err := json.Unmarshal(data, &export); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", path, err)
	}
	if len(export.Verbs) == 0 {
		return nil, fmt.Errorf("%s has no verbs", path)
	}
	return &export, nil
}

func expandHome(path string) (string, error) {
	if path != "~" && !strings.HasPrefix(path, "~/") {
		return path, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to find home directory: %w", err)
	}
	return filepath.Join(home, strings.TrimPrefix(path, "~")), nil
}
