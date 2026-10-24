// Renders a verb's conjugation grid. Shared by the verb tables and conjugation patterns pages.
// Needs greek-verbs.js loaded first.

(function (root) {
  "use strict";
  const { conjugate } = root.GreekVerbs;

  const DOT = `<span class="dot"> · </span>`;
  const PERSON_LABELS = ["εγώ", "εσύ", "αυτός/ή/ό", "εμείς", "εσείς", "αυτοί/ές/ά"];
  const CLASS_ORDER = ["a1", "a2", "b1", "b2", "c1", "c2", "c3", "c4", "irregular"];
  const PATTERN_ENDINGS = { a1: "-ω", a2: "-ω after a vowel", b1: "-άω", b2: "-ώ", c1: "-ομαι", c2: "-άμαι", c3: "-ιέμαι", c4: "-ούμαι", irregular: "irregular" };

  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // "θα γράψ|ουμε" → muted "θα", stem, highlighted ending
  function formHTML(form) {
    const space = form.lastIndexOf(" ");
    const pre = space >= 0 ? form.slice(0, space + 1) : "";
    const [stem, end = ""] = form.slice(pre.length).split("|");
    return (pre ? `<span class="pre">${esc(pre)}</span>` : "") + esc(stem) + (end ? `<span class="end">${esc(end)}</span>` : "");
  }

  // Main form, with any alternatives (μιλάω / μιλώ, έγραψαν / γράψανε) in small type underneath.
  function cellHTML(alternatives) {
    if (!alternatives.length) return `<span class="dash">—</span>`;
    const [main, ...rest] = alternatives;
    return formHTML(main) + rest.map(a => `<span class="alt">${formHTML(a)}</span>`).join("");
  }

  const dropPrefix = cell => cell.map(row => row.map(f => f.replace(/^θα /, "")));
  const first = cell => (cell[0] && cell[0][0]) || "";
  // "γράφ|ω" → "γράφ-"
  const stemOf = cell => (first(cell).includes("|") ? first(cell).split("|")[0] + "-" : "");

  // The grid for one verb: heading, the two-stem table, then the θα / να / έχω forms written out.
  // Pass `heading` to replace the default verb heading (word, meaning, class and voice tags).
  function cardHTML(verb, { heading } = {}) {
    const c = conjugate(verb);
    const I = c.indicative;
    const contPresent = I.present.continuous;
    const contPast = I.past.continuous;
    const simplePresent = dropPrefix(I.future.simple);
    const simplePast = I.past.simple;
    const participle = first(I.present.perfect).split(" ").pop();

    const groupHead = (label, cell) => `<th class="group" colspan="2">${label}${stemOf(cell) ? `<span class="stem">${esc(stemOf(cell))}</span>` : ""}</th>`;
    const rows = PERSON_LABELS.map((who, i) => `<tr>
        <td class="who">${who}</td>
        <td>${cellHTML(contPresent[i])}</td><td>${cellHTML(contPast[i])}</td><td class="gap"></td>
        <td>${cellHTML(simplePresent[i])}</td><td>${cellHTML(simplePast[i])}</td>
      </tr>`).join("");
    const imperative = pair => (pair.some(r => r.length) ? pair.map(cellHTML).join(`<span class="sep">·</span>`) : `<span class="dash">—</span>`);

    // Narrow screens: one small table per stem group.
    const stacked = [["Continuous", contPresent, contPast, "present", "Ενεστώτας", "past", "Παρατατικός", c.imperative.continuous],
                     ["Simple", simplePresent, simplePast, "after θα / να", "Εξαρτημένος", "past", "Αόριστος", c.imperative.simple]]
      .map(([label, now, past, h1, g1, h2, g2, imp]) => `<div class="scroll"><table lang="el">
        <thead>
          <tr><th></th>${groupHead(label, now)}</tr>
          <tr><th></th><th class="sub">${h1}<small>${g1}</small></th><th class="sub">${h2}<small>${g2}</small></th></tr>
        </thead>
        <tbody>
          ${PERSON_LABELS.map((who, i) => `<tr><td class="who">${who}</td><td>${cellHTML(now[i])}</td><td>${cellHTML(past[i])}</td></tr>`).join("")}
          <tr class="extra"><td class="who">imperative</td><td colspan="2">${imperative(imp)}</td></tr>
        </tbody>
      </table></div>`).join("");

    // How the remaining tenses are built, written out with this verb.
    const example = (pre, cell, note = "") =>
      `<span class="ex">${first(cell) ? formHTML(pre + first(cell)) : `<span class="dash">—</span>`}${note ? ` <span class="pre">(${note})</span>` : ""}</span>`;
    const perfect = participle ? `<span class="ex"><span class="pre">έχω / είχα / θα έχω + </span>${formHTML(participle)}</span>` : `<span class="dash">—</span>`;
    const legend = [
      ["Future", `${example("θα ", contPresent, "continuous")}${DOT}${example("θα ", simplePresent, "simple")}`],
      ["Subjunctive", `${example("να ", contPresent)}${DOT}${example("να ", simplePresent)}`],
    ].map(([dt, dd]) => `<dt>${dt}</dt><dd>${dd}</dd>`).join("")
      + `<dt class="narrow-only">Perfect</dt><dd class="narrow-only">${perfect}</dd>`;

    const cls = verb.class || c.pattern;
    const pattern = PATTERN_ENDINGS[c.pattern];
    const classTag = pattern && pattern !== cls ? `${cls} · ${pattern}` : cls;
    return `
      ${heading ?? `<div>
        <div class="verb-top"><h2 lang="el">${esc(c.greek)}</h2><span class="english">${esc(c.english)}</span></div>
        <div class="tags"><span class="tag">${esc(classTag)}</span>${c.voice ? `<span class="tag">${esc(c.voice)}</span>` : ""}</div>
      </div>`}
      ${c.notes.map(n => `<p class="note">${esc(n)}</p>`).join("")}
      <div class="stacked">${stacked}</div>
      <div class="scroll wide"><table lang="el">
        <thead>
          <tr><th></th>${groupHead("Continuous", contPresent)}<th class="gap"></th>${groupHead("Simple", simplePresent)}</tr>
          <tr><th></th>
            <th class="sub">present<small>Ενεστώτας</small></th><th class="sub">past<small>Παρατατικός</small></th><th class="gap"></th>
            <th class="sub">after θα / να<small>Εξαρτημένος</small></th><th class="sub">past<small>Αόριστος</small></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="extra"><td class="who">imperative</td>
            <td colspan="2">${imperative(c.imperative.continuous)}</td><td class="gap"></td>
            <td colspan="2">${imperative(c.imperative.simple)}</td></tr>
          <tr><td class="who">perfect</td>
            <td colspan="5">${perfect}</td></tr>
        </tbody>
      </table></div>
      <dl class="legend">${legend}</dl>`;
  }

  root.VerbGrid = { cardHTML, esc, PATTERN_ENDINGS, CLASS_ORDER };
})(this);
