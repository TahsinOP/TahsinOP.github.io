#!/usr/bin/env python3
"""Create a detail-page stub for every research item, project and competition.

Run after adding an item to _data/*.yml:   python3 tools/make_pages.py
Writes research/<slug>.html and projects/<slug>.html (layout: detail); the
content itself lives in the data files. Stubs for removed items are deleted.
"""
import os, sys, glob, yaml

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..")
load = lambda n: yaml.safe_load(open(os.path.join(ROOT, "_data", n))) or []

groups = {
    "research": ("Research", load("research.yml").get("work", [])),
    "projects": ("Projects", load("mentoring.yml") + load("projects.yml") + load("competitions.yml")),
}
for folder, (label, items) in groups.items():
    d = os.path.join(ROOT, folder)
    os.makedirs(d, exist_ok=True)
    keep = set()
    for it in items:
        slug = it["slug"]
        keep.add(slug + ".html")
        title = it["title"].replace('"', '\\"')
        with open(os.path.join(d, slug + ".html"), "w") as f:
            f.write(f'---\nlayout: detail\nslug: {slug}\ntitle: "{title}"\n'
                    f'back: /{folder}/\nback_label: {label}\n---\n')
    for old in glob.glob(os.path.join(d, "*.html")):
        if os.path.basename(old) not in keep:
            os.remove(old)
    print(f"{folder}/: {len(keep)} pages")
