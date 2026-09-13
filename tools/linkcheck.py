#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "node_modules", "backend", "tools", "fonts"}

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        for key in ("href", "src"):
            if key in d:
                self.refs.append(d[key])


def html_files():
    for p in ROOT.rglob("*.html"):
        if SKIP_DIRS.intersection(p.relative_to(ROOT).parts):
            continue
        yield p


failed = 0
checked = 0
for page in html_files():
    parser = LinkParser()
    parser.feed(page.read_text(encoding="utf-8"))
    for ref in parser.refs:
        if not ref or ref.startswith(("#", "mailto:", "tel:", "https://", "http://", "data:")):
            continue
        if ref.startswith("/"):
            target = ROOT / ref.lstrip("/")
        else:
            target = (page.parent / ref).resolve()
        # query/hash
        target = Path(str(target).split("#")[0].split("?")[0])
        checked += 1
        if not target.exists():
            # directory URLs
            if not (target / "index.html").exists():
                print(f"FAIL  {page.relative_to(ROOT)} -> {ref}")
                failed += 1

print(f"checked {checked} local refs")
if failed:
    print(f"RESULT: FAIL ({failed})")
    sys.exit(1)
print("RESULT: PASS")
