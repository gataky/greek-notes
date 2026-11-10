// Checks the preposition drill's sentence bank (docs/data/preposition-sentences.json) and grader.
//   node tests/test_preposition_sentences.js
//
// Every sentence must name a noun with a table in declensions.json, have English with one
// *marked* phrase, and Greek that holds its answer exactly once. The answer must read as its
// preposition (or none) followed by the noun in the accusative, with the article and any
// adjectives agreeing (preposition-drill.js's analyse), and σε joined to the article. The
// grader must mark the answer and each alternative in `also` correct.

const fs = require("fs");
const path = require("path");
const PD = require("../docs/javascripts/preposition-drill.js");
const GS = require("../docs/javascripts/gap-sentences.js");

const read = p => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));
const bank = read("docs/data/preposition-sentences.json");
const tables = read("docs/data/declensions.json");
const byWord = new Map(tables.map(t => [t.greek, t]));
const adjectives = new Map(tables.filter(t => t.pos === "adjective").map(t => [t.greek, t]));

let failures = 0;
const fail = (i, msg) => { failures++; console.log(`✗ #${i} ${msg}`); };

const seen = new Set(), byGroup = {}, items = [];
bank.forEach((s, i) => {
  const label = s.el;
  if (!s.en || !s.el || !s.answer || !s.noun || !s.prep) return fail(i, `${label} — missing a field`);
  if ((s.en.match(/\*/g) || []).length !== 2 || !GS.target(s.en)[1]) fail(i, `${label} — the English should mark one phrase, *like this*`);
  if (GS.count(s.el, s.answer) !== 1) fail(i, `${label} — the answer "${s.answer}" should appear once in the Greek`);
  if (seen.has(s.el)) fail(i, `${label} — duplicate Greek sentence`);
  seen.add(s.el);
  const e = PD.analyse(s, byWord.get(s.noun), adjectives);
  if (e.error) return fail(i, `${label} — ${e.error}`);
  if (e.prep !== s.prep) fail(i, `${label} — the answer's preposition is "${e.prep}", the sentence says "${s.prep}"`);
  for (const a of s.also || []) {
    const x = PD.analyse({ ...s, answer: a }, byWord.get(s.noun), adjectives);
    if (x.error) fail(i, `${label} — also "${a}": ${x.error}`);
  }
  const item = { ...s, expected: e };
  for (const a of [s.answer, ...(s.also || [])]) {
    const g = PD.grade(a, item);
    if (!g || g.result !== "correct") fail(i, `${label} — "${a}" graded ${g && g.result}`);
  }
  const group = PD.groupOf(s.prep);
  byGroup[group] = (byGroup[group] || 0) + 1;
  items.push(item);
});
for (const g of PD.GROUPS) if (!byGroup[g.key]) fail("-", `no sentences for ${g.label}`);

// [answer, typed, result]
const find = answer => items.find(it => it.answer === answer);
const CASES = [
  ["στην παραλία", "στην παραλία", "correct"],
  ["στην παραλία", "στη παραλία", "n"],
  ["στην παραλία", "σε την παραλία", "contraction"],
  ["στην παραλία", "στην παραλίας", "form"],
  ["στην παραλία", "στο παραλία", "form"],
  ["στην παραλία", "από την παραλία", "preposition"],
  ["στην παραλία", "παραλία", "preposition"],
  ["στην παραλία", "στην παραλια", "accent"],
  ["στη μητέρα μου", "στην μητέρα μου", "correct"],
  ["δίπλα στο σχολείο", "δίπλα το σχολείο", "preposition"],
  ["δίπλα στο σχολείο", "κοντά στο σχολείο", "preposition"],
  ["τη Δευτέρα", "την Δευτέρα", "correct"],
  ["τη Δευτέρα", "στη Δευτέρα", "preposition"],
  ["τη Δευτέρα", "η Δευτέρα", "form"],
  ["με μολύβι", "με το μολύβι", "extra article"],
  ["με το λεωφορείο", "με λεωφορείο", "correct"],
  ["με τον πατέρα μου", "με τον πατέρας μου", "form"],
  ["με τον πατέρα μου", "με πατέρα μου", "missing article"],
  ["με το μεγάλο μαχαίρι", "με το μεγάλη μαχαίρι", "form"],
  ["για Αθήνα", "για την Αθήνα", "extra article"],
  ["γύρω από τη λίμνη", "γυρω απο τη λιμνη", "accent"],
  ["γύρω από τη λίμνη", "γυρω απο τη λίμνη", "accent"],
  ["κοντά στο πάρκο", "κοντα στο παρκο", "accent"],
  ["δίπλα στο σχολείο", "διπλα το σχολείο", "preposition"],
];
for (const [answer, typed, want] of CASES) {
  const it = find(answer);
  if (!it) { fail("grade", `no sentence with the answer ${answer}`); continue; }
  const g = PD.grade(typed, it);
  if (!g || g.result !== want) fail("grade", `"${typed}" for ${answer} graded ${g && g.result}, expected ${want}`);
}

console.log(`${bank.length} sentences (` + PD.GROUPS.map(g => `${byGroup[g.key] || 0} ${g.label}`).join(", ") + ")");
if (failures) { console.log(`${failures} problem(s)`); process.exit(1); }
console.log("preposition sentences OK");
