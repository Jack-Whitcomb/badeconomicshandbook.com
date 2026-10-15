# The Bad Economics Handbook: web edition

The source of https://badeconomicshandbook.com, a [Quarto](https://quarto.org) book site.

## How the site gets updated

Every push to the `main` branch (including saving an edit in GitHub's web editor) runs
`.github/workflows/publish.yml`, which builds the site with Quarto and publishes it to GitHub Pages.
It usually goes live within about two minutes. Progress is shown in the repository's **Actions** tab.

To edit a page: click **Edit this page** at the bottom of the page on the site, or go to
https://badeconomicshandbook.com/editor/. See "The web editor" below. You can still edit a `.qmd` file on
GitHub directly (pencil icon, then **Commit changes**).

"Edit this page" opens the web editor and is hidden from readers. To show it in your browser, open any page once with `#editor-on`
added to the address (e.g. `https://badeconomicshandbook.com/#editor-on`); `#editor-off` hides it again.

## The web editor

`editor/` is an editor for the pages, served with the site at `/editor/` (listed under `resources:` in
`_quarto.yml` so Quarto copies it as is). It shows a page the way the site does and saves straight to this
repository through the GitHub API, one commit per **Publish**, which then rebuilds the site as above.

- Sign-in uses a GitHub fine-grained token (this repository only; Contents: read and write, Actions:
  read-only), kept in that browser's localStorage.
- Unpublished edits are saved in the browser as a draft per page and come back when the page is reopened.
  If the page changed on GitHub in the meantime, the editor says so before anything is overwritten.
- `editor/md.js` reads and writes the Markdown. A page opened and published without edits is unchanged
  byte for byte, and only the paragraphs you touch are rewritten. Anything it can't show as formatted text
  (equations, tables, HTML) is edited as Markdown source in place.
- New images are named `chNN-MM.png` (next free number) and uploaded with the page.

## Footnotes (endnotes)

On the site, notes are numbered automatically, starting from 1 on each page, in the order they appear.
In the `.qmd` files a note has two parts: a marker in the text, like `[^n135]`, and its text at the
bottom of the file, on a line starting with `[^n135]:`. The `n135` part is just a name (it was the note's
number in the print edition when the site was made). Names never need renumbering.

- **Remove a note:** delete its marker from the text and its `[^n135]: ...` line at the bottom.
  Everything after it renumbers itself.
- **Add a note:** put a marker with any new name where the number should go, e.g. `[^tax2027]`, and add
  a line at the bottom: `[^tax2027]: https://example.com/source`. Names just have to be unique on that page.
- If you delete a marker but forget the bottom line, nothing breaks; the unused note isn't shown.

(Print edition: `add_endnotes.py` and `remove_endnotes.py` in the book folder do the same for the `.odt`.)

## Folder layout

- `_quarto.yml`: site settings (title, sidebar, chapter list, comments, footer)
- `index.qmd`, `about.qmd`: landing page and license page
- `introduction.qmd`, `chapters/*.qmd`, `appendix.qmd`: the book text. **These are the master copy.**
- `search.qmd`, `search-enter.html`: full search results page (Enter in the search box)
- `images/`: chapter images and `cover.jpg`
- `tools/sidebar_takes.py`, `sidebar-takes.html`: list each chapter's Takes under it in the left sidebar,
  and hide the search page from the sidebar (runs automatically after every build)
- `theme.scss`, `theme-dark.scss`, `_tiers.scss`: fonts, colors, layout, tier badges
- `_book/`: the built website (made by the build; not stored in the repository)

## History: the converter

The pages were originally generated from the book's `.odt` by `tools/convert.py`. Since the site went
online (October 2026) the `.qmd` files are the master copy, so the converter refuses to run unless given
`--overwrite-web-edits` (it would replace web edits with the `.odt`'s text).
`tools/tables/render_tables.py` makes the Chapter 1 table image; re-run it if those numbers change.

## Building locally

```
quarto render
quarto preview      # opens the site in your browser
```

New pages must also be listed under `chapters:` in `_quarto.yml`.

## Comments (Giscus)

Comments are stored in this repository's Discussions, in the `Comments` category, and readers sign in
with GitHub to post. Reply to a comment (on the site or on GitHub) to respond to it.
