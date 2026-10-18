#!/usr/bin/env python3
"""Check every local href/src/poster and #anchor in a built site.
    python3 tools/check_links.py [_site]
Exits non-zero if anything is broken."""
import sys, os, re, html
from urllib.parse import urlparse, unquote
B = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "_site")
FILTERS = {"navigation", "slam", "perception", "manipulation", "learning", "hardware"}
pages = [os.path.join(d, f) for d, _, fs in os.walk(B) for f in fs if f.endswith(".html")]
ids = {p: set(re.findall(r'id="([^"]+)"', open(p).read())) for p in pages}
bad, n = [], 0
for p in pages:
    s = open(p).read()
    links = re.findall(r'\b(?:href|src|poster)="([^"]+)"', s) + re.findall(r'&quot;link&quot;:&quot;([^&]+)&quot;', s)
    for u in map(html.unescape, links):
        if u.startswith(("http://", "https://", "mailto:", "data:")):
            continue
        n += 1
        if u.startswith("#"):
            if len(u) > 1 and u[1:] not in ids[p]: bad.append((p, u))
            continue
        path, frag = unquote(urlparse(u).path), urlparse(u).fragment
        t = os.path.join(B, path.lstrip("/"))
        if path.endswith("/"): t = os.path.join(t, "index.html")
        if not os.path.exists(t) or (frag and t.endswith(".html") and frag not in ids.get(t, set()) and frag not in FILTERS):
            bad.append((os.path.relpath(p, B), u))
print(f"{len(pages)} pages, {n} local links checked")
for b in bad: print("BROKEN", *b)
sys.exit(1 if bad else 0)
