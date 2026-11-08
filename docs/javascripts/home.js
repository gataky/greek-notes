// The buttons on the landing page (overrides/home.html). Listens on the document, so they keep
// working after instant navigation swaps the page. Esc closes the menu dialog by itself.

// The theme button picks the next of Material's palettes (mkdocs.yml). Their radio inputs are still
// in the hidden site header, so choosing one there saves the choice for every page the same way
// the header's own toggle does, and drill-frame.js passes it into the dictionary.
// The current palette comes from the page, not the inputs: on a first visit Material follows the
// system setting without checking either input.
function nextPalette() {
  const inputs = [...document.querySelectorAll('[data-md-component="palette"] input[name="__palette"]')];
  if (!inputs.length) return null;
  const scheme = document.body.getAttribute("data-md-color-scheme");
  const current = inputs.findIndex(input => input.getAttribute("data-md-color-scheme") === scheme);
  return inputs[(current + 1) % inputs.length];
}

document.addEventListener("click", e => {
  if (e.target.closest("#site-theme")) {
    nextPalette()?.click();
    return;
  }
  const menu = document.getElementById("site-menu");
  if (!menu) return;
  if (e.target.closest("#site-menu-open")) menu.showModal();
  else if (e.target === menu || e.target.closest("#site-menu-close")) menu.close();
});
