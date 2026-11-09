// Aspect forks: how a verb's present splits into its two stems, imperfective (the present's)
// and perfective, and how each makes a past and a future. Shared by the verb tables page,
// dictionary entries and the aspect forks page, and tested by tests/test_aspect_forks.js.
//
// Nothing here generates forms. It reads four first-person forms from a conjugation
// (conjugate()'s shape, normally verbToShow()'s merge of the dictionary's cells), compares
// their stems and works out:
//   - the group: which rule turns the present stem into the perfective one (γράφ- → γράψ- is a
//     labial). A verb that fits no rule is irregular and gets no fork;
//   - the markup: the augment, the letters that change in the perfective, the letters the
//     present has that the perfective loses, and letters only the imperfective adds;
//   - notes about this verb, like an augment inside a compound.
//
// Forms come back in a bracket notation, which forkHTML() turns into coloured spans:
//   [έ]γρα{ψ}α   [x] augment   {x} changed or added in the perfective
//   κλεί(ν)ω     (x) lost in the perfective
//   άκου<γ>α     <x> added in the imperfective
// Comparisons ignore accents (strip() maps letter for letter, so positions still line up).
// Passive and deponent verbs aren't covered yet: analyse() returns null for them.

(function (root) {
  "use strict";
  const { strip } = root.GreekVerbs || require("./greek-verbs.js");

  // In the order the aspect forks page shows them.
  const GROUPS = [
    { id: "labials", name: "Labials", rule: "-π  -β  -φ  -πτ  + σ → ψ",
      note: "Lip sounds fuse with σ into ψ." },
    { id: "velars", name: "Velars", rule: "-κ  -γ  -χ  -χν  -σσ  + σ → ξ",
      note: "Throat sounds fuse with σ into ξ. With -χν the ν goes too." },
    { id: "dentals", name: "Dentals", rule: "-τ  -δ  -θ  -ζ  + σ → σ",
      note: "Tooth sounds disappear into σ. Most -ζω verbs are here." },
    { id: "zeta-xi", name: "-ζω that take ξ", rule: "-ζω  + σ → ξ",
      note: "A handful of -ζω verbs act like velars. There's no rule to spot them, so learn these ones." },
    { id: "ev", name: "-εύω verbs", rule: "-ευ-  -αυ-  + σ → εψ  αψ",
      note: "ευ sounds like “ev”, so the υ behaves like β and becomes ψ." },
    { id: "vowel", name: "Vowel stem", rule: "vowel  + σ",
      note: "A plain vowel just adds σ." },
    { id: "nu-sigma", name: "-νω: ν drops, σ comes in", rule: "-ώνω  -ίνω  -ήνω  -ύνω  -άνω → -σ-",
      note: "The ν of the present is only in the imperfective. The perfective swaps it for σ." },
    { id: "liquids", name: "Nasals & liquids", rule: "-ν  -μ  -ρ  -λ : no σ, the vowel shifts",
      note: "These never take σ. The perfective changes a vowel (ε → ει, ε → υ, αι → α), or drops a ν or a doubled letter." },
    { id: "same", name: "Same form both ways", rule: "imperfective = perfective",
      note: "The two pasts and the two futures look identical. Only context tells you the aspect." },
    { id: "strong", name: "-αίνω / -άνω: strong aorist", rule: "drop -αιν- / -αν- (and any extra μ, γ, ν)",
      note: "The present is built on a longer stem. The perfective goes back to the short root, with no σ. Some add -ηκ- in the aorist." },
    { id: "aino", name: "-αίνω / -άνω: -ησ-, -ασ-", rule: "-αιν-  -αν-  → -ησ-  /  -ασ-",
      note: "The -αιν- or -αν- of the present gives way to -ησ- or -ασ-. Which one isn't predictable, so learn it with the verb." },
    { id: "b1-eta", name: "-άω verbs: -ησ-", rule: "-άω  → -ησ-",
      note: "Contracted verbs. The past continuous takes -ούσα, and the perfective adds -ησ-." },
    { id: "b1-other", name: "-άω verbs: -ασ-, -εσ-, -αξ-, -ηξ-", rule: "-άω  → -ασ-  /  -εσ-  /  -αξ-  /  -ηξ-",
      note: "Same pattern as the -ησ- verbs, but a different vowel (or ξ). These have to be memorised." },
    { id: "b2", name: "-ώ (-είς) verbs", rule: "-ώ  → -ησ-  (μπορώ → -εσ-)",
      note: "Also -ούσα in the past continuous, and usually -ησ- in the perfective." },
    { id: "no-perf", name: "No perfective", rule: "only the imperfective exists",
      note: "Verbs of being and knowing have one past and one future, which cover both aspects." },
    { id: "irregular", name: "Irregular: learn by heart", rule: "the stems don't follow a rule",
      note: "These don't get a fork: their stems come from different roots or change in ways no rule predicts. Tip: drop the augment from the aorist to get the perfective stem (είδα → θα δω, ήπια → θα πιω)." },
  ];
  const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));

  // Stems are compared without accents or diaeresis (ταΐζω, τάισα). Letter for letter, so
  // positions in the flattened string are positions in the real one.
  const flat = w => strip(w).replace(/ϊ/g, "ι").replace(/ϋ/g, "υ");

  const INFIXES = ["ησ", "ασ", "εσ", "αξ", "ηξ"];
  const VOWEL = /[αεηιουωϊϋ]/;
  const isVowel = ch => VOWEL.test(ch);
  const ACCENTED = /[άέήίόύώΐΰ]/;

  // ---------- Comparing stems ----------

  // Where two strings differ: a list of blocks { a: [start, end), b: [start, end), same }, from a
  // longest common subsequence. Unchanged runs and changed runs alternate.
  function diff(a, b) {
    const n = a.length, m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ops = [];
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { ops.push(["=", i++, j++]); continue; }
      if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) ops.push(["+", i, j++]);
      else ops.push(["-", i++, j]);
    }
    const blocks = [];
    for (const [op, ai, bj] of ops) {
      const same = op === "=";
      let last = blocks[blocks.length - 1];
      if (!last || last.same !== same) blocks.push(last = { same, a: [ai, ai], b: [bj, bj] });
      if (op !== "+") last.a[1] = ai + 1;
      if (op !== "-") last.b[1] = bj + 1;
    }
    return blocks;
  }
  const seg = (s, [x, y]) => s.slice(x, y);

  // Two stem bodies match, or differ in one letter (ανατρεφ-/αναθρεψ-, δι-/δω-).
  function close(x, y) {
    if (x === y) return true;
    if (x.length !== y.length) return false;
    return [...x].filter((ch, i) => ch !== y[i]).length === 1;
  }

  // ---------- Groups ----------

  // Which group turns present stem p into perfective stem d (both without accents), or null.
  function groupOf(p, d, pattern) {
    if (pattern === "b1" || pattern === "b2") {
      for (const base of [p, p.endsWith("ν") ? p.slice(0, -1) : null]) {
        if (base === null || !d.startsWith(base)) continue;
        const infix = d.slice(base.length);
        if (!INFIXES.includes(infix)) continue;
        if (pattern === "b2") return "b2";
        return infix === "ησ" ? "b1-eta" : "b1-other";
      }
      return null;
    }
    if (p === d) return "same";
    // The present stem ends in one of `ends`, the perfective in `to`, and what comes before matches.
    const fits = (ends, to) => {
      const e = ends.find(x => p.endsWith(x) && p.length > x.length);
      return !!e && d.endsWith(to) && close(p.slice(0, -e.length), d.slice(0, -to.length));
    };
    if (/[εα]υ$/.test(p) && fits(["υ"], "ψ")) return "ev";
    if (isVowel(p.slice(-1)) && d === p + "σ") return "vowel";
    if (fits(["πτ", "φτ", "π", "β", "φ"], "ψ")) return "labials";
    if (fits(["χν", "γγ", "σσ", "ττ", "σκ", "κ", "γ", "χ"], "ξ")) return "velars";
    if (fits(["ζ"], "ξ")) return "zeta-xi";
    if (fits(["τ", "δ", "θ", "ζ"], "σ")) return "dentals";
    if (fits(["ν"], "σ") && isVowel(p.slice(-2, -1))) return "nu-sigma";
    // Strong aorist: μαθαιν- → μαθ-, λαμβαν- → λαβ-, τυγχαν- → τυχ-.
    const strong = /^(.+?)(αιν|αν)$/.exec(p);
    if (strong) {
      const r = strong[1];
      const short = r.replace(/μ(β|π)$/, "$1").replace(/γ(χ|κ)$/, "$1").replace(/ν(θ|τ)$/, "$1");
      if (d === r || d === short) return "strong";
      if (d === r + "ησ" || d === r + "ασ") return "aino";
    }
    // Nasals and liquids: στελν- → στειλ-, φερν- → φερ-, βαλλ- → βαλ-, μεν- → μειν-, θερμαιν- → θερμαν-.
    const q = /[λρ]ν$/.test(p) || p.endsWith("λλ") ? p.slice(0, -1) : p;
    if (q !== p && q === d) return "liquids";
    const lq = /^(.*?)([αεηιουω]+)([μνλρ]+)$/.exec(q), ld = /^(.*?)([αεηιουω]+)([μνλρ]+)$/.exec(d);
    if (lq && ld && lq[1] === ld[1] && lq[3] === ld[3] && lq[2] !== ld[2]) return "liquids";
    return null;
  }

  // ---------- Markup ----------

  // Wrap letters by role: { aug: "[]", chg: "{}", drop: "()", ins: "<>" }.
  const BRACKETS = { aug: "[]", chg: "{}", drop: "()", ins: "<>" };
  function notation(word, roles) {
    let out = "", open = null;
    [...word].forEach((ch, i) => {
      const r = roles[i] || null;
      if (r !== open) {
        if (open) out += BRACKETS[open][1];
        if (r) out += BRACKETS[r][0];
        open = r;
      }
      out += ch;
    });
    return out + (open ? BRACKETS[open][1] : "");
  }

  // How a past stem relates to the stem it's built on (imperfect on the present, aorist on the
  // dependent): an augment, letters added at the end (άκου-γ-α, μιλ-ούσ-α, ανέβ-ηκ-α), and the
  // rest unchanged. Returns null when they relate some other way (πήγαινα from πάω).
  //   past, base   accented stems; pastForm the whole 1st singular, for where the accent is
  //   baseRoles    the base's letter roles, carried over to the letters the past shares
  //   addRole      the role for letters added at the end
  function pastMarkup(past, base, pastForm, baseRoles, addRole) {
    const P = flat(past), B = flat(base);
    const roles = new Array(past.length).fill(null);
    const accent = [...pastForm].findIndex(ch => ACCENTED.test(ch));
    const blocks = diff(B, P);
    let augment = null, added = "";
    // έχω → είχα, απέχω → απείχα: the ε lengthens to ει. The diff sees an added ι after a
    // shared ε, so the ε moves into the changed block.
    for (let k = 1; k < blocks.length; k++) {
      const bl = blocks[k], before = blocks[k - 1];
      if (bl.same || seg(B, bl.a) !== "" || seg(P, bl.b) !== "ι" || P[bl.b[0] - 1] !== "ε") continue;
      before.a[1]--; before.b[1]--;
      bl.a[0]--; bl.b[0]--;
      if (before.a[0] === before.a[1]) blocks.splice(k - 1, 1);
      break;
    }
    for (const [k, bl] of blocks.entries()) {
      if (bl.same) {
        for (let x = 0; x < bl.b[1] - bl.b[0]; x++) roles[bl.b[0] + x] = baseRoles[bl.a[0] + x];
        continue;
      }
      const from = seg(B, bl.a), to = seg(P, bl.b);
      const carriesAccent = accent >= bl.b[0] && accent < bl.b[1];
      const first = k === 0 || (k === 1 && blocks[0].same);
      // The augment carries the accent: έγραψα, είχα, ήθελα; inside a compound παρέλαβα,
      // επέστρεψα, υπήρχα. Inside, it follows a prefix, so a vowel comes before it.
      const initial = bl.b[0] === 0 && ["ε", "η", "ει"].includes(to) && (from === "" || (isVowel(from) && from.length <= 2));
      const inside = bl.b[0] > 0 && /[αεηιουω]/.test(P.slice(0, bl.b[0])) && ["ε", "η", "ει"].includes(to) && from.length <= 1 && (from === "" || isVowel(from));
      // A learned prefix that changes with it: εκφράζω → εξέφρασα, συγγράφω → συνέγραψα, εγκλείω → ενέκλεισα.
      const prefix = bl.b[0] > 0 && /[αεηιουω]/.test(P.slice(0, bl.b[0])) && /^[^αεηιουω]{1,2}$/.test(from) && /^[^αεηιουω]{1,2}ε$/.test(to);
      if (!augment && first && carriesAccent && (initial || inside || prefix)) {
        augment = { at: bl.b[0], from, to, inside: !initial, prefix, consonant: !isVowel(B[0]) };
        for (let x = bl.b[0]; x < bl.b[1]; x++) roles[x] = "aug";
        continue;
      }
      if (k === blocks.length - 1 && from === "" && bl.b[1] === P.length) {
        added = past.slice(bl.b[0]);
        for (let x = bl.b[0]; x < bl.b[1]; x++) roles[x] = addRole;
        continue;
      }
      return null;
    }
    return { roles, augment, added };
  }

  // ---------- Reading a conjugation ----------

  const bare = f => (f || "").replace(/^θα /, "").replace("|", "");
  const firstForm = cell => bare(cell && cell[0] && cell[0][0]);
  const splitEnding = (form, re) => { const m = re.exec(form); return m ? [form.slice(0, m.index), m[0]] : null; };

  // A verb's fork from its conjugation, or null if it's passive or has no present. `verb` is
  // verbToShow()'s verb: its spelling picks the present when the cell lists several (πάω's
  // table is πηγαίνω's), and the word list's class says b1 or b2. The result:
  //   group      a GROUPS id; "irregular" gets no fork, "missing" means the forms aren't there
  //   present, imperfect, aorist, dependent    1st singular forms in bracket notation
  //   presentStem, perfectiveStem              the same stems, unaccented: κλει(ν)-, κλει{σ}-
  //   notes      what's particular to this verb
  //   generated  which of the forms the engine filled in because the dictionary has none
  function analyse(c, verb = {}) {
    const greek = verb.greek || c.greek;
    const I = c.indicative;
    const presentRow = (I.present.continuous[0] || []).map(bare);
    const presentForm = presentRow.includes(greek) ? greek : presentRow[0];
    if (!presentForm || /μαι$/.test(presentForm) || !presentForm.endsWith("ω") && !presentForm.endsWith("ώ")) return null;
    const imperfectForm = firstForm(I.past.continuous);
    const aoristForm = firstForm(I.past.simple);
    const dependentForm = firstForm(I.future.simple);
    const g = c.generated || {};
    const result = {
      greek, present: presentForm, imperfect: imperfectForm, aorist: aoristForm, dependent: dependentForm, notes: [],
      generated: { imperfect: !!(g.imperfect && g.imperfect[0]), aorist: !!(g.past && g.past[0]), dependent: !!(g.dependent && g.dependent[0]) },
    };
    const plainOnly = group => Object.assign(result, { group, presentStem: "", perfectiveStem: "" });
    // Contracted verbs: the word list's class, else b1 if the 2nd singular can be -άς (μιλάς,
    // βοηθάς / βοηθείς), b2 if it's only -είς (μπορείς, ζεις). The engine's pattern doesn't
    // tell them apart for a verb that isn't in the word list.
    const contracted = c.pattern === "b1" || c.pattern === "b2";
    const second = (I.present.continuous[1] || []).map(f => flat(bare(f)));
    const pattern = !contracted ? c.pattern
      : verb.class === "b1" || verb.class === "b2" ? verb.class
      : second.some(f => f.endsWith("ας")) ? "b1" : "b2";

    const pres = splitEnding(presentForm, contracted ? /(άω|ώ|ω)$/ : /ω$/);
    const imp = imperfectForm && splitEnding(imperfectForm, /α$/);
    if (!pres) return plainOnly("irregular");
    if (!imp) return plainOnly(imperfectForm ? "irregular" : "missing");
    const [ps, pEnd] = pres;

    // No perfective (έχω, ξέρω): only the imperfective side.
    if (!aoristForm && !dependentForm) {
      const im = pastMarkup(imp[0], ps, imperfectForm, [], "ins");
      if (!im) return plainOnly("irregular");
      Object.assign(result, { group: "no-perf", present: presentForm, imperfect: notation(imp[0], im.roles) + "α", aorist: "", dependent: "",
        presentStem: strip(ps) + "-", perfectiveStem: "" });
      augmentNote(result, im.augment, imperfectForm);
      return result;
    }
    const dep = dependentForm && splitEnding(dependentForm, /(ώ|ω)$/);
    const aor = aoristForm && splitEnding(aoristForm, /α$/);
    if (!dependentForm || !aoristForm) return plainOnly("missing");
    if (!dep || !aor) return plainOnly("irregular");
    const [ds, dEnd] = dep;

    const P = flat(ps), D = flat(ds);
    const group = groupOf(P, D, pattern);
    if (!group) return plainOnly("irregular");

    // Present and dependent: what the perfective loses, and what it changes or adds.
    const pRoles = new Array(ps.length).fill(null), dRoles = new Array(ds.length).fill(null);
    const blocks = diff(P, D);
    for (const bl of blocks) {
      if (bl.same) continue;
      const lost = bl.b[0] === bl.b[1];
      for (let x = bl.a[0]; x < bl.a[1]; x++) if (lost || P[x] === "ν") pRoles[x] = "drop";
      for (let x = bl.b[0]; x < bl.b[1]; x++) dRoles[x] = "chg";
    }
    const im = pastMarkup(imp[0], ps, imperfectForm, pRoles, "ins");
    const am = pastMarkup(aor[0], ds, aoristForm, dRoles, "chg");
    if (!im || !am) return plainOnly("irregular");
    // A consonant stem with ή- or εί- (ήθελα, ήπια, είδα) is irregular, however tidy its stems.
    if ([im.augment, am.augment].some(a => a && !a.inside && a.consonant && a.to !== "ε")) return plainOnly("irregular");

    Object.assign(result, {
      group,
      present: notation(ps, pRoles) + pEnd,
      imperfect: notation(imp[0], im.roles) + "α",
      aorist: notation(aor[0], am.roles) + "α",
      dependent: notation(ds, dRoles) + dEnd,
      presentStem: strip(notation(ps, pRoles)) + "-",
      perfectiveStem: strip(notation(ds, dRoles)) + "-",
    });

    // Notes on what the group's rule doesn't say.
    augmentNote(result, am.augment || im.augment, am.augment ? aoristForm : imperfectForm);
    // A letter swapped earlier in the stem (ανατρέφω, αναθρέψω). For liquids and strong aorists
    // the changes inside the stem are the rule itself.
    if (group !== "liquids" && group !== "strong") {
      const ending = blocks.length - 1;
      blocks.filter((bl, k) => !bl.same && k < ending && bl.a[0] < bl.a[1] && bl.b[0] < bl.b[1])
        .forEach(bl => result.notes.push(`Also ${seg(P, bl.a)} → ${seg(D, bl.b)} in the perfective.`));
    }
    if (contracted && !D.startsWith(P)) result.notes.push(`The ν of the present drops: ${P}- → ${P.slice(0, -1)}-.`);
    if (group === "vowel" && /ευ$/.test(P)) result.notes.push(`Learned -εύω verbs like this one keep ευ and add σ, unlike δουλεύω, δουλέψω.`);
    if (am.added) result.notes.push(`The aorist adds -${strip(am.added)}-: ${aoristForm}.`);
    if (im.added && !contracted) result.notes.push(`The past continuous adds ${strip(im.added)}: ${imperfectForm}.`);
    return result;
  }

  function augmentNote(result, aug, form) {
    if (!aug) return;
    if (aug.prefix) result.notes.push(`The augment goes inside, and the learned prefix changes with it: ${form}.`);
    else if (aug.inside && aug.to === "ει") result.notes.push(`The augment lengthens ε → ει inside the verb: ${form}.`);
    else if (aug.inside && aug.from && aug.to === "η") result.notes.push(`The augment lengthens ${aug.from} → η inside the verb: ${form}.`);
    else if (aug.inside) result.notes.push(`The augment goes inside, after the prefix: ${form}.`);
    else if (aug.from) result.notes.push(`The augment lengthens ${aug.from} → ${aug.to}: ${form}.`);
  }

  // ---------- Drawing ----------

  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const CLASSES = { "[": ["aug", "]"], "{": ["chg", "}"], "(": ["drop", ")"], "<": ["ins", ">"] };

  // Bracket notation → HTML. "θα " in front is muted.
  function markHTML(s) {
    let out = "", i = 0;
    if (s.startsWith("θα ")) { out = `<span class="pre">θα </span>`; i = 3; }
    while (i < s.length) {
      const m = CLASSES[s[i]];
      if (m) {
        const j = s.indexOf(m[1], i + 1);
        out += `<span class="${m[0]}">${esc(s.slice(i + 1, j))}</span>`;
        i = j + 1;
      } else out += esc(s[i++]);
    }
    return out;
  }
  const plainText = s => s.replace(/[[\]{}()<>]/g, "");

  const GENERATED = `<span class="gen" title="Not in the dictionary: generated by rule" aria-label="generated">*</span>`;
  const node = (cls, label, form, generated = false) =>
    `<div class="node ${cls}"><span class="lbl">${label}</span><div class="form" lang="el">${markHTML(form)}${generated ? GENERATED : ""}</div></div>`;
  const SPLIT = `<svg class="split" viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden="true">
      <path class="i" d="M200 0 C200 18 100 12 100 30"/><path class="p" d="M200 0 C200 18 300 12 300 30"/></svg>`;

  // The fork for analyse()'s result. With `group: true` it's headed by the group's name and rule,
  // linked to `groupHref(id)` if given. Irregular verbs get a one-line note instead.
  function forkHTML(r, { group = true, groupHref } = {}) {
    if (!r) return "";
    if (r.group === "irregular")
      return `<p class="fork-none"><span lang="el">${esc(r.greek)}</span> is irregular, so it doesn't get an aspect fork: its stems don't follow a rule.</p>`;
    if (r.group === "missing")
      return `<p class="fork-none">No aspect fork: the dictionary doesn't list enough of <span lang="el">${esc(r.greek)}</span>'s past and future forms.</p>`;
    const G = GROUP[r.group];
    const name = groupHref ? `<a href="${esc(groupHref(r.group))}" target="_top">${esc(G.name)}</a>` : esc(G.name);
    const head = group
      ? `<div class="fork-head"><span class="fork-group">${name}</span><span class="fork-rule" lang="el">${esc(G.rule)}</span></div><p class="fork-gnote">${esc(G.note)}</p>`
      : "";
    const perfective = r.group === "no-perf"
      ? `${node("stem", "perfective stem", "—")}<div class="leaves">${node("leaf none", "aorist", "none")}${node("leaf none", "future simple", "use θα " + r.present)}</div>`
      : `${node("stem", "perfective stem", r.perfectiveStem)}<div class="leaves">${node("leaf", "aorist", r.aorist, r.generated.aorist)}${node("leaf", "future simple", "θα " + r.dependent, r.generated.dependent)}</div>`;
    const anyGenerated = r.generated.imperfect || (r.group !== "no-perf" && (r.generated.aorist || r.generated.dependent));
    const notes = r.notes.map(n => `<p class="fork-vnote">${esc(n)}</p>`).join("")
      + (anyGenerated ? `<p class="fork-vnote">${GENERATED} Not in the dictionary, so generated by rule.</p>` : "");
    return `${head}<div class="fork">
      ${node("present", "present", r.present)}
      ${SPLIT}
      <div class="cols">
        <div class="col i">${node("stem", "imperfective stem", r.presentStem)}<div class="leaves">${node("leaf", "past continuous", r.imperfect, r.generated.imperfect)}${node("leaf", "future continuous", "θα " + r.present)}</div></div>
        <div class="col p">${perfective}</div>
      </div>
      ${notes}
    </div>`;
  }

  // The legend for the colours.
  const LEGEND = `<div class="fork-legend">
      <span><i class="sw i"></i>imperfective</span><span><i class="sw p"></i>perfective</span>
      <span><span class="aug" lang="el">έ</span> augment</span>
      <span><span class="chg" lang="el">ψ</span> letters that change</span>
      <span><span class="drop" lang="el">ν</span> letters lost in the perfective</span>
      <span><span class="ins" lang="el">γ</span> letters only the imperfective adds</span>
    </div>`;

  const api = { GROUPS, GROUP, analyse, groupOf, diff, forkHTML, markHTML, plainText, LEGEND };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AspectFork = api;
})(this);
