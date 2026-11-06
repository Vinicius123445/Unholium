'use strict';
// Fishing. Stand by water with a rod and press [E] (or use the rod from your inventory).
//   Cast:  hold [E] to charge, let go: the stronger the cast, the further out (deeper water, bigger fish).
//   Wait:  fish bite faster at dawn and dusk, with bait (one per hooked fish), and with the Angler skill.
//   Bite:  the bobber dips. Strike ([E]) quickly or it is gone.
//   Reel:  hold [E] to reel in; that raises the tension. Keep it in the green: too high and the line snaps,
//          too low for too long and the fish throws the hook. Big fish pull hard.
// What bites depends on the water (lake, pond, sea, deep sea), the hour, bait, skill and luck.
// Raw fish heals a little; cook it at a stove or campfire. Trophy fish sell for a lot.
(() => {
const U = G.ui;
//   [item, weight, strength 1..5, min lb, max lb, where, when]
const FISH = [
  ['fish_bluegill', 30, 1, 0.2, 1.2, 'fresh', 'day'], ['fish_bass', 18, 3, 1, 8, 'fresh', 'any'], ['fish_catfish', 14, 3, 2, 25, 'fresh', 'night'],
  ['fish_carp', 16, 2, 3, 30, 'fresh', 'any'], ['fish_trout', 10, 2, 0.5, 6, 'fresh', 'dawn'], ['fish_pike', 5, 4, 4, 30, 'fresh', 'any'],
  ['fish_golden', 0.4, 5, 8, 40, 'lake', 'dawn'],
  ['fish_snapper', 22, 3, 2, 20, 'salt', 'any'], ['fish_tuna', 4, 5, 60, 400, 'deep', 'any'],
  ['old_boot', 6, 1, 1, 2, 'any', 'any'],
];

G.fishing = {
  waterAt(map, tx, ty) { const t = G.TILES[map.get(tx, ty)]; return t && t.water ? t.name : null; },
  // The water the player is facing (within 3 tiles), or null.
  facing(scene) {
    const p = scene.player, [fx, fy] = G.util.DIR_VEC[p.dir], tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16);
    for (let k = 1; k <= 3; k++) { const w = this.waterAt(scene.map, tx + fx * k, ty + fy * k); if (w) return { tx: tx + fx * k, ty: ty + fy * k, fx, fy, kind: w }; }
    return null;
  },
  zone(scene, spot) {
    const id = scene.map.id;
    if (spot.kind === 'pool') return 'pool';
    if (id === 'island' || id === 'city' || id === 'eastside') return spot.kind === 'deepwater' ? 'deep' : 'salt';
    if (id === 'rural') return 'lake';
    return 'fresh';
  },
  timeOf(w) { const h = w.hourF; return h >= 5 && h < 8 ? 'dawn' : h >= 17 && h < 20 ? 'dusk' : h >= 21 || h < 5 ? 'night' : 'day'; },
  pick(scene, zone) {
    const p = scene.player, w = scene.world, t = this.timeOf(w), luck = G.skills.stat(p, 'luck') || 0, big = G.skills.has(p, 'big_one');
    const ok = FISH.filter((f) => f[5] === 'any' || f[5] === zone || (f[5] === 'fresh' && zone === 'lake') || (f[5] === 'salt' && zone === 'deep'));
    const weight = (f) => {
      let wt = f[1];
      if (f[6] === 'night') wt *= t === 'night' ? 3 : 0.4;
      if (f[6] === 'dawn') wt *= t === 'dawn' || t === 'dusk' ? 3 : 0.5;
      if (f[6] === 'day') wt *= t === 'day' ? 1.5 : 0.8;
      if (f[2] >= 4) wt *= (big ? 3 : 1) * (1 + luck * 0.25);
      if (f[0] === 'old_boot') wt *= Math.max(0.2, 1 - luck * 0.2);
      return wt;
    };
    const total = ok.reduce((s, f) => s + weight(f), 0);
    let r = Math.random() * total;
    for (const f of ok) { r -= weight(f); if (r <= 0) return f; }
    return ok[0];
  },
  start(scene) {
    const p = scene.player;
    if (!p.inventory.has('fishing_rod')) { scene.toast('You need a fishing rod.'); return false; }
    if (p.swimming || p.vehicle) { scene.toast('Not from here.'); return false; }
    const spot = this.facing(scene);
    if (!spot) { scene.toast('Face the water to fish.'); return false; }
    if (spot.kind === 'pool') { scene.toast('Nothing lives in a swimming pool. Probably.'); return false; }
    G.scenes.push(new FishingScene(scene, spot));
    return true;
  },
};

class FishingScene {
  constructor(game, spot) {
    this.transparent = true; this.game = game; this.spot = spot; this.zone = G.fishing.zone(game, spot);
    this.phase = 'charge'; this.power = 0; this.t = 0; this.msg = 'Hold to cast, let go to throw.';
  }
  get p() { return this.game.player; }
  biteTime() {
    const p = this.p, w = this.game.world, t = G.fishing.timeOf(w);
    let s = G.rng.range(6, 18) * (1 - G.skills.rank(p, 'angler') * 0.15);
    if (p.inventory.has('bait')) s *= 0.5;
    if (t === 'dawn' || t === 'dusk') s *= 0.7;
    return s;
  }
  update(dt) {
    const I = G.input, held = I.isDown('interact') || I.isDown('confirm');
    this.t += dt;
    this.game.world.advance(dt);   // the clock keeps running while you fish
    if (I.wasPressed('cancel')) { G.scenes.remove(this); return; }
    switch (this.phase) {
      case 'charge':
        if (held) this.power = Math.min(1, this.power + dt * 0.9);
        else if (this.power > 0.05) {
          const d = 1 + Math.round(this.power * 3), { fx, fy } = this.spot;
          const tx = Math.floor(this.p.x / 16) + fx * d, ty = Math.floor((this.p.y - 3) / 16) + fy * d;
          const kind = G.fishing.waterAt(this.game.map, tx, ty);
          if (!kind) { this.msg = 'Your line lands on the ground. Try again.'; this.power = 0; return; }
          this.bob = { x: tx * 16 + 8, y: ty * 16 + 8 };
          if (kind === 'deepwater' && this.zone === 'salt') this.zone = 'deep';
          this.phase = 'wait'; this.wait = this.biteTime(); this.t = 0; this.msg = 'Waiting for a bite...';
          G.audio.play('swing');
        }
        break;
      case 'wait':
        if (this.t >= this.wait) { this.phase = 'bite'; this.t = 0; this.window = 0.85 + G.skills.rank(this.p, 'angler') * 0.12; this.msg = 'A BITE! Strike!'; G.audio.play('select'); }
        else if (I.wasPressed('interact')) { this.msg = 'You reel in too early. Nothing. Cast again.'; this.phase = 'charge'; this.power = 0; }
        break;
      case 'bite':
        if (I.wasPressed('interact') || I.wasPressed('confirm')) {
          this.fish = G.fishing.pick(this.game, this.zone);
          if (this.p.inventory.has('bait')) this.p.inventory.remove('bait', 1);
          this.phase = 'reel'; this.progress = 0.15; this.tension = 0.45; this.slack = 0; this.pull = 0; this.t = 0;
          this.msg = 'Hold to reel. Keep the tension in the green!';
        } else if (this.t > this.window) { this.msg = 'Too slow. It got away.'; this.phase = 'charge'; this.power = 0; }
        break;
      case 'reel': {
        const str = this.fish[2], skill = G.skills.rank(this.p, 'angler');
        // the fish fights in bursts
        if ((this.pullT = (this.pullT || 0) - dt) <= 0) { this.pullT = G.rng.range(0.5, 1.6); this.pull = Math.random() < 0.55 ? G.rng.range(0.1, 0.25) * str : 0; }
        this.tension += ((held ? 0.55 : -0.5) + this.pull * 0.6) * dt;
        this.progress += (held ? 0.16 - str * 0.012 + skill * 0.02 : -0.03) * dt * (this.tension > 0.85 ? 0.3 : 1);
        this.tension = G.util.clamp(this.tension, 0, 1);
        const band = 0.17 + skill * 0.03;
        if (this.tension >= 1) { this.msg = 'SNAP! The line broke.'; this.phase = 'charge'; this.power = 0; G.audio.play('hit'); }
        else if (this.tension < band) { this.slack += dt; if (this.slack > 1.6) { this.msg = 'Slack line. The fish threw the hook.'; this.phase = 'charge'; this.power = 0; } }
        else this.slack = 0;
        if (this.progress >= 1) this.land();
        break;
      }
      case 'caught':
        if (this.t > 0.4 && (I.wasPressed('interact') || I.wasPressed('confirm'))) { this.phase = 'charge'; this.power = 0; this.msg = 'Hold to cast again.'; }
        break;
    }
  }
  land() {
    const w = this.game.world, [id, , str, lo, hi] = this.fish, it = G.item(id);
    const lb = +(lo + Math.pow(Math.random(), 2.2) * (hi - lo)).toFixed(1);
    this.p.inventory.add(id, 1);
    const rec = (w.fishing = w.fishing || { caught: 0, records: {} });
    rec.caught++;
    const best = rec.records[id] || 0;
    if (id !== 'old_boot' && lb > best) rec.records[id] = lb;
    this.phase = 'caught'; this.t = 0;
    this.catch = { id, lb, record: id !== 'old_boot' && lb > best && best > 0 };
    this.msg = id === 'old_boot' ? 'An old boot. Classic.' : `${it.name}, ${lb} lb!${this.catch.record ? ' A new personal record!' : ''}`;
    G.audio.play('pickup');
    G.events.emit('xp', id === 'old_boot' ? 1 : 3 + str * 3, 'Fishing');
    if (id === 'fish_golden') w.log(`You caught the legendary Golden Carp (${lb} lb)!`, 'quest');
  }
  render(ctx) {
    const R = G.renderer, p = this.p;
    // the line and the bobber, in the world
    if (this.bob && this.phase !== 'charge') {
      R.worldTransform();
      const dip = this.phase === 'bite' ? 3 : this.phase === 'reel' ? 2 + Math.sin(this.t * 20) : Math.sin(this.t * 2.5);
      const tipX = p.x + G.util.DIR_VEC[p.dir][0] * 10, tipY = p.y - 18 + G.util.DIR_VEC[p.dir][1] * 6;
      const bx = this.phase === 'reel' ? tipX + (this.bob.x - tipX) * (1 - this.progress) : this.bob.x, by = this.phase === 'reel' ? tipY + (this.bob.y - tipY) * (1 - this.progress) : this.bob.y;
      ctx.strokeStyle = 'rgba(240,240,240,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + 6, bx, by + dip); ctx.stroke();
      ctx.fillStyle = '#e83a3a'; ctx.fillRect(bx - 1.5, by + dip - 2, 3, 2); ctx.fillStyle = '#f8f8f8'; ctx.fillRect(bx - 1.5, by + dip, 3, 1.5);
      if (this.phase === 'bite') { ctx.fillStyle = '#ffe040'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('!', bx - 2, by - 6); }
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(tipX, tipY); ctx.stroke(); ctx.lineWidth = 1;
    }
    R.uiTransform();
    const W = 240, x = (R.uiW - W) / 2, y = R.uiH - 78;
    U.panel(ctx, x, y, W, 64);
    U.text(ctx, this.msg, R.uiW / 2, y + 8, { align: 'center', size: 9 });
    if (this.phase === 'charge') { ctx.fillStyle = '#1a1a20'; ctx.fillRect(x + 20, y + 28, W - 40, 10); ctx.fillStyle = '#5ab0e8'; ctx.fillRect(x + 20, y + 28, (W - 40) * this.power, 10); U.text(ctx, 'power', x + 20, y + 42, { size: 7, color: U.colors.dim }); }
    if (this.phase === 'reel') {
      const band = 0.17 + G.skills.rank(p, 'angler') * 0.03;
      ctx.fillStyle = '#5a1a1a'; ctx.fillRect(x + 20, y + 26, W - 40, 8);
      ctx.fillStyle = '#2a7a3a'; ctx.fillRect(x + 20 + (W - 40) * band, y + 26, (W - 40) * (0.85 - band), 8);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 20 + (W - 40) * this.tension - 1, y + 23, 3, 14);
      U.text(ctx, 'tension', x + 20, y + 37, { size: 7, color: U.colors.dim });
      ctx.fillStyle = '#1a1a20'; ctx.fillRect(x + 20, y + 48, W - 40, 5); ctx.fillStyle = '#e8c040'; ctx.fillRect(x + 20, y + 48, (W - 40) * Math.min(1, this.progress), 5);
    }
    if (this.phase === 'caught') { U.icon(ctx, G.item(this.catch.id).icon, R.uiW / 2 - 16, y + 24, 2); }
    if (this.phase === 'wait') U.text(ctx, `${G.fishing.timeOf(this.game.world)} · ${p.inventory.has('bait') ? 'with bait (' + p.inventory.count('bait') + ')' : 'no bait'}`, R.uiW / 2, y + 34, { align: 'center', size: 7, color: U.colors.dim });
  }
}
G.FishingScene = FishingScene;

// using the rod from the inventory, or [E] while facing water with a rod
G.ITEM_USE = G.ITEM_USE || {};
G.ITEM_USE.fishing_rod = (game) => { const top = G.scenes.top(); if (top !== game) G.scenes.remove(top); return G.fishing.start(game); };
const GS = G.GameScene.prototype, _find = GS.findInteraction, _interact = GS.interact;
GS.findInteraction = function () {
  const best = _find.call(this);
  if (best || !this.player.inventory.has('fishing_rod') || this.player.swimming) return best;
  const spot = G.fishing.facing(this);
  return spot && spot.kind !== 'pool' ? { type: 'fish', label: 'Fish' } : best;
};
GS.interact = function () {
  if (this.promptTarget && this.promptTarget.type === 'fish') { G.fishing.start(this); return; }
  return _interact.call(this);
};
// cook fish on stoves and campfires
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  if (d.def.interact === 'campfire') {
    const p = scene.player;
    let n = 0;
    for (const f of FISH) if (f[0] !== 'old_boot' && f[0] !== 'fish_golden') { const c = p.inventory.count(f[0]); if (c) { p.inventory.remove(f[0], c); n += c; } }
    if (n) { p.inventory.add('cooked_fish', n); scene.toast(`You cook ${n} fish.`, 'good'); }
  }
  return _use.call(this, d, scene);
};
})();
