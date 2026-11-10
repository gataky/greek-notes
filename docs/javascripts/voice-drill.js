// Active or passive drill: the logic shared by apps/passive-verbs.html and
// tests/test_voice_sentences.js.
//
// A sentence in voice-sentences.json names only its verb (dictionary form) and
// person. Everything else comes from verbs.json through greek-verbs.js: the voice,
// the active partner, the present-tense forms, and which word in the Greek
// sentence is the answer. The test checks that every sentence has exactly one such
// word, so a typo in the bank fails CI instead of teaching a wrong form.

(function (root) {
  "use strict";

  const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];

  const lower = s => String(s).toLocaleLowerCase("el").normalize("NFC");
  // Drop accents and diaeresis, for "only the accent is off" and near-miss checks.
  const strip = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");

  // "βάζ|ουν(ε)" -> ["βάζουν", "βάζουνε"]
  function expand(form) {
    const plain = form.replace(/\|/g, "");
    const m = plain.match(/^(.*)\((.*)\)(.*)$/);
    return m ? [m[1] + m[3], m[1] + m[2] + m[3]] : [plain];
  }

  // Present tense of a verbs.json entry: six lists of plain forms, one per person.
  // The first form in each list is the one the engine shows first.
  function present(GreekVerbs, verb) {
    return GreekVerbs.conjugate(verb).indicative.present.continuous
      .map(cell => cell.flatMap(expand).map(lower));
  }

  // Words of a sentence or an answer, lowercased, with a typed final σ fixed to ς.
  function tokens(text) {
    return lower(text)
      .replace(/[.,;:!?·;·"«»()[\]—–-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(t => t.replace(/σ$/, "ς"));
  }

  // Words in the Greek sentence that are this verb in this person.
  function answersIn(el, forms, person) {
    const want = forms[PERSONS.indexOf(person)];
    return tokens(el).filter(t => want.includes(t));
  }

  function lev(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // Present endings, unaccented. "ομε" (for όμαστε / ομαι) is left out of the active
  // list on purpose: it's a spelling slip more often than a change of voice.
  const PASSIVE_END = /(μαι|σαι|ται|μαστε|σαστε|στε|νται)$/;
  const ACTIVE_END = /(ω|εις|ει|ουμε|ετε|ουν|ουνε|ας|αει|αμε|ατε|ανε)$/;

  // Grade a typed answer.
  //   item: { voice: "active" | "passive" | "deponent", person, answer,
  //           forms: { active: six lists or null, passive: six lists or null } }
  // Returns null for an empty answer, otherwise
  //   { result, typed, hit? }   hit = { voice, person } of the form that was typed
  // result is one of: correct, accent, spelling, wrong person, wrong voice, wrong.
  function grade(typed, item) {
    const toks = tokens(typed);
    if (!toks.length) return null;
    const tv = item.voice === "active" ? "active" : "passive";
    const pi = PERSONS.indexOf(item.person);
    const accepted = [...new Set([lower(item.answer), ...((item.forms[tv] || [])[pi] || [])])];

    const all = [];
    for (const v of ["active", "passive"]) {
      (item.forms[v] || []).forEach((list, i) => list.forEach(form => all.push({ form, voice: v, person: PERSONS[i] })));
    }

    // If a whole sentence was typed, grade the word closest to a form of this verb.
    const candidates = [...accepted, ...all.map(f => f.form)].map(strip);
    let t = toks[0], best = Infinity;
    for (const tok of toks) {
      const s = strip(tok);
      const score = accepted.includes(tok) ? -1 : Math.min(...candidates.map(c => lev(s, c)));
      if (score < best) { best = score; t = tok; }
    }

    const st = strip(t);
    const tol = Math.max(1, Math.floor(st.length * 0.25));
    if (accepted.includes(t)) return { result: "correct", typed: t };
    if (accepted.some(a => strip(a) === st)) return { result: "accent", typed: t };

    const exact = all.find(f => strip(f.form) === st);
    if (exact) return { result: exact.voice === tv ? "wrong person" : "wrong voice", typed: t, hit: exact };

    // An ending that clearly belongs to the other voice, as with an active ending on
    // a deponent (προσεύχει for προσεύχεσαι), which has no active forms to match.
    if (tv === "passive" ? ACTIVE_END.test(st) && !PASSIVE_END.test(st) : PASSIVE_END.test(st)) {
      return { result: "wrong voice", typed: t };
    }

    let near = null, dNear = Infinity;
    for (const f of all) {
      const d = lev(st, strip(f.form));
      if (d < dNear) { dNear = d; near = f; }
    }
    const dAcc = Math.min(...accepted.map(a => lev(st, strip(a))));
    if (dAcc <= tol && dAcc <= dNear) return { result: "spelling", typed: t };
    if (near && dNear <= tol) {
      return { result: near.voice === tv ? "wrong person" : "wrong voice", typed: t, hit: near, misspelled: true };
    }
    return { result: "wrong", typed: t };
  }

  // How strictly the drills mark spelling, a setting on both pages. Each level lists the
  // slips it counts as right; real mistakes (wrong person, voice, aspect, θα / να) never are.
  const MARKING = { exact: [], accents: ["accent"], forgiving: ["accent", "spelling"] };
  const DEFAULT_MARKING = "accents";
  const countsAsRight = (result, level) =>
    result === "correct" || (MARKING[level] || MARKING[DEFAULT_MARKING]).includes(result);

  // The answer split into [text, changed] runs, changed being the letters that differ from
  // what was typed (by longest common subsequence, so an accent or one letter lights up).
  function changes(typed, answer) {
    const a = Array.from(lower(typed)), b = Array.from(answer);
    const lb = Array.from(lower(answer));
    const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        L[i][j] = a[i] === lb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    const runs = [];
    const add = (ch, changed) => {
      const last = runs[runs.length - 1];
      if (last && last[1] === changed) last[0] += ch; else runs.push([ch, changed]);
    };
    let i = 0;
    for (let j = 0; j < b.length; j++) {
      while (i < a.length && a[i] !== lb[j] && L[i + 1][j] >= L[i][j + 1]) i++;
      if (i < a.length && a[i] === lb[j]) { add(b[j], false); i++; } else add(b[j], true);
    }
    return runs;
  }

  const api = { PERSONS, lower, strip, expand, present, tokens, answersIn, lev, grade,
    MARKING, DEFAULT_MARKING, countsAsRight, changes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VoiceDrill = api;
})(this);
