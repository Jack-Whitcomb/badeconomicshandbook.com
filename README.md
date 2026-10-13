# The Bad Economics Handbook: web edition

The source of https://badeconomicshandbook.com, a [Quarto](https://quarto.org) book site.

## How the site gets updated

Every push to the `main` branch (including saving an edit in GitHub's web editor) runs
`.github/workflows/publish.yml`, which builds the site with Quarto and publishes it to GitHub Pages.
It usually goes live within about two minutes. Progress is shown in the repository's **Actions** tab.

To edit a page: click **Edit this page** at the bottom of the page on the site (or open the `.qmd` file on
GitHub and click the pencil icon), make the change, then **Commit changes**.

"Edit this page" is hidden from readers. To show it in your browser, open any page once with `#editor-on`
added to the address (e.g. `https://badeconomicshandbook.com/#editor-on`); `#editor-off` hides it again.

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
