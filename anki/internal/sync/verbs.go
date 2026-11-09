package sync

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/gataky/sync/internal/anki"
	"github.com/gataky/sync/internal/logging"
	"github.com/gataky/sync/internal/mapper"
	"github.com/gataky/sync/internal/verbs"
	"github.com/gataky/sync/pkg/models"
)

// VerbAnkiClient is what the verb sync needs from Anki.
type VerbAnkiClient interface {
	CreateDeck(deckName string) error
	EnsureModel(spec anki.ModelSpec) error
	NotesOfType(modelName string) ([]anki.NoteInfo, error)
	CreateNote(deckName, modelName string, fields map[string]string, tags []string) (int64, error)
	UpdateNote(noteID int64, fields map[string]string, tags []string) error
	StoreAudioFile(filename string, audioData []byte) error
}

// VerbPusher pushes the verb deck: a "Greek verb" note for each active verb in the sheet, and a
// "Greek aspect" cloze note for each of its past-tense sentences. The forms and sentences come
// from greek-notes' anki-verbs.json; the sheet decides which verbs are in and gives their meaning.
//
// Notes are matched in Anki on a key field (the present, or verb|sentence), so nothing is written
// back to the sheet. A note is updated only when its fields or group tag differ. Notes whose verb
// or sentence is gone are listed, never deleted, since that would lose their review history.
type VerbPusher struct {
	sheets SheetsClientInterface
	anki   VerbAnkiClient
	tts    TTSClientInterface
	config *models.Config
	logger *logging.SyncLogger
	media  mediaLibrary
	out    io.Writer

	notices []string
}

// NewVerbPusher creates a VerbPusher. tts may be nil, in which case no new audio is made.
func NewVerbPusher(sheets SheetsClientInterface, ankiClient VerbAnkiClient, tts TTSClientInterface,
	config *models.Config, logger *logging.SyncLogger, out io.Writer) *VerbPusher {
	return &VerbPusher{
		sheets: sheets,
		anki:   ankiClient,
		tts:    tts,
		config: config,
		logger: logger,
		media:  mediaLibrary(ankiMediaDir(config.AnkiProfile)),
		out:    out,
	}
}

// noteCounts tallies what a sync did to one note type's notes.
type noteCounts struct {
	created, updated, unchanged, failed int
}

func (c noteCounts) String() string {
	parts := []string{
		fmt.Sprintf("%d new", c.created),
		fmt.Sprintf("%d updated", c.updated),
		fmt.Sprintf("%d unchanged", c.unchanged),
	}
	if c.failed > 0 {
		parts = append(parts, fmt.Sprintf("%d failed", c.failed))
	}
	return strings.Join(parts, ", ")
}

// Push syncs the verb deck. With dryRun, it reports what would change and writes nothing.
func (p *VerbPusher) Push(dryRun bool) error {
	if p.config.Verbs == nil || strings.TrimSpace(p.config.Verbs.CardsPath) == "" {
		return fmt.Errorf("no verb cards file: pass --cards or set verbs.cards_path to the repo's exports/anki-verbs.json (make push-verbs does this)")
	}
	cfg := p.config.Verbs.WithDefaults()

	export, err := verbs.Load(cfg.CardsPath)
	if err != nil {
		return err
	}
	sheetVerbs, err := p.readSheetVerbs()
	if err != nil {
		return err
	}

	verbNotes, clozeNotes := p.buildNotes(export, sheetVerbs)

	if !dryRun {
		for _, deck := range []string{cfg.Deck, cfg.ClozeDeck} {
			if err := p.anki.CreateDeck(deck); err != nil {
				return fmt.Errorf("failed to create deck %s: %w", deck, err)
			}
		}
		for _, spec := range []anki.ModelSpec{verbs.VerbModel(), verbs.ClozeModel()} {
			if err := p.anki.EnsureModel(spec); err != nil {
				return err
			}
		}
	}

	verbCounts, err := p.syncNotes(verbs.VerbModelName, cfg.Deck, verbNotes, dryRun)
	if err != nil {
		return err
	}
	clozeCounts, err := p.syncNotes(verbs.ClozeModelName, cfg.ClozeDeck, clozeNotes, dryRun)
	if err != nil {
		return err
	}

	prefix := ""
	if dryRun {
		prefix = "Dry run, nothing written. "
	}
	fmt.Fprintf(p.out, "%sVerbs (%s): %s\n", prefix, cfg.Deck, verbCounts)
	fmt.Fprintf(p.out, "%sAspect sentences (%s): %s\n", prefix, cfg.ClozeDeck, clozeCounts)
	for _, n := range p.notices {
		fmt.Fprintf(p.out, "  ! %s\n", n)
	}
	if verbCounts.failed+clozeCounts.failed > 0 {
		return fmt.Errorf("%d notes failed; run with -v for details", verbCounts.failed+clozeCounts.failed)
	}
	return nil
}

func (p *VerbPusher) notice(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	p.notices = append(p.notices, msg)
	p.logger.Warn("%s", msg)
}

// readSheetVerbs returns the sheet's active verbs by their Greek. A verb on several rows gets its
// meanings joined, as greek-notes' verbs.json does, and the first examples given.
func (p *VerbPusher) readSheetVerbs() (map[string]verbs.SheetVerb, error) {
	rows, err := p.sheets.ReadSheet(p.config.GoogleSheetID, p.config.SheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet: %w", err)
	}
	headers, err := p.sheets.ParseHeaders(rows)
	if err != nil {
		return nil, fmt.Errorf("failed to parse headers: %w", err)
	}
	if err := p.sheets.ValidateRequiredColumns(headers, []string{"English", "Greek", "Part of Speech", "Voice"}); err != nil {
		return nil, fmt.Errorf("sheet validation failed: %w", err)
	}

	out := make(map[string]verbs.SheetVerb)
	for i := 1; i < len(rows); i++ {
		if len(rows[i]) == 0 {
			continue
		}
		card, err := mapper.RowToCard(rows[i], headers, i+1)
		if err != nil {
			return nil, err
		}
		if !strings.EqualFold(strings.TrimSpace(card.PartOfSpeech), "verb") ||
			!strings.EqualFold(strings.TrimSpace(card.Voice), "active") {
			continue
		}
		greek := strings.TrimSpace(card.Greek)
		english := strings.TrimSpace(card.English)
		v, seen := out[greek]
		switch {
		case !seen:
			v.English = english
		case english != "" && !slices.Contains(strings.Split(v.English, "; "), english):
			v.English += "; " + english
		}
		if v.Examples == "" {
			v.Examples = card.Examples
		}
		out[greek] = v
	}
	return out, nil
}

// buildNotes joins the export with the sheet: a verb gets notes only if it's an active verb in both.
func (p *VerbPusher) buildNotes(export *verbs.Export, sheetVerbs map[string]verbs.SheetVerb) (verbNotes, clozeNotes []verbs.Note) {
	kept := make(map[string]bool)
	for _, v := range export.Verbs {
		sv, ok := sheetVerbs[v.Greek]
		if !ok {
			p.notice("%s is in anki-verbs.json but isn't an active verb in the sheet, so it's skipped (run `make sync` in greek-notes)", v.Greek)
			continue
		}
		kept[v.Greek] = true
		verbNotes = append(verbNotes, verbs.VerbNote(v, sv))
	}
	for _, greek := range slices.Sorted(maps.Keys(sheetVerbs)) {
		if !kept[greek] {
			p.notice("%s is an active verb in the sheet but not in anki-verbs.json yet (run `make sync` in greek-notes)", greek)
		}
	}
	for _, c := range export.Cloze {
		if kept[c.Verb] {
			clozeNotes = append(clozeNotes, verbs.ClozeNote(c))
		}
	}
	return verbNotes, clozeNotes
}

// pendingAudio is a sound file a note refers to that isn't in Anki's media folder yet.
type pendingAudio struct {
	field, filename, text string
}

// syncNotes creates and updates one note type's notes, in the given order (which becomes Anki's
// new-card order for created notes).
func (p *VerbPusher) syncNotes(model, deck string, notes []verbs.Note, dryRun bool) (noteCounts, error) {
	var counts noteCounts
	existing, err := p.anki.NotesOfType(model)
	if err != nil {
		return counts, err
	}
	keyField := verbs.KeyField(model)
	byKey := make(map[string]anki.NoteInfo, len(existing))
	for _, n := range existing {
		byKey[n.Fields[keyField]] = n
	}

	seen := make(map[string]bool, len(notes))
	for _, note := range notes {
		key := note.Fields[keyField]
		seen[key] = true
		current, exists := byKey[key]

		fields := maps.Clone(note.Fields)
		var pending []pendingAudio
		for _, a := range note.Audio {
			filename, missing := p.audioFile(a)
			switch {
			case filename == "" && exists:
				fields[a.Field] = current.Fields[a.Field] // no TTS: keep whatever the note has
			case filename == "":
				fields[a.Field] = ""
			default:
				fields[a.Field] = "[sound:" + filename + "]"
				if missing {
					pending = append(pending, pendingAudio{a.Field, filename, a.Text})
				}
			}
		}
		tags := mergeTags(current.Tags, note.Tags)

		if exists && len(pending) == 0 && fieldsMatch(current.Fields, fields) && tagsMatch(current.Tags, tags) {
			counts.unchanged++
			continue
		}

		if dryRun {
			verb := "create"
			if exists {
				verb = "update"
			}
			p.logger.Info("DRY RUN: would %s %s %q (%d audio files to generate)", verb, model, note.Label, len(pending))
			if exists {
				counts.updated++
			} else {
				counts.created++
			}
			continue
		}

		for _, a := range pending {
			if err := p.makeAudio(a); err != nil {
				p.logger.Error("audio for %q: %v", a.text, err)
				fields[a.field] = ""
				if exists {
					fields[a.field] = current.Fields[a.field]
				}
			}
		}

		if exists {
			if err := p.anki.UpdateNote(current.ID, fields, tags); err != nil {
				p.logger.Error("%s %q: %v", model, note.Label, err)
				counts.failed++
				continue
			}
			p.logger.Info("Updated %s %q", model, note.Label)
			counts.updated++
		} else {
			if _, err := p.anki.CreateNote(deck, model, fields, tags); err != nil {
				p.logger.Error("%s %q: %v", model, note.Label, err)
				counts.failed++
				continue
			}
			p.logger.Info("Created %s %q", model, note.Label)
			counts.created++
		}
	}

	var gone []string
	for key := range byKey {
		if !seen[key] {
			gone = append(gone, key)
		}
	}
	if len(gone) > 0 {
		slices.Sort(gone)
		p.notice("%d %s notes in Anki are no longer in the export, left as they are: %s", len(gone), model, strings.Join(gone, ", "))
	}
	return counts, nil
}

// audioFile returns the file an audio field should play and whether it still has to be made.
// It returns "" when there's no file and no TTS to make one.
//
// A word's audio is shared with the vocabulary deck ({word}.mp3 or {word}-{source}-{n}.mp3), so
// the present reuses the file its vocabulary card already has. Other audio is named after a hash
// of its text, so a changed sentence or form gets a new file.
func (p *VerbPusher) audioFile(a verbs.Audio) (string, bool) {
	source := providerSource(p.config.TextToSpeech)
	canMake := p.tts != nil && source != "" && p.config.TextToSpeech != nil && p.config.TextToSpeech.Enabled

	if a.Word {
		if existing := p.media.wordAudio(a.Text, source); existing != "" {
			return existing, false
		}
		if !canMake {
			return "", false
		}
		_, version := p.media.latestWordAudio(a.Text, source)
		return wordAudioFilename(a.Text, source, version+1), true
	}

	if source == "" {
		return "", false
	}
	filename := hashedAudioFilename(a.Text, source)
	if p.media.exists(filename) {
		return filename, false
	}
	if !canMake {
		return "", false
	}
	return filename, true
}

// hashedAudioFilename names the audio for a phrase or sentence: verbs-{hash}-{source}.mp3.
func hashedAudioFilename(text, source string) string {
	sum := sha1.Sum([]byte(text))
	return fmt.Sprintf("verbs-%s-%s.mp3", hex.EncodeToString(sum[:])[:12], source)
}

func (p *VerbPusher) makeAudio(a pendingAudio) error {
	data, err := p.tts.GenerateAudio(a.text)
	if err != nil {
		return err
	}
	if err := p.anki.StoreAudioFile(a.filename, data); err != nil {
		return err
	}
	p.logger.Info("Generated audio %s for %q", a.filename, a.text)
	if delay := p.config.TextToSpeech.RequestDelayMs; delay > 0 {
		time.Sleep(time.Duration(delay) * time.Millisecond)
	}
	return nil
}

// fieldsMatch reports whether a note already has every field value we'd write.
func fieldsMatch(current, want map[string]string) bool {
	for name, value := range want {
		if current[name] != value {
			return false
		}
	}
	return true
}

// mergeTags keeps a note's own tags (marked, leech, anything added by hand) and replaces its
// aspect:: tags with ours.
func mergeTags(current, ours []string) []string {
	var out []string
	for _, t := range current {
		if !strings.HasPrefix(strings.ToLower(t), "aspect::") {
			out = append(out, t)
		}
	}
	return append(out, ours...)
}

// tagsMatch compares tags as sets, ignoring case as Anki does.
func tagsMatch(a, b []string) bool {
	set := func(tags []string) map[string]bool {
		m := make(map[string]bool, len(tags))
		for _, t := range tags {
			m[strings.ToLower(t)] = true
		}
		return m
	}
	return maps.Equal(set(a), set(b))
}
