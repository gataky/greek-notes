# Modern Greek Notes

Personal notes for learning Modern Greek, published with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) on GitHub Pages.

## Adding a note

1. Put the `.md` file in `docs/`.
2. Add it to `nav` in `mkdocs.yml` and link it from `docs/index.md`.
3. Commit and push to `main`. The site rebuilds automatically.

## Previewing locally

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/mkdocs serve
```

Then open http://127.0.0.1:8000.
