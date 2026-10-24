#!/usr/bin/env python3
"""Build docs/tools/verbs.json from the verbs on the words tab of the Google Sheet.

Usage:
    python3 scripts/build_verbs.py            # download the sheet (it must be link-shared)
    python3 scripts/build_verbs.py --csv FILE # use a CSV export instead

Columns are found by their header, so their position in the sheet doesn't matter.
The conjugation itself happens in the browser (docs/tools/greek-verbs.js); this
script only copies the per-verb facts the rules can't work out.
"""

import argparse
import csv
import io
import json
import sys
import urllib.request
from pathlib import Path

SHEET_ID = "1p39Sbnkx3G4swoSPJ2KKVKu-VwteKmaAQ9toFadd5cA"
WORDS_GID = "833818589"
URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={WORDS_GID}"
OUT = Path(__file__).resolve().parent.parent / "docs" / "tools" / "verbs.json"

# JSON key -> sheet header
FIELDS = {
    "greek": "greek",
    "english": "english",
    "class": "attributes",
    "voice": "voice",
    "activeForm": "active form",
    "future": "future simple",
    "aorist": "aorist",
    "overrides": "overrides",
}


def read_rows(csv_path):
    if csv_path:
        text = Path(csv_path).read_text(encoding="utf-8")
    else:
        with urllib.request.urlopen(URL) as resp:
            text = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--csv", help="read this CSV export instead of downloading the sheet")
    args = parser.parse_args()

    rows = read_rows(args.csv)
    if not rows:
        sys.exit("No rows found in the words tab.")
    missing = [h for h in FIELDS.values() if h not in rows[0]]
    if missing:
        print(f"warning: sheet has no column(s) {', '.join(missing)}; they'll be empty", file=sys.stderr)

    verbs = {}
    for row in rows:
        if row.get("part of speech", "").strip().lower() != "verb":
            continue
        verb = {key: (row.get(header) or "").strip() for key, header in FIELDS.items()}
        if not verb["greek"]:
            continue
        # The same verb listed twice (e.g. with two meanings): keep one entry, join the meanings.
        if verb["greek"] in verbs:
            seen = verbs[verb["greek"]]
            if verb["english"] and verb["english"] not in seen["english"]:
                seen["english"] += "; " + verb["english"]
            continue
        verbs[verb["greek"]] = verb

    unfilled = [v["greek"] for v in verbs.values()
                if not v["aorist"] and "no perfective" not in v["overrides"]]
    if unfilled:
        print(f"note: {len(unfilled)} verb(s) have no aorist yet: {' '.join(unfilled)}", file=sys.stderr)

    # One verb per line keeps diffs readable.
    lines = [json.dumps({k: v for k, v in verb.items() if v}, ensure_ascii=False) for verb in verbs.values()]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")
    print(f"Wrote {len(lines)} verbs to {OUT.relative_to(Path.cwd()) if OUT.is_relative_to(Path.cwd()) else OUT}")


if __name__ == "__main__":
    main()
