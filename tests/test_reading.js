// Checks the dictionary's reading mode (docs/javascripts/reading.js) against the database:
// splitting a text into words, what a written word can be, and the labels of its forms.
//   node tests/test_reading.js

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const initSqlJs = require("../docs/vendor/sql.js/sql-wasm.js");
const D = require("../docs/javascripts/greek-dictionary.js");
const R = require("../docs/javascripts/reading.js");

let failures = 0, checks = 0;
const check = (label, got, expected) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    failures++;
    console.log(`✗ ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
};

// ---------- Splitting ----------

const words = text => R.split(text).map(p => p.filter(x => x.word).map(x => x.text));
check("split: words, punctuation and paragraphs", words("«Ποιος έγραψε;» ρώτησε.\n\nΝαι, εγώ."), [["Ποιος", "έγραψε", "ρώτησε"], ["Ναι", "εγώ"]]);
check("split: a single line break stays in the paragraph", R.split("Ένα\nδύο").length, 1);
check("split: elisions keep their apostrophe", words("σ’ ένα, απ' το, ’χε"), [["σ’", "ένα", "απ'", "το", "’χε"]]);
check("split: Latin and numbers aren't words", words("Το iPhone 15 κοστίζει"), [["Το", "κοστίζει"]]);
check("split: the pieces give back the text", R.split("Α, β.\n\nγ!").map(p => p.map(x => x.text).join("")), ["Α, β.", "γ!"]);
check("split: an empty text", R.split("  \n "), []);

initSqlJs().then(SQL => {
  const gz = fs.readFileSync(path.join(__dirname, "../docs/data/lemma_greek_en.db.gz"));
  const dict = D.open(new SQL.Database(zlib.gunzipSync(gz)));
  const first = written => R.candidates(dict, written)[0];
  const all = written => R.candidates(dict, written).map(c => c.word);

  // ---------- Candidates ----------

  for (const [written, word] of [
    ["είπα", "λέω"], ["Είπα", "λέω"], ["έγραψε", "γράφω"], ["γράφτηκαν", "γράφω"], ["σπίτια", "σπίτι"],
    ["κι", "και"], ["σ’", "σε"], ["σ'", "σε"], ["απ'", "από"], ["στη", "σε"], ["ΑΘΗΝΑΣ", "Αθήνα"],
  ]) check(`${written} → ${word}`, first(written)?.word, word);

  // Accents written are accents meant: που is "that", πού is "where".
  check("που keeps only που", all("που"), ["που"]);
  check("πού keeps only πού", all("πού"), ["πού"]);
  // Capitals carry no accents, so both stay.
  check("ΠΟΥ keeps both", all("ΠΟΥ").sort(), ["που", "πού"]);
  // Ambiguous words list each headword: the pronoun and the article.
  check("το is the pronoun and the article", all("το").slice(0, 2), ["το", "ο"]);
  check("at most three", R.candidates(dict, "το").length <= 3, true);
  check("no sound matches for typos", all("σπητι"), []);
  // A quote mark taken for an elision's apostrophe is dropped.
  check("'σπίτι' in quote marks", all("'σπίτι'"), ["σπίτι"]);

  // The particles the dictionary has no entry for.
  for (const p of ["θα", "να", "δεν", "μην", "ας"]) check(`${p} is a particle`, !!first(p)?.particle, true);
  check("Θα, capitalised", !!first("Θα")?.particle, true);
  check("ΘΑ, in capitals", !!first("ΘΑ")?.particle, true);
  check("θ’ is θα", first("θ’")?.word, "θα");
  check("να has no initialism (ΝΑ)", all("να"), ["να"]);
  for (const p of Object.keys(R.PARTICLES)) check(`${p} still has no entry`, dict.lookup(p) === null || p === "δε", true);

  // ---------- Labels ----------

  const label = (headword, written) => R.describe(dict, headword, written).label;
  check("είπα", label("λέω", "είπα"), "past simple, 1st singular");
  check("έγραψε", label("γράφω", "έγραψε"), "past simple, 3rd singular");
  check("έγραφα", label("γράφω", "έγραφα"), "past continuous, 1st singular");
  check("γράφουμε", label("γράφω", "γράφουμε"), "present, 1st plural");
  check("πεις", label("λέω", "πεις"), "dependent (θα, να), 2nd singular");
  check("γράφτηκαν", label("γράφω", "γράφτηκαν"), "passive past simple, 3rd plural");
  check("ρώτησε, past or command", label("ρωτάω", "ρώτησε"), "past simple, 3rd singular · imperative, simple, 2nd singular");
  check("παιδιά", label("παιδί", "παιδιά"), "nominative, accusative or vocative plural");
  check("ΑΘΗΝΑΣ", label("Αθήνα", "ΑΘΗΝΑΣ"), "genitive singular");
  check("της", label("ο", "της"), "genitive feminine singular");
  check("the headword itself has no label", label("σπίτι", "σπίτι"), "");
  check("the label's entry", typeof R.describe(dict, "γράφω", "έγραψε").entryId, "number");

  console.log(failures ? `\n${failures}/${checks} checks failed` : `${checks}/${checks} checks passed`);
  process.exit(failures ? 1 : 0);
});
