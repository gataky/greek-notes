// The dictionary's reading mode (apps/dictionary.html): a pasted text with every Greek word
// tappable. Shared with tests/test_reading.js. Nothing is generated: a word's headwords and the
// label of its form ("past simple, 1st singular") come from the dictionary's forms and tables.
//
//   split(text)             paragraphs of pieces, { text, word } where word marks a Greek word
//   candidates(dict, word)  what a written word can be, best first, at most three:
//                           [{ word, particle }] where word is a headword, or particle a gloss
//                           for the few particles the dictionary has no entry for
//   describe(dict, headword, written)
//                           { label, entryId }: which form of the headword was written, and the
//                           entry whose table has it ("" and null for the headword itself)
//   labelOf(tagSets)        Wiktionary's tags as a label

(function (root) {
  "use strict";
  const D = root.GreekDictionary || require("./greek-dictionary.js");

  // A Greek word, with an elision's apostrophe after it (σ’, απ’) or before it (’χε). Texts
  // write the apostrophe several ways; the dictionary stores ’.
  const APOSTROPHE = /['ʼ’‘]/g;
  const WORD = /(?:(?<![\p{L}\p{M}])['ʼ’‘](?=\p{Script=Greek}))?[\p{Script=Greek}\p{M}]+(?:['ʼ’‘](?![\p{L}]))?/gu;

  const lower = s => s.toLocaleLowerCase("el");

  // Text -> paragraphs (split at blank lines) of pieces. Single line breaks stay in the text.
  function split(text) {
    const body = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!body) return [];
    return body.split(/\n[ \t]*\n\s*/).map(paragraph => {
      const pieces = [];
      let at = 0;
      for (const m of paragraph.matchAll(WORD)) {
        if (m.index > at) pieces.push({ text: paragraph.slice(at, m.index), word: false });
        pieces.push({ text: m[0], word: true });
        at = m.index + m[0].length;
      }
      if (at < paragraph.length) pieces.push({ text: paragraph.slice(at), word: false });
      return pieces;
    });
  }

  // The particles the dictionary has no entry for, though every text is full of them.
  const NEGATIVE = "not: makes a verb negative (δεν ξέρω, I don't know)";
  const DONT = "don't, not: the negative with να, ας and commands (μην το πεις, don't say it)";
  const PARTICLES = {
    θα: "will, would: makes the future and the conditional (θα γράψω, I'll write; θα έγραφα, I would write)",
    να: "to, that: before a verb (θέλω να φύγω, I want to leave); also here!, there! (να το, there it is)",
    δεν: NEGATIVE,
    δε: NEGATIVE,
    μη: DONT,
    μην: DONT,
    ας: "let: suggestions and wishes (ας πάμε, let's go)",
  };

  // Elisions the dictionary doesn't list (it has σ’, μ’, γι’ and τ’).
  const ELISIONS = { "απ’": ["από"], "θ’": ["θα"], "ν’": ["να"], "κ’": ["και"] };

  // What a written word can be. The spellings tried, in order: as written (apostrophe as ’), an
  // elision's full word, then without the apostrophe (which may be a quote mark). The first that
  // finds anything wins. Where some match the written spelling exactly (που, not πού; να, not the
  // initialism ΝΑ), only those are kept. A capital at the start of a sentence may be lowered, but
  // a word in capitals carries no accents, so it keeps all.
  function candidates(dict, written) {
    const word = written.replace(APOSTROPHE, "’");
    const tries = [word, ...(ELISIONS[lower(word)] || []), word.replace(/’/g, "")];
    for (const spelling of [...new Set(tries)].filter(Boolean)) {
      const particle = PARTICLES[lower(spelling)];
      const hits = dict.headwordsOf(spelling);
      if (!hits.length && !particle) continue;
      const capitals = [...spelling].length > 1 && spelling === spelling.toLocaleUpperCase("el");
      const exact = h => h.matchedForm === spelling || h.matchedForm === lower(spelling);
      const kept = capitals ? hits : hits.some(exact) || particle ? hits.filter(exact) : hits;
      const best = new Map();
      for (const h of kept.sort((a, b) => b.isPrimary - a.isPrimary || b.frequency - a.frequency)) {
        if (!best.has(h.word)) best.set(h.word, { word: h.word, written: spelling });
      }
      const out = [...best.values()];
      if (particle) out.unshift({ word: lower(spelling), written: spelling, particle });
      return out.slice(0, 3);
    }
    return [];
  }

  // Which form of a headword was written, from the cells of its tables that hold it. Exact
  // spellings first (accents and all); the headword lines' labels only when no table has it.
  function describe(dict, headword, written) {
    if (D.norm(written) === D.norm(headword)) return { label: "", entryId: null };
    const rows = dict.formTags(headword, written);
    const exact = rows.filter(r => lower(r.form) === lower(written));
    const pool = exact.length ? exact : rows;
    const tables = pool.filter(r => r.kind !== "head");
    const used = tables.length ? tables : pool;
    return { label: labelOf(used.map(r => r.tags)), entryId: used[0]?.entryId ?? null };
  }

  const PERSONS = { "first-person": "1st", "second-person": "2nd", "third-person": "3rd" };
  const NUMBERS = ["singular", "plural"];
  const GENDERS = ["masculine", "feminine", "neuter"];
  const EXTRAS = ["comparative", "superlative", "strong", "weak"];

  // A verb form: tense, then person and number. null when the tags aren't a verb's.
  function verbLabel(t) {
    const tense = t.has("participle") ? "participle"
      : t.has("infinitive-aorist") ? "aorist infinitive (έχω …)"
      : t.has("imperative") ? (t.has("perfective") ? "imperative, simple" : "imperative, continuous")
      : t.has("dependent") ? "dependent (θα, να)"
      : t.has("present") ? "present"
      : t.has("imperfect") ? "past continuous"
      : t.has("past") ? "past simple"
      : null;
    if (!tense) return null;
    const person = Object.keys(PERSONS).find(p => t.has(p));
    const number = NUMBERS.find(n => t.has(n));
    const who = [person && PERSONS[person], number].filter(Boolean).join(" ");
    return [(t.has("passive") ? "passive " : "") + tense, who].filter(Boolean).join(", ");
  }

  // Tag sets -> one label. Verb forms are listed; noun and adjective forms that differ only in
  // case are joined (nominative, accusative or vocative plural).
  function labelOf(tagSets) {
    const labels = [];
    const nominal = new Map();   // the rest of the label -> its cases
    for (const tags of tagSets) {
      const t = new Set(tags.split(" "));
      const verb = verbLabel(t);
      if (verb) { labels.push(verb); continue; }
      const rest = [...EXTRAS, ...GENDERS, ...NUMBERS].filter(x => t.has(x)).join(" ");
      const cases = D.CASES.filter(c => t.has(c));
      if (!rest && !cases.length) continue;
      if (!nominal.has(rest)) { nominal.set(rest, new Set()); labels.push(nominal.get(rest)); }
      cases.forEach(c => nominal.get(rest).add(c));
    }
    const text = labels.map(label => {
      if (typeof label === "string") return label;
      const rest = [...nominal].find(([, cases]) => cases === label)[0];
      const cases = D.CASES.filter(c => label.has(c));
      const joined = cases.length > 1 ? cases.slice(0, -1).join(", ") + " or " + cases.at(-1) : cases.join("");
      return [joined, rest].filter(Boolean).join(" ");
    });
    const unique = [...new Set(text)];
    return unique.length > 3 ? unique.slice(0, 3).join(" · ") + " …" : unique.join(" · ");
  }

  const api = { split, candidates, describe, labelOf, PARTICLES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Reading = api;
})(this);
