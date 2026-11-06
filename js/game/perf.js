'use strict';
// Keeping frames cheap.
//   Drawing: props are looked up by row (an index rebuilt only when props are added or removed) instead of
//   scanning every prop on the map every frame.
//   Thinking: people far off screen who are just going about their day (not fighting, fleeing, following
//   you or on an errand you are part of) think every other frame, with twice the time step.
(() => {
const TM = G.TileMap.prototype;
TM.decorInView = function (view) {
  if (!this._rows || this._rowsLen !== this.decor.length || this._rowsDirty) {
    this._rows = new Array(this.h + 4); this._rowsLen = this.decor.length; this._rowsDirty = false;
    for (const d of this.decor) { const r = G.util.clamp(Math.floor(d.y / 16), 0, this.h + 3); (this._rows[r] = this._rows[r] || []).push(d); }
  }
  const out = [], r0 = Math.max(0, Math.floor(view.y / 16)), r1 = Math.min(this.h + 3, Math.ceil((view.y + view.h + 48) / 16));
  for (let r = r0; r <= r1; r++) { const row = this._rows[r]; if (row) for (const d of row) out.push(d); }
  return out;
};
// any change to the props marks the index stale (moving a prop in place, too)
for (const name of ['addDecor', 'addDecorRuntime', 'removeDecorRuntime', 'finalize']) {
  const f = TM[name]; TM[name] = function () { this._rowsDirty = true; return f.apply(this, arguments); };
}
const NP = G.NPC.prototype, _upd = NP.update;
NP.update = function (dt, scene) {
  const p = scene.player;
  if (p && !this.dead && this.state === 'schedule' && !this.talking && !this.st.companion && !this.evTask && !this.swing && !this.meet && !this.dodge && !(this.cower > 0)) {
    const far = Math.abs(this.x - p.x) > 520 || Math.abs(this.y - p.y) > 380;
    if (far) { this.lodSkip = !this.lodSkip; if (this.lodSkip) return; return _upd.call(this, dt * 2, scene); }
  }
  return _upd.call(this, dt, scene);
};
})();
