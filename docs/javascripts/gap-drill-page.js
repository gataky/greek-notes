// The page behind the fill-in-the-gap drills (apps/object-pronouns.html, apps/prepositions.html):
// an English sentence with words marked, the Greek with those words blanked, and a box to type
// them in. Each page passes its own config:
//   storage     prefix for localStorage keys (-history, -seen, -settings)
//   data        files in ../data/ to load, the sentence bank first
//   groups      [{ key, label }] for the chips and the slip grid
//   prepare(sentence, ...otherData) -> the sentence ready to grade, with `group`, or null to skip it
//   grade(typed, item) -> null for an empty answer, else { result, typed }
//   explain(g, item) -> { kind: good | warn | bad, title, msg: [lines] } for the feedback box
//   reason(item) -> [label, text] under the revealed Greek
//   errors: [[label, result]] counted under the slip grid
// Marking (settings.marking, as in DrillKit.marking) decides whether an accent slip, a small typo
// or τη for την counts as right; the feedback still lights up the letters that differ.
// Sentences of a group come up more often when you miss them, unseen ones first, and a missed
// one comes back a few turns later.

(function (root) {
  "use strict";
  const K = root.DrillKit, GS = root.GapSentences, $ = K.$;

  root.GapDrillPage = function (config) {
    const key = s => `${config.storage}-${s}`;
    const groupKeys = config.groups.map(g => g.key);
    let settings = { ...Object.fromEntries(groupKeys.map(g => [g, true])), marking: root.VoiceDrill.DEFAULT_MARKING, ...K.store.get(key("settings"), {}) };
    let history = K.store.get(key("history"), []);  // [{ g: group, r: result }]
    let seen = new Set(K.store.get(key("seen"), []));
    let items = [], retry = [], recent = [];
    let item = null, answered = false;
    const session = K.score();
    const right = r => K.counts(r, settings.marking);

    Promise.all(config.data.map(n => fetch(`../data/${n}.json`).then(r => r.json())))
      .then(([bank, ...rest]) => {
        for (const s of bank) {
          const it = config.prepare(s, ...rest);
          if (it) items.push({ ...it, id: K.hash(s.el) });
        }
        renderOptions(); renderSlips(); next();
      })
      .catch(err => {
        console.error(err);
        $("english").textContent = "Couldn't load the sentences. Open this page through the site (make serve), not straight from disk.";
      });

    function pickItem() {
      const due = retry.findIndex(r => r.due <= session.q && settings[r.it.group]);
      if (due >= 0) return retry.splice(due, 1)[0].it;
      const rows = history.slice(-150);
      const rate = g => { const x = rows.filter(r => r.g === g); return x.length ? x.filter(r => !right(r.r)).length / x.length : 0.3; };
      const groups = groupKeys.filter(g => settings[g] && items.some(it => it.group === g));
      if (!groups.length) return null;
      const g = K.weighted(groups, g => (1 + 3 * rate(g)) * Math.sqrt(items.filter(it => it.group === g).length));
      const list = items.filter(it => it.group === g);
      let pool = list.filter(it => !seen.has(it.id) && !recent.includes(it.id));
      if (!pool.length) { for (const it of list) seen.delete(it.id); pool = list.filter(it => !recent.includes(it.id)); }
      if (!pool.length) pool = list;
      const it = K.pick(pool);
      recent = [...recent, it.id].slice(-6);
      return it;
    }

    function next() {
      item = pickItem();
      if (!item) { $("english").textContent = "Turn on at least one group."; return; }
      answered = false; session.q++;
      seen.add(item.id); K.store.set(key("seen"), [...seen]);
      $("counter").textContent = "Sentence " + session.q;
      const [before, marked, after] = GS.target(item.en);
      const b = document.createElement("b"); b.textContent = marked;
      $("english").replaceChildren(before, b, after);
      const [gb, , ga] = GS.split(item.el, item.answer);
      const blank = document.createElement("span"); blank.className = "blank"; blank.textContent = " ";
      $("gapped").replaceChildren(gb, blank, ga);
      $("answer").value = ""; $("answer").disabled = false;
      $("check").disabled = false; $("show").disabled = false; $("next").disabled = true;
      $("feedback").hidden = true; $("reveal").hidden = true;
      K.focus($("answer"));
    }

    function check(e) {
      e && e.preventDefault();
      if (answered) { next(); return; }
      const raw = $("answer").value.trim();
      if (!raw) return;
      finish(config.grade(raw, item));
    }

    function finish(g) {
      answered = true;
      const result = g ? g.result : "shown";
      session.add(right(result));
      if (!right(result)) retry.push({ it: item, due: session.q + 3 + Math.floor(Math.random() * 4) });
      if (g) {
        history = [...history, { g: item.group, r: result }].slice(-300);
        K.store.set(key("history"), history); renderSlips();
      }
      let shown = g ? config.explain(g, item) : { kind: "bad", title: "Answer", msg: ["This one will come back later."] };
      if (g && K.forgiven(g.result, settings.marking)) shown = { ...shown, kind: "good", title: K.FORGIVEN, msg: [shown.title, ...(shown.msg || [])] };
      const clean = g && g.result === "correct";
      K.feedback($("feedback"), { ...shown, typed: g && !clean ? g.typed : "", answer: clean ? "" : item.answer, highlight: g && K.isSlip(g.result) });
      const [gb, ans, ga] = GS.split(item.el, item.answer);
      const b = document.createElement("b"); b.textContent = ans;
      $("greek").replaceChildren(gb, b, ga);
      const [label, text] = config.reason(item);
      $("reason").textContent = label; $("why").textContent = text;
      $("note").textContent = item.note || ""; $("note").hidden = !item.note;
      $("also").textContent = item.also && item.also.length ? "Also right: " + item.also.join(", ") : "";
      $("also").hidden = !(item.also && item.also.length);
      $("reveal").hidden = false;
      $("answer").disabled = true; $("check").disabled = true; $("show").disabled = true; $("next").disabled = false;
      K.focus($("next"));
    }

    function renderOptions() {
      $("chips").innerHTML = "";
      for (const g of config.groups) {
        const n = items.filter(it => it.group === g.key).length;
        if (!n) continue;
        const label = document.createElement("label"); label.className = "chip";
        const input = document.createElement("input"); input.type = "checkbox"; input.checked = settings[g.key];
        input.addEventListener("change", () => setOption(g.key, input.checked, input));
        const span = document.createElement("span"); span.innerHTML = g.label;
        label.append(input, span); $("chips").append(label);
      }
      $("bankInfo").textContent = `${items.length} sentences.`;
    }

    function setOption(g, value, input) {
      settings[g] = value;
      if (!groupKeys.some(k => settings[k])) { settings[g] = true; input.checked = true; return; }
      K.store.set(key("settings"), settings);
    }

    function renderSlips() {
      const rows = history.slice(-150);
      const has = rows.length > 0;
      $("slipInfo").textContent = has
        ? `Your last ${rows.length} answer${rows.length === 1 ? "" : "s"} on this device. The groups you miss come up more often.`
        : "Answer a few sentences and this shows which rules and mistakes come up most.";
      $("slip").hidden = !has; $("errs").hidden = !has; $("reset").hidden = !has;
      if (!has) return;
      const grid = $("slip"); grid.innerHTML = "";
      for (const g of config.groups) {
        const x = rows.filter(r => r.g === g.key);
        if (!x.length) continue;
        const label = K.div("rl", ""); label.innerHTML = g.label;
        grid.append(label, K.rateCell(x, r => right(r.r)));
      }
      K.errList($("errs"), config.errors.map(([label, r]) => [label, rows.filter(x => x.r === r).length]));
    }

    K.marking(settings, () => K.store.set(key("settings"), settings), renderSlips);
    $("form").addEventListener("submit", check);
    $("show").addEventListener("click", () => { if (!answered && item) finish(null); });
    $("next").addEventListener("click", next);
    $("reset").addEventListener("click", () => { history = []; K.store.set(key("history"), history); renderSlips(); });
    K.enterForNext(() => answered, "panel-drill", next);
    K.tabs([["drill", "tab-drill", "panel-drill"], ["tables", "tab-tables", "panel-tables"]], name => { if (name === "drill" && !answered) K.focus($("answer")); });
  };
})(this);
