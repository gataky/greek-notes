// Register the service worker (docs/sw.js, filled in by hooks/pwa.py) so the site
// keeps working offline and can be added to a phone's home screen.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("../sw.js", document.currentScript.src));
}

// The phone's status and navigation bars take the page's background. overrides/main.html sets
// theme-color for the phone's light or dark setting; when the site's own toggle picks the other
// one, both tags take the background actually shown, read from theme.css's --bg on the body.
(function () {
  const metas = [...document.querySelectorAll('meta[name="theme-color"][media]')];
  if (!metas.length) return;
  const sync = () => {
    const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim();
    if (bg) metas.forEach(meta => meta.setAttribute("content", bg));
  };
  sync();
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["data-md-color-scheme"] });
})();
