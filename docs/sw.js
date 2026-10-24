// Service worker: keeps a copy of the whole site so the installed app works offline.
// hooks/pwa.py fills in VERSION, FILES and FONT_CSS after every build; a new VERSION
// makes browsers install the new copy and drop the old one. Left unfilled (as under
// `mkdocs serve`), FILES is empty, so no site files are saved and requests go to the server.

const VERSION = "/*__VERSION__*/dev";
const FILES = /*__FILES__*/[];
const FONT_CSS = /*__FONT_CSS__*/[];

const SITE_CACHE = `site-${VERSION}`;
const FONT_CACHE = "fonts";  // Google's font files never change, so this one is kept across versions
const FONT_SUBSETS = /^\/\* (latin|latin-ext|greek|greek-ext) \*\//;

const scoped = path => new URL(path, self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SITE_CACHE);
    await cache.addAll(FILES.map(path => new Request(scoped(path), { cache: "reload" })));
    await cacheFonts().catch(() => {});  // nice to have; the text still shows in a fallback font
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SITE_CACHE && key !== FONT_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(fromSite(request));
  else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(fromFonts(request));
});

// Site files come from the cached copy; anything not in it goes to the network, and an
// unknown page while offline gets the 404 page.
async function fromSite(request) {
  const cache = await caches.open(SITE_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (err) {
    if (request.mode === "navigate") {
      const notFound = await cache.match(scoped("404.html"));
      if (notFound) return notFound;
    }
    throw err;
  }
}

async function fromFonts(request) {
  const cache = await caches.open(FONT_CACHE);
  // Google varies its CSS on request headers that differ between the page and this worker.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// Fetch the stylesheets the pages use and the font files they point to, keeping only the
// Latin and Greek subsets so the download stays small.
async function cacheFonts() {
  const cache = await caches.open(FONT_CACHE);
  for (const cssUrl of FONT_CSS) {
    const response = await fetch(cssUrl);
    if (!response.ok) continue;
    const css = await response.clone().text();
    await cache.put(cssUrl, response);
    const fontUrls = css.split(/(?=\/\* )/)
      .filter(block => FONT_SUBSETS.test(block))
      .flatMap(block => [...block.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]));
    await Promise.all(fontUrls.map(async fontUrl => {
      if (await cache.match(fontUrl)) return;
      const font = await fetch(fontUrl);
      if (font.ok) await cache.put(fontUrl, font);
    }));
  }
}
