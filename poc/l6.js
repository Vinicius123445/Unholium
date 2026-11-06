module.exports = (G, g, p, shot, tick) => {
  g.loadMap('city', 'start'); tick(10);
  // real rider, real bike, close; clock by a wall; a swing mid-air; weapon in a fight stance
  const moto = new G.Vehicle({ model: 'moto_red', x: p.x + 60, y: p.y, angle: 0 }); g.vehicles.push(moto); moto.driver = p; moto.update = () => {}; p.vehicle = null;
  G.riders.lookOf = G.riders.lookOf; tick(30); shot('rider');
  moto.driver = null; g.vehicles.pop();
  p.inventory.add('crowbar', 1); p.equipFromSlot(p.inventory.slots.findIndex((q) => q && q.id === 'crowbar')); p.dir = 2; p.aim = 0; p.mouseHeld = true; tick(4); shot('ready'); p.mouseHeld = false;
  p.dir = 0; tick(2); shot('rest');
  p.attackCd = 0; p.dir = 2; G.combat.attack(p, g); let n = 0; while (p.swing && n < 8) { tick(1); n++; } shot('swing');
};
