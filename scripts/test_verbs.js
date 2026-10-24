// Checks the conjugation engine against hand-checked forms.
//   node scripts/test_verbs.js          run the checks
//   node scripts/test_verbs.js --dump   also print every verb's forms (for reviewing)

const fs = require("fs");
const path = require("path");
const { conjugate } = require("../docs/tools/greek-verbs.js");

const verbs = JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/tools/verbs.json"), "utf8"));
const byGreek = Object.fromEntries(verbs.map(v => [v.greek, v]));

const clean = row => row.map(f => f.replace("|", "")).join(" / ") || "—";
const cell = (c, where) => where.split(".").reduce((o, k) => o[k], c);

// verb -> { "mood.tense.aspect" or "mood.aspect": [six persons, or two for imperatives] }
const EXPECTED = {
  γράφω: {
    "indicative.present.continuous": ["γράφω", "γράφεις", "γράφει", "γράφουμε", "γράφετε", "γράφουν(ε)"],
    "indicative.past.continuous": ["έγραφα", "έγραφες", "έγραφε", "γράφαμε", "γράφατε", "έγραφαν / γράφανε"],
    "indicative.past.simple": ["έγραψα", "έγραψες", "έγραψε", "γράψαμε", "γράψατε", "έγραψαν / γράψανε"],
    "indicative.future.simple": ["θα γράψω", "θα γράψεις", "θα γράψει", "θα γράψουμε", "θα γράψετε", "θα γράψουν(ε)"],
    "indicative.present.perfect": ["έχω γράψει", "έχεις γράψει", "έχει γράψει", "έχουμε γράψει", "έχετε γράψει", "έχουν(ε) γράψει"],
    "imperative.continuous": ["γράφε", "γράφετε"],
    "imperative.simple": ["γράψε", "γράψτε"],
  },
  αγοράζω: {
    "indicative.past.continuous": ["αγόραζα", "αγόραζες", "αγόραζε", "αγοράζαμε", "αγοράζατε", "αγόραζαν / αγοράζανε"],
    "imperative.simple": ["αγόρασε", "αγοράστε"],
  },
  ανοίγω: { "indicative.past.continuous": ["άνοιγα", "άνοιγες", "άνοιγε", "ανοίγαμε", "ανοίγατε", "άνοιγαν / ανοίγανε"] },
  ελπίζω: { "indicative.past.simple": ["έλπισα", "έλπισες", "έλπισε", "ελπίσαμε", "ελπίσατε", "έλπισαν / ελπίσανε"] },
  πίνω: {
    "indicative.past.simple": ["ήπια", "ήπιες", "ήπιε", "ήπιαμε", "ήπιατε", "ήπιαν(ε)"],
    "indicative.future.simple": ["θα πιω", "θα πιεις", "θα πιει", "θα πιούμε", "θα πιείτε", "θα πιουν / θα πιούνε"],
    "imperative.simple": ["πιες", "πιείτε"],
    "indicative.present.perfect": ["έχω πιει", "έχεις πιει", "έχει πιει", "έχουμε πιει", "έχετε πιει", "έχουν(ε) πιει"],
  },
  βλέπω: { "indicative.past.simple": ["είδα", "είδες", "είδε", "είδαμε", "είδατε", "είδαν(ε)"], "imperative.simple": ["δες", "δείτε"] },
  τρώω: {
    "indicative.present.continuous": ["τρώω", "τρως", "τρώει", "τρώμε", "τρώτε", "τρώνε"],
    "indicative.past.continuous": ["έτρωγα", "έτρωγες", "έτρωγε", "τρώγαμε", "τρώγατε", "έτρωγαν / τρώγανε"],
    "indicative.past.simple": ["έφαγα", "έφαγες", "έφαγε", "φάγαμε", "φάγατε", "έφαγαν / φάγανε"],
    "indicative.future.simple": ["θα φάω", "θα φας", "θα φάει", "θα φάμε", "θα φάτε", "θα φάνε"],
    "imperative.simple": ["φάε", "φάτε"],
  },
  πιστεύω: { "indicative.past.continuous": ["πίστευα", "πίστευες", "πίστευε", "πιστεύαμε", "πιστεύατε", "πίστευαν / πιστεύανε"] },
  υπάρχω: {
    "indicative.past.continuous": ["υπήρχα", "υπήρχες", "υπήρχε", "υπήρχαμε", "υπήρχατε", "υπήρχαν(ε)"],
    "indicative.past.simple": ["υπήρξα", "υπήρξες", "υπήρξε", "υπήρξαμε", "υπήρξατε", "υπήρξαν(ε)"],
  },
  ακούω: { "indicative.past.continuous": ["άκουγα", "άκουγες", "άκουγε", "ακούγαμε", "ακούγατε", "άκουγαν / ακούγανε"] },
  λέω: { "imperative.continuous": ["λέγε", "λέτε"], "imperative.simple": ["πες", "πείτε"] },
  μιλάω: {
    "indicative.present.continuous": ["μιλάω / μιλώ", "μιλάς", "μιλάει", "μιλάμε / μιλούμε", "μιλάτε", "μιλάνε / μιλούν(ε)"],
    "indicative.past.continuous": ["μιλούσα", "μιλούσες", "μιλούσε", "μιλούσαμε", "μιλούσατε", "μιλούσαν(ε)"],
    "indicative.past.simple": ["μίλησα", "μίλησες", "μίλησε", "μιλήσαμε", "μιλήσατε", "μίλησαν / μιλήσανε"],
    "imperative.continuous": ["μίλα", "μιλάτε"],
    "imperative.simple": ["μίλησε", "μιλήστε"],
  },
  ξεχνώ: { "indicative.present.continuous": ["ξεχνώ / ξεχνάω", "ξεχνάς", "ξεχνάει", "ξεχνούμε / ξεχνάμε", "ξεχνάτε", "ξεχνούν(ε) / ξεχνάνε"] },
  ζω: { "indicative.present.continuous": ["ζω", "ζεις", "ζει", "ζούμε", "ζείτε", "ζουν / ζούνε"], "indicative.past.simple": ["έζησα", "έζησες", "έζησε", "ζήσαμε", "ζήσατε", "έζησαν / ζήσανε"] },
  θέλω: { "indicative.past.continuous": ["ήθελα", "ήθελες", "ήθελε", "θέλαμε", "θέλατε", "ήθελαν / θέλανε"] },
  έχω: { "indicative.past.continuous": ["είχα", "είχες", "είχε", "είχαμε", "είχατε", "είχαν(ε)"], "indicative.past.simple": ["—", "—", "—", "—", "—", "—"] },
  παραλαμβάνω: { "indicative.past.simple": ["παρέλαβα", "παρέλαβες", "παρέλαβε", "παραλάβαμε", "παραλάβατε", "παρέλαβαν / παραλάβανε"] },
  επιστρέφω: { "indicative.past.continuous": ["επέστρεφα", "επέστρεφες", "επέστρεφε", "επιστρέφαμε", "επιστρέφατε", "επέστρεφαν / επιστρέφανε"] },
  ανεβαίνω: { "indicative.past.simple": ["ανέβηκα", "ανέβηκες", "ανέβηκε", "ανεβήκαμε", "ανεβήκατε", "ανέβηκαν / ανεβήκανε"] },
  πάω: { "indicative.past.continuous": ["πήγαινα", "πήγαινες", "πήγαινε", "πηγαίναμε", "πηγαίνατε", "πήγαιναν / πηγαίνανε"] },
  γράφομαι: {
    "indicative.present.continuous": ["γράφομαι", "γράφεσαι", "γράφεται", "γραφόμαστε", "γραφόσαστε / γράφεστε", "γράφονται"],
    "indicative.past.continuous": ["γραφόμουν(α)", "γραφόσουν(α)", "γραφόταν(ε)", "γραφόμαστε", "γραφόσαστε", "γράφονταν"],
    "indicative.past.simple": ["γράφτηκα", "γράφτηκες", "γράφτηκε", "γραφτήκαμε", "γραφτήκατε", "γράφτηκαν / γραφτήκανε"],
    "indicative.future.simple": ["θα γραφτώ", "θα γραφτείς", "θα γραφτεί", "θα γραφτούμε", "θα γραφτείτε", "θα γραφτούν(ε)"],
    "indicative.present.perfect": ["έχω γραφτεί", "έχεις γραφτεί", "έχει γραφτεί", "έχουμε γραφτεί", "έχετε γραφτεί", "έχουν(ε) γραφτεί"],
    "imperative.simple": ["γράψου", "γραφτείτε"],
  },
  ετοιμάζομαι: {
    "indicative.present.continuous": ["ετοιμάζομαι", "ετοιμάζεσαι", "ετοιμάζεται", "ετοιμαζόμαστε", "ετοιμαζόσαστε / ετοιμάζεστε", "ετοιμάζονται"],
    "imperative.simple": ["ετοιμάσου", "ετοιμαστείτε"],
  },
  έρχομαι: {
    "indicative.past.simple": ["ήρθα", "ήρθες", "ήρθε", "ήρθαμε", "ήρθατε", "ήρθαν(ε)"],
    "indicative.future.simple": ["θα έρθω", "θα έρθεις", "θα έρθει", "θα έρθουμε", "θα έρθετε", "θα έρθουν(ε)"],
    "imperative.simple": ["έλα", "ελάτε"],
  },
  κάθομαι: { "indicative.past.simple": ["κάθισα", "κάθισες", "κάθισε", "καθίσαμε", "καθίσατε", "κάθισαν / καθίσανε"], "imperative.simple": ["κάθισε", "καθίστε"] },
  γίνομαι: { "indicative.past.simple": ["έγινα", "έγινες", "έγινε", "γίναμε", "γίνατε", "έγιναν / γίνανε"], "imperative.simple": ["γίνε", "γίνετε"] },
  σηκώνομαι: { "imperative.simple": ["σήκω", "σηκωθείτε"] },
  κοιμάμαι: {
    "indicative.present.continuous": ["κοιμάμαι", "κοιμάσαι", "κοιμάται", "κοιμόμαστε", "κοιμόσαστε / κοιμάστε", "κοιμούνται"],
    "indicative.past.continuous": ["κοιμόμουν(α)", "κοιμόσουν(α)", "κοιμόταν(ε)", "κοιμόμαστε", "κοιμόσαστε", "κοιμόνταν"],
    "imperative.simple": ["κοιμήσου", "κοιμηθείτε"],
  },
  βοηθιέμαι: { "indicative.present.continuous": ["βοηθιέμαι", "βοηθιέσαι", "βοηθιέται", "βοηθιόμαστε", "βοηθιόσαστε / βοηθιέστε", "βοηθιούνται"] },
  είμαι: { "indicative.past.continuous": ["ήμουν(α)", "ήσουν(α)", "ήταν(ε)", "ήμασταν / ήμαστε", "ήσασταν / ήσαστε", "ήταν(ε)"] },
};

let failures = 0, checks = 0;
for (const [greek, cells] of Object.entries(EXPECTED)) {
  if (!byGreek[greek]) { console.log(`✗ ${greek}: not in verbs.json`); failures++; continue; }
  const c = conjugate(byGreek[greek]);
  for (const [where, expected] of Object.entries(cells)) {
    cell(c, where).forEach((row, i) => {
      checks++;
      if (clean(row) !== expected[i]) {
        failures++;
        console.log(`✗ ${greek} ${where} [${i}]: got "${clean(row)}", expected "${expected[i]}"`);
      }
    });
  }
}

if (process.argv.includes("--dump")) {
  const SECTIONS = ["indicative.present.continuous", "indicative.past.continuous", "indicative.past.simple",
    "indicative.future.simple", "indicative.present.perfect", "imperative.continuous", "imperative.simple"];
  for (const v of verbs) {
    const c = conjugate(v);
    console.log(`\n## ${c.greek} (${c.pattern}, ${c.voice || "?"}) ${c.notes.join(" ")}`);
    for (const s of SECTIONS) console.log(`  ${s.replace("indicative.", "").padEnd(20)} ${cell(c, s).map(clean).join(", ")}`);
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
