"""Post-render step: list each chapter's Takes under it in the left sidebar.

Quarto's book sidebar only lists pages. This reads the second-level sections
(the Takes) from every rendered page and nests them as links under that page's
entry in the sidebar of every page. Run automatically by `quarto render`
(see post-render in _quarto.yml).
"""

import html
import os
import re
from pathlib import Path

OUT = Path(os.environ.get("QUARTO_PROJECT_OUTPUT_DIR", "_book"))
SECTION = re.compile(r'<section id="([^"]+)" class="level2[^"]*">\s*<h2[^>]*>(.*?)</h2>', re.S)
ITEM = re.compile(r'(<a href="([^"#]+\.html)" class="sidebar-item-text sidebar-link[^"]*">.*?</a>\s*</div>)'
                  r'(?:\s*<ul class="sidebar-takes">.*?</ul>)?', re.S)

# snark/ is the Snark mode copy of the book, a separate project with its own sidebar (it runs this script too)
pages = sorted(p for p in OUT.rglob("*.html") if p.relative_to(OUT).parts[0] != "snark")
sections = {}
for page in pages:
    found = SECTION.findall(page.read_text(encoding="utf-8"))
    if found:
        rel = page.relative_to(OUT).as_posix()
        sections[rel] = [(sid, re.sub(r"<[^>]+>", "", title).strip()) for sid, title in found]

for page in pages:
    text = page.read_text(encoding="utf-8")
    if "sidebar-item-text sidebar-link" not in text:
        continue
    page_dir = page.parent

    def add_takes(m):
        href = m.group(2)
        target = (page_dir / href).resolve().relative_to(OUT.resolve()).as_posix()
        if target not in sections:
            return m.group(1)
        links = "".join(
            f'<li><a class="sidebar-take" href="{href}#{sid}" data-take="{sid}">{html.escape(html.unescape(title))}</a></li>'
            for sid, title in sections[target])
        return f'{m.group(1)}\n<ul class="sidebar-takes">{links}</ul>'

    new = ITEM.sub(add_takes, text)
    if new != text:
        page.write_text(new, encoding="utf-8")

# The search results page (search.qmd) is listed under chapters only so Quarto builds it.
# Hide it from the sidebar and from the previous/next page links.
HIDE_ITEM = re.compile(r'\s*<li class="sidebar-item">\s*<div class="sidebar-item-container">\s*'
                       r'<a href="[^"]*search\.html"[^>]*>.*?</a>\s*</div>\s*</li>', re.S)
HIDE_NAV = re.compile(r'(<div class="nav-page nav-page-(?:next|previous)">)\s*<a href="[^"]*(?:search|about)\.html"'
                      r'[^>]*class="pagination-link"[^>]*>.*?</a>', re.S)
for page in pages:
    text = page.read_text(encoding="utf-8")
    new = HIDE_ITEM.sub("", text)
    new = re.sub(r'<link href="[^"]*search\.html" rel="next">\n?', "", new)
    if page.name == "search.html":
        new = HIDE_NAV.sub(r"\1", new)      # no "previous: About" link on the results page
    else:
        new = re.sub(r'(<div class="nav-page nav-page-next">)\s*<a href="[^"]*search\.html".*?</a>', r"\1", new, flags=re.S)
    if new != text:
        page.write_text(new, encoding="utf-8")
