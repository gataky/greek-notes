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
  // A spelling several headwords share ranks its main owner (is_primary) first, ahead of frequency.
  check("search πήγα (πηγαίνω owns it, πάω shares it)", top("πήγα", 2), ["πηγαίνω", "πάω"]);
  check("search λεπτά finds both owners", top("λεπτά", 2), ["λεπτός", "λεπτό"]);
  check("complete λεπτά (main owner first)", dict.complete("λεπτά").slice(0, 2).map(h => h.word), ["λεπτός", "λεπτό"]);
  check("search bank", dict.searchEnglish("bank").slice(0, 2).map(h => [h.greek, h.note]), [["τράπεζα", "institution"], ["όχθη", "edge of river or lake"]]);
  check("search salt water", dict.searchEnglish("salt water")[0].greek, "αλατόνερο");
  // Not in the English index, so this goes through the gloss search ("oil pressed from olives").
  check("search olive oil press", dict.searchEnglish("olive oil press").map(h => [h.greek, h.fullText])[0], ["ελαιόλαδο", true]);
  // Filtering as you type: every prefix of σπίτι finds it.
  for (const q of ["σπ", "σπι", "σπίτ", "sp", "spi", "spit"]) check(`complete ${q}`, dict.complete(q)[0].word, "σπίτι");
  check("complete είπ", [dict.complete("είπ")[0].word, dict.complete("είπ")[0].matchedForm], ["λέω", "είπα"]);
  check("complete σπη (misspelt) has σπίτι", dict.complete("σπη").some(h => h.word === "σπίτι" && h.kind === D.PHONETIC), true);
  // καλό ("good", the noun) is a headword of its own, not just a form of καλός.
  check("complete kal (no odd forms on top)", dict.complete("kal").slice(0, 4).map(h => h.word), ["καλά", "καλό", "καλός", "καλημέρα"]);
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
  // απάγω lists all of κλέβω's forms too, but κλέβω owns them, so they can't be its parts.
  check("principal parts only from forms the verb owns", dict.principalParts("απάγω"), { future: "απαγάγω", aorist: "απήγαγα" });
  // Against the sheet's hand-entered parts: a wrong guess is worse than none, which only
  // means no link. When this build was added: 121 agree, 7 differ (mostly real variants
  // such as κάτσω for καθίσω), 19 no guess. With schema 4: 127 agree, 7 differ, 15 no guess.
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

  // ---------- Noun declensions ----------

  const table = (word, i = 0) => dict.declensions(word)[i];
  const row = (word, c, i = 0) => D.NUMBERS.map(n => table(word, i).cells[c][n]);
  check("δρόμος is masculine", table("δρόμος").gender, "masculine");
  check("δρόμος nominative", row("δρόμος", "nominative"), [["δρόμ|ος"], ["δρόμ|οι"]]);
  check("δρόμος vocative", row("δρόμος", "vocative"), [["δρόμ|ε"], ["δρόμ|οι"]]);
  check("άνθρωπος: the accent moves, the ending split doesn't", row("άνθρωπος", "genitive"), [["ανθρώπ|ου"], ["ανθρώπ|ων"]]);
  check("σπίτι: the stem comes from the template (-ι)", row("σπίτι", "genitive"), [["σπιτ|ιού"], ["σπιτ|ιών"]]);
  check("πόλη is feminine", table("πόλη").gender, "feminine");
  check("πόλη genitive plural", table("πόλη").cells.genitive.plural, ["πόλ|εων"]);
  check("a form that doesn't exist is []", table("αβάντα").cells.genitive.plural, []);
  check("alternatives, most usual first", table("αγγελτήριο").cells.genitive.singular, ["αγγελτηρί|ου", "αγγελτήρι|ου"]);
  check("a romanization in the cell is dropped", table("βάβω").cells.nominative.plural, ["βάβ|ες"]);
  check("articles in the cell are dropped, and no single gender", [table("βάτος").gender, table("βάτος").cells.nominative.plural], [null, ["βάτ|οι", "βάτ|α"]]);
  check("a noun with two tables has both", dict.declensions("άλυσος").map(t => t.gender), ["feminine", "masculine"]);
  check("a noun with no plural rows has null there", table("αρπα-κόλλα").cells.nominative.plural, null);
  check("an adjective's table filed under a noun is left out", dict.declensions("απαυτός"), []);
  check("a verb has no declension", dict.declensions("γράφω"), []);
  check("articles", ["masculine", "feminine", "neuter"].map(g => D.article(g, "accusative", "plural")), ["τους", "τις", "τα"]);
  check("no article in the vocative", D.article("masculine", "vocative", "singular"), "");

  // Every 5th noun (all of them take about half a minute): eight cells, each a list of clean forms.
  const nouns = dict.rows("SELECT DISTINCT h.word FROM headword h JOIN entry e ON e.headword_id = h.id WHERE e.pos = 'noun' ORDER BY h.word").map(r => r[0]);
  const clean = /^[Ͱ-Ͽἀ-῿|-]+( [Ͱ-Ͽἀ-῿|-]+)*$/;
  const nounProblems = [];
  let nounTables = 0;
  nouns.filter((_, i) => i % 5 === 0).forEach(word => {
    for (const t of dict.declensions(word)) {
      nounTables++;
      for (const c of D.CASES) for (const n of D.NUMBERS) {
        const cell = t.cells[c][n];
        if (cell !== null && !(Array.isArray(cell) && cell.every(f => clean.test(f)))) nounProblems.push(`${word} ${c} ${n}: ${JSON.stringify(cell)}`);
      }
    }
  });
  check(`noun tables read cleanly (${nounTables} tables)`, nounProblems.slice(0, 5), []);

  // ---------- Adjective declensions ----------

  const adj = (word, g, c, i = 0) => D.NUMBERS.map(n => dict.adjectiveDeclensions(word)[i].cells[g][c][n]);
  check("καλός masculine nominative", adj("καλός", "masculine", "nominative"), [["καλ|ός"], ["καλ|οί"]]);
  check("καλός feminine genitive", adj("καλός", "feminine", "genitive"), [["καλ|ής"], ["καλ|ών"]]);
  check("καλός masculine vocative", adj("καλός", "masculine", "vocative"), [["καλ|έ"], ["καλ|οί"]]);
  check("καλός is an adjective and a noun: one table each", [dict.adjectiveDeclensions("καλός").length, dict.declensions("καλός").length], [1, 1]);
  check("comparative and superlative tables are left out", dict.adjectiveDeclensions("ωραίος").length, 1);
  check("comparative rows in the positive table are left out", adj("ελαφρύς", "neuter", "nominative"), [["ελαφρ|ύ"], ["ελαφρ|ιά"]]);
  check("alternatives, most usual first", adj("ελαφρύς", "masculine", "genitive")[0], ["ελαφρ|ιού", "ελαφρ|ύ"]);
  check("masculine and feminine alike", adj("συνεχής", "feminine", "nominative"), [["συνεχ|ής"], ["συνεχ|είς"]]);
  check("a form that doesn't exist is []", adj("αβανιάρης", "feminine", "genitive")[1], []);
  check("two declensions of one word are one table", dict.adjectiveDeclensions("βαρύς").length, 1);
  check("the headword line's feminine comes first (βαριά, then formal βαρεία)", adj("βαρύς", "feminine", "nominative"), [["βαρ|ιά", "βαρ|εία"], ["βαρ|ιές", "βαρ|είες"]]);
  check("an alternative feminine follows the usual one", adj("θαυματουργός", "feminine", "nominative")[0], ["θαυματουργ|ή", "θαυματουργ|ός"]);
  check("a participle has a table", dict.adjectiveDeclensions("κουρασμένος").map(t => t.pos), ["participle"]);
  check("a verb has no adjective table", dict.adjectiveDeclensions("γράφω"), []);
  check("a noun has no adjective table", dict.adjectiveDeclensions("δρόμος"), []);

  // Every 5th adjective and participle: 24 cells, each a list of clean forms, nominative singular in all three genders.
  const adjectives = dict.rows("SELECT DISTINCT h.word FROM headword h JOIN entry e ON e.headword_id = h.id WHERE e.pos = 'adj' OR e.pos_display = 'participle' ORDER BY h.word").map(r => r[0]);
  const adjProblems = [];
  let adjTables = 0;
  adjectives.filter((_, i) => i % 5 === 0).forEach(word => {
    for (const t of dict.adjectiveDeclensions(word)) {
      adjTables++;
      for (const g of D.GENDERS) for (const c of D.CASES) for (const n of D.NUMBERS) {
        const cell = t.cells[g][c][n];
        if (cell !== null && !(Array.isArray(cell) && cell.every(f => clean.test(f)))) adjProblems.push(`${word} ${g} ${c} ${n}: ${JSON.stringify(cell)}`);
      }
      if (D.GENDERS.some(g => !t.cells[g].nominative.singular?.length)) adjProblems.push(`${word}: no nominative singular in every gender`);
    }
  });
  check(`adjective tables read cleanly (${adjTables} tables)`, adjProblems.slice(0, 5), []);

  console.log(`\n${checks - failures}/${checks} checks passed (${forms.length} stored forms)`);
  process.exit(failures ? 1 : 0);
});
