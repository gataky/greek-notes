// Checks the aspect forks (docs/javascripts/aspect-fork.js): the group each verb falls in and
// the highlighted letters, worked out from the verb tables' forms.
//   node tests/test_aspect_forks.js            run the checks
//   node tests/test_aspect_forks.js --groups   also print how many dictionary verbs are in each group
//
// GROUPS and MARKUP are hand-checked. They began as a hand-made page of forks for the word
// list's verbs; where the dictionary lists another form first (προσέφερα), the dictionary wins.
// Then every verb in verb-forms.json must analyse without errors, and its marked forms must
// spell the forms it was given.

const fs = require("fs");
const path = require("path");
const VF = require("../docs/javascripts/verb-forms.js");
const AF = require("../docs/javascripts/aspect-fork.js");

const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/data", file), "utf8"));
const sheet = read("verbs.json");
const forms = read("verb-forms.json");
const fork = greek => {
  const shown = VF.verbToShow(greek, { sheet, forms });
  return shown && AF.analyse(shown.conjugation, shown.verb);
};

// group -> verbs in it
const GROUPS = {
  labials: "γράφω κόβω ανάβω επιστρέφω επιτρέπω ανατρέφω",
  velars: "ανοίγω τρέχω βρέχω φτιάχνω ψάχνω υπάρχω",
  dentals: "διαβάζω αγοράζω αρχίζω βουρτσίζω βράζω γεμίζω γνωρίζω δοκιμάζω ελπίζω εξετάζω καθαρίζω καθίζω κερδίζω νομίζω σκουπίζω σώζω τηγανίζω νιώθω ταΐζω εκφράζω",
  "zeta-xi": "αλλάζω αγγίζω κοιτάζω παίζω",
  ev: "δουλεύω πιστεύω μαγειρεύω ανακατεύω χαϊδεύω",
  vowel: "ακούω αγορεύω αναλύω",
  "nu-sigma": "λύνω κλείνω πληρώνω τελειώνω σηκώνω στεγνώνω μεγαλώνω αφήνω ψήνω ντύνω χύνω χάνω δένω δίνω",
  liquids: "μένω στέλνω πλένω ξεπλένω θερμαίνω φέρνω αμφιβάλλω",
  same: "κάνω περιμένω προσφέρω σερβίρω",
  strong: "μαθαίνω καταλαβαίνω ανεβαίνω κατεβαίνω βγαίνω μπαίνω αποτυγχάνω παραλαμβάνω",
  aino: "χορταίνω σωπαίνω",
  "b1-eta": "μιλάω ρωτάω απαντάω αγαπάω ακολουθάω βοηθώ ζητάω κολυμπώ κρατάω μελετώ νικάω περπατάω πουλάω προτιμώ σταματάω συναντάω τηλεφωνάω χαιρετώ χτυπάω",
  "b1-other": "περνάω ξεχνώ πεινώ παρακαλώ πονάω φοράω πετάω",
  b2: "μπορώ ζω οδηγώ αργώ ευχαριστώ χρησιμοποιώ αγνοώ",
  irregular: "βλέπω λέω τρώω πάω πηγαίνω πίνω βρίσκω παίρνω βάζω βγάζω πέφτω φεύγω θέλω",
  "no-perf": "έχω ξέρω απέχω",
};

// verb -> [present, past continuous, aorist, dependent], in aspect-fork.js's bracket notation
const MARKUP = {
  γράφω: ["γράφω", "[έ]γραφα", "[έ]γρα{ψ}α", "γρά{ψ}ω"],
  επιστρέφω: ["επιστρέφω", "επ[έ]στρεφα", "επ[έ]στρε{ψ}α", "επιστρέ{ψ}ω"],
  ανατρέφω: ["ανατρέφω", "αν[έ]τρεφα", "αν[έ]{θ}ρε{ψ}α", "ανα{θ}ρέ{ψ}ω"],
  φτιάχνω: ["φτιάχ(ν)ω", "[έ]φτιαχ(ν)α", "[έ]φτια{ξ}α", "φτιά{ξ}ω"],
  υπάρχω: ["υπάρχω", "υπ[ή]ρχα", "υπ[ή]ρ{ξ}α", "υπάρ{ξ}ω"],
  διαβάζω: ["διαβάζω", "διάβαζα", "διάβα{σ}α", "διαβά{σ}ω"],
  ταΐζω: ["ταΐζω", "τάιζα", "τάι{σ}α", "ταΐ{σ}ω"],
  εκφράζω: ["εκφράζω", "ε[ξέ]φραζα", "ε[ξέ]φρα{σ}α", "εκφρά{σ}ω"],
  παίζω: ["παίζω", "[έ]παιζα", "[έ]παι{ξ}α", "παί{ξ}ω"],
  δουλεύω: ["δουλεύω", "δούλευα", "δούλε{ψ}α", "δουλέ{ψ}ω"],
  ακούω: ["ακούω", "άκου<γ>α", "άκου{σ}α", "ακού{σ}ω"],
  κλείνω: ["κλεί(ν)ω", "[έ]κλει(ν)α", "[έ]κλει{σ}α", "κλεί{σ}ω"],
  δίνω: ["δί(ν)ω", "[έ]δι(ν)α", "[έ]δ{ωσ}α", "δ{ώσ}ω"],
  στέλνω: ["στέλ(ν)ω", "[έ]στελ(ν)α", "[έ]στε{ι}λα", "στε{ί}λω"],
  πλένω: ["πλένω", "[έ]πλενα", "[έ]πλ{υ}να", "πλ{ύ}νω"],
  θερμαίνω: ["θερμα(ί)νω", "θέρμα(ι)να", "θέρμανα", "θερμάνω"],
  αμφιβάλλω: ["αμφιβάλ(λ)ω", "αμφ[έ]βαλ(λ)α", "αμφ[έ]βαλα", "αμφιβάλω"],
  κάνω: ["κάνω", "[έ]κανα", "[έ]κανα", "κάνω"],
  προσφέρω: ["προσφέρω", "προσ[έ]φερα", "προσ[έ]φερα", "προσφέρω"],
  μαθαίνω: ["μαθ(αίν)ω", "μάθ(αιν)α", "[έ]μαθα", "μάθω"],
  βγαίνω: ["βγ(αίν)ω", "[έ]βγ(αιν)α", "βγ{ήκ}α", "βγω"],
  αποτυγχάνω: ["αποτυ(γ)χ(άν)ω", "αποτύ(γ)χ(αν)α", "απ[έ]τυχα", "αποτύχω"],
  παραλαμβάνω: ["παραλα(μ)β(άν)ω", "παραλά(μ)β(αν)α", "παρ[έ]λαβα", "παραλάβω"],
  μιλάω: ["μιλάω", "μιλ<ούσ>α", "μίλ{ησ}α", "μιλ{ήσ}ω"],
  περνάω: ["περ(ν)άω", "περ(ν)<ούσ>α", "πέρ{ασ}α", "περ{άσ}ω"],
  ζω: ["ζω", "ζ<ούσ>α", "[έ]ζ{ησ}α", "ζ{ήσ}ω"],
  μπορώ: ["μπορώ", "μπορ<ούσ>α", "μπόρ{εσ}α", "μπορ{έσ}ω"],
  έχω: ["έχω", "[εί]χα", "", ""],
  ξέρω: ["ξέρω", "[ή]ξερα", "", ""],
  απέχω: ["απέχω", "απ[εί]χα", "", ""],
  βλέπω: ["βλέπω", "έβλεπα", "είδα", "δω"],  // irregular: no markup
};

// verb -> a note it must have
const NOTES = {
  επιστρέφω: "The augment goes inside, after the prefix: επέστρεψα.",
  ανατρέφω: "Also τ → θ in the perfective.",
  υπάρχω: "The augment lengthens α → η inside the verb: υπήρξα.",
  εκφράζω: "The augment goes inside, and the learned prefix changes with it: εξέφρασα.",
  ακούω: "The past continuous adds γ: άκουγα.",
  περνάω: "The ν of the present drops: περν- → περ-.",
  ανεβαίνω: "The aorist adds -ηκ-: ανέβηκα.",
  έχω: "The augment lengthens ε → ει: είχα.",
};

let failures = 0;
const fail = msg => { failures++; console.log("✗ " + msg); };

for (const [group, list] of Object.entries(GROUPS)) {
  if (!AF.GROUP[group]) fail(`${group}: not a group in aspect-fork.js`);
  for (const greek of list.split(" ")) {
    const r = fork(greek);
    if (!r) fail(`${greek}: no fork at all (expected ${group})`);
    else if (r.group !== group) fail(`${greek}: group ${r.group}, expected ${group}`);
  }
}
for (const [greek, want] of Object.entries(MARKUP)) {
  const r = fork(greek);
  const got = r && [r.present, r.imperfect, r.aorist, r.dependent];
  if (!got || got.join(" | ") !== want.join(" | ")) fail(`${greek}: ${got ? got.join(" | ") : "no fork"}, expected ${want.join(" | ")}`);
}
for (const [greek, note] of Object.entries(NOTES)) {
  const r = fork(greek);
  if (!r || !r.notes.includes(note)) fail(`${greek}: missing note "${note}" (has: ${r ? r.notes.join(" / ") || "none" : "no fork"})`);
}

// Every active verb in the word list gets a group. Passives get no fork.
for (const v of sheet) {
  const r = fork(v.greek);
  if (v.voice === "active" && (!r || !AF.GROUP[r.group])) fail(`${v.greek}: active, but ${r ? `group ${r.group}` : "no fork"}`);
  if (v.voice !== "active" && r) fail(`${v.greek}: ${v.voice}, but has a fork`);
}

// Every dictionary verb: the markup spells the forms it came from, brackets balance, and it draws.
const counts = {};
const BALANCED = /^(?:[^[\]{}()<>]|\[[^[\]{}()<>]+\]|\{[^[\]{}()<>]+\}|\([^[\]{}()<>]+\)|<[^[\]{}()<>]+>)*$/;
for (const greek of Object.keys(forms)) {
  let r;
  try {
    r = fork(greek);
    if (!r) continue;
    AF.forkHTML(r);
  } catch (e) {
    fail(`${greek}: ${e.message}`);
    continue;
  }
  counts[r.group] = (counts[r.group] || 0) + 1;
  const shown = VF.verbToShow(greek, { sheet, forms }).conjugation.indicative;
  const first = cell => (cell[0] && cell[0][0] || "").replace(/^θα /, "").replace("|", "");
  const presents = (shown.present.continuous[0] || []).map(f => f.replace("|", ""));
  const given = [presents.includes(greek) ? greek : presents[0], first(shown.past.continuous), first(shown.past.simple), first(shown.future.simple)];
  [r.present, r.imperfect, r.aorist, r.dependent].forEach((s, i) => {
    if (!BALANCED.test(s)) fail(`${greek}: unbalanced markup ${s}`);
    else if (r.group !== "missing" && AF.plainText(s) !== given[i] && !(r.group === "no-perf" && i > 1))
      fail(`${greek}: markup ${s} doesn't spell ${given[i]}`);
  });
}

if (process.argv.includes("--groups"))
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([g, n]) => console.log(`${String(n).padStart(5)}  ${g}`));

const verbs = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(failures ? `\n${failures} aspect fork check(s) failed` : `All aspect fork checks pass (${verbs} active dictionary verbs, ${counts.irregular || 0} irregular)`);
process.exit(failures ? 1 : 0);
