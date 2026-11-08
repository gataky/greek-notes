// Checks the tense and aspect drill's sentence bank (docs/data/aspect-sentences.json).
//   node tests/test_aspect_sentences.js            run the checks
//   node tests/test_aspect_sentences.js --gaps     also list verbs missing a tense or aspect
//
// Every sentence must name an active verb from verbs.json, a tense and aspect it has
// forms for, a reason that fits the aspect, an English sentence with the verb to
// translate marked *like this*, and a Greek sentence containing exactly one word that
// is that verb in that form and person (with θα or να in front where it takes one).

const fs = require("fs");
const path = require("path");
const VF = require("../docs/javascripts/verb-forms.js");
const AD = require("../docs/javascripts/aspect-drill.js");

const read = p => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));
const sheet = read("docs/data/verbs.json");
const forms = read("docs/data/verb-forms.json");
const bank = read("docs/data/aspect-sentences.json");

const active = sheet.filter(v => v.voice === "active");
const formsByVerb = new Map(active.map(v => [v.greek, AD.formsOf(VF.verbToShow(v.greek, { sheet, forms }).conjugation)]));
const REASONS = { continuous: ["ongoing", "repeated"], simple: ["once"] };

let failures = 0;
const fail = (i, msg) => { failures++; console.log(`✗ #${i} ${msg}`); };

const seen = new Set();
const count = new Map();
const answers = [];
bank.forEach((s, i) => {
  const label = `${s.verb} ${s.tense} ${s.aspect} ${s.person}: ${s.el}`;
  const f = formsByVerb.get(s.verb);
  if (!f) return fail(i, `${label} — ${s.verb} isn't an active verb in verbs.json`);
  if (!AD.PERSONS.includes(s.person)) return fail(i, `${label} — unknown person`);
  const cell = AD.TENSES.includes(s.tense) && AD.cellOf(s.tense, s.aspect);
  if (!cell || cell.aspect !== s.aspect) return fail(i, `${label} — unknown tense or aspect`);
  if (!REASONS[s.aspect].includes(s.reason)) fail(i, `${label} — reason "${s.reason}" doesn't fit the ${s.aspect} aspect`);
  if (!s.en || !s.el) return fail(i, `${label} — missing English or Greek`);
  if ((s.en.match(/\*/g) || []).length !== 2 || !AD.target(s.en)[1].trim()) fail(i, `${label} — the English should mark the verb once, *like this*`);
  if (s.person === "2sg" && !/\(sg\)/.test(s.en)) fail(i, `${label} — 2nd singular English should say "you (sg)"`);
  if (s.person === "2pl" && !/\(pl\)/.test(s.en)) fail(i, `${label} — 2nd plural English should say "you (pl)"`);
  if (seen.has(s.el)) fail(i, `${label} — duplicate Greek sentence`);
  seen.add(s.el);

  const want = f[cell.key][AD.PERSONS.indexOf(s.person)];
  if (!want.length) return fail(i, `${label} — ${s.verb} has no ${cell.label} form`);
  const hits = AD.answersIn(s.el, f, cell, s.person);
  if (hits.length !== 1) {
    return fail(i, `${label} — expected one word matching ${cell.particle ? cell.particle + " + " : ""}${want.join(" / ")}, found ${hits.length}`);
  }
  answers.push([i, s, hits[0], f]);
  const key = `${s.verb} ${cell.key}`;
  count.set(key, (count.get(key) || 0) + 1);
});

// The grader must mark each sentence's own answer correct.
for (const [i, s, answer, f] of answers) {
  const g = AD.grade(answer, { ...s, answer, forms: f });
  if (!g || g.result !== "correct") fail(i, `${s.verb} ${s.tense} ${s.aspect} ${s.person}: grader marks its own answer ${answer} as ${g && g.result}`);
}

// The grader's verdicts on typical answers.
{
  const item = (verb, tense, aspect, person) => {
    const f = formsByVerb.get(verb), cell = AD.cellOf(tense, aspect);
    const answer = (cell.particle ? cell.particle + " " : "") + f[cell.key][AD.PERSONS.indexOf(person)][0];
    return { tense, aspect, person, answer, forms: f };
  };
  const CASES = [
    ["γράφω", "past", "simple", "1sg", "έγραψα", "correct"],
    ["γράφω", "past", "simple", "1sg", "έγραφα", "wrong aspect"],
    ["γράφω", "past", "continuous", "3pl", "έγραφαν", "correct"],
    ["γράφω", "past", "continuous", "3pl", "έγραφε", "wrong person"],
    ["γράφω", "past", "continuous", "1sg", "γράφω", "wrong tense"],
    ["γράφω", "past", "simple", "1sg", "θα γράψω", "wrong tense"],
    ["γράφω", "past", "simple", "1sg", "εγραψα", "accent"],
    ["γράφω", "past", "simple", "1sg", "έγγραψα", "spelling"],
    ["γράφω", "future", "simple", "1sg", "θα γράψω", "correct"],
    ["γράφω", "future", "simple", "1sg", "θα το γράψω", "correct"],
    ["γράφω", "future", "simple", "1sg", "Θα το γράψω αύριο.", "correct"],
    ["γράφω", "future", "simple", "1sg", "γράψω", "particle"],
    ["γράφω", "future", "simple", "1sg", "να γράψω", "particle"],
    ["γράφω", "future", "simple", "1sg", "θα γράφω", "wrong aspect"],
    ["γράφω", "future", "continuous", "1sg", "γράφω", "particle"],
    ["γράφω", "future", "continuous", "1pl", "θα γράψουμε", "wrong aspect"],
    ["γράφω", "present", "continuous", "1sg", "θα γράφω", "particle"],
    ["γράφω", "na", "simple", "2sg", "να γράψεις", "correct"],
    ["γράφω", "na", "simple", "2sg", "να γράφεις", "wrong aspect"],
    ["γράφω", "na", "simple", "2sg", "θέλω να γράψεις", "correct"],
    ["γράφω", "na", "continuous", "3sg", "να μην γράφει", "correct"],
    ["γράφω", "na", "continuous", "3sg", "να γράψει", "wrong aspect"],
    ["μιλάω", "past", "continuous", "1sg", "μίλαγα", "correct"],
    ["μιλάω", "past", "continuous", "1sg", "μιλούσα", "correct"],
    ["μιλάω", "past", "continuous", "1sg", "μίλησα", "wrong aspect"],
    ["λέω", "past", "simple", "3pl", "είπαν", "correct"],
    ["λέω", "past", "simple", "3pl", "είπανε", "correct"],
    ["λέω", "future", "simple", "1sg", "θα λέω", "wrong aspect"],
    ["τρώω", "future", "simple", "1pl", "θα φάμε", "correct"],
    ["τρώω", "future", "simple", "1pl", "θα τρώμε", "wrong aspect"],
    ["κάνω", "future", "simple", "1sg", "θα κάνω", "correct"],
  ];
  for (const [verb, tense, aspect, person, typed, want] of CASES) {
    const g = AD.grade(typed, item(verb, tense, aspect, person));
    if (!g || g.result !== want) fail("grade", `${verb} ${tense} ${aspect} ${person}: "${typed}" graded ${g && g.result}, expected ${want}`);
  }
}

// Coverage: every active verb, in every form it has, where the bank has it.
const gaps = [];
for (const v of active) {
  const f = formsByVerb.get(v.greek);
  if (!AD.CELLS.some(c => count.get(`${v.greek} ${c.key}`))) fail("-", `${v.greek} has no sentences`);
  for (const c of AD.CELLS) if (f[c.key][0].length && !count.get(`${v.greek} ${c.key}`)) gaps.push(`${v.greek} ${c.key}`);
}

const byCell = Object.fromEntries(AD.CELLS.map(c => [c.key, 0]));
for (const [, s] of answers) byCell[AD.cellOf(s.tense, s.aspect).key]++;
console.log(`${bank.length} sentences for ${new Set(bank.map(s => s.verb)).size} of ${active.length} active verbs (` +
  AD.CELLS.map(c => `${byCell[c.key]} ${c.key}`).join(", ") + ")");
if (process.argv.includes("--gaps")) gaps.forEach(g => console.log("  no sentence: " + g));

if (failures) { console.log(`${failures} problem(s)`); process.exit(1); }
console.log("aspect sentences OK");
