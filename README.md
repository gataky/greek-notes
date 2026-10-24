# Modern Greek Notes

Personal notes for learning Modern Greek, published with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) on GitHub Pages.

## Adding a note

1. Put the `.md` file in `docs/`.
2. Add it to `nav` in `mkdocs.yml` and link it from `docs/index.md`.
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
make sync      # pull the verbs into verbs.json and run the checks
```

Commit `verbs.json` and push.
