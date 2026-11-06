'use strict';
// A small native interface toolkit, painted with Skia: panels, buttons, lists, text fields, dropdowns, sliders, scrolling, menus, dialogs.
// No HTML and no CSS: a tree of elements built by code, one theme written in JavaScript, its own layout. The Creation Tool's logic talks to it
// with the same few calls it always made (create an element, append it, set its text, listen for a click), so that logic stays as it was.
const { Canvas, Image } = require('skia-canvas');
const C = { frame: '#cfcabd', face: '#e3ded2', pane: '#e6e1d5', line: '#8f8c84', line2: '#aba9a5', text: '#282726', dim: '#54524c', hi: '#e8d49c', hib: '#bea66f', on: '#dcc38c', onb: '#ab905d', paper: '#fbf6e7', cap: '#6c6860', btn: '#dcd8ca', btnb: '#9a978d', bad: '#984a4b', title: '#4e4b45', menu: '#e3dfd1', drop: '#f7f2e3', field: '#fdfaf0' };
const FONT = 'Tahoma, "Segoe UI", sans-serif';
const tt = { t: (s) => (globalThis.__uiTranslate ? globalThis.__uiTranslate(s) : s) };   // the language hook
// ---------------------------------------------------------------- selectors
const parseSel = (s) => s.split(',').map((g) => g.trim().split(/\s+/).map((part) => { const c = { cls: [], attr: [] }; part.replace(/^[a-zA-Z0-9]+/, (m) => { c.tag = m.toUpperCase(); return ''; }).replace(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="?([^"\]]*)"?)?\]/g, (m, id, k, a, v) => { if (id) c.id = id; if (k) c.cls.push(k); if (a) c.attr.push([a, v]); return ''; }); return c; }));
const hit1 = (n, c) => n.nodeType === 1 && (!c.tag || n.tagName === c.tag) && (!c.id || n.id === c.id) && c.cls.every((k) => n.classList.contains(k)) && c.attr.every(([a, v]) => (a.startsWith('data-') ? (n.dataset[a.slice(5)] !== undefined && (v === undefined || String(n.dataset[a.slice(5)]) === v)) : (v === undefined ? n.getAttribute(a) != null : String(n.getAttribute(a)) === v)));
const hitChain = (n, ch) => { if (!hit1(n, ch[ch.length - 1])) return false; let i = ch.length - 2, p = n.parentNode; while (i >= 0 && p) { if (hit1(p, ch[i])) i--; p = p.parentNode; } return i < 0; };
const matches = (n, s) => parseSel(s).some((ch) => hitChain(n, ch));
const walk = (n, f) => { for (const c of n.children || []) { if (c.nodeType === 1) { f(c); walk(c, f); } } };
// ---------------------------------------------------------------- elements
const base = {
  addEventListener(t, f) { (this._on || (this._on = {}))[t] = (this._on[t] || []).concat(f); }, removeEventListener(t, f) { if (this._on && this._on[t]) this._on[t] = this._on[t].filter((x) => x !== f); },
  dispatchEvent(e) { e.target = e.target || this; e.currentTarget = this; for (const f of (this._on && this._on[e.type]) || []) f.call(this, e); const h = this['on' + e.type]; if (h) h.call(this, e); return true; },
  getBoundingClientRect() { const r = this._abs ? this._abs() : { x: 0, y: 0 }; return { left: r.x, top: r.y, x: r.x, y: r.y, width: this._w || 0, height: this._h || 0, right: r.x + (this._w || 0), bottom: r.y + (this._h || 0) }; },
  _abs() { let x = this._x || 0, y = this._y || 0; for (let p = this.parentNode; p; p = p.parentNode) if (p._scroller) y -= p.scrollTop || 0; return { x, y }; },
  remove() { const p = this.parentNode; if (p) p.removeChild(this); },
  matches(s) { return matches(this, s); }, closest(s) { for (let n = this; n; n = n.parentNode) if (n.nodeType === 1 && matches(n, s)) return n; return null; },
  focus() { UI.focus(this); }, blur() { if (UI.focused === this) UI.focus(null); }, click() { UI.fire(this, 'click', {}); },
  getAttribute(a) { return a === 'style' ? this.style.cssText : this._attr && a in this._attr ? this._attr[a] : (a === 'title' || a === 'placeholder') && this[a] ? this[a] : null; }, setAttribute(a, v) { if (a === 'style') this.style.cssText = v; else if (a.startsWith('data-')) this.dataset[a.slice(5)] = v; else if (a === 'class') this.className = v; else { (this._attr || (this._attr = {}))[a] = v; if (a in this) this[a] = v; } UI.dirty = true; }, hasAttribute(a) { return this.getAttribute(a) != null; }, removeAttribute(a) { if (this._attr) delete this._attr[a]; },
  get clientWidth() { return Math.round(this._w || 0); }, get clientHeight() { return Math.round(this._h || 0); }, get offsetWidth() { return Math.round(this._w || 0); }, get offsetHeight() { return Math.round(this._h || 0); },
  scrollIntoView() { for (let p = this.parentNode; p; p = p.parentNode) if (p._scroller) { const top = (this._y || 0) - p._y; if (top < p.scrollTop) p.scrollTop = top; else if (top + this._h > p.scrollTop + p._h) p.scrollTop = top + this._h - p._h; return; } },
};
const classes = (n) => ({ add(...k) { for (const c of k) n._cls.add(c); UI.dirty = true; }, remove(...k) { for (const c of k) n._cls.delete(c); UI.dirty = true; }, contains: (k) => n._cls.has(k), toggle(k, f) { const on = f === undefined ? !n._cls.has(k) : !!f; if (on) n._cls.add(k); else n._cls.delete(k); UI.dirty = true; return on; } });
const styleOf = () => { const s = { cssText: '' }; return s; };
const defProps = { id: '', title: '', placeholder: '', type: '', min: '', max: '', step: '', href: '', download: '', rows: 2, colSpan: 1, selected: false, disabled: false, checked: false, name: '', htmlFor: '', onclick: null, oninput: null, onchange: null, onmousedown: null, onmouseenter: null, onmouseleave: null, onkeydown: null, open: false, scrollTop: 0 };
class El {
  constructor(tag) { this.nodeType = 1; this.tagName = this.nodeName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.dataset = {}; this.style = styleOf(); this._cls = new Set(); this.classList = classes(this); Object.assign(this, defProps); this._value = ''; this._caret = 0; }
  get childNodes() { return this.children; } get firstChild() { return this.children[0] || null; } get lastChild() { return this.children[this.children.length - 1] || null; } get firstElementChild() { return this.children.find((c) => c.nodeType === 1) || null; } get nextSibling() { const k = this.parentNode ? this.parentNode.children : []; return k[k.indexOf(this) + 1] || null; } get parentElement() { return this.parentNode; } get options() { return this.children.filter((c) => c.tagName === 'OPTION'); } get ownerDocument() { return UI.document; }
  get className() { return [...this._cls].join(' '); } set className(v) { this._cls.clear(); for (const c of String(v).split(/\s+/)) if (c) this._cls.add(c); UI.dirty = true; }
  get textContent() { return this.children.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent || '')).join(''); } set textContent(v) { for (const c of this.children) c.parentNode = null; this.children = []; const s = v == null ? '' : String(v); if (s) this.append(s); UI.dirty = true; }
  get innerText() { return this.textContent; } set innerText(v) { this.textContent = v; }
  get innerHTML() { return ''; } set innerHTML(v) { this.textContent = ''; if (v) this.insertAdjacentHTML('beforeend', v); }
  // the few bits of marked-up text the tool writes: paragraphs and headings, read as plain text with its emphasis dropped
  insertAdjacentHTML(pos, s) { const parts = String(s).split(/<\/(?:p|h\d|div|span)>/i); for (const raw of parts) { const tag = (/<(p|h2|h3|span)[\s>]/i.exec(raw) || [])[1] || 'p', cls = /class="([^"]+)"/.exec(raw), t = raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(); if (!t && !/<h2/i.test(raw)) continue; const e = new El(tag.toLowerCase()); if (cls) e.className = cls[1]; if (t) e.textContent = t; this.append(e); } }
  append(...k) { for (let c of k) { if (c == null) continue; if (typeof c !== 'object') c = new Text(String(c)); if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); } UI.dirty = true; }
  appendChild(c) { this.append(c); return c; } prepend(c) { this.insertBefore(c, this.children[0] || null); }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; UI.dirty = true; if (UI.hover === c) UI.hover = null; } return c; }
  insertBefore(c, before) { if (typeof c !== 'object') c = new Text(String(c)); if (c.parentNode) c.parentNode.removeChild(c); const i = before ? this.children.indexOf(before) : -1; c.parentNode = this; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); UI.dirty = true; return c; }
  replaceChildren(...k) { this.textContent = ''; this.append(...k); }
  before(n) { this.parentNode.insertBefore(n, this); } after(n) { const k = this.parentNode.children; this.parentNode.insertBefore(n, k[k.indexOf(this) + 1] || null); }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  querySelector(s) { const g = parseSel(s); let r = null; const go = (n) => { for (const c of n.children || []) { if (r || c.nodeType !== 1) continue; if (g.some((ch) => hitChain(c, ch))) { r = c; return; } go(c); } }; go(this); return r; }
  querySelectorAll(s) { const g = parseSel(s), out = []; walk(this, (c) => { if (g.some((ch) => hitChain(c, ch))) out.push(c); }); return out; }
  get value() { if (this.tagName === 'SELECT') { const o = this.options.find((x) => x.selected) || this.options[0]; return o ? o.value : ''; } if (this.tagName === 'OPTION' && this._value === '') return this.textContent; return this._value; }
  set value(v) { if (this.tagName === 'SELECT') { const s = String(v); for (const o of this.options) o.selected = String(o.value) === s; } else { this._value = v == null ? '' : String(v); this._caret = this._value.length; } UI.dirty = true; }
  get selectedIndex() { return this.options.findIndex((x) => x.selected); } set selectedIndex(i) { this.options.forEach((o, k) => { o.selected = k === i; }); }
}
Object.defineProperties(El.prototype, Object.getOwnPropertyDescriptors(base));
class Text { constructor(s) { this.nodeType = 3; this.nodeValue = s; this.parentNode = null; this.nodeName = '#text'; } get textContent() { return this.nodeValue; } set textContent(v) { this.nodeValue = String(v); UI.dirty = true; } remove() { if (this.parentNode) this.parentNode.removeChild(this); } }
// canvases are real canvases that can also sit in the tree
for (const k of Object.getOwnPropertyNames(base)) { if (k === 'constructor') continue; Object.defineProperty(Canvas.prototype, k, Object.getOwnPropertyDescriptor(base, k)); }
Object.defineProperties(Canvas.prototype, { nodeType: { get: () => 1 }, tagName: { get: () => 'CANVAS' }, nodeName: { get: () => 'CANVAS' }, dataset: { get() { return this._ds || (this._ds = {}); } }, _cls: { get() { return this._cl || (this._cl = new Set()); } }, classList: { get() { return this._lst || (this._lst = classes(this)); } } });
Object.defineProperty(Canvas.prototype, 'className', { get() { return [...this._cls].join(' '); }, set(v) { this._cls.clear(); for (const c of String(v).split(/\s+/)) if (c) this._cls.add(c); } });

// ---------------------------------------------------------------- the look of each thing: what CSS did, as a function
const has = (n, k) => n._cls && n._cls.has(k), under = (n, s) => { for (let p = n.parentNode; p; p = p.parentNode) if (p.id === s || (p._cls && p._cls.has(s))) return true; return false; };
const INLINE = new Set(['SPAN', 'B', 'I', 'A', 'KBD', 'BUTTON', 'INPUT', 'SELECT', 'CANVAS', 'EM', 'STRONG', 'SMALL']);
const inlineOf = (n) => n.nodeType === 3 || INLINE.has(n.tagName) || n.tagName === 'LABEL' && has(n, 'inl');
const hidden = (n) => n.nodeType === 1 && (has(n, 'hidden') || n.style.display === 'none' || (has(n, 'mdrop') && !(n.parentNode && has(n.parentNode, 'open'))) || n.tagName === 'OPTION' || n.id === 'toast' && !has(n, 'show'));
const fontOf = (n) => { let sz = 11, w = ''; for (let p = n; p; p = p.parentNode) { if (p.nodeType !== 1) continue; if (p.tagName === 'H2') { sz = 14; w = 'bold '; break; } if (p.tagName === 'H3') { w = 'bold '; break; } if (p.tagName === 'B' || p.tagName === 'STRONG') w = 'bold '; if (has(p, 'small') || (p.parentNode && has(p.parentNode, 'tools'))) { sz = 10; } if (p.id === 'titlebar') { sz = 12; w = 'bold '; break; } if (has(p, 'caption')) { w = 'bold '; break; } if (has(p, 'on') && under(p, 'tabs')) w = 'bold '; if (p.tagName === 'BUTTON' && has(p, 'accent')) w = 'bold '; } return `${w}${sz}px ${FONT}`; };
const colorOf = (n) => { for (let p = n; p; p = p.parentNode) { if (p.nodeType !== 1) continue; if (p.id === 'titlebar' || has(p, 'caption')) return '#fbf6e7'; if (has(p, 'dim') || has(p, 'mkey') || has(p, 'small')) return C.dim; if (has(p, 'danger') || has(p, 'bad')) return C.bad; if (p.tagName === 'LABEL') return C.dim; } return C.text; };
const m = new Canvas(8, 8).getContext('2d'), mcache = new Map();
const mw = (s, f) => { const k = f + '|' + s; let v = mcache.get(k); if (v == null) { m.font = f; v = m.measureText(s).width; if (mcache.size > 20000) mcache.clear(); mcache.set(k, v); } return v; };
const textOf = (n) => { let s = tt.t(n.nodeValue); return s.replace(/\s+/g, ' '); };
// natural width of something placed on a line
function natural(n) {
  if (n.nodeType === 3) return mw(textOf(n), fontOf(n.parentNode));
  if (n instanceof Canvas) return (+n.style.width0 || n.width) + 0;
  switch (n.tagName) {
    case 'BUTTON': { const t = n.children.reduce((s, c) => s + natural(c) + 1, 0); return Math.max(20, t + (under(n, 'bar') ? 14 : 16)); }
    case 'INPUT': return n.type === 'checkbox' || n.type === 'radio' ? 13 : n.type === 'range' ? 90 : n.type === 'color' ? 30 : n.type === 'number' ? 60 : 110;
    case 'SELECT': { const o = n.options.reduce((a, c) => Math.max(a, mw(tt.t(c.textContent), `11px ${FONT}`)), 40); return Math.min(170, o + 24); }
    default: return n.children.reduce((s, c) => (hidden(c) ? s : s + natural(c) + (c.nodeType === 3 ? 0 : 2)), 0);
  }
}
const heightOf = (n) => { if (n instanceof Canvas) return n.height; if (n.nodeType === 3) return 15; if (n.tagName === 'BUTTON') { if (n.children.some((c) => c instanceof Canvas)) return Math.max(...n.children.map((c) => c.height || 15)) + 4; return under(n, 'bar') ? 26 : 20; } if (n.tagName === 'INPUT') return n.type === 'checkbox' || n.type === 'radio' ? 13 : 20; if (n.tagName === 'SELECT') return 20; return 15; };
const lineWrap = (s, font, w) => { const words = s.split(' '), out = []; let cur = ''; for (const a of words) { const t = cur ? cur + ' ' + a : a; if (mw(t, font) > w && cur) { out.push(cur); cur = a; } else cur = t; } if (cur) out.push(cur); return out.length ? out : ['']; };
// layout: every element gets _x, _y, _w, _h. Returns the height used
function flow(n, x, y, w) {
  const kids = (n.children || []).filter((c) => !hidden(c) && !(c._cls && (c._cls.has('mdrop') || c.id === 'toast')));
  let cy = y, cx = x, lineH = 0; const flush = () => { if (cx > x) { cy += lineH + 1; cx = x; lineH = 0; } };
  for (const c of kids) {
    if (inlineOf(c)) {
      if (c.nodeType === 3) {
        const f = fontOf(n), s = textOf(c); if (!s.trim() && cx === x) continue; const wide = mw(s, f);
        if (cx + wide > x + w && (s.includes(' '))) { flush(); const L = lineWrap(s, f, w); c._lines = L; c._x = x; c._y = cy; c._w = w; c._h = L.length * 15; cy += c._h; }
        else { if (cx + wide > x + w) flush(); c._lines = null; c._x = cx; c._y = cy; c._w = wide; c._h = 15; cx += wide; lineH = Math.max(lineH, 15); }
        continue;
      }
      const iw = Math.min(natural(c), w), ih = heightOf(c); if (cx + iw > x + w + 0.5) flush(); place(c, cx, cy, iw, ih); cx += iw + 3; lineH = Math.max(lineH, ih);
    } else { flush(); const h = block(c, x, cy, w); cy += h + gapAfter(c); }
  }
  flush(); return cy - y;
}
const gapAfter = (c) => (c.tagName === 'P' ? 4 : c.tagName === 'H3' ? 2 : c.tagName === 'LABEL' ? 3 : 0);
function place(c, x, y, w, h) {
  c._x = x; c._y = y; c._w = w; c._h = h;
  if (c instanceof Canvas) return;
  if (c.tagName === 'BUTTON' || c.tagName === 'SPAN' || c.tagName === 'B' || c.tagName === 'I' || c.tagName === 'A' || c.tagName === 'KBD' || c.tagName === 'LABEL') { let cx = x + (c.tagName === 'BUTTON' ? 7 : 0); for (const k of c.children) { if (k.nodeType === 3) { const s = textOf(k), f = fontOf(c); k._lines = null; k._x = cx; k._y = y + (h - 14) / 2; k._w = mw(s, f); k._h = 15; cx += k._w + 1; } else if (!hidden(k)) { const kw = natural(k), kh = heightOf(k); place(k, cx, y + (h - kh) / 2, kw, kh); cx += kw + 1; } } }
}
function block(n, x, y, w) {
  n._x = x; n._y = y; n._w = w; n._scroller = false; let h;
  if (has(n, 'row')) h = rowLay(n, x, y + 2, w) + 4;
  else if (n.tagName === 'TEXTAREA') { h = Math.max(2, +n.rows || 2) * 15 + 6; }
  else if (n.tagName === 'LABEL') { h = labelLay(n, x, y, w); }
  else if (n.tagName === 'TABLE' || n.tagName === 'TBODY') { h = 0; for (const r of n.children) { if (r.nodeType !== 1) continue; if (r.tagName === 'TBODY') { h += block(r, x, y + h, w); continue; } h += block(r, x, y + h, w); } }
  else if (n.tagName === 'TR') { const cells = n.children.filter((c) => c.nodeType === 1 && !hidden(c)), span = cells.reduce((s, c) => s + (c.colSpan || 1), 0) || 1, cw = cells.length === 2 ? [Math.min(92, w * 0.38), w - Math.min(92, w * 0.38)] : null; let cx = x; h = 0; cells.forEach((c, i) => { const ww = cw ? (cw[i]) : w * (c.colSpan || 1) / span, hh = block(c, cx, y, ww - 2); h = Math.max(h, hh); cx += ww; }); h += 2; }
  else if (has(n, 'tools') || has(n, 'palette') || has(n, 'grid')) {
    const decor = has(n, 'decor'), pal = has(n, 'palette'), cols = pal ? Math.max(1, Math.floor((w - 6) / (decor ? 50 : 38))) : 4, cw = pal ? (decor ? 50 : 38) : Math.floor(w / 4), chh = pal ? (decor ? 50 : 38) : 22, kids = n.children.filter((c) => c.nodeType === 1 && !hidden(c));
    kids.forEach((c, i) => { const cx = x + (pal ? 2 : 0) + (i % cols) * cw, cy = y + (pal ? 2 : 0) + Math.floor(i / cols) * chh; place(c, cx, cy, cw - 2, chh - 2); if (c.tagName !== 'BUTTON') { c._w = cw - 2; c._h = chh - 2; } });
    const full = Math.ceil(kids.length / cols) * chh + 4, cap = pal ? (decor ? 300 : 210) : 1e9; n._scroller = full > cap; n._full = full; h = Math.min(full, cap);
  } else if (has(n, 'msep')) h = 7;
  else if (n.tagName === 'H3') h = flow(n, x, y + 5, w) + 7;
  else if (n.tagName === 'H2') h = flow(n, x, y + 2, w) + 8;
  else if (has(n, 'caption')) { h = 18; flow(n, x + 5, y + 2, w - 10); }
  else h = flow(n, x + padOf(n), y + padOf(n), w - padOf(n) * 2) + padOf(n) * 2;
  n._h = h; return h;
}
const padOf = (n) => (has(n, 'list') ? 1 : has(n, 'inner') ? 6 : has(n, 'mitem') ? 3 : 0);
function rowLay(n, x, y, w) {
  const kids = n.children.filter((c) => !hidden(c) && (c.nodeType === 1 || c.nodeValue.trim())), flex = (c) => c.nodeType === 1 && (c.tagName === 'SELECT' || (c.tagName === 'INPUT' && !/checkbox|range|color|radio/.test(c.type)));
  const fixed = kids.reduce((s, c) => s + (flex(c) ? 0 : natural(c)) + 4, -4), nf = kids.filter(flex).length, share = nf ? Math.max(30, (w - fixed - 4 * nf) / nf) : 0, end = has(n, 'end');
  let cx = end ? x + w - fixed : x, h = 20;
  for (const c of kids) { const cw = flex(c) ? share : natural(c), ch = heightOf(c); if (c.nodeType === 3) { c._lines = null; c._x = cx; c._y = y + 3; c._w = cw; c._h = 15; } else place(c, cx, y + (20 - ch) / 2, cw, ch); h = Math.max(h, ch); cx += cw + 4; }
  return h;
}
function labelLay(n, x, y, w) {
  const field = n.children.find((c) => c.nodeType === 1 && /INPUT|SELECT|TEXTAREA/.test(c.tagName) && c.type !== 'checkbox' && c.type !== 'radio');
  if (!field) { let cx = x; for (const c of n.children) { if (c.nodeType === 3) { c._lines = null; c._x = cx; c._y = y + 1; c._w = mw(textOf(c), fontOf(n)); c._h = 15; cx += c._w + 3; } else if (!hidden(c)) { const iw = natural(c), ih = heightOf(c); place(c, cx, y + 2, iw, ih); cx += iw + 3; } } return 18; }
  let cy = y; for (const c of n.children) { if (hidden(c)) continue; if (c.nodeType === 3) { if (!textOf(c).trim()) continue; c._lines = lineWrap(textOf(c), fontOf(n), w); c._x = x; c._y = cy; c._w = w; c._h = c._lines.length * 14; cy += c._h; } else if (c === field && c.tagName === 'TEXTAREA') { c._x = x; c._y = cy; c._w = w; c._h = Math.max(2, +c.rows || 2) * 15 + 6; cy += c._h; } else { const ch = heightOf(c); place(c, x, cy, w, ch); cy += ch + 1; } }
  return cy - y + 1;
}

// ---------------------------------------------------------------- the toolkit
const UI = {
  root: null, focused: null, hover: null, dirty: true, W: 1280, H: 720, popup: null, mouse: { x: 0, y: 0 }, drag: null, T: tt, tip: null, tipAt: 0, Canvas,
  El, Text, C, FONT, focus(n) { const was = this.focused; if (was === n) return; this.focused = n; if (was && was.dispatchEvent && /INPUT|TEXTAREA/.test(was.tagName) && was._dirtyVal) { was._dirtyVal = false; was.dispatchEvent({ type: 'change', target: was }); } if (n && n._value != null) n._caret = String(n._value).length; this.dirty = true; },
  fire(n, type, e) { const ev = Object.assign({ type, target: n, bubbles: true, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stop = true; }, stopImmediatePropagation() { this.stop = true; }, ctrlKey: false, shiftKey: false, altKey: false }, e, { type, target: n }); for (let p = n; p && !ev.stop; p = p.parentNode) { ev.currentTarget = p; if (p.dispatchEvent) p.dispatchEvent(ev); } if (!ev.stop) for (const g of this.globals(n)) { ev.currentTarget = g; g.dispatchEvent(ev); } return ev; },
  globals() { return [this.document, this.window]; },
  // the layers: the app, then menus, then a dialog, then popups
  layout() {
    const r = this.root; if (!r) return; const W = this.W, H = this.H, $ = (id) => this.byId(id);
    let y = 0; for (const [id, h] of [['titlebar', 26], ['menubar', 21], ['bar', 34]]) { const n = $(id); n._x = 0; n._y = y; n._w = W; n._h = h; if (id === 'bar') { let cx = 6; for (const k of n.children) { if (k.nodeType !== 1) continue; if (has(k, 'sep')) { k._x = cx + 3; k._y = y + 6; k._w = 2; k._h = 22; cx += 9; continue; } k._x = cx; k._y = y + 4; k._h = 26; let c2 = cx; for (const b of k.children) { if (b.nodeType !== 1) continue; const bw = natural(b); place(b, c2, y + 4, bw, 26); c2 += bw + 2; } k._w = c2 - cx; cx = c2 + 3; } } else { let cx = 8; for (const k of n.children) { if (k.nodeType === 3) { if (!textOf(k).trim()) continue; const f = fontOf(n), tw = mw(textOf(k), f); k._lines = null; k._x = cx; k._y = y + (h - 14) / 2; k._w = tw; k._h = 15; cx += tw + 2; } else { const nw = has(k, 'appicon') ? 16 : mtopW(k) + 2; k._x = cx; k._y = y + (id === 'menubar' ? 1 : 5); k._w = nw; k._h = id === 'menubar' ? 19 : 16; if (has(k, 'mtop')) { for (const q of k.children) if (q.nodeType === 3) { q._lines = null; q._x = cx + 8; q._y = k._y + 2; q._w = mw(textOf(q), `11px ${FONT}`); q._h = 15; } const d = k.children.find((c) => has(c, 'mdrop')); if (d && has(k, 'open')) { const dw = 240, its = d.children.filter((c) => c.nodeType === 1); d._x = cx; d._y = k._y + 20; d._w = dw; let dy = d._y + 2; for (const it of its) { it._x = cx + 2; it._y = dy; it._w = dw - 4; it._h = has(it, 'msep') ? 7 : 20; const sp = it.children.filter((c) => c.nodeType === 1); if (sp[0]) { sp[0]._x = it._x + 28; sp[0]._y = dy + 3; sp[0]._w = 150; sp[0]._h = 15; for (const q of sp[0].children) { q._lines = null; q._x = sp[0]._x; q._y = dy + 3; q._w = 150; q._h = 15; } } if (sp[1]) { sp[1]._x = it._x + 170; sp[1]._y = dy + 3; sp[1]._w = 60; sp[1]._h = 15; for (const q of sp[1].children) { q._lines = null; q._x = sp[1]._x; q._y = dy + 3; q._w = 60; q._h = 15; } } dy += it._h; } d._h = dy - d._y + 2; } } cx += nw; } } } y += h; }
    const fh = 20, mid = H - y - fh, sb = $('statusbar'); sb._x = 0; sb._y = H - fh; sb._w = W; sb._h = fh; let cx = 6; for (const k of sb.children) { if (k.nodeType === 1) { k._x = k.id === 'statusRight' ? W - 240 : cx; k._y = H - fh + 2; k._w = 230; k._h = 16; flow(k, k._x, k._y, k.id === 'statusRight' ? 234 : W - 260); } }
    const main = $('main'); main._x = 0; main._y = y; main._w = W; main._h = mid; const L = $('left'), Rr = $('right'), Ce = $('center'), LW = 270, RW = 290;
    L._x = 3; L._y = y + 3; L._w = LW; L._h = mid - 6; Ce._x = LW + 6; Ce._y = y + 3; Ce._w = W - LW - RW - 12; Ce._h = mid - 6; Rr._x = W - RW - 3; Rr._y = y + 3; Rr._w = RW; Rr._h = mid - 6;
    let ly = L._y; for (const k of L.children) { if (k.nodeType !== 1 || hidden(k)) continue; if (has(k, 'caption')) { ly += block(k, L._x, ly, L._w); } else if (has(k, 'tabs')) { k._x = L._x; k._y = ly; k._w = L._w; k._h = 22; const bs = k.children.filter((c) => c.nodeType === 1), bw = (L._w - 6) / bs.length; bs.forEach((b, i) => place(b, L._x + 3 + i * bw, ly + 2, bw - 1, 20)); ly += 22; } else if (has(k, 'pane')) { k._x = L._x; k._y = ly; k._w = L._w; k._scroller = true; k._h = L._y + L._h - ly; k._full = flow(k, L._x + 6, ly + 5, L._w - 20) + 10; } }
    let cy = Ce._y; for (const k of Ce.children) { if (k.nodeType !== 1) continue; if (has(k, 'caption')) cy += block(k, Ce._x, cy, Ce._w); else { k._x = Ce._x; k._y = cy; k._w = Ce._w; k._h = Ce._y + Ce._h - cy; const v = $('view'); v._x = k._x; v._y = k._y; v._w = k._w; v._h = k._h; } }
    Rr._scroller = true; let ry = Rr._y; for (const k of Rr.children) { if (k.nodeType !== 1 || hidden(k)) continue; const h = block(k, Rr._x, ry, Rr._w - 11); ry += h; } Rr._full = ry - Rr._y;
    const mo = $('modal'); if (!hidden(mo)) { const b = mo.querySelector('.box'), bw = Math.min(520, W - 60); b._w = bw; b._x = (W - bw) / 2; b._scroller = true; const full = flow(b, b._x + 12, 0, bw - 34) + 24, bh = Math.min(full, H - 60); b._h = bh; b._y = (H - bh) / 2; flow(b, b._x + 12, b._y + 12, bw - 34); b._full = full; mo._x = 0; mo._y = 0; mo._w = W; mo._h = H; }
    this.dirty = false;
  },
  byId(id) { return this.ids.get(id) || this.findId(id); },
  findId(id) { if (this.root && this.root.id === id) return this.root; let r = null; const go = (n) => { for (const c of n.children || []) { if (r || c.nodeType !== 1) continue; if (c.id === id) { r = c; return; } go(c); } }; go(this.root); if (r && this.frozen && this.frozen.has(id)) this.ids.set(id, r); return r; },
  ids: new Map(), frozen: null,
  // painting
  paint(x) {
    if (this.dirty) this.layout();
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.fillStyle = C.frame; x.fillRect(0, 0, this.W, this.H); x.textBaseline = 'top'; x.textAlign = 'left';
    const R = this.root; for (const c of R.children) { if (c.nodeType !== 1 || c.id === 'modal' || c.id === 'toast') continue; this.draw(x, c, 0); }
    const bar = this.byId('menubar'); for (const t of bar.children) { const d = t.nodeType === 1 && t.children.find((c) => has(c, 'mdrop')); if (d && has(t, 'open')) this.draw(x, d, 0, true); }
    const mo = this.byId('modal'); if (!hidden(mo)) { x.fillStyle = 'rgba(40,38,34,0.42)'; x.fillRect(0, 0, this.W, this.H); this.draw(x, mo.querySelector('.box'), 0); }
    const to = this.byId('toast'); if (to && has(to, 'show')) { const s = tt.t(to.textContent), tw = mw(s, `11px ${FONT}`) + 22; x.fillStyle = '#3d3a35'; x.fillRect((this.W - tw) / 2, this.H - 60, tw, 24); x.fillStyle = '#fbf6e7'; x.font = `11px ${FONT}`; x.fillText(s, (this.W - tw) / 2 + 11, this.H - 54); }
    if (this.busyEl && this.busyEl.parentNode && this.busyEl.style.display !== 'none') { const s = tt.t(this.busyEl.textContent), tw = mw(s, `11px ${FONT}`) + 32; x.fillStyle = '#3d3a35'; x.fillRect((this.W - tw) / 2, this.H / 2 - 16, tw, 32); x.fillStyle = '#fbf6e7'; x.font = `11px ${FONT}`; x.fillText(s, (this.W - tw) / 2 + 16, this.H / 2 - 7); }
    if (this.popup) this.drawPopup(x);
    const tip = this.tip; if (tip && performance.now() - this.tipAt > 550) { const s = tt.t(tip), f = `11px ${FONT}`, tw = mw(s, f) + 10, px = Math.min(this.W - tw - 2, this.mouse.x + 10), py = Math.min(this.H - 20, this.mouse.y + 18); x.fillStyle = '#f8f3e4'; x.fillRect(px, py, tw, 18); x.strokeStyle = C.line; x.lineWidth = 1; x.strokeRect(px + 0.5, py + 0.5, tw - 1, 17); x.fillStyle = C.text; x.font = f; x.fillText(s, px + 5, py + 3); }
    x.restore();
  },
  fill(x, n, c, b) { x.fillStyle = c; x.fillRect(n._x, n._y + this.dy, n._w, n._h); if (b) { x.strokeStyle = b; x.lineWidth = 1; x.strokeRect(n._x + 0.5, n._y + this.dy + 0.5, n._w - 1, n._h - 1); } },
  dy: 0,
  draw(x, n, dy, over) {
    if (n.nodeType === 3) { this.dy = dy; const p = n.parentNode, f = fontOf(p); x.font = f; x.fillStyle = colorOf(p); if (n._x == null) return; if (n._lines) n._lines.forEach((l, i) => x.fillText(l, n._x, n._y + dy + i * 15)); else x.fillText(textOf(n), n._x, n._y + dy); return; }
    if (hidden(n) || n._x == null) return; if (has(n, 'mdrop') && !over) return;
    this.dy = dy; const hov = this.hover === n || (this.hover && n.contains && n.tagName === 'BUTTON' && n.contains(this.hover)), Y = n._y + dy;
    if (n instanceof Canvas) { if (n._w > 0 && n._h > 0) { x.imageSmoothingEnabled = false; x.drawImage(n, n._x, Y, n._w, n._h); } return; }
    switch (n.tagName) {
      case 'BUTTON': { const onB = has(n, 'on'); if (under(n, 'bar') && !hov && !has(n, 'accent')) break; this.fill(x, n, n.disabled ? '#d6d2c6' : onB ? C.on : hov ? C.hi : has(n, 'accent') ? '#bfbbb0' : C.btn, onB ? C.onb : hov ? C.hib : C.btnb); break; }
      case 'INPUT': case 'TEXTAREA': case 'SELECT': this.field(x, n, Y); return;
      case 'H2': case 'H3': break;
      default: break;
    }
    if (n.id === 'titlebar') this.fill(x, n, C.title); else if (n.id === 'menubar') this.fill(x, n, C.menu); else if (n.id === 'bar') this.fill(x, n, '#dad5c8', null); else if (n.id === 'statusbar') this.fill(x, n, '#dad5c8'); else if (n.id === 'left' || n.id === 'right') this.fill(x, n, C.pane, C.line); else if (has(n, 'caption')) this.fill(x, n, C.cap); else if (has(n, 'palette')) this.fill(x, n, C.paper, C.line2); else if (has(n, 'box')) this.fill(x, n, C.face, C.line); else if (has(n, 'mdrop')) this.fill(x, n, C.drop, C.line);
    else if ((has(n, 'mtop') || has(n, 'mitem')) && (hov || has(n, 'open'))) this.fill(x, n, '#ecdcae', '#cab47d'); else if (has(n, 'sep')) { x.fillStyle = '#b6b2a7'; x.fillRect(n._x, Y, 1, n._h); x.fillStyle = '#fbf6e7'; x.fillRect(n._x + 1, Y, 1, n._h); } else if (has(n, 'msep')) { x.fillStyle = '#d1cdc0'; x.fillRect(n._x + 28, Y + 3, n._w - 32, 1); } else if (has(n, 'appicon')) { x.fillStyle = '#c8c4b8'; x.beginPath(); x.arc(n._x + 8, Y + 8, 7, 0, 6.3); x.fill(); } else if (has(n, 'item') || has(n, 'lrow')) { if (has(n, 'on')) this.fill(x, n, '#d5ccb6'); else if (hov) this.fill(x, n, C.hi); } else if (has(n, 'sw')) this.fill(x, n, has(n, 'on') ? '#d5ccb6' : '#e9e4d6', has(n, 'on') ? '#8a8170' : hov ? '#cab47d' : '#d8d3c6'); else if (has(n, 'dlg-node') || has(n, 'card')) this.fill(x, n, '#efe9db', C.line2);
    if (has(n, 'mitem') && has(n, 'checked')) { x.fillStyle = C.text; x.font = `bold 11px ${FONT}`; x.fillText('✓', n._x + 8, Y + 3); }
    if (n._scroller) { x.save(); x.beginPath(); x.rect(n._x, Y, n._w, n._h); x.clip(); const max = Math.max(0, (n._full || 0) - n._h); if (n.scrollTop > max) n.scrollTop = max; if (n.scrollTop < 0) n.scrollTop = 0; const d2 = dy - n.scrollTop; for (const c of n.children) { if (c.nodeType === 3 ? c._y != null : !hidden(c)) this.draw(x, c, d2); } x.restore(); if (max > 0) { const th = Math.max(20, n._h * n._h / n._full), ty = Y + (n._h - th) * (n.scrollTop / max); x.fillStyle = '#d3cec2'; x.fillRect(n._x + n._w - 9, Y + 1, 8, n._h - 2); x.fillStyle = C.line2; x.fillRect(n._x + n._w - 8, ty + 1, 6, th - 2); } return; }
    for (const c of n.children) { if (c.nodeType === 3 || !hidden(c)) this.draw(x, c, dy); }
    if (has(n, 'sw')) { const q = /url\((.*?)\)/.exec(n.style.cssText || n.getAttribute('style') || ''); if (q) { if (n._bgU !== q[1]) { n._bgU = q[1]; n._bg = new Image(); n._bg.src = q[1]; } if (n._bg.complete && n._bg.width) { const k = Math.min((n._w - 4) / n._bg.width, (n._h - 4) / n._bg.height, 3), bw = n._bg.width * k, bh = n._bg.height * k; x.imageSmoothingEnabled = false; x.drawImage(n._bg, n._x + (n._w - bw) / 2, Y + (n._h - bh) / 2, bw, bh); } } }
    if (n.dataset && n.dataset.name && n === this.hover && has(n, 'sw')) this.tip = n.dataset.name;
  },
  field(x, n, Y) {
    const X = n._x, w = n._w, h = n._h, foc = this.focused === n;
    if (n.tagName === 'SELECT') { x.fillStyle = C.field; x.fillRect(X, Y, w, h); x.strokeStyle = foc ? C.onb : C.btnb; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1); x.fillStyle = C.btn; x.fillRect(X + w - 15, Y + 1, 14, h - 2); x.fillStyle = C.text; x.beginPath(); x.moveTo(X + w - 11, Y + 8); x.lineTo(X + w - 4, Y + 8); x.lineTo(X + w - 7.5, Y + 12); x.closePath(); x.fill(); const o = n.options.find((c) => c.selected) || n.options[0]; x.font = `11px ${FONT}`; x.fillStyle = C.text; if (o) { x.save(); x.beginPath(); x.rect(X, Y, w - 16, h); x.clip(); x.fillText(tt.t(o.textContent), X + 4, Y + 4); x.restore(); } return; }
    if (n.type === 'checkbox' || n.type === 'radio') { x.fillStyle = C.field; x.fillRect(X, Y, 13, 13); x.strokeStyle = C.btnb; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, 12, 12); if (n.checked) { x.strokeStyle = C.text; x.lineWidth = 2; x.beginPath(); x.moveTo(X + 3, Y + 7); x.lineTo(X + 6, Y + 10); x.lineTo(X + 10, Y + 3); x.stroke(); } return; }
    if (n.type === 'range') { const lo = +n.min || 0, hi = +n.max || 100, t = (+n.value - lo) / ((hi - lo) || 1); x.fillStyle = C.line2; x.fillRect(X, Y + h / 2 - 1, w, 2); x.fillStyle = C.cap; x.fillRect(X + (w - 8) * t, Y + 3, 8, h - 6); return; }
    if (n.type === 'color') { x.fillStyle = /^#/.test(n.value) ? n.value : '#000'; x.fillRect(X, Y, w, h); x.strokeStyle = C.btnb; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1); return; }
    x.fillStyle = C.field; x.fillRect(X, Y, w, h); x.strokeStyle = foc ? C.onb : C.btnb; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1);
    const v = String(n.value), f = `11px ${FONT}`; x.save(); x.beginPath(); x.rect(X + 2, Y + 1, w - 4, h - 2); x.clip(); x.font = f;
    if (n.tagName === 'TEXTAREA') { const L = v.split('\n').flatMap((l) => lineWrap(l, f, w - 10)); x.fillStyle = C.text; L.forEach((l, i) => x.fillText(l, X + 4, Y + 3 + i * 15)); if (!v && n.placeholder) { x.fillStyle = '#8a877e'; x.fillText(tt.t(n.placeholder), X + 4, Y + 3); } if (foc && Math.floor(performance.now() / 500) % 2 === 0) { const l = L[L.length - 1] || ''; x.fillStyle = C.text; x.fillRect(X + 4 + mw(l, f), Y + 3 + (L.length - 1) * 15, 1, 13); } }
    else { const cw = mw(v.slice(0, n._caret), f), off = Math.max(0, cw - (w - 12)); if (v) { x.fillStyle = C.text; x.fillText(v, X + 4 - off, Y + 4); } else if (n.placeholder) { x.fillStyle = '#8a877e'; x.fillText(tt.t(n.placeholder), X + 4, Y + 4); } if (foc && Math.floor(performance.now() / 500) % 2 === 0) { x.fillStyle = C.text; x.fillRect(X + 4 + cw - off, Y + 3, 1, 14); } }
    x.restore();
  },
  drawPopup(x) { const p = this.popup, h = 18, f = `11px ${FONT}`; x.fillStyle = C.drop; x.fillRect(p.x, p.y, p.w, p.h); x.strokeStyle = C.line; x.lineWidth = 1; x.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1); x.save(); x.beginPath(); x.rect(p.x + 1, p.y + 1, p.w - 2, p.h - 2); x.clip(); x.font = f; p.opts.forEach((o, i) => { const y = p.y + 1 + i * h - p.scroll; if (y < p.y - h || y > p.y + p.h) return; if (i === p.hov) { x.fillStyle = '#ecdcae'; x.fillRect(p.x + 1, y, p.w - 2, h); } x.fillStyle = C.text; x.fillText(tt.t(o.textContent), p.x + 5, y + 3); }); x.restore(); },
  // finding what is under the pointer
  pick(px, py) {
    if (this.popup) return null;
    const mo = this.byId('modal'); if (!hidden(mo)) { const b = mo.querySelector('.box'); return this.at(b, px, py, 0) || mo; }
    const bar = this.byId('menubar'); for (const t of bar.children) { const d = t.nodeType === 1 && t.children.find((c) => has(c, 'mdrop')); if (d && has(t, 'open')) { const r = this.at(d, px, py, 0); if (r) return r; } }
    for (const c of this.root.children) { if (c.nodeType !== 1 || c.id === 'modal' || c.id === 'toast') continue; const r = this.at(c, px, py, 0); if (r) return r; }
    return this.root;
  },
  at(n, px, py, dy) {
    if (n.nodeType !== 1 || hidden(n) || n._x == null) return null; const Y = n._y + dy, inside = px >= n._x && py >= Y && px < n._x + n._w && py < Y + n._h;
    if (n._scroller && !inside) return null; const d2 = n._scroller ? dy - (n.scrollTop || 0) : dy;
    if (n.children) for (let i = n.children.length - 1; i >= 0; i--) { const r = this.at(n.children[i], px, py, d2); if (r) return r; }
    return inside ? n : null;
  },
  // input
  mousemove(px, py, e) {
    this.mouse.x = px; this.mouse.y = py; if (this.popup) { const p = this.popup; p.hov = px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h ? Math.floor((py - p.y - 1 + p.scroll) / 18) : -1; return; }
    if (this.sliding) { this.slide(px); return; } if (this.thumbDrag) { const d = this.thumbDrag, n = d.n, max = n._full - n._h; n.scrollTop = Math.max(0, Math.min(max, d.top + (py - d.y) * max / (n._h - 20))); return; }
    const n = this.pick(px, py); if (n !== this.hover) { const old = this.hover; this.hover = n; this.tip = null; this.tipAt = performance.now(); for (let p = n; p; p = p.parentNode) { if (p.title) { this.tip = p.title; break; } } if (old && old.dispatchEvent) old.dispatchEvent({ type: 'mouseleave', target: old }); if (n && n.dispatchEvent) n.dispatchEvent({ type: 'mouseenter', target: n }); }
    const ev = Object.assign({ type: 'mousemove', target: n, clientX: px, clientY: py, buttons: e.buttons, button: e.button, preventDefault() {} }, {}); this.fire(n || this.root, 'mousemove', ev);
  },
  mousedown(px, py, e) {
    if (this.popup) { const p = this.popup, i = p.hov, n = p.n; this.popup = null; if (i >= 0 && i < p.opts.length) { n.options.forEach((o, k) => { o.selected = k === i; }); n.dispatchEvent({ type: 'input', target: n }); n.dispatchEvent({ type: 'change', target: n }); } this.dirty = true; return; }
    const n = this.pick(px, py) || this.root; this.pressed = n;
    for (let s = n; s; s = s.parentNode) if (s._scroller && px > s._x + s._w - 10) { const Y = s._y; if (py >= Y && py < Y + s._h && s._full > s._h) { this.thumbDrag = { n: s, y: py, top: s.scrollTop }; return; } }
    if (/INPUT|TEXTAREA|SELECT/.test(n.tagName)) { this.focus(n); if (n.tagName === 'SELECT' && e.button === 0) { this.openSelect(n); } else if (n.type === 'range') { this.sliding = n; this.slide(px); } else if (n.type === 'checkbox' || n.type === 'radio') { /* toggled on click */ } else if (n._value != null) { const f = `11px ${FONT}`, want = px - n._x - 4; let c = 0; while (c < n._value.length && mw(n._value.slice(0, c + 1), f) < want) c++; n._caret = c; } }
    else this.focus(null);
    const ev = this.fire(n, 'mousedown', { clientX: px, clientY: py, button: e.button, buttons: e.buttons, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey }); void ev;
  },
  openSelect(n) { const r = n.getBoundingClientRect(), opts = n.options, h = 18, ph = Math.min(opts.length * h + 2, this.H - 60), y = r.bottom + ph > this.H ? Math.max(4, r.top - ph) : r.bottom, sel = Math.max(0, n.selectedIndex); this.popup = { n, opts, x: r.left, y, w: Math.max(r.width, 120), h: ph, hov: sel, scroll: Math.max(0, Math.min(opts.length * h + 2 - ph, sel * h - ph / 2)) }; },
  slide(px) { const n = this.sliding, lo = +n.min || 0, hi = +n.max || 100, st = +n.step || 1, t = Math.max(0, Math.min(1, (px - n._x - 4) / (n._w - 8))); const v = Math.round((lo + (hi - lo) * t) / st) * st; if (String(v) !== String(n.value)) { n.value = v; n.dispatchEvent({ type: 'input', target: n }); n.dispatchEvent({ type: 'change', target: n }); } },
  mouseup(px, py, e) {
    this.thumbDrag = null; if (this.sliding) { this.sliding = null; return; }
    const n = this.pick(px, py) || this.root, was = this.pressed; this.pressed = null;
    this.fire(n, 'mouseup', { clientX: px, clientY: py, button: e.button, buttons: e.buttons });
    if (was && e.button === 0 && (was === n || was.contains && was.contains(n) || n.contains && n.contains(was))) { const t = was; if (t.disabled) return; if (t.tagName === 'INPUT' && (t.type === 'checkbox' || t.type === 'radio')) { t.checked = t.type === 'radio' ? true : !t.checked; t.dispatchEvent({ type: 'input', target: t }); t.dispatchEvent({ type: 'change', target: t }); this.dirty = true; } else if (t.tagName === 'LABEL' || (t.parentNode && t.parentNode.tagName === 'LABEL')) { const lb = t.tagName === 'LABEL' ? t : t.parentNode, cb = lb.querySelector('input'); if (cb && cb.type === 'checkbox') { cb.checked = !cb.checked; cb.dispatchEvent({ type: 'input', target: cb }); cb.dispatchEvent({ type: 'change', target: cb }); this.dirty = true; } } this.fire(t, 'click', { clientX: px, clientY: py, button: 0 }); }
  },
  wheel(px, py, dy) {
    if (this.popup) { const p = this.popup; p.scroll = Math.max(0, Math.min(p.opts.length * 18 + 2 - p.h, p.scroll + dy * 40)); return; }
    const n = this.pick(px, py); for (let s = n; s; s = s.parentNode) if (s._scroller && s._full > s._h) { s.scrollTop = Math.max(0, Math.min(s._full - s._h, (s.scrollTop || 0) + dy * 40)); this.mousemove(px, py, {}); return; }
    if (n) this.fire(n, 'wheel', { deltaY: dy * 100, clientX: px, clientY: py });
  },
  keydown(e) {
    const f = this.focused, text = f && f.isConnected !== false && /INPUT|TEXTAREA/.test(f.tagName) && !/checkbox|radio|range|color/.test(f.type);
    if (this.popup && e.key === 'Escape') { this.popup = null; return; }
    if (e.key === 'Escape' && !hidden(this.byId('modal'))) { const c = this.byId('modalCancel'); if (c && !hidden(c)) c.click(); else this.byId('modalOk').click(); return; }
    if (e.key === 'Enter' && !hidden(this.byId('modal')) && !(f && f.tagName === 'TEXTAREA')) { if (f) this.focus(null); this.byId('modalOk').click(); return; }
    if (text) {
      let v = String(f._value), c = f._caret; const put = (s) => { v = v.slice(0, c) + s + v.slice(c); c += s.length; }, set = () => { f._value = v; f._caret = c; f._dirtyVal = true; f.dispatchEvent({ type: 'input', target: f }); this.dirty = true; };
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) return;
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) { Promise.resolve(UI.paste ? UI.paste() : '').then((s) => { if (s) { put(s.replace(/\r/g, '')); set(); } }); return; }
      if (e.key === 'Backspace') { if (c > 0) { v = v.slice(0, c - 1) + v.slice(c); c--; set(); } return; }
      if (e.key === 'Delete') { if (c < v.length) { v = v.slice(0, c) + v.slice(c + 1); set(); } return; }
      if (e.key === 'ArrowLeft') { f._caret = Math.max(0, c - 1); return; } if (e.key === 'ArrowRight') { f._caret = Math.min(v.length, c + 1); return; } if (e.key === 'Home') { f._caret = 0; return; } if (e.key === 'End') { f._caret = v.length; return; }
      if (e.key === 'Enter') { if (f.tagName === 'TEXTAREA') { put('\n'); set(); } else { f._dirtyVal = false; f.dispatchEvent({ type: 'change', target: f }); } return; }
      if (e.key === 'Tab') { this.focus(null); return; }
      if (e.key && [...e.key].length === 1 && !e.ctrlKey && !e.altKey) { put(e.key); set(); return; }
      return;
    }
    this.fire(this.focused || this.root, 'keydown', e);
  },
};
module.exports = UI;
const mtopW = (k) => mw(tt.t(k.children.filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join('')), `11px ${FONT}`) + 16;
