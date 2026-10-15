/* Reads and writes the Markdown in the book's .qmd files, for the web editor (editor.js).
   Everything the editor can't show as formatted text is kept as Markdown source, so a page that
   is opened and saved without edits comes back byte-for-byte identical.

   A page is: front matter, then blocks separated by blank lines, then the footnote texts
   ([^label]: ...) at the bottom. Text inside paragraphs, headings, quotes and list items is
   parsed into "inline nodes":
     {t:"text", v}          plain text (escapes removed)
     {t:"lit", c}           a punctuation character the source escaped although it didn't have to,
                            e.g. \' (a straight apostrophe on the site) or the first dot of \...
     {t:"em"|"strong"|"sup"|"sub", c:[nodes]}
     {t:"link", href, c}    href is the raw text between the parentheses
     {t:"code", v, ticks}
     {t:"fn", label}        footnote marker [^label]
     {t:"br"}               hard line break (backslash at the end of a line)
     {t:"raw", src}         anything else (inline math, images, [spans]{.x}, HTML), kept as source */
(function (root) {
"use strict";

// Characters that are always written with a backslash. In the book's source, pandoc escaped
// these whenever they were meant literally.
const ALWAYS = new Set(["\\", "*", "_", "[", "]", "$", "^", "`"]);
const PUNCT = /^[!-\/:-@\[-`{-~]$/;

/* ------------------------------------------------------------------ inline: parse */

function parseInline(s) {
  const p = { s, i: 0, closed: false };
  return seq(p, null);
}

function runLength(s, i, ch) { let j = i; while (s[j] === ch) j++; return j - i; }

// Index of the "]" that closes the "[" at i, or -1.
function matchBracket(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "`") { const r = runLength(s, j, "`"); const k = s.indexOf("`".repeat(r), j + r); if (k > 0) { j = k + r - 1; continue; } }
    if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return j;
  }
  return -1;
}

// Index of the ")" that closes the "(" at i, or -1.
function matchParen(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "\n") return -1;
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return j;
  }
  return -1;
}

function matchBrace(s, i) { const j = s.indexOf("}", i); return j > 0 && !s.slice(i, j).includes("\n") ? j : -1; }

function seq(p, closer) {
  const out = [];
  let buf = "";
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  const s = p.s;
  while (p.i < s.length) {
    const i = p.i, c = s[i];
    // Closing delimiters of the enclosing span
    if (closer && c === closer[0] && i > 0 && !/\s/.test(s[i - 1])) {
      const r = runLength(s, i, c);
      if (closer === "*" && (r === 1 || r === 3)) { flush(); p.i = i + 1; p.closed = true; return out; }
      if (closer === "**" && r >= 2) { flush(); p.i = i + 2; p.closed = true; return out; }
      if ((closer === "^" || closer === "~") && r === 1) { flush(); p.i = i + 1; p.closed = true; return out; }
    }
    if (c === "\\") {
      const n = s[i + 1];
      if (n === "\n") { flush(); out.push({ t: "br" }); p.i = i + 2; continue; }
      if (n === undefined) { flush(); out.push({ t: "br" }); p.i = i + 1; continue; }
      if (PUNCT.test(n)) {
        if (ALWAYS.has(n)) buf += n; else { flush(); out.push({ t: "lit", c: n }); }
        p.i = i + 2; continue;
      }
      buf += c; p.i = i + 1; continue;
    }
    if (c === "[") {
      const fn = /^\[\^([^\]\s]+)\](?!:)/.exec(s.slice(i, i + 200));
      if (fn) { flush(); out.push({ t: "fn", label: fn[1] }); p.i = i + fn[0].length; continue; }
      const j = matchBracket(s, i);
      if (j > 0 && s[j + 1] === "(") {
        const k = matchParen(s, j + 1);
        if (k > 0) {
          if (s[k + 1] === "{") { const e = matchBrace(s, k + 1); if (e > 0) { flush(); out.push({ t: "raw", src: s.slice(i, e + 1) }); p.i = e + 1; continue; } }
          flush();
          out.push({ t: "link", href: s.slice(j + 2, k), c: parseInline(s.slice(i + 1, j)) });
          p.i = k + 1; continue;
        }
      }
      if (j > 0 && s[j + 1] === "{") {
        const e = matchBrace(s, j + 1);
        if (e > 0) { flush(); out.push({ t: "raw", src: s.slice(i, e + 1) }); p.i = e + 1; continue; }
      }
      buf += c; p.i = i + 1; continue;
    }
    if (c === "!" && s[i + 1] === "[") {
      const j = matchBracket(s, i + 1);
      if (j > 0 && s[j + 1] === "(") {
        let k = matchParen(s, j + 1);
        if (k > 0) {
          if (s[k + 1] === "{") { const e = matchBrace(s, k + 1); if (e > 0) k = e; }
          flush(); out.push({ t: "raw", src: s.slice(i, k + 1) }); p.i = k + 1; continue;
        }
      }
      buf += c; p.i = i + 1; continue;
    }
    if (c === "*") {
      const r = runLength(s, i, "*");
      const next = s[i + r];
      if (next !== undefined && !/\s/.test(next)) {
        const kind = r >= 2 ? "strong" : "em";
        const width = r >= 2 ? 2 : 1;
        p.i = i + width;
        const inner = seq(p, width === 2 ? "**" : "*");
        if (p.closed && inner.length) { flush(); out.push({ t: kind, c: inner }); p.closed = false; continue; }
        p.closed = false;
      }
      // Asterisks that don't make emphasis show on the site as asterisks
      flush(); out.push({ t: "raw", src: "*".repeat(r) }); p.i = i + r; continue;
    }
    if (c === "^" || (c === "~" && s[i + 1] !== "~")) {
      if (s[i + 1] !== undefined && !/\s/.test(s[i + 1])) {
        p.i = i + 1;
        const inner = seq(p, c);
        if (p.closed && inner.length) { flush(); out.push({ t: c === "^" ? "sup" : "sub", c: inner }); p.closed = false; continue; }
        p.closed = false;
      }
      buf += c; p.i = i + 1; continue;
    }
    if (c === "~") {
      const k = s.indexOf("~~", i + 2);
      if (k > 0) { flush(); out.push({ t: "raw", src: s.slice(i, k + 2) }); p.i = k + 2; continue; }
      buf += c; p.i = i + 1; continue;
    }
    if (c === "`") {
      const r = runLength(s, i, "`");
      const k = s.indexOf("`".repeat(r), i + r);
      if (k > 0) { flush(); out.push({ t: "code", v: s.slice(i + r, k), ticks: r }); p.i = k + r; continue; }
      buf += c; p.i = i + 1; continue;
    }
    if (c === "$" && s[i + 1] && !/[\s$]/.test(s[i + 1])) {
      let k = i + 1;
      while ((k = s.indexOf("$", k)) > 0 && (s[k - 1] === "\\" || /\s/.test(s[k - 1]))) k++;
      if (k > 0 && !/[0-9]/.test(s[k + 1] || "")) { flush(); out.push({ t: "raw", src: s.slice(i, k + 1) }); p.i = k + 1; continue; }
      buf += c; p.i = i + 1; continue;
    }
    if (c === "<") {
      const m = /^(<!--[\s\S]*?-->|<(?:https?:|mailto:)[^>\s]+>|<\/?[A-Za-z][^<>]*>)/.exec(s.slice(i, i + 2000));
      if (m) { flush(); out.push({ t: "raw", src: m[0] }); p.i = i + m[0].length; continue; }
      buf += c; p.i = i + 1; continue;
    }
    buf += c; p.i = i + 1;
  }
  flush();
  p.closed = false;
  return out;
}

/* ------------------------------------------------------------------ inline: write */

// Display characters (smart quotes, dashes, ellipsis, non-breaking spaces) back to source.
const FROM_DISPLAY = { "‘": "'", "’": "'", "“": '"', "”": '"', "—": "---", "–": "--", "…": "...", " ": " " };

function escText(v, st) {
  let o = "";
  for (let k = 0; k < v.length; k++) {
    const ch = v[k];
    if (st.lineStart) {
      // Text at the start of a line that would otherwise begin a heading, quote or list
      const rest = v.slice(k);
      if (/^[#>]/.test(rest)) { o += "\\" + ch; st.lineStart = false; continue; }
      if (/^[-+] /.test(rest)) { o += "\\" + ch; st.lineStart = false; continue; }
      const num = /^(\d+)([.)]) /.exec(rest);
      if (num) { o += num[1] + "\\" + num[2]; k += num[0].length - 2; st.lineStart = false; continue; }
    }
    let w;
    if (FROM_DISPLAY[ch] !== undefined) w = FROM_DISPLAY[ch];
    else if (ALWAYS.has(ch)) w = "\\" + ch;
    else if (ch === "<" && /[A-Za-z\/!?]/.test(v[k + 1] || "")) w = "\\<";
    else if (ch === " " && st.inScript) w = "\\ ";
    else w = ch;
    o += w;
    st.lineStart = ch === "\n";
  }
  return o;
}

function toMd(nodes, st) {
  st = st || { lineStart: false, inScript: false };
  let o = "";
  nodes.forEach((n, idx) => {
    switch (n.t) {
      case "text": o += escText(n.v, st); break;
      case "lit": o += "\\" + n.c; st.lineStart = false; break;
      case "em": st.lineStart = false; o += "*" + toMd(n.c, st) + "*"; break;
      case "strong": st.lineStart = false; o += "**" + toMd(n.c, st) + "**"; break;
      case "sup": case "sub": {
        const d = n.t === "sup" ? "^" : "~", was = st.inScript;
        st.lineStart = false; st.inScript = true;
        o += d + toMd(n.c, st) + d; st.inScript = was; break;
      }
      case "code": { const t = "`".repeat(n.ticks || 1); o += t + n.v + t; st.lineStart = false; break; }
      case "link": st.lineStart = false; o += "[" + toMd(n.c, st) + "](" + n.href + ")"; break;
      case "fn": o += "[^" + n.label + "]"; st.lineStart = false; break;
      case "raw": o += n.src; st.lineStart = false; break;
      case "br": o += idx === nodes.length - 1 ? "\\" : "\\\n"; st.lineStart = idx !== nodes.length - 1; break;
    }
  });
  return o;
}

const MARKS = new Set(["em", "strong", "sup", "sub"]);

// Tidy nodes that came from the browser's editing: merge neighbours, drop empty formatting,
// move spaces out of *emphasis* (Markdown doesn't allow "*word *").
function normalize(nodes, inside) {
  let out = [];
  for (let n of nodes) {
    if (n.c) n = Object.assign({}, n, { c: normalize(n.c, n.t) });
    if (MARKS.has(n.t)) {
      if (n.t === inside) { out.push(...n.c); continue; }
      const txt = plainText(n.c);
      if (!n.c.length || (!txt.trim() && !n.c.some(x => x.t === "fn" || x.t === "raw"))) { out.push(...n.c); continue; }
      if (n.t === "em" || n.t === "strong") {
        const c = n.c.slice();
        let lead = "", trail = "";
        if (c[0].t === "text") { const m = /^\s+/.exec(c[0].v); if (m) { lead = m[0]; c[0] = { t: "text", v: c[0].v.slice(lead.length) }; if (!c[0].v) c.shift(); } }
        const L = c[c.length - 1];
        if (L && L.t === "text") { const m = /\s+$/.exec(L.v); if (m) { trail = m[0]; c[c.length - 1] = { t: "text", v: L.v.slice(0, -trail.length) }; if (!c[c.length - 1].v) c.pop(); } }
        if (lead) out.push({ t: "text", v: lead });
        out.push(Object.assign({}, n, { c }));
        if (trail) out.push({ t: "text", v: trail });
        continue;
      }
    }
    if (n.t === "link" && !n.c.length) continue;
    out.push(n);
  }
  // merge neighbours
  const merged = [];
  for (const n of out) {
    const prev = merged[merged.length - 1];
    if (prev && n.t === "text" && prev.t === "text") prev.v += n.v;
    else if (prev && MARKS.has(n.t) && prev.t === n.t) prev.c = normalize(prev.c.concat(n.c), inside);
    else if (prev && n.t === "link" && prev.t === "link" && prev.href === n.href) prev.c = normalize(prev.c.concat(n.c), inside);
    else merged.push(n.t === "text" ? { t: "text", v: n.v } : n);
  }
  return merged.filter(n => n.t !== "text" || n.v);
}

function plainText(nodes) {
  return nodes.map(n => n.t === "text" ? n.v : n.t === "lit" ? n.c : n.c ? plainText(n.c) : n.t === "code" ? n.v : "").join("");
}

/* ------------------------------------------------------------------ display text */

// What readers see: straight quotes become curly, --- and -- become dashes, ... an ellipsis.
// prev is the character before this text, for deciding between opening and closing quotes.
function smart(v, prev) {
  v = v.replace(/---/g, "—").replace(/--/g, "–").replace(/\.\.\./g, "…");
  let o = "";
  for (const ch of v) {
    if (ch === "'" || ch === '"') {
      const open = !prev || /[\s(\[{—–\/“‘-]/.test(prev);
      o += ch === "'" ? (open ? "‘" : "’") : (open ? "“" : "”");
    } else o += ch;
    prev = ch;
  }
  return o;
}

/* ------------------------------------------------------------------ blocks */

const RATING = /^\[Rating: ([^\]]*)\]\{\.rating \.tier-([a-z]+)\}$/;
const LIST_ITEM = /^((?:\d+[.)]|[-*+])[ \t]+)(.*)$/;

function parseImage(line) {
  let m = /^\[(!\[.*\]\(.*?\)(?:\{[^{}]*\})?)\]\(([^()\s]+)\)$/.exec(line);
  let href = null;
  if (m) { href = m[2]; line = m[1]; }
  m = /^!\[(.*?)\]\(([^()\s]+)\)(\{([^{}]*)\})?$/.exec(line);
  if (!m) return null;
  const attrs = [];
  if (m[4] !== undefined) {
    const re = /\s*([A-Za-z][\w-]*)="([^"]*)"|\s*(\S+)/g; let a;
    while ((a = re.exec(m[4]))) attrs.push(a[1] ? { k: a[1], v: a[2] } : { raw: a[3] });
  }
  return { alt: m[1], src: m[2], attrs, hasBraces: m[3] !== undefined, href };
}

function imageMd(b) {
  const a = b.attrs.map(x => x.raw !== undefined ? x.raw : `${x.k}="${x.v}"`).join(" ");
  const img = `![${b.alt}](${b.src})` + (a || b.hasBraces ? `{${a}}` : "");
  return b.href ? `[${img}](${b.href})` : img;
}

function getAttr(b, k) { const a = b.attrs.find(x => x.k === k); return a ? a.v : ""; }
function setAttr(b, k, v) {
  const a = b.attrs.find(x => x.k === k);
  if (a && v) a.v = v; else if (a) b.attrs.splice(b.attrs.indexOf(a), 1); else if (v) b.attrs.push({ k, v });
}

let uid = 0;
const unit = (md, extra) => Object.assign({ id: ++uid, md }, extra || {});

function classify(raw) {
  const lines = raw.split("\n"), f = lines[0];
  let m;
  if (lines.length === 1) {
    if ((m = /^(#{1,6})[ \t]+(.*?)((?:[ \t]+\{[^{}]*\})?)$/.exec(f))) return { kind: "heading", level: m[1].length, attrs: m[3], units: [unit(m[2])] };
    if ((m = RATING.exec(f))) return { kind: "rating", label: m[1], tier: m[2] };
    const img = parseImage(f);
    if (img) return Object.assign({ kind: "image" }, img);
  }
  if (/^\$\$/.test(f)) return { kind: "raw", sub: "math" };
  if (/^(\+[-=]|\|)/.test(f)) return { kind: "raw", sub: "table" };
  if (/^<!--/.test(f) && /-->\s*$/.test(raw)) return { kind: "raw", sub: "comment" };
  if (/^(:::|```|<|[ \t])/.test(f)) return { kind: "raw", sub: "code" };
  if (lines.every(l => /^>/.test(l))) {
    const paras = [[]];
    for (const l of lines) { const t = l.replace(/^> ?/, ""); if (t === "") paras.push([]); else paras[paras.length - 1].push(t); }
    if (paras.some(p => !p.length || /^(>|#|[-+*] |\d+[.)] )/.test(p[0]))) return { kind: "raw", sub: "code" };
    return { kind: "quote", units: paras.map(p => unit(p.join("\n"))) };
  }
  if (LIST_ITEM.test(f)) {
    const items = []; let cur = null, blank = false;
    for (const l of lines) {
      const im = /^\s/.test(l) ? null : LIST_ITEM.exec(l);
      if (im) { cur = { marker: im[1], units: [unit(im[2], { inds: [""] })] }; items.push(cur); blank = false; continue; }
      if (l.trim() === "") { if (blank) return { kind: "raw", sub: "code" }; blank = true; continue; }
      const ind = /^[ \t]*/.exec(l)[0];
      if (!cur || (blank && !ind) || /^(>|[-+*] |\d+[.)] )/.test(l.slice(ind.length))) return { kind: "raw", sub: "code" };
      if (blank) { cur.units.push(unit(l.slice(ind.length), { inds: [ind] })); blank = false; continue; }
      const u = cur.units[cur.units.length - 1];
      u.md += "\n" + l.slice(ind.length); u.inds.push(ind);
    }
    if (blank) return { kind: "raw", sub: "code" };
    return { kind: "list", items };
  }
  return { kind: "para", units: [unit(raw)] };
}

// Markdown for a block from its parts. unitMd(u) gives a text unit's current Markdown.
function blockMd(b, unitMd) {
  unitMd = unitMd || (u => u.md);
  switch (b.kind) {
    case "para": return unitMd(b.units[0]);
    case "heading": return "#".repeat(b.level) + " " + unitMd(b.units[0]) + b.attrs;
    case "rating": return `[Rating: ${b.label}]{.rating .tier-${b.tier}}`;
    case "image": return imageMd(b);
    case "quote": return b.units.map(u => unitMd(u).split("\n").map(l => "> " + l).join("\n")).join("\n>\n");
    case "list": return b.items.map(it => it.units.map((u, k) => {
      const def = " ".repeat(it.marker.length);
      return unitMd(u).split("\n").map((l, j) => {
        if (k === 0 && j === 0) return it.marker + l;
        const inds = k === 0 ? u.inds.slice(1) : u.inds, jj = k === 0 ? j - 1 : j;
        return (inds[jj] !== undefined ? inds[jj] : inds.length ? inds[inds.length - 1] : def) + l;
      }).join("\n");
    }).join("\n\n")).join("\n");
    default: return b.raw;
  }
}

function makeBlock(raw, pre) {
  let b = classify(raw);
  if (b.kind !== "raw" && blockMd(b) !== raw) b = { kind: "raw", sub: "code" };
  b.raw = raw; b.pre = pre; b.id = ++uid;
  return b;
}

function parseBlocks(text) {
  const L = text.split("\n"), blocks = [];
  let i = 0;
  while (i < L.length) {
    const pre = [];
    while (i < L.length && L[i].trim() === "") pre.push(L[i++]);
    if (i >= L.length) return { blocks, end: pre };
    const f = L[i];
    let j = i;
    if (/^:::/.test(f)) {
      let depth = 0;
      for (; j < L.length; j++) { if (/^:::+\s*\S/.test(L[j])) depth++; else if (/^:::+\s*$/.test(L[j]) && --depth === 0) break; }
      j = Math.min(j + 1, L.length);
    } else if (/^```/.test(f)) {
      j++; while (j < L.length && !/^```\s*$/.test(L[j])) j++; j = Math.min(j + 1, L.length);
    } else if (/^\$\$/.test(f) && !(f.length > 4 && /\$\$\s*$/.test(f))) {
      j++; while (j < L.length && !/\$\$\s*$/.test(L[j])) j++; j = Math.min(j + 1, L.length);
    } else if (/^<!--/.test(f) && !f.includes("-->")) {
      while (j < L.length && !L[j].includes("-->")) j++; j = Math.min(j + 1, L.length);
    } else {
      while (j < L.length && L[j].trim() !== "") j++;
    }
    // A list item can continue after a blank line with indented paragraphs
    if (LIST_ITEM.test(f)) {
      for (;;) {
        let k = j; while (k < L.length && L[k].trim() === "") k++;
        if (k < L.length && k > j && /^( {2,}|\t)\S/.test(L[k])) { j = k; while (j < L.length && L[j].trim() !== "") j++; }
        else break;
      }
    }
    blocks.push(makeBlock(L.slice(i, j).join("\n"), pre));
    i = j;
  }
  return { blocks, end: [] };
}

const NOTE_DEF = /^\[\^([^\]]+)\]:[ \t]?(.*)$/;

function parseDoc(text) {
  const crlf = text.includes("\r\n");
  if (crlf) text = text.replace(/\r\n/g, "\n");
  const fmm = /^---\n[\s\S]*?\n---\n/.exec(text);
  const fm = fmm ? fmm[0] : "";
  let body = text.slice(fm.length);
  const tail = /\n*$/.exec(body)[0];
  body = body.slice(0, body.length - tail.length);
  const lines = body.split("\n");
  // Footnote texts: the run of [^x]: lines (with indented continuations) at the end
  let k = lines.length;
  while (k > 0 && (NOTE_DEF.test(lines[k - 1]) || /^( {4}|\t)/.test(lines[k - 1]) || lines[k - 1].trim() === "")) k--;
  while (k < lines.length && !NOTE_DEF.test(lines[k])) k++;
  const notes = [];
  for (const l of lines.slice(k)) {
    const m = NOTE_DEF.exec(l);
    if (m) notes.push({ label: m[1], md: m[2] });
    else if (notes.length && l.trim()) notes[notes.length - 1].md += "\n" + l.replace(/^( {4}|\t)/, "");
  }
  const notesRaw = lines.slice(k).join("\n");
  const pb = parseBlocks(lines.slice(0, k).join("\n"));
  const title = parseTitle(fm);
  const doc = { crlf, fm, title, blocks: pb.blocks, end: pb.end, notes, notesRaw, tail, notesOrig: null };
  doc.notesOrig = notesSection(doc, docBodyMd(doc), notes);
  return doc;
}

function parseTitle(fm) {
  const m = /^title:[ \t]*(.*)$/m.exec(fm);
  if (!m) return null;
  let v = m[1].trim(), style = "plain";
  if (/^'.*'$/.test(v)) { style = "single"; v = v.slice(1, -1).replace(/''/g, "'"); }
  else if (/^".*"$/.test(v)) { style = "double"; v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\"); }
  return { text: v, orig: v, line: m[0], style };
}

function titleLine(t) {
  const v = t.text;
  if (t.style === "double") return `title: "${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  if (t.style === "plain" && !/[:#'"\[\]{}&*!|>%@`,]/.test(v) && v.trim() === v) return `title: ${v}`;
  return `title: '${v.replace(/'/g, "''")}'`;
}

// Joins blocks back into text. bmd(b) gives a block's current Markdown (default: its source).
function docBodyMd(doc, bmd) {
  bmd = bmd || (b => b.raw);
  const out = [];
  doc.blocks.forEach(b => { out.push(...b.pre, bmd(b)); });
  out.push(...doc.end);
  return out.join("\n");
}

// The footnote texts, in the order their markers appear; texts with no marker are left out.
function notesSection(doc, bodyMd, notes) {
  const byLabel = new Map(notes.map(n => [n.label, n]));
  const seen = [];
  const re = /\[\^([^\]\s]+)\](?!:)/g; let m;
  while ((m = re.exec(bodyMd))) if (byLabel.has(m[1]) && !seen.includes(m[1])) seen.push(m[1]);
  return seen.map(l => `[^${l}]: ` + byLabel.get(l).md.split("\n").join("\n    ")).join("\n");
}

function serializeDoc(doc, bmd) {
  let body = docBodyMd(doc, bmd);
  let fm = doc.fm;
  if (doc.title && doc.title.text !== doc.title.orig) fm = fm.replace(doc.title.line, titleLine(doc.title));
  let notes = notesSection(doc, body, doc.notes);
  if (notes === doc.notesOrig) notes = doc.notesRaw;
  let text;
  // doc.end holds the blank lines between the last block and the notes
  if (notes) text = fm + body + (doc.notesRaw ? "\n" : body.endsWith("\n") ? "\n" : "\n\n") + notes;
  else text = fm + body.replace(/\n+$/, "");
  text += doc.tail;
  return doc.crlf ? text.replace(/\n/g, "\r\n") : text;
}

function shortLink(url) {
  let shown = url.replace(/^https?:\/\/(www\.)?/, "");
  try { shown = decodeURIComponent(shown); } catch (e) { /* keep as is */ }
  if (shown.length > 70) shown = shown.slice(0, 67) + "...";
  shown = shown.replace(/([_*\[\]\\`<>])/g, "\\$1");
  return `[${shown}](${url.replace(/ /g, "%20")})`;
}

// A new footnote's Markdown from what was typed or pasted: bare web addresses become short links,
// as in tools/convert.py.
function noteFromInput(text) {
  text = text.trim();
  const parts = text.split(/(https?:\/\/[^\s<>]+)/);
  return parts.map((p, i) => i % 2 ? shortLink(p) : toMd([{ t: "text", v: p }])).join("");
}

const API = { parseInline, toMd, normalize, plainText, smart, parseDoc, serializeDoc, blockMd, classify, makeBlock,
  parseBlocks, docBodyMd, imageMd, getAttr, setAttr, shortLink, noteFromInput, unit, RATING, titleLine };
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.MD = API;
})(this);
