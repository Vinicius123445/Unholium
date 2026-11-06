'use strict';
// The Prison Diary: your phone stays in the evidence room, this stays with you. A real notebook, written by hand.
// P opens it: the character stops, takes it out and reads; the cover swings open, pages turn. P or Esc closes it.
// Pages: Self-Evaluation, Relationships, Factions, then what the phone did that is not talking to people: Tasks (the
// Journal's quests and jobs), Abilities, Attributes, Effects, Days (clock and sentence), Notes (your log).
// Only prison data reaches it: the pages are built from prison sources (G.prison, the jail's own map of inmates), and
// outside factions are not filtered out at the end: they are never read.
(() => {
const FONT = '"Ink Free","Segoe Print","Segoe Script","Bradley Hand","Comic Sans MS",cursive', TITLE = '"Segoe Script","Ink Free","Segoe Print",cursive';
const PEN = '#1e2a5a', RED = '#a02a2a', LEAD = '#4a4a50';
const I = () => G.i18n;
G.ITEMS.prison_diary = { name: 'Prison Diary', type: 'misc', icon: 'book', value: 0, stack: 1, quest: true, desc: 'Cheap ruled notebook, its corners soft. Everything you need to remember in here, in your own handwriting.' };
G.ITEM_USE = G.ITEM_USE || {};
G.ITEM_USE.prison_diary = (game) => { G.scenes.push(new DiaryScene(game)); return true; };

const P = () => G.prison;
const ink = (ctx, s, x, y, o = {}) => { ctx.font = `${o.bold ? 'bold ' : ''}${o.size || 9}px ${o.title ? TITLE : FONT}`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = o.color || PEN; const t = I().t(String(s)); const jx = o.title ? 0 : Math.sin(y * 3.1 + x) * 0.35; ctx.fillText(t, x + jx, y); return ctx.measureText(t).width; };
const fit = (ctx, s, w, size) => { ctx.font = `${size || 9}px ${FONT}`; const out = []; for (const para of I().t(String(s)).split('\n')) { let line = ''; for (const word of para.split(' ')) { const t = line ? `${line} ${word}` : word; if (ctx.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } out.push(line); } return out; };

// each page: a list of lines { t, c, s, b } (text, color, heading?, bar value)
const PAGES = [
  ['Self-Evaluation', (g) => {
    const w = g.world, p = g.player, j = w.jail || {}, out = [], mine = P().yours(w);
    out.push({ s: 'How I am' });
    out.push({ t: `Health: ${Math.ceil(p.hp)} of ${p.maxHp}`, b: p.hp / p.maxHp });
    out.push({ t: `Hunger: ${Math.round(p.hunger || 0)}   Thirst: ${Math.round(p.thirst || 0)}` });
    if (p.effects && p.effects.length) out.push({ t: `Feeling: ${p.effects.map((e) => G.EFFECTS[e.id].name).join(', ')}` }); else out.push({ t: 'Feeling: nothing out of the ordinary.' });
    out.push({ s: 'In here' });
    out.push({ t: `Days left: ${Math.max(0, (j.release || w.day) - w.day)}` });
    out.push({ t: `Who I run with: ${mine ? P().GANGS[mine] : 'nobody'}` });
    for (const f of P().standing(w)) out.push({ t: `${f.name}: ${f.label}${f.member ? ' (mine)' : ''}` });
    const friends = P().inmates(w).filter((id) => (w.npcs[id].disp || 0) >= 20 && w.isAlive(id)).length, foes = P().inmates(w).filter((id) => (w.npcs[id].disp || 0) <= -20 && w.isAlive(id)).length;
    out.push({ t: `Friends inside: ${friends}   Enemies inside: ${foes}` });
    out.push({ t: `Call today: ${G.prisonCall ? (G.prisonCall.available(w) ? 'still mine' : G.prisonCall.statusText(w)) : '-'}` });
    return out;
  }],
  ['Relationships', (g) => {
    const w = g.world, out = [];
    const list = P().inmates(w).filter((id) => w.npcs[id].introduced || (w.npcs[id].disp || 0) !== 0 || w.npcs[id].talked);
    if (!list.length) return [{ t: 'Nobody yet. Better learn who is who.' }];
    for (const id of list) {
      const st = w.npcs[id], t = G.rel.tier(st), gang = P().gangOf(w, id);
      out.push({ s: w.displayName(id) });
      out.push({ t: `${t.name}${gang ? ` · ${P().GANGS[gang]}` : ' · on their own'}${w.isAlive(id) ? '' : ' (dead)'}` });
    }
    return out;
  }],
  ['Factions', (g) => {
    const w = g.world, out = [];
    for (const f of P().standing(w)) {
      out.push({ s: f.name + (f.member ? ' (mine)' : '') });
      out.push({ t: `Standing: ${f.label} (${f.rep})`, b: (f.rep + 100) / 200 });
      const rel = P().IDS.filter((o) => o !== f.id).map((o) => `${P().GANGS[o]}: ${G.factionRelation(f.id, o) <= -0.75 ? 'open hatred' : 'bad blood'}`);
      out.push({ t: rel.join(' · ') });
      const n = P().inmates(w).filter((id) => G.NPCS[id].faction === f.id && w.isAlive(id)).length;
      out.push({ t: `Members I know of: ${n}` });
    }
    return out;
  }],
  ['Tasks', (g) => {
    const w = g.world, out = [];
    const left = Object.keys(w.quests || {}).filter((id) => w.quests[id].state === 'active').length;   // (what is waiting outside stays outside: only how much)
    const quests = [];
    if (left) out.push({ t: `Things left unfinished outside: ${left}` });
    if (!w.jail || !w.jail.tunnel) { out.push({ t: 'Get through this one day at a time.' }); }
    if (w.jail && w.jail.dig) out.push({ t: `The tunnel: ${Math.round(w.jail.dig)}% done. Keep it quiet.` });
    if (!left && !out.length) out.push({ t: 'Nothing I can do anything about from in here.' });
    for (const t of quests) out.push({ t: `- ${t}` });
    return out;
  }],
  ['Abilities', (g) => {
    const p = g.player, out = [], sk = p.skills || {}, ranks = sk.ranks || sk.learned || {};
    out.push({ t: `Level ${sk.level || 1} · points to spend: ${sk.points || 0}` });
    for (const id in ranks) if (ranks[id] && G.SKILLS && G.SKILLS[id]) out.push({ t: `- ${G.SKILLS[id].name} ${ranks[id] > 1 ? `(${ranks[id]})` : ''}` });
    const a = sk.attrs; if (a) { out.push({ s: 'Attributes' }); for (const k in a) out.push({ t: `${G.util.capitalize(k)}: ${a[k]}`, b: a[k] / 10 }); }
    return out;
  }],
  ['Days', (g) => {
    const w = g.world, j = w.jail || {}, out = [];
    out.push({ t: `Day ${w.day}, ${w.timeString}` });
    out.push({ t: `I walk out on day ${j.release || '?'}, at eight in the morning.` });
    out.push({ t: 'Lights out at 22:00. Back in the cell by then.' });
    out.push({ s: 'Stats' });
    out.push({ t: `Crimes on record: ${(w.stats && w.stats.crimes) || 0}` });
    return out;
  }],
  ['Notes', (g) => {
    const w = g.world, list = ((w.jail && w.jail.notes) || []).slice(-14).reverse(), out = [];   // (its own record: what happened to you in here)
    if (!list.length) return [{ t: 'Nothing written yet.' }];
    for (const l of list) out.push({ t: `- Day ${l[0]}: ${l[1]}`, c: LEAD });
    return out;
  }],
];

class DiaryScene {
  constructor(game) { this.transparent = true; this.xpNoir = true; this.game = game; this.page = 0; this.open = 0; this.closing = false; this.turn = 0; this.turnDir = 1; this.scroll = 0; G.audio.play('select'); game.player.reading = true; }
  exit() { this.game.player.reading = false; }
  go(d) { const n = this.page + d; if (n < 0 || n >= PAGES.length || this.turn > 0) return; this.turnFrom = this.page; this.page = n; this.turn = 1; this.turnDir = d; this.scroll = 0; G.audio.play('select'); }
  update(dt) {
    const I_ = G.input;
    this.open = Math.min(1, this.open + dt * (this.closing ? -3.5 : 3.5) * (this.closing ? 2 : 1));
    if (this.closing) { this.open = Math.max(0, this.open - dt * 4); if (this.open <= 0) G.scenes.remove(this); return; }
    if (this.turn > 0) this.turn = Math.max(0, this.turn - dt * 3.2);
    if (I_.wasPressed('phone') || I_.wasPressed('cancel')) { this.closing = true; G.audio.play('back'); return; }
    if (I_.wasPressed('left') || I_.wasPressed('tabLeft')) this.go(-1);
    if (I_.wasPressed('right') || I_.wasPressed('tabRight')) this.go(1);
    if (I_.wasPressed('up')) this.scroll = Math.max(0, this.scroll - 1);
    if (I_.wasPressed('down')) this.scroll += 1;
    if (I_.mouse.wheel) this.scroll = Math.max(0, this.scroll + I_.mouse.wheel);
  }
  paper(ctx, x, y, w, h) {
    ctx.fillStyle = '#efe6cf'; ctx.fillRect(x, y, w, h);
    const r = new G.RNG('paper'); for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(120,100,60,${r.next() * 0.05})`; ctx.fillRect(x + r.next() * w, y + r.next() * h, 1 + r.next() * 3, 1); }
    ctx.fillStyle = 'rgba(70,110,170,0.28)'; for (let ly = y + 24; ly < y + h - 4; ly += 12) ctx.fillRect(x + 3, ly, w - 6, 0.5);
    ctx.fillStyle = 'rgba(190,60,60,0.35)'; ctx.fillRect(x + 22, y, 0.6, h);
  }
  body(ctx, i, x, y, w, h) {
    const [title, build] = PAGES[i];
    ink(ctx, title, x + 30, y + 19, { size: 13, title: true, bold: true });
    const lines = []; let list = [];
    try { list = build(this.game); } catch (e) { G.reportError && G.reportError(e); }
    for (const l of list) { if (l.s) lines.push({ t: l.s, s: true }); else for (const t of fit(ctx, l.t, w - 42, 9)) lines.push({ t, c: l.c, b: l.b }); }
    const rows = Math.floor((h - 34) / 12), max = Math.max(0, lines.length - rows);
    if (i === this.page) this.scroll = Math.min(this.scroll, max);
    const s = i === this.page ? this.scroll : 0;
    lines.slice(s, s + rows).forEach((l, k) => {
      const by = y + 33 + k * 12;
      if (l.s) { const tw = ink(ctx, l.t, x + 28, by, { size: 10, bold: true, color: RED }); ctx.fillStyle = 'rgba(160,42,42,0.5)'; ctx.fillRect(x + 28, by + 2, tw, 0.6); return; }
      const tw = ink(ctx, l.t, x + 28, by, { color: l.c || PEN });
      if (l.b != null) { const bx = x + 34 + tw, bw = Math.min(50, x + w - bx - 8); if (bw > 10) { ctx.strokeStyle = PEN; ctx.lineWidth = 0.5; ctx.strokeRect(bx, by - 6, bw, 5); ctx.fillStyle = 'rgba(30,42,90,0.45)'; for (let q = 0; q < bw * G.util.clamp(l.b, 0, 1); q += 1.5) ctx.fillRect(bx + q, by - 6, 0.8, 5); } }
    });
    if (max > s) ink(ctx, '...', x + w - 20, y + h - 6, { color: LEAD });
  }
  render(ctx) {
    const R = G.renderer; R.uiTransform();
    ctx.fillStyle = `rgba(0,0,0,${0.5 * this.open})`; ctx.fillRect(0, 0, R.uiW, R.uiH);
    const W = Math.min(440, R.uiW - 20), H = Math.min(270, R.uiH - 16), x = (R.uiW - W) / 2, y = (R.uiH - H) / 2, pw = W / 2, e = this.open * this.open * (3 - 2 * this.open);
    ctx.save(); ctx.translate(0, (1 - e) * 40); ctx.globalAlpha = Math.min(1, e * 2);
    ctx.fillStyle = '#2e3a4e'; ctx.fillRect(x - 5, y - 5, W + 10, H + 10);          // the cover
    ctx.fillStyle = '#1e2838'; ctx.fillRect(x + W / 2 - 3, y - 5, 6, H + 10);
    const lp = x, rp = x + pw;
    this.paper(ctx, lp, y, pw, H); this.paper(ctx, rp, y, pw, H);
    // left page: this one; right page: the next one, so the book reads as a spread
    this.body(ctx, this.page, lp, y, pw, H);
    if (this.page + 1 < PAGES.length) this.body(ctx, this.page + 1, rp, y, pw, H);
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x + W / 2 - 7, y, 14, H);   // the gutter
    // the page turning over
    if (this.turn > 0) {
      const k = 1 - this.turn, sq = Math.cos(k * Math.PI), bw = pw * Math.abs(sq), bx = (this.turnDir > 0 ? sq > 0 : sq < 0) ? x + W / 2 : x + W / 2 - bw;
      ctx.fillStyle = '#e4dabf'; ctx.fillRect(bx, y, bw, H); ctx.fillStyle = `rgba(0,0,0,${0.22 * (1 - Math.abs(sq))})`; ctx.fillRect(bx, y, bw, H);
    }
    // the cover swinging open
    if (e < 1) { const cw = pw * (1 - e); ctx.fillStyle = '#34425a'; ctx.fillRect(x + W / 2, y - 5, cw, H + 10); }
    ctx.restore();
    // corners to turn the page with the mouse
    const m = G.input.mouse;
    if (m.pressed && e > 0.9) { if (m.ux < x + 40) this.go(-1); else if (m.ux > x + W - 40) this.go(1); }
    ink(ctx, `${this.page + 1} / ${PAGES.length}`, x + W / 2, y + H - 5, { align: 'center', size: 8, color: LEAD });
  }
}
G.DiaryScene = DiaryScene;
G.PRISON_DIARY_PAGES = PAGES;

// inside, P is the diary. The notebook is issued at booking and handed back at release.
const GS = G.GameScene.prototype, _u = GS.update;
GS.update = function (dt) {
  const I_ = G.input, p = this.player;
  if (G.scenes.top() === this && p && !p.dead && G.prison.inside(this) && I_.wasPressed('phone')) {
    if (!p.inventory.has('prison_diary')) p.inventory.add('prison_diary');
    for (const k of I_.bindings.phone) I_.pressed.delete(k);
    G.scenes.push(new DiaryScene(this));
    return;
  }
  return _u.call(this, dt);
};
G.prison.note = (w, text) => { if (w.jail) (w.jail.notes = w.jail.notes || []).push([w.day, text]); };
const J = G.jail, _imp = J.imprison, _rel = J.release;
J.imprison = function (scene) { const r = _imp.apply(this, arguments); scene.player.inventory.add('prison_diary'); G.prison.note(scene.world, 'Booked in. Orange suits me about as well as you would think.'); return r; };
J.release = function (scene) { scene.player.inventory.remove('prison_diary', 1); return _rel.apply(this, arguments); };
// escaping: it stays behind too
G.events.on('hour', () => { const p = G.player, w = G.world; if (p && w && !w.jail && p.inventory && p.inventory.has('prison_diary')) p.inventory.remove('prison_diary', 1); });
})();
