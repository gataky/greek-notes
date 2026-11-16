// Data for the aspect map (docs/apps/aspect-map.html, in the labs app): writes
// docs/data/aspect-map.json, the endings and outcomes first, then one verb per line.
//
//   node scripts/build_aspect_map.js          (make aspect-map; make sync and make verb-forms run it)
//   node scripts/build_aspect_map.js --print  also print the counts behind the flows
//
// Every active verb in verb-forms.json goes through verbToShow() and aspect-fork.js's analyse(),
// as on the aspect forks page, so the groups and markup are the site's. Each verb gets three
// labels, the columns of the flow chart: the ending of its present, its group, and what its
// perfective stem does. Spellings of one verb (αγαπώ, αγαπάω) share a table and are counted
// once, under the word list's spelling if it has one, with their frequencies added up.
// Frequencies and glosses come from the dictionary (docs/data/lemma_greek_en.db.gz).

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const VF = require(path.join(ROOT, "docs/javascripts/verb-forms.js"));
const AF = require(path.join(ROOT, "docs/javascripts/aspect-fork.js"));
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data", file), "utf8"));
const sheet = read("verbs.json");
const forms = read("verb-forms.json");

const flat = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ς/g, "σ");
const unmark = s => s.replace(/[\[\]{}()<>]/g, "");

// The present's ending, from its 1st singular. Contracted verbs are one ending: -ώ hides
// whether a verb is b1 (αγαπώ, αγαπάς) or b2 (μπορώ, μπορείς), which the group then shows.
const ENDINGS = [
  { id: "contracted", label: "-ώ / -άω" },
  { id: "zeta", label: "-ζω" },
  { id: "nu", label: "-νω" },
  { id: "eu", label: "-εύω / -αύω" },
  { id: "labial", label: "-πω -βω -φω -πτω -φτω" },
  { id: "velar", label: "-κω -γω -χω -χνω -σσω" },
  { id: "dental", label: "-τω -δω -θω" },
  { id: "liquid", label: "-ρω -λω -μω" },
  { id: "vowel", label: "vowel + ω" },
  { id: "other", label: "other" },
];

function ending(r) {
  if (["b1-eta", "b1-other", "b2"].includes(r.group) || /[ώ]$/.test(r.present)) return "contracted";
  const stem = flat(unmark(r.present)).replace(/ω$/, "");
  const last = stem.slice(-1), two = stem.slice(-2);
  if (["χν", "σσ", "ττ"].includes(two)) return "velar";
  if (["πτ", "φτ"].includes(two)) return "labial";
  if (/[εα]υ$/.test(stem)) return "eu";
  if (last === "ζ") return "zeta";
  if (last === "ν") return "nu";
  if ("πβφ".includes(last)) return "labial";
  if ("κγχ".includes(last)) return "velar";
  if ("τδθ".includes(last)) return "dental";
  if ("ρλμ".includes(last)) return "liquid";
  if ("αεηιουω".includes(last)) return "vowel";
  return "other";
}

// What the perfective does, from the letters aspect-fork.js marks as changed in its stem
// ({ψ} in γρα{ψ}-), or from the group when nothing is added.
const SIGNATURES = [
  { id: "psi", label: "ψ" },
  { id: "xi", label: "ξ" },
  { id: "sigma", label: "σ" },
  { id: "eta-sigma", label: "-ησ-" },
  { id: "vowel-sigma", label: "-ασ- / -εσ-" },
  { id: "no-sigma", label: "no σ: vowel or stem change" },
  { id: "short", label: "no σ: short root" },
  { id: "same", label: "unchanged" },
  { id: "none", label: "no perfective" },
  { id: "irregular", label: "irregular" },
];

function signature(r) {
  if (r.group === "irregular") return "irregular";
  if (r.group === "no-perf") return "none";
  if (r.group === "same") return "same";
  if (r.group === "strong") return "short";
  const added = [...r.perfectiveStem.matchAll(/\{([^}]*)\}/g)].map(m => flat(m[1])).join("");
  if (/ψ$/.test(added)) return "psi";
  if (/ξ$/.test(added)) return "xi";
  if (/σ$/.test(added)) {
    // -ησ- and the other vowels belong to the contracted verbs and -αίνω's -ησ-/-ασ- (χορταίνω
    // marks only the σ of χορτά{σ}ω, since its α stays)
    if (added === "ησ" && ["b1-eta", "b1-other", "b2", "aino"].includes(r.group)) return "eta-sigma";
    if (r.group === "aino" || ["b1-other", "b2"].includes(r.group) && added.length > 1) return "vowel-sigma";
    return "sigma";
  }
  return "no-sigma";
}

(async () => {
  const initSqlJs = require(path.join(ROOT, "docs/vendor/sql.js/sql-wasm.js"));
  const SQL = await initSqlJs({ locateFile: file => path.join(ROOT, "docs/vendor/sql.js", file) });
  const dbFile = process.env.DICT_DB || path.join(ROOT, "docs/data/lemma_greek_en.db.gz");
  const bytes = fs.readFileSync(dbFile);
  const db = new SQL.Database(dbFile.endsWith(".gz") ? zlib.gunzipSync(bytes) : bytes);

  const frequency = new Map(db.exec("SELECT word, MAX(frequency) FROM headword GROUP BY word")[0].values);
  // The first sense of the word's first verb entry
  const gloss = new Map();
  const rows = db.exec(`SELECT h.word, s.gloss FROM headword h
    JOIN entry e ON e.headword_id = h.id AND e.pos = 'verb'
    JOIN sense s ON s.entry_id = e.id AND s.is_reference = 0
    ORDER BY h.word, e.ord, s.ord`)[0].values;
  for (const [word, text] of rows) if (!gloss.has(word)) gloss.set(word, text);

  const english = new Map(sheet.map(v => [v.greek, v.english]));
  const verbs = new Map();  // one verb's key -> its record
  for (const greek of Object.keys(forms)) {
    const shown = VF.verbToShow(greek, { sheet, forms });
    const r = shown && AF.analyse(shown.conjugation, shown.verb);
    if (!r || r.group === "missing") continue;
    // A verb's spellings share their table, so their pasts and futures are the same.
    const key = [r.group, unmark(r.imperfect), unmark(r.aorist), unmark(r.dependent), unmark(r.presentStem)].join("|");
    const record = {
      greek, english: english.get(greek) || gloss.get(greek) || "", f: frequency.get(greek) || 0,
      list: english.has(greek), group: r.group, ending: ending(r), signature: signature(r),
      present: r.present, imperfect: r.imperfect, aorist: r.aorist, dependent: r.dependent,
    };
    const seen = verbs.get(key);
    if (!seen) { verbs.set(key, record); continue; }
    const keep = seen.list || (!record.list && seen.f >= record.f) ? seen : record;
    keep.f = seen.f + record.f;
    keep.also = [...(seen.also || []), ...(record.also || []), (keep === seen ? record : seen).greek];
    verbs.set(key, keep);
  }

  const list = [...verbs.values()].sort((a, b) => b.f - a.f || a.greek.localeCompare(b.greek, "el"));
  // Readable diffs: the endings and outcomes, then one verb per line
  const line = x => JSON.stringify(x);
  const json = `{"endings": ${line(ENDINGS)},\n"signatures": ${line(SIGNATURES)},\n"verbs": [\n${list.map(line).join(",\n")}\n]}\n`;
  fs.writeFileSync(path.join(ROOT, "docs/data/aspect-map.json"), json);
  console.log(`${list.length} verbs (${list.filter(v => v.list).length} in the word list) -> docs/data/aspect-map.json`);

  if (process.argv.includes("--print")) {
    const count = {};
    for (const v of list) {
      const k = `${v.ending} → ${v.group} → ${v.signature}`;
      count[k] = (count[k] || 0) + 1;
    }
    Object.entries(count).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(String(n).padStart(5), k));
  }
})();
