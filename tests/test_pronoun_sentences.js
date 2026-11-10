// Checks the object pronoun drill's sentence bank (docs/data/pronoun-sentences.json) and grader.
//   node tests/test_pronoun_sentences.js
//
// Every sentence must have a known rule, English with one *marked* phrase, and Greek that holds
// its answer exactly once. The answer and each accepted alternative must be particles, weak
// pronouns and one verb, built the way the rule says (pronoun-drill.js's ruleProblem), and the
// grader must mark each of them correct.

const fs = require("fs");
const path = require("path");
const PD = require("../docs/javascripts/pronoun-drill.js");
const GS = require("../docs/javascripts/gap-sentences.js");

const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/data/pronoun-sentences.json"), "utf8"));

let failures = 0;
const fail = (i, msg) => { failures++; console.log(`✗ #${i} ${msg}`); };

const seen = new Set(), byRule = {};
bank.forEach((s, i) => {
  const label = `${s.el}`;
  if (!PD.RULES.includes(s.rule)) return fail(i, `${label} — unknown rule "${s.rule}"`);
  byRule[s.rule] = (byRule[s.rule] || 0) + 1;
  if (!s.en || !s.el || !s.answer) return fail(i, `${label} — missing English, Greek or answer`);
  if ((s.en.match(/\*/g) || []).length !== 2 || !GS.target(s.en)[1]) fail(i, `${label} — the English should mark one phrase, *like this*`);
  if (GS.count(s.el, s.answer) !== 1) fail(i, `${label} — the answer "${s.answer}" should appear once in the Greek`);
  if (seen.has(s.el)) fail(i, `${label} — duplicate Greek sentence`);
  seen.add(s.el);
  for (const a of [s.answer, ...(s.also || [])]) {
    const problem = PD.ruleProblem(a, s.rule);
    if (problem) fail(i, `${label} — "${a}": ${problem}`);
    const g = PD.grade(a, { answers: [s.answer, ...(s.also || [])] });
    if (!g || g.result !== "correct") fail(i, `${label} — "${a}" graded ${g && g.result}`);
  }
});
for (const r of PD.RULES) if (!byRule[r]) fail("-", `no sentences for the rule "${r}"`);

// [accepted answers, typed, result]
const CASES = [
  [["θα σου το δώσω"], "θα σου το δώσω", "correct"],
  [["θα σου το δώσω"], "Θα σου το δώσω.", "correct"],
  [["θα σου το δώσω"], "θα το σου δώσω", "order"],
  [["θα σου το δώσω"], "θα σου δώσω", "pronoun"],
  [["θα σου το δώσω"], "θα του το δώσω", "pronoun"],
  [["θα σου το δώσω"], "σου το δώσω", "particle"],
  [["θα σου το δώσω"], "θα σου το δωσω", "accent"],
  [["θα σου το δώσω"], "θα σου το δόσω", "spelling"],
  [["θα σου το δώσω"], "θα σου το δίνω", "verb"],
  [["διάβασέ το"], "διάβασε το", "accent"],
  [["διάβασέ το"], "το διάβασε", "order"],
  [["δώσ' μου το", "δώσε μου το"], "δώσ’ μου το", "correct"],
  [["δώσ' μου το", "δώσε μου το"], "δώσε μου το", "correct"],
  [["δεν σε καταλαβαίνω"], "δε σε καταλαβαίνω", "correct"],
  [["δεν την ξέρω"], "δεν τη ξέρω", "pronoun"],
  [["τη φάγαμε"], "την φάγαμε", "correct"],
  [["μη με περιμένεις"], "μην με περιμένεις", "correct"],
  [["την ξέρω"], "ξέρω την", "order"],
];
for (const [answers, typed, want] of CASES) {
  const g = PD.grade(typed, { answers });
  if (!g || g.result !== want) fail("grade", `"${typed}" for ${answers[0]} graded ${g && g.result}, expected ${want}`);
}

console.log(`${bank.length} sentences (` + PD.RULES.map(r => `${byRule[r] || 0} ${r}`).join(", ") + ")");
if (failures) { console.log(`${failures} problem(s)`); process.exit(1); }
console.log("pronoun sentences OK");
