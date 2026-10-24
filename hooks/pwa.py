"""MkDocs hook that makes the built site an installable app that works offline.

After every build it fills in site/sw.js (from docs/sw.js) with the list of every file in
the site, the Google Fonts stylesheets the pages use, and a version stamp taken from the
files' contents, so each deploy that changes anything reaches installed apps.

Under `mkdocs serve` it does nothing: the dev server hands out docs/sw.js as is, and with
its empty file list that worker saves no site files, so edits always show up on reload.
"""

import hashlib
import json
import re
from pathlib import Path

SKIP = {"sw.js", "sitemap.xml.gz"}
LUNR = "assets/javascripts/lunr/"
FONT_CSS = re.compile(r"https://fonts\.googleapis\.com/css2?\?[^\"' )]+")

_command = "build"


def _offline(rel, search_langs):
    """Whether a built file belongs in the offline copy."""
    if rel in SKIP or rel.endswith(".map"):  # source maps are only for browser dev tools
        return False
    if rel.startswith(LUNR):
        # Search language packs load only for non-English search languages.
        extra = [lang for lang in search_langs if lang != "en"]
        name = rel[len(LUNR):].removeprefix("min/")
        needed = {"lunr.stemmer.support.min.js", "lunr.multi.min.js"} | {f"lunr.{lang}.min.js" for lang in extra}
        return bool(extra) and name in needed
    return True


def on_startup(command, dirty):
    global _command
    _command = command


def on_post_build(config):
    if _command == "serve":
        return
    site = Path(config["site_dir"])
    worker = site / "sw.js"

    search = next((p for name, p in config["plugins"].items() if name.endswith("search")), None)
    search_langs = (search.config.get("lang") if search else None) or ["en"]

    source = worker.read_text(encoding="utf-8")
    # The version covers the worker's own code too, so changing only sw.js still refreshes the cache.
    files, fonts, digest = [], set(), hashlib.sha256(source.encode())
    for path in sorted(p for p in site.rglob("*") if p.is_file()):
        rel = path.relative_to(site).as_posix()
        if path.name.startswith(".") or not _offline(rel, search_langs):
            continue
        data = path.read_bytes()
        digest.update(rel.encode() + b"\0" + data)
        # Pages are linked as directories (tools/verb-tables/), so cache them under that URL.
        if rel.endswith("index.html"):
            rel = rel[: -len("index.html")] or "./"
        files.append(rel)
        if path.suffix in (".html", ".css"):
            text = data.decode("utf-8", "ignore")
            fonts.update(url.replace("&amp;", "&") for url in FONT_CSS.findall(text))

    for marker, value in {
        '"/*__VERSION__*/dev"': json.dumps(digest.hexdigest()[:12]),
        "/*__FILES__*/[]": json.dumps(files, ensure_ascii=False),
        "/*__FONT_CSS__*/[]": json.dumps(sorted(fonts)),
    }.items():
        if marker not in source:
            raise ValueError(f"docs/sw.js is missing the {marker} placeholder")
        source = source.replace(marker, value)
    worker.write_text(source, encoding="utf-8")
