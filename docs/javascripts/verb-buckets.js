// The verb groups drill (apps/verb-groups.html): sort a verb by what its perfective stem does
// with σ, then type its simple future. Shared with tests/test_verb_buckets.js.
//
// The aspect forks' fifteen groups (aspect-fork.js) are folded into six buckets a learner can
// sort by ear: lip sounds + σ give ψ, throat sounds ξ, the rest σ; contracted verbs add -ησ-;
// some stems take no σ at all; and the irregulars. Nothing here generates forms: the bucket
// comes from analyse()'s group, and the answers from the verb tables' forms.

(function (root) {
  "use strict";
  const AF = root.AspectFork || require("./aspect-fork.js");
  const VD = root.VoiceDrill || require("./voice-drill.js");

  const BUCKETS = [
    { id: "psi", label: "ψ", name: "lip sounds + σ", ends: "π  β  φ  πτ  φτ  ευ", groups: ["labials", "ev"],
      rule: "Lip sounds (π, β, φ) fuse with σ into ψ. So does the υ of ευ, which sounds like β." },
    { id: "xi", label: "ξ", name: "throat sounds + σ", ends: "κ  γ  χ  χν  σσ  (a few ζ)", groups: ["velars", "zeta-xi"],
      rule: "Throat sounds (κ, γ, χ) fuse with σ into ξ. A few -ζω verbs do too." },
    { id: "sigma", label: "σ", name: "+ σ, the sound vanishes", ends: "τ  δ  θ  ζ  ν  a vowel", groups: ["dentals", "vowel", "nu-sigma", "aino"],
      rule: "Tooth sounds (τ, δ, θ, ζ) vanish into σ, a vowel just adds it, and -νω swaps its ν for σ." },
    { id: "eta", label: "-ήσω", name: "-άω / -ώ verbs", ends: "-άω  -ώ", groups: ["b1-eta", "b1-other", "b2"],
      rule: "Contracted verbs add -ησ-, and a few -ασ-, -εσ- or -αξ-." },
    { id: "none", label: "no σ", name: "the stem shifts", ends: "ν  μ  ρ  λ  -αίνω", groups: ["liquids", "strong", "same", "no-perf"],
      rule: "No σ at all: the vowel shifts (μένω, θα μείνω), the stem gets shorter (μαθαίνω, θα μάθω), or nothing changes (κάνω)." },
    { id: "irregular", label: "irregular", name: "learn by heart", ends: "τρώω  βλέπω  λέω …", groups: ["irregular"],
      rule: "The stems don't follow a rule. Learn the future and the past with the verb: τρώω, θα φάω, έφαγα." },
  ];
  const BUCKET = Object.fromEntries(BUCKETS.map(b => [b.id, b]));
  const OF_GROUP = Object.fromEntries(BUCKETS.flatMap(b => b.groups.map(g => [g, b.id])));
  const bucketOf = group => OF_GROUP[group] || null;

  const plain = s => AF.plainText(s || "");
  const stemOf = fork => plain(fork.presentStem).replace(/-$/, "");
  const endIn = (stem, re) => (re.exec(stem) || [""])[0];
  // The letters the perfective changes or adds, from the fork's {…} marks: "ησ" in μιλ{ησ}-.
  const changed = fork => ((fork.perfectiveStem || "").match(/\{([^}]*)\}/g) || []).map(m => m.slice(1, -1)).join("");

  // Why this verb is in its bucket, in a sentence about its own stem. `future` is its first
  // simple future without θα.
  function why(fork, future) {
    const stem = stemOf(fork), present = plain(fork.present), pair = `${present}, θα ${future}`;
    switch (fork.group) {
      case "labials": return `${stem}- ends in ${endIn(stem, /(πτ|φτ|π|β|φ)$/)}, a lip sound. Lip + σ = ψ: ${pair}.`;
      case "ev": return `${stem}- ends in ευ, which sounds like εβ: a lip sound, so + σ = ψ: ${pair}.`;
      case "velars": {
        const end = endIn(stem, /(χν|γγ|σσ|ττ|σκ|κ|γ|χ)$/);
        return `${stem}- ends in ${end}, a throat sound. Throat + σ = ξ${end === "χν" ? ", and the ν goes" : ""}: ${pair}.`;
      }
      case "zeta-xi": return `Most -ζω verbs take σ, but this is one of the few that take ξ, like a throat sound: ${pair}.`;
      case "dentals": return `${stem}- ends in ${endIn(stem, /(τ|δ|θ|ζ)$/)}, a tooth sound. It vanishes into σ: ${pair}.`;
      case "vowel": return `${stem}- ends in a vowel, which just adds σ: ${pair}.`;
      case "nu-sigma": return `The ν of ${present} is only in the present. The perfective swaps it for σ: ${pair}.`;
      case "aino": return `The -αιν- or -αν- of the present gives way to -${changed(fork)}-: ${pair}.`;
      case "b1-eta": case "b2": {
        const infix = changed(fork);
        return infix === "ησ" ? `A contracted verb (-άω / -ώ): it adds -ησ-: ${pair}.`
          : `A contracted verb (-άω / -ώ), but this one adds -${infix}-, not -ησ-: ${pair}.`;
      }
      case "b1-other": return `A contracted verb (-άω / -ώ), but this one adds -${changed(fork)}-, not -ησ-: ${pair}.`;
      case "liquids": return `${stem}- ends in ${endIn(stem, /[μνλρ]+$/)}, and ν, μ, ρ, λ never take σ. The stem changes instead: ${pair}.`;
      case "strong": return `The present is built on a longer stem. The perfective goes back to the short root, with no σ: ${pair}.`;
      case "same": return `No σ and no change: θα ${future} is both futures, so only the context gives the aspect.`;
      case "no-perf": return `This verb has only one stem, so θα ${future} covers both futures. No σ.`;
      case "irregular": return `The stems don't follow a rule: ${pair}${fork.aorist ? ", " + plain(fork.aorist) : ""}. Learn it by heart.`;
      default: return "";
    }
  }

  const bare = f => String(f || "").replace(/^θα /, "").replace(/\|/g, "");
  // The simple future's forms without θα, most usual first: θα γράψω → ["γράψω"]. A verb with no
  // perfective (έχω) answers with its present: θα έχω.
  function futureAnswers(conjugation, fork) {
    const simple = ((conjugation.indicative.future.simple || [])[0] || []).map(bare).filter(Boolean);
    return simple.length ? [...new Set(simple)] : [fork.present];
  }

  // A typed future, with or without θα or να in front:
  //   correct, accent, present (θα + the present, the continuous future), spelling, wrong.
  function gradeFuture(typed, answers, present) {
    const t = VD.lower(typed).trim().replace(/\s+/g, " ").replace(/^(θα|να) /, "");
    if (!t) return null;
    const A = answers.map(VD.lower);
    if (A.includes(t)) return { result: "correct", typed: t };
    if (A.some(a => VD.strip(a) === VD.strip(t))) return { result: "accent", typed: t };
    if (VD.strip(t) === VD.strip(VD.lower(present))) return { result: "present", typed: t };
    const st = VD.strip(t), tol = Math.max(1, Math.floor(st.length * 0.25));
    if (A.some(a => VD.lev(st, VD.strip(a)) <= tol)) return { result: "spelling", typed: t };
    return { result: "wrong", typed: t };
  }

  const api = { BUCKETS, BUCKET, bucketOf, why, futureAnswers, gradeFuture };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VerbBuckets = api;
})(this);
