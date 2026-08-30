#!/usr/bin/env python3
"""Tiny Jekyll-compatible renderer, only good enough to preview/validate this site."""
import os, re, sys, shutil, glob
import yaml
from liquid import Environment

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
OUT  = os.path.join(ROOT, "_preview")

def load_yaml(p):
    with open(p) as f:
        return yaml.safe_load(f)

config = load_yaml(os.path.join(ROOT, "_config.yml"))
data = {}
for p in glob.glob(os.path.join(ROOT, "_data", "*.yml")):
    data[os.path.splitext(os.path.basename(p))[0]] = load_yaml(p)
site = dict(config)
site["data"] = data

FM = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?(.*)\Z", re.S)
def split_fm(text):
    m = FM.match(text)
    if not m:
        return {}, text
    return (yaml.safe_load(m.group(1)) or {}), m.group(2)

INC = re.compile(r"\{%-?\s*include\s+([\w.\-/]+)\s*(.*?)-?%\}")
def inline_includes(text, depth=0):
    if depth > 6:
        return text
    def repl(m):
        name, params = m.group(1), m.group(2).strip()
        path = os.path.join(ROOT, "_includes", name)
        body = open(path).read()
        for kv in re.finditer(r"(\w+)\s*=\s*([\w.\[\]'\"]+)", params):
            body = body.replace("include." + kv.group(1), kv.group(2))
        return inline_includes(body, depth + 1)
    return INC.sub(repl, text)

env = Environment()

def relative_url(v):
    return (site.get("baseurl") or "") + str(v)

def absolute_url(v):
    return (site.get("url") or "") + (site.get("baseurl") or "") + str(v)

env.filters["relative_url"] = relative_url
env.filters["absolute_url"] = absolute_url

def render(text, ctx):
    return env.from_string(inline_includes(text)).render(**ctx)

def apply_layout(name, content, page):
    seen = 0
    while name and seen < 5:
        seen += 1
        lp = os.path.join(ROOT, "_layouts", name + ".html")
        fm, body = split_fm(open(lp).read())
        content = render(body, {"site": site, "page": page, "content": content})
        name = fm.get("layout")
    return content

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

pages = sorted(glob.glob(os.path.join(ROOT, "*.html")))
errors = []
for p in pages:
    fm, body = split_fm(open(p).read())
    base = os.path.basename(p)
    permalink = fm.get("permalink")
    if permalink is None:
        permalink = "/" if base == "index.html" else "/" + base[:-5] + "/"
    page = dict(fm)
    page["url"] = permalink
    layout = fm.get("layout") or (config.get("defaults", [{}])[0].get("values", {}).get("layout", "page"))
    try:
        content = render(body, {"site": site, "page": page})
        html = apply_layout(layout, content, page)
    except Exception as e:
        errors.append((base, repr(e)))
        continue
    if permalink.endswith(".html"):
        dest = os.path.join(OUT, permalink.lstrip("/"))
    else:
        dest = os.path.join(OUT, permalink.strip("/"), "index.html")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, "w").write(html)
    print("rendered %-20s -> %s" % (base, os.path.relpath(dest, OUT)))

shutil.copytree(os.path.join(ROOT, "assets"), os.path.join(OUT, "assets"))

if errors:
    print("\nERRORS:")
    for b, e in errors:
        print(" ", b, e)
    sys.exit(1)
print("\nok")
