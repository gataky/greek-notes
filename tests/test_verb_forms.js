// Checks the verb tables' forms: dictionary cells from verb-forms.json, with the engine filling gaps.
//   node tests/test_verb_forms.js

const fs = require("fs");
const path = require("path");
const { conjugate } = require("../docs/javascripts/greek-verbs.js");
const { withForms, dictionaryVerb, verbToShow } = require("../docs/javascripts/verb-forms.js");

const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/data", file), "utf8"));
const verbs = read("verbs.json");
const forms = read("verb-forms.json");
const verb = greek => verbs.find(v => v.greek === greek);
// A verb as the page builds it: from the sheet, or from the dictionary alone.
const conj = greek => withForms(verb(greek) || dictionaryVerb(greek, forms[greek]), forms[greek]);

const show = row => row.map(f => f.replace("|", "")).join(" / ") || "—";
const dig = (c, where) => where.split(".").reduce((o, k) => o[k], c);

// verb -> { "path into the conjugation[person]": what the cell shows }
const EXPECTED = {
  // Alternatives, the ν(ε) notation, and tenses built on top of the dictionary's.
  γράφω: {
    "indicative.present.continuous[5]": "γράφουν(ε)",
    "indicative.past.continuous[5]": "έγραφαν / γράφαν(ε)",
    "indicative.past.simple[5]": "έγραψαν / γράψαν(ε)",
    "indicative.future.continuous[0]": "θα γράφω",
    "indicative.future.simple[3]": "θα γράψουμε",
    "subjunctive.simple[1]": "να γράψεις",
    "indicative.present.perfect[0]": "έχω γράψει",
    "indicative.past.perfect[5]": "είχαν(ε) γράψει",
    "imperative.simple[1]": "γράψτε / γράφτε",
  },
  // Deponent, tagged passive. Its irregular endings are written as "-όμαστε".
  έρχομαι: {
    "indicative.past.simple[0]": "ήρθα / ήλθα",
    "indicative.past.continuous[3]": "ερχόμασταν / ερχόμαστε",
    "indicative.future.simple[0]": "θα έρθω / θα έλθω",
    "imperative.simple[0]": "έλα",
    "imperative.continuous[1]": "έρχεστε",
    "indicative.present.perfect[0]": "έχω έρθει",
  },
  // Tagged active, and has no perfective at all.
  είμαι: {
    "indicative.present.continuous[2]": "είναι",
    "indicative.past.continuous[0]": "ήμουν(α)",
    "indicative.past.continuous[3]": "ήμαστε / ήμασταν",
    "indicative.past.simple[0]": "—",
    "indicative.future.continuous[1]": "θα είσαι",
    "indicative.present.perfect[0]": "—",
    "imperative.continuous[1]": "να είστε / να είσαστε",
  },
  // The passive cells of the active verb's table, reached through its headword line.
  σηκώνομαι: {
    "indicative.present.continuous[0]": "σηκώνομαι",
    "indicative.past.simple[0]": "σηκώθηκα",
    "imperative.simple[0]": "σηκώσου / σήκω",
    "indicative.present.perfect[0]": "έχω σηκωθεί",
  },
  λυπάμαι: { "indicative.present.continuous[0]": "λυπάμαι / λυπούμαι" },
  // A variant spelling: the table is on βοηθάω, and lists that first.
  βοηθώ: {
    "indicative.present.continuous[0]": "βοηθάω / βοηθώ",
    "indicative.past.continuous[5]": "βοηθούσαν(ε) / βοήθαγαν / βοηθάγαν(ε)",  // a Latin v in the source
  },
  // A dash in the data shows as a dash, and the dictionary beats the overrides column.
  υπάρχω: { "imperative.simple[0]": "—", "indicative.past.continuous[3]": "υπάρχαμε" },
  // Rows with no data: the engine's forms, with the sheet's overrides.
  περιμένω: { "indicative.past.simple[0]": "περίμενα", "indicative.past.continuous[0]": "περίμενα" },
  έχω: { "indicative.past.simple[0]": "—", "indicative.past.continuous[0]": "είχα" },
  // Not in the sheet: everything comes from its own table, so nothing is guessed.
  καπνίζω: {
    "indicative.past.continuous[5]": "κάπνιζαν / καπνίζαν(ε)",
    "indicative.past.simple[5]": "κάπνισαν / καπνίσαν(ε)",
    "indicative.future.simple[0]": "θα καπνίσω",
    "imperative.simple[1]": "καπνίστε",
    "indicative.present.perfect[0]": "έχω καπνίσει",
  },
  // Not in the sheet, reached through the active verb's table like σηκώνομαι.
  καπνίζομαι: { "indicative.past.simple[0]": "καπνίστηκα", "imperative.simple[0]": "καπνίσου" },
};

let failures = 0, checks = 0;
const check = (ok, message) => {
  checks++;
  if (!ok) { failures++; console.log(`✗ ${message}`); }
};

for (const [greek, cells] of Object.entries(EXPECTED)) {
  const c = conj(greek);
  for (const [where, expected] of Object.entries(cells)) {
    const [, cell, i] = /^(.*)\[(\d)\]$/.exec(where);
    const got = show(dig(c, cell)[i]);
    check(got === expected, `${greek} ${where}: got "${got}", expected "${expected}"`);
  }
}

// One cell missing from a table falls back on its own; the rest of the column stays.
check(forms.αμφιβάλλω.past[0] === null, "αμφιβάλλω past [0] should have no data, or pick another gap to test");
check(show(conj("αμφιβάλλω").indicative.past.simple[0]) === "αμφέβαλα", "αμφιβάλλω past [0] should come from the engine");
check(show(conj("αμφιβάλλω").indicative.past.simple[1]) === forms.αμφιβάλλω.past[1].join(" / "), "αμφιβάλλω past [1] should come from the dictionary");

// Verbs with no table are entirely the engine's, as are verbs that aren't in the sheet.
const generated = ["ξεπλένω", "μεγαλώνω", "βάζομαι", "ξεπλένομαι", "περιμένομαι", "στεγνώνομαι"];
for (const greek of generated) {
  check(!forms[greek], `${greek} has a table now: pick another verb to test the fallback`);
  if (verb(greek)) check(JSON.stringify(conj(greek)) === JSON.stringify(conjugate(verb(greek))), `${greek} should match the engine`);
}
// A verb with no table at all is still guessed from the parts the dictionary page works out.
const guessed = { greek: "υποθέτω", future: "υποθέσω", aorist: "υπέθεσα", guessed: true };
check(!forms.υποθέτω, "υποθέτω has a table now: pick another verb with no table to test guessing");
check(JSON.stringify(withForms(guessed, forms.υποθέτω)) === JSON.stringify(conjugate(guessed)), "a verb with no table should match the engine");
// A verb with a table isn't guessed: its principal parts are its table's own.
const kapnizo = dictionaryVerb("καπνίζω", forms.καπνίζω);
check(kapnizo.future === "καπνίσω" && kapnizo.aorist === "κάπνισα" && !kapnizo.guessed, "καπνίζω's principal parts should come from its table");
check(conj("καπνίζω").notes.length === 0, "a dictionary verb shouldn't get the engine's notes about the sheet");

// verbToShow picks a verb the same way on every page: word list, then dictionary table, then a guess.
const show_ = (greek, opts = {}) => verbToShow(greek, { sheet: verbs, forms, ...opts });
check(show_("γράφω").verb === verb("γράφω") && !show_("γράφω").verb.note, "a word-list verb with a table is shown as it is");
check(/no conjugation table for μεγαλώνω/.test(show_("μεγαλώνω").verb.note), "a word-list verb with no table gets a note");
check(!show_("μεγαλώνω", { formsLoaded: false }).verb.note, "without verb-forms.json nothing can be said about tables");
check(show_("καπνίζω").verb.fromDictionary && !show_("καπνίζω").verb.guessed, "a dictionary verb with a table isn't guessed");
check(show_("καπνίζω", { guess: () => { throw new Error("guessed"); } }) !== null, "a verb with a table never asks for a guess");
const guessedShow = show_("υποθέτω", { guess: () => ({ future: "υποθέσω", aorist: "υπέθεσα" }) });
check(guessedShow.verb.guessed && /worked out/.test(guessedShow.verb.note), "a verb with no table is guessed, with a note");
check(show_("υποθέτω") === null, "a verb with no table and no guess shows nothing");

// Cells the engine filled are flagged for the grid to mark; the dictionary's own cells and the
// dashes the engine leaves (a sheet's "no perfective") aren't.
const flags = greek => conj(greek).generated;
const flagged = g => Object.entries(g).filter(([k, v]) => (Array.isArray(v) ? v.some(Boolean) : v)).map(([k]) => k);
check(flags("περιμένω").past.every(Boolean) && flags("περιμένω").dependent.every(Boolean), "περιμένω's simple forms should be flagged as generated");
check(!flags("περιμένω").present.some(Boolean), "περιμένω's present comes from the dictionary");
check(flags("αμφιβάλλω").past[0] && !flags("αμφιβάλλω").past[1], "only αμφιβάλλω's missing past cell should be flagged");
check(flagged(flags("καπνίζω")).length === 0, `καπνίζω has nothing generated, got ${flagged(flags("καπνίζω"))}`);
check(flagged(flags("έχω")).length === 0, "έχω's dashes are the sheet's no perfective, not generated forms");
check(!conjugate(verb("μεγαλώνω")).generated, "a verb with no table has no per-cell flags: the page notes it once");
// A dictionary verb whose table has no simple stem at all says so, instead of looking complete.
const noSimple = Object.keys(forms).find(g => !verb(g) && !dictionaryVerb(g, forms[g]).future && !dictionaryVerb(g, forms[g]).aorist);
check(noSimple && /no simple-stem forms/.test(dictionaryVerb(noSimple, forms[noSimple]).note), "a dictionary verb with no simple stem should get a note");

// Every verb, in the sheet or only in the dictionary: the grid's cells have the right shape,
// and hold words, not Wiktionary's markup.
const GREEK = /^[Ͱ-Ͽἀ-῿]+(\([εα]\))?$/;
const PATHS = ["indicative.present.continuous", "indicative.past.continuous", "indicative.past.simple", "indicative.future.simple", "subjunctive.simple", "indicative.present.perfect"];
const everyVerb = [...verbs, ...Object.keys(forms).filter(g => !verb(g)).map(g => dictionaryVerb(g, forms[g]))];
for (const v of everyVerb) {
  const c = withForms(v, forms[v.greek]);
  for (const where of PATHS) {
    check(dig(c, where).length === 6, `${v.greek} ${where} should have six persons`);
  }
  const cells = [...PATHS.flatMap(p => dig(c, p)), ...c.imperative.continuous, ...c.imperative.simple];
  for (const form of cells.flat()) {
    check(form.replace(/^να /, "").split(" ").every(w => GREEK.test(w.replace("|", ""))), `${v.greek}: "${form}" isn't a clean form`);
  }
}

// Ending highlights: the engine's split, the same ending, the same stem, or none when irregular.
const marked = (greek, where, i) => dig(conj(greek), where)[i][0];
for (const [greek, where, i, expected] of [
  ["γράφω", "indicative.present.continuous", 5, "γράφ|ουν(ε)"],
  ["γράφω", "indicative.past.continuous", 5, "έγραφ|αν"],
  ["έρχομαι", "indicative.past.continuous", 3, "ερχ|όμασταν"],
  ["κάθομαι", "imperative.continuous", 0, "κάθ|ου"],
  ["αγαπάω", "imperative.simple", 0, "αγάπησ|ε"],
  ["είμαι", "indicative.present.continuous", 0, "είμαι"],
]) {
  check(marked(greek, where, i) === expected, `${greek} ${where} [${i}]: got "${marked(greek, where, i)}", expected "${expected}"`);
}
let split = 0, total = 0;
for (const v of everyVerb.filter(v => forms[v.greek] && v.greek !== "είμαι")) {
  const I = withForms(v, forms[v.greek]).indicative;
  for (const f of [I.present.continuous, I.past.continuous, I.past.simple].flat(2)) { total++; split += f.includes("|"); }
}
check(split / total > 0.98, `only ${split} of ${total} indicative forms have an ending highlight`);

const fromSheet = verbs.filter(v => forms[v.greek]).length;
console.log(`${checks - failures}/${checks} verb form checks passed (${fromSheet} of ${verbs.length} sheet verbs, ${Object.keys(forms).length - fromSheet} more from the dictionary, ${split}/${total} forms highlighted)`);
process.exit(failures ? 1 : 0);
