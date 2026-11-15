// Checks the verb groups drill's buckets (docs/javascripts/verb-buckets.js): every aspect-fork
// group is in one bucket, hand-checked verbs land where they should, and every active verb in
// the word list gets a bucket, an explanation and a simple future its own answer passes.
//   node tests/test_verb_buckets.js

const fs = require("fs");
const path = require("path");
const VF = require("../docs/javascripts/verb-forms.js");
const AF = require("../docs/javascripts/aspect-fork.js");
const VB = require("../docs/javascripts/verb-buckets.js");

const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/data", file), "utf8"));
const sheet = read("verbs.json");
const forms = read("verb-forms.json");
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

// Every group is in exactly one bucket.
for (const g of AF.GROUPS) {
  const n = VB.BUCKETS.filter(b => b.groups.includes(g.id)).length;
  check(n === 1, `group ${g.id} is in ${n} buckets`);
}

// Hand-checked: bucket and first simple future.
const EXPECTED = {
  γράφω: ["psi", "γράψω"], δουλεύω: ["psi", "δουλέψω"], κόβω: ["psi", "κόψω"],
  ανοίγω: ["xi", "ανοίξω"], ψάχνω: ["xi", "ψάξω"], παίζω: ["xi", "παίξω"],
  αγοράζω: ["sigma", "αγοράσω"], νιώθω: ["sigma", "νιώσω"], ακούω: ["sigma", "ακούσω"], κλείνω: ["sigma", "κλείσω"], δίνω: ["sigma", "δώσω"],
  μιλάω: ["eta", "μιλήσω"], μπορώ: ["eta", "μπορέσω"], ξεχνώ: ["eta", "ξεχάσω"], πετάω: ["eta", "πετάξω"],
  μένω: ["none", "μείνω"], στέλνω: ["none", "στείλω"], μαθαίνω: ["none", "μάθω"], κάνω: ["none", "κάνω"], έχω: ["none", "έχω"],
  τρώω: ["irregular", "φάω"], βλέπω: ["irregular", "δω"], λέω: ["irregular", "πω"], πίνω: ["irregular", "πιω"],
};

let n = 0;
for (const v of sheet.filter(v => v.voice === "active")) {
  const shown = VF.verbToShow(v.greek, { sheet, forms });
  const fork = shown && AF.analyse(shown.conjugation, shown.verb);
  if (!fork || fork.group === "missing") continue;
  n++;
  const bucket = VB.bucketOf(fork.group);
  const answers = VB.futureAnswers(shown.conjugation, fork);
  const why = VB.why(fork, answers[0]);
  const present = AF.plainText(fork.present);
  check(bucket, `${v.greek}: group ${fork.group} has no bucket`);
  check(answers.length && answers.every(a => a && !/[|\s]/.test(a)), `${v.greek}: odd answers ${answers.join(", ")}`);
  // The fork's bracket marks (γρα{ψ}ω, κλεί(ν)ω) mustn't leak into the text.
  check(why && !/undefined|[[\]{}<>]|[^\s]\(/.test(why), `${v.greek}: explanation "${why}"`);
  for (const a of answers) {
    const g = VB.gradeFuture("θα " + a, answers, present);
    check(g && g.result === "correct", `${v.greek}: θα ${a} graded ${g && g.result}`);
  }
  // θα + the present is the continuous future, unless the two are the same (κάνω, έχω).
  if (!answers.includes(present)) {
    const g = VB.gradeFuture("θα " + present, answers, present);
    check(g && g.result === "present", `${v.greek}: θα ${present} graded ${g && g.result}, not present`);
  }
  if (EXPECTED[v.greek]) {
    const [b, f] = EXPECTED[v.greek];
    check(bucket === b, `${v.greek}: bucket ${bucket}, expected ${b}`);
    check(answers[0] === f, `${v.greek}: future ${answers[0]}, expected ${f}`);
  }
}
for (const greek of Object.keys(EXPECTED)) check(sheet.some(v => v.greek === greek), `${greek} isn't in verbs.json`);

// Grading slips.
const g = (typed, answers, present) => VB.gradeFuture(typed, answers, present).result;
check(g("γραψω", ["γράψω"], "γράφω") === "accent", "γραψω should be an accent slip");
check(g("γράψο", ["γράψω"], "γράφω") === "spelling", "γράψο should be a spelling slip");
check(g("να γράψω", ["γράψω"], "γράφω") === "correct", "να γράψω should count");
check(g("θα γράφω", ["γράψω"], "γράφω") === "present", "θα γράφω is the present stem");
check(g("διαβάσω", ["γράψω"], "γράφω") === "wrong", "διαβάσω is wrong");

if (fails.length) {
  console.log(fails.join("\n"));
  console.log(`\n${fails.length} problem${fails.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`verb buckets OK (${n} verbs)`);
