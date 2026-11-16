---
template: app.html
back: labs/
back_label: Labs
app: aspect-map.html
---

# Aspect map

How each verb's present turns into its perfective. The first chart follows every active verb in the dictionary from the ending of its present (-ζω, -νω, -ώ / -άω …), through its group, to what its perfective stem does (ψ, ξ, σ, -ησ-, no σ, unchanged, irregular). Size the bands by the number of verbs or by usage, and limit them to your word list. Click a band or a box to list its verbs, most common first, with their five forms side by side.

The second chart sets each group's share of the verbs against its share of usage. Usage is the frequency of the dictionary form (έχω, not every form of it) in a subtitle corpus, so it's a rough ranking: groups that slope up are worth learning before their size suggests.

The groups are the [aspect forks](../notes/tools/aspect-forks.md)' groups, and the forms are the ones the [verb tables](../notes/tools/verb-tables.md) show. The data is rebuilt by `make aspect-map`, which `make sync` and `make verb-forms` run.
