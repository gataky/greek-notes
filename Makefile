# Run `make` to list the targets.

SHEET_URL := https://docs.google.com/spreadsheets/d/1p39Sbnkx3G4swoSPJ2KKVKu-VwteKmaAQ9toFadd5cA/edit
NODE      := node
DICT_DB   := ../lemma/lemma_greek_en/lemma_greek_en.db

.DEFAULT_GOAL := help
.PHONY: help install upgrade sync dictionary verb-forms test dump serve build check clean sheet

help: ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

install: ## Create .venv from uv.lock
	uv sync

upgrade: ## Update Python packages to the newest allowed versions (rewrites uv.lock)
	uv lock --upgrade
	uv sync

sync: ## Pull verbs from the Google Sheet into verbs.json, then run the checks
	uv run python scripts/build_verbs.py
	@git diff --stat -- docs/data/verbs.json
	@$(NODE) tests/test_verbs.js
	@$(NODE) tests/test_voice_sentences.js

dictionary: ## Copy in a new dictionary build (DICT_DB=path/to/lemma_greek_en.db), then check it
	gzip -9 -n -c "$(DICT_DB)" > docs/data/lemma_greek_en.db.gz
	@$(NODE) tests/test_dictionary.js

verb-forms: ## Copy our verbs' forms from the dictionary into verb-forms.json (DICT_DB=path/to/lemma_greek_en.db)
	uv run python scripts/build_verb_forms.py "$(DICT_DB)"
	@git diff --stat -- docs/data/verb-forms.json
	@$(NODE) tests/test_verb_forms.js

test: ## Check the conjugation engine, the verb forms, the drill sentences and the dictionary lookup
	$(NODE) tests/test_verbs.js
	$(NODE) tests/test_verb_forms.js
	$(NODE) tests/test_voice_sentences.js
	$(NODE) tests/test_dictionary.js

dump: ## Print every verb's conjugations, for reviewing
	$(NODE) tests/test_verbs.js --dump

serve: ## Preview the site at http://127.0.0.1:8000 with live reload
	uv run mkdocs serve

build: ## Build the site into site/, failing on warnings like CI does
	uv run mkdocs build --strict

check: test build ## Everything CI checks before deploying

clean: ## Remove the built site
	rm -rf site

sheet: ## Open the vocabulary sheet in the browser
	open "$(SHEET_URL)"
