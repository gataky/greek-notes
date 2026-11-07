// A verb's forms for the verb tables: the lemma dictionary's where it has them (verb-forms.json,
// built by scripts/build_verb_forms.py), and the conjugation engine's for everything else.
//
// The dictionary is the source of truth, so a cell it has replaces the engine's, overrides included.
// Its forms have no "|" between stem and ending, so that split comes from the engine's forms in
// the same cell. What Wiktionary doesn't list (future, subjunctive, perfect) is built on top.

(function (root) {
  "use strict";
  const { conjugate, strip, perfectForms, HAVE, HAD } = root.GreekVerbs || require("./greek-verbs.js");

  // ["γράφ|ουν(ε)"] → [["γράφ", "ουνε"], ["γράφ", "ουν"]], longest ending first.
  // Forms with no split (είμαι, overrides) are skipped.
  const splits = row => row.flatMap(form => {
    const [stem, end] = form.split("|");
    if (end === undefined) return [];
    const optional = /^(.*)\((.+)\)$/.exec(end);
    return (optional ? [optional[1], optional[1] + optional[2]] : [end]).map(e => [stem, e]);
  }).sort((a, b) => b[1].length - a[1].length);

  // Same word as the engine's, else same ending (ήλθ|αμε from ήρθ|αμε), else same stem
  // (γράφ|ουν from γράφ|ω). Anything else is irregular enough to show without a highlight.
  function markEnding(form, known) {
    if (form.includes(" ")) return form;  // να είσαι
    const bare = strip(form);
    const at = n => form.slice(0, n) + "|" + form.slice(n);
    const same = known.find(([s, e]) => s + e === form);
    if (same) return at(same[0].length);
    const ending = known.find(([, e]) => e && bare.length > e.length && bare.endsWith(strip(e)));
    if (ending) return at(form.length - ending[1].length);
    const stem = known.find(([s]) => s && bare.length > s.length && bare.startsWith(strip(s)));
    return stem ? at(stem[0].length) : form;
  }

  // γράφουν, γράφουνε → γράφουν(ε), the engine's notation.
  function collapse(row) {
    const bare = row.map(f => f.replace("|", ""));
    return row.flatMap((form, i) => {
      if (/[εα]$/.test(bare[i]) && bare.includes(bare[i].slice(0, -1))) return [];
      const letter = ["ε", "α"].find(l => bare.includes(bare[i] + l));
      return [letter ? `${form}(${letter})` : form];
    });
  }

  // One column of the grid: dictionary cells, with the engine's where the data says nothing (null).
  const column = (cells, engine, related = () => []) => cells.map((cell, i) =>
    cell === null ? engine[i] : collapse(cell.map(f => markEnding(f, splits([...engine[i], ...related(i)])))));

  const prefix = (pre, cell) => cell.map(row => row.map(f => pre + f));
  const unprefixed = cell => cell.map(row => row.map(f => f.replace(/^θα /, "")));

  // The same shape as conjugate(). `forms` is the verb's entry in verb-forms.json, if it has one.
  function withForms(verb, forms) {
    const c = conjugate(verb);
    if (!forms) return c;
    const I = c.indicative;

    const present = column(forms.present, I.present.continuous);
    const imperfect = column(forms.imperfect, I.past.continuous);
    const dependent = column(forms.dependent, unprefixed(I.future.simple));
    const aorist = column(forms.past, I.past.simple);
    // Imperatives the engine leaves blank can still split like the present (κάθ|ου, έρχ|εστε),
    // and simple ones like the continuous (αγάπ|α).
    const impCont = column(forms.impCont, c.imperative.continuous, i => present[i ? 4 : 1]);
    const impSimple = column(forms.impSimple, c.imperative.simple, i => impCont[i]);

    const engineInfinitive = I.present.perfect[0][0]?.split(" ").pop() || "";
    const infinitive = forms.infinitive === null ? engineInfinitive
      : forms.infinitive[0] && markEnding(forms.infinitive[0], splits([engineInfinitive, ...dependent[2]]));
    const perfect = perfectForms(HAVE, infinitive);

    return {
      ...c,
      indicative: {
        past: { continuous: imperfect, simple: aorist, perfect: perfectForms(HAD, infinitive) },
        present: { continuous: present, perfect },
        future: { continuous: prefix("θα ", present), simple: prefix("θα ", dependent), perfect: prefix("θα ", perfect) },
      },
      subjunctive: { continuous: prefix("να ", present), simple: prefix("να ", dependent), perfect: prefix("να ", perfect) },
      imperative: { continuous: impCont, simple: impSimple },
    };
  }

  const api = { withForms };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VerbForms = api;
})(this);
