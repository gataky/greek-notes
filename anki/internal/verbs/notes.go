package verbs

import (
	"fmt"
	"html"
	"regexp"
	"strings"
)

// SheetVerb is what the vocabulary sheet adds to a verb: its meaning and examples, as on its
// vocabulary card.
type SheetVerb struct {
	English  string
	Examples string // one per line, "Greek — English"
}

// Audio is a field that holds a [sound:] tag. The sync works out the file and generates it if needed.
type Audio struct {
	Field string
	Text  string // what is spoken
	// Word means the audio is a single word's, shared with the vocabulary deck's
	// "{word}-{source}-{n}.mp3" files. Otherwise it's named after a hash of the text.
	Word bool
}

// Note is a note as it should be in Anki. Fields leave out the audio fields, which the sync fills.
type Note struct {
	Label  string // for log messages
	Fields map[string]string
	Tags   []string
	Audio  []Audio
}

// KeyField is the field a note type's notes are matched on: a verb's present, or a sentence's verb|Greek.
func KeyField(model string) string {
	if model == ClozeModelName {
		return "Key"
	}
	return "Present"
}

// noForm stands in for a form a verb doesn't have (the aorist of έχω).
const noForm = "—"

// tagPrefix groups the verbs' tags, so a filtered deck can drill one group: tag:aspect::dentals.
const tagPrefix = "aspect::"

// exampleSeparator separates a Greek example from its translation in the sheet, as on vocabulary cards.
const exampleSeparator = " — "

// VerbNote builds the "Greek verb" note for a verb.
func VerbNote(v Verb, sheet SheetVerb) Note {
	english := sheet.English
	if strings.TrimSpace(english) == "" {
		english = v.English
	}
	aorist := v.Marked.Aorist
	if v.Aorist == "" {
		aorist = noForm
	}

	notes := make([]string, len(v.Notes))
	for i, n := range v.Notes {
		notes[i] = html.EscapeString(n)
	}

	example := ""
	if v.Example != nil {
		example = exampleHTML(v.Example.El, v.Example.En)
	} else if line := firstLine(sheet.Examples); line != "" {
		el, en, _ := strings.Cut(line, exampleSeparator)
		example = exampleHTML(el, en)
	}

	spoken := []string{v.Imperfect}
	if v.Aorist != "" {
		spoken = append(spoken, v.Aorist)
	}
	spoken = append(spoken, v.Future)

	return Note{
		Label: v.Present,
		Fields: map[string]string{
			"Present":        html.EscapeString(v.Present),
			"English":        html.EscapeString(strings.TrimSpace(english)),
			"PastContinuous": v.Marked.Imperfect,
			"Aorist":         aorist,
			"FutureSimple":   v.Marked.Future,
			"Group":          html.EscapeString(v.GroupName),
			"GroupRule":      html.EscapeString(v.GroupRule),
			"GroupNote":      html.EscapeString(v.GroupNote),
			"PresentMarked":  v.Marked.Present,
			"Example":        example,
			"Notes":          strings.Join(notes, "<br>"),
			"Recognize":      html.EscapeString(v.Recognize),
		},
		Tags: []string{tagPrefix + v.Group},
		Audio: []Audio{
			{Field: "PresentAudio", Text: v.Present, Word: true},
			{Field: "FormsAudio", Text: strings.Join(spoken, ", ")},
		},
	}
}

// aspectNames names the two aspects as the cards do.
var aspectNames = map[string]string{"continuous": "Past continuous", "simple": "Aorist"}

// ClozeNote builds the "Greek aspect" note for a sentence.
func ClozeNote(c Cloze) Note {
	name := aspectNames[c.Aspect]
	if name == "" {
		name = c.Aspect
	}
	return Note{
		Label: c.El,
		Fields: map[string]string{
			"Text":    html.EscapeString(c.Text),
			"English": markedEnglish(c.En),
			"Aspect":  fmt.Sprintf("<b>%s</b>: %s", name, html.EscapeString(c.Reason)),
			"Notes":   html.EscapeString(c.Note),
			"Verb":    html.EscapeString(c.Verb),
			"Key":     html.EscapeString(c.Verb + "|" + c.El),
		},
		Tags:  []string{tagPrefix + c.Group},
		Audio: []Audio{{Field: "Audio", Text: c.El}},
	}
}

// markedVerb is the drill's marking of the verb in an English sentence: "I *swept* the kitchen".
var markedVerb = regexp.MustCompile(`\*([^*]+)\*`)

// markedEnglish escapes an English sentence and shows its *marked* verb in bold.
func markedEnglish(en string) string {
	return markedVerb.ReplaceAllString(html.EscapeString(en), "<b>$1</b>")
}

func exampleHTML(el, en string) string {
	el, en = strings.TrimSpace(el), strings.TrimSpace(en)
	if el == "" {
		return ""
	}
	out := `<div class="ex"><span class="ex-el" lang="el">` + html.EscapeString(el) + `</span>`
	if en != "" {
		out += `<span class="ex-en">` + html.EscapeString(en) + `</span>`
	}
	return out + `</div>`
}

func firstLine(text string) string {
	for _, line := range strings.Split(text, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return ""
}
