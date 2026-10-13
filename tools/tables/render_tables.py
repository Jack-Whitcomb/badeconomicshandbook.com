"""Render data tables from the book as PNG images (so readers can copy/share them).

Usage: python tools/tables/render_tables.py
Needs: pip install playwright && playwright install chromium

If the numbers in the book change, update ROWS below and re-run.
"""

import math
from pathlib import Path
from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[2]

# Spreadsheet behind the Chapter 1 table (the book's endnote for it); printed under the table.
# tools/convert.py also makes the image a link to it, since text in a PNG can't be clicked.
SOURCE_URL = "https://docs.google.com/spreadsheets/d/1q8NibyVtZLjKavaQqa1xUMTWUD52M_QEfAwrjtogzlM/edit?gid=0#gid=0"
SOURCE_SHOWN = "docs.google.com/spreadsheets/d/1q8NibyVtZLjKavaQqa1xUMTWUD52M_QEfAwrjtogzlM"

# Chapter 1, Take 1: how much more the median American worker can buy.
ROWS = [
    ("Square foot of new housing", "1975, 2023", 0.68),
    ("Electricity (1 kWh)", "1978, 2023", 104.10),
    ("Public tuition, fees, room and board for a year", "1975, 2018", -50.43),
    ("Healthcare (out-of-pocket spending per capita)", "1975, 2022", -17.75),
    ("1 gallon of milk", "1975, 2023", 178.38),
    ("Kellogg's corn flakes, 1 oz", "1974, 2023", 41.19),
    ("Apples, red delicious (1 lb)", "1980, 2017", 78.74),
    ("Bananas (1 lb)", "1980, 2023", 165.32),
    ("White bread (1 lb)", "1980, 2023", 41.03),
    ("1 lb steak", "1980, 2023", 99.08),
    ("Pound of tomatoes", "1980, 2023", 107.80),
    ("Movie ticket", "1975, 2017", 27.70),
    ("1 gal gasoline", "1976, 2023", 16.34),
    ("1 mile of car travel", "1976, 2017", 48.78),
    ("Vacuum cleaner", "1976, 2025 price w/ 2023 income", 329.16),
    ("Washer", "1980, 2025 price w/ 2023 income", 493.03),
    ("Dryer", "1980, 2025 price w/ 2023 income", 369.91),
    ("1 mile of plane travel (JFK–LAX round trip, United)", "1970s, 2026 price w/ 2023 income", 179.53),
]


def cell_style(pct):
    """Green for gains, red for losses; stronger color for bigger changes."""
    if pct >= 0:
        t = min(1.0, math.log1p(pct / 100) / math.log1p(5.0))   # +500% = full strength
        return f"background: rgba(34, 139, 34, {0.06 + 0.5 * t:.2f}); color: #0d4f1c;"
    t = min(1.0, -pct / 60)                                      # -60% = full strength
    return f"background: rgba(200, 30, 30, {0.12 + 0.48 * t:.2f}); color: #7f1010;"


def table_html():
    rows = "".join(
        f'<tr><td class="good">{good}<span class="yrs">{yrs}</span></td>'
        f'<td class="pct" style="{cell_style(p)}">{"+" if p > 0 else "−" if p < 0 else ""}{abs(p):.2f}%</td></tr>'
        for good, yrs, p in ROWS)
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">
<style>
  body {{ margin: 0; background: #fff; font-family: "Source Serif 4", Georgia, serif; color: #1d1d1d; }}
  .card {{ width: 680px; padding: 22px 26px 16px; }}
  h1 {{ font-size: 21px; margin: 0 0 4px; font-weight: 700; }}
  .sub {{ font-size: 13.5px; color: #555; margin-bottom: 14px; }}
  table {{ width: 100%; border-collapse: separate; border-spacing: 0 3px; font-size: 14.5px; }}
  th {{ text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #666;
        font-weight: 600; padding: 0 10px 4px; border-bottom: 1.5px solid #1d1d1d; }}
  th.pct {{ text-align: right; }}
  td {{ padding: 5px 10px; }}
  td.good {{ border-bottom: 1px solid #eee; }}
  .yrs {{ color: #777; font-size: 12.5px; margin-left: 7px; }}
  td.pct {{ text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; width: 92px; border-radius: 4px; }}
  .src {{ margin-top: 12px; font-size: 12px; color: #555; }}
  .src .url {{ color: #8f1d1d; text-decoration: underline; text-underline-offset: 2px; }}
  .foot {{ margin-top: 8px; font-size: 11.5px; color: #888; display: flex; justify-content: space-between; }}
</style></head><body><div class="card">
<h1>How much more the median American worker can buy</h1>
<div class="sub">Change in how much of each good the median income buys, past vs. present (years compared in gray)</div>
<table><tr><th>Good or service</th><th class="pct">Change</th></tr>{rows}</table>
<div class="src">Sources: <span class="url">{SOURCE_SHOWN}</span></div>
<div class="foot"><span>The Bad Economics Handbook · Jack Whitcomb</span><span>Green = can buy more · Red = can buy less</span></div>
</div></body></html>"""


def main():
    out = SITE / "images" / "ch01-purchasing-power.png"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 732, "height": 400}, device_scale_factor=2)
        page.set_content(table_html(), wait_until="networkidle")
        page.locator(".card").screenshot(path=str(out))
        browser.close()
    print("wrote", out)


if __name__ == "__main__":
    main()
