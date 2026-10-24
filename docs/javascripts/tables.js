// Mark Markdown table cells that contain Greek with lang="el", so tables.css can set them
// in the Greek font and mute the English glosses beside them (and screen readers read
// them as Greek). Headings with Greek get .has-greek so they aren't uppercased:
// uppercase turns ν into Ν (which reads as N) and drops accents.
const GREEK = /[Ͱ-Ͽ]/;

document$.subscribe(() => {
  document.querySelectorAll(".md-typeset table:not([class]) :is(td, th)").forEach(cell => {
    if (!GREEK.test(cell.textContent)) return;
    if (cell.tagName === "TD") cell.lang = "el";
    else cell.classList.add("has-greek");
  });
});
