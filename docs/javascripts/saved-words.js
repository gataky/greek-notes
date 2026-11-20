// The dictionary's saved words: a list the learner builds while looking words up, to jump back
// and forth between them.
//
// Two halves, in one file because both need the list:
//   - in the dictionary app (apps/dictionary.html), the pin next to a word saves or unsaves it;
//   - on the dictionary's page (overrides/app.html with saved_words: true), the history button in
//     the bar opens a dialog with the list. Picking a word opens it in the frame, × removes one,
//     and "Clear all" empties the list, with an undo until the dialog closes.
//
// The list is per device, in localStorage (`gdict-saved`), oldest first, and shown newest first.
// Each item is { word, gloss, pos }: the headword (by spelling, never a row id, since ids change
// between dictionary builds), its first meaning, and its part of speech's colour (verb, noun,
// adj, adv, prep, other) as the dictionary draws it. The page has no dictionary loaded, so the
// gloss and colour are kept from when the word was saved.
//
// The frame and the page are separate windows on one origin, so a change in one reaches the other
// as a storage event; "saved-words" fires for a change in either.

(function () {
  const KEY = "gdict-saved";

  function list() {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(items) ? items.filter(item => item && typeof item.word === "string") : [];
    } catch (err) {
      return [];
    }
  }

  function write(items) {
    try {
      if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
      else localStorage.removeItem(KEY);
    } catch (err) {}
    dispatchEvent(new Event("saved-words"));
  }

  const has = word => list().some(item => item.word === word);
  const add = item => { if (!has(item.word)) write([...list(), item]); };
  const remove = word => write(list().filter(item => item.word !== word));
  // Clears the list and returns what it held, for an undo.
  function clear() {
    const items = list();
    write([]);
    return items;
  }
  const restore = items => write(items);

  window.SavedWords = { KEY, list, has, add, remove, clear, restore };
  addEventListener("storage", e => {
    if (e.key === KEY || e.key === null) dispatchEvent(new Event("saved-words"));
  });

  // ---------- The dialog, on the page around the dictionary's frame ----------

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // Material Symbols' "close" and the sweep icon (Apache 2.0)
  const CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" fill="currentColor" aria-hidden="true"><path d="M6.4,19L5,17.6L10.6,12L5,6.4L6.4,5L12,10.6L17.6,5L19,6.4L13.4,12L19,17.6L17.6,19L12,13.4L6.4,19Z"/></svg>';
  const SWEEP = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" fill="currentColor" aria-hidden="true"><path d="M11,11h2V4q0-0.43-0.29-0.71T12,3T11.29,3.29T11,4v7ZM5,15H19V13H5v2ZM3.55,21H6V19q0-0.43 0.29-0.71T7,18t0.71,0.29T8,19v2h3V19q0-0.43 0.29-0.71T12,18t0.71,0.29T13,19v2h3V19q0-0.43 0.29-0.71T17,18t0.71,0.29T18,19v2h2.45l-1-4H4.55l-1,4Zm16.9,2H3.55q-0.98,0-1.58-0.77T1.63,20.5L3,15V13q0-0.83 0.59-1.41T5,11H9V4Q9,2.75 9.88,1.88T12,1t2.13,0.88T15,4v7h4q0.83,0 1.41,0.59Q21,12.18 21,13v2l1.38,5.5q0.33,0.95-0.29,1.73T20.45,23ZM19,13H5H19Zm-6-2H11q0,0 0.29,0T12,11t0.71,0T13,11Z"/></svg>';

  let dialog = null;
  let cleared = null;   // what "Clear all" took, until the dialog closes

  const frame = () => document.querySelector("iframe.drill-frame");

  // The word open in the frame, to mark it in the list.
  function openWord() {
    try {
      return decodeURIComponent(frame()?.contentWindow.location.hash.slice(1) || "");
    } catch (err) {
      return "";
    }
  }

  function render() {
    const items = list().reverse();
    const current = openWord();
    const body = dialog.querySelector(".saved__body");
    if (cleared) {
      body.innerHTML = `<p class="saved__empty">Cleared ${cleared.length} ${cleared.length === 1 ? "word" : "words"}.
        <button type="button" class="saved__undo" data-undo>Undo</button></p>`;
    } else if (!items.length) {
      body.innerHTML = '<p class="saved__empty">Nothing saved yet. Open a word and press the pin next to it.</p>';
    } else {
      body.innerHTML = `<ul class="saved__list">${items.map(item => `
        <li class="saved__item pos-${esc(item.pos || "other")}${item.word === current ? " saved__item--open" : ""}">
          <button type="button" class="saved__word" data-open="${esc(item.word)}"${item.word === current ? ' aria-current="true"' : ""}>
            <span class="saved__greek" lang="el">${esc(item.word)}</span>
            <span class="saved__gloss">${esc(item.gloss || "")}</span>
          </button>
          <button type="button" class="saved__remove" data-remove="${esc(item.word)}" aria-label="Remove ${esc(item.word)}" title="Remove">${CLOSE}</button>
        </li>`).join("")}</ul>`;
    }
    dialog.querySelector("[data-clear]").hidden = !items.length || !!cleared;
  }

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "picker saved";
    dialog.setAttribute("aria-label", "Saved words");
    dialog.innerHTML = `<form method="dialog">
      <h2>Saved words</h2>
      <p>Words you've pinned, newest first. Pick one to open it. Saved on this device.</p>
      <div class="saved__body"></div>
      <div class="saved__actions">
        <button type="button" class="saved__clear" data-clear>${SWEEP}<span>Clear all</span></button>
        <button class="picker__done" value="done">Done</button>
      </div>
    </form>`;
    dialog.addEventListener("click", e => {
      if (e.target === dialog) return dialog.close();
      const open = e.target.closest("[data-open]");
      const removing = e.target.closest("[data-remove]");
      if (open) {
        const win = frame()?.contentWindow;
        if (win) win.location.hash = "#" + encodeURIComponent(open.dataset.open);
        dialog.close();
      } else if (removing) {
        remove(removing.dataset.remove);
        render();
        dialog.querySelector("[data-open], [data-clear]:not([hidden]), .picker__done")?.focus();
      } else if (e.target.closest("[data-clear]")) {
        cleared = clear();
        render();
        dialog.querySelector("[data-undo]")?.focus();
      } else if (e.target.closest("[data-undo]")) {
        restore(cleared);
        cleared = null;
        render();
      }
    });
    dialog.addEventListener("close", () => { cleared = null; });
    document.body.append(dialog);
  }

  document.addEventListener("click", e => {
    if (!e.target.closest("[data-saved-words-open]")) return;
    if (!dialog || !dialog.isConnected) build();
    cleared = null;
    render();
    dialog.showModal();
  });
})();
