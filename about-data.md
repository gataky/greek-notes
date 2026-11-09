We take Greek words and their definitions from English Wiktionary, using the machine-readable copy that kaikki.org publishes. That gives us each word's part of speech, numbered definitions, example sentences, etymology, and its labelled inflection tables (this form is "genitive plural feminine", that one "1st singular aorist").

For English → Greek lookup, we also go the other way. We stream English Wiktionary's own entries and keep the Greek lines from their translation tables ("house → σπίτι"). People wrote those translations on purpose, so they rank above English words picked out of Greek definitions.

Dilemma, a Greek lemmatizer dataset (2.7M Modern Greek form → dictionary-word pairs, from Wiktionary, annotated corpora and the LSJ lexicon), adds the inflected forms, so typing any form finds its dictionary word: είπα → λέω. FrequencyWords (word counts from OpenSubtitles film and TV subtitles) ranks words and forms by how common they are.

Lemma, a Rust build, merges all of that into one SQLite file: 31K headwords, 358K searchable spellings and 53K inflection tables. Each spelling gets search keys computed in advance, so lookups ignore accents and match by sound or Greeklish. Entries that only point to another word ("plural of…", "diminutive of…") are folded into the word they point to.

The site ships that file gzipped (23 MB, as a GitHub release asset) and queries it in the browser with sql.js. There's no server, and it works offline. Noun and adjective tables are read straight from the database. Verb tables come from a pre-built verb-forms.json, which the conjugation engine and your vocabulary sheet fill in where the dictionary has gaps.

                         BUILD (../lemma, Rust · once a year or so)
 ┌───────────────────────────────┐
 │ English Wiktionary            │
 │  via kaikki.org               │
 │  ├ Greek entries ─────────────┼──► headwords, POS, definitions,
 │  │  (~1 GB of JSON lines)     │    examples, etymology,
 │  │                            │    labelled inflection tables
 │  └ English entries' ──────────┼──► English → Greek translations
 │     translation tables        │    ("house → σπίτι")
 └───────────────────────────────┘
 ┌───────────────────────────────┐
 │ Dilemma (HuggingFace)         │──► 2.7M form → dictionary word pairs
 │  lemmatizer data              │    (είπα → λέω), polytonic spellings
 └───────────────────────────────┘
 ┌───────────────────────────────┐
 │ FrequencyWords (OpenSubtitles)│──► how common each word and form is
 └───────────────────────────────┘
                 │
                 ▼  merge "form of" entries into their word, dedupe tables,
                 │  precompute search keys (no accents / by sound / Greeklish),
                 │  score English terms
         lemma_greek_en.db  (SQLite: 31K headwords, 358K forms, 53K tables)
                 │
                 │  make dictionary → make publish-dictionary
                 ▼
 ────────────────────────────── SITE (greek-notes) ─────────────────────────────
   GitHub release asset  lemma_greek_en.db.gz  (23 MB, pinned by SHA-256)
                 │  fetched once, cached by the service worker for offline use
                 ▼
   Browser: DecompressionStream → sql.js (SQLite compiled to WebAssembly)
     ├ search         form keys: σπιτι · spiti · σπητι → σπίτι; English via the index
     ├ definitions    entry + sense tables
     ├ noun/adj tables  read straight from the inflection tables
     └ verb tables    verb-forms.json (pre-built from the db)
                       + your sheet's verbs.json + the conjugation engine for gaps
