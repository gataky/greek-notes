// Tense and aspect drill: the logic shared by apps/tense-aspect.html and
// tests/test_aspect_sentences.js.
//
// A sentence in aspect-sentences.json names its verb (dictionary form, active, from the
// word list), person, tense and aspect. The forms come from the verb tables' merge
// (verb-forms.js: the dictionary's cells, the engine's where it has none), so the drill
// and the verb tables always agree. The test checks that every sentence's Greek holds
// exactly one such form, so a typo in the bank fails CI instead of teaching a wrong form.

(function (root) {
  "use strict";
  const VD = root.VoiceDrill || require("./voice-drill.js");
  const { PERSONS, lower, strip, expand, tokens, lev } = VD;

  // The seven forms the drill asks for. Future and να forms are stored without their
  // particle: θα γράφω is the present's verb form, θα γράψω and να γράψω the dependent's.
  const bare = cell => cell.map(row => row.map(f => f.replace(/^(θα|να) /, "")));
  const CELLS = [
    { key: "present", tense: "present", aspect: "continuous", particle: "", label: "present", forms: c => c.indicative.present.continuous },
    { key: "past continuous", tense: "past", aspect: "continuous", particle: "", label: "past continuous (imperfect)", forms: c => c.indicative.past.continuous },
    { key: "past simple", tense: "past", aspect: "simple", particle: "", label: "past simple (aorist)", forms: c => c.indicative.past.simple },
    { key: "future continuous", tense: "future", aspect: "continuous", particle: "θα", label: "future continuous", forms: c => bare(c.indicative.future.continuous) },
    { key: "future simple", tense: "future", aspect: "simple", particle: "θα", label: "future simple", forms: c => bare(c.indicative.future.simple) },
    { key: "na continuous", tense: "na", aspect: "continuous", particle: "να", label: "να + continuous", forms: c => bare(c.subjunctive.continuous) },
    { key: "na simple", tense: "na", aspect: "simple", particle: "να", label: "να + simple", forms: c => bare(c.subjunctive.simple) },
  ];
  const TENSES = ["present", "past", "future", "na"];
  const cellOf = (tense, aspect) => CELLS.find(c => c.tense === tense && c.aspect === (tense === "present" ? "continuous" : aspect));

  // Object pronouns and negation can stand between θα / να and the verb: θα το γράψω, να μην το πεις.
  const BETWEEN = new Set(["με", "σε", "τον", "την", "τη", "το", "τους", "τις", "τα", "μου", "σου", "του", "της", "μας", "σας", "μην", "μη"]);
  const PARTICLES = new Set(["θα", "να"]);

  // Every cell of a conjugation (verb-forms.js's withForms / verbToShow): key → six lists
  // of plain lowercased forms, ουν(ε) expanded, the first being the one the grid shows first.
  function formsOf(conjugation) {
    const out = {};
    for (const c of CELLS) out[c.key] = c.forms(conjugation).map(row => [...new Set(row.flatMap(expand).map(lower))]);
    return out;
  }

  // The particle before word i of a sentence, skipping pronouns and negation ("" if none).
  function particleBefore(toks, i) {
    let j = i - 1;
    while (j >= 0 && BETWEEN.has(toks[j])) j--;
    return j >= 0 && PARTICLES.has(toks[j]) ? toks[j] : "";
  }

  // The answer in a Greek sentence: words that are this cell's form in this person, with
  // the right particle in front (none for the present and past). Returns the answers as
  // they'd be typed: "θα γράψω", "έγραψα".
  function answersIn(el, forms, cell, person) {
    const want = forms[cell.key][PERSONS.indexOf(person)];
    const toks = tokens(el);
    return toks.flatMap((t, i) => (want.includes(t) && particleBefore(toks, i) === cell.particle ? [(cell.particle ? cell.particle + " " : "") + t] : []));
  }

  // "*was writing*" in the English marks the verb to translate. Returns [before, verb, after].
  function target(en) {
    const m = /^(.*?)\*([^*]+)\*(.*)$/.exec(en);
    return m ? [m[1], m[2], m[3]] : [en, "", ""];
  }

  // Grade a typed answer.
  //   item: { tense, aspect, person, answer ("θα γράψω"), forms (formsOf) }
  // Returns null for an empty answer, otherwise { result, typed, hit? }, where hit = { cell, person }
  // is the form that was typed. result is one of: correct, accent, particle (right verb form,
  // θα / να missing or wrong), spelling, wrong person, wrong aspect, wrong tense, wrong.
  function grade(typed, item) {
    const cell = cellOf(item.tense, item.aspect);
    const toks = tokens(typed).filter(t => !BETWEEN.has(t) && t !== "δεν" && t !== "δε");
    if (!toks.length) return null;
    const particle = toks.find(t => PARTICLES.has(t)) || "";
    const words = toks.filter(t => !PARTICLES.has(t));
    const shown = w => (particle ? particle + " " : "") + w;
    if (!words.length) return { result: "wrong", typed: particle };

    const pi = PERSONS.indexOf(item.person);
    const answerWord = lower(item.answer).split(" ").pop();
    const accepted = [...new Set([answerWord, ...item.forms[cell.key][pi]])];
    const all = [];
    for (const c of CELLS) item.forms[c.key].forEach((row, i) => row.forEach(form => all.push({ form, cell: c, person: PERSONS[i] })));

    // If more than the verb was typed (θέλω να γράψω), grade the word closest to a form of this verb.
    const candidates = [...accepted, ...all.map(f => f.form)].map(strip);
    let w = words[0], best = Infinity;
    for (const tok of words) {
      const score = accepted.includes(tok) ? -1 : Math.min(...candidates.map(c => lev(strip(tok), c)));
      if (score < best) { best = score; w = tok; }
    }
    const sw = strip(w);
    const right = particle === cell.particle;

    if (accepted.includes(w)) return { result: right ? "correct" : "particle", typed: shown(w) };
    if (accepted.some(a => strip(a) === sw)) return { result: right ? "accent" : "particle", typed: shown(w), accent: !right };

    // The form of another cell: prefer one the typed particle fits, then the same tense, then the same aspect.
    const rank = f => (f.cell.particle === particle ? 0 : 4) + (f.cell.tense === cell.tense ? 0 : 2) + (f.cell.aspect === cell.aspect ? 0 : 1);
    const classify = (hit, extra) => {
      const result = hit.cell === cell ? "wrong person" : hit.cell.tense === cell.tense ? "wrong aspect" : "wrong tense";
      return { result, typed: shown(w), hit: { cell: hit.cell, person: hit.person }, ...extra };
    };
    const exact = all.filter(f => strip(f.form) === sw).sort((a, b) => rank(a) - rank(b))[0];
    if (exact) return classify(exact);

    const tol = Math.max(1, Math.floor(sw.length * 0.25));
    const dAcc = Math.min(...accepted.map(a => lev(sw, strip(a))));
    let near = null, dNear = Infinity;
    for (const f of all) {
      const d = lev(sw, strip(f.form));
      if (d < dNear || (d === dNear && near && rank(f) < rank(near))) { dNear = d; near = f; }
    }
    if (dAcc <= tol && dAcc <= dNear) return { result: right ? "spelling" : "particle", typed: shown(w), misspelled: !right };
    if (near && dNear <= tol) return classify(near, { misspelled: true });
    return { result: "wrong", typed: shown(w) };
  }

  const api = { PERSONS, CELLS, TENSES, cellOf, formsOf, particleBefore, answersIn, target, grade };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AspectDrill = api;
})(this);
