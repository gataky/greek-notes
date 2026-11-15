"""MkDocs hook that stamps each page with the commit it was built from, so an installed app shows
which version it's running (overrides/app.html under each full-page app, and
overrides/partials/copyright.html in the notes' footer).

It gives the templates `build`: { commit (short hash), full, date, url, dirty }, where url is the
commit under mkdocs.yml's extra.repo. `dirty` is true
when the working tree has uncommitted changes (a local build or `make serve`), never in CI.
Without git, `build` is None and nothing is shown.
"""

import subprocess
from pathlib import Path

def _git(root, *args):
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=True).stdout.strip()


def on_config(config):
    root = Path(config.config_file_path).parent
    try:
        full, short, date = _git(root, "log", "-1", "--format=%H %h %cs").split()
        dirty = bool(_git(root, "status", "--porcelain", "--untracked-files=no"))
    except (OSError, subprocess.CalledProcessError, ValueError):
        config.extra["build"] = None
        return config
    config.extra["build"] = {"commit": short, "full": full, "date": date, "url": f"{config.extra['repo'].rstrip('/')}/commit/{full}", "dirty": dirty}
    return config
