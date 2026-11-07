#!/usr/bin/env python3
"""Build docs/tools/verb-forms.json: the labelled forms of our verbs from the lemma dictionary.

Usage:
    python3 scripts/build_verb_forms.py path/to/lemma_greek_en.db   (or: make verb-forms)

The verb tables page can't load the 22 MB dictionary, so this copies out just the cells its
grid shows. The database is the source of truth: docs/tools/verb-forms.js shows these forms
and only falls back to the conjugation engine for cells that aren't here.

Each verb has six-person columns (present, imperfect, past, dependent), two-person imperatives
(impCont, impSimple) and the infinitive-aorist. A cell is a list of alternatives, most usual
first; [] means the form doesn't exist, null means the data doesn't say. Verbs with no
conjugation table are left out.
"""

import json
import re
import sqlite3
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERBS = ROOT / "docs" / "tools" / "verbs.json"
OUT = ROOT / "docs" / "tools" / "verb-forms.json"

SIX = [("first-person", "singular"), ("second-person", "singular"), ("third-person", "singular"),
       ("first-person", "plural"), ("second-person", "plural"), ("third-person", "plural")]
TWO = [("second-person", "singular"), ("second-person", "plural")]
COLUMNS = {
    "present": (("present", "imperfective", "indicative"), SIX),
    "imperfect": (("imperfect", "imperfective", "indicative"), SIX),
    "past": (("past", "perfective", "indicative"), SIX),
    "dependent": (("dependent", "perfective", "indicative"), SIX),
    "impCont": (("imperative", "imperfective"), TWO),
    "impSimple": (("imperative", "perfective"), TWO),
}
VOICES = ("active", "passive")
HIDDEN = {"rare", "archaic", "dated"}  # hidden unless the cell has nothing else
DASHES = "-‑–—−"
GREEK = "Ͱ-Ͽἀ-῿"
WORD = re.compile(f"^[{GREEK}]+$")
CROSS_REF = re.compile(r"\s*\((?:[^()]|\([^()]*\))*→(?:[^()]|\([^()]*\))*\)\s*$")  # ρωτώ (ερωτώ →)
TWO_FORMS = re.compile(r"(\S+)\s+\((\S+)\)")                                       # θέλουν (θένε)


def nfc(text):
    return unicodedata.normalize("NFC", text)


def plain(text):
    return "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))


def expand_ending(previous, ending):
    """-όμαστε after ερχόμασταν is ερχόμαστε: graft it where its first letter last occurs."""
    at = plain(previous).rfind(plain(ending)[0]) if previous else -1
    if at <= 0:
        return None
    stem = previous[:at]
    return (plain(stem) if plain(ending) != ending else stem) + ending


def pieces(raw):
    """The forms inside one row's text, which can hold several and some markup."""
    text = CROSS_REF.sub("", nfc(raw).strip()).strip("[]{} ")
    text = re.sub(f"(?<=[{GREEK}])v", "ν", text)  # a Latin v typed for ν: βοηθούσαv
    text = re.sub(r"[¹²³⁴⁵*†]", "", text)
    out = []
    for part in re.split(r"\s*,\s*|\s+[-‑–—/]\s+", text):
        part = part.strip()
        part = part[1:-1] if part.startswith("(") and part.endswith(")") else part
        both = TWO_FORMS.fullmatch(part)
        out += both.groups() if both else [part]
    return out


def parse_cell(rows, where, problems):
    """Rows of (text, tags) -> list of forms, [] for a dash, None if there are no rows."""
    if not rows:
        return None
    usual = [text for text, tags in rows if not tags & HIDDEN] or [text for text, _ in rows]
    forms, dash = [], False
    for raw in usual:
        for form in pieces(raw):
            if form and all(c in DASHES for c in form):
                dash = True
                continue
            if form and form[0] in DASHES:
                form = expand_ending(forms[-1] if forms else None, form[1:])
                if form is None:
                    problems["ending with nothing to attach to"].append(f"{where}: {raw}")
                    continue
            if form.endswith(("'", "’")):  # γράφ', a spoken elision of γράψε
                problems["elision (left out)"].append(f"{where}: {form}")
                continue
            if not all(WORD.match(word) for word in form.split(" ")):
                problems["couldn't read"].append(f"{where}: {raw}")
                continue
            if form not in forms:
                forms.append(form)
    return forms if forms or dash else None


class Dictionary:
    def __init__(self, path):
        self.db = sqlite3.connect(f"{Path(path).resolve().as_uri()}?mode=ro", uri=True)
        version = self.db.execute("SELECT value FROM meta WHERE key = 'schema_version'").fetchone()[0]
        if version != "3":
            sys.exit(f"expected dictionary schema_version 3, got {version}")

    def tables(self, word):
        """The headword's own conjugation tables, as lists of (text, tags)."""
        found = self.db.execute(
            """SELECT t.id FROM headword h
               JOIN entry e ON e.headword_id = h.id
               JOIN inflection_table t ON t.entry_id = e.id
               WHERE h.word = ? AND e.pos = 'verb' AND t.kind = 'conjugation' AND t.word IS NULL
               ORDER BY t.ord""", (word,)).fetchall()
        return [[(nfc(form), frozenset(tags.split())) for form, tags in self.db.execute(
            """SELECT i.form, g.tags FROM inflection i JOIN inflection_tags g ON g.id = i.tags_id
               WHERE i.table_id = ? ORDER BY i.ord""", (table,))] for table, in found]

    def routes(self, verb):
        """Headwords that might hold this verb's table, in order. `form` reaches variants
        (βοηθώ → βοηθάω). A passive with its own headword isn't in `form`, but its headword
        line names the active verb (σηκώνομαι → σηκώνω)."""
        greek = nfc(verb["greek"])
        yield [greek]
        yield [w for w, in self.db.execute(
            """SELECT DISTINCT h.word FROM form f JOIN headword h ON h.id = f.headword_id
               WHERE f.form = ? AND h.word <> ?""", (greek, greek))]
        yield [nfc(w) for w, in self.db.execute(
            """SELECT r.form FROM inflection_row r
               JOIN entry e ON e.id = r.entry_id JOIN headword h ON h.id = e.headword_id
               WHERE h.word = ? AND r.kind = 'head' AND ' ' || r.tags || ' ' LIKE '% active %'""", (greek,))]
        yield [nfc(verb["activeForm"])] if verb.get("activeForm") else []

    def find(self, verb):
        """(headword, table, voice) for the table whose present lists this verb, or None.

        The voice comes from that match, not the sheet: deponents are tagged passive,
        but είμαι is tagged active. With several tables, prefer the one listing it first."""
        greek = nfc(verb["greek"])
        for words in self.routes(verb):
            best = None
            for word in words:
                for table in self.tables(word):
                    for voice in VOICES:
                        rows = cell_rows(table, voice, COLUMNS["present"][0] + ("first-person", "singular"))
                        listed = [f for text, _ in rows for f in pieces(text)]
                        if greek in listed and (not best or listed.index(greek) < best[0]):
                            best = (listed.index(greek), word, table, voice)
            if best:
                return best[1:]
        return None


def cell_rows(table, voice, wanted):
    wanted = set(wanted)
    rows = [(text, tags) for text, tags in table if wanted <= tags and voice in tags]
    return rows or [(text, tags) for text, tags in table if wanted <= tags and not tags & set(VOICES)]


def verb_forms(verb, word, table, voice, problems):
    out = {"table": word, "voice": voice}
    for name, (tense, people) in COLUMNS.items():
        out[name] = [parse_cell(cell_rows(table, voice, tense + person), f"{verb['greek']} {name} {i}", problems)
                     for i, person in enumerate(people)]
    out["infinitive"] = parse_cell(cell_rows(table, voice, ("infinitive-aorist",)), f"{verb['greek']} infinitive", problems)
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    dictionary = Dictionary(sys.argv[1])
    verbs = json.loads(VERBS.read_text(encoding="utf-8"))
    problems, found, missing = defaultdict(list), {}, []
    for verb in verbs:
        match = dictionary.find(verb)
        if match:
            found[nfc(verb["greek"])] = verb_forms(verb, *match, problems)
        else:
            missing.append(verb["greek"])

    lines = [f"{json.dumps(greek, ensure_ascii=False)}: {json.dumps(forms, ensure_ascii=False)}" for greek, forms in found.items()]
    OUT.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")

    routes = Counter("own table" if forms["table"] == greek else "another headword's table" for greek, forms in found.items())
    print(f"Wrote {OUT.relative_to(ROOT)}: {dict(routes)}")
    print(f"No table, so generated: {', '.join(missing) or 'none'}")
    for kind, items in problems.items():
        print(f"{kind}: {len(items)}")
        for item in items:
            print(f"  {item}")


if __name__ == "__main__":
    main()
