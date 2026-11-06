'use strict';
// Time that passes in one go (sleeping, waiting, passing out, the debug skips) passes for your body too:
// highs, hangovers, withdrawal and every other timed effect wear off if you wait or sleep through as long
// as they would have lasted, and alcohol leaves your blood. (Effects run in real seconds; this converts
// the skipped game time into the real seconds it stands for.)
(() => {
const W = G.World.prototype, _skip = W.skipHours;
W.skipHours = function (h) {
  const r = _skip.call(this, h);
  return r;   // (what the body does meanwhile: js/game/gameclock.js)
};
})();
