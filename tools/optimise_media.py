#!/usr/bin/env python3
"""Make an 800px-wide `-thumb` copy of every image in assets/img.

Cards, research rows and the gallery strip load the thumb; the lightbox
and inline figures load the full image. Run after adding images:
    python3 tools/optimise_media.py
"""
import os, sys
from PIL import Image, ImageOps

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
SKIP_DIRS = {"logos"}
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
WIDTH = 800

made = 0
for d, dirs, files in os.walk(ROOT):
    dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
    for f in files:
        base, ext = os.path.splitext(f)
        if ext.lower() not in EXTS or base.endswith("-thumb"):
            continue
        src = os.path.join(d, f)
        dst = os.path.join(d, base + "-thumb" + ext)
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        im = ImageOps.exif_transpose(Image.open(src))
        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        kw = {"optimize": True}
        if ext.lower() in (".jpg", ".jpeg"):
            im = im.convert("RGB"); kw["quality"] = 80; kw["progressive"] = True
        elif ext.lower() == ".webp":
            kw["quality"] = 80
        im.save(dst, **kw)
        made += 1
print(f"{made} thumbnails written")
