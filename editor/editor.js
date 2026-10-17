/* Web editor for The Bad Economics Handbook.
   Pages are read from and saved to the GitHub repository with the GitHub API; saving makes one
   commit, and the site's normal workflow (.github/workflows/publish.yml) rebuilds the site.
   Unpublished edits are kept in this browser (localStorage) as drafts, one per page.
   md.js does all the Markdown reading and writing; this file is the editing interface. */
(() => {
"use strict";

const OWNER = "Jack-Whitcomb", REPO = "badeconomicshandbook.com", BRANCH = "main";
const API = "https://api.github.com";
const SITE = new URL("../", location.href).href;           // the editor lives at <site>/editor/
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
const TOKEN_KEY = "bebh-editor-token", DRAFT_KEY = "bebh-draft:";
const TIERS = [["A-tier", "a"], ["B-tier", "b"], ["C-tier", "c"], ["D-tier", "d"], ["F-tier", "f"], ["Super F", "superf"]];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const ICON = {
  grip: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="6" cy="3.5" r="1.2"/><circle cx="10" cy="3.5" r="1.2"/><circle cx="6" cy="8" r="1.2"/><circle cx="10" cy="8" r="1.2"/><circle cx="6" cy="12.5" r="1.2"/><circle cx="10" cy="12.5" r="1.2"/></svg>',
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M4 9l4 4 4-4"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></svg>',
  para: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 4h10M3 7h10M3 10h10M3 13h6"/></svg>',
  head: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 3v10M12 3v10M4 8h8"/></svg>',
  quote: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 3v10M6 5h7M6 8h7M6 11h5"/></svg>',
  ul: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="3.5" cy="4.5" r=".9" fill="currentColor"/><circle cx="3.5" cy="11.5" r=".9" fill="currentColor"/><path d="M7 4.5h6M7 11.5h6"/></svg>',
  ol: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M7 4.5h6M7 11.5h6M3 3l1-.5v4M2.6 9.5c.4-.6 1.8-.6 1.8.4 0 .8-1.8 1.6-1.8 2.6h1.9"/></svg>',
  img: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="m2.5 11 3.5-3.5 3 3 2-2 2.5 2.5"/></svg>',
  star: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="m8 2 1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5z"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3l10 10M13 3 3 13"/></svg>',
  ent: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9"/><path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9"/></svg>',
  unent: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m10.3 9.4 2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9M5.7 6.6 3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9M2.5 2.5l11 11"/></svg>',
  code: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 4.5-3 3.5 3 3.5M10.5 4.5l3 3.5-3 3.5"/></svg>',
};

/* =================================================================== GitHub */

let token = store.get(TOKEN_KEY);

async function gh(path, opts = {}) {
  const res = await fetch(API + path, {
    method: opts.method || "GET", cache: "no-store",
    headers: Object.assign({ Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${token}` },
      opts.body ? { "Content-Type": "application/json" } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`GitHub said ${res.status}`);
    err.status = res.status;
    try { err.detail = (await res.json()).message; } catch (e) { /* no body */ }
    if (err.detail) err.message += `: ${err.detail}`;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
const repo = p => `/repos/${OWNER}/${REPO}${p}`;
const encPath = p => p.split("/").map(encodeURIComponent).join("/");
const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), c => c.charCodeAt(0)));

async function getFile(path, ref) {
  const j = await gh(repo(`/contents/${encPath(path)}?ref=${ref || BRANCH}`));
  return { text: fromB64(j.content), sha: j.sha };
}

/* =================================================================== state */

let pages = [];              // [{path, title}]
let cur = null;              // {path, title, baseSha, origText, doc}
let twin = null;             // the same page in the other version, for entangled blocks: {path, baseSha, origText, doc, stale}
let entPrev = new Map();     // entangled block id -> its Markdown at the last sync (see syncTwin)
const units = new Map();     // unit id -> {u, b}
const pendingImages = new Map();   // repo path -> {b64, url}
const imageNames = new Map(); // book ("" or "snark/") -> names in its images/ folder on GitHub (loaded when needed)
let undoStack = [], redoStack = [];
let clip = null;             // last copy: {text, md}, so footnotes and formatting survive paste
let build = null;            // {sha, state, url}

/* =================================================================== start */

document.addEventListener("DOMContentLoaded", init);

function init() {
  $("#signin-form").addEventListener("submit", async e => {
    e.preventDefault();
    const t = $("#token").value.trim();
    if (!t) return;
    $("#signin-err").textContent = "Checking…";
    token = t;
    try {
      const r = await gh(repo(""));
      if (!r.permissions || !r.permissions.push) throw new Error("This token can read the repository but not save to it. Set Contents to “Read and write”.");
      store.set(TOKEN_KEY, t);
      $("#signin-err").textContent = "";
      start();
    } catch (err) {
      token = null;
      $("#signin-err").textContent = err.status === 401 ? "GitHub didn’t accept that token." : err.status === 404 ? "That token can’t see the badeconomicshandbook.com repository." : err.message;
    }
  });
  $("#signout").addEventListener("click", () => {
    if (!confirm("Sign out of the editor in this browser? Unpublished drafts stay saved here.")) return;
    store.del(TOKEN_KEY); location.reload();
  });
  $("#help-btn").addEventListener("click", showHelp);
  $("#menu-btn").addEventListener("click", () => $("#side").classList.toggle("open"));
  $("#publish").addEventListener("click", openReview);
  $("#tools").addEventListener("mousedown", e => { if (e.target.closest(".tb")) e.preventDefault(); });
  $("#tools").addEventListener("click", e => { const b = e.target.closest(".tb"); if (b) command(b.dataset.cmd); });
  bindEditing();
  window.addEventListener("hashchange", route);
  if (token) start(); else $("#signin").hidden = false;
}

async function start() {
  $("#signin").hidden = true;
  $("#shell").hidden = false;
  $("#doc").replaceChildren(h("div", { class: "loading" }, "Loading the book…"));
  try {
    // The normal book, then the Snark mode copy in snark/ (a separate Quarto project), if there is one
    pages = [];
    for (const book of ["", "snark/"]) {
      let yml;
      try { yml = await getFile(book + "_quarto.yml"); } catch (e) { if (book && e.status === 404) continue; throw e; }
      let inChapters = false;
      for (const line of yml.text.split("\n")) {
        if (/^\s*chapters:/.test(line)) { inChapters = true; continue; }
        if (inChapters) {
          const m = /^\s*-\s+(\S+\.qmd)/.exec(line);
          if (m) { if (m[1] !== "search.qmd") pages.push({ path: book + m[1], book, title: m[1] === "index.qmd" ? "Home" : m[1].replace(/^.*\//, "").replace(/\.qmd$/, "") }); }
          else if (/^\S/.test(line) || /^\s*[a-z-]+:/.test(line)) inChapters = false;
        }
      }
    }
    renderPageList();
    // Titles, in the background
    Promise.all(pages.map(async pg => {
      try {
        const f = await getFile(pg.path);
        const t = MD.parseDoc(f.text).title;
        if (t && !pg.path.endsWith("index.qmd")) pg.title = t.text;
      } catch (e) { /* keep the file name */ }
    })).then(renderPageList);
    route();
  } catch (err) {
    if (err.status === 401) { store.del(TOKEN_KEY); token = null; $("#shell").hidden = true; $("#signin").hidden = false; $("#signin-err").textContent = "Your saved token stopped working (it may have expired). Paste a new one."; return; }
    $("#doc").replaceChildren(h("div", { class: "loading" }, "Couldn’t load the book: " + err.message));
  }
}

function route() {
  const want = decodeURIComponent(location.hash.slice(1)) || (pages.find(p => p.path === "introduction.qmd") || pages[0] || {}).path;
  if (!want || (cur && cur.path === want)) return;
  openPage(want);
}

/* =================================================================== pages */

function renderPageList() {
  const ul = $("#pages");
  const twoBooks = pages.some(pg => pg.book);
  ul.replaceChildren(...pages.flatMap((pg, i) => {
    const group = twoBooks && (i === 0 || pages[i - 1].book !== pg.book) ? h("li", { class: "group" }, pg.book ? "Snark mode" : "Normal") : null;
    const li = h("li", {},
      h("a", { class: "pg" + (cur && cur.path === pg.path ? " cur" : ""), href: "#" + pg.path, onclick: () => $("#side").classList.remove("open") },
        pg.title, store.get(DRAFT_KEY + pg.path) ? h("span", { class: "dot", title: "Unpublished changes" }) : null));
    if (cur && cur.path === pg.path) li.append(outlineEl());
    return group ? [group, li] : [li];
  }));
}

function outlineEl() {
  const ul = h("ul", { class: "outline" });
  for (const b of cur.doc.blocks) {
    if (b.kind !== "heading" || b.level > 2 || !b.el) continue;
    const t = MD.plainText(MD.parseInline(b.units[0].md));
    ul.append(h("li", {}, h("a", { href: "#", onclick: e => { e.preventDefault(); b.el.scrollIntoView({ behavior: "smooth", block: "start" }); $("#side").classList.remove("open"); } }, MD.smart(t) || "(untitled)")));
  }
  return ul.children.length ? ul : null;
}
let outlineTimer;
function refreshOutline() { clearTimeout(outlineTimer); outlineTimer = setTimeout(renderPageList, 400); }

async function openPage(path) {
  closePop();
  $("#doc").replaceChildren(h("div", { class: "loading" }, "Opening…"));
  $("#banner").hidden = true;
  let f, tw;
  try { [f, tw] = await Promise.all([getFile(path), loadTwin(path)]); }
  catch (err) { $("#doc").replaceChildren(h("div", { class: "loading" }, err.status === 404 ? "That page doesn’t exist on GitHub." : "Couldn’t open the page: " + err.message)); return; }
  cur = { path, baseSha: f.sha, origText: f.text, doc: null };
  twin = tw;
  undoStack = []; redoStack = [];
  let text = f.text;
  const draft = readDraft(path);
  if (draft && draft.text !== f.text) {
    if (draft.base === f.sha) {
      text = draft.text;
      banner(`Restored your unpublished changes from ${when(draft.at)}.`, [["Discard them", () => { if (confirm("Discard your unpublished changes to this page?")) { store.del(DRAFT_KEY + path); cur = null; openPage(path); } }]]);
    } else {
      banner(`You have unpublished changes from ${when(draft.at)}, but this page was changed on GitHub after that. You’re looking at the GitHub version.`,
        [["Show my changes instead", () => { checkpoint(); loadText(draft.text); afterChange(); $("#banner").hidden = true; toast("Your changes are back. Publishing them replaces the newer GitHub version."); }],
         ["Discard my changes", () => { store.del(DRAFT_KEY + path); $("#banner").hidden = true; renderPageList(); }]]);
    }
  } else if (draft) store.del(DRAFT_KEY + path);
  loadText(text);
  lastStable = state();
  if ($("#banner").hidden) twinBanner();
  document.title = `${cur.title} · Editor`;
  $("#view-live").href = pageUrl(path);
  $("#gh-link").href = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${path}`;
  renderPageList();
  updateStatus();
  updateEntButton();
  window.scrollTo(0, 0);
}

function loadText(text) {
  matchCache = null;
  cur.doc = MD.parseDoc(text);
  entPrev = entMap(cur.doc);
  cur.title = (cur.path.endsWith("index.qmd") ? "Home" : (cur.doc.title ? cur.doc.title.text : cur.path)) + (bookOf(cur.path) ? " (Snark mode)" : "");
  renderDoc();
}

function bookOf(path) { return path.startsWith("snark/") ? "snark/" : ""; }
function pageUrl(path) { return SITE + (path.endsWith("index.qmd") && !path.slice(bookOf(path).length).includes("/") ? bookOf(path) : path.replace(/\.qmd$/, ".html")); }
function when(t) {
  const d = new Date(t), now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? `today at ${time}` : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}
function banner(msg, actions) {
  const b = $("#banner");
  b.replaceChildren(h("span", { class: "grow" }, msg), ...actions.map(([label, fn]) => h("button", { class: "btn", type: "button", onclick: fn }, label)));
  b.hidden = false;
}

/* =================================================================== rendering */

const isText = b => b.kind === "para" || b.kind === "heading" || b.kind === "quote" || b.kind === "list";
const blockUnits = b => b.kind === "list" ? b.items.flatMap(it => it.units) : b.units || [];

function renderDoc() {
  units.clear();
  const doc = $("#doc");
  const kids = [];
  if (bookOf(cur.path)) kids.push(h("div", { class: "book-tag" }, "Snark mode"));
  if (cur.doc.title) {
    const t = h("h1", { class: "title", contenteditable: "plaintext-only", spellcheck: "true", "data-ph": "Title" }, cur.doc.title.text);
    t.addEventListener("input", () => { cur.doc.title.text = t.textContent.replace(/\s+/g, " ").trim(); afterChange(); });
    t.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const f = allUnits()[0]; if (f) setCaret(f.u.el, 0); } });
    kids.push(h("div", { class: "blk k-title" }, t, addButton(null)));
  }
  for (const b of cur.doc.blocks) kids.push(renderBlock(b));
  doc.replaceChildren(...kids);
  if (cur.doc.blocks.some(b => b.sub === "math" || blockHasMath(b))) loadKatex();
  renumberNotes();
}

function renderBlock(b) {
  let el;
  if (isText(b) && !b.code) {
    el = renderTextBlock(b);
    if (!el) { b.code = true; el = null; }   // didn't survive a round trip: edit as Markdown
  }
  if (!el) el = b.kind === "image" ? renderImage(b) : b.kind === "tweet" ? renderTweet(b) : b.kind === "rating" ? renderRating(b) : renderRaw(b);
  el.dataset.bid = b.id;
  el.prepend(h("div", { class: "gut", contenteditable: "false" },
    h("button", { class: "handle", type: "button", title: "Move, change or delete", "aria-label": "Block options", html: ICON.grip, onclick: e => blockMenu(b, e.currentTarget) })));
  if (MD.entOf(b)) {
    el.classList.add("ent");
    el.append(h("span", { class: "ent-mark", contenteditable: "false", html: ICON.ent,
      title: twin ? `Entangled: changes here also change the ${twinName()}` : "Entangled (the other version of this page couldn’t be loaded)" }));
  }
  el.append(addButton(b));
  b.el = el;
  return el;
}

function addButton(b) {
  return h("button", { class: "add", type: "button", title: "Add something here", "aria-label": "Add below", contenteditable: "false", onclick: e => addMenu(b, e.currentTarget) }, "+");
}

function renderTextBlock(b) {
  const ok = [];
  const mk = (u, tag, ph) => { const el = renderUnit(u, b, tag, ph); ok.push(el); return el; };
  let el;
  if (b.kind === "para") el = h("div", { class: "blk k-para" }, mk(b.units[0], "p", "Write something…"));
  else if (b.kind === "heading") el = h("div", { class: "blk k-heading" }, mk(b.units[0], "h" + Math.min(b.level, 6), "Heading"));
  else if (b.kind === "quote") el = h("div", { class: "blk k-quote" }, h("blockquote", {}, b.units.map(u => mk(u, "p", "Quote"))));
  else if (b.kind === "list") {
    const m = /^(\d+)/.exec(b.items[0].marker);
    const list = h(m ? "ol" : "ul", m && m[1] !== "1" ? { start: m[1] } : {}, b.items.map(it => h("li", {}, it.units.map(u => mk(u, "p", "List item")))));
    el = h("div", { class: "blk k-list" }, list);
  }
  return ok.every(x => x) ? el : null;
}

function renderUnit(u, b, tag, ph) {
  const locked = MD.entOf(b) && (!twin || twin.stale);
  const el = h(tag, { class: "u", contenteditable: locked ? "false" : "true", spellcheck: "true", "data-uid": u.id, "data-ph": ph || "" });
  if (u.md0 === undefined) u.md0 = u.md;
  el.append(renderInline(MD.parseInline(u.md), { prev: null }));
  u.el = el;
  units.set(u.id, { u, b });
  if (unitMd(el, u) !== u.md.trim()) { units.delete(u.id); u.el = null; return null; }
  markEmpty(el);
  return el;
}

function renderInline(nodes, ctx) {
  const frag = document.createDocumentFragment();
  for (const n of nodes) {
    switch (n.t) {
      case "text": { frag.append(MD.smart(n.v, ctx.prev)); ctx.prev = n.v.slice(-1) || ctx.prev; break; }
      case "lit": frag.append(h("span", { class: "lit", "data-c": n.c }, n.c)); ctx.prev = n.c; break;
      case "em": case "strong": case "sup": case "sub": {
        const el = h(n.t, {}); el.append(renderInline(n.c, ctx)); frag.append(el); break;
      }
      case "code": frag.append(h("code", { "data-ticks": n.ticks || 1 }, n.v)); ctx.prev = "x"; break;
      case "link": {
        const el = h("a", { href: hrefUrl(n.href), "data-href": n.href }); el.append(renderInline(n.c, ctx)); frag.append(el); break;
      }
      case "fn": frag.append(fnChip(n.label)); ctx.prev = "x"; break;
      case "raw": frag.append(rawChip(n.src)); ctx.prev = "x"; break;
      case "br": frag.append(h("br", { class: "hard" })); ctx.prev = " "; break;
    }
  }
  return frag;
}

function fnChip(label) { return h("sup", { class: "fn", contenteditable: "false", "data-label": label, title: "Footnote: click to see or edit" }); }

function rawChip(src) {
  if (/^\*+$/.test(src)) return h("span", { class: "raw stray", contenteditable: "false", "data-src": src, title: "Stray asterisks: the site shows these as asterisks. Delete them if they’re a mistake." }, src);
  if (/^\$[^$]/.test(src) && window.katex) {
    const el = h("span", { class: "raw math", contenteditable: "false", "data-src": src, title: src });
    try { katex.render(src.slice(1, -1), el, { throwOnError: false }); return el; } catch (e) { /* fall through */ }
  }
  return h("span", { class: "raw", contenteditable: "false", "data-src": src, title: "Kept as Markdown: " + src }, src);
}

function hrefUrl(href) {
  const url = href.trim().split(/\s+/)[0].replace(/^<|>$/g, "");
  if (/^[a-z]+:/i.test(url) || url.startsWith("#")) return url;
  try { return new URL(url.replace(/\.qmd(#|$)/, ".html$1"), pageUrl(cur.path)).href; } catch (e) { return url; }
}

function blockHasMath(b) { return blockUnits(b).some(u => /\$[^$\s]/.test(u.md)); }

let katexLoading = false;
function loadKatex() {
  if (window.katex || katexLoading) return;
  katexLoading = true;
  const base = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/";
  document.head.append(h("link", { rel: "stylesheet", href: base + "katex.min.css" }));
  const s = h("script", { src: base + "katex.min.js" });
  s.onload = () => { for (const b of cur.doc.blocks) if (b.sub === "math" || blockHasMath(b)) rerender(b); };
  document.head.append(s);
}

/* ---------- images ---------- */

function repoPathOf(src) {
  const clean = src.split(/[?#]/)[0];
  const parts = cur.path.split("/").slice(0, -1);
  for (const seg of clean.split("/")) { if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg); }
  return parts.join("/");
}

function renderImage(b) {
  const rp = repoPathOf(b.src);
  const pend = pendingImages.get(rp);
  const width = MD.getAttr(b, "width") || "100%";
  const img = h("img", { src: pend ? pend.url : SITE + rp + (b.src.includes("?") ? b.src.slice(b.src.indexOf("?")) : ""), alt: MD.getAttr(b, "fig-alt") || b.alt || "", style: `width:${width}` });
  img.addEventListener("error", () => {
    if (img.dataset.fallback) { img.replaceWith(h("div", { class: "img-missing" }, "Image not found: " + rp)); return; }
    img.dataset.fallback = "1"; img.src = RAW + rp;
  }, { once: false });
  const pct = parseInt(width, 10) || 100;
  const range = h("input", { type: "range", min: "20", max: "100", step: "1", value: String(pct), "aria-label": "Width" });
  const out = h("span", {}, pct + "%");
  range.addEventListener("input", () => { img.style.width = range.value + "%"; out.textContent = range.value + "%"; });
  range.addEventListener("change", () => { checkpoint(); MD.setAttr(b, "width", range.value + "%"); b.dirty = true; afterChange(); });
  const tools = h("div", { class: "img-tools", contenteditable: "false" },
    h("label", { title: "Width on the page" }, range, out),
    h("button", { type: "button", onclick: e => altPop(b, e.currentTarget) }, "Alt text"),
    h("button", { type: "button", onclick: () => pickImage(file => replaceImage(b, file)) }, "Replace"));
  const fig = h("figure", {}, img, tools);
  if (b.href) fig.append(h("div", { class: "img-note" }, "Links to ", h("a", { href: b.href, target: "_blank", rel: "noopener" }, b.href.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60) + "…")));
  if (pend) fig.append(h("div", { class: "img-note" }, `New image (${rp.split("/").pop()}), uploaded when you publish`));
  return h("div", { class: "blk k-image" }, fig);
}

function altPop(b, anchor) {
  const ta = h("textarea", { rows: "3", placeholder: "Describe the image for people who can’t see it" }, MD.getAttr(b, "fig-alt"));
  const save = () => { const v = ta.value.replace(/\s+/g, " ").replace(/"/g, "'").trim(); if (v !== MD.getAttr(b, "fig-alt")) { checkpoint(); MD.setAttr(b, "fig-alt", v); b.dirty = true; afterChange(); rerender(b); } closePop(); };
  openPop(anchor, h("div", { class: "form" },
    h("div", { class: "head" }, "Alt text"),
    ta,
    h("div", { class: "help" }, "Read aloud by screen readers. Leave empty if the image is decorative."),
    h("div", { class: "row" }, h("span", { class: "grow" }), h("button", { class: "btn", type: "button", onclick: closePop }, "Cancel"), h("button", { class: "btn primary", type: "button", onclick: save }, "Save"))));
  ta.focus();
}

function pickImage(cb) {
  const inp = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml" });
  inp.addEventListener("change", () => { if (inp.files[0]) cb(inp.files[0]); });
  inp.click();
}

// both: also upload it to the other version's images/ folder (for an entangled image), under the same name
async function stageImage(file, both) {
  if (file.size > 8 * 1024 * 1024) { toast("That image is over 8 MB. Please shrink it first."); return null; }
  const book = bookOf(cur.path);
  const books = both && twin ? [book, bookOf(twin.path)] : [book];
  for (const bk of books) {
    if (imageNames.has(bk)) continue;
    // The new file's name must not match an existing image, so don't guess if the list can't be read
    try { imageNames.set(bk, (await gh(repo(`/contents/${bk}images?ref=${BRANCH}`))).map(f => f.name)); }
    catch (e) { toast("Couldn’t check the existing images on GitHub, so the image wasn’t added. Try again."); return null; }
  }
  const m = /chapters\/(\d+)-/.exec(cur.path);
  const prefix = m ? "ch" + m[1] : cur.path.replace(/^.*\//, "").replace(/\.qmd$/, "").replace(/^introduction$/, "intro");
  const taken = books.flatMap(bk => imageNames.get(bk).concat([...pendingImages.keys()].filter(p => bookOf(p) === bk).map(p => p.split("/").pop())));
  let n = 0;
  for (const name of taken) { const mm = new RegExp(`^${prefix}-(\\d+)\\.`).exec(name); if (mm) n = Math.max(n, +mm[1]); }
  const ext = ({ "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg" })[file.type] || "png";
  const name = `${prefix}-${String(n + 1).padStart(2, "0")}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const img = { b64: btoa(bin), url: URL.createObjectURL(file) };
  for (const bk of books) pendingImages.set(bk + "images/" + name, img);
  return "../".repeat(cur.path.slice(book.length).split("/").length - 1) + "images/" + name;
}

async function replaceImage(b, file) {
  const src = await stageImage(file, !!MD.entOf(b));
  if (!src) return;
  checkpoint();
  b.src = src; b.dirty = true;
  rerender(b); afterChange();
}

async function insertImageAfter(after, file, entangled) {
  const src = await stageImage(file, entangled);
  if (!src) return;
  checkpoint();
  const nb = MD.makeBlock(`![](${src}){width="90%"${entangled ? ` ent="${newEntId()}"` : ""}}`, [""]);
  nb.dirty = true;
  insertBlock(nb, after);
  afterChange();
  nb.el.scrollIntoView({ block: "center", behavior: "smooth" });
  toast("Image added. Use “Alt text” on the image to describe it.");
}

/* ---------- posts from X ---------- */

// "https://twitter.com/a/status/1?s=20" → "https://x.com/a/status/1"; null if it isn't a link to a post
function tweetUrl(v) {
  const m = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w+)\/status(?:es)?\/(\d+)/i.exec(v.trim());
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}

let twttrLoad = null;
function loadTwttr() {
  return twttrLoad = twttrLoad || new Promise((ok, fail) => {
    const sc = h("script", { src: "https://platform.twitter.com/widgets.js", async: "" });
    sc.onload = () => window.twttr && twttr.ready ? twttr.ready(ok) : fail();
    sc.onerror = () => { twttrLoad = null; fail(); };
    document.head.append(sc);
  });
}

function renderTweet(b) {
  const url = tweetUrl(b.url) || b.url;
  const box = h("div", { class: "tweet-box" }, h("div", { class: "img-missing" }, "Loading the post from X…"));
  const dark = document.documentElement.dataset.theme === "dark" ||
    (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const failed = why => box.replaceChildren(h("div", { class: "img-missing" }, why, " ",
    h("a", { href: url, target: "_blank", rel: "noopener" }, url.replace(/^https:\/\//, ""))));
  const id = (/\/status\/(\d+)/.exec(url) || [])[1];
  if (!id) failed("This isn’t a link to a post on X:");
  else loadTwttr().then(() => twttr.widgets.createTweet(id, box, { dnt: true, theme: dark ? "dark" : "light", align: "center" }))
    .then(el => { if (el) box.firstChild.remove(); else failed("X wouldn’t show this post (deleted, private, or blocked). On the site it will appear as a link:"); })
    .catch(() => failed("Couldn’t load X’s preview (maybe a blocker). The post will still be on the site:"));
  const tools = h("div", { class: "img-tools", contenteditable: "false" },
    h("button", { type: "button", onclick: e => tweetPop(e.currentTarget, b.url, v => { checkpoint(); b.url = v; b.dirty = true; rerender(b); afterChange(); }) }, "Change link"));
  return h("div", { class: "blk k-image k-tweet" }, h("figure", {}, box, tools));
}

function tweetPop(anchor, value, done) {
  const input = h("input", { type: "url", value: value || "", placeholder: "https://x.com/someone/status/…", "aria-label": "Link to the post" });
  const err = h("div", { class: "help" }, "Paste the link to the post (Share → Copy link).");
  const apply = () => {
    const v = tweetUrl(input.value);
    if (!v) { err.textContent = "That doesn’t look like a link to a post on X. It should contain “/status/” followed by a number."; input.focus(); return; }
    closePop();
    if (v !== value) done(v);
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
  openPop(anchor, h("div", { class: "form" },
    h("div", { class: "head" }, "Post from X"),
    input, err,
    h("div", { class: "row" }, h("span", { class: "grow" }), h("button", { class: "btn", type: "button", onclick: closePop }, "Cancel"), h("button", { class: "btn primary", type: "button", onclick: apply }, "Add post"))));
  input.focus();
}

function insertTweetAfter(after, url) {
  checkpoint();
  const nb = MD.makeBlock(`{{< tweet ${url} >}}`, [""]);
  nb.dirty = true;
  insertBlock(nb, after);
  afterChange();
  nb.el.scrollIntoView({ block: "center", behavior: "smooth" });
}

/* ---------- ratings ---------- */

function renderRating(b) {
  const btn = h("button", { class: `rating tier-${b.tier}`, type: "button", title: "Change the rating", onclick: e => ratingPop(b, e.currentTarget) }, "Rating: " + b.label);
  return h("div", { class: "blk k-rating" }, h("p", {}, btn));
}

function ratingPop(b, anchor) {
  const custom = h("input", { type: "text", value: b.label, "aria-label": "Rating text" });
  const set = (label, tier) => { closePop(); if (label === b.label && tier === b.tier) return; checkpoint(); b.label = label; b.tier = tier; b.dirty = true; rerender(b); afterChange(); };
  openPop(anchor, h("div", { class: "form" },
    h("div", { class: "head" }, "Rating"),
    h("div", { class: "tierpick" }, TIERS.map(([label, tier]) => h("button", { class: `rating tier-${tier}`, type: "button", onclick: () => set(label, tier) }, label))),
    h("div", { class: "help" }, "Or type your own wording (it keeps the current colour):"),
    h("div", { class: "row" }, custom, h("button", { class: "btn", type: "button", onclick: () => set(custom.value.trim() || b.label, b.tier) }, "Use"))));
}

/* ---------- blocks kept as Markdown ---------- */

function renderRaw(b) {
  const src = b.kind === "raw" ? b.raw : MD.blockMd(b);
  let view, tag = "Markdown";
  if (b.sub === "comment") {
    return h("div", { class: "blk k-raw" }, h("div", { class: "rawblk comment", title: "Click to edit", onclick: () => codeEdit(b) }, "‹hidden HTML comment›"));
  }
  if (b.sub === "math") {
    tag = "Equation";
    view = h("div", { class: "mathview" });
    if (window.katex) { try { katex.render(src.trim().replace(/^\$\$|\$\$$/g, ""), view, { displayMode: true, throwOnError: false }); } catch (e) { view.textContent = src; } }
    else view.textContent = src;
  } else if (b.sub === "table" && /^\|/.test(src)) {
    tag = "Table";
    view = pipeTable(src) || h("pre", {}, src);
  } else if (isText(b)) {
    tag = "Unusual formatting: edit as Markdown";
    view = h("div", {});
    const ro = b.kind === "heading" ? h("h" + b.level) : b.kind === "quote" ? h("blockquote") : h("p");
    ro.append(renderInline(MD.parseInline(blockUnits(b).map(u => u.md).join(" ")), { prev: null }));
    view.append(ro);
  } else {
    tag = b.sub === "table" ? "Table" : "Markdown";
    view = h("pre", {}, src);
  }
  return h("div", { class: "blk k-raw" }, h("div", { class: "rawblk", title: "Click to edit as Markdown", onclick: e => { if (!e.target.closest("a")) codeEdit(b); } }, view, h("span", { class: "tag" }, tag)));
}

function pipeTable(src) {
  const rows = src.split("\n").filter(l => /^\|/.test(l));
  if (rows.length < 2 || !/^\|?[\s:|-]+\|?$/.test(rows[1])) return null;
  const cells = l => l.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => c.trim());
  const cell = (tag, c) => { const el = h(tag); el.append(renderInline(MD.parseInline(c), { prev: null })); return el; };
  return h("table", {}, h("thead", {}, h("tr", {}, cells(rows[0]).map(c => cell("th", c)))),
    h("tbody", {}, rows.slice(2).map(r => h("tr", {}, cells(r).map(c => cell("td", c))))));
}

function codeEdit(b) {
  closePop();
  const src = b.kind === "raw" ? b.raw : MD.blockMd(b);
  const ta = h("textarea", { spellcheck: "false" }, src);
  const done = () => {
    const v = ta.value.replace(/\r/g, "").replace(/^\n+|\n+$/g, "");
    if (v !== src) {
      checkpoint();
      const nb = MD.makeBlock(v, b.pre);
      nb.dirty = true; nb.raw = v;
      replaceBlock(b, nb);
      afterChange();
    } else rerender(b);
  };
  const box = h("div", { class: "blk codeedit" }, ta,
    h("div", { class: "row" }, h("span", { class: "hint" }, "Markdown source. Ctrl+Enter to finish."),
      h("button", { class: "btn", type: "button", onclick: () => rerender(b) }, "Cancel"),
      h("button", { class: "btn primary", type: "button", onclick: done }, "Done")));
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); done(); } if (e.key === "Escape") rerender(b); });
  const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 4, window.innerHeight * .7) + "px"; };
  ta.addEventListener("input", fit);
  box.dataset.bid = b.id;
  b.el.replaceWith(box); b.el = box;
  fit(); ta.focus();
}

/* =================================================================== block operations */

function idx(b) { return cur.doc.blocks.indexOf(b); }

function rerender(b) {
  if (!b.el || !b.el.isConnected) return;
  for (const u of blockUnits(b)) units.delete(u.id);
  const old = b.el;
  old.replaceWith(renderBlock(b));
  renumberNotes();
}

function insertBlock(nb, after) {
  const i = after ? idx(after) + 1 : 0;
  cur.doc.blocks.splice(i, 0, nb);
  const el = renderBlock(nb);
  const anchor = after ? after.el : $("#doc .k-title");
  if (anchor) anchor.after(el); else $("#doc").prepend(el);
  refreshOutline();
}

function removeBlock(b) {
  cur.doc.blocks.splice(idx(b), 1);
  for (const u of blockUnits(b)) units.delete(u.id);
  if (b.el) b.el.remove();
  refreshOutline();
}

function replaceBlock(b, nb) {
  cur.doc.blocks[idx(b)] = nb;
  for (const u of blockUnits(b)) units.delete(u.id);
  b.el.replaceWith(renderBlock(nb));
  renumberNotes(); refreshOutline();
}

function moveBlock(b, dir) {
  const i = idx(b), j = i + dir;
  if (j < 0 || j >= cur.doc.blocks.length) return;
  checkpoint();
  const other = cur.doc.blocks[j];
  cur.doc.blocks[i] = other; cur.doc.blocks[j] = b;
  if (dir < 0) other.el.before(b.el); else other.el.after(b.el);
  // Moving changes which blank lines go where; keep both blocks' own separators
  b.dirty = b.dirty || false;
  afterChange(); renumberNotes(); refreshOutline();
  b.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  b.el.classList.remove("flash"); void b.el.offsetWidth; b.el.classList.add("flash");
}

function deleteBlock(b) {
  checkpoint();
  const i = idx(b);
  removeBlock(b);
  afterChange(); renumberNotes();
  const near = allUnits().find(x => idx(x.b) >= i) || allUnits().slice(-1)[0];
  if (near) setCaret(near.u.el, 0);
  toast(MD.entOf(b) && twin ? `Deleted here and in the ${twinName()}.` : "Deleted.", ["Undo", undo]);
}

// New text blocks of a given kind holding these pieces of text (Markdown)
let newId = 1e6;
function newTextBlock(kind, mds) {
  mds = mds.length ? mds : [""];
  let bs;
  if (kind === "para") bs = mds.map(m => ({ kind: "para", units: [MD.unit(m)] }));
  else if (kind === "heading") bs = [{ kind: "heading", level: 2, attrs: "", units: [MD.unit(mds.join(" "))], autoId: true }];
  else if (kind === "quote") bs = [{ kind: "quote", units: mds.map(m => MD.unit(m)) }];
  else bs = [{ kind: "list", items: mds.map((m, i) => ({ marker: kind === "ol" ? `${i + 1}.  ` : "- ", units: [MD.unit(m, { inds: [""] })] })) }];
  for (const b of bs) {
    if (b.kind === "heading") setHeadingId(b);
    b.id = ++newId; b.pre = [""]; b.dirty = true; b.raw = MD.blockMd(b);
  }
  return bs;
}

function convertBlock(b, kind) {
  checkpoint();
  const mds = blockUnits(b).map(u => u.md);
  const nbs = newTextBlock(kind, mds);
  nbs[0].pre = b.pre;
  const i = idx(b);
  removeBlock(b);
  let after = cur.doc.blocks[i - 1] || null;
  for (const nb of nbs) { insertBlock(nb, after); after = nb; }
  afterChange(); renumberNotes();
  const u = blockUnits(nbs[0])[0];
  if (u && u.el) setCaret(u.el, Infinity);
}

// A new "Take N: ..." heading gets the {#take-N} anchor the chapter links use, unless another
// heading on the page already has it
function setHeadingId(b) {
  if (!b.autoId) return;
  const m = /^Take (\d+):/.exec(b.units[0].md);
  const id = m ? ` {#take-${m[1]}}` : "";
  b.attrs = id && cur && cur.doc.blocks.some(o => o !== b && o.kind === "heading" && o.attrs.trim() === id.trim()) ? "" : id;
}

function addNew(after, kind) {
  closePop();
  if (kind === "image" || kind === "entimage") { pickImage(f => insertImageAfter(after, f, kind === "entimage")); return; }
  checkpoint();
  let nb;
  if (kind === "entpara") { nb = newTextBlock("para", [""])[0]; nb.ent = newEntId(); nb.raw = MD.blockMd(nb); }
  else if (kind === "rating") { nb = MD.makeBlock("[Rating: D-tier]{.rating .tier-d}", [""]); nb.dirty = true; }
  else {
    nb = newTextBlock(kind, [kind === "heading" ? nextTakeTitle(after) : ""])[0];
  }
  insertBlock(nb, after);
  afterChange();
  if (kind === "rating") { ratingPop(nb, $(".rating", nb.el)); return; }
  const u = blockUnits(nb)[0];
  if (u && u.el) setCaret(u.el, Infinity);
}

function nextTakeTitle(after) {
  const i = after ? idx(after) : -1;
  let n = 0, any = false;
  cur.doc.blocks.slice(0, i + 1).forEach(b => { if (b.kind === "heading") { const m = /^Take (\d+):/.exec(b.units[0].md); if (m) { n = +m[1]; any = true; } } });
  return any ? `Take ${n + 1}:` : "";
}

/* ---------- menus ---------- */

function menuItem(icon, label, fn, cls) {
  return h("button", { type: "button", class: cls || "", onclick: () => { closePop(); fn(); } }, h("span", { html: ICON[icon] || "" }), label);
}

function blockMenu(b, anchor) {
  const items = [
    menuItem("up", "Move up", () => moveBlock(b, -1)),
    menuItem("down", "Move down", () => moveBlock(b, 1)),
  ];
  const ent = MD.entOf(b);
  if (twin && !twin.stale && (b.kind === "para" || b.kind === "image")) {
    if (ent) items.push(h("hr"), menuItem("unent", "Untangle", () => untangle(b)));
    else if (twinMatches().has(b)) items.push(h("hr"), menuItem("ent", "Entangle", () => entangle(b)));
  }
  if (isText(b) && !b.code && !ent) {
    items.push(h("hr"), h("div", { class: "lbl" }, "Turn into"));
    const opts = [["para", "para", "Paragraph"], ["heading", "head", "Heading"], ["quote", "quote", "Quote"], ["ul", "ul", "Bulleted list"], ["ol", "ol", "Numbered list"]];
    const curKind = b.kind === "list" ? (/^\d/.test(b.items[0].marker) ? "ol" : "ul") : b.kind;
    for (const [k, ic, label] of opts) if (k !== curKind) items.push(menuItem(ic, label, () => convertBlock(b, k)));
  }
  if (b.kind !== "image" && b.kind !== "rating" && b.kind !== "tweet") items.push(h("hr"), menuItem("code", "Edit as Markdown", () => codeEdit(b)));
  items.push(h("hr"), menuItem("trash", ent && twin ? "Delete from both versions" : "Delete", () => deleteBlock(b), "danger"));
  openPop(anchor, h("div", { class: "menu" }, items), { side: "right" });
  anchor.closest(".gut").classList.add("open");
}

function addMenu(after, anchor) {
  openPop(anchor, h("div", { class: "menu" },
    h("div", { class: "lbl" }, "Add below"),
    menuItem("para", "Paragraph", () => addNew(after, "para")),
    menuItem("head", "Heading (Take)", () => addNew(after, "heading")),
    menuItem("star", "Rating", () => addNew(after, "rating")),
    menuItem("quote", "Quote", () => addNew(after, "quote")),
    menuItem("ul", "Bulleted list", () => addNew(after, "ul")),
    menuItem("ol", "Numbered list", () => addNew(after, "ol")),
    menuItem("img", "Image…", () => addNew(after, "image")),
    menuItem("x", "Post from X…", () => tweetPop(anchor, "", url => insertTweetAfter(after, url))),
    canAddEntangled(after) ? [h("hr"), h("div", { class: "lbl" }, "Add to both versions"),
      menuItem("ent", "Entangled paragraph", () => addNew(after, "entpara")),
      menuItem("img", "Entangled image…", () => addNew(after, "entimage"))] : null), { side: "right" });
  anchor.classList.add("open");
}

/* ---------- popovers ---------- */

let pop = null;
function openPop(anchor, content, opts = {}) {
  closePop();
  const el = h("div", { class: "pop" }, content);
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, vw = document.documentElement.clientWidth;
  let left = opts.side === "right" ? r.left : r.left + r.width / 2 - w / 2;
  left = Math.max(16, Math.min(left, vw - w - 16));
  let top = r.bottom + 6;
  if (top + el.offsetHeight > window.innerHeight - 8 && r.top - el.offsetHeight - 6 > 8) top = r.top - el.offsetHeight - 6;
  el.style.left = left + window.scrollX + "px";
  el.style.top = top + window.scrollY + "px";
  pop = { el, anchor, onClose: opts.onClose };
  return el;
}
function closePop() {
  if (!pop) return;
  const p = pop; pop = null;
  p.el.remove();
  if (p.anchor) { p.anchor.classList.remove("open", "on"); const g = p.anchor.closest && p.anchor.closest(".gut"); if (g) g.classList.remove("open"); }
  if (p.onClose) p.onClose();
}
document.addEventListener("mousedown", e => { if (pop && !pop.el.contains(e.target) && e.target !== pop.anchor && !(pop.anchor && pop.anchor.contains(e.target))) closePop(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && pop) { closePop(); } });

let toastTimer;
function toast(msg, action) {
  const t = $("#toast");
  t.replaceChildren(h("span", {}, msg), ...(action ? [h("button", { type: "button", onclick: () => { t.classList.remove("show"); action[1](); } }, action[0])] : []));
  t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), action ? 6000 : 3500);
}

/* =================================================================== reading text back from the page */

function fromDom(node) {
  const out = [];
  for (const ch of node.childNodes) {
    if (ch.nodeType === 3) { out.push({ t: "text", v: ch.data }); continue; }
    if (ch.nodeType !== 1) continue;
    const cl = ch.classList, tag = ch.nodeName;
    if (cl.contains("fn")) out.push({ t: "fn", label: ch.dataset.label });
    else if (cl.contains("raw")) out.push({ t: "raw", src: ch.dataset.src });
    else if (cl.contains("lit")) {
      const t = ch.textContent;
      if (t && t[0] === ch.dataset.c) { out.push({ t: "lit", c: t[0] }); if (t.length > 1) out.push({ t: "text", v: t.slice(1) }); }
      else if (t) out.push({ t: "text", v: t });
    }
    else if (tag === "BR") { if (cl.contains("hard")) out.push({ t: "br" }); }
    else if (tag === "EM" || tag === "I") out.push({ t: "em", c: fromDom(ch) });
    else if (tag === "STRONG" || tag === "B") out.push({ t: "strong", c: fromDom(ch) });
    else if (tag === "SUP") out.push({ t: "sup", c: fromDom(ch) });
    else if (tag === "SUB") out.push({ t: "sub", c: fromDom(ch) });
    else if (tag === "CODE") out.push({ t: "code", v: ch.textContent, ticks: +ch.dataset.ticks || 1 });
    else if (tag === "A") out.push({ t: "link", href: ch.dataset.href || ch.getAttribute("href") || "", c: fromDom(ch) });
    else if ((tag === "DIV" || tag === "P") && out.length) { out.push({ t: "text", v: " " }); out.push(...fromDom(ch)); }
    else out.push(...fromDom(ch));
  }
  return out;
}

// Markdown for one editable piece of text
function unitMd(el, u) {
  let nodes = MD.normalize(fromDom(el));
  const keepTrailingBr = u && /\\$/.test(u.md0 || "");
  while (nodes.length && nodes[nodes.length - 1].t === "br" && !keepTrailingBr) nodes.pop();
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (first && first.t === "text") first.v = first.v.replace(/^[\s ]+/, "");
  if (last && last.t === "text") last.v = last.v.replace(/[ \t ]+$/, "");
  return MD.toMd(nodes.filter(n => n.t !== "text" || n.v));
}

function nodesMd(el) { return MD.toMd(MD.normalize(fromDom(el))); }

function markEmpty(el) {
  const empty = !el.textContent.replace(/​/g, "") && !el.querySelector(".fn, .raw, br.hard");
  el.classList.toggle("empty", empty);
}

/* =================================================================== the whole page as text */

function bmd(b) { return (b.kind === "raw" || b.code || !b.dirty) ? b.raw : MD.blockMd(b); }
function isEmptyText(b) { return isText(b) && blockUnits(b).every(u => !u.md.trim()); }

function serialize() {
  const d = cur.doc;
  const blocks = d.blocks.filter(b => !isEmptyText(b));
  return MD.serializeDoc(Object.assign({}, d, { blocks }), bmd);
}

/* =================================================================== editing events */

function unitOf(node) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  const uel = el && el.closest(".u");
  if (!uel) return null;
  if (uel.classList.contains("note-u")) return { note: true, el: uel };
  const rec = units.get(+uel.dataset.uid);
  return rec ? { el: uel, u: rec.u, b: rec.b } : null;
}

function onUnitInput(el) {
  const x = unitOf(el);
  if (!x) return;
  markEmpty(el);
  if (x.note) { noteInput(el); return; }
  const md = unitMd(el, x.u);
  if (md === x.u.md) return;
  beginTyping();
  x.u.md = md;
  x.b.dirty = true;
  if (x.b.kind === "heading") { setHeadingId(x.b); refreshOutline(); }
  afterChange();
}

function bindEditing() {
  document.addEventListener("beforeinput", e => {
    const x = unitOf(e.target);
    if (!x) return;
    if (e.inputType === "historyUndo" || e.inputType === "historyRedo") { e.preventDefault(); (e.inputType === "historyUndo" ? undo : redo)(); return; }
    if (e.inputType === "insertText" && (e.data === "'" || e.data === '"')) {
      e.preventDefault();
      document.execCommand("insertText", false, MD.smart(e.data, charBeforeCaret(x.el)));
    }
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") e.preventDefault();
    if (e.inputType === "insertFromDrop") e.preventDefault();
  });

  document.addEventListener("input", e => {
    const x = unitOf(e.target);
    if (!x) return;
    if (e.inputType === "insertText" && (e.data === "-" || e.data === ".")) typographer();
    onUnitInput(x.el);
  });

  document.addEventListener("keydown", e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && (e.key === "z" || e.key === "Z" || e.key === "y")) {
      if (!cur || $("#review").open || (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.nodeName))) return;
      e.preventDefault();
      if (e.key === "y" || e.shiftKey) redo(); else undo();
      return;
    }
    const x = unitOf(e.target);
    if (!x) return;
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); command("link"); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); command("note"); return; }
    if (x.note) { if (e.key === "Enter") e.preventDefault(); return; }
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      if (e.shiftKey) hardBreak(x.el); else splitUnit(x);
      return;
    }
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    if (e.key === "Backspace" && caretOffset(x.el) === 0) { if (mergeBack(x)) e.preventDefault(); return; }
    if (e.key === "Delete" && caretOffset(x.el) === textLength(x.el)) {
      const list = allUnits(), i = list.findIndex(y => y.u === x.u), nx = list[i + 1];
      if (nx && adjacent(x, nx)) { e.preventDefault(); mergeBack(nx); }
      return;
    }
    if (!e.shiftKey && !mod && !e.altKey && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) arrowNav(e, x);
  });

  document.addEventListener("paste", e => {
    const x = unitOf(e.target);
    if (!x) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\r/g, "");
    if (!text) { const f = [...e.clipboardData.files].find(f => /^image\//.test(f.type)); if (f && !x.note) insertImageAfter(x.b, f); return; }
    if (clip && clip.text === text) { insertNodes(withNotes(clip)); onUnitInput(x.el); return; }
    const paras = text.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
    if (!paras.length) return;
    document.execCommand("insertText", false, MD.smart(paras[0], charBeforeCaret(x.el)));
    if (paras.length > 1 && !x.note) {
      checkpoint();
      let after = x.b;
      for (const p of paras.slice(1)) {
        const nb = newTextBlock("para", [MD.toMd([{ t: "text", v: MD.smart(p, " ") }])])[0];
        insertBlock(nb, after); after = nb;
      }
      afterChange();
      setCaret(blockUnits(after)[0].el, Infinity);
    }
  });

  const copy = (e, cut) => {
    const x = unitOf(e.target);
    const sel = getSelection();
    if (!x || !sel.rangeCount || sel.isCollapsed) return;
    const r = sel.getRangeAt(0);
    if (!x.el.contains(r.commonAncestorContainer)) return;
    const box = h("div"); box.append(r.cloneContents());
    clip = { text: sel.toString(), md: nodesMd(box), notes: $$(".fn", box).map(c => noteByLabel(c.dataset.label)).filter(Boolean).map(n => ({ label: n.label, md: n.md })) };
    e.clipboardData.setData("text/plain", clip.text);
    e.preventDefault();
    if (cut) { r.deleteContents(); onUnitInput(x.el); }
  };
  document.addEventListener("copy", e => copy(e, false));
  document.addEventListener("cut", e => copy(e, true));
  document.addEventListener("dragstart", e => { if (unitOf(e.target)) e.preventDefault(); });

  document.addEventListener("click", e => {
    const fn = e.target.closest && e.target.closest("#doc .fn");
    if (fn) { e.preventDefault(); notePop(fn); return; }
    const a = e.target.closest && e.target.closest(".u a");
    if (a && a.closest(".note-u")) { e.preventDefault(); if (e.ctrlKey || e.metaKey) window.open(a.href, "_blank", "noopener"); return; }
    if (a) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { window.open(a.href, "_blank", "noopener"); return; }
      linkInfoPop(a);
    }
  });

  document.addEventListener("selectionchange", () => {
    const sel = getSelection();
    if (sel.rangeCount && unitOf(sel.anchorNode)) lastRange = { range: sel.getRangeAt(0).cloneRange(), el: unitOf(sel.anchorNode).el };
    clearTimeout(entBtnTimer); entBtnTimer = setTimeout(updateEntButton, 120);
  });
}
let lastRange = null, entBtnTimer;

// Pasted text keeps its footnotes, even when copied from another page
function withNotes(c) {
  let md = c.md;
  if (caretInNote()) md = md.replace(/\[\^[^\]\s]+\](?!:)/g, "");
  for (const n of c.notes || []) {
    const here = noteByLabel(n.label);
    if (here && here.md === n.md) continue;
    let label = n.label;
    if (here) { label = nextLabel(); md = md.split(`[^${n.label}]`).join(`[^${label}]`); }
    cur.doc.notes.push({ label, md: n.md });
  }
  return MD.parseInline(md);
}
function caretInNote() { const s = getSelection(); const x = s.rangeCount ? unitOf(s.anchorNode) : null; return !!(x && x.note); }

function charBeforeCaret(el) {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const s = pre.toString();
  return s ? s.slice(-1) : null;
}

// -- → en dash, --- → em dash, ... → ellipsis, as on the site
function typographer() {
  const sel = getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0), node = r.startContainer, off = r.startOffset;
  if (node.nodeType !== 3) return;
  const before = node.data.slice(0, off);
  let rep = null, len = 0;
  if (/–-$/.test(before)) { rep = "—"; len = 2; }
  else if (/--$/.test(before)) { rep = "–"; len = 2; }
  else if (/\.\.\.$/.test(before)) { rep = "…"; len = 3; }
  if (!rep) return;
  node.data = before.slice(0, -len) + rep + node.data.slice(off);
  const nr = document.createRange(); nr.setStart(node, off - len + 1); nr.collapse(true);
  sel.removeAllRanges(); sel.addRange(nr);
}

function hardBreak(el) {
  const sel = getSelection(); if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0); r.deleteContents();
  const br = h("br", { class: "hard" });
  r.insertNode(br);
  // A line break at the very end needs a second one to show the new line
  if (!br.nextSibling || (br.nextSibling.nodeType === 3 && !br.nextSibling.data && !br.nextSibling.nextSibling)) br.after(h("br"));
  const nr = document.createRange(); nr.setStartAfter(br); nr.collapse(true);
  sel.removeAllRanges(); sel.addRange(nr);
  onUnitInput(el);
}

function insertNodes(nodes) {
  const sel = getSelection(); if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0); r.deleteContents();
  const frag = renderInline(nodes, { prev: " " });
  const last = frag.lastChild;
  r.insertNode(frag);
  if (last) { const nr = document.createRange(); nr.setStartAfter(last); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); }
}

/* ---------- caret positions (text characters, with footnote markers etc. counting as one) ---------- */

function measure(node) {
  let n = 0;
  for (const ch of node.childNodes) {
    if (ch.nodeType === 3) n += ch.data.length;
    else if (ch.nodeType === 1) n += (ch.getAttribute("contenteditable") === "false" || ch.nodeName === "BR") ? 1 : measure(ch);
  }
  return n;
}
function textLength(el) { return measure(el) - (el.lastChild && el.lastChild.nodeName === "BR" && !el.lastChild.classList.contains("hard") ? 1 : 0); }
function caretOffset(el) {
  const sel = getSelection(); if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return null;
  const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
  const box = h("div"); box.append(pre.cloneContents());
  return measure(box);
}
function setCaret(el, off) {
  el.focus({ preventScroll: true });
  const sel = getSelection(), r = document.createRange();
  let left = off, done = false;
  const walk = node => {
    for (const ch of node.childNodes) {
      if (done) return;
      if (ch.nodeType === 3) { if (left <= ch.data.length) { r.setStart(ch, left); done = true; return; } left -= ch.data.length; }
      else if (ch.nodeType === 1) {
        if (ch.getAttribute("contenteditable") === "false" || ch.nodeName === "BR") { if (left === 0) { r.setStartBefore(ch); done = true; return; } left -= 1; }
        else walk(ch);
      }
    }
  };
  walk(el);
  if (!done) { r.selectNodeContents(el); r.collapse(false); }
  r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
  const rect = (r.getClientRects()[0] || el.getBoundingClientRect());
  if (rect.top < 70 || rect.bottom > window.innerHeight - 20) el.scrollIntoView({ block: "center" });
}

/* ---------- splitting and joining ---------- */

function allUnits() {
  const out = [];
  for (const b of cur.doc.blocks) if (isText(b) && !b.code) for (const u of blockUnits(b)) if (u.el) out.push({ u, b });
  return out;
}

// Can b's first unit be joined onto a? Only if nothing (like an image) sits between them.
function adjacent(a, b) {
  if (a.b === b.b) return true;
  const i = idx(a.b), j = idx(b.b);
  return j === i + 1 && blockUnits(a.b).slice(-1)[0] === a.u && blockUnits(b.b)[0] === b.u;
}

function container(b, u) {
  if (b.kind === "list") { const it = b.items.find(it => it.units.includes(u)); return { arr: it.units, item: it }; }
  return { arr: b.units };
}

function splitUnit(x) {
  const { el, u, b } = x;
  const sel = getSelection(); if (!sel.rangeCount) return;
  checkpoint();
  const r = sel.getRangeAt(0); r.deleteContents();
  const tail = document.createRange(); tail.setStart(r.startContainer, r.startOffset); tail.setEnd(el, el.childNodes.length);
  const box = h("div"); box.append(tail.extractContents());
  const md2 = unitMd(box, null);
  u.md = unitMd(el, u); b.dirty = true;
  const md1 = u.md;
  let target;
  if (b.kind === "para" || b.kind === "heading") {
    if (b.kind === "heading") setHeadingId(b);
    const nb = newTextBlock("para", [md2])[0];
    // Splitting an entangled paragraph keeps both halves entangled, so the other version keeps all the text
    if (b.ent && md2.trim()) { nb.ent = newEntId(); nb.raw = MD.blockMd(nb); }
    rerender(b); insertBlock(nb, b); target = nb.units[0];
  } else {
    const c = container(b, u), i = c.arr.indexOf(u);
    const lastOfBlock = blockUnits(b).slice(-1)[0] === u;
    if (!md1.trim() && !md2.trim() && lastOfBlock) {
      // Enter on an empty last line leaves the quote or list
      c.arr.splice(i, 1);
      if (c.item && !c.item.units.length) b.items.splice(b.items.indexOf(c.item), 1);
      const nb = newTextBlock("para", [""])[0];
      if (!blockUnits(b).length) { insertBlock(nb, b); removeBlock(b); }
      else { rerender(b); insertBlock(nb, b); }
      target = nb.units[0];
    } else if (b.kind === "list" && i === 0) {
      const it = c.item, k = b.items.indexOf(it);
      const nu = MD.unit(md2, { inds: [""] });
      b.items.splice(k + 1, 0, { marker: nextMarker(it.marker), units: [nu] });
      rerender(b); target = nu;
    } else {
      const nu = MD.unit(md2, { inds: c.item ? [" ".repeat(c.item.marker.length)] : undefined });
      c.arr.splice(i + 1, 0, nu);
      rerender(b); target = nu;
    }
  }
  afterChange();
  if (target && target.el) setCaret(target.el, 0);
}

function nextMarker(m) {
  const n = /^(\d+)([.)])(\s+)$/.exec(m);
  if (!n) return m;
  const next = String(+n[1] + 1);
  return next + n[2] + (n[3].length > next.length - n[1].length ? n[3].slice(next.length - n[1].length) : " ");
}

// Backspace at the start of a piece of text: join it onto the previous one
function mergeBack(x) {
  const list = allUnits(), i = list.findIndex(y => y.u === x.u);
  const prev = list[i - 1];
  if (!prev || !adjacent(prev, x)) {
    const bi = idx(x.b);
    if (!x.u.md.trim() && blockUnits(x.b).length === 1 && bi > 0) {
      // An empty paragraph after an image: remove it
      checkpoint();
      removeBlock(x.b); afterChange();
      if (prev) setCaret(prev.u.el, Infinity);
      return true;
    }
    return false;
  }
  if (prev.b !== x.b && MD.entOf(prev.b) !== MD.entOf(x.b) && x.u.md.trim()) {
    toast(MD.entOf(x.b) ? "This paragraph is entangled and the one above isn’t, so they can’t be joined. Untangle it first." : "The paragraph above is entangled and this one isn’t, so they can’t be joined. Untangle it first.");
    return true;
  }
  checkpoint();
  const off = textLength(prev.u.el);
  const box = h("div");
  box.append(...[...prev.u.el.childNodes].map(n => n.cloneNode(true)), ...[...x.u.el.childNodes].map(n => n.cloneNode(true)));
  prev.u.md = unitMd(box, prev.u); prev.b.dirty = true;
  const c = container(x.b, x.u);
  c.arr.splice(c.arr.indexOf(x.u), 1);
  if (c.item && !c.item.units.length) x.b.items.splice(x.b.items.indexOf(c.item), 1);
  x.b.dirty = true;
  if (!blockUnits(x.b).length) removeBlock(x.b); else if (x.b !== prev.b) rerender(x.b);
  rerender(prev.b);
  afterChange();
  setCaret(prev.u.el, off);
  return true;
}

function arrowNav(e, x) {
  const list = allUnits(), i = list.findIndex(y => y.u === x.u);
  const off = caretOffset(x.el), len = textLength(x.el);
  let go = null, toEnd = false;
  if (e.key === "ArrowLeft" && off === 0) { go = list[i - 1]; toEnd = true; }
  else if (e.key === "ArrowRight" && off === len) go = list[i + 1];
  else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const sel = getSelection(), r = sel.getRangeAt(0).cloneRange();
    let rect = r.getClientRects()[0];
    const box = x.el.getBoundingClientRect(), lh = parseFloat(getComputedStyle(x.el).lineHeight) || 28;
    const up = e.key === "ArrowUp";
    const edge = rect ? (up ? rect.top - box.top < lh * .8 : box.bottom - rect.bottom < lh * .8) : (up ? off === 0 : off === len);
    if (!edge) return;
    go = up ? list[i - 1] : list[i + 1];
    if (go) {
      e.preventDefault();
      const tb = go.u.el.getBoundingClientRect();
      const xPos = rect ? rect.left : box.left;
      const y = up ? tb.bottom - lh / 2 : tb.top + lh / 2;
      go.u.el.focus({ preventScroll: true });
      const cr = document.caretRangeFromPoint && y > 0 && y < window.innerHeight ? document.caretRangeFromPoint(xPos, y) : null;
      if (cr && go.u.el.contains(cr.startContainer)) { sel.removeAllRanges(); sel.addRange(cr); }
      else setCaret(go.u.el, up ? Infinity : 0);
      go.u.el.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (go) { e.preventDefault(); setCaret(go.u.el, toEnd ? Infinity : 0); }
}

/* =================================================================== toolbar commands */

function command(cmd) {
  if (cmd === "undo") return undo();
  if (cmd === "redo") return redo();
  if (cmd === "entangle") return entangleCommand();
  const sel = getSelection();
  const x = sel.rangeCount ? unitOf(sel.anchorNode) : null;
  if (!x) { toast("Click into the text first."); return; }
  if (cmd === "bold" || cmd === "italic" || cmd === "superscript") { document.execCommand(cmd); onUnitInput(x.el); return; }
  if (cmd === "link") return linkPop(x);
  if (cmd === "note" && !x.note) return newNotePop(x);
}

function linkPop(x) {
  const sel = getSelection(), range = sel.getRangeAt(0).cloneRange();
  const sc = range.startContainer, existing = (sc.nodeType === 1 ? sc : sc.parentElement).closest("a");
  if (existing && x.el.contains(existing)) { linkInfoPop(existing); return; }
  const input = h("input", { type: "url", placeholder: "https://…", "aria-label": "Web address" });
  const apply = () => {
    let url = input.value.trim();
    if (!url) { closePop(); return; }
    if (!/^[a-z]+:|^#|^\.|^\//i.test(url)) url = "https://" + url;
    closePop();
    x.el.focus();
    sel.removeAllRanges(); sel.addRange(range);
    if (range.collapsed) insertNodes([{ t: "link", href: url, c: [{ t: "text", v: url.replace(/^https?:\/\/(www\.)?/, "") }] }]);
    else { document.execCommand("createLink", false, url); $$("a:not([data-href])", x.el).forEach(a => a.dataset.href = a.getAttribute("href")); }
    onUnitInput(x.el);
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
  const rect = range.getBoundingClientRect();
  const anchor = h("span"); anchor.getBoundingClientRect = () => rect;
  openPop(anchor, h("div", { class: "form" },
    h("div", { class: "head" }, "Link"),
    input,
    h("div", { class: "row" }, h("span", { class: "grow" }), h("button", { class: "btn primary", type: "button", onclick: apply }, "Add link"))));
  input.focus();
}

function linkInfoPop(a) {
  const x = unitOf(a);
  const input = h("input", { type: "url", value: a.dataset.href || a.getAttribute("href"), "aria-label": "Web address" });
  const save = () => {
    const v = input.value.trim();
    closePop();
    if (!v || v === a.dataset.href) return;
    a.dataset.href = v; a.href = hrefUrl(v);
    onUnitInput(x.el);
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save(); } });
  openPop(a, h("div", { class: "form" },
    h("div", { class: "head" }, "Link"),
    input,
    h("div", { class: "row" },
      h("a", { class: "btn", href: a.href, target: "_blank", rel: "noopener" }, "Open ↗"),
      h("button", { class: "btn danger", type: "button", onclick: () => { closePop(); a.replaceWith(...a.childNodes); onUnitInput(x.el); } }, "Remove link"),
      h("span", { class: "grow" }),
      h("button", { class: "btn primary", type: "button", onclick: save }, "Save"))));
}

/* =================================================================== footnotes */

function noteByLabel(label) { return cur.doc.notes.find(n => n.label === label); }

function renumberNotes() {
  clearTimeout(renumberNotes.t);
  renumberNotes.t = setTimeout(() => {
    if (!cur) return;
    const body = MD.docBodyMd(cur.doc, bmd);
    const order = []; const re = /\[\^([^\]\s]+)\](?!:)/g; let m;
    while ((m = re.exec(body))) if (!order.includes(m[1])) order.push(m[1]);
    for (const chip of $$("#doc .fn")) {
      const n = order.indexOf(chip.dataset.label) + 1;
      chip.dataset.n = n || "?";
      chip.classList.toggle("missing", !noteByLabel(chip.dataset.label));
    }
  }, 60);
}

function nextLabel() {
  let n = 0;
  // Unused in the other version too, so a note in an entangled paragraph can be copied there as is
  for (const note of cur.doc.notes.concat(twin ? twin.doc.notes : [])) { const m = /^n(\d+)$/.exec(note.label); if (m) n = Math.max(n, +m[1]); }
  return "n" + (n + 1);
}

function notePop(chip) {
  const label = chip.dataset.label;
  let note = noteByLabel(label);
  const x = unitOf(chip);
  const ed = h("div", { class: "u note-u", contenteditable: "true", spellcheck: "true", "data-ph": "Note text or link" });
  const linkRow = h("div", { class: "row" });
  const fill = () => {
    ed.replaceChildren(renderInline(MD.parseInline(note ? note.md : ""), { prev: null }));
    const a = ed.querySelector("a");
    linkRow.replaceChildren(
      a ? h("a", { class: "btn", href: a.href, target: "_blank", rel: "noopener" }, "Open link ↗") : null,
      h("button", { class: "btn", type: "button", onclick: changeLink }, a ? "Change link" : "Add link"),
      h("span", { class: "grow" }),
      h("button", { class: "btn danger", type: "button", onclick: removeNote }, "Remove note"));
    markEmpty(ed);
  };
  const changeLink = () => {
    const a = ed.querySelector("a");
    const inp = h("input", { type: "url", value: a ? a.dataset.href : "", placeholder: "https://…", "aria-label": "Web address" });
    const ok = () => { if (inp.value.trim()) setLink(inp.value.trim()); else fill(); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ok(); } if (e.key === "Escape") { e.stopPropagation(); fill(); } });
    linkRow.replaceChildren(h("span", { class: "grow" }, inp), h("button", { class: "btn primary", type: "button", onclick: ok }, "Save"));
    inp.focus(); inp.select();
  };
  const setLink = url => {
    const a = ed.querySelector("a");
    if (!/^[a-z]+:/i.test(url)) url = "https://" + url;
    checkpoint();
    if (!note) { note = { label, md: "" }; cur.doc.notes.push(note); }
    // A note that is just a link gets a new short link, as the converter writes them
    if (!a || /^\[[^\]]*\]\([^)]*\)$/.test(note.md)) note.md = a ? MD.shortLink(url) : (note.md ? note.md + " " : "") + MD.shortLink(url);
    else { a.dataset.href = url; note.md = nodesMd(ed); }
    fill(); afterChange(); renumberNotes();
  };
  const removeNote = () => {
    closePop();
    checkpoint();
    chip.remove();
    if (x) onUnitInput(x.el);
    toast("Footnote removed.", ["Undo", undo]);
  };
  ed.dataset.label = label;
  fill();
  chip.classList.add("on");
  openPop(chip, h("div", { class: "form" },
    h("div", { class: "head" }, `Note ${chip.dataset.n}`, h("span", { class: "muted" }, label)),
    note ? null : h("div", { class: "warnbox" }, "This marker has no note text. Type it below to add it."),
    ed, linkRow,
    h("div", { class: "help" }, "Edits save as you type. Ctrl-click a link to open it.")), {});
  ed.focus();
}

function noteInput(ed) {
  const label = ed.dataset.label;
  if (!label) return;
  let note = noteByLabel(label);
  const md = unitMd(ed, null);
  if (!note) { note = { label, md: "" }; cur.doc.notes.push(note); }
  if (md === note.md) return;
  beginTyping();
  note.md = md;
  afterChange(); renumberNotes();
}

function newNotePop(x) {
  const sel = getSelection(), range = sel.getRangeAt(0).cloneRange();
  range.collapse(false);
  const input = h("textarea", { rows: "2", placeholder: "Paste a link, or type the note" });
  const lab = h("input", { type: "text", value: nextLabel(), "aria-label": "Note name", spellcheck: "false" });
  const add = () => {
    const text = input.value.trim();
    const label = lab.value.trim().replace(/[\s\]^]/g, "") || nextLabel();
    if (!text) { closePop(); return; }
    if (noteByLabel(label)) { toast(`There’s already a note called ${label} on this page.`); return; }
    if (twin && twin.doc.notes.some(n => n.label === label) && MD.entOf(x.b)) { toast(`The ${twinName()} already has a note called ${label}. Pick another name.`); return; }
    closePop();
    checkpoint();
    cur.doc.notes.push({ label, md: MD.noteFromInput(text) });
    x.el.focus();
    sel.removeAllRanges(); sel.addRange(range);
    const chip = fnChip(label);
    range.insertNode(chip);
    const nr = document.createRange(); nr.setStartAfter(chip); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr);
    onUnitInput(x.el);
    renumberNotes();
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } });
  const rect = range.getBoundingClientRect();
  const anchor = h("span"); anchor.getBoundingClientRect = () => (rect.width || rect.height ? rect : x.el.getBoundingClientRect());
  openPop(anchor, h("div", { class: "form" },
    h("div", { class: "head" }, "New footnote"),
    input,
    h("div", { class: "lab" }, "Name", lab, h("span", {}, "(any unique name; the reader sees a number)")),
    h("div", { class: "row" }, h("span", { class: "grow" }), h("button", { class: "btn", type: "button", onclick: closePop }, "Cancel"), h("button", { class: "btn primary", type: "button", onclick: add }, "Add note"))));
  input.focus();
}

/* =================================================================== entangled blocks

   A paragraph or image that is identical in the normal and Snark mode versions of a page can be
   entangled: md.js gives it a hidden id in both files, and edits to it here are copied into the
   other version (`twin`, loaded with every page and saved as that page's draft). Publishing then
   commits both files. Between two entangled blocks that are next to each other in both versions,
   "+" can add an entangled paragraph or image, which goes into both. */

function twinPathOf(path) { return bookOf(path) ? path.slice(bookOf(path).length) : "snark/" + path; }
function twinName() { return twin && bookOf(twin.path) ? "Snark mode version" : "normal version"; }

// The other version as it would be published: GitHub's copy, or its unpublished draft
async function loadTwin(path) {
  const tp = twinPathOf(path);
  if (!pages.some(pg => pg.path === tp)) return null;
  let f;
  try { f = await getFile(tp); } catch (e) { return null; }
  const t = { path: tp, baseSha: f.sha, origText: f.text, stale: false };
  const d = readDraft(tp);
  let text = f.text;
  // A draft made before the page last changed on GitHub can't be built on without losing something
  if (d && d.text !== f.text) { if (d.base === f.sha) text = d.text; else t.stale = true; }
  t.doc = MD.parseDoc(text);
  return t;
}

function serializeTwin() {
  const d = twin.doc;
  return MD.serializeDoc(Object.assign({}, d, { blocks: d.blocks.filter(b => !isEmptyText(b)) }), bmd);
}

const noteLabels = md => [...new Set([...md.matchAll(/\[\^([^\]\s]+)\](?!:)/g)].map(m => m[1]))];
function notesKey(doc, md) { return noteLabels(md).map(l => { const n = doc.notes.find(x => x.label === l); return "\n" + l + ":" + (n ? n.md : ""); }).join(""); }

// id -> Markdown (with its footnote texts) of each entangled block; empty paragraphs don't count yet
function entMap(doc) {
  const m = new Map();
  for (const b of doc.blocks) {
    const id = MD.entOf(b);
    if (id && !isEmptyText(b)) { const md = MD.blockMd(b); m.set(id, md + notesKey(doc, md)); }
  }
  return m;
}

function newEntId() {
  const used = new Set(cur.doc.blocks.concat(twin ? twin.doc.blocks : []).map(b => MD.entOf(b)).filter(Boolean));
  let id;
  do id = Math.random().toString(36).slice(2, 7); while (id.length < 5 || used.has(id));
  return id;
}

// Copy entangled blocks that changed here since the last sync into the other version: new ones go
// after the entangled block before them, deleted ones are deleted there too.
function syncTwin() {
  if (!twin || twin.stale || !cur || !cur.doc) return;
  const now = entMap(cur.doc);
  const order = cur.doc.blocks.filter(b => now.has(MD.entOf(b)));
  const tb = twin.doc.blocks;
  const find = id => tb.findIndex(x => MD.entOf(x) === id);
  order.forEach((b, k) => {
    const id = MD.entOf(b);
    if (entPrev.get(id) === now.get(id)) return;
    const j = find(id);
    const md = MD.blockMd(b);
    if (j >= 0) tb[j] = MD.makeBlock(md, tb[j].pre);
    else {
      let at = -1;
      for (let q = k - 1; q >= 0 && at < 0; q--) { const p = find(MD.entOf(order[q])); if (p >= 0) at = p + 1; }
      for (let q = k + 1; q < order.length && at < 0; q++) at = find(MD.entOf(order[q]));
      if (at < 0) at = tb.length;
      tb.splice(at, 0, MD.makeBlock(md, [""]));
    }
    for (const l of noteLabels(md)) {
      const n = noteByLabel(l);
      if (!n) continue;
      const t = twin.doc.notes.find(x => x.label === l);
      if (t) t.md = n.md; else twin.doc.notes.push({ label: l, md: n.md });
    }
  });
  for (const id of entPrev.keys()) if (!now.has(id)) { const j = find(id); if (j >= 0) tb.splice(j, 1); }
  entPrev = now;
}

// Blocks here that are identical to a block in the other version (and not entangled yet): this page's
// block -> the other's. Lined up in order, so a paragraph that appears twice pairs with the right copy.
let matchCache = null;
function twinMatches() {
  if (matchCache) return matchCache;
  const key = (doc, b, i, side) => {
    if (!MD.entOf(b)) {
      if (b.kind === "para" && b.units[0].md.trim()) return "p" + b.units[0].md + notesKey(doc, b.units[0].md);
      if (b.kind === "image") return "i" + MD.imageMd(b);
    }
    return "\u0001" + side + i;
  };
  const m = new Map();
  if (!twin || twin.stale) return m;
  const A = cur.doc.blocks, B = twin.doc.blocks;
  const ops = lcs(A.map((b, i) => key(cur.doc, b, i, "a")), B.map((b, i) => key(twin.doc, b, i, "b"))) || [];
  let i = 0, j = 0;
  for (const [op] of ops) {
    if (op === "=") { m.set(A[i], B[j]); i++; j++; } else if (op === "-") i++; else j++;
  }
  return matchCache = m;
}

function entangle(b) {
  const tb = twinMatches().get(b);
  if (!tb) return;
  const u = b.kind === "para" ? b.units[0] : null, off = u && u.el ? caretOffset(u.el) : null;
  checkpoint();
  const id = newEntId();
  MD.setEnt(b, id); b.dirty = true;
  MD.setEnt(tb, id); tb.dirty = true;
  rerender(b); afterChange();
  if (off !== null && u.el) setCaret(u.el, off);
  toast(`Entangled: changes here now also change the ${twinName()}.`, ["Undo", undo]);
}

function untangle(b) {
  const id = MD.entOf(b);
  const u = b.kind === "para" ? b.units[0] : null, off = u && u.el ? caretOffset(u.el) : null;
  checkpoint();
  MD.setEnt(b, null); b.dirty = true;
  const tb = twin && twin.doc.blocks.find(x => MD.entOf(x) === id);
  if (tb) { MD.setEnt(tb, null); tb.dirty = true; }
  rerender(b); afterChange();
  if (off !== null && u.el) setCaret(u.el, off);
  toast(`Untangled: the two versions can now be edited separately.`, ["Undo", undo]);
}

function entangleCommand() {
  const sel = getSelection();
  const x = sel.rangeCount ? unitOf(sel.anchorNode) : null;
  if (!twin) { toast("The other version of this page couldn’t be loaded, so nothing here can be entangled."); return; }
  if (twin.stale) { toast(`The ${twinName()} has out-of-date unpublished changes. Open it and publish or discard them first.`); return; }
  if (!x || x.note) { toast("Click into a paragraph first."); return; }
  if (MD.entOf(x.b)) { untangle(x.b); return; }
  if (x.b.kind !== "para") { toast("Only paragraphs and images (from their ⋮⋮ menu) can be entangled."); return; }
  if (!twinMatches().has(x.b)) { toast(`This paragraph isn’t identical in the ${twinName()}, so it can’t be entangled.`); return; }
  entangle(x.b);
}

// The toolbar button follows the paragraph the cursor is in
function updateEntButton() {
  const btn = $("#ent-btn");
  if (!btn) return;
  btn.hidden = !twin;
  if (!twin || !cur) return;
  const sel = getSelection();
  const x = sel.rangeCount ? unitOf(sel.anchorNode) : null;
  const b = x && !x.note ? x.b : null;
  const on = !!(b && MD.entOf(b));
  $(".lbl", btn).textContent = on ? "Untangle" : "Entangle";
  btn.querySelector("svg").outerHTML = on ? ICON.unent : ICON.ent;
  const ok = on || (b && b.kind === "para" && !twin.stale && twinMatches().has(b));
  btn.classList.toggle("off", !ok);
  btn.title = on ? `Stop copying edits of this paragraph to the ${twinName()}`
    : ok ? `Entangle this paragraph with the same one in the ${twinName()}, so edits change both`
    : `Entangle: only for a paragraph that is identical in the ${twinName()}`;
}

// "+" offers entangled blocks only between two entangled blocks that are next to each other in both versions
function canAddEntangled(a) {
  if (!a || !twin || twin.stale) return false;
  syncTwin();
  const nx = cur.doc.blocks[idx(a) + 1], ia = MD.entOf(a), inx = nx && MD.entOf(nx);
  if (!ia || !inx || isEmptyText(a) || isEmptyText(nx)) return false;
  const tb = twin.doc.blocks, j = tb.findIndex(x => MD.entOf(x) === ia);
  return j >= 0 && !!tb[j + 1] && MD.entOf(tb[j + 1]) === inx;
}

// On opening a page: say if entangled blocks no longer match (edited on GitHub, or a draft was discarded)
function twinBanner() {
  if (!twin) return;
  const here = entMap(cur.doc);
  if (twin.stale) {
    if (here.size) banner(`The ${twinName()} of this page has unpublished changes made before it last changed on GitHub. Until you publish or discard them there, entangled paragraphs here can’t be edited.`,
      [["Open it", () => { location.hash = twin.path; }]]);
    return;
  }
  const there = entMap(twin.doc);
  const ids = new Set([...here.keys(), ...there.keys()].filter(id => here.get(id) !== there.get(id)));
  if (!ids.size) return;
  const n = ids.size;
  const fix = fromHere => {
    checkpoint();
    for (const id of ids) {
      const a = cur.doc.blocks.find(x => MD.entOf(x) === id), t = twin.doc.blocks.find(x => MD.entOf(x) === id);
      if (a && t) {
        if (fromHere) { entPrev.delete(id); continue; }
        const md = MD.blockMd(t), nb = MD.makeBlock(md, a.pre);
        for (const l of noteLabels(md)) {
          const tn = twin.doc.notes.find(x => x.label === l);
          if (!tn) continue;
          const an = noteByLabel(l);
          if (an) an.md = tn.md; else cur.doc.notes.push({ label: l, md: tn.md });
        }
        nb.dirty = true; replaceBlock(a, nb);
      } else if (a) { if (fromHere) entPrev.delete(id); else { MD.setEnt(a, null); a.dirty = true; rerender(a); } }
      else { MD.setEnt(t, null); t.dirty = true; }
    }
    entPrev = new Map([...entMap(cur.doc)].filter(([id]) => !(fromHere && ids.has(id))));
    afterChange();
    $("#banner").hidden = true;
  };
  banner(`${n} entangled ${n > 1 ? "paragraphs or images don’t" : "paragraph or image doesn’t"} match the ${twinName()} (edited outside this editor, or a draft was discarded).`,
    [["Use this page’s text in both", () => fix(true)], [`Use the ${twinName()}’s text in both`, () => fix(false)]]);
}

/* =================================================================== undo, drafts, status */

let typing = false, typingTimer = null, lastStable = { text: "", twin: "" };

// Both versions of the page as text: an undo step covers entangled changes to the other one too
function state() { syncTwin(); return { text: serialize(), twin: twin ? serializeTwin() : "" }; }
const sameState = (a, b) => a.text === b.text && a.twin === b.twin;

function caretInfo() {
  const sel = getSelection();
  const x = sel.rangeCount ? unitOf(sel.anchorNode) : null;
  if (!x || x.note) return null;
  return { i: allUnits().findIndex(y => y.u === x.u), off: caretOffset(x.el) };
}

function pushUndo(st, caret) {
  const top = undoStack[undoStack.length - 1];
  if (top && sameState(top, st)) return;
  undoStack.push({ text: st.text, twin: st.twin, caret });
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
}

// Typing: one undo step per burst of typing
function beginTyping() {
  if (!typing) { pushUndo(lastStable, caretInfo()); typing = true; }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(endTyping, 800);
}
function endTyping() { clearTimeout(typingTimer); typing = false; if (cur) lastStable = state(); }

// Before a structural change
function checkpoint() { endTyping(); pushUndo(lastStable, caretInfo()); }

function restore(state) {
  closePop();
  const y = window.scrollY;
  if (twin && state.twin) twin.doc = MD.parseDoc(state.twin);
  loadText(state.text);
  lastStable = { text: state.text, twin: state.twin };
  window.scrollTo(0, y);
  if (state.caret && state.caret.i >= 0) { const u = allUnits()[state.caret.i]; if (u) setCaret(u.u.el, state.caret.off); }
  afterChange();
  refreshOutline();
}
function undo() {
  if (!cur) return;
  endTyping();
  const now = Object.assign(state(), { caret: caretInfo() });
  let s = undoStack.pop();
  while (s && sameState(s, now)) s = undoStack.pop();
  if (!s) { toast("Nothing to undo."); return; }
  redoStack.push(now);
  restore(s);
}
function redo() {
  if (!cur) return;
  endTyping();
  const s = redoStack.pop();
  if (!s) return;
  undoStack.push(Object.assign(state(), { caret: caretInfo() }));
  restore(s);
}

let saveTimer;
function afterChange() {
  matchCache = null;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 400);
  renumberNotes();
}

function readDraft(path) { try { return JSON.parse(store.get(DRAFT_KEY + path)); } catch (e) { return null; } }

function saveDraft() {
  if (!cur) return;
  const st = state();
  let listChanged = false;
  // Entangled changes to the other version are saved as its draft, so they show there too
  for (const [pg, text] of [[cur, st.text], [twin && !twin.stale ? twin : null, st.twin]]) {
    if (!pg) continue;
    const had = !!store.get(DRAFT_KEY + pg.path);
    if (text === pg.origText) store.del(DRAFT_KEY + pg.path);
    else if (!store.set(DRAFT_KEY + pg.path, JSON.stringify({ text, base: pg.baseSha, at: Date.now() }))) toast("Couldn’t save a draft in this browser. Publish soon so you don’t lose edits.");
    if (had !== (text !== pg.origText)) listChanged = true;
  }
  if (listChanged) renderPageList();
  updateStatus(st);
  updateEntButton();
}

function updateStatus(now) {
  const st = $("#status"), txt = $(".txt", st);
  if (!cur) return;
  now = now || state();
  const changed = now.text !== cur.origText || twinChanged(now);
  $("#publish").disabled = !changed;
  st.className = "status";
  if (build && build.state !== "done") {
    st.classList.add(build.state === "failed" ? "bad" : "busy");
    txt.replaceChildren(build.state === "failed" ? h("a", { href: build.url, target: "_blank", rel: "noopener" }, "Site build failed") : "Publishing to the site…");
  } else if (changed) { st.classList.add("changed"); txt.textContent = "Unpublished changes (saved in this browser)"; }
  else if (build && build.state === "done") { st.classList.add("ok"); txt.textContent = "Published"; }
  else txt.textContent = "No changes";
}

window.addEventListener("beforeunload", () => { if (cur) { clearTimeout(saveTimer); saveDraft(); } });

const twinChanged = st => !!twin && !twin.stale && st.twin !== twin.origText;

/* =================================================================== review & publish */

function lcs(a, b) {
  // Edit script between two arrays (Myers-like via DP; arrays are small)
  const n = a.length, m = b.length;
  if (n * m > 4e6) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push(["=", a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(["-", a[i++]]);
    else ops.push(["+", b[j++]]);
  }
  while (i < n) ops.push(["-", a[i++]]);
  while (j < m) ops.push(["+", b[j++]]);
  return ops;
}

function wordDiff(a, b) {
  const ta = a.split(/(\s+)/), tb = b.split(/(\s+)/);
  const ops = lcs(ta, tb);
  const del = h("div", { class: "line minus" }), ins = h("div", { class: "line plus" });
  if (!ops) { del.textContent = a; ins.textContent = b; return [del, ins]; }
  // Long unchanged stretches are shortened to their first and last few words
  const out = [];
  for (const o of ops) { const last = out[out.length - 1]; if (last && last[0] === "=" && o[0] === "=") last[1] += o[1]; else out.push(o.slice()); }
  out.forEach((o, i) => {
    if (o[0] !== "=") return;
    const w = o[1].split(/(\s+)/), keep = 16;
    if (w.length <= keep * 2 + 6) return;
    const head = i === 0 ? [] : w.slice(0, keep), tail = i === out.length - 1 ? [] : w.slice(-keep);
    o[1] = head.join("") + (head.length ? " … " : "… ") + tail.join("");
  });
  for (const [op, t] of out) {
    if (op === "=") { del.append(t); ins.append(t); }
    else if (op === "-") del.append(h("del", {}, t));
    else ins.append(h("ins", {}, t));
  }
  return [del, ins];
}

function changeList(oldText, newText) {
  const a = oldText.split("\n"), b = newText.split("\n");
  const ops = lcs(a, b) || [];
  const hunks = [];
  let heading = "", group = null;
  for (const [op, line] of ops) {
    if (op === "=") {
      if (/^#{1,6} /.test(line)) heading = line.replace(/^#+ /, "").replace(/\s*\{[^}]*\}$/, "");
      if (group) { hunks.push(group); group = null; }
      continue;
    }
    if (!line.trim()) continue;
    if (!group) group = { where: /^\[\^/.test(line) ? "Footnotes" : heading || "Top of page", del: [], add: [] };
    (op === "-" ? group.del : group.add).push(line);
    if (op === "+" && /^#{1,6} /.test(line)) heading = line.replace(/^#+ /, "").replace(/\s*\{[^}]*\}$/, "");
  }
  if (group) hunks.push(group);
  return hunks;
}

function openReview() {
  if (!cur) return;
  endTyping();
  const st = state(), text = st.text, both = twinChanged(st);
  if (text === cur.origText && !both) return;
  const body = h("div", { class: "dlg-body" });
  if (both) body.append(h("h3", { class: "dlg-sub" }, cur.title.replace(/ \(Snark mode\)$/, "") + (bookOf(cur.path) ? " (Snark mode)" : " (normal)")));
  body.append(...hunkEls(cur.origText, text));
  if (both) {
    body.append(h("h3", { class: "dlg-sub" }, `The ${twinName()}`),
      h("p", { class: "help" }, "Entangled paragraphs and images are changed there too. Any other unpublished edits you made on that page are included."),
      ...hunkEls(twin.origText, st.twin));
  }
  const images = usedImages(text, cur.path).concat(both ? usedImages(st.twin, twin.path) : []);
  if (images.length) body.append(h("p", { class: "warnbox" }, `New image${images.length > 1 ? "s" : ""} to upload: ${images.join(", ")}`));
  const missing = $$("#doc .fn.missing").map(c => c.dataset.label);
  if (missing.length) body.append(h("p", { class: "warnbox" }, `Footnote marker${missing.length > 1 ? "s" : ""} without note text: ${missing.join(", ")}. ${missing.length > 1 ? "They" : "It"} will show as a broken number on the site.`));
  const msg = h("input", { type: "text", value: `Edit ${shortTitle()}${both ? " and its " + twinName() : ""} (web editor)`, "aria-label": "Description of the change" });
  const pub = h("button", { class: "btn primary", type: "button" }, "Publish");
  const foot = h("div", { class: "dlg-foot" }, msg, h("button", { class: "btn", type: "button", onclick: () => $("#review").close() }, "Cancel"), pub);
  pub.addEventListener("click", () => doPublish({ text, twin: both ? st.twin : null }, msg.value.trim() || `Edit ${shortTitle()}`, body, foot));
  $("#review-inner").replaceChildren(
    h("div", { class: "dlg-head" }, h("h2", {}, "Review changes"), h("p", {}, `${cur.title}. Removed text is red, added text is green. Footnote markers look like [^n12] here.`)),
    body, foot);
  $("#review").showModal();
  pub.focus();
}

// Entanglement markers are left out of the word-by-word changes and summed up in one line instead
const ENT_MARK = / <!--ent:[a-z0-9]+-->(?=\r?$)|\{ent="[a-z0-9]+"\}| ent="[a-z0-9]+"/gm;
function entIds(text) { return new Set([...text.matchAll(/<!--ent:([a-z0-9]+)-->|\bent="([a-z0-9]+)"/g)].map(m => m[1] || m[2])); }

function hunkEls(oldText, text) {
  const out = [];
  const was = entIds(oldText), now = entIds(text);
  const added = [...now].filter(id => !was.has(id)).length, removed = [...was].filter(id => !now.has(id)).length;
  const n = k => `${k} paragraph${k > 1 ? "s or images" : " or image"}`;
  if (added || removed) out.push(h("p", { class: "help" }, [added ? `${n(added)} newly entangled` : "", removed ? `${n(removed)} untangled or deleted` : ""].filter(Boolean).join("; ") + "."));
  oldText = oldText.replace(ENT_MARK, ""); text = text.replace(ENT_MARK, "");
  for (const g of changeList(oldText, text)) {
    const hk = h("div", { class: "hunk" }, h("div", { class: "where" }, MD.smart(g.where)));
    // Show an edited paragraph as one word-by-word change; pair removed and added lines that share most words
    const words = l => new Set(l.toLowerCase().split(/\W+/).filter(Boolean));
    const similar = (a, b) => { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.min(A.size, B.size)); };
    const plus = l => h("div", { class: "line plus" }, h("ins", {}, l)), minus = l => h("div", { class: "line minus" }, h("del", {}, l));
    let j = 0;
    for (const d of g.del) {
      const k = g.add.findIndex((a, i) => i >= j && similar(d, a) >= .5);
      if (k < 0) { hk.append(minus(d)); continue; }
      while (j < k) hk.append(plus(g.add[j++]));
      hk.append(...wordDiff(d, g.add[k])); j = k + 1;
    }
    while (j < g.add.length) hk.append(plus(g.add[j++]));
    out.push(hk);
  }
  return out;
}

// New images waiting to be uploaded that this page's text uses
function usedImages(text, path) {
  return [...pendingImages.keys()].filter(p => bookOf(p) === bookOf(path) && text.includes("images/" + p.split("/").pop()));
}

function shortTitle() { return (cur.title || cur.path).replace(/^(Chapter \d+):.*?( \(Snark mode\))?$/, "$1$2"); }

// st: {text, twin}; twin is the other version's text when entangled changes go there too, else null
async function doPublish(st, message, body, foot, force) {
  const page = cur, text = st.text;
  const other = st.twin !== null ? twin : null;
  const files = [[page, text]].concat(other ? [[other, st.twin]] : []);
  const steps = h("ul", { class: "steps" });
  const step = (label) => { const li = h("li", {}, h("span", { class: "ic" }, "…"), h("span", {}, label)); steps.append(li); return { ok: () => { li.firstChild.textContent = "✓"; }, fail: () => { li.firstChild.textContent = "✕"; } }; };
  body.replaceChildren(h("p", {}, "Publishing…"), steps);
  foot.replaceChildren(h("span", { class: "grow" }), h("button", { class: "btn", type: "button", onclick: () => $("#review").close() }, "Close"));
  const s1 = step("Saving to GitHub");
  try {
    let commitSha = null;
    for (let attempt = 0; attempt < 2 && !commitSha; attempt++) {
      const head = (await gh(repo(`/git/ref/heads/${BRANCH}`))).object.sha;
      for (const [pg] of files) {
        let remoteSha = null;
        try { remoteSha = (await gh(repo(`/contents/${encPath(pg.path)}?ref=${head}`))).sha; } catch (e) { if (e.status !== 404) throw e; }
        if (remoteSha !== pg.baseSha && !force) { s1.fail(); conflict(pg, st, message, body, foot); return; }
      }
      const entries = files.map(([pg, t]) => ({ path: pg.path, mode: "100644", type: "blob", content: t }));
      const imgs = [...new Set(files.flatMap(([pg, t]) => usedImages(t, pg.path)))];
      for (const p of imgs) {
        const img = pendingImages.get(p);
        const blob = await gh(repo("/git/blobs"), { method: "POST", body: { content: img.b64, encoding: "base64" } });
        entries.push({ path: p, mode: "100644", type: "blob", sha: blob.sha });
      }
      const base = await gh(repo(`/git/commits/${head}`));
      const tree = await gh(repo("/git/trees"), { method: "POST", body: { base_tree: base.tree.sha, tree: entries } });
      const commit = await gh(repo("/git/commits"), { method: "POST", body: { message, tree: tree.sha, parents: [head] } });
      try { await gh(repo(`/git/refs/heads/${BRANCH}`), { method: "PATCH", body: { sha: commit.sha, force: false } }); commitSha = commit.sha; }
      catch (e) { if (e.status !== 422 || attempt) throw e; /* someone else pushed just now: try again on top */ }
    }
    s1.ok();
    // The pages as GitHub now has them are our new starting point
    for (const [pg, t] of files) {
      const f = await getFile(pg.path, commitSha);
      for (const p of usedImages(t, pg.path)) { if (imageNames.has(bookOf(p))) imageNames.get(bookOf(p)).push(p.split("/").pop()); pendingImages.delete(p); }
      pg.origText = f.text; pg.baseSha = f.sha;
      store.del(DRAFT_KEY + pg.path);
    }
    renderPageList();
    if (cur === page) { saveDraft(); }
    const s2 = step("Rebuilding the site (usually 1–2 minutes)");
    build = { sha: commitSha, state: "building", url: `https://github.com/${OWNER}/${REPO}/actions` };
    updateStatus();
    body.append(h("p", { class: "help" }, "You can close this and keep editing; the status at the top shows when it’s live."));
    trackBuild(commitSha, s2, body, page.path);
  } catch (err) {
    s1.fail();
    const why = err.status === 403 || err.status === 404 ? "this token isn’t allowed to save to the repository. Make a token with Contents set to “Read and write” and sign in again" : err.message;
    body.append(h("p", { class: "warnbox" }, "Publishing failed: " + why + ". Your changes are still saved in this browser."));
  }
}

function conflict(page, st, message, body, foot) {
  body.append(h("div", { class: "warnbox" }, (page === cur ? "This page" : `The ${twinName()}`) + " was changed on GitHub after you opened this page (perhaps in GitHub’s own editor). Publishing now would replace those changes with your version."));
  foot.replaceChildren(
    h("a", { class: "btn", href: `https://github.com/${OWNER}/${REPO}/commits/${BRANCH}/${page.path}`, target: "_blank", rel: "noopener" }, "See the GitHub changes ↗"),
    h("span", { class: "grow" }),
    h("button", { class: "btn", type: "button", onclick: () => $("#review").close() }, "Cancel"),
    h("button", { class: "btn primary", type: "button", onclick: () => doPublish(st, message, body, foot, true) }, "Replace them with mine"));
}

async function trackBuild(sha, stepUi, body, path) {
  const started = Date.now();
  for (;;) {
    await new Promise(r => setTimeout(r, 6000));
    if (!build || build.sha !== sha) return;
    try {
      const runs = (await gh(repo(`/actions/runs?branch=${BRANCH}&per_page=5`))).workflow_runs || [];
      const mine = runs.find(r => r.head_sha === sha);
      const newest = runs[0];
      // A newer push cancels this build and its build includes these changes too
      const run = mine && mine.conclusion === "cancelled" && newest ? newest : mine;
      if (run) {
        build.url = run.html_url;
        if (run.status === "completed") {
          if (run.conclusion === "success") {
            build.state = "done"; stepUi.ok();
            body.append(h("p", {}, "Live. ", h("a", { href: pageUrl(path), target: "_blank", rel: "noopener" }, "View the page ↗"), " (it can take another minute to appear)."));
            toast("Your changes are live on the site.");
          } else {
            build.state = "failed"; stepUi.fail();
            body.append(h("p", { class: "warnbox" }, "The site build failed, so the live site hasn’t changed. ", h("a", { href: run.html_url, target: "_blank", rel: "noopener" }, "See what went wrong ↗")));
            toast("The site build failed. See the status at the top.");
          }
          updateStatus(); return;
        }
      }
    } catch (e) {
      if (e.status === 401 || e.status === 403 || e.status === 404) {
        // The token can't see the site's builds; the site still rebuilds on its own
        build.state = "done"; stepUi.ok();
        body.append(h("p", {}, "Saved. The site updates by itself in a minute or two. (This token can’t see build progress; give it Actions: Read-only to see it here.)"));
        updateStatus(); return;
      }
    }
    if (Date.now() - started > 15 * 60 * 1000) { build.state = "done"; updateStatus(); return; }
  }
}

/* =================================================================== help */

function showHelp() {
  const rows = [["Enter", "New paragraph"], ["Shift+Enter", "Line break inside a paragraph"], ["Backspace at the start", "Join with the paragraph above"],
    ["Ctrl+B / Ctrl+I", "Bold / italic"], ["Ctrl+K", "Link"], ["Ctrl+Shift+F", "Footnote at the cursor"], ["Ctrl+Z / Ctrl+Shift+Z", "Undo / redo"],
    ["Click a footnote number", "See, edit or remove the note"], ["Ctrl-click a link", "Open it"], ["⋮⋮ left of a paragraph", "Move, change or delete it"], ["+ below a paragraph", "Add a paragraph, Take heading, rating, quote, list or image"],
    ["Entangle (toolbar)", "Link the paragraph to the same paragraph in the other version, so edits change both. Only for paragraphs that are identical in both"],
    ["+ between two entangled paragraphs", "Add an entangled paragraph or image to both versions"]];
  $("#review-inner").replaceChildren(
    h("div", { class: "dlg-head" }, h("h2", {}, "Keyboard shortcuts")),
    h("div", { class: "dlg-body" }, h("table", { class: "help-table", style: "width:100%;border-collapse:collapse;font-family:var(--ui);font-size:.85rem" },
      rows.map(([k, v]) => h("tr", {}, h("td", { style: "padding:.4rem .8rem .4rem 0;white-space:nowrap;font-weight:600;vertical-align:top" }, k), h("td", { style: "padding:.4rem 0;color:var(--muted)" }, v))))),
    h("div", { class: "dlg-foot" }, h("span", { style: "flex:1" }), h("button", { class: "btn", type: "button", onclick: () => $("#review").close() }, "Close")));
  $("#review").showModal();
}

// For tests
window.__editor = { serialize: () => serialize(), get cur() { return cur; }, get twin() { return twin; }, MD };
})();
