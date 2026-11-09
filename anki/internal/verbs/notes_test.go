package verbs

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func grapho() Verb {
	return Verb{
		Greek: "γράφω", English: "I write", Group: "labials", GroupName: "Labials",
		GroupRule: "-π  -β  -φ  -πτ  + σ → ψ", GroupNote: "Lip sounds fuse with σ into ψ.",
		Present: "γράφω", Imperfect: "έγραφα", Aorist: "έγραψα", Future: "θα γράψω",
		Marked: Marked{
			Present:   "γράφω",
			Imperfect: `<span class="aug">έ</span>γραφα`,
			Aorist:    `<span class="aug">έ</span>γρα<span class="chg">ψ</span>α`,
			Future:    `<span class="pre">θα </span>γρά<span class="chg">ψ</span>ω`,
		},
		Example: &Example{El: "Έγραψα ένα γράμμα.", En: "I wrote a letter."},
	}
}

func TestVerbNote(t *testing.T) {
	n := VerbNote(grapho(), SheetVerb{English: "I write"})

	want := map[string]string{
		"Present":        "γράφω",
		"English":        "I write",
		"PastContinuous": `<span class="aug">έ</span>γραφα`,
		"Aorist":         `<span class="aug">έ</span>γρα<span class="chg">ψ</span>α`,
		"Group":          "Labials",
		"Recognize":      "",
		"Example":        `<div class="ex"><span class="ex-el" lang="el">Έγραψα ένα γράμμα.</span><span class="ex-en">I wrote a letter.</span></div>`,
	}
	for field, value := range want {
		if n.Fields[field] != value {
			t.Errorf("%s = %q, want %q", field, n.Fields[field], value)
		}
	}
	if len(n.Tags) != 1 || n.Tags[0] != "aspect::labials" {
		t.Errorf("tags = %v", n.Tags)
	}
	if len(n.Audio) != 2 || n.Audio[0].Text != "γράφω" || !n.Audio[0].Word || n.Audio[1].Text != "έγραφα, έγραψα, θα γράψω" {
		t.Errorf("audio = %+v", n.Audio)
	}
	for _, field := range verbFields {
		if _, ok := n.Fields[field]; !ok && !strings.HasSuffix(field, "Audio") {
			t.Errorf("field %s isn't filled", field)
		}
	}
}

func TestVerbNoteNoPerfective(t *testing.T) {
	v := Verb{Greek: "έχω", Group: "no-perf", Present: "έχω", Imperfect: "είχα", Future: "θα έχω", Recognize: "είχα"}
	n := VerbNote(v, SheetVerb{English: "I have"})
	if n.Fields["Aorist"] != "—" {
		t.Errorf("Aorist = %q, want a dash", n.Fields["Aorist"])
	}
	if n.Fields["Recognize"] != "είχα" {
		t.Errorf("Recognize = %q", n.Fields["Recognize"])
	}
	if n.Audio[1].Text != "είχα, θα έχω" {
		t.Errorf("forms audio = %q", n.Audio[1].Text)
	}
}

func TestVerbNoteFallsBackToSheet(t *testing.T) {
	v := grapho()
	v.Example = nil
	n := VerbNote(v, SheetVerb{Examples: "\nΓράφω & διαβάζω. — I write & read.\nΆλλο. — Other."})
	if n.Fields["English"] != "I write" {
		t.Errorf("English = %q, want the export's when the sheet has none", n.Fields["English"])
	}
	want := `<div class="ex"><span class="ex-el" lang="el">Γράφω &amp; διαβάζω.</span><span class="ex-en">I write &amp; read.</span></div>`
	if n.Fields["Example"] != want {
		t.Errorf("Example = %q, want %q", n.Fields["Example"], want)
	}
}

func TestClozeNote(t *testing.T) {
	n := ClozeNote(Cloze{
		Verb: "διαβάζω", Group: "dentals", Aspect: "simple", Reason: "a single, finished action",
		El: "Διάβασα ένα βιβλίο.", En: "I read a book.", Text: "{{c1::Διάβασα::διαβάζω}} ένα βιβλίο.",
	})
	if n.Fields["Text"] != "{{c1::Διάβασα::διαβάζω}} ένα βιβλίο." {
		t.Errorf("Text = %q", n.Fields["Text"])
	}
	if n.Fields["Aspect"] != "<b>Aorist</b>: a single, finished action" {
		t.Errorf("Aspect = %q", n.Fields["Aspect"])
	}
	if n.Fields[KeyField(ClozeModelName)] != "διαβάζω|Διάβασα ένα βιβλίο." {
		t.Errorf("Key = %q", n.Fields["Key"])
	}
	if len(n.Audio) != 1 || n.Audio[0].Text != "Διάβασα ένα βιβλίο." || n.Audio[0].Word {
		t.Errorf("audio = %+v", n.Audio)
	}
}

func TestModelsUseOnlyTheirFields(t *testing.T) {
	for _, spec := range []struct {
		fields []string
		html   string
	}{
		{verbFields, verbTemplates[0].Front + verbTemplates[0].Back + verbTemplates[1].Front + verbTemplates[1].Back},
		{clozeFields, clozeTemplates[0].Front + clozeTemplates[0].Back},
	} {
		known := map[string]bool{"FrontSide": true}
		for _, f := range spec.fields {
			known[f] = true
		}
		for _, part := range strings.Split(spec.html, "{{")[1:] {
			name, _, _ := strings.Cut(part, "}}")
			name = strings.TrimLeft(name, "#/^")
			if i := strings.LastIndex(name, ":"); i >= 0 {
				name = name[i+1:]
			}
			if !known[name] {
				t.Errorf("template refers to unknown field %q", name)
			}
		}
	}
}

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "anki-verbs.json")
	data := `{"groups": [], "verbs": [{"greek": "γράφω", "marked": {"aorist": "x"}}], "cloze": []}`
	if err := os.WriteFile(path, []byte(data), 0o644); err != nil {
		t.Fatal(err)
	}
	export, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(export.Verbs) != 1 || export.Verbs[0].Greek != "γράφω" || export.Verbs[0].Marked.Aorist != "x" {
		t.Errorf("export = %+v", export)
	}
	if _, err := Load(filepath.Join(dir, "missing.json")); err == nil || !strings.Contains(err.Error(), "make anki-verbs") {
		t.Errorf("missing file error = %v", err)
	}
}
