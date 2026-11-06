// The same four pictures from the same game state, in the browser build and the native one.
globalThis.PocScene = function (shot, done) {
  const ready = () => {
    if (!(G.realMat && G.realMat.ready)) { setTimeout(ready, 50); return; }
    try {
      G.loop.running = false; G.law.off = true; G.happenings.off = true; G.travel.off = true; G.settings.data.notifications = 2;
      if (G.streetlife) G.streetlife.off = true;
      G.scenes.replace(new G.GameScene({})); const g = G.scenes.top(), p = g.player;
      const walls = () => { for (let i = 0; i < 34; i++) G.loop.draw(); };
      const go = (map, spawn, fn, name) => { g.loadMap(map, spawn); for (let i = 0; i < 6; i++) G.loop.tick(1 / 60); fn(); for (let i = 0; i < 30; i++) G.loop.tick(1 / 60); g.map.finishGround && g.map.finishGround(); walls(); shot(name); };
      go('city', 'start', () => {}, 'city');
      go('city', 'start', () => { const b = g.map.buildings.find((x) => x.id === 'c_tavern'); p.x = (b.x + b.w / 2) * 16; p.y = (b.y + b.h / 2) * 16 + 8; }, 'bar');
      go('rural', 'start', () => {}, 'rural');
      go('heights', 'from_city', () => {}, 'heights');
      done();
    } catch (e) { done(e); }
  };
  ready();
};
