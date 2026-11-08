// Checks the active or passive drill's sentence bank (docs/data/voice-sentences.json).
//   node tests/test_voice_sentences.js            run the checks
//   node tests/test_voice_sentences.js --gaps     also list verb/person pairs with no sentence
//
// Every sentence must name a verb the drill uses (a passive or deponent in verbs.json,
// or a passive's active form), a reason that fits its voice, and a Greek sentence
// containing exactly one word that is that verb in that person.

const fs = require("fs");
const path = require("path");
const GreekVerbs = require("../docs/javascripts/greek-verbs.js");
const VD = require("../docs/javascripts/voice-drill.js");

const read = p => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));
const verbs = read("docs/data/verbs.json");
const bank = read("docs/data/voice-sentences.json");

const byGreek = new Map(verbs.map(v => [v.greek, v]));
const passives = verbs.filter(v => v.voice === "passive" && v.activeForm && byGreek.has(v.activeForm));
const deponents = verbs.filter(v => v.voice === "deponent" && v.greek !== "είμαι");
const activeOf = new Map(passives.map(v => [v.activeForm, v]));

const REASONS = {
  active: ["object", "intransitive"],
  passive: ["self", "each", "done", "happens"],
  deponent: ["deponent"],
};
const voiceOf = g => (activeOf.has(g) ? "active" : byGreek.get(g) && byGreek.get(g).voice);

let failures = 0;
const fail = (i, msg) => { failures++; console.log(`✗ #${i} ${msg}`); };

const seen = new Set();
const count = new Map();
bank.forEach((s, i) => {
  const label = `${s.verb} ${s.person}: ${s.el}`;
  const voice = voiceOf(s.verb);
  if (!voice || !REASONS[voice]) return fail(i, `${label} — ${s.verb} isn't a passive, deponent or passive's active form in verbs.json`);
  if (!VD.PERSONS.includes(s.person)) return fail(i, `${label} — unknown person`);
  if (!REASONS[voice].includes(s.reason)) fail(i, `${label} — reason "${s.reason}" doesn't fit a ${voice} verb`);
  if (!s.en || !s.el) fail(i, `${label} — missing English or Greek`);
  if (s.person === "2sg" && !/\(sg\)/.test(s.en)) fail(i, `${label} — 2nd singular English should say "you (sg)"`);
  if (s.person === "2pl" && !/\(pl\)/.test(s.en)) fail(i, `${label} — 2nd plural English should say "you (pl)"`);
  if (seen.has(s.el)) fail(i, `${label} — duplicate Greek sentence`);
  seen.add(s.el);

  const forms = VD.present(GreekVerbs, byGreek.get(s.verb));
  const hits = VD.answersIn(s.el, forms, s.person);
  if (hits.length !== 1) {
    const want = forms[VD.PERSONS.indexOf(s.person)].join(" / ");
    fail(i, `${label} — expected one word matching ${want}, found ${hits.length}`);
  }
  const key = `${s.verb} ${s.person}`;
  count.set(key, (count.get(key) || 0) + 1);
});

// The grader must mark each sentence's own answer correct.
bank.forEach((s, i) => {
  const voice = voiceOf(s.verb);
  if (!voice) return;
  const pas = voice === "active" ? activeOf.get(s.verb) : byGreek.get(s.verb);
  const act = voice === "active" ? byGreek.get(s.verb) : voice === "passive" ? byGreek.get(pas.activeForm) : null;
  const forms = { active: act ? VD.present(GreekVerbs, act) : null, passive: VD.present(GreekVerbs, pas) };
  const answer = VD.answersIn(s.el, voice === "active" ? forms.active : forms.passive, s.person)[0];
  if (!answer) return;
  const g = VD.grade(answer, { voice, person: s.person, answer, forms });
  if (!g || g.result !== "correct") fail(i, `${s.verb} ${s.person}: grader marks its own answer ${answer} as ${g && g.result}`);
});

// The grader's verdicts on typical answers.
{
  const item = (verb, voice, person) => {
    const v = byGreek.get(verb);
    const pas = voice === "active" ? activeOf.get(verb) : v;
    const act = voice === "active" ? v : voice === "passive" ? byGreek.get(v.activeForm) : null;
    const forms = { active: act ? VD.present(GreekVerbs, act) : null, passive: VD.present(GreekVerbs, pas) };
    const answer = (voice === "active" ? forms.active : forms.passive)[VD.PERSONS.indexOf(person)][0];
    return { voice, person, answer, forms };
  };
  const CASES = [
    ["σηκώνομαι", "passive", "1pl", "σηκωνόμαστε", "correct"],
    ["σηκώνομαι", "passive", "2pl", "σηκώνεστε", "correct"],
    ["σηκώνομαι", "passive", "2pl", "σηκωνόσαστε", "correct"],
    ["σηκώνομαι", "passive", "1pl", "σηκωνομαστε", "accent"],
    ["σηκώνομαι", "passive", "1pl", "σικονόμαστε", "spelling"],
    ["σηκώνομαι", "passive", "1pl", "Σηκωνόμαστε νωρίς.", "correct"],
    ["βρέχομαι", "passive", "3pl", "βρέχεται", "wrong person"],
    ["ψήνομαι", "passive", "3sg", "ψήνει", "wrong voice"],
    ["στεγνώνω", "active", "1sg", "στεγνώνομαι", "wrong voice"],
    ["βάζω", "active", "3pl", "βάζουνε", "correct"],
    ["χρειάζομαι", "deponent", "1pl", "χρειάζομαι", "wrong person"],
    ["χρειάζομαι", "deponent", "1pl", "χριαζόμαστε", "spelling"],
    ["προσεύχομαι", "deponent", "2sg", "προσεύχει", "wrong voice"],
    ["θυμάμαι", "deponent", "2pl", "θυμόσαστε", "correct"],
    ["σερβίρομαι", "passive", "1pl", "σερβιόμαστε", "spelling"],
  ];
  for (const [verb, voice, person, typed, want] of CASES) {
    const g = VD.grade(typed, item(verb, voice, person));
    if (!g || g.result !== want) fail("grade", `${verb} ${person}: "${typed}" graded ${g && g.result}, expected ${want}`);
  }
}

// Coverage: every drilled verb in every person, where the bank has it.
const gaps = [];
const drilled = [...passives.flatMap(p => [p.activeForm, p.greek]), ...deponents.map(d => d.greek)];
for (const g of drilled) for (const p of VD.PERSONS) if (!count.get(`${g} ${p}`)) gaps.push(`${g} ${p}`);
for (const g of drilled) if (!VD.PERSONS.some(p => count.get(`${g} ${p}`))) fail("-", `${g} has no sentences`);

const byVoice = { active: 0, passive: 0, deponent: 0 };
bank.forEach(s => { const v = voiceOf(s.verb); if (v in byVoice) byVoice[v]++; });
console.log(`${bank.length} sentences (${byVoice.active} active, ${byVoice.passive} passive, ${byVoice.deponent} deponent), ` +
  `${drilled.length * 6 - gaps.length} of ${drilled.length * 6} verb/person pairs covered`);
if (process.argv.includes("--gaps")) gaps.forEach(g => console.log("  no sentence: " + g));

if (failures) { console.log(`${failures} problem(s)`); process.exit(1); }
console.log("voice sentences OK");
