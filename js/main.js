'use strict';
// Boot: init engine subsystems, generate assets, show the main menu, start the loop.
// Debug helpers are exposed on G.debug (open the browser console: e.g. G.debug.give('gem', 3)).

(function boot() {
  const canvas = document.getElementById('game');
  G.renderer.init(canvas);
  G.input.init(canvas);
  G.cursor.init(canvas);
  G.assets.init();
  G.scenes.push(new G.MenuScene());
  G.loop.start();
  canvas.focus();
  (function bootDone() { const s = document.getElementById('boot'); if (!s) return; if (!(G.realMat && G.realMat.ready)) { setTimeout(bootDone, 100); return; } s.style.opacity = 0; setTimeout(() => s.remove(), 500); })();
  if (G.desktop && G.settings.get('fullscreen')) G.platform.post('fullscreen:1');

  const game = () => G.scenes.stack.find((s) => s instanceof G.GameScene);
  G.debug = {
    game,
    give(id, n = 1) { game().player.inventory.add(id, n); },
    gold(n = 100) { game().player.gold += n; },
    heal() { const p = game().player; p.hp = p.maxHp; },
    time(hour) { const w = G.world; const d = ((hour * 60 - w.minutes) + 1440) % 1440; w.addMinutes(d); game().resyncNPCs(); },
    days(n = 1) { G.world.skipHours(24 * n); game().resyncNPCs(); },
    tp(mapId, spawn) { game().changeMap(mapId, spawn || Object.keys(G.maps.get(mapId).points).find((k) => k.startsWith('from_'))); },
    rep(key, n) { G.world.addRep(key, n); },
    bounty(region, n) { G.world.bounty[region] = n; },
    kill(id) { const a = game().actors.find((x) => x.id === id); if (a) G.combat.damage(a, 9999, game().player, game()); },
    xp(n = 100) { G.skills.addXp(game().player, n, 'debug', game()); },
    points(n = 10) { game().player.skills.points += n; },
    effect(id, secs = 60, power = 1) { G.effects.add(game().player, id, secs, power); },
    drunk(n = 50) { game().player.alcohol = n; },
    // love: G.debug.romance('r_farmwife') maxes romance; G.debug.pregnant(30) makes you 30 weeks pregnant; G.debug.weeks(5) moves every pregnancy 5 weeks ahead
    romance(id, n = 100) { G.world.npcs[id].romance = n; G.world.npcs[id].disp = Math.max(G.world.npcs[id].disp || 0, 40); },
    pregnant(weeks = 0) { const p = game().player; p.preg = { day: G.world.day - weeks, father: 'r_farmer2', known: weeks >= 3, harm: 0 }; p.refreshSprite(); },
    weeks(n = 1) { const w = G.world, p = game().player; if (p.preg) p.preg.day -= n; for (const id in w.npcs) if (w.npcs[id].preg) w.npcs[id].preg.day -= n; },
    // gang war: G.debug.raid('gang_blue', 's_ne') starts an attack now; G.debug.turf('s_ne', 'gang_blue', 80) sets an owner
    raid(attacker, territory) { const w = G.world; w.raid = null; G.gangWar.startRaid(w, attacker, territory); },
    turf(id, owner, control = 60) { G.world.territories[id] = { owner, control }; },
    epilogue() { G.world.flags.epilogue = true; console.log('Epilogue unlocked: talk to the harbormaster or use the boat in the city.'); },
    world: () => G.world,
  };
})();
