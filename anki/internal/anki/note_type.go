package anki

import (
	"github.com/atselvan/ankiconnect"
)

// Template names of the two card types generated for each note.
const (
	templateEnglishToGreek = "English to Greek"
	templateGreekToEnglish = "Greek to English"
)

// noteTypeFields lists the fields of the VocabSync note type in display order.
// Front holds the English text and Back holds the Greek text with its [sound:] tag.
var noteTypeFields = []string{
	"Front",
	"Back",
	"PartOfSpeech",
	"Article",
	"Gender",
	"Attributes",
	"Voice",
	"ActiveForm",
	"FutureSimple",
	"Aorist",
	"Examples",
	"Notes",
}

// Template fragments shared by both card types. Empty optional fields render nothing.
const (
	englishHTML = `<div class="prompt">{{Front}}</div>`

	greekHTML = `<div class="target {{Gender}}">{{#Article}}<span class="article">{{Article}}</span> {{/Article}}{{Back}}</div>`

	partOfSpeechHTML = `<div class="pos">{{PartOfSpeech}}</div>`

	detailsHTML = `<div class="grammar">` +
		`{{#Attributes}}<span>{{Attributes}}</span>{{/Attributes}}` +
		`{{#Voice}}<span>{{Voice}}</span>{{/Voice}}` +
		`{{#ActiveForm}}<span>active: {{ActiveForm}}</span>{{/ActiveForm}}` +
		`</div>` +
		`<div class="parts">` +
		`{{#FutureSimple}}<span><i>fut.</i> θα {{FutureSimple}}</span>{{/FutureSimple}}` +
		`{{#Aorist}}<span><i>aor.</i> {{Aorist}}</span>{{/Aorist}}` +
		`</div>` +
		`{{#Examples}}<div class="examples">{{Examples}}</div>{{/Examples}}` +
		`{{#Notes}}<div class="notes">{{Notes}}</div>{{/Notes}}`

	answerRule = `{{FrontSide}}<hr id="answer">`
)

// noteTypeTemplates defines the two card types. {{FrontSide}} does not replay the front's audio,
// so the Greek audio plays once per card: on the answer for English→Greek, on the question for Greek→English.
var noteTypeTemplates = []ankiconnect.CardTemplate{
	{
		Name:  templateEnglishToGreek,
		Front: englishHTML + partOfSpeechHTML,
		Back:  answerRule + greekHTML + detailsHTML,
	},
	{
		Name:  templateGreekToEnglish,
		Front: greekHTML + partOfSpeechHTML,
		Back:  answerRule + englishHTML + detailsHTML,
	},
}

// noteTypeCSS styles the cards in light and night mode. Nouns are colored by gender.
const noteTypeCSS = `.card {
	font-family: "Noto Sans", "Helvetica Neue", Arial, sans-serif;
	font-size: 20px;
	line-height: 1.4;
	text-align: center;
	color: #1f2328;
	background-color: #ffffff;
	padding: 12px;
}

.prompt {
	font-size: 28px;
}

.target {
	font-size: 36px;
	font-weight: 600;
}

.target .article {
	font-weight: 400;
}

.target.masculine { color: #0969da; }
.target.feminine { color: #cf222e; }
.target.neuter { color: #1a7f37; }

.pos {
	font-size: 14px;
	font-style: italic;
	color: #6e7781;
	margin-top: 4px;
}

hr#answer {
	border: none;
	border-top: 1px solid #d0d7de;
	width: 80%;
	margin: 16px auto;
}

.grammar,
.parts {
	font-size: 15px;
	color: #57606a;
	margin-top: 8px;
}

.grammar:empty,
.parts:empty {
	display: none;
}

.grammar span + span::before,
.parts span + span::before {
	content: " · ";
}

.parts i {
	font-style: normal;
	font-size: 13px;
	color: #8c959f;
}

.examples,
.notes {
	text-align: left;
	max-width: 34em;
	margin: 16px auto 0;
}

.ex {
	margin: 8px 0;
}

.ex-el,
.ex-en {
	display: block;
}

.ex-en {
	font-size: 16px;
	color: #6e7781;
}

.notes {
	font-size: 15px;
	font-style: italic;
	color: #57606a;
	border-left: 3px solid #d0d7de;
	padding-left: 10px;
}

.nightMode.card,
.night_mode.card {
	color: #e6edf3;
	background-color: #1e1e1e;
}

.nightMode .target.masculine, .night_mode .target.masculine { color: #58a6ff; }
.nightMode .target.feminine, .night_mode .target.feminine { color: #ff7b72; }
.nightMode .target.neuter, .night_mode .target.neuter { color: #3fb950; }

.nightMode .pos, .night_mode .pos,
.nightMode .ex-en, .night_mode .ex-en {
	color: #8b949e;
}

.nightMode .grammar, .night_mode .grammar,
.nightMode .parts, .night_mode .parts,
.nightMode .notes, .night_mode .notes {
	color: #9da7b3;
}

.nightMode hr#answer, .night_mode hr#answer,
.nightMode .notes, .night_mode .notes {
	border-color: #3d444d;
}
`

// EnsureNoteType creates the VocabSync note type, or brings an existing one up to date by adding
// missing fields and replacing its card templates and styling. Review history is not affected.
func (c *AnkiClient) EnsureNoteType(modelName string) error {
	return c.EnsureModel(ModelSpec{
		Name:      modelName,
		Fields:    noteTypeFields,
		Templates: noteTypeTemplates,
		CSS:       noteTypeCSS,
	})
}
