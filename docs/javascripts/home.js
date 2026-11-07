// The menu on the landing page (overrides/home.html). Listens on the document, so it keeps
// working after instant navigation swaps the page. Esc closes the dialog by itself.

document.addEventListener("click", e => {
  const menu = document.getElementById("site-menu");
  if (!menu) return;
  if (e.target.closest("#site-menu-open")) menu.showModal();
  else if (e.target === menu || e.target.closest("#site-menu-close")) menu.close();
});
