# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal Modern Greek study notes: an MkDocs Material site, installable as three apps (notes, drills, dictionary), deployed to GitHub Pages (https://gataky.github.io/greek-notes/) by `.github/workflows/deploy.yml` on every push to `main` (except pushes that only touch `anki/` or `.claude/`). `anki/` is the owner's Go tool that pushes the same vocabulary sheet to Anki, merged in from gataky/go-anki-sync with its history.

## Layout

```
docs/                   the site (MkDocs serves everything here)
  index.md              home page of the notes app
  grammar/              notes (articles.md ..., pronouns/)
  tools/                pages that embed an app (notes app); their URLs are linked from outside, keep them
  drills/               the drills app: index.md, one page per drill, its manifest; URLs kept as for tools/
  dictionary/           the dictionary app: index.md and its manifest
  apps/                 standalone HTML apps, embedded by the pages above
  javascripts/          all JS: site-wide scripts (listed in mkdocs.yml) and the apps' modules
  stylesheets/          all CSS: site-wide (listed in mkdocs.yml), theme.css (every page's colours), and verb-grid.css and drill.css for the apps
  data/                 JSON the apps fetch, and the gzipped dictionary (downloaded, not in git)
  vendor/sql.js/        third-party code, vendored for offline use
  fonts/, icons/        self-hosted Greek font, app icons
  sw.js                 must stay at the site root (service worker scope)
  manifest.webmanifest  the notes app's (its scope is the whole site)
overrides/              theme templates (custom_dir)
hooks/                  MkDocs hooks: apps.py (which app a page is in), pwa.py (offline)
scripts/                build_*.py, build_declensions.js: write the files in docs/data/; build_anki_verbs.js writes exports/
exports/                data for anki/, not served by the site (anki-verbs.json)
tests/                  node test_*.js, run by make test and CI
sqlite-database.md      the lemma dictionary's developer guide (a copy)
anki/                   the Anki sync tool (Go module, its own Makefile and README)
.claude/skills/         add-verb (sheet → site → Anki), and the sheet editors it uses (fill-verb-forms, update-examples-notes)
```

Put new files by type, not next to the page that uses them. Apps refer to the rest with `../javascripts/`, `../stylesheets/`, `../data/` and `../vendor/`. Don't name a folder `assets/`: Material writes its own files there.

## Commands

Tools are pinned in `.tool-versions` (asdf: Python, Node, uv, Go); Python packages in `pyproject.toml` + `uv.lock`, Go modules in `anki/go.mod`. `.envrc` (direnv) loads them and `.venv`, and `anki/.envrc` adds a GOPATH on top; the Makefile works without direnv.

```sh
make install   # uv sync
make serve     # dev server at http://127.0.0.1:8000
make build     # mkdocs build --strict (CI fails on any warning)
make check     # all tests, the Go tests, then strict build: what CI runs before deploying, plus Go
make test      # node tests/test_verbs.js, test_verb_forms.js, test_voice_sentences.js, test_aspect_sentences.js, test_aspect_forks.js, test_nouns.js, test_numbers.js, test_pronoun_sentences.js, test_preposition_sentences.js and test_dictionary.js
make dump      # print every verb's conjugations for review
make sync      # pull verbs, nouns and adjectives from the Google Sheet into docs/data/verbs.json, words.json and declensions.json, then test
make fetch-dictionary  # download the pinned dictionary into docs/data/ (build, serve and test do this)
make dictionary  # gzip a new lemma dictionary build into docs/data/, then test
make publish-dictionary  # upload docs/data's dictionary as a GitHub release and pin the Makefile to it
make verb-forms  # copy our verbs' forms from the dictionary into docs/data/verb-forms.json, then test
make declensions  # copy our nouns' and adjectives' tables from the dictionary into docs/data/declensions.json, then test
make anki-verbs  # write the verb cards for anki/ into exports/anki-verbs.json (sync and verb-forms do too)
make anki-build  # go build anki/sync
make anki-test   # go test ./... in anki/
make push-words  # anki/sync push: the words tab to the Greek deck
make push-verbs  # anki-verbs, then anki/sync verbs --cards exports/anki-verbs.json
make anki        # sync, push-words, push-verbs: the whole flow after editing the sheet
make upgrade   # uv lock --upgrade
```

The push targets take `DRY=1` (`--dry-run`) and need Anki running with AnkiConnect. Preview with `DRY=1` before pushing for the owner; a push writes to their Anki collection.

There is no per-test runner: `tests/test_verbs.js` checks a table of hand-verified forms (`EXPECTED`) and prints each mismatch. To check one verb, add or edit its entry there.

uv is configured with `python-preference = "only-system"`, so it uses asdf's Python from `.tool-versions` (and setup-python's in CI) instead of downloading one. uv does not read `.tool-versions` itself. MkDocs is capped below 2.0 because Material doesn't support 2.0.

## Content

- Notes are Markdown in `docs/grammar/`. Each must be added to `nav` in `mkdocs.yml`. Each app's menu shows only its own part of `nav` (see Apps below). A note's path is its URL (`grammar/articles.md` is `grammar/articles/`), so moving or renaming one breaks links to it.
- **Colours** are gruvbox, the same in all three apps, and live only in `docs/stylesheets/theme.css`: `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-soft`, `--good`/`--warn`/`--bad` (with `-soft` tints), `--aug`, and the dictionary's part-of-speech and gender colours, light and dark. Every app in `docs/apps/` links it first, and the site loads it through `extra_css`, where it also sets Material's `--md-*` colours (palette `custom` in `mkdocs.yml`). Don't define colours anywhere else; the manifests' and `main.html`'s `theme-color` repeat `--bg` (the phone's status and navigation bars), and `pwa.js` keeps the tags in step with the site's light/dark toggle.
- Every table on the note pages is styled by `docs/stylesheets/tables.css` to match the verb grid (`docs/stylesheets/verb-grid.css`). Keep the two looking alike: card, uppercase headings, row rules, accent highlights.
  - **Plain Markdown tables** need no markup. `docs/javascripts/tables.js` sets `lang="el"` on cells with Greek, which get the Greek font while the other cells in that table are muted as glosses. Bold inside Greek cells shows in the accent colour. Header cells with Greek aren't uppercased.
  - **Grid layouts** (paradigms with grouped columns) are hand-written HTML: `<div class="grid-card"><table class="grid">` with `th.group`/`th.sub`, `td.who` row labels, `td.gloss`, `span.end` (accent), `span.pre` (muted), `td.gap` spacer columns, and an optional `p.grid-note` underneath. Row labels can shorten on phones: `masc<span class="full">uline</span><span class="abbr">.</span>`.
  - Greek is in GFS Neohellenic everywhere, as in the dictionary. Where Greek and English mix (the note tables, the notes' prose through `greek-font.css`, the drills' `--display`), it's a self-hosted Greek-only subset, regular and bold (`docs/fonts/`, OFL), registered as "Greek Neohellenic" with a Greek `unicode-range` and `size-adjust: 124%`, so Latin in the same cell falls through to Commissioner (or the notes' text font). The apps' display text (`--display` in `verb-grid.css`) uses Google's full "GFS Neohellenic", Latin included, at its own size.
- **Greek font picker** (`docs/javascripts/greek-font.js`, `docs/stylesheets/greek-font.css`): the translate-icon button, in the header and on the dictionary's page, opens a dialog with `FONTS`: the default (GFS Neohellenic) and 5 other fonts with Greek (Alegreya, LXGW WenKai Mono TC, GFS Didot, Ubuntu Mono, Carlito). A choice registers its faces, the Greek subsets only, as "Chosen Greek" with a `size-adjust` that matches Commissioner's letter height. So **every font stack starts with `"Chosen Greek"`** (`--display`, `--body`, `--gn-body`, `--gn-greek`, Material's `--md-text-font-family`), and every app in `docs/apps/` loads `greek-font.js`. Until something is chosen, no such font exists and the stacks fall through to their own fonts. The choice is per device, in localStorage (`greek-font`, with its faces, so pages don't fetch the stylesheet again). The page passes a new choice into its frames, and `drill-frame.js` passes it into frames that load later. Fonts come from Google Fonts and are cached by the service worker on first use, not ahead of time; Didot's Greek subset is self-hosted, like the default's.
- Interactive pages are standalone HTML apps in `docs/apps/`, embedded in a Markdown page with `<iframe class="drill-frame" src="../../apps/x.html">` (relative to the page's URL, `tools/x/`). `docs/javascripts/drill-frame.js` (loaded site-wide) hides the app's `<header>`, sizes the iframe to its content, and syncs the light/dark theme by setting `data-theme` on the app's root. theme.css therefore gives the apps dark tokens under both `prefers-color-scheme` and `[data-theme="dark"]`, and the site's pages under Material's `[data-md-color-scheme="slate"]` on the body. Add `data-pass-hash` to an iframe to forward the page's `#fragment` into it, which is how `tools/verb-tables/#γράφω` opens a verb. Add `data-keep-header` to keep the app's header showing.
- Drills move focus to their answer box only with a mouse or trackpad (`AUTO_FOCUS`, `(hover: hover) and (pointer: fine)`). On a phone, focusing it opens the on-screen keyboard and the page jumps, so there the learner taps the box.

## Apps

One site and one build, installable as three apps so a drill and the dictionary can be open at once. Each has a manifest in its folder:
- **Greek Dictionary:** `dictionary/` (`docs/dictionary/manifest.webmanifest`).
- **Greek Drills:** `drills/` (`docs/drills/manifest.webmanifest`).
- **Greek Notes:** the rest, the grammar and the tools (`docs/manifest.webmanifest`, scope the whole site; the other two are nested in it, and a more specific scope wins).

`hooks/apps.py` (`APPS`) puts each page in the app whose folder holds it, and gives the templates:
- `app`: that app's names, read from its manifest. `overrides/main.html` uses it for the manifest link, the apple-touch-icon and the home-screen name.
- `nav` with only that app's top-level sections: one `nav` in `mkdocs.yml` serves all three. Its homepage, which the logo links to, is the app's first page.
- `config.site_name`: the app's name, so the header and titles say Greek Drills, and an app's first page is titled with the name alone.

Links between apps are ordinary links. Inside an installed app, one that leaves the app's scope still works, shown with the browser's address bar. Search still covers the whole site.

Icons are `docs/icons/<app>-{512,192,180}.png`: the same Αα and Greek key, with gruvbox's blue, orange or aqua behind them (dictionary, drills, notes). `scripts/icon.html?app=` is the source, with the commands to render them. The favicon is the notes app's.

The dictionary used to be the home page. The home page sends a Greek `#fragment` (`/#σπίτι`) on to `dictionary/#σπίτι`, so old links still open the word.

## Offline (PWA)

All three apps work offline through one service worker:
- `overrides/main.html` (theme `custom_dir`) adds the page's app's manifest and the home-screen tags.
- `docs/javascripts/pwa.js` registers `docs/sw.js`.
- `hooks/pwa.py` (an MkDocs hook, so it also runs in CI) fills placeholders in the built `sw.js` after every build:
  - the list of every built file, skipping `*.map` and lunr language packs for languages search doesn't use;
  - the Google Fonts stylesheets found in the pages;
  - a version stamp: a hash of every listed file plus the worker's own source.
- A new stamp makes installed apps cache the new copy and delete the old one. The worker also caches the Latin and Greek font subsets, kept across versions.
- Nothing needs updating when pages are added. Pages are cached under their directory URL (`tools/verb-tables/`), matching how they're linked.
- Large data files (`*.db.gz`, the dictionary) stay out of the file list and the version stamp. The hook lists them in `DATA` with their own content hash, and the worker keeps them in a separate `data` cache, so a deploy doesn't download them again unless they changed. A new version only pre-downloads the data files this browser has saved before. Otherwise a file waits for its first use, since only the dictionary reads it and a phone may give each home-screen app its own storage.
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

## Aspect forks (`docs/tools/aspect-forks.md`, `docs/apps/aspect-forks.html`)

A verb's present forking into its two stems, imperfective and perfective, each with its past and future, with the augment and the changed letters highlighted. Active verbs only. **`aspect-fork.js`** (browser and Node) draws it from a conjugation, normally `verbToShow()`'s, so it shows the same forms as the verb tables. It generates no forms:
- `analyse(conjugation, verb)` compares the 1st singular present, past continuous, aorist and dependent, ignoring accents and diaeresis, and returns them in a bracket notation: `[έ]` augment, `{ψ}` changed or added in the perfective, `(ν)` lost in the perfective, `<γ>` added in the imperfective. `forkHTML()` turns it into spans.
- **Groups** come from rules on the end of the present and dependent stems (labials, velars, dentals, ν → σ, -ησ- ...), in `GROUPS`. The word list's class decides b1/b2, else the 2nd singular. A verb that fits no rule, whose pasts don't come from its stems (πήγαινα), or that has ή-/εί- on a consonant (ήθελα, είδα) is `irregular` and gets a one-line note, no fork. Passives return null.
- Notes on single verbs are generated (internal augment, an extra letter change, -ηκ-). There are no hand-written ones; don't add any.
- Always shown, never folded: under the grid on the verb tables page and in dictionary entries, and on the aspect forks page, which groups the word list's active verbs. `tools/aspect-forks/#κλείνω` opens a verb, `#labials` a group.
- `tests/test_aspect_forks.js` checks hand-checked groups, markup and notes, and that every dictionary verb's markup spells its forms. `--groups` prints the counts (about 1,880 active verbs, 95 irregular). Run it after changing the rules or `verb-forms.json`; `make verb-forms` and `make sync` do.

## Anki verb cards (`scripts/build_anki_verbs.js`, `exports/anki-verbs.json`)

The Anki sync tool in `anki/` pushes a "Greek Verbs" deck from this file with `./sync verbs` (`make push-verbs`). The cards show what the site shows, so the forms and highlights are worked out here in JavaScript rather than ported to Go.

- **Verbs:** the word list's active verbs, in `AspectFork.GROUPS` order (regular groups first, irregular last, which becomes Anki's new-card order). Each has its 1st singular present, past continuous, aorist and `θα` future, plain and as `markHTML()` spans, the group's name, rule and note, and the fork's notes.
- **`recognize`** is the form for an aorist → present card, set for the irregular, strong and no-perfective groups.
- **`example`** is the verb's past simple sentence from `aspect-sentences.json`.
- **`cloze`** holds every past-tense sentence from `aspect-sentences.json`, with the answer wrapped as `{{c1::έγραψα::γράφω}}`. The answer is found with `answersIn()`, as in the drill. The English keeps its `*marks*`: the card's front shows it, with the verb in bold, above the Greek blank. That gives the person, which the Greek often drops, so the card tests the aspect and the form.
- Committed, one item per line, so the diff shows which cards a push will change. `make sync` and `make verb-forms` rebuild it. The script exits non-zero if a verb has no forms or a sentence's answer can't be found.
- Don't rename fields without changing `anki/internal/verbs` in the same commit, and run `make anki-test`.

## Anki sync tool (`anki/`)

A Go CLI (cobra) that reads the sheet through the Sheets API with a service account and writes to Anki through AnkiConnect. The sheet is the source of truth; nothing is pulled back. `anki/README.md` documents it in full.

- **Config and secrets** are in `~/.config/sync/` (`config.yaml`, `service-account.json`, TTS keys), never in the repo, which is public. The sheet ID stays in that config for the Go tool and the skills.
- **`./sync push`** (`make push-words`): one note per row of the words tab in the "Greek" deck, with change detection by checksum and Greek audio from ElevenLabs or Google TTS.
- **`./sync verbs`** (`make push-verbs`): the "Greek Verbs" deck from `exports/anki-verbs.json`. `--cards` sets the file, else `verbs.cards_path` in the config. Run it after `push`, since a verb's present reuses the vocabulary card's audio.
- Both the site (`scripts/build_verbs.py`, CSV export) and the tool (Sheets API) read the words tab, with their own filters. A column change in the sheet has to be checked against both, and against the skills.
- Go code and tests: `anki/internal/` (anki, sheets, sync, verbs, tts, mapper, ...), `anki/pkg/models/`. `.github/workflows/anki.yml` runs `go vet`, `go test` and a build on changes to `anki/`, `exports/` or the export script.
- `anki/internal/verbs/export_test.go` decodes the committed `exports/anki-verbs.json` strictly, so a field the script writes but Go doesn't read, or a required field left empty, fails the Go tests. Rebuild the export (`make anki-verbs`) before running them after changing the script.

## Active or passive drill (`docs/drills/`, `docs/apps/passive-verbs.html`)

Present tense: an English sentence, and the learner types the Greek verb, choosing the active or the -μαι form and the person. It replaced an older conjugation-only passive drill and kept its URL (`drills/passive-verbs/`), so links and installed apps still work.

- **Verbs:** the sheet's passives whose `active form` is also in the sheet, those active partners, and the deponents except είμαι.
- **Sentences:** `voice-sentences.json`, one object per line: `verb` (dictionary form), `person` (`1sg`…`3pl`), `reason`, `en`, `el`, and an optional `note`. Reasons are `object` or `intransitive` for active verbs, `self`, `each`, `done` or `happens` for passives, and `deponent`. Nothing else is stored: the voice, the active partner, which word is the answer and the paradigm all come from `verbs.json` through `greek-verbs.js`. Sentences use only words from the words tab.
- **`voice-drill.js`** (browser and Node) has the logic the page and the test share: present forms with `ουν(ε)` expanded, finding the answer word in a sentence, and grading (correct, accent, spelling, wrong person, wrong voice).
- **`tests/test_voice_sentences.js`** runs in `make test`, `make sync` and CI. It fails when a sentence's Greek doesn't contain exactly one word that is its verb in its person, when the reason doesn't fit the voice, when "you" isn't marked (sg) or (pl), or on duplicates. A changed verb in the sheet can break sentences, which is why `make sync` runs it. `--gaps` lists verb/person pairs with no sentence; βλέπομαι in the singular and most of βάζομαι are left out on purpose.
- **Page:** pairs come back to back (the same verb once active, once -μαι), unseen sentences come first until a verb's sentences are used up, persons with more misses come up more often, and missed sentences come back a few turns later. Progress is per device, in localStorage (`gav-history`, `gav-seen`, `gav-settings`).
- **Marking** (both drills): Exact, Accents optional (the default) or Forgiving decides whether `grade()`'s `accent` and `spelling` results count as right for the score, streak and retries (`MARKING` and `countsAsRight()` in `voice-drill.js`). Wrong person, voice, aspect, tense and θα / να never do. Either way the feedback lights up the letters that differ (`changes()`), and the history keeps the raw result.

## Tense and aspect drill (`docs/drills/tense-aspect.md`, `docs/apps/tense-aspect.html`)

Active verbs only, since the owner hasn't learned the passive past yet. The learner reads an English sentence with one verb marked, `*like this*`, and types the Greek, with θα or να when the form takes one. Seven cells are drilled: the present, the past (continuous/simple), the future (θα + continuous/simple) and after να (continuous/simple).

- **Sentences:** `aspect-sentences.json`, one object per line, with these fields:
  - `verb`: an active verb in verbs.json.
  - `person`, `en`, `el`, and an optional `note`.
  - `tense`: `present`, `past`, `future` or `na`.
  - `aspect`: `continuous` or `simple`. The present is always `continuous`.
  - `reason`: `ongoing` or `repeated` for the continuous, `once` for the simple.

  Use only words from the words tab. Write a verb's two aspects in the same tense where both are natural, so the page can pair them. Verbs with one form for both aspects get one sentence per tense: κάνω, περιμένω, σερβίρω, προσφέρω, and πάω (whose continuous sentences are under πηγαίνω). έχω and ξέρω get continuous sentences only.
- **Forms come from the verb tables' merge** (`verbToShow()` in `verb-forms.js`, so the dictionary's cells), not from the engine alone. A change to `verb-forms.json` can therefore break sentences, which is why `make verb-forms` and `make sync` run the test.
- **`aspect-drill.js`** (browser and Node) holds what the page and the test share:
  - `CELLS`: each cell's particle, and where its forms are in `conjugate()`'s shape.
  - `answersIn()` finds the answer in a sentence: the form, with its particle in front. Object pronouns and μη(ν) may stand between: θα το γράψω.
  - `grade()` returns one of: correct, accent, particle (right verb form, θα or να missing or wrong), spelling, wrong person, wrong aspect, wrong tense, wrong. It reuses `voice-drill.js`'s helpers.
- **`tests/test_aspect_sentences.js`** fails in these cases:
  - a sentence's Greek doesn't contain exactly one matching form;
  - the verb has no form for that cell;
  - the reason doesn't fit the aspect;
  - the English doesn't mark the verb once;
  - "you" isn't marked (sg) or (pl);
  - a sentence is a duplicate;
  - an active verb has no sentences.

  `--gaps` lists the verb/cell pairs with no sentence.
- **Page:**
  - A verb's two aspects in one tense come back to back.
  - Tenses with more misses come up more often, and missed sentences come back a few turns later.
  - Chips turn each tense on or off.
  - Marking works as in the active or passive drill.
  - Progress is per device, in localStorage (`gta-history`, `gta-seen`, `gta-settings`).

## Noun drills (`docs/drills/noun-gender.md`, `agreement.md`, `numbers.md`, `prepositions.md`)

Noun gender, agreement (article + adjective + noun in a case), numbers and prepositions draw from the word list's nouns and adjectives, with the dictionary's forms. No noun or adjective form is generated; only the article and the numbers are fixed tables in code.

- **`words.json`**: the words tab's nouns and adjectives (`greek`, `english`, `pos`, `gender`, `tag`), written by `scripts/build_verbs.py` next to `verbs.json`. `gender` is the sheet's `attributes` column, `invariable` for ο/η γιατρός.
- **`declensions.json`** (`scripts/build_declensions.js`, Node, through `greek-dictionary.js`'s `declensions()` and `adjectiveDeclensions()`, so the cells are the dictionary page's): one word per line, `{ greek, pos, gender, cells }`, plus `name: true` for proper names (Ελλάδα, Απρίλιος; `declensions(word, "name")`) and `indeclinable: true` (ταξί). The word list's gender wins over the table's; the script prints disagreements and the words with no table (about 55: multi-word nouns, plurals the dictionary files under a singular, spellings it files under another, like αυγό for αβγό). Rebuild with `make declensions` after `make sync` (which runs it) or a new dictionary.
- **`noun-drill.js`** (browser and Node): articles and the ν rule (`articleForms`: τη before most consonants, την before a vowel and κ π τ ξ ψ), phrases as slots (`phrase()`), and `gradePhrase()`, which aligns the typed words to the slots and names a wrong form by its case, number or gender. `ADJECTIVE_TAGS` is a small hand-made list of which adjectives suit which noun tags, so the agreement drill doesn't pair "hungry" with "spoon"; adjectives not in it aren't drilled.
- **`number-words.js`**: cardinals 0 to 999.999.999 in words, by gender and case, with spelling variants (εφτά/επτά), following `grammar/numerals.md`.
- **`preposition-drill.js`** and `preposition-sentences.json`: one object per line, `prep` (`σε`, `από`, `δίπλα σε`… or `none`), `noun` (word list spelling), `en` with the phrase `*marked*`, `el`, `answer` (as it appears in `el`), optional `also` (other accepted answers) and `note`. `analyse()` reads the answer as preposition + accusative against the noun's table.
- Progress is per device in localStorage: `gng-*` (noun gender), `gag-*` (agreement), `gnm-*` (numbers), `gpp-*` (prepositions).
- `tests/test_nouns.js` checks the data and grades every phrase the agreement drill can ask for against its own answer; `test_numbers.js` checks hand-checked numbers; `test_preposition_sentences.js` checks every sentence against its noun's table and the grader.

## Object pronoun drill (`docs/drills/object-pronouns.md`, `docs/apps/object-pronouns.html`)

Weak pronouns and where they go. `pronoun-sentences.json`: one object per line, `rule` (`before`, `negation`, `particle`, `imperative`, `dont`), `en` with the verb phrase `*marked*`, `el` (with the referent before the gap, so its gender shows), `answer`, optional `also` and `note`. **`pronoun-drill.js`** grades: correct, accent (the second accent of διάβασέ το), order, pronoun, particle, spelling, verb. τη/την, δε/δεν and μη/μην are accepted wherever the ν may drop. `tests/test_pronoun_sentences.js` checks each answer is built the way its rule says (`ruleProblem`). Progress: `gop-*`.

## Shared drill pieces

The five newer drill apps share `docs/stylesheets/drill.css` (layout and fonts) and `docs/javascripts/drill-kit.js` (storage, feedback box, score, tabs, slip cells). The two gap-fill drills, prepositions and object pronouns, also share `gap-drill-page.js` (the page) and `gap-sentences.js` (finding and blanking the answer in the Greek). The older passive and tense-aspect apps still inline their own.

Marking works in these drills as in the verb drills, through `voice-drill.js`'s `MARKING` and `countsAsRight()`: `DrillKit.marking()` draws the radios, and `DrillKit.counts()` maps their slips onto it (`accent`, `spelling`, and `n` for τη where the ν must stay, marked like a typo). Forgiven slips also count as right in Where you slip; the feedback lights up the letters that differ (`changes()`).

## Dictionary (`docs/apps/dictionary.html`)

A Greek ↔ English dictionary that runs entirely in the browser. It's an app of its own at `dictionary/`, so `dictionary/#σπίτι` opens a word.

- **Page:** `docs/dictionary/index.md` is only the iframe. Its template, `overrides/home.html`, adds a light/dark button (top right, `docs/javascripts/home.js`) and no menu, since the notes and drills are other apps. The theme button picks the next palette through Material's own radio inputs, still in the hidden header, so the choice is saved for every page and `drill-frame.js` passes it into the dictionary. It reads the current palette from `body[data-md-color-scheme]`, because on a first visit neither input is checked. `docs/stylesheets/home.css` hides the site's header and footer with `body:has(.dict-home)`. They stay in the page because instant navigation needs them. The point is that the app is only a dictionary, so don't add links to the notes there.

- **Data:** `lemma_greek_en.db.gz` is the lemma SQLite dictionary (schema version 4, built from English Wiktionary via kaikki.org, CC BY-SA, so the page credits it), gzipped. The owner's copy is built in `../lemma` (`make sqlite` there, output `lemma_greek_en/lemma_greek_en.db`), and its developer guide is copied to `sqlite-database.md`. It changes about once a year: `make dictionary`, then `make verb-forms` and `make declensions`, then `make publish-dictionary`.
  - **It isn't in git** (23 MB; ignored). It's an asset on a GitHub release of this repo (`dictionary-YYYYMMDD`). The Makefile pins it by `DICT_URL` and `DICT_SHA256`, and `make fetch-dictionary` downloads it when missing; `build`, `serve`, `test` and CI run that first. A local file that isn't the pinned build is left alone, with a note, so a fresh `make dictionary` isn't overwritten. `publish-dictionary` creates the release with `gh` and rewrites the two pin lines; commit the Makefile after. Older copies remain in git history (before 2026-11-07); history was deliberately not rewritten.
  - Never write to the database, and refer to words by spelling (`#σπίτι`), since row ids change between builds.
- **Engine:** sql.js 1.14.2 is vendored in `docs/vendor/sql.js/` (no CDN, so it works offline). The app unzips the file with `DecompressionStream` and opens it in memory.
- **`greek-dictionary.js`** (browser and Node) ports the guide's Python reference: the `norm`/`phonetic`/Greeklish/English keys, Greek and English search, entry lookup. The keys must match the stored ones exactly; `tests/test_dictionary.js` recomputes them for every form. sql.js has no FTS5, so the English fallback for terms missing from `en_index` scans glosses with `LIKE` instead of using `sense_fts`.
- **`apps/dictionary.html`:** one search box. Greek input searches Greek. Latin input shows English and Greeklish results side by side, since it could be either. The hash is the open headword. Greek words in glosses link to their entries.
  - An open word has one section per entry (`entryHTML()`): the part of speech as a heading, the headword line, senses and etymology, then that entry's own tables. μικρός the adjective is followed by the adjective's declension, μικρός the noun by the noun's. `declensions()` and `adjectiveDeclensions()` return each table's `entry` id to match `lookup()`'s entries. The conjugation goes in the first verb entry, or after all of them when the word list has the verb but no entry is a verb.
- **A verb's entry shows its conjugation grid** (`conjugationHTML()`, drawn by `verb-grid.js`) after the senses, instead of linking to the verb tables. Before the first render the page waits for `verbs.json` and `verb-forms.json`, so a verb is never drawn from a guess when it has a table.
  - Which verb and forms come from `verbToShow()` in `verb-forms.js`, shared with the verb tables page so both always agree: the word list's verb (also under its other spelling, ξεχνάω → ξεχνώ), else the dictionary's table, else a guess.
  - A verb with a table in `verb-forms.json` shows the dictionary's own forms. Never call these guessed.
  - Only a verb with no table at all (about 700, like υποθέτω) is guessed: `principalParts()` supplies a future and aorist, the engine conjugates them, and the grid carries a "guessed" note.
  - The senses' `.ex` style is scoped to `.senses`, not `.entry`, because the grid (inside its entry now) uses `.ex` in its legend too.
- **A noun's entry shows its declension** (`declensionHTML()`), read straight from the database by `declensions()` in `greek-dictionary.js`: no data file and no engine. Nouns without a table (about 2,600) show nothing extra; their headword line already gives the plural.
  - One table per noun entry (37 nouns have two: two genders or two patterns), four cases by two numbers. A cell is a list, most usual first; `[]` is a dash (a form that doesn't exist, usually a genitive plural) and `null` means the table has no rows there. A number with no rows at all, like a noun with no plural, is left out.
  - Gender comes from the template (`el-nM-ος-οι-2a`), else the headword line. The article is added when drawing (`article()`), not stored; without a single gender (βάτος, 16 tables) there are no articles. The vocative takes none.
  - `nounForms()` cleans hand-made cells: several forms, articles and romanizations inside a cell, `(βάβες (váves))`. Tables declined by gender like adjectives (6, filed as nouns) are skipped.
  - Endings are split at the stem the template gives (`el-nN-ι-ια-2b`: σπίτ|ι, σπιτ|ιού), else at the letters all forms share. Rare, archaic and dated rows are hidden unless the cell has nothing else.
- **An adjective's or participle's entry shows its declension** (`adjectiveHTML()`), read from the database by `adjectiveDeclensions()` in `greek-dictionary.js`, in the same way as nouns. The entry's `pos` is `adj`, or its `pos_display` is `participle` (κουρασμένος).
  - One table per entry (about 5,900): four cases down, the three genders across, singular then plural. Four entries have two positive tables for one word: βαρύς (everyday βαριά, formal βαρεία), θαυματουργός and ευχετήριος (a feminine like the masculine), and καρδιακός (καρδιακιά). They're merged, each cell giving the forms of the table whose feminine the headword line lists first, then the other's as alternatives. Like the verb grid, it's one table on wide screens and one per number below 560px (`.wide`/`.stacked`). There are no articles; the column headings give the gender.
  - Only the positive degree. Comparative and superlative rows are dropped one by one, since some entries have tables of their own for them (ωραίος) and others mix them into the positive table (ελαφρύς).
  - Cells are built as for nouns (`cellOf()`): `[]` is a dash (the feminine genitive plural of -ης adjectives like αβανιάρης), and rare rows only count when the cell has nothing else. Endings are split at the letters every gender's forms share (καλ|ός, καλ|ή, καλ|ό).
- **The verb tables page** still opens from links like `verb-tables.html#υποθέτω,υποθέσω,υπέθεσα` (older dictionary links); for a verb that has a table, the table wins.
  - `principalParts()` works out the future and aorist from the dictionary's forms, which carry no labels. It tries each candidate pair through `greek-verbs.js` and keeps the one whose generated forms the dictionary also lists.
  - Candidates are filtered first: the aorist must share the future's consonants (κάπνισα/καπνίσω, not the imperfect κάπνιζα), and the verb's own present and imperfect, variant presents that are headwords, and unaccented forms are skipped.
  - It returns null when unsure, and then there's no link. `test_dictionary.js` checks it against the sheet's hand-entered parts, so re-run it after changing the engine.
