// Noun drills: the logic shared by apps/noun-gender.html, apps/agreement.html, apps/numbers.html,
// apps/prepositions.html and their tests.
//
// Words come from words.json (the word list's nouns and adjectives) and their forms from
// declensions.json (the dictionary's tables, written by scripts/build_declensions.js). Nothing
// here generates a noun or adjective form: a phrase is the article, which is a fixed table,
// plus the dictionary's cells.
//
// A phrase is a list of slots, one per word: { role, word, forms, all }. forms are the accepted
// spellings, most usual first; all lists every form of that word with its features
// ({ form, case, number, gender }), so a wrong answer can be named ("that's the genitive").

(function (root) {
  "use strict";
  const VD = root.VoiceDrill || require("./voice-drill.js");
  const { lower, strip, lev } = VD;

  const CASES = ["nominative", "accusative", "genitive"];
  const NUMBERS = ["singular", "plural"];
  const GENDERS = ["masculine", "feminine", "neuter"];
  const ARTICLES = {
    masculine: { nominative: ["ο", "οι"], accusative: ["τον", "τους"], genitive: ["του", "των"] },
    feminine: { nominative: ["η", "οι"], accusative: ["την", "τις"], genitive: ["της", "των"] },
    neuter: { nominative: ["το", "τα"], accusative: ["το", "τα"], genitive: ["του", "των"] },
  };
  const SHORT = { masculine: "masc.", feminine: "fem.", neuter: "neut." };

  // την, μην, δεν keep their ν before a vowel and before κ, π, τ, ξ, ψ (so also γκ, μπ, ντ,
  // τσ, τζ). Before other consonants it's usually dropped: την Αθήνα, τη θάλασσα.
  const keepsN = next => /^[αεηιουωκπτξψ]|^(γκ|μπ|ντ)/.test(strip(lower(next || "")));

  // The article's spellings before the word `next`, the expected one first. Before a vowel or
  // κ π τ ξ ψ only την is right; elsewhere τη is usual and την is accepted too.
  function articleForms(gender, grammaticalCase, number, next) {
    const a = ARTICLES[gender][grammaticalCase][NUMBERS.indexOf(number)];
    if (a !== "την") return [a];
    return keepsN(next) ? ["την"] : ["τη", "την"];
  }

  // Every article form with its features. τη is listed beside την; nRule() tells them apart.
  const ARTICLE_ALL = GENDERS.flatMap(g => CASES.flatMap(c => NUMBERS.map((n, i) => ({ form: ARTICLES[g][c][i], case: c, number: n, gender: g }))))
    .flatMap(f => (f.form === "την" ? [f, { ...f, form: "τη" }] : [f]));

  // σε joins the article: σε + τον = στον, σε + τη = στη.
  const withSe = a => "σ" + a;

  const plain = f => lower(f.replace(/\|/g, ""));

  // One cell of a declensions.json entry, as plain forms, or null if there's none. A noun's
  // cells are cases by numbers; an adjective's genders by cases by numbers.
  function cell(entry, grammaticalCase, number, gender) {
    const c = entry.pos === "adjective" ? entry.cells[gender]?.[grammaticalCase]?.[number] : entry.cells[grammaticalCase]?.[number];
    return c && c.length ? c : null;
  }

  // Every form of an entry, with its features. A noun's gender is fixed (its first, for the few
  // with two: ο/η γιατρός).
  function allForms(entry) {
    const out = [];
    for (const g of entry.pos === "adjective" ? GENDERS : [entry.gender[0]]) {
      for (const c of CASES) for (const n of NUMBERS) {
        for (const f of cell(entry, c, n, g) || []) out.push({ form: plain(f), marked: f, case: c, number: n, gender: g });
      }
    }
    return out;
  }

  // The slots of "article + adjective + noun" in one case and number: το μεγάλο σπίτι. adjective
  // may be null. Returns null when a form is missing (no genitive plural, a plural-only noun).
  function phrase({ noun, adjective, case: c, number: n, article = true }) {
    const gender = noun.gender[0];
    const nounForms = cell(noun, c, n);
    const adjForms = adjective ? cell(adjective, c, n, gender) : [];
    if (!nounForms || !adjForms) return null;
    const slots = [];
    const next = plain((adjective ? adjForms : nounForms)[0]);
    if (article) slots.push({ role: "article", word: "", forms: articleForms(gender, c, n, next), marked: articleForms(gender, c, n, next), all: ARTICLE_ALL, next });
    if (adjective) slots.push({ role: "adjective", word: adjective.greek, forms: adjForms.map(plain), marked: adjForms, all: allForms(adjective) });
    slots.push({ role: "noun", word: noun.greek, forms: nounForms.map(plain), marked: nounForms, all: allForms(noun) });
    return slots;
  }

  // How the article's ν was handled, when the letters are otherwise right: "dropped" for τη
  // before a vowel or κ π τ ξ ψ.
  const nRule = (typed, slot) => (slot.role === "article" && typed === "τη" && slot.forms.includes("την") && !slot.forms.includes("τη") ? "dropped" : null);

  // ---------- Grading ----------

  const SEVERITY = { correct: 0, accent: 1, n: 1, spelling: 2, extra: 2, form: 3, missing: 4, wrong: 4 };

  // One typed word against one slot:
  //   { result: correct | accent | n | spelling | form | wrong, typed, hit? }
  // form means it's another form of the same word; hit has its features (case, number, gender),
  // the one closest to what was wanted.
  function gradeWord(typed, slot, want) {
    const t = lower(typed).replace(/σ$/, "ς"), st = strip(t);
    if (slot.forms.includes(t)) return { result: "correct", typed: t };
    if (nRule(t, slot)) return { result: "n", typed: t };
    if (slot.forms.some(f => strip(f) === st)) return { result: "accent", typed: t };
    const closest = list => list.sort((a, b) => diffs(a, want).length - diffs(b, want).length)[0];
    const exact = closest(slot.all.filter(f => f.form === t));
    if (exact) return { result: "form", typed: t, hit: exact };
    const loose = closest(slot.all.filter(f => strip(f.form) === st));
    if (loose) return { result: "form", typed: t, hit: loose, accent: true };
    const tol = Math.max(1, Math.floor(st.length * 0.25));
    const dAcc = Math.min(...slot.forms.map(f => lev(st, strip(f))));
    let near = null, dNear = Infinity;
    for (const f of slot.all) {
      const d = lev(st, strip(f.form));
      if (d < dNear) { dNear = d; near = f; }
    }
    if (dAcc <= tol && dAcc <= dNear) return { result: "spelling", typed: t };
    if (near && dNear <= tol) return { result: "form", typed: t, hit: near, misspelled: true };
    return { result: "wrong", typed: t };
  }

  // The features a hit gets wrong: ["case", "gender"]. τον for την is a gender slip; των for του
  // is a number slip.
  const diffs = (hit, want) => ["case", "number", "gender"].filter(k => want[k] && hit[k] && hit[k] !== want[k]);
  // What a wrong form is, in the features it gets wrong: "accusative", "genitive plural", "neuter".
  const describe = (hit, want) => diffs(hit, want).map(k => hit[k]).join(" ") || "another form";

  // The typed words matched to the slots, in order: for each slot, the index of its word, or -1
  // when it's missing. The alignment costs least overall: a word matching a slot costs how far it
  // is from that word's nearest form (0 to 1), and a missing or extra word costs 1.
  function align(words, slots) {
    const cost = (w, s) => {
      const sw = strip(w);
      const d = Math.min(...[...s.forms, ...s.all.map(f => f.form)].map(f => lev(sw, strip(f)) / Math.max(sw.length, strip(f).length, 1)));
      return Math.min(d, 1);
    };
    const W = words.length, S = slots.length;
    const dp = Array.from({ length: W + 1 }, (_, i) => Array.from({ length: S + 1 }, (_, k) => (i === 0 ? k : k === 0 ? i : 0)));
    const how = Array.from({ length: W + 1 }, () => []);
    for (let i = 1; i <= W; i++) {
      for (let k = 1; k <= S; k++) {
        const options = [[dp[i - 1][k - 1] + cost(words[i - 1], slots[k - 1]), "match"], [dp[i - 1][k] + 1, "extra"], [dp[i][k - 1] + 1, "missing"]];
        const [c, h] = options.reduce((a, b) => (b[0] < a[0] ? b : a));
        dp[i][k] = c; how[i][k] = h;
      }
    }
    const out = new Array(S).fill(-1);
    for (let i = W, k = S; i > 0 || k > 0;) {
      const h = i === 0 ? "missing" : k === 0 ? "extra" : how[i][k];
      if (h === "match") { out[k - 1] = i - 1; i--; k--; }
      else if (h === "extra") i--;
      else k--;
    }
    return out;
  }

  // Grade a typed phrase against its slots. want: { case, number, gender } of the phrase.
  // Returns null for an empty answer, else { result, words: [per slot: gradeWord's result, or
  // { result: "missing" }], extra: [words matched to no slot] }. result is the worst slot's:
  // correct, accent, n, spelling, form, missing, wrong.
  function gradePhrase(typed, slots, want) {
    const words = typeof typed === "string" ? VD.tokens(typed) : typed;
    if (!words.length) return null;
    const at = align(words, slots);
    const graded = slots.map((s, k) => (at[k] < 0 ? { result: "missing" } : gradeWord(words[at[k]], s, want)));
    const extra = words.filter((w, i) => !at.includes(i));
    let result = graded.reduce((r, g) => (SEVERITY[g.result] > SEVERITY[r] ? g.result : r), "correct");
    if (extra.length && SEVERITY[result] < SEVERITY.extra) result = "extra";
    return { result, words: graded, extra };
  }

  // ---------- Words ----------

  // The word list's English, for a prompt: its first meaning, without notes in brackets.
  // "bill, check, account" -> "bill"; "spouse (husband, wife)" -> "spouse".
  const gloss = en => String(en || "").replace(/\([^)]*\)/g, "").split(/[;,]/)[0].replace(/^\s*(a|an|the|to) /i, "").replace(/\s+/g, " ").trim();

  const IRREGULAR_EN = { child: "children", man: "men", woman: "women", person: "people", foot: "feet", tooth: "teeth", mouse: "mice",
    fish: "fish", sheep: "sheep", knife: "knives", leaf: "leaves", wife: "wives", shelf: "shelves", wolf: "wolves", glass: "glasses",
    dish: "dishes", box: "boxes", bus: "buses", peach: "peaches", tomato: "tomatoes", potato: "potatoes", "best man": "best men" };
  // A rough English plural for a prompt: "the big houses". Only the last word changes.
  function pluralEn(word) {
    if (IRREGULAR_EN[word]) return IRREGULAR_EN[word];
    const m = /^(.*?)(\S+)$/.exec(word);
    const [, head, last] = m;
    if (IRREGULAR_EN[last]) return head + IRREGULAR_EN[last];
    if (/(s|x|z|ch|sh)$/.test(last)) return head + last + "es";
    if (/[^aeiou]y$/.test(last)) return head + last.slice(0, -1) + "ies";
    return head + last + "s";
  }

  // The ending a noun is filed under for "how its ending hints at its gender": -ος, -α, -μα, ...
  // Accents don't count. Anything else (a consonant, mostly loanwords) is "other".
  const ENDINGS = ["ους", "μα", "ος", "ας", "ης", "ες", "α", "η", "ο", "ι", "υ"];
  const endingOf = word => ENDINGS.find(e => strip(lower(word)).endsWith(e)) || "other";

  // Per ending: how many of the given nouns have each gender. { "ος": { masculine: 40, feminine: 6, neuter: 3 }, ... }
  function endingCounts(nouns) {
    const out = {};
    for (const n of nouns) {
      const e = endingOf(plain(n.cells.nominative.singular[0]));
      out[e] = out[e] || { masculine: 0, feminine: 0, neuter: 0 };
      for (const g of n.gender) out[e][g]++;
    }
    return out;
  }

  // Which adjectives make sense with which nouns, by the word list's tags. A small hand-made
  // list, so the agreement drill doesn't ask for "the hungry spoon". Adjectives not here aren't
  // drilled; tests/test_nouns.js checks every one has a table.
  const THINGS = ["home", "school", "object", "device", "clothing", "transport", "text", "document", "medicine", "travel"];
  const ADJECTIVE_TAGS = [
    [["μεγάλος", "μικρός", "καλός", "κακός"], ["person", "occupation", "animal", "city", "nature", "food", "drink", ...THINGS]],
    [["ωραίος", "όμορφος", "άσχημος"], ["person", "occupation", "animal", "city", "nature", ...THINGS]],
    [["παλιός", "νέος"], ["person", "city", ...THINGS]],
    [["καθαρός", "βρώμικος"], ["anatomy", "city", ...THINGS]],
    [["ακριβός", "φτηνός"], ["city", "food", "drink", ...THINGS]],
    [["βαρύς", "ελαφρύς"], ["food", ...THINGS]],
    [["άδειος", "γεμάτος"], ["city", "home", "school", "object", "transport"]],
    [["κρύος", "ζεστός"], ["food", "drink"]],
    [["φρέσκος", "νόστιμος", "γλυκός"], ["food"]],
    [["γρήγορος", "αργός"], ["transport", "animal", "person"]],
    [["ψηλός", "κοντός"], ["person", "occupation", "nature"]],
    [["χοντρός", "λεπτός"], ["person", "animal", "text", "school"]],
    [["φαρδύς", "στενός"], ["clothing"]],
    [["ήσυχος"], ["person", "animal", "city"]],
    [["αριστερός", "δεξιός"], ["anatomy"]],
    [["αγγλικός", "ιταλικός", "γαλλικός", "ισπανικός", "αμερικάνικος", "κινέζικος"], ["food", "drink", ...THINGS]],
    [["θυμωμένος", "γενναίος", "τρελός", "φιλικός", "αστείος", "ευγενικός", "φτωχός", "πλούσιος", "λυπημένος", "ανόητος",
      "δυνατός", "αδύναμος", "σοβαρός", "συμπαθητικός", "αντιπαθητικός"], ["person", "occupation"]],
    [["χαρούμενος", "πεινασμένος", "διψασμένος", "κουρασμένος", "έξυπνος"], ["person", "occupation", "animal"]],
  ];
  const adjectivesFor = tag => ADJECTIVE_TAGS.filter(([, tags]) => tags.includes(tag)).flatMap(([adjs]) => adjs);

  const api = {
    CASES, NUMBERS, GENDERS, ARTICLES, SHORT, ARTICLE_ALL, keepsN, articleForms, withSe, plain, cell, allForms, phrase, nRule,
    gradeWord, gradePhrase, diffs, describe, align, gloss, pluralEn, ENDINGS, endingOf, endingCounts, ADJECTIVE_TAGS, adjectivesFor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NounDrill = api;
})(this);
