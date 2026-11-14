#!/usr/bin/env python3
"""Write the colour themes into docs/stylesheets/theme.css and docs/javascripts/palette.js.

Each theme has a light and a dark set of the site's colour tokens (see theme.css). The colours
come from the themes' own palettes (the Neovim colour schemes they're named after), then every
one is checked against the backgrounds it's drawn on:

- text colours (--ink, --muted, --accent, --aug, --good, --warn, --bad): 4.5:1 on --bg,
  --surface and --accent-soft, and the feedback colours on their own tints too;
- the gender pills (--masculine, --feminine, --neuter), drawn behind --surface text: 4.5:1;
- the part-of-speech bars (--verb ... --other): 3:1 on --bg and --surface;
- --line: 1.7:1 on --surface, so table rules and card borders show.

A colour that falls short is moved, keeping its hue, darker on light and lighter on dark until it
passes (in OKLCH, losing chroma only where the screen can't show it). The script prints each one
it moved, so a palette change shows what it costs.

    python3 scripts/build_themes.py          # write both files
    python3 scripts/build_themes.py --check  # fail if they aren't up to date (make test)

Stdlib only. The default theme (no data-palette) is the site's own high-contrast gruvbox.
"""

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / "docs/stylesheets/theme.css"
JS = ROOT / "docs/javascripts/palette.js"


# ---------- Colour maths: sRGB hex <-> OKLCH, WCAG contrast ----------

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def rgb(hex_):
    return [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)]


def hexof(rgb_):
    return "#" + "".join(f"{round(max(0.0, min(1.0, c)) * 255):02x}" for c in rgb_)


def oklch(hex_):
    r, g, b = (_lin(c) for c in rgb(hex_))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.atan2(bb, a)


def _linear_rgb(L, C, H):
    a, b = C * math.cos(H), C * math.sin(H)
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841694 * a - 1.2914855480 * b) ** 3
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]


def from_oklch(L, C, H):
    """The colour at L and H with chroma C, or as much of it as sRGB can show."""
    L = max(0.0, min(1.0, L))
    lo, hi = 0.0, C
    if all(-1e-4 <= c <= 1 + 1e-4 for c in _linear_rgb(L, C, H)):
        lo = C
    else:
        for _ in range(30):
            mid = (lo + hi) / 2
            if all(-1e-4 <= c <= 1 + 1e-4 for c in _linear_rgb(L, mid, H)):
                lo = mid
            else:
                hi = mid
    return hexof([_gam(max(0.0, min(1.0, c))) for c in _linear_rgb(L, lo, H)])


def luminance(hex_):
    r, g, b = (_lin(c) for c in rgb(hex_))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def mix(a, b, t):
    """t of a, the rest b, in sRGB like CSS color-mix(in srgb, a t, b)."""
    return hexof([x * t + y * (1 - t) for x, y in zip(rgb(a), rgb(b))])


# ---------- The themes ----------

# Token order as written in theme.css. "soft" is --accent-soft.
TOKENS = ["bg", "surface", "ink", "muted", "line", "accent", "soft", "aug", "good", "warn", "bad",
          "verb", "noun", "adj", "adv", "prep", "other", "masculine", "feminine", "neuter"]
TEXT = ["ink", "muted", "accent", "aug", "good", "warn", "bad"]
PILLS = ["masculine", "feminine", "neuter"]
BARS = ["verb", "noun", "adj", "adv", "prep", "other"]


def theme(**sets):
    return sets


# Gruvbox (ellisonleao/gruvbox.nvim)
GB = dict(
    dark0_hard="#1d2021", dark0="#282828", dark0_soft="#32302f", dark1="#3c3836", dark2="#504945",
    dark3="#665c54", dark4="#7c6f64", light0_hard="#f9f5d7", light0="#fbf1c7", light0_soft="#f2e5bc",
    light1="#ebdbb2", light2="#d5c4a1", light3="#bdae93", light4="#a89984",
    bright_red="#fb4934", bright_green="#b8bb26", bright_yellow="#fabd2f", bright_blue="#83a598",
    bright_purple="#d3869b", bright_aqua="#8ec07c", bright_orange="#fe8019",
    neutral_red="#cc241d", neutral_green="#98971a", neutral_yellow="#d79921", neutral_blue="#458588",
    neutral_purple="#b16286", neutral_aqua="#689d6a", neutral_orange="#d65d0e",
    faded_red="#9d0006", faded_green="#79740e", faded_yellow="#b57614", faded_blue="#076678",
    faded_purple="#8f3f71", faded_aqua="#427b58", faded_orange="#af3a03", gray="#928374",
)

# Kanagawa (rebelot/kanagawa.nvim): Wave (dark) and Lotus (light)
KW = dict(
    sumiInk3="#1F1F28", sumiInk4="#2A2A37", sumiInk5="#363646", sumiInk6="#54546D",
    fujiWhite="#DCD7BA", fujiGray="#727169", crystalBlue="#7E9CD8", springBlue="#7FB4CA",
    oniViolet="#957FB8", springGreen="#98BB6C", carpYellow="#E6C384", surimiOrange="#FFA066",
    sakuraPink="#D27E99", waveRed="#E46876", waveAqua2="#7AA89F", katanaGray="#717C7C",
    lotusInk1="#545464", lotusGray2="#716e61", lotusGray3="#8a8980", lotusWhite0="#d5cea3",
    lotusWhite1="#dcd5ac", lotusWhite2="#e5ddb0", lotusWhite3="#f2ecbc", lotusViolet4="#624c83",
    lotusBlue4="#4d699b", lotusGreen="#6f894e", lotusPink="#b35b79", lotusOrange="#cc6d00",
    lotusYellow3="#de9800", lotusRed="#c84053", lotusAqua="#597b75", lotusTeal1="#4e8ca2",
)

# Tokyo Night (folke/tokyonight.nvim): Night (dark, with Storm's darker surface) and Day (light)
TN = dict(
    bg="#1a1b26", storm_bg_dark="#1f2335", bg_highlight="#292e42", fg_gutter="#3b4261",
    fg="#c0caf5", dark5="#737aa2", blue="#7aa2f7", cyan="#7dcfff", magenta="#bb9af7",
    orange="#ff9e64", yellow="#e0af68", green="#9ece6a", green1="#73daca", red="#f7768e",
    day_bg="#e1e2e7", day_bg_dark="#d0d5e3", day_bg_highlight="#c4c8da", day_fg_gutter="#a8aecb",
    day_fg="#3760bf", day_dark5="#68709a", day_dark3="#8990b3", day_blue="#2e7de9",
    day_cyan="#007197", day_magenta="#9854f1", day_orange="#b15c00", day_yellow="#8c6c3e",
    day_green="#587539", day_teal="#118c74", day_red="#f52a65", day_red1="#c64343",
)

# Melange (savq/melange-nvim): its a (greys), b (bright) and c (muted) rows
MD = dict(bg="#292522", float="#34302C", sel="#403A36", ui="#867462", com="#C1A78E", fg="#ECE1D7",
          red="#D47766", yellow="#EBC06D", green="#85B695", cyan="#89B3B6", blue="#A3A9CE",
          magenta="#CF9BC2", c_yellow="#E49B5D")
ML = dict(bg="#F1F1F1", float="#E9E1DB", sel="#D9D3CE", ui="#A98A78", com="#7D6658", fg="#54433A",
          red="#BF0021", yellow="#A06D00", green="#3A684A", cyan="#3D6568", blue="#465AA4",
          magenta="#904180", c_yellow="#BC5C00")

THEMES = [
    dict(id="default", name="Default", note="Gruvbox, high contrast",
         light=dict(bg="#f2e5bc", surface="#f9f5d7", ink="#282828", muted="#665c54", line="#bdae93",
                    accent="#0075af", soft="#ebdbb2", aug="#a21f79",
                    good="#686300", warn="#ad3800", bad="#c00009",
                    verb="#da5c00", noun="#0075af", adj="#888700", adv="#c64d89", prep="#b77500", other="#967f68",
                    masculine="#0075af", feminine="#c00009", neuter="#15804c"),
         dark=dict(bg="#1d2021", surface="#282828", ink="#fbf1c7", muted="#bdae93", line="#665c54",
                   accent="#5eb3cc", soft="#3c3836", aug="#f17da0",
                   good="#cfd300", warn="#febc00", bad="#ff7965",
                   verb="#ff7e07", noun="#5eb3cc", adj="#cfd300", adv="#e97599", prep="#febc00", other="#98816b",
                   masculine="#5eb3cc", feminine="#ff7965", neuter="#7ac75c")),
    dict(id="gruvbox", name="Gruvbox", note="the original",
         light=dict(bg=GB["light0"], surface=GB["light0_hard"], ink=GB["dark1"], muted=GB["dark4"], line=GB["light2"],
                    accent=GB["faded_blue"], soft=GB["light1"], aug=GB["faded_purple"],
                    good=GB["faded_green"], warn=GB["faded_orange"], bad=GB["faded_red"],
                    verb=GB["neutral_orange"], noun=GB["neutral_blue"], adj=GB["neutral_green"],
                    adv=GB["neutral_purple"], prep=GB["neutral_yellow"], other=GB["gray"],
                    masculine=GB["faded_blue"], feminine=GB["faded_red"], neuter=GB["faded_aqua"]),
         dark=dict(bg=GB["dark0"], surface=GB["dark0_soft"], ink=GB["light1"], muted=GB["light4"], line=GB["dark2"],
                   accent=GB["bright_blue"], soft=GB["dark1"], aug=GB["bright_purple"],
                   good=GB["bright_green"], warn=GB["bright_yellow"], bad=GB["bright_red"],
                   verb=GB["bright_orange"], noun=GB["bright_blue"], adj=GB["bright_green"],
                   adv=GB["bright_purple"], prep=GB["bright_yellow"], other=GB["gray"],
                   masculine=GB["bright_blue"], feminine=GB["bright_red"], neuter=GB["bright_aqua"])),
    dict(id="kanagawa", name="Kanagawa", note="Wave and Lotus",
         light=dict(bg=KW["lotusWhite2"], surface=KW["lotusWhite3"], ink=KW["lotusInk1"], muted=KW["lotusGray2"],
                    line=KW["lotusWhite0"], accent=KW["lotusBlue4"], soft=KW["lotusWhite1"], aug=KW["lotusViolet4"],
                    good=KW["lotusGreen"], warn=KW["lotusOrange"], bad=KW["lotusRed"],
                    verb=KW["lotusOrange"], noun=KW["lotusBlue4"], adj=KW["lotusGreen"], adv=KW["lotusPink"],
                    prep=KW["lotusYellow3"], other=KW["lotusGray3"],
                    masculine=KW["lotusTeal1"], feminine=KW["lotusRed"], neuter=KW["lotusAqua"]),
         dark=dict(bg=KW["sumiInk3"], surface=KW["sumiInk4"], ink=KW["fujiWhite"], muted=KW["fujiGray"],
                   line=KW["sumiInk6"], accent=KW["crystalBlue"], soft=KW["sumiInk5"], aug=KW["oniViolet"],
                   good=KW["springGreen"], warn=KW["carpYellow"], bad=KW["waveRed"],
                   verb=KW["surimiOrange"], noun=KW["crystalBlue"], adj=KW["springGreen"], adv=KW["sakuraPink"],
                   prep=KW["carpYellow"], other=KW["katanaGray"],
                   masculine=KW["springBlue"], feminine=KW["waveRed"], neuter=KW["waveAqua2"])),
    dict(id="tokyonight", name="Tokyo Night", note="Night and Day",
         light=dict(bg=TN["day_bg_dark"], surface=TN["day_bg"], ink=TN["day_fg"], muted=TN["day_dark5"],
                    line=TN["day_fg_gutter"], accent=TN["day_blue"], soft=TN["day_bg_highlight"], aug=TN["day_magenta"],
                    good=TN["day_green"], warn=TN["day_orange"], bad=TN["day_red1"],
                    verb=TN["day_orange"], noun=TN["day_blue"], adj=TN["day_green"], adv=TN["day_magenta"],
                    prep=TN["day_yellow"], other=TN["day_dark3"],
                    masculine=TN["day_cyan"], feminine=TN["day_red"], neuter=TN["day_teal"]),
         dark=dict(bg=TN["bg"], surface=TN["storm_bg_dark"], ink=TN["fg"], muted=TN["dark5"], line=TN["fg_gutter"],
                   accent=TN["blue"], soft=TN["bg_highlight"], aug=TN["magenta"],
                   good=TN["green"], warn=TN["yellow"], bad=TN["red"],
                   verb=TN["orange"], noun=TN["blue"], adj=TN["green"], adv=TN["magenta"], prep=TN["yellow"],
                   other=TN["dark5"], masculine=TN["cyan"], feminine=TN["red"], neuter=TN["green1"])),
    dict(id="melange", name="Melange", note="warm",
         light=dict(bg=ML["float"], surface=ML["bg"], ink=ML["fg"], muted=ML["com"], line=mix(ML["ui"], ML["bg"], 0.55),
                    accent=ML["yellow"], soft=ML["sel"], aug=ML["magenta"],
                    good=ML["green"], warn=ML["c_yellow"], bad=ML["red"],
                    verb=ML["c_yellow"], noun=ML["blue"], adj=ML["green"], adv=ML["magenta"], prep=ML["yellow"],
                    other=ML["ui"], masculine=ML["blue"], feminine=ML["red"], neuter=ML["cyan"]),
         dark=dict(bg=MD["bg"], surface=MD["float"], ink=MD["fg"], muted=MD["com"], line=mix(MD["ui"], MD["float"], 0.5),
                   accent=MD["yellow"], soft=MD["sel"], aug=MD["magenta"],
                   good=MD["green"], warn=MD["c_yellow"], bad=MD["red"],
                   verb=MD["c_yellow"], noun=MD["blue"], adj=MD["green"], adv=MD["magenta"], prep=MD["yellow"],
                   other=MD["ui"], masculine=MD["blue"], feminine=MD["red"], neuter=MD["cyan"])),
]


# ---------- Contrast checks ----------

def requirements(c, token):
    """(background, minimum ratio) pairs for one token of colour set c."""
    if token in TEXT:
        backs = [c["bg"], c["surface"], c["soft"]]
        if token in ("good", "warn", "bad"):
            backs.append(mix(c[token], c["surface"], 0.14))  # its -soft tint (theme.css)
        return [(b, 4.5) for b in backs]
    if token in PILLS:
        return [(c["surface"], 4.5)]
    if token in BARS:
        return [(c["bg"], 3.0), (c["surface"], 3.0)]
    if token == "line":
        return [(c["surface"], 1.7)]
    return []


def passes(c, token, colour):
    probe = dict(c, **{token: colour})
    return all(contrast(colour, b) >= need for b, need in requirements(probe, token))


def readable(c, token, dark):
    """The token's colour, moved darker (light set) or lighter (dark set) until it passes."""
    colour = c[token]
    if passes(c, token, colour):
        return colour
    L, C, H = oklch(colour)
    step = 0.004 if dark else -0.004
    for i in range(1, 250):
        moved = from_oklch(L + step * i, C, H)
        if passes(c, token, moved):
            return moved
    sys.exit(f"build_themes: can't make {token} {colour} readable")


def checked(theme_):
    out = {}
    for mode in ("light", "dark"):
        c = dict(theme_[mode])
        missing = [t for t in TOKENS if t not in c]
        if missing:
            sys.exit(f"build_themes: {theme_['id']} {mode} has no {', '.join(missing)}")
        # Lines and backgrounds first, since the others are checked against them.
        for token in ["line"] + TEXT + PILLS + BARS:
            fixed = readable(c, token, mode == "dark")
            if fixed != c[token]:
                print(f"  {theme_['id']:11} {mode:5} {token:9} {c[token]} -> {fixed}")
                c[token] = fixed
        out[mode] = c
    return out


# ---------- Output ----------

NAMES = {"soft": "accent-soft"}


def declarations(c, indent):
    def row(tokens):
        return indent + " ".join(f"--{NAMES.get(t, t)}: {c[t].lower()};" for t in tokens)
    return "\n".join([
        row(["bg", "surface", "ink", "muted", "line"]),
        row(["accent", "soft", "aug"]),
        row(["good", "warn", "bad"]),
        row(["verb", "noun", "adj", "adv", "prep", "other"]),
        row(["masculine", "feminine", "neuter"]),
    ])


def css_block(theme_, sets):
    if theme_["id"] == "default":
        light_sel = ':root,\n[data-md-color-scheme="default"]'
        media_sel = ':root:not([data-theme="light"])'
        dark_sel = ':root[data-theme="dark"],\n[data-md-color-scheme="slate"]'
    else:
        p = f'[data-palette="{theme_["id"]}"]'
        light_sel = f':root{p},\n{p} [data-md-color-scheme="default"]'
        media_sel = f':root{p}:not([data-theme="light"])'
        dark_sel = f':root{p}[data-theme="dark"],\n{p} [data-md-color-scheme="slate"]'
    light, dark = sets["light"], sets["dark"]
    return (f"/* {theme_['name']}: {theme_['note']} */\n"
            f"{light_sel} {{\n{declarations(light, '  ')}\n  color-scheme: light;\n}}\n"
            f"@media (prefers-color-scheme: dark) {{\n  {media_sel} {{\n{declarations(dark, '    ')}\n"
            f"    color-scheme: dark;\n  }}\n}}\n"
            f"{dark_sel} {{\n{declarations(dark, '  ')}\n  color-scheme: dark;\n}}\n")


def js_entry(theme_, sets):
    def preview(c):
        return {"bg": c["bg"], "surface": c["surface"], "line": c["line"], "ink": c["ink"],
                "accent": c["accent"], "dots": [c[t] for t in ("verb", "noun", "adj", "adv", "feminine")]}
    return json.dumps({"id": theme_["id"], "name": theme_["name"], "note": theme_["note"],
                       "light": preview(sets["light"]), "dark": preview(sets["dark"])}, ensure_ascii=False)


def replace_between(text, begin, end, body, path):
    pattern = re.compile(re.escape(begin) + r".*?" + re.escape(end), re.S)
    if not pattern.search(text):
        sys.exit(f"build_themes: no {begin!r} ... {end!r} in {path}")
    return pattern.sub(lambda _: f"{begin}\n{body}{end}", text, count=1)


def main():
    check = "--check" in sys.argv[1:]
    ids = [t["id"] for t in THEMES]
    if len(set(ids)) != len(ids) or ids[0] != "default":
        sys.exit("build_themes: theme ids must be unique, default first")
    print("Colours moved to be readable:")
    built = [(t, checked(t)) for t in THEMES]

    css = replace_between(CSS.read_text(), "/* BEGIN THEMES (scripts/build_themes.py) */", "/* END THEMES */",
                          "\n".join(css_block(t, s) for t, s in built), CSS)
    js = replace_between(JS.read_text(), "// BEGIN THEMES (scripts/build_themes.py)", "  // END THEMES",
                         "  const THEMES = [\n" + "".join(f"    {js_entry(t, s)},\n" for t, s in built) + "  ];\n",
                         JS)

    stale = [p for p, text in ((CSS, css), (JS, js)) if p.read_text() != text]
    if check:
        if stale:
            sys.exit(f"build_themes: {', '.join(str(p.relative_to(ROOT)) for p in stale)} out of date; "
                     "run make themes")
        print(f"themes OK ({len(THEMES)} themes)")
        return
    CSS.write_text(css)
    JS.write_text(js)
    print(f"Wrote {len(THEMES)} themes" + (f" ({', '.join(p.name for p in stale)} changed)" if stale else ", no changes"))


if __name__ == "__main__":
    main()
