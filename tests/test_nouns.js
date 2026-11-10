// Checks the noun drills' data and logic: docs/data/words.json and declensions.json, and
// noun-drill.js (noun gender and agreement drills).
//   node tests/test_nouns.js
//
// Every word in declensions.json must be in words.json, every noun must have a gender and a
// nominative singular or plural, and every adjective the agreement drill pairs with nouns must
// have a table. Every phrase the agreement drill can ask for is graded against its own answer,
// which must come back correct, so an odd table fails here instead of in the drill.

const fs = require("fs");
const path = require("path");
const ND = require("../docs/javascripts/noun-drill.js");

const read = p => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));
const words = read("docs/data/words.json");
const tables = read("docs/data/declensions.json");

let failures = 0, checks = 0;
const fail = (label, msg) => { failures++; console.log(`✗ ${label}: ${msg}`); };
const check = (label, got, expected) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(expected)) fail(label, `got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
};

// ---------- The data ----------

const byWord = new Map(words.map(w => [w.greek, w]));
const byTable = new Map(tables.map(t => [t.greek, t]));
for (const t of tables) {
  const w = byWord.get(t.greek);
  if (!w) { fail(t.greek, "in declensions.json but not in words.json"); continue; }
  if (t.pos !== w.pos) fail(t.greek, `pos ${t.pos}, the word list says ${w.pos}`);
  if (t.pos === "noun") {
    if (!t.gender || !t.gender.length || !t.gender.every(g => ND.GENDERS.includes(g))) fail(t.greek, `bad gender ${JSON.stringify(t.gender)}`);
    if (!ND.cell(t, "nominative", "singular") && !ND.cell(t, "nominative", "plural")) fail(t.greek, "no nominative");
  } else if (!ND.cell(t, "nominative", "singular", "masculine")) fail(t.greek, "adjective with no masculine nominative singular");
}
for (const [adjs] of ND.ADJECTIVE_TAGS) {
  for (const a of adjs) {
    if (!byWord.has(a)) fail(a, "in ADJECTIVE_TAGS but not in the word list");
    else if (!byTable.has(a)) fail(a, "in ADJECTIVE_TAGS but has no table in declensions.json");
  }
}

// ---------- Articles and the ν rule ----------

check("την before a vowel", ND.articleForms("feminine", "accusative", "singular", "Αθήνα"), ["την"]);
check("την before π", ND.articleForms("feminine", "accusative", "singular", "πόρτα"), ["την"]);
check("την before ντ", ND.articleForms("feminine", "accusative", "singular", "ντομάτα"), ["την"]);
check("τη before θ", ND.articleForms("feminine", "accusative", "singular", "θάλασσα"), ["τη", "την"]);
check("τη before μ", ND.articleForms("feminine", "accusative", "singular", "μητέρα"), ["τη", "την"]);
check("τον always", ND.articleForms("masculine", "accusative", "singular", "μαθητή"), ["τον"]);
check("των", ND.articleForms("neuter", "genitive", "plural", "σπιτιών"), ["των"]);

// ---------- Phrases and grading ----------

const want = (c, n, g) => ({ case: c, number: n, gender: g });
const phraseOf = (noun, adj, c, n) => ND.phrase({ noun: byTable.get(noun), adjective: adj ? byTable.get(adj) : null, case: c, number: n });
const answer = slots => slots.map(s => s.forms[0]).join(" ");
check("το μεγάλο σπίτι", answer(phraseOf("σπίτι", "μεγάλος", "nominative", "singular")), "το μεγάλο σπίτι");
check("των μεγάλων σπιτιών", answer(phraseOf("σπίτι", "μεγάλος", "genitive", "plural")), "των μεγάλων σπιτιών");
check("τον καλό πατέρα", answer(phraseOf("πατέρας", "καλός", "accusative", "singular")), "τον καλό πατέρα");
check("τη μεγάλη παραλία", answer(phraseOf("παραλία", "μεγάλος", "accusative", "singular")), "τη μεγάλη παραλία");
check("της ωραίας πόλης", answer(phraseOf("πόλη", "ωραίος", "genitive", "singular")), "της ωραίας πόλης");
check("οι βαριές τσάντες", answer(phraseOf("τσάντα", "βαρύς", "nominative", "plural")), "οι βαριές τσάντες");

// typed, then the result for the phrase and for each word.
const CASES = [
  ["τη μεγάλη παραλία", "correct", ["correct", "correct", "correct"]],
  ["την μεγάλη παραλία", "correct", ["correct", "correct", "correct"]],
  ["η μεγάλη παραλία", "form", ["form", "correct", "correct"]],
  ["τη μεγάλης παραλίας", "form", ["correct", "form", "form"]],
  ["μεγάλη παραλία", "missing", ["missing", "correct", "correct"]],
  ["τη μεγαλη παραλία", "accent", ["correct", "accent", "correct"]],
  ["τη μεγάλο παραλία", "form", ["correct", "form", "correct"]],
  ["τη μεγάλη παραλια", "accent", ["correct", "correct", "accent"]],
  ["τη μεγάλη παραλίαα", "spelling", ["correct", "correct", "spelling"]],
  ["τη μεγάλη παραλία εδώ", "extra", ["correct", "correct", "correct"]],
];
const beach = phraseOf("παραλία", "μεγάλος", "accusative", "singular");
for (const [typed, result, perWord] of CASES) {
  const g = ND.gradePhrase(typed, beach, want("accusative", "singular", "feminine"));
  check(`grade "${typed}"`, [g.result, g.words.map(w => w.result)], [result, perWord]);
}
const g1 = ND.gradePhrase("η μεγάλη παραλία", beach, want("accusative", "singular", "feminine"));
check("η is the nominative", ND.describe(g1.words[0].hit, want("accusative", "singular", "feminine")), "nominative");
const g2 = ND.gradePhrase("το μεγάλο σπίτι", phraseOf("αδελφός", "μεγάλος", "accusative", "singular"), want("accusative", "singular", "masculine"));
check("το for τον is the gender", ND.diffs(g2.words[0].hit, want("accusative", "singular", "masculine")), ["gender"]);
const g3 = ND.gradePhrase("τη Αθήνα", ND.phrase({ noun: byTable.get("Αθήνα"), case: "accusative", number: "singular" }), want("accusative", "singular", "feminine"));
check("τη before a vowel", g3.result, "n");

// Every phrase the agreement drill can ask for grades its own answer correct.
let phrases = 0;
for (const noun of tables.filter(t => t.pos === "noun" && t.gender.length === 1 && !t.name)) {
  const tag = byWord.get(noun.greek).tag;
  const adjs = [null, ...ND.adjectivesFor(tag).filter(a => byTable.has(a)).map(a => byTable.get(a))];
  for (const adjective of adjs) for (const c of ND.CASES) for (const n of ND.NUMBERS) {
    const slots = ND.phrase({ noun, adjective, case: c, number: n });
    if (!slots) continue;
    phrases++;
    const typings = [answer(slots)];
    if (slots.some(s => s.forms.length > 1)) typings.push(slots.map(s => s.forms[s.forms.length - 1]).join(" "));
    for (const typed of typings) {
      const g = ND.gradePhrase(typed, slots, want(c, n, noun.gender[0]));
      if (g.result !== "correct") fail(noun.greek, `"${typed}" (${c} ${n}) graded ${g.result}`);
    }
  }
}

// ---------- Endings and English ----------

check("ending of σπίτι", ND.endingOf("σπίτι"), "ι");
check("ending of όνομα", ND.endingOf("όνομα"), "μα");
check("ending of παππούς", ND.endingOf("παππούς"), "ους");
check("ending of μπολ", ND.endingOf("μπολ"), "other");
const nouns = tables.filter(t => t.pos === "noun" && ND.cell(t, "nominative", "singular"));
const counts = ND.endingCounts(nouns);
if (!(counts["ι"].neuter > counts["ι"].feminine + counts["ι"].masculine)) fail("endings", "most -ι nouns should be neuter");
if (!(counts["α"].feminine > counts["α"].neuter)) fail("endings", "most -α nouns should be feminine");
for (const [w, p] of [["house", "houses"], ["bus", "buses"], ["city", "cities"], ["child", "children"], ["day", "days"], ["post office", "post offices"], ["best man", "best men"]]) {
  check(`plural of ${w}`, ND.pluralEn(w), p);
}
check("gloss", ND.gloss("spouse (husband, wife)"), "spouse");
check("gloss", ND.gloss("bill, check, account"), "bill");

console.log(`${tables.filter(t => t.pos === "noun").length} nouns and ${tables.filter(t => t.pos === "adjective").length} adjectives; ${phrases} agreement phrases graded`);
if (failures) { console.log(`${failures} problem(s) in ${checks} checks`); process.exit(1); }
console.log("nouns OK");
