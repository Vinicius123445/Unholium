'use strict';
// Journal: quests, event log (consequences), factions, reputation, rumors, stats, gang territories.
(() => {
const U = G.ui;
const TABS = ['Quests', 'Log', 'Factions', 'Reputation', 'Rumors', 'Stats', 'Turf'];

class JournalScene {
  constructor(game) {
    this.transparent = true;
    this.game = game;
    G.audio.play('page');
    this.tab = 0;
    this.scroll = 0;
  }
  update() {
    const I = G.input;
    if (I.wasPressed('left') || I.wasPressed('tabLeft')) { this.tab = (this.tab + TABS.length - 1) % TABS.length; this.scroll = 0; G.audio.play('select'); }
    if (I.wasPressed('right') || I.wasPressed('tabRight')) { this.tab = (this.tab + 1) % TABS.length; this.scroll = 0; G.audio.play('select'); }
    if (I.wasPressed('down')) this.scroll++;
    if (I.wasPressed('up')) this.scroll = Math.max(0, this.scroll - 1);
    if (I.wasPressed('cancel') || I.wasPressed('journal')) { G.audio.play('back'); G.scenes.remove(this); }
  }
  render(ctx) {
    U.dim(ctx, 0.6);
    const R = G.renderer, w = this.game.world;
    const W = 460, H = 280, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    if (this.inPhone) U.phoneBezel(ctx, x, y, W, H);
    U.panel(ctx, x, y, W, H, { title: 'Journal', titleSize: 13 });
    TABS.forEach((t, i) => {
      const b = U.button(ctx, x + 12 + i * 62, y + 24, 60, 16, t, { selected: this.tab === i, size: 9 });
      if (b.clicked) { this.tab = i; this.scroll = 0; }
    });
    this.drawBody(ctx, x, y, W, H);
  }

  // the page under the tabs (the Windows look draws its own frame and tabs around it: js/game/xpscreens.js)
  drawBody(ctx, x, y, W, H) {
    const w = this.game.world;
    if (G.input.mouse.wheel) this.scroll = Math.max(0, this.scroll + G.input.mouse.wheel);
    const cx = x + 16, cy = y + 50, cw = W - 32;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, cy - 2, W - 8, H - 70);
    ctx.clip();
    let yy = cy - this.scroll * 12;
    const line = (text, o = {}) => { yy += U.textBlock(ctx, text, cx + (o.indent || 0), yy, cw - (o.indent || 0), Object.assign({ size: 9 }, o)) + (o.gap || 2); };

    if (this.tab === 0) {
      const ids = Object.keys(w.quests);
      if (!ids.length) line('No quests yet. Talk to people — some of them need help.', { color: U.colors.dim });
      for (const state of ['active', 'done', 'failed']) {
        for (const id of ids.filter((k) => w.quests[k].state === state)) {
          const q = G.questDef(w, id), st = w.quests[id];
          const col = state === 'active' ? '#ffd86a' : state === 'done' ? U.colors.good : U.colors.bad;
          line(`${q.title}  [${state}]`, { weight: 'bold', color: col, size: 10 });
          line(q.desc, { indent: 8, color: U.colors.dim });
          if (state === 'active') q.objectives.forEach((o, i) => {
            const prog = o.type === 'kill' ? ` (${Math.min(st.progress[i] || 0, o.count)}/${o.count})` : o.type === 'have' ? ` (${Math.min(this.game.player.inventory.count(o.item), o.count)}/${o.count})` : w.flags[o.flag] ? ' (done)' : '';
            line(`• ${o.text}${prog}`, { indent: 8 });
          });
          yy += 6;
        }
      }
    } else if (this.tab === 1) {
      const entries = w.journal.slice().reverse();
      for (const e of entries) {
        const col = { bad: '#ff8a7a', good: U.colors.good, quest: '#ffd86a', warn: '#ffb060' }[e.type] || U.colors.text;
        line(`Day ${e.day} ${G.util.formatTime(e.time)} — ${e.text}`, { color: col });
      }
    } else if (this.tab === 2) {
      this.drawFactions(ctx, cx, yy, cw, w);
    } else if (this.tab === 3) {
      line('Regions', { weight: 'bold', color: U.colors.borderLight, size: 10 });
      for (const r in G.REGIONS) {
        const v = w.getRep(r);
        const b = w.bounty[r] || 0, t = w.tension[r] || 0;
        line(`${G.REGIONS[r].name}: ${v} (${G.repLabel(v)})${t >= 30 ? `   Tension ${t >= 50 ? 'high (curfew)' : 'rising'}` : ''}`, { indent: 8, color: v < -25 ? '#ff8a7a' : v > 25 ? U.colors.good : U.colors.text });
      }
      yy += 6;
      line('Other groups', { weight: 'bold', color: U.colors.borderLight, size: 10 });
      for (const f in G.FACTIONS) {
        if (G.FACTIONS[f].listed) continue;
        const v = w.getRep(f);
        line(`${G.FACTIONS[f].name}: ${v} (${G.repLabel(v)})`, { indent: 8 });
      }
    } else if (this.tab === 4) {
      const rs = w.rumors.slice().reverse();
      if (!rs.length) line('You have not heard anything interesting yet.', { color: U.colors.dim });
      for (const r of rs) line(`Day ${r.day}${r.region ? ' · ' + G.REGIONS[r.region].name : ''}: "${r.text}"`);
    } else if (this.tab === 6) {
      G.gangWar.ensure(w);
      for (const g of G.GANGS) {
        const f = G.FACTIONS[g];
        line(`${f.name}: ${G.gangWar.ownedBy(w, g).length} blocks · ${G.gangWar.members(w, g)} known members · strength ${G.gangWar.strength(w, g)}${w.isMember(g) ? '  [your gang]' : ''}`, { color: f.color, weight: 'bold' });
      }
      if (w.raid) {
        const t = G.TERRITORIES[w.raid.territory];
        line(`ATTACK IN PROGRESS: ${G.FACTIONS[w.raid.attacker].name} vs ${w.raid.defender ? G.FACTIONS[w.raid.defender].name : 'nobody'} at ${t.name} (until ${G.util.formatTime(w.raid.end % 1440)})`, { color: '#ff7a6a' });
      }
      yy += 4;
      for (const id in G.TERRITORIES) {
        const t = G.TERRITORIES[id], st = w.territories[id], f = st.owner && G.FACTIONS[st.owner];
        U.text(ctx, t.name, cx, yy, { size: 9 });
        U.text(ctx, f ? f.name : 'Unclaimed', cx + 230, yy, { size: 9, color: f ? f.color : U.colors.dim });
        if (f) U.bar(ctx, cx + 320, yy + 2, 100, 7, st.control / 100, f.color);
        yy += 13;
      }
    } else {
      const s = w.stats;
      const mins = Math.floor(s.playSeconds / 60);
      [
        `Day ${w.day}, ${w.timeString}`,
        `Time played: ${Math.floor(mins / 60)}h ${mins % 60}m`,
        `People killed: ${s.murders}`,
        `Animals killed: ${s.animals}`,
        `Crimes committed: ${s.crimes}`,
        `Notable people dead: ${Object.keys(w.dead).length}`,
        `Forest wildlife: ${Object.entries(w.wildlifeReport('forest')).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`,
      ].forEach((t) => line(t));
      // substance use: addiction (dependence) and tolerance per drug class
      const ds = G.effects.drugState(this.game.player);
      const habits = Object.keys(G.DRUG_CLASSES).filter((c) => (ds.addiction[c] || 0) >= 1 || (ds.tol[c] || 0) >= 5);
      yy += 6;
      line('Substances', { weight: 'bold', color: U.colors.borderLight, size: 10 });
      if (!habits.length) line('Clean.', { indent: 8, color: U.colors.dim });
      for (const c of habits) {
        const a = Math.round(ds.addiction[c] || 0), dep = G.effects.dependent(this.game.player, c);
        line(`${G.DRUG_CLASSES[c].name}: addiction ${a}${dep ? (a >= 60 ? ' (severely dependent)' : ' (dependent)') : ''} · tolerance ${Math.round(ds.tol[c] || 0)}`, { indent: 8, color: dep ? '#ff9a7a' : U.colors.text });
      }
    }
    ctx.restore();
    if (this.tab === 2) U.text(ctx, 'Helping one faction affects its rivals and allies. Ask any member to join. Members rise through the ranks by doing faction work.', x + W / 2, y + H - 24, { size: 8, align: 'center', color: U.colors.dim });
  }

  // Faction meters: -100 .. +100 with the neutral point in the middle.
  drawFactions(ctx, x, y, w, world) {
    const ids = G.listedFactions();
    ids.forEach((id, i) => {
      const f = G.FACTIONS[id];
      const v = world.getRep(id);
      const ry = y + i * (ids.length > 6 ? 29 : 34);
      const member = world.isMember(id);
      U.text(ctx, f.name + (member ? `  [${G.factionRanks ? G.factionRanks.title(world, id) + ' · ' + G.factionRanks.progress(world, id) : 'member'}]` : ''), x, ry, { size: 10, weight: 'bold', color: f.color });
      U.text(ctx, `${v > 0 ? '+' : ''}${v}  ${G.repLabel(v)}`, x + w, ry, { size: 9, align: 'right', color: v < -25 ? '#ff8a7a' : v > 25 ? U.colors.good : U.colors.text });
      const bx = x, by = ry + 13, bw = w, bh = 8, mid = bx + bw / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = v >= 0 ? f.color : '#a83a2a';
      const len = (Math.abs(v) / 100) * (bw / 2);
      ctx.fillRect(v >= 0 ? mid : mid - len, by + 1, len, bh - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(mid - 0.5, by - 1, 1, bh + 2);
      for (const t of [-60, -25, 25, 60]) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(mid + (t / 100) * (bw / 2), by, 1, bh); }
      const enemies = ids.filter((o) => G.factionsAtWar(id, o)).map((o) => G.FACTIONS[o].name);
      if (enemies.length) U.text(ctx, 'At war with: ' + enemies.join(', '), x, ry + 23, { size: 7, color: U.colors.dim });
    });
  }
}

G.JournalScene = JournalScene;
JournalScene.TABS = TABS;
})();
