// Preposition drill: the logic shared by apps/prepositions.html and
// tests/test_preposition_sentences.js.
//
// A sentence in preposition-sentences.json has its English (the words to translate marked
// *like this*), its Greek, the answer as it appears in the Greek, the answer's noun (from the
// word list) and its preposition: "σε", "από", "δίπλα σε", or "none" where Greek has none
// (τη Δευτέρα, on Monday; περιμένω τον Νίκο, I'm waiting for Nikos). Everything after the
// preposition is in the accusative, which the test checks against the noun's table:
//   [place word] [preposition] [article] [adjectives] noun [possessive]
//   δίπλα        στο (σε + το)             μικρό        σπίτι μου

(function (root) {
  "use strict";
  const VD = root.VoiceDrill || require("./voice-drill.js");
  const GS = root.GapSentences || require("./gap-sentences.js");
  const ND = root.NounDrill || require("./noun-drill.js");
  const { strip, lev } = VD;

  const SIMPLE = ["σε", "από", "με", "για", "χωρίς", "μέχρι", "ως", "μετά", "πριν", "κατά", "προς"];
  const PLACE = ["δίπλα", "κοντά", "μπροστά", "πίσω", "πάνω", "κάτω", "ανάμεσα", "μέσα", "έξω", "μακριά", "γύρω", "απέναντι"];
  // σ' and απ' are spoken shortenings of σε and από.
  const SHORT = { "σ'": "σε", "απ'": "από", "μ'": "με", "γι'": "για" };
  const POSSESSIVE = new Set(["μου", "σου", "του", "της", "μας", "σας", "τους"]);
  const ARTICLE_WORDS = new Set(ND.ARTICLE_ALL.map(a => a.form));
  // σε + article: στον, στη(ν), στο, στους, στις, στα.
  const contracted = w => (w.startsWith("στ") && ARTICLE_WORDS.has(w.slice(1)) ? w.slice(1) : null);

  // Groups for the page's chips, in order.
  const GROUPS = [
    { key: "σε", label: "σε", has: p => p === "σε" },
    { key: "από", label: "από", has: p => p === "από" },
    { key: "με", label: "με", has: p => p === "με" },
    { key: "για", label: "για", has: p => p === "για" },
    { key: "place", label: "Place words", has: p => PLACE.includes(p.split(" ")[0]) },
    { key: "other", label: "χωρίς, μέχρι, μετά…", has: p => p !== "none" && !["σε", "από", "με", "για"].includes(p) && !PLACE.includes(p.split(" ")[0]) },
    { key: "none", label: "No preposition", has: p => p === "none" },
  ];
  const groupOf = prep => GROUPS.find(g => g.has(prep)).key;

  // The words of an answer split into their parts. Contractions are opened: στο -> σε + το.
  //   { prep: "δίπλα σε" | "none", contracted: bool, article, phrase: [words after the preposition and article] }
  // A preposition is recognised without its accent (κοντα, απο); accent is then true.
  function parse(answer) {
    const ws = Array.isArray(answer) ? answer : GS.words(answer);
    const find = (list, w) => w && (list.includes(w) ? w : list.find(x => strip(x) === strip(w)));
    let i = 0, accent = false;
    const prep = [];
    const take = canonical => { if (canonical !== ws[i]) accent = true; prep.push(canonical); i++; };
    const place = find(PLACE, ws[i]);
    if (place) take(place);
    let article = null, isContracted = false;
    const c = ws[i] && contracted(ws[i]);
    if (c) { prep.push("σε"); article = c; isContracted = true; i++; }
    else if (ws[i] && SHORT[ws[i]]) { prep.push(SHORT[ws[i]]); i++; }
    else if (find(SIMPLE, ws[i])) take(find(SIMPLE, ws[i]));
    if (!article && ws[i] && ARTICLE_WORDS.has(ws[i])) article = ws[i++];
    return { prep: prep.length ? prep.join(" ") : "none", contracted: isContracted, article, phrase: ws.slice(i), words: ws, accent };
  }

  // A sentence's answer worked out against its noun's table (declensions.json):
  //   { prep, article, number, gender, slots } where slots grade the words after the
  //   preposition (NounDrill's phrase slots: article, adjectives, noun, possessive).
  // adjectives: Map of declensions.json adjectives by spelling, to read adjectives in the answer.
  // Returns { error } when the answer doesn't read as preposition + accusative.
  function analyse(item, noun, adjectives) {
    const p = parse(item.answer);
    if (!noun) return { error: `${item.noun} isn't in declensions.json` };
    const gender = noun.gender[0];
    const nounAt = p.phrase.findIndex(w => ND.allForms(noun).some(f => f.form === w));
    if (nounAt < 0) return { error: `no form of ${item.noun} in "${item.answer}"` };
    const hit = ND.allForms(noun).filter(f => f.form === p.phrase[nounAt]);
    const acc = hit.find(f => f.case === "accusative");
    if (!acc) return { error: `${p.phrase[nounAt]} isn't accusative` };
    const number = acc.number;
    const want = { case: "accusative", number, gender };
    const slots = [];
    const before = p.phrase.slice(0, nounAt), after = p.phrase.slice(nounAt + 1);
    for (const w of before) {
      const adj = [...adjectives.values()].find(a => (ND.cell(a, "accusative", number, gender) || []).map(ND.plain).includes(w));
      if (!adj) return { error: `${w} isn't an adjective agreeing with ${item.noun}` };
      slots.push({ role: "adjective", word: adj.greek, forms: ND.cell(adj, "accusative", number, gender).map(ND.plain), all: ND.allForms(adj) });
    }
    slots.push({ role: "noun", word: noun.greek, forms: ND.cell(noun, "accusative", number).map(ND.plain), all: ND.allForms(noun) });
    for (const w of after) {
      if (!POSSESSIVE.has(w)) return { error: `${w} after the noun isn't a possessive` };
      slots.push({ role: "possessive", word: w, forms: [w], all: [...POSSESSIVE].map(form => ({ form })) });
    }
    if (p.article) {
      const forms = ND.articleForms(gender, "accusative", number, p.phrase[0]);
      if (!forms.includes(p.article)) return { error: `the article ${p.article} doesn't fit ${p.phrase[0]} (${forms.join(" / ")})` };
      slots.unshift({ role: "article", word: "", forms, all: ND.ARTICLE_ALL });
    }
    if (p.prep.endsWith("σε") && p.article && !p.contracted) return { error: "σε and the article should join: στον, στη(ν), στο…" };
    return { prep: p.prep, contracted: p.contracted, article: p.article, number, gender, want, slots };
  }

  const SEVERITY = { correct: 0, accent: 1, n: 1, spelling: 2, extra: 2, contraction: 3, form: 3, "missing article": 3, "extra article": 3, preposition: 4, missing: 4, wrong: 5 };

  // Grade a typed answer. item: a sentence with `expected` (analyse()'s result). Returns null for
  // an empty answer, otherwise { result, typed, prep?, phrase? } where phrase is NounDrill's
  // gradePhrase() result for the words after the preposition. result is one of: correct, accent,
  // n (τη where the ν stays), spelling, contraction (σε την for στην), form (an article,
  // adjective or noun in another case, number or gender), missing article, extra article,
  // preposition (the wrong one, a missing one, or one where Greek has none), wrong.
  function grade(typed, item) {
    const t = GS.words(typed);
    if (!t.length) return null;
    const e = item.expected, p = parse(t);
    const out = { typed: t.join(" "), typedPrep: p.prep };
    // Another way to say it, listed in the sentence's `also`: με λεωφορείο for με το λεωφορείο.
    if ((item.also || []).some(a => GS.words(a).join(" ") === out.typed)) return { ...out, result: "correct", also: true };
    const prepRight = p.prep === e.prep;
    out.prepAccent = prepRight && p.accent;

    // The words after the preposition, the article opened out of a contraction.
    const rest = [...(p.article ? [p.article] : []), ...p.phrase];
    const slots = e.slots;
    const g = rest.length ? ND.gradePhrase(rest, slots, e.want) : { result: "missing", words: slots.map(() => ({ result: "missing" })), extra: [] };
    out.phrase = g;
    // A missing article, or an article where Greek has none, is its own mistake.
    const articleAt = slots.findIndex(s => s.role === "article");
    const extraArticle = articleAt < 0 && p.article && g.extra.includes(p.article);
    let result = "correct";
    g.words.forEach((w, k) => { result = worse(result, k === articleAt && w.result === "missing" ? "missing article" : w.result); });
    for (const x of g.extra) result = worse(result, extraArticle && x === p.article ? "extra article" : "extra");
    if (!prepRight) result = worse(result, "preposition");
    else if (out.prepAccent) result = worse(result, "accent");
    if (prepRight && e.prep.endsWith("σε") && e.article && p.article && !p.contracted) result = worse(result, "contraction");
    out.result = result;
    return out;
  }
  const worse = (a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a);

  // Words that are part of a preposition, for telling the learner which one they typed.
  const isPrepWord = w => SIMPLE.includes(w) || PLACE.includes(w) || !!SHORT[w] || !!contracted(w);

  const api = { SIMPLE, PLACE, GROUPS, groupOf, parse, analyse, grade, isPrepWord, contracted };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PrepositionDrill = api;
})(this);
