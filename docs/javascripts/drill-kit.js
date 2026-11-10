// The small pieces the newer drill apps share (noun gender, agreement, numbers, object
// pronouns, prepositions): storage, the feedback box, the score line, tabs, and the
// "where you slip" cells. Browser only; each drill's logic is in its own module.

(function (root) {
  "use strict";

  const $ = id => document.getElementById(id);

  // Move focus to the answer box only with a mouse or trackpad. On a phone that would open the
  // on-screen keyboard on every new question and make the page jump, so there the learner taps
  // the box when ready.
  const AUTO_FOCUS = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const focus = el => { if (AUTO_FOCUS && el) el.focus({ preventScroll: true }); };

  // localStorage that never throws: private windows and blocked storage just forget.
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hash = s => { let h = 5381; for (const c of s) h = (h * 33 + c.codePointAt(0)) >>> 0; return h.toString(36); };
  const pick = list => list[Math.floor(Math.random() * list.length)];
  function weighted(list, weight) {
    let x = Math.random() * list.reduce((s, it) => s + weight(it), 0);
    for (const it of list) { x -= weight(it); if (x <= 0) return it; }
    return list[list.length - 1];
  }

  // Marking: Exact, Accents optional (the default) or Forgiving, the same setting and levels as
  // the verb drills (MARKING and countsAsRight() in voice-drill.js). A slip is only the accent
  // being off (accent), a small typo (spelling) or τη where the ν must stay (n, marked like a
  // typo). Anything that's a different form (another case, gender, person, word order...)
  // never counts as right.
  const VD = root.VoiceDrill;
  const SLIP_LEVEL = { accent: "accent", spelling: "spelling", n: "spelling" };
  const isSlip = result => result in SLIP_LEVEL;
  const counts = (result, marking) => result === "correct" || (isSlip(result) && VD.countsAsRight(SLIP_LEVEL[result], marking));
  const forgiven = (result, marking) => result !== "correct" && counts(result, marking);
  const FORGIVEN = "Σωστά! Counted as right.";
  const MARKING_HELP = {
    exact: "Every letter and accent has to be right.",
    accents: "A missing or misplaced accent counts as right; other spelling slips don't.",
    forgiving: "Accent and small spelling slips count as right.",
  };

  // The Marking radios, in #marking with their help in #markingInfo. settings.marking is checked
  // and kept; save() runs after a change, then onChange().
  function marking(settings, save, onChange) {
    if (!(settings.marking in VD.MARKING)) settings.marking = VD.DEFAULT_MARKING;
    const box = $("marking");
    box.innerHTML = "";
    for (const [value, label] of [["exact", "Exact"], ["accents", "Accents optional"], ["forgiving", "Forgiving"]]) {
      const chip = document.createElement("label"); chip.className = "chip";
      const input = document.createElement("input"); input.type = "radio"; input.name = "marking"; input.value = value;
      input.checked = settings.marking === value;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        settings.marking = value; save(); help(); if (onChange) onChange();
      });
      chip.append(input, " " + label); box.append(chip);
    }
    const help = () => { $("markingInfo").textContent = MARKING_HELP[settings.marking] + " You're still shown the right spelling, and slips still show under Where you slip."; };
    help();
  }

  // "σπίτ|ια" -> σπίτ<span class="end">ια</span>, the ending in the accent colour.
  function markHTML(form) {
    const [stem, end] = String(form).includes("|") ? String(form).split("|") : [form, ""];
    return esc(stem) + (end ? `<span class="end">${esc(end)}</span>` : "");
  }

  // The feedback box under the answer: a title, a message, and typed → right answer.
  //   kind: "good" | "warn" | "bad"
  //   highlight: light up the letters of the answer that differ from what was typed, for a slip
  function feedback(el, { kind, title, msg, typed, answer, highlight }) {
    el.className = "feedback " + kind;
    el.innerHTML = "";
    const strong = document.createElement("strong"); strong.textContent = title; el.append(strong);
    for (const m of [].concat(msg || [])) {
      if (!m) continue;
      const p = document.createElement("span"); p.className = "msg"; p.textContent = m; el.append(p);
    }
    if (answer) {
      const fix = document.createElement("span"); fix.className = "fix"; fix.lang = "el";
      if (typed) { const del = document.createElement("s"); del.textContent = typed; fix.append(del, " → "); }
      const ins = document.createElement("b");
      if (highlight && typed) {
        for (const [text, changed] of VD.changes(typed, answer)) {
          if (!changed) { ins.append(text); continue; }
          const m = document.createElement("mark"); m.textContent = text; ins.append(m);
        }
      } else ins.textContent = answer;
      fix.append(ins);
      el.append(fix);
    }
    el.hidden = false;
  }

  // Correct / total and the streak, shown in #sCorrect, #sTotal and #sStreak.
  function score() {
    const s = { q: 0, correct: 0, total: 0, streak: 0 };
    s.add = right => {
      s.total++;
      if (right) { s.correct++; s.streak++; } else s.streak = 0;
      $("sCorrect").textContent = s.correct; $("sTotal").textContent = s.total; $("sStreak").textContent = s.streak;
    };
    return s;
  }

  // Two tabs, "drill" and another: [tab id, panel id] pairs. onShow(name) runs after a switch.
  function tabs(pairs, onShow) {
    const show = name => {
      for (const [key, tab, panel] of pairs) {
        $(tab).setAttribute("aria-selected", key === name);
        $(panel).hidden = key !== name;
      }
      if (onShow) onShow(name);
    };
    for (const [key, tab] of pairs) $(tab).addEventListener("click", () => show(key));
    return show;
  }

  // One "where you slip" cell from a list of answers: "4 of 5", "80% right", coloured by rate.
  function rateCell(rows, right, unit = "right") {
    const cell = document.createElement("div");
    const b = document.createElement("b"), s = document.createElement("span");
    if (rows.length) {
      const n = rows.filter(right).length, rate = n / rows.length;
      cell.className = "cell " + (rate < 0.6 ? "lo" : rate < 0.85 ? "mid" : "hi");
      b.textContent = `${n} of ${rows.length}`; s.textContent = `${Math.round(rate * 100)}% ${unit}`;
    } else { cell.className = "cell"; b.textContent = "–"; s.textContent = "not drilled yet"; }
    cell.append(b, s);
    return cell;
  }
  const div = (cls, text) => { const d = document.createElement("div"); d.className = cls; d.textContent = text; return d; };

  // The list under the slip grid: "label: n" for each count that isn't 0.
  function errList(el, pairs) {
    el.innerHTML = "";
    for (const [label, n] of pairs) {
      if (!n) continue;
      const li = document.createElement("li"); li.append(label + ": ");
      const b = document.createElement("b"); b.textContent = n; li.append(b); el.append(li);
    }
  }

  // Enter moves on once a question is answered (the form's submit handles the first Enter).
  function enterForNext(isAnswered, panel, next) {
    document.addEventListener("keydown", e => {
      if (e.key === "Enter" && isAnswered() && !$(panel).hidden && e.target.tagName !== "BUTTON") { e.preventDefault(); next(); }
    });
  }

  root.DrillKit = { $, AUTO_FOCUS, focus, store, esc, hash, pick, weighted, isSlip, counts, forgiven, FORGIVEN, marking, markHTML, feedback, score, tabs, rateCell, div, errList, enterForNext };
})(this);
