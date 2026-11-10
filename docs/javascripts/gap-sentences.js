// Fill-in-the-gap sentences: the helpers shared by the object pronoun and preposition drills
// (pronoun-drill.js, preposition-drill.js) and their tests.
//
// A sentence stores its Greek (`el`) and the words to type (`answer`), which must appear in it.
// The page shows the Greek with the answer blanked out and the English with the same words
// marked, *like this*.

(function (root) {
  "use strict";
  const VD = root.VoiceDrill || require("./voice-drill.js");
  const { lower, strip } = VD;

  // Every apostrophe-like mark is one ', so δώσ' and δώσ’ match.
  const APOSTROPHES = /[’'ʼ΄`´]/g;
  const WORD = /[\p{L}\p{M}]+'?/gu;
  const fold = w => lower(w).replace(APOSTROPHES, "'").replace(/σ$/, "ς");

  // Words of a text, lowercased, an elided word keeping its apostrophe (σ', δώσ'), and a typed
  // final σ fixed to ς.
  const words = text => [...String(text).replace(APOSTROPHES, "'").matchAll(WORD)].map(m => fold(m[0]));

  // Where the answer's words are in the sentence: { from, to } character offsets, or null.
  // Words are compared without their accents only when matchAccents is false.
  function locate(el, answer, matchAccents = true) {
    const ms = [...String(el).replace(APOSTROPHES, "'").matchAll(WORD)];
    const toks = ms.map(m => fold(m[0])), want = words(answer);
    const same = (a, b) => (matchAccents ? a === b : strip(a) === strip(b));
    for (let i = 0; i + want.length <= toks.length; i++) {
      if (want.every((w, k) => same(toks[i + k], w))) {
        const last = ms[i + want.length - 1];
        return { from: ms[i].index, to: last.index + last[0].length };
      }
    }
    return null;
  }

  // How many times the answer's words appear in the sentence.
  function count(el, answer) {
    const toks = words(el), want = words(answer);
    let n = 0;
    for (let i = 0; i + want.length <= toks.length; i++) if (want.every((w, k) => toks[i + k] === w)) n++;
    return n;
  }

  // The sentence split around its answer: [before, answer, after].
  function split(el, answer) {
    const at = locate(el, answer);
    return at ? [el.slice(0, at.from), el.slice(at.from, at.to), el.slice(at.to)] : [el, "", ""];
  }

  // "*was writing*" in the English marks the words to translate. Returns [before, marked, after].
  function target(en) {
    const m = /^(.*?)\*([^*]+)\*(.*)$/.exec(en);
    return m ? [m[1], m[2], m[3]] : [en, "", ""];
  }

  // Do two lists of words hold the same words, in any order?
  const sameWords = (a, b) => a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");

  const api = { words, fold, locate, count, split, target, sameWords };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GapSentences = api;
})(this);
