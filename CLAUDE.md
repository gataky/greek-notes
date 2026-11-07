# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal Modern Greek study notes: an MkDocs Material site deployed to GitHub Pages (https://gataky.github.io/greek-notes/) by `.github/workflows/deploy.yml` on every push to `main`.

## Commands

Tools are pinned in `.tool-versions` (asdf: Python, Node, uv); Python packages in `pyproject.toml` + `uv.lock`. `.envrc` (direnv) loads them and `.venv`; the Makefile works without direnv.

```sh
make install   # uv sync
make serve     # dev server at http://127.0.0.1:8000
make build     # mkdocs build --strict (CI fails on any warning)
make check     # verb + dictionary checks, then strict build: what CI runs before deploying
make test      # node scripts/test_verbs.js and scripts/test_dictionary.js
make dump      # print every verb's conjugations for review
make sync      # pull verbs from the Google Sheet into docs/tools/verbs.json, then test
make dictionary  # gzip a new lemma dictionary build into docs/tools/, then test
make upgrade   # uv lock --upgrade
```

There is no per-test runner: `scripts/test_verbs.js` checks a table of hand-verified forms (`EXPECTED`) and prints each mismatch. To check one verb, add or edit its entry there.

uv is configured with `python-preference = "only-system"`, so it uses asdf's Python from `.tool-versions` (and setup-python's in CI) instead of downloading one. uv does not read `.tool-versions` itself. MkDocs is capped below 2.0 because Material doesn't support 2.0.

## Content

- Notes are Markdown in `docs/`. Each must be added to `nav` in `mkdocs.yml`, which also builds the menu on the home page.
- Every table on the note pages is styled by `docs/stylesheets/tables.css` to match the verb grid (`docs/tools/verb-grid.css`). Keep the two looking alike: card, uppercase headings, row rules, accent highlights.
  - **Plain Markdown tables** need no markup. `docs/javascripts/tables.js` sets `lang="el"` on cells with Greek, which get the Greek font while the other cells in that table are muted as glosses. Bold inside Greek cells shows in the accent colour. Header cells with Greek aren't uppercased.
  - **Grid layouts** (paradigms with grouped columns) are hand-written HTML: `<div class="grid-card"><table class="grid">` with `th.group`/`th.sub`, `td.who` row labels, `td.gloss`, `span.end` (accent), `span.pre` (muted), `td.gap` spacer columns, and an optional `p.grid-note` underneath. Row labels can shorten on phones: `masc<span class="full">uline</span><span class="abbr">.</span>`.
  - Greek uses a self-hosted Greek-only subset of GFS Didot (`docs/fonts/`, OFL) registered as "Greek Didot" with a Greek `unicode-range`, so Latin in the same cell falls through to Commissioner.
- Interactive pages are standalone HTML apps embedded in a Markdown page with `<iframe class="drill-frame" src="../x-app.html">`. `docs/javascripts/drill-frame.js` (loaded site-wide) hides the app's `<header>`, sizes the iframe to its content, and syncs the light/dark theme by setting `data-theme` on the app's root. Apps therefore define colour tokens on `:root` with dark variants under both `prefers-color-scheme` and `[data-theme="dark"]`. Add `data-pass-hash` to an iframe to forward the page's `#fragment` into it, which is how `tools/verb-tables/#γράφω` opens a verb. Add `data-keep-header` to keep the app's header showing.

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
- Large data files (`*.db.gz`, the dictionary) stay out of the file list and the version stamp. The hook lists them in `DATA` with their own content hash, and the worker keeps them in a separate `data` cache, so a deploy doesn't download them again unless they changed.
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
5. **Pages:** `verb-tables-app.html` (search, a list grouped by class, URL hash = current verb) and `conjugation-patterns-app.html` (one regular example verb per class; the c3/c4 examples are defined inline because they aren't in the sheet).

When changing the engine, run `make test` and also diff all generated forms against the previous commit's engine. Most verbs aren't in `EXPECTED`, so the checks alone can miss regressions.

## Dictionary (`docs/tools/dictionary-app.html`)

A Greek ↔ English dictionary that runs entirely in the browser. It's the home page, so `/#σπίτι` opens a word.

- **Home page:** `docs/index.md` is only the iframe. Its template, `overrides/home.html`, adds a menu button and a `<dialog>` built from `nav` (`docs/javascripts/home.js`). `docs/stylesheets/home.css` hides the site's header and footer with `body:has(.dict-home)`. They stay in the page because instant navigation needs them. The point is that the site looks like a dictionary until you open the menu, so don't add links to the notes there.

- **Data:** `lemma_greek_en.db.gz` is the lemma SQLite dictionary (schema version 2, built from English Wiktionary via kaikki.org, CC BY-SA, so the page credits it), gzipped. The owner's copy and its developer guide (`sqlite-database.md`) are in `../dictionary/`. It changes about once a year: `make dictionary`. Never write to the database, and refer to words by spelling (`#σπίτι`), since row ids change between builds.
- **Engine:** sql.js 1.14.2 is vendored in `docs/tools/vendor/` (no CDN, so it works offline). The app unzips the file with `DecompressionStream` and opens it in memory.
- **`greek-dictionary.js`** (browser and Node) ports the guide's Python reference: the `norm`/`phonetic`/Greeklish/English keys, Greek and English search, entry lookup. The keys must match the stored ones exactly; `scripts/test_dictionary.js` recomputes them for every form. sql.js has no FTS5, so the English fallback for terms missing from `en_index` scans glosses with `LIKE` instead of using `sense_fts`.
- **`dictionary-app.html`:** one search box. Greek input searches Greek. Latin input shows English and Greeklish results side by side, since it could be either. The hash is the open headword. Greek words in glosses link to their entries, and verbs in `verbs.json` link to `verb-tables-app.html` inside the same frame, so the notes' sidebar doesn't appear. Its header has a link back to the entry, which the notes page hides along with the header.
- **Verbs not in the sheet** also link to the verb tables, as `verb-tables-app.html#καπνίζω,καπνίσω,κάπνισα`. The verb tables page conjugates those parts and shows a "guessed" note.
  - `principalParts()` works out the future and aorist from the dictionary's forms, which carry no labels. It tries each candidate pair through `greek-verbs.js` and keeps the one whose generated forms the dictionary also lists.
  - Candidates are filtered first: the aorist must share the future's consonants (κάπνισα/καπνίσω, not the imperfect κάπνιζα), and the verb's own present and imperfect, variant presents that are headwords, and unaccented forms are skipped.
  - It returns null when unsure, and then there's no link. `test_dictionary.js` checks it against the sheet's hand-entered parts, so re-run it after changing the engine.
