# Modern Greek Notes

Personal notes for learning Modern Greek, published with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) on GitHub Pages.

## Adding a note

1. Put the `.md` file in `docs/`.
2. Add it to `nav` in `mkdocs.yml`. The menu on the home page is built from `nav`.
3. Commit and push to `main`. The site rebuilds automatically.

## Installing on a phone

The site is an installable app that works offline. Open https://gataky.github.io/greek-notes/ and add it to the home screen: on iPhone, Safari → Share → Add to Home Screen; on Android, Chrome → Install app. The first visit online saves the whole site (every page, the verb data, search and fonts). After that it opens without a connection, and it picks up new deploys the next time it's opened online.

## Working locally

Tool versions (Python, Node, uv) are pinned in `.tool-versions` for asdf, and Python packages in `pyproject.toml` and `uv.lock`. `.envrc` puts the tools and the `.venv` on your PATH when you `cd` here. Run `direnv allow` once (and again after editing `.envrc`), then:

```sh
make install   # uv sync: create .venv from uv.lock
make serve     # preview at http://127.0.0.1:8000
```

Run `make` to see every target. To add a Python package, run `uv add <package>` and commit `pyproject.toml` and `uv.lock`.

## Updating the verb tables

The verb tables page reads `docs/tools/verbs.json`, which comes from the words tab of the vocabulary sheet (`make sheet` opens it). For each verb, fill in **future simple** and **aorist** (columns N–O), and **overrides** (P) only for irregular forms. Then:

```sh
make sync        # pull the verbs into verbs.json and run the checks
make verb-forms  # copy their forms from the dictionary into verb-forms.json (needs ../lemma's database)
```

Commit `verbs.json` and `verb-forms.json`, and push. The page shows the dictionary's forms wherever it has them. The sheet's columns only count for forms the dictionary doesn't have.

## Drill sentences

The active or passive drill reads `docs/drills/voice-sentences.json`. Each sentence names its verb and person; the forms come from `verbs.json`. `make test` checks every sentence against the conjugation engine, and `node scripts/test_voice_sentences.js --gaps` lists verb/person pairs that have no sentence yet.

## Updating the dictionary

The dictionary page reads `docs/tools/lemma_greek_en.db.gz`, a gzipped copy of the lemma SQLite dictionary. When there's a new build:

```sh
make dictionary DICT_DB=path/to/lemma_greek_en.db   # default: ../dictionary/lemma_greek_en.db
```

That gzips it into `docs/` and runs the checks. Commit the `.db.gz` and push. Installed apps download it again only because it changed; other deploys leave it alone.
