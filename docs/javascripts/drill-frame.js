// Embedded drills: hide their own header, size the frame to its content and
// follow the site's light/dark toggle.

function syncTheme(doc) {
  const dark = document.body.getAttribute("data-md-color-scheme") === "slate";
  doc.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function setupFrame(frame) {
  const doc = frame.contentDocument;
  if (!doc || !doc.body) return;

  const header = doc.querySelector("header");
  if (header) header.hidden = true;

  syncTheme(doc);
  new MutationObserver(() => syncTheme(doc)).observe(document.body, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"],
  });

  const fit = () => { frame.style.height = Math.ceil(doc.body.offsetHeight) + "px"; };
  new ResizeObserver(fit).observe(doc.body);
  fit();
}

document$.subscribe(() => {
  // Frames marked data-pass-hash get the page's #fragment, so ../verb-tables/#γράφω opens that verb.
  if (location.hash) {
    document.querySelectorAll("iframe.drill-frame[data-pass-hash]").forEach(frame => {
      frame.src = frame.getAttribute("src").split("#")[0] + location.hash;
    });
  }
  document.querySelectorAll("iframe.drill-frame").forEach(frame => {
    frame.addEventListener("load", () => setupFrame(frame));
    if (frame.contentDocument && frame.contentDocument.readyState === "complete") setupFrame(frame);
  });
});
