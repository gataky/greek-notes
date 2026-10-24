# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal Modern Greek study notes: an MkDocs Material site deployed to GitHub Pages (https://gataky.github.io/greek-notes/) by `.github/workflows/deploy.yml` on every push to `main`.

## Commands

Tools are pinned in `.tool-versions` (asdf: Python, Node, uv); Python packages in `pyproject.toml` + `uv.lock`. `.envrc` (direnv) loads them and `.venv`; the Makefile works without direnv.

```sh
make install   # uv sync
make serve     # dev server at http://127.0.0.1:8000
make build     # mkdocs build --strict (CI fails on any warning)
make check     # verb checks + strict build: what CI runs before deploying
make test      # node scripts/test_verbs.js
make dump      # print every verb's conjugations for review
make sync      # pull verbs from the Google Sheet into docs/tools/verbs.json, then test
make upgrade   # uv lock --upgrade
```

There is no per-test runner: `scripts/test_verbs.js` checks a table of hand-verified forms (`EXPECTED`) and prints each mismatch. To check one verb, add or edit its entry there.

uv is configured with `python-preference = "only-system"`, so it uses asdf's Python from `.tool-versions` (and setup-python's in CI) instead of downloading one. uv does not read `.tool-versions` itself. MkDocs is capped below 2.0 because Material doesn't support 2.0.

## Content

- Notes are Markdown in `docs/`. Each must be added to `nav` in `mkdocs.yml` and linked from `docs/index.md`.
- Grammar tables are raw HTML (`<div class="sheet-wrap"><table class="sheet">`) styled by `docs/stylesheets/sheet.css` to mirror the layout of the owner's Google Sheet. Border and colour classes include `r1`/`r3`/`b1`/`b3`/`bd` and `nom`/`acc`/`gen`.
- Interactive pages are standalone HTML apps embedded in a Markdown page with `<iframe class="drill-frame" src="../x-app.html">`. `docs/javascripts/drill-frame.js` (loaded site-wide) hides the app's `<header>`, sizes the iframe to its content, and syncs the light/dark theme by setting `data-theme` on the app's root. Apps therefore define colour tokens on `:root` with dark variants under both `prefers-color-scheme` and `[data-theme="dark"]`. Add `data-pass-hash` to an iframe to forward the page's `#fragment` into it, which is how `tools/verb-tables/#γράφω` opens a verb.

## Offline app (PWA)

The whole site installs as a phone app and works offline:
- `overrides/main.html` (theme `custom_dir`) adds the manifest (`docs/manifest.webmanifest`) and home-screen tags. Icons are in `docs/app/`.
- `docs/javascripts/pwa.js` registers `docs/sw.js`.
- `hooks/pwa.py` (an MkDocs hook, so it also runs in CI) fills placeholders in the built `sw.js` after every build:
  - the list of every built file, skipping `*.map` and lunr language packs for languages search doesn't use;
  - the Google Fonts stylesheets found in the pages;
  - a version stamp: a hash of every listed file plus the worker's own source.
- A new stamp makes installed apps cache the new copy and delete the old one. The worker also caches the Latin and Greek font subsets, kept across versions.
- Nothing needs updating when pages are added. Pages are cached under their directory URL (`tools/verb-tables/`), matching how they're linked.
- `mkdocs serve` hands out the unfilled `docs/sw.js`. Its empty file list caches nothing, so dev edits show on reload; keep the template valid JS for that reason.

## Verb tables (`docs/tools/`)

Data flows from sheet to JSON to the browser. There is no backend.

1. **Source:** the `words` tab of the owner's Google Sheet (link-shared; ID in `scripts/build_verbs.py` and the Makefile). Rows with part of speech exactly `verb` (not a substring match, which would also catch `adverb`). The fields used are `greek` (dictionary form), `attributes` (class a1/a2/b1/b2/c1–c4/irregular), `voice`, plus three columns the owner added for this: `future simple` (1sg, e.g. γράψω / γραφτώ), `aorist` (1sg, e.g. έγραψα / γράφτηκα) and `overrides`. Other scripts depend on the sheet's column order, so new columns go after the existing ones. Columns are read by header name.
2. **`scripts/build_verbs.py`** (stdlib only) downloads the CSV export, merges duplicate verbs, and writes `verbs.json` one verb per line. `verbs.json` is committed; the site never contacts the sheet.
3. **`greek-verbs.js`** is the conjugation engine (works in the browser and in Node). It derives every form from the dictionary form plus the two principal parts:
   - The pattern is detected from the ending; the sheet's class only breaks ties (πάω is a2, αγαπάω is b1) and a mismatch produces a note.
   - Accent rules work on syllable nuclei (digraphs, and an unaccented ι before a vowel is a glide). Past tenses use recessive accent, and the augment survives only while it carries the accent (έγραψα/γράψαμε, παρέλαβα/παραλάβαμε). One-syllable forms lose their accent.
   - Forms are strings with `|` between stem and ending (`γράψ|ουμε`). The UI uses this to highlight endings and tests strip it. Cells are arrays of alternatives (μιλάω / μιλώ); `ουν(ε)` notation collapses optional letters.
   - Per-verb exceptions come only from the `overrides` column: `past: ήθελα; imp: έλα, ελάτε; imp-cont: …; no perfective` (`—` means not used). Prefer an override over special-casing a verb in code; only είμαι is hardcoded.
4. **`verb-grid.js` + `verb-grid.css`** render the shared "two stems" grid: continuous and simple, each with present/dependent and past columns, plus imperative and perfect rows and the θα/να forms written out. It switches to stacked tables below 560px.
5. **Pages:** `verb-tables-app.html` (search, random, a list grouped by class, URL hash = current verb) and `conjugation-patterns-app.html` (one regular example verb per class; the c3/c4 examples are defined inline because they aren't in the sheet).

When changing the engine, run `make test` and also diff all generated forms against the previous commit's engine. Most verbs aren't in `EXPECTED`, so the checks alone can miss regressions.
