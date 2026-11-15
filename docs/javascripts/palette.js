// The colour theme picker. A theme is a set of colours in stylesheets/theme.css, light and dark,
// chosen by data-palette on <html>; the default has none. The light/dark toggle still picks
// between a theme's two sets.
//
// Loaded by every page (mkdocs.yml) and every app in docs/apps/ (in its <head>, so an app never
// shows the default first). Each document applies the saved choice itself; the pages also draw
// the button and the dialog, and pass a new choice into their frames (drill-frame.js does the
// same for frames that load later). overrides/main.html sets the attribute before the page draws.
// The choice is kept per device in localStorage ("palette").
(function () {
  const KEY = "palette";

  // BEGIN THEMES (scripts/build_themes.py)
  const THEMES = [
    {"id": "default", "name": "Default", "note": "Gruvbox, high contrast", "light": {"bg": "#f2e5bc", "surface": "#f9f5d7", "line": "#bdae93", "ink": "#282828", "accent": "#006598", "dots": ["#da5c00", "#0075af", "#888700", "#c64d89", "#c00009"]}, "dark": {"bg": "#1d2021", "surface": "#282828", "line": "#665c54", "ink": "#fbf1c7", "accent": "#5eb3cc", "dots": ["#ff7e07", "#5eb3cc", "#cfd300", "#e97599", "#ff7965"]}},
    {"id": "gruvbox", "name": "Gruvbox", "note": "the original", "light": {"bg": "#fbf1c7", "surface": "#f9f5d7", "line": "#ccbb98", "ink": "#3c3836", "accent": "#076678", "dots": ["#d65d0e", "#458588", "#908e05", "#b16286", "#9d0006"]}, "dark": {"bg": "#282828", "surface": "#32302f", "line": "#59524e", "ink": "#ebdbb2", "accent": "#87a99c", "dots": ["#fe8019", "#83a598", "#b8bb26", "#d3869b", "#ff6550"]}},
    {"id": "kanagawa", "name": "Kanagawa", "note": "Wave and Lotus", "light": {"bg": "#e5ddb0", "surface": "#f2ecbc", "line": "#bdb68b", "ink": "#545464", "accent": "#415c8d", "dots": ["#be6500", "#4d699b", "#6c854b", "#b35b79", "#be364b"]}, "dark": {"bg": "#1F1F28", "surface": "#2A2A37", "line": "#54546D", "ink": "#DCD7BA", "accent": "#82a0dc", "dots": ["#FFA066", "#7E9CD8", "#98BB6C", "#D27E99", "#e76b78"]}},
    {"id": "tokyonight", "name": "Tokyo Night", "note": "Night and Day", "light": {"bg": "#d0d5e3", "surface": "#e1e2e7", "line": "#a7adca", "ink": "#284fac", "accent": "#0051ae", "dots": ["#b15c00", "#2675e1", "#587539", "#9651ee", "#c9004c"]}, "dark": {"bg": "#1a1b26", "surface": "#1f2335", "line": "#404767", "ink": "#c0caf5", "accent": "#7aa2f7", "dots": ["#ff9e64", "#7aa2f7", "#9ece6a", "#bb9af7", "#f7768e"]}},
    {"id": "melange", "name": "Melange", "note": "warm", "light": {"bg": "#E9E1DB", "surface": "#F1F1F1", "line": "#c8b7ad", "ink": "#54433A", "accent": "#7c5400", "dots": ["#BC5C00", "#465AA4", "#3A684A", "#904180", "#BF0021"]}, "dark": {"bg": "#292522", "surface": "#34302C", "line": "#5d5247", "ink": "#ECE1D7", "accent": "#EBC06D", "dots": ["#E49B5D", "#A3A9CE", "#85B695", "#CF9BC2", "#dc7e6d"]}},
  ];
  // END THEMES

  const root = document.documentElement;
  let current = "default";

  function load() {
    try {
      const id = localStorage.getItem(KEY);
      return THEMES.some(t => t.id === id) ? id : "default";
    } catch (err) {
      return "default";
    }
  }

  function save(id) {
    try {
      if (id === "default") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, id);
    } catch (err) {}
  }

  // Apply a theme to this document. Anything unknown is the default.
  function use(id) {
    current = THEMES.some(t => t.id === id) ? id : "default";
    if (current === "default") root.removeAttribute("data-palette");
    else root.setAttribute("data-palette", current);
  }

  // Pass this document's theme into a frame that loads palette.js too.
  function sync(win) {
    try {
      win.Palette?.use(current);
    } catch (err) {}
  }

  function choose(id) {
    use(id);
    save(current);
    document.querySelectorAll("iframe").forEach(frame => sync(frame.contentWindow));
  }

  window.Palette = { THEMES, use, sync, choose, get current() { return current; } };
  use(load());
  addEventListener("storage", e => {
    if (e.key === KEY || e.key === null) use(load());
  });

  // The rest is the picker, on the site's pages only (not inside the apps' frames).
  const header = document.querySelector(".md-header__inner");
  if (!header) return;

  // Material Design Icons' "palette-outline" (Apache 2.0), also in overrides/app.html
  const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24" width="24" fill="currentColor" aria-hidden="true"><path d="M12 22A10 10 0 0 1 2 12 10 10 0 0 1 12 2c5.5 0 10 4 10 9a6 6 0 0 1-6 6h-1.8c-.3 0-.5.2-.5.5 0 .1.1.2.1.3.4.5.6 1.1.6 1.7.1 1.4-1 2.5-2.4 2.5m0-18a8 8 0 0 0-8 8 8 8 0 0 0 8 8c.3 0 .5-.2.5-.5 0-.2-.1-.3-.1-.4-.4-.5-.6-1-.6-1.6 0-1.4 1.1-2.5 2.5-2.5H16a4 4 0 0 0 4-4c0-3.9-3.6-7-8-7m-5.5 6c.8 0 1.5.7 1.5 1.5S7.3 13 6.5 13 5 12.3 5 11.5 5.7 10 6.5 10m3-4c.8 0 1.5.7 1.5 1.5S10.3 9 9.5 9 8 8.3 8 7.5 8.7 6 9.5 6m5 0c.8 0 1.5.7 1.5 1.5S15.3 9 14.5 9 13 8.3 13 7.5 13.7 6 14.5 6m3 4c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5-1.5-.7-1.5-1.5.7-1.5 1.5-1.5"/></svg>';

  // In the header, left of the Greek font button (greek-font.js) and the light/dark toggle. The
  // full-page apps draw their own button in their bar (overrides/app.html), since the header is hidden.
  const button = document.createElement("button");
  button.className = "md-header__button md-icon palette__open";
  button.type = "button";
  button.dataset.paletteOpen = "";
  button.title = "Colour theme";
  button.setAttribute("aria-label", "Colour theme");
  button.innerHTML = ICON;
  header.insertBefore(button, header.querySelector(".greek-font__open") || header.querySelector('[data-md-component="palette"]'));

  // A theme's light or dark set in miniature: its card on its page, a Greek word with the ending
  // in the accent colour, and five of its colours.
  const preview = (set, label) => `
    <span class="palette__preview" style="background:${set.bg};border-color:${set.line}" title="${label}" aria-hidden="true">
      <span class="palette__card" style="background:${set.surface};border-color:${set.line};color:${set.ink}">
        <span lang="el">γράφ<span style="color:${set.accent}">ω</span></span>
        <span class="palette__dots">${set.dots.map(c => `<i style="background:${c}"></i>`).join("")}</span>
      </span>
    </span>`;

  let dialog = null;

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "picker";
    dialog.setAttribute("aria-label", "Colour theme");
    dialog.innerHTML = `<form method="dialog">
      <h2>Colour theme</h2>
      <p>For the notes, the drills and the dictionary. Each theme has a light and a dark version; the sun and moon button switches between them. Saved on this device.</p>
      <div class="picker__options">${THEMES.map(theme => `
        <label class="picker__option palette__option">
          <input type="radio" name="palette" value="${theme.id}">
          <span class="picker__name">${theme.name}<small>${theme.note}</small></span>
          <span class="palette__previews">${preview(theme.light, "Light")}${preview(theme.dark, "Dark")}</span>
        </label>`).join("")}
      </div>
      <button class="picker__done" value="done">Done</button>
    </form>`;
    dialog.addEventListener("change", e => choose(e.target.value));
    dialog.addEventListener("click", e => {
      if (e.target === dialog) dialog.close();
    });
    document.body.append(dialog);
  }

  document.addEventListener("click", e => {
    if (!e.target.closest("[data-palette-open]")) return;
    if (!dialog) build();
    dialog.querySelectorAll("input").forEach(input => { input.checked = input.value === current; });
    dialog.showModal();
  });
})();
