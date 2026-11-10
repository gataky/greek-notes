#!/usr/bin/env node
// Copies the declension of every noun and adjective in docs/data/words.json from the dictionary
// into docs/data/declensions.json, for the noun drills (noun gender, agreement, numbers,
// prepositions). The cells are the dictionary page's own, from greek-dictionary.js's
// declensions() and adjectiveDeclensions(), so the drills and the dictionary always agree.
//   node scripts/build_declensions.js
//
// One word per line: { greek, pos, gender, cells }, greek spelled as in the word list. A noun's
// cells are cases by numbers, an adjective's genders by cases by numbers, as the dictionary
// gives them: lists of forms, "|" before the ending, [] for a form that doesn't exist and null
// where the table says nothing. gender is the word list's, else the table's, and both genders
// for a noun the word list marks invariable (ο/η γιατρός). Where the two disagree it's printed.
//
// A noun's table is its own, else a proper name's (Ελλάδα, Απρίλιος: name: true). A noun the
// dictionary calls indeclinable (ταξί, μπολ) gets its one form in every cell and
// indeclinable: true. A word with none of these, such as a spelling the dictionary files
// under another (αυγό for αβγό), is left out and printed.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const initSqlJs = require("../docs/vendor/sql.js/sql-wasm.js");
const D = require("../docs/javascripts/greek-dictionary.js");

const DATA = path.join(__dirname, "../docs/data");
const OUT = path.join(DATA, "declensions.json");
const words = JSON.parse(fs.readFileSync(path.join(DATA, "words.json"), "utf8"));

initSqlJs().then(SQL => {
  const db = new SQL.Database(zlib.gunzipSync(fs.readFileSync(path.join(DATA, "lemma_greek_en.db.gz"))));
  const dict = D.open(db);
  const out = [], missing = [];

  const disagree = [];
  const genders = (w, tableGender) => {
    if (w.gender === "invariable") return ["masculine", "feminine"];
    if (D.GENDERS.includes(w.gender) && tableGender && tableGender !== w.gender) disagree.push(`${w.greek} (${w.gender}, the dictionary says ${tableGender})`);
    return [D.GENDERS.includes(w.gender) ? w.gender : tableGender].filter(Boolean);
  };
  const fromTables = (w, tables, extra) => {
    // The table of the word list's gender, when the dictionary has two (two genders or two patterns).
    const t = tables.find(t => t.gender === w.gender) || tables[0];
    const gender = t && genders(w, t.gender);
    return gender && gender.length ? { greek: w.greek, pos: "noun", gender, cells: t.cells, ...extra } : null;
  };
  function noun(w, s) {
    const own = fromTables(w, dict.declensions(s)) || fromTables(w, dict.declensions(s, "name"), { name: true });
    if (own) return own;
    const entry = dict.lookup(s);
    if (!entry || !entry.entries.some(e => e.pos === "noun" && /\bindeclinable\b/.test(e.head || ""))) return null;
    const gender = genders(w, null);
    const cells = Object.fromEntries(D.CASES.map(c => [c, { singular: [s], plural: [s] }]));
    return gender.length ? { greek: w.greek, pos: "noun", gender, cells, indeclinable: true } : null;
  }

  for (const w of words) {
    // "φίλη, φιλενάδα": the first spelling with a table.
    const spellings = w.greek.split(/\s*,\s*/);
    let found = null;
    for (const s of spellings) {
      if (w.pos === "noun") found = noun(w, s);
      else {
        const t = dict.adjectiveDeclensions(s)[0];
        if (t) found = { greek: w.greek, pos: "adjective", cells: t.cells };
      }
      if (found) break;
    }
    if (found) out.push(found);
    else missing.push(w.greek);
  }

  fs.writeFileSync(OUT, "[\n" + out.map(x => JSON.stringify(x)).join(",\n") + "\n]\n");
  console.log(`Wrote ${out.length} of ${words.length} nouns and adjectives to ${path.relative(process.cwd(), OUT)}`);
  if (missing.length) console.log(`No table for ${missing.length}: ${missing.join(", ")}`);
  if (disagree.length) console.log(`Gender from the word list, not the dictionary, for ${disagree.join(", ")}`);
});
