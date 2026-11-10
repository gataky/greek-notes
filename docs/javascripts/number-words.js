// Greek cardinal numbers in words, for apps/numbers.html and tests/test_numbers.js. The rules
// are the ones in grammar/numerals.md:
//   - 1, 3, 4 and compounds ending in them (13, 21, 34) agree with the noun; 11 and 12 don't.
//   - The hundreds from 200 to 900, and χίλιοι, decline like adjectives in -οι, -ες, -α.
//   - εκατό becomes εκατόν before another number. There's no "one" before 100 or 1000.
//   - Thousands from 2000 up are the feminine noun χιλιάδες, so the number in front of it is
//     feminine; millions are the neuter εκατομμύρια.
//
// parts(n, gender, case) -> the words, each a list of accepted spellings, the usual one first:
//   parts(23, "feminine") -> [["είκοσι"], ["τρεις"]]
//   parts(7) -> [["εφτά", "επτά"]]
// Without a noun, numbers are neuter: τρία, τέσσερα.

(function (root) {
  "use strict";

  const GENDERS = ["masculine", "feminine", "neuter"];
  const CASES = ["nominative", "accusative", "genitive"];
  const MAX = 999999999;

  const ONE = {
    masculine: { nominative: ["ένας"], accusative: ["έναν", "ένα"], genitive: ["ενός"] },
    feminine: { nominative: ["μία", "μια"], accusative: ["μία", "μια"], genitive: ["μίας", "μιας"] },
    neuter: { nominative: ["ένα"], accusative: ["ένα"], genitive: ["ενός"] },
  };
  // 3, 4, 13 and 14: masculine and feminine share a form, and the genitive is one for all.
  const MF_N = (mf, n, gen) => (g, c) => (c === "genitive" ? [gen] : g === "neuter" ? [n] : [mf]);
  const UNITS = {
    1: (g, c) => ONE[g][c], 2: () => ["δύο", "δυο"], 3: MF_N("τρεις", "τρία", "τριών"), 4: MF_N("τέσσερις", "τέσσερα", "τεσσάρων"),
    5: () => ["πέντε"], 6: () => ["έξι"], 7: () => ["εφτά", "επτά"], 8: () => ["οχτώ", "οκτώ"], 9: () => ["εννιά", "εννέα"],
  };
  const TEENS = {
    10: () => ["δέκα"], 11: () => ["έντεκα"], 12: () => ["δώδεκα"],
    13: MF_N("δεκατρείς", "δεκατρία", "δεκατριών"), 14: MF_N("δεκατέσσερις", "δεκατέσσερα", "δεκατεσσάρων"),
    15: () => ["δεκαπέντε"], 16: () => ["δεκαέξι", "δεκάξι"], 17: () => ["δεκαεφτά", "δεκαεπτά"],
    18: () => ["δεκαοχτώ", "δεκαοκτώ"], 19: () => ["δεκαεννιά", "δεκαεννέα"],
  };
  const TENS = { 2: "είκοσι", 3: "τριάντα", 4: "σαράντα", 5: "πενήντα", 6: "εξήντα", 7: "εβδομήντα", 8: "ογδόντα", 9: "ενενήντα" };
  const HUNDREDS = {
    2: ["διακόσι"], 3: ["τριακόσι"], 4: ["τετρακόσι"], 5: ["πεντακόσι"], 6: ["εξακόσι"],
    7: ["εφτακόσι", "επτακόσι"], 8: ["οχτακόσι", "οκτακόσι"], 9: ["εννιακόσι", "εννεακόσι"],
  };
  const ENDINGS = { masculine: { nominative: "οι", accusative: "ους" }, feminine: { nominative: "ες", accusative: "ες" }, neuter: { nominative: "α", accusative: "α" } };
  const unaccent = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");

  // διακόσι- -> διακόσιοι, διακόσιες, διακόσια; the genitive moves the accent: διακοσίων, χιλίων.
  const decline = (stems, g, c) => stems.map(s => (c === "genitive" ? unaccent(s).slice(0, -1) + "ίων" : s + ENDINGS[g][c]));

  function below1000(n, g, c) {
    const out = [];
    const h = Math.floor(n / 100), rest = n % 100;
    if (h === 1) out.push([rest ? "εκατόν" : "εκατό"]);
    else if (h > 1) out.push(decline(HUNDREDS[h], g, c));
    if (rest >= 10 && rest < 20) out.push(TEENS[rest](g, c));
    else {
      if (rest >= 20) out.push([TENS[Math.floor(rest / 10)]]);
      if (rest % 10) out.push(UNITS[rest % 10](g, c));
    }
    return out;
  }

  function parts(n, g = "neuter", c = "nominative") {
    if (!Number.isInteger(n) || n < 0 || n > MAX) throw new Error(`parts: ${n} is out of range`);
    if (n === 0) return [["μηδέν"]];
    const out = [];
    const millions = Math.floor(n / 1e6), thousands = Math.floor(n / 1000) % 1000, rest = n % 1000;
    if (millions === 1) out.push(ONE.neuter[c], [c === "genitive" ? "εκατομμυρίου" : "εκατομμύριο"]);
    else if (millions) out.push(...below1000(millions, "neuter", c), [c === "genitive" ? "εκατομμυρίων" : "εκατομμύρια"]);
    if (thousands === 1) out.push(decline(["χίλι"], g, c));
    else if (thousands) out.push(...below1000(thousands, "feminine", c), [c === "genitive" ? "χιλιάδων" : "χιλιάδες"]);
    out.push(...below1000(rest, g, c));
    return out;
  }

  // The usual spelling: "είκοσι τρεις".
  const words = (n, g, c) => parts(n, g, c).map(p => p[0]).join(" ");

  // Every gender and case's spelling of each word of n, for naming a wrong one: the same shape
  // as NounDrill's slot.all, [{ form, gender, case }] per word.
  function allParts(n) {
    const out = parts(n).map(() => []);
    for (const g of GENDERS) for (const c of CASES) {
      parts(n, g, c).forEach((p, k) => p.forEach(form => {
        if (!out[k].some(f => f.form === form && f.gender === g && f.case === c)) out[k].push({ form, gender: g, case: c });
      }));
    }
    return out;
  }

  // Does n change with the noun? 1, 3, 4, 13, 14 and compounds ending in them, 200 to 999 and
  // 1000 to 1999 (χίλιοι), and anything with thousands that do (τρεις χιλιάδες).
  const agrees = n => new Set(GENDERS.map(g => words(n, g))).size > 1;

  // 2300 -> "2.300": a full stop between thousands, as Greek writes them. Years stay as they are.
  const digits = (n, year = false) => (year ? String(n) : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."));

  // Typed digits -> a number, or null: "2.300", "2300" and "2 300" are all 2300.
  function readDigits(text) {
    const t = String(text).trim().replace(/[.\s]/g, "");
    return /^\d+$/.test(t) ? Number(t) : null;
  }

  const api = { GENDERS, CASES, MAX, parts, words, allParts, agrees, digits, readDigits };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NumberWords = api;
})(this);
