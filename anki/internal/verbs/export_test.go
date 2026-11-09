package verbs

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// The repo's committed export, written by scripts/build_anki_verbs.js.
const exportPath = "../../../exports/anki-verbs.json"

// TestCommittedExport checks the real anki-verbs.json against the structs here, so renaming a
// field on the JavaScript side fails instead of pushing cards with that field blank.
func TestCommittedExport(t *testing.T) {
	data, err := os.ReadFile(exportPath)
	if err != nil {
		t.Fatalf("read %s: %v", exportPath, err)
	}

	// Every field the script writes must be one this package reads. A new field needs adding
	// to Export (and the note types, if the cards show it) in the same commit.
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	var export Export
	if err := dec.Decode(&export); err != nil {
		t.Fatalf("%s doesn't match Export: %v", exportPath, err)
	}

	groups := map[string]bool{}
	for _, g := range export.Groups {
		if g.ID == "" || g.Name == "" {
			t.Errorf("group %+v has no id or name", g)
		}
		groups[g.ID] = true
	}
	if len(export.Verbs) == 0 {
		t.Fatal("no verbs")
	}

	verbs := map[string]bool{}
	for _, v := range export.Verbs {
		verbs[v.Greek] = true
		// Aorist is empty for verbs with no perfective, so it isn't required.
		for field, value := range map[string]string{
			"greek": v.Greek, "english": v.English, "group": v.Group, "groupName": v.GroupName,
			"present": v.Present, "imperfect": v.Imperfect, "future": v.Future,
			"marked.present": v.Marked.Present, "marked.imperfect": v.Marked.Imperfect,
			"marked.future": v.Marked.Future,
		} {
			if strings.TrimSpace(value) == "" {
				t.Errorf("%s: %s is empty", v.Greek, field)
			}
		}
		if v.Aorist != "" && v.Marked.Aorist == "" {
			t.Errorf("%s: has an aorist but no marked.aorist", v.Greek)
		}
		if !groups[v.Group] {
			t.Errorf("%s: group %q isn't in groups", v.Greek, v.Group)
		}
	}

	for _, c := range export.Cloze {
		if !verbs[c.Verb] {
			t.Errorf("cloze %q: verb %q isn't in verbs", c.El, c.Verb)
		}
		if !strings.Contains(c.Text, "{{c1::") {
			t.Errorf("cloze %q: text has no {{c1::}}", c.El)
		}
		if c.En == "" || c.Aspect == "" {
			t.Errorf("cloze %q: en or aspect is empty", c.El)
		}
	}
}
