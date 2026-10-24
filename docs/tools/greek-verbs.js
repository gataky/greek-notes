// Modern Greek verb conjugation.
//
// Every form is built from three things the sheet gives us: the dictionary form
// (present stem), the future simple 1st singular (perfective stem) and the aorist
// 1st singular. Endings and accent rules live here; per-verb oddities come from the
// "overrides" column ("past: ήθελα; imp: έλα, ελάτε; imp-cont: ...; no perfective").
//
// A form is a string with "|" between stem and ending ("γράψ|ουμε") so the page
// can highlight the ending. A cell is one row per person, each row a list of
// alternatives; an empty list means the form isn't used.

(function (root) {
  "use strict";

  // ---------- Letters and syllables ----------

  const ACUTE = { α: "ά", ε: "έ", η: "ή", ι: "ί", ο: "ό", υ: "ύ", ω: "ώ", ϊ: "ΐ", ϋ: "ΰ" };
  const PLAIN = Object.fromEntries(Object.entries(ACUTE).map(([p, a]) => [a, p]));
  const VOWELS = new Set([...Object.keys(ACUTE), ...Object.values(ACUTE)]);
  const DIGRAPHS = new Set(["αι", "ει", "οι", "ου", "υι", "αυ", "ευ", "ηυ"]);

  const plain = ch => PLAIN[ch] || ch;
  const isVowel = ch => VOWELS.has(ch);
  const strip = w => [...w].map(plain).join("");
  const hasAccent = w => [...w].some(ch => ch in PLAIN);

  // Vowel groups that make up the syllables of a word, as [start, end) offsets.
  function nuclei(w) {
    const out = [];
    let i = 0;
    while (i < w.length) {
      if (!isVowel(w[i])) { i++; continue; }
      const start = i;
      // Unaccented ι between a consonant and a vowel is a glide: πιω, βοηθιέμαι.
      if (w[i] === "ι" && i > 0 && !isVowel(w[i - 1]) && isVowel(w[i + 1] || "")) i++;
      const pair = plain(w[i]) === w[i] && w[i + 1] ? w[i] + plain(w[i + 1]) : "";
      i += DIGRAPHS.has(pair) ? 2 : 1;
      out.push({ start, end: i });
    }
    return out;
  }

  // Index from the end (1 = last syllable) of the accented syllable, 0 if none.
  function accentFromEnd(w) {
    const ns = nuclei(w);
    const i = ns.findIndex(n => hasAccent(w.slice(n.start, n.end)));
    return i < 0 ? 0 : ns.length - i;
  }

  // Put the accent on the k-th syllable from the end.
  function placeAccent(w, k) {
    w = strip(w);
    const ns = nuclei(w);
    if (ns.length < 2) return w;
    const n = ns[Math.max(0, ns.length - k)];
    let pos = n.start;
    if (w[pos] === "ι" && n.end - pos > 1) pos++;  // glide: accent the vowel after it
    if (n.end - pos === 2) pos++;                   // digraph: accent its second letter
    return w.slice(0, pos) + ACUTE[w[pos]] + w.slice(pos + 1);
  }

  // Monosyllables carry no accent: πω, πεις, τρως.
  const finish = w => (nuclei(w).length < 2 ? strip(w) : w);

  // Past tenses pull the accent back as far as it goes (3rd syllable from the end).
  const recessive = w => finish(placeAccent(w, Math.min(3, nuclei(w).length)));

  // The accent can't sit further back than the 3rd syllable from the end.
  const limit = w => (accentFromEnd(w) > 3 ? placeAccent(w, 3) : w);

  const mark = (w, endLen) => (endLen ? w.slice(0, w.length - endLen) + "|" + w.slice(w.length - endLen) : w);

  // Stem + ending. An accented ending takes the accent; otherwise the stem keeps it.
  function join(stem, ending) {
    const w = hasAccent(ending) ? strip(stem) + ending : limit(stem + ending);
    return mark(finish(w), ending.length);
  }

  // How an augmented past stem relates to the plain one, or null if it has no
  // augment that can drop: έγραψ/γραψ, ήθελ/θελ, είδ/δ, έφαγ/φα (initial), or
  // παρέλαβ/παραλαβ, επέστρεφ/επιστρεφ (internal ε in a compound).
  function findAugment(full, base) {
    full = strip(full);
    base = strip(base);
    if (!base || full === base) return null;
    for (const x of ["ει", "η", "ε"]) {
      const rest = full.slice(x.length);
      if (full.startsWith(x) && rest.startsWith(base)) return { pos: 0, plain: rest };
    }
    if (full.length === base.length) {
      const diff = [...full].map((ch, i) => (ch !== base[i] ? i : -1)).filter(i => i >= 0);
      if (diff.length === 1 && diff[0] > 0 && full[diff[0]] === "ε") return { pos: diff[0], plain: base };
    }
    return null;
  }

  // A past form. The augment only survives while it carries the accent:
  // έγραψα but γράψαμε, ήθελα but θέλαμε, παρέλαβα but παραλάβαμε.
  function past(full, aug, ending) {
    let w = recessive(strip(full) + ending);
    if (aug) {
      const ns = nuclei(w);
      const accented = ns.findIndex(n => hasAccent(w.slice(n.start, n.end)));
      const augmented = ns.findIndex(n => n.start <= aug.pos && aug.pos < n.end);
      if (accented !== augmented) w = recessive(aug.plain + ending);
    }
    return mark(w, ending.length);
  }

  // A past stem from the sheet (aorist or "past:" override). Normally the accent
  // goes back as far as it can, but if the sheet's 1st singular has it later
  // (υπήρχα, υπήρξα), it stays on that syllable in every person.
  function pastFromSheet(full, base, ending, first = full + "α") {
    if (nuclei(first).length >= 3 && accentFromEnd(first) < 3) return join(full, ending);
    return past(full, findAugment(full, base), ending);
  }

  // Run fn over an ending spec: a string or list of alternatives, where "ουν(ε)"
  // means an optional letter. Alternatives that only add the letter collapse back
  // to "γράφ|ουν(ε)"; ones where the accent moves stay apart ("έγραψαν", "γράψανε").
  function variants(spec, fn) {
    const out = [];
    for (const e of [].concat(spec)) {
      const m = /^(.*)\((.+)\)$/.exec(e);
      if (!m) { out.push(fn(e)); continue; }
      const short = fn(m[1]);
      const long = fn(m[1] + m[2]);
      if (long === short + m[2]) out.push(short + "(" + m[2] + ")");
      else out.push(short, long);
    }
    return [...new Set(out)];
  }

  const table = (endings, fn) => endings.map(spec => variants(spec, fn));
  const prefix = (pre, cell) => cell.map(row => row.map(f => pre + f));
  const NONE6 = () => [[], [], [], [], [], []];
  const NONE2 = () => [[], []];

  // ---------- Endings ----------

  const PRESENT = {
    a1: ["ω", "εις", "ει", "ουμε", "ετε", "ουν(ε)"],
    a2: ["ω", "ς", "ει", "με", "τε", "νε"],
    b1: [["άω", "ώ"], "άς", "άει", ["άμε", "ούμε"], "άτε", ["άνε", "ούν(ε)"]],
    b2: ["ώ", "είς", "εί", "ούμε", "είτε", "ούν(ε)"],
    c1: ["ομαι", "εσαι", "εται", "όμαστε", ["όσαστε", "εστε"], "ονται"],
    c2: ["άμαι", "άσαι", "άται", "όμαστε", ["όσαστε", "άστε"], "ούνται"],
    c3: ["ιέμαι", "ιέσαι", "ιέται", "ιόμαστε", ["ιόσαστε", "ιέστε"], "ιούνται"],
    c4: ["ούμαι", "είσαι", "είται", "ούμαστε", "είστε", "ούνται"],
  };

  const AORIST = ["α", "ες", "ε", "αμε", "ατε", "αν(ε)"];
  const AORIST_HKA = AORIST.map(e => "ηκ" + e);
  const PAST = {
    a1: AORIST,
    a2: ["γα", "γες", "γε", "γαμε", "γατε", "γαν(ε)"],
    b1: ["ούσα", "ούσες", "ούσε", "ούσαμε", "ούσατε", "ούσαν(ε)"],
    b2: ["ούσα", "ούσες", "ούσε", "ούσαμε", "ούσατε", "ούσαν(ε)"],
    c1: ["όμουν(α)", "όσουν(α)", "όταν(ε)", "όμαστε", "όσαστε", "ονταν"],
    c2: ["όμουν(α)", "όσουν(α)", "όταν(ε)", "όμαστε", "όσαστε", "όνταν"],
    c3: ["ιόμουν(α)", "ιόσουν(α)", "ιόταν(ε)", "ιόμαστε", "ιόσαστε", "ιόνταν"],
    c4: ["ούμουν(α)", "ούσουν(α)", "ούνταν", "ούμαστε", "ούσαστε", "ούνταν"],
  };

  const STEM_CUT = { a1: 1, a2: 1, b2: 1, c1: 4, c2: 4, c3: 5, c4: 5 };

  const HAVE = ["έχω", "έχεις", "έχει", "έχουμε", "έχετε", "έχουν(ε)"];
  const HAD = ["είχα", "είχες", "είχε", "είχαμε", "είχατε", "είχαν(ε)"];

  // Passive perfective imperative: the passive stem turns back into the active
  // one before -ου: γραφτ- → γράψου, ετοιμαστ- → ετοιμάσου, σηκωθ- → σηκώσου.
  const PASSIVE_IMP = [[/φτ$/, "ψ"], [/χτ$/, "ξ"], [/στ$/, "σ"], [/([αε])υτ$/, "$1ψ"], [/([αεηιουωρ])θ$/, "$1σ"]];

  const PERSONS = ["εγώ", "εσύ", "αυτός / αυτή / αυτό", "εμείς", "εσείς", "αυτοί / αυτές / αυτά"];

  // είμαι follows none of the patterns.
  const EIMAI = {
    present: ["είμαι", "είσαι", "είναι", "είμαστε", ["είστε", "είσαστε"], "είναι"],
    past: ["ήμουν(α)", "ήσουν(α)", "ήταν(ε)", ["ήμασταν", "ήμαστε"], ["ήσασταν", "ήσαστε"], "ήταν(ε)"],
  };

  // ---------- Reading the sheet's data ----------

  function parseOverrides(text) {
    const out = {};
    for (const part of (text || "").split(";")) {
      const [key, ...rest] = part.split(":");
      const k = key.trim().toLowerCase();
      if (k) out[k] = rest.join(":").trim() || true;
    }
    return out;
  }

  // "έλα, ελάτε" → [["έλα"], ["ελάτε"]]; "—" means not used.
  const parsePair = text => text.split(",").map(s => s.trim()).map(s => (!s || s === "—" || s === "-" ? [] : [s]));

  // Which ending pattern the dictionary form follows. The sheet's class decides
  // between patterns that share an ending (πάω is a2, αγαπάω is b1).
  function detectPattern(greek, cls) {
    if (greek === "είμαι") return { pattern: "irregular" };
    let options;
    if (greek.endsWith("ιέμαι")) options = ["c3"];
    else if (greek.endsWith("ούμαι")) options = ["c4"];
    else if (greek.endsWith("άμαι")) options = ["c2"];
    else if (greek.endsWith("ομαι")) options = ["c1"];
    else if (greek.endsWith("άω")) options = ["b1", "a2"];
    else if (greek.endsWith("ώ")) options = ["b1", "b2"];
    else if (nuclei(greek).length < 2) options = ["b2"];
    // τρώω, ακούω, λέω — but not πιστεύω, where υ is a consonant sound.
    else if (isVowel(greek[greek.length - 2]) && !/[αε][υύ]ω$/.test(greek)) options = ["a2"];
    else options = ["a1"];
    if (options.includes(cls)) return { pattern: cls };
    const note = cls ? `The sheet says ${cls}, but ${greek} follows the ${options[0]} pattern, so that's what's shown.` : null;
    return { pattern: options[0], note };
  }

  // ---------- Conjugation ----------

  function conjugate(verb) {
    const greek = verb.greek.normalize("NFC");
    const cls = (verb.class || "").toLowerCase();
    const ov = parseOverrides(verb.overrides);
    const { pattern, note } = detectPattern(greek, cls);
    const notes = note ? [note] : [];
    const passive = /μαι$/.test(greek);

    if (pattern === "irregular") return irregular(verb, notes);

    const stem = pattern === "b1" ? greek.replace(/(άω|ώ)$/, "") : greek.slice(0, -STEM_CUT[pattern]);

    // Present and past continuous
    let presentEndings = PRESENT[pattern];
    if (pattern === "b1" && greek.endsWith("ώ")) {
      // List the form the sheet uses first: ξεχνώ / ξεχνάω.
      presentEndings = presentEndings.map(e => (Array.isArray(e) ? [...e].reverse() : e));
    }
    const present = table(presentEndings, e => join(stem, e));

    let pastCont;
    if (ov.past) {
      const full = String(ov.past).replace(/α$/, "");
      pastCont = table(PAST.a1, e => pastFromSheet(full, stem, e));
    } else if (pattern === "a1" || pattern === "a2") {
      const full = isVowel(stem[0]) ? stem : "ε" + stem;
      const aug = findAugment(full, stem);
      pastCont = table(PAST[pattern], e => past(full, aug, e));
    } else {
      pastCont = table(PAST[pattern], e => join(stem, e));
    }

    // Perfective stem: future simple and aorist
    const fut = (verb.future || "").normalize("NFC");
    const aor = (verb.aorist || "").normalize("NFC");
    let futureSimple = NONE6(), aorist = NONE6(), infinitive = null, fStem = null, fKind = null;

    if (fut) {
      if (fut.endsWith("άω")) { fKind = "a2"; fStem = fut.slice(0, -1); }
      // One-syllable futures (πω, δω, πιω) carry no accent but take the same endings as γραφτώ.
      else if (fut.endsWith("ώ") || (fut.endsWith("ω") && nuclei(fut).length < 2)) { fKind = "b2"; fStem = fut.slice(0, -1); }
      else if (fut.endsWith("ω")) { fKind = "a1"; fStem = fut.slice(0, -1); }
      else notes.push(`Future simple "${fut}" should end in -ω.`);
    }
    if (fStem !== null) {
      futureSimple = table(PRESENT[fKind], e => join(fStem, e));
      infinitive = join(fStem, fKind === "b2" ? "εί" : "ει");
    }
    if (aor) {
      if (strip(aor).endsWith("ηκα")) {
        // γράφτηκα, βρήκα: -ηκα is the ending learners know, so mark it as one.
        const full = aor.slice(0, -3);
        aorist = table(AORIST_HKA, e => pastFromSheet(full, fStem || "", e, aor));
      } else if (aor.endsWith("α")) {
        const full = aor.slice(0, -1);
        aorist = table(AORIST, e => pastFromSheet(full, fStem || "", e));
      } else {
        notes.push(`Aorist "${aor}" should end in -α.`);
      }
    }
    if (!fut && !aor && !ov["no perfective"]) {
      notes.push("No future simple or aorist in the sheet yet. Fill in those columns and rebuild.");
    }

    const perfectWith = aux => (infinitive ? table(aux, a => a).map(row => row.map(a => a + " " + infinitive)) : NONE6());

    // Imperative (εσύ, εσείς)
    let impCont;
    if (ov["imp-cont"]) impCont = parsePair(ov["imp-cont"]);
    else if (passive) impCont = NONE2();
    else if (pattern === "a1") impCont = [[mark(recessive(stem + "ε"), 1)], [join(stem, "ετε")]];
    else if (pattern === "a2") impCont = [[mark(recessive(stem + "γε"), 2)], [join(stem, "τε")]];
    else if (pattern === "b1") impCont = [[mark(placeAccent(stem + "α", 2), 1)], [join(stem, "άτε")]];
    else impCont = [[], [join(stem, "είτε")]];

    let impSimple;
    if (ov.imp) impSimple = parsePair(ov.imp);
    else if (fStem === null) impSimple = NONE2();
    else if (fKind === "a1") impSimple = [[mark(recessive(fStem + "ε"), 1)], [join(fStem, /[σψξλρ]$/.test(fStem) ? "τε" : "ετε")]];
    else if (fKind === "a2") impSimple = [[join(fStem, "ε")], [join(fStem, "τε")]];
    else if (!passive) impSimple = [[join(fStem, "ες")], [join(fStem, "είτε")]];
    else {
      const bare = strip(fStem);
      const rule = PASSIVE_IMP.find(([re]) => re.test(bare));
      const sg = rule ? [mark(placeAccent(bare.replace(rule[0], rule[1]) + "ου", 2), 2)] : [];
      impSimple = [sg, [join(fStem, "είτε")]];
    }

    return {
      greek, english: verb.english || "", pattern, voice: verb.voice || "", notes,
      future: fut, aorist: aor,
      indicative: {
        past: { continuous: pastCont, simple: aorist, perfect: perfectWith(HAD) },
        present: { continuous: present, perfect: perfectWith(HAVE) },
        future: { continuous: prefix("θα ", present), simple: prefix("θα ", futureSimple), perfect: prefix("θα ", perfectWith(HAVE)) },
      },
      subjunctive: { continuous: prefix("να ", present), simple: prefix("να ", futureSimple), perfect: prefix("να ", perfectWith(HAVE)) },
      imperative: { continuous: impCont, simple: impSimple },
    };
  }

  function irregular(verb, notes) {
    const whole = e => e;  // no stem/ending split for είμαι
    const present = table(EIMAI.present, whole);
    return {
      greek: verb.greek, english: verb.english || "", pattern: "irregular", voice: verb.voice || "", notes,
      future: "", aorist: "",
      indicative: {
        past: { continuous: table(EIMAI.past, whole), simple: NONE6(), perfect: NONE6() },
        present: { continuous: present, perfect: NONE6() },
        future: { continuous: prefix("θα ", present), simple: NONE6(), perfect: NONE6() },
      },
      subjunctive: { continuous: prefix("να ", present), simple: NONE6(), perfect: NONE6() },
      imperative: { continuous: NONE2(), simple: NONE2() },
    };
  }

  const api = { conjugate, PERSONS, strip, nuclei, placeAccent, recessive };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GreekVerbs = api;
})(this);
