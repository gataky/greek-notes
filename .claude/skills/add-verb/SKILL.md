---
name: add-verb
description: Take Greek verbs that were just added to the vocabulary sheet all the way through to the site and Anki - fill their verb columns, pull them into verbs.json, write their tense and aspect sentences, preview and push the Anki decks, and commit. Use this whenever the user says they've added verbs (or new words that include verbs) to the sheet, asks to "add a verb", wants new verbs on the verb tables, aspect forks, drills or Anki cards, or asks why a new verb isn't showing up in one of them.
---

# Add a verb

A verb added to the words tab reaches the site and Anki only after several steps, and one of them (sentences) needs writing, not just running. This skill does them in order. Everything here gets studied as correct Greek, so a gap is better than a guess: leave a form or sentence out and say why, rather than invent it.

Run every command from the repo root. CLAUDE.md has the background on each piece: "Verb tables", "Tense and aspect drill" and "Anki sync tool".

## 1. Fill the verb columns

Follow `.claude/skills/fill-verb-forms/SKILL.md`, for the verbs the user named or, if they named none, its default selection of verb rows with missing columns. Skip its closing reminder about `./sync push`: step 6 here pushes.

If it finds no rows and the user didn't name a verb, check whether the verbs are already filled but missing from the site: `make sync` in step 2 shows that in its diff. If nothing is new there either, say so and stop.

## 2. Pull them into the site

```sh
make sync
```

This downloads the sheet into `docs/data/verbs.json`, runs the checks, then rebuilds `exports/anki-verbs.json`. Read its output:

- `git diff --stat` on `verbs.json` should show the new verbs. If they're missing, check their `part of speech` is exactly `verb`.
- `note: … have no aorist yet` lists verbs step 1 left incomplete. That's fine if you meant to, and should match your step 1 report.
- It stops at the first failing check, so the export isn't rebuilt yet.
  - `<verb> has no sentences` (test_aspect_sentences.js) is expected for a new active verb. Go on to step 4.
  - Any other failure means the sheet change broke existing data, for example a re-entered verb whose forms changed under its sentences. Stop and show the user. Don't edit old sentences or sheet rows to make it pass without asking.

## 3. Dictionary forms

The site and the Anki cards show the dictionary's forms from `docs/data/verb-forms.json`, which already has about 2,500 dictionary verbs. Check each new verb with `grep -c '^"<verb>":' docs/data/verb-forms.json`.

- **In the file:** nothing to do.
- **Not in the file, and `../lemma/lemma_greek_en/lemma_greek_en.db` exists:** run `make verb-forms`.
- **Not in the file, and there's no database:** the verb shows the engine's forms, worked out from the sheet's columns. Tell the user, so they know those forms are only as good as step 1.

## 4. Sentences (active verbs only)

Write each new active verb's sentences in `docs/data/aspect-sentences.json`. The format and rules are in CLAUDE.md under "Tense and aspect drill". In short:

- One object per line, grouped by verb, with the verbs in `verbs.json`'s order. Insert the new verb's block where it falls, not at the end.
- Most verbs have six sentences: the past, the future and να, each continuous and simple. The two past ones matter most. Each becomes an Anki cloze card, and the past simple one is the example on the verb's own card.
  - If one aspect isn't natural for a verb, leave it out rather than force it.
  - Verbs with one form for both aspects (like κάνω) get one sentence per tense.
- Use only words already on the words tab (read `words!D:D`). Mark the verb in the English once, `*like this*`. Write "you (sg)" or "you (pl)".
- Choose the aspect by what the sentence means (`ongoing` or `repeated` for continuous, `once` for simple), and make the Greek context show it: κάθε μέρα, χθες, όταν….

Passive and deponent verbs don't go in this file. For those, run `node tests/test_voice_sentences.js --gaps` and offer to write sentences for the active or passive drill (`voice-sentences.json`). The drill works without them.

Then run:

```sh
node tests/test_aspect_sentences.js --gaps
```

Fix every problem it reports and check the gaps it lists for the new verbs, then run `make sync` again until it passes. Re-read `git diff exports/anki-verbs.json`: each new verb should have its forms, group and example, and its past sentences should appear as cloze items.

## 5. Preview

Anki must be open with AnkiConnect. Run:

```sh
make anki DRY=1
```

If it can't reach AnkiConnect, ask the user to open Anki and run it again.

Show the user, for each new verb:

- its present, past continuous, aorist and future, and its group;
- the sentences you wrote, Greek and English;
- the dry run's counts for both decks. Expect the new words and verbs, plus their cloze notes. Anything else that changes is worth pointing out.

Wait for the user to approve, or to correct a form or sentence. After a correction, go back to the step it belongs to: step 1 for the sheet, step 4 for sentences.

## 6. Push and commit

```sh
make anki
```

Then commit what changed: `docs/data/verbs.json`, `docs/data/aspect-sentences.json`, `exports/anki-verbs.json`, and `docs/data/verb-forms.json` if step 3 rebuilt it. Use a message like `Add the verbs κερδίζω and χάνω`.

Ask before `git push`: pushing to `main` deploys the site.

## Report

End with a short table of each verb: its forms, the number of sentences, and whether it went to Anki. Under the table, list anything you left out and why: a blank form, a missing aspect, a passive with no drill sentences.
