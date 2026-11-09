package sync

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gataky/sync/internal/anki"
	"github.com/gataky/sync/internal/logging"
	"github.com/gataky/sync/internal/testutil"
	"github.com/gataky/sync/internal/verbs"
	"github.com/gataky/sync/pkg/models"
)

// fakeVerbAnki keeps notes in memory, as Anki would.
type fakeVerbAnki struct {
	notes   map[int64]*fakeNote
	nextID  int64
	stored  []string
	decks   []string
	models  []string
	updates int
}

type fakeNote struct {
	deck, model string
	info        anki.NoteInfo
}

func newFakeVerbAnki() *fakeVerbAnki { return &fakeVerbAnki{notes: map[int64]*fakeNote{}, nextID: 1} }

func (f *fakeVerbAnki) CreateDeck(name string) error { f.decks = append(f.decks, name); return nil }
func (f *fakeVerbAnki) EnsureModel(spec anki.ModelSpec) error {
	f.models = append(f.models, spec.Name)
	return nil
}
func (f *fakeVerbAnki) NotesOfType(model string) ([]anki.NoteInfo, error) {
	var out []anki.NoteInfo
	for _, n := range f.notes {
		if n.model == model {
			out = append(out, n.info)
		}
	}
	return out, nil
}
func (f *fakeVerbAnki) CreateNote(deck, model string, fields map[string]string, tags []string) (int64, error) {
	id := f.nextID
	f.nextID++
	f.notes[id] = &fakeNote{deck, model, anki.NoteInfo{ID: id, Fields: fields, Tags: tags}}
	return id, nil
}
func (f *fakeVerbAnki) UpdateNote(id int64, fields map[string]string, tags []string) error {
	f.updates++
	f.notes[id].info.Fields = fields
	f.notes[id].info.Tags = tags
	return nil
}
func (f *fakeVerbAnki) StoreAudioFile(name string, data []byte) error {
	f.stored = append(f.stored, name)
	return nil
}

type fakeTTS struct{ spoken []string }

func (t *fakeTTS) GenerateAudio(text string) ([]byte, error) {
	t.spoken = append(t.spoken, text)
	return []byte("mp3"), nil
}
func (t *fakeTTS) Close() error { return nil }

func writeExport(t *testing.T, export verbs.Export) string {
	t.Helper()
	data, err := json.Marshal(export)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "anki-verbs.json")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func testExport() verbs.Export {
	return verbs.Export{
		Verbs: []verbs.Verb{
			{Greek: "γράφω", English: "I write", Group: "labials", GroupName: "Labials", Present: "γράφω",
				Imperfect: "έγραφα", Aorist: "έγραψα", Future: "θα γράψω",
				Marked: verbs.Marked{Imperfect: "έγραφα", Aorist: "έγραψα", Future: "θα γράψω"}},
			{Greek: "πίνω", English: "I drink", Group: "irregular", Present: "πίνω",
				Imperfect: "έπινα", Aorist: "ήπια", Future: "θα πιω", Recognize: "ήπια"},
			{Greek: "τρέχω", English: "I run", Group: "velars", Present: "τρέχω"},
		},
		Cloze: []verbs.Cloze{
			{Verb: "γράφω", Group: "labials", Aspect: "simple", El: "Έγραψα.", En: "I wrote.", Text: "{{c1::Έγραψα::γράφω}}."},
			{Verb: "τρέχω", Group: "velars", Aspect: "simple", El: "Έτρεξα.", En: "I ran.", Text: "{{c1::Έτρεξα::τρέχω}}."},
		},
	}
}

// The sheet has γράφω and πίνω (twice, with two meanings) but not τρέχω, plus a passive and a noun.
func testSheet() *testutil.MockSheetsClient {
	return &testutil.MockSheetsClient{
		Headers: map[string]int{"english": 0, "greek": 1, "part of speech": 2, "voice": 3, "examples": 4},
		Rows: [][]any{
			{"english", "greek", "part of speech", "voice", "examples"},
			{"I write", "γράφω", "verb", "active", ""},
			{"I drink", "πίνω", "verb", "active", ""},
			{"I drink (a toast)", "πίνω", "verb", "active", ""},
			{"I get up", "σηκώνομαι", "verb", "passive", ""},
			{"water", "νερό", "noun", "", ""},
		},
	}
}

func newTestVerbPusher(t *testing.T, client *fakeVerbAnki, tts TTSClientInterface) (*VerbPusher, *bytes.Buffer) {
	t.Helper()
	cfg := &models.Config{
		Verbs:        &models.VerbsConfig{CardsPath: writeExport(t, testExport())},
		TextToSpeech: &models.TTSConfig{Provider: "google", Enabled: true},
	}
	out := &bytes.Buffer{}
	p := NewVerbPusher(testSheet(), client, tts, cfg, logging.NewSyncLogger(logging.Silent, out), out)
	p.media = mediaLibrary(t.TempDir())
	return p, out
}

func TestVerbPushCreatesThenLeavesUnchanged(t *testing.T) {
	client := newFakeVerbAnki()
	tts := &fakeTTS{}
	p, out := newTestVerbPusher(t, client, tts)
	if err := p.Push(false); err != nil {
		t.Fatal(err)
	}

	if strings.Join(client.decks, ",") != "Greek Verbs,Greek Verbs::Aspect" {
		t.Errorf("decks = %v", client.decks)
	}
	if len(client.notes) != 3 {
		t.Fatalf("created %d notes, want 2 verbs and 1 sentence (τρέχω isn't in the sheet)", len(client.notes))
	}
	pino := client.notes[2]
	if pino.deck != "Greek Verbs" || pino.info.Fields["English"] != "I drink; I drink (a toast)" || pino.info.Fields["Recognize"] != "ήπια" {
		t.Errorf("πίνω = %+v", pino)
	}
	if !strings.HasPrefix(pino.info.Fields["PresentAudio"], "[sound:πίνω-gtts-1.mp3") {
		t.Errorf("PresentAudio = %q", pino.info.Fields["PresentAudio"])
	}
	cloze := client.notes[3]
	if cloze.deck != "Greek Verbs::Aspect" || cloze.model != verbs.ClozeModelName || cloze.info.Tags[0] != "aspect::labials" {
		t.Errorf("cloze = %+v", cloze)
	}
	if len(tts.spoken) != 5 { // 2 presents, 2 form lists, 1 sentence
		t.Errorf("spoke %v", tts.spoken)
	}
	if !strings.Contains(out.String(), "τρέχω is in anki-verbs.json but isn't an active verb in the sheet") {
		t.Errorf("output doesn't mention τρέχω:\n%s", out)
	}

	// Second run: the audio files are now in the media folder, and nothing has changed.
	for _, name := range client.stored {
		if err := os.WriteFile(filepath.Join(string(p.media), name), nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	p2, out2 := newTestVerbPusher(t, client, tts)
	p2.media = p.media
	if err := p2.Push(false); err != nil {
		t.Fatal(err)
	}
	if client.updates != 0 || len(client.notes) != 3 || len(tts.spoken) != 5 {
		t.Errorf("second run: %d updates, %d notes, %d spoken; output:\n%s", client.updates, len(client.notes), len(tts.spoken), out2)
	}
}

func TestVerbPushUpdatesAndKeepsOwnTags(t *testing.T) {
	client := newFakeVerbAnki()
	p, _ := newTestVerbPusher(t, client, nil)
	if err := p.Push(false); err != nil {
		t.Fatal(err)
	}
	grapho := client.notes[1]
	grapho.info.Fields["Aorist"] = "wrong"
	grapho.info.Tags = []string{"leech", "aspect::old"}
	orphan, _ := client.CreateNote("Greek Verbs", verbs.VerbModelName, map[string]string{"Present": "παλιό"}, nil)

	p2, out := newTestVerbPusher(t, client, nil)
	if err := p2.Push(false); err != nil {
		t.Fatal(err)
	}
	if client.updates != 1 || grapho.info.Fields["Aorist"] != "έγραψα" {
		t.Errorf("%d updates, Aorist = %q", client.updates, grapho.info.Fields["Aorist"])
	}
	if strings.Join(grapho.info.Tags, ",") != "leech,aspect::labials" {
		t.Errorf("tags = %v", grapho.info.Tags)
	}
	if _, ok := client.notes[orphan]; !ok || !strings.Contains(out.String(), "no longer in the export, left as they are: παλιό") {
		t.Errorf("orphan wasn't reported and kept:\n%s", out)
	}
}

func TestVerbPushDryRunWritesNothing(t *testing.T) {
	client := newFakeVerbAnki()
	tts := &fakeTTS{}
	p, out := newTestVerbPusher(t, client, tts)
	if err := p.Push(true); err != nil {
		t.Fatal(err)
	}
	if len(client.notes) != 0 || len(client.decks) != 0 || len(client.models) != 0 || len(tts.spoken) != 0 {
		t.Errorf("dry run wrote: %d notes, decks %v, models %v, spoke %v", len(client.notes), client.decks, client.models, tts.spoken)
	}
	if !strings.Contains(out.String(), "Verbs (Greek Verbs): 2 new") {
		t.Errorf("output:\n%s", out)
	}
}

func TestVerbPushNeedsCardsPath(t *testing.T) {
	p := NewVerbPusher(testSheet(), newFakeVerbAnki(), nil, &models.Config{}, logging.NewSyncLogger(logging.Silent, &bytes.Buffer{}), &bytes.Buffer{})
	if err := p.Push(true); err == nil || !strings.Contains(err.Error(), "verbs.cards_path") {
		t.Errorf("err = %v", err)
	}
}
