// Object pronoun drill: the logic shared by apps/object-pronouns.html and
// tests/test_pronoun_sentences.js.
//
// A sentence in pronoun-sentences.json has its English (the words to translate marked
// *like this*), its Greek, the answer as it appears in the Greek, any other accepted answers,
// and a rule: where the weak pronoun goes.
//   before      before a plain verb: Το ξέρω.
//   negation    after δεν: Δεν το ξέρω.
//   particle    after θα or να: Θα το πάρω. Να του το πεις.
//   imperative  after an imperative: Πάρ' το. Δώσ' μου το.
//   dont        after μην, before the verb: Μην το πεις.
// The test checks that the answer is in the Greek and is built the way its rule says.

(function (root) {
  "use strict";
  const VD = root.VoiceDrill || require("./voice-drill.js");
  const GS = root.GapSentences || require("./gap-sentences.js");
  const { strip, lev } = VD;

  const RULES = ["before", "negation", "particle", "imperative", "dont"];
  // The weak pronouns. μας, σας and τους are both accusative and genitive.
  const ACCUSATIVE = { με: "me", σε: "you", τον: "him", την: "her", τη: "her", το: "it", μας: "us", σας: "you (pl.)", τους: "them (masc.)", τις: "them (fem.)", τα: "them (neut.)" };
  const GENITIVE = { μου: "me", σου: "you", του: "him / it", της: "her", μας: "us", σας: "you (pl.)", τους: "them" };
  const isPronoun = w => w in ACCUSATIVE || w in GENITIVE;
  const PARTICLES = new Set(["θα", "να", "δεν", "δε", "μην", "μη"]);

  // What a pronoun means, for feedback: "το (it)", "του (to him / it)".
  function meaning(w) {
    const acc = ACCUSATIVE[w], gen = GENITIVE[w];
    return acc && gen ? `${acc}, or to ${gen}` : acc || (gen && "to " + gen) || "";
  }

  // The parts of an answer: its particles, pronouns and the verb, with where the pronouns are.
  //   { particles: ["θα"], pronouns: ["σου", "το"], verb: "πω", position: "before" | "after" | null }
  function analyse(answer) {
    const ws = Array.isArray(answer) ? answer : GS.words(answer);
    const particles = [], pronouns = [];
    let verb = null, position = null;
    for (const w of ws) {
      if (verb === null && PARTICLES.has(w)) particles.push(w);
      else if (isPronoun(w)) { pronouns.push(w); if (!position) position = verb === null ? "before" : "after"; }
      else if (verb === null) verb = w;
      else return null;  // a second verb or another word: not an answer this drill can read
    }
    return verb === null ? null : { words: ws, particles, pronouns, verb, position };
  }

  // Is the answer built the way its rule says? Returns "" or what's wrong.
  function ruleProblem(answer, rule) {
    const a = analyse(answer);
    if (!a) return "it isn't particles, pronouns and one verb";
    if (!a.pronouns.length) return "it has no weak pronoun";
    if (a.pronouns.length > 2) return "it has more than two pronouns";
    const first = a.particles[0];
    const want = {
      before: !a.particles.length && a.position === "before",
      negation: (first === "δεν" || first === "δε") && a.position === "before",
      particle: (first === "θα" || first === "να") && a.position === "before",
      imperative: !a.particles.length && a.position === "after",
      dont: (first === "μην" || first === "μη") && a.position === "before",
    }[rule];
    if (want === undefined) return `the rule "${rule}" isn't one of ${RULES.join(", ")}`;
    if (!want) return `it doesn't fit the rule "${rule}"`;
    // Two before the verb: the genitive (to whom) comes first, μου το.
    if (a.position === "before" && a.pronouns.length === 2 && !(a.pronouns[0] in GENITIVE)) return "with two pronouns before the verb, the genitive comes first";
    return "";
  }

  // The answers with τη for την, δε for δεν and μη for μην wherever the ν may drop: before a
  // consonant other than κ, π, τ, ξ, ψ (τη βλέπω, but την ξέρω), and the other way round.
  // Dropping a ν that must stay isn't added, so it's graded wrong.
  const keepsN = next => /^[αεηιουωκπτξψ]|^(γκ|μπ|ντ)/.test(strip(next || ""));
  const N_PAIRS = { την: "τη", τη: "την", δεν: "δε", δε: "δεν", μην: "μη", μη: "μην" };
  function withN(answers) {
    let out = [...answers];
    // Twice, for answers with two such words (δεν την).
    for (let pass = 0; pass < 2; pass++) {
      for (const answer of [...out]) {
        const ws = GS.words(answer);
        ws.forEach((w, i) => {
          if (N_PAIRS[w] && !keepsN(ws[i + 1])) out.push(ws.map((x, k) => (k === i ? N_PAIRS[w] : x)).join(" "));
        });
      }
      out = [...new Set(out)];
    }
    return out;
  }

  const SEVERITY = { correct: 0, accent: 1, order: 2, spelling: 2, particle: 3, pronoun: 3, verb: 4, wrong: 5 };

  // Grade a typed answer against a sentence's accepted answers (item.answers: strings, the first
  // being the one in the Greek). Returns null for an empty answer, otherwise
  //   { result, typed, answer, order?, missing?, extra?, swapped? }
  // result: correct, accent, order (the right words in the wrong order), particle, pronoun
  // (missing, extra or the wrong one), spelling (the verb is close), verb, wrong. order: false
  // when, besides that, the pronouns are on the wrong side of the verb.
  function grade(typed, item) {
    const t = GS.words(typed);
    if (!t.length) return null;
    let best = null;
    for (const answer of withN(item.answers)) {
      const g = gradeOne(t, GS.words(answer));
      g.answer = answer;
      if (!best || SEVERITY[g.result] < SEVERITY[best.result]) best = g;
    }
    return best;
  }

  function gradeOne(t, a) {
    const typed = t.join(" ");
    const eq = (x, y, loose) => x.length === y.length && x.every((w, i) => (loose ? strip(w) === strip(y[i]) : w === y[i]));
    if (eq(t, a)) return { result: "correct", typed };
    if (eq(t, a, true)) return { result: "accent", typed };
    if (GS.sameWords(t, a) || GS.sameWords(t.map(strip), a.map(strip))) return { result: "order", typed };

    const ta = analyse(t), aa = analyse(a);
    const pt = t.filter(isPronoun), pa = a.filter(isPronoun);
    const ot = t.filter(w => !isPronoun(w)), oa = a.filter(w => !isPronoun(w));
    const side = ta && aa && ta.position && aa.position ? ta.position === aa.position : true;
    if (GS.sameWords(ot.map(strip), oa.map(strip))) {
      const missing = pa.filter(w => !pt.includes(w)), extra = pt.filter(w => !pa.includes(w));
      return { result: "pronoun", typed, missing, extra, order: side };
    }
    const nt = ot.filter(w => !PARTICLES.has(w)), na = oa.filter(w => !PARTICLES.has(w));
    const samePronouns = GS.sameWords(pt, pa);
    if (GS.sameWords(nt.map(strip), na.map(strip))) return { result: "particle", typed, order: side, pronounsRight: samePronouns };
    if (nt.length === 1 && na.length === 1) {
      const d = lev(strip(nt[0]), strip(na[0]));
      const close = d <= Math.max(1, Math.floor(strip(na[0]).length * 0.25));
      if (close && samePronouns) return { result: "spelling", typed, order: side };
      if (samePronouns || d <= 3) return { result: "verb", typed, order: side, pronounsRight: samePronouns };
    }
    return { result: "wrong", typed };
  }

  const api = { RULES, ACCUSATIVE, GENITIVE, PARTICLES, isPronoun, meaning, analyse, ruleProblem, grade };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PronounDrill = api;
})(this);
