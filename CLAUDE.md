# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal Modern Greek study notes: an MkDocs Material site deployed to GitHub Pages (https://gataky.github.io/greek-notes/) by `.github/workflows/deploy.yml` on every push to `main`.

## Layout

```
docs/                   the site (MkDocs serves everything here)
  index.md              home page: the dictionary app
  grammar/              notes (articles.md ..., pronouns/)
  drills/, tools/       pages that embed an app; their URLs are linked from outside, keep them
  apps/                 standalone HTML apps, embedded by the pages above
  javascripts/          all JS: site-wide scripts (listed in mkdocs.yml) and the apps' modules
  stylesheets/          all CSS: site-wide (listed in mkdocs.yml) and verb-grid.css for the apps
  data/                 JSON and the gzipped dictionary the apps fetch
  vendor/sql.js/        third-party code, vendored for offline use
  fonts/, icons/        self-hosted Greek font, app icons
  manifest.webmanifest, sw.js   must stay at the site root (service worker scope)
overrides/              theme templates (custom_dir)
hooks/                  MkDocs hooks
scripts/                build_*.py: write the files in docs/data/
tests/                  node test_*.js, run by make test and CI
sqlite-database.md      the lemma dictionary's developer guide (a copy)
```

Put new files by type, not next to the page that uses them. Apps refer to the rest with `../javascripts/`, `../stylesheets/`, `../data/` and `../vendor/`. Don't name a folder `assets/`: Material writes its own files there.

## Commands

Tools are pinned in `.tool-versions` (asdf: Python, Node, uv); Python packages in `pyproject.toml` + `uv.lock`. `.envrc` (direnv) loads them and `.venv`; the Makefile works without direnv.

```sh
make install   # uv sync
make serve     # dev server at http://127.0.0.1:8000
make build     # mkdocs build --strict (CI fails on any warning)
make check     # all tests, then strict build: what CI runs before deploying
make test      # node tests/test_verbs.js, test_verb_forms.js, test_voice_sentences.js and test_dictionary.js
make dump      # print every verb's conjugations for review
make sync      # pull verbs from the Google Sheet into docs/data/verbs.json, then test
make dictionary  # gzip a new lemma dictionary build into docs/data/, then test
make verb-forms  # copy our verbs' forms from the dictionary into docs/data/verb-forms.json, then test
make upgrade   # uv lock --upgrade
```

There is no per-test runner: `tests/test_verbs.js` checks a table of hand-verified forms (`EXPECTED`) and prints each mismatch. To check one verb, add or edit its entry there.

uv is configured with `python-preference = "only-system"`, so it uses asdf's Python from `.tool-versions` (and setup-python's in CI) instead of downloading one. uv does not read `.tool-versions` itself. MkDocs is capped below 2.0 because Material doesn't support 2.0.

## Content

- Notes are Markdown in `docs/grammar/`. Each must be added to `nav` in `mkdocs.yml`, which also builds the menu on the home page. A note's path is its URL (`grammar/articles.md` is `grammar/articles/`), so moving or renaming one breaks links to it.
- Every table on the note pages is styled by `docs/stylesheets/tables.css` to match the verb grid (`docs/stylesheets/verb-grid.css`). Keep the two looking alike: card, uppercase headings, row rules, accent highlights.
  - **Plain Markdown tables** need no markup. `docs/javascripts/tables.js` sets `lang="el"` on cells with Greek, which get the Greek font while the other cells in that table are muted as glosses. Bold inside Greek cells shows in the accent colour. Header cells with Greek aren't uppercased.
  - **Grid layouts** (paradigms with grouped columns) are hand-written HTML: `<div class="grid-card"><table class="grid">` with `th.group`/`th.sub`, `td.who` row labels, `td.gloss`, `span.end` (accent), `span.pre` (muted), `td.gap` spacer columns, and an optional `p.grid-note` underneath. Row labels can shorten on phones: `masc<span class="full">uline</span><span class="abbr">.</span>`.
  - Greek uses a self-hosted Greek-only subset of GFS Didot (`docs/fonts/`, OFL) registered as "Greek Didot" with a Greek `unicode-range`, so Latin in the same cell falls through to Commissioner.
- Interactive pages are standalone HTML apps in `docs/apps/`, embedded in a Markdown page with `<iframe class="drill-frame" src="../../apps/x.html">` (relative to the page's URL, `tools/x/`). `docs/javascripts/drill-frame.js` (loaded site-wide) hides the app's `<header>`, sizes the iframe to its content, and syncs the light/dark theme by setting `data-theme` on the app's root. Apps therefore define colour tokens on `:root` with dark variants under both `prefers-color-scheme` and `[data-theme="dark"]`. Add `data-pass-hash` to an iframe to forward the page's `#fragment` into it, which is how `tools/verb-tables/#γράφω` opens a verb. Add `data-keep-header` to keep the app's header showing.

## Offline app (PWA)

The whole site installs as a phone app and works offline:
- `overrides/main.html` (theme `custom_dir`) adds the manifest (`docs/manifest.webmanifest`) and home-screen tags. Icons are in `docs/icons/`.
- `docs/javascripts/pwa.js` registers `docs/sw.js`.
- `hooks/pwa.py` (an MkDocs hook, so it also runs in CI) fills placeholders in the built `sw.js` after every build:
  - the list of every built file, skipping `*.map` and lunr language packs for languages search doesn't use;
  - the Google Fonts stylesheets found in the pages;
  - a version stamp: a hash of every listed file plus the worker's own source.
- A new stamp makes installed apps cache the new copy and delete the old one. The worker also caches the Latin and Greek font subsets, kept across versions.
- Nothing needs updating when pages are added. Pages are cached under their directory URL (`tools/verb-tables/`), matching how they're linked.
- Large data files (`*.db.gz`, the dictionary) stay out of the file list and the version stamp. The hook lists them in `DATA` with their own content hash, and the worker keeps them in a separate `data` cache, so a deploy doesn't download them again unless they changed.
- `mkdocs serve` hands out the unfilled `docs/sw.js`. Its empty file list caches nothing, so dev edits show on reload; keep the template valid JS for that reason.

## Verb tables (`docs/tools/`, `docs/apps/verb-tables.html`)

Data flows from the sheet and the dictionary to JSON to the browser. There is no backend. **The dictionary is the source of truth for forms:** the verb tables page shows its cells, and the engine and sheet only fill what it doesn't have.

1. **Source:** the `words` tab of the owner's Google Sheet (link-shared; ID in `scripts/build_verbs.py` and the Makefile). Rows with part of speech exactly `verb` (not a substring match, which would also catch `adverb`). The fields used are `greek` (dictionary form), `attributes` (class a1/a2/b1/b2/c1–c4/irregular), `voice`, plus three columns the owner added for this: `future simple` (1sg, e.g. γράψω / γραφτώ), `aorist` (1sg, e.g. έγραψα / γράφτηκα) and `overrides`. Other scripts depend on the sheet's column order, so new columns go after the existing ones. Columns are read by header name.
2. **`scripts/build_verbs.py`** (stdlib only) downloads the CSV export, merges duplicate verbs, and writes `verbs.json` one verb per line. `verbs.json` is committed; the site never contacts the sheet.
3. **`greek-verbs.js`** is the conjugation engine (works in the browser and in Node). It derives every form from the dictionary form plus the two principal parts:
   - The pattern is detected from the ending; the sheet's class only breaks ties (πάω is a2, αγαπάω is b1) and a mismatch produces a note.
   - Accent rules work on syllable nuclei (digraphs, and an unaccented ι before a vowel is a glide). Past tenses use recessive accent, and the augment survives only while it carries the accent (έγραψα/γράψαμε, παρέλαβα/παραλάβαμε). One-syllable forms lose their accent.
   - Forms are strings with `|` between stem and ending (`γράψ|ουμε`). The UI uses this to highlight endings and tests strip it. Cells are arrays of alternatives (μιλάω / μιλώ); `ουν(ε)` notation collapses optional letters.
   - Per-verb exceptions come only from the `overrides` column: `past: ήθελα; imp: έλα, ελάτε; imp-cont: …; no perfective` (`—` means not used). Prefer an override over special-casing a verb in code; only είμαι is hardcoded.
4. **`verb-grid.js` + `verb-grid.css`** render the shared "two stems" grid: continuous and simple, each with present/dependent and past columns, plus imperative and perfect rows and the θα/να forms written out. It switches to stacked tables below 560px.
5. **Pages:** `apps/verb-tables.html` (search, a list grouped by class, URL hash = current verb) and `apps/conjugation-patterns.html` (one regular example verb per class; the c3/c4 examples are defined inline because they aren't in the sheet).

6. **`scripts/build_verb_forms.py`** (stdlib `sqlite3`, read-only) copies the grid's cells from the lemma database into the committed `verb-forms.json` (about 2,500 verbs, 2.9 MB, 320 KB gzipped), so the verb tables page doesn't load the dictionary. It has the sheet's verbs, keyed by the sheet's spelling, and every other verb headword it can find a table for. The verb tables page reads the forms; the dictionary page only reads which verbs are there.
   - Refresh with `make verb-forms` (about a minute) after `make dictionary`, and after `make sync` adds verbs. A verb missing from the file just shows the engine's forms. `DICT_DB` sets the database path.
   - Finding a table: the headword's own, then `form` (βοηθώ → βοηθάω), then the headword line's `active` link (σηκώνομαι → σηκώνω, whose passive cells are used), then the sheet's `active form`. With several tables, it takes the one listing the verb first.
   - The voice comes from which voice's present lists the verb, not from the sheet: deponents are tagged `passive`, but είμαι is `active`.
   - Rows tagged `rare`, `archaic` or `dated` are hidden unless the cell has nothing else. Elisions (`γράφ'`) are left out. The script prints anything it can't read.
   - A cell is a list, most usual first. `[]` means the form doesn't exist (a dash), `null` that the data doesn't say.
7. **`verb-forms.js`** (browser and Node) merges those cells over `conjugate()`, keeping its shape, and `cardHTML(verb, { conjugation })` shows the result.
   - A dictionary cell replaces the engine's, overrides included, and the dictionary's order is kept. The engine and its overrides only show in `null` cells and for the 6 sheet verbs with no table. There's no way yet to correct a dictionary form per verb.
   - `dictionaryVerb()` makes the verb object for a verb that isn't in the sheet: its principal parts are its table's 1st singular dependent and past (or `no perfective` without either), and the engine's notes about sheet columns are dropped.
   - The future, subjunctive and perfect are built from the merged present, dependent and `infinitive-aorist`.
   - The result's `generated` flags the cells the engine filled where the dictionary had nothing, and the grid marks them with an orange `*` and a footnote. Blank engine cells aren't flagged. A sheet verb with no table, and a dictionary verb with no simple stem at all, get one note each above the grid instead.
   - Ending highlights come from the engine's forms in the same cell: same word, else same ending, else same stem, else none.
   - `apps/conjugation-patterns.html` and the drill still use the engine alone, so they can differ from the verb tables.

When changing the engine, run `make test` and also diff all generated forms against the previous commit's engine. Most verbs aren't in `EXPECTED`, so the checks alone can miss regressions.

## Active or passive drill (`docs/drills/`, `docs/apps/passive-verbs.html`)

Present tense: an English sentence, and the learner types the Greek verb, choosing the active or the -μαι form and the person. It replaced an older conjugation-only passive drill and kept its URL (`drills/passive-verbs/`), so links and installed apps still work.

- **Verbs:** the sheet's passives whose `active form` is also in the sheet, those active partners, and the deponents except είμαι.
- **Sentences:** `voice-sentences.json`, one object per line: `verb` (dictionary form), `person` (`1sg`…`3pl`), `reason`, `en`, `el`, and an optional `note`. Reasons are `object` or `intransitive` for active verbs, `self`, `each`, `done` or `happens` for passives, and `deponent`. Nothing else is stored: the voice, the active partner, which word is the answer and the paradigm all come from `verbs.json` through `greek-verbs.js`. Sentences use only words from the words tab.
- **`voice-drill.js`** (browser and Node) has the logic the page and the test share: present forms with `ουν(ε)` expanded, finding the answer word in a sentence, and grading (correct, accent, spelling, wrong person, wrong voice).
- **`tests/test_voice_sentences.js`** runs in `make test`, `make sync` and CI. It fails when a sentence's Greek doesn't contain exactly one word that is its verb in its person, when the reason doesn't fit the voice, when "you" isn't marked (sg) or (pl), or on duplicates. A changed verb in the sheet can break sentences, which is why `make sync` runs it. `--gaps` lists verb/person pairs with no sentence; βλέπομαι in the singular and most of βάζομαι are left out on purpose.
- **Page:** pairs come back to back (the same verb once active, once -μαι), unseen sentences come first until a verb's sentences are used up, persons with more misses come up more often, and missed sentences come back a few turns later. Progress is per device, in localStorage (`gav-history`, `gav-seen`, `gav-settings`).

## Dictionary (`docs/apps/dictionary.html`)

A Greek ↔ English dictionary that runs entirely in the browser. It's the home page, so `/#σπίτι` opens a word.

- **Home page:** `docs/index.md` is only the iframe. Its template, `overrides/home.html`, adds a menu button and a `<dialog>` built from `nav` (`docs/javascripts/home.js`). `docs/stylesheets/home.css` hides the site's header and footer with `body:has(.dict-home)`. They stay in the page because instant navigation needs them. The point is that the site looks like a dictionary until you open the menu, so don't add links to the notes there.

- **Data:** `lemma_greek_en.db.gz` is the lemma SQLite dictionary (schema version 3, built from English Wiktionary via kaikki.org, CC BY-SA, so the page credits it), gzipped. The owner's copy is built in `../lemma` (`make sqlite` there, output `lemma_greek_en/lemma_greek_en.db`), and its developer guide is copied to `sqlite-database.md`. It changes about once a year: `make dictionary`, then `make verb-forms`. Never write to the database, and refer to words by spelling (`#σπίτι`), since row ids change between builds.
- **Engine:** sql.js 1.14.2 is vendored in `docs/vendor/sql.js/` (no CDN, so it works offline). The app unzips the file with `DecompressionStream` and opens it in memory.
- **`greek-dictionary.js`** (browser and Node) ports the guide's Python reference: the `norm`/`phonetic`/Greeklish/English keys, Greek and English search, entry lookup. The keys must match the stored ones exactly; `tests/test_dictionary.js` recomputes them for every form. sql.js has no FTS5, so the English fallback for terms missing from `en_index` scans glosses with `LIKE` instead of using `sense_fts`.
- **`apps/dictionary.html`:** one search box. Greek input searches Greek. Latin input shows English and Greeklish results side by side, since it could be either. The hash is the open headword. Greek words in glosses link to their entries, and verbs in `verbs.json` link to `verb-tables.html` inside the same frame, so the notes' sidebar doesn't appear. Its header has a link back to the entry, which the notes page hides along with the header.
- **Verbs not in the sheet** also link to the verb tables. Before the first render the page waits for `verbs.json` and the keys of `verb-forms.json`, so the link is never wrongly "guessed".
  - A verb with a table in `verb-forms.json` links as `#καπνίζω` and shows the dictionary's own forms. Never call these guessed.
  - Only a verb with no table at all (about 700, like υποθέτω) is guessed: it links as `verb-tables.html#υποθέτω,υποθέσω,υπέθεσα`, and the verb tables page conjugates those parts with the engine and shows a "guessed" note. Older links of that shape for verbs that do have a table open the table.
  - `principalParts()` works out the future and aorist from the dictionary's forms, which carry no labels. It tries each candidate pair through `greek-verbs.js` and keeps the one whose generated forms the dictionary also lists.
  - Candidates are filtered first: the aorist must share the future's consonants (κάπνισα/καπνίσω, not the imperfect κάπνιζα), and the verb's own present and imperfect, variant presents that are headwords, and unaccented forms are skipped.
  - It returns null when unsure, and then there's no link. `test_dictionary.js` checks it against the sheet's hand-entered parts, so re-run it after changing the engine.
