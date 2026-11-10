# Run `make` to list the targets.

SHEET_URL := https://docs.google.com/spreadsheets/d/1p39Sbnkx3G4swoSPJ2KKVKu-VwteKmaAQ9toFadd5cA/edit
NODE      := node
DICT_DB   := ../lemma/lemma_greek_en/lemma_greek_en.db

# The dictionary isn't kept in git: it's an asset on a GitHub release, pinned here by URL and
# checksum. `make publish-dictionary` uploads a new build and rewrites these two lines.
DICT_GZ     := docs/data/lemma_greek_en.db.gz
DICT_URL    := https://github.com/gataky/greek-notes/releases/download/dictionary-20261107/lemma_greek_en.db.gz
DICT_SHA256 := 5fc29721d7e7233d8c3f89e26471b78a237179d173ac4f303a89aaf8baae3adc

# The Anki sync tool (Go) in anki/. Its config and keys live in ~/.config/sync/, not here.
# DRY=1 makes the push targets preview what they'd change.
ANKI        := anki/sync
DRY_RUN     := $(if $(DRY),--dry-run)

.DEFAULT_GOAL := help
.PHONY: help install upgrade sync fetch-dictionary dictionary publish-dictionary verb-forms declensions anki-verbs anki-build anki-test push-words push-verbs anki test dump serve build check clean sheet

help: ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-18s %s\n", $$1, $$2}'

install: ## Create .venv from uv.lock
	uv sync

upgrade: ## Update Python packages to the newest allowed versions (rewrites uv.lock)
	uv lock --upgrade
	uv sync

sync: fetch-dictionary ## Pull verbs, nouns and adjectives from the Google Sheet into verbs.json and words.json, then run the checks
	uv run python scripts/build_verbs.py
	@$(NODE) scripts/build_declensions.js
	@git diff --stat -- docs/data/verbs.json docs/data/words.json docs/data/declensions.json
	@$(NODE) tests/test_verbs.js
	@$(NODE) tests/test_voice_sentences.js
	@$(NODE) tests/test_aspect_sentences.js
	@$(NODE) tests/test_aspect_forks.js
	@$(NODE) tests/test_nouns.js
	@$(NODE) tests/test_preposition_sentences.js
	@$(NODE) scripts/build_anki_verbs.js

fetch-dictionary: ## Download the pinned dictionary into docs/data/ if it isn't there
	@if [ ! -f $(DICT_GZ) ]; then \
		echo "Downloading $(DICT_URL)"; \
		curl -fL --retry 3 -o $(DICT_GZ).part "$(DICT_URL)" \
		&& echo "$(DICT_SHA256)  $(DICT_GZ).part" | shasum -a 256 -c --status \
		&& mv $(DICT_GZ).part $(DICT_GZ) \
		|| { rm -f $(DICT_GZ).part; echo "Download failed or the checksum doesn't match DICT_SHA256" >&2; exit 1; }; \
	elif ! echo "$(DICT_SHA256)  $(DICT_GZ)" | shasum -a 256 -c --status; then \
		echo "Note: $(DICT_GZ) isn't the pinned build. Publish it (make publish-dictionary) or delete it to download the pinned one."; \
	fi

dictionary: ## Copy in a new dictionary build (DICT_DB=path/to/lemma_greek_en.db), then check it
	gzip -9 -n -c "$(DICT_DB)" > $(DICT_GZ)
	@$(NODE) tests/test_dictionary.js
	@echo "Then run make verb-forms and make declensions, check the site, and run make publish-dictionary so the build uses it."

publish-dictionary: ## Upload docs/data's dictionary as a new GitHub release and pin the build to it
	@SHA=$$(shasum -a 256 $(DICT_GZ) | cut -d' ' -f1); \
	TAG=dictionary-$$(date +%Y%m%d); \
	gh release create $$TAG $(DICT_GZ) --title "Dictionary database $$(date +%Y-%m-%d)" \
		--notes "The lemma Greek–English SQLite dictionary the site's dictionary page loads, gzipped. The build downloads it and checks its SHA-256: \`$$SHA\`. Data from English Wiktionary via kaikki.org, CC BY-SA." \
	&& URL=$$(gh release view $$TAG --json assets -q '.assets[0].url') \
	&& sed -i.bak -e "s|^DICT_URL    := .*|DICT_URL    := $$URL|" -e "s|^DICT_SHA256 := .*|DICT_SHA256 := $$SHA|" Makefile \
	&& rm Makefile.bak && echo "Pinned $$TAG. Commit the Makefile."

verb-forms: ## Copy our verbs' forms from the dictionary into verb-forms.json (DICT_DB=path/to/lemma_greek_en.db)
	uv run python scripts/build_verb_forms.py "$(DICT_DB)"
	@git diff --stat -- docs/data/verb-forms.json
	@$(NODE) tests/test_verb_forms.js
	@$(NODE) tests/test_aspect_sentences.js
	@$(NODE) tests/test_aspect_forks.js
	@$(NODE) scripts/build_anki_verbs.js

declensions: fetch-dictionary ## Copy the word list's noun and adjective tables from the dictionary into declensions.json
	$(NODE) scripts/build_declensions.js
	@git diff --stat -- docs/data/declensions.json
	@$(NODE) tests/test_nouns.js
	@$(NODE) tests/test_preposition_sentences.js

anki-verbs: ## Write the verb cards for anki/ into exports/anki-verbs.json
	$(NODE) scripts/build_anki_verbs.js
	@git diff --stat -- exports/anki-verbs.json

anki-build: ## Build the Anki sync tool into anki/sync
	cd anki && go build -o sync ./cmd/sync

anki-test: ## Run the Anki sync tool's Go tests
	cd anki && go test ./...

push-words: anki-build ## Push the words tab to the Greek deck in Anki (DRY=1 to preview)
	$(ANKI) push $(DRY_RUN)

push-verbs: anki-build anki-verbs ## Push exports/anki-verbs.json to the Greek Verbs deck (DRY=1 to preview)
	$(ANKI) verbs --cards "$(CURDIR)/exports/anki-verbs.json" $(DRY_RUN)

anki: sync push-words push-verbs ## After editing the sheet: pull it, check it, push both decks (DRY=1 to preview)

test: fetch-dictionary ## Check the conjugation engine, the verb forms, the drills, the aspect forks and the dictionary lookup
	$(NODE) tests/test_verbs.js
	$(NODE) tests/test_verb_forms.js
	$(NODE) tests/test_voice_sentences.js
	$(NODE) tests/test_aspect_sentences.js
	$(NODE) tests/test_aspect_forks.js
	$(NODE) tests/test_nouns.js
	$(NODE) tests/test_numbers.js
	$(NODE) tests/test_pronoun_sentences.js
	$(NODE) tests/test_preposition_sentences.js
	$(NODE) tests/test_dictionary.js

dump: ## Print every verb's conjugations, for reviewing
	$(NODE) tests/test_verbs.js --dump

serve: fetch-dictionary ## Preview the site at http://127.0.0.1:8000 with live reload
	uv run mkdocs serve

build: fetch-dictionary ## Build the site into site/, failing on warnings like CI does
	uv run mkdocs build --strict

check: test anki-test build ## Everything CI checks before deploying, plus the Go tests

clean: ## Remove the built site
	rm -rf site

sheet: ## Open the vocabulary sheet in the browser
	open "$(SHEET_URL)"
