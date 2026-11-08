// Checks the dictionary lookup (docs/javascripts/greek-dictionary.js) against the database.
//   node tests/test_dictionary.js
// The search keys must match the ones stored in the database exactly, so besides the
// examples from the dictionary's guide this recomputes norm and phonetic for every form.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const initSqlJs = require("../docs/vendor/sql.js/sql-wasm.js");
const D = require("../docs/javascripts/greek-dictionary.js");

let failures = 0, checks = 0;
const check = (label, got, expected) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    failures++;
    console.log(`✗ ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
};

// ---------- Key functions (the guide's "Verifying a port" tables) ----------

for (const [word, key] of [["Σπίτι", "σπιτι"], ["λόγος", "λογοσ"], ["ἄνθρωπος", "ανθρωποσ"], ["Ϊ", "ι"], ["ΕΊΠΑ", "ειπα"]]) {
  check(`norm(${word})`, D.norm(word), key);
}

for (const [word, key] of Object.entries({
  σπίτι: "spiti", σπήτι: "spiti", καλημέρα: "kalimera", θάλασσα: "8alasa", παιδί: "pedi", ούτε: "ute",
  γεια: "gia", μπαμπάς: "babas", πόλη: "poli", πολύ: "poli", τσάι: "tsai", κοροϊδεύω: "koroidevo",
  αϋπνία: "aipnia", αυτός: "aftos", αύριο: "avrio", ευχαριστώ: "efharisto", Ευρώπη: "evropi", πάντα: "pada",
})) check(`phonetic(${word})`, D.phonetic(word), key);

for (const [latin, word] of Object.entries({
  spiti: "σπίτι", kalhmera: "καλημέρα", thalassa: "θάλασσα", "8alasa": "θάλασσα", efharisto: "ευχαριστώ",
  eyxaristw: "ευχαριστώ", xeri: "χέρι", xerw: "ξέρω", geia: "γεια", yia: "γεια", mpampas: "μπαμπάς",
  tsai: "τσάι", ellhnika: "ελληνικά", Spíti: "σπίτι", anthropos: "άνθρωπος",
})) check(`queryKeys(${latin}) has ${word}`, D.queryKeys(latin).some(([k]) => k === D.phonetic(word)), true);
check("queryKeys(xeri)", D.queryKeys("xeri").slice(0, 2), [["heri", 0], ["kseri", 1]]);

for (const [input, term] of [["To Say", "say"], ["a House", "house"], ["living rooms.", "living room"], ["to", "to"], ["...", ""]]) {
  check(`normalizeTerm(${input})`, D.normalizeTerm(input), term);
}
for (const [word, s] of Object.entries({ houses: "house", cities: "city", boxes: "box", glasses: "glass", bus: "bus", thing: "thing", bed: "bed", children: "child" })) {
  check(`stem(${word})`, D.stem(word), s);
}

// ---------- Against the database ----------

initSqlJs().then(SQL => {
  const gz = fs.readFileSync(path.join(__dirname, "../docs/data/lemma_greek_en.db.gz"));
  const db = new SQL.Database(zlib.gunzipSync(gz));
  const dict = D.open(db);

  // Every stored form's keys, recomputed. Only the first few mismatches are printed.
  let keyFailures = 0;
  const forms = dict.rows("SELECT form, norm, phonetic FROM form");
  for (const [form, n, p] of forms) {
    const got = [D.norm(form), D.phonetic(form)];
    if (got[0] !== n || got[1] !== p) {
      if (++keyFailures <= 10) console.log(`✗ keys of ${form}: got ${got.join(" / ")}, stored ${n} / ${p}`);
    }
  }
  checks += forms.length;
  failures += keyFailures;
  if (keyFailures > 10) console.log(`  … and ${keyFailures - 10} more forms`);

  // The guide's search examples.
  const top = (query, n) => dict.searchGreek(query).slice(0, n).map(h => h.word);
  check("search σπίτι", dict.searchGreek("σπίτι")[0], { ...dict.searchGreek("σπίτι")[0], word: "σπίτι", kind: D.EXACT });
  check("search σπιτι", dict.searchGreek("σπιτι")[0].kind === D.NORM && top("σπιτι", 1)[0], "σπίτι");
  check("search σπητι", top("σπητι", 1), ["σπίτι"]);
  check("search spiti", top("spiti", 1), ["σπίτι"]);
  check("search είπα", [top("είπα", 1)[0], dict.searchGreek("είπα")[0].matchedForm], ["λέω", "είπα"]);
  check("search ἄνθρωπος", top("ἄνθρωπος", 1), ["άνθρωπος"]);
  check("search xeri", top("xeri", 3), ["χέρι", "χαίρω", "ξέρω"]);
  check("search bank", dict.searchEnglish("bank").slice(0, 2).map(h => [h.greek, h.note]), [["τράπεζα", "institution"], ["όχθη", "edge of river or lake"]]);
  check("search salt water", dict.searchEnglish("salt water")[0].greek, "αλατόνερο");
  // Not in the English index, so this goes through the gloss search ("oil pressed from olives").
  check("search olive oil press", dict.searchEnglish("olive oil press").map(h => [h.greek, h.fullText])[0], ["ελαιόλαδο", true]);
  // Filtering as you type: every prefix of σπίτι finds it.
  for (const q of ["σπ", "σπι", "σπίτ", "sp", "spi", "spit"]) check(`complete ${q}`, dict.complete(q)[0].word, "σπίτι");
  check("complete είπ", [dict.complete("είπ")[0].word, dict.complete("είπ")[0].matchedForm], ["λέω", "είπα"]);
  check("complete σπη (misspelt) has σπίτι", dict.complete("σπη").some(h => h.word === "σπίτι" && h.kind === D.PHONETIC), true);
  check("complete kal (no odd forms on top)", dict.complete("kal").slice(0, 3).map(h => h.word), ["καλά", "καλός", "καλημέρα"]);
  check("complete σ (one letter)", dict.complete("σ"), []);
  check("lookup σπίτι", dict.lookup("σπίτι").entries[0].pos, "noun");
  check("lookup forms of σπίτι", dict.lookup("σπίτι").forms.includes("σπιτιού"), true);
  check("lookup unknown", dict.lookup("σπιτ"), null);

  // Principal parts guessed from the dictionary's forms, for verbs not in the word list.
  for (const [verb, future, aorist] of [
    ["καπνίζω", "καπνίσω", "κάπνισα"], ["χορεύω", "χορέψω", "χόρεψα"], ["αγαπώ", "αγαπήσω", "αγάπησα"],
    ["αποφεύγω", "αποφύγω", "απέφυγα"], ["αντιγράφω", "αντιγράψω", "αντέγραψα"], ["παθαίνω", "πάθω", "έπαθα"],
    ["αγωνίζομαι", "αγωνιστώ", "αγωνίστηκα"], ["δίνομαι", "δοθώ", "δόθηκα"],
  ]) check(`principal parts of ${verb}`, dict.principalParts(verb), { future, aorist });
  check("principal parts of a noun", dict.principalParts("σπίτι"), null);
  // Against the sheet's hand-entered parts: a wrong guess is worse than none, which only
  // means no link. When this build was added: 121 agree, 7 differ (mostly real variants
  // such as κάτσω for καθίσω), 19 no guess.
  const sheet = JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/data/verbs.json"), "utf8")).filter(v => v.future && v.aorist);
  const tally = { agree: 0, differ: [], none: 0 };
  for (const v of sheet) {
    const got = dict.principalParts(v.greek);
    if (!got) tally.none++;
    else if (got.future === v.future && got.aorist === v.aorist) tally.agree++;
    else tally.differ.push(`${v.greek}: ${got.future}/${got.aorist}, sheet ${v.future}/${v.aorist}`);
  }
  check(`principal parts agree with the sheet (${tally.agree}/${sheet.length})`, tally.agree / sheet.length >= 0.8, true);
  check(`principal parts differ from the sheet (${tally.differ.length})`, tally.differ.length <= 8 || tally.differ, true);

  console.log(`\n${checks - failures}/${checks} checks passed (${forms.length} stored forms)`);
  process.exit(failures ? 1 : 0);
});
