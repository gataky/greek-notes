// Checks the verb tables' forms: dictionary cells from verb-forms.json, with the engine filling gaps.
//   node scripts/test_verb_forms.js

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { conjugate } = require("../docs/tools/greek-verbs.js");
const { withForms } = require("../docs/tools/verb-forms.js");

const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/tools", file), "utf8"));
const verbs = read("verbs.json");
const forms = read("verb-forms.json");
const verb = greek => verbs.find(v => v.greek === greek);
const conj = greek => withForms(verb(greek), forms[greek]);

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
const guessed = { greek: "καπνίζω", future: "καπνίσω", aorist: "κάπνισα" };
check(JSON.stringify(withForms(guessed, undefined)) === JSON.stringify(conjugate(guessed)), "a verb outside the sheet should match the engine");

// Every verb: the grid's cells have the right shape, and hold words, not Wiktionary's markup.
const GREEK = /^[Ͱ-Ͽἀ-῿]+(\([εα]\))?$/;
const PATHS = ["indicative.present.continuous", "indicative.past.continuous", "indicative.past.simple", "indicative.future.simple", "subjunctive.simple", "indicative.present.perfect"];
for (const v of verbs) {
  const c = withForms(v, forms[v.greek]);
  for (const where of PATHS) {
    check(dig(c, where).length === 6, `${v.greek} ${where} should have six persons`);
  }
  const cells = [...PATHS.flatMap(p => dig(c, p)), ...c.imperative.continuous, ...c.imperative.simple];
  for (const form of cells.flat()) {
    check(form.split(" ").every(w => GREEK.test(w.replace("|", ""))), `${v.greek}: "${form}" isn't a clean form`);
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
for (const v of verbs.filter(v => forms[v.greek] && v.greek !== "είμαι")) {
  const I = withForms(v, forms[v.greek]).indicative;
  for (const f of [I.present.continuous, I.past.continuous, I.past.simple].flat(2)) { total++; split += f.includes("|"); }
}
check(split / total > 0.99, `only ${split} of ${total} indicative forms have an ending highlight`);

console.log(`${checks - failures}/${checks} verb form checks passed (${Object.keys(forms).length} of ${verbs.length} verbs from the dictionary, ${split}/${total} forms highlighted)`);
process.exit(failures ? 1 : 0);
