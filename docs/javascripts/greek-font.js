// The Greek font picker. Every font stack on the site starts with "Chosen Greek", a font that
// exists only once the learner picks one. It covers Greek letters alone, so Latin text keeps its
// own font, and until a choice is made the stacks fall through to the fonts they always had.
//
// Loaded by every page (mkdocs.yml) and every app in docs/apps/. Each document registers the
// saved choice's faces itself; the pages also draw the button and the dialog, and pass a new
// choice into their frames (drill-frame.js does the same for frames that load later).
// The choice is kept per device in localStorage ("greek-font"), with its faces, so a page can
// register them without fetching the font's stylesheet again. Font files are cached by the
// service worker on first use, so a font works offline once it has been picked online.
(function () {
  const KEY = "greek-font";
  const FAMILY = "Chosen Greek";
  const SAMPLE = "Καλημέρα! Πώς είσαι;";
  const HERE = document.currentScript.src;

  // size: CSS size-adjust, so the Greek letters stand as tall as Commissioner's (Didot keeps the
  // 118% it has everywhere else). file: a self-hosted Greek subset instead of Google Fonts.
  const FONTS = [
    { id: "default", name: "Default", note: "Didot, and GFS Neohellenic in the dictionary" },
    { id: "neohellenic", name: "GFS Neohellenic", family: "GFS Neohellenic", size: "124%" },
    { id: "alegreya", name: "Alegreya", family: "Alegreya", size: "109%" },
    { id: "wenkai", name: "LXGW WenKai Mono TC", family: "LXGW WenKai Mono TC", size: "103%" },
    { id: "didot", name: "GFS Didot", file: "../fonts/gfs-didot-greek.woff2", size: "118%" },
    { id: "ubuntu-mono", name: "Ubuntu Mono", family: "Ubuntu Mono", size: "107%" },
    { id: "carlito", name: "Carlito", family: "Carlito", size: "105%" },
  ];

  // The button's icon (Material Symbols' "translate"), also in overrides/home.html
  const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24" width="24" fill="currentColor" aria-hidden="true"><path d="M11.9,22l4.55-12h2.1L23.1,22H21l-1.07-3.05H15.08L14,22H11.9ZM4,19L2.6,17.6l5.05-5.05q-0.88-0.88-1.59-2T4.75,8h2.1q0.5,0.97 1,1.7t1.2,1.45q0.82-0.82 1.71-2.31T12.1,6H1V4H8V2h2V4h7V6H14.1q-0.53,1.8-1.58,3.7t-2.07,2.9l2.4,2.45L12.1,17.1L9.05,13.98L4,19Zm11.7-1.8h3.6l-1.8-5.1l-1.8,5.1Z"/></svg>';

  const cssURL = (font, query) =>
    `https://fonts.googleapis.com/css2?family=${font.family.replace(/ /g, "+")}${query}&display=swap`;

  function load() {
    try {
      const state = JSON.parse(localStorage.getItem(KEY));
      return state && FONTS.some(font => font.id === state.id) ? state : null;
    } catch (err) {
      return null;
    }
  }

  function save(state) {
    try {
      if (state) localStorage.setItem(KEY, JSON.stringify(state));
      else localStorage.removeItem(KEY);
    } catch (err) {}
  }

  // The @font-face rules in a Google Fonts stylesheet, as FontFace descriptors. With `greek`,
  // only the Greek subsets (polytonic included); a stylesheet made with &text= has no subsets.
  function parseFaces(css, size, greek) {
    return [...css.matchAll(/(?:\/\* ([\w-]+) \*\/\s*)?@font-face\s*\{([^}]*)\}/g)]
      .filter(([, subset]) => !greek || /^greek/.test(subset || ""))
      .map(([, , body]) => {
        const get = name => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
        return { src: get("src"), style: get("font-style"), weight: get("font-weight"), range: get("unicode-range"), size };
      });
  }

  async function facesOf(font, query, greek) {
    if (font.file) {
      return [{ src: `url("${new URL(font.file, HERE)}") format("woff2")`, style: "normal", weight: "400", range: "U+0370-03FF", size: font.size }];
    }
    const response = await fetch(cssURL(font, query));
    if (!response.ok) throw new Error(`${response.status} for ${font.name}`);
    return parseFaces(await response.text(), font.size, greek);
  }

  function fontFace(family, face) {
    return new FontFace(family, face.src, {
      style: face.style || "normal",
      weight: face.weight || "400",
      unicodeRange: face.range || "U+0-10FFFF",
      sizeAdjust: face.size || "100%",
      display: "swap",
    });
  }

  let current = null;
  let applied = "null";
  let added = [];

  // Register a choice's faces in this document, in place of the last choice's. null is Default.
  function use(state) {
    current = state;
    const key = JSON.stringify(state);
    if (key === applied) return;
    applied = key;
    added.forEach(face => document.fonts.delete(face));
    added = (state?.faces || []).map(face => fontFace(FAMILY, face));
    added.forEach(face => document.fonts.add(face));
  }

  // Pass this document's choice into a frame that loads greek-font.js too.
  function sync(win) {
    try {
      win.GreekFont?.use(current);
    } catch (err) {}
  }

  async function choose(id) {
    const font = FONTS.find(f => f.id === id);
    const state = font.id === "default" ? null : { id, faces: await facesOf(font, ":wght@400;700", true) };
    save(state);
    use(state);
    document.querySelectorAll("iframe").forEach(frame => sync(frame.contentWindow));
  }

  window.GreekFont = { FONTS, use, sync, choose, get current() { return current; } };
  use(load());
  addEventListener("storage", e => {
    if (e.key === KEY || e.key === null) use(load());
  });

  // The rest is the picker, on the site's pages only (not inside the apps' frames).
  const header = document.querySelector(".md-header__inner");
  if (!header) return;

  // In the header, before the light/dark toggle. The dictionary's page draws its own button
  // (overrides/home.html), since its header is hidden.
  const button = document.createElement("button");
  button.className = "md-header__button md-icon greek-font__open";
  button.type = "button";
  button.dataset.greekFontOpen = "";
  button.title = "Greek font";
  button.setAttribute("aria-label", "Greek font");
  button.innerHTML = ICON;
  header.insertBefore(button, header.querySelector('[data-md-component="palette"]'));

  let dialog = null;

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "greek-font";
    dialog.setAttribute("aria-label", "Greek font");
    dialog.innerHTML = `<form method="dialog">
      <h2>Greek font</h2>
      <p>For every Greek word in the notes, the drills and the dictionary. English text keeps its font. Saved on this device.</p>
      <div class="greek-font__options">${FONTS.map(font => `
        <label class="greek-font__option">
          <input type="radio" name="greek-font" value="${font.id}">
          <span class="greek-font__name">${font.name}${font.note ? `<small>${font.note}</small>` : ""}</span>
          <span class="greek-font__sample" lang="el" style="font-family: 'Greek Sample ${font.id}', 'Greek Didot', serif">${SAMPLE}</span>
        </label>`).join("")}
      </div>
      <p class="greek-font__status" role="status"></p>
      <button class="greek-font__done" value="done">Done</button>
    </form>`;
    dialog.addEventListener("change", async e => {
      const status = dialog.querySelector(".greek-font__status");
      status.textContent = "";
      try {
        await choose(e.target.value);
      } catch (err) {
        status.textContent = "Couldn't download that font. It needs a connection the first time.";
        check();
      }
    });
    dialog.addEventListener("click", e => {
      if (e.target === dialog) dialog.close();
    });
    document.body.append(dialog);
    previews();
  }

  // Each sample in its own font: a tiny download of just the sample's letters.
  function previews() {
    for (const font of FONTS) {
      if (font.id === "default") continue;
      facesOf(font, `&text=${encodeURIComponent(SAMPLE)}`, false)
        .then(faces => faces.forEach(face => document.fonts.add(fontFace(`Greek Sample ${font.id}`, { ...face, range: null }))))
        .catch(() => {});
    }
  }

  function check() {
    const id = current?.id || "default";
    dialog.querySelectorAll("input").forEach(input => { input.checked = input.value === id; });
  }

  document.addEventListener("click", e => {
    if (!e.target.closest("[data-greek-font-open]")) return;
    if (!dialog) build();
    check();
    dialog.showModal();
  });
})();
