// Checks number-words.js against hand-checked numbers, most of them from grammar/numerals.md.
//   node tests/test_numbers.js
// Also grades every number's own spelling (and each alternative) through NounDrill.gradePhrase,
// as the numbers drill does, which must come back correct.

const NW = require("../docs/javascripts/number-words.js");
const ND = require("../docs/javascripts/noun-drill.js");

let failures = 0, checks = 0;
const check = (label, got, expected) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    failures++;
    console.log(`✗ ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
};

// [number, gender, case, the usual spelling]; gender and case default to neuter nominative.
const EXPECTED = [
  [0, , , "μηδέν"], [1, , , "ένα"], [2, , , "δύο"], [3, , , "τρία"], [4, , , "τέσσερα"], [7, , , "εφτά"], [9, , , "εννιά"],
  [10, , , "δέκα"], [11, , , "έντεκα"], [12, , , "δώδεκα"], [13, , , "δεκατρία"], [14, , , "δεκατέσσερα"], [16, , , "δεκαέξι"], [19, , , "δεκαεννιά"],
  [20, , , "είκοσι"], [21, , , "είκοσι ένα"], [35, , , "τριάντα πέντε"], [70, , , "εβδομήντα"], [99, , , "ενενήντα εννιά"],
  [100, , , "εκατό"], [101, , , "εκατόν ένα"], [123, , , "εκατόν είκοσι τρία"], [200, , , "διακόσια"], [350, , , "τριακόσια πενήντα"],
  [999, , , "εννιακόσια ενενήντα εννιά"], [1000, , , "χίλια"], [1001, , , "χίλια ένα"], [1100, , , "χίλια εκατό"],
  [1984, , , "χίλια εννιακόσια ογδόντα τέσσερα"], [2000, , , "δύο χιλιάδες"], [2026, , , "δύο χιλιάδες είκοσι έξι"],
  [3000, , , "τρεις χιλιάδες"], [21000, , , "είκοσι μία χιλιάδες"], [200000, , , "διακόσιες χιλιάδες"],
  [1000000, , , "ένα εκατομμύριο"], [2300000, , , "δύο εκατομμύρια τριακόσιες χιλιάδες"], [4000000, , , "τέσσερα εκατομμύρια"],
  // Agreement (numerals.md: "Agreement in compound numbers").
  [1, "masculine", , "ένας"], [1, "masculine", "accusative", "έναν"], [1, "feminine", , "μία"], [1, "feminine", "genitive", "μίας"],
  [1, "neuter", "genitive", "ενός"], [3, "feminine", , "τρεις"], [3, "masculine", "genitive", "τριών"], [4, "masculine", , "τέσσερις"],
  [4, "feminine", "genitive", "τεσσάρων"], [13, "feminine", , "δεκατρείς"], [14, "masculine", , "δεκατέσσερις"],
  [21, "masculine", , "είκοσι ένας"], [23, "feminine", , "είκοσι τρεις"], [23, "neuter", , "είκοσι τρία"],
  [400, "feminine", , "τετρακόσιες"], [200, "masculine", "accusative", "διακόσιους"], [200, "neuter", "genitive", "διακοσίων"],
  [1000, "masculine", , "χίλιοι"], [1000, "feminine", , "χίλιες"], [1000, "masculine", "genitive", "χιλίων"],
  [3400, "neuter", , "τρεις χιλιάδες τετρακόσια"], [200000, "neuter", , "διακόσιες χιλιάδες"],
  [701, "masculine", "genitive", "εφτακοσίων ενός"], [5, "feminine", , "πέντε"], [12, "masculine", , "δώδεκα"],
];
for (const [n, g, c, words] of EXPECTED) check(`${n} ${g || ""} ${c || ""}`.trim(), NW.words(n, g, c), words);

check("7 has two spellings", NW.parts(7), [["εφτά", "επτά"]]);
check("2 has two spellings", NW.parts(2), [["δύο", "δυο"]]);
check("1 fem. has two spellings", NW.parts(1, "feminine"), [["μία", "μια"]]);
check("800 has two spellings", NW.parts(800), [["οχτακόσια", "οκτακόσια"]]);

for (const [n, agrees] of [[1, true], [2, false], [3, true], [5, false], [11, false], [13, true], [21, true], [25, false], [100, false],
  [200, true], [1000, true], [1500, true], [2000, false], [3000, false], [3001, true]]) {
  check(`${n} agrees`, NW.agrees(n), agrees);
}

check("digits 2300", NW.digits(2300), "2.300");
check("digits 2300000", NW.digits(2300000), "2.300.000");
check("digits 999", NW.digits(999), "999");
check("a year has no full stop", NW.digits(1984, true), "1984");
check("read 2.300", NW.readDigits("2.300"), 2300);
check("read 2 300", NW.readDigits("2 300"), 2300);
check("read words", NW.readDigits("δύο"), null);

// Every number's own spellings grade correct, and a wrong gender is named.
const slotsOf = (n, g, c) => {
  const all = NW.allParts(n);
  return NW.parts(n, g, c).map((forms, k) => ({ role: "number", word: String(n), forms, all: all[k] }));
};
const sample = [...Array(1200).keys(), 1984, 2026, 3400, 21000, 200000, 2300000];
for (const n of sample) {
  for (const g of NW.GENDERS) for (const c of ["nominative", "accusative"]) {
    const slots = slotsOf(n, g, c);
    for (const typed of [slots.map(s => s.forms[0]).join(" "), slots.map(s => s.forms[s.forms.length - 1]).join(" ")]) {
      const r = ND.gradePhrase(typed, slots, { gender: g, case: c });
      if (r.result !== "correct") { failures++; console.log(`✗ "${typed}" for ${n} ${g} ${c} graded ${r.result}`); }
    }
  }
}
const wrong = ND.gradePhrase("τρεις", slotsOf(3, "neuter", "nominative"), { gender: "neuter", case: "nominative" });
check("τρεις for τρία", [wrong.result, ND.diffs(wrong.words[0].hit, { gender: "neuter", case: "nominative" })], ["form", ["gender"]]);
const missing = ND.gradePhrase("εκατό ένα", slotsOf(101, "neuter", "nominative"), { gender: "neuter", case: "nominative" });
check("εκατό ένα", missing.words.map(w => w.result), ["spelling", "correct"]);

if (failures) { console.log(`${failures} problem(s) in ${checks} checks`); process.exit(1); }
console.log(`numbers OK (${checks} checks, ${sample.length} numbers graded)`);
