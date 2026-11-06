'use strict';
// Less on screen. Every toast goes through here:
//   Minimal (default): only what needs attention now: danger, the police, major quest events, and
//     "you can't do that" feedback. At most 2 at once.
//   Normal: also good news and warnings. At most 3.   All: everything, as before (6).
// Repeats are merged ("x2"), the same message is not shown again within a few seconds, long ones are cut.
// Whatever is not shown goes to the phone: LifeLog > Notifications (gossip, reputation, gang war, faction
// and rank news, job updates...). Damage numbers only show with the debug view on.
// Settings > Gameplay: Notifications, Speech bubbles.
(() => {
const S = G.settings;
S.defaults.notifications = 0;   // 0 minimal, 1 normal, 2 all
S.defaults.bubbles = true;
if (S.data.notifications == null) S.data.notifications = 0;
if (S.data.bubbles == null) S.data.bubbles = true;

const URGENT = /\b(?:police|cop|arrest|wanted|detective|jail|died|dead|dying|kill|attack|fire|burn|smoke|overdose|starv|dehydrat|bleed|hurt|danger|run|camera|saw you|witness|caught|alarm|bounty)/i;   // (from the start of a word: not the kill in skill)
const NOPE = /can(no|')t|not enough|need |needs |no room|full|locked|too far|nothing to|out of stock|no .* left|not interested|cannot afford|does not|won't|failed/i;
const FLAVOR = /reputation|rumor|gossip|gang war|is moving on|turf|rank|standing|contacts|added to|Business:|news|said|whispers|joined|faction/i;
const MAJOR = /quest|job done|job:|new job|initiation|completed|complete|started|ending|you are no longer/i;

const N = G.notify = {
  mode() { return S.get('notifications') || 0; },
  max() { return [2, 3, 6][this.mode()]; },
  keep(text, type) {
    const m = this.mode();
    if (m >= 2) return true;
    if (FLAVOR.test(text) && !URGENT.test(text)) return false;
    if (type === 'bad' || URGENT.test(text) || NOPE.test(text)) return true;
    if (type === 'quest' && MAJOR.test(text)) return true;
    if (m >= 1 && (type === 'good' || type === 'warn' || type === 'quest')) return true;
    return false;
  },
  shorten(t) { t = String(t); return t.length > 72 ? t.slice(0, 70).trim() + '…' : t; },
  // the phone's notification list
  feed(w, text, type) { if (!w) return; const f = w.notes = w.notes || []; f.push({ day: w.day, min: Math.floor(w.minutes), text: String(text), type }); if (f.length > 80) f.shift(); },
};

const GS = G.GameScene.prototype, _toast = GS.toast;
GS.toast = function (text, type = 'info') {
  if (text == null || text === '') return;
  text = String(text);
  const keep = N.keep(text, type);
  N.feed(this.world, text, type);
  if (!keep) return;
  const short = N.shorten(text);
  // merge repeats; skip the same message shown a moment ago
  const same = this.toasts.find((t) => t.base === short);
  if (same) { same.n = (same.n || 1) + 1; same.text = `${short} (x${same.n})`; same.t = 4; return; }
  this._recent = this._recent || {};
  if (this._recent[short] && this.time - this._recent[short] < 5) return;
  this._recent[short] = this.time;
  _toast.call(this, short, type);
  const last = this.toasts[this.toasts.length - 1];
  if (last) last.base = short;
  // never more than the mode allows: the oldest goes first, but danger stays over chatter
  while (this.toasts.length > N.max()) {
    const i = this.toasts.findIndex((t) => t.type !== 'bad');
    this.toasts.splice(i >= 0 && i < this.toasts.length - 1 ? i : 0, 1);
  }
};
// damage numbers: debug only (hit flashes and flinches say it already)
const _ft = GS.floatText;
GS.floatText = function (x, y, text, color) {
  if (/^[-+]?\d+!?$/.test(String(text)) && !this.debug) return;
  return _ft.call(this, x, y, text, color);
};
// NPC barks: off with the speech bubble setting (the important ones still reach you as toasts)
const NP = G.NPC.prototype, _say = NP.say;
if (_say) NP.say = function (text, t) { if (S.get('bubbles') === false) return; return _say.call(this, text, t); };

// phone: LifeLog > Notifications
G.PHONE_SCREENS.notes = (ps) => (ps.w.notes || []).slice().reverse().slice(0, 40).map((n) => ({ label: n.text, sub: `Day ${n.day}, ${G.util.formatTime(n.min)}`, color: { bad: '#ff8a7a', good: '#8ae0b0', quest: '#ffd86a', warn: '#ffb060' }[n.type] || null, info: true }));
})();
