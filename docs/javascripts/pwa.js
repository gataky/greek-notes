// Register the service worker (docs/sw.js, filled in by hooks/pwa.py) so the site
// keeps working offline and can be added to a phone's home screen.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("../sw.js", document.currentScript.src));
}
