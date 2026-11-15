// Embedded drills: hide their own header, size the frame to its content and
// follow the site's light/dark toggle, colour theme (palette.js) and Greek font (greek-font.js).

function syncTheme(doc) {
  const dark = document.body.getAttribute("data-md-color-scheme") === "slate";
  doc.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function setupFrame(frame) {
  const doc = frame.contentDocument;
  if (!doc || !doc.body) return;

  const header = doc.querySelector("header");
  if (header && !frame.hasAttribute("data-keep-header")) header.hidden = true;

  syncTheme(doc);
  window.GreekFont?.sync(frame.contentWindow);
  window.Palette?.sync(frame.contentWindow);
  new MutationObserver(() => syncTheme(doc)).observe(document.body, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"],
  });

  // The frame is as tall as the app, and the page scrolls, never the frame. A frame that can
  // scroll at all, even by a fraction of a pixel, takes a trackpad gesture that starts over it
  // and keeps it until the fingers lift, so the page would need a second swipe. So the height
  // is the exact one rounded up (offsetHeight rounds first, 784.4 to 784, which left 0.4px to
  // scroll), and the app's own page can't scroll at all, even while the frame catches up with
  // a change in its height.
  frame.setAttribute("scrolling", "no");
  doc.documentElement.style.overflow = "hidden";
  const fit = () => { frame.style.height = Math.ceil(doc.body.getBoundingClientRect().height) + "px"; };
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
