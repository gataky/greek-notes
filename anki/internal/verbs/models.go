package verbs

import (
	"github.com/atselvan/ankiconnect"
	"github.com/gataky/sync/internal/anki"
)

// Note type names.
const (
	VerbModelName  = "Greek verb"
	ClozeModelName = "Greek aspect"
)

// Fields of the "Greek verb" note type. Present is the first field, so it's what Anki's browser
// sorts by and what notes are matched on.
var verbFields = []string{
	"Present",
	"English",
	"PastContinuous",
	"Aorist",
	"FutureSimple",
	"Group",
	"GroupRule",
	"GroupNote",
	"PresentMarked",
	"Example",
	"Notes",
	"Recognize",
	"PresentAudio",
	"FormsAudio",
}

// Fields of the "Greek aspect" cloze note type. Key (verb|sentence) is what notes are matched on.
var clozeFields = []string{
	"Text",
	"English",
	"Aspect",
	"Notes",
	"Verb",
	"Audio",
	"Key",
}

// The forms, laid out as a table. {{FrontSide}} doesn't replay the front's audio, so each card's
// audio plays once.
const formsHTML = `<table class="forms">` +
	`<tr><th>past continuous</th><td lang="el">{{PastContinuous}}</td></tr>` +
	`<tr><th>aorist</th><td lang="el">{{Aorist}}</td></tr>` +
	`<tr><th>future simple</th><td lang="el">{{FutureSimple}}</td></tr>` +
	`</table>`

const groupHTML = `<div class="group"><span class="group-name">{{Group}}</span> <span class="rule" lang="el">{{GroupRule}}</span></div>` +
	`<div class="gnote">{{GroupNote}}</div>` +
	`{{#Notes}}<div class="notes">{{Notes}}</div>{{/Notes}}` +
	`{{#Example}}<div class="example">{{Example}}</div>{{/Example}}`

var verbTemplates = []ankiconnect.CardTemplate{
	{
		// The main card: from the present, produce the past continuous, aorist and future.
		Name: "Forms",
		Front: `<div class="kind">past · aorist · future</div>` +
			`<div class="head" lang="el">{{Present}}</div>` +
			`<div class="english">{{English}}</div>{{PresentAudio}}` +
			`<div class="hint">{{hint:Group}}</div>`,
		Back: `<div class="kind">past · aorist · future</div>` +
			`<div class="head" lang="el">{{PresentMarked}}</div>` +
			`<div class="english">{{English}}</div>` +
			`<hr id="answer">` + formsHTML + `{{FormsAudio}}` + groupHTML,
	},
	{
		// Only for verbs whose aorist doesn't look like the present (Recognize is empty otherwise,
		// so Anki doesn't make this card).
		Name: "Recognize",
		Front: `{{#Recognize}}<div class="kind">which verb?</div>` +
			`<div class="head" lang="el">{{Recognize}}</div>{{/Recognize}}`,
		Back: `{{FrontSide}}<hr id="answer">` +
			`<div class="head" lang="el">{{Present}}</div>` +
			`<div class="english">{{English}}</div>{{PresentAudio}}` +
			formsHTML + groupHTML,
	},
}

var clozeTemplates = []ankiconnect.CardTemplate{
	{
		Name:  "Cloze",
		Front: `<div class="kind">past continuous or aorist?</div><div class="sentence" lang="el">{{cloze:Text}}</div>`,
		Back: `<div class="kind">past continuous or aorist?</div><div class="sentence" lang="el">{{cloze:Text}}</div>{{Audio}}` +
			`<hr id="answer"><div class="english">{{English}}</div>` +
			`<div class="aspect">{{Aspect}}</div>` +
			`{{#Notes}}<div class="notes">{{Notes}}</div>{{/Notes}}`,
	},
}

// The colours are the aspect forks page's (greek-notes' verb-grid.css and aspect-fork.css):
// the augment purple, letters that change in the perfective warm, letters only the
// imperfective has blue.
const css = `.card {
	--ink: #10233f; --muted: #5a6a80; --line: #d6dee9; --bg: #ffffff;
	--accent: #1f5fa8; --accent-soft: #e2ecf8; --warn: #9a620e; --warn-soft: #fbf0dc; --aug: #7646bd;
	font-family: "Noto Sans", "Helvetica Neue", Arial, sans-serif;
	font-size: 20px;
	line-height: 1.4;
	text-align: center;
	color: var(--ink);
	background-color: var(--bg);
	padding: 12px;
}
.nightMode.card, .night_mode.card {
	--ink: #e5ecf5; --muted: #94a4b9; --line: #24354b; --bg: #1e1e1e;
	--accent: #80b3ee; --accent-soft: #1a2d46; --warn: #e3ad58; --warn-soft: #33270f; --aug: #b995f3;
}
[lang="el"] { font-family: "GFS Didot", "Noto Serif", Georgia, serif; }

.kind { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.head { font-size: 38px; font-weight: 600; margin-top: 4px; }
.english { font-size: 18px; color: var(--muted); }
.hint { margin-top: 14px; font-size: 15px; }
.hint a { color: var(--muted); }

hr#answer { border: none; border-top: 1px solid var(--line); width: 80%; margin: 16px auto; }

.forms { margin: 0 auto; border-collapse: collapse; }
.forms th {
	font-size: 12px; font-weight: 400; letter-spacing: .06em; text-transform: uppercase;
	color: var(--muted); text-align: right; padding: 4px 12px 4px 0; white-space: nowrap;
}
.forms td { font-size: 30px; text-align: left; padding: 2px 0; color: var(--ink); }

.aug { color: var(--aug); font-weight: 600; }
.chg { color: var(--warn); font-weight: 600; background: var(--warn-soft); border-radius: 3px; padding: 0 1px; }
.ins { color: var(--accent); font-weight: 600; background: var(--accent-soft); border-radius: 3px; padding: 0 1px; }
.drop { color: var(--accent); text-decoration: underline dotted; text-underline-offset: 3px; text-decoration-thickness: 2px; }
.pre { color: var(--muted); }

.group { margin-top: 18px; font-size: 16px; }
.group-name { font-weight: 600; }
.rule { font-size: 18px; padding: 1px 8px; border-radius: 6px; background: var(--warn-soft); border: 1px solid var(--line); white-space: pre-wrap; }
.gnote, .aspect { font-size: 15px; color: var(--muted); max-width: 34em; margin: 6px auto 0; }
.notes {
	font-size: 15px; font-style: italic; color: var(--muted); text-align: left;
	max-width: 34em; margin: 12px auto 0; border-left: 3px solid var(--line); padding-left: 10px;
}
.example { text-align: left; max-width: 34em; margin: 16px auto 0; }
.ex-el, .ex-en { display: block; }
.ex-el { font-size: 20px; }
.ex-en { font-size: 16px; color: var(--muted); }

.sentence { font-size: 26px; margin-top: 8px; }
.cloze { font-weight: 600; color: var(--warn); }
.aspect { font-size: 16px; }
.aspect b { color: var(--ink); }
`

// VerbModel is the "Greek verb" note type.
func VerbModel() anki.ModelSpec {
	return anki.ModelSpec{Name: VerbModelName, Fields: verbFields, Templates: verbTemplates, CSS: css}
}

// ClozeModel is the "Greek aspect" cloze note type.
func ClozeModel() anki.ModelSpec {
	return anki.ModelSpec{Name: ClozeModelName, Fields: clozeFields, Templates: clozeTemplates, CSS: css, IsCloze: true}
}
