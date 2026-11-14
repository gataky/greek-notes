"""MkDocs hook that splits the site into three installable apps: the dictionary, the drills,
and the notes (the grammar and the tools). Each has its own manifest in its folder, and a page
belongs to the app whose folder holds it; the notes app has the rest of the site.

For every page it gives the templates `app` (the names from that app's manifest, used by
overrides/main.html), the app's name as the site name, and a nav with only that app's pages,
so the menu stays inside it. One service worker (docs/sw.js) still serves all three.
"""

import copy
import json
from pathlib import Path

from mkdocs.structure.nav import Navigation

# Folder of each app, most specific first: the notes' "" matches every page.
APPS = {"dictionary": "dictionary/", "drills": "drills/", "notes": ""}

_apps = {}


def app_of(url):
    return next(name for name, path in APPS.items() if url.startswith(path))


def _first_page(item):
    if item.is_page:
        return item
    for child in getattr(item, "children", None) or []:
        page = _first_page(child)
        if page:
            return page
    return None


def on_config(config):
    _apps.clear()
    for name, path in APPS.items():
        manifest = json.loads((Path(config["docs_dir"]) / path / "manifest.webmanifest").read_text(encoding="utf-8"))
        _apps[name] = {"id": name, "path": path, "name": manifest["name"], "short_name": manifest["short_name"]}


def on_page_context(context, page, config, nav):
    name = app_of(page.url)
    items = [item for item in nav.items if (first := _first_page(item)) and app_of(first.url) == name]
    app_nav = Navigation(items, [p for p in nav.pages if app_of(p.url) == name])
    # The logo links to the app's own home page.
    app_nav.homepage = next((p for p in app_nav.pages if p.url == APPS[name]), None)

    site = copy.copy(config)
    site["site_name"] = _apps[name]["name"]
    context.update(nav=app_nav, config=site, app=_apps[name])
    return context
