'use strict';
// Benzos, honestly, and naloxone for the people around you.
//   Xanax alone does not stop your breathing (benzodiazepines on their own almost never kill): too much of
//   it blacks you out. Hours go missing. You come to somewhere you do not recognize, in clothes that are
//   not yours, with your pockets full of things that are not yours either. Mixed with alcohol or opioids
//   it is a real overdose, as before.
//   Naloxone only reverses opioids. When the benzos (and the drink) are what is keeping someone under, it
//   does nothing: you, an NPC or a companion stay down.
//   Someone who passed out from an overdose (a companion, anyone): [E] on them offers "Give them naloxone"
//   if you carry some. On an opioid overdose they gasp awake.
//   NPCs who take too much Xanax sleep it off where they are.
(() => {
const E = G.effects, FX = G.npcFx, GS = G.GameScene.prototype;
const now = () => (G.world ? G.world.day * 1440 + G.world.minutes : 0);
const BLACKOUT = 60;   // benzo load (about three pills close together) that takes the night away
const mixed = (alcohol, opioid) => alcohol >= 20 || opioid >= 10;   // the other depressants that make it deadly

// ---------------------------------------------------------------- the player
const _risk = E.risk;
E.risk = function (p, cls) {
  if (cls === 'benzo') { const s = this.drugState(p); if (!mixed(p.alcohol || 0, s.load.opioid || 0)) return 0; }
  return _risk.apply(this, arguments);
};
// naloxone: only the opioid part
const _consume = E.consume;
E.consume = function (p, it, scene) {
  const resp = it && it.antidote ? this.get(p, 'resp_depression') : null, left = resp ? resp.t : 0;
  const r = _consume.apply(this, arguments);
  if (resp) {
    const s = this.drugState(p), still = ((s.load.benzo || 0) + (p.alcohol || 0) * 0.8) / (G.DRUG_CLASSES.benzo.od + (s.tol.benzo || 0) * 0.3);
    if (still >= 0.9 && (s.load.benzo || 0) > 15) { this.add(p, 'resp_depression', Math.max(left, 8)); if (scene) scene.toast('The naloxone does nothing. It is not opioids keeping your breathing down. It is the benzos and the booze.', 'bad'); }
  }
  return r;
};
const _pu = G.pills.update;
G.pills.update = function (p, dt, scene) {
  const r = _pu.apply(this, arguments);
  const s = E.drugState(p);
  if ((s.load.benzo || 0) >= BLACKOUT && !mixed(p.alcohol || 0, s.load.opioid || 0) && !scene.passingOut && !p.dead && !(p.benzoOutT > now() - 60)) G.benzo.blackout(scene);
  return r;
};

// ---------------------------------------------------------------- the blackout
const LOOT = [['jewelry', [1, 3]], ['designer_watch', [1, 1]], ['smartphone', [1, 2]], ['wallet', [1, 3]], ['lipstick', [1, 2]], ['sunglasses', [1, 1]], ['perfume', [1, 1]], ['cigarettes', [1, 3]],
  ['gem', [1, 2]], ['documents', [1, 2]], ['keycard', [1, 1]], ['wine', [1, 2]], ['whiskey', [1, 1]], ['painkillers', [1, 2]], ['xanax', [1, 3]], ['candy', [2, 5]], ['photo', [1, 1]], ['copper_ring', [1, 2]], ['tv_remote', [1, 1]], ['letter', [1, 2]]];
const DISTRICTS = ['city', 'southside', 'eastside', 'suburbs', 'heights', 'industrial', 'rural', 'farmland'];
G.benzo = {
  BLACKOUT,
  blackout(scene) {
    if (scene.passingOut || G.scenes.top() !== scene) return;
    const p = scene.player, w = scene.world;
    p.benzoOutT = now();
    scene.passingOut = true;
    scene.toast('Everything slides sideways. You do not remember the next part.', 'bad');
    G.scenes.push(new G.FadeScene(() => {
      scene.passingOut = false;
      try { this.wakeElsewhere(scene); } catch (e) { if (G.reportError) G.reportError(e); }
    }, 2.2));
  },
  wakeElsewhere(scene) {
    const p = scene.player, w = scene.world, s = E.drugState(p);
    const hours = 5 + Math.floor(Math.random() * 6);
    if (p.vehicle) G.vehicles.exit(scene, true);
    p.sitting = null; p.dragging = null; p.draggingNpc = null; p.pouring = null;
    w.skipHours(hours);
    s.load.benzo = Math.min(s.load.benzo || 0, 18);
    // somewhere else: another part of town, out on the street
    const maps = DISTRICTS.filter((id) => G.MAPGEN[id] && id !== scene.map.id);
    const dest = maps.length && Math.random() < 0.8 ? G.rng.pick(maps) : scene.map.id;
    if (dest !== scene.map.id) { const pts = G.maps.get(dest).points; scene.loadMap(dest, Object.keys(pts).find((k) => k.startsWith('from_')) || (pts.start ? 'start' : Object.keys(pts)[0])); }
    const m = scene.map;
    for (let k = 0; k < 40; k++) {
      const tx = 4 + Math.floor(Math.random() * (m.w - 8)), ty = 4 + Math.floor(Math.random() * (m.h - 8));
      const at = m.randomWalkableNear ? m.randomWalkableNear(tx, ty, 3, G.rng, false) : null;
      if (at && !m.buildingAtTile(at.x, at.y) && !G.TILES[m.get(at.x, at.y)].water) { p.x = at.x * 16 + 8; p.y = at.y * 16 + 12; break; }
    }
    // dressed in someone else's clothes
    const pick = (a) => a[Math.floor(Math.random() * a.length)], cols = ['#e8e4dc', '#2a2a30', '#a83232', '#3a8a4a', '#4070d8', '#6a3a8a', '#d8782a', '#2a8a8a', '#d070a0', '#c8a038', '#7a5a3a'];
    const style = (slot) => { const all = Object.keys((G.CLOTH_STYLES || {})[slot] || {}); return all.length ? pick(all) : null; };
    for (const slot of ['top', 'bottom', 'shoes']) {
      const st = style(slot); if (!st) continue;
      const id = G.clothId(slot, st, pick(cols), slot === 'top' && Math.random() < 0.3 ? pick(cols) : null);
      if (G.clothItem(id)) p.equip[slot] = id;
    }
    if (Math.random() < 0.15 && style('mask')) { const id = G.clothId('mask', style('mask'), '#2a2a30'); if (G.clothItem(id)) p.equip.mask = id; }
    p.refreshSprite && p.refreshSprite(); p.refreshStats && p.refreshStats();
    // and pockets full of things that are not yours
    const n = 4 + Math.floor(Math.random() * 5), got = [];
    for (let k = 0; k < n; k++) { const [id, [a, b]] = pick(LOOT); if (!G.ITEMS[id]) continue; const q = a + Math.floor(Math.random() * (b - a + 1)); p.inventory.add(id, q); got.push(G.ITEMS[id].name.toLowerCase()); }
    const cash = Math.random() < 0.6 ? 20 + Math.floor(Math.random() * 180) : 0; p.gold += cash;
    w.stats.stolen = (w.stats.stolen || 0) + n;
    const region = G.maps.get(scene.map.id).meta.region || scene.region;
    if (Math.random() < 0.35) w.commitCrime('theft', region, true, null, 60 + Math.floor(Math.random() * 140));   // someone saw you that night
    E.add(p, 'nausea', 40); E.add(p, 'drowsy', 120);
    p.stamina = Math.min(p.stamina, 30);
    scene.resyncNPCs();
    scene.toast(`You come to ${hours} hours later. Somewhere you do not recognize. These are not your clothes.`, 'bad');
    w.log(`You blacked out on Xanax and lost ${hours} hours. You woke up ${m.meta && m.meta.name ? 'in ' + m.meta.name : 'somewhere else'}, in someone else's clothes, with ${[...new Set(got)].slice(0, 4).join(', ')}${got.length > 4 ? ' and more' : ''}${cash ? ` and $${cash}` : ''} in your pockets. None of it is yours.`, 'bad');
  },
};

// ---------------------------------------------------------------- NPCs
FX.risk = (function (_r) {
  return function (npc, cls) {
    if (cls !== 'benzo') return _r.apply(this, arguments);
    const s = this.st(npc), c = G.DRUG_CLASSES.benzo;
    if (!mixed(s.alcohol || 0, s.drugs.load.opioid || 0)) return 0;
    return ((s.drugs.load.benzo || 0) + s.alcohol * 0.8 + (s.drugs.load.opioid || 0) * 0.6) / (c.od + (s.drugs.tol.benzo || 0) * 0.3);
  };
})(FX.risk);
const _fu = FX.update;
FX.update = function (npc, dt, scene) {
  const r = _fu.apply(this, arguments);
  const s = npc.st;
  if (!s.drugs || !(s.drugs.load.benzo > 0) || s.ko || npc.dead) return r;
  if (this.risk(npc, 'benzo') >= 1 && !this.has(npc, 'resp_depression')) {   // benzos + drink or opioids: a real overdose
    this.add(npc, 'resp_depression', 30); s.drugs.load.benzo *= 0.8;
    npc.say('...so... tired... can\'t...', 3); G.ko.passOut(scene, npc, 120 + Math.random() * 240, 'overdose'); s.ko.cls = 'benzo';
    if (scene.toast && s.companion) scene.toast(`${npc.displayName} has stopped breathing properly. Benzos and booze. Naloxone will not fix this one.`, 'bad');
  } else if (s.drugs.load.benzo >= BLACKOUT) {   // alone: they nod off where they are and sleep it off
    npc.say(G.rng.pick(['*slurs* ...I just need... to sit down...', 'Whoa... everything is... *yawns*', '...mmh...']), 3);
    G.ko.passOut(scene, npc, 90 + Math.random() * 150, 'benzo'); s.drugs.load.benzo *= 0.6;
  }
  return r;
};
// naloxone given to an NPC: only the opioid part
const _use = FX.use;
FX.use = function (scene, npc, id) {
  const it = G.item(id), s = this.st(npc);
  const ko = s.ko, until = ko && ko.until, resp = this.has(npc, 'resp_depression');
  const benzoish = it && it.antidote && (((s.drugs.load.benzo || 0) + s.alcohol * 0.8) / G.DRUG_CLASSES.benzo.od >= 0.9 && (s.drugs.load.benzo || 0) > 15 || (ko && (ko.cls === 'benzo' || ko.reason === 'benzo')));
  const r = _use.apply(this, arguments);
  if (r != null && benzoish) {
    if (resp) this.add(npc, 'resp_depression', 20);
    if (ko && s.ko === ko && until) ko.until = until;
    npc.say('...', 2);
    return '(No response. The naloxone does nothing: it only reverses opioids.)';
  }
  return r;
};
// giving it to someone who is out: from the [E] menu on an unconscious person
G.aid.narcan = function (scene, npc) {
  const p = scene.player;
  if (!p.inventory.has('naloxone')) return;
  p.inventory.remove('naloxone', 1);
  const s = FX.st(npc); s.inv = s.inv || []; s.inv.push(['naloxone', 1]);
  const said = FX.use(scene, npc, 'naloxone');
  G.audio.play('select');
  const woke = !s.ko || s.ko.until <= now();
  if (woke && s.ko) { s.ko.until = now(); }
  scene.toast(woke ? `You spray the naloxone into ${npc.displayName}'s nose. They gasp awake.` : `You spray the naloxone into ${npc.displayName}'s nose. Nothing happens. ${said && said.startsWith('(') ? 'It only reverses opioids.' : ''}`, woke ? 'good' : 'bad');
  if (woke && G.fate) G.fate.good('heal_other', { key: 'narcan:' + npc.id + ':' + Math.floor(now() / 60) });
};
})();
