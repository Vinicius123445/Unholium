'use strict';
// Hotwiring is automatic now: pick "Hotwire it" and your character does it. How fast and how sure depends on
// the Hotwiring skill (and a little on Knowledge and luck):
//   no skill: about 7 s, roughly a coin flip;  rank 1: about 4 s, usually;  rank 2: about 2 s, almost always.
// A police car is harder. A failed try just means it did not catch: try again. [Esc] stops.
(() => {
class AutoHotwire {
  constructor(game, v, onStart) {
    this.transparent = true; this.game = game; this.v = v; this.onStart = onStart; this.t = 0; this.sparkT = 0;
    const p = game.player, rank = G.skills.rank(p, 'hotwire'), know = G.attr ? G.attr.get(p, 'knowledge') - 3 : 0, luck = G.skills.stat(p, 'luck') || 0;
    const cop = v.model === 'police_car';
    this.dur = [7, 4, 2][Math.min(2, rank)] * (cop ? 1.4 : 1) * (1 - Math.max(-0.2, know * 0.03));
    this.chance = G.util.clamp(0.5 + rank * 0.22 + know * 0.03 + luck * 0.04 - (cop ? 0.15 : 0), 0.25, 0.97);
    this.rank = rank;
    G.audio.play('click');
  }
  update(dt) {
    const I = G.input;
    if (I.wasPressed('cancel')) { G.scenes.remove(this); this.game.toast('You leave the wires alone.'); return; }
    this.t += dt;
    if ((this.sparkT -= dt) <= 0) { this.sparkT = 0.35 + Math.random() * 0.4; G.audio.play('click'); }
    if (this.t < this.dur) return;
    G.scenes.remove(this);
    if (Math.random() < this.chance) { G.audio.play('engine'); G.events.emit('xp', 15, 'Hotwiring'); this.onStart(); }
    else { G.audio.play('error'); this.game.toast(G.rng.pick(['Sparks, a cough... it does not catch. Try again.', 'Wrong pair. The dash stays dark.']), 'warn'); }
  }
  render(ctx) {
    const U = G.ui, R = G.renderer, w = 190, h = 44, x = (R.uiW - w) / 2, y = R.uiH - 110;
    U.panel(ctx, x, y, w, h);
    U.text(ctx, `Hotwiring${this.rank ? ` (skill ${this.rank})` : ''}...`, x + w / 2, y + 7, { align: 'center', size: 9 });
    U.bar(ctx, x + 12, y + 22, w - 24, 6, Math.min(1, this.t / this.dur), '#e8c040');
  }
}
G.HotwireScene = AutoHotwire;
})();
