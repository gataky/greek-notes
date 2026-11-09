// Greek ↔ English lookup over the lemma dictionary (lemma_greek_en.db, schema version 4),
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

  const SELECT_FORMS = `SELECT f.headword_id, f.form, h.word, h.frequency, f.phonetic, f.is_primary
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

  // ---------- Noun declensions ----------

  const CASES = ["nominative", "accusative", "genitive", "vocative"];  // display order: genitive after accusative
  const NUMBERS = ["singular", "plural"];
  const GENDERS = ["masculine", "feminine", "neuter"];
  const GENDER_CODES = { M: "masculine", F: "feminine", N: "neuter" };
  // The definite article by gender, case and number. The vocative takes none.
  const ARTICLES = {
    masculine: { nominative: ["ο", "οι"], genitive: ["του", "των"], accusative: ["τον", "τους"] },
    feminine: { nominative: ["η", "οι"], genitive: ["της", "των"], accusative: ["την", "τις"] },
    neuter: { nominative: ["το", "τα"], genitive: ["του", "των"], accusative: ["το", "τα"] },
  };
  const article = (gender, grammaticalCase, number) => ARTICLES[gender]?.[grammaticalCase]?.[NUMBERS.indexOf(number)] || "";
  const ARTICLE_WORDS = new Set(["ο", "η", "το", "οι", "τα", "του", "της", "των", "τον", "την", "τη", "τις", "τους"]);
  const USAGE = ["rare", "archaic", "dated"];
  const GREEK_WORD = /^[Ͱ-Ͽἀ-῿]+(-[Ͱ-Ͽἀ-῿]+)*$/;  // αρπα-κόλλα

  // One cell's text -> its forms, or "-" when the form doesn't exist. Hand-made tables can hold
  // several forms, an article or a romanization: "(βάβες (váves))", "η  βάτος (vátos)".
  function nounForms(text) {
    const out = [];
    for (let part of text.normalize("NFC").split(/\s*[,/]\s*|\s+[-‑–]\s+/)) {
      part = part.replace(/\([^()]*[A-Za-z][^()]*\)/g, "").replace(/[()[\]{}¹²³⁴⁵*†]/g, "").trim();
      if (/^[-‑–—]$/.test(part)) { out.push("-"); continue; }
      const words = part.split(/\s+/).filter(w => w && !ARTICLE_WORDS.has(w));
      if (words.length && words.every(w => GREEK_WORD.test(w))) out.push(words.join(" "));
    }
    return out;
  }

  // Every form in a cells object (cases by numbers, or genders by cases by numbers), and the same
  // object with fn applied to each form. null cells stay null.
  const allForms = o => (Array.isArray(o) ? o : o ? Object.values(o).flatMap(allForms) : []);
  const mapForms = (o, fn) => (Array.isArray(o) ? o.map(fn) : o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, mapForms(v, fn)])) : o);

  // Puts "|" between stem and ending so endings can be highlighted like the verb grid's:
  // άνθρωπ|ος, ανθρώπ|ου, σπίτ|ι, σπιτ|ιού. The template names the nominative singular's ending
  // (el-nN-ι-ια-2b), which gives the stem; without one, the letters every form shares are the
  // stem. Accents don't count, and a form that doesn't start with the stem stays whole.
  function markEndings(cells, template, nominative) {
    const bare = f => Verbs.strip(f.toLowerCase());
    const all = allForms(cells).filter(f => f && !f.includes(" "));
    if (all.length < 2) return cells;
    let stem = "";
    const ending = /^el-n[MFN]-([^-]+)-/.exec(template || "");
    if (ending && nominative && bare(nominative).endsWith(bare(ending[1]))) {
      stem = bare(nominative).slice(0, -ending[1].length);
    } else {
      const forms = all.map(bare);
      let n = 0;
      while (n < forms[0].length && forms.every(f => f[n] === forms[0][n])) n++;
      stem = forms[0].slice(0, n);
    }
    if (!stem) return cells;
    const mark = f => (f.includes(" ") || f.length <= stem.length || !bare(f).startsWith(stem) ? f : f.slice(0, stem.length) + "|" + f.slice(stem.length));
    return mapForms(cells, mark);
  }

  // The cell for one set of labels: its forms, most usual first, [] when the table says the form
  // doesn't exist (a dash) and null when it has no rows there. Rare, archaic and dated rows only
  // count when the cell has nothing else.
  function cellOf(cellRows, ...wanted) {
    const matching = cellRows.filter(r => wanted.every(t => r.tags.has(t)));
    const usual = matching.filter(r => !USAGE.some(u => r.tags.has(u)));
    const forms = [...new Set((usual.length ? usual : matching).flatMap(r => nounForms(r.form)))];
    const real = forms.filter(f => f !== "-");
    return real.length ? real : forms.length ? [] : null;
  }

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
    if (version !== "4") throw new Error(`expected dictionary schema_version 4, got ${version}`);
    const meta = Object.fromEntries(rows("SELECT key, value FROM meta"));

    // Greek or Greeklish query -> hits, best first:
    // { headwordId, word, matchedForm, kind (EXACT/NORM/PHONETIC), penalty, isPrimary, frequency, gloss }
    // A spelling several headwords share ranks its main owner first (is_primary): πήγα finds
    // πηγαίνω before πάω, though πάω is more frequent.
    function searchGreek(query, limit = 10) {
      query = query.trim();
      const best = new Map();
      const rank = h => [h.kind, h.penalty, h.isPrimary ? 0 : 1];
      const before = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
      const keep = (row, kind, penalty) => {
        const [headwordId, matchedForm, word, frequency, , isPrimary] = row;
        const hit = { headwordId, word, matchedForm, frequency, kind, penalty, isPrimary: !!isPrimary };
        const cur = best.get(headwordId);
        if (!cur || before(hit, cur)) best.set(headwordId, hit);
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
        .sort((a, b) => a.kind - b.kind || a.penalty - b.penalty || b.isPrimary - a.isPrimary || b.frequency - a.frequency || cmp(a.word, b.word))
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
      // Of a word's matching forms, show its own spelling if that matches, else a spelling it
      // is the main owner of (is_primary), else any (SQLite takes the bare f.form from the row
      // that won the single MAX, so both go into it: 3 own, 1 main owner, 0 shared).
      // Words matched only by a form rank main owners first: λεπτά -> λεπτός before λεπτό.
      const select = (where, params) => rows(`SELECT f.headword_id, f.form, h.word, h.frequency,
          MAX((f.form = h.word) * 2 + f.is_primary) AS fit FROM form f JOIN headword h ON h.id = f.headword_id
        WHERE ${where}
        GROUP BY f.headword_id
        ORDER BY CASE WHEN fit >= 2 AND h.frequency > 0 THEN 0 WHEN fit < 2 THEN 1 ELSE 2 END,
          instr(h.word, ' ') > 0, fit DESC, h.frequency DESC
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

    // A headword's forms, or only those it is the main owner of (a spelling several headwords
    // share is primary for one: απάγω lists all of κλέβω's forms, but none as primary).
    const formsOf = (word, primaryOnly = false) => {
      const found = rows(HEADWORD, [norm(word), word])[0];
      return found ? rows("SELECT form FROM form WHERE headword_id = ?" + (primaryOnly ? " AND is_primary = 1" : ""), [found[0]]).map(r => r[0]) : [];
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
      // Every form counts as evidence, but the future and aorist must be spellings the verb
      // is the main owner of, so another verb's forms listed under it can't win.
      const pool = words => {
        const forms = words.flatMap(w => formsOf(w)), main = words.flatMap(w => formsOf(w, true));
        return { forms, main };
      };
      const own = pool(twin ? [word, twin] : [word]);
      const found = own.forms.length ? bestParts(word, own.forms, own.main, false) : null;
      if (found) return found;
      // A passive's perfective forms are often listed under the active verb (δόθηκα under δίνω).
      const borrowed = pool(activeTwins(word));
      return borrowed.forms.length ? bestParts(word, [...own.forms, ...borrowed.forms], [...own.main, ...borrowed.main], true) : null;
    }

    function bestParts(word, forms, mainForms, passiveOnly) {
      // Skip capitalised entries and unaccented spellings (καπνιστω), which the data also has.
      forms = forms.filter(f => !/\p{Lu}/u.test(f) && (/[άέήίόύώΐΰ]/.test(f) || Verbs.nuclei(f).length < 2));
      const listed = new Set(forms), main = new Set(mainForms);
      const active = !/μαι$/.test(word);
      // The verb's own present and imperfect are not its future or aorist (κάπνιζα, αγαπούσα).
      const own = new Set(continuousForms(word));
      const futures = forms.filter(f => main.has(f) && /[ωώ]$/.test(f) && !own.has(f) && !PRESENT_ONLY.test(f) && !has(f)
        && !(active && PASSIVE_FUTURE.test(f)) && !(passiveOnly && !f.endsWith("ώ")));
      const aorists = forms.filter(f => main.has(f) && f.endsWith("α") && !own.has(f) && !f.endsWith("ούσα")
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

    // A noun's declension tables, from its own entries:
    //   [{ gender, cells: { nominative: { singular: ["δρόμ|ος"], plural: ["δρόμ|οι"] }, ... } }]
    // A cell is a list of alternatives, most usual first, [] when the form doesn't exist and null
    // when the table doesn't say. gender ("masculine", "feminine", "neuter") comes from the
    // table's template (el-nM-ος-οι-2a), else the entry's headword line, else it's null.
    // Tables declined like adjectives, by gender, are left out.
    function declensions(word) {
      const found = rows(`SELECT t.id, t.template, e.head, i.form, g.tags
        FROM headword h JOIN entry e ON e.headword_id = h.id
        JOIN inflection_table t ON t.entry_id = e.id
        JOIN inflection i ON i.table_id = t.id JOIN inflection_tags g ON g.id = i.tags_id
        WHERE h.word = ? AND e.pos = 'noun' AND t.kind = 'declension' AND t.word IS NULL
        ORDER BY e.ord, t.ord, i.ord`, [word]);
      const tables = new Map();
      for (const [id, template, head, form, tags] of found) {
        if (!tables.has(id)) tables.set(id, { template, head, rows: [] });
        tables.get(id).rows.push({ form, tags: new Set(tags.split(" ")) });
      }
      const out = [];
      for (const { template, head, rows: cellRows } of tables.values()) {
        if (cellRows.some(r => Object.values(GENDER_CODES).some(g => r.tags.has(g)))) continue;
        const code = /^el-n([MFN])-/.exec(template || "");
        const fromHead = /^(masculine|feminine|neuter)\b(?! or)/.exec(head || "");
        const gender = code ? GENDER_CODES[code[1]] : fromHead ? fromHead[1] : null;
        const cells = Object.fromEntries(CASES.map(c => [c, Object.fromEntries(NUMBERS.map(n => [n, cellOf(cellRows, c, n)]))]));
        if (CASES.some(c => NUMBERS.some(n => cells[c][n] !== null))) {
          out.push({ gender, cells: markEndings(cells, template, cells.nominative.singular && cells.nominative.singular[0]) });
        }
      }
      return out;
    }

    // An adjective's or participle's declension, one per entry:
    //   [{ pos: "adj" or "participle", cells: { masculine: { nominative: { singular: ["καλ|ός"], plural: ["καλ|οί"] }, ... }, feminine: ..., neuter: ... } }]
    // Cells are as in declensions(). Only the positive degree: comparative and superlative rows
    // are skipped, whether they have tables of their own (ωραίος) or share the positive one
    // (ελαφρύς). The endings are split at the letters every gender's forms share.
    // A few entries have two positive tables for one word: βαρύς declines as βαριά or, formally,
    // βαρεία, and θαυματουργός's feminine can be θαυματουργή or θαυματουργός. They're merged into
    // one, each cell listing the forms of the table whose feminine the headword line gives first,
    // then the other's.
    function adjectiveDeclensions(word) {
      const found = rows(`SELECT e.id, t.id, t.kind, e.pos_display, i.form, g.tags
        FROM headword h JOIN entry e ON e.headword_id = h.id
        JOIN inflection_table t ON t.entry_id = e.id
        JOIN inflection i ON i.table_id = t.id JOIN inflection_tags g ON g.id = i.tags_id
        WHERE h.word = ? AND (e.pos = 'adj' OR e.pos_display = 'participle') AND t.kind IN ('declension', 'head') AND t.word IS NULL
        ORDER BY e.ord, t.ord, i.ord`, [word]);
      const entries = new Map();
      for (const [entryId, tableId, kind, pos, form, tags] of found) {
        if (!entries.has(entryId)) entries.set(entryId, { pos, feminines: [], tables: new Map() });
        const entry = entries.get(entryId);
        const set = new Set(tags.split(" "));
        if (kind === "head") {
          if (set.has("feminine")) entry.feminines.push(form);
          continue;
        }
        if (set.has("comparative") || set.has("superlative")) continue;
        if (!entry.tables.has(tableId)) entry.tables.set(tableId, []);
        entry.tables.get(tableId).push({ form, tags: set });
      }
      const out = [];
      for (const { pos, feminines, tables } of entries.values()) {
        const rank = tableRows => {
          const feminine = tableRows.find(r => ["feminine", "nominative", "singular"].every(t => r.tags.has(t)));
          const i = feminine ? feminines.indexOf(feminine.form) : -1;
          return i < 0 ? Infinity : i;
        };
        const cellRows = [...tables.values()].sort((a, b) => rank(a) - rank(b) || 0).flat();
        const cells = Object.fromEntries(GENDERS.map(g => [g, Object.fromEntries(CASES.map(c =>
          [c, Object.fromEntries(NUMBERS.map(n => [n, cellOf(cellRows, g, c, n)]))]))]));
        if (!allForms(cells).length) continue;
        out.push({ pos, cells: markEndings(cells, null, cells.masculine.nominative.singular && cells.masculine.nominative.singular[0]) });
      }
      return out;
    }

    return { meta, searchGreek, complete, searchEnglish, has, lookup, principalParts, declensions, adjectiveDeclensions, rows };
  }

  const api = { norm, phonetic, queryKeys, isGreek, normalizeTerm, stem, open, article, nounForms, CASES, NUMBERS, GENDERS, EXACT, NORM, PHONETIC };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GreekDictionary = api;
})(this);
