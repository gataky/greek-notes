---
template: app.html
back: notes/
back_label: Notes
app: verb-tables.html
pass_hash: true
---

# Verb tables

Pick a verb to see its forms. Every Greek verb has two stems: continuous (γράφ-) and simple (γράψ-). Each stem has a present and a past set of endings. The other tenses are built from those four sets with θα, να and έχω, and the table spells them out for each verb. Endings are highlighted.

The verbs come from the words tab of the vocabulary sheet, and their forms from the dictionary, which is Wiktionary's data. Forms it doesn't have are generated. After adding or changing verbs in the sheet, run `make sync` and `make verb-forms`, and commit `docs/data/verbs.json` and `docs/data/verb-forms.json`.
