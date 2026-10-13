"""Convert the Bad Economics Handbook .odt into Quarto pages for the website.

Usage (from the website folder):
    python tools/convert.py "../The Bad Economics Handbook (Claude-spotted Errors Revision Edition).odt"
    python tools/convert.py BOOK.odt --only intro,1,2

What it does:
  * runs pandoc (bundled with Quarto) to turn the .odt into Markdown
  * splits the book into pages: introduction, one page per chapter, and the
    appendix (the print Table of Bad Economics is left out; the sidebar replaces it)
  * turns the superscript endnote numbers into real footnotes whose text
    is the matching entry from the Endnotes list
  * copies images into images/ and changes "on the next page" to "below"

It overwrites the generated .qmd files, so make edits to the book itself
(the .odt) and re-run this, rather than editing the generated pages.
"""

import argparse
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote

SITE = Path(__file__).resolve().parent.parent
ANCHOR = re.compile(r"^((?:\[\]\{#anchor[-\d]*\})+)(.*)$")
NOTE_REF = re.compile(r"\^(\d+)(\\ )?\^")  # some superscripts include a trailing space: ^13\ ^
IMAGE = re.compile(r"!\[\]\((media/[^)\s]+)\)(\{[^}]*\})?")
RATING = re.compile(r"^\**Rating: ([^*\"]{1,20}?)\.?\**\\?\s*$")
TEXT_WIDTH_IN = 5.25
# Tables shown as images on the web (made by tools/tables/render_tables.py).
# Key: text in the table's header row. Value: (image file, display width, link to the data, alt text).
TABLE_IMAGES = {
    "How much more the median American worker can buy": (
        "ch01-purchasing-power.png", "80%",
        "https://docs.google.com/spreadsheets/d/1q8NibyVtZLjKavaQqa1xUMTWUD52M_QEfAwrjtogzlM/edit?gid=0#gid=0",
        "Table: how much more the median American worker can buy of 18 goods and services, "
        "past vs. present. Most rose, from +0.68% (new housing) to +493% (washers); "
        "public college (-50%) and healthcare (-18%) fell."),
}
SIMPLE_TABLE = re.compile(r"^  -{5,}[- ]*\n.*?\n  -{5,}[- ]*$", re.S | re.M)  # width of the print text block, used to scale images



def run_pandoc(odt, workdir, quarto):
    cmd = [quarto, "pandoc", str(odt), "-t", "markdown", "--wrap=none",
           "--extract-media=media", "-o", "book.md"]
    subprocess.run(cmd, cwd=workdir, check=True)
    return (Path(workdir) / "book.md").read_text(encoding="utf-8")


def split_sections(md):
    """Return [(heading, [lines])] for every heading paragraph in the book."""
    sections, current = [], None
    for line in md.split("\n"):
        m = ANCHOR.match(line)
        if m:
            current = (m.group(2).strip(), [])
            sections.append(current)
        elif current is not None:
            current[1].append(line)
    return sections


def parse_endnotes(lines):
    notes, last = {}, None
    for line in lines:
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m:
            last = int(m.group(1))
            notes[last] = m.group(2).strip()
        elif line.strip() and last is not None:
            prev, piece = notes[last], line.strip()
            joiner = "" if prev.startswith("http") and " " not in piece else " "
            notes[last] = prev + joiner + piece
    return notes


def link_target(url):
    return url.replace(" ", "%20").replace("(", "%28").replace(")", "%29")


def short_link(url):
    shown = unquote(re.sub(r"^https?://(www\.)?", "", url))
    if len(shown) > 70:
        shown = shown[:67] + "..."
    shown = re.sub(r"([_*\[\]\\`<>])", r"\\\1", shown)
    return f"[{shown}]({link_target(url)})"


def format_note(text):
    # Pandoc escapes characters like ~ and _ in plain text; links need them raw.
    text = re.sub(r"\\(.)", r"\1", text)
    return re.sub(r"https?://[^\s<>]+", lambda m: short_link(m.group(0)), text)


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def tier_class(rating):
    r = rating.lower()
    return "tier-superf" if r.startswith("super") else "tier-" + r[0]


class Page:
    def __init__(self, path, title):
        self.path, self.title, self.body, self.notes_used = path, title, [], []


class Converter:
    def __init__(self, notes, media_dir):
        self.notes, self.media_dir = notes, media_dir
        self.image_names, self.report = {}, []
        self.chapter_paths = {}

    def clean(self, lines, page, img_prefix, img_root):
        out = []
        for i, line in enumerate(lines):
            if line.strip() == "\\" or re.fullmatch(r">\s*\\\s*", line):
                line = ">" if line.startswith(">") else ""
            if line.strip().startswith("We will start with a table"):
                continue  # the web edition has no Table page; the sidebar lists the takes
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if line.endswith("\\") and not nxt.strip():
                line = line[:-1]

            line = re.sub(r"\*{4,}", "", line)  # empty bold/italic toggles left by pandoc ("*****")
            m = RATING.match(line)
            if m:
                rating = m.group(1).strip()
                page.ratings.append(rating)
                line = f"[Rating: {rating}]{{.rating .{tier_class(rating)}}}"

            if re.search(r"[Oo]n the next page", line):
                line = re.sub(r"On the next page", "Below", line)
                line = re.sub(r"on the next page", "below", line)
                self.report.append(f"{page.title}: 'next page' -> 'below'")

            def note_sub(m):
                n = int(m.group(1))
                if n not in self.notes:
                    self.report.append(f"{page.title}: superscript {n} has no endnote")
                    return m.group(0)
                if n not in page.notes_used:
                    page.notes_used.append(n)
                return f"[^n{n}]" + (" " if m.group(2) else "")
            # Superscripts that are not note numbers (they break the 1, 2, 3, ... sequence in print).
            line = line.replace("E = mc^2^", "E = mc^\u00002^")
            line = NOTE_REF.sub(note_sub, line)
            line = line.replace("^\u00002^", "^2^")
            line = self.cross_links(line, page)

            def image_sub(m):
                src = m.group(1)
                if src not in self.image_names:
                    count = sum(1 for k in self.image_names.values() if k.startswith(img_prefix))
                    name = f"{img_prefix}-{count + 1:02d}{Path(src).suffix.lower()}"
                    shutil.copy(self.media_dir / src, SITE / "images" / name)
                    self.image_names[src] = name
                width = re.search(r'width="([\d.]+)in"', m.group(2) or "")
                pct = min(100, round(float(width.group(1)) / TEXT_WIDTH_IN * 100)) if width else 100
                return f"![]({img_root}images/{self.image_names[src]}){{width=\"{pct}%\"}}"
            line = IMAGE.sub(image_sub, line)
            line = re.sub(r"(\)(?:\{[^}]*\})?)(?=!\[)", r"\1\n\n", line)  # one image per paragraph
            out.append(line)

        text = "\n".join(out)

        def table_sub(m):
            for key, (img, width, url, alt) in TABLE_IMAGES.items():
                if key in m.group(0):
                    # ?v=<content hash>: browsers re-download the image whenever it's regenerated.
                    ver = hashlib.md5((SITE / "images" / img).read_bytes()).hexdigest()[:8]
                    return f'[![]({img_root}images/{img}?v={ver}){{width="{width}" fig-alt="{alt}"}}]({url})'
            return m.group(0)
        text = SIMPLE_TABLE.sub(table_sub, text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip("\n")
        return text

    def cross_links(self, line, page):
        """Link "Chapter 2", "Chapter 9, Take 9" and "Take 4 of this chapter" to the right page/section."""
        here = "" if page.path.startswith("chapters/") else "chapters/"

        def chap(m):
            path = self.chapter_paths.get(m.group(1))
            if not path:
                return m.group(0)
            target = here + path + (f"#take-{m.group(3)}" if m.group(3) else "")
            return f"[{m.group(0)}]({target})"
        line = re.sub(r"(?<![\[\w])[Cc]hapter (\d+)(, [Tt]ake (\d+))?", chap, line)
        return re.sub(r"(?<![\[\w])([Tt]ake (\d+))(?= of this chapter)", r"[\1](#take-\2)", line)

    def footnotes(self, page):
        return "\n".join(f"[^n{n}]: {format_note(self.notes[n])}" for n in page.notes_used)


def yaml_title(title):
    return "'" + title.replace("'", "''") + "'"


def write_page(page, conv):
    head = ["---", f"title: {yaml_title(page.title)}"]
    # The book's Introduction opens with a big italic "Why?" under the heading.
    if page.body and page.body[0].startswith("Why?\n"):
        page.body[0] = page.body[0][len("Why?\n"):].lstrip("\n")
        head += ["subtitle: '*Why?*'", "body-classes: why-subtitle"]
    parts = head + ["---", "", "\n\n".join(page.body)]
    if page.notes_used:
        parts += ["", conv.footnotes(page)]
    (SITE / page.path).write_text("\n".join(parts) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("odt")
    ap.add_argument("--only", help="comma list of pages: intro,appendix,0-9")
    ap.add_argument("--quarto", default=shutil.which("quarto") or "quarto")
    ap.add_argument("--overwrite-web-edits", action="store_true",
                    help="required: the .qmd pages are now the master copy (edited on GitHub), "
                         "and this script overwrites them with the .odt's text")
    args = ap.parse_args()
    if not args.overwrite_web_edits:
        sys.exit("Stopped: since the site went online (Oct 2026) the .qmd pages are the master copy and may\n"
                 "contain edits made on GitHub. Re-running this would replace them with the .odt's text.\n"
                 "If that's really what you want, add --overwrite-web-edits.")
    only = set(args.only.split(",")) if args.only else None

    with tempfile.TemporaryDirectory() as tmp:
        md = run_pandoc(Path(args.odt).resolve(), tmp, args.quarto)
        sections = split_sections(md)
        notes = parse_endnotes(next(l for h, l in sections if h == "Endnotes"))
        conv = Converter(notes, Path(tmp))

        # Group sections into pages.
        chapters, intro, appendix, cur = [], None, None, None
        for heading, lines in sections:
            cm = re.match(r"Chapter (\d+): (.*)", heading)
            if heading == "Introduction":
                intro = cur = {"key": "intro", "title": heading, "lines": lines, "subs": []}
            elif heading == "The Table of Bad Economics":
                cur = None  # print-only page; the sidebar does its job on the web
            elif cm:
                cur = {"key": cm.group(1), "title": heading, "lines": lines, "subs": [],
                       "slug": f"chapters/{int(cm.group(1)):02d}-{slugify(cm.group(2))}"}
                chapters.append(cur)
            elif heading == "Appendix":
                appendix = cur = {"key": "appendix", "title": heading, "lines": lines, "subs": []}
            elif heading == "Endnotes":
                cur = None
            elif cur is not None:
                cur["subs"].append((heading, lines))

        conv.chapter_paths = {ch["key"]: Path(ch["slug"]).name + ".qmd" for ch in chapters}

        def build(sec, path, img_prefix, img_root):
            page = Page(path, sec["title"])
            page.ratings = []
            page.take_ratings = []
            intro_text = conv.clean(sec["lines"], page, img_prefix, img_root)
            if intro_text:
                page.body.append(intro_text)
            for heading, lines in sec["subs"]:
                tm = re.match(r"Take (\d+):", heading)
                anchor = f"take-{tm.group(1)}" if tm else slugify(heading)
                before = len(page.ratings)
                body = conv.clean(lines, page, img_prefix, img_root)
                page.take_ratings.append((heading, anchor, page.ratings[before] if len(page.ratings) > before else None))
                page.body.append(f"## {heading} {{#{anchor}}}\n\n{body}")
            return page

        def wanted(key):
            return only is None or key in only

        for ch in chapters:
            if wanted(ch["key"]):
                write_page(build(ch, ch["slug"] + ".qmd", "ch" + ch["key"].zfill(2), "../"), conv)
        if intro and wanted("intro"):
            write_page(build(intro, "introduction.qmd", "intro", ""), conv)
        if appendix and wanted("appendix"):
            write_page(build(appendix, "appendix.qmd", "appendix", ""), conv)

    for line in dict.fromkeys(conv.report):
        print(line)


if __name__ == "__main__":
    sys.exit(main())
