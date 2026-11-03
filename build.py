#!/usr/bin/env python3
"""Builds the two apps from one source: python3 build.py

    src/shell.html      head, the Wärme design system (CSS) and the app frame (rail, tabs, sheet)
    src/core.js         helpers and components shared by both apps (charts, theme, navigation)
    src/views-*.html    the pages of each home
    src/stg.js, src/wien.js   each home's data and behaviour

  public/index.html  Seewärme (St. Gilgen, Home Assistant)
  public/wien.html   Wien Wärme (Vienna, Intellihome bridge)

Only edit src/; the two HTML files in public/ are generated.
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).parent
SRC, PUB = ROOT / "src", ROOT / "public"

HOMES = {
    "index.html": dict(
        BRAND="see", NAME="Seewärme", DESC="Heating for the St. Gilgen flat", MANIFEST="manifest.json",
        ICONDIR="icons/", BAR_LIGHT="#F6FAFC", BAR_DARK="#0B1D2B", views="views-stg.html",
        scripts=[("module", '\nimport { createFlatView } from "./flatview.js";\n'
                            'createFlatView().then(m => { window.SW3D = m; dispatchEvent(new Event("m3d-ready")); })\n'
                            '  .catch(e => console.warn("Flat picture not available, showing the plan instead", e));\n'),
                 ("file", "plan.js"), ("file", "core.js"), ("file", "stg.js")],
        touch=PUB / "apple-touch-icon.png"),
    "wien.html": dict(
        BRAND="wien", NAME="Wien Wärme", DESC="Heating for the Vienna house", MANIFEST="manifest-wien.json",
        ICONDIR="icons/wien/", BAR_LIGHT="#FFF8F1", BAR_DARK="#17191F", views="views-wien.html",
        scripts=[("file", "core.js"), ("file", "wien.js")],
        touch=PUB / "icons/wien/apple-touch-icon.png"),
}


def build(out, c):
    if not (SRC / c["views"]).exists():
        return print(f"skip {out}: no {c['views']}")
    h = (SRC / "shell.html").read_text()
    h = h.replace("{{TOUCH}}", "data:image/png;base64," + base64.b64encode(c["touch"].read_bytes()).decode())
    for k in ("NAME", "DESC", "MANIFEST", "ICONDIR", "BAR_LIGHT", "BAR_DARK"):
        h = h.replace("{{%s}}" % k, c[k])
    h = h.replace("{{VIEWS}}", (SRC / c["views"]).read_text())
    parts = []
    for kind, v in c["scripts"]:
        parts.append(f'<script type="module">{v}</script>' if kind == "module" else
                     "<script>\n" + (SRC / v).read_text().rstrip("\n") + "\n</script>")
    h = h.replace("{{SCRIPTS}}", "\n".join(parts))
    assert not re.search(r"\{\{[A-Z_]+\}\}", h), "unfilled placeholder in " + out
    head = ('<!doctype html>\n<html lang="en" data-brand="%s">\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' % c["BRAND"])
    (PUB / out).write_text(head + h)
    print(f"built public/{out} ({len(head + h) // 1024} KB)")


for out, c in HOMES.items():
    build(out, c)
