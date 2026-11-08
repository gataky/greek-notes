// Greek ↔ English lookup over the lemma dictionary (lemma_greek_en.db, schema version 3),
// opened in the browser or Node with sql.js.
//
// The database stores search keys that only code can compute: `norm` (accents and case
// dropped), `phonetic` (how the word sounds, so σπήτι finds σπίτι) and normalized English
// terms. The key functions below are a port of the Python reference in the dictionary's
// guide (itself a port of lemma's Rust code); tests/test_dictionary.js checks them
// against every stored form. The database is a build artifact: never write to it, and
// remember words by their spelling, since row ids change between builds.

(function (root) {
  "use strict";

  // ---------- Greek keys ----------

  const ACCENTS = new Set(["̀", "́", "͂"]);  // grave, acute, perispomeni
  const DIAERESIS = "̈";
  const VOICELESS = new Set("θκξπστφχψ");
  const SINGLE = {
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "8", ι: "i", κ: "k", λ: "l", μ: "m",
    ν: "n", ξ: "ks", ο: "o", π: "p", ρ: "r", σ: "s", τ: "t", υ: "i", φ: "f", χ: "h", ψ: "ps", ω: "o",
  };
  const VOWEL_PAIRS = { ου: "u", ει: "i", οι: "i", υι: "i", αι: "e" };
  const CONSONANT_PAIRS = { μπ: "b", ντ: "d", γκ: "g", γγ: "g" };

  // Greeklish spelling -> readings, most common first (index = penalty).
  // The first entry that matches at a position wins.
  const GREEKLISH = [
    ["nth", ["n8"]], ["mph", ["mf"]],
    ["th", ["8"]], ["ch", ["h"]], ["ph", ["f"]],
    ["ou", ["u"]], ["ei", ["i"]], ["oi", ["i", "oi"]], ["ui", ["i"]], ["ai", ["e", "ai"]],
    ["au", ["af", "av"]], ["ay", ["af", "av"]], ["eu", ["ef", "ev"]], ["ey", ["ef", "ev"]],
    ["mp", ["b"]], ["nt", ["d"]], ["gk", ["g"]], ["gg", ["g"]],
    ["a", ["a"]], ["b", ["b", "v"]], ["c", ["k"]], ["d", ["d"]], ["e", ["e"]], ["f", ["f"]],
    ["g", ["g"]], ["h", ["i", "h"]], ["i", ["i"]], ["j", ["g"]], ["k", ["k"]], ["l", ["l"]],
    ["m", ["m"]], ["n", ["n"]], ["o", ["o"]], ["p", ["p"]], ["q", ["k"]], ["r", ["r"]],
    ["s", ["s"]], ["t", ["t"]], ["u", ["u", "i"]], ["v", ["v"]], ["w", ["o"]], ["x", ["h", "ks"]],
    ["y", ["i", "g"]], ["z", ["z"]], ["8", ["8"]], ["3", ["ks"]],
  ];
  const MAX_QUERY_KEYS = 64;

  const isMark = c => /\p{M}/u.test(c);
  // Lowercase one character at a time, so no final-sigma rule applies.
  const lower = s => [...s].map(c => c.toLowerCase()).join("");
  const collapse = s => [...s].filter((c, i, all) => c !== all[i - 1]).join("");

  function isGreek(s) {
    return [...s].some(c => {
      const cp = c.codePointAt(0);
      return (cp >= 0x370 && cp <= 0x3ff) || (cp >= 0x1f00 && cp <= 0x1fff);
    });
  }

  // Σπίτι -> σπιτι: lowercase, every diacritic dropped, ς folded to σ.
  function norm(s) {
    return lower([...s.normalize("NFD")].filter(c => !isMark(c)).join("")).replace(/ς/g, "σ");
  }

  // [base letter, has accent, has diaeresis] for each letter.
  function letters(s) {
    const out = [];
    for (const c of s.normalize("NFD")) {
      if (ACCENTS.has(c)) { if (out.length) out[out.length - 1][1] = true; }
      else if (c === DIAERESIS) { if (out.length) out[out.length - 1][2] = true; }
      else if (isMark(c)) continue;
      else for (const lc of c.toLowerCase()) out.push([lc === "ς" ? "σ" : lc, false, false]);
    }
    return out;
  }

  // Sound-based key: σπίτι and σπήτι -> spiti, θάλασσα -> 8alasa.
  function phonetic(s) {
    const ls = letters(s);
    let out = "";
    for (let i = 0; i < ls.length;) {
      const [a, aAccent] = ls[i];
      if (i + 1 < ls.length) {
        const [b, , bDiaeresis] = ls[i + 1];
        // An accent on the first vowel (τσάι) or a diaeresis on the second (κοροϊδεύω)
        // means two separate vowels, not a digraph.
        if (!aAccent && !bDiaeresis) {
          if (VOWEL_PAIRS[a + b]) { out += VOWEL_PAIRS[a + b]; i += 2; continue; }
          if ((a === "α" || a === "ε") && b === "υ") {
            const after = i + 2 < ls.length ? ls[i + 2][0] : null;
            out += (a === "α" ? "a" : "e") + (after === null || VOICELESS.has(after) ? "f" : "v");
            i += 2;
            continue;
          }
        }
        if (CONSONANT_PAIRS[a + b]) { out += CONSONANT_PAIRS[a + b]; i += 2; continue; }
      }
      out += SINGLE[a] || "";
      i += 1;
    }
    return collapse(out);
  }

  function greeklishKeys(s) {
    const latin = lower([...s.normalize("NFD")].filter(c => !isMark(c)).join(""));
    let candidates = [["", 0]];
    for (let i = 0; i < latin.length;) {
      const match = GREEKLISH.find(([spelling]) => latin.startsWith(spelling, i));
      if (!match) { i += 1; continue; }  // not Greeklish: spaces, punctuation
      const [spelling, readings] = match;
      i += spelling.length;
      candidates = candidates
        .flatMap(([c, p]) => readings.map((r, rank) => [c + r, p + rank]))
        .sort((x, y) => x[1] - y[1])  // stable
        .slice(0, MAX_QUERY_KEYS);
    }
    const keys = new Map();
    for (const [c, p] of candidates) {
      const k = collapse(c);
      if (k && !keys.has(k)) keys.set(k, p);
    }
    return [...keys];
  }

  // [[phonetic key, penalty]] for a Greek or Greeklish query, lowest penalty first.
  function queryKeys(s) {
    if (isGreek(s)) {
      const k = phonetic(s);
      return k ? [[k, 0]] : [];
    }
    return greeklishKeys(s);
  }

  // ---------- English keys ----------

  const IRREGULAR_PLURALS = {
    children: "child", people: "person", men: "man", women: "woman", feet: "foot", teeth: "tooth",
    mice: "mouse", geese: "goose", knives: "knife", wives: "wife", lives: "life", leaves: "leaf",
  };

  function stem(w) {
    if (Object.hasOwn(IRREGULAR_PLURALS, w)) return IRREGULAR_PLURALS[w];
    if ([...w].length <= 3 || !/^[\x00-\x7f]*$/.test(w)) return w;
    if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
    if (w.endsWith("sses")) return w.slice(0, -2);
    if (/(ss|us|is)$/.test(w)) return w;
    if (/(shes|ches|xes|zes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith("s")) return w.slice(0, -1);
    return w;
  }

  const trim = w => w.replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "");

  // English lookup term: "To Say" -> "say", "Houses" -> "house".
  function normalizeTerm(s) {
    let words = s.toLowerCase().split(/\s+/).map(trim).filter(Boolean);
    if (words.length > 1 && ["to", "a", "an", "the"].includes(words[0])) words = words.slice(1);
    if (!words.some(w => /\p{L}/u.test(w))) return "";
    return words.map(stem).join(" ");
  }

  // ---------- Search ----------

  const EXACT = 0, NORM = 1, PHONETIC = 2;

  const SELECT_FORMS = `SELECT f.headword_id, f.form, h.word, h.frequency, f.phonetic
    FROM form f JOIN headword h ON h.id = f.headword_id`;
  const PREFER_HEADWORD = " ORDER BY f.form = h.word DESC";
  // One meaning to show next to a headword in a list, skipping "plural of …" when possible.
  const FIRST_GLOSS = `SELECT s.gloss FROM entry e JOIN sense s ON s.entry_id = e.id
    WHERE e.headword_id = ? ORDER BY s.is_reference, e.ord, s.ord LIMIT 1`;

  const SELECT_EN = `SELECT e.greek, e.headword_id, e.score,
      COALESCE(s.gloss, (SELECT s2.gloss FROM entry e2 JOIN sense s2 ON s2.entry_id = e2.id
        WHERE e2.headword_id = e.headword_id ORDER BY s2.is_reference, e2.ord, s2.ord LIMIT 1)),
      e.note
    FROM en_index e
    LEFT JOIN headword h ON h.id = e.headword_id
    LEFT JOIN sense s ON s.id = e.sense_id
    WHERE e.term = ?
    ORDER BY e.score DESC, COALESCE(h.frequency, 0) DESC, e.greek
    LIMIT ?`;

  // ---------- Principal parts (helpers) ----------

  // The conjugation engine, for guessing a verb's principal parts.
  const Verbs = typeof module !== "undefined" && module.exports ? require("./greek-verbs.js") : root.GreekVerbs;

  const MIN_SCORE = 0.6;  // share of the generated perfective forms the dictionary must list
  const PASSIVE_FUTURE = /[θτ]ώ$/, PASSIVE_AORIST = /[θτφχ]ηκα$/;
  // Suffixes that only make present stems (καπνίζω, μαθαίνω, τελειώνω, ψάχνω, βρίσκω).
  const PRESENT_ONLY = /(ζω|αίνω|ώνω|χνω|σκω)$/;

  // "να γράψ|ουν(ε)" -> ["γράψουν", "γράψουνε"]
  function plainForms(cells) {
    return cells.flat(2).flatMap(f => {
      f = f.replace("|", "").replace(/^(θα|να) /, "");
      const m = f.match(/^(.*)\((\p{L}+)\)(.*)$/u);
      return m ? [m[1] + m[3], m[1] + m[2] + m[3]] : [f];
    });
  }
  function continuousForms(greek) {
    try {
      const I = Verbs.conjugate({ greek }).indicative;
      return plainForms([I.present.continuous, I.past.continuous]);
    } catch { return []; }
  }
  function perfectiveForms(greek, future, aorist) {
    try {
      const c = Verbs.conjugate({ greek, future, aorist });
      return plainForms([c.indicative.past.simple, c.subjunctive.simple, c.imperative.simple]);
    } catch { return []; }
  }

  // Consonants only, so augments and accents don't matter: έγραψα and γράψω -> γρψ.
  const skeleton = w => norm(w).replace(/[αεηιουω]/g, "");
  // The aorist and the future share the perfective stem: κάπνισα/καπνίσω, not κάπνιζα (imperfect).
  const sameStem = (future, aorist) => skeleton(norm(aorist).replace(/ηκα$|α$/, "")) === skeleton(future.replace(/[ωώ]$/, ""));
  const commonPrefix = (a, b) => {
    a = norm(a); b = norm(b);
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i;
  };
  // Active forms of a passive: δίνομαι -> δίνω, αγαπιέμαι -> αγαπώ/αγαπάω, θεωρούμαι -> θεωρώ.
  const activeTwins = w => w.endsWith("ιέμαι") ? [w.slice(0, -5) + "ώ", w.slice(0, -5) + "άω"]
    : w.endsWith("ούμαι") ? [w.slice(0, -5) + "ώ"]
    : w.endsWith("ομαι") ? [w.slice(0, -4) + "ω"] : [];

  const escapeLike = w => w.replace(/[\\%_]/g, "\\$&");
  const escapeRegExp = w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // sql.js database -> lookup functions. Rows come back as arrays, in column order.
  function open(db) {
    const rows = (sql, params = []) => {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const out = [];
        while (stmt.step()) out.push(stmt.get());
        return out;
      } finally {
        stmt.free();
      }
    };
    const value = (sql, params) => rows(sql, params)[0]?.[0] ?? null;

    const version = value("SELECT value FROM meta WHERE key = 'schema_version'");
    if (version !== "3") throw new Error(`expected dictionary schema_version 3, got ${version}`);
    const meta = Object.fromEntries(rows("SELECT key, value FROM meta"));

    // Greek or Greeklish query -> hits, best first:
    // { headwordId, word, matchedForm, kind (EXACT/NORM/PHONETIC), penalty, frequency, gloss }
    function searchGreek(query, limit = 10) {
      query = query.trim();
      const best = new Map();
      const keep = (row, kind, penalty) => {
        const [headwordId, matchedForm, word, frequency] = row;
        const cur = best.get(headwordId);
        if (!cur || kind < cur.kind || (kind === cur.kind && penalty < cur.penalty)) {
          best.set(headwordId, { headwordId, word, matchedForm, frequency, kind, penalty });
        }
      };

      if (isGreek(query)) {
        for (const row of rows(SELECT_FORMS + " WHERE f.norm = ?" + PREFER_HEADWORD, [norm(query)])) {
          keep(row, row[1] === query ? EXACT : NORM, 0);
        }
      }
      const keys = new Map(queryKeys(query));
      if (keys.size) {
        const marks = [...keys].map(() => "?").join(", ");
        for (const row of rows(SELECT_FORMS + ` WHERE f.phonetic IN (${marks})` + PREFER_HEADWORD, [...keys.keys()])) {
          keep(row, PHONETIC, keys.get(row[4]));
        }
      }

      const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
      return [...best.values()]
        .sort((a, b) => a.kind - b.kind || a.penalty - b.penalty || b.frequency - a.frequency || cmp(a.word, b.word))
        .slice(0, limit)
        .map(hit => ({ ...hit, gloss: value(FIRST_GLOSS, [hit.headwordId]) }));
    }

    // Words that start with what's typed so far, for filtering as you type (searchGreek only
    // finds whole words). Hits are shaped like searchGreek's, with kind NORM when the spelling
    // matched and PHONETIC when only the sound did. Order: words whose own spelling starts
    // that way, most common first; then words with only a form that does (frequency is the
    // headword's, so ranking forms by it would put odd forms of common words on top:
    // kal -> κάνω ← καλοκαμωμένα); then headwords never seen in the corpus, mostly
    // phrases and proverbs, with phrases last.
    function complete(query, limit = 10) {
      query = query.trim();
      // One letter matches a huge share of the forms: slow, and it narrows nothing.
      if ([...query].length < 2) return [];
      const MAX_CHAR = "\u{10ffff}";
      // Of a word's matching forms, show its own spelling if that matches, otherwise any form
      // (SQLite takes the bare f.form from the row that won MAX).
      const select = (where, params) => rows(`SELECT f.headword_id, f.form, h.word, h.frequency,
          MAX(f.form = h.word) AS own FROM form f JOIN headword h ON h.id = f.headword_id
        WHERE ${where}
        GROUP BY f.headword_id
        ORDER BY CASE WHEN own AND h.frequency > 0 THEN 0 WHEN NOT own THEN 1 ELSE 2 END,
          instr(h.word, ' ') > 0, h.frequency DESC
        LIMIT ?`, [...params, limit]);
      const range = (column, keys) => ({
        where: keys.map(() => `(f.${column} >= ? AND f.${column} < ?)`).join(" OR "),
        params: keys.flatMap(k => [k, k + MAX_CHAR]),
      });

      const hits = [];
      const add = (found, kind) => {
        for (const [headwordId, matchedForm, word, frequency] of found) {
          if (!hits.some(h => h.headwordId === headwordId)) hits.push({ headwordId, word, matchedForm, frequency, kind, penalty: 0 });
        }
      };
      if (isGreek(query)) {
        const byNorm = range("norm", [norm(query)]);
        add(select(byNorm.where, byNorm.params), NORM);
      }
      // Sound keys: the query's own for Greek, the likeliest Greeklish readings for Latin.
      // Greek gets sound matches only when the spelling has few, as with a misspelling (σπη).
      const keys = queryKeys(query).filter(([, p]) => p <= 1).slice(0, 4).map(([k]) => k);
      if (keys.length && hits.length < limit) {
        const bySound = range("phonetic", keys);
        add(select(bySound.where, bySound.params), PHONETIC);
      }
      return hits.map(hit => ({ ...hit, gloss: value(FIRST_GLOSS, [hit.headwordId]) }));
    }

    // English query -> hits, best first:
    // { greek, headwordId (null when the Greek has no entry), score, gloss, note, fullText }
    function searchEnglish(query, limit = 10) {
      const term = normalizeTerm(query);
      if (!term) return [];
      const hits = rows(SELECT_EN, [term, limit]).map(([greek, headwordId, score, gloss, note]) =>
        ({ greek, headwordId, score, gloss, note, fullText: false }));
      return hits.length ? hits : searchGlosses(term, limit);
    }

    // Fallback for terms the English index doesn't have: glosses containing every word.
    // (The guide uses the FTS5 table for this, but sql.js is built without FTS5.)
    // LIKE narrows the rows; the regexp then keeps whole words, so "salt" skips "basalt".
    function searchGlosses(term, limit) {
      const words = term.split(" ");
      const like = words.map(() => "s.gloss LIKE ? ESCAPE '\\'").join(" AND ");
      const wordRes = words.map(w => new RegExp(`(^|[^\\p{L}])${escapeRegExp(w)}`, "iu"));
      const phrase = new RegExp(`(^|[^\\p{L}])${escapeRegExp(term)}`, "iu");
      const found = rows(`SELECT h.word, h.id, s.gloss, h.frequency FROM sense s
          JOIN entry en ON en.id = s.entry_id JOIN headword h ON h.id = en.headword_id
          WHERE s.is_reference = 0 AND ${like}`, words.map(w => `%${escapeLike(w)}%`))
        .filter(([, , gloss]) => wordRes.every(re => re.test(gloss)))
        // The whole phrase first, then common words, then short glosses.
        .map(([greek, headwordId, gloss, frequency]) => ({ greek, headwordId, gloss, frequency, phrase: phrase.test(gloss) }))
        .sort((a, b) => b.phrase - a.phrase || b.frequency - a.frequency || a.gloss.length - b.gloss.length);
      const seen = new Set(), hits = [];
      for (const { greek, headwordId, gloss } of found) {
        if (seen.has(headwordId)) continue;
        seen.add(headwordId);
        hits.push({ greek, headwordId, score: 0, gloss, note: null, fullText: true });
        if (hits.length >= limit) break;
      }
      return hits;
    }

    // The form table's key finds a headword by spelling; headword.word has no index.
    const HEADWORD = `SELECT h.id, h.word, h.frequency FROM form f JOIN headword h ON h.id = f.headword_id
      WHERE f.norm = ? AND h.word = ?`;
    const has = word => rows(HEADWORD, [norm(word), word]).length > 0;

    // A headword by its exact spelling -> { word, frequency, entries: [{ pos, head, etymology,
    // senses: [{ gloss, example, translation, isReference }] }], forms }, or null.
    function lookup(word) {
      const found = rows(HEADWORD, [norm(word), word])[0];
      if (!found) return null;
      const [id, , frequency] = found;
      const entries = rows("SELECT id, pos_display, head, etymology FROM entry WHERE headword_id = ? ORDER BY ord", [id])
        .map(([entryId, pos, head, etymology]) => ({
          pos, head, etymology,
          senses: rows("SELECT gloss, example, example_translation, is_reference FROM sense WHERE entry_id = ? ORDER BY ord", [entryId])
            .map(([gloss, example, translation, ref]) => ({ gloss, example, translation, isReference: !!ref })),
        }));
      const forms = rows("SELECT form FROM form WHERE headword_id = ?", [id]).map(r => r[0])
        .filter(f => f !== word)
        .sort((a, b) => norm(a).localeCompare(norm(b), "el") || a.localeCompare(b, "el"));
      return { word, frequency, entries, forms };
    }

    // ---------- Principal parts ----------

    const formsOf = word => {
      const found = rows(HEADWORD, [norm(word), word])[0];
      return found ? rows("SELECT form FROM form WHERE headword_id = ?", [found[0]]).map(r => r[0]) : [];
    };

    // A verb's future simple and aorist (1sg), worked out from the dictionary's forms so a
    // verb that isn't in the word list can still get a conjugation table:
    // καπνίζω -> { future: "καπνίσω", aorist: "κάπνισα" }, or null when the forms don't
    // settle it. The forms carry no labels, so each plausible pair goes through the
    // conjugation engine, and the pair whose forms the dictionary also lists wins.
    // On the hand-entered verbs in verbs.json this agrees with the sheet about 5 times in 6;
    // most misses return null, and most of the rest are real variants (κάτσω for καθίσω).
    function principalParts(word) {
      if (!Verbs) return null;
      // αγαπάω and αγαπώ are separate headwords; pool their forms.
      const twin = word.endsWith("άω") ? word.slice(0, -2) + "ώ" : word.endsWith("ώ") ? word.slice(0, -1) + "άω" : null;
      const own = [...formsOf(word), ...(twin ? formsOf(twin) : [])];
      const found = own.length ? bestParts(word, own, false) : null;
      if (found) return found;
      // A passive's perfective forms are often listed under the active verb (δόθηκα under δίνω).
      const borrowed = activeTwins(word).flatMap(formsOf);
      return borrowed.length ? bestParts(word, [...own, ...borrowed], true) : null;
    }

    function bestParts(word, forms, passiveOnly) {
      // Skip capitalised entries and unaccented spellings (καπνιστω), which the data also has.
      forms = forms.filter(f => !/\p{Lu}/u.test(f) && (/[άέήίόύώΐΰ]/.test(f) || Verbs.nuclei(f).length < 2));
      const listed = new Set(forms);
      const active = !/μαι$/.test(word);
      // The verb's own present and imperfect are not its future or aorist (κάπνιζα, αγαπούσα).
      const own = new Set(continuousForms(word));
      const futures = forms.filter(f => /[ωώ]$/.test(f) && !own.has(f) && !PRESENT_ONLY.test(f) && !has(f)
        && !(active && PASSIVE_FUTURE.test(f)) && !(passiveOnly && !f.endsWith("ώ")));
      const aorists = forms.filter(f => f.endsWith("α") && !own.has(f) && !f.endsWith("ούσα")
        && !(active && PASSIVE_AORIST.test(f)) && !(passiveOnly && !f.endsWith("ηκα")));

      const scored = [];
      for (const future of futures) {
        for (const aorist of aorists) {
          if (!sameStem(future, aorist)) continue;
          const generated = [...new Set(perfectiveForms(word, future, aorist))];
          if (!generated.length) continue;
          const score = generated.filter(f => listed.has(f)).length / generated.length;
          scored.push({
            future, aorist, score,
            near: commonPrefix(future, word),
            gap: Math.abs([...future].length - [...word].length),
            aoristNear: commonPrefix(aorist.replace(/^[εέηή]/, ""), future),
          });
        }
      }
      const top = Math.max(0, ...scored.map(c => c.score));
      if (top < MIN_SCORE) return null;
      // Variant spellings make the scores jumpy, so among the near-best take the spelling
      // closest to the dictionary form: γεμίσω over γιομίζω, ακολούθησα over ακλούθησα.
      const best = scored.filter(c => c.score >= top - 0.1)
        .sort((a, b) => b.near - a.near || a.gap - b.gap || b.score - a.score || b.aoristNear - a.aoristNear)[0];
      return { future: best.future, aorist: best.aorist };
    }

    return { meta, searchGreek, complete, searchEnglish, has, lookup, principalParts, rows };
  }

  const api = { norm, phonetic, queryKeys, isGreek, normalizeTerm, stem, open, EXACT, NORM, PHONETIC };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GreekDictionary = api;
})(this);
