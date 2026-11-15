"""MkDocs hook: the notes and tools moved under notes/ (grammar/articles/ is now
notes/grammar/articles/). After each build it writes a page at every old address that sends the
browser on to the new one, keeping the #fragment, so links and bookmarks from before still work
(tools/verb-tables/#γράφω opens γράφω).

Runs before hooks/pwa.py, so the service worker caches these pages too.
"""

import os
from pathlib import Path

# Old folder -> where it is now, both relative to the site
MOVED = {"grammar/": "notes/grammar/", "tools/": "notes/tools/"}

PAGE = """<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Moved</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{href}">
<script>location.replace({href!r} + location.hash);</script>
<meta http-equiv="refresh" content="0; url={href}">
<p>This page has moved: <a href="{href}">{href}</a>.</p>
</html>
"""


def on_post_build(config):
    site = Path(config["site_dir"])
    for old, new in MOVED.items():
        for page in sorted((site / new).rglob("index.html")):
            folder = page.parent.relative_to(site / new)
            stub = site / old / folder / "index.html"
            if stub.exists():
                raise RuntimeError(f"redirects: {stub} is a real page; not overwriting it")
            href = os.path.relpath(page.parent, stub.parent).replace(os.sep, "/") + "/"
            stub.parent.mkdir(parents=True, exist_ok=True)
            stub.write_text(PAGE.format(href=href), encoding="utf-8")
