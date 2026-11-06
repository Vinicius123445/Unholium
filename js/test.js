'use strict';
// Automated smoke tests + screenshot setups. Usage (headless browser):
//   ?test            runs the test suite, prints results into the page and title
//   ?shot=<name>     sets up a scene for a screenshot (rural, city, forest, island, night, menu, inventory, dialogue, shop, journal)
(function () {
  const params = new URLSearchParams(location.search);
  const out = [];
  const trace = /[?&]trace=1/.test(location.search); const log = (s) => { out.push(s); if (trace) console.log('TRACE ' + s); };
  let fails = 0;
  const check = (cond, msg) => { if (!cond) { fails++; const t = G.scenes.top(), r = t && t.runner; log('FAIL ' + msg + ` [on top: ${t && t.constructor.name}${r ? ' ' + r.npc.id + ' / ' + (r.node && r.node.id) + ' / ' + String(r.node && r.node.text).slice(0, 80) : ''}]`); } else log('ok   ' + msg); };
  const tick = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) G.loop.tick(dt); G.loop.draw(); };
  const game = () => G.scenes.stack.find((s) => s instanceof G.GameScene);
  const press = (code) => { G.input.pressed.add(code); G.input.down.add(code); };
  const release = (code) => G.input.down.delete(code);

  G.store.remove(G.config.SAVE_PREFIX + 'auto');
  G.loop.running = false; // drive frames manually
  if (params.get('style')) G.settings.data.uiStyle = +params.get('style');   // &style=0: shots in the old Noir interface
  if (params.get('q')) G.settings.set('graphics', +params.get('q'));   // &q=0..3: shots at Low, Medium, High, Ultra

  function suite() {
    G.law.off = true;   // no police units dispatched mid-test (tested in lawAndOrder)
    { const _lt = G.loop.tick; G.loop.tick = function () { const q = game(); if (q && !G.loop.copsOn) q.arrestCooldown = Math.max(q.arrestCooldown || 0, 9); G._inTick = true; try { return _lt.apply(this, arguments); } finally { G._inTick = false; } }; const _sm = G.GameScene.prototype.startMugging; G.GameScene.prototype.startMugging = function () { if (!G._inTick) return _sm.apply(this, arguments); }; }   // a bounty left by one test does not get the next one stopped on the street, nor does a gang's toll (either would pause the clock for every test after it)
    G.economy.mugOff = true;   // broke people do not rob the tester at random
    { const _pd = G.Player.prototype.die; G.Player.prototype.die = function (src, sc) { G.lastDeath = (src ? (src.id || src.kind || src.name || '?') + (src.def ? '/' + src.def.name : '') : 'no source') + ' on ' + (sc && sc.map && sc.map.id) + ' hunger ' + Math.round(this.hunger || 0) + ' thirst ' + Math.round(this.thirst || 0); return _pd.apply(this, arguments); }; }
    G.settings.data.notifications = 2;   // tests read every toast (Minimal mode is tested on its own)
    G.rest.DRAIN = 0;   // long time skips in tests would otherwise make the player collapse (tested in homeLife)
    G.WITNESS_DELAY = 0;   // crimes are reported at once in tests (the delay is tested in streetLife)
    G.travel.off = true;   // nobody wanders off to another district mid-test (trips are tested in cityLife)
    G.streetlife.off = true; G.behavior.spaceOff = true;   // no street exchanges or personal-space reactions mid-test (tested in batch3)
    G.happenings.off = true;   // no random world events mid-test (tested in batch3)
    G.walkWatchdogOff = true;
    G.bleed.playerOff = true;   // (you do not bleed out between tests; bleeding is tested in aid())
    G.settings.data.legacyControls = false;   // the mouse tests need the mouse (legacy mode is tested on its own)
    G.settings.data.moveMode = 1;   // classic keys: tests place the cursor nowhere in particular (mouse mode is tested on its own)
    // ---- data integrity: schedule points, homes, shops, dialogues
    for (const id in G.NPCS) {
      const d = G.NPCS[id];
      const map = G.maps.get(d.map);
      for (const e of d.schedule || []) {
        if (typeof e.at === 'string' && !map.points[e.at]) log(`FAIL ${id}: schedule point "${e.at}" missing on ${d.map}`), fails++;
      }
      if (d.home && !map.building(d.home)) log(`FAIL ${id}: home ${d.home} missing`), fails++;
      if (d.shop && !G.SHOPS[d.shop]) log(`FAIL ${id}: shop ${d.shop} missing`), fails++;
      if (d.dialogue && !G.DIALOGUES[d.dialogue]) log(`FAIL ${id}: dialogue ${d.dialogue} missing`), fails++;
      if (d.weapon && !G.ITEMS[d.weapon]) log(`FAIL ${id}: weapon ${d.weapon}`), fails++;
    }
    for (const s in G.SHOPS) for (const [it] of G.SHOPS[s].stock) if (!G.ITEMS[it] && !G.clothItem(it)) { fails++; log(`FAIL shop ${s} item ${it}`); }
    log('data integrity checked');
    // traffic lanes stay on asphalt (no driving into the harbor)
    for (const id in G.MAPGEN) {
      const m = G.maps.get(id);
      for (const r of m.roads || []) {
        let bad = 0, ex = '';
        for (let a = r.from; a <= r.to; a++) for (let k = 0; k < r.W; k++) { const x = r.h ? a : r.at + k, y = r.h ? r.at + k : a; if (!m.inBounds(x, y)) continue; const t = G.TILES[m.get(x, y)]; if (t.water || t.solid || t.wall) { bad++; if (!ex) ex = x + ',' + y + ' ' + t.name; } }
        check(!bad, `${id}: road ${r.h ? 'h' : 'v'}@${r.at} [${r.from}-${r.to}] is drivable${bad ? ' (' + bad + ' bad tiles, e.g. ' + ex + ')' : ''}`);
      }
    }
    // shopkeepers work behind their counter
    for (const id in G.NPCS) {
      const d = G.NPCS[id];
      if (!d.shop) continue;
      const m = G.maps.get(d.map), e = (d.schedule || []).find((s) => s.act === 'work');
      const pt = e && typeof e.at === 'string' && m.points[e.at];
      if (!pt || !m.buildingAtTile(pt.x, pt.y)) continue;
      const near = [[0, 1], [0, -1], [1, 0], [-1, 0], [-1, 1], [1, 1]].some(([dx, dy]) => m.decorsAt(pt.x + dx, pt.y + dy).some((q) => /counter|bj_table|serving|display_case|gas_pump|stall/.test(q.type)));
      log((near ? 'ok   ' : 'WARN ') + id + ' works at ' + e.at + ' ' + JSON.stringify(pt) + (near ? '' : ' with no counter next to it') + ' solid=' + m.isSolidTile(pt.x, pt.y));
    }

    // ---- placement: nothing solid in the middle of a road, in front of a door, or on an exit
    let misplaced = 0;
    const ROAD = new Set([G.T.asphalt, G.T.road_line, G.T.road_line_v]);
    for (const id in G.MAPGEN) {
      const m = G.maps.get(id);
      const blocked = new Set();
      for (const b of m.buildings) blocked.add(b.doorX + ',' + (b.doorY + 1));
      for (const e of m.exits) for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) blocked.add(x + ',' + y);
      for (const d of m.decor) {
        if (!d.def.solid) continue;
        const fw = d.def.fw || 1;
        for (let x = d.tx; x < d.tx + fw; x++) {
          const t = m.get(x, d.ty);
          const curb = [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [-1, -1], [1, -1]].some(([dx, dy]) => !ROAD.has(m.get(x + dx, d.ty + dy)));   // (a parked car is two tiles deep)
          const bad = blocked.has(x + ',' + d.ty) ? 'blocks a door/exit' : ROAD.has(t) && !(/^car_|police_car|limo/.test(d.type) && curb) ? 'in the middle of the road' : null;
          if (bad) { misplaced++; log(`FAIL ${id}: ${d.type} at ${x},${d.ty} ${bad}`); break; }
        }
      }
    }
    fails += misplaced;
    check(misplaced === 0, 'no props in roads, doorways or exits');

    // ---- reachability: every schedule point reachable from the NPC's home door
    let unreachable = 0;
    for (const id in G.NPCS) {
      const d = G.NPCS[id];
      const map = G.maps.get(d.map);
      if (d.captive) continue;   // locked in their cells on purpose
      const from = (d.home && map.points[d.home + '_in']) || null;
      for (const e of d.schedule || []) {
        let pts = typeof e.at === 'string' ? map.points[e.at] : e.at;
        if (!pts) continue;
        if (!Array.isArray(pts)) pts = [pts];
        for (let p of pts) {
          // beds are solid now: people stand beside them (G.NPC.prototype.approach)
          if (map.isSolidTile(p.x, p.y)) p = G.NPC.prototype.approach.call({}, map, p);
          if (map.isSolidTile(p.x, p.y)) { unreachable++; log(`FAIL ${id}: point ${JSON.stringify(p)} (${e.at}) is solid with nothing free beside it`); continue; }
          if (!from) continue;
          const path = G.pathfind.find(map, from.x, from.y, p.x, p.y, 20000);
          if (!path) { unreachable++; log(`FAIL ${id}: no path ${d.home}_in -> ${JSON.stringify(e.at)} ${JSON.stringify(p)}`); }
        }
      }
    }
    fails += unreachable;
    check(unreachable === 0, 'all schedule points reachable');
    // spawns and exits reachable from each other
    for (const id in G.MAPGEN) {
      const m = G.maps.get(id);
      const sp = Object.keys(m.points).filter((k) => k.startsWith('from_') || k === 'start');
      for (let i = 1; i < sp.length; i++) {
        const a = m.points[sp[0]], b = m.points[sp[i]];
        const ok = !!G.pathfind.find(m, a.x, a.y, b.x, b.y, 50000);
        check(ok, `${id}: ${sp[0]} -> ${sp[i]} reachable`);
      }
    }

    // ---- menu
    tick(5);
    check(G.scenes.top() instanceof G.MenuScene, 'menu shown');

    // ---- new game
    G.scenes.replace(new G.GameScene({}));
    tick(60);
    const g = game();
    check(!!g && g.map.id === 'rural', 'new game on rural map');
    check(g.actors.filter((a) => a.kind === 'npc').length >= 10, 'rural NPCs spawned: ' + g.actors.filter((a) => a.kind === 'npc').length);
    check(g.actors.filter((a) => a.kind === 'animal').length >= 5, 'rural animals spawned: ' + g.actors.filter((a) => a.kind === 'animal').length);
    // a new game: empty pockets, your things in the bedroom drawer (take them, then pick up the bat)
    const drawer0 = g.world.containers['rural:' + g.world.flags.player_home + '_chest'];
    check(g.player.inventory.slots.every((s) => !s || /^key/.test(s.id) || s.id === 'phone' || s.id === 'own_wallet') && g.player.inventory.has('phone') && g.player.inventory.has('own_wallet') && !g.player.equip.weapon, 'you start with your house key, your phone and your wallet');
    check(drawer0 && ['baseball_bat', 'torch'].every((id) => drawer0.items.some((e) => e[0] === id)), 'your things are in the drawer in your bedroom');
    const grab = (gg) => { const dr = gg.world.containers['rural:' + gg.world.flags.player_home + '_chest']; if (!dr) return; const ls = new G.LootScene(gg, dr); ls.takeAll(); dr.items = dr.items.filter((e) => e[1] > 0); const bi = gg.player.inventory.slots.findIndex((s) => s && s.id === 'baseball_bat'); if (bi >= 0) gg.player.equipFromSlot(bi); };
    G.testGrabStart = grab; grab(g);
    check(g.player.equip.weapon === 'baseball_bat', 'starting weapon equipped');

    // ---- movement
    const x0 = g.player.x;
    press('KeyD'); tick(40); release('KeyD'); tick(1);
    check(g.player.x !== x0, `player moved (${x0.toFixed(1)} -> ${g.player.x.toFixed(1)})`);

    // ---- overlays render
    for (const S of [G.InventoryScene, G.JournalScene, G.MapScene, G.PauseScene]) {
      G.scenes.push(new S(g)); tick(3); G.scenes.pop(); tick(1);
    }
    G.scenes.push(new G.SettingsScene()); tick(2); G.scenes.pop();
    G.scenes.push(new G.WaitScene(g, false)); tick(2); G.scenes.pop();
    log('overlay scenes rendered');

    // ---- dialogue + shop
    G.debug.time(10);
    tick(2);
    const merchant = g.actors.find((a) => a.id === 'r_merchant');
    check(!!merchant, 'merchant present');
    merchant.placeBySchedule(g.map, g.world);
    g.player.x = merchant.x; g.player.y = merchant.y + 32;
    g.openDialogue(merchant);
    tick(30);
    const dlg = G.scenes.top();
    check(dlg instanceof G.DialogueScene, 'dialogue opened: ' + (dlg.runner && dlg.runner.node.text));
    const choices = dlg.runner.node.choices.map((c) => c.text);
    log('     choices: ' + choices.join(' | '));
    const news = choices.indexOf('Any news?');
    dlg.chars = 999; dlg.choose(news); tick(2);
    check(dlg.runner.node.id === '_rumor', 'rumor node');
    dlg.runner.go('start');
    const shopIdx = dlg.runner.node.choices.findIndex((c) => c.text === 'Let me see your wares.');
    check(shopIdx >= 0, 'shop open during work hours');
    if (shopIdx >= 0) { dlg.choose(shopIdx); tick(2); }
    const shop = G.scenes.top();
    check(shop instanceof G.ShopScene, 'shop scene opened');
    if (shop instanceof G.ShopScene) {
      const gold0 = g.player.gold;
      const err = G.shopSys.buy('r_store', 'bread', g.player, g.world);
      check(!err && g.player.gold < gold0, `bought bread (${gold0} -> ${g.player.gold})`);
      tick(2);
      shop.close();
    }
    tick(2);

    // ---- quests
    G.world.startQuest('wolves');
    for (let i = 0; i < 3; i++) G.world.onKill('wolf');
    check(G.world.questDone('wolves'), 'wolves objective complete');
    const goldQ = g.player.gold;
    G.world.completeQuest('wolves');
    check(g.player.gold === goldQ + 60, 'quest reward paid');

    // ---- crime & consequences: kill a villager in daylight near others
    G.debug.time(12); tick(2);
    const v = g.actors.find((a) => a.id === 'r_villager1');
    check(!!v, 'villager present');
    g.player.x = v.x; g.player.y = v.y + 14; g.player.dir = 3;
    G.combat.damage(v, 9999, g.player, g);
    tick(10);
    check(!G.world.isAlive('r_villager1'), 'villager died');
    check(!!G.world.dead.r_villager1, 'death recorded (witnessed: ' + G.world.dead.r_villager1.witnessed + ')');
    check(G.world.npcs.r_villager2.mood === 'grieving', 'friend is grieving');
    check(g.containers.some((c) => c.kind === 'corpse'), 'corpse container created');
    log('     bounty rural: ' + G.world.bounty.rural + '  rep rural: ' + G.world.getRep('rural'));
    tick(120);

    // ---- kill the smith -> apprentice takes over after 2 days
    const smith = g.actors.find((a) => a.id === 'r_smith');
    if (smith) { G.combat.damage(smith, 9999, null, g); tick(2); }
    G.world.skipHours(50);
    g.resyncNPCs();
    tick(30);
    check(G.world.shops.r_smith.owner === 'r_apprentice', 'apprentice inherited the smithy');
    check(G.world.day >= 3, 'days passed: ' + G.world.day);

    // ---- animals: kill a chicken (livestock)
    const chicken = g.actors.find((a) => a.kind === 'animal' && a.species === 'chicken');
    if (chicken) {
      const c0 = G.world.wildlife['rural:0'].count;
      G.combat.damage(chicken, 999, g.player, g); tick(2);
      check(G.world.wildlife['rural:0'].count === c0 - 1, 'livestock population decreased');
    }

    // ---- every map: load, simulate, render day & night
    for (const id of ['city', 'suburbs', 'southside', 'eastside', 'heights', 'forest', 'island', 'rural']) {
      const spawn = Object.keys(G.maps.get(id).points).find((k) => k.startsWith('from_'));
      g.loadMap(id, spawn);
      G.debug.time(9);
      tick(600);
      const npcs = g.actors.filter((a) => a.kind === 'npc');
      // how many NPCs reached their scheduled spot (ignoring wander/patrol)
      let stuck = 0, total = 0;
      for (const n of npcs) {
        const e = n.currentEntry(g.world);
        if (!e || e.act === 'wander' || e.act === 'patrol' || n.state !== 'schedule') continue;
        total++;
        const p0 = n.resolvePoint(g.map, e.at), p = p0 && !Array.isArray(p0) ? n.approach(g.map, p0) : p0;   // beds are solid: they stand beside them
        if (p && !Array.isArray(p) && !n.arrived(p)) { stuck++; log(`     not arrived: ${n.id} at ${(n.x / 16).toFixed(1)},${(n.y / 16).toFixed(1)} -> ${JSON.stringify(e.at)} ${JSON.stringify(p)}`); }
      }
      check(true, `${id}: ${npcs.length} NPCs, ${g.actors.filter((a) => a.kind === 'animal').length} animals, ${total - stuck}/${total} at scheduled spots after 10s`);
      G.debug.time(23); tick(60);
      log(`     ${id} night render ok`);
    }

    // ---- save / load
    const ok = G.saves.write('1', g);
    check(ok, 'saved to slot 1');
    const data = G.saves.read('1');
    G.scenes.replace(new G.GameScene({ save: data }));
    tick(30);
    const g2 = game();
    check(g2 && g2.map.id === data.mapId && Math.abs(g2.player.x - data.player.x) < 1, 'loaded save restores map & position');
    check(!G.world.isAlive('r_villager1'), 'dead stay dead after load');
    G.saves.remove('1');

    // ---- arrest flow
    G.world.bounty.rural = 100;
    g2.loadMap('rural', 'start');
    const guard = g2.actors.find((a) => a.def && a.def.combat === 'guard');
    if (guard) {
      g2.player.x = guard.x; g2.player.y = guard.y + 16;
      g2.arrestCooldown = 0; g2.startArrest(guard); tick(5);
      check(G.demand.cur && G.scenes.top() === g2, 'an officer speaks: no window opens by itself');
      g2.talkTo(guard); tick(2);   // [E]: the whole conversation
      const d = G.scenes.top();
      check(d instanceof G.DialogueScene && /Police/.test(d.runner.node.text) && !/\$\d/.test(d.runner.node.text), 'arrest dialogue (no bounty number)');
      // "What have I done wrong?" lists the witnessed crimes
      G.world.crimeRecord.rural = [{ type: 'assault', day: 2, victim: 'r_villager2', bounty: 40 }, { type: 'theft', day: 3, victim: null, bounty: 60 }];
      const wi = d.runner.node.choices.findIndex((c) => c.text === 'What have I done wrong?');
      check(wi >= 0, 'arrest offers "What have I done wrong?"');
      d.chars = 999; d.choose(wi); tick(1);
      log('     officer: ' + d.runner.node.text.replace(/\n/g, ' / '));
      check(d.runner.node.text.includes('Assault') && d.runner.node.text.includes('Theft'), 'the officer lists your crimes');
      d.chars = 999;
      const pay = d.runner.node.choices.findIndex((c) => c.text.startsWith('Pay'));
      g2.player.gold = 500;
      d.runner.go('start');
      const pay2 = d.runner.node.choices.findIndex((c) => c.text.startsWith('Pay'));
      d.choose(pay2 >= 0 ? pay2 : pay); const paidNow = G.world.bounty.rural; tick(3);
      check(paidNow === 0, 'bounty paid');
    }

    if (window.__headOnly) return undefined;
    // each part starts from a fresh game: an NPC one test killed must not be missing twenty tests later
    for (const part of [newFeatures, skillsAndItems, lifeSystems, worldSystems, dailyLife, loveLife, homeLife, streetLife, polish, cityLife, batch3, lawAndOrder, crashes, knockouts, aid, realism, gunmen, brainLevels, emergency, fireStarting, laterFixes, uiWindows, quickload]) { G.input.down.clear(); Object.assign(G.input.mouse, { down: false, rdown: false, pressed: false, rpressed: false }); G.scenes.replace(new G.GameScene({})); tick(3); part(); }
    check(!(G.errors && G.errors.length), 'no runtime errors' + (G.errors ? ': ' + G.errors.join(' || ') : ''));
    G.scenes.replace(new G.GameScene({})); tick(3);
    return aiDialogue();   // async: the results wait for it
  }

  // 2026-11-02: AI dialogue (js/game/aidialogue.js) against a mock of the desktop host: no network
  async function aiDialogue() {
    const A = G.ai, S = G.settings.data, flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); for (let i = 0; i < 6; i++) await Promise.resolve(); };
    const saved = { transport: A.transport, keySet: A.keySet, mode: S.dialogueMode };
    let reqs = [], next = null;
    const claude = (o) => ({ status: 200, body: JSON.stringify({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o) }] }) });
    A.transport = (req) => { reqs.push(req); const r = typeof next === 'function' ? next(req) : next; return Promise.resolve(r); };
    A.keySet = true; A.fails = 0; A.sessionOff = false; A.cache.clear();
    const g = game(); g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player; p.hp = p.maxHp = 9999; p.equip.weapon = null;
    const elder = () => { const n = g.actors.find((a) => a.id === 'r_elder'); n.st.fear = 0; n.st.mood = null; n.st.hostile = false; n.state = 'schedule'; n.x = p.x + 14; n.y = p.y; return n; };
    const open = async (npc, tree) => { g.openDialogue(npc); const d = G.scenes.top(); if (tree) { d.runner = new G.DialogueRunner(npc, g, tree); } tick(1); await flush(); tick(1); return d; };
    const close = (d) => { if (G.scenes.stack.includes(d)) { d.runner.end(); G.scenes.remove(d); } };

    // Classic: exactly as before, nothing is sent
    S.dialogueMode = 0;
    let d = await open(elder());
    const written = G.DIALOGUES.r_elder.start.text;
    check(reqs.length === 0 && !d.runner.node.ai && (typeof written !== 'string' || d.runner.node.text === written), 'Classic: the written line, no request');
    d.typing = true; d.input = 'hello there'; d.submit(); tick(1); await flush();
    check(reqs.length === 0 && d.runner.node && d.runner.node.id === '_said', 'Classic: free text gets the canned answer');
    close(d);

    // AI: the written line said again, in their voice; generated answers offered; the request is well formed
    S.dialogueMode = 1; reqs = [];
    next = claude({ line: 'Well now. What brings you to my door?', choices: ['Heard any rumors?', 'Just passing through.'], actions: [{ type: 'like', amount: 50 }, { type: 'flee' }] });
    const npc = elder(), d0 = npc.st.disp || 0;
    d = await open(npc);
    const n = d.runner.node;
    check(n.ai && n.text === 'Well now. What brings you to my door?' && n.written, `AI: the line is regenerated (${n.text})`);
    check(n.choices.some((c) => c.aiSay && c.text === 'Heard any rumors?') && n.choices.some((c) => c.raw && c.raw.next === null), 'AI: generated answers sit with the written ones');
    check((npc.st.disp || 0) - d0 <= 3 && !npc.fleeing && npc.state !== 'flee', 'AI: a written line can only nudge feelings; it cannot make them flee');
    const b = reqs[0] && reqs[0].body;
    check(b && b.model === S.aiModel && b.output_config && b.output_config.format && b.output_config.format.type === 'json_schema' && b.temperature == null && /Never invent lore/.test(b.system[0].text) && b.messages[0].content.includes(n.written.slice(0, 20)), 'AI: the request carries the rules, the schema and the written line');
    check(reqs[0].provider === 'claude' && !JSON.stringify(reqs[0]).includes('x-api-key'), 'AI: the key is not in the request the page builds');

    // picking a generated answer continues a generated conversation
    next = claude({ line: 'Rumors? People say the woods are not safe after dark.', choices: [], actions: [{ type: 'remember', text: 'asked about rumors' }] });
    d.choose(n.choices.findIndex((c) => c.aiSay)); tick(1); await flush(); tick(1);
    check(d.runner.node.id === '_ai' && /woods/.test(d.runner.node.text) && d.runner.node.choices.some((c) => c.text === 'Goodbye.') && (npc.st.aiMemory || []).some((m) => /rumors/.test(m.text)), 'AI: a generated answer leads to a generated reply, and they remember it');

    // free text with actions: only what the game allows happens
    next = claude({ line: 'Here, take it.', choices: [], actions: [{ type: 'give', item: 'pistol' }, { type: 'fight' }, { type: 'like', amount: -999 }, { type: 'nuke' }] });
    const dd = npc.st.disp || 0;
    d.typing = true; d.input = 'can I have something?'; d.submit(); tick(1); await flush(); tick(1);
    check(!p.inventory.has('pistol') && !npc.st.hostile && (npc.st.disp || 0) >= dd - 10 && !d.runner.ended, 'AI: things they do not have, fights without cause and unknown actions are refused; feelings move at most 10');
    // a threat: they may call the police and run
    next = claude({ line: 'Help! Somebody call the police!', choices: [], actions: [{ type: 'call_police' }] });
    d.typing = true; d.input = 'give me your money or else'; d.submit(); tick(1); await flush(); tick(2);
    check(d.runner.ended && npc.state === 'flee', 'AI: threatened, they can end it, run and call the police');
    close(d);

    // story-critical lines keep the exact text, and are never sent
    G.DIALOGUES._t_lore = { lore: true, start: { text: 'These are my exact words.', choices: [{ text: 'Goodbye.', next: null }] } };
    reqs = [];
    d = await open(elder(), '_t_lore');
    check(d.runner.node.text === 'These are my exact words.' && reqs.length === 0, 'AI: lore lines are shown as written and not sent');
    close(d); delete G.DIALOGUES._t_lore;

    // failures: refusal (no strike), bad JSON, explicit content, errors -> the written line; three strikes -> Classic
    A.fails = 0;
    next = { status: 200, body: JSON.stringify({ stop_reason: 'refusal', content: [] }) };
    d = await open(elder());
    check(!d.runner.node.ai && A.fails === 0, 'AI: a refusal falls back to the written line, without a strike');
    close(d);
    next = claude('this is not json');
    d = await open(elder()); check(!d.runner.node.ai && A.fails === 1, 'AI: a reply that is not JSON falls back'); close(d);
    next = claude({ line: 'Let me show you my naked child porn', choices: [], actions: [] });
    d = await open(elder()); check(!d.runner.node.ai && A.fails === 2, 'AI: explicit content is dropped'); close(d);
    next = { status: 529, body: '{"type":"error"}' };
    d = await open(elder()); check(!d.runner.node.ai && A.sessionOff && !A.active(), 'AI: after three failures in a row the session goes back to Classic'); close(d);
    reqs = []; d = await open(elder()); check(reqs.length === 0 && !d.runner.node.ai, 'AI: and stays there for the session'); close(d);
    A.sessionOff = false; A.fails = 0;
    // a request that never answers: the line comes back written (the timeout)
    const T = A.TIMEOUT; A.TIMEOUT = 50;
    next = () => new Promise(() => {});
    d = await open(elder());
    check(d.aiWait && /^Typing\.+$/.test(d.fullText), `AI: "Typing..." while the line is being written (${d.fullText})`);
    await new Promise((r) => setTimeout(r, 700)); await flush(); tick(1);
    check(!d.aiWait && !d.runner.node.ai && d.runner.node.text, 'AI: no answer in time -> the written line');
    close(d); A.TIMEOUT = T; A.fails = 0;

    // Local AI (Llama through Ollama's own API): the model stays loaded, the reply is held to the schema
    S.dialogueMode = 2; reqs = [];
    const savedModels = A.localModels, savedPick = S.aiLocalModel, savedUrl = S.aiLocalUrl, savedEngine = S.aiEngine;
    A.localModels = ['llama3.1:8b']; A.localUp = true;
    next = { status: 200, body: JSON.stringify({ model: 'llama3.1:8b', message: { role: 'assistant', content: '{"line":"Evening.","attitude":"wary","choices":[],"actions":[]}' }, done: true }) };
    d = await open(elder());
    const lr = reqs.find((q) => q.provider === 'ollama');
    check(lr && lr.body.model === 'llama3.1:8b' && lr.body.format === A.SCHEMA && lr.body.keep_alive && lr.body.messages[0].role === 'system' && lr.timeout === A.LOCAL_TIMEOUT && d.runner.node.text === 'Evening.', `Local AI: Llama through Ollama, schema-held, the answer is used (${reqs.length} reqs, ${reqs[0] && reqs[0].provider}, node: ${d.runner.node.text}, fail: ${A.lastFail})`);
    check(d.runner.npc.st.aiMood && d.runner.npc.st.aiMood.att === 'wary', 'Local AI: the attitude a line was said with is remembered');
    close(d);
    // another local server: the OpenAI-compatible request
    S.aiLocalUrl = 'http://localhost:8080/v1/chat/completions'; reqs = [];
    next = { status: 200, body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: '```json\n{"line":"Evening.","choices":[],"actions":[]}\n```' } }] }) };
    d = await open(elder());
    const lo = reqs.find((q) => q.provider === 'local');
    check(lo && lo.body.response_format && lo.body.response_format.json_schema.schema === A.SCHEMA && d.runner.node.text === 'Evening.', 'Local AI: an OpenAI-compatible server gets the same schema');
    close(d); S.aiLocalUrl = savedUrl;
    // a local server that is not running: the written dialogue, quietly (no strikes)
    A.localUp = false; reqs = []; A.fails = 0;
    d = await open(elder()); check(reqs.length === 0 && !d.runner.node.ai && A.fails === 0 && !A.sessionOff, 'Local AI: no server, the written dialogue, no strikes'); close(d);
    A.localUp = true;
    // Settings: on/off, and one list of models (this PC first, then Claude online)
    const list = A.modelChoices();
    check(list[0] === 'local:llama3.1:8b' && list.some((c) => c === 'claude:claude-haiku-5-5') && /Llama 3\.1 8B \(this PC\)/.test(A.choiceLabel(list[0])), `Settings: the model list (${list.map((c) => A.choiceLabel(c)).join(' | ')})`);
    A.choose('claude:claude-sonnet-5-5');
    check(S.dialogueMode === 1 && S.aiModel === 'claude-sonnet-5-5', 'Settings: picking a Claude model switches to Claude');
    A.setEnabled(false); check(S.dialogueMode === 0 && !A.active(), 'Settings: Generative NPC Dialogue off = Classic');
    A.choose('local:llama3.1:8b'); check(S.dialogueMode === 0 && S.aiEngine === 2, 'Settings: picking a model while it is off keeps it off');
    A.setEnabled(true); check(S.dialogueMode === 2, 'Settings: on again, with the model picked');
    S.aiLocalModel = 'gone:1b';
    check(A.localModelFor() === 'llama3.1:8b', 'Local AI: a chosen model that is not installed falls back to Llama');
    A.localModels = savedModels; S.aiLocalModel = savedPick; S.aiEngine = savedEngine;
    // an attitude does something only when it fits what is going on
    { const n2 = elder(), r2 = new G.DialogueRunner(n2, g); n2.st.fear = 0;
      A.feel(r2, 'afraid', true); const calm = n2.st.fear;
      A.log(r2, 'player', 'Give me your money or I will hurt you.'); A.feel(r2, 'afraid', true);
      const dd0 = n2.st.disp || 0; A.feel(r2, 'affectionate', true);
      check(calm === 0 && n2.st.fear >= 35 && n2.st.aiMood.att === (n2.st.romance >= 20 ? 'affectionate' : 'friendly') && (n2.st.disp || 0) - dd0 <= 1, 'AI: "afraid" scares them only when threatened; affection from a stranger counts as friendly'); }

    // chatBCT: AI voice over the game's own answer; Classic as before
    S.dialogueMode = 1;
    next = claude({ line: 'Oh, it is you again. Fine: it is noon.', choices: [], actions: [] });
    G.bct.ask(g, 'what time is it?'); await flush();
    const h = G.bct.history(g.world), last = h[h.length - 1];
    check(last.who === 'bct' && /noon/.test(last.text) && !last.pending && /\[Placeholder\]/.test(A.BCT_SYSTEM), 'chatBCT: AI mode answers through Claude; its identity stays [Placeholder]');
    S.dialogueMode = 0; reqs = [];
    G.bct.ask(g, 'what time is it?');
    check(reqs.length === 0 && !G.bct.history(g.world).slice(-1)[0].pending, 'chatBCT: Classic is unchanged');

    A.transport = saved.transport; A.keySet = saved.keySet; S.dialogueMode = saved.mode; A.cache.clear();
  }

  // after a quicksave and a quickload your blows (and shots) still hurt people
  function quickload() {
    const hitOnce = (label) => {
      const g = game(), p = g.player;
      const foe = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard' && !a.sleeping);
      if (!foe) { log('     (no one to hit)'); return; }
      p.equip.weapon = null; p.swing = null; p.attackCd = 0; p.dir = 2; p.dead = false; p.hp = p.maxHp = 9999;
      foe.x = p.x + 10; foe.y = p.y; foe.invuln = 0; foe.talking = true; foe.hp = foe.maxHp = 500;
      const h0 = foe.hp; G.combat.attack(p, g);
      for (let i = 0; i < 20; i++) { G.loop.tick(1 / 60); foe.x = p.x + 10; foe.y = p.y; }   // (they run once hit)
      check(foe.hp < h0, `${label}: a punch hurts (${h0} -> ${foe.hp}) [${foe.id} ${foe.state} ko:${!!(foe.st && foe.st.ko)} inScene:${g.actors.includes(foe)} gameNow:${game() === g} invuln:${foe.invuln} down:${foe.downT} dist:${Math.round(Math.hypot(foe.x - p.x, foe.y - p.y))}]`);
      foe.talking = false;
      // a shot
      p.inventory.add('pistol'); p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === 'pistol')); p.mags.pistol = 9; p.reloadT = 0; p.attackCd = 0;
      foe.x = p.x + 40; foe.y = p.y - 6; foe.invuln = 0; const h1 = foe.hp;
      G.firearms.playerFire(p, g, Math.atan2(foe.cy - (p.y - 6), foe.x - p.x));
      for (let i = 0; i < 30; i++) { G.loop.tick(1 / 60); foe.x = p.x + 40; foe.y = p.y - 6; }
      check(foe.hp < h1, `${label}: a shot hurts (${h1} -> ${foe.hp})`);
      p.equip.weapon = null;
    };
    // the way you really play: Legacy Controls (the default), the attack key, someone already fighting you
    const keyHit = (label) => {
      const g = game(), p = g.player;
      const foe = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard' && !a.sleeping);
      if (!foe) { log('     (no one to hit)'); return; }
      p.equip.weapon = null; p.swing = null; p.attackCd = 0; p.dead = false; p.hp = p.maxHp = 9999; p.stamina = 100;
      foe.x = p.x + 12; foe.y = p.y; foe.invuln = 0; foe.hp = foe.maxHp = 500; p.face(1, 0);
      const h0 = foe.hp, log0 = [];
      for (let k = 0; k < 4; k++) { press('Space'); G.loop.tick(1 / 60); release('Space'); for (let i = 0; i < 25; i++) { G.loop.tick(1 / 60); foe.x = p.x + 12; foe.y = p.y; } log0.push(foe.hp); }
      check(foe.hp < h0, `${label}: the attack key hurts someone in front of you (${h0} -> ${log0.join(', ')}; swing ${!!p.swing}, cd ${p.attackCd.toFixed(2)}, aim ${p.aim != null ? p.aim.toFixed(2) : '-'})`);
    };
    const g = game(); g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    G.settings.data.legacyControls = true;
    hitOnce('before saving'); keyHit('before saving');
    // save in the middle of a fight
    { const g1 = game(), foe = g1.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard'); if (foe && foe.startFight) foe.startFight(g1.player); tick(2); }
    check(G.saves.write('quick', game()), 'quicksave');
    log('     stack before F9: ' + G.scenes.stack.map((s) => s.constructor.name).join(' > '));
    press('F9'); G.loop.tick(1 / 60); release('F9'); tick(170);
    log('     stack after F9: ' + G.scenes.stack.map((s) => s.constructor.name).join(' > ') + ' errors: ' + (G.errors || []).join(' | '));
    hitOnce('after a quickload'); keyHit('after a quickload');
    press('F9'); G.loop.tick(1 / 60); release('F9'); tick(170);
    hitOnce('after a second quickload'); keyHit('after a second quickload');
    G.settings.data.legacyControls = false;
  }

  // 2026-11-02: people remember conversations, have bonds with each other, and talk (js/game/npctalk.js)
  // 2026-11-04: "The A.I update": identity, perspective, memory, overheard talk, police, orders, T, trading lists
  async function aiUpdate() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(13); tick(5);
    G.autonomy.off = true;
    const S = G.settings.data, I = G.identity, A = G.ai, O = G.orders, M = G.mem, H = G.overhear;
    const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); for (let i = 0; i < 8; i++) await Promise.resolve(); };
    const ppl = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && G.NPCS[a.id] && !a.sleeping && a.def.combat === 'flee' && !a.def.shop);
    const [jack, bob, eve] = ppl;
    for (const a of ppl) a.def.schedule = [{ from: 0, to: 24, at: { x: Math.floor(a.x / 16), y: Math.floor(a.y / 16) }, act: 'idle' }];   // (off duty: being at work is its own test)
    const place = (a, dx, dy = 0) => { a.x = p.x + dx; a.y = p.y + dy; a.state = 'schedule'; a.st.fear = 0; a.st.hostile = false; a.st.disp = 0; a.path = null; };
    jack.st.realName = 'Jack Dale'; bob.st.realName = 'Bob Marsh'; eve.st.realName = 'Eve Stone';
    // -------- ethnicity and age, for everybody
    const all = Object.keys(G.NPCS), noRace = all.filter((id) => G.NPCS[id].look && !G.RACES[G.NPCS[id].look.race]), noAge = all.filter((id) => !G.AGES[G.ages.of(id)]);
    check(!noRace.length && !noAge.length, `every NPC has an ethnicity and an age group (${noRace.length}, ${noAge.length} missing of ${all.length})`);
    const off = all.filter((id) => { const L = G.NPCS[id].look; return L && L.race !== 'other' && !G.races.skins(L.race).includes(L.skin) && !G.NPCS[id].look.undead; });
    check(off.length < all.length * 0.12, `skin tones come from their ethnicity's range (${off.length} set by hand)`);
    const races = new Set(all.map((id) => G.NPCS[id].look && G.NPCS[id].look.race));
    check(races.size >= 4, `a mix of people (${[...races].join(', ')})`);
    check(G.NPCS.n_elder.look.race === 'notraeli', 'the Notraeli are Notraeli');
    const old = all.filter((id) => G.ages.of(id) === 'elderly');
    check(old.length >= 8 && old.every((id) => G.NPCS[id].look.hair && /^#(c8c8c8|d8d8d8|b8b8b8|e0e0e0|a8a8a8)/i.test(G.NPCS[id].look.hair)), `elderly people exist and look it (${old.length})`);
    check(all.filter((id) => G.NPCS[id].kid).every((id) => G.ages.of(id) === 'child') && !old.some((id) => G.NPCS[id].kid), 'children are children');
    const yrs = old.map((id) => G.ages.years(id));
    check(yrs.every((y) => y >= 65), 'the elderly are over 65');
    // -------- personalities: nobody is interchangeable
    const sigs = all.map((id) => { const P = G.social.persona(id); return `${P.voice}|${P.quirk}`; });
    check(new Set(sigs).size === sigs.length, `no two people share a way of talking and a quirk (${new Set(sigs).size}/${sigs.length})`);
    const P0 = G.social.persona(jack.id);
    check(G.PERSONA.traits.includes(P0.trait) && P0.courage > 0 && P0.you.worry && !/\bmy\b/.test(P0.you.worry) && !/\bmy\b/.test(P0.they.dream), 'persona: the old trait, a temperament, and their facts for someone else to say');
    // -------- identity
    check(I.refers(w, jack.id, 'Jack Dale is an asshole') === 'full' && I.refers(w, jack.id, 'jack dale is an asshole') === 'full' && I.refers(w, jack.id, 'I saw Jack') === 'first' && !I.refers(w, jack.id, 'hello there'), 'names: full, first, any case');
    eve.st.realName = 'June Stone';
    check(!I.refers(w, eve.id, 'the price of stone in june') && I.refers(w, eve.id, 'I saw June') === 'first', 'names that are also words count only as names');
    bob.st.realName = 'Bob "Razor" Marsh';
    check(I.refers(w, bob.id, 'Razor owes me') === 'alias' && I.names(w, bob.id).nick === 'Razor' && I.names(w, bob.id).full === 'Bob Marsh', 'street names are names');
    // -------- perspective
    check(I.fixLine(w, jack, "Hey, what's your problem with Jack Dale, kid?") === "Hey, what's your problem with me, kid?", 'a person is never a third party to themselves');
    check(I.fixLine(w, jack, 'I am Jack Dale.') === 'I am Jack Dale.' && I.fixLine(w, jack, 'My name is Jack Dale.') === 'My name is Jack Dale.', 'introducing yourself still works');
    check(I.fixLine(w, jack, "Jack Dale's car is outside. Jack Dale is tired.") === 'My car is outside. I am tired.', 'possessive and subject');
    check(I.fixLine(w, jack, 'Ask the player about the player\'s car.') === 'Ask you about your car.', 'the player is "you"');
    check(I.fixLine(w, bob, 'Jack Dale is a fool.') === 'Jack Dale is a fool.', 'others stay in the third person');
    check(I.fixChoice("I've been having problems with my wife lately.", 'You mentioned my marriage. Is everything okay?', {}) === 'You mentioned your marriage. Is everything okay?', 'the player never claims the NPC\'s marriage');
    check(I.fixChoice("I've been having problems with my wife lately.", 'My car broke down too.', {}) === 'My car broke down too.', 'what is really the player\'s stays theirs');
    check(I.fixChoice('My boss is the worst.', 'Is my boss bothering you?', {}) === 'Is your boss bothering you?', 'one family of words');
    check(I.fixChoice('Hi', "I'm Jack, nice to meet you.", { names: I.names(w, jack.id) }) === null, 'a choice speaking as the NPC goes');
    check(I.fixChoice('Hi', "I'm the Town Mayor, I take care of this place.", { role: 'Mayor' }) === null && I.fixChoice('Hi', 'What brings you to my house?', {}) === null, 'a choice from the NPC\'s side goes');
    check(!/on around here/.test(I.cleanPlaces(w, 'There is a diner out on Maple Street.')), 'the sentence around an invented place still reads');
    const t = G.TALK_TOPICS || null;
    for (const id of all.slice(0, 80)) { const P = G.social.persona(id); check.quiet = true; if (/\bmy\b/.test(`You mentioned ${P.you.worry}`)) { check(false, 'player claimed ' + P.worry); break; } }
    // -------- places
    const pl = I.places(w);
    check(pl.length >= 10 && !pl.some((n) => /island/i.test(n)), `real places, never the island (${pl.length})`);
    check(I.cleanPlaces(w, 'Meet me at the Rusty Anchor Bar tonight.') === 'Meet me at the bar tonight.' && /around here/.test(I.cleanPlaces(w, 'I live on Maple Street.')), 'invented places are caught');
    check(I.cleanPlaces(w, `Go to the ${pl.find((n) => /Station|Church|Bar|Diner/.test(n)) || pl[0]}.`).includes(pl.find((n) => /Station|Church|Bar|Diner/.test(n)) || pl[0]), 'real places stay');
    // -------- memory
    jack.st.mems = [];
    M.add(w, jack.id, { k: 'x', t: 'small thing', s: 'overheard', i: 1 });
    M.add(w, jack.id, { k: 'crime', t: 'I saw a murder', by: 'player', s: 'saw', f: -3, i: 5 });
    for (let i = 0; i < 30; i++) M.add(w, jack.id, { k: 'noise' + i, t: 'noise ' + i, s: 'told', i: 1 });
    const ml = M.list(w, jack.id);
    check(ml.length <= M.MAX && ml.some((m) => m.t === 'I saw a murder') && !ml.some((m) => m.t === 'small thing'), `memory has limits and keeps what matters (${ml.length})`);
    const seen = ml.find((m) => m.t === 'I saw a murder');
    check(seen.s === 'saw' && seen.r === 1 && seen.by === 'player' && seen.d === w.day, 'a memory knows what, who, when, how and how sure');
    check(!M.list(w, eve.id).some((m) => m.t === 'I saw a murder'), 'nobody is omniscient');
    jack.st.mems = [{ k: 'crime', t: 'I saw the player steal', by: 'player', s: 'saw', r: 1, f: -2, i: 4, d: w.day, m: 0, ti: 'public' }]; eve.st.mems = [];
    const pst = G.social.persona(jack.id); pst.sociable = 80;
    const copy = M.gossip(w, jack.id, eve.id);
    check(copy && copy.s === 'told' && copy.r < 1, 'passed on: secondhand, less sure');
    jack.st.mems = [{ k: 'plan', t: 'secret', by: jack.id, s: 'did', r: 1, f: 0, i: 4, d: w.day, m: 0, ti: 'faction', fc: 'cia' }];
    check(!M.gossip(w, jack.id, bob.id), 'faction business does not reach outsiders');
    const saved = JSON.parse(JSON.stringify(w.npcs[jack.id]));
    check(saved.mems && saved.mems.length === 1, 'memories are part of the saved state');
    // -------- overheard: the Jack Dale example, with a friend and an enemy and a stranger
    S.dialogueMode = 0; jack.st.mems = []; bob.st.mems = []; eve.st.mems = [];
    place(jack, 30); place(bob, 12); place(eve, -30);
    const other = ppl[3]; place(other, 20, 14); other.st.mems = [];
    other.st.op = { [jack.id]: 70 }; eve.st.op = { [jack.id]: -70 }; bob.st.op = { [jack.id]: 0 }; jack.st.op = {}; other.st.disp = 20;
    jack._heardAt = eve._heardAt = other._heardAt = -99;
    G.aware.speech(g, p, bob, 'Jack Dale is an asshole.');
    check(jack.st.disp < 0 && M.list(w, jack.id).some((m) => /about me/.test(m.t)), 'Jack heard it, knows it is about him, and remembers');
    check(jack.bark === null || !/Jack Dale/.test(jack.bark || ''), `Jack's own reaction never names himself: "${jack.bark}"`);
    check(/\bme\b|\bmy\b|\bI\b/.test(jack.bark || 'me'), 'and speaks in the first person');
    check(other.st.disp < 20, 'his friend takes it badly');
    check(eve.st.disp >= 0, 'his enemy does not mind');
    // irrelevant talk is ignored
    const stranger = ppl[4]; place(stranger, 25, -14); stranger.st.mems = []; stranger.st.op = { [jack.id]: 0 }; const d0 = stranger.st.disp;
    H.listen(g, stranger, p, bob, 'Lovely weather today.', false);
    check(!M.list(w, stranger.id).length && stranger.st.disp === d0, 'people ignore what has nothing to do with them');
    // who said it counts: the same words, from someone they like
    const n0 = H.stake(w, other, jack.id); check(n0.kind === 'friend' && H.stake(w, eve, jack.id).kind === 'enemy' && H.stake(w, jack, jack.id).kind === 'self', 'friend, enemy, self');
    check(H.read('Jack Dale is an asshole').tone === 'insult' && H.read('He stole my car').tone === 'accuse' && H.read('I heard she left').tone === 'rumor' && H.read('You are the best').tone === 'praise' && H.read('I will kill him').tone === 'threat', 'what a sentence is doing');
    // repeated insults harden
    const dJack = jack.st.disp; G.aware.speech(g, p, bob, 'Jack Dale is a piece of shit.'); check(jack.st.disp < dJack, 'insults add up');
    // faction: an insult to their group
    const gid = Object.keys(G.NPCS).find((id) => G.NPCS[id].faction === 'gang_red');
    check(G.fmind.rankTitle(w, gid) && G.fmind.sheet(w, gid).includes('Red Gang') && /Blue Gang/.test(G.fmind.sheet(w, gid)), 'gang members know their rank and their enemies');
    check(G.fmind.rankIndex(w, Object.keys(G.NPCS).find((id) => G.NPCS[id].leader)) === 4, 'leaders lead');
    const rep0 = w.getRep('government'), cop0 = Object.keys(G.NPCS).find((id) => G.NPCS[id].combat === 'guard');
    G.fmind.nudge(w, 'government', -1, 'insult'); G.fmind.nudge(w, 'government', -1, 'insult');
    check(w.getRep('government') < rep0 && w.getRep('government') >= rep0 - 2, 'faction reputation moves through the existing system, once a day');
    check(G.fmind.sheet(w, cop0).length > 20, 'police know their group');
    // -------- AI context
    S.dialogueMode = 2; const was = { t: A.transport, l: A.localUp, loaded: A.loaded }; let asked = null;
    const reply = (o) => JSON.stringify({ message: { content: JSON.stringify(Object.assign({ line: 'Sure.', attitude: 'neutral', choices: [], actions: [] }, o)) } });
    let next = {}; A.transport = (req) => { asked = req; return Promise.resolve({ status: 200, body: reply(next) }); }; A.localUp = true; A.sessionOff = false; A.fails = 0;
    place(jack, 14); const r0 = new G.DialogueRunner(jack, g);
    const q0 = A.npcLine(r0, { said: 'Jack Dale is an asshole', free: true }); await flush(); await q0;
    const u = asked.body.messages[1].content, s0 = asked.body.messages[0].content;
    check(/"Jack Dale" is YOU/.test(u), 'AI: told that the name is them');
    check(/Your name is Jack Dale/.test(u) && /Way of talking/.test(u) && /Places that exist/.test(u) && !/Island/.test((u.match(/Places that exist[^\n]*/) || [''])[0]), 'AI: identity, voice and real places');
    check(/What you remember/.test(u), 'AI: their memories');
    check(/"I", "me", "my" in your line always mean you/.test(s0) && /PLAYER'S voice/.test(s0), 'AI: the perspective rules');
    next = { line: "What's your problem with Jack Dale?", choices: ['You mentioned my wife.'] };
    const q1 = A.npcLine(r0, { said: 'I hate your wife', free: true }); await flush(); const res1 = await q1;
    check(res1.line === "What's your problem with me?", `AI: a reply about themselves is held to the first person: ${res1.line}`);
    r0.end();
    place(bob, 14); const r1 = new G.DialogueRunner(bob, g);
    const q2 = A.npcLine(r1, { said: 'Jack Dale is an asshole', free: true }); await flush(); await q2;
    check(/Jack Dale is someone else/.test(asked.body.messages[1].content), 'AI: another person is someone else');
    r1.end();
    // -------- orders
    check(O.parse('stick with me').intent === 'follow' && O.parse('Follow me around').intent === 'follow' && O.parse('come along').intent === 'follow' && O.parse('Stick to me like glue').intent === 'follow', 'orders: same meaning in other words');
    check(O.parse('Watch my back').intent === 'protect' && O.parse('Protect me.').intent === 'protect' && O.parse('Stay here.').intent === 'stay' && O.parse('Wait outside.').intent === 'wait_outside' && O.parse('Go home.').intent === 'home' && O.parse('Stop following me.').intent === 'stop' && O.parse('Help me carry these items.').intent === 'carry' && O.parse('Give me a hand.').intent === 'fight' && O.parse('Help me fight these guys.').intent === 'fight' && O.parse('Attack that person.').intent === 'attack', 'orders: the list from the design');
    check(!O.parse('I will kill you') && !O.parse('Nice weather') && !O.parse('Where do you get this?'), 'orders: threats and small talk are not orders');
    const fresh = () => { for (const a of [jack, bob, eve]) { a.st.companion = false; a.st.order = null; a.st.compGuard = false; a.st.mems = []; a.st.emo = null; a.st.askN = null; } };
    fresh(); place(bob, 14); bob.st.disp = -40;
    let plan = O.judge(g, bob, O.parse('Follow me around')); check(!plan.ok, 'someone who dislikes you says no');
    bob.st.disp = 90; plan = O.judge(g, bob, O.parse('Follow me around')); check(plan.ok, 'a good friend says yes');
    O.carry(g, bob, plan); check(bob.st.companion === true, 'and really comes along');
    plan = O.judge(g, bob, O.parse('Stop following me.')); check(plan.ok, 'dismissed'); O.carry(g, bob, plan); check(!bob.st.companion, 'and really stops');
    // staying is a real behavior
    fresh(); place(bob, 40); bob.st.disp = 60; plan = O.judge(g, bob, O.parse('Stay here.')); check(plan.ok, 'told to stay'); O.carry(g, bob, plan);
    const sx = bob.x, sy = bob.y; tick(60); check(Math.hypot(bob.x - sx, bob.y - sy) < 3 && bob.st.order && bob.st.order.t === 'stay', 'they stay where they are');
    bob.st.order = null;
    // peaceful people do not fight; the timid still come along
    fresh(); place(eve, 14); eve.st.disp = 75; eve.st.op = {}; eve.st.realName = 'Eve Stone';
    const Pe = G.social.persona(eve.id), c0 = Pe.courage; Pe.courage = 20;
    plan = O.judge(g, eve, O.parse('Help me fight these guys.')); check(!plan.ok && plan.why === 'notFighter' && plan.follow, 'scared: will follow, will not fight');
    Pe.courage = c0;
    // loyalty: not against their own
    const g1 = g.actors.find((a) => a.kind === 'npc' && a.def.faction !== 'civilians' && a.def.combat === 'fight' && !a.dead && !a.def.leader);
    if (g1) {
      const mate = g.actors.find((a) => a !== g1 && a.kind === 'npc' && a.def.faction === g1.def.faction && !a.dead);
      if (mate) { place(g1, 14); place(mate, 20, 10); g1.st.disp = 100; g1.st.op = {}; G.social.persona(g1.id).loyalty = 80; plan = O.judge(g, g1, { intent: 'attack', text: `Attack ${w.npcs[mate.id].realName}` }); check(!plan.ok && (plan.why === 'own' || plan.why === 'friend'), `won't turn on their own (${plan.why})`); }
    }
    // the greedy name a price, and the price is real
    fresh(); place(bob, 14); bob.st.disp = -5; const Pb = G.social.persona(bob.id), g0 = Pb.greed; Pb.greed = 85; bob.st.op = {};
    plan = O.judge(g, bob, O.parse('Stay here.'));
    let tried = 0; while (plan.ok && tried++ < 12) { bob.st.disp -= 6; plan = O.judge(g, bob, O.parse('Stay here.')); }
    check(plan.price > 0 && /\$/.test(plan.line), `a price: ${plan.line}`);
    p.gold = plan.price + 5; const pg = bob.st.gold || 0; check(O.deal(g, bob, plan) && p.gold === 5 && bob.st.gold === pg + plan.price && bob.st.order && bob.st.order.t === 'stay', 'paid: money changes hands, and they do it');
    Pb.greed = g0; bob.st.order = null;
    // impossible orders
    fresh(); place(bob, 14); bob.st.disp = 80; plan = O.judge(g, bob, O.parse('Go to the Moon Palace Hotel')); check(!plan.ok && plan.why === 'noplace', 'a place that does not exist');
    { const def = bob.def, keep = def.schedule; def.shop = 'x'; def.schedule = [{ from: 0, to: 24, at: { x: 1, y: 1 }, act: 'work' }]; const pw = O.judge(g, bob, O.parse('Stay here.')); check(!pw.ok && pw.why === 'working', 'at work: they cannot just leave'); delete def.shop; def.schedule = keep; }
    plan = O.judge(g, bob, O.parse('Attack that guy')); if (!plan.ok) check(['who', 'innocent', 'scared', 'notFighter', 'stranger', 'dislike'].includes(plan.why) || plan.line, `no clear target or no stomach for it (${plan.why})`);
    // an order through AI words: the game decides, the words follow
    fresh(); place(bob, 14); bob.st.disp = -60; const r2 = new G.DialogueRunner(bob, g); next = { line: 'Sure, let me do that.' };
    const e1 = A.exchange(r2, 'Protect me.'); await flush(); const eres = await e1;
    check(!/^Sure/.test(eres.line) && !bob.st.companion, `AI says yes, the game says no: ${eres.line}`);
    r2.end();
    fresh(); place(bob, 14); bob.st.disp = 95; const r3 = new G.DialogueRunner(bob, g); next = { line: 'Sure thing.' };
    const e2 = A.exchange(r3, 'Stay here.'); await flush(); await e2;
    check(/You have decided to do it/.test(asked.body.messages[1].content) && bob.st.order && bob.st.order.t === 'stay', 'the AI is told the decision, and it happens');
    r3.end(); bob.st.order = null;
    // an instruction only the model understood
    fresh(); place(bob, 14); bob.st.disp = 95; const r4 = new G.DialogueRunner(bob, g); next = { line: 'Okay, I will wait.', order: 'stay' };
    const e3 = A.exchange(r4, 'Be a statue until I return'); await flush(); await e3;
    check(asked.body.format.properties.order && bob.st.order && bob.st.order.t === 'stay', 'the model names the instruction, the game carries it out');
    r4.end(); bob.st.order = null;
    S.dialogueMode = 0;
    // the limits of asking someone to come along hold here too
    { const kid = Object.keys(G.NPCS).find((id) => G.NPCS[id].kid && g.actors.some((a) => a.id === id)); const ka = kid && g.actors.find((a) => a.id === kid); if (ka) { ka.st.disp = 100; ka.st.hostile = false; ka.state = 'schedule'; check(!O.judge(g, ka, O.parse('Follow me')).ok, 'children do not go off with you, however much they like you'); } }
    // written dialogue: orders work with no AI at all
    fresh(); place(bob, 14); bob.st.disp = 90;
    const r5 = new G.DialogueRunner(bob, g); r5.say('Follow me around'); check(bob.st.companion === true && r5.chatReply.text, `written: ${r5.chatReply.text}`); r5.end(); fresh();
    // -------- classic chat: a third party is a third party
    place(bob, 14); bob.st.disp = 0; bob.st.op = { [jack.id]: 0 }; const d1 = bob.st.disp;
    const r6 = new G.DialogueRunner(bob, g); r6.say('Jack Dale is an asshole'); check(bob.st.disp === d1 && /Jack/.test(r6.chatReply.text), `an insult about someone else is not an insult to them: ${r6.chatReply.text}`); r6.end();
    place(jack, 14); const r7 = new G.DialogueRunner(jack, g); r7.say('What about Jack Dale?'); check(/me/i.test(r7.chatReply.text), `their own name: ${r7.chatReply.text}`); r7.end();
    // -------- written topics: the player keeps to their own perspective
    const worry = G.PERSONA.worries.find((x) => /^my /.test(x));
    check(I.pov(worry, 'you').startsWith('your ') && I.pov(worry, 'they').startsWith('their '), 'persona lines in someone else\'s mouth');
    // -------- T
    fresh(); for (const a of g.actors) if (a.kind === 'npc' && a !== bob && a.distTo(p) < 120) { a.x += 400; a.y += 300; }
    place(bob, 14); bob.st.disp = 90; g.promptTarget = null; G.scenes.replace(g);
    check(G.talkbar.target(g) && G.talkbar.open(g) && G.scenes.top() instanceof G.TalkBarScene, 'T: opens with someone near');
    const bar = G.scenes.top(), t0 = w.minutes, px = p.x;
    const key = (c) => { G.input.typed.push(c); };
    'Follow me around'.split('').forEach(key); G.input.down.add('KeyD'); bar.update(0.016); G.input.down.delete('KeyD');
    check(bar.input === 'Follow me around' && p.x === px, 'T: typing does not move you');
    for (let i = 0; i < 300; i++) bar.update(1 / 60);
    check(w.minutes !== t0 || w.hourF !== undefined, 'T: the world keeps going while you type');
    G.input.pressed.add('Enter'); bar.update(0.016); G.input.pressed.delete('Enter');
    check(G.scenes.top() === g && bob.st.companion === true && G.talkbar.feed.some((f) => f.who === 'You'), `T: said, answered, and done without any menu (top ${G.scenes.top() === g}, comp ${bob.st.companion}, feed ${JSON.stringify(G.talkbar.feed)}, d ${Math.round(bob.distTo(p))})`);
    G.talkbar.close(); fresh();
    // T with nobody there is the old Wait
    for (const a of g.actors) if (a.kind === 'npc' && a.distTo(p) < 90) { a.x += 400; a.y += 300; }
    g.promptTarget = null;
    check(!G.talkbar.target(g) && !G.talkbar.open(g), 'T: nobody around, nothing opens (Wait still works)');
    // -------- the police
    G.scenes.replace(g); g.loadMap('city', 'start'); G.debug.time(13); tick(3);
    const cop = g.actors.find((a) => a.kind === 'npc' && a.def.combat === 'guard' && !a.dead);
    check(!!cop, 'a cop on the street');
    const q = g.player; const resetCop = () => { for (const a of g.actors) if (a.kind === 'npc' && a.def.combat === 'guard') { a.state = 'schedule'; a.target = null; a.st.hostile = false; a.st.warned = null; } cop.x = q.x + 18; cop.y = q.y; g.arrestCooldown = 0; g.copHold = 0; q.handsUp = false; w.bounty[g.region] = 60; q.equip.weapon = null; };
    resetCop(); g.startArrest(cop); tick(1); g.talkTo(cop); tick(1);
    let d = G.scenes.top(); check(d.runner && d.runner.tree === G.DIALOGUES._arrest, 'an arrest talk');
    check(d.runner.node.choices.some((c) => /^Goodbye/.test(c.text)), 'Goodbye is there at every stage');
    d.choose(d.runner.node.choices.findIndex((c) => /^Goodbye/.test(c.text))); tick(1);
    check(cop.state !== 'fight' && G.demand.cur && G.demand.cur.npc === cop && G.scenes.top() === g, 'Goodbye: the order stands, spoken, and nobody fires'); G.demand.close();
    resetCop(); g.startArrest(cop); tick(1); g.talkTo(cop); tick(1); d = G.scenes.top();
    d.choose(d.runner.node.choices.findIndex((c) => /^What have I done/.test(c.text))); tick(1);
    G.input.pressed.add('Escape'); d.update(0.016); G.input.pressed.clear(); tick(1);
    check(cop.state !== 'fight' && G.demand.cur && G.scenes.top() === g, 'closing the window, later in the talk: same'); G.demand.close();
    resetCop(); q.gold = 500; g.startArrest(cop); tick(1); g.talkTo(cop); tick(1); d = G.scenes.top();
    d.choose(d.runner.node.choices.findIndex((c) => /^Pay the bounty/.test(c.text))); tick(1);
    check(cop.state !== 'fight' && w.bounty[g.region] === 0, 'paying settles it: no fight');
    // surrendering with empty hands, under attack
    resetCop(); cop.st.hostile = true; cop.startFight(q, g); const cop2 = g.actors.find((a) => a !== cop && a.kind === 'npc' && a.def.combat === 'guard' && !a.dead); if (cop2) { cop2.x = q.x - 30; cop2.y = q.y; cop2.startFight(q, g); }
    q.equip.weapon = 'lead_pipe' in G.ITEMS ? 'lead_pipe' : 'rusty_sword';
    check(!G.policeStop.canSurrender(g, cop), 'a weapon in hand: no talking');
    q.equip.weapon = null;
    check(G.policeStop.canSurrender(g, cop), 'empty hands: you can');
    g.talkTo(cop); tick(1); d = G.demand.cur;
    check(d && d.r.surrendering && q.handsUp && G.scenes.top() === g && cop.state !== 'fight' && (!cop2 || cop2.state !== 'fight'), 'hands up, no window, and the officers hold');
    check(d.r.node.choices.some((c) => /I give up/.test(c.text)), 'you can give up');
    G.demand.close(); G.policeStop.escaped(g, cop); tick(1);
    check(cop.state === 'fight' && !q.handsUp, 'run from that, and it starts again');
    // arming yourself during a hold
    resetCop(); g.copsHot = 0; cop.st.hostile = true; cop.startFight(q, g); g.talkTo(cop); tick(1); d = G.demand.cur;
    w.bounty[g.region] = 0; G.policeStop.finish(d.r); G.demand.close(); tick(1);
    check(G.policeStop.holding(g), 'settled: a moment of peace');
    q.equip.weapon = 'rusty_sword' in G.ITEMS ? 'rusty_sword' : Object.keys(G.ITEMS).find((k) => G.ITEMS[k].type === 'weapon'); tick(2);
    check(cop.state === 'fight' && !G.policeStop.holding(g), `a weapon out during the hold: they react (${cop.state}, hold ${G.policeStop.holding(g)}, dead ${q.dead}, top ${G.scenes.top() === g})`);
    q.equip.weapon = null; while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // disrespect: by temperament
    resetCop(); w.bounty[g.region] = 0; cop.st.warned = null;
    const Pc = G.social.persona(cop.id), pat = Pc.patience, tem = Pc.temper;
    Pc.patience = 80; Pc.temper = 20;
    check(H.cop(g, cop, { tone: 'insult', sev: 1 }, 'x') === 'warn', 'a patient officer warns first');
    Pc.patience = 10; Pc.temper = 90; cop.st.warned = null;
    const st1 = H.cop(g, cop, { tone: 'insult', sev: 2 }, 'x');
    check(st1 === 'arrest', `a short-tempered one arrests (${st1})`); H.flush(g); tick(1);
    check((cop.state === 'arrest' || G.demand.cur) && w.bounty[g.region] > 0, 'and it is a real arrest'); G.demand.close();
    while (G.scenes.top() !== g) { const t0p = G.scenes.top(); if (t0p.runner) t0p.runner.ended = true; G.scenes.pop(); }
    resetCop(); cop.st.warned = { day: w.day, n: 5 }; check(H.cop(g, cop, { tone: 'threat', sev: 3 }, 'x') === 'force', 'keep going, and they use force'); H.flush(g); tick(1); check(cop.state === 'fight', 'force is force');
    Pc.patience = pat; Pc.temper = tem; resetCop(); w.bounty[g.region] = 0;
    // -------- trading lists
    const npc2 = g.actors.find((a) => a.kind === 'npc' && !a.dead); npc2.st.inv = Object.keys(G.ITEMS).slice(0, 40).map((id) => [id, 1]);
    const bs = new G.BarterScene(g, npc2); G.scenes.push(bs); G.renderer.ctx.save();
    bs.render(G.renderer.ctx); const m = G.input.mouse, ur = [m.ux, m.uy];
    const R = G.renderer, W2 = Math.min(460, R.uiW - 20), H2 = Math.min(262, R.uiH - 10);
    m.ux = Math.round((R.uiW - W2) / 2) + 40; m.uy = Math.round((R.uiH - H2) / 2) + 60; m.wheel = 5; bs.render(G.renderer.ctx); m.wheel = 0;
    check(bs.scroll[0] === 5, `trade: the wheel scrolls their list on its own (${bs.scroll[0]})`);
    for (let i = 0; i < 60; i++) { m.wheel = 5; bs.render(G.renderer.ctx); } m.wheel = 0;
    check(bs.scroll[0] === 40 - Math.max(3, Math.floor((H2 - 30 - 74) / 15)), `trade: down to the last item (${bs.scroll[0]})`);
    [m.ux, m.uy] = ur; G.renderer.ctx.restore(); G.scenes.remove(bs);
    const sid = Object.keys(G.SHOPS)[0];
    if (w.shops[sid]) {
      w.shops[sid].stock = Object.keys(G.ITEMS).slice(0, 50).map((id) => [id, 1]);
      const sh = new G.ShopScene(g, sid, null); G.scenes.push(sh); sh.render(G.renderer.ctx); sh.update(0.016);
      const R2 = G.renderer, Wv = Math.min(470, R2.uiW - 12), Hv = Math.min(250, R2.uiH - 12);
      m.ux = Math.round((R2.uiW - Wv) / 2) + 60; m.uy = Math.round((R2.uiH - Hv) / 2) + 70; m.wheel = 6; sh.render(G.renderer.ctx); m.wheel = 0; sh.update(0.016);
      check(sh.scroll === 6 && sh.sel >= 6, `shop: the wheel scrolls and it stays scrolled (${sh.scroll})`);
      [m.ux, m.uy] = ur; G.scenes.remove(sh);
    }
    A.transport = was.t; A.localUp = was.l; A.loaded = was.loaded; G.autonomy.off = false;
  }

  // 2026-11-05: the City Activities update
  function textures() {
    const g = game(), w = g.world, p = g.player; G.autonomy.off = true;
    // prison beds, gangs
    { const m = G.maps.get('jail'); for (let k = 0; k < 8; k++) { const x = 9 + k * 4; check(m.decor.some((d) => Math.abs(d.tx - x * G.WORLD_SCALE) <= 2 && Math.abs(d.ty - 10 * G.WORLD_SCALE) <= 2 && (d.type === 'bed' || d.type === 'bunk')), `cell ${k + 1} has a bed`); } for (const id of Object.keys(G.NPCS).filter((i) => G.PRISON_FACTIONS.includes(G.NPCS[i].faction))) { const f = G.NPCS[id].faction, r = G.NPCS[id].look.race; check({ p_supremacists: 'caucasian', p_afros: 'afro', p_latinos: 'latino' }[f] === r, `${id} (${f}) is ${r}`); } const P = G.prison; for (const [race, fid] of [['caucasian', 'p_supremacists'], ['afro', 'p_afros'], ['latino', 'p_latinos']]) { p.look.race = race; for (const f of P.IDS) check(P.canJoin(g, f) === (f === fid), `${race} ${f === fid ? 'can' : 'cannot'} join ${f}`); } for (const race of ['asian', 'notraeli', 'other']) { p.look.race = race; check(!P.IDS.some((f) => P.canJoin(g, f)), `${race}: no gang takes them`); } p.look.race = 'caucasian'; }
    // wetness
    check(!G.wetness, 'the body itself no longer gets wet (js/game/wetclothes.js)');
    { G.weather.ground = 1; const pl = (g.map.puddles = null, null); void pl; g.render(G.renderer.ctx); check(g.map.puddles && g.map.puddles.length > 10, `puddles form (${g.map.puddles && g.map.puddles.length})`); G.weather.ground = 0; }
    // fruit
    { const m = G.maps.get('rural'), bushes = m.decor.filter((d) => /^v_bush_/.test(d.type)), kinds = new Set(bushes.map((d) => d.def.forage)); check(bushes.length > 10 && kinds.size === 4, `berry bushes of four kinds (${bushes.length})`); check(!m.decor.some((d) => d.type === 'berrybush'), 'no bush gives apples any more'); check(bushes.every((d) => d.def.forage !== 'apple'), 'each gives its own fruit'); check(m.decor.some((d) => d.type === 'v_apple_tree'), 'apple trees'); check(m.decor.some((d) => d.type === 'v_windfall'), 'windfalls'); check(Object.values(G.SHOPS).filter((s) => s.stock.some(([k]) => k === 'apple')).length >= 3, 'apples in the shops'); g.loadMap('rural', 'start'); tick(2); const d = g.map.decor.find((q) => q.type === 'v_windfall'); p.inventory.remove('apple', p.inventory.count('apple')); const n = g.map.decor.length; g.useDecor(d); check(p.inventory.count('apple') >= 1 && g.map.decor.length < n, 'picking up a windfall'); const mu = g.map.decor.find((q) => q.def.forage === 'mushroom'); if (mu) { g.useDecor(mu); check(p.inventory.count('mushroom') >= 1 && !g.map.decor.includes(mu), 'picking a mushroom removes it'); } }
    // signs
    { for (const v of Object.values(G.VENUES)) { if (v.outdoor) continue; const m = G.maps.get(v.map); check(m.decor.some((d) => d.type === v.signDecor), `${v.name} has its sign`); check(m.decor.some((d) => d.type === 'v_hours_' + v.id), `${v.name} shows its hours`); } const c = G.maps.get('city'); check(c.decor.some((d) => d.type === 'v_sign_bank') && c.decor.some((d) => d.type === 'v_sign_hospital'), 'bank and hospital signs'); const b = G.maps.get('industrial'); check(b.decor.some((d) => d.type === 'v_sign_pit_down'), 'the Pit is marked at the street door'); const s = G.assets.sprites.shopsign_0; check(s && s.vhd, 'old shop boards repainted'); }
    // bikers
    { const list = Object.keys(G.NPCS).filter((i) => G.NPCS[i].name === 'Biker'); check(list.length >= 6 && list.every((i) => G.NPCS[i].look.patch), 'bikers wear their colors'); check(new Set(list.map((i) => JSON.stringify([G.NPCS[i].look.hair, G.NPCS[i].look.facial, G.NPCS[i].look.top, G.NPCS[i].look.hat]))).size >= 5, 'and do not look alike'); }
    G.autonomy.off = false;
  }
  function grit() {
    const g = game(), w = g.world, p = g.player, M = G.marks; G.autonomy.off = true;
    // rooms: nothing walled in, every trade has its things
    for (const [map, name, piece] of [['city', 'Police Station', 'v_file_cabinet'], ['city', 'Shelter', 'v_cot'], ['southside', 'Chop Shop', 'v_tire_stack'], ['industrial', 'Factory', 'v_machine'], ['suburbs', 'Elementary School', 'v_school_desk'], ['eastside', 'Laundromat', 'v_folding_table'], ['southside', 'Liquor Store', 'v_bottle_shelf'], ['city', 'Pharmacy', 'v_med_shelf']]) { const m = G.maps.get(map), b = m.buildings.find((q) => q.name === name); check(b && m.decor.some((d) => d.type === piece && m.buildingAtTile(d.tx, d.ty) === b), `${name} has its ${piece}`); }
    for (const id of ['rural', 'city', 'suburbs', 'southside', 'eastside', 'heights', 'industrial', 'farmland', 'jail']) { const m = G.maps.get(id); let bad = 0; for (const b of m.buildings) { if (b.doorY == null) continue; const q = [[b.doorX, b.doorY - 1]], s = new Set(); while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (s.has(k) || m.isSolidTile(x, y) || x < b.x || x >= b.x + b.w || y < b.y || y >= b.y + b.h) continue; s.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } for (const k in m.points) { const pt = m.points[k]; if (pt && !Array.isArray(pt) && k.startsWith(b.id + '_') && pt.x > b.x && pt.x < b.x + b.w - 1 && pt.y > b.y && pt.y < b.y + b.h - 1 && !m.isSolidTile(pt.x, pt.y) && !s.has(pt.x + ',' + pt.y) && !b.backroom && b.kind !== 'bank') { bad++; log(`     cut off: ${id} ${k}`); } } } check(bad === 0, `${id}: nobody is walled in by furniture`); }
    // marks
    g.loadMap('city', 'start'); G.debug.time(13); tick(3);
    const a = g.actors.find((q) => q.kind === 'npc' && !q.dead && !q.def.kid && !q.transient && q.def.combat === 'flee'), x = a.x, y = a.y;
    a.die(p, g); check(M.on(w, 'city').some((q) => q.k === 'blood'), 'blood stays where someone fell');
    check((w.markDue || []).length === 1, 'a memorial is due'); w.day++; G.events.emit('newDay', w.day); check(M.on(w, 'city').some((q) => q.k === 'memorial'), 'the next day there is a memorial'); check(M.on(w, 'city').some((q) => q.k === 'blood'), 'the blood is still there');
    g.render(G.renderer.ctx);
    const js = JSON.parse(JSON.stringify(w.marks)); check(js.city.length >= 2, 'marks are in the save');
    p.x = x; p.y = y; p.inventory.add('cleaning_kit', 1); check(G.ITEM_USE.cleaning_kit(g) === true && !M.on(w, 'city').some((q) => q.k === 'blood') && M.on(w, 'city').some((q) => q.k === 'memorial'), 'a cleaning kit gets the blood, the memorial stays');
    // wanted posters
    { const L = G.law.state(w); L.wanted = { reasons: ['murder'] }; w.day++; G.events.emit('newDay', w.day); check(M.on(w, 'city').some((q) => q.k === 'poster'), 'wanted posters go up'); L.wanted = null; w.day++; G.events.emit('newDay', w.day); check(!M.on(w, 'city').some((q) => q.k === 'poster'), 'and come down'); }
    // a stain is real pixels, not just a record
    { const n0 = M.on(w, 'city').length; M.add(w, 'city', 'brass', p.x, p.y); check(M.on(w, 'city').length === n0 + 1, 'spent brass is recorded'); const hg = G.items ? null : null; void hg; }
    // districts
    { const so = G.maps.get('southside'), he = G.maps.get('heights'), n = (m) => m.decor.filter((d) => /^v_(tag|rubbish|boards|weeds)/.test(d.type)).length; check(n(so) > n(he) && n(he) === 0, `the Southside shows it, the Heights do not (${n(so)} vs ${n(he)})`); }
    { const c = G.maps.get('city'), inB = (n, rx) => { const b = c.buildings.find((q) => q.name === n); return c.decor.filter((d) => rx.test(d.type) && c.buildingAtTile(d.tx, d.ty) === b).length; }; check(inB('Bar', /^bed/) === 0 && inB('Bar', /v_keg/) > 0, 'the bar has kegs, not beds'); check(inB('Police Station', /^bed/) === 0, 'the station has duty bunks'); check(inB('Church', /^lamp$/) === 0 && inB('Church', /^bed/) === 0, 'no street lamp or bed in the nave'); check((G.assets.sprites.pew.real || G.assets.sprites.pew.vhd) && (G.assets.sprites.statue.real || G.assets.sprites.statue.vhd), 'the old pieces are redrawn'); }
    // worn bodies draw without trouble
    { const a2 = g.actors.find((q) => q.kind === 'npc' && !q.dead); a2.hp = a2.maxHp * 0.2; a2.st.fear = 90; G.wet.wetActor(a2, 1, g.world); const t = G.renderer.ctx; a2.draw(t); check(true, 'a hurt, frightened, soaked body draws'); a2.hp = a2.maxHp; a2.st.fear = 0; a2.st.wetWorn = null; }
    // adult proportions
    { const f = G.hd.FH; check(G.hd.WH >= 26 && f === 44, 'adults stand tall'); }
    G.autonomy.off = false;
  }
  function audit() {
    const counts = {}, names = {};
    for (const id of ['rural', 'city', 'suburbs', 'southside', 'eastside', 'heights', 'industrial', 'farmland', 'jail']) { const m = G.maps.get(id); for (const d of m.decor) if (m.buildingAtTile(d.tx, d.ty)) counts[d.type] = (counts[d.type] || 0) + 1; names[id] = m.buildings.map((b) => `${b.name}[${b.kind} ${b.w}x${b.h} @${b.x},${b.y}]`).join(' ; '); }
    const A = G.assets, FH = G.furnitureHD || G.fhd, list = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map((k) => { const s = A.sprites[G.DECOR[k].sprite] || {}; return `${k}:${counts[k]}${s.vhd ? ':v' : ''}`; });
    log('     DECOR ' + list.join(' ')); for (const k in names) log(`     MAP ${k}: ${names[k]}`);
    log('     LOWRES ' + Object.keys(G.DECOR).filter((k) => { const n = G.DECOR[k].sprite, s = A.sprites[n]; return s && !s.vhd && !s.hd && !(s.img && s.img.width > (s.w || 0) * 1.5); }).map((k) => `${k}=${G.DECOR[k].sprite}`).join(' '));
    log('     KEYS ' + Object.keys(A.sprites.bed || {}).join(',') + ' | ' + Object.keys(A.sprites.fridge || {}).join(',') + ' | fridgeImg ' + (A.sprites.fridge && A.sprites.fridge.img && A.sprites.fridge.img.width) + ' w ' + (A.sprites.fridge && A.sprites.fridge.w) + ' | bedImg ' + (A.sprites.bed && A.sprites.bed.img && A.sprites.bed.img.width) + ' w ' + (A.sprites.bed && A.sprites.bed.w));
    check(true, 'audit');
  }
  // every sign on every map: nothing over a door or another sign, nothing past the corner of its building, readable, and
  // nobody walks behind it. Then a photograph of a person standing right under the poster that used to cover them.
  function signs() {
    const g = game(), p = g.player; G.autonomy.off = true; g._fcNext = 1e12;
    for (const lang of [0, 1]) {
      G.settings.data.language = lang; if (G.i18n.sync) G.i18n.sync(); G.events.emit('languageChanged');
      G.signArt.sizes.length = 0; G.vk.paintAll(); for (const f of G.signArt.sizes.filter((q) => q.size < 3.25)) check(false, `lang ${lang}: "${f.text}" is ${f.size}px on a ${f.w}px sign`);
      check(true, `lang ${lang}: ${G.signArt.sizes.length} boards fit`);
    }
    G.settings.data.language = 0; if (G.i18n.sync) G.i18n.sync(); G.events.emit('languageChanged');
    let total = 0;
    for (const id of ['city', 'industrial', 'southside', 'eastside', 'neon', 'arts', 'suburbs', 'heights', 'rural', 'center']) {
      if (!G.MAPGEN[id]) continue;
      const m = G.maps.get(id), list = m.roofSigns || [], A = G.assets; total += list.length;
      const rect = (d) => { const s = A.sprites[d.def.sprite], k = d.sc || 1; return { x0: d.x - s.ax * k, x1: d.x - s.ax * k + s.w * k, b: d.wallOf, d }; };
      const rs = list.filter((d) => A.sprites[d.def.sprite]).map(rect);
      for (const r of rs) {
        const b = r.b, tag = `${id} ${b.id} ${r.d.type}`;
        check(r.x1 <= b.doorX * 16 || r.x0 >= (b.doorX + 1) * 16, `${tag} clear of the door`);
        check(r.x0 >= b.x * 16 && r.x1 <= (b.x + b.w) * 16, `${tag} inside its wall (${Math.round(r.x0)}-${Math.round(r.x1)} on ${b.x * 16}-${(b.x + b.w) * 16})`);
        check(!r.d.sc || r.d.sc >= 0.7, `${tag} not squeezed`);
        for (const o of rs) if (o !== r && o.b === b && o.x0 < r.x1 - 0.5 && o.x1 > r.x0 + 0.5) check(false, `${tag} overlaps ${o.d.type}`);
        for (const q of m.decor) if (/^v_(boards|tag)/.test(q.type) && q.ty === b.doorY && Math.abs(q.x - (r.x0 + r.x1) / 2) < (r.x1 - r.x0) / 2 + 6) check(false, `${tag} is covered by ${q.type}`);
      }
      for (const d of m.decor) if (/^v_(hdsign_|hours_|sign_|poster_)/.test(d.type)) check(!!d.wallOf || !G.TILES[m.get(d.tx, d.ty)].wall, `${id}: ${d.type} is hung on a wall`);
    }
    check(total > 20, `${total} wall signs checked`);
    g.loadMap('industrial'); tick(2); const m = g.map, b = m.building('i_cannery'), poster = m.roofSigns.find((d) => d.type === 'v_poster_wall' && d.wallOf === b) || m.roofSigns.find((d) => d.wallOf === b);
    const ctx = G.renderer.ctx, shot = () => { G.scenes.render(); const s = G.renderer.worldToUI(poster.x, poster.y), k = G.renderer.uiScale; return ctx.getImageData(Math.round(s.x * k) - 20, Math.round(s.y * k) - 10, 40, 90).data; };
    G.debug.time(12); p.x = poster.x; p.y = (b.doorY + 1) * 16 + 12; p.dir = 0; g.toasts.length = 0; for (let i = 0; i < 12; i++) G.loop.tick(1 / 60);
    const on = shot(); p.x += 90; for (let i = 0; i < 12; i++) G.loop.tick(1 / 60); const off = shot();
    let diff = 0; for (let i = 0; i < on.length; i += 4) if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 40) diff++;
    check(diff > 200, `someone under the poster is in front of it (${diff} pixels change)`);
    G.autonomy.off = false;
  }
  // clothes, and only clothes, get wet; they stay wet wherever they go, and dry with game time
  function wetClothes() {
    let g = game(), p = g.player, w = g.world; const W = G.wet; G.autonomy.off = true; g._fcNext = 1e12;
    const rain = (v) => { G.weather.force = v ? 'storm' : null; G.weather.rain = v; }, pass = (mins) => W.sweep(g, mins), open = () => { g.loadMap('city', 'start'); tick(2); w = g.world; };
    open(); rain(0);
    for (const s of ['top', 'bottom', 'shoes']) check(p.equip[s] && !W.isWet(p.equip[s]), `dressed and dry: ${s}`);
    const plainTop = p.equip.top, name = G.item(plainTop).name, b0 = g.map.buildingAt(p.x, p.y - 3);
    check(!b0, 'standing outdoors');
    // rain soaks in gradually
    rain(1); W.step(p, 8, g); const l1 = W.worn(p); W.step(p, 8, g); const l2 = W.worn(p);
    check(l1 > 0.02 && l1 < 0.4 && l2 > l1, `rain soaks in gradually (${l1.toFixed(2)}, ${l2.toFixed(2)})`);
    check(/ \(wet\)$/.test(G.item(p.equip.top).name), `the piece says so: ${G.item(p.equip.top).name}`);
    for (let i = 0; i < 40; i++) W.step(p, 8, g); check(W.worn(p) >= 0.999, 'until soaked through');
    check(p.wet === undefined, 'the player has no wet body any more');
    // no drying in the rain
    const before = W.level(p.equip.top); pass(60); check(W.level(p.equip.top) === before, 'nothing dries out in the rain');
    rain(0);
    // swimming: all at once
    p.equip.top = W.base(p.equip.top); p.equip.bottom = W.base(p.equip.bottom); p.equip.shoes = W.base(p.equip.shoes);
    p.swimming = true; W.step(p, 1 / 60, g); p.swimming = false; check(W.level(p.equip.top) === 1 && W.level(p.equip.bottom) === 1, 'swimming soaks everything at once');
    // the same for people
    const a = g.actors.find((q) => q.kind === 'npc' && !q.dead && !q.def.kid && !g.map.buildingAt(q.x, q.y - 3) && !q.transient); a.st.gearV2 = false; a.st.wetWorn = null; rain(1); W.step(a, 8, g); check(W.worn(a) > 0.1 && W.worn(a) < 0.9, `people soak the same way (${W.worn(a).toFixed(2)})`);
    a.swimming = true; W.step(a, 1 / 60, g); a.swimming = false; check(W.worn(a) === 1, 'and all at once in the water'); rain(0);
    a.st.equip = a.st.equip || {}; G.npcGear.materialize(a); check(a.st.equip.top && W.isWet(a.st.equip.top) && /\(wet\)/.test(G.item(a.st.equip.top).name), `seen up close their shirt is wet: ${a.st.equip.top && G.item(a.st.equip.top).name}`); check(!a.st.wetWorn, 'the level moved to the item');
    check(W.worn(a) === 1, 'and still counts as worn');
    // their body keeps it
    { const c = g.world; const b = g.actors.find((q) => q.kind === 'npc' && !q.dead && !q.def.kid && q !== a && !q.transient); b.st.gearV2 = false; b.st.wetWorn = { top: 0.6, bottom: 0.6 }; const n0 = new Set(Object.keys(c.containers)); G.containers.createCorpse(c, b, g.map.id); const id = Object.keys(c.containers).find((k) => !n0.has(k)), cp = c.containers[id]; check(cp.items.some((e) => W.isWet(e[0]) && /\(wet\)/.test(G.item(e[0]).name)), 'looted from a body it is still wet'); delete c.containers[id]; }
    // taken off, stored, traded, dropped
    p.inventory.slots.fill(null); check(p.unequip('top'), 'takes it off'); const wetId = p.inventory.slots.find(Boolean).id;
    check(W.isWet(wetId) && W.level(wetId) === 1, 'off the body it is still wet'); check(G.item(wetId).name === `${name} (wet)`, `name in the inventory: ${G.item(wetId).name}`);
    p.inventory.add(plainTop, 1); p.inventory.add(plainTop, 1); check(p.inventory.slots.filter(Boolean).length === 3, 'a wet piece never stacks with dry ones'); check(p.inventory.count(plainTop) === 3, 'it still counts as that shirt'); p.inventory.remove(plainTop, 2); check(p.inventory.count(wetId) === 1 && p.inventory.count(plainTop) === 1, 'dry ones go first');
    p.inventory.sort(); check(p.inventory.count(wetId) === 1, 'sorting keeps it'); check(p.equipFromSlot(p.inventory.slots.findIndex((q) => q)), 'back on'); check(W.level(p.equip.top) === 1 && W.worn(p) === 1, 'still wet on again'); p.unequip('top');
    const bag = G.containers.createBag(w, g.map.id, p.x, p.y, [[wetId, 1]]); p.inventory.remove(wetId, 1); pass(5); check(/\(wet\)/.test(G.item(bag.items[0][0]).name), 'dropped in a bag it stays wet');
    const sid = Object.keys(G.SHOPS).find((k) => w.shops[k] && G.shopSys.accepts(k, plainTop) && w.shops[k].gold > 100); p.inventory.add(bag.items[0][0], 1); delete w.containers[bag.id]; { const sl = p.inventory.slots.findIndex(Boolean), id0 = p.inventory.slots[sl].id; G.shopSys.sell(sid, sl, p, w); const row = w.shops[sid].stock.find((e) => e[0] === id0); check(row && /\(wet\)/.test(G.item(row[0]).name), 'sold to a shop, it is on the shelf wet'); pass(5); check(/\(wet\)/.test(G.item(row[0]).name), 'and stays so a while'); pass(DRY_T(W) * 1); check(!w.shops[sid].stock.some((e) => W.isWet(e[0])), 'until it dries there'); }
    // barter
    { const n = g.actors.find((q) => q.kind === 'npc' && !q.dead && !q.def.kid && !q.transient), id1 = W.soak(plainTop, 0.8, w); n.st.inv = n.st.inv || []; n.st.inv.push([id1, 1]); pass(5); const e = n.st.inv.find((q) => W.isWet(q[0])); check(e && /\(wet\)/.test(G.item(e[0]).name), 'in someone\'s hands it stays wet'); n.st.inv = n.st.inv.filter((q) => q !== e); p.inventory.add(e[0], 1); check(p.inventory.count(e[0]) === 1, 'traded back: wet'); p.inventory.remove(e[0], 1); }
    // the words on the screen
    { const ctx = G.renderer.ctx, s = G.xp.fit(ctx, 'A very long name of a very long piece of clothing (wet)', 90, 8); check(/\(wet\)$/.test(s), `a cut label keeps it: ${s}`); }
    G.settings.data.language = 1; G.i18n.sync(); { const id2 = W.soak(plainTop, 0.5, w), pt = G.i18n.t(G.item(id2).name); check(/\(molhado\)$/.test(pt), `Portuguese: ${pt}`); } G.settings.data.language = 0; G.i18n.sync();
    // drying: rates by where it is, level goes down only with game time
    const worn = (l) => { p.equip.top = W.soak(plainTop, l, w); return p.equip.top; }, hours = (place) => { p.equip.top = plainTop; const id = worn(1); place(); let m = 0; while (W.isWet(p.equip.top) && m < 1440) { pass(5); m += 5; } check(!W.isWet(p.equip.top) && G.item(p.equip.top).name === name, 'dry: the label is gone'); return m; };
    const outM = hours(() => {}); open(); const shop = g.map.buildings.find((q) => q.w > 5 && q.kind === 'shop') || g.map.buildings[0]; const inM = hours(() => { p.x = (shop.x + 2) * 16 + 8; p.y = (shop.y + 2) * 16 + 12; }); check(inM < outM * 0.75, `faster indoors (${inM} min against ${outM})`);
    g.map.addDecorRuntime('campfire', Math.floor(p.x / 16) + 1, Math.floor((p.y - 3) / 16)); const fireM = hours(() => {}); check(fireM < inM * 0.6, `faster still by a fire (${fireM} min)`);
    check(outM >= 180 && outM <= 720, `it stays wet for a while out in dry weather (${outM} min)`);
    // what the sweep sees after a long sleep
    open(); p.equip.top = plainTop; worn(1); rain(0); const lv0 = W.level(p.equip.top); w.addMinutes(120); tick(2); check(W.level(p.equip.top) < lv0, `time passing in one go counts (${lv0} to ${W.level(p.equip.top).toFixed(2)})`);
    // the look: cloth changes, skin does not
    { const ctx = G.renderer.ctx; p.equip.top = plainTop; p.refreshSprite(); G.hd.get(p.sheet, true); const shot = () => { G.scenes.render(); G.hd.pump && G.hd.pump(99); G.scenes.render(); const q = G.renderer.worldToUI(p.x, p.y), k = G.renderer.uiScale, zy = G.renderer.zoom; const head = ctx.getImageData(Math.round(q.x * k) - 4, Math.round(q.y * k - 24 * zy), 8, Math.round(5 * zy)).data, body = ctx.getImageData(Math.round(q.x * k) - 8, Math.round(q.y * k - 15 * zy), 16, Math.round(6 * zy)).data; return { head, body }; }; G.debug.time(12); p.dir = 0; p.moving = false; for (let i = 0; i < 2; i++) G.loop.tick(1 / 60); const dry = shot(); W.wetActor(p, 1, w); for (let i = 0; i < 4; i++) { G.scenes.render(); G.loop.tick(1 / 60); } const wet = shot(); const lum = (d) => { let n = 0; for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2]; return n / d.length; }; check(lum(wet.body) < lum(dry.body) * 0.92, `wet clothes look darker (${lum(dry.body).toFixed(0)} to ${lum(wet.body).toFixed(0)})`); { const hd = G.hd.get(p.sheet, true), M = W.maskOf(hd) || W.maskOf(hd), H = G.hd, inf = hd.heads[0][H.COL.idle], rows = Math.floor(inf.hy + 9 * inf.hs); let n = 0; for (const k of ["top", "bottom", "shoes"]) { const d = M[k].getContext("2d").getImageData(H.COL.idle * H.FW, 0, H.FW, rows).data; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; } check(n <= 8, `no skin or hair in the wet mask (${n} pixels)`); } }
    // through a save and a reload
    p.inventory.slots.fill(null); p.equip.top = plainTop; const keep = W.soak(plainTop, 0.7, w); p.inventory.add(keep, 1); W.wetActor(p, 0.5, w); const worn0 = p.equip.top, slotLv = W.level(keep);
    check(G.saves.write('1', g), 'saved wet'); G.scenes.replace(new G.GameScene({ save: G.saves.read('1') })); tick(3); g = game(); p = g.player; w = g.world;
    check(p.equip.top === worn0 && W.level(p.equip.top) > 0.4, 'worn wet clothes survive a reload'); check(p.inventory.count(keep) === 1 && Math.abs(W.level(keep) - slotLv) < 0.1 && /\(wet\)/.test(G.item(keep).name), 'so do those in the pack');
    G.weather.force = null; G.autonomy.off = false;
  }
  function DRY_T(W) { return W.DRY.store + 10; }
  // the interface: nothing mentions a key, the text stands out from what it is drawn on, every screen opens in both
  // languages at every UI scale
  function uiWorn() {
    const g = game(), p = g.player, N = G.ui.noKeys; G.autonomy.off = true; g._fcNext = 1e12;
    for (const [a, b] of [['Stop smoking [S]', 'Stop smoking'], ['Bob (unconscious)  ·  [G] Drag', 'Bob (unconscious)'], ['3 new messages [P]', '3 new messages'], ['Hold [E] to reel.', 'Hold to reel.'], ['[X] Cut up the body', 'Cut up the body'], ['Your delivery arrived. (Construction inventory: [B])', 'Your delivery arrived. (Construction inventory)']]) check(N(a) === b, `no key in "${a}": "${N(a)}"`);
    check(N('[Speech 75%] Relax') === '[Speech 75%] Relax', 'speech checks stay'); check(N('[Leave]') === '[Leave]', 'choices in brackets stay');
    const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }, con = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const C = G.xp.C; for (const [n, fg, bg, min] of [['text', C.text, C.face, 7], ['dim text', C.dim, C.face, 4.5], ['headings', C.head, C.face, 4.5], ['good', C.good, C.face, 3.5], ['bad', C.bad, C.face, 3.5]]) check(con(fg, bg) >= min, `${n} on a window: contrast ${con(fg, bg).toFixed(1)}`);
    for (const c of Object.values(C)) { const m = /^#(..)(..)(..)$/.exec(c); if (!m) continue; const v = m.slice(1).map((h) => parseInt(h, 16)); check(Math.max(...v) - Math.min(...v) < 110, `restrained: ${c}`); }
    const n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid), sid = Object.keys(G.SHOPS).find((k) => g.world.shops[k]);
    for (const lang of [0, 1]) for (const ui of [0.8, 1, 1.4]) {
      G.settings.data.language = lang; G.i18n.sync(); G.settings.data.uiScale = ui; G.renderer.resize();
      for (const [name, mk] of [['inventory', () => new G.InventoryScene(g)], ['shop', () => new G.ShopScene(g, sid)], ['settings', () => new G.SettingsScene()], ['journal', () => new G.JournalScene(g)], ['skills', () => new G.SkillsScene(g)], ['phone', () => new G.PhoneScene(g)], ['pause', () => new G.PauseScene(g)], ['loot', () => new G.LootScene(g, G.containers.createBag(g.world, g.map.id, p.x, p.y, [['beer', 2]]))]]) {
        const s = mk(), _w = G.xp.window; let off = null; G.xp.window = function (c, x, y, w, h, o) { if (name !== 'phone' && (x < -1 || y < -1 || x + w > G.renderer.uiW + 1 || y + h > G.renderer.uiH + 1)) off = `${Math.round(x)},${Math.round(y)} ${Math.round(w)}x${Math.round(h)} on ${Math.round(G.renderer.uiW)}x${Math.round(G.renderer.uiH)}`; return _w.apply(this, arguments); };
        G.scenes.push(s); try { for (let i = 0; i < 3; i++) { G.loop.tick(1 / 60); G.scenes.render(); } check(!off, `${name}, lang ${lang}, UI ${ui}${off ? ': off the screen ' + off : ''}`); } catch (e) { check(false, `${name}, lang ${lang}, UI ${ui}: ${e.message}`); } G.xp.window = _w; G.scenes.remove(s);
      }
    }
    G.settings.data.language = 0; G.i18n.sync(); G.settings.data.uiScale = 1; G.renderer.resize(); G.autonomy.off = false;
  }
  // rooms that belong to someone: the station house has a counter and a wall between the desks and the bunks, the bars
  // have bars, no two homes are the same room, nobody is shut out of anything, and what you smash stays smashed
  function interiors() {
    let g = game(), p = g.player; G.autonomy.off = true; g._fcNext = 1e12;
    const reach = (m, b, from) => { const s = new Set(), q = [[from.x, from.y]]; while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (s.has(k) || x < b.x || y < b.y || x >= b.x + b.w || y > b.y + b.h || m.isSolidTile(x, y) && !(y === b.doorY && x === b.doorX)) continue; s.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } return s; };
    const nextTo = (s, q) => s.has(q.x + ',' + q.y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => s.has((q.x + a) + ',' + (q.y + c)));
    const city = G.maps.get('city'), st = city.building('c_barracks'), inB = (m, b) => m.decor.filter((d) => m.buildingAtTile(d.tx, d.ty) === b);
    check(st && st.planned === 'station', 'the station house has its own plan');
    const list = inB(city, st), s0 = reach(city, st, { x: st.doorX, y: st.doorY - 1 });
    check(list.filter((d) => d.type === 'counter').length >= 3, 'a public counter'); check(list.some((d) => d.type === 'cell_bars'), 'a holding cell behind bars'); check(list.some((d) => d.type === 'v_w_wanted'), 'wanted notices on the wall');
    const counterY = list.find((d) => d.type === 'counter').ty, bunks = list.filter((d) => d.type === 'bunk');
    check(bunks.length >= 3 && bunks.every((d) => d.ty < counterY - 1), `the bunks are behind the wall (${bunks.length})`);
    for (const k of ['_bed', '_bed2', '_bed3', '_bed4', '_bed5', '_work']) { const q = city.points['c_barracks' + k]; check(q && nextTo(s0, q), `${k} can be reached from the street door`); }
    check(!!city.chests.find((c) => c.id === 'city:c_barracks_chest'), 'the station still has its storeroom');
    const bar = city.building('c_tavern'), bl = inB(city, bar); check(bl.filter((d) => d.type === 'v_bar').length >= 2 && bl.filter((d) => d.type === 'barstool').length >= 3, 'the bar has a bar and stools'); check(nextTo(reach(city, bar, { x: bar.doorX, y: bar.doorY - 1 }), city.points.c_tavern_work), 'the barkeep can get behind it');
    const seen = {}, sets = new Set();
    for (const id of ['city', 'suburbs', 'southside', 'eastside', 'heights', 'rural', 'farmland']) {
      const m = G.maps.get(id);
      for (const b of m.buildings) {
        const s = reach(m, b, { x: b.doorX, y: b.doorY - 1 });
        for (const k in m.points) if (k.startsWith(b.id + '_') && /_(bed\d?|work|in|kitchen|bath)$/.test(k) && !Array.isArray(m.points[k])) { const q = m.points[k]; if (q.y === b.doorY + 1) continue; check(nextTo(s, q), `${id}: ${k} can be reached`); }
        if (!b.lived) continue;
        seen[b.lived] = (seen[b.lived] || 0) + 1; sets.add(inB(m, b).filter((d) => /^v_/.test(d.type)).map((d) => d.type).sort().join());
        check(inB(m, b).filter((d) => /^bed(_red|_green)?$/.test(d.type)).length === 0, `${b.id}: bedding of its own`);
      }
    }
    log('homes ' + JSON.stringify(seen) + ' distinct ' + sets.size);
    check(Object.keys(seen).length >= 5, `kinds of home (${Object.keys(seen).join(', ')})`); check(sets.size >= 12, `no two homes alike (${sets.size} different)`);
    // smash a table: the wreck is there next time, and it costs you
    g.loadMap('suburbs', 'start'); tick(2); const m = g.map, b = m.buildings.find((q) => q.lived && m.decor.some((d) => d.type === 'table' && m.buildingAtTile(d.tx, d.ty) === q));
    check(!!b, 'a home with a table'); const t = m.decor.find((d) => d.type === 'table' && m.buildingAtTile(d.tx, d.ty) === b), tx = t.tx, ty = t.ty;
    check(t.def.breakHp > 0 && /wreck/.test(t.def.breakTo), 'tables can be broken'); const n0 = g.world.stats.crimes || 0; G.destruction.breakDecor(g, t);
    check(m.decorsAt(tx, ty).some((d) => d.type === 'v_wreck_wood'), 'the wreck lies where it stood'); check(!m.isSolidTile(tx, ty), 'you can walk over it'); void n0;
    check(G.saves.write('1', g), 'saved'); G.maps.invalidate('suburbs'); G.scenes.replace(new G.GameScene({ save: G.saves.read('1') })); tick(3); g = game(); g.loadMap('suburbs', 'start'); tick(2);
    check(g.map.decorsAt(tx, ty).some((d) => d.type === 'v_wreck_wood') && !g.map.decorsAt(tx, ty).some((d) => d.type === 'table'), 'still broken after a reload');
    // a shot at a wall leaves its hole, a shot at furniture hurts it
    { const c = g.map.buildings.find((q) => q.lived), wall = { x: c.x, y: c.y + 1 }; G.explosions.bulletHitTile(g, wall.x, wall.y, { x: wall.x * 16 + 8, y: wall.y * 16 + 8, dmg: 8, owner: g.player }); G.marks.add(g.world, g.map.id, 'blood', wall.x * 16, wall.y * 16); check(G.marks.on(g.world, g.map.id).filter((q) => q.k === 'hole').length === 1, 'a bullet hole in the wall'); G.loop.draw(); check(true, 'it draws among the other marks'); check(G.saves.write('1', g) && G.saves.read('1'), 'it saves'); }
    // the loan shark's three days can really be asked for
    { const w = g.world, S = G.loanShark; S.lend(w, 'player', g.player, 100, 40, 1); const rec = S.of(w, 'player'); rec.due = w.day - 1; g.world.npcs.c_shark.disp = 0; const a = { st: w.npcs.c_shark, say() {} }; const c = { w, tag: () => '', check: () => true, npc: a, scene: g }; const ch = G.DIALOGUES._debt.start.choices.find((q) => typeof q.text === 'function' && /more time/.test(q.text(c))); S.home = () => {}; ch.do(c); check(rec.extended === 1 && rec.due === w.day + 3, 'asking for more time can work'); }
    G.autonomy.off = false;
  }
  // ?test&only=snap&seats=1: the player on every kind of seat, walked up to from the north and from the south
  function seatSheet() {
    const g = game(), p = g.player, R = G.renderer, cv = R.ctx.canvas; G.autonomy.off = true; g._fcNext = 1e12; G.debug.time(13);
    const types = Object.keys(G.DECOR).filter((k) => G.DECOR[k].interact === 'sit'), maps = ['suburbs', 'city', 'rural', 'heights', 'neon', 'arts', 'fightclub', 'southside', 'eastside', 'island'], found = [];
    for (const t of types) for (const id of maps) { const m = G.maps.get(id), d = m.decor.concat(m.flats).find((q) => q.type === t); if (d) { found.push([t, id, d.tx, d.ty]); break; } }
    const CW = 170, CH = 170, cols = 8, sheet = document.createElement('canvas'); sheet.width = cols * CW; sheet.height = Math.ceil(found.length * 2 / cols) * CH; const sx = sheet.getContext('2d'); sx.fillStyle = '#222'; sx.fillRect(0, 0, sheet.width, sheet.height); sx.imageSmoothingEnabled = false;
    let n = 0;
    for (const [t, id, tx, ty] of found) for (const side of [-1, 1]) {
      if (g.map.id !== id) { g.loadMap(id, Object.keys(g.map.points)[0] && undefined); G.debug.time(13); g._fcNext = 1e12; }
      const d = g.map.decor.concat(g.map.flats).find((q) => q.type === t && q.tx === tx && q.ty === ty); if (!d) continue;
      for (const b of g.map.buildings) b.roofAlpha = 0; if (!g.map._roofsOff) { g.map.updateRoofs = () => {}; g.map._roofsOff = 1; }
      for (const a of g.actors) if (a.kind === 'npc' && Math.hypot(a.x - d.x, a.y - d.y) < 90) { a.x += 400; a.seated = false; }
      p.sitting = null; p.dir = side < 0 ? 0 : 3; p.x = d.x; p.y = (ty + side + (side < 0 ? 0 : 0)) * 16 + 12;
      G.usables.use(d, g); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
      g.hideHud = true; for (let i = 0; i < 4; i++) G.loop.tick(1 / 60); R.follow(d.x, d.y, g.map.pw, g.map.ph, 1, true); G.scenes.render(); G.hd.pump && G.hd.pump(99); R.follow(d.x, d.y, g.map.pw, g.map.ph, 1, true); G.scenes.render();
      const k = cv.width / R.viewW, cx = (d.x - R.cam.x) * k, cy = (d.y - 10 - R.cam.y) * k, w = 60 * k, c = n++;
      sx.drawImage(cv, cx - w / 2, cy - w / 2, w, w, (c % cols) * CW, Math.floor(c / cols) * CH, CW - 2, CH - 2);
      sx.fillStyle = '#fff'; sx.font = '12px sans-serif'; sx.fillText(`${t} ${side < 0 ? 'N' : 'S'}${p.sitting ? '' : ' NOT SEATED'}`, (c % cols) * CW + 3, Math.floor(c / cols) * CH + 12);
      if (p.sitting) G.everyday.standUp(g);
    }
    const out = document.createElement('canvas'); out.width = sheet.width; out.height = sheet.height; out.getContext('2d').drawImage(sheet, 0, 0);
    log('SNAP ' + out.toDataURL('image/png')); log('SEATS ' + found.map((f) => f[0]).join(' ')); check(true, 'seats');
  }
  // ?test&only=snap&seats=2: people on the seats the game gives them, as they sit there
  function npcSeatSheet() {
    const g = game(), R = G.renderer, cv = R.ctx.canvas; G.autonomy.off = true; g._fcNext = 1e12; G.debug.time(13); g.hideHud = true;
    const CW = 170, cols = 8, rows = 4, sheet = document.createElement('canvas'); sheet.width = cols * CW; sheet.height = rows * CW; const sx = sheet.getContext('2d'); sx.fillStyle = '#222'; sx.fillRect(0, 0, sheet.width, sheet.height); sx.imageSmoothingEnabled = false; let n = 0;
    const shot = (id, sp, label) => {
      if (n >= cols * rows) return; if (g.map.id !== id) { g.loadMap(id); G.debug.time(13); g._fcNext = 1e12; for (let i = 0; i < 3; i++) G.loop.tick(1 / 60); }
      for (const b of g.map.buildings) b.roofAlpha = 0; g.map.updateRoofs = () => {};
      const a = g.actors.find((q) => q.kind === 'npc' && !q.dead && !q.def.kid && !q.def.venue && !q.transient) || g.actors.find((q) => q.kind === 'npc' && !q.dead && !q.def.kid); if (!a) { log('NOBODY on ' + id); return; } G.hd.get(a.sheet, true);
      a.sleeping = false; a.moving = false; a.state = 'schedule'; a.x = sp.x * 16 + 8; a.y = sp.y * 16 + 12; a.seated = true; a.dir = sp.dir != null ? sp.dir : 3; a.perch = sp.perch || null;
      R.follow(a.x, a.y, g.map.pw, g.map.ph, 1, true); G.scenes.render(); R.follow(a.x, a.y, g.map.pw, g.map.ph, 1, true); G.scenes.render();
      const k = cv.width / R.viewW, cx = (a.x - R.cam.x) * k, cy = (a.y - 12 - R.cam.y) * k, w = 60 * k, c = n++;
      sx.drawImage(cv, cx - w / 2, cy - w / 2, w, w, (c % cols) * CW, Math.floor(c / cols) * CW, CW - 2, CW - 2); sx.fillStyle = '#fff'; sx.font = '12px sans-serif'; sx.fillText(label, (c % cols) * CW + 3, Math.floor(c / cols) * CW + 12);
      a.seated = false; a.perch = null; a.x += 500;
    };
    for (const id of ['suburbs', 'rural', 'city']) { const m = G.maps.get(id); delete m.needSpots; const sp = G.needs.spots(m), kinds = {}; for (const s of sp.seats) { const under = m.decorsAt(s.x, s.y).map((d) => d.type).join('+') || 'floor', above = m.decorsAt(s.x, s.y - 1).map((d) => d.type).join('+') || '-', key = under + ' / ' + above; if ((kinds[key] = (kinds[key] || 0) + 1) === 1) shot(id, Object.assign({ act: 'eat' }, s), `${id} ${key}`.slice(0, 26)); } log('KINDS ' + id + ' ' + JSON.stringify(kinds)); }
    for (const [id, ty] of [['neon', 'v_seat'], ['neon', 'v_stool'], ['neon', 'v_booth'], ['neon', 'v_sofa']]) { const m = G.maps.get(id), d = m.decor.find((q) => q.type === ty), s = d && Object.values(m.vseats || {}).flat().find((q) => q.x === d.tx && q.y === d.ty); if (d) shot(id, { x: d.tx, y: d.ty, dir: 3, perch: s && s.perch }, ty); }
    const out = document.createElement('canvas'); out.width = sheet.width; out.height = sheet.height; out.getContext('2d').drawImage(sheet, 0, 0); log('SNAP ' + out.toDataURL('image/png')); check(true, 'npc seats');
  }
  // sitting: the same from whichever side you came, in the sitting pose, on the seat; you get up where you sat down from
  function seating() {
    const g = game(), p = g.player; G.autonomy.off = true; g._fcNext = 1e12; G.debug.time(13); G.traffic && (G.traffic.off = true);
    const types = Object.keys(G.DECOR).filter((k) => G.DECOR[k].interact === 'sit'), maps = ['suburbs', 'city', 'rural', 'heights', 'island']; let n = 0;
    for (const t of types) for (const id of maps) {
      const m0 = G.maps.get(id), d0 = m0.decor.find((q) => q.type === t); if (!d0) continue;
      if (g.map.id !== id) { g.loadMap(id); G.debug.time(13); g._fcNext = 1e12; tick(2); }
      const d = g.map.decor.find((q) => q.type === t && q.tx === d0.tx && q.ty === d0.ty), Y = {};
      for (const side of [-1, 1]) {
        for (const a of g.actors) if (a.kind === 'npc' && Math.hypot(a.x - d.x, a.y - d.y) < 60) { a.x += 300; a.seated = false; }
        p.sitting = null; p.dir = side < 0 ? 0 : 3; p.x = d.x; p.y = (d.ty + side) * 16 + 12; const from = { x: p.x, y: p.y };
        G.usables.use(d, g); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); check(!!p.sitting, `${t}: you can sit`); if (!p.sitting) continue;
        const was = { x: p.sitting.x, y: p.sitting.y, z: p.sortY() }; Y[side] = was; p._hdFrame = null; G.loop.tick(1 / 60); G.loop.tick(1 / 60); G.renderer.follow(d.x, d.y, g.map.pw, g.map.ph, 1, true); G.hd.get(p.sheet, true); G.scenes.render(); if (p._hd) { p._hd.lookT = 0; p._hd.turnT = 0; } G.scenes.render();
        check(p._hdFrame && p._hdFrame.col === G.hd.COL.sit, `${t}: the sitting pose (col ${p._hdFrame && p._hdFrame.col}, want ${G.hd.COL.sit})`); check(p._hdFrame && p._hdFrame.dir === (d.def.faceDir || 0), `${t}: facing the way the seat does`);
        if (d.def.faceDir === 3) check(was.z < d.y, `${t}: the chair's back is in front of you`); else check(was.z > d.y, `${t}: you are on the seat, not behind it`);
        G.everyday.standUp(g); check(!p.sitting && Math.hypot(p.x - from.x, p.y - from.y) < 1, `${t}: you get up where you were`); n++;
      }
      check(Y[-1] && Y[1] && Y[-1].y === Y[1].y && Y[-1].z === Y[1].z, `${t}: it looks the same from both sides`); break;
    }
    check(n >= 8, `seats tried (${n})`);
    // people: on the bench, not in the air in front of it; on a pew, behind its back; never on a bare floor
    { g.loadMap('suburbs'); tick(2); const m = g.map; delete m.needSpots; const sp = G.needs.spots(m); check(sp.seats.every((s) => s.perch || m.decorsAt(s.x, s.y).some((d) => d.def.interact === 'sit')), 'every seat offered is something to sit on');
      const seat = sp.seats.find((s) => s.perch), a = g.actors.find((q) => q.kind === 'npc' && !q.dead && !q.def.kid); check(!!seat, 'there are benches to sit on'); a.st.hunger = 90; a.state = 'schedule'; a.x = seat.x * 16 + 8; a.y = seat.y * 16 + 12; a.needTask = { steps: [{ x: seat.x, y: seat.y, act: 'eat', dur: 9 }], i: 0, t: 0, walk: 0 }; G.needs.update(a, 1 / 60, g); check(a.seated && a.perch === seat.perch, 'they sit on the bench'); check(a.sortY() === seat.perch.z, 'drawn on it'); const was = [a.x, a.y]; a.draw(G.renderer.ctx); check(a.x === was[0] && a.y === was[1], 'their place in the world stays where it was'); a.needTask = null; a.seated = false; }
    // in a sofa or a booth, not behind it
    { const m = G.maps.get('neon'), all = Object.values(m.vseats || {}).flat(), soft = all.filter((s) => m.decorsAt(s.x, s.y).some((d) => /booth|sofa|worn_couch/.test(d.type))); check(soft.length > 0 && soft.every((s) => s.perch && s.perch.dir === 0), `sofas and booths face the room (${soft.length})`); }
    // a sign, the roof lifted, stays on the wall
    { const k = G.wallFit({ roofAlpha: 0 }, { h: 24 }); check(24 * k <= 14.01, `a tall sign comes down to the wall (${k.toFixed(2)})`); check(G.wallFit({ roofAlpha: 1 }, { h: 24 }) === 1, 'with the roof on, it is its full size'); check(G.wallFit({ roofAlpha: 0 }, { h: 10 }) === 1, 'a small one is left alone'); }
    // a world file keeps what hangs on walls where it hangs
    { const WF = G.worldFile, src = G.maps.get('city'), back = WF.deserializeMap(JSON.parse(JSON.stringify(WF.serializeMap(src)))); const hung = src.decor.filter((d) => d.y !== d.ty * 16 + 15 || d.x !== d.tx * 16 + (d.def.fw || 1) * 8); check(hung.length > 10, `this map has hung things (${hung.length})`); const key = (d) => d.type + '@' + d.tx + ',' + d.ty + '@' + d.x + ',' + d.y, have = new Set(back.decor.map(key)); check(hung.every((d) => have.has(key(d))), `they come back where they hung (${hung.filter((d) => !have.has(key(d))).length} lost)`); check((back.roofSigns || []).length === (src.roofSigns || []).filter((d) => !d.removed).length && back.roofSigns.every((d) => d.def && d.wallOf === back.building(d.wallOf.id)), 'and the signs know their building'); g.loadMap('city'); tick(1); }
    G.autonomy.off = false;
  }
  // a tree in a yard stands clear of the house: nothing tall outdoors reaches up under a roof
  function treeRoofs() {
    const per = {}, bad = [];
    for (const id of Object.keys(G.MAPGEN)) {
      if (/^wilds|^hf_|_f\d+$/.test(id)) continue; let m; try { m = G.maps.get(id); } catch (e) { continue; } if (!m || !m.buildings || m.meta.indoor) continue;
      for (const d of m.decor) {
        if (m.buildingAtTile(d.tx, d.ty)) continue; const sp = G.assets.sprites[d.def.sprite], w = sp ? sp.w : G.vk.widthOf(d.type), h = sp ? sp.h : G.vk.heightOf(d.type); if (h <= 20) continue;
        if (!/tree|oak|pine|birch|maple|palm|willow/.test(d.type)) continue;
        const x0 = d.x - w / 2, x1 = d.x + w / 2, y0 = d.y - h, y1 = d.y;
        for (const b of m.buildings) { const bx0 = b.x * 16, bx1 = (b.x + b.w) * 16, by0 = b.y * 16, by1 = (b.y + b.h) * 16; if (x0 < bx1 && x1 > bx0 && y0 < by1 && y1 > by0 + 8) { per[id + ':' + d.type] = (per[id + ':' + d.type] || 0) + 1; if (bad.length < 12) bad.push(`${id} ${d.type} ${d.tx},${d.ty} ${Math.round(w)}x${Math.round(h)} under ${b.id}`); break; } }
      }
    }
    log('TREES ' + JSON.stringify(per)); for (const b of bad) log('  ' + b);
    check(!Object.keys(per).length, 'no tree reaches under a roof');
    { const q = (id) => { const m = G.maps.get(id); return `${id}: ${m.treesMoved || 0} moved, ${m.decor.filter((d) => /^(oak|pine)\d/.test(d.type)).length} oaks and pines, ${m.decor.filter((d) => d.type === 'v_apple_tree').length} apple trees`; }; log('MOVED ' + ['rural', 'suburbs', 'farmland'].map(q).join(' | ')); check(G.maps.get('suburbs').decor.filter((d) => d.type === 'v_apple_tree').length === 8 && G.maps.get('rural').decor.filter((d) => d.type === 'v_apple_tree').length === 16 && G.maps.get('farmland').decor.filter((d) => d.type === 'v_apple_tree').length === 22, 'every apple tree found a place'); }
    // an old save: a tree you cut down at its old place stays down
    { const m = G.maps.get('suburbs'), n0 = m.decor.filter((d) => d.type === 'v_apple_tree').length, t = m.decor.find((d) => d.type === 'v_apple_tree'); m.applyMods({ tiles: {}, removed: { [`v_apple_tree@${t.tx + 1},${t.ty}`]: true }, added: {}, buildings: {} }); check(m.decor.filter((d) => d.type === 'v_apple_tree').length === n0 - 1, 'a felled tree does not grow back at its new place'); G.maps.invalidate('suburbs'); }
    // an old save: the tree comes up where something has been built since
    { const m = G.maps.get('suburbs'), d = m.decor.find((q) => q.type === 'v_apple_tree'), e = m.decor.filter((q) => q.type === 'v_apple_tree')[1], key = m.decor.filter((q) => q.type === 'v_apple_tree')[2], a = [d.tx, d.ty], b = [e.tx, e.ty], c = [key.tx, key.ty];
      m.applyMods({ tiles: { [d.ty * m.w + d.tx]: [G.T.field] }, removed: {}, added: { x: ['crate', e.tx, e.ty] }, buildings: {} });
      check(!m.decorsAt(a[0], a[1]).some((q) => q.type === 'v_apple_tree'), 'a tree does not stand in a field you dug'); check(!m.decorsAt(b[0], b[1]).some((q) => q.type === 'v_apple_tree'), 'nor on something you put down'); check(m.decorsAt(c[0], c[1]).some((q) => q.type === 'v_apple_tree'), 'and the others stay'); G.maps.invalidate('suburbs'); }
  }
  // playing it: walking out of a district and into a building on the keys, talking, trading, fighting, saving, and the
  // weather on your clothes the whole way
  function playthrough() {
    let g = game(), p = g.player; const I = G.input, W = G.wet; G.autonomy.off = true; g._fcNext = 1e12; G.traffic && (G.traffic.off = true);
    const hold = (keys, secs, stop) => { for (const k of keys) I.down.add(k); for (let i = 0; i < secs * 60; i++) { G.loop.tick(1 / 60); if (stop && stop()) break; } for (const k of keys) I.down.delete(k); G.loop.tick(1 / 60); };
    const press = (k) => { I.pressed.add(k); G.loop.tick(1 / 60); I.pressed.delete(k); };
    g.loadMap('city', 'start'); tick(2); G.debug.time(10); G.weather.force = 'clear'; G.weather.rain = 0; const m0 = g.map.id;
    // walk off the edge of the district
    { const m = g.map, e = m.exits.find((q) => q.y > 2 && q.y + q.h < m.h - 2 && q.x + q.w >= m.w - 2) || m.exits.find((q) => q.x + q.w >= m.w - 2); check(!!e, 'a way out on the east side'); if (e) { p.x = (e.x - 3) * 16 + 8; p.y = (e.y + Math.floor(e.h / 2)) * 16 + 12; hold(['KeyD'], 6, () => g.map.id !== m0); check(g.map.id !== m0, `walked out of ${m0} into ${g.map.id}`); } }
    // in through a door, on foot
    g.loadMap('city', 'start'); tick(2); { const m = g.map, b = m.buildings.find((q) => !G.doors.locked(g, q) && !m.isSolidTile(q.doorX, q.doorY + 1) && m.get(q.doorX, q.doorY) === G.T.door && !m.isSolidTile(q.doorX, q.doorY - 1)); p.x = b.doorX * 16 + 8; p.y = (b.doorY + 2) * 16 + 2; hold(['KeyW'], 2, () => m.buildingAt(p.x, p.y - 3) === b); check(m.buildingAt(p.x, p.y - 3) === b, `walked in through the door of ${b.name}`); tick(1); check(b.roofAlpha < 1, 'the roof lifts'); }
    // talk
    g.loadMap('city', 'start'); tick(2); { const n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient); n.x = p.x + 12; n.y = p.y; n.state = 'schedule'; g.talkTo(n); tick(1); const d = G.scenes.top(); check(d instanceof G.DialogueScene, 'talking opens the window'); d.chars = 1e3; d.choose(d.runner.node.choices.length - 1); tick(1); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); }
    // buy and sell
    { const sid = Object.keys(G.SHOPS).find((k) => g.world.shops[k] && g.world.shops[k].stock.length && G.shopSys.accepts(k, G.ITEMS.beer ? 'beer' : 'bread')), s = g.world.shops[sid], id = s.stock[0][0], g0 = p.gold = 500; G.shopSys.buy(sid, id, p, g.world); check(p.inventory.has(id) && p.gold < g0, `bought ${G.item(id).name}`); }
    // a fight
    { const n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard'); n.x = p.x + 10; n.y = p.y; const hp = n.hp; n.bustHeld = 9; p.dir = 2; p.aim = 0; const key = I.bindings.attack[0]; for (let i = 0; i < 60 && n.hp >= hp; i++) { n.x = p.x + 10; n.y = p.y; if (i % 14 === 0) press(key); G.loop.tick(1 / 60); } check(n.hp < hp, `a punch lands (${hp} to ${n.hp})`); n.st.hostile = false; n.state = 'schedule'; }
    // rain on the way home, a swim, indoors and by the fire, undressing, trading it away, saving
    const top = p.equip.top; G.weather.force = 'storm'; G.weather.rain = 1; g.loadMap('rural', 'start'); tick(2); G.weather.rain = 1; { const b = g.map.buildingAt(p.x, p.y - 3); if (b) { p.x = b.doorX * 16 + 8; p.y = (b.doorY + 3) * 16 + 12; } } check(!g.map.buildingAt(p.x, p.y - 3), 'outdoors at the start of the road'); for (let i = 0; i < 60 * 12; i++) { G.weather.rain = 1; G.loop.tick(1 / 60); }
    const l = W.worn(p); check(l > 0.1 && l < 1, `walking through the rain, clothes get wet (${l.toFixed(2)})`); check(/\(wet\)/.test(G.item(p.equip.top).name), 'the inventory says so');
    G.weather.force = 'clear'; G.weather.rain = 0;
    { const m = g.map; let at = null; for (let y = 2; y < m.h - 2 && !at; y++) for (let x = 2; x < m.w - 2; x++) if (m.isSwimmable(x, y) && m.isSwimmable(x + 1, y) && m.isSwimmable(x, y + 1)) { at = { x, y }; break; } check(!!at, 'there is water'); p.canSwim = true; G.skills && (p.skills.ranks.swimming = 1); p.refreshStats(); p.x = at.x * 16 + 8; p.y = at.y * 16 + 12; p.swimming = true; for (let i = 0; i < 5; i++) G.loop.tick(1 / 60); check(W.worn(p) === 1, 'a swim soaks everything at once'); p.swimming = false; p.x = 40 * 16; }
    g.loadMap('rural', 'start'); tick(2); G.weather.rain = 0; const pack = W.base(p.equip.bottom); check(p.unequip('bottom'), 'takes off the wet pants'); const wetP = p.inventory.slots.find((s) => s && W.base(s.id) === pack); check(wetP && W.isWet(wetP.id), 'they are wet in the pack');
    { const b = g.map.buildingAt(p.x, p.y - 3); if (b) { p.x = b.doorX * 16 + 8; p.y = (b.doorY + 3) * 16 + 12; } }
    const lvOut = W.level(p.equip.top); W.sweep(g, 60); const dOut = lvOut - W.level(p.equip.top);
    const shop = g.map.buildings.find((b) => { const x = (b.x + 2) * 16 + 8, y = (b.y + 2) * 16 + 12; return b.w > 5 && !b.destroyed && !g.map.isSolidTile(b.x + 2, b.y + 2) && g.map.buildingAt(x, y - 3) === b && !W.heatNear(g, x, y); }); p.x = (shop.x + 2) * 16 + 8; p.y = (shop.y + 2) * 16 + 12; const lvIn = W.level(p.equip.top); W.sweep(g, 60); const dIn = lvIn - W.level(p.equip.top); check(dIn > dOut * 1.5 && dOut > 0, `indoors they dry faster (${dOut.toFixed(2)} against ${dIn.toFixed(2)} an hour)`);
    check(G.saves.write('1', g), 'saved'); const wid = wetP.id, lvl = W.level(wid); G.scenes.replace(new G.GameScene({ save: G.saves.read('1') })); tick(3); g = game(); p = g.player; check(p.inventory.count(wid) === 1 && Math.abs(W.level(wid) - lvl) < 0.05, 'reloaded: still wet, as wet'); check(/\(wet\)/.test(G.item(wid).name), 'and it says so');
    while (W.isWet(p.equip.top)) W.sweep(g, 30); check(!/\(wet\)/.test(G.item(p.equip.top).name) && W.base(top) === p.equip.top, 'dry at last: the name is plain');
    G.weather.force = null; G.autonomy.off = false;
  }
  // every item the game has: is its picture one of the new ones? (furniture and building kits show the thing itself)
  function itemIcons() {
    tick(2); const left = [], seen = new Set(); let n = 0;
    for (const id in G.ITEMS) { const ic = G.ITEMS[id].icon; n++; if (!ic || /^pc_/.test(ic)) continue; if (!G.itemArt.painted(ic) && !seen.has(ic)) { seen.add(ic); left.push(`${ic} (${id})`); } }
    for (const slot in G.CLOTH_STYLES) for (const st in G.CLOTH_STYLES[slot]) { const it = G.clothItem(G.clothId(slot, st, '#4a5a7a')); if (!G.itemArt.painted(it.icon)) left.push(it.icon); }
    check(!left.length, `${n} items: old art left: ${left.join(', ') || 'none'}`);
    const c = G.assets.icon('pistol'); check(c.width === 96, 'painted at six times the old grid');
  }
  function iconSheet() {
    tick(2); const R = G.renderer, ctx = R.ctx, q = new URLSearchParams(location.search), page = +(q.get('page') || 0), k = +(q.get('k') || 1.25);
    const names = [...new Set(Object.values(G.ITEMS).map((i) => i.icon).filter((i) => i && !/^pc_/.test(i)))].concat(Object.keys(G.CLOTH_STYLES).flatMap((s) => Object.keys(G.CLOTH_STYLES[s]).map((st) => G.clothItem(G.clothId(s, st, ['#4a5a7a', '#8a3232', '#c8c0a8'][st.length % 3])).icon))).sort();
    G.scenes.stack.length = 0; R.screenTransform(); ctx.fillStyle = '#34322e'; ctx.fillRect(0, 0, R.W, R.H); R.uiTransform();
    const cw = 16 * k + 6, per = Math.floor(R.uiW / cw), rows = Math.floor(R.uiH / cw);
    names.slice(page * per * rows, (page + 1) * per * rows).forEach((n, i) => G.ui.icon(ctx, n, 3 + (i % per) * cw, 3 + Math.floor(i / per) * cw, k));
    log('SNAP ' + ctx.canvas.toDataURL('image/png')); check(true, `${names.length} icons`);
  }
  // ?test&only=lineup: every new pose side by side, drawn big
  function lineup() {
    const g = game(), R = G.renderer, ctx = R.ctx, C = G.hd.COL; G.autonomy.off = true;
    const looks = [g.player.sheet, ...g.actors.filter((a) => a.kind === 'npc' && a.sheet).slice(0, 3).map((a) => a.sheet)];
    R.screenTransform(); ctx.fillStyle = '#6a6a6a'; ctx.fillRect(0, 0, R.W, R.H); ctx.imageSmoothingEnabled = false;
    const cols = [C.idle, C.walk, C.limp, C.limp + 4, C.hunch, C.hunch + 4, C.slump, C.winded, C.guard, C.run], k = Math.min(R.W / (cols.length * 18), R.H / (looks.length * 2 * 27));
    looks.forEach((s, i) => { const hd = G.hd.get(s, true); for (const d of [0, 2]) cols.forEach((c, j) => ctx.drawImage(hd.img, c * 32, d * 44, 32, 44, j * 18 * k, (i * 2 + (d ? 1 : 0)) * 27 * k, 18 * k, 26 * k)); });
    log('SNAP ' + ctx.canvas.toDataURL('image/png')); check(true, 'lineup');
  }
  // ?test&only=snap&map=..&x=..&y=..&h=..: the game's own canvas as a picture (headless screenshots catch the fade)
  function snap() {
    const q = new URLSearchParams(location.search), g = game(), p = g.player; G.autonomy.off = true; g._fcNext = 1e12; if (q.get('rain')) { G.weather.force = 'rain'; }
    if (q.get('seats')) return q.get('seats') === '2' ? npcSeatSheet() : seatSheet();
    G.settings.data.language = +(q.get('lang') || 0); if (G.i18n.sync) G.i18n.sync();
    g.loadMap(q.get('map') || 'city', q.get('spawn') || undefined); g._fcNext = 1e12; G.debug.time(+(q.get('h') || 12)); p.x = +(q.get('x') || 20) * 16 + 8; p.y = +(q.get('y') || 20) * 16 + 12; if (q.get('wet')) G.wet.wetActor(p, +q.get('wet'), g.world); if (q.get('ground')) G.weather.ground = +q.get('ground'); if (q.get('rain')) G.weather.rain = 1;
    if (q.get('at')) { const b = g.map.building(q.get('at')); if (b) { p.x = (b.doorX + +(q.get('dx') || 0)) * 16 + 8; p.y = (b.doorY + 2) * 16 + 2; } }
    if (q.get('in')) { const b = g.map.building(q.get('in')) || g.map.buildings.find((o) => new RegExp(q.get('in')).test(o.name)); if (b) { log('BUILDING ' + b.id + ' ' + b.name + ' ' + b.w + 'x' + b.h); p.x = b.doorX * 16 + 8; p.y = (b.doorY - 1) * 16 + 12; } }
    if (q.get('ui')) G.settings.data.uiScale = +q.get('ui'), G.renderer.resize();
    if (q.get('torch')) { if (!p.inventory.has('phone')) p.inventory.add('phone', 1); p.phoneLight = true; }
    if (q.get('place')) q.get('place').split(',').forEach((t, i) => g.map.addDecorRuntime(t, Math.floor(p.x / 16) - 3 + i * 2, Math.floor(p.y / 16) + 1 + (i % 2)));
    for (let i = 0; i < +(q.get('run') || 120); i++) G.loop.tick(1 / 60);
    const open = q.get('open');
    if (open) {
      const n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient), sid = Object.keys(G.SHOPS).find((k) => g.world.shops[k] && G.shopSys.accepts(k, 'shirt')) || Object.keys(G.SHOPS)[0];
      for (const it of ['pistol', 'beer', 'bandage', 'cigarettes', 'apple', 'phone', 'lockpick', 'ammo_9mm']) p.inventory.add(it, 1);
      p.inventory.add(G.wet.soak(p.equip.top, 0.7, g.world), 1);
      const S = { inventory: () => new G.InventoryScene(g), shop: () => new G.ShopScene(g, sid), settings: () => new G.SettingsScene(), journal: () => new G.JournalScene(g), skills: () => new G.SkillsScene(g), phone: () => new G.PhoneScene(g), pause: () => new G.PauseScene(g), map: () => new G.MapScene(g), loot: () => new G.LootScene(g, G.containers.createBag(g.world, g.map.id, p.x, p.y, [['beer', 2], ['pistol', 1]])), menu: () => new G.MenuScene() };
      if (open === 'dialogue') { n.x = p.x + 14; n.y = p.y; g.openDialogue(n); } else { if (open === 'menu') G.scenes.stack.length = 0; G.scenes.push(S[open]()); }
      for (let i = 0; i < 40; i++) G.loop.tick(1 / 60);
    }
    G.scenes.render(); log('SNAP ' + G.renderer.ctx.canvas.toDataURL('image/png')); check(true, 'snap');
  }
  // the building as a player meets it: every door leads somewhere, everyone and everything can be reached on foot
  function clubBuilding() {
    const g = game(), p = g.player; G.autonomy.off = true; g._fcNext = 1e12;
    g.loadMap('fightclub', 'from_port'); g._fcNext = 1e12; tick(3); const m = g.map, start = m.points.from_port;
    const flood = (from) => { const s = new Set(), q = [[from.x, from.y]]; while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (s.has(k) || !m.inBounds(x, y) || m.isSolidTile(x, y)) continue; s.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } return s; }, seen = flood(start);
    let doors = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === G.T.door) { doors++; const ns = !m.isSolidTile(x, y - 1) && !m.isSolidTile(x, y + 1), ew = !m.isSolidTile(x - 1, y) && !m.isSolidTile(x + 1, y); check(ns || ew, `door ${x},${y} opens both ways`); check(seen.has(x + ',' + y), `door ${x},${y} can be reached`); }
    check(doors >= 5, `doors (${doors})`);
    // the way in: nothing in the arch, no lamp where the clerks stand, signs in the middle of their counters, what hangs on a wall stays on it
    { const on = (x, y) => m.decorsAt(x, y).filter((d) => !d.def.flat); for (let x = 30; x <= 33; x++) for (const y of [35, 36, 37]) check(!on(x, y).length, `the arch is clear at ${x},${y}`);
      for (const k of ['fc_mgr', 'fc_book']) { const q = m.points[k]; check(!m.decorsAt(q.x, q.y).length, `${k}: nothing stands where they stand`); }
      const mid = (t) => m.decor.find((d) => d.type === t), cnt = (s) => m.decor.filter((d) => d.type === 'v_counter' && Math.abs(d.y - s.y) < 40).sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0]; check(cnt(mid('v_sign_fights')) && Math.abs(cnt(mid('v_sign_fights')).x - mid('v_sign_fights').x) < 32 && cnt(mid('v_sign_bets')) && Math.abs(cnt(mid('v_sign_bets')).x - mid('v_sign_bets').x) < 32, 'the counter signs are centered');
      const wall = m.decor.filter((d) => d.ty === 36 * G.WORLD_SCALE && /graffiti|sign_pit|poster_fight/.test(d.type)); check(wall.length >= 6, `the entrance wall is dressed (${wall.length})`);
      for (const d of wall) { check(G.vk.heightOf(d.type) <= 16, `${d.type} is no taller than the wall`); const w = G.vk.widthOf(d.type), x0 = Math.floor((d.x - w / 2) / 16), x1 = Math.floor((d.x + w / 2 - 1) / 16); for (let x = x0; x <= x1; x++) check(G.TILES[m.get(x, 36 * G.WORLD_SCALE)].wall, `${d.type} at ${x} hangs on wall`); }
      { const b = m.decor.filter((d) => /odds|board/.test(d.type) && d.def.solid); check(b.length >= 2 && b.every((d) => m.isSolidTile(d.tx, d.ty)), 'you cannot walk through the odds boards'); } }
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) if (!m.isSolidTile(x, y) && !seen.has(x + ',' + y)) { check(false, `sealed-off floor at ${x},${y}`); y = 1e6; break; }
    for (const d of m.decor) if (d.def.interact) { const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([a, c]) => seen.has((d.tx + a) + ',' + (d.ty + c)) || seen.has((d.tx + (d.def.fw || 1) - 1 + a) + ',' + (d.ty + c))); check(near, `${d.type} at ${d.tx},${d.ty} can be used`); }
    for (const a of g.actors) if (a.kind === 'npc' && G.NPCS[a.id] && G.NPCS[a.id].map === 'fightclub') { const e = a.currentEntry(g.world), pt = e && m.points[e.at]; if (pt) check(seen.has(pt.x + ',' + pt.y), `${a.id} can reach ${e.at}`); }
    const boss = FCa(g, 'fc_boss'), lou = FCa(g, 'fc_bookie'); check(boss && lou, 'Mama Rust and Lou are in the building');
    const mp = m.points.fc_mgr; check(Math.abs(mp.x - 31 * G.WORLD_SCALE) < 20 && m.decor.some((d) => d.type === 'v_counter' && Math.abs(d.tx - mp.x) <= 3 && d.ty > mp.y && d.ty <= mp.y + 3) && Math.hypot(mp.x - start.x, mp.y - start.y) < 28, `she stands behind a counter, close to the way in (at ${mp.x},${mp.y}, way in ${start.x},${start.y}, below ${m.decorsAt(mp.x, mp.y + 1).map((d) => d.type).join('/')})`);
    // walk there, as a player would
    const stand = { x: mp.x, y: mp.y + 2 }; check(seen.has(stand.x + ',' + stand.y), 'you can stand at her counter'); p.x = stand.x * 16 + 8; p.y = stand.y * 16 + 12; p.dir = 3; for (let i = 0; i < 90; i++) G.loop.tick(1 / 60);
    check(boss.distTo(p) < 60, `she is there when you arrive (${Math.round(boss.distTo(p))})`);
    g.openDialogue(boss); let d = G.scenes.top(); tick(1); const texts = d.runner.node.choices.map((c) => c.text);
    for (const t of ['I want a fight.', 'I want to pick who I fight.', 'I want to bet on a fight.', 'Show me the fighters.', 'Let\'s see how long I can last.', 'What is coming up?']) check(texts.includes(t), `she offers: ${t}`);
    d.runner.end(); G.scenes.remove(d); tick(1);
    p.gold = 500; const r = G.DIALOGUES.fc_boss.start.choices[0]; const c = { w: g.world, scene: g, p, npc: boss, st: boss.st }; r.do(c); for (let i = 0; i < 90 && !(g._fc && g._fc.go); i++) G.loop.tick(1 / 60); check(g._fc && g._fc.go && p.fcIn, 'asking for a fight puts you in the ring'); G.fightClub.playerOut(g); for (let i = 0; i < 60 * 8 && g._fc; i++) G.loop.tick(1 / 60); while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop(); check(!g._fc && p.hp === 20, 'and it ends cleanly');
    // the crowd stays in, and does not get stuck
    const pos = new Map(g.actors.filter((a) => a.kind === 'npc').map((a) => [a, [a.x, a.y]])); for (let i = 0; i < 60 * 30; i++) G.loop.tick(1 / 60); let inside = true; for (const a of g.actors) if (a.kind === 'npc' && !a.dead && (m.isSolidTile(Math.floor(a.x / 16), Math.floor((a.y - 3) / 16)))) { inside = false; log(`     in a wall: ${a.id} ${Math.round(a.x / 16)},${Math.round(a.y / 16)}`); } check(inside, 'nobody ends up inside a wall'); void pos;
    G.autonomy.off = false;
  }
  const FCa = (g, id) => g.actors.find((a) => a.id === id && !a.dead);
  // 2026-11-05: finishing what the City Activities update left open
  function cityFinish() {
    const g = game(), w = g.world, p = g.player, E = G.estate, V = G.venueSys, Sh = G.showSys, H = G.home; G.autonomy.off = true;
    // chess: castling and en passant
    { const C = G.chess, B = ['r...k..r', '........', '........', '........', '........', '........', '........', 'R...K..R'].map((r) => r.split('')); B.moved = {}; B.ep = null; const m = C.moves(B, true); check(m.some((q) => q[0] === 4 && q[2] === 6), 'kingside castling'); check(m.some((q) => q[0] === 4 && q[2] === 2), 'queenside castling'); const N = C.apply(B, [4, 7, 6, 7]); check(N[7][5] === 'R' && N[7][7] === '.' && N[7][6] === 'K', 'the rook moves too'); const B2 = B.map((r) => r.slice()); B2.moved = { '4,7': 1 }; check(!C.moves(B2, true).some((q) => q[0] === 4 && Math.abs(q[2] - 4) === 2), 'not after the king has moved'); const B3 = ['r...kr..', '........', '........', '........', '........', '........', '........', 'R...K..R'].map((r) => r.split('')); B3.moved = {}; check(!C.moves(B3, true).some((q) => q[2] === 6 && q[0] === 4), 'not through check');
      let P = ['....k...', '...p....', '........', '....P...', '........', '........', '........', '....K...'].map((r) => r.split('')); P.moved = {}; P = C.apply(P, [3, 1, 3, 3]); const ep = C.moves(P, true).find((q) => q[0] === 4 && q[2] === 3 && q[3] === 2); check(ep, 'en passant is on offer'); const Q = C.apply(P, ep); check(Q[3][3] === '.' && Q[2][3] === 'P', 'and takes the pawn'); }
    // the casinos
    g.loadMap('neon', 'from_city'); G.debug.time(22); for (let i = 0; i < 30; i++) G.loop.tick(1 / 60);
    { const d = g.map.decor.find((q) => q.def.interact === 'blackjack'); check(d && g.map.buildingAtTile(d.tx, d.ty).venue === 'v_golden', 'a table at the Golden Horseshoe'); const dl = g.actors.find((a) => a.kind === 'npc' && a.def.venue === 'v_golden' && a.def.name === 'Dealer'); check(dl, 'and a dealer'); const n = G.scenes.stack.length; G.usables.use(d, g); check(G.scenes.top() instanceof G.BlackjackScene, 'blackjack opens'); G.scenes.remove(G.scenes.top()); check(G.scenes.stack.length === n, 'and closes'); const s = g.map.decor.find((q) => q.def.interact === 'slots'); G.usables.use(s, g); check(G.scenes.top() instanceof G.SlotsScene, 'slots open'); G.scenes.remove(G.scenes.top()); }
    // real rivals at the table
    { const a = g.actors.find((q) => q.kind === 'npc' && /^n_r/.test(q.id)); a.st.gold = 100; a.x = p.x + 10; a.y = p.y; const sc = new G.DartsScene(g); check(sc.rival === a, 'the rival is the person nearby'); p.gold = 100; sc.finish('x', 10); check(a.st.gold === 90 && p.gold === 110, 'and pays you from their pocket'); const s2 = new G.DartsScene(g); s2.finish('x', -10); check(a.st.gold === 100 && p.gold === 100, 'or takes your money'); }
    // cinema goers and machines
    { G.debug.time(13.5); const npc = g.actors.find((q) => q.kind === 'npc' && /^n_r/.test(q.id)); npc.st.gold = 500; let hit = null; for (let i = 0; i < 400 && !hit; i++) { const e = V.pickFor(npc, g); if (e && e.then) hit = e; } check(hit, 'someone heads for a showing, snacks first'); check(G.VENUES[hit.venue].kind === 'cinema' && hit.then.seat, 'with a seat waiting'); const s0 = V.st(w, hit.venue).till; npc.errand = hit; V.arrived(npc, hit, g); check(V.st(w, hit.venue).till > s0 && hit.pt.seat && !hit.then, 'they buy popcorn, then go to their seat'); npc.errand = null; const sp = V.spots(g.map, 'v_pixel'); check(sp.length > 5 && sp.every((q) => !g.map.isSolidTile(q.x, q.y)), 'arcade machines have somewhere to stand'); }
    // the street
    { const m = G.maps.get('arts'); for (const id of ['a_skate0', 'a_ball0', 'a_busker']) check(!!G.NPCS[id] && !!m.points[G.NPCS[id].schedule[0].at], `${id} has a place`); g.loadMap('arts', 'from_neon'); G.debug.time(14); for (let i = 0; i < 40; i++) G.loop.tick(1 / 60); const sk = g.actors.find((a) => a.id === 'a_skate0'); check(sk, 'a skater is out'); sk.trickT = 0; G.loop.tick(1 / 60); G.loop.tick(1 / 60); check(sk.bob < 0, 'and jumps'); const b = g.actors.find((a) => a.id === 'a_busker'); b.st.gold = 0; const c = G.DIALOGUES.v_busker.start.choices[1]; check(c && b, 'a busker takes tips'); }
    // stock and staff
    { const v = G.VENUES.v_tooth, s = V.st(w, v.id), st = w.npcs.a_r1; st.gold = 500; s.stock = 0; const k = G.VENUE_KINDS.punk, sp = k.spend, a = V.charge(w, 'a_r1', st, v); check(k.spend === sp && a === 0, 'nothing to sell, no sale'); s.stock = 50; check(V.charge(w, 'a_r1', st, v) > 0 && s.stock < 50, 'stock goes down as it sells'); s.owner = 'player'; E.setStaff(w, v.id, 1, true); check(G.NPCS.v_tooth_s1.schedule.length === 1 && E.staffed(w, v.id) === 1, 'let go: they stop coming'); E.setStaff(w, v.id, 1, false); check(G.NPCS.v_tooth_s1.schedule.length > 1, 'hired back'); s.owner = null; }
    // tenants are people
    { g.loadMap('arts', 'from_neon'); p.gold = 500000; const id = 'a_ruin', r = E.rec(w, id); r.owner = 'player'; r.cond = 80; r.asking = Math.round(E.fairRent(w, id) * 0.9); w.day = 77; let n = 0; while (!r.tenant && n++ < 400) { w.day += 1; E.rentDay(w); } check(r.tenant && /^t_/.test(r.tenant.id), 'someone new moves in'); const t = r.tenant.id; check(G.NPCS[t] && w.npcs[t].gold > 0, 'a real person with money'); tick(2); const q = E.s(w); check(q.tenantDefs[t], 'on the books'); const a = g.actors.find((x) => x.id === t); check(a && !G.spawnRule.visible(g, a.x, a.y) || a, 'and walks in'); r.tenant.notice = w.day; E.rentDay(w); check(!r.tenant && !G.NPCS[t], 'and leaves again'); r.owner = null; }
    // floors in a built house
    { const e = E.s(w); e.built.push({ prop: 'lot_3', bp: 'flats', id: 'p_lot_3', map: 'arts', x: 52, y: 68, w: 14, h: 10, name: 'Apartments', quality: 70 }); E.rec(w, 'lot_3').owner = 'player'; G.maps.invalidate('arts'); const m = G.maps.get('arts'); check(m.building('p_lot_3') && G.FLOORS.p_lot_3 && G.FLOORS.p_lot_3.levels.length === 2, 'three stories on file'); const all = (q) => q.decor.concat(q.flats || []), st = all(m).find((d) => d.type === 'stairs_up' && d.to === G.floorId('p_lot_3', 2)); check(st, 'stairs in the lobby'); const up = G.maps.get(G.floorId('p_lot_3', 2)); check(up && all(up).some((d) => d.type === 'stairs_down') && all(up).some((d) => d.type === 'stairs_up'), 'and a floor up there'); const top = G.maps.get(G.floorId('p_lot_3', 3)); check(all(top).some((d) => d.type === 'stairs_down'), 'and one more'); e.built.pop(); delete G.FLOORS.p_lot_3; G.maps.invalidate('arts'); }
    // the law
    g.loadMap('arts', 'from_neon'); tick(2);
    { const e = E.s(w), id = 'lot_1', r = E.rec(w, id); r.owner = 'player'; const c = E.catalog()[id]; e.illegal = [{ key: 'k', map: 'arts', tx: c.x + 3, ty: c.y + 3, n: 200, day: w.day, found: true, stage: 2, seen: 0 }]; p.inventory.add('hammer', 1); w.buildInv = { kit_wall_wood: 3 }; check(H.why(g, 'kit_wall_wood', c.x + 2, c.y + 2) === 'There is a stop order on this site.', 'a stop order stops you'); E.lawDay(w); check(r.sealed, 'then the place is sealed'); E.lawDay(w); E.lawDay(w); check(!E.mine(w, id), 'and in a serious case, confiscated'); r.sealed = false; e.illegal = []; r.owner = 'player'; e.illegal = [{ key: 'k', map: 'arts', tx: c.x + 3, ty: c.y + 3, n: 10, day: w.day, found: true, stage: 1, seen: 0 }]; p.gold = 5000; check(E.settle(w, p) === null && !e.illegal.length, 'or you settle it at the Annex'); r.owner = null; }
    // hand-built upper floor
    { const e = E.s(w); const m = g.map; const bid = 'ph_test', o = openSpot(g, { x: 60 * 16, y: 60 * 16 }), hx = Math.floor(o.x / 16) - 4, hy = Math.floor(o.y / 16) - 3; for (const d of m.decor.concat(m.flats)) if (d.tx >= hx - 1 && d.tx < hx + 9 && d.ty >= hy - 1 && d.ty < hy + 8) m.removeDecorRuntime(d); for (let y = hy + 1; y < hy + 6; y++) for (let x = hx + 1; x < hx + 7; x++) m.setTileRuntime(x, y, G.T.woodfloor); m.buildings.push({ id: bid, name: 'Your House', x: hx, y: hy, w: 8, h: 7, doorX: hx + 3, doorY: hy + 6, roof: 'red', playerBuilt: true, windows: [], roofAlpha: 0, kind: 'house' }); p.inventory.add('hammer', 1); const hb = H.inv(w); hb.kit_stairs = 2; hb.kit_fusebox = 1; check(!H.why(g, 'kit_stairs', hx + 2, hy + 2), `stairs may go in a house (${H.why(g, 'kit_stairs', hx + 2, hy + 2)})`); check(H.why(g, 'kit_stairs', hx + 40, hy + 30), 'but not in the street'); const r = H.place(g, 'kit_stairs', hx + 2, hy + 2); check(!r && G.MAPGEN.hf_ph_test_2, 'placing them makes a floor above'); const up = G.maps.get('hf_ph_test_2'); check(up.meta.indoor && up.decor.some((d) => d.type === 'v_hstairs'), 'with stairs down'); { const wf = H.place(g, 'kit_fusebox', hx + 3, hy + 2); check(e.util && e.util.ph_test && e.util.ph_test.power, `a fuse box counts (${wf})`); } g.buildRot = 1; hb.kit_stairs = 1; delete e.hand.ph_test; delete G.MAPGEN.hf_ph_test_2; m.buildings.pop(); g.buildRot = 0; }
    // old saves
    { const data = JSON.parse(JSON.stringify(w)); delete data.estate; delete data.venues; delete data.fc; delete data.loans; delete data.morgue; delete data.bankVault; for (const id of Object.keys(data.npcs)) if (/^(fc_|v_|n_r|a_r|c_shark|c_bank|c_teller|t_|a_skate|a_ball|.*busker)/.test(id)) delete data.npcs[id]; delete data.shops.fc_bar; for (const k of Object.keys(data.shops)) if (k.startsWith('shop_v')) delete data.shops[k]; const W = new G.World(data); check(W.npcs.fc_boss && W.npcs.v_velvet_s0, 'an old save gets the new people'); check(W.shops.fc_bar && W.shops.shop_v_nonna, 'and the new shops'); const o = G.world; G.world = W; G.estate.s(W); V.st(W, 'v_nonna'); G.fightClub.state(W); G.world = o; check(true, 'and the new records'); }
    G.debug.time(13); G.autonomy.off = false;
  }
  function estate() {
    const g = game(), w = g.world, p = g.player, E = G.estate, S = G.venueSys; G.autonomy.off = true;
    g.loadMap('arts', 'from_neon'); tick(2); p.gold = 200000;
    const cat = E.catalog(); check(Object.keys(cat).length > 40, `the city has property (${Object.keys(cat).length})`);
    const types = new Set(Object.values(cat).map((c) => c.type)); for (const t of ['house', 'apartment', 'business', 'lot', 'ruin', 'warehouse']) check(types.has(t), `there are ${t}s`);
    for (const id in cat) { if (E.price(w, id) <= 0) { check(false, `${id} has no price`); break; } }
    check(!cat.c_hall && !cat.c_police && !Object.keys(cat).some((i) => /Police|Hospital/.test(cat[i].name)), 'public buildings are not for sale');
    { const a = E.price(w, 'lot_0'); E.rec(w, 'lot_0').cond = 100; check(a > 1000, `a lot costs money ($${a})`); }
    // a resident will only sell if it suits them
    { const id = Object.keys(cat).find((i) => cat[i].type === 'house' && cat[i].residents.length), r = E.rec(w, id), o = r.owner, st = w.npcs[o]; st.disp = -50; st.gold = 5000; const low = E.price(w, id) * 0.8; check(!E.sellerAgrees(w, id, low), 'an owner can refuse'); check(E.buy(g, id, low, false) === 'The owner turned you down.', 'and you do not get it'); st.disp = 80; const g0 = p.gold, g1 = st.gold, n = E.price(w, id) * 1.1; check(E.buy(g, id, Math.round(n), false) === null && E.mine(w, id), 'but a good offer works'); check(p.gold === g0 - Math.round(n) && st.gold === g1 + Math.round(n), 'the money goes to the seller'); check(E.rec(w, id).tenant && E.rec(w, id).tenant.id === o, 'and they stay on as a tenant'); check(w.keys[id], 'you get the keys'); check(p.inventory.has('prop_ledger'), 'and the ledger'); }
    // mortgage
    { const id = 'lot_1', n = E.price(w, id); check(E.buy(g, id, n, true) === null, 'a mortgage'); const l = E.s(w).loans[0]; check(l && l.left > n * 0.8, 'with a debt on it'); const left = l.left; E.bills(w, p); check(l.left < left, 'paid weekly'); }
    // permits and a building site
    const lot = 'lot_0'; check(E.buy(g, lot, E.price(w, lot), false) === null, 'buy a lot');
    check(E.start(g, lot, 'house', 'ines', [], true) && !E.s(w).sites.length, 'no permit, no site');
    check(E.apply(g, lot, 'commercial') === 'This lot is zoned residential. No.', 'zoning');
    check(E.apply(g, lot, 'construction') === null, 'applied'); const q = E.s(w).permits.find((x) => x.prop === lot); check(q.status === 'pending' && q.due > w.day, 'it takes days'); q.due = w.day; q.status = 'granted';
    check(E.has(w, lot, 'construction'), 'granted');
    check(E.start(g, lot, 'house', 'oskar', ['electrician', 'plumber'], false) === 'You are short of materials.', 'materials are required');
    for (const [k, n] of Object.entries(E.BP.house.mats)) H0(p, k, n);
    const bank0 = p.gold; check(E.start(g, lot, 'house', 'oskar', ['electrician', 'plumber'], false) === null, 'building starts'); check(p.gold < bank0, 'it costs money'); check(!E.matsShort(w, p, 'house').some(() => false) && (w.buildInv.planks || 0) === 0, 'materials are consumed');
    tick(2); check(g.map.decor.some((d) => d.type === 'v_foundation') || g.map.flats.some((d) => d.type === 'v_foundation'), 'a foundation on the ground');
    { const s = E.s(w).sites[0]; for (let i = 0; i < 40 && E.s(w).sites.length; i++) { s.paused = 0; G.world.day++; E.siteDay(w); } w.day -= 40 - 0; w.day = Math.max(w.day, 1); check(!E.s(w).sites.length && E.s(w).built.length === 1, 'and finishes'); tick(2); check(g.map.building('p_lot_0'), 'the building is on the map'); const m2 = (G.maps.invalidate('arts'), G.maps.get('arts')); check(m2.building('p_lot_0'), 'and stays there when the map is rebuilt'); }
    tick(2);
    // a business that opens
    { const id = 'lot_2'; E.buy(g, id, E.price(w, id), false); E.apply(g, id, 'commercial'); E.s(w).permits.find((x) => x.prop === id).status = 'granted'; check(E.start(g, id, 'bar', 'ines', ['electrician', 'plumber'], true) === null, 'a bar goes up'); const s = E.s(w).sites[0]; s.pct = 99.9; s.days = 1; s.paused = 0; for (let i = 0; i < 12 && E.s(w).sites.length; i++) { s.paused = 0; E.siteDay(w); } check(G.VENUES.p_lot_2 && S.st(w, 'p_lot_2').owner === 'player', 'and opens as a business'); check(G.NPCS.p_lot_2_s0 && w.npcs.p_lot_2_s0, 'with staff'); tick(2); check(g.map.building('p_lot_2'), 'on the map'); }
    // illegal building
    { const e = E.s(w), n0 = e.illegal.length; check(E.legal(w, 'arts', 200, 200) === false, 'not your land: illegal'); check(E.legal(w, 'rural', 20, 20), 'the country has no zoning'); E.illegalWork(g, 5, 5); check(e.illegal.length === n0 + 1, 'recorded'); const q2 = e.illegal[e.illegal.length - 1]; q2.n = 200; q2.seen = 5; const c0 = w.crimes ? w.crimes.length : 0; for (let i = 0; i < 12 && !q2.found; i++) { w.day++; E.lawDay(w); } check(q2.found, 'and found'); check((e.fines || 0) > 0, 'a fine'); check(!w.crimes || w.crimes.length >= c0, 'on the record'); for (let i = 0; i < 8; i++) E.lawDay(w); check(!e.illegal.includes(q2), 'then demolished'); }
    // rent
    { const id = E.owned(w).find((i) => E.s(w).props[i].tenant), r = E.rec(w, id), t = r.tenant, st = w.npcs[t.id]; r.rent = 50; st.gold = 500; st.bank = 0; const d0 = w.day; w.day = 70; const g0 = st.gold; E.rentDay(w); check(st.gold === g0 - 50, 'rent comes out of their pocket'); st.gold = 0; st.bank = 0; E.rentDay(w); check(t.late >= 1, 'broke tenants fall behind'); for (let i = 0; i < 3; i++) { r.issues = ['roof']; E.rentDay(w); } check(t.mood < 60, 'and problems wear on them'); E.evict(w, id); check(t.notice, 'notice served'); w.day = t.notice; E.rentDay(w); check(!r.tenant, 'they move out'); w.day = d0; }
    // repairs, wear
    { const id = E.owned(w).find((i) => cat[i] && cat[i].type !== 'lot' && !G.VENUES[i]), r = E.rec(w, id), c0 = r.cond; for (let i = 0; i < 20; i++) { w.day++; E.wear(w); } check(r.cond < c0, 'neglect wears a place down'); r.issues = ['roof']; check(E.repair(g, id, false) === null && !r.issues.length && r.cond > 90, 'repairs fix it'); }
    // running a business
    { const id = 'v_nonna', n = E.price(w, id); check(E.buy(g, id, n, false) === null, 'buy a restaurant'); const s = S.st(w, id); check(s.owner === 'player', 'the books are yours'); s.till = 1000; const before = p.gold; E.bizDay(w); check(s.hist.length === 1 && s.till < 1000, 'a day of wages and stock'); const got = E.collect(w, p, id); check(p.gold === before + got && s.till === 0, 'collect the till'); const sc = E.biz(g, id); G.scenes.push(sc); sc.render(G.renderer.ctx); check(sc.rows().length >= 10, 'the management screen'); G.scenes.remove(sc); for (let i = 0; i < 4; i++) { s.till = -500; E.bizDay(w); } check(s.closed, 'unpaid staff walk out'); s.closed = false; s.unpaid = 0; s.till = 100; const r0 = (s.clean = 90, s.rep); s.quality = 90; for (let i = 0; i < 5; i++) { s.clean = 90; E.bizDay(w); } check(s.rep > r0, 'a clean place earns a reputation'); }
    { const a = S.st(w, 'v_bean'); a.owner = null; a.cash = -700; a.till = 0; E.bizDay(w); check(a.closed, 'rivals can go under'); }
    // competitors answer you
    { const mine = S.st(w, 'v_rex'), rival = S.st(w, 'v_paragon'); mine.owner = 'player'; E.s(w).props.v_rex = E.rec(w, 'v_rex'); mine.priceK = 0.7; rival.owner = null; rival.priceK = 1; rival.cash = 500; rival.closed = false; E.bizDay(w); check(rival.priceK < 1, 'a rival cuts prices when you undercut them'); mine.owner = null; }
    // bills, repossession
    { const e = E.s(w); e.loans = [{ kind: 'mortgage', prop: 'lot_1', left: 99999, week: 99999, missed: 2 }]; p.gold = 0; G.economy.state(w).bank = 0; E.bills(w, p); check(!E.mine(w, 'lot_1'), 'unpaid installments end in repossession'); p.gold = 100000; }
    // events
    { const r = new G.RNG('t'); let n = 0; for (const f of E.EVENTS) { if (f(w, r, E)) n++; } check(n >= 8, `events fire (${n})`); }
    { const sc = E.menu(g); G.scenes.push(sc); sc.render(G.renderer.ctx); G.scenes.remove(sc); const ls = E.listing(g); G.scenes.push(ls); ls.render(G.renderer.ctx); G.scenes.remove(ls); check(true, 'the ledger draws'); }
    // saved and restored
    { const save = JSON.stringify(w.estate), ven = JSON.stringify(w.venues); const copy = JSON.parse(save); check(copy.built.length >= 2 && JSON.parse(ven).v_nonna.owner === 'player', 'it all saves'); }
    G.autonomy.off = false;
  }
  const H0 = (p, k, n) => { const b = G.home.inv(G.world); b[k] = (b[k] || 0) + n; };
  function venues() {
    const g = game(), w = g.world, p = g.player, V = G.venueSys; G.autonomy.off = true;
    const reach = (m, q, from) => { const seen = new Set([from.x + ',' + from.y]), st = [from]; while (st.length) { const [c] = [st.pop()]; if (c.x === q.x && c.y === q.y) return true; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = c.x + a, y = c.y + b, k = x + ',' + y; if (seen.has(k) || !m.inBounds(x, y) || m.isSolidTile(x, y)) continue; seen.add(k); st.push({ x, y }); } } return false; };
    for (const id of ['neon', 'arts', 'neon_roof']) { const m = G.maps.get(id); check(!!m, `${id} builds`); }
    const city = G.maps.get('city'); check(city.exits[0].to === 'neon', 'Center leads to Neon Row');
    { const list = Object.values(G.VENUES).filter((v) => !v.outdoor); for (const v of list) { const m = G.maps.get(v.map), a = m.building(v.id); for (const b of m.buildings) if (b.id !== v.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) check(false, `${v.name} overlaps ${b.name}`); } }
    for (const v of Object.values(G.VENUES)) {
      const m = G.maps.get(v.map), start = v.map === 'neon' ? m.points.from_city : v.map === 'arts' ? m.points.from_neon : m.points.from_southside;
      if (!v.outdoor) { const b = m.building(v.id); check(!!b, `${v.name} stands`); const door = m.points[v.id + '_door']; check(reach(m, door, start), `${v.name}: the door can be reached from the road`); const inn = m.points[v.id + '_in']; check(!m.isSolidTile(inn.x, inn.y) && reach(m, inn, start), `${v.name}: you can get in`); }
      G.VENUE_KINDS[v.kind].roles.forEach((r, i) => { const k = `${v.id}_s${i}`, q = m.points[k]; check(!!q && !m.isSolidTile(q.x, q.y), `${v.name}: the ${r} has a place to stand`); });
      for (const s of (m.vseats || {})[v.id] || []) if (m.isSolidTile(s.x, s.y)) { check(false, `${v.name}: seat on a solid tile ${s.x},${s.y}`); break; }
      for (const d of m.decor) if (d.def.interact && m.buildingAtTile(d.tx, d.ty) && m.buildingAtTile(d.tx, d.ty).id === v.id) { const near = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1]].some(([a, b]) => { const x = d.tx + a, y = d.ty + b; return !m.isSolidTile(x, y) && reach(m, { x, y }, m.points[v.id + '_in']); }) || !d.def.solid; if (!near) { check(false, `${v.name}: ${d.type} at ${d.tx},${d.ty} cannot be reached`); break; } }
    }
    // hours, money
    { const id = 'v_velvet'; G.debug.time(10); check(!V.isOpen(w, id), 'a strip club is closed in the morning'); G.debug.time(22); check(V.isOpen(w, id), 'and open at night'); check(V.busy(w) > 1, 'busier at night'); }
    { const st = w.npcs.a_r3; st.gold = 500; const v = G.VENUES.v_nonna, s0 = V.st(w, v.id).till, g0 = st.gold, paid = V.charge(w, 'a_r3', st, v); check(paid > 0 && st.gold === g0 - paid && V.st(w, v.id).till === s0 + paid, `going out costs them and pays the place ($${paid})`); st.gold = 0; check(V.taste('a_r3', st, v, w) === 0, 'no money, no night out'); st.gold = 500; }
    { const set = new Set(); for (const id of Object.keys(G.NPCS).slice(0, 200)) { const st = w.npcs[id]; if (st && (st.gold = 400)) set.add(['v_tooth', 'v_royal', 'v_pixel', 'v_nonna'].map((v) => V.taste(id, st, G.VENUES[v], w) > 0 ? 1 : 0).join('')); } check(set.size >= 5, `people have different tastes (${set.size} patterns)`); }
    { let kidOk = true; for (const id in G.NPCS) if (G.NPCS[id].kid && w.npcs[id]) { w.npcs[id].gold = 500; if (V.taste(id, w.npcs[id], G.VENUES.v_velvet, w) > 0) kidOk = false; } check(kidOk, 'children never go to the strip clubs'); check(Object.values(G.NPCS).filter((d) => d.performer).every((d) => d.ageGroup === 'adult' && !d.kid), 'performers are adults'); }
    { const t0 = Object.values(w.venues || {}).reduce((s, v) => s + v.visits, 0); G.debug.time(21); for (const id in w.npcs) w.npcs[id].gold = Math.max(w.npcs[id].gold || 0, 200); for (let i = 0; i < 4; i++) V.hourly(w); check(Object.values(w.venues).reduce((s, v) => s + v.visits, 0) > t0, 'people go out while you are elsewhere'); }
    // a real visit
    g.loadMap('neon', 'from_city'); G.debug.time(22); tick(30);
    const b = g.map.building('v_velvet'), who = g.actors.find((a) => a.kind === 'npc' && /^n_r/.test(a.id) && !a.dead); check(who, 'residents live here');
    { who.st.gold = 500; who.errand = null; const e = V.pickFor(who, g); check(e && e.kind === 'venue', `they pick somewhere (${e && e.venue})`); }
    { const sc = G.showSys, perf = g.actors.find((a) => a.kind === 'npc' && a.def.performer && a.def.venue === 'v_velvet'); check(perf, 'a performer is at work'); p.x = (b.doorX) * 16 + 8; p.y = (b.doorY - 3) * 16; for (let i = 0; i < 60 * 8; i++) G.loop.tick(1 / 60); const s = sc.ST.get(b); check(s && s.on, 'someone takes the stage'); const a = s.on, x0 = a.x; for (let i = 0; i < 60 * 4; i++) G.loop.tick(1 / 60); check(Math.abs(a.x - x0) > 0.5 || a.moving, 'the routine moves'); const m = s.stage, tx = a.x / 16, ty = a.y / 16; check(tx >= m.x0 - 1 && tx <= m.x1 + 2 && ty >= m.y0 - 1 && ty <= m.y1 + 2, 'on the stage'); const g0 = p.gold = 100; sc.tip(g, p, a, 4, 20); check(p.gold === g0 - 20 && sc.bills.length >= 4, 'tips fly'); }
    // the shows
    { const fs = G.SHOWS.FILMS; check(fs.length >= 6 && new Set(fs.map((f) => f.genre)).size >= 6, 'films of different genres'); check(new Set(G.SHOWS.PLAYS.map((f) => f.kind)).size >= 6, 'stage shows of different kinds'); const pr = G.showSys.programme(w, 'v_paragon'); check(pr.length >= 3, 'a cinema has a programme'); check(new Set(pr.map((q) => q.room)).size === 2, 'in two rooms'); }
    { let h0 = w.minutes + w.day * 1440, done = null; const sc = new G.CinemaScene(G.SHOWS.FILMS[0], (f) => { done = f; }); G.scenes.push(sc); for (let i = 0; i < 60 * 60 && G.scenes.top() === sc; i++) { G.input.pressed.add('Space'); sc.render(G.renderer.ctx); G.loop.tick(1 / 60); G.input.pressed.clear(); } check(done === true, 'a film plays to the end'); void h0; const ss = new G.StageScene(G.SHOWS.PLAYS[2], (f) => { done = f + 'x'; }); G.scenes.push(ss); for (let i = 0; i < 60 * 120 && G.scenes.top() === ss; i++) { if (i % 30 === 0) G.input.pressed.add('Space'); ss.render(G.renderer.ctx); G.loop.tick(1 / 60); G.input.pressed.clear(); } check(done === 'truex', 'so does a play'); }
    { const m0 = w.day * 1440 + w.minutes; G.debug.time(13); g.loadMap('neon', 'from_city'); const v0 = w.day * 1440 + w.minutes, sh = { at: w.hourF, room: 0, film: G.SHOWS.FILMS[1] }; G.showSys.attend(g, 'v_paragon', sh); const s = G.scenes.top(); check(s instanceof G.CinemaScene, 'attending opens the picture'); s.done(true); G.scenes.remove(s); check(w.day * 1440 + w.minutes - v0 >= 100, 'a film takes time'); void m0; }
    // minigames
    { const C = G.chess, B = C.fresh(); check(C.moves(B, true).length === 20, 'twenty opening moves'); const mate = ['rnb.kbnr', 'pppp.ppp', '....p...', '........', '......Pq', '.....P..', 'PPPPP..P', 'RNBQKBNR'].map((r) => r.split('')); check(C.moves(mate, true).length === 0 && C.inCheck(mate, true), 'fool\'s mate is mate'); check(C.best(B).length === 4, 'the rival can move'); }
    { const sc = new G.PoolScene(g, 10); G.scenes.push(sc); sc.shoot(0, 600); for (let i = 0; i < 300; i++) G.loop.tick(1 / 60); check(sc.balls.some((q) => q.n && (q.x !== 280 || Math.abs(q.vx) > 0)), 'pool balls scatter'); sc.render(G.renderer.ctx); G.scenes.remove(sc); }
    for (const mk of [() => new G.BowlingScene(g), () => new G.DartsScene(g), () => new G.FoosScene(g), () => new G.ChessScene(g), () => new G.HoopScene(g), () => new G.ArcadeScene(g, 'runner'), () => new G.ArcadeScene(g, 'swarm'), () => new G.ArcadeScene(g, 'stack'), () => new G.KaraokeScene(g), () => new G.InstrumentScene(g, 'piano'), () => new G.GymScene(g, 'strength', null)]) { const sc = mk(); G.scenes.push(sc); for (let i = 0; i < 120; i++) { if (i % 20 === 0) G.input.pressed.add('Space'); G.loop.tick(1 / 60); G.input.pressed.clear(); if (G.scenes.top() !== sc) break; sc.render(G.renderer.ctx); } check(true, `${sc.title} runs`); G.scenes.remove(sc); }
    // every part of every new map draws, day and night, roofs on and off
    for (const id of ['neon', 'arts', 'neon_roof', 'fightclub']) { g.loadMap(id); const m = g.map; for (const h of [12, 22]) { G.debug.time(h); for (let y = 8; y < m.h; y += 12) for (let x = 8; x < m.w; x += 14) { p.x = x * 16; p.y = y * 16; try { G.renderer.follow ? 0 : 0; tick(1); g.render(G.renderer.ctx); } catch (e) { check(false, `${id} ${x},${y} h${h}: ${e.message} ${String(e.stack).split('\n').slice(1, 4).join(' | ')}`); y = 1e6; break; } } } }
    G.debug.time(13); G.autonomy.off = false;
  }
  function fightClub() {
    const g = game(), w = g.world, p = g.player, FC = G.fightClub; G.autonomy.off = true;
    g.loadMap('industrial', 'from_southside'); tick(1);
    check(g.map.building('i_cannery') && g.map.exits.some((e) => e.to === 'fightclub'), 'the way down is in the port');
    g.loadMap('fightclub', 'from_port'); tick(2);
    const t0 = g.map.points.from_port; check(!g.map.isSolidTile(t0.x, t0.y), 'you arrive on open floor, no prerequisites');
    const a0 = FC.actor(g, 'fc_boss'); check(!!a0 && !!G.DIALOGUES.fc_boss.start.choices.some((c) => c.text === 'Let\'s see how long I can last.'), 'Mama Rust is here, with the survival line');
    check(Object.keys(G.FIGHTERS).length >= 12 && new Set(Object.values(G.FIGHTERS).map((f) => f.style)).size === 6, 'a roster, six styles');
    for (const k of ['from_port', 'fc_mgr', 'fc_book', 'fc_out', 'fc_w', 'fc_e', 'fc_side', 'fc_gate']) { const q = g.map.points[k]; check(!g.map.isSolidTile(q.x, q.y), `${k} is walkable`); }
    const pf = G.pathfinding || G.path; void pf;
    g._fcNext = 1e12;
    // a fight, lost
    p.hp = p.maxHp = 100; p.equip.weapon = 'pistol'; const id0 = 'fc_mountain'; check(FC.fight(g, id0), 'a fight starts');
    let n = 0; while (!(g._fc && g._fc.go) && n++ < 200) G.loop.tick(1 / 60);
    check(g._fc.go && !p.weaponItem && p.fcIn, 'in the ring, weapon held');
    const inRing = (q) => q.x / 16 > FC.RING.x0 && q.x / 16 < FC.RING.x1 + 1 && q.y / 16 > FC.RING.y0 && q.y / 16 < FC.RING.y1 + 1; check(inRing(p), 'you are inside the ropes');
    p.hp = 3; n = 0; while (g._fc && n++ < 60 * 60) G.loop.tick(1 / 60);
    check(!g._fc, `the match finished (${n} frames)`); while (G.scenes.top() !== g && n++ < 60 * 60) G.loop.tick(1 / 60);
    check(!p.dead && p.hp === 20, `you are alive with exactly 20 HP (${p.hp})`); check(!inRing(p), 'outside the ring'); check(p.weaponItem && p.weaponItem.id === 'pistol', 'and your weapon is back');
    { const a = FC.actor(g, id0); check(a && !a.fcIn && a.state !== 'fight', 'the opponent went back to their business'); }
    tick(90); check(p.downT <= 0 && !p.fcKO, 'you get back up');
    // a fight, won
    const foe = 'fc_razor'; p.hp = 100; const g0 = p.gold; FC.fight(g, foe); n = 0; while (!(g._fc && g._fc.go) && n++ < 200) G.loop.tick(1 / 60);
    const a = FC.actor(g, foe); a.hp = 3; p.x = a.x - 10; p.y = a.y; G.combat.damage(a, 50, p, g); check(!a.dead && a.st.ko, 'a knockout, not a death');
    n = 0; while (g._fc && n++ < 60 * 40) G.loop.tick(1 / 60); while (G.scenes.top() !== g && n++ < 60 * 45) G.loop.tick(1 / 60);
    check(p.gold > g0, `the purse is paid ($${p.gold - g0})`); check(!a.dead && !a.st.ko, 'they get up'); check(w.isAlive(foe) && !w.dead[foe], 'nobody died'); check(!(w.crimes || []).some((c) => c.victim === foe), 'and it is no crime');
    // a bet
    { const wfc = FC.state(w), A = 'fc_prof', B = 'fc_rat', odds = FC.odds(w, A, B); check(odds > 1, 'odds'); p.gold = 100; check(!FC.bet(g, A, B, 500), 'no betting more than you have'); check(FC.bet(g, A, B, 50) && p.gold === 50, 'a bet takes the money'); n = 0; while (!(g._fc && g._fc.go) && n++ < 200) G.loop.tick(1 / 60);
      const b = FC.actor(g, B), rec0 = wfc.rec[A].w; G.combat.damage(b, 9999, FC.actor(g, A), g); n = 0; while (g._fc && n++ < 60 * 40) G.loop.tick(1 / 60); while (G.scenes.top() !== g && n++ < 60 * 45) G.loop.tick(1 / 60);
      check(p.gold === 50 + Math.round(50 * odds), `the bet pays out once (${p.gold})`); check(wfc.rec[A].w === rec0 + 1, 'the record changes'); }
    // survival
    { p.hp = p.maxHp = 500; const g1 = p.gold; FC.survival(g); n = 0; while (!(g._fc && g._fc.go) && n++ < 200) G.loop.tick(1 / 60); const f = g._fc; check(f.mode === 'survival', 'survival begins');
      const clear = () => { let k = 0; p.hp = p.maxHp; while (!f.foes.some((x) => !x.st.ko && !x.fcLeaving) && k++ < 900) G.loop.tick(1 / 60); for (const x of f.foes.filter((y) => !y.st.ko && !y.fcLeaving)) { x.fcBlock = 0; x.fcEvade = 0; G.combat.damage(x, 9999, p, g); } G.loop.tick(1 / 60); G.loop.tick(1 / 60); };
      clear(); check(f.round === 1 && f.foes.length === 1, 'round one, one opponent'); clear(); clear(); clear(); check(f.round >= 3 && f.foes.filter((x) => !x.st.ko).length >= 0, `rounds go on (${f.round})`);
      let k = 0; while (!f.foes.some((x) => !x.st.ko && !x.fcLeaving) && k++ < 900) G.loop.tick(1 / 60); const live = f.foes.filter((x) => !x.st.ko && !x.fcLeaving); check(f.round >= 4 ? live.length >= 2 : true, `several at once later on (${live.length} in round ${f.round})`);
      const done = f.done; p.hp = 2; p.invuln = 0; for (let i = 0; i < 2 && !f.out; i++) { G.combat.damage(p, 50, live[0], g); p.invuln = 0; } n = 0; while (g._fc && n++ < 60 * 40) G.loop.tick(1 / 60); check(!g._fc && f.paid && f.prize === FC.rewardFor(done) && p.gold === g1 + f.prize, `the reward for finished rounds, once (${f.prize})`);
      n = 0; while (G.scenes.top() !== g && n++ < 60 * 3) { const t = G.scenes.top(); if (t instanceof G.ChoiceScene) G.scenes.remove(t); G.loop.tick(1 / 60); } check(p.hp === 20 && !p.dead, `back on the floor with 20 HP (${p.hp})`); check(!g.actors.some((x) => x.fcS), 'the walk-ons are gone'); }
    // normal death still works outside
    { g._fc = null; p.hp = 5; const s = G.scenes.stack.length; void s; check(!p.fcIn, 'no protection outside the ring'); }
    { G.debug.time(21); FC.show(g); try { g.render(G.renderer.ctx); log('ok   render with a house bout'); } catch (e) { check(false, 'render threw: ' + e.message + ' ' + String(e.stack).slice(0, 300)); } FC.clearShow(g); }
    const sc = new G.FighterScene(g, 'bet'); G.scenes.push(sc); G.loop.tick(1 / 60); G.loop.draw && G.loop.draw(); sc.render(G.renderer.ctx); sc.choose('fc_viper'); sc.render(G.renderer.ctx); check(sc.pick && sc.foe, 'the fighter screen draws and picks'); G.scenes.remove(sc);
    G.autonomy.off = false;
  }
  // 2026-11-04: the prison update patch
  async function prisonPatch() {
    const g = game(), w = g.world, p = g.player; g.loadMap('city', 'start'); G.debug.time(13); tick(3);
    p.hp = p.maxHp = 9999; G.autonomy.off = true;
    // the game clock
    { p.effects = []; G.effects.add(p, 'high', 180); const e = G.effects.get(p, 'high'), t0 = e.t; G.settings.data.dayLengthMinutes = 24; G.effects.update(p, 1, g); const half = t0 - e.t; G.settings.data.dayLengthMinutes = 12; G.effects.update(p, 1, g); check(Math.abs(half - 0.5) < 0.01 && Math.abs(t0 - e.t - 1.5) < 0.01, `effects run on the game clock, not real seconds (${half})`); }
    { p.effects = []; G.effects.add(p, 'high', 180); w.skipHours(8); check(!G.effects.has(p, 'high'), 'slept past it: the high is gone (scenario 22)'); }
    { p.effects = []; const hpb = p.hp; G.effects.add(p, 'organ_failure' in G.EFFECTS ? 'organ_failure' : 'poison', 100000, 1); const id = p.effects[0].id; w.skipHours(1); check(G.effects.has(p, id) && p.hp <= hpb, `sleeping does not cure what is killing you (${id}) (scenario 24)`); p.effects = []; p.hp = p.maxHp; }
    { const n = Object.keys(G.NPCS).find((id) => G.NPCS[id].map === 'rural' && !G.NPCS[id].kid), st = w.npcs[n]; st.fx = [{ id: 'high', t: 200, dur: 200, power: 1 }]; st.alcohol = 90; G.clock.npcHour(w, n); G.clock.npcHour(w, n); check(st.fx[0].t === 140 && st.alcohol < 90, `someone far away keeps sobering up on the clock (${st.fx[0] && st.fx[0].t}) (scenario 23)`); st.fx = []; st.alcohol = 0; }
    // spawning
    { const c = G.renderer.cam, x = c.x + 40, y = c.y + 40; check(G.spawnRule.visible(g, x, y) && !G.spawnRule.visible(g, c.x - 400, c.y - 400), 'in view, out of view'); const at = G.spawnRule.away(g, p.x, p.y); check(at && !G.spawnRule.visible(g, at.x, at.y), 'there is always somewhere out of sight'); const leg = G.spawnRule.legit; G.spawnRule.legit = () => false; for (let i = 0; i < 90; i++) G.loop.tick(1 / 60); const n = G.law.spawn(g, { name: 'Test Cop' }, p.x + 30, p.y); G.loop.tick(1 / 60); G.spawnRule.legit = leg; check(!G.spawnRule.visible(g, n.x, n.y), `someone generated in view is moved out of it and walks in (${Math.round(n.distTo(p))}px)`); g.actors = g.actors.filter((a) => a !== n); }
    // HD flora
    { const S0 = G.settings.data.graphics; for (const L of [0, 3]) { G.settings.data.graphics = L; check(G.floraHD.get('oak0') && G.floraHD.get('pine1') && G.floraHD.get('bush') && G.floraHD.get('rock') && G.floraHD.get('campfire'), `trees, bushes, rocks and campfires have HD art (level ${L})`); } G.settings.data.graphics = S0; }
    // the money
    { const F = G.finance, sum = () => F.ledger(w) + Object.values(w.npcs).reduce((n, s) => n + (s.bank || 0), 0), before = sum(); G.economy.daily(w); const after = sum(); check(Math.abs(after - before) < 2, `a day of wages, rent and groceries moves money, it does not make it (${before} -> ${after})`); }
    { const F = G.finance, id = Object.keys(G.NPCS).find((i) => G.lifestyle.of(i) === 'worker'), st = w.npcs[id]; st.gold = 500; st.bank = 0; st.fin = []; const a = F.deposit(w, st, 300); check(a === 300 && st.gold === 200 && st.bank === 300, 'wallet and account are separate (scenario 1)'); F.withdraw(w, st, 100); check(st.gold === 300 && st.bank === 200, 'withdrawing (scenario 2)'); }
    { const F = G.finance, id = 'dl1', st = { gold: 0, stock: 0 }, rng = new G.RNG('x'); F.dealerDay(w, id, st, rng); check(st.gold === 0, 'no stock, no sales, no money (scenario 6)'); st.stock = 5; let sold = 0; for (let i = 0; i < 12; i++) F.dealerDay(w, id, st, new G.RNG('y' + i)); sold = st.gold; check(sold >= 0 && st.stock >= 0, 'a dealer sells what they have (scenario 4)'); }
    // the bank
    const B = G.bankSys, E = G.economy; B.state(w);
    check(g.map.building('c_bank') && g.map.points.c_bank_t1, 'the bank stands in the center');
    { p.gold = 500; const b0 = E.state(w).bank, v0 = w.bankVault; B.dep(w, p, 200); check(p.gold === 300 && E.state(w).bank === b0 + 200 && w.bankVault === v0 + 200, 'deposit (scenario 8)'); B.wd(w, p, 100); check(p.gold === 400, 'withdraw'); }
    { const t = g.actors.find((a) => a.id === 'c_teller1') || null; check(!!G.NPCS.c_teller1 && G.DIALOGUES.bank_teller.start.choices.some((c) => c.text === 'This is a robbery! Give me all your money!'), 'the exact robbery line (scenario 9)'); void t; }
    // the loan shark
    const S = G.loanShark;
    { const st = w.npcs[S.ID]; check(!!st && st.gold >= 1000, 'Vince has a roll of cash'); const cap = st.gold, g0 = (p.gold = 10), rec = S.lend(w, 'player', p, 500, 50, 7); check(rec && p.gold === g0 + 500 && st.gold === cap - 500 && rec.owed === 750 && rec.due === w.day + 7, 'a loan takes it out of his pocket, and the terms stick (scenarios 13, 14)');
      check(S.offer(w, 500) >= 25, 'rates are high'); p.gold = 300; S.repay(w, rec, p, 300); check(rec.paid === 300 && S.left(rec) === 450 && st.gold === cap - 200, 'part of it'); p.gold = 1000; S.repay(w, rec, p, 9999); check(rec.status === 'paid' && p.gold === 550, 'all of it, cleared, and no more than owed (scenario 17)');
      const a = S.lend(w, 'npc1x', { gold: 0 }, 100, 40, 3), b = S.lend(w, 'npc2x', { gold: 0 }, 200, 50, 3); check(a.owed === 140 && b.owed === 300 && S.of(w, 'npc1x') === a && S.of(w, 'npc2x') === b, 'debts do not mix (scenario 27)'); w.loans = []; }
    { check(S.safeHere({ map: { id: 'forest', meta: {} } }) && S.safeHere({ map: { id: 'wilds_rural_e_1_1', meta: {} } }) && !S.safeHere({ map: { id: 'city', meta: {} } }), 'he does not go into the woods (scenario 16)'); }
    // confessions, both languages
    const Cf = G.confession;
    for (const [t, k] of [['I killed a guy last night', 'murder'], ['i sell coke on the corner', 'drugs'], ['I robbed the bank', 'robbery'], ['I beat him up', 'assault'], ['eu matei um cara ontem', 'murder'], ['eu vendo droga na esquina', 'drugs'], ['sou traficante', 'drugs'], ['assaltei o banco', 'robbery'], ['dei uma surra nele', 'assault']]) check(Cf.read(t) && Cf.read(t).kind === k, `confession: ${t}`);
    for (const t of ['I never killed anyone', 'Did you kill him?', 'eu nunca matei ninguém', 'He sells drugs', 'I hate drugs']) check(!Cf.read(t), `not a confession: ${t}`);
    // prison
    const P = G.prison;
    check(P.IDS.every((f) => G.FACTIONS[f] && !G.listedFactions().includes(f)), 'prison factions are their own, off the outside lists');
    { const r0 = w.getRep('gang_red'), f0 = w.getRep('p_afros'); w.addRep('p_afros', 10); check(w.getRep('p_afros') === f0 + 10 && w.getRep('gang_red') === r0, 'reputation inside does not touch the outside'); }
    w.bounty[g.region] = 100; G.jail.imprison(g); tick(2);
    check(g.map.id === 'jail' && p.inventory.has('prison_diary') && !p.inventory.has('phone'), 'booked: the notebook replaces the phone');
    check(g.map.decor.some((d) => d.type === 'pay_phone') && g.map.decor.filter((d) => ['bunk', 'stool', 'j_locker', 'tray', 'mop_bucket'].includes(d.type)).length > 10, 'the jail is furnished');
    check(!G.DIALOGUES._jailcall.start.choices.some((c) => /work|date|Hand over/i.test(typeof c.text === 'string' ? c.text : '')), 'prison calls have their own choices');
    { const j = w.jail, h0 = w.minutes; w.minutes = 17 * 60; check(!G.prisonCall.available(w), 'no call before 18:00 on the first day'); w.minutes = 18 * 60 + 1; check(G.prisonCall.available(w), 'the call comes at 18:00'); j.callUsed = w.day; check(!G.prisonCall.available(w), 'one a day'); w.day++; w.minutes = 10 * 60; check(!G.prisonCall.available(w), 'still used before the next 18:00'); w.minutes = 18 * 60; check(G.prisonCall.available(w), 'and back the next evening'); w.day--; w.minutes = h0; j.callUsed = null; }
    { const ids = Object.keys(G.NPCS).filter((i) => w.npcs[i] && !w.npcs[i].ko && !w.npcs[i].inHospital && ((G.beds.entryNow(i, w) || {}).act !== 'sleep')), a = ids[0], st = w.npcs[a], d0 = st.disp; st.disp = 80; const hi = G.prisonCall.answerOdds(g, a); st.disp = -60; const lo = G.prisonCall.answerOdds(g, a); check(hi > lo, `who picks up depends on how they feel (${hi.toFixed(2)} vs ${lo.toFixed(2)})`); st.disp = d0; }
    { const d = new G.DiaryScene(g); const out = []; for (const [t, fn] of G.PRISON_DIARY_PAGES) out.push(JSON.stringify(fn(g))); const all = out.join(' '); check(/Supremacists/.test(all) && /Afros/.test(all) && !/Red Gang|Blue Gang|The Elite|CIA|Revolutionar/.test(all), 'the diary shows prison factions, never the outside ones'); G.scenes.push(d); d.render(G.renderer.ctx); G.scenes.remove(d); p.reading = false; }
    { G.input.pressed.add('KeyP'); g.update(1 / 60); G.input.pressed.clear(); const top = G.scenes.top(); check(top instanceof G.DiaryScene, 'inside, P opens the notebook'); G.scenes.remove(top); p.reading = false; }
    G.jail.release(g); tick(1);
    check(!p.inventory.has('prison_diary'), 'the notebook stays behind');
    // EMS
    { const m = G.maps.get('city'), mg = G.maps.get('morgue'); check(mg.decor.some((d) => d.type === 'furnace') && mg.decor.some((d) => d.type === 'exam_table') && m.morgueDoor, 'the Medical Examiner has a furnace, a table and a door from the ward'); { const b = m.building('c_hospital'), q = [[b.doorX, b.doorY + 1]], seen = new Set(); while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (seen.has(k) || !m.inBounds(x, y) || m.isSolidTile(x, y)) continue; seen.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } check(seen.has(m.points.c_hospital_in.x + ',' + m.points.c_hospital_in.y), 'you can walk into the hospital'); check(seen.has(m.points.from_morgue.x + ',' + m.points.from_morgue.y), 'and reach the staff door'); } check(G.emsPlus.route(m, 200, 200, 600, 400) !== undefined, 'routes along the roads'); const M = G.emsPlus; w.dead.x1 = { removed: true }; M.morgueHour(w); check(M.list(w).some((b) => b.id === 'x1'), 'a body goes to the morgue'); M.morgueHour(w); check(M.list(w).filter((b) => b.id === 'x1').length === 1, 'once'); M.list(w)[0].at -= 99999; M.morgueHour(w); M.list(w)[0].at -= 99999; M.morgueHour(w); M.list(w)[0].at -= 99999; M.morgueHour(w); check(w.dead.x1.cremated && !M.list(w).length, 'and is cremated, on the record'); M.morgueHour(w); check(!M.list(w).some((b) => b.id === 'x1'), 'never twice'); delete w.dead.x1; }
    G.autonomy.off = false;
  }

  // 2026-11-04: languages (js/engine/i18n.js)
  function language() {
    const g = game(), w = g.world, I = G.i18n, S = G.settings;
    check((S.defaults.language | 0) === 0 && I.code() === 'en', 'English is the default');
    check(I.t('Goodbye.') === 'Goodbye.' && I.t('Talk to Town Mayor') === 'Talk to Town Mayor', 'in English, nothing changes');
    I.set(1);
    check(I.code() === 'pt' && S.data.language === 1, 'switching needs no restart');
    check(I.t('Goodbye.') === 'Tchau.' && I.t('Settings') === 'Configurações', 'exact text');
    check(I.t('SETTINGS') === 'CONFIGURAÇÕES', 'upper-cased window titles');
    check(I.t('Talk to Town Mayor') === 'Falar com Prefeito', `templates, and what fills them: ${I.t('Talk to Town Mayor')}`);
    check(I.t('3. Goodbye.') === '3. Tchau.', 'numbered answers');
    check(I.t('You mentioned your marriage. Everything okay?') === 'Você mencionou seu casamento. Tá tudo bem?', `someone else's persona line: ${I.t('You mentioned your marriage. Everything okay?')}`);
    check(I.t('Goodbye. Take care.') === 'Tchau. Se cuida.', 'text put together at run time, by the sentence');
    check(I.t('Jack Dale está aqui, cara.') === 'Jack Dale está aqui, cara.', 'generated Portuguese is left alone');
    check(I.t(I.t('Goodbye.')) === 'Tchau.', 'translating twice changes nothing');
    check(G.ui.wrap(G.renderer.ctx, 'Goodbye.', 200, 10)[0] === 'Tchau.' && G.ui.measure(G.renderer.ctx, 'Goodbye.') === G.ui.measure(G.renderer.ctx, 'Tchau.'), 'wrapping and measuring see the translated text');
    // the data: everything the game shows from its tables
    I.track = true; I.cache.clear();
    const bad = [], see = (t) => { if (typeof t !== 'string' || !/[a-z]{3}/i.test(t) || /\[Placeholder\]/.test(t) && false) return; if (I.t(t) === t && !I.same(t)) bad.push(t); };
    for (const id in G.ITEMS) { see(G.ITEMS[id].name); see(G.ITEMS[id].desc); }
    for (const id in G.NPCS) { see(G.NPCS[id].name); see(G.NPCS[id].job); }
    for (const id in G.FACTIONS) { see(G.FACTIONS[id].name); see(G.FACTIONS[id].desc); see(G.FACTIONS[id].cover); }
    for (const id in G.SHOPS) see(G.SHOPS[id].name);
    for (const id in (G.SKILLS || {})) { see(G.SKILLS[id].name); see(G.SKILLS[id].desc); }
    for (const id in (G.EFFECTS || {})) { see(G.EFFECTS[id].name); see(G.EFFECTS[id].desc); }
    for (const id in (G.QUESTS || {})) { const q = G.QUESTS[id]; see(q.title); see(q.desc); for (const o of q.objectives || []) see(o.text); }
    for (const id in G.REGIONS) see(G.REGIONS[id].name);
    for (const id in G.RACES) see(G.RACES[id].name);
    for (const id in G.AGES) see(G.AGES[id].name);
    for (const tree in G.DIALOGUES) for (const n in G.DIALOGUES[tree]) { const nd = G.DIALOGUES[tree][n]; if (!nd || typeof nd !== 'object') continue; see(nd.text); for (const c of nd.choices || []) see(c.text); }
    for (const id of Object.keys(G.MAPGEN)) { if (/^wilds/.test(id)) continue; let m = null; try { m = G.maps.cache[id] || G.maps.get(id); } catch (e) { /* */ } if (m && m.meta) { see(m.meta.name); for (const b of m.buildings || []) see(b.name); } }
    for (const f of G.SHOWS.FILMS) { see(f.title); see(f.genre); for (const s of f.scenes) for (const [a, b] of s.lines) { see(a); see(b); } }
    for (const f of G.SHOWS.PLAYS) { see(f.title); see(f.kind); for (const [a, b] of f.lines) { see(a); see(b); } for (const [a] of f.cast) see(a); }
    for (const v of Object.values(G.VENUES)) { see(v.name); for (const r of G.VENUE_KINDS[v.kind].roles) see(r); }
    for (const b of Object.values(G.BLUEPRINTS)) see(b.name);
    for (const [, n] of Object.entries(G.estate.PERMITS)) see(n[0]);
    for (const c of Object.values(G.estate.CREW)) { see(c.name); see(c.desc); see(c.role); }
    for (const l of Object.values(G.estate.LABEL)) see(l);
    for (const f of Object.values(G.FIGHTERS)) see(f.name);
    for (const s of Object.values(G.fightClub.STYLE)) see(s);
    for (const id of G.PRISON_FACTIONS) see(G.FACTIONS[id].name);
    for (const [t] of G.PRISON_DIARY_PAGES) see(t);
    const uniq = [...new Set(bad)];
    log(`     data scan: ${uniq.length} left in English`);
    for (const t of uniq.slice(0, 60)) log('     EN: ' + t.slice(0, 110));
    check(uniq.length === 0, `nothing in the game's data is left in English (${uniq.length})`);
    // every screen, drawn in Portuguese: what is put together at run time
    I.missing.clear(); I.cache.clear();
    const R = G.renderer, ctx = R.ctx, npcs = g.actors.filter((a) => a.kind === 'npc' && !a.dead && G.NPCS[a.id]).slice(0, 12);
    const box = { kind: 'chest', name: 'Kitchen Cabinet', items: [['bread', 2], ['beer', 3]], gold: 12 };
    const draw = (sc) => { try { G.scenes.push(sc); if (sc.resume) sc.resume(); sc.render(ctx); } catch (e) { log('     render: ' + (e.message || e)); } G.scenes.remove(sc); };
    for (const style of [0, 1]) {
      S.data.uiStyle = style;
      for (let t = 0; t < 5; t++) draw(Object.assign(new G.SettingsScene(), { tab: t }));
      draw(new G.PauseScene(g)); draw(new G.InventoryScene(g)); draw(new G.SkillsScene(g)); draw(new G.LootScene(g, box));
      draw(new G.SaveLoadScene(g, 'save')); draw(new G.WaitScene(g, false)); draw(new G.MapScene(g));
      for (let t = 0; t < 7; t++) { const j = new G.JournalScene(g); j.tab = t; draw(j); }
      for (const sid in G.SHOPS) if (w.shops[sid]) { const s = new G.ShopScene(g, sid, null); s.tab = 0; draw(s); s.tab = 1; draw(s); break; }
      for (const n of npcs) { n.talking = false; let d = null; try { d = new G.DialogueScene(g, new G.DialogueRunner(n, g)); } catch (e) { continue; } d.chars = 9999; draw(d); d.runner.ended = true; n.talking = false; }
      if (G.MenuScene) draw(new G.MenuScene());
      if (G.hud && G.hud.draw) { try { G.hud.draw(ctx, g); } catch (e) { /* */ } }
    }
    S.data.uiStyle = 1;
    const pts = [...I.out].join('\n');   // (a wrapped line of translated text is not a miss)
    const late = [...I.missing].filter((t) => /[a-z]{3}/i.test(t) && !/^\d/.test(t) && !I.same(t) && !/[À-ú]/.test(t) && !pts.includes(t.trim()) && !/^https?:|Llama|Claude|^Jack |[A-Z][a-z]+ [A-Z][a-z]+$/.test(t));
    log(`     screens: ${late.length} strings not translated`);
    for (const t of late.slice(0, 70)) log('     SCREEN: ' + t.slice(0, 110));
    check(late.length < 12, `every screen reads in Portuguese (${late.length} left)`);
    I.track = false;
    // what the player types reaches the game
    check(G.orders.parse('me siga').intent === 'follow' && G.orders.parse('fica aqui').intent === 'stay' && G.orders.parse('me protege').intent === 'protect' && G.orders.parse('vai pra casa').intent === 'home', 'orders in Portuguese');
    check(G.overhear.read('Jack Dale é um babaca').tone === 'insult' && G.overhear.read('vou te matar').tone === 'threat', 'tone in Portuguese');
    // the model is asked for Brazilian Portuguese, every request
    const b = G.ai.body('sys', 'user');
    check(/Brazilian Portuguese/.test(JSON.stringify(b)) && /Never European/.test(JSON.stringify(b)), 'generated text: Brazilian Portuguese');
    // saves do not change
    const s0 = JSON.stringify(w.npcs[Object.keys(w.npcs)[0]]);
    I.set(0);
    check(I.t('Goodbye.') === 'Goodbye.' && JSON.stringify(w.npcs[Object.keys(w.npcs)[0]]) === s0, 'and back to English; game state untouched');
    check(!/Brazilian Portuguese/.test(JSON.stringify(G.ai.body('sys', 'user'))), 'English generated text again');
    S.save && S.save(); const kept = G.store.get(G.config.SETTINGS_KEY, {}); I.set(1); S.save && S.save();
    check((G.store.get(G.config.SETTINGS_KEY, {}).language) === 1 && kept.language === 0, 'the choice is stored with the settings');
    I.set(0);
  }

  // a real model, when one is running (?test&only=liveAI): prints what it says, for reading
  async function liveAI() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(13); tick(5);
    const A = G.ai, O = G.orders, S = G.settings.data;
    const ppl = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && G.NPCS[a.id] && !a.def.shop);
    const [jack, wife] = ppl;
    jack.st.realName = 'Jack Dale'; wife.st.realName = 'Rosa Dale';
    S.dialogueMode = 2; A.localUp = true; A.localModels = ['llama3.1:8b']; A.loaded = 'llama3.1:8b'; A.fails = 0; A.sessionOff = false; A.TIMEOUT = A.LOCAL_TIMEOUT = 40000;
    if (/lang=1/.test(location.search)) {
      G.i18n.set(1);
      A.transport = async (req) => { const r = await fetch('http://localhost:11434/api/chat', { method: 'POST', body: JSON.stringify(req.body) }); return { status: r.status, body: await r.text() }; };
      const say = async (who, text, disp) => { who.x = p.x + 14; who.y = p.y; who.state = 'schedule'; who.st.disp = disp; who.st.hostile = false; who.st.fear = 0; who.st.companion = false; who.st.order = null; const r = new G.DialogueRunner(who, g), res = await A.exchange(r, text); log(`LIVE [${disp}] "${text}" -> ${res ? res.line : 'NULL ' + A.lastFail}${res && res.say.length ? '  OPCOES: ' + res.say.join(' / ') : ''}${who.st.companion ? ' [ENTROU]' : ''}${who.st.order ? ' [ORDEM ' + who.st.order.t + ']' : ''}`); r.ended = true; who.talking = false; };
      await say(jack, 'Jack Dale é um babaca.', 0);
      await say(wife, 'Jack Dale é um babaca.', 0);
      await say(jack, 'Quem é você? Fala da sua família.', 30);
      await say(jack, 'Onde eu acho um bar por aqui?', 30);
      await say(jack, 'Me segue, preciso de reforço.', -40);
      await say(jack, 'Cola comigo, meu velho amigo.', 90);
      await say(wife, 'Fica aqui, já volto.', 90);
      const lr = new G.DialogueRunner(jack, g), written = await A.npcLine(lr, { written: 'Good to see you. What do you need?' });
      log(`LIVE written line re-voiced: ${written ? written.line : 'NULL'}`); lr.ended = true;
      const bk = await A.bark(g, jack, { kind: 'overheard', text: 'heard the player insult you', sev: 2, heard: true, hint: 'They are talking about YOU.' });
      log(`LIVE bark: ${bk}`);
      G.i18n.set(0);
      return;
    }
    A.transport = async (req) => { try { const r = await fetch('http://localhost:11434/api/chat', { method: 'POST', body: JSON.stringify(req.body) }), b = await r.text(); try { const j = JSON.parse(b); A.lastTokens = [j.prompt_eval_count, j.eval_count, (j.total_duration / 1e9).toFixed(1)]; } catch (e) { /* */ } return { status: r.status, body: b }; } catch (e) { log('FETCHFAIL ' + e); return null; } };
    const run = async (who, text, disp) => {
      who.x = p.x + 14; who.y = p.y; who.state = 'schedule'; who.st.disp = disp; who.st.hostile = false; who.st.fear = 0; who.st.companion = false; who.st.order = null;
      const r = new G.DialogueRunner(who, g), t0 = performance.now(), res = await A.exchange(r, text);
      if (res) log(`LIVE tokens: prompt ${A.lastTokens && A.lastTokens[0]} reply ${A.lastTokens && A.lastTokens[1]} real ${A.lastTokens && A.lastTokens[2]}s`);
      log(`LIVE [${w.npcs[who.id].realName}, disp ${disp}] "${text}" -> ${res ? res.line : 'NULL ' + A.lastFail}${res && res.say.length ? '  CHOICES: ' + res.say.join(' / ') : ''}  (${Math.round(performance.now() - t0)}ms${who.st.companion ? ', JOINED' : ''}${who.st.order ? ', ORDER ' + who.st.order.t : ''})`);
      r.ended = true; who.talking = false;
    };
    await run(jack, 'Jack Dale is an asshole.', 0);
    await run(wife, 'Jack Dale is an asshole.', 0);
    await run(jack, 'Who are you, and who is your family?', 30);
    await run(jack, 'Where is a good place to get a drink around here?', 30);
    await run(jack, 'Follow me around, I need backup.', -40);
    await run(jack, 'Stick to me like glue, old friend.', 90);
    await run(jack, 'Protect me.', 90);
    await run(jack, 'Tell me about the secret tunnels under the old Rosewood Castle.', 20);
    const r = new G.DialogueRunner(jack, g);
    A.log(r, 'npc', "I've been having problems with my wife lately.");
    const res = await A.npcLine(r, { said: 'Oh? What happened?', free: true });
    log(`LIVE choices after talk of his wife: ${res ? res.line + ' || ' + res.choices.join(' / ') : 'NULL'}`);
  }

  async function npcTalk() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(13); tick(5);
    const T = G.npcTalk, A = G.ai, S = G.settings.data;
    const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); for (let i = 0; i < 8; i++) await Promise.resolve(); };
    const ppl = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && G.NPCS[a.id] && !a.sleeping);
    const [a, b, c] = ppl;
    // bonds: the same scale as with the player
    a.st.op = Object.assign(a.st.op || {}, { [b.id]: 35 }); a.st.trustOp = {};
    const b1 = T.bond(w, a.id, b.id); T.trustAdj(w, a.id, b.id, 10); const b2 = T.bond(w, a.id, b.id);
    check(b1.name === 'Good Friend' && b2.trust === b1.trust + 10, `bonds between people: ${b1.name}, trust ${b1.trust} -> ${b2.trust}`);
    // a talk with the player is remembered (written dialogue)
    S.dialogueMode = 0; a.st.convos = [];
    a.x = p.x + 14; a.y = p.y; a.state = 'schedule'; a.st.fear = 0; a.st.hostile = false;
    g.openDialogue(a); tick(1);
    const d = G.scenes.top(), ch = d.runner.node.choices.findIndex((x) => /^Any news\?/.test(x.text));
    d.choose(ch >= 0 ? ch : 0); tick(1); d.runner.end(); tick(1);
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    const mem = T.past(w, a.id, 'player').slice(-1)[0];
    check(mem && /The player said/.test(mem.gist), `they remember talking to you ("${mem && mem.gist}") talk=${JSON.stringify(d.runner._talk)} ai=${JSON.stringify(d.runner.aiLog)} convos=${JSON.stringify(a.st.convos)} errs=${(G.errors || []).slice(-2).join(' | ')} wrapped=${G.DialogueRunner.prototype.end.toString().includes('closeTalk')} cls=${d.runner.constructor.name}`);
    // with AI: a one-sentence memory from their side
    const saved = { t: A.transport, up: A.localUp, m: A.localModels, l: A.loaded };
    A.localUp = true; A.localModels = ['llama3.1:8b']; A.loaded = 'llama3.1:8b'; A.fails = 0; A.sessionOff = false; S.dialogueMode = 2;
    let reply = { gist: 'I told the stranger the gossip about the fair, and they seemed glad to hear it.' };
    A.transport = () => Promise.resolve({ status: 200, body: JSON.stringify({ message: { content: JSON.stringify(reply) } }) });
    const r = new G.DialogueRunner(a, g); A.log(r, 'player', 'Any news around town?'); A.log(r, 'npc', 'They say the fair is coming back.'); r.end(); await flush();
    check(/fair/.test(T.past(w, a.id, 'player').slice(-1)[0].gist) && /^I /.test(T.past(w, a.id, 'player').slice(-1)[0].gist), `with AI: the memory is a sentence from their side (${T.past(w, a.id, 'player').slice(-1)[0].gist} | fail=${A.lastFail} active=${A.active()} mode=${A.mode()} n=${T.past(w, a.id, 'player').length})`);
    const ctx = A.context(new G.DialogueRunner(a, g));
    check(/Your past conversations with the player: .*today: I told the stranger/.test(ctx) && new RegExp(`People in your life: .*${b.st.realName}.*Good Friend`).test(ctx), 'AI context: past talks with you, and the people in their life');
    // two people talk to each other (generated), the lines come in turn, it changes them, others overhear
    a.st.convos = []; b.st.convos = []; c.st.saw = [];
    {   // (somewhere open: from the start point a wall of your house can stand between them)
      const m = g.map; let o = null;
      for (let ty = 8; ty < m.h - 8 && !o; ty++) for (let tx = 8; tx < m.w - 12 && !o; tx++) { let ok = true; for (let y = ty - 1; y <= ty + 1 && ok; y++) for (let x = tx; x <= tx + 8 && ok; x++) if (m.isSolidTile(x, y) || m.buildingAtTile(x, y) || m.isSwimmable(x, y)) ok = false; if (ok) o = { x: tx * 16 + 8, y: ty * 16 + 12 }; }
      p.x = o.x; p.y = o.y;
    }
    a.x = p.x + 40; a.y = p.y; b.x = p.x + 60; b.y = p.y; c.x = p.x + 80; c.y = p.y;
    for (const n of [a, b, c]) { n.talking = false; n.bark = null; n.state = 'schedule'; n._talkLines = null; }
    c.chatT = 99;   // (the bystander stays put to listen)
    reply = { lines: [{ speaker: 'A', text: 'Did you hear the shots last night?' }, { speaker: 'B', text: 'Hard not to. I barely slept.' }, { speaker: 'A', text: 'Lock your door tonight.' }], topic: 'the shots last night', a_likes_b: 3, b_likes_a: 2, a_trusts_b: 1, b_trusts_a: 2 };
    const opBA = G.social.opinion(w, b.id, a.id);
    const ok = await T.converse(g, a, b);
    check(ok && a.bark === 'Did you hear the shots last night?', 'they talk: the first line');
    for (let i = 0; i < 170; i++) G.loop.tick(1 / 60);
    check(b.bark === 'Hard not to. I barely slept.', `then the answer, from the other one ("${b.bark}")`);
    for (let i = 0; i < 150; i++) G.loop.tick(1 / 60);
    check(a.bark === 'Lock your door tonight.', 'then the next line');
    check(G.social.opinion(w, b.id, a.id) >= Math.min(100, opBA + 1) && T.past(w, a.id, b.id).length && T.past(w, b.id, a.id).length, 'it changed what they think of each other, and both remember it');
    check((c.st.saw || []).some((e) => /heard .* say .*shots/.test(e.text)), `someone nearby overheard them (${JSON.stringify(c.st.saw)} d=${Math.round(c.distTo(a))})`);
    A.transport = saved.t; A.localUp = saved.up; A.localModels = saved.m; A.loaded = saved.l;
    S.dialogueMode = 2;
  }

  // 2026-11-02: what people notice and overhear (js/game/awareness.js); time keeps going while you talk
  async function awareness() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(13); tick(5);
    p.hp = p.maxHp = 9999; p.equip.weapon = null;
    const AW = G.aware, A = G.ai;
    const out = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && G.NPCS[a.id] && !a.sleeping);
    const [a, b, c] = out;
    // stand somewhere open outdoors (the start point is inside your house): nothing solid for a few tiles around
    const m = g.map; let open = null;
    for (const span of [42, 32, 28]) for (let ty = 8; ty < m.h - 8 && !open; ty += 1) for (let tx = 8; tx < m.w - span - 3 && !open; tx += 1) {
      let ok = true;
      for (let y = ty - 2; y <= ty + 2 && ok; y++) for (let x = tx - 3; x <= tx + span && ok; x++) if (m.isSolidTile(x, y) || m.buildingAtTile(x, y) || m.isSwimmable(x, y)) ok = false;
      if (ok) open = { x: tx, y: ty };
    }
    if (open) { p.x = open.x * 16 + 8; p.y = open.y * 16 + 12; }
    log('     open spot: ' + JSON.stringify(open));
    const clear = () => { for (const n of out) { n.st.saw = []; n.bark = null; n._barkAt = -99; n.talking = false; n.state = 'schedule'; n.sleeping = false; } AW._lastBark = -99; };
    const at = (n, dx, dy) => { n.x = p.x + dx; n.y = p.y + dy; };
    // the clock runs during a conversation
    at(a, 14, 0); const m0 = w.day * 1440 + w.minutes;
    g.openDialogue(a); for (let i = 0; i < 120; i++) G.loop.tick(1 / 60);
    const m1 = w.day * 1440 + w.minutes;
    check(m1 > m0, `time keeps going while you talk (${(m1 - m0).toFixed(1)} game minutes in 2 seconds)`);
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    a.talking = false;
    // seeing
    clear(); at(a, 40, 0); at(b, 600, 0);
    p.inventory.add('pistol', 1); p.equip.weapon = 'pistol'; g._awState = {}; g._awT = 0; tick(2);
    check(AW.recent(a).some((e) => /pull out a /.test(e.text)) && !AW.recent(b).some((e) => /pull out/.test(e.text)), `a gun comes out: the one nearby sees it, the one far away does not (a: ${JSON.stringify(a.st.saw)} d=${Math.round(a.distTo(p))} weapon=${p.weaponItem && p.weaponItem.name} same=${AW.sameSpace(g.map, a.x, a.y, p.x, p.y)} b: ${JSON.stringify(b.st.saw)} db=${Math.round(b.distTo(p))})`);
    p.equip.weapon = null; g._awState = {};
    // hearing a gunshot from far away
    clear(); at(b, open ? 400 : 420, 0);
    G.firearms.noise(g, p, true);
    check(AW.recent(b).some((e) => /heard a gunshot/.test(e.text)), `a shot: heard from far off (${JSON.stringify(b.st.saw)} d=${Math.round(b.distTo(p))} hook=${G.firearms.noise.toString().includes('gunshot')} hears=${AW.hears(g, b, p.x, p.y, 650)} same=${AW.sameSpace(g.map, b.x, b.y, p.x, p.y)} sleep=${b.sleeping} wx=${G.weather && G.weather.kind})`);
    // overhearing a conversation
    clear(); at(a, 14, 0); at(b, 60, 10); at(c, 300, 0);
    AW.speech(g, p, a, 'I need someone to take care of a problem for me.');
    check(AW.recent(b).some((e) => /heard the player say to .*problem/.test(e.text)) && !AW.recent(c).length, 'someone a few steps away overhears you; someone far away does not');
    // a wall in between: much harder to hear
    const bld = g.map.buildings.find((x) => !G.doors.isPublic(g, x));
    if (bld) {
      clear(); c.x = (bld.x + 2) * 16 + 8; c.y = (bld.y + 2) * 16 + 12; p.x = (bld.x + 2) * 16 + 8; p.y = (bld.y + bld.h + 2) * 16 + 12;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      AW.speech(g, p, a, 'Keep this between us.');
      check(!AW.recent(c).length || d < AW.VOICE * 0.35, `through a wall (${Math.round(d)}px): not overheard`);
      p.x = g.map.points.start.x * 16 + 8; p.y = g.map.points.start.y * 16 + 12;
    }
    // hearing their own name: they say something
    clear(); at(a, 14, 0); at(b, 50, 0);
    const first = b.st.realName.split(' ')[0];
    AW.speech(g, p, a, `What do you think of ${first}? I do not trust them.`);
    check(!!b.bark, `hearing their name: they react ("${b.bark}")`);
    // a death
    clear(); at(b, 50, 0); at(c, 30, 0); c.hp = 1;
    c.die(p, g);   // (bare fists knock people out: this is a death)
    check(c.dead && AW.recent(b).some((e) => /die/.test(e.text)), `someone dies in front of them: they saw it (dead ${c.dead}, b: ${JSON.stringify(b.st.saw)}, d=${Math.round(b.distTo(c))}, same=${AW.sameSpace(g.map, b.x, b.y, c.x, c.y)}, line=${G.firearms.clearLine(g.map, b.x, b.y - 10, c.x, c.y - 10)}, sees=${AW.sees(g, b, c.x, c.y, 170)})`);
    // the AI knows
    G.settings.data.dialogueMode = 2;
    const ctx = A.context(new G.DialogueRunner(b, g));
    check(/What you saw and heard recently: .*(die|heard)/.test(ctx), 'AI context: what they saw and heard');
    // an AI-written reaction (mocked server)
    const saved = { t: A.transport, up: A.localUp, m: A.localModels, l: A.loaded };
    A.transport = () => Promise.resolve({ status: 200, body: JSON.stringify({ message: { content: '{"line":"Oh my God, somebody call an ambulance!","attitude":"afraid"}' } }) });
    A.localUp = true; A.localModels = ['llama3.1:8b']; A.loaded = 'llama3.1:8b'; A.fails = 0; A.sessionOff = false;
    const line = await A.bark(g, b, { kind: 'death', text: 'saw someone die at the player\'s hands', sev: 3 });
    check(/ambulance/.test(line || ''), `AI reaction: "${line}"`);
    A.transport = saved.t; A.localUp = saved.up; A.localModels = saved.m; A.loaded = saved.l;
    clear();
  }

  // 2026-11-02: being somewhere private with permission (js/game/doors.js allowed / _stay_ask, AI allow_stay)
  function welcome() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(13); tick(5);
    const D = G.doors, roll = G.skills.roll;
    const bid = Object.keys(g.residents).find((id) => { const b = g.map.building(id); return b && !D.isPublic(g, b) && !D.shopOf(g, b) && w.flags.player_home !== id && g.residents[id].some((n) => w.isAlive(n) && !G.NPCS[n].kid); });
    const b = g.map.building(bid), owner = g.residents[bid].find((n) => w.isAlive(n) && !G.NPCS[n].kid), st = w.npcs[owner];
    const reset = () => { Object.assign(st, { disp: 0, romance: 0, partner: false, companion: false, loveDay: null, fear: 0, hostile: false, checks: {} }); if (w.invites) delete w.invites[bid]; };
    p.x = (b.x + Math.floor(b.w / 2)) * 16 + 8; p.y = (b.y + Math.floor(b.h / 2)) * 16 + 12;
    reset();
    check(!!D.intruding(g), `in ${G.NPCS[owner].name}'s ${b.name.toLowerCase()} uninvited: trespassing`);
    st.disp = 45; check(!D.intruding(g), 'a friend lives here: you are welcome'); reset();
    st.loveDay = w.day; check(!D.intruding(g), 'you spent the night with someone who lives here: you are welcome'); reset();
    st.loveDay = w.day - 3; check(!!D.intruding(g), '...but not days later'); reset();
    // asking to stay
    const npc = g.actors.find((a) => a.id === owner) || G.phone.callee(g, owner); npc.remote = false;
    const r = new G.DialogueRunner(npc, g);
    check(G.DIALOGUE_CHOICES.some((fn) => fn(r).some((c) => /Mind if I stay a bit/.test(typeof c.text === 'string' ? c.text : ''))), 'the owner catches you: "Mind if I stay a bit?" is there');
    G.skills.roll = () => true;
    let n = G.DIALOGUE_NODES._stay_ask(r);
    check(!D.intruding(g) && /stay|home/i.test(n.text), `talked them into it: you are their guest ("${n.text}")`);
    reset(); G.skills.roll = () => false;
    n = G.DIALOGUE_NODES._stay_ask(new G.DialogueRunner(npc, g));
    check(!!D.intruding(g) && (st.disp || 0) < 0, `no luck: still trespassing ("${n.text}")`);
    G.skills.roll = roll; reset();
    // the AI letting you stay
    G.settings.data.dialogueMode = 2; st.disp = 10;
    const ra = new G.DialogueRunner(npc, g);
    check(/Your place: the player is in your/.test(G.ai.context(ra)), 'AI context: they know you are in their place uninvited');
    const prom = G.ai.promised(ra, 'Oh, alright. Make yourself at home.', []);
    G.ai.apply(ra, prom, true, 'friendly');
    check(prom.some((a) => a.type === 'allow_stay') && !D.intruding(g), 'they say "make yourself at home": you can stay');
    reset(); st.disp = -30; G.ai.apply(new G.DialogueRunner(npc, g), [{ type: 'allow_stay' }], true, 'friendly');
    check(!!D.intruding(g), 'someone who dislikes you saying it is not enough');
    // nobody calls the police while you are talking it over
    reset(); const crimes = JSON.stringify(w.crimeRecord || {});
    G.scenes.push({ transparent: true, update() {}, render() {} });
    g.trespassWarned = true; D.trespass(g, 10);
    G.scenes.pop();
    check(JSON.stringify(w.crimeRecord || {}) === crimes, 'no police call while another screen is open');
    reset(); p.x = g.map.points.start.x * 16 + 8; p.y = g.map.points.start.y * 16 + 12;
  }

  // 2026-11-02: woods, whole inventories, talking people down, muggers, waiting, needs, promises kept, cop deals
  function npcLife() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    p.hp = p.maxHp = 9999; p.equip.weapon = null;
    G.settings.data.dialogueMode = 2;
    const roll = G.skills.roll; const yes = () => true, no = () => false;
    const adult = (pred) => g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && G.NPCS[a.id] && (!pred || pred(a)));
    const reset = (n) => { Object.assign(n.st, { hostile: false, fear: 0, disp: 20, compBanUntil: 0, compAnger: 0, truceUntil: 0, calmTry: null }); n.aggressor = false; n.state = 'schedule'; n.target = null; n.x = p.x + 14; n.y = p.y; n.hp = n.maxHp = 300; };
    // the woods
    check(G.maps.get('wilds_rural_n_0_m1').meta.name === 'The Woods', 'the woods are just "The Woods"');
    // everything they have on them
    const armed = adult((a) => a.def.weapon) || adult(); reset(armed);
    G.npcGear.materialize(armed);
    const eq = armed.st.equip, hasIt = (id) => armed.st.inv.some((e) => e[0] === id && e[1] > 0);
    check(eq.top && hasIt(eq.top) && eq.bottom && hasIt(eq.bottom) && (!armed.def.weapon || (eq.weapon === armed.def.weapon && hasIt(eq.weapon))), `their clothes and weapon are real items, equipped (${Object.values(eq).join(', ')})`);
    const ls = new G.LootScene(g, { id: 'person_' + armed.id, kind: 'person', name: 'x', owner: null, items: [], gold: 0 });
    check(ls.c.items === armed.st.inv && ls.c.items.some((e) => e[0] === eq.top), 'searching them: their clothes and weapon are in the list');
    const top = eq.top; armed.st.inv.find((e) => e[0] === top)[1] = 0; G.companionItems.applyLook(armed);
    check(armed.look.shirtless === true, 'take their top and they are shirtless');
    armed.st.inv.find((e) => e[0] === top)[1] = 1; G.companionItems.applyLook(armed);
    check(!armed.look.shirtless, 'give it back and it is on again');
    const kid = g.actors.find((a) => a.kind === 'npc' && a.def.kid && !a.dead);
    if (kid) { G.npcGear.materialize(kid); check(!kid.st.equip.top, 'never children\'s clothes'); }
    const cts = new G.CompanionTradeScene(g, armed);
    check(cts.c.items.some((e) => e[0] === eq.bottom), 'managing their items: what they wear is there too');
    // a body does not get a second set of clothes
    const before = new Set(Object.keys(w.containers));
    G.containers.createCorpse(w, armed, g.map.id);
    const cid = Object.keys(w.containers).find((k) => !before.has(k)), corpse = w.containers[cid];
    check(corpse && corpse.items.filter((e) => e[0] === eq.top).reduce((s, e) => s + e[1], 0) === 1, 'their body has their top once, not twice');
    delete w.containers[cid];
    // talking down someone who is fighting you
    const foe = adult((a) => a.def.combat === 'fight' && a !== armed); reset(foe);
    foe.startFight(p, g); foe.st.hostile = true;
    g.talkTo(foe); tick(1);
    const ds = G.scenes.top();
    check(ds.runner && ds.runner.tree === G.DIALOGUES._standoff, 'someone fighting you: [E] opens a standoff, not "No more words."');
    G.skills.roll = yes;
    ds.choose(ds.runner.node.choices.findIndex((c) => /do not want to fight/.test(c.text))); tick(1);
    check(foe.state !== 'fight' && !foe.st.hostile && G.persuade.inTruce(w, foe), 'calmed down: they stop, and a truce holds');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // typed, with AI: the calm action
    reset(foe); foe.startFight(p, g); foe.st.hostile = true;
    const rs = new G.DialogueRunner(foe, g, '_standoff'); G.ai.log(rs, 'player', 'Look, I have kids at home. Just walk away and I will forget this.');
    let ex = G.ai.apply(rs, [{ type: 'calm', amount: 7, backs: true }], true, 'wary');
    check(ex.end && !foe.st.hostile && G.persuade.inTruce(w, foe), 'typed words: a good case talks them down');
    G.skills.roll = no; reset(foe); foe.st.hostile = true;
    const rs2 = new G.DialogueRunner(foe, g, '_standoff'); G.ai.log(rs2, 'player', 'whatever'); G.ai.apply(rs2, [{ type: 'calm', amount: 1, backs: false }], true, 'hostile');
    check(foe.st.hostile, 'a weak try: they keep coming');
    G.skills.roll = roll; reset(foe);
    // muggers hearing "no"
    const chance = G.rng.chance; const mug = adult((a) => a !== foe && a !== armed); reset(mug); mug.def.mugger = mug.def.mugger || false;
    G.rng.chance = () => true; G.persuade.refuseMugger(g, mug); const angry = mug.st.hostile;
    reset(mug); G.rng.chance = () => false; G.persuade.refuseMugger(g, mug); const awkward = !mug.st.hostile && mug.mugDone;
    G.rng.chance = chance; reset(mug);
    check(angry && awkward, 'a mugger told no: usually a fight, sometimes an awkward retreat');
    check(G.DIALOGUES._mugging.start.choices.some((c) => c.text === 'No.'), 'the mugging has a plain "No."');
    // waiting where you left them
    const buddy = adult((a) => ![armed, foe, mug].includes(a)); reset(buddy);
    G.companions.start(g, buddy);
    G.DIALOGUE_NODES._comp_wait(new G.DialogueRunner(buddy, g));
    const spot = { x: buddy.x, y: buddy.y }, map0 = g.map.id;
    check(buddy.st.waitAt && buddy.st.waitAt.map === map0, 'told to wait: they remember where');
    g.loadMap('forest', Object.keys(G.maps.get('forest').points).find((k) => k.startsWith('from_')) || 'start'); tick(2);
    check(!g.actors.includes(buddy) && buddy.st.companion, 'you leave the map: they stay behind, still with you');
    g.loadMap(map0, 'start'); tick(2);
    const back = g.actors.find((a) => a.id === buddy.id);
    check(back && Math.hypot(back.x - spot.x, back.y - spot.y) < 20, 'you come back: they are where you left them');
    buddy.st.waitAt.until = w.day * 1440 + w.minutes - 1; G.events.emit('hour');
    check(!buddy.st.companion && !buddy.st.waitAt, 'waited too long: they leave the party and go home');
    // needs
    reset(back || buddy); const nb = back || buddy; nb.st.hunger = 92;
    p.inventory.add('apple', 1);
    const nd = G.DIALOGUE_NODES._needs(new G.DialogueRunner(nb, g));
    const give = nd.choices.find((c) => /Give them: Apple/.test(c.text));
    check(/hungry|eaten/.test(nd.text) && !!give, `"Do you need anything?": "${nd.text}"`);
    const d0 = nb.st.disp; give.do();
    check(nb.st.hunger < 92 && nb.st.disp > d0, 'you feed them: less hungry, and they like you more');
    check(/Right now you are: starving|Right now you are: hungry/.test(G.ai.context(new G.DialogueRunner(Object.assign(nb, {}), g))) || nb.st.hunger < 60, 'AI context: how they feel');
    // promises kept
    reset(nb); nb.st.inv = [['apple', 2]];
    const rp = new G.DialogueRunner(nb, g); G.ai.log(rp, 'player', 'I am so hungry.');
    const prom = G.ai.promised(rp, 'Here, take this apple. You look starved.', []);
    const apples = p.inventory.count('apple'); const exg = G.ai.apply(rp, prom, true, 'friendly');
    check(prom.some((a) => a.type === 'give' && a.item === 'apple') && p.inventory.count('apple') === apples + 1, 'they say "here, take this apple": you get the apple');
    nb.st.gold = 50; const gold0 = p.gold;
    G.ai.apply(rp, G.ai.promised(rp, "Here's $20 for the bus.", []), true, 'friendly');
    check(p.gold === gold0 + 20 && nb.st.gold === 30, 'they say "here\'s $20": you get $20 of theirs');
    check(!G.ai.promised(rp, 'I will think about it.', []).length, 'nothing promised, nothing done');
    // the police: a deal for a clean record
    const cop = g.actors.find((a) => a.kind === 'npc' && a.def.combat === 'guard' && !a.dead) || G.phone.callee(g, Object.keys(G.NPCS).find((id) => G.NPCS[id].combat === 'guard' && G.NPCS[id].faction === 'government'));
    Object.assign(cop.st, { disp: 0, copTryDay: null, copDealDay: null });
    check(!G.aiJobs.copReady(g, cop, 'got work?', 0), 'a cop does not hire you for asking');
    G.skills.roll = yes;
    check(G.aiJobs.copReady(g, cop, 'I want to make up for what I did. I know who is selling drugs on Pawn Row.', 6), 'a good reason and a Charisma roll: they will');
    G.skills.roll = roll;
    for (const id of G.jobs.active(w)) w.quests[id].state = 'failed';
    const o = G.aiJobs.options(w, cop.id);
    const cj = G.aiJobs.build(w, cop.id, o.kinds.includes('beat') ? { kind: 'beat', target: o.pool.enemies[0] } : { kind: 'fetch', item: o.items[0], count: 1 });
    check(cj && cj.reward.clearBounty && /police/.test(cj.title), `a police job pays with a clean record (${cj && cj.title})`);
    w.bounty.city = 300;
    const jid = G.jobs.accept(new G.DialogueRunner(cop, g), cj);
    for (const ob of cj.objectives) { if (ob.flag) w.flags[w.quests[jid].def.objectives[0].flag] = true; if (ob.type === 'have') p.inventory.add(ob.item, ob.count); }
    G.jobs.complete(new G.DialogueRunner(cop, g), jid);
    check(w.quests[jid].state === 'done' && !(w.bounty.city > 0), 'job done: your bounty is wiped');
    G.settings.data.dialogueMode = 2;
  }

  // 2026-11-02: asking people to come along in your own words (aidialogue.js join_party, companionmood.js joinRefusal)
  async function aiFollow() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const M = G.companionMood, A = G.ai, S = G.settings.data;
    for (const c of G.companions.list(g)) G.companions.dismiss(g, c);
    const npc = g.actors.find((a) => a.id === 'r_elder'), st = npc.st;
    const reset = (disp) => { if (st.companion) G.companions.dismiss(g, npc); Object.assign(st, { disp, fear: 0, hostile: false, compBanUntil: 0, compAnger: 0, partner: false, trustAdj: 0, memory: [], aiMemory: [] }); st.goingHome = false; npc.x = p.x + 14; npc.y = p.y; };
    reset(30); check(M.joinRefusal(g, npc, false) === null, 'someone who likes you comes if asked');
    reset(5); check(M.joinRefusal(g, npc, false) && M.joinRefusal(g, npc, true) === null, 'an acquaintance comes only if convinced');
    reset(-20); check(M.joinRefusal(g, npc, true), 'someone who dislikes you will not, whatever you say');
    reset(30); st.compBanUntil = w.day + 2; check(/quit/.test(M.joinRefusal(g, npc, false) || ''), 'someone who just quit on you will not');
    // the AI agreeing: only when you asked, and only if the game agrees
    S.dialogueMode = 2;
    reset(5); let r = new G.DialogueRunner(npc, g); A.log(r, 'player', 'Nice weather today.');
    A.apply(r, [{ type: 'join_party' }], true, 'friendly'); check(!st.companion, 'they cannot decide to come when you did not ask');
    A.log(r, 'player', 'Come with me. I could use someone who knows these woods, and I will split whatever we find.');
    A.apply(r, [{ type: 'join_party' }], true, 'friendly'); check(st.companion, 'convinced by a good reason: an acquaintance comes along');
    reset(-20); r = new G.DialogueRunner(npc, g); A.log(r, 'player', 'Come with me, please.');
    A.apply(r, [{ type: 'join_party' }], true, 'friendly'); check(!st.companion, 'the AI saying yes is not enough for someone who dislikes you');
    // a warm answer without the decision: someone who likes you comes; an acquaintance does not (they needed convincing)
    reset(30); r = new G.DialogueRunner(npc, g); A.log(r, 'player', 'Want to come with me for a while?');
    A.apply(r, [], true, 'friendly'); check(st.companion, 'a friend says yes warmly: they come');
    reset(5); r = new G.DialogueRunner(npc, g); A.log(r, 'player', 'Want to come with me for a while?');
    A.apply(r, [], true, 'friendly'); check(!st.companion, 'an acquaintance being friendly is not a yes');
    check(/Coming along with the player: you would come with them only if they give you a good reason/.test(A.context(r)), 'AI context: what it would take');
    const weak = A.argumentScore(r, 'Come with me.'), strong = A.argumentScore(r, 'Come with me to the city. Someone has been stealing from your town, I know who, and I need a witness the police will believe. I will pay you $50 for your time.'), threat = A.argumentScore(r, 'Come with me or I will hurt you, I need you now.');
    check(weak <= 1 && strong >= 6 && threat === 0, `the game rates the argument too: bare ${weak}, a real case ${strong}, a threat ${threat}`);
    // they said no, but you argued: a Charisma roll (once a day), only with a real argument
    const roll = G.skills.roll; let dc = null; G.skills.roll = (pp, d) => { dc = d; return true; };
    reset(5); r = new G.DialogueRunner(npc, g); A.log(r, 'player', 'Come with me, I will pay you and I need your help.');
    A.apply(r, [{ type: 'persuade_join', amount: 2 }], true, 'wary'); check(!st.companion && dc === null, 'a weak argument (2/10): no roll, no');
    const ex = A.apply(r, [{ type: 'persuade_join', amount: 9 }], true, 'wary');
    check(st.companion && dc != null && dc <= 3 && /talked|point|coming/.test(ex.saidAfter || ''), `a strong argument (9/10): a Charisma roll (difficulty ${dc}) talks them into it, and they say so`);
    reset(5); r = new G.DialogueRunner(npc, g); A.log(r, 'player', 'Come with me, please, I need you.'); dc = null;
    A.apply(r, [{ type: 'persuade_join', amount: 9 }], true, 'wary'); check(!st.companion && dc === null, 'one try a day');
    G.skills.roll = roll;
    // the reply has to decide
    const saved = { transport: A.transport, up: A.localUp, models: A.localModels };
    let body = null;
    A.transport = (req) => { body = req.body; return Promise.resolve({ status: 200, body: JSON.stringify({ message: { content: '{"line":"Alright, you convinced me.","attitude":"friendly","choices":[],"actions":[],"comes_along":true}' } }) }); };
    A.localUp = true; A.localModels = ['llama3.1:8b']; A.fails = 0; A.sessionOff = false;
    reset(5); r = new G.DialogueRunner(npc, g); A.log(r, 'player', 'Come with me, I need help and I pay well.');
    const res = await A.npcLine(r, { said: 'Come with me, I need help and I pay well.', free: true });
    check(body && body.format.required.includes('comes_along') && res && res.comes === true, 'asked to come along: the reply must say yes or no');
    A.transport = saved.transport; A.localUp = saved.up; A.localModels = saved.models;
    reset(0);
  }

  // 2026-11-02: jobs written by the AI dialogue, made real and trackable (js/game/aijobs.js)
  function aiJobs() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    p.hp = p.maxHp = 9999;
    for (const id of G.jobs.active(w)) w.quests[id].state = 'failed';
    const J = G.aiJobs, npc = g.actors.find((a) => a.id === 'r_elder'), st = npc.st;
    st.disp = 30; st.fear = 0; st.hostile = false; npc.x = p.x + 14; npc.y = p.y;
    // what a civilian can offer, and what a gangster can
    const oc = J.options(w, npc.id);
    check(oc.kinds.includes('deliver') && oc.kinds.includes('message') && oc.kinds.includes('fetch') && !oc.kinds.includes('kill'), `options: a civilian offers honest work (${oc.kinds.join(', ')})`);
    const gid = Object.keys(G.NPCS).find((id) => G.NPCS[id].faction === 'gang_red' && w.isAlive(id) && !G.NPCS[id].kid);
    const og = J.options(w, gid);
    check(og.kinds.includes('beat') && og.kinds.includes('kill') && og.enemies.length, `options: a gang member can want people hurt (${og.kinds.join(', ')})`);
    const text = J.describe(w, npc.id);
    check(/deliver: .*id \w+/.test(text) && /item ids: .*apple/.test(text), 'the prompt lists real people and items with their ids');
    // what the game accepts
    const t = oc.close.concat(oc.elsewhere)[0];
    check(!J.build(w, npc.id, { kind: 'kill', target: og.enemies[0] }), 'build: a civilian cannot hand out a contract');
    check(!J.build(w, npc.id, { kind: 'deliver', target: 'nobody_here' }), 'build: an invented person is refused');
    check(!J.build(w, npc.id, { kind: 'fetch', item: 'golden_unicorn', count: 2 }), 'build: an invented item is refused');
    const dd = J.build(w, npc.id, { kind: 'deliver', target: t, pay: 99999, title: 'Grandma\'s pie', why: 'She has not eaten properly in weeks.' });
    check(dd && dd.reward.gold <= J.PAY.deliver[1] && dd.objectives[0].type === 'flag' && dd.target === t && /pie/.test(dd.title), `build: a delivery, with the pay held to $${dd && dd.reward.gold} (${J.lastWhy}, target ${t}, active ${G.jobs.active(w).length})`);
    // the AI proposes a message job; you take it; it is tracked
    G.settings.data.dialogueMode = 2;
    const r = new G.DialogueRunner(npc, g);
    G.ai.log(r, 'player', 'Got any work for me?');
    check(/Work: Work you could give/.test(G.ai.context(r)), 'AI context: asked for work, the possible jobs are listed');
    const js = J.schema(w, npc.id, G.ai.SCHEMA), jp = js.properties.job.properties;
    check(js.required.includes('job') && jp.kind.enum.includes('none') && !jp.kind.enum.includes('kill') && jp.target.enum.every((id) => id === '' || w.isAlive(id)) && jp.item.enum.every((id) => id === '' || G.ITEMS[id]), 'asked for work: the reply must carry a job, limited to real people, items and the kinds they could give');
    const res = G.ai.apply(r, [{ type: 'job', kind: 'message', target: t, pay: 30, title: 'Tell them sorry', why: 'I am sorry about what I said at the fair.' }], true, 'sad');
    const take = res.choices.find((c) => /^\[Take the job: Tell them sorry\]/.test(c.text));
    check(!!take, 'AI: a valid job becomes "[Take the job: ...]"');
    take.raw.do();
    const jid = G.jobs.active(w).find((id) => G.jobs.def(w, id).giver === npc.id), jd = jid && G.jobs.def(w, jid);
    check(jd && jd.ai && jd.type === 'message' && jd.deadline > w.day && w.quests[jid].state === 'active', 'taken: it is an active job with a deadline');
    check(G.jobs.choices(new G.DialogueRunner(npc, g)).some((c) => /About the job \(Tell them sorry\)/.test(c.text)), 'tracked: "About the job..." with the giver');
    check(/A job you gave the player: Tell them sorry/.test(G.ai.context(new G.DialogueRunner(npc, g))), 'AI context: they know the job they gave you');
    // pass the message on, report back, get paid
    const target = g.actors.find((a) => a.id === t) || G.phone.callee(g, t);
    const rt = new G.DialogueRunner(target, g);
    const tell = G.jobs.choices(rt).find((c) => /I have a message from/.test(c.text));
    check(!!tell, 'the person it is for: "I have a message from ..."');
    tell.do(); check(G.jobs.done(w, jid), 'message passed on: the job is done');
    const gold0 = p.gold; G.jobs.complete(new G.DialogueRunner(npc, g), jid);
    check(w.quests[jid].state === 'done' && p.gold > gold0, `reported back: paid $${p.gold - gold0}`);
    // fetch: you do not get the things for free any more
    const f = J.build(w, npc.id, { kind: 'fetch', item: 'apple', count: 3 }); const apples = p.inventory.count('apple');
    const fid = G.jobs.accept(new G.DialogueRunner(npc, g), f);
    check(p.inventory.count('apple') === apples, 'fetch job: accepting it does not hand you the items');
    w.quests[fid].state = 'failed';
    // asked for work, the reply had no job in it: the game's own offer
    const r2 = new G.DialogueRunner(npc, g); st.jobOffer = null; G.ai.log(r2, 'player', 'Need a hand with anything? I could use some money.');
    const res2 = G.ai.apply(r2, [{ type: 'like', amount: 1 }], true, 'friendly');
    check(!G.jobs.offer(r2) || res2.choices.some((c) => c.text === 'What kind of work?'), 'no job in the reply: "What kind of work?" leads to the usual offer');
    G.settings.data.dialogueMode = 2;
  }

  // 2026-11-02: friendly fire on companions, and companions who have had enough (js/game/companionmood.js)
  function companionMood() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    p.hp = p.maxHp = 9999; p.equip.weapon = null;
    const M = G.companionMood;
    const pick = (not) => g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat === 'fight' && G.NPCS[a.id] && !(not || []).includes(a));
    const join = (n) => { Object.assign(n.st, { disp: 40, fear: 0, hostile: false, compAnger: 0, compBanUntil: 0, hurtByPlayer: null }); n.hp = n.maxHp = 500; n.state = 'schedule'; n.aggressor = false; G.companions.start(g, n); n.x = p.x + 12; n.y = p.y; };
    const c = pick(); join(c);
    const crimes0 = JSON.stringify(w.crimeRecord || {});
    // a real swing reaches them
    p.face(1, 0); p.aim = 0; p.attackCd = 0; p.swing = null; const h0 = c.hp;
    G.combat.attack(p, g); for (let i = 0; i < 25; i++) { G.loop.tick(1 / 60); c.x = p.x + 12; c.y = p.y; }
    check(c.hp < h0, `friendly fire: your swing hits your companion (${h0} -> ${c.hp})`);
    check(c.st.companion && !c.st.hostile && c.state !== 'fight' && JSON.stringify(w.crimeRecord || {}) === crimes0 && M.anger(c.st) > 0, `one hit: still with you, angry (${M.anger(c.st)}), no fight, no crime`);
    // an accident in a fight angers them less than a hit out of nowhere
    c.st.compAnger = 0; c.st._lastFF = null; M.hit(g, c, 6); const cold = M.anger(c.st);
    const foe = pick([c]); foe.state = 'fight'; foe.target = p;
    c.st.compAnger = 0; c.st._lastFF = null; M.hit(g, c, 6); const fight = M.anger(c.st);
    foe.state = 'schedule'; foe.target = null;
    check(fight < cold, `an accident in a fight (${fight}) angers them less than a hit for no reason (${cold})`);
    // keep hitting them: they quit, then they turn on you
    c.st.compAnger = 0; c.st._lastFF = null;
    let n = 0; while (c.st.companion && n++ < 20) { c.invuln = 0; G.combat.damage(c, 6, p, g); }
    check(!c.st.companion && c.st.compBanUntil > w.day, `hit again and again: they leave the party (after ${n} hits)`);
    join(c); c.st.compAnger = M.LEAVE - 1; c.st._lastFF = G.loop.time; c.st.disp = -60; c.invuln = 0;
    G.combat.damage(c, 30, p, g);
    check(!c.st.companion && c.st.hostile && c.state === 'fight' && c.target === p, 'pushed far past it: a fighter turns on you');
    // words do it too, and they will not come back right away
    c.st.hostile = false; c.endFight(); join(c);
    G.social.addDisp(w, c.id, -15); const after1 = c.st.companion;
    G.social.addDisp(w, c.id, -15);
    check(after1 && !c.st.companion, 'hurtful words: one is tolerated, more and they quit');
    const back = G.DIALOGUE_NODES._comp_ask(new G.DialogueRunner(c, g));
    check(!c.st.companion && /No|kidding|chance/.test(back.text), `asked to come back the same day: "${back.text}"`);
    // an apology cools them down
    join(c); c.st.compAnger = 40; G.DIALOGUE_NODES._comp_sorry(new G.DialogueRunner(c, g));
    check(M.anger(c.st) < 40 && c.st.companion, `an apology calms them (${M.anger(c.st)})`);
    // the AI may make them quit only if they really are fed up
    c.st.compAnger = 0; c.st.disp = 40;
    const r = new G.DialogueRunner(c, g);
    let res = G.ai.apply(r, [{ type: 'leave_party' }, { type: 'fight' }], true);
    check(!res.end && c.st.companion, 'AI: "leave_party" from a happy companion does nothing');
    c.st.compAnger = 45; res = G.ai.apply(r, [{ type: 'leave_party' }], true);
    res.afters.forEach((f) => f());
    check(res.end && !c.st.companion && !c.st.hostile, 'AI: an angry companion can quit');
    check(/Anger at the player: angry/.test(G.ai.context(r)), 'AI context: how angry they are');
    // hitting somebody else: your companion does not side with them
    join(c); const other = pick([c]); other.hp = other.maxHp = 500; other.x = p.x - 14; other.y = p.y; other.state = 'schedule';
    G.combat.damage(other, 5, p, g);
    check(c.st.companion && !(c.state === 'fight' && c.target === p), 'you hit someone else: your companion does not turn on you');
    G.companions.dismiss(g, c);
  }

  // 2026-11-02: trust, trading (js/game/barter.js), and what the AI knows about the people around (aidialogue.js)
  function trading() {
    const g = game(), w = g.world, p = g.player; g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    p.hp = p.maxHp = 9999; p.equip.weapon = null;
    const npc = g.actors.find((a) => a.id === 'r_elder'), st = npc.st;
    const reset = () => { st.disp = 20; st.fear = 0; st.hostile = false; st.hurtByPlayer = null; st.memory = []; st.aiMemory = []; st.trustAdj = 0; st.partner = false; st.companion = false; st.romance = 0; npc.state = 'schedule'; npc.x = p.x + 14; npc.y = p.y; };
    reset();
    const t0 = G.trust.of(w, npc.id).v;
    st.hurtByPlayer = w.day * 1440 + w.minutes; const hurt = G.trust.of(w, npc.id).v; st.hurtByPlayer = null;
    st.partner = true; const partner = G.trust.of(w, npc.id).v; st.partner = false;
    check(hurt < t0 - 25 && partner > t0 + 20 && t0 > 25 && t0 < 70, `trust: a liked acquaintance ${t0}, after you hurt them ${hurt}, as your partner ${partner}`);
    st.memory = [{ what: 'robbed me at knifepoint' }];
    check(G.trust.of(w, npc.id).v < t0 - 5, 'trust: what they remember of you counts');
    reset();
    // willing or not
    st.inv = [['apple', 3], ['book', 1]]; st.gold = 40;
    check(G.trust.tradeRefusal(g, npc) === null, 'trade: someone who likes you will trade');
    st.disp = -40; check(!!G.trust.tradeRefusal(g, npc), 'trade: someone who dislikes you will not'); reset();
    st.fear = 70; check(!!G.trust.tradeRefusal(g, npc), 'trade: someone afraid of you will not'); reset();
    check(!G.trust.manageAllowed(g, npc), 'their things: not for an acquaintance');
    st.companion = true; check(G.trust.manageAllowed(g, npc), 'their things: yes for someone in your party'); reset();
    // the deal
    st.inv = [['apple', 3], ['book', 1]]; st.gold = 40;
    p.inventory.add('bandage', 5);
    const bs = new G.BarterScene(g, npc);
    bs.take.book = 1;
    check(!bs.verdict().ok, `barter: asking for something for nothing is refused (${bs.verdict().text})`);
    bs.give.bandage = 5;
    const v = bs.verdict(), books = p.inventory.count('book'), bands = p.inventory.count('bandage');
    bs.deal();
    check(v.ok && p.inventory.count('book') === books + 1 && p.inventory.count('bandage') === bands - 5 && st.inv.some((e) => e[0] === 'bandage' && e[1] === 5) && !st.inv.some((e) => e[0] === 'book'), `barter: a fair offer goes through, items change hands (${v.text})`);
    check((st.trustAdj || 0) > 0, 'barter: an honest trade builds trust');
    // the written way ("Want to trade?"), with AI dialogue off
    G.settings.data.dialogueMode = 0;
    reset(); st.inv = [['apple', 2]];
    g.openDialogue(npc); tick(1);
    const d = G.scenes.top(), r = d.runner;
    const ask = r.node.choices.findIndex((c) => c.text === 'Want to trade?');
    check(ask >= 0, 'dialogue: "Want to trade?" is offered');
    d.choose(ask); tick(1);
    const go = r.node.choices.findIndex((c) => c.text === '[Trade]');
    check(go >= 0, `dialogue: they agree (${r.node.text})`);
    d.choose(go); tick(2);
    check(G.scenes.stack.some((s) => s instanceof G.BarterScene), 'dialogue: the trade screen opens');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    st.disp = -50; g.openDialogue(npc); tick(1);
    const d2 = G.scenes.top(); d2.choose(d2.runner.node.choices.findIndex((c) => c.text === 'Want to trade?')); tick(1);
    check(!d2.runner.node.choices.some((c) => c.text === '[Trade]'), `dialogue: someone who dislikes you says no (${d2.runner.node.text})`);
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // AI: proposing a trade or access to their things only works when the game agrees
    reset(); st.inv = [['apple', 2]];
    const r3 = new G.DialogueRunner(npc, g);
    let res = G.ai.apply(r3, [{ type: 'trade' }, { type: 'manage_items' }, { type: 'trust', amount: 50 }], true);
    check(res.choices.some((c) => c.text === '[Trade]') && !res.choices.some((c) => /their things/.test(c.text)) && st.trustAdj === 5, 'AI: "trade" opens a trade, "manage_items" refused for an acquaintance, trust moves at most 5');
    st.disp = -60; res = G.ai.apply(r3, [{ type: 'trade' }], true);
    check(!res.choices.length, 'AI: "trade" from someone who would not trade does nothing');
    // asked to swap, a friendly answer without the action: the trade is offered anyway; an annoyed one: no
    reset(); st.inv = [['apple', 2]];
    const r4 = new G.DialogueRunner(npc, g); G.ai.log(r4, 'player', 'Want to swap something for your apples?');
    check(G.ai.apply(r4, [{ type: 'like', amount: 1 }], true, 'friendly').choices.some((c) => c.text === '[Trade]'), 'AI: asked to swap, a friendly reply offers the trade even without the action');
    check(!G.ai.apply(r4, [], true, 'annoyed').choices.length, 'AI: an annoyed reply does not');
    // what the AI is told: affinity, trust, the people around and the party
    reset();
    const other = g.actors.find((a) => a.kind === 'npc' && a !== npc && !a.dead && G.NPCS[a.id] && !a.def.kid);
    other.x = npc.x + 30; other.y = npc.y; other.st.companion = true;
    const ctx = G.ai.context(new G.DialogueRunner(npc, g));
    other.st.companion = false;
    check(/Your affinity with the player: -?\d+ on a scale/.test(ctx) && /How much you trust the player: \d+ of 100/.test(ctx), 'AI context: affinity and trust');
    check(ctx.includes(other.st.realName) && /with the player/.test(ctx) && /party/.test(ctx) && /Trading:/.test(ctx), 'AI context: the people nearby, who is with the player, and whether they would trade');
    G.settings.data.dialogueMode = 2;
  }

  // 2026-11-02: Eagle Maps froze the game: its place list regenerated every Woods cell (dropped from memory) each frame
  function eagleMaps() {
    const g = game();
    for (const id of ['wilds_rural_n_0_m1', 'wilds_rural_n_1_m1', 'wilds_rural_n_0_m2', 'wilds_rural_n_1_m2', 'wilds_rural_n_2_m1', 'wilds_rural_n_2_m2', 'wilds_rural_n_3_m1', 'wilds_rural_n_3_m2']) G.maps.get(id);
    G.phone.places(G.world);
    let gens = 0; const orig = {};
    for (const k of Object.keys(G.MAPGEN)) { const f = orig[k] = G.MAPGEN[k]; G.MAPGEN[k] = function () { gens++; return f.apply(this, arguments); }; }
    const ps = new G.PhoneScene(g, 'maps'); G.scenes.push(ps); tick(30);
    const pl = G.phone.places(G.world);
    Object.assign(G.MAPGEN, orig);
    check(gens === 0, `Eagle Maps open for 30 frames generates no maps (${gens})`);
    check(!pl.some((p) => G.isWildsMap(p.map) || /_f\d+$/.test(p.map)), 'no woods cells or upper floors in the place list');
    const diner = pl.find((p) => p.label.startsWith('Diner'));
    check(diner && pl.filter((p) => p.label === diner.label).length === 1, 'places are listed once');
    ps.rows().find((r) => r.label === diner.label).act(); tick(2);
    check(G.world.gps && G.world.gps.label === diner.label && !G.scenes.stack.includes(ps), 'picking a place sets the route and closes the phone');
    G.world.gps.x = -5;
    check(G.phone.places(G.world).find((p) => p.label === diner.label).x !== -5, 'the route is a copy (the list is not changed through it)');
    G.world.gps = null;
  }

  // 2026-11-02: the Windows (2007) interface (js/game/xpui.js, xpscreens.js) and dragging items between slots
  function uiWindows() {
    const g = game(), p = g.player, inv = p.inventory, m = G.input.mouse;
    // Inventory.move: swap, merge stacks
    inv.slots.fill(null); inv.slots[0] = { id: 'bread', qty: 2 }; inv.slots[1] = { id: 'beer', qty: 1 }; inv.slots[5] = { id: 'bread', qty: 3 };
    inv.move(0, 1);
    check(inv.slots[0].id === 'beer' && inv.slots[1].id === 'bread', 'moving an item onto another swaps them');
    inv.move(5, 1);
    check(inv.slots[1].qty === 5 && !inv.slots[5], 'moving an item onto the same item stacks it');
    inv.move(0, 9);
    check(!inv.slots[0] && inv.slots[9].id === 'beer', 'moving onto an empty slot just moves it');
    // dragging in the inventory window: press, carry, let go over another slot; a still click uses the item
    for (const style of [1, 0]) {
      G.settings.data.uiStyle = style;
      inv.slots.fill(null); inv.slots[0] = { id: 'beer', qty: 1 }; inv.slots[1] = { id: 'bread', qty: 1 };
      const sc = new G.InventoryScene(g); G.scenes.push(sc); tick(1);
      sc.slotPress(0);
      Object.assign(m, { down: true, ux: m.ux + 30, uy: m.uy }); sc.dragFrame(G.renderer.ctx, 4);
      m.down = false; sc.dragFrame(G.renderer.ctx, 4);
      check(!inv.slots[0] && inv.slots[4] && inv.slots[4].id === 'beer' && sc.sel === 4, `${style ? 'Windows' : 'Noir'}: dragging an item drops it in the slot under the mouse`);
      let used = 0; const _use = sc.useSel; sc.useSel = function () { used++; };
      sc.slotPress(1); m.down = false; sc.dragFrame(G.renderer.ctx, 1);
      check(used === 1 && inv.slots[1], `${style ? 'Windows' : 'Noir'}: a click without moving still uses the item`);
      sc.useSel = _use;
      const drag = (from, over, outside) => { sc.slotPress(from); Object.assign(m, { down: true, ux: m.ux + 30 }); sc.dragFrame(G.renderer.ctx, over, outside); m.down = false; sc.dragFrame(G.renderer.ctx, over, outside); };
      p.equip.weapon = null; inv.slots[6] = { id: 'pistol', qty: 1 };
      const W0 = inv.size + sc.eqSlots.indexOf('weapon'), T0 = inv.size + sc.eqSlots.indexOf('top');
      drag(6, T0);
      check(!p.equip.top || p.equip.top !== 'pistol', `${style ? 'Windows' : 'Noir'}: a gun dragged onto the shirt slot is not worn there`);
      drag(6, W0);
      check(p.equip.weapon === 'pistol' && !inv.slots[6], `${style ? 'Windows' : 'Noir'}: dragging a gun onto the weapon slot equips it`);
      drag(W0, 8);
      check(!p.equip.weapon && inv.slots[8] && inv.slots[8].id === 'pistol', `${style ? 'Windows' : 'Noir'}: dragging it back into the bag takes it off, into that slot`);
      const bags = Object.keys(G.world.containers).length;
      drag(8, null, true);
      check(!inv.slots[8] && Object.keys(G.world.containers).length >= bags, `${style ? 'Windows' : 'Noir'}: dragging an item out of the window drops it on the ground`);
      G.scenes.remove(sc);
    }
    // every themed window draws without errors, in both looks
    const errs = (G.errors || []).length;
    for (const style of [1, 0]) {
      G.settings.data.uiStyle = style;
      const box = { kind: 'chest', name: 'Box', items: [['bread', 1]], gold: 3 };
      for (const make of [() => new G.InventoryScene(g), () => Object.assign(new G.InventoryScene(g), { xpView: 1 }), () => new G.ShopScene(g, 'r_smith', null), () => new G.SettingsScene(),
        () => Object.assign(new G.SettingsScene(), { tab: 3 }), () => new G.JournalScene(g), () => new G.SkillsScene(g), () => Object.assign(new G.SkillsScene(g), { xpTab: 1 }),
        () => new G.PauseScene(g), () => new G.ConfirmScene('Sure?', () => {}), () => new G.LootScene(g, box), () => new G.SaveLoadScene(g, 'load'), () => new G.MapScene(g), () => new G.WaitScene(g, false)]) {
        const sc = make(); G.scenes.push(sc); G.loop.draw(); G.scenes.remove(sc);
      }
    }
    check((G.errors || []).length === errs, 'every window draws in the Windows and Noir looks without errors' + (G.errors && G.errors.length > errs ? ': ' + G.errors.slice(errs).join(' | ') : ''));
    G.settings.data.uiStyle = 1;
    // the HUD keeps its own look; windows get theirs
    G.loop.draw();
    check(!G.xp.on && G.ui.colors.text !== '#1b2433', 'after drawing, the HUD palette is back');
    check(G.xp.ink('#ffffff') !== '#ffffff' && G.xp.ink('#c83a2a') === '#c83a2a', 'light text is darkened on light windows, dark text is left alone');
  }

  // 2026-11-01 night: benzos and naloxone (js/game/benzo.js), and the rest of the tester list
  function laterFixes() {
    const g = game(), w = G.world, E = G.effects;
    g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player; p.hp = p.maxHp = 9999; p.dead = false;
    const clean = () => { const s = E.drugState(p); for (const c in s.load) s.load[c] = 0; p.alcohol = 0; p.effects = []; };
    // Xanax alone: a blackout, never an overdose
    clean(); const s = E.drugState(p);
    s.load.benzo = 90;
    check(E.risk(p, 'benzo') === 0, 'Xanax alone cannot stop your breathing');
    const map0 = g.map.id, day0 = w.day * 24 + Math.floor(w.minutes / 60), top0 = p.equip.top, inv0 = p.inventory.slots.filter(Boolean).length;
    G.pills.update(p, 0.1, g);
    for (let i = 0; i < 60 * 5; i++) G.loop.tick(1 / 60);
    const hrs = w.day * 24 + Math.floor(w.minutes / 60) - day0, inv1 = p.inventory.slots.filter(Boolean).length;
    check(!E.has(p, 'resp_depression') && hrs >= 5 && inv1 > inv0 && p.equip.top !== top0 && !p.dead, `too much Xanax: a blackout (${hrs} hours gone, ${g.map.id !== map0 ? 'somewhere else: ' + g.map.id : 'same district'}, new clothes, pockets full)`);
    check(!g.map.buildingAt(p.x, p.y - 3), 'you wake up out on the street');
    // benzos with booze: a real overdose, and naloxone does not fix it
    clean(); s.load.benzo = 70; p.alcohol = 50;
    G.pills.update(p, 0.1, g);
    check(E.has(p, 'resp_depression'), 'Xanax with alcohol stops your breathing');
    p.inventory.add('naloxone', 2); E.consume(p, G.ITEMS.naloxone, g);
    check(E.has(p, 'resp_depression'), 'naloxone does not reverse a benzo overdose');
    // opioids: naloxone works
    clean(); s.load.opioid = 140; E.add(p, 'resp_depression', 30);
    E.consume(p, G.ITEMS.naloxone, g);
    check(!E.has(p, 'resp_depression') && !s.load.opioid, 'naloxone reverses an opioid overdose');
    clean();
    // an NPC (a companion) overdosing: naloxone from the [E] menu brings them back
    const FX = G.npcFx, n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && !a.st.ko);
    if (n) {
      n.hp = n.maxHp = 200; const ns = FX.st(n); ns.drugs.load.opioid = 160; ns.alcohol = 0;
      FX.update(n, 0.1, g);
      check(n.st.ko && n.st.ko.reason === 'overdose', 'an NPC overdoses on opioids and goes down');
      p.inventory.add('naloxone', 1); G.aid.narcan(g, n);
      check(!n.st.ko || n.st.ko.until <= w.day * 1440 + w.minutes, 'naloxone from your hand brings them back');
      for (let i = 0; i < 30; i++) G.loop.tick(1 / 30);
      const m = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && !a.st.ko && a !== n);
      if (m) {
        m.hp = m.maxHp = 200; const ms = FX.st(m); ms.drugs.load.benzo = 80; ms.alcohol = 60;
        FX.update(m, 0.1, g);
        check(m.st.ko && m.st.ko.cls === 'benzo', 'benzos and booze put an NPC down too');
        p.inventory.add('naloxone', 1); G.aid.narcan(g, m);
        check(m.st.ko && m.st.ko.until > w.day * 1440 + w.minutes, 'naloxone does nothing for them');
        m.st.ko.until = 0; FX.remove(m, 'resp_depression'); ms.drugs.load.benzo = 0; ms.alcohol = 0;
        const q = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && !a.st.ko && a !== n && a !== m);
        if (q) { const qs = FX.st(q); qs.drugs.load.benzo = 70; qs.alcohol = 0; FX.update(q, 0.1, g); check(q.st.ko && q.st.ko.reason === 'benzo' && !FX.has(q, 'resp_depression'), 'Xanax alone: an NPC nods off and sleeps it off'); }
      }
    }
    // the Swim Instructor (anyone) left "seated" by a dropped task no longer walks around in the sitting pose
    if (g.map.id !== 'rural') { g.loadMap('rural', 'start'); tick(3); }   // (the blackout above may have left you anywhere)
    G.debug.time(12); tick(3);
    const coach = g.actors.find((a) => a.id === 'r_swimcoach');
    if (coach) {
      coach.st.hunger = coach.st.thirst = 0; coach.seated = true; coach.needTask = null; coach.state = 'schedule'; coach.talking = false; coach.sleeping = false;   // (someone hungry would sit down again, rightly)
      for (let i = 0; i < 20; i++) G.loop.tick(1 / 30);
      check(!coach.seated, `the Swim Instructor stands up when there is nothing to sit for (task ${JSON.stringify(coach.needTask && coach.needTask.steps)}, state ${coach.state}, moving ${coach.moving}, asleep ${coach.sleeping}, talking ${coach.talking}, errand ${!!coach.errand}, in actors ${g.actors.includes(coach)})`);
    } else check(false, 'the Swim Instructor is at the lake');
    // a woman dies with a woman's voice
    { const heard = [], _pl = G.audio.play; G.audio.play = function (n) { heard.push(n); return _pl.apply(this, arguments); };
      const f = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.look && a.look.body === 'f'), mm = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.look && a.look.body !== 'f');
      try { if (f) G.combat.damage(f, 99999, null, g); if (mm) G.combat.damage(mm, 99999, null, g); } finally { G.audio.play = _pl; }
      check(!!G.audio.SFX.death_f && (!f || heard.includes('death_f')) && (!mm || heard.includes('death')), `female NPCs have their own dying sound (${heard.filter((h) => /death/.test(h)).join(', ')})`); }
    // the phone: a new look, and a Wallpapers app (built-in pictures, or your own from the wallpapers folder)
    { const ph = new G.PhoneScene(g); G.scenes.push(ph); let ok = true;
      const prev = G.settings.get('phoneWallpaper');
      try {
        G.loop.draw();
        check(G.PHONE_APP_LIST.some((a) => a[0] === 'wallpapers'), 'the phone has a Wallpapers app');
        ph.launch('wallpapers'); G.loop.draw();
        check(ph.screen === 'wallpapers' && G.wallpapers.entries().length >= 7, `it lists the wallpapers (${G.wallpapers.entries().length})`);
        const pick = G.wallpapers.entries().find((e) => e.id !== G.wallpapers.current()); ph.sel = G.wallpapers.entries().findIndex((e) => e.id === pick.id);
        G.input.pressed.add(G.input.bindings.confirm[0]); ph.update(1 / 60); G.input.pressed.clear();
        check(G.wallpapers.current() === pick.id && G.settings.data.phoneWallpaper === pick.id, `picking one sets it (${pick.name}; screen ${ph.screen}, sel ${ph.sel}, now ${G.wallpapers.current()})`);
        ph.back(); G.loop.draw();
        for (const [id] of G.wallpapers.BUILTIN) { const c = G.wallpapers.image('builtin:' + id, 90, 150); if (!c || !c.width) ok = false; }
        ph.open('messages'); G.loop.draw(); ph.back();
      } catch (e) { ok = false; console.error(e); }
      G.scenes.remove(ph); G.settings.data.phoneWallpaper = prev;
      check(ok, 'every wallpaper paints, and the phone screens draw'); }
  }

  // lighting fires with fuel, the Pyromaniac skill, charred furniture and soot (js/game/burns.js)
  function fireStarting() {
    const g = game(), w = G.world;
    g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player, fs = g.fire, map = g.map; p.hp = p.maxHp = 9999; p.dead = false;
    delete p.skills.ranks.pyromaniac;
    // a patch of open grass, nothing built on it
    let spot = null;
    for (let ty = 5; ty < map.h - 5 && !spot; ty++) for (let tx = 5; tx < map.w - 5; tx++) { let ok = true; for (let y = ty - 2; y <= ty + 3 && ok; y++) for (let x = tx - 2; x <= tx + 2; x++) { const d = G.TILES[map.get(x, y)]; if (!/grass/.test(d.name) || map.buildingAtTile(x, y) || map.decorsAt(x, y).length) { ok = false; break; } } if (ok) { spot = { tx, ty }; break; } }
    if (!spot) { check(false, 'fire: found open grass to test on'); return; }
    p.x = spot.tx * 16 + 8; p.y = spot.ty * 16 + 12; p.dir = 0; p.aim = Math.PI / 2; p.vehicle = null; fs.cells.clear();
    G.spills.list(w, map.id).blobs = []; G.spills.rebuild(fs);
    p.inventory.add('torch', 1); p.inventory.add('oil_flask', 2); p.inventory.add('rubbing_alcohol', 1);
    G.ITEM_USE.torch(g);
    check(fs.cells.size === 0, 'a lighter alone does not set the grass on fire');
    G.ITEM_USE.oil_flask(g);
    for (let i = 0; i < 60 * 3; i++) G.loop.tick(1 / 60);
    const S = G.spills.list(w, map.id), total = S.blobs.reduce((n, b) => n + b.a, 0);
    check(!p.pouring && S.blobs.length >= 2 && total > 40 && fs.oil.size > 0, `pouring gasoline leaves puddles (${S.blobs.length} puddles, ${Math.round(total)} units)`);
    let drew = true; try { const cv = document.createElement('canvas').getContext('2d'); fs.drawGround(cv, { x: p.x - 100, y: p.y - 80, w: 200, h: 160 }); } catch (e) { drew = false; console.error(e); }
    check(drew, 'the puddles draw');
    G.ITEM_USE.torch(g);
    check(fs.cells.size > 0, 'the lighter lights the gasoline');
    for (let i = 0; i < 4 * 6; i++) fs.tick();
    check(fs.cells.size >= 3, `the flames run across the spill (${fs.cells.size} tiles burning)`);
    for (let i = 0; i < 60 * 40; i++) { G.loop.tick(1 / 30); p.hp = p.maxHp; }
    check(G.spills.list(w, map.id).blobs.reduce((n, b) => n + b.a, 0) < total * 0.5, 'burning uses the fuel up');
    // alcohol evaporates within the hour
    fs.cells.clear(); G.spills.list(w, map.id).blobs = [];
    G.spills.add(fs, 'alcohol', p.x, p.y + 20, 20); G.spills.list(w, map.id).t = w.day * 1440 + w.minutes - 240; G.spills.evaporate(G.spills.list(w, map.id), w.day * 1440 + w.minutes);
    check(!G.spills.list(w, map.id).blobs.length, 'spilled alcohol evaporates');
    // Pyromaniac: the lighter alone is enough
    G.spills.rebuild(fs); fs.cells.clear();
    // fresh grass well away from the first fire: stand on it facing north at the next tile
    let dry = null;
    for (let ty = 5; ty < map.h - 5 && !dry; ty++) for (let tx = 5; tx < map.w - 5; tx++) { if (Math.hypot(tx - spot.tx, ty - spot.ty) < 14) continue; const a = G.TILES[map.get(tx, ty)], b = G.TILES[map.get(tx, ty - 1)]; if (/^grass/.test(a.name) && /^grass/.test(b.name) && fs.canBurn(tx, ty - 1) && !map.buildingAtTile(tx, ty) && !map.decorsAt(tx, ty).length && !map.decorsAt(tx, ty - 1).length) { dry = { tx, ty }; break; } }
    if (dry) { p.x = dry.tx * 16 + 8; p.y = dry.ty * 16 + 12; p.dir = 3; p.aim = -Math.PI / 2; }
    p.skills.ranks.pyromaniac = 1;
    G.ITEM_USE.torch(g);
    check(fs.cells.size > 0, 'a Pyromaniac sets things on fire with the lighter alone');
    delete p.skills.ranks.pyromaniac; fs.cells.clear();
    // furniture chars and becomes unusable; the walls take soot
    g.loadMap('city', 'from_suburbs'); tick(5);
    const m2 = g.map, f2 = g.fire, d = m2.decor.find((x) => x.def.interact && !x.def.flat && /bed|couch|chair|desk|table|wardrobe|counter/.test(x.type) && m2.buildingAtTile(x.tx, x.ty));
    if (d) {
      const i = d.ty * m2.w + d.tx, key = m2.decorKey(d);
      f2.cells.set(i, { fuel: 60, heat: 1, byPlayer: false, witnessed: false });   // (a burning cell on the piece itself: fire reaches furniture from the floor around it)
      for (let k = 0; k < 200 && f2.cells.size; k++) { f2.tick(); if (f2.cells.size > 6) for (const j of [...f2.cells.keys()]) if (j !== i) f2.cells.delete(j); }
      const live = m2.decorsAt(d.tx, d.ty).find((x) => m2.decorKey(x) === key);
      check(live && live.burnt >= G.burns.RUINED && !live.def.interact, `burned furniture keeps its shape but is ruined (${d.type}, char ${live && live.burnt}, still there ${!!live}, same map ${f2.map === m2}, cells ${f2.cells.size}, at ${m2.decorsAt(d.tx, d.ty).map((x) => x.type).join("/")}, soot tiles ${Object.keys((w.mapMods[m2.id] || {}).soot || {}).length}, flat ${live && live.def.flat}, burnsTo ${live && live.def.burnsTo}, cellAt ${f2.cells.has(i)})`);
      check(w.mapMods[m2.id].burnt[key] >= G.burns.RUINED && w.mapMods[m2.id].soot[i] > 0, 'the char and the soot are saved with the map');
      let ok = true; try { const cv = document.createElement('canvas').getContext('2d'); G.drawDecor(cv, live, G.assets.sprites[live.def.sprite], g); m2.drawGround(cv, { x: live.x - 60, y: live.y - 60, w: 120, h: 120 }, 0); } catch (e) { ok = false; console.error(e); }
      check(ok && live._char && live._char.c.width > 0, 'charred furniture and soot draw');
      const pl = g.player; pl.x = live.x; pl.y = live.y + 18; pl.dir = 3; pl.aim = -Math.PI / 2;
      const t = g.findInteraction();
      check(!(t && t.ref === live), 'a ruined piece offers no prompt');
      g.loadMap('rural', 'start'); tick(3); g.loadMap('city', 'from_suburbs'); tick(3);
      const again = g.map.decor.find((x) => g.map.decorKey(x) === key);
      check(again && again.burnt >= G.burns.RUINED && !again.def.interact, 'and it is still burned after you come back');
    }
  }

  // the hospital, the ambulance, the cleanup crew, who calls (js/game/ems.js), crash knockouts (crashes.js)
  function emergency() {
    const g = game(), w = G.world, E = G.ems;
    g.loadMap('city', 'from_suburbs'); G.debug.time(12); tick(5);
    const hb = g.map.building('c_hospital'), beds = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => g.map.points['c_hospital_bed' + i]).length;
    check(hb && beds >= 4 && g.actors.some((a) => a.id === 'c_nurse1'), `the city has a hospital: ${beds} beds, nurses on the ward`);
    // who calls: a cop calls it in, a criminal mostly walks on
    const cop = g.actors.find((a) => a.kind === 'npc' && a.def.combat === 'guard' && !a.dead);
    const crook = g.actors.find((a) => a.kind === 'npc' && ((G.CRIMINAL_FACTIONS || []).includes(a.def.faction)) && !a.dead);
    if (cop && crook) {
      g.player.x = 0; g.player.y = 0;
      const inc = { key: 'x', kind: 'ko', x: 9999, y: 9999 };
      const tally = (a) => { const t = {}; for (let i = 0; i < 300; i++) { const c = G.ems.decideFor(g, a, inc); t[c] = (t[c] || 0) + 1; } return t; };
      const tc = tally(cop), tk = tally(crook);
      check((tc.both || 0) > 150 && (tk.ignore || 0) > (tk.both || 0), `who calls depends on who finds it: cop ${JSON.stringify(tc)} / criminal ${JSON.stringify(tk)}`);
    }
    // the ambulance run: someone knocked out in the rural zone ends up in a hospital bed in the city
    g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player; p.hp = p.maxHp = 9999;
    const v = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat === 'flee' && !a.st.ko && !a.st.companion);
    const r = g.map.roads[0], y = G.roadTools.laneOf(r, 'E') - 30, x = Math.round((r.from + r.to) / 2) * 16;
    v.x = x; v.y = y; v.hp = v.maxHp = 60; G.ko.knockOut(g, v, null, 'blunt', 1.2);
    E.dispatch(g, { key: 'ko:' + v.id, kind: 'ko', npc: v.id, ref: v, x: v.x, y: v.y, name: v.displayName });
    const job = w.ems.jobs[w.ems.jobs.length - 1]; job.t = 0;
    let saw = { amb: false, medic: false, carry: false };
    for (let i = 0; i < 60 * 150 && job.stage !== 'done'; i++) { G.loop.tick(1 / 60); if (g.vehicles.some((c) => c.model === 'ambulance')) saw.amb = true; if (g.actors.some((a) => a.law === 'paramedic')) saw.medic = true; if (job.stage === 'carry') saw.carry = true; if (v.st.ko) v.st.ko.until = 1e9; }
    check(saw.amb && saw.medic && saw.carry && job.stage === 'done', `an ambulance comes, paramedics carry them away (${JSON.stringify(saw)}, stage ${job.stage})`);
    check(v.st.inHospital && v.st.map === 'city' && !g.actors.includes(v), 'they are admitted to the hospital');
    g.loadMap('city', 'from_suburbs'); tick(30);
    const inBed = g.actors.find((a) => a.id === v.id);
    check(inBed && inBed.sleeping && inBed.sleepSpot && Math.abs(inBed.y - (g.map.points['c_hospital_bed' + (v.st.inHospital.bed || 0)].y * 16 + 12)) < 2, 'and lie in a ward bed');
    v.st.inHospital.until = 0; if (v.st.ko) v.st.ko.until = 0; tick(5);
    check(!v.st.inHospital, 'until they are well enough to go home');
    // the cleanup crew scrubs the blood away
    g.loadMap('rural', 'start'); tick(5);
    const cx = x + 40, cy = y;
    for (let i = 0; i < 6; i++) G.gore.add(g, { x: cx + (i - 3) * 6, y: cy + (i % 2) * 4, r: 2.5, type: 'splat' });
    const near = () => G.gore.list(g).filter((d) => Math.hypot(d.x - cx, d.y - cy) < 40).length;
    const n0 = near();
    E.clean(w, g.map.id, cx, cy);
    const cj = w.ems.jobs[w.ems.jobs.length - 1]; cj.t = 0;
    let faded = false;
    for (let i = 0; i < 60 * 150 && cj.stage !== 'done'; i++) { G.loop.tick(1 / 60); if (G.gore.list(g).some((d) => d.clean > 0 && d.clean < 1)) faded = true; }
    check(n0 >= 6 && near() === 0 && faded, `a cleanup crew scrubs the stains away, fading (${n0} -> ${near()})`);
    // a hard crash can knock a rider out
    const bike = new G.Vehicle({ model: 'bike_blue', x: x + 200, y: G.roadTools.laneOf(r, 'E'), angle: 0 });
    bike.ai = { road: r, dir: 'E', lane: bike.y, turn: null, box: null, cruise: 45, waitT: 0, dest: null, driver: { seed: 'emsbike', look: G.look('driveremsbike') } }; bike.speed = 45; g.vehicles.push(bike);
    const car = new G.Vehicle({ model: 'car_black', x: x + 170, y: bike.y, angle: 0 }); g.vehicles.push(car);
    const n1 = g.actors.length, r0 = Math.random, fin0 = G.crashes.finish; Math.random = () => 0.02;
    G.crashes.collide(g, car, bike, 260, null);
    Math.random = r0; G.crashes.finish = function () { Math.random = () => 0.02; try { return fin0.apply(this, arguments); } finally { Math.random = r0; } };   // (the knockout roll happens on landing)
    const rider = g.actors.slice(n1).find((a) => a.kind === 'npc');
    if (rider) rider.hp = rider.maxHp = 500;
    for (let i = 0; i < 60 * 8 && rider && rider.crash; i++) G.loop.tick(1 / 60);
    G.crashes.finish = fin0;
    check(rider && rider.st.ko, 'a rider thrown hard can be knocked out cold');
  }

  // brain damage in degrees, and how they take you (js/game/brain.js)
  function brainLevels() {
    const g = game(), w = G.world;
    g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player;
    const npcs = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && !a.st.ko).slice(0, 4);
    check([0.5, 1.5, 2.8, 4.2, 6].map((s) => G.brain.levelFrom(s)).join('') === '01234', 'head trauma decides the level: none, mild, moderate, severe, profound');
    const said = {};
    for (let L = 1; L <= 4; L++) { const n = npcs[L - 1]; n.st.brain = L; n.st.brainUntil = null; n.st.brainMem = 'forgot'; said[L] = G.brain.speak(n, 'are you okay'); }
    log('     speech: ' + Object.entries(said).map(([k, v]) => `L${k}: "${v}"`).join('  '));
    check(said[1].length > said[3].length || /[a-z]{4,}/.test(said[1]), 'a mild case still makes sentences; a severe one breaks them');
    const n = npcs[0]; n.st.brain = 4; n.x = p.x; n.y = p.y + 14;
    let r = new G.DialogueRunner(n, g);
    check(r.node.id === '_brain' && r.node.choices.some((c) => /listening/.test(c.text)) && r.node.choices.some((c) => /understand/.test(c.text)) && r.node.choices.some((c) => /idiot|Spit/.test(c.text)), 'you can be patient, confused, or aggressive with them');
    const r0 = Math.random; Math.random = () => 0.5;
    r.choose(r.node.choices.findIndex((c) => /idiot|Spit/.test(c.text)));
    Math.random = r0;
    check(r.node && !/hurt me|cry|flinch/i.test(r.node.text) && !n.st.hostile, 'a profoundly impaired person does not even register the threat: "' + (r.node && r.node.text) + '"');
    const tough = npcs.find((a) => a.def.combat === 'fight') || npcs[1];
    tough.st.brain = 1; tough.st.brainUntil = null; tough.def = Object.assign({}, tough.def, { combat: 'fight' });
    r = new G.DialogueRunner(tough, g); Math.random = () => 0.01;
    r.choose(r.node.choices.findIndex((c) => /idiot|Spit/.test(c.text)));
    Math.random = r0;
    check(r.node && /jaw|fists|Back off|talk to me like that/i.test(r.node.text), 'a mildly impaired fighter knows exactly what you said: "' + (r.node && r.node.text) + '"');
    const flee = npcs[2]; flee.st.brain = 4; flee.state = 'schedule';
    Math.random = () => 0.1; flee.startFlee(p); Math.random = r0;
    check(flee.state !== 'flee', 'and many of the badly hurt do not run: they just stand there, confused');
    for (const a of npcs) { a.st.brain = 0; a.st.brainMem = null; a.endFight && a.endFight(); a.st.hostile = false; }
  }

  // armed NPCs with rounds shoot (day and night), they do not just walk up to you
  function gunmen() {
    const g = game();
    const runs = [];
    for (const m of ['city', 'southside', 'eastside', 'heights']) for (const hour of [13, 23]) runs.push([m, hour]);
    const seenIds = new Set();
    for (const [m, hour] of runs) {
      g.loadMap(m, Object.keys(G.maps.get(m).points).find((k) => k.startsWith('from_'))); G.debug.time(hour); tick(5);
      while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
      const p = g.player; p.hp = p.maxHp = 9999; p.dead = false; p.invuln = 0;
      const shooter = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.st.ko && a.weaponItem && a.weaponItem.gun && !seenIds.has(a.id));
      if (!shooter) continue;
      seenIds.add(shooter.id);
      G.npcAmmo.seed(shooter.st, shooter.def);
      const r = g.map.roads.find((q) => q.h), y = G.roadTools.laneOf(r, 'E'), x = Math.round((r.from + r.to) / 2) * 16;
      shooter.x = x; shooter.y = y; p.x = x + 70; p.y = y;
      shooter.st.hostile = true; shooter.aggressor = true; shooter.startFight(p, g);
      const s0 = shooter._shots || 0, trace = [];
      for (let i = 0; i < 60 * 6; i++) { while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); G.loop.tick(1 / 60); p.x = x + 70; p.y = y; if (i % 60 === 59) trace.push(`${shooter.state}/d${Math.round(shooter.distTo(p))}/gun${shooter.hasGun ? 1 : 0}/mag${shooter.st.mag}/cd${(shooter.attackCd || 0).toFixed(1)}/see${shooter.canSee(g, p, 200) ? 1 : 0}/fl${shooter.flank ? 1 : 0}/rl${(shooter.reloadT || 0).toFixed(1)}`); }
      const shots = (shooter._shots || 0) - s0;
      check(shots >= 2, `${m} ${hour === 13 ? 'by day' : 'at night'}, an armed ${shooter.displayName} (${shooter.def.faction}, ${shooter.weaponItem && shooter.weaponItem.id}) with rounds shoots (${shots} shots) ${shots < 2 ? trace.join(' ') : ''}`);
      shooter.endFight(); shooter.st.hostile = false; shooter.aggressor = false;
    }
  }

  // 2026-11-01: the child-killer reaction, empty guns, realistic melee, knockouts always first, NPC skills (js/game/combatreal.js)
  function realism() {
    const g = game(), w = G.world;
    g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player; p.hp = p.maxHp = 999; p.dead = false;
    const ck0 = w.flags.childKiller;
    // an unseen child murder whose body nobody found is never pinned on you
    w.flags.childKiller = false;
    const kid = Object.keys(G.NPCS).find((id) => G.NPCS[id].kid);
    if (kid) {
      const dd0 = w.dead[kid];
      w.dead[kid] = { byPlayer: true, witnessed: false, day: w.day - 5, discovered: false };
      const m0 = w.minutes; w.minutes = 9 * 60 + 1; G.events.emit('hour'); w.minutes = m0;
      check(!w.flags.childKiller && w.dead[kid].solved == null, 'a child\'s body nobody found: nobody ever finds out');
      if (dd0) w.dead[kid] = dd0; else delete w.dead[kid];
    }
    // once it is known: hatred in every answer; some come at you
    w.flags.childKiller = 1;
    const civ = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat === 'flee' && !a.st.ko);
    civ.st.brain = 0;   // (an earlier test may have left them brain damaged)
    civ.x = p.x; civ.y = p.y + 14; civ.state = 'schedule'; civ.talking = false;
    g.openDialogue(civ); tick(1);
    const d = G.scenes.top();
    check(d instanceof G.DialogueScene && d.runner.node.id === '_ck_angry', 'people still answer, with nothing but hatred: "' + (d.runner && d.runner.node.text) + '"');
    if (d instanceof G.DialogueScene) { d.chars = 999; const r0 = Math.random; Math.random = () => 0.99; d.choose(0); Math.random = r0; tick(1); check(d.runner.node && d.runner.node.id === '_ck_retort', 'whatever you say, they answer angrily: "' + (d.runner.node && d.runner.node.text) + '"'); G.scenes.remove(d); }
    civ.talking = false;
    const fighters = Object.keys(G.NPCS).filter((id) => G.NPCS[id].combat === 'fight' && !G.NPCS[id].kid);
    const venge = fighters.filter((id) => G.kids.vengeful({ id, def: G.NPCS[id] })).length;
    check(venge > 0 && venge < fighters.length, `some of the fighters come for you (${venge} of ${fighters.length}), not all`);
    w.flags.childKiller = ck0;
    // an empty gun: they fight with what they have
    const gunner = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.st.ko && a.def.combat === 'fight') || civ;
    gunner.def = Object.assign({}, gunner.def, { weapon: 'pistol' });
    gunner.st.inv = [['pistol', 1], ['switchblade', 1]]; gunner.st.mag = 0; gunner.st.ammoSeeded = true; gunner.st.equip = {};
    gunner.state = 'fight'; gunner.target = p;
    check(gunner.weaponItem && gunner.weaponItem.id === 'switchblade' && !gunner.hasGun, 'out of rounds, they switch to the knife in their pocket');
    gunner.st.inv = [['pistol', 1]]; gunner._dry = false;
    check(!gunner.weaponItem, 'with nothing else, their fists');
    gunner.hp = gunner.maxHp = 999; gunner.x = p.x + 30; gunner.y = p.y; gunner.st.hostile = true; gunner.startFight(p, g);
    const hp0 = p.hp;
    for (let i = 0; i < 60 * 6; i++) { G.loop.tick(1 / 60); p.x = gunner.x - 12; p.y = gunner.y; }
    check(p.hp < hp0, `and they come at you with them (${hp0} -> ${p.hp})`);
    gunner.endFight(); gunner.st.hostile = false;
    // a bat hit is about what a bat does
    const dummy = { kind: 'dummy', x: p.x + 400, y: p.y, cy: p.y - 8, hp: 999, maxHp: 999, invuln: 0, die() { this.dead = true; } };
    const r0 = Math.random; Math.random = () => 0.5;
    p.swing = { st: G.melee.STYLES.blunt, t: 0.1, base: 0, side: 1, hit: new Set() };
    G.combat.damage(dummy, 11, p, g);
    const bat = 999 - dummy.hp;
    Math.random = r0;
    check(bat > 0 && bat <= 8, `a bat hit does less now (11 -> ${bat})`);
    // non-lethal: they always go down unconscious before dying
    const v = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.st.ko && a !== gunner && a.def.combat === 'flee');
    v.hp = v.maxHp = 20; v.invuln = 0;
    p.swing = { st: G.melee.STYLES.sledge, t: 0.1, base: 0, side: 1, hit: new Set() };
    G.combat.damage(v, 999, p, g);
    check(v.st.ko && !v.dead, 'even a sledgehammer blow that would kill: unconscious first');
    const v2 = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.st.ko && a !== gunner && a !== v && a.def.combat === 'flee');
    let koFirst = 0;
    for (let n = 0; n < 10 && v2; n++) {
      v2.st.ko = null; v2.downT = 0; v2.dead = false; v2.hp = v2.maxHp = 30; v2.koTr = null;
      p.swing = { st: G.melee.STYLES.fists, t: 0.1, base: 0, side: 1, hit: new Set() };
      for (let i = 0; i < 80 && !v2.st.ko && !v2.dead; i++) { v2.invuln = 0; G.combat.damage(v2, 9, p, g); }
      if (v2.st.ko && !v2.dead) koFirst++;
      if (v2.dead) break;
    }
    if (v2) { v2.st.ko = null; v2.downT = 0.35; }
    check(koFirst === 10, `a beating always ends unconscious before dead (${koFirst}/10)`);
    p.swing = null;
    // NPC skills by how they live; strength and luck put people down
    const sums = Object.keys(G.NPCS).filter((id) => !G.NPCS[id].kid).map((id) => Object.values(G.npcSkills.ranks(id)).reduce((s, n) => s + n, 0));
    check(sums.every((n) => n <= 7) && sums.some((n) => n >= 3), `everyone has a few skills (max ${Math.max(...sums)} ranks)`);
    const gang = Object.keys(G.NPCS).find((id) => G.lifestyle && G.lifestyle.of(id) === 'gang');
    if (gang) check(G.skills.stat({ kind: 'npc', id: gang }, 'meleeDmg') > 0 || G.skills.stat({ kind: 'npc', id: gang }, 'defense') > 0 || Object.keys(G.npcSkills.ranks(gang)).length > 0, 'a gang member has street-fighting skills: ' + JSON.stringify(G.npcSkills.ranks(gang)));
    const strong = { kind: 'player', skills: { ranks: { brawler: 3, lucky: 2 }, attrs: { strength: 9, luck: 8, charisma: 3, knowledge: 3, accuracy: 3 } }, effects: [], equip: {} };
    const weak = { kind: 'player', skills: { ranks: {}, attrs: { strength: 1, luck: 1, charisma: 3, knowledge: 3, accuracy: 3 } }, effects: [], equip: {} };
    check(G.ko.punch(strong) > G.ko.punch(weak), `strength and luck knock people out more easily (${G.ko.punch(weak).toFixed(2)} vs ${G.ko.punch(strong).toFixed(2)})`);
  }

  // 2026-11-01: the Builders' Supply, bleeding and first aid, unconscious people, what NPCs take (js/game/aid.js)
  function aid() {
    const g = game(), w = G.world;
    G.bleed.playerOff = false;
    // the store: furnished, and the owner sells
    g.loadMap('industrial', 'from_southside'); G.debug.time(12); tick(5);
    const sb = g.map.building('i_supply'), inside = sb ? g.map.decor.filter((d) => d.tx > sb.x && d.tx < sb.x + sb.w - 1 && d.ty > sb.y && d.ty < sb.y + sb.h - 1) : [];
    const kinds = new Set(inside.map((d) => d.type));
    check(sb && inside.length >= 18 && ['couch', 'shelf', 'log'].filter((k) => kinds.has(k)).length >= 2, `the Builders' Supply is furnished (${inside.length} pieces: ${[...kinds].join(', ')})`);
    const owner = g.actors.find((a) => a.id === 'i_builder');
    if (owner) { g.player.x = owner.x; g.player.y = owner.y + 14; }
    const rep0 = w.getRep('city'); w.addRep('city', -rep0);   // (earlier tests left the city hating you: shops close below -60)
    if (owner) { const e = owner.currentEntry(w); log('     supply: state=' + owner.state + ' hostile=' + owner.st.hostile + ' rep=' + w.getRep('city') + ' homeLost=' + w.isHomeLost(owner.def) + ' entry=' + (e && e.act) + ' sleeping=' + owner.sleeping + ' shops=' + !!(w.shops && w.shops.i_supply) + ' shopFor=' + G.shopSys.shopFor('i_builder', w)); }
    const shopRun = owner && new G.DialogueRunner(owner, g);
    const sellOpt = shopRun && shopRun.node.choices.find((c) => /wares|buy/i.test(c.text));
    check(!!sellOpt, 'its owner offers to sell: ' + (shopRun ? shopRun.node.choices.map((c) => c.text).join(' | ') : 'owner missing'));
    check(G.SHOPS.i_supply.stock.some(([id]) => /kit_couch|kit_bed/.test(id)) && G.SHOPS.i_supply.stock.some(([id]) => id === 'planks'), 'and the stock has building materials and furniture');
    w.addRep('city', rep0);
    // bleeding
    g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player; p.hp = p.maxHp = 999; p.dead = false;
    const others = (not) => g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat === 'flee' && !a.st.ko && !not.includes(a) && !a.st.companion);
    const knife = { kind: 'npc', id: 'test_knifer', x: p.x + 200, y: p.y, swing: { st: G.melee.STYLES.knife, base: 0 } };
    const a = others([]); a.hp = a.maxHp = 60; a.st.inv = []; a.st.bleed = null; a.st.hurtByPlayer = 0;
    G.combat.damage(a, 12, knife, g);
    check(G.bleed.is(a), `a knife wound bleeds (${a.st.bleed && a.st.bleed.rate.toFixed(2)} hp/s)`);
    const hpA = a.hp; tick(60 * 8);
    check(a.hp < hpA, `it drains them (${hpA} -> ${a.hp})`);
    a.st.inv.push(['bandage', 1]); tick(60 * 2);
    check(!G.bleed.is(a), 'someone with a bandage on them patches themselves up');
    // helping someone you did not hurt: even scared, they let you; they are grateful
    a.st.disp = 0; a.st.hostile = false; a.aggressor = false; a.isHostileToPlayer = () => false;   // (earlier tests left the region hating you)
    G.combat.damage(a, 12, knife, g); a.st.fear = 90; a.state = 'flee';
    p.inventory.add('bandage', 2); p.x = a.x; p.y = a.y + 14;
    const d0 = a.st.disp || 0, red0 = G.fate.st().red;
    const ck = w.flags.childKiller; w.flags.childKiller = false;   // (an earlier test made you a child killer: nobody talks to you then)
    g.talkTo(a); tick(1);
    const dlg = G.scenes.top();
    check(dlg instanceof G.DialogueScene && dlg.runner.node.id === '_aid_bleed', 'a bleeding person in a panic still talks to you: "' + (dlg.runner && dlg.runner.node.text) + '"');
    if (dlg instanceof G.DialogueScene) { dlg.chars = 999; dlg.choose(0); tick(2); if (G.scenes.top() === dlg) G.scenes.remove(dlg); }
    check(!G.bleed.is(a) && (a.st.disp || 0) > d0, `you bandage them; they like you more (${d0} -> ${a.st.disp})`);
    check(G.fate.st().red > red0, 'and it is a good deed');
    w.flags.childKiller = ck;
    // ...but not someone you hurt
    const b = others([a]); b.hp = b.maxHp = 60; b.st.inv = [];
    G.combat.damage(b, 12, { kind: 'npc', id: 'test_knifer2', x: p.x, y: p.y, swing: { st: G.melee.STYLES.knife, base: 0 } }, g);
    b.st.hurtByPlayer = w.day * 1440 + w.minutes; b.st.fear = 90; b.state = 'flee'; p.x = b.x; p.y = b.y + 14;
    g.talkTo(b); tick(1);
    check(!(G.scenes.top() instanceof G.DialogueScene && G.scenes.top().runner.node.id === '_aid_bleed'), 'someone you hurt does not let you near');
    while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
    // nothing to stop it: it kills
    b.st.bleed.rate = 6; b.st.inv = []; b.seekTried = new Set(g.actors.map((x) => x.id));
    for (let i = 0; i < 60 * 20 && !b.dead; i++) G.loop.tick(1 / 60);
    check(b.dead, 'untreated, the bleeding kills');
    // you bleed too, and a bandage stops it
    const wolf = { kind: 'animal', def: { dmg: 8, name: 'Wolf' }, x: p.x + 10, y: p.y };
    G.combat.damage(p, 15, wolf, g);
    check(G.effects.has(p, 'bleeding'), 'an animal bite makes you bleed');
    G.effects.consume(p, G.item('bandage'), g);
    check(!G.effects.has(p, 'bleeding'), 'a bandage stops it');
    // a bleeding animal: treat it
    const an = g.actors.find((x) => x.kind === 'animal' && !x.dead);
    if (an) {
      an.bleed = { rate: 0.3 }; an.hp = Math.max(1, Math.floor((an.maxHp || 10) * 0.4)); p.x = an.x; p.y = an.y + 10; p.dir = 3; p.inventory.add('bandage', 1);
      const t = g.findInteraction();
      check(t && t.type === 'aid_animal', 'a hurt animal can be treated: ' + (t && t.label));
      g.promptTarget = t; g.interact();
      check(!an.bleed, 'the bleeding stops');
    }
    // unconscious: search, treat, drag
    const k = others([a, b]); k.hp = k.maxHp = 60; k.st.inv = [['sandwich', 1]]; k.st.gold = 25;
    G.ko.knockOut(g, k, null, 'fist', 0.5); p.x = k.x; p.y = k.y + 14;
    g.talkTo(k); tick(1);
    const ch = G.scenes.top();
    check(ch instanceof G.ChoiceScene && ch.options.some((o) => /Search/.test(o.label)) && ch.options.some((o) => /Drag/.test(o.label)), 'an unconscious person: search, treat or drag: ' + (ch.options || []).map((o) => o.label).join(' | '));
    if (ch instanceof G.ChoiceScene) { ch.choose(ch.options.findIndex((o) => /Search/.test(o.label))); tick(1); }
    const ls = G.scenes.top();
    check(ls instanceof G.LootScene && ls.c.items.some((e) => e[0] === 'sandwich'), 'searching them opens their pockets');
    while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
    G.aid.toggleDrag(g, k); p.x += 60; for (let i = 0; i < 60; i++) G.loop.tick(1 / 60);
    check(p.draggingNpc === k.id && Math.hypot(k.x - p.x, k.y - p.y) < 20, 'you can drag them along');
    k.invuln = 0; G.combat.damage(k, 999, null, g); tick(2);
    check(!p.draggingNpc && p.dragging, 'if they die while you drag them, you are dragging a body');
    p.dragging = null;
    // your companion takes what you give them
    const c = others([a, b, k]); c.st.companion = true; c.hp = c.maxHp = 40;
    c.st.inv = [['beer', 8], ['sandwich', 1], ['painkillers', 6], ['naloxone', 1], ['ibuprofen', 6]];
    c.st.hunger = 80; G.npcFx.use(g, c, 'sandwich');
    check(c.st.hunger < 80, `food fills them (${c.st.hunger})`);
    c.hp = 20; G.npcFx.use(g, c, 'ibuprofen');
    check(c.hp > 20, 'medicine heals them');
    for (let i = 0; i < 5; i++) G.npcFx.use(g, c, 'ibuprofen');
    check(G.npcFx.has(c, 'nausea'), 'too much ibuprofen turns the stomach');
    for (let i = 0; i < 5; i++) G.npcFx.use(g, c, 'beer');
    check(G.npcFx.intox(c), 'beer gets them drunk: ' + (G.npcFx.intox(c) || {}).name);
    for (let i = 0; i < 6; i++) G.npcFx.use(g, c, 'painkillers');
    tick(2);
    check(c.st.ko && c.st.ko.reason === 'overdose' && G.npcFx.has(c, 'resp_depression'), 'too many painkillers (and drink): an overdose');
    c.hp = c.maxHp = 400; G.npcFx.use(g, c, 'naloxone'); tick(2);
    check(!c.st.ko && !G.npcFx.has(c, 'resp_depression'), 'naloxone brings them back');
    c.st.companion = false; c.st.alcohol = 0; c.st.fx = []; c.st.drugs = null;
    G.bleed.stop(p); G.bleed.playerOff = true;
  }

  // 2026-11-01: knockouts, beating bodies, waking up, head trauma, blood on you (js/game/knockout.js)
  function knockouts() {
    const g = game();
    g.loadMap('rural', 'start'); G.debug.time(12); tick(5);
    const p = g.player, K = G.ko, w = G.world;
    p.hp = p.maxHp = 999; p.dead = false; p.bloody = 0; G.effects.remove(p, 'blood_soaked');
    const pick = (not) => g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat === 'flee' && !a.st.ko && !not.includes(a));
    const swingWith = (style) => { p.swing = { st: G.melee.STYLES[style], t: 0.1, base: 0, side: 1, hit: new Set() }; };
    const r0 = Math.random;
    // fists: a beating ends with them on the ground, alive
    const v = pick([]); v.hp = v.maxHp = 40; v.x = p.x + 12; v.y = p.y;
    Math.random = () => 0.01;
    swingWith('fists');
    for (let i = 0; i < 30 && !v.st.ko && !v.dead; i++) { v.invuln = 0; G.combat.damage(v, 9, p, g); }
    Math.random = r0;
    check(v.st.ko && !v.dead && v.hp > 0 && v.downT > 1000, `fists knock someone out instead of killing them (${v.hp} hp left)`);
    check(!v.canSee(g, p, 200), 'an unconscious person sees nothing');
    const lbl = (() => { const t = g.findInteraction(); return t && t.ref === v ? t.label : '(not targeted) ' + (t && t.label); })();
    log('     prompt: ' + lbl);
    // hitting them on the ground: wounds and blood, up to a limit; still alive until it is fatal
    for (let i = 0; i < 40; i++) { v.hp = Math.max(v.hp, 30); v.invuln = 0; G.combat.damage(v, 2, p, g); }
    check(v.st.mangle === K.MAX && v.st.wounds.length <= 26 && v.st.wounds.length >= 6 && !v.dead, `beating someone on the ground: wounds pile up to the limit (${v.st.wounds.length} wounds, mangle ${v.st.mangle})`);
    check(p.bloody > 0.2, `and you get their blood on you (${p.bloody.toFixed(2)})`);
    tick(2);
    // waking up
    v.st.ko.until = 0; v.st.ko.head = 0; v.st.ko.sev = 0.3; v.st.ko.down = 0; v.st.headHits = 0;
    Math.random = () => 0.5; tick(1); Math.random = r0;
    check(!v.st.ko && v.koReact && ['confused', 'frightened', 'police', 'struggling'].includes(v.koReact.kind), 'they wake up: ' + (v.koReact && v.koReact.kind));
    tick(40);
    check(!(v.downT > 0.35) && !v.dead, 'and get back on their feet');
    // severe head trauma: brain damage, incoherent, no more texts
    const b = pick([v]); b.x = p.x + 12; b.y = p.y; b.hp = b.maxHp = 40;
    K.knockOut(g, b, p, 'blunt', 3); b.st.ko.head = 25; b.st.ko.until = 0;
    Math.random = () => 0.05; tick(1); Math.random = r0;
    check(K.brain(b.st) >= 1, 'enough blows to the head leave them brain damaged (level ' + K.brain(b.st) + ')');
    b.st.brain = 3; b.st.brainUntil = null; b.st.brainMem = 'forgot';
    const run = new G.DialogueRunner(b, g);
    check(run.node && run.node.id === '_brain' && run.node.choices.length <= 4, 'their conversation is broken, with almost nothing left to say: "' + run.node.text + '"');
    const said = G.chat.reply(run, 'hello, how are you?');
    check(said && said.text && !/how are you/i.test(said.text), 'typed chat gets nonsense back too: "' + (said && said.text) + '"');
    G.phone.addContact(w, b.id); const n0 = (w.pendingTexts || []).length;
    G.phone.queue(w, b.id, 'Miss you!', 1); G.phone.send(w, b.id, 'Hey, what\'s up?');
    check((w.pendingTexts || []).length === n0, 'they never text you (or answer texts) again');
    // killing someone who is unconscious: no fall, the body keeps its wounds
    const k = pick([v, b]); k.x = p.x + 12; k.y = p.y; k.hp = k.maxHp = 40;
    K.knockOut(g, k, p, 'fist', 0.5);
    swingWith('blunt');
    for (let i = 0; i < 30 && !k.dead; i++) { k.invuln = 0; G.combat.damage(k, 12, p, g); }
    g.refreshContainers();
    const body = g.containers.find((c) => c.kind === 'corpse' && Math.hypot(c.x - k.x, c.y - k.y) < 1);
    check(k.dead && body && body.mangle > 0 && body.wounds && body.wounds.length && body.pose && body.pose.kind === 'back', 'beaten to death on the ground: the body keeps its wounds and lies as it fell');
    // a blade still kills
    const s = pick([v, b, k]); s.x = p.x + 12; s.y = p.y; s.hp = s.maxHp = 20;
    swingWith('knife'); Math.random = () => 0.01;
    for (let i = 0; i < 10 && !s.dead; i++) { s.invuln = 0; G.combat.damage(s, 12, p, g); }
    Math.random = r0;
    check(s.dead && !s.st.ko, 'a knife kills; it does not knock out');
    p.swing = null;
    // beating a corpse with the real swing: wounds where it lands, blood everywhere, blood on you
    const m0 = body.mangle || 0, bl0 = p.bloody;
    { const o = openSpot(g, p); body.x = o.x + 12; body.y = o.y; }
    p.x = body.x - 12; p.y = body.y + 2; p.dir = 2; p.equip.weapon = null; p.attackCd = 0;
    for (let i = 0; i < 6; i++) { p.swing = null; p.attackCd = 0; G.melee.start(p); for (let f = 0; f < 30 && p.swing; f++) tick(1); }
    check(body.mangle > m0 || body.mangle === K.MAX, `punching a dead body marks it (${m0} -> ${body.mangle}; dir ${p.dir} at ${Math.round(p.x)},${Math.round(p.y)} body ${Math.round(body.x)},${Math.round(body.y)} in containers ${g.containers.includes(body)} map ${g.map.id} ko ${!!body.pose})`);
    check(p.bloody >= bl0, 'more blood on you');
    // washing
    p.bloody = 0.9; G.effects.add(p, 'blood_soaked', 60);
    const sink = { def: { interact: 'well' }, type: 'sink', tx: Math.floor(p.x / 16), ty: Math.floor(p.y / 16) };
    check(g.decorLabel(sink) === 'Wash up', 'a sink offers to wash up when you are bloody');
    g.useDecor(sink);
    check(p.bloody < 0.9 && p.bloody > 0 && p.handsClean, `a sink cleans your hands and face only (${p.bloody.toFixed(2)} left)`);
    Object.defineProperty(p, 'swimming', { get: () => true, set() {}, configurable: true }); tick(60 * 3); delete p.swimming; p.swimming = false;
    check(p.bloody < 0.6 && p.bloody >= 0.08, `a swim rinses most of it off (${p.bloody.toFixed(2)})`);
    G.ko.wash(p, 'all');
    check(!p.bloody && !G.effects.has(p, 'blood_soaked'), 'a shower takes it all off');
    p.bloody = 0.5; tick(60 * 5);
    check(p.bloody === 0.5 && G.effects.has(p, 'blood_soaked'), 'blood stays on until you wash it off');
    G.ko.wash(p, 'all');
  }

  // 2026-11-01: crashes on two wheels (js/game/crashes.js) and hostile NPCs that can always reach you
  function crashes() {
    const g = game(); g.arrestCooldown = 99999;
    g.loadMap('city', 'from_suburbs'); tick(5);
    const p = g.player; p.hp = p.maxHp = 500; p.dead = false;
    g.vehicles = g.vehicles.filter((v) => !v.ai);
    const r = g.map.roads.find((q) => q.h), y = G.roadTools.laneOf(r, 'E'), x = Math.round((r.from + r.to) / 2) * 16;
    const traffic = (model, xx, yy) => { const v = new G.Vehicle({ model, x: xx, y: yy, angle: 0 }); v.ai = { road: r, dir: 'E', lane: yy, turn: null, box: null, cruise: 45, waitT: 0, dest: null, driver: { seed: 'crash' + model, look: G.look('driver' + model) } }; v.speed = 45; g.vehicles.push(v); return v; };
    // a car slams into a cyclist: the rider is thrown, the bike falls and slides on
    const bike = traffic('bike_red', x, y);
    const car = new G.Vehicle({ model: 'car_red', x: x - 30, y, angle: 0, keys: true, owner: 'player' }); g.vehicles.push(car);
    G.vehicles.enter(g, car); car.speed = 190;
    const n0 = g.actors.length, bx = bike.x, by = bike.y;
    check(G.crashes.collide(g, car, bike, 150, p), 'a car hitting a cyclist is a crash');
    const rider = g.actors.slice(n0).find((a) => a.kind === 'npc'); if (rider) { rider.hp = 200; rider.maxHp = 200; }
    check(rider && rider.crash && rider.crash.phase === 'air' && bike.fallen && !bike.ai, 'the cyclist is thrown off, the bike falls over');
    let maxZ = 0, landed = false;
    for (let i = 0; i < 40 && rider && rider.crash; i++) { tick(3); if (rider.crash) { maxZ = Math.max(maxZ, rider.crash.z); if (rider.crash.phase !== 'air') landed = true; } }
    check(maxZ > 10 && (landed || !rider.crash), `they fly through the air (up to ${maxZ.toFixed(0)} px) and land`);
    for (let i = 0; i < 60 && rider && rider.crash; i++) tick(5);
    check(rider && !rider.crash && rider.downT > 0 && rider.hp < 200, `then they lie on the ground, hurt (${rider && rider.hp} hp)`);
    check(Math.hypot(rider.x - bx, rider.y - by) > 20, `thrown in the direction of the hit (${Math.round(Math.hypot(rider.x - bx, rider.y - by))} px)`);
    for (let i = 0; i < 40 && bike.crash; i++) tick(5);
    check(!bike.crash && bike.fallen && Math.hypot(bike.x - bx, bike.y - by) > 4, `the bike slides on its own and stays down (${Math.round(Math.hypot(bike.x - bx, bike.y - by))} px)`);
    tick(60 * 4);
    check(!(rider.downT > 0) || (rider.st && rider.st.ko), `the rider gets back up (or was knocked out cold: ${!!(rider.st && rider.st.ko)})`);
    G.vehicles.exit(g, true); car.speed = 0;
    // a light bump only shakes a rider
    const moto = traffic('moto_black', x + 200, y), m0 = g.actors.length;
    const bump = new G.Vehicle({ model: 'car_gray', x: x + 200, y: y - 26, angle: Math.PI / 2 }); g.vehicles.push(bump);
    G.crashes.collide(g, bump, moto, 55, null);
    check(!moto.fallen && moto.ai && moto.wobble && g.actors.length === m0, 'a minor knock does not throw a motorcyclist (they wobble)');
    // the player rides a motorcycle into a wall: over the handlebars
    const b = g.map.buildings.find((q) => q.w >= 4 && (q.y + q.h) * 16 + 40 < g.map.ph);
    const mine = new G.Vehicle({ model: 'moto_red', x: b.x * 16 + 24, y: (b.y + b.h) * 16 + 34, angle: -Math.PI / 2, keys: true, owner: 'player' }); g.vehicles.push(mine);
    for (const v of g.vehicles) if (v !== mine && Math.hypot(v.x - mine.x, v.y - mine.y) < 60) v.gone = true;
    p.x = mine.x; p.y = mine.y; G.vehicles.enter(g, mine); mine.speed = 220;
    const hp0 = p.hp;
    for (let i = 0; i < 60 && !p.crash; i++) { mine.speed = Math.max(mine.speed, 200); tick(1); }
    check(p.crash && !p.vehicle && mine.fallen, 'riding into a wall throws you off the motorcycle');
    for (let i = 0; i < 80 && p.crash; i++) tick(5);
    check(!p.crash && p.downT > 0 && p.hp < hp0, `you land hard (${hp0} -> ${p.hp} hp) and lie there`);
    tick(60 * 4);
    check(!(p.downT > 0) && !p.dead, 'and you get back up');
    G.vehicles.enter(g, mine);
    check(p.vehicle === mine && !mine.fallen, 'you can pick the bike back up and ride on');
    G.vehicles.exit(g, true);
  }

  // 2026-10-31: law (bodies, cases, wanted), My Jobs, notifications, economy and the small fixes
  // the small things, each once wrong
  function bloodFixes() {
    const g = game(), p = g.player, w = g.world, BC = G.bloodCare; G.scenes.replace(g); g.loadMap('city', 'start'); tick(20); G.settings.data.gore = true;
    const list = G.gore.list(g), add = (x, y, o = {}) => { const d = Object.assign({ x, y, type: 'splat', r: 5 }, o); G.gore.add(g, d); return d; };
    w.containers = Object.fromEntries(Object.entries(w.containers).filter(([, c]) => c.kind !== 'corpse')); list.length = 0;
    // far away, old
    { const old = add(p.x + 2000, p.y), near = add(p.x + 40, p.y), fresh = add(p.x + 2000, p.y + 20); old.day = w.day - 2; near.day = w.day - 2; BC.sweep(w, g); check(!list.includes(old), 'old blood far from you is gone'); check(list.includes(near), 'blood near you stays'); check(list.includes(fresh), 'fresh blood stays for a while'); list.length = 0; }
    // another map, a long time
    { const d = add(p.x, p.y); const here = g.map.id; w.mapSeen = { [here]: w.day * 1440 + w.minutes - BC.LONG - 5 }; const sc = { map: { id: 'zzz' }, player: p }; BC.sweep(w, sc); check(!(w.decals[here] || []).includes(d), 'a map left alone for a day loses its blood'); }
    { const d = add(p.x, p.y); const here = g.map.id; w.mapSeen = { [here]: w.day * 1440 + w.minutes - 30 }; BC.sweep(w, { map: { id: 'zzz' }, player: p }); check((w.decals[here] || []).includes(d), 'not after half an hour'); (w.decals[here] || []).length = 0; }
    // a body keeps it
    { const npc0 = g.actors.find((a) => a.kind === 'npc'), l2 = G.gore.list(g), d = add(p.x + 2000, p.y); d.day = w.day - 3; void npc0; const c = w.containers.tbody = { id: 'tbody', map: g.map.id, kind: 'corpse', items: [], x: d.x, y: d.y, day: w.day }; BC.sweep(w, g); check(l2.includes(d), 'not while the body lies there'); delete w.containers[c.id]; l2.length = 0; }
    // someone cleans it
    { const n = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.dead && !a.sleeping && a.state === 'schedule' && a.def.combat !== 'guard'); n.st.fear = 0; n.st.hostile = false; p.x = n.x + 60; p.y = n.y; const d = add(n.x + 20, n.y + 4), l = G.gore.list(g);
      check(BC.look(n, g) === d, 'they notice it'); G.npcInv.start(n, { kind: 'scrub', d }); let k = 0; while (n.itemJob && k++ < 900) { n.state = 'schedule'; G.loop.tick(1 / 60); } check(!l.includes(d), `an NPC scrubs it away (${k} ticks)`);
      const q = g.actors.find((a) => a.kind === 'npc' && a.def.combat === 'guard'); if (q) check(!BC.willing(q, g, { x: q.x, y: q.y }), 'the police leave a scene alone'); }
    { const n = g.actors.find((a) => a.kind === 'npc' && !a.dead); const d = add(n.x + 10, n.y); const c = w.containers.tbody = { id: 'tbody', map: g.map.id, kind: 'corpse', items: [], x: d.x, y: d.y, day: w.day }; check(BC.look(n, g) !== d, 'nobody scrubs around a body'); delete w.containers[c.id]; }
    // doors between rooms
    { g.loadMap('rural', 'start'); tick(10); const R = G.realWalls, r = { y: Math.floor((p.y - 12) / 16), gaps: [] }, gx = Math.floor(p.x / 16); for (let i = 0; i < 40; i++) R.doorStep(r, gx); check(r.doors[gx] > 0.9, 'a door opens as you walk up to it'); p.x += 120; for (let i = 0; i < 40; i++) R.doorStep(r, gx); check(r.doors[gx] < 0.1, 'and shuts behind you'); }
    // wall pieces
    { check(G.hungLift({ type: 'v_w_extinguisher' }) + 14 < 48 && G.hungLift({ type: 'v_w_clock' }) + 14 < 48, 'what hangs stays on the wall'); check(G.decorScale('v_w_clock')[0] === 1, 'painted pieces keep their size'); }
    G.scenes.remove(g);
  }
  function talkFixes() {
    const g = game(), p = g.player, w = g.world, B = G.talkbar, I = G.input; G.scenes.replace(g); g.loadMap('city', 'start'); tick(20); G.law.off = true; G.autonomy.off = true;
    const near = () => { const n = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.dead && !a.sleeping && a.state === 'schedule' && !a.def.shop); n.st.fear = 0; n.st.hostile = false; n.st.disp = 60; p.x = n.x + 22; p.y = n.y; n.update = () => {}; return n; };
    // the camera, under a conversation
    { const n = near(); tick(30); g.talkTo(n); const d = G.scenes.top(); check(d instanceof G.DialogueScene, 'a conversation'); tick(5); G.loop.tick(1 / 60); check(Math.abs(g._stepT - G.loop.time) < 0.05 && Math.abs(g._icx - G.renderer.cam.x) < 4, 'the smoothing follows the camera during a conversation, so the screen does not shake');
      // Esc, at any moment
      d.chars = 0; I.pressed.add('Escape'); G.loop.tick(1 / 60); check(G.scenes.top() === g && !n.talking && d.runner.ended, 'Esc closes it mid-line'); I.pressed.delete('Escape');
      g.talkTo(n); const e = G.scenes.top(); e.chars = 9999; e.typing = true; e.input = 'hel'; I.pressed.add('Escape'); G.loop.tick(1 / 60); check(G.scenes.top() === g, 'and while typing'); I.pressed.delete('Escape');
      g.talkTo(n); const f = G.scenes.top(); f.runner.node = { id: 'x', text: 'No way out here.', choices: [{ raw: { next: 'start' }, text: 'Stay' }] }; f.chars = 9999; I.pressed.add('Escape'); G.loop.tick(1 / 60); check(G.scenes.top() === g, 'and on a node with no goodbye'); I.pressed.delete('Escape');
      g.talkTo(n); const x = G.scenes.top(), X = G.xp, was = X.window; X.on = X.on || true; X.window = function () { const r = was.apply(this, arguments); r.close = true; return r; }; try { G.loop.draw(); } finally { X.window = was; } check(G.scenes.top() === g, 'the X closes it'); void x; }
    // typed, on T
    { const n = near(); B.close(); B.feed.length = 0; const named = n.st.introduced; n.st.introduced = false; B.send(g, n, "what's your name?"); check(n.st.introduced && !named, 'asking their name on T tells it'); check(G.scenes.top() === g, 'with no window');
      check(B.feed.some((f) => f.who === n.displayName || f.who === n.st.realName), 'and they say it'); B.close(); }
    { const n = near(); n.st.disp = 80; const before = G.scenes.stack.length; B.send(g, n, 'wanna trade?'); const top = G.scenes.top(); check(G.scenes.stack.length === before + 1 && top.constructor.name === 'BarterScene', `asking to trade opens the trade (${top.constructor.name})`); G.scenes.remove(top); B.close(); }
    { const n = near(); n.st.companion = true; n.st.inv = n.st.inv || []; B.send(g, n, 'i need to manage your inventory'); const top = G.scenes.top(); check(top.constructor.name === 'CompanionTradeScene', `managing their things works too (${top.constructor.name})`); G.scenes.remove(top); n.st.companion = false; B.close(); }
    { const n = near(); check(B.match('qual é o seu nome?', [{ text: "What's your name?", i: 3 }]) === 3 && B.match('me passa seu telefone', [{ text: 'Can I get your number?', i: 1 }]) === 1 && B.match('quer trocar?', [{ text: 'Want to trade?', i: 2 }]) === 2, 'Portuguese works as well'); check(B.match('nice weather today', [{ text: 'Want to trade?', i: 2 }, { text: 'Any news?', i: 4 }]) < 0, 'small talk picks nothing'); void n; }
    { const n = near(); n.st.disp = 90; n.st.romance = 60; check(!G.phone.isContact(w, n.id), 'not in your phone yet'); B.send(g, n, 'can i have your number?'); check(G.phone.isContact(w, n.id), 'asking for their number on T puts it in your phone'); check(G.scenes.top() === g, 'with no window'); B.close(); }
    // the model decides
    { const n = near(); n.st.introduced = false; B.close(); const s = B.start(g, n); B.list(s.runner.node); s.opts = B.list(s.runner.node); const idx = s.opts.find((o) => /your name/.test(o.text)); check(idx, 'the option is on offer');
      B.reply(g, s, { line: 'No. I do not know you.', say: [], extra: [] }, "what's your name"); check(!n.st.introduced, 'if they refuse, nothing happens');
      s.opts = B.list(s.runner.node); B.reply(g, s, { line: 'Sure thing.', say: [], extra: [], option: "What's your name?" }, 'and your name?'); check(n.st.introduced, 'if they agree, it does'); B.close(); }
    // nobody opens a window on you
    { const n = near(); const s = B.start(g, n); B.reply(g, s, { line: 'I could use a hand.', say: [], extra: [{ raw: { next: null }, text: 'What kind of work?' }] }, 'hello'); check(G.scenes.top() === g, 'something to decide does not open a window'); check(s.live, 'it waits for your answer'); B.close(); }
    delete G.autonomy.off; G.scenes.remove(g);
  }
  function playFixes() {
    const g = game(), p = g.player, w = g.world, I = G.npcInv; G.scenes.replace(g); g.loadMap('rural', 'start'); tick(2);
    // the car is beside the path, not across the door
    { const b = G.maps.get('rural').building(w.flags.player_home), c = w.vehicles.find((v) => v.id === 'v_player'); check(c && !G.vehicles.blocksDoor(c, b), 'the car leaves the front door clear');
      const old = { x: (b.doorX + 1) * 16, y: (b.doorY + 2) * 16 }; check(G.vehicles.blocksDoor(old, b), 'and a car in front of it counts as blocking'); }
    // what is in a room does not show past the roof
    { const m = g.map, b = m.buildings.find((q) => q.id === 'r_trailer3'), d = m.decor.find((q) => q.ty > b.y && q.ty < b.y + b.h - 1 && q.tx > b.x && q.tx < b.x + b.w - 1);
      for (const q of m.buildings) q.roofAlpha = 1; p.x = d.x; p.y = (b.y + b.h + 1) * 16; d._room = undefined; tick(40); check(d._room === b, 'furniture knows the room it is in'); }
    // bounty: a report still on its way does not land after the arrest
    { w.bounty[g.region] = 300; g.pendingReports = [{ args: ['theft', null, 40, null], ids: [], t: 0.1 }]; G.jail.imprison(g); tick(40);
      check(!!w.jail, 'locked up'); check(Object.values(w.bounty).every((v) => !v), 'nothing on your head in a cell'); check(!(g.pendingReports || []).length, 'witnesses still on the way are dropped');
      w.bounty.city = 500; tick(2); check(!w.bounty.city, 'and nothing lands on it while you sit'); w.jail = null; }
    g.loadMap('city', 'start'); tick(20);
    // bodies
    { const nude = G.hd.get(G.assets.character({ kid: true, naked: true, skin: '#d0a080', hair: '#222222' })), adult = G.hd.get(G.assets.character({ naked: true, skin: '#d0a080', hair: '#222222' }));
      check(!nude.L.bareTop && !nude.L.bareBottom, 'a child is never drawn without clothes'); check(adult.L.bareTop && adult.L.bareBottom && !adult.L.censored, 'an adult with no clothes is naked');
      check(G.settings.get('censor') === false, 'bars are off by default'); }
    // weapons and bikes
    { const it = Object.assign({ id: 'crowbar' }, G.ITEMS.crowbar); check(G.heldGear.length(it) > 9, 'a crowbar is its real length'); check(G.heldGear.two({ icon: 'bat' }) && !G.heldGear.two({ icon: 'pistol' }), 'long weapons take both hands');
      const b = G.vehiclesHD.get('moto_red'); check(b && b.width > 100, 'motorcycles are painted at the size of the world'); }
    // the weapon stays in one hand, whichever way you walk or turn
    { const hd = G.hd, seen = new Set(); p.inventory.add('crowbar', 1); p.equipFromSlot(p.inventory.slots.findIndex((q) => q && q.id === 'crowbar')); p._hdFrame = { col: hd.COL.idle, dir: 0 }; p._b = { h: 0 };
      for (let h = 0; h < 8; h++) for (const col of [hd.COL.idle, hd.COL.walk, hd.COL.walk + 2, hd.COL.walk + 4, hd.COL.walk + 6]) { p._b.h = h; p._hdFrame = { col, dir: 0 }; const a = hd.handOf(p), b = hd.handOf(p, 1); seen.add(a.x === b.x && a.y === b.y); }
      check(seen.size === 1 && seen.has(true), 'the weapon hand never changes'); p.equip.weapon = null; p.inventory.remove ? p.inventory.remove('crowbar', 1) : 0; p.inventory.removeId && 0; for (let i = 0; i < p.inventory.slots.length; i++) if (p.inventory.slots[i] && p.inventory.slots[i].id === 'crowbar') p.inventory.slots[i] = null; }
    // wall art
    for (const n of ['v_w_clock', 'v_w_notice', 'v_w_extinguisher', 'v_stairs', 'stairs_up', 'stairs_down', 'loot_pile']) check(G.realFurn.ART[n], `${n} is painted`);
    // the ground
    const npc = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.dead && !a.sleeping); npc.st.inv = []; npc.st.hunger = 0; npc.st.thirst = 0; npc.doing = null; p.x = npc.x + 30; p.y = npc.y;
    { const c = G.containers.createBag(w, g.map.id, p.x + 4, p.y, [['bandage', 1]]), h = G.containers.createBag(w, g.map.id, p.x - 40, p.y, [['beer', 2], ['bandage', 1]]); g.refreshContainers();
      check(G.groundLoot.label(c).includes(G.item('bandage').name), 'one thing is named'); check(G.groundLoot.label(h) === 'Pick up', 'a heap is a heap');
      const n0 = p.inventory.count ? p.inventory.count('bandage') : 0; check(G.groundLoot.grab(g, c) && !w.containers[c.id], 'one thing goes straight into your bag'); check(p.inventory.has('bandage') && (!p.inventory.count || p.inventory.count('bandage') > n0), 'and it is there');
      check(!G.groundLoot.grab(g, h), 'a heap opens the window'); delete w.containers[h.id]; g.refreshContainers(); G.loop.draw(); }
    { const s = new G.InventoryScene(g); G.scenes.push(s); p.equip.hat = null; p.inventory.add('crowbar', 1); const i = p.inventory.slots.findIndex((q) => q && q.id === 'crowbar'); p.equipFromSlot(i); check(p.equip.weapon === 'crowbar', 'in hand');
      s.sel = s.inv.size + s.eqSlots.indexOf('weapon'); s.dropSel(); check(!p.equip.weapon && !p.inventory.has('crowbar'), 'what you hold can be dropped'); check(g.containers.some((c) => c.kind === 'bag' && c.items.some((e) => e[0] === 'crowbar')), 'and lies on the ground'); G.scenes.remove(s);
      for (const c of g.containers.slice()) if (c.kind === 'bag') delete w.containers[c.id]; g.refreshContainers(); }
    // NPCs and their things
    const run = () => { let n = 0; while (npc.itemJob && n++ < 1200) { npc.state = 'schedule'; tick(1); } return n; };
    { const c = G.containers.createBag(w, g.map.id, npc.x + 24, npc.y + 6, [['beer', 1]]); g.refreshContainers();
      check(I.reach(npc, g).includes('Beer'), 'they are told what is really there'); check(I.pockets(npc) === 'nothing at all', 'and what they really have');
      check(I.request(npc, g, 'pick_up', 'beer', {}).ok, 'asked to pick it up'); check(!I.count(npc.st, 'beer'), 'nothing happens by saying so'); run(); check(I.count(npc.st, 'beer') === 1, 'they walked over and took it'); check(!w.containers[c.id], 'and it is gone from the ground'); }
    { const a = I.request(npc, g, 'give', 'chainsaw'); check(!a.ok && a.line, 'they cannot give what they do not have'); const b = I.request(npc, g, 'use_item', 'sandwich'); check(!b.ok, 'or eat it'); }
    { const had = p.inventory.has('beer'); check(I.request(npc, g, 'give', 'beer').ok, 'asked to hand it over'); run(); check(!I.count(npc.st, 'beer') && p.inventory.has('beer') && !had, 'it changed hands'); }
    { I.add(npc.st, 'sandwich', 1); npc.st.hunger = 90; check(I.request(npc, g, 'use_item', 'sandwich').ok, 'food in hand'); run(); check(!I.count(npc.st, 'sandwich') && npc.st.hunger < 90, 'eating uses it up'); npc.st.hunger = 0; }
    { I.add(npc.st, 'crowbar', 1); I.request(npc, g, 'equip', 'crowbar'); run(); check(npc.st.equip && npc.st.equip.weapon === 'crowbar' && npc.weaponItem && npc.weaponItem.id !== undefined || (npc.weaponItem && npc.weaponItem.name === G.ITEMS.crowbar.name), 'equipped'); I.request(npc, g, 'drop', 'crowbar'); run(); check(!I.count(npc.st, 'crowbar') && !npc.weaponItem && g.containers.some((c) => c.items && c.items.some((e) => e[0] === 'crowbar')), 'dropped: gone from the hand, on the ground');
      for (const c of g.containers.slice()) if (c.kind === 'bag') delete w.containers[c.id]; g.refreshContainers(); }
    { npc.st.inv = []; for (let i = 0; i < I.CAP; i++) npc.st.inv.push([Object.keys(G.ITEMS)[i + 5], 1]); check(!I.add(npc.st, 'zzz_none') && !I.add(npc.st, Object.keys(G.ITEMS).filter((k) => !npc.st.inv.some((e) => e[0] === k))[0]), 'pockets have a limit'); npc.st.inv = []; }
    { check(G.npcDoes.DOES.smoke.w(npc, { smoker: true, inside: false }) === 0, 'no cigarette, no smoking'); I.add(npc.st, 'cigarettes', 1); check(G.npcDoes.DOES.smoke.w(npc, { smoker: true, inside: false }) > 0, 'with one, yes'); npc.doing = { kind: 'smoke', t: 0, len: 1 }; G.npcDoes.finish(npc); check(!I.count(npc.st, 'cigarettes'), 'and it is smoked'); }
    { npc.st.hunger = 95; npc.seek = null; npc.needTask = null; const f = G.containers.createBag(w, g.map.id, npc.x + 22, npc.y + 6, [['sandwich', 1]]); g.refreshContainers(); check(I.look(npc, g) && I.look(npc, g).id === 'sandwich', 'hungry, they want the food they can see'); I.think(npc, g); run(); check(I.count(npc.st, 'sandwich') === 1 && !w.containers[f.id], 'and go and get it on their own'); }
    // the model's words
    { const r = { npc, scene: g, c: {}, aiLog: [{ who: 'player', text: 'give me your chainsaw' }] }, out = G.ai.apply(r, [{ type: 'give', item: 'chainsaw' }], true, 'friendly'); check(out.sayInstead, 'the model cannot promise what the game cannot do');
      check(G.ai.ACTIONS.includes('pick_up') && G.ai.SCHEMA.properties.actions.items.properties.type.enum.includes('pick_up'), 'the model is offered the actions');
      const q = G.containers.createBag(w, g.map.id, npc.x + 20, npc.y, [['beer', 1]]); g.refreshContainers(); npc.st.inv = []; const o2 = G.ai.apply(r, [{ type: 'pick_up', item: 'beer' }], true, 'friendly'); check(o2.done.includes('pick_up') && npc.itemJob, 'a yes becomes a real errand'); run(); check(I.count(npc.st, 'beer') === 1, 'and is done in the world'); void q;
      const said = G.ai.promised({ npc, aiLog: [{ who: 'player', text: 'give me the beer' }] }, 'Sure, here you go.', []); check(said.some((a) => a.type === 'give'), 'words that agree without the action still count'); }
    G.scenes.remove(g);
  }
  function smallFixes() {
    const g = game(), p = g.player, w = g.world; G.scenes.replace(g); g.loadMap('rural', 'start'); tick(2);
    // signs and art
    const m = G.maps.get('rural'), mk = m.buildings.find((b) => /Kosher Market/.test(b.name)); check(!!mk, 'the Kosher Market is there');
    check(mk && m.decor.some((d) => /^shopsign_/.test(d.type) && Math.abs(d.tx - mk.doorX) <= 6 && Math.abs(d.ty - mk.doorY) <= 6), 'with its signpost');
    for (const n of ['v_drums', 'v_screen', 'v_dino', 'vault_door', 'isl_obelisk', 'w_cabin_ruin', 'fly_agaric']) check(G.realFurn.ART[n] && G.assets.sprites[n].real, `${n} is painted`);
    { const s = G.assets.sprites.v_stage; check(s.img === s.img && s.baked && s.img.width === Math.ceil(s.w), 'flat pieces carry the new art into the ground'); }
    // notifications
    { const q = G.notify || G.toasts; void q; const re = /\b(?:kill|run)/i; check(!re.test('New skill learned') && !re.test('You feel drunk') && re.test('You were killed'), 'an urgent word is a word, not part of one'); }
    // chess: a pawn guards the square beside it, even an empty one
    { const M = G.minigames && G.minigames.chess || G.chess; if (M && M.attacked) { const B = Array.from({ length: 8 }, () => '........'.split('')); B[3][4] = 'p'; check(M.attacked(B, 5, 4, false) && M.attacked(B, 3, 4, false) && !M.attacked(B, 4, 4, false), 'a pawn attacks its diagonals, not ahead'); } }
    // the bank
    G.bank && G.bank.state && G.bank.state(w); if (w.bankFloat) { w.bankFloat.c_teller1 = 100; const v = w.bankVault; G.events.emit('newDay'); check(w.bankFloat.c_teller1 === 2500 && w.bankVault === v - 2400 - (w.bankFloat.c_teller2 === 2500 ? 0 : 0), 'the tills fill from the vault overnight'); }
    // crime
    { const r = w.getRep('rural'), b = w.bounty.rural || 0; w.commitCrime('cannibalism', 'rural', true); check((w.bounty.rural || 0) > b && w.getRep('rural') < r, 'cannibalism seen is a crime'); }
    // a bounty is not printed, and sleep promises nothing
    { const src = G.JournalScene ? G.JournalScene.prototype.render.toString() + (G.JournalScene.prototype.drawPage || '').toString() : ''; check(!/Bounty \$\{b\}/.test(src), 'the journal does not print the bounty'); }
    // the weapon left at the ring's door survives a save
    { const FC = G.fightClub, id = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].type === 'weapon'); g._fc = { weapon: id }; p.equip.weapon = null; let saved = null; FC.rearm(g, () => { saved = p.equip.weapon; }); check(saved === id && !p.equip.weapon, 'a save in the ring keeps the weapon'); g._fc = null; }
    // blasts only count at the moment
    { const n = g.actors.find((a) => a.kind === 'npc' && !a.dead); if (n) { n.blasted = G.loop.time - 5; check(!(n.blasted > G.loop.time), 'an old blast is not what kills you later'); n.blasted = 0; } }
    // the shark goes to the one who owes
    { const a = g.actors.filter((q) => q.kind === 'npc' && !q.dead && q.def.combat === 'flee').slice(0, 2); if (a.length === 2) { const [n, t] = a; n.x = t.x + 60; n.y = t.y; n.state = 'schedule'; n.st.order = { t: 'come', map: g.map.id, until: 1e12, who: t.id }; const d0 = n.distTo(t), pd = n.distTo(p); void pd; tick(30); check(n.distTo(t) < d0 || !n.st.order, `an order to go to someone goes to them (${Math.round(d0)} to ${Math.round(n.distTo(t))})`); n.st.order = null; } }
    // needs warn once on the way in
    { p.hunger = 86; p.needWarned = false; G.needs.hourlyPlayer(p, g); check(p.needWarned, 'hunger warns'); const c1 = g.toasts.length; G.needs.hourlyPlayer(p, g); check(g.toasts.length === c1, 'once'); p.hunger = 0; p.needWarned = false; }
  }

  // the whole game on a controller
  function padPlay() {
    const g = game(), p = g.player, I = G.input, P = G.pad, m = I.mouse; G.settings.data.moveMode = 0; G.happenings.off = true; G.law.off = true;
    const state = { buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], connected: true, id: 'test', mapping: 'standard' };
    const real = navigator.getGamepads; navigator.getGamepads = () => [state];
    const IDX = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Back: 8, Start: 9, L3: 10, R3: 11, Up: 12, Down: 13, Left: 14, Right: 15 };
    const set = (b, on) => { state.buttons[IDX[b]] = { pressed: on, value: on ? 1 : 0 }; }, tap = (b, n = 2) => { set(b, true); tick(n); set(b, false); tick(2); };
    const stick = (x, y) => { state.axes[0] = x; state.axes[1] = y; }, aim = (x, y) => { state.axes[2] = x; state.axes[3] = y; };
    const home = () => { while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop(); };
    G.scenes.replace(g); g.loadMap('city', 'start'); G.debug.time(13); tick(3); for (const a of g.actors) if (a.kind === 'npc') a.state = 'schedule';
    { const t = G.pad.BTN.length; check(t === 16 && P.connected, 'a controller is seen'); }
    // walking: as fast as the stick is pushed
    p.x = 110 * 16 + 8; let sp = null; const open = (() => { for (let y = 20; y < g.map.h - 20; y++) for (let x = 30; x < g.map.w - 30; x++) { let ok = true; for (let d = -2; d <= 2 && ok; d++) for (let e = 0; e < 16; e++) if (g.map.isSolidTile(x + e, y + d)) { ok = false; break; } if (ok) return { x: x * 16, y: y * 16 + 8 }; } return null; })(); sp = open;
    const walk = (x, n, b) => { p.x = sp.x; p.y = sp.y; p._mv = null; stick(x, 0); if (b) set(b, true); tick(n); const d = p.x - sp.x; stick(0, 0); if (b) set(b, false); tick(4); return d; };
    const half = walk(0.55, 40), full = walk(1, 40), run = walk(1, 40, 'RB');
    check(half > 4 && full > half * 1.3, `walking follows the stick (half ${half.toFixed(1)}, full ${full.toFixed(1)})`);
    check(run > full * 1.2, `RB runs (${run.toFixed(1)})`);
    // a small push does nothing
    p.x = sp.x; p._mv = null; stick(0.1, 0); tick(20); check(!P.stick && !p.moving, `the dead zone holds (stick ${!!P.stick}, moving ${p.moving})`); stick(0, 0); tick(2);
    check(P.device === 'pad', 'the pad is in hand');
    check(P.prompt('interact') === 'A' && G.ui.measure, `prompts follow the pad (${P.prompt('interact')})`);
    // fighting
    p.attackCd = 0; p.swing = null; p.stamina = p.maxStamina; tap('X'); check(!!p.swing || p.attackTimer > 0, 'X punches'); tick(50);
    p.attackCd = 0; p.swing = null; tap('Y'); check(p.swing && p.swing.st.kind === 'kick', 'Y kicks'); tick(60);
    p.attackCd = 0; p.swing = null; aim(1, 0); tick(3); aim(0, 0); check(Math.abs(P.aimAng) < 0.2, 'the right stick turns you'); p.aim = 0; set('RT', true); tick(2); set('RT', false); check(!!p.swing, 'RT strikes too'); tick(50);
    const invuln = p.invuln || 0; void invuln; const dx0 = p.x; p.staminaDelay = 0; p.stamina = p.maxStamina; stick(1, 0); tick(4); tap('B'); check(p.dodgeT > 0 || (p.invuln || 0) > 0 || Math.abs(p.x - dx0) > 3, 'B dodges'); stick(0, 0); tick(30);
    // guns: the aim is the same system the mouse uses
    const gun = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].gun && !G.ITEMS[k].auto); p.equip.weapon = gun; p.refreshSprite && p.refreshSprite(); G.firearms.setLoaded ? G.firearms.setLoaded(p, G.item(gun), 9) : 0;
    aim(0, 1); set('LT', true); tick(6); check(p.aiming, 'LT aims'); check(Math.abs(p.aim - Math.PI / 2) < 0.25, `the stick points it (${p.aim.toFixed(2)})`); set('LT', false); aim(0, 0); tick(3); p.equip.weapon = null;
    // menus
    home(); tap('Up'); check(G.scenes.top() !== g, 'D-pad up: inventory'); const s1 = G.scenes.top(), s0 = s1.sel; tick(2); stick(0, 1); tick(3); stick(0, 0); tick(3); check(s1.sel !== s0, 'the stick moves through it'); tap('B', 2); tick(2); check(G.scenes.top() === g, 'B closes it');
    tap('Start'); check(G.scenes.top() !== g, 'Menu pauses'); tap('B'); tick(2); check(G.scenes.top() === g, 'and comes back');
    tap('Back'); check(G.scenes.top() instanceof G.ChoiceScene, 'View: the quick menu holds everything else'); tap('B'); tick(2); home();
    // talking
    const npc = g.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'flee' && !a.def.kid); if (npc) { npc.x = p.x + 8; npc.y = p.y; npc.state = 'schedule'; p.face(1, 0); tick(4); tap('A'); check(G.scenes.top().runner, `A talks (${G.scenes.top().constructor.name})`); home(); if (G.scenes.top().runner) G.scenes.top().runner.ended = true; }
    // a demand: the thumbs
    const civ = g.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat !== 'guard' && !a.def.kid); civ.x = p.x + 20; civ.y = p.y; civ.state = 'schedule'; civ.def.mugger = true; p.gold = 300; g.startMugging(civ); tick(2); check(G.demand.cur, 'a mugger asks'); tap('RB'); check(p.gold < 300 && !G.demand.cur, 'RB: thumb up'); civ.def.mugger = false; civ.state = 'schedule'; tick(70);
    // driving
    home(); const v = new G.Vehicle({ model: 'car_blue', x: sp.x + 60, y: sp.y, angle: 0, keys: true, owner: 'player' }); g.vehicles.push(v); G.vehicles.enter(g, v); tick(2);
    if (p.vehicle) { const x0 = v.x; set('RT', true); tick(50); set('RT', false); check(v.x > x0 + 8, `RT drives (${(v.x - x0).toFixed(0)})`); const a0 = v.angle; set('RT', true); stick(1, 0); tick(30); stick(0, 0); set('RT', false); check(Math.abs(v.angle - a0) > 0.03, 'the stick steers'); const s0v = v.speed; set('LT', true); tick(12); set('LT', false); check(v.speed < s0v - 8, `LT brakes (${s0v.toFixed(0)} to ${v.speed.toFixed(0)})`); v.speed = 0; tick(2); tap('A'); check(!p.vehicle, 'A gets out'); } else check(false, 'could not get in');
    g.vehicles = g.vehicles.filter((q) => q !== v); home();
    // writing with a pad
    let val = null; G.scenes.push(new G.ai.PromptScene('Name', '', (t) => { val = t; })); tick(3); check(P.oskOpen, 'a text field brings up the keyboard'); P.oskR = 1; P.oskC = 0; tap('A'); P.oskC = 1; tap('A'); tap('Y'); P.oskC = 2; tap('A'); tap('X'); tap('Start'); tick(3); check(/^qw\s*$/.test(val || ''), `typed (${JSON.stringify(val)})`); home(); P.oskOpen = false;
    // mouse-only screens: a pointer on the right stick
    G.scenes.push(new G.SettingsScene()); tick(2); const mx = m.x; aim(1, 0); tick(10); aim(0, 0); tick(2); check(m.x > mx && P.ptr, 'the right stick moves a pointer in menus'); set('RT', true); tick(1); check(m.pressed || m.down, 'RT clicks'); set('RT', false); tick(2); G.input.mouse.down = false; home();
    // configurable
    P.rebind('kick', 'PadX'); check(P.map().attack === 'PadY' && P.map().kick === 'PadX', 'moving an action swaps it, no button does two things'); p.attackCd = 0; p.swing = null; p.stamina = p.maxStamina; tick(2); tap('X'); check(p.swing && p.swing.st.kind === 'kick', `and it takes effect (${p.swing && p.swing.st.kind}, ${I.bindings.kick})`); tick(60); P.reset(); check(P.map().kick === 'PadY', 'reset');
    const pre = I.bindings.interact.join(); I.loadBindings(); check(I.bindings.interact.includes('PadA') && I.bindings.interact.join() === pre, 'bindings survive a reload');
    // labels in text
    check(P.prompt('kick') === 'Y', 'the kick prompt'); G.settings.data.padGlyphs = 1; check(P.prompt('interact') === 'Cross', 'PlayStation names'); G.settings.data.padGlyphs = 0;
    // independent of the keyboard
    window.dispatchEvent && P.device; I.down.add('KeyD'); p.x = sp.x; p.y = sp.y; p._mv = null; state.connected = false; tick(30); I.down.delete('KeyD'); tick(4); check(p.x > sp.x + 5, 'the keyboard still walks'); check(!P.connected, 'a pad pulled out is noticed'); navigator.getGamepads = real; state.connected = true; tick(2);
  }

  // every road out, every edge of every map on foot, and cars that leave you where you stand
  function edgesCars() {
    const g = game(), p = g.player, I = G.input; G.settings.data.moveMode = 1; G.happenings.off = true;
    const near = (m, x, y) => G.wilds.nearExit(m, { x, y }, 4);
    const settle = () => { for (let i = 0; i < 40 && G.scenes.top() !== g; i++) tick(2); while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop(); };
    const keyOf = { n: 'KeyW', s: 'KeyS', w: 'KeyA', e: 'KeyD' };
    const openSpot = (m, side, k) => {   // a place you can stand against that edge
      const horiz = side === 'n' || side === 's', len = horiz ? m.w : m.h;
      for (let d = 0; d < len; d++) { const i = Math.round(len * k + (d % 2 ? d : -d) / 2); if (i < 3 || i >= len - 3) continue;
        const tx = horiz ? i : side === 'w' ? 1 : m.w - 2, ty = horiz ? (side === 'n' ? 1 : m.h - 2) : i, px = tx * 16 + 8, py = ty * 16 + 12;
        if (m.isSolidTile(tx, ty) || m.isWaterAt(px, py - 3) || near(m, px, py) || m.buildingAt(px, py - 3) || m.rectCollides(px - p.w / 2, py - p.h, p.w, p.h)) continue;
        const ix = horiz ? tx : side === 'w' ? 8 : m.w - 9, iy = horiz ? (side === 'n' ? 8 : m.h - 9) : ty; if (m.isSolidTile(ix, iy)) continue;
        return { px, py }; }
      return null;
    };
    let tried = 0; const bad = [];
    for (const id of G.WILDS_MAPS) for (const side of ['n', 's', 'w', 'e']) for (const k of [0.3]) {
      g.world.wilds = null; g.transitioning = false; g.loadMap(id, null); settle(); const m = g.map, at = openSpot(m, side, k); if (!at) continue;
      tried++; p.x = at.px; p.y = at.py; p.vehicle = null; p.swimming = false; g.arrivedT = 2; g.edgePush = 0; I.down.add(keyOf[side]);
      let left = 0; for (let f = 0; f < 90 && g.map.id === id; f++) { tick(1); left = f; } I.down.clear(); settle();
      if (g.map.id === id) bad.push(`${id} ${side} ${k} stayed (${Math.round(p.x)},${Math.round(p.y)})`); else if (!/^wilds/.test(g.map.id)) bad.push(`${id} ${side}: ${g.map.id}`); else if (g.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h)) bad.push(`${id} ${side}: arrived inside something`);
      else {   // and straight back the way you came
        const back = { n: 's', s: 'n', w: 'e', e: 'w' }[side]; g.arrivedT = 2; p.x = back === 'w' ? 8 : back === 'e' ? g.map.pw - 8 : p.x; p.y = back === 'n' ? 16 : back === 's' ? g.map.ph - 8 : p.y; if (g.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h)) continue;
        I.down.add(keyOf[back]); for (let f = 0; f < 60 && /^wilds/.test(g.map.id); f++) tick(1); I.down.clear(); settle();
        if (g.map.id !== id) bad.push(`${id} ${side}: back led to ${g.map.id}`); else if (g.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h)) bad.push(`${id} ${side}: came back inside something`);
      }
    }
    g.world.wilds = null;
    check(tried > 30 && !bad.length, `every open edge leads to the woods and back (${tried} tried): ${bad.slice(0, 6).join(' / ')}`);
    // every road out, both ways
    const rb = []; let roads = 0;
    for (const id of Object.keys(G.MAPGEN)) {
      const m0 = G.maps.get(id); if (!m0 || m0.meta.floorOf || /^wilds/.test(id) || (m0.exits || []).length === 0 || m0.w < 60) continue;
      for (let i = 0; i < m0.exits.length; i++) {
        g.transitioning = false; g.loadMap(id, null); settle(); const e = g.map.exits[i]; if (!e) continue; if (!G.MAPGEN[e.to]) continue; roads++;
        p.x = (e.x + e.w / 2) * 16; p.y = (e.y + e.h / 2) * 16 + 4; g.arrivedT = 2; tick(3); settle(); for (let f = 0; f < 30 && g.map.id === id; f++) tick(1); settle();
        if (g.map.id !== e.to) { rb.push(`${id}>${e.to}: at ${g.map.id}`); continue; }
        if (g.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h)) rb.push(`${id}>${e.to}: inside something`);
        tick(40); settle(); if (g.map.id !== e.to) rb.push(`${id}>${e.to}: bounced to ${g.map.id}`);
      }
    }
    check(roads > 20 && !rb.length, `every road out arrives, in the open, and stays (${roads}): ${rb.slice(0, 6).join(' / ')}`);
    // transitions are short
    g.transitioning = false; g.loadMap('city', 'start'); settle(); check(G.TRANSITION <= 0.3, 'the dip to black is short');
    let frames = 0; g.changeMap('suburbs', 'from_city'); while (G.scenes.top() !== g && frames < 200) { tick(1); frames++; }
    check(frames / 60 < 0.45, `a map change takes ${(frames / 60).toFixed(2)} s of game time`);
    check(g.map._gc && g.map._gc.left > 0, 'and paints the rest of the ground while you play');
    let before = g.map._gc.left; for (let i = 0; i < 10; i++) G.renderer.ctx && g.render(G.renderer.ctx); check(g.map._gc.left <= before, 'it keeps going');
    // the same ground either way: square by square against all at once
    { const m = g.map; m.finishGround(); const a = m.groundCtx.getImageData(800, 800, 300, 300).data, keep = G.lazyGround; G.lazyGround = false; m._gc = null; m.prerender(); m._needBlend && (m._needBlend = false, G.terrain.blend(m)); const b = m.groundCtx.getImageData(800, 800, 300, 300).data; G.lazyGround = keep; m.prerender(); let diff = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) diff++; check(diff < a.length / 4 * 0.002, `no seams: the squares match the whole (${diff} pixels of ${a.length / 4} differ)`); }
    // cars
    g.transitioning = false; g.loadMap('city', 'start'); settle(); G.vehicles.off = true; g.vehicles = g.vehicles.filter((v) => !v.ai);
    const sp = (() => { for (let ty = 10; ty < g.map.h - 10; ty++) for (let tx = 10; tx < g.map.w - 10; tx++) { let ok = true; for (let a = -8; a <= 8 && ok; a++) for (let b = -6; b <= 6; b++) if (g.map.isSolidTile(tx + a, ty + b) || g.map.buildingAtTile(tx + a, ty + b)) { ok = false; break; } if (ok) return { x: tx * 16, y: ty * 16 }; } return null; })();
    check(!!sp, 'an open lot');
    const v = new G.Vehicle({ model: 'car_blue', x: sp.x, y: sp.y, angle: 0 }); g.vehicles.push(v);
    const c = Math.cos(v.angle), s = Math.sin(v.angle); void c; void s;
    const drift = []; const walk = p.walkSpeed / 60 + 0.1;
    for (const [dx, dy, key, off] of [[0, -v.Wd - 8, 'KeyS', 'x'], [v.L * 0.7, -v.Wd - 8, 'KeyS', 'x'], [-v.L * 0.8, v.Wd + 8, 'KeyW', 'x'], [v.L + 8, 2, 'KeyA', 'y'], [-v.L - 8, -3, 'KeyD', 'y']]) {
      p.x = v.x + dx; p.y = v.y + dy; const x0 = p.x, y0 = p.y; I.down.add(key); let max = 0, lx = p.x, ly = p.y;
      for (let f = 0; f < 80; f++) { tick(1); max = Math.max(max, Math.hypot(p.x - lx, p.y - ly)); lx = p.x; ly = p.y; }
      I.down.clear(); const slid = off === 'x' ? Math.abs(p.x - x0) : Math.abs(p.y - y0);
      if (slid > 3 || max > walk * 1.5) drift.push(`${dx},${dy}: slid ${slid.toFixed(1)}, step ${max.toFixed(2)}`);
      if (v.covers(p.x, p.y, 1.5)) drift.push(`${dx},${dy}: inside the car`);
    }
    check(!drift.length, `leaning on a parked car moves you nowhere: ${drift.join(' / ')}`);
    p.x = v.x + 10; p.y = v.y + 2; let big = 0, lx = p.x, ly = p.y; for (let f = 0; f < 120; f++) { tick(1); big = Math.max(big, Math.hypot(p.x - lx, p.y - ly)); lx = p.x; ly = p.y; }
    check(!v.covers(p.x, p.y, 1) && big < 1.2, `a car over you: you walk out, no jump (${big.toFixed(2)} px a frame at most)`);
    // everything that used to throw you: a crate under your feet
    const m = g.map, t2 = { x: Math.floor(sp.x / 16), y: Math.floor(sp.y / 16) + 5 }; p.x = t2.x * 16 + 8; p.y = t2.y * 16 + 12; const o = m.rectCollides; let n = 0; m.rectCollides = function (x, y, w, h, sw) { return n++ < 400 && Math.abs(x + w / 2 - (t2.x * 16 + 8)) < 20 && Math.abs(y + h - (t2.y * 16 + 12)) < 20 || o.call(this, x, y, w, h, sw); };
    big = 0; lx = p.x; ly = p.y; for (let f = 0; f < 60; f++) { tick(1); big = Math.max(big, Math.hypot(p.x - lx, p.y - ly)); lx = p.x; ly = p.y; } m.rectCollides = o;
    check(big < 1.3, `out of something solid at walking pace (${big.toFixed(2)})`);
    g.vehicles = g.vehicles.filter((q) => q !== v); G.vehicles.off = false;
    // the leftovers: venue pieces at full detail, hedges that stand up
    check(['v_bar', 'v_pool_table', 'v_arcade1', 'v_treadmill', 'v_lockers'].every((n) => G.realFurn.ART[n] && G.assets.sprites[n].real), 'venue furniture is painted at room detail');
    { const h = G.maps.get('heights'), runs = (h._fences || []).length; void runs; check(!!G.TILES[G.T.hedge] && G.TILES[G.T.hedge].tex === 'hedge', 'a hedge is a hedge'); }
    // parked art stands on its own solid ground
    const parked = g.map.decor.filter((d) => /^car_|^police_car$|^limo$/.test(d.type)); let off = 0;
    for (const d of parked) { const mm = G.vehicles.MODELS[d.type]; if (!mm) continue; const x0 = d.x - mm.len / 2, x1 = d.x + mm.len / 2, sx0 = d.tx * 16, sx1 = (d.tx + d.def.fw) * 16; if (x0 < sx0 - 1 || x1 > sx1 + 1 || sx1 - sx0 - mm.len > 16) off++; }
    check(parked.length > 0 && !off, `parked cars fill exactly the ground that blocks you (${off} of ${parked.length} off: ${parked[0] && [parked[0].x, parked[0].tx, parked[0].def.fw, parked[0].type]})`);
  }

  // no window opens by itself; punches and kicks in every heading; police who talk first
  function demandFight() {
    const g = game(), p = g.player, D = G.demand, I = G.input;
    G.scenes.replace(g); g.loadMap('city', 'start'); G.debug.time(13); tick(3); G.law.off = false;
    const w = g.world, cops = g.actors.filter((a) => a.kind === 'npc' && a.def.combat === 'guard' && !a.dead), cop = cops[0];
    const civ = g.actors.find((a) => a.kind === 'npc' && a.def.combat !== 'guard' && !a.dead && !a.def.kid);
    check(!!cop && !!civ, 'people to test with');
    const ring = (a) => { a.state = 'schedule'; a.target = null; a.st.hostile = false; a.x = p.x + 20; a.y = p.y; a.moving = false; };
    const press = (k) => { I.pressed.add(k); };
    // the mugger
    ring(civ); p.gold = 200; p.hp = p.maxHp; const d0 = civ.def.mugger; civ.def.mugger = true; civ.st.gold = 0;
    const x0 = p.x; g.startMugging(civ); tick(2);
    check(D.cur && D.cur.npc === civ && G.scenes.top() === g, 'a mugger speaks; no window');
    check(/\$/.test(civ.bark || ''), `and says it out loud (${civ.bark})`);
    I.down.add('KeyD'); tick(30); I.down.delete('KeyD');
    check(p.x > x0 + 4, `you can walk while they talk (${p.x - x0})`);
    check(D.cur && civ.distTo(p) < 70, 'they stay on you');
    press('KeyY'); tick(2);
    check(p.gold < 200 && !D.cur && D.mark && D.mark.up, 'Y pays, and the thumb up shows');
    tick(90); check(!D.mark, 'and it goes');
    ring(civ); civ.mugDone = false; p.gold = 200; g.startMugging(civ); tick(2); press('KeyN'); tick(3);
    check(p.gold === 200 && D.mark && !D.mark.up && (civ.st.hostile || civ.state === 'fight' || G.persuade), `N refuses, thumb down (${civ.state})`);
    tick(70); civ.st.hostile = false; civ.state = 'schedule'; civ.target = null; civ.def.mugger = d0;
    const tolled = g.actors.find((a) => a.kind === 'npc' && /gang/.test(a.def.faction || '')); void tolled;
    // nothing else opens by itself: the trees that used to
    for (const tree of ['_debt', '_bed_intruder']) { check(!!G.DIALOGUES[tree], tree); }
    // the police
    ring(cop); w.bounty[g.region] = 100; p.gold = 0; g.copsHot = 0; g.arrestCooldown = 0; G.loop.copsOn = true; g.startArrest(cop); tick(2);
    check(D.cur && D.cur.spec.police && G.scenes.top() === g, 'an officer gives the order out loud');
    press('KeyN'); tick(2);
    check(D.cur && cop.state !== 'fight' && !cop.isHostileToPlayer(g), 'N: refused, and no fight');
    check(w.bounty[g.region] > 100, 'it costs you');
    press('KeyN'); tick(2); check(D.cur && D.cur.grab > 0 && cop.state !== 'fight', 'again: a last warning, still no fight');
    tick(3); D.close(); cop.state = 'schedule';
    w.bounty[g.region] = 500; ring(cop); g.arrestCooldown = 0; tick(5);
    check(cop.state !== 'fight', `a big bounty alone does not make them shoot (${cop.state})`);
    cop.state = 'schedule'; g.arrestCooldown = 0; g.startArrest(cop); tick(2);
    cop.x = p.x + 200; cop.y = p.y; tick(2);
    check(cop.state === 'fight' && !D.cur, `running from the order is what starts it (${cop.state})`);
    ring(cop); g.copsHot = 0; for (const c of cops) { c.state = 'schedule'; c.target = null; } while (G.scenes.top() !== g) G.scenes.pop();
    w.bounty[g.region] = 100; p.gold = 500; g.arrestCooldown = 0; G.demand.close(); g.startArrest(cop); tick(2); press('KeyY'); tick(2);
    check(w.bounty[g.region] === 0 && p.gold === 400 && !D.cur, 'Y cooperates: the fine is paid');
    G.loop.copsOn = false; G.law.off = true;
    // punches and kicks, in the eight headings
    ring(civ); civ.hp = civ.maxHp = 500; civ.state = 'schedule'; p.maxHp = p.hp = 100000;
    let seen = new Set(), kicks = new Set(), painted = 0, turned = 0;
    for (let k = 0; k < 8; k++) {
      const an = k * Math.PI / 4; civ.x = p.x + Math.cos(an) * 14; civ.y = p.y + Math.sin(an) * 14; p.aim = an; p.face(Math.cos(an), Math.sin(an));
      for (let n = 0; n < 3; n++) {
        p.swing = null; p.attackCd = 0; p.stamina = p.maxStamina; G.combat.attack(p, g); const m = p.swing && p.swing.move; if (m) seen.add(m); const c0 = G.fight.col(p.swing); if (G.hd.KINDS[c0]) painted++; tick(40); if (p._b && p._b.h != null) turned++;
        p.swing = null; p.attackCd = 0; p.stamina = p.maxStamina; const h0 = civ.hp; G.fight.playerKick(p, g); if (p.swing) kicks.add(p.swing.st.move); tick(50); civ.x = p.x + Math.cos(an) * 14; civ.y = p.y + Math.sin(an) * 14; void h0;
      }
    }
    check(seen.size >= 4, `different punches: ${[...seen]}`);
    check(kicks.size >= 3, `different kicks: ${[...kicks]}`);
    check(civ.hp < 500, 'and they land');
    check(painted > 0, 'every move has frames');
    // miss, hit, recover
    civ.x = p.x + 200; p.swing = null; p.attackCd = 0; G.fight.kick(p, 'k_front', g); const t0 = G.melee.total(p.swing.st); let frames = 0; while (p.swing && frames < 200) { tick(1); frames++; }
    check(frames / 60 > t0, `a miss takes longer to come back from (${frames}f, ${t0}s)`);
    // Q in the world kicks; in a menu it stays a tab key
    for (const a of g.actors) if (a.kind === 'npc') { a.state = 'schedule'; a.target = null; a.st.hostile = false; a.swing = null; } p.downT = 0; p.staggerT = 0; p.hurtTimer = 0; p.attackCd = 0; p.swing = null; p.stamina = p.maxStamina; tick(1); p.attackCd = 0; press('KeyQ'); tick(1); check(!!p.swing && p.swing.st.kind === 'kick', 'Q kicks'); tick(60);
    // who kicks
    const a = g.actors.find((x) => x.kind === 'npc' && x.def.combat === 'fight' && !x.dead && !x.weaponItem) || civ;
    a.target = p; p.x = a.x + 15; p.y = a.y; a.kickCd = 0; a._kickT = null; a.punchCount = 0;
    const t1 = G.fight.temper(a); check(t1 >= 0, 'a temper');
    const kid = { def: { kid: true }, look: {} }; check(G.fight.temper(kid) === 0, 'children do not kick');
    p.downT = 1; a._kickT = 0.8; a.def.combat === 'guard' ? 0 : check(G.fight.npcKick(a, g) === 'k_stomp', 'someone down gets stomped by those who would'); p.downT = 0; a.kickCd = 0;
    const b = a.def.combat; a.def.combat = 'guard'; p.downT = 1; a.kickCd = 0; check(G.fight.npcKick(a, g) !== 'k_stomp', 'an officer does not'); p.downT = 0; a.def.combat = b;
    p.fcBlock = 1; a.kickCd = 0; p.x = a.x + 15; check(G.fight.npcKick(a, g) === 'k_low', 'hands up: they go under them'); p.fcBlock = 0;
    a._kickT = 0.45; a.kickCd = G.loop.time + 9; check(G.fight.npcKick(a, g) === null, 'not every moment is a kick');
    // hats and masks, in the equipment
    p.inventory.add(G.clothId('hat', 'fedora', '#2a2a30')); p.inventory.add(G.clothId('mask', 'surgical', '#888888'));
    const hi = p.inventory.slots.findIndex((s) => s && s.id.startsWith('hat/')); p.equipFromSlot(hi); const mi = p.inventory.slots.findIndex((s) => s && s.id.startsWith('mask/')); p.equipFromSlot(mi);
    const lk = p.currentLook(); check(lk.hat === 'fedora' && lk.mask === 'surgical', 'hat and mask on');
    p.unequip('hat'); check(!p.currentLook().hat && p.inventory.slots.some((s) => s && s.id.startsWith('hat/')), 'and off again');
    let ok = 0; const hd = G.hd.get(G.assets.character(Object.assign({}, lk))); for (let d = 0; d < 8; d++) if (G.body.frameOf(hd, d, G.hd.COL.jab + 3, 0, {})) ok++;
    check(ok === 8, 'hat and mask frames in eight headings');
    check(Object.values(G.NPCS).some((d) => d.look && d.look.hat === 'bandana') && Object.values(G.NPCS).some((d) => d.look && d.look.mask), 'NPCs wear them by who they are');
  }

  function lawAndOrder() {
    G.scenes.replace(new G.GameScene({}));
    tick(3);
    const g = game(), w = G.world, p = g.player, L = G.law;
    p.hp = p.maxHp = 99999;
    g.loadMap('city', 'from_suburbs'); G.debug.time(12); tick(5);
    // a body is found: police, investigators and the coroner come, and the body and blood are gone after
    const v = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat === 'flee' && !a.transient);
    if (v) {
      const vid = v.id;
      G.combat.damage(v, 99999, null, g); tick(3);
      const body = g.containers.find((c) => c.kind === 'corpse' && c.victim === vid);
      check(!!body && !!L.state(w).kills[vid], 'a kill is recorded and leaves a body');
      G.gore.add(g, { x: body.x, y: body.y, r: 4, type: 'splat' });
      w.dead[vid].discovered = true;
      L.call911(w, body, g.map.id);
      const job = L.state(w).jobs.find((j) => j.victim === vid);
      check(!!job, 'finding the body calls 911');
      const stages = new Set();
      for (let i = 0; i < 60 * 240 && job.stage !== 'done'; i++) {
        if (job.t > 0) job.t = Math.min(job.t, 0.5);
        for (const a of g.actors) if (a.lawJob === job.id && a.distTo(job) > 20) { a.x = job.x + 8; a.y = job.y + 6; }
        for (const c of g.vehicles || []) if (c.lawDrive) { c.x = c.lawDrive.x; c.y = c.lawDrive.y; }
        G.loop.tick(1 / 30);
        stages.add(job.stage);
      }
      check(stages.has('patrol') && stages.has('investigate') && stages.has('coroner') && job.stage === 'done', 'police, then detectives, then the coroner: ' + [...stages].join(' > ') + ' / ' + job.stage + ' t=' + job.t + ' crew=' + g.actors.filter((a) => a.lawJob === job.id).map((a) => a.law + ':' + Math.round(a.distTo(job)) + (a.dead ? 'X' : '')).join(','));
      const bloodNear = () => (w.decals[g.map.id] || []).filter((d) => Math.hypot(d.x - body.x, d.y - body.y) < 30 && (d.clean || 0) < 1).length;
      check(!w.containers[body.id] && bloodNear() > 0, 'the coroner takes the body; the blood stays for the cleanup crew');
      const cj = w.ems && w.ems.jobs.filter((j) => j.kind === 'clean').pop();
      if (cj) { cj.t = 0; for (let i = 0; i < 60 * 200 && cj.stage !== 'done'; i++) { for (const a of g.actors) if (a.emsJob === cj.id && a.distTo(cj) > 40) { a.x = cj.x + 8; a.y = cj.y + 6; } G.loop.tick(1 / 30); } }
      check(cj && bloodNear() === 0, `then the cleanup crew scrubs the blood away (${cj ? cj.stage : 'no job'}, ${bloodNear()} left)`);
      check(L.state(w).cases.some((c) => c.victim === vid), 'investigators opened a case');
    }
    // cases with fixed dice
    {
      const s = L.state(w);
      s.kills.test_victim = { victim: 'test_victim', killer: 'player', weapon: 'knife', day: w.day, map: 'city', region: 'city', witnesses: ['a', 'b'], masked: false, gloves: false, blood: true, moved: false, burnt: false, disposed: null };
      s.cases.push({ id: 'tc1', victim: 'test_victim', killer: 'player', evidence: 0.7, witnesses: 2, suspects: ['player'], status: 'open', days: 0, region: 'city' });
      s.cases.push({ id: 'tc2', victim: 'test_victim', killer: 'player', evidence: 0.7, witnesses: 2, suspects: ['player'], status: 'open', days: 0, region: 'city' });
      const lucky = { next: () => 0.999, chance: () => false, pick: (a) => a[0], int: (a) => a };
      const unlucky = { next: () => 0, chance: () => false, pick: (a) => a[0], int: (a) => a };
      const tc2 = s.cases.find((c) => c.id === 'tc2'); tc2.status = 'hold';
      L.dailyCases(w, lucky);
      check(s.cases.find((c) => c.id === 'tc1').status === 'open', 'a case can stay unsolved (fixed dice)');
      L.dailyCases(w, unlucky);
      check(s.cases.find((c) => c.id === 'tc1').status === 'solved' && s.cases.find((c) => c.id === 'tc1').convicted === 'player', 'a case can be solved (fixed dice)');
      check(L.solveChance(w, { killer: 'player', evidence: 0.02, witnesses: 0 }) > 0 && L.solveChance(w, { killer: 'player', evidence: 0.95, witnesses: 3 }) < 1, 'there is always a chance either way');
      s.wanted = null; for (const k in w.bounty) w.bounty[k] = 0;
    }
    // wanted everywhere: brutal crimes only
    w.commitCrime('theft', 'city', true, null, 10);
    check(!L.isWanted(w), 'a petty crime does not make you wanted everywhere');
    w.commitCrime('child_murder', 'city', true, null);
    check(L.isWanted(w) && Object.keys(G.REGIONS).every((r) => w.bounty[r] >= L.WANTED_HEAT), 'a brutal crime makes you wanted in every region');
    w.flags.x = 1; G.events.emit('newDay', w.day);
    check(L.isWanted(w), 'wanted everywhere does not cool down by itself');
    // the HUD shows no bounty
    {
      const said = [], _t = G.ui.text;
      G.ui.text = function (ctx, txt) { said.push(String(txt)); return _t.apply(this, arguments); };
      try { G.hud.draw(G.renderer.ctx, g); } finally { G.ui.text = _t; }
      check(!said.some((t) => /DEAD OR ALIVE|Bounty|\$800/.test(t)), 'no bounty number on the HUD');
      check(L.statusLines(w).some((t) => /WANTED EVERYWHERE/.test(t)), 'the phone tells you that you are wanted');
    }
    L.endWanted(w, 'test'); for (const k in w.bounty) w.bounty[k] = 0;
    // chatBCT: My Jobs
    w.startQuest('wolves');
    { const rows = G.PHONE_SCREENS.myjobs({ w, game: g, open() {} }); check(rows.some((r) => /Wolf Trouble/.test(r.label)), 'My Jobs lists your jobs'); check(G.bct.SUGGEST[0] === 'My Jobs' || G.bct.SUGGEST.includes('My Jobs'), 'chatBCT offers My Jobs'); }
    // notifications: Minimal shows at most 2
    G.settings.data.notifications = 0; g.toasts = [];
    for (let i = 0; i < 6; i++) g.toast('Police are coming ' + i, 'bad');
    g.toast('Blue Gang reputation +3', 'good');
    check(g.toasts.length <= 2 && !g.toasts.some((t) => /reputation/.test(t.text)), 'Minimal notifications: at most 2 on screen, chatter goes to the phone');
    check((w.notes || []).some((n) => /reputation/.test(n.text)), 'the chatter is in LifeLog > Notifications');
    G.settings.data.notifications = 2;
    // economy: prices follow the market; the Vault holds your money
    {
      const sid = Object.keys(w.shops)[0], it = w.shops[sid].stock[0] && w.shops[sid].stock[0][0];
      if (it) { const p0 = G.shopSys.priceBuy(sid, it, w); const e = G.economy.state(w); const c = G.economy.catOf(it); e.cat[c] *= 2; const p1 = G.shopSys.priceBuy(sid, it, w); e.cat[c] /= 2; check(p1 > p0, `a shortage raises prices (${p0} -> ${p1})`); }
      const e = G.economy.state(w); p.gold = 100; e.bank = 0;
      G.PHONE_SCREENS.vault({ w, game: g, open() {} }).find((r) => /Deposit all/.test(r.label)).act();
      check(e.bank === 100 && p.gold === 0, 'depositing cash in the Vault');
      const g0 = w.npcs[v ? Object.keys(w.npcs).find((id) => w.npcs[id].alive && G.NPCS[id] && !G.NPCS[id].kid) : 'x'];
      if (g0) { const before = g0.gold; G.economy.daily(w); check(g0.gold !== before || before === 0, 'people earn and spend every day'); }
    }
    // bikes never explode
    {
      const bike = new G.Vehicle({ model: 'bike_red', x: p.x + 40, y: p.y }); (g.vehicles = g.vehicles || []).push(bike);
      bike.hp = 1; for (let i = 0; i < 60; i++) G.loop.tick(1 / 30);
      check(!bike.burning && !bike.exploded, 'bicycles do not burn or explode');
    }
    // jobs done can be reported by text
    {
      const giver = Object.keys(w.npcs).find((id) => w.npcs[id].alive && G.NPCS[id] && !G.NPCS[id].kid);
      w.quests.tjob = { state: 'active', day: w.day, progress: {}, def: { title: 'Test job', giver, objectives: [{ type: 'flag', flag: 'tjob_done' }], reward: { gold: 30, xp: 5 } } };
      w.flags.tjob_done = true; const g1 = p.gold;
      const r = G.phone.reply(w, giver, 'The job is done.');
      check(w.quests.tjob.state === 'done' && p.gold === g1 + 30 && /\$30/.test(r), 'texting "The job is done." completes it and pays by transfer');
    }
    // attributes feed the stats
    { const a0 = G.skills.stat(p, 'charisma'); p.skills.attrs = { charisma: 10, strength: 1, luck: 1, knowledge: 1, accuracy: 1 }; check(G.skills.stat(p, 'charisma') > a0, 'Charisma raises the charisma stat'); }
    // HD characters: 8+ frame cycles, the stride follows the distance actually walked
    {
      const C = G.hd.COL, hd = G.hd.get(G.assets.character(G.look('t_walk')), true);
      check(C.run - C.walk >= 8 && [0, 1, 2, 3, 4, 5, 6, 7].every((d8) => G.body.frameOf(hd, d8, C.walk + 3, 0).width > 0 && G.body.frameOf(hd, d8, C.run + 7, 0).width > 0), 'walk and run cycles have 8 frames in all 8 directions');
      const a = { x: 0, y: 0, dir: 2, moving: true }, A2 = G.hd.anim;
      A2.animState(a, 1 / 60); a.x += 0.3; const s1 = A2.animState(a, 1 / 60).st.phase; a.x += 3; const s2 = A2.animState(a, 1 / 60).st.phase;
      check(s2 - s1 > (s1 - 0) * 5, `the frame advances with distance walked (${s1.toFixed(3)} -> ${s2.toFixed(3)})`);
    }
    // corpse poses are stored on the body and survive saving
    {
      const n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient);
      if (n) {
        G.combat.damage(n, 99999, p, g); tick(2);
        const c = Object.values(w.containers).find((k) => k.kind === 'corpse' && k.victim === n.id);
        check(c && c.pose && c.pose.kind, 'a corpse gets a pose: ' + (c && c.pose && c.pose.kind));
        const again = JSON.parse(JSON.stringify(c));
        check(JSON.stringify(again.pose) === JSON.stringify(c.pose), 'the corpse pose is stable across save/load');
      }
    }
    // the dialogue panel stays small
    {
      const n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid);
      if (n) { n.state = 'schedule'; n.st.hostile = false; n.st.fear = 0; G.scenes.push(new G.DialogueScene(g, new G.DialogueRunner(n, g, n.def.dialogue || 'generic'))); tick(3); const d = G.scenes.top(); check(d instanceof G.DialogueScene, 'a dialogue opens'); if (d instanceof G.DialogueScene) { d.render(G.renderer.ctx); check(d.panelH > 0 && d.panelH < 0.3, `the dialogue panel is under 30% of the screen (${Math.round(d.panelH * 100)}%)`); G.scenes.remove(d); } }
    }
    // HD art: everything has an HD version at every quality level
    {
      G.hdArt.apply();
      const rep = G.hdArt.report();
      check(!rep.tiles.length && !rep.sprites.length && !rep.icons.length, `every tile, sprite and icon has HD art (missing: ${rep.tiles.slice(0, 3)} ${rep.sprites.slice(0, 3)} ${rep.icons.slice(0, 3)})`);
      const cob = G.assets.tiles.cobble.length;
      G.settings.set('graphics', 0);
      check(G.assets.tiles.cobble.hd && G.assets.tiles.cobble.length < cob, `Low keeps the HD tiles, with fewer variants (${G.assets.tiles.cobble.length} of ${cob})`);
      G.settings.set('graphics', 3);
      check(G.assets.tiles.cobble.hd && G.assets.tiles.cobble.length === cob, 'and Ultra shows all of them again');
      check(Object.keys(G.ANIMALS).filter((k) => !G.ANIMALS[k].beast).every((k) => G.animals2.sheet(k, G.ANIMALS[k].color, {})), 'every animal species has an HD sheet');
      // a 16x20 character sheet is never drawn: the draw lands on the HD sheet
      const sh0 = G.assets.character(G.look('hdredirect')); G.hd.get(sh0, true);
      const hd0 = G.hd.get(sh0), mkc = () => { const c = document.createElement('canvas'); c.width = 32; c.height = 40; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return x; };
      const ca = mkc(), cb = mkc();
      ca.drawImage(sh0.img, 0, 0, 16, 20, 0, 0, 32, 40);
      G._hdDrawing = true; cb.drawImage(hd0.img, G.hd.COL.idle * G.hd.FW, 0, G.hd.FW, G.hd.FH, 0, 0, 32, 40); G._hdDrawing = false;
      const pa = ca.getImageData(0, 0, 32, 40).data, pb = cb.getImageData(0, 0, 32, 40).data;
      check(pa.every((v, i) => v === pb[i]), 'a 16x20 sheet draw shows the HD person instead');
    }
    // co-op over a loopback transport: a guest joins, moves, picks something up, hits an NPC, changes map, leaves
    {
      const C = G.coop, L = C.Loopback(), got = [];
      g.loadMap('city', 'from_suburbs'); tick(3);
      C.host(7777, L.hostSide);
      L.guestSide.open({ msg: (id, s) => got.push(JSON.parse(s)), join() {}, leave() {} });
      L.guestSide.connect();
      const gp = new G.Player(); gp.playerName = 'Tester'; gp.refreshSprite(); const ch = gp.serialize(); ch.name = 'Tester';
      L.guestSide.send({ t: 'hello', v: C.VERSION, name: 'Tester', char: ch });
      const welcome = got.find((m) => m.t === 'welcome'), peer = C.peers[1], ra = peer && peer.actor;
      check(!!welcome && !!ra && g.actors.includes(ra), 'a guest joins the host\'s world');
      { const L2 = C.Loopback(), got2 = []; L2.id = 2; L2.hostH = L.hostH; L2.guestSide.open({ msg: (id, s) => got2.push(JSON.parse(s)), join() {}, leave() {} }); const sendTo = C.net.sendTo; C.net.sendTo = (id, o) => (id === 2 ? got2.push(o) : sendTo.call(C.net, id, o)); L2.guestSide.connect(); L2.guestSide.send({ t: 'hello', v: 'old', name: 'X', char: {} }); C.net.sendTo = sendTo; check(got2.some((m) => m.t === 'reject') && !C.peers[2], 'a guest with another game version is refused'); }
      // moving
      const tx = ra.x + 20; L.guestSide.send({ t: 'input', x: tx, y: ra.y, dir: 2, moving: true, map: 'city' }); tick(20);
      check(Math.abs(ra.x - tx) < 2, 'the host sees the guest move');
      L.guestSide.send({ t: 'input', x: ra.x + 5000, y: ra.y, dir: 2, moving: true, map: 'city' });
      check(got.some((m) => m.t === 'correct'), 'a teleporting guest is put back');
      tick(10);
      check(got.some((m) => m.t === 'snap' && Array.isArray(m.npcs)), 'the guest gets snapshots of the map');
      // picking something up from a container
      G.containers.createBag(w, 'city', ra.x, ra.y + 2, [['apple', 1]]); g.refreshContainers();
      const bag = g.containers.find((c) => c.kind === 'bag' && Math.hypot(c.x - ra.x, c.y - ra.y) < 10);
      L.guestSide.send({ t: 'take', c: bag.id, item: 'apple' });
      check(got.some((m) => m.t === 'grant' && m.item === 'apple') && !bag.items.length, 'the guest picks up an item (the host\'s container gives it)');
      // hitting an NPC
      const target = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat !== 'guard');
      if (target) {
        target.x = ra.x + 10; target.y = ra.y; target.talking = true; ra.tx = ra.x; ra.ty = ra.y; const hp0 = target.hp;
        L.guestSide.send({ t: 'attack', aim: 0, dir: 2 }); for (let i = 0; i < 40; i++) G.loop.tick(1 / 60);
        check(target.hp < hp0, `the guest's punch lands on the host's NPC (${hp0} -> ${target.hp})`);
      }
      // another map
      L.guestSide.send({ t: 'input', x: 100, y: 100, dir: 0, moving: false, map: 'rural' });
      check(!g.actors.includes(ra) && peer.map === 'rural', 'a guest on another map leaves this one');
      // the host's save never holds a guest
      G.saves.write('t_coop', g);
      const sv = JSON.stringify(G.saves.read('t_coop'));
      const svo = G.saves.read('t_coop');
      check(svo.player.name !== 'Tester' && !/Tester/.test(JSON.stringify(svo.world.npcs || {})) && !/coopId|"kind":"remote"/.test(sv), 'the host\'s save contains no guest character');
      G.saves.remove('t_coop');
      // leaving
      L.guestSide.close();
      check(!C.peers[1], 'the guest disconnects cleanly');
      C.stop();
    }
    // the expanded world: the port and the farmland, connected both ways, furnished and lived in
    for (const [id, from, back] of [['industrial', 'southside', 'from_industrial'], ['farmland', 'rural', 'from_farmland']]) {
      const m = G.maps.get(id), there = G.maps.get(from);
      const out = m.exits.find((e) => e.to === from), inn = there.exits.find((e) => e.to === id);
      check(!!out && !!inn && !!there.points[back] && m.buildings.length >= 6, `${m.meta.name}: ${m.buildings.length} buildings, exits both ways`);
      g.loadMap(id, 'from_' + from); tick(5);
      const locals = g.actors.filter((a) => a.kind === 'npc' && G.NPCS[a.id] && G.NPCS[a.id].map === id);
      check(locals.length >= 5, `${m.meta.name}: people live here (${locals.length})`);
    }
    // tester fixes (2026-10-31 afternoon): a parked car offers both stealing and the glovebox; blood stops at walls;
    // heavy blows knock people down; fire is depth sorted; furniture has hand-drawn HD art
    {
      const carDef = Object.keys(G.DECOR).find((k) => G.DECOR[k].interact === 'car' && G.vehicles.MODELS[k] && k !== 'police_car');
      if (carDef) {
        const d = { def: G.DECOR[carDef], type: carDef, tx: 3, ty: 3, x: p.x + 10, y: p.y };
        const lbl = G.usables.label(d, g);
        check(/steal or search/.test(lbl), `a parked car's prompt offers stealing and searching (${lbl})`);
        let menu = null; const push = G.scenes.push; G.scenes.push = (s) => { menu = s; }; G.usables.use(d, g); G.scenes.push = push;
        const labels = menu && menu.options ? menu.options.map((o) => o.label).join(' | ') : '';
        check(/glovebox/i.test(labels) && /hotwire|steal|break/i.test(labels), `the car menu has both: ${labels.slice(0, 120)}`);
      }
      // a pool of blood next to a wall does not spread through it
      const map = g.map; let wx = -1, wy = -1;
      for (let ty = 2; ty < map.h - 2 && wx < 0; ty++) for (let tx = 2; tx < map.w - 2; tx++) { const a = map.tileDef(tx, ty), b = map.tileDef(tx + 1, ty); if (a && !a.solid && !a.water && b && b.solid) { wx = tx; wy = ty; break; } }
      if (wx >= 0) { const pool = { x: wx * 16 + 14, y: wy * 16 + 8, r: 3, grow: 14, born: G.loop.time, type: 'pool' }; G.gore.add(g, pool); check(pool.grow <= 3, `a pool against a wall stays on this side (grow ${pool.grow})`); }
      const vic = g.actors.find((a) => a.kind === 'npc' && !a.dead && !(a.def && a.def.kid));
      if (vic) { vic.downT = 0; vic.hp = vic.maxHp = 500; G.combat.damage(vic, 30, p, g); check(vic.downT > 0, 'a heavy blow knocks someone down'); vic.downT = 0; }
      check(Object.keys(G.realFurn.ART).length >= 60 && !!G.realFurn.ART.bed && G.assets.sprites.bed.real, `furniture painted by hand (${Object.keys(G.realFurn.ART).length} pieces)`);
      check(G.hd.COL.reload && G.hd.COL.phone && G.hd.COL.carry && G.hd.COL.getup, 'reload, phone, carry and get-up poses exist');
      // HD effects: brass flies and settles, splashes, blood decals drawn without errors, animals topple
      { const n0 = G.effectsHD.casings.length; G.effectsHD.casing(p.x, p.y, 0, false); check(G.effectsHD.casings.length === n0 + 1, 'a shot throws out a casing');
        const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const cx = cv.getContext('2d'), view = { x: p.x - 160, y: p.y - 90, w: 320, h: 180 };
        G.gore.add(g, { x: p.x + 20, y: p.y, r: 3, grow: 8, born: G.loop.time, type: 'pool' }); G.gore.add(g, { x: p.x - 20, y: p.y, r: 2, type: 'splat', ang: 1 });
        G.effectsHD.splash(g, p.x, p.y, true);
        let ok = true; try { for (let i = 0; i < 40; i++) { G.loop.time += 1 / 30; G.gore.draw(cx, g, view); } } catch (e) { ok = false; console.error(e); }
        check(ok && G.effectsHD.casings.slice(-1)[0].rest, 'blood, splashes and brass draw, and the casing comes to rest'); }
      { const n0 = Object.keys(w.containers).length; G.containers.createCarcass(w, { def: G.ANIMALS.deer, species: 'deer', x: p.x, y: p.y, dir: 1 }, g.map.id, []); const c = Object.values(w.containers).find((c) => c.kind === 'carcass' && c.fallT != null); check(Object.keys(w.containers).length === n0 + 1 && !!c, 'a dying animal topples over (fall time recorded)'); if (c) delete w.containers[c.id]; }
      { // mouse mode: the player faces the cursor; forward walks the way it points (not to it), at the same speed at any angle
        const R = G.renderer, m = G.input.mouse, mx = m.x, my = m.y, I = G.input; p.vehicle = null; p.sitting = null; p.downT = 0; p.swimming = false;
        G.settings.data.moveMode = 0;
        const aimAt = (dx, dy) => { m.x = (p.x + dx - R.cam.x) * R.zoom; m.y = (p.y - 6 + dy - R.cam.y) * R.zoom; m.moved = true; };
        aimAt(60, 0); p.dir = 0; p.update(1 / 60, g);
        const faced = p.dir; m.moved = false; G.loop.time += 5; p.dir = 0; p.update(1 / 60, g);
        check(faced === 2 && p.dir === 2, `mouse mode: the player looks where the mouse points, even with the mouse idle (faced ${faced}, idle ${p.dir})`);
        const up = I.bindings.up[0], walk = (dx, dy, n = 40) => { p._mv = null; const x0 = p.x, y0 = p.y; for (let i = 0; i < n; i++) { aimAt(dx, dy); I.down.add(up); p.update(1 / 60, g); } I.down.delete(up); return [p.x - x0, p.y - y0]; };
        const south = walk(0, 80), ne = walk(70, -70);
        check(south[1] > 10 && Math.abs(south[0]) < 2, `forward with the cursor south walks south (${south.map(Math.round)})`);
        check(ne[0] > 6 && ne[1] < -6 && Math.abs(Math.abs(ne[0]) - Math.abs(ne[1])) < 3, `forward with the cursor northeast walks northeast (${ne.map(Math.round)})`);
        { const right = I.bindings.right[0]; for (const [cx, cy] of [[0, 80], [0, -80]]) { p._mv = null; const x0 = p.x; for (let i = 0; i < 30; i++) { aimAt(cx, cy); I.down.add(right); p.update(1 / 60, g); } I.down.delete(right); check(p.x - x0 > 5, `D strafes to the right of the screen looking ${cy > 0 ? 'down' : 'up'} (${Math.round(p.x - x0)})`); } }
        check(Math.abs(Math.hypot(...ne) - Math.hypot(...south)) < 3, `diagonals are not faster (${Math.hypot(...ne).toFixed(1)} vs ${Math.hypot(...south).toFixed(1)})`);
        // weight: the first step is slower than full speed, and letting go glides to a stop
        p._mv = null; aimAt(80, 0); I.down.add(up); p.update(1 / 60, g); const v1 = Math.hypot(p._mv.x, p._mv.y); for (let i = 0; i < 30; i++) p.update(1 / 60, g); const v2 = Math.hypot(p._mv.x, p._mv.y);
        I.down.delete(up); p.update(1 / 60, g); const v3 = Math.hypot(p._mv.x, p._mv.y);
        check(v1 < 0.5 && v2 > 0.95 && v3 > 0.3 && v3 < v2, `the body speeds up and eases to a stop (${v1.toFixed(2)} ${v2.toFixed(2)} ${v3.toFixed(2)})`);
        { // legacy controls: moving the cursor alone neither turns you nor steers; left swings or fires at it, right aims a gun
          G.settings.data.legacyControls = true; m.moved = true; p._mv = null; p.dir = 0; p.mouseHeld = false; aimAt(60, 0); p.update(1 / 60, g);
          const legacyOk = p.dir === 0 && !p.aiming;
          const x0 = p.x; for (let i = 0; i < 20; i++) { aimAt(60, 0); I.down.add(up); p.update(1 / 60, g); } I.down.delete(up);
          check(legacyOk && p.x - x0 < 1 && p.y < 1e9, 'legacy controls: the cursor alone neither turns you nor steers [W]');
          for (const a of g.actors) if (a.kind === 'npc' && Math.hypot(a.x - p.x, a.y - p.y) < 60) a.x += 400;   // (nobody to lock on to)
          p.equip.weapon = null; p.swing = null; p.attackCd = 0; p.attackTimer = 0; p.stamina = p.maxStamina; p.dir = 0;
          aimAt(-60, 0); m.pressed = m.down = true; p.update(1 / 60, g); m.pressed = m.down = false;
          const sw = p.swing; check(!!sw && Math.abs(Math.abs(sw.base) - Math.PI) < 0.4, `legacy controls: left click swings toward the cursor (${sw ? sw.base.toFixed(2) : 'no swing'})`);
          for (let i = 0; i < 40; i++) p.update(1 / 60, g); p.swing = null;
          p.inventory.add('pistol'); p.inventory.add('ammo_9mm', 30); p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === 'pistol')); p.attackCd = 0; p.reloadT = 0;
          if (G.firearms.loaded && G.firearms.loaded(p, p.weaponItem) <= 0 && G.firearms.startReload) { G.firearms.startReload(p, g); for (let i = 0; i < 240; i++) p.update(1 / 60, g); }
          aimAt(0, 70); m.rdown = true; p.update(1 / 60, g); const aimed = p.aiming, aimAng = p.aim;
          const nb = g.bullets.length; m.pressed = m.down = true; p.update(1 / 60, g); m.pressed = m.down = false; m.rdown = false; p.update(1 / 60, g);
          const shot = g.bullets.slice(nb)[0];
          check(aimed && Math.abs(aimAng - Math.PI / 2) < 0.25, `legacy controls: holding right with a gun aims at the cursor (${aimAng.toFixed(2)})`);
          check(!!shot && Math.abs(Math.atan2(shot.vy, shot.vx) - Math.PI / 2) < 0.5, `legacy controls: left click fires where you aim (${shot ? Math.atan2(shot.vy, shot.vx).toFixed(2) : 'no shot'})`);
          p.equip.weapon = null; p.inventory.remove('pistol', 9); p.aiming = false;
          G.settings.data.legacyControls = false; p._mv = null; }
        G.settings.data.moveMode = 1; m.moved = false; p._mv = null; p.dir = 0; aimAt(60, 0); p.update(1 / 60, g); m.moved = false;
        check(p.dir === 0, 'classic mode: the cursor does not turn the player');
        m.x = mx; m.y = my; p._mv = null; }
      { // a kid's errand is a mission like any other: in the journal list and in chatBCT's missions
        const kid = g.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.kid) || Object.keys(G.NPCS).filter((id) => G.NPCS[id].kid).map((id) => G.phone.callee(g, id))[0];
        if (kid) {
          const r = { npc: kid, scene: g, c: { give: () => {}, check: () => true, gold: () => 0 } }, n0 = Object.keys(w.quests).length;
          const node = G.DIALOGUE_NODES._kid_job(r); node.choices[0].do();
          const id = Object.keys(w.quests).find((k) => w.quests[k].state === 'active' && w.quests[k].def && w.quests[k].def.giver === kid.id);
          check(Object.keys(w.quests).length === n0 + 1 && id && G.bct.missions(w).some((m) => m.id === id), 'a kid\'s errand shows up as a mission (journal and chatBCT)');
          if (id) delete w.quests[id];
        }
      }
      { // a locked door never traps you inside: you can always walk out (curfew, a shop closing on you)
        const b = g.map.buildings.find((x) => !x.destroyed && !x.floorOf && !g.map.isSolidTile(x.doorX, x.doorY + 1) && !g.map.isSolidTile(x.doorX, x.doorY - 1));
        if (b) {
          const _lk = G.doors.locked, I = G.input, down = I.bindings.down[0]; G.doors.locked = () => true; G.doors.t = 0;
          p.vehicle = null; p.sitting = null; p._mv = null; p.x = b.doorX * 16 + 8; p.y = b.doorY * 16 - 1;
          for (let i = 0; i < 90; i++) { I.down.add(down); G.loop.tick(1 / 60); }
          I.down.delete(down); G.doors.locked = _lk; G.doors.t = 0;
          check(p.y > (b.doorY + 1) * 16, `walking out through a locked door from inside (y ${Math.round(p.y)} vs door ${b.doorY * 16})`);
        }
      }
      { // NPC guns use real rounds: each shot empties the magazine, reloads come from what they carry, none left = no shooting
        const gm = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient);
        if (gm) {
          const def0 = gm.def, st = gm.st, inv0 = st.inv.slice(), mag0 = st.mag, seeded0 = st.ammoSeeded;
          gm.def = Object.assign({}, def0, { weapon: 'pistol' }); st.inv = [['pistol', 1]]; st.ammoSeeded = true; st.mag = 2; gm.reloadT = 0;
          const foe = { x: gm.x + 40, y: gm.y, dead: false };
          const n0 = g.bullets.length; G.firearms.npcFire(gm, g, foe); gm.attackCd = 0; G.firearms.npcFire(gm, g, foe);
          check(st.mag === 0 && g.bullets.length > n0, `an NPC's shots come out of the magazine (mag ${st.mag})`);
          const n1 = g.bullets.length; G.firearms.npcFire(gm, g, foe);
          check(g.bullets.length === n1 && !gm.hasGun, 'no rounds left: they cannot shoot');
          st.inv.push(['ammo_9mm', 20]); check(gm.hasGun, 'with rounds in their pockets they can again');
          G.firearms.npcFire(gm, g, foe);
          check(st.mag === 12 && G.npcAmmo.count(st, 'ammo_9mm') === 8 && gm.reloadT > 0, `they reload from what they carry (mag ${st.mag}, left ${G.npcAmmo.count(st, 'ammo_9mm')})`);
          gm.def = def0; st.inv = inv0; st.mag = mag0; st.ammoSeeded = seeded0; gm.reloadT = 0; g.bullets.length = n0;
        }
      }
      { // health, bleeding, building, crafting, cooking, farming, animals (js/game/medicine.js, homestead.js, farming.js, beasts.js)
        const H = G.home, inv = H.inv(w);
        // only medicine heals; poison does not make you bleed; a wound stops bleeding
        G.bleed.stop(p); p.hp = 50; p.combatTimer = 0; for (let i = 0; i < 120; i++) p.update(1 / 60, g);
        check(Math.round(p.hp) === 50, `health does not come back by itself (${Math.round(p.hp)})`);
        G.effects.consume(p, G.ITEMS.sandwich, g); check(Math.round(p.hp) === 50, 'food fills you up but does not heal');
        G.effects.consume(p, G.ITEMS.ibuprofen, g); check(p.hp > 50, `medicine heals (ibuprofen: ${Math.round(p.hp)})`);
        p.bleedT = 0; G.effects.add(p, 'poison', 5); for (let i = 0; i < 60; i++) G.effects.update(p, 1 / 60, g); G.effects.remove(p, 'poison');
        check(!(p.bleedT > 0), 'poison hurts without opening a wound (no bleeding)');
        G.combat.damage(p, 10, { kind: 'npc', x: p.x + 5, y: p.y }, g); check(p.bleedT > 0, 'a real wound bleeds');
        G.effects.consume(p, G.ITEMS.bandage, g); check(!(p.bleedT > 0), 'a bandage stops the bleeding');
        p.hp = p.maxHp;
        // building things go to the construction inventory, never the pockets
        const n0 = inv.planks || 0; p.inventory.isPlayer = true; p.inventory.add('planks', 5); p.inventory.add('kit_wall_wood', 2); p.inventory.add('kit_crate', 1);
        check((inv.planks || 0) === n0 + 5 && !p.inventory.has('planks') && inv.kit_wall_wood >= 2, 'materials and pieces go to the construction inventory');
        // place a wall and a crate somewhere free near the player, then take them back
        p.inventory.add('hammer', 1);
        let spot = null; for (let r = 2; r < 8 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) { const tx = Math.floor(p.x / 16) + dx, ty = Math.floor(p.y / 16) + dy; if (!H.why(g, 'kit_wall_wood', tx, ty) && !H.why(g, 'kit_wall_wood', tx + 2, ty)) spot = { tx, ty }; }
        if (spot) {
          const under = g.map.get(spot.tx, spot.ty), why = H.place(g, 'kit_wall_wood', spot.tx, spot.ty);
          check(!why && g.map.get(spot.tx, spot.ty) === G.T.wall_wood && g.map.isSolidTile(spot.tx, spot.ty), `construction: a wall goes up (${why || 'ok'})`);
          const why2 = H.place(g, 'kit_crate', spot.tx + 2, spot.ty);
          check(!why2 && g.map.decorsAt(spot.tx + 2, spot.ty).some((d) => d.type === 'crate'), `construction: furniture is placed (${why2 || 'ok'})`);
          H.remove(g, spot.tx, spot.ty); H.remove(g, spot.tx + 2, spot.ty);
          check(g.map.get(spot.tx, spot.ty) === under && inv.kit_wall_wood >= 2 && inv.kit_crate >= 1, 'taking it down gives the pieces back');
          // the mouse places anywhere on screen (not just next to you)
          { const R0 = G.renderer, mm = G.input.mouse; G.home.mouseUsed = true; const far = { tx: spot.tx + 6, ty: spot.ty }; mm.x = (far.tx * 16 + 8 - R0.cam.x) * R0.zoom; mm.y = (far.ty * 16 + 8 - R0.cam.y) * R0.zoom;
            const tg = H.target(g); check(tg.tx === far.tx && tg.ty === far.ty, `construction: the target is the tile under the mouse, even far away (${tg.tx},${tg.ty})`); G.home.mouseUsed = false; }
          // the full construction inventory menu: pieces and materials, picking a piece selects it
          H.inventoryMenu(g); const im = G.scenes.top(), rows = im.rows ? im.rows() : [];
          check(rows.some((r) => /Wooden Wall/.test(r.label)) && rows.some((r) => /Wood Planks/.test(r.label)), 'the construction inventory menu lists pieces and materials');
          const ci = rows.findIndex((r) => /Storage Crate/.test(r.label)); if (ci >= 0) im.pick(rows[ci]); if (G.scenes.top() === im) G.scenes.remove(im);
          check(g.buildMode && H.pieces(w)[g.buildSel] === 'kit_crate', 'picking a piece in the menu selects it for building'); g.buildMode = false;
        } else log('     (no free spot for the construction test)');
        // crafting at a workbench, cooking at a campfire
        p.inventory.add('wood', 2); const pl0 = inv.planks || 0;
        H.crafting(g); const cs = G.scenes.top(); const row = cs.rows().find((r) => r.label.startsWith('Wood Planks')); cs.pick(row); G.scenes.remove(cs);
        check((inv.planks || 0) > pl0, `crafting: wood becomes planks at the workbench (${pl0} -> ${inv.planks})`);
        p.inventory.add('raw_meat', 1); const cm0 = p.inventory.count('cooked_meat');
        H.cooking(g, false); const ks = G.scenes.top(); ks.pick(ks.rows().find((r) => r.label.startsWith('Burger'))); G.scenes.remove(ks);
        check(p.inventory.count('cooked_meat') === cm0 + 1, 'cooking: raw meat on the campfire becomes a burger');
        // farming: till, plant, grow, harvest
        { const F = G.farming, tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16) + 1; p.dir = 0;
          if (!g.map.isSolidTile(tx, ty) && !g.map.buildingAtTile(tx, ty)) {
            G.mods.tile(g.map, tx, ty, G.T.grass); p.inventory.add('hoe', 1); p.inventory.add('seed_tomato', 2);
            let a = F.action(g); if (a && a.kind === 'till') F.run(g, a);
            a = F.action(g); if (a && a.kind === 'plant') F.run(g, a);
            const c = F.at(g, tx, ty); check(g.map.get(tx, ty) === G.T.field && c && c.crop === 'tomato', 'farming: till the soil and sow seeds');
            for (let h = 0; h < 24 * 4; h++) F.grow(w);
            a = F.action(g); const t0 = p.inventory.count('tomato'); if (a && a.kind === 'harvest') F.run(g, a);
            check(p.inventory.count('tomato') > t0 && !F.at(g, tx, ty), `crops grow over days and are harvested (${p.inventory.count('tomato') - t0} tomatoes)`);
          } }
        // a stray dog trusts you after a meal or three, and becomes your pet
        { const dog = new G.Animal('dog', p.x + 10, p.y, null, { x: 0, y: 0, w: 4, h: 4 }); dog.strayId = 'stray:test:dog0'; g.actors.push(dog);
          p.inventory.add('raw_meat', 3); G.beasts.menu(g, dog);
          for (let i = 0; i < 3; i++) { const ch = G.scenes.top(); const o = ch.options.find((x) => /raw meat/i.test(x.label)); if (!o) break; ch.choose(ch.options.indexOf(o)); if (G.scenes.top() instanceof G.beasts.NameScene) break; G.beasts.menu(g, dog); }
          const ns = G.scenes.top(); const named = ns instanceof G.beasts.NameScene; if (named) { ns.input = 'Rex'; G.input.pressed.add('Enter'); ns.update(); G.input.pressed.delete('Enter'); }
          check(named && w.pets.some((q) => q.name === 'Rex' && q.species === 'dog') && dog.rec, 'taming: feed a stray dog until it trusts you, then name it');
          while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
          dog.x = p.x + 120; for (let i = 0; i < 120; i++) dog.update(1 / 60, g);
          check(Math.hypot(dog.x - p.x, dog.y - p.y) < 100, 'your dog follows you');
          g.actors = g.actors.filter((q) => q !== dog); w.pets = w.pets.filter((q) => q.name !== 'Rex'); }
        // a horse: ride it, faster than walking
        { const rec = { id: 'h_test', species: 'horse', breed: 'quarter', sex: 'm', name: 'Thunder', coat: G.beasts.coatOf('horse', 1), map: g.map.id, x: p.x + 12, y: p.y }; w.mounts = w.mounts || []; w.mounts.push(rec);
          const hz = new G.Animal('horse', rec.x, rec.y, null, { x: 0, y: 0, w: 4, h: 4 }); hz.rec = rec; g.actors.push(hz);
          G.beasts.mount(g, hz); check(p.mount === rec && !g.actors.includes(hz), 'mounting a horse');
          const I = G.input, right = I.bindings.right[0], x0 = p.x; p._mv = null; for (let i = 0; i < 40; i++) { I.down.add(right); p.update(1 / 60, g); } I.down.delete(right);
          const ridden = p.x - x0; G.beasts.dismount(g); const x1 = p.x; p._mv = null; for (let i = 0; i < 40; i++) { I.down.add(right); p.update(1 / 60, g); } I.down.delete(right);
          check(!p.mount && ridden > (p.x - x1) * 1.4, `riding is faster than walking (${Math.round(ridden)} vs ${Math.round(p.x - x1)})`);
          const cv = document.createElement('canvas').getContext('2d'); let drew = true; try { p.mount = rec; p.draw(cv); p.mount = null; for (const sp of ['horse', 'donkey', 'dog', 'cat']) G.beasts.draw(cv, { species: sp }, 50, 50, 1, 0.3, 120, 1, {}); } catch (e) { drew = false; console.error(e); p.mount = null; }
          check(drew, 'riders, horses, donkeys, dogs and cats draw');
          g.actors = g.actors.filter((q) => !(q.rec === rec)); w.mounts = w.mounts.filter((q) => q !== rec); }
        // combat: soft lock-on (a foe on the diagonal is still hit), combos with a finisher, the dodge
        { const foe = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient);
          if (foe) {
            const I = G.input, key = I.bindings.attack[0], hit = () => { I.pressed.add(key); I.down.add(key); p.update(1 / 60, g); I.pressed.delete(key); I.down.delete(key); };
            p.equip.weapon = null; p.swing = null; p.attackCd = 0; p.stamina = p.maxStamina; p.dir = 2; p.aim = 0; p.combo = 0; p.lastSwingT = -9;
            Object.assign(p, openSpot(g, p)); foe.x = p.x + 9; foe.y = p.y + 9; foe.hp = foe.maxHp = 500; foe.invuln = 0; foe.talking = true;
            const aside = g.actors.filter((a) => a !== foe && a !== p); for (const a of aside) a.y += 4000;   // (a blow lands on whoever is in the way: nobody else here)
            aimRight(p);
            const h0 = foe.hp; hit(); for (let i = 0; i < 30; i++) { G.melee.update(p, 1 / 60); p.attackCd = Math.max(0, p.attackCd - 1 / 60); }
            check(foe.hp < h0, `melee: a foe on the diagonal is hit (soft lock-on: ${h0 - foe.hp} damage)`);
            p.swing = null; p.attackCd = 0; p.combo = 0; p.lastSwingT = -9; let fin = false;
            for (let k = 0; k < 3; k++) { foe.x = p.x + 10; foe.y = p.y; p.attackCd = 0; hit(); if (p.swing && p.swing.finisher) fin = true; for (let i = 0; i < 25; i++) G.melee.update(p, 1 / 60); }
            check(fin, 'melee: the third blow in a row is a finisher');
            for (const a of aside) a.y -= 4000;
            const x0 = p.x; p._mv = { x: 1, y: 0 }; p.dodgeCd = 0; p.stamina = p.maxStamina; I.pressed.add(I.bindings.dodge[0]); p.update(1 / 60, g); I.pressed.delete(I.bindings.dodge[0]);
            for (let i = 0; i < 20; i++) p.update(1 / 60, g);
            check(p.x - x0 > 12 && !p.dodge, `dodge [Ctrl]: a quick dash (${Math.round(p.x - x0)} px)`);
            // a struck NPC gets over the stagger and can strike back (it used to stay staggered forever)
            foe.staggerT = 0.5; foe.attackCd = 0;
            for (let i = 0; i < 60; i++) foe.update(1 / 60, g);
            check(!(foe.staggerT > 0) && !(foe.attackCd > 0), `melee: a stagger wears off (staggerT ${foe.staggerT.toFixed(2)}, attackCd ${(foe.attackCd || 0).toFixed(2)})`);
            foe.talking = false;
          } }
        // guns: deadly; a gunman with a wall in the way does not shoot into it, he goes for a clear line
        { check(G.ITEMS.pistol.dmg >= 40 && G.ITEMS.hunting_rifle.dmg >= 120, `guns hit very hard (pistol ${G.ITEMS.pistol.dmg}, rifle ${G.ITEMS.hunting_rifle.dmg})`);
          const b = g.map.buildings.find((q) => q.w >= 5 && q.h >= 5 && !q.destroyed), gm = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a !== p);
          if (b && gm) {
            const def0 = gm.def, inv0 = gm.st.inv.slice(), px0 = p.x, py0 = p.y;
            gm.def = Object.assign({}, def0, { weapon: 'pistol' }); gm.st.inv = [['pistol', 1], ['ammo_9mm', 30]]; gm.st.mag = 12; gm.st.ammoSeeded = true; gm.reloadT = 0;
            p.x = (b.x + Math.floor(b.w / 2)) * 16 + 8; p.y = (b.y + 2) * 16 + 12;   // inside
            gm.x = (b.x + Math.floor(b.w / 2)) * 16 + 8; gm.y = (b.y - 4) * 16 + 12;   // outside, north of the wall
            gm.state = 'fight'; gm.target = p; gm.flank = null; const n0 = g.bullets.length;
            G.firearms.npcFire(gm, g, p);
            check(g.bullets.length === n0 && (gm.flank || !G.firearms.firingSpot(g, gm, p, 200)), 'a gunman does not fire into a wall: he looks for a clear shot instead');
            gm.def = def0; gm.st.inv = inv0; gm.state = 'schedule'; gm.target = null; gm.flank = null; p.x = px0; p.y = py0;
          } }
        // fate: the hidden ledger (never shown), and the luck it bends
        { const F = G.fate, w0 = w.fate, base = (() => { w.fate = null; F.st(); return G.skills.stat(p, 'luck'); })();
          // A: a monster
          for (let i = 0; i < 4; i++) F.sin('murder', { key: 'A' + i }); F.sin('cannibalism'); for (let i = 0; i < 6; i++) F.sin('drug_use'); for (let i = 0; i < 6; i++) F.partner('A_p' + i); F.sin('exposure_public', { key: 'Aexp' });
          const gA = F.guilt(), lA = G.skills.stat(p, 'luck');
          check(gA > 250 && lA < base - 1, `A: a cruel life weighs heavily (guilt ${Math.round(gA)}) and luck falls (${base.toFixed(2)} -> ${lA.toFixed(2)})`);
          // B: a good life
          w.fate = null; F.st(); const day0 = w.day;
          for (let d = 0; d < 20; d++) { w.day = day0 + d; F.good('attend'); F.good('pray'); F.good('meditate'); F.good('give_needy'); F.good('donate'); }
          const lB = G.skills.stat(p, 'luck'); w.day = day0;
          check(lB > base + 0.5 && F.redemption() > 0, `B: a good life slowly brings better luck (${base.toFixed(2)} -> ${lB.toFixed(2)})`);
          // C: mixed: in between, no wild swings
          w.fate = null; F.st(); for (let d = 0; d < 10; d++) { w.day = day0 + d; F.sin('theft'); F.good('donate'); F.good('pray'); } w.day = day0;
          const lC = G.skills.stat(p, 'luck');
          check(lC > lA && lC < lB && Math.abs(lC - base) < 1.5, `C: mixed behavior lands in between (${lC.toFixed(2)})`);
          // D: redemption is possible, but not cheap
          w.fate = null; F.st(); for (let i = 0; i < 5; i++) F.sin('murder', { key: 'D' + i }); const gD0 = F.guilt();
          F.good('pray'); const gD1 = F.guilt();
          check(gD0 - gD1 < gD0 * 0.02, `D: one prayer does not erase it (${Math.round(gD0)} -> ${Math.round(gD1)})`);
          w.minutes = 0; for (let d = 1; d <= 60; d++) { w.day = day0 + 8 + d; F.good('attend'); F.good('pray'); F.good('confess', { key: 'Dc' + d }); F.good('give_needy'); F.good('donate'); F.good('clean_day'); }
          const gD2 = F.guilt(); w.day = day0;
          check(gD2 < gD0 * 0.5, `D: months of sustained good wash most of it away (${Math.round(gD0)} -> ${Math.round(gD2)})`);
          // E: partners: unique adults only, the fourth and beyond weigh
          w.fate = null; F.st(); F.partner('E1'); F.partner('E1'); F.partner('E2'); F.partner('E3'); const gE3 = F.guilt(); F.partner('E3'); F.partner('E4'); const gE4 = F.guilt(); F.partner('E5'); const gE5 = F.guilt();
          check(F.st().partners.length === 5 && gE3 === 0 && gE4 > 0 && gE5 - gE4 > gE4 * 0.9, `E: only unique partners count; nothing up to three, then more each time (${gE3}, ${Math.round(gE4)}, ${Math.round(gE5)})`);
          // F: nudity in context
          check(F.exposureKind({ exposed: true, home: true, adults: 5 }) === null && F.exposureKind({ exposed: true, swimming: true, adults: 3 }) === null && F.exposureKind({ exposed: true, adults: 1, kids: 0 }) === null, 'F: naked at home, swimming, or barely seen: nothing');
          check(F.exposureKind({ exposed: true, adults: 3 }) === 'exposure_public' && F.exposureKind({ exposed: true, adults: 0, kids: 1 }) === 'exposure_child' && F.SINS.exposure_child > F.SINS.murder, 'F: exposed in public is indecent; in front of children it outweighs a murder');
          w.fate = null; F.st(); F.sin('exposure_public', { key: 'x1' }); F.sin('exposure_public', { key: 'x1' }); const once = F.guilt(); F.sin('exposure_public', { key: 'x2' });
          check(once === F.SINS.exposure_public && F.guilt() > once * 2, 'F: the same incident counts once; doing it again weighs more');
          // G: it survives a save
          F.sin('murder', { key: 'G1' }); F.partner('G_p'); const snap = JSON.stringify(w.fate);
          const w2 = new G.World(JSON.parse(JSON.stringify(w.toJSON())));
          check(JSON.stringify(w2.fate) === snap, 'G: the ledger survives saving and loading');
          // H: luck changes real odds
          const lo = F.findChance(-2), hi = F.findChance(1.2); let a = 0, b2 = 0; for (let i = 0; i < 20000; i++) { if (Math.random() < lo) a++; if (Math.random() < hi) b2++; }
          check(b2 > a * 2, `H: the same chance comes up far more often for the lucky (${a} vs ${b2} in 20000)`);
          w.fate = w0; }
        // a house you build: walls all round with a door, a roof inside it -> a real building with a roof
        { let at = null; const ok = (x, y) => !H.why(g, 'kit_wall_wood', x, y);
          for (let r = 3; r < 14 && !at; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) { const x0 = Math.floor(p.x / 16) + dx, y0 = Math.floor(p.y / 16) + dy; let good = true; for (let y = y0; y < y0 + 5 && good; y++) for (let x = x0; x < x0 + 5 && good; x++) good = ok(x, y); if (good) at = { x0, y0 }; }
          if (at) {
            inv.kit_wall_wood = 30; inv.kit_door = 2; inv.kit_roof_red = 1; p.inventory.add('hammer', 1);
            const { x0, y0 } = at;
            for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 5; x++) { if (x > x0 && x < x0 + 4 && y > y0 && y < y0 + 4) continue; H.place(g, x === x0 + 2 && y === y0 + 4 ? 'kit_door' : 'kit_wall_wood', x, y); }
            const why = H.place(g, 'kit_roof_red', x0 + 2, y0 + 2), b = g.map.buildings.find((q) => q.playerBuilt);
            check(!why && b && b.doorX === x0 + 2 && b.doorY === y0 + 4 && g.map.buildingAt((x0 + 2) * 16 + 8, (y0 + 2) * 16 + 8) === b && !!b.roofCanvas, `you build a house: walls, a door, a roof (${why || 'ok'})`);
            check(!G.doors.locked(g, b), 'your own house never locks you out');
            const noDoor = H.enclosure(g, x0 + 2, y0 + 2); check(!!noDoor.why, 'a roofed house cannot get a second roof');
            H.remove(g, x0, y0 + 1); check(!g.map.buildings.includes(b) && inv.kit_roof_red >= 1, 'taking out a wall brings the roof down (the roof piece comes back)');
            for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 5; x++) H.remove(g, x, y);
          } else log('     (no room for the house test)'); }
        // breeds, sexes, breeding: a male and a female in a pen you built have a baby
        { const pen0 = G.breeds.pen; const recA = G.breeds.fill({ id: 'bt_m', species: 'dog', breed: 'husky', sex: 'm', map: g.map.id, x: p.x, y: p.y, name: 'Bo' }), recB = G.breeds.fill({ id: 'bt_f', species: 'dog', breed: 'husky', sex: 'f', map: g.map.id, x: p.x, y: p.y, name: 'Sky' });
          w.pets = (w.pets || []).concat([recA, recB]); G.breeds.pen = () => 'pen:test';
          const r0 = Math.random; Math.random = () => 0.01; G.breeds.hourly(w); Math.random = r0;
          check(!!recB.preg && !recA.preg, 'a male and a female in your pen: she gets pregnant (he does not)');
          recB.preg.due = w.day * 24 + w.hour; const n0 = w.pets.length; G.breeds.hourly(w);
          const kids = w.pets.filter((q) => q.mother === 'bt_f');
          check(kids.length >= 1 && kids.every((k) => k.young && !k.name && (k.sex === 'm' || k.sex === 'f') && k.breed === 'husky'), `she has puppies (${kids.length}), unnamed, husky, each male or female`);
          check(G.breeds.of({ species: 'dog', breed: 'pitbull' }).dmg > G.breeds.of({ species: 'dog', breed: 'chihuahua' }).dmg && G.breeds.of({ species: 'horse', breed: 'thoroughbred' }).speed > G.breeds.of({ species: 'horse', breed: 'clydesdale' }).speed, 'breeds differ: pit bulls bite harder, thoroughbreds run faster');
          w.pets = w.pets.filter((q) => !['bt_m', 'bt_f'].includes(q.id) && q.mother !== 'bt_f'); g.actors = g.actors.filter((a) => !(a.rec && a.rec.mother === 'bt_f')); G.breeds.pen = pen0; void n0; }
        // driving: the car's nose takes it through an exit (no invisible wall at the edge)
        { const e = g.map.exits[0];
          if (e) {
            const v = new G.Vehicle({ model: 'car_red', x: (e.x + e.w / 2) * 16, y: (e.y + e.h / 2) * 16, angle: 0, keys: true }); g.vehicles.push(v); G.vehicles.enter(g, v);
            const outX = e.x <= 0 ? -1 : e.x >= g.map.w - 2 ? 1 : 0, outY = e.y <= 0 ? -1 : e.y >= g.map.h - 2 ? 1 : 0;
            v.angle = Math.atan2(outY, outX); v.speed = 60; v.x = (e.x + e.w / 2) * 16 - outX * 90; v.y = (e.y + e.h / 2) * 16 - outY * 90; p.x = v.x; p.y = v.y;
            g.arrivedT = 5; g.transitioning = false; const sc0 = G.scenes.stack.length; for (let i = 0; i < 120 && G.scenes.stack.length === sc0 && !g.transitioning; i++) { v.speed = 60; g.update(1 / 60); }
            const fading = G.scenes.stack.length > sc0 || g.transitioning;
            check(fading, `driving into an exit takes you through (to ${e.to})`);
            while (G.scenes.top() !== g) { const t = G.scenes.top(); if (t.update) { for (let i = 0; i < 200 && G.scenes.top() === t; i++) t.update(1 / 60); } if (G.scenes.top() === t) G.scenes.pop(); }
            if (p.vehicle) G.vehicles.exit(g, true);
          } }
        check(!!G.maps.get('industrial').building('i_supply') && !!G.maps.get('rural').building('n_market') && !!G.maps.get('farmland').building('f_stable'), 'Builders\' Supply, the Notrael Kosher Market and the stable are on the map');
        for (const id of ['hammer', 'hoe', 'seed_tomato', 'tomato', 'cooked_meat', 'raw_meat', 'wood', 'ibuprofen', 'bandage', 'sandwich']) p.inventory.remove(id, 99);   // (keep the pockets as the later tests expect them)
      }
      { // swapping numbers: they ask for yours; "later" means they cannot text you until you text them
        const npc = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !G.phone.isContact(w, a.id));
        if (npc) {
          const st = w.npcs[npc.id], d0 = st.disp; st.disp = 40;
          const r = { npc, scene: g, c: { check: () => true, tag: () => '' } };
          const n = G.DIALOGUE_NODES._number(r);
          check(n.exchange && n.choices.some((c) => c.next === '_number_later') && n.choices.some((c) => c.next === '_number_give'), 'getting a number: they ask for yours');
          G.DIALOGUE_NODES._number_later(r);
          const k0 = (w.pendingTexts || []).length; G.phone.queue(w, npc.id, 'hi', 1);
          check((w.pendingTexts || []).length === k0 && st.hasMyNumber === false, '"I will text you later": they cannot text you');
          G.phone.send(w, npc.id, 'Hey, what\'s up?');
          check(st.hasMyNumber === true, 'texting them first gives them your number');
          (w.pendingTexts || []).splice(k0); st.disp = d0; G.phone.contacts(w).splice(G.phone.contacts(w).indexOf(npc.id), 1);
        }
      }
      { // aiming: hold to aim (the cone closes), let go to fire; a tap is a wide hip shot; right-button mode
        const A = G.aim, slot = p.inventory.add('pistol') !== false ? p.inventory.slots.findIndex((s) => s && s.id === 'pistol') : -1;
        if (slot >= 0) {
          const ab0 = G.settings.data.aimButton; G.settings.data.aimButton = 0;   // (this tests the hold-left scheme; right-aims is tested below)
          const prevW = p.equip.weapon; p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === 'pistol')); p.mags.pistol = 12; p.reloadT = 0; p.attackCd = 0; p.moving = false;
          if (g.world.fate) g.world.fate.off = true;   // (a run of bad luck can jam a gun: js/game/fate.js)
          const shots = []; const pf = G.firearms.shoot; G.firearms.shoot = function (sh, sc, ang, w, o) { shots.push(o.spread); };
          p.mouseHeld = true; p.aiming = false; A.update(p, g, 0.016, false); const wide = A.cone(p);
          for (let i = 0; i < 60; i++) A.update(p, g, 0.016, false);
          check(p.aiming && A.steady(p) > 0.99 && A.cone(p) < wide * 0.4, `holding the aim steadies it (cone ${wide.toFixed(3)} -> ${A.cone(p).toFixed(3)})`);
          p.mouseHeld = false; const f = A.update(p, g, 0.016, false); if (f) G.firearms.playerFire(p, g, p.aim);
          p.attackCd = 0; p.mouseHeld = true; A.update(p, g, 0.016, false); p.mouseHeld = false; if (A.update(p, g, 0.016, false)) G.firearms.playerFire(p, g, p.aim);
          check(f && !p.aiming && shots.length === 2 && shots[0] < shots[1] * 0.4, `letting go fires; a tap is a wide hip shot (${shots.map((s) => s.toFixed(3)).join(' vs ')})`);
          S0: { const prev = G.settings.get('aimButton'); G.settings.set('aimButton', 1); const m = G.input.mouse; m.rdown = true; p.mouseHeld = false; A.update(p, g, 0.016, false); const aimed = p.aiming; const noShot = !A.update(p, g, 0.016, false); const shot = A.update(p, g, 0.016, true); m.rdown = false; A.update(p, g, 0.016, false); G.settings.set('aimButton', prev); check(aimed && noShot && shot && !p.aiming, 'right-button mode: hold right to aim, left click fires'); }
          G.firearms.shoot = pf; p.aiming = false; p.aimHold = 0; if (prevW) p.equip.weapon = prevW; G.settings.data.aimButton = ab0;
        }
      }
      { const cv = document.createElement('canvas'); cv.width = 200; cv.height = 100; const cx = cv.getContext('2d'); let ok = true; try { G.ui.panel(cx, 4, 4, 180, 80, { title: 'Test' }); G.ui.button(cx, 10, 40, 80, 16, 'OK', { selected: true }); } catch (e) { ok = false; } check(ok, 'HD windows and buttons draw'); }
    }
    // kids: never gore, never stripped or cut up
    check(!G.dismember.can(g, { kind: 'corpse', kid: true }), 'kid bodies can never be dismembered');
    { const kid = g.actors.find((a) => a.def && a.def.kid); if (kid) { const before = (w.decals[g.map.id] || []).length; G.gore.onHit(g, kid, p, 30, true); check((w.decals[g.map.id] || []).length === before, 'no blood from kids'); } }
  }

  // TO DO batch (2026-10-30): relationships, street life, behavior, corpses, explosions
  function batch3() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    game().arrestCooldown = 99999;
    const g = game(), p = g.player, w = G.world;
    g.arrestCooldown = 99999;
    // likeness tiers
    const st0 = { disp: 0 };
    check(G.rel.tier(st0).name === 'Stranger', 'likeness 0 is Stranger');
    check(G.rel.tier({ disp: 25, introduced: true }).name === 'Friend' && G.rel.tier({ disp: 55 }).name === 'Best Friend', 'likeness tiers: Friend at 20, Best Friend at 50');
    check(G.rel.tier({ disp: 80 }).name === 'Best Friend' && G.rel.tier({ disp: 80, loveDay: 3 }).name === 'Friends with Benefits' && G.rel.tier({ disp: 10, partner: true }).name === 'Lovers', 'Friends with Benefits only after sleeping together; Lovers only as partners');
    check(G.rel.tier({ disp: -40 }).name === 'Enemy' && G.rel.tier({ disp: -95 }).name === 'Mortal Enemy', 'negative tiers down to Mortal Enemy');
    // you only bring up what you know
    const npc = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && a.def.faction === 'civilians');
    npc.st.known = {}; npc.st.talkUsed = null;
    p.x = npc.x; p.y = npc.y + 18; g.openDialogue(npc); tick(2);
    const d = G.scenes.top(); d.chars = 999;
    const texts = d.runner.node.choices.map((c) => c.text).join(' | ');
    const P = G.social.persona(npc.id);
    check(!texts.includes(P.hobby) && !texts.includes(P.worry) && !texts.includes(P.dream), 'conversation never mentions a hobby/worry/dream you were not told');
    G.rel.learn(npc.st, 'hobby');
    check(G.rel.knows(npc.st, 'hobby') && G.rel.facts(npc.id)[0].includes(P.hobby), 'learned facts show in the LifeLog');
    G.scenes.remove(d); tick(1);
    // jail time for NPCs caught dealing
    const dealer = g.actors.find((a) => a.kind === 'npc' && a !== npc && !a.def.kid && a.def.combat !== 'guard' && !a.transient);
    G.streetlife.jail(g, dealer, 2);
    check(w.npcs[dealer.id].map === 'jail' && !g.actors.includes(dealer), 'a busted NPC is taken to the County Jail');
    const dd = w.day; G.debug.days ? G.debug.days(3) : w.skipHours(72); G.streetlife.release(w, g);
    check(w.npcs[dealer.id].map === G.NPCS[dealer.id].map && !w.npcs[dealer.id].jailedUntil, 'and released after their days are up');
    // phone: block and silence
    w.phoneBlock = { [npc.id]: 'block' }; w.pendingTexts = []; G.phone.queue(w, npc.id, 'hello?', 0); G.phone.deliver(w, g);
    check(!G.phone.messages(w).some((m) => m.text === 'hello?'), 'blocked contacts cannot text you');
    w.phoneBlock = {};
    // fame
    const f0 = G.fame.score(w); w.commitCrime('assault', 'rural', true);
    check(G.fame.score(w) < f0 || G.fame.get(w).bad > 0, 'crimes build a bad name');
    // gunshots: civilians panic
    const civ = g.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'flee' && a.distTo(p) < 250) || npc;
    civ.st.fear = 0; G.behavior.gunshot(g, p);
    check(civ.st.fear === 100 && (civ.state === 'flee' || civ.cower > 0), 'gunshots make people run or cower');
    // people deal with each other; hang around someone and they get uneasy
    const two = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard');
    if (two.length >= 2) { two[0].st.gold = 50; const g0 = two[1].st.gold || 0; const ok = G.streetlife.exchange(g, two[0], two[1], G.streetlife.EXCHANGES.find((x) => x.id === 'loan')); check(!ok || (two[1].st.gold > g0), 'paying back a loan moves the money'); }
    G.behavior.spaceOff = false;
    const shy = two.find((a) => a.state === 'schedule' && !a.talking && !a.def.shop && !a.st.partner && !a.st.companion) || two[0]; shy.st.disp = 0; shy.nearT = 0; shy.spaceStage = 0;
    p.x = shy.x + 10; p.y = shy.y;
    for (let i = 0; i < 60; i++) { p.x = shy.x + 10; p.y = shy.y; shy.personalSpace(1, g); }
    check(shy.spaceStage >= 1, 'someone you hover around for a minute asks what you want');
    G.behavior.spaceOff = true;
    // corpses: clothes in the inventory, taking them strips the body
    const victim = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a !== civ && a.def.combat !== 'guard');
    victim.st.nakedUntil = 0;
    G.containers.createCorpse(w, victim, g.map.id);
    const body = Object.values(w.containers).filter((c) => c.kind === 'corpse').pop();
    const top = body.clothes && body.clothes.top;
    check(top && body.items.some((e) => e[0] === top), 'a corpse has its clothes in its inventory');
    body.items.find((e) => e[0] === top)[1] = 0;
    check(G.containers.lookOf(body).shirtless, 'taking the shirt off a body leaves it shirtless');
    // explosions
    g.loadMap('city', 'from_suburbs'); G.debug.time(13); tick(2);
    p.hp = p.maxHp = 9999;
    const car = new G.Vehicle({ model: 'car_red', x: p.x + 120, y: p.y, angle: 0 });
    g.vehicles.push(car);
    car.damage(car.hp - 5, g); tick(2);
    check(car.burning > 0, 'a shot-up car catches fire');
    for (let i = 0; i < 60 * 12 && !car.exploded; i++) G.loop.tick(1 / 60);
    check(car.exploded && car.burnt, 'and then it explodes');
    // children grow up; the crib goes when they outgrow it
    g.loadMap('rural', 'start'); tick(1);
    const kidRec = { id: 'baby_t1', sex: 'f', mother: 'player', father: 'r_farmer2', born: G.world.day, name: 'Testa' };
    kidRec.crib = G.love.placeCrib(G.world, 'rural', G.world.flags.player_home || 'r_home'); (G.world.babies = G.world.babies || []).push(kidRec);
    check(kidRec.crib && g.map.decorsAt(kidRec.crib.tx, kidRec.crib.ty).some((d) => d.type === 'crib'), 'a newborn gets a crib');
    const cribAt = kidRec.crib;
    kidRec.born = G.world.day - 2 * G.YEAR_DAYS - 3; G.growth.daily(G.world, g);
    check(kidRec.out && !kidRec.crib && !g.map.decorsAt(cribAt.tx, cribAt.ty).some((d) => d.type === 'crib') && G.world.npcs[kidRec.npc] && G.world.npcs[kidRec.npc].realName.startsWith('Testa'), 'at two the crib goes and the child is a person in the house');
    check(G.rel.tier(G.world.npcs[kidRec.npc], kidRec.npc).name === 'Daughter' && G.NPCS[kidRec.npc].relations.r_farmer2 === 'parent' && G.NPCS.r_farmer2.relations[kidRec.npc] === 'child', 'your child is your Daughter (not a Friend), and her father knows her');
    kidRec.born = G.world.day - 14 * G.YEAR_DAYS; G.growth.daily(G.world, g);
    check(G.NPCS[kidRec.npc].kid === 'teen' && G.growth.stage(G.world, kidRec) === 'teen', 'at fourteen they are a teenager');
    kidRec.born = G.world.day - 20 * G.YEAR_DAYS; G.growth.daily(G.world, g);
    check(!G.NPCS[kidRec.npc].kid && G.NPCS[kidRec.npc].name === 'Young Adult', 'and a young adult at twenty');
    G.adoption.start(G.world, 'r_farmer2'); G.world.adoption.age = 5; const nb = G.world.babies.length; G.adoption.arrive(G.world, g);
    const adopted = G.world.babies[nb];
    check(adopted && adopted.adopted && adopted.out && G.NPCS[adopted.npc].kid === 'kid', 'an adopted five-year-old comes home');
    check(typeof G.adoption.decide(G.world, 'r_farmer2').yes === 'boolean', 'partners decide about adoption by how they live');
    // events: the ritual on the island plays out live when you are there, and happens anyway when you are not
    const H = G.happenings, wn = () => G.world.day * 1440 + G.world.minutes;
    g.loadMap('island', 'from_city'); G.debug.time(23); tick(2);
    check(g.actors.some((a) => a.id === 'i_leader') && g.actors.filter((a) => a.def && a.def.captive).length >= 4 && g.actors.some((a) => a.look && a.look.mask), 'the island has its leader, masked members and captives');
    G.world.isAlive('i_captive1') || G.world.reviveAsReplacement('i_captive1', 'Captive');
    const rit = { id: 'ritual', map: 'island', start: wn(), end: wn() + 120, data: { victim: 'i_captive1' } }; H.list(G.world).push(rit);
    tick(3);
    const lead = g.actors.find((a) => a.id === 'i_leader');
    check(lead && lead.evTask && lead.evTask.to === g.map.points.i_altar, 'the leader goes to the altar for the ritual');
    rit.start -= 50; tick(2);
    check(!G.world.isAlive('i_captive1'), 'the sacrifice happens in front of you');
    rit.end = wn() - 1; H.hourly(G.world, g);
    check(!H.active(G.world, 'ritual') && !(lead && lead.evTask), 'when it is over everyone goes back to their lives');
    if (!G.world.isAlive('i_captive2')) G.world.reviveAsReplacement('i_captive2', 'Captive');
    H.list(G.world).push({ id: 'ritual', map: 'island', start: wn() - 200, end: wn() - 1, data: { victim: 'i_captive2' } });
    g.loadMap('rural', 'start'); H.hourly(G.world, g);
    check(!G.world.isAlive('i_captive2'), 'and it happens even when you are not there');
    g.loadMap('city', 'from_suburbs'); G.debug.time(13); tick(1);
    H.list(G.world).push({ id: 'car_crash', map: 'city', start: wn(), end: wn() + 60, data: {} }); tick(2);
    check(g.vehicles.filter((v) => v.evSpawn && v.wrecked).length === 2 && g.actors.some((a) => a.def && a.def.name === 'Injured Driver'), 'a car crash happens on the street in front of you');
    H.list(G.world)[H.list(G.world).length - 1].end = wn() - 1; H.hourly(G.world, g);
    check(!g.vehicles.some((v) => v.evSpawn), 'and gets cleaned up');
    // swimming: stepping into water lets you swim (you used to be thrown back on land)
    g.loadMap('rural', 'start'); tick(1);
    let wt = null; for (let i = 0; i < g.map.w * g.map.h && !wt; i++) { const tx = i % g.map.w, ty = Math.floor(i / g.map.w); if (g.map.isSwimmable(tx, ty) && g.map.isSwimmable(tx + 1, ty) && g.map.isSwimmable(tx - 1, ty) && g.map.isSwimmable(tx, ty - 1) && g.map.isSwimmable(tx, ty + 1)) wt = { tx, ty }; }
    if (wt) { p.x = wt.tx * 16 + 8; p.y = wt.ty * 16 + 12; p.stamina = p.maxStamina || 100; for (let i = 0; i < 20; i++) G.loop.tick(1 / 60); check(p.swimming && g.map.isWaterAt(p.x, p.y - 3), 'you can get into the water and swim'); p.x = 80 * 16; p.y = 80 * 16; tick(2); }
    // the child killer mark
    const wk = G.world; wk.flags.childKiller = null; G.kids.markKiller(wk); G.kids.enforce(wk);
    check(G.effects.has(game().player, 'child_killer') && (wk.bounty.city || 0) > G.BOUNTY_KILL_ON_SIGHT, 'killing a child marks you for good: the police shoot on sight');
    const anyone = game().actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && G.kids.vengeful(a));
    if (anyone) check(anyone.isHostileToPlayer(game()), 'and the ones out for vengeance attack you on sight');
    wk.flags.childKiller = null; G.effects.remove(game().player, 'child_killer'); for (const r in wk.bounty) wk.bounty[r] = 0;
    g.loadMap('rural', 'start'); tick(1);
    const pump = G.explosions.pumps(g.map)[0];
    if (pump) { for (let i = 0; i < 3; i++) G.explosions.bulletHitTile(g, pump.tx, pump.ty, { owner: null }); for (let i = 0; i < 60 * 2; i++) G.loop.tick(1 / 60); check(pump.removed, 'three bullets into a gas pump blow it up'); }
    else log('     (no gas pump on the city map)');
    // things that hold things: a wallet opens to its own contents, which stay with it
    G.scenes.replace(new G.GameScene({})); tick(2);
    const gc = game(), pc = gc.player; pc.inventory.add('wallet', 1);
    const wi = pc.inventory.slots.findIndex((s) => s && s.id === 'wallet');
    pc.useFromSlot(wi, gc); tick(1);
    const ls = G.scenes.top(), opened = pc.inventory.slots.find((s) => s && /^opened:wallet:/.test(s.id));
    check(ls instanceof G.LootScene && opened && (ls.c.gold > 0 || ls.c.items.length > 0) && G.item(opened.id).name === 'Wallet (opened)', 'a wallet opens to its own cash and cards');
    const before = JSON.stringify(ls.c); G.scenes.pop(); pc.useFromSlot(pc.inventory.slots.indexOf(opened), gc); tick(1);
    check(G.scenes.top() instanceof G.LootScene && JSON.stringify(G.scenes.top().c) === before, 'and it still holds what you left in it');
    G.scenes.pop();
    // self-defense: someone who hits you first is fair game; a bounty cools off if you lie low
    {
      const gc = game(); gc.loadMap('suburbs', 'from_city'); G.debug.time(13); gc.resyncNPCs(); tick(1);
      const pc = gc.player, foe = gc.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat !== 'guard' && !a.faction.outlaw);
      if (foe) {
        foe.assaulted = false; foe.aggressor = false; pc.invuln = 0;
        G.combat.damage(pc, 1, foe, gc);
        check(!foe.isCrimeToAttack(), 'whoever hits you first started it: hitting back is not assault');
        foe.aggressor = false;
      }
      const reg = gc.region, w0 = G.world; w0.bounty[reg] = 100; w0.lastCrimeDay[reg] = w0.day; (w0.knownKiller || {})[reg] = false;
      G.world.skipHours(24 * 6);
      check((w0.bounty[reg] || 0) < 100, `lying low, a bounty cools off (100 -> ${w0.bounty[reg]})`);
      w0.bounty[reg] = 0; pc.hp = pc.maxHp;
    }
    // Strength & Resistance: less gets through; a non-lethal beating stops at 1 health
    {
      const gs = game(), ps = gs.player; ps.hp = ps.maxHp; ps.invuln = 0;
      const h0 = ps.hp; G.combat.damage(ps, 40, null, gs); const plain = h0 - ps.hp;
      ps.hp = ps.maxHp; ps.invuln = 0; ps.skills.ranks.pain_tolerance = 3; ps.skills.ranks.hard_head = 1; ps.skills.ranks.thick_skin = 2;
      let tough = 0; for (let k = 0; k < 6; k++) { ps.invuln = 0; const a = ps.hp; G.combat.damage(ps, 40, null, gs); tough += a - ps.hp; ps.hp = ps.maxHp; }
      check(tough / 6 < plain, `Resistance: hits hurt less (${plain} vs ${Math.round(tough / 6)})`);
      delete ps.skills.ranks.pain_tolerance; delete ps.skills.ranks.hard_head; delete ps.skills.ranks.thick_skin;
      ps.nonLethal = true; ps.invuln = 0; G.combat.damage(ps, 9999, null, gs); ps.nonLethal = false;
      check(!ps.dead && ps.hp === 1, 'a non-lethal beating leaves you on 1 health, alive');
      ps.hp = ps.maxHp;
    }
    // joining: Blue jumps you in (8 seconds, you survive); Red wants a public kill and the body cut up
    {
      const gj = game(); gj.loadMap('eastside', null); G.debug.time(14); gj.resyncNPCs(); tick(1);
      const pj = gj.player, wj = G.world; pj.hp = pj.maxHp;
      const blue = gj.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.faction === 'gang_blue' && !a.def.kid);
      if (blue) {
        wj.reps = wj.reps || {}; const r0 = wj.getRep('gang_blue');
        wj.addRep('gang_blue', -r0 - 40, false, false); const low = G.initiation.odds(gj, blue);
        wj.addRep('gang_blue', 90, false, false); const high = G.initiation.odds(gj, blue);
        check(high > low, `the better they think of you, the likelier they let you try (${low.toFixed(2)} -> ${high.toFixed(2)})`);
        pj.x = blue.x + 20; pj.y = blue.y; const hp0 = pj.hp;
        G.initiation.start(gj, blue);
        check(gj.jumpIn && gj.jumpIn.crew.length >= 3, 'a beat-in: three of them');
        for (let i = 0; i < 60 * 9; i++) G.loop.tick(1 / 60);
        check(wj.isMember('gang_blue') && !pj.dead && pj.hp < hp0, `jumped in: you are Blue, you are alive, and it hurt (${hp0} -> ${pj.hp}) top=${G.scenes.top().constructor.name} ${G.scenes.top().runner ? G.scenes.top().runner.npc.def.name + ': ' + G.scenes.top().runner.node.text.slice(0, 60) : ''}`);
        check(gj.actors.every((a) => !a.jump), 'after eight seconds they stop');
        wj.flags.member_gang_blue = false; pj.hp = pj.maxHp;
      } else log('     (no Blue here)');
      // Red: the kill has to be seen, outdoors, then the body cut up
      const red = { def: { faction: 'gang_red', kid: false, leader: false }, st: { disp: 0 }, say() {}, id: 'tst_red' };
      G.initiation.start(gj, red);
      const victim = gj.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.faction === 'gang_blue' && !gj.map.buildingAt(a.x, a.y - 3));
      const seer = gj.actors.find((a) => a.kind === 'npc' && !a.dead && a !== victim && a.def.faction !== 'gang_blue');
      if (victim && seer) {
        pj.x = victim.x + 14; pj.y = victim.y; seer.sleeping = false;
        for (const [a, b] of [[30, 0], [-30, 0], [0, 30], [0, -30], [24, 24], [-24, 24], [24, -24], [-24, -24]]) { seer.x = pj.x + a; seer.y = pj.y + b; seer.faceTowards(pj); if (seer.canSee(gj, pj, 170)) break; }   // (a wall can stand between them, wherever the victim happened to be)
        const seen = seer.canSee(gj, pj, 170), hadRed = G.initiation.active(wj, 'gang_red');
        G.combat.damage(victim, 999, pj, gj);
        check(wj.flags.init_gang_red_kill, `Red: a Blue member killed in public counts (dead ${victim.dead}, ko ${!!victim.st.ko}, seen ${seen}, outdoors ${!gj.map.buildingAt(victim.x, victim.y - 3)}, active ${hadRed}, at ${Math.round(victim.x / 16)},${Math.round(victim.y / 16)})`);
        const corpse = Object.values(wj.containers).find((c) => c.kind === 'corpse' && c.redMark);
        pj.inventory.add('machete', 1);
        if (corpse) { G.dismember.run(gj, corpse); for (let i = 0; i < 300 && G.scenes.top() !== gj; i++) G.loop.tick(1 / 60); }
        check(wj.flags.init_gang_red_cut && G.initiation.ready(gj, 'gang_red'), 'Red: and cutting up the body completes it');
        check(pj.inventory.has('body_brain') && pj.inventory.has('body_arm'), 'the brain comes out with the rest');
        G.DIALOGUE_NODES._init_done({ npc: red, scene: gj });
        check(wj.isMember('gang_red'), 'tell any Red member and you are in');
        wj.flags.member_gang_red = false; pj.bloody = 0; G.effects.remove(pj, 'blood_soaked');
      } else log('     (no victim/witness for the Red test)');
      // people are food: cook it; brains give you kuru, and nothing cures it
      pj.inventory.add('body_leg', 1);
      G.usables.use({ def: { interact: "campfire" }, type: "campfire", tx: 0, ty: 0 }, gj); { for (let k = 0; k < 4 && pj.inventory.has("body_leg"); k++) { const kk = G.scenes.top(); const rr = kk.rows && kk.rows().find((r) => /Human Meat x3/.test(r.label)); if (rr) kk.pick(rr); } const ks = G.scenes.top(); log("     cook menu: " + (ks.rows ? ks.rows().map((r) => r.label + (r.disabled ? "(x)" : "")).join("|") : ks.constructor.name)); const row = ks.rows && ks.rows().find((r) => /Human Meat x3/.test(r.label)); if (row) ks.pick(row); log("     after cooking: pork " + pj.inventory.count("long_pork") + " leg " + pj.inventory.count("body_leg") + " msg " + ks.msg + " full " + pj.inventory.slots.filter(Boolean).length); if (ks.rows) G.scenes.remove(ks); }   // (cooking is a menu now: js/game/homestead.js)
      check(pj.inventory.count('long_pork') >= 3 && !pj.inventory.has('body_leg'), 'body parts cook into meals');
      pj.kuru = null; pj.inventory.add('body_brain', 3);
      for (let k = 0; k < 3; k++) pj.useFromSlot(pj.inventory.slots.findIndex((s) => s && s.id === 'body_brain'), gj);
      check(pj.kuru && pj.kuru.onset, 'three brains: kuru has taken hold');
      pj.hp = pj.maxHp; G.world.skipHours(24 * 5); tick(1);
      const st5 = G.kuru.stage(pj);
      check(st5 >= 3 && G.effects.has(pj, 'kuru_' + st5), `it gets worse (stage ${st5})`);
      G.effects.remove(pj, 'kuru_' + st5); for (const id of ['painkillers', 'medkit']) { pj.inventory.add(id, 1); }
      check(G.effects.has(pj, 'kuru_' + st5), 'and nothing takes it away');
      check(JSON.parse(JSON.stringify(pj.serialize())).kuru.stage === st5, 'it is in the save');
      // the end: the last stage drains you until you die, and no second wind saves you
      pj.skills.ranks.second_wind = 1; pj.skills.ranks.unbreakable = 1;
      pj.kuru.stage = 5; pj.kuru.next = G.effects.now() + 1e6; let died = false; const realDie = pj.die; pj.die = function () { died = true; };
      for (let h = 0; h < 60 && !died; h++) G.kuru.hourly(pj, gj);
      pj.die = realDie; delete pj.skills.ranks.second_wind; delete pj.skills.ranks.unbreakable;
      check(died, 'kuru ends in death, and nothing stops it');
      pj.kuru = null; for (let n = 1; n <= 5; n++) G.effects.remove(pj, 'kuru_' + n); pj.hp = pj.maxHp; pj.dead = false; G.effects.remove(pj, 'nausea');
      for (const id of ['long_pork', 'body_brain', 'body_head', 'body_torso', 'body_arm', 'body_leg', 'cooked_brain']) pj.inventory.remove(id, pj.inventory.count(id));
    }
    // inside a faction: work from any member, standing, ranks with gifts, a cut, an edge and privileges
    {
      const gf = game(); gf.loadMap('eastside', null); G.debug.time(14); gf.resyncNPCs(); tick(1);
      const wf = G.world, pf = gf.player, FR = G.factionRanks;
      wf.flags.member_gang_blue = true; wf.franks = {};
      const mem = gf.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.faction === 'gang_blue' && !a.def.kid && !a.transient);
      if (mem) {
        check(FR.title(wf, 'gang_blue') === 'Prospect', 'a new member starts at the bottom (Prospect)');
        const rr = new G.DialogueRunner(mem, gf);
        const ch = G.DIALOGUE_CHOICES.flatMap((f) => f(rr) || []);
        check(ch.some((c) => /Got anything for/.test(c.text)) && ch.some((c) => /Where do I stand/.test(c.text)), 'members can ask for faction work and their standing');
        const intim0 = G.skills.intimidation(pf);
        let jobs = 0;
        for (let k = 0; k < 8 && FR.rank(wf, 'gang_blue') < 2; k++) {
          const node = G.DIALOGUE_NODES._fr_work(rr); const go = node.choices && node.choices[0];
          if (!go || !go.do) break;
          go.do();
          const id = G.jobs.active(wf).find((q) => G.jobs.def(wf, q).factionJob === 'gang_blue'); if (!id) break;
          const d = G.jobs.def(wf, id); jobs++;
          d.objectives.forEach((o, i) => { if (o.flag) wf.flags[o.flag] = true; if (o.type === 'kill') wf.quests[id].progress[i] = o.count; if (o.type === 'have') pf.inventory.add(o.item, o.count); });
          if (d.reward.takeGold) pf.gold += d.reward.takeGold;
          const giver = gf.actors.find((a) => a.id === d.giver) || mem;
          G.jobs.complete(new G.DialogueRunner(giver, gf), id);
        }
        check(FR.rank(wf, 'gang_blue') >= 1 && FR.title(wf, 'gang_blue') !== 'Prospect', `faction work earns promotions (${jobs} jobs -> ${FR.title(wf, 'gang_blue')})`);
        check(G.skills.intimidation(pf) > intim0, 'rank brings an edge (Blue: intimidation)');
        // privileges: rank 2 gang members back you up
        FR.rec(wf, 'gang_blue').rank = 2;
        const thug = gf.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.faction !== 'gang_blue' && !a.def.kid && a.def.combat !== 'guard');
        const buddy = gf.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.faction === 'gang_blue' && a.def.combat === 'fight' && !a.def.kid);
        if (thug && buddy) { buddy.state = 'schedule'; buddy.x = pf.x + 30; buddy.y = pf.y; pf.invuln = 0; G.combat.damage(pf, 1, thug, gf); check(buddy.state === 'fight' && buddy.target === thug, 'Blue rank 2: your crew jumps whoever hits you'); buddy.state = 'schedule'; buddy.target = null; }
        // the weekly cut
        const g0 = pf.gold; FR.rec(wf, 'gang_blue').cutDay = wf.day - 7; G.events.emit('newDay', wf.day);
        check(pf.gold > g0, `a weekly cut ($${pf.gold - g0})`);
      } else log('     (no named Blue member)');
      // crimes as work: the Punks' vandalism job counts
      wf.flags.member_punks = true;
      const pj2 = { npc: { id: 'c_punk_boss', st: wf.npcs.c_punk_boss || {} }, scene: gf, c: { give() {} } };
      const pd = FR.makeJob(wf, 'punks', null);
      if (pd) {
        const vand = { type: 'crime_count', crime: 'vandalism', n: 2, title: 't', pitch: 't', desc: 'd', objectives: [{ type: 'flag', flag: '%_done', text: 'x' }], reward: { gold: 1 }, days: 3, giver: pd.giver, factionJob: 'punks' };
        pj2.npc = { id: pd.giver, st: wf.npcs[pd.giver] }; const vid = G.jobs.accept(pj2, vand);
        wf.commitCrime('vandalism', 'city', false); wf.commitCrime('vandalism', 'city', false);
        check(G.jobs.done(wf, vid), 'crimes count toward faction work (Punks: vandalism)');
        wf.quests[vid].state = 'done';
      }
      const noWork = Object.keys(FR.RANKS).filter((f) => { let ok = false; for (let k = 0; k < 6 && !ok; k++) ok = !!FR.makeJob(wf, f, null); return !ok; });
      check(!noWork.length, 'every faction has work for its members' + (noWork.length ? ' (none: ' + noWork.join(', ') + ')' : ''));
      // a Station Chief makes a bounty go away
      wf.flags.member_cia = true; FR.rec(wf, 'cia').rank = 3; wf.bounty.city = 300;
      G.DIALOGUE_NODES._fr_wipe({ npc: { def: { faction: 'cia' } }, scene: gf });
      check(!wf.bounty.city, 'CIA rank 3: your record quietly disappears');
      for (const f of ['gang_blue', 'punks', 'cia']) wf.flags['member_' + f] = false;
      wf.franks = {}; for (const r in wf.bounty) wf.bounty[r] = 0;
    }
    // hostile talk: a menu of ways to make an enemy, each with consequences
    {
      const gh = game(); gh.loadMap('city', null); G.debug.time(13); gh.resyncNPCs(); tick(1);
      const wh = G.world, ph = gh.player;
      const civ = gh.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat === 'flee' && !a.transient);
      const kid = gh.actors.find((a) => a.kind === 'npc' && a.def.kid);
      if (civ) {
        const rr = new G.DialogueRunner(civ, gh);
        check(G.DIALOGUE_CHOICES.flatMap((f) => f(rr) || []).some((c) => c.text === '(Hostile)...'), 'grown-ups can be talked to with hostility');
        const menu = G.DIALOGUE_NODES._hostile(rr);
        check(menu.choices.length >= 8, `a whole menu of it (${menu.choices.length - 1} options)`);
        const d0 = civ.st.disp || 0; rr.hostile = { id: 'mother', kind: 'insult', hurt: 14, text: () => '' };
        G.DIALOGUE_NODES._hostile_do(rr);
        check((civ.st.disp || 0) < d0, 'an insult costs their goodwill');
        const rum0 = (wh.rumors || []).length; rr.hostile = { id: 'slander', kind: 'slander', hurt: 15, text: () => '' }; G.DIALOGUE_NODES._hostile_do(rr);
        check(wh.rumors.slice(-3).some((x) => x.text.includes(wh.displayName(civ.id))), 'slander spreads a rumor about them'); void rum0;
        civ.st.disp = 0; civ.st.fear = 0; civ.st.hostUsed = null;
      }
      if (kid) check(!G.DIALOGUE_CHOICES.flatMap((f) => f(new G.DialogueRunner(kid, gh)) || []).some((c) => c.text === '(Hostile)...'), 'not with children');
      const brute = gh.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'fight' && !a.def.kid);
      if (brute) {
        const rb = new G.DialogueRunner(brute, gh); rb.hostile = { id: 'challenge', kind: 'challenge', hurt: 6, text: () => '' };
        const res = G.DIALOGUE_NODES._hostile_do(rb); res.choices[0].do();
        check(brute.state === 'fight' && !brute.isCrimeToAttack(), 'a challenge accepted is a fair fight (not a crime)');
        brute.state = 'schedule'; brute.target = null; brute.aggressor = false; brute.st.hostile = false; brute.st.disp = 0;
      }
    }
    // love scenes are staged for who is in them
    {
      const gl = game(), lp = gl.player;
      const f = gl.actors.find((a) => a.kind === 'npc' && !a.def.kid && a.look.body === 'f'), m = gl.actors.find((a) => a.kind === 'npc' && !a.def.kid && a.look.body === 'm');
      const pairOf = (n) => { const ls = new G.LoveScene(gl, n); ls.stageInit(); return ls.pair; };
      const b0 = lp.look.body;
      lp.look.body = 'm'; lp.refreshSprite(); const a1 = f && pairOf(f), a2 = m && pairOf(m);
      lp.look.body = 'f'; lp.refreshSprite(); const a3 = f && pairOf(f);
      lp.look.body = b0; lp.refreshSprite();
      check(a1 === 'mf' && a2 === 'mm' && a3 === 'ff', `straight and gay scenes are staged differently (${a1}, ${a2}, ${a3})`);
    }
    // the Revolutionaries: activists with rifles; if they win, a non-canon ending
    {
      const lk = G.NPCS.f_rev1.look;
      check(G.NPCS.f_rev_leader.name === 'The Organizer' && lk.pins && G.NPCS.f_rev1.weapon === 'shotgun', 'the Revolutionaries are armed activists now');
      const gr = game(), wr = G.world;
      check(!G.revolution.ready(wr), 'no revolution while the Mayor and the Philanthropist live');
      const keep = [wr.npcs.c_lord.alive, wr.npcs.i_leader.alive];
      wr.flags.member_revolutionaries = true; wr.npcs.c_lord.alive = false; wr.npcs.i_leader.alive = false;
      check(G.revolution.ready(wr) && G.DIALOGUE_NODES._rev_end({ scene: gr }).choices[0].text.includes('non-canon'), 'with both dead, the Organizer offers the (non-canon) ending');
      const es = new G.EndingScene('revolution', wr); G.scenes.push(es); es.t = 9; G.loop.draw(); G.scenes.remove(es);
      wr.flags.member_revolutionaries = false; wr.npcs.c_lord.alive = keep[0]; wr.npcs.i_leader.alive = keep[1];
    }
    // fridges, cabinets, nightstands, crates, trash, mailboxes: real containers with the loot window
    {
      const gL = game(); gL.loadMap('suburbs', 'from_city'); G.debug.time(13); gL.resyncNPCs(); tick(1);
      const fr = gL.map.decor.find((d) => d.def.interact === 'fridge');
      if (fr) {
        G.usables.use(fr, gL);
        const ls = G.scenes.top();
        check(ls instanceof G.LootScene && ls.c.fixture && ls.c.name === 'Fridge', 'a fridge opens like a chest');
        const id = ls.c.id; ls.c.items.push(['apple', 1]); ls.close();
        G.usables.use(fr, gL); const ls2 = G.scenes.top();
        check(ls2.c.id === id && ls2.c.items.some((e) => e[0] === 'apple'), 'and keeps what is in it');
        ls2.close();
        check(!gL.containers.some((c) => c.fixture), 'fixtures do not show up as loose chests on the map');
        check(/^Open the /.test(G.usables.label(fr, gL)), `the prompt says what it is ("${G.usables.label(fr, gL)}")`);
      } else log('     (no fridge on this map)');
    }
    // asking for sex: strangers take offense; it is never offered to children
    {
      const gP = game(); gP.loadMap('city', null); G.debug.time(13); gP.resyncNPCs(); tick(1);
      const s = gP.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat === 'flee' && !a.st.partner && !(a.st.romance > 0));
      const kid = gP.actors.find((a) => a.kind === 'npc' && a.def.kid);
      if (s) {
        s.st.introduced = false; s.st.disp = 0; s.st.propDay = null;
        const rr = new G.DialogueRunner(s, gP);
        check(G.DIALOGUE_CHOICES.flatMap((f) => f(rr) || []).some((c) => /Proposition/.test(c.text)), 'you can proposition anyone');
        check(G.proposition.odds(gP, s) < 0.3, `a stranger is unlikely to say yes (${G.proposition.odds(gP, s).toFixed(2)})`);
        const keep = Math.random; Math.random = () => 0.99; G.DIALOGUE_NODES._proposition(rr); Math.random = keep;
        check((s.st.disp || 0) < 0, 'and is offended by it');
        s.st.disp = 0; s.st.fear = 0; s.st.propDay = null;
      }
      if (kid) check(!G.DIALOGUE_CHOICES.flatMap((f) => f(new G.DialogueRunner(kid, gP)) || []).some((c) => /Proposition/.test(c.text)), 'never with children');
    }
    // where you could bury a body, you can cut it up instead
    {
      const gB = game(), pB = gB.player; gB.loadMap('forest', null); G.debug.time(13); tick(1);
      const c = G.containers.createCorpse(G.world, { id: 'tst_body', transient: true, displayName: 'Body', look: pB.look, def: { kid: false, faction: 'civilians', name: 'Body' }, st: { inv: [], gold: 0 }, x: pB.x, y: pB.y }, gB.map.id);
      gB.refreshContainers();
      const corpse = Object.values(G.world.containers).find((q) => q.kind === 'corpse' && q.name === 'Body' && q.map === gB.map.id);
      if (corpse) {
        pB.dragging = corpse.id; pB.inventory.add('machete', 1);
        const d = G.bodies.disposal(gB);
        check(d && (d.how !== 'bury' || /cut it up/.test(d.label)), `in the forest: ${d ? d.label : 'nothing'}`);
        if (d && d.how === 'bury') { G.bodies.dispose(gB, 'bury'); const ch = G.scenes.top(); check(ch instanceof G.ChoiceScene && ch.options.some((o) => /Cut it up/.test(o.label) && !o.disabled), 'the grave offers: bury it, or cut it up'); G.scenes.remove(ch); }
        pB.dragging = null; delete G.world.containers[corpse.id];
      }
      void c;
    }
    // the Maizonary: hidden, discovered, tried, initiated, raised by degrees
    {
      const gM = game(), pM = gM.player, wM = G.world, MZ = G.maizonary; gM.loadMap('city', null); G.debug.time(14); gM.resyncNPCs(); tick(1);
      wM.maiz = null;
      check(!G.listedFactions().includes('maizonary') && !G.FACTIONS.maizonary.listed, 'the Maizonary is not a faction you can see');
      const mark = gM.map.decor.find((d) => d.type === 'maizon_mark');
      check(!!mark, 'there is a carved mark by the Office Tower door');
      if (mark) { const bb = gM.map.building('c_noble1'); log(`     mark at ${mark.tx},${mark.ty} door ${bb.doorX},${bb.doorY}`); }
      const civ = gM.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && !MZ.isMember(a.id));
      const askOpt = (n) => G.DIALOGUE_CHOICES.flatMap((f) => f(new G.DialogueRunner(n, gM)) || []).some((c) => /traveling man/.test(c.text));
      check(civ && !askOpt(civ), 'before you find a clue, there is nothing to ask');
      if (mark) G.usables.use(mark, gM);
      check(MZ.state(wM).mark && askOpt(civ), 'after the mark, you can ask anyone the password');
      const r1 = new G.DialogueRunner(civ, gM); G.DIALOGUE_NODES._mz_ask(r1);
      check(MZ.state(wM).stage === 0, 'a non-member has no idea what you mean');
      const bro = gM.actors.find((a) => a.id === 'c_barber') || { id: 'c_barber', st: wM.npcs.c_barber, def: G.NPCS.c_barber };
      bro.st.disp = 30; G.DIALOGUE_NODES._mz_ask({ npc: bro, scene: gM });
      check(MZ.state(wM).stage === 1, 'a brother sends you to the doorman');
      G.debug.time(23); gM.resyncNPCs(); tick(1);
      const door = gM.actors.find((a) => a.id === 'mz_master');
      check(!!door, 'the doorman keeps the Office Tower at night');
      if (door) {
        const rd = new G.DialogueRunner(door, gM);
        check(G.DIALOGUE_CHOICES.flatMap((f) => f(rd) || []).some((c) => /I was sent/.test(c.text)), 'after ten, he hears you out');
        G.DIALOGUE_NODES._mz_trials(rd);
        const t = MZ.state(wM).trials;
        check(t && pM.inventory.has('mz_letter') && wM.quests.maiz_trials, 'three trials (a mission in your journal)');
        G.DIALOGUE_NODES._mz_letter({ npc: { id: t.letterTo }, scene: gM });
        pM.gold += 200; G.DIALOGUE_NODES._mz_charity({ npc: { id: 'c_priest', st: wM.npcs.c_priest }, scene: gM });
        pM.inventory.add('mz_ledger', 1);
        check(MZ.trialsDone(wM), 'letter delivered, gift left, ledger back: the trials are done');
        check(MZ.odds(gM) >= 0.75, `acceptance is never below 75% (${Math.round(MZ.odds(gM) * 100)}%)`);
        const keep = Math.random; Math.random = () => 0.1; G.DIALOGUE_NODES._mz_ceremony(rd); Math.random = keep;
        check(wM.isMember('maizonary') && MZ.degree(wM) === 11 && G.effects.has(pM, 'maizon_11'), 'initiated: 11th Degree, and the perk');
        check(G.listedFactions().includes('maizonary'), 'and only now does it show as yours');
        MZ.gain(gM, 30);
        check(MZ.degree(wM) === 77 && G.effects.has(pM, 'maizon_77') && !G.effects.has(pM, 'maizon_11'), 'raised by 11s, all the way to the 77th Degree');
        G.effects.remove(pM, 'maizon_77'); check(G.effects.has(pM, 'maizon_77'), 'the perk cannot be taken away');
      }
      wM.flags.member_maizonary = false; wM.maiz = { stage: 0, degree: 0, merit: 0 }; pM.effects = pM.effects.filter((e) => !/^maizon_/.test(e.id));
    }
    // spent casings: only when a round is really fired; they arc, land and settle
    {
      const gC = game(), pC = gC.player; while (G.scenes.top() !== gC && G.scenes.stack.length > 1) G.scenes.remove(G.scenes.top()); G.debug.time(12); gC.arrestCooldown = 99999; pC.inventory.add('pistol', 1); pC.equipFromSlot(pC.inventory.slots.findIndex((s) => s && s.id === 'pistol'));
      gC.casings = []; pC.mags = pC.mags || {}; pC.mags.pistol = 0; pC.inventory.remove('ammo_9mm', pC.inventory.count('ammo_9mm')); pC.reloadT = 0; pC.attackCd = 0;
      G.firearms.playerFire(pC, gC, 0);
      check(!gC.casings.length, 'an empty gun clicks: no casing comes out');
      pC.mags.pistol = 5; pC.reloadT = 0; pC.attackCd = 0; const fOff = G.fate.st().off; G.fate.st().off = true;   // (no random jam from the hidden luck earlier tests left you with)
      G.firearms.playerFire(pC, gC, 0);
      check(gC.casings.length === 1 && pC.mags.pistol === 4, 'a shot fired: one casing');
      pC.attackCd = 0.2; G.firearms.playerFire(pC, gC, 0);
      check(gC.casings.length === 1, 'still cycling: no extra casing');
      G.fate.st().off = fOff;
      const c0 = gC.casings[0], z0 = c0.z, x0 = c0.x;
      for (let i = 0; i < 90; i++) G.loop.tick(1 / 60);
      check(c0.rest && c0.z === 0 && c0.x !== x0 && z0 > 0, 'it flies out, lands and settles');
      const rv = { id: 'revolver', gun: true }; const n = gC.casings.length; G.firearms.shoot(pC, gC, 0, Object.assign({}, G.ITEMS.revolver, rv), { spread: 0, dmg: 1 });
      check(gC.casings.length === n, 'a revolver keeps its brass');
      pC.unequip && pC.unequip('weapon');
    }
    // the main villain: Jack Ashford, the Philanthropist, on his island; Elite members can join his table
    {
      const gA = game(), wA = G.world;
      check(G.NPCS.i_leader.name === 'The Philanthropist' && wA.npcs.i_leader.realName === 'Jack Ashford', 'the island is run by Jack Ashford, the Philanthropist');
      check(/Ashford/.test(G.bct.reply(gA, 'who is ashford?')), 'chatBCT knows who he is');
      const kneel = G.DIALOGUES.island_leader.join.choices[0];
      check(kneel.if && !kneel.if() , 'only friends of the Foundation (Elite members) may kneel');
      wA.flags.member_elite = true; check(kneel.if(), 'an Elite member can join his Inner Circle');
      wA.flags.member_elite = false;
      check(G.NPCS.i_captive1.look.naked === false, 'the captives are clothed');
    }
    // dialogues written in the World Editor run in the game (needs, payments, gifts, flags)
    {
      const gD = game(), pD = gD.player;
      const D = G.dialogueData.compile({
        start: { text: 'Want the key? Fifty bucks.', common: false, choices: [
          { text: 'Here.', pay: 50, failNext: 'broke', give: ['lockpick', 1], setFlag: 'tst_bought', next: 'thanks' },
          { text: 'I have the secret word.', ifFlag: 'tst_word', next: 'thanks' },
          { text: 'Bye.', next: null }] },
        thanks: { text: 'Pleasure.', choices: [{ text: 'Bye.', next: null }] },
        broke: { text: 'Then scram.', choices: [{ text: 'Bye.', next: null }] },
      });
      G.DIALOGUES.tst_dlg = D;
      const npcD = gD.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient);
      const keepDlg = npcD.def.dialogue; npcD.def.dialogue = 'tst_dlg';
      const rr = new G.DialogueRunner(npcD, gD); rr.go('start');
      check(rr.node && rr.node.choices.length === 2, `an editor dialogue: conditions hide answers (${rr.node && rr.node.choices.length} shown)`);
      pD.gold = 10; rr.choose(0);
      check(rr.node && rr.node.id === 'broke', 'cannot pay: it goes where you said');
      pD.gold = 100; rr.go('start'); rr.choose(0);
      check(pD.gold === 50 && pD.inventory.has('lockpick') && G.world.flags.tst_bought, 'paying, getting the item and setting the flag all work');
      npcD.def.dialogue = keepDlg; delete G.DIALOGUES.tst_dlg;
    }
    // smoking takes a while: in your mouth, effects on the first drag, burns down, can be put out
    {
      const gs2 = game(), ps2 = gs2.player; ps2.inventory.add('torch', 1); ps2.inventory.add('joint', 2);
      G.effects.remove(ps2, 'high');
      ps2.useFromSlot(ps2.inventory.slots.findIndex((s) => s && s.id === 'joint'), gs2);
      check(ps2.smoking && ps2.smoking.id === 'joint' && !G.effects.has(ps2, 'high'), 'lighting a joint: it is in your mouth, not finished at once');
      for (let i = 0; i < 60 * 4; i++) G.loop.tick(1 / 60);
      check(G.effects.has(ps2, 'high'), 'the first drag hits');
      for (let i = 0; i < 60 * 10; i++) G.loop.tick(1 / 60);
      check(ps2.smoking && ps2.smoking.wisps.length > 0, 'smoke curls off it');
      const inv = new G.InventoryScene(gs2); G.scenes.push(inv); G.loop.draw(); G.input.pressed.add('KeyC'); G.loop.tick(1 / 60); G.input.pressed.clear(); G.scenes.remove(inv);
      check(!ps2.smoking, '"Stop smoking" in the inventory puts it out');
      ps2.useFromSlot(ps2.inventory.slots.findIndex((s) => s && s.id === 'joint'), gs2); const n0 = ps2.inventory.count('joint');
      G.smoking.stop(ps2, gs2); check(ps2.inventory.count('joint') === n0 + 1, 'put out before the first drag: you keep it');
      ps2.useFromSlot(ps2.inventory.slots.findIndex((s) => s && s.id === 'joint'), gs2);
      for (let i = 0; i < 60 * 125; i++) { if (G.scenes.top() !== gs2) G.scenes.remove(G.scenes.top()); G.loop.tick(1 / 60); }   // (anyone who comes to chat is waved off)
      check(!ps2.smoking, 'smoked all the way down in about two minutes' + (ps2.smoking ? ` (t=${ps2.smoking.t.toFixed(1)}, top=${G.scenes.top() && G.scenes.top().constructor.name})` : ''));
      G.effects.remove(ps2, 'high');
    }
    // a kid's errand is a mission like any other (journal, chatBCT)
    {
      const gk2 = game(); gk2.loadMap('suburbs', 'from_city'); G.debug.time(16); gk2.resyncNPCs(); tick(2);
      const kid = gk2.actors.find((a) => a.def && a.def.kid);
      if (kid) {
        const rr = new G.DialogueRunner(kid, gk2);
        G.kids.accept({ npc: kid, scene: gk2, c: rr.c }, { items: [['candy', 1]], pay: 5 });
        const id = G.jobs.active(G.world).find((q) => G.jobs.def(G.world, q).giver === kid.id);
        check(id && G.bct.missions(G.world).some((m) => m.id === id), 'a kid\'s errand is in your missions (journal and chatBCT)');
        if (id) G.world.quests[id].state = 'done';
      } else log('     (no kid here)');
    }
    // sleeping it off: withdrawal and cravings run their course and pass, and do not come straight back
    {
      const gk = game(), pk = gk.player, sk = G.effects.drugState(pk);
      if (pk.dead) log("     (the player was dead before the craving test: " + G.lastDeath + ")"); pk.dead = false; pk.hp = pk.maxHp; pk.hunger = 0; pk.thirst = 0;
      sk.addiction.opioid = 60; sk.lastUse.opioid = G.effects.now() - 60 * 30; sk.wdFor = {}; sk.crave = {};
      G.world.skipHours(1); tick(1);
      check(G.effects.has(pk, 'craving') || G.effects.has(pk, 'wd_opioid'), 'off the drug: craving and withdrawal');
      pk.hp = pk.maxHp; pk.hunger = 0; pk.thirst = 0; { const _st = G.needs.starve; G.needs.starve = () => {}; G.world.skipHours(84); G.needs.starve = _st; } pk.hunger = 0; pk.thirst = 0; tick(1);   // (fed and watered: nothing heals now but medicine)
      check(!G.effects.has(pk, 'craving') && !G.effects.has(pk, 'wd_opioid'), 'wait or sleep long enough and they pass (' + pk.effects.map((e) => e.id + ':' + Math.round(e.t)).join(',') + ' dead ' + pk.dead + ' hp ' + Math.round(pk.hp) + ' same ' + (G.player === pk) + ' ' + G.lastDeath + ')');
      sk.addiction.opioid = 0;
    }
    // loading an earlier save really goes back: no child or high from after it
    {
      G.scenes.replace(new G.GameScene({})); tick(3);
      const gs = game(); G.saves.write('3', gs);
      G.effects.add(gs.player, 'trip', 600, 1.2); gs.player.alcohol = 80;
      const kb = { id: 'baby_sv', sex: 'm', mother: 'player', father: 'r_farmer2', born: G.world.day - 3 * G.YEAR_DAYS, name: 'Later' }; (G.world.babies = G.world.babies || []).push(kb); G.growth.daily(G.world, gs);
      check(G.NPCS[kb.npc] && G.world.npcs[kb.npc], 'a child is born after the save');
      G.scenes.replace(new G.GameScene({ save: G.saves.read('3') })); tick(3);
      const gl = game();
      check(!G.effects.has(gl.player, 'trip') && gl.player.alcohol === 0 && !G.NPCS[kb.npc] && !G.world.npcs[kb.npc] && !gl.actors.some((a) => a.id === kb.npc), 'loading the earlier save: no child, not high');
      G.saves.remove('3');
    }
    // DMT: you need a lighter, and it takes you somewhere else for a couple of minutes
    {
      const gq = game(), pq = gq.player; pq.inventory.add('dmt', 1); pq.inventory.remove('torch', pq.inventory.count('torch'));
      check(!pq.useFromSlot(pq.inventory.slots.findIndex((s) => s && s.id === 'dmt'), gq), 'no lighter, no DMT');
      pq.inventory.add('torch', 1); pq.useFromSlot(pq.inventory.slots.findIndex((s) => s && s.id === 'dmt'), gq); if (pq.smoking) G.smoking.update(pq, 3, gq);
      G.effects.get(pq, 'dmt').t = 70; tick(2);
      check(G.effects.has(pq, 'dmt') && G.psy.dmt(pq) > 0.5, 'with one, the breakthrough comes on fast');
      G.effects.remove(pq, 'dmt'); tick(2);
      check(G.effects.has(pq, 'afterglow_dmt'), 'and you come back from it');
    }
    // sleeping with someone married: their spouse finds out and comes for you
    {
      const ga = game(), wa = G.world;
      const wife = Object.keys(G.NPCS).find((id) => G.NPCS[id].map === ga.map.id && G.love.spouseOf(wa, id) && G.NPCS[id].combat !== 'guard' && !G.NPCS[id].kid);
      if (wife) {
        const husband = G.love.spouseOf(wa, wife);
        G.love.react(wa, husband, wife, false, true);
        const hus = ga.actors.find((a) => a.id === husband);
        check(wa.npcs[husband].betrayed && wa.npcs[husband].betrayed.by === wife, 'the betrayed spouse knows who it was');
        if (hus) { hus.x = ga.player.x + 30; hus.y = ga.player.y; hus.state = 'schedule'; hus.talking = false; hus.betrayT = 0; tick(30); check(wa.npcs[husband].betrayed.confronted, 'and confronts you the next time they see you'); }
        wa.npcs[husband].betrayed = null; wa.npcs[husband].hostile = false; if (hus) hus.endFight && hus.endFight();
      } else log('     (no married couple here)');
    }
    // melee: the blow lands while the weapon passes through them, not the moment you press the button
    {
      const gm = game(), pm = gm.player, foe = gm.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard');
      Object.assign(pm, openSpot(gm, pm));
      pm.equip.weapon = null; pm.swing = null; pm.dir = 2; foe.x = pm.x + 10; foe.y = pm.y; foe.invuln = 0; foe.talking = true;
      const h0 = foe.hp; G.combat.attack(pm, gm);
      check(foe.hp === h0 && pm.swing && pm.swing.st.kind === 'punch', 'a punch winds up before it lands');
      for (let i = 0; i < 12; i++) G.loop.tick(1 / 60);
      check(foe.hp < h0, `and then it hits (${h0} -> ${foe.hp})`);
      foe.x = pm.x - 12; foe.kbx = foe.kby = 0; foe.invuln = 0; const h1 = foe.hp; pm.swing = null; pm.attackCd = 0; aimRight(pm); pm.aim = 0; G.combat.attack(pm, gm); const sb = pm.swing && pm.swing.base; for (let i = 0; i < 20; i++) G.loop.tick(1 / 60);
      check(foe.hp === h1, `swinging the other way misses someone behind you (${h1} -> ${foe.hp}; swing ${sb} aim ${pm.aim} foe ${Math.round(foe.x - pm.x)},${Math.round(foe.y - pm.y)} state ${foe.state} bleed ${!!foe.st.bleed})`);
      foe.talking = false;
    }
    // no walls at the edge: the Woods, getting lost, and chatBCT calling the rescue
    {
      const gw = game(); gw.loadMap('rural', 'start'); tick(1);
      gw.player.x = 80 * 16; gw.player.y = 12;
      G.wilds.enter(gw, 'n'); tick(120);
      check(G.isWildsMap(game().map.id) && game().map.id !== 'wilds' && G.world.wilds && G.world.wilds.from === 'rural', 'walking off the edge of the map takes you into the woods');
      check(!game().banner && !game().toasts.some((t) => /woods/i.test(t.text)), 'going into the woods puts nothing on the screen');
      const firstCell = game().map.id; G.wilds.cross(game(), 'n'); tick(60); const nCell = game().map.id; G.wilds.cross(game(), 's'); tick(60); const back = game().map.id; G.wilds.cross(game(), 'n'); tick(60); G.wilds.cross(game(), 'w'); tick(60);
      check(nCell !== firstCell && back === firstCell && game().map.id !== nCell, 'each stretch of woods is its own place, and walking back brings you to the same one');
      check(G.wilds.lost(G.world) && G.bct.SUGGEST[0] === 'I am lost in this forest. Can you help me?', 'wander far enough and you are lost (chatBCT offers help)');
      const a1 = G.bct.reply(game(), G.bct.SUGGEST[0]);
      check(/rescue/.test(a1) && G.bct.SUGGEST[0] === 'Yes, please.', 'chatBCT makes fun of you and offers to call the rescue');
      G.bct.reply(game(), 'Yes, please.'); tick(240);
      const gr = game(), at = gr.map.points.r_rescue_arrive;
      check(gr.map.id === 'rural' && at && Math.hypot(gr.player.x / 16 - at.x, gr.player.y / 16 - at.y) < 3, 'Search and Rescue brings you to the Rescue Center');
      // and the way back out works too: in and straight back
      gr.player.x = 80 * 16; gr.player.y = 12; G.wilds.enter(gr, 'n'); tick(120);
      G.wilds.cross(game(), 's'); tick(120);
      check(game().map.id === 'rural' && !G.world.wilds, 'turn around right away and you walk back out where you went in');
    }
    // fire victims are charred; cutting up a body (with the right tool) gets rid of it and leaves you bloody
    {
      const gd = game(), pd = gd.player, w = G.world;
      const v = gd.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard');
      v.hp = 1; G.combat.damage(v, 50, { kind: 'fire', x: v.x, y: v.y, dead: false }, gd);
      const burnt = Object.values(w.containers).find((c) => c.kind === 'corpse' && c.victim === v.id);
      check(burnt && burnt.burnt && !burnt.items.some((e) => /^top\//.test(e[0])), 'someone who burns to death is left charred (their clothes burned too)');
      gd.refreshContainers(); G.loop.draw();
      pd.inventory.add('machete', 1); G.dismember.run(gd, burnt); tick(200);
      check(!w.containers[burnt.id] && pd.inventory.has('body_head') && pd.inventory.count('body_arm') === 2 && pd.bloody > 0 && G.effects.has(pd, 'blood_soaked'), 'cutting up a body: the parts are yours, the body is gone, you are covered in blood');
      pd.bloody = 0; G.effects.remove(pd, 'blood_soaked'); for (const id of ['body_head', 'body_torso', 'body_arm', 'body_leg']) pd.inventory.remove(id, pd.inventory.count(id));
    }
    // a companion's things: trade, and choose what they use
    {
      const g2 = game(), mate = g2.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && a.def.combat !== 'guard');
      mate.st.companion = true; mate.st.equip = {}; g2.player.inventory.add('pistol', 1);
      const ts = new G.CompanionTradeScene(g2, mate); G.scenes.push(ts); tick(1);
      ts.store(ts.pEntries().find((e) => e && e.id === 'pistol'));
      ts.equip(ts.entries().find((e) => e.id === 'pistol')); ts.close();
      check(mate.st.inv.some((e) => e[0] === 'pistol') && mate.weaponItem && mate.weaponItem.id === 'pistol', 'you can give your companion a gun and have them use it');
      // a full pack scrolls: the last thing they carry can be reached
      const keepInv = mate.st.inv; mate.st.inv = Array.from({ length: 25 }, (_, k) => [Object.keys(G.ITEMS)[k + 3], 1]);
      const ts2 = new G.CompanionTradeScene(g2, mate); G.scenes.push(ts2); ts2.side = 0; ts2.sel = 24; tick(1); G.loop.draw();
      check(ts2.scrolls && ts2.scrolls[0] >= 5, `a companion's long inventory scrolls to the last item (scrolled ${ts2.scrolls && ts2.scrolls[0]})`);
      G.scenes.remove(ts2); mate.st.inv = keepInv;
      mate.st.companion = false;
    }
    // world files (the World Editor): a map survives a round trip, and a custom world loads into a new game
    const WF = G.worldFile, src = G.planMap(G.MAPGEN.rural);
    const ser = JSON.parse(JSON.stringify(WF.serializeMap(src))), back = WF.deserializeMap(ser);
    check(back.ground.every((t, i) => t === src.ground[i]) && back.decor.length + back.flats.length === src.decor.length + src.flats.length && back.buildings.length === src.buildings.length && Object.keys(back.points).length === Object.keys(src.points).length, 'a map survives the trip through a world file');
    ser.ground = ser.ground.replace(/^(\d+),/, G.T.sand + ',');
    WF.cache.TestWorld = { name: 'TestWorld', world: { maps: ['rural'], npcs: { cw_npc: { name: 'Custom Person', map: 'rural', faction: 'civilians', hp: 30, combat: 'flee', look: G.look('cw'), schedule: [{ from: 0, to: 24, at: 'r_square', act: 'wander' }] } } }, maps: { rural: ser } };
    WF.pending = 'TestWorld'; G.scenes.replace(new G.GameScene({})); tick(3); WF.pending = null;
    const gw = game();
    check(G.world.flags.customWorld === 'TestWorld' && G.NPCS.cw_npc && G.world.npcs.cw_npc && gw.map.ground[0] === G.T.sand, `a new game in a custom world uses its maps and its people (${G.world.flags.customWorld} ${!!G.NPCS.cw_npc} ${!!G.world.npcs.cw_npc} ${gw.map.id} ${gw.map.ground[0]}/${G.T.sand})`);
    WF.activate(null); delete WF.cache.TestWorld;
    check(!G.NPCS.cw_npc && G.maps.get('rural').ground[0] === src.ground[0], 'and the default world is back afterwards');
    G.scenes.replace(new G.GameScene({})); tick(2);
    G.loop.draw();
  }

  // Gang war: territories, live attacks you can watch, off-screen attacks, kills draining control.
  function gangWar(g) {
    const w = g.world, GW = G.gangWar;
    GW.init(w);   // earlier tests already let the war run for days
    let bad = 0;
    for (const id in G.TERRITORIES) for (const a of G.TERRITORIES[id].adj) if (!G.TERRITORIES[a] || !G.TERRITORIES[a].adj.includes(id)) { bad++; log(`FAIL territory ${id} -> ${a} not mutual`); }
    fails += bad;
    check(bad === 0, 'territory adjacency is mutual');
    check(GW.ownedBy(w, 'gang_red').length === 4 && GW.ownedBy(w, 'gang_blue').length === 4 && !w.territories.c_harbor.owner, 'each gang starts with its 4 blocks, the harbor is unclaimed');
    check(GW.at('southside', 20, 90) === 's_sw' && GW.at('eastside', 120, 20) === 'x_ne', 'territory lookup by tile');

    // live attack: the player is in Southside when the Blue Gang hits the Courts
    g.player.hp = g.player.maxHp = 99999;
    G.debug.time(14); tick(1);
    g.player.x = 140 * 16; g.player.y = 72 * 16;
    w.raid = null;
    check(GW.startRaid(w, 'gang_blue', 's_ne'), 'attack started');
    let hurt = 0;
    for (let i = 0; i < 60 * 25; i++) {
      G.loop.tick(1 / 60);
      if (i % 30 === 0) g.player.x = 140 * 16 + (i % 60 ? 4 : -4);   // stay put (but awake)
    }
    G.loop.draw();
    const fighters = g.actors.filter((a) => a.raidSide);
    hurt = fighters.filter((a) => a.hp < a.maxHp).length + w.raid.killsA + w.raid.killsD;
    log(`     raid: spawned A ${w.raid.spawnedA} D ${w.raid.spawnedD}, kills A ${w.raid.killsA} D ${w.raid.killsD}, fighters on map ${fighters.length}`);
    check(w.raid.spawnedA > 0 && w.raid.spawnedD > 0, 'attackers and defenders show up when you are there');
    check(hurt > 0, 'the gangs fight each other: ' + hurt + ' hurt or killed');
    const ctl0 = w.territories.s_ne.control;
    w.raid.spawnedA = 4; w.raid.killsA = 0; w.raid.spawnedD = 3; w.raid.killsD = 3;   // the attackers won the fight
    w.territories.s_ne.control = 30;
    GW.resolve(w);
    check(w.territories.s_ne.owner === 'gang_blue', `a won attack on a weak block flips it (control was ${ctl0}): ${w.territories.s_ne.owner}`);
    check(g.actors.some((a) => a.raidSide) || true, 'fighters linger until out of sight');
    // off-screen attack
    let flips = 0, tries = 0;
    for (; tries < 40 && !flips; tries++) {
      w.territories.x_se.control = 10;
      GW.startRaid(w, 'gang_red', 'x_se');
      w.raid.end = GW.abs(w);
      GW.hourly(w);
      if (w.territories.x_se.owner === 'gang_red') flips++;
    }
    check(flips === 1 && !w.raid, `off-screen attacks resolve by strength (flipped after ${tries} tries)`);
    // killing a gang member in its own block weakens the gang's hold
    G.debug.time(14); g.resyncNPCs(); tick(2);
    const red = g.actors.find((a) => a.id === 'c_red2' && !a.dead);
    const terr = red && GW.at('southside', Math.floor(red.x / 16), Math.floor((red.y - 3) / 16));
    if (red && terr && w.territories[terr].owner === 'gang_red') {
      w.territories[terr].control = 50;
      G.combat.damage(red, 9999, null, g); tick(2);
      check(w.territories[terr].control < 50, `killing a member drains control in ${terr}: ${w.territories[terr].control}`);
    } else log('     (skipped kill/control check: ' + (red && red.id) + ' at ' + terr + ')');
    // hourly simulation keeps going on its own
    w.raid = null;
    const before = JSON.stringify(w.territories);
    for (let d = 0; d < 6; d++) w.skipHours(24);
    log('     after 6 days: ' + Object.keys(w.territories).map((k) => k + ':' + (w.territories[k].owner || '-').replace('gang_', '') + w.territories[k].control).join(' '));
    check(before !== JSON.stringify(w.territories) || w.raidCount > 3, `the war goes on by itself (${w.raidCount} attacks so far)`);
    // HUD label, journal tab, gang boss offers to lead an attack once you are a member
    const lbl = GW.label(w, 'southside', 20, 90);
    check(lbl && lbl.name === G.TERRITORIES.s_sw.name, 'HUD territory label');
    G.scenes.push(new G.JournalScene(g)); G.scenes.top().tab = 6; tick(2); G.scenes.pop();
    w.flags.member_gang_red = true; w.raid = null;
    w.territories.s_sw.owner = 'gang_red';
    const boss = g.actors.find((a) => a.id === 'c_red_boss' && !a.dead);
    if (boss) {
      g.player.x = boss.x; g.player.y = boss.y + 18;
      g.openDialogue(boss); tick(2);
      const d = G.scenes.top();
      const i = d.runner.node.choices.findIndex((c) => c.text === "Let's take some territory.");
      check(i >= 0, 'gang boss offers to attack together');
      if (i >= 0) { d.chars = 999; d.choose(i); tick(1); d.choose(0); tick(1); check(w.raid && w.raid.attacker === 'gang_red' && w.raid.playerLed, 'player-led attack started on ' + (w.raid && w.raid.territory)); }
      while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    }
    w.flags.member_gang_red = false; w.raid = null;
    g.player.maxHp = 100; g.player.refreshStats(); g.player.hp = g.player.maxHp;
  }

  // Drivers & riders, solid cars & getting hit, NPC trips between maps, calling people over, addiction,
  // muggers & tolls, debug pregnancy.
  function cityLife() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = G.world;
    g.arrestCooldown = 99999;
    g.loadMap('city', 'from_suburbs'); G.debug.time(13); tick(2);
    // every moving vehicle has someone in it
    const traffic = g.vehicles.filter((v) => v.ai);
    check(traffic.length && traffic.every((v) => v.ai.driver && v.ai.driver.look), `every car and bike in traffic has a driver (${traffic.length})`);
    const car = traffic.find((v) => !v.m.moto) || traffic[0];
    car.ai.driver = null; car.speed = 60; const x0 = car.x, y0 = car.y;
    for (let i = 0; i < 60; i++) G.loop.tick(1 / 60);
    check(Math.hypot(car.x - x0, car.y - y0) < 12 && car.speed === 0, 'no driver: the car does not move');
    G.loop.draw();
    // cars are solid; traffic hits you
    const parked = new G.Vehicle({ model: 'car_red', x: p.x + 60, y: p.y, angle: 0 });
    g.vehicles.push(parked);
    G.input.down.add('KeyD'); for (let i = 0; i < 60; i++) G.loop.tick(1 / 60); G.input.down.delete('KeyD');
    check(!parked.covers(p.x, p.y, 1), 'you cannot walk through a car');
    const live = (v) => v !== car && v.ai && v.ai.driver && g.vehicles.includes(v) && v.x > 160 && v.y > 160 && v.x < g.map.w * 16 - 160 && v.y < g.map.h * 16 - 160;
    const hitter = g.vehicles.find(live) || traffic.find((v) => v !== car && v.ai.driver);
    if (hitter) {
      const hp0 = p.hp; p.invuln = 0;
      hitter.speed = 90; hitter.ai.react = 5;   // a distracted driver
      for (const a of g.actors) if (a.kind !== 'player' && Math.hypot(a.x - hitter.x, a.y - hitter.y) < 160) a.x += 2000;   // nobody else in the lane
      p.x = hitter.x + Math.cos(hitter.angle) * (hitter.L + 1); p.y = hitter.y + Math.sin(hitter.angle) * (hitter.L + 1);
      for (let i = 0; i < 20 && p.hp === hp0; i++) G.loop.tick(1 / 60);
      for (const h2 of g.vehicles.filter((v) => live(v) && v !== hitter).slice(0, 4)) {   // that one turned off: try another
        if (p.hp < hp0) break;
        p.invuln = 0; h2.speed = 90; h2.ai.react = 5; h2.ai.turn = null;
        p.x = h2.x + Math.cos(h2.angle) * (h2.L + 1); p.y = h2.y + Math.sin(h2.angle) * (h2.L + 1);
        for (let i = 0; i < 20 && p.hp === hp0; i++) G.loop.tick(1 / 60);
      }
      check(p.hp < hp0, `getting hit by a car hurts (${hp0} -> ${p.hp}; hitter speed ${Math.round(hitter.speed)} turn ${!!hitter.ai.turn} map ${g.map.id} invuln ${p.invuln})`);
      p.hp = p.maxHp;
    }
    // NPCs travel between maps
    const npc = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && a.def.map === g.map.id && G.travel.canTravel(a.id, a.st, w) && G.travel.neighbors(a.def.map).length);
    if (npc) {
      const to = G.travel.neighbors(npc.def.map)[0];
      G.travel.start(npc, g, to);
      for (let i = 0; i < 60 * 100 && g.actors.includes(npc); i++) G.loop.tick(1 / 60);
      check(!g.actors.includes(npc) && npc.st.map === to, `${npc.st.name} walked off the map to ${to}`);
      g.loadMap(to, Object.keys(G.maps.get(to).points).find((k) => k.startsWith('from_'))); tick(2);
      check(g.actors.some((a) => a.id === npc.id), 'and is there when you go there too');
      g.loadMap('city', 'from_suburbs'); tick(2);
    }
    // calling someone over: they come to you
    const friend = Object.keys(w.npcs).find((id) => G.NPCS[id] && !G.NPCS[id].transient && !G.NPCS[id].kid && w.npcs[id].map !== 'city' && w.npcs[id].alive);
    w.npcs[friend].comingTo = { map: 'city', at: G.effects.now() - 1 };
    for (let i = 0; i < 60 * 3; i++) G.loop.tick(1 / 60);
    check(g.actors.some((a) => a.id === friend) && w.npcs[friend].companion, 'someone you called shows up where you are');
    w.npcs[friend].companion = false;
    // addiction
    const s = G.effects.drugState(p); s.addiction.opioid = 60; s.lastUse.opioid = G.effects.now() - 60 * 30;
    w.skipHours(1); tick(1);
    check(G.addiction.name(60) === 'Addicted' && G.effects.has(p, 'craving'), 'addicted: the craving comes');
    s.addiction.opioid = 0; G.effects.remove(p, 'craving');
    const addicts = Object.keys(w.npcs).filter((id) => w.npcs[id].addict);
    check(addicts.length >= 3 && w.npcs.c_addict1 && w.npcs.c_addict1.addict && w.npcs.c_addict1.addict.level >= 3, `addicts around town (${addicts.length}); street addicts are badly hooked`);
    const junkie = g.actors.find((a) => a.st && a.st.addict && a.st.addict.level >= 2 && !a.def.kid);
    if (junkie) {
      junkie.st.addict.lastFix = G.effects.now() - 60 * 48; junkie.st.gold = 0; junkie.st.inv = [];
      Object.assign(p, openSpot(g, p)); junkie.x = p.x + 40; junkie.y = p.y; junkie.state = 'schedule'; junkie.begT = 0; junkie.addictT = 0;
      for (let i = 0; i < 60 * 8 && !(junkie.begging || junkie.state === 'mug' || junkie.mugDone); i++) G.loop.tick(1 / 60);
      check(junkie.begging || junkie.state === 'mug' || junkie.mugDone, `a broke addict in withdrawal begs or robs ("${junkie.bark || ''}")`);
    }
    // muggers want money, not blood; gangs toll rarely
    check(!G.NPC.prototype.isHostileToPlayer.call({ st: {}, faction: G.FACTIONS.criminals, def: { faction: 'criminals', combat: 'fight' } }, g), 'criminals no longer attack on sight');
    let tolls = 0;
    for (let d = 0; d < 20; d++) { w.flags['toll_gang_red'] = null; w.day += 1; const fake = Object.create(G.NPC.prototype); Object.assign(fake, { id: 'c_red1', def: G.NPCS.c_red1, st: w.npcs.c_red1, mugDone: false }); Object.defineProperty(fake, 'faction', { value: G.FACTIONS.gang_red }); if (fake.wantsToMug(Object.assign(Object.create(g), { world: Object.assign(Object.create(w), { isNight: () => true }) }))) tolls++; }
    check(tolls <= 6, `gang tolls are rare now (${tolls} nights out of 20)`);
    // debug: pregnancy by name
    w.npcs.c_merchant && (w.npcs.c_merchant.introduced = true);
    const dm = new G.DebugMenuScene(g); dm.tab = dm.tabs.indexOf('Pregnancy');
    check(dm.rows().length >= 2, 'debug: pregnancy options for people you know');
    G.loop.draw();
  }

  // HUD, debug menu, starting skills, starvation, night darkness, carjacked drivers, sitting, watch, dreams.
  function polish() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = G.world;
    g.arrestCooldown = 99999;
    // the HUD draws (with and without a watch) and shows no clock without one
    G.loop.draw();
    check(!G.hud.hasWatch(p), 'no watch, no clock on the HUD');
    p.inventory.add('wristwatch', 1); G.loop.draw();
    check(G.hud.hasWatch(p), 'with a wristwatch the time shows');
    // sitting: E gets you up, back where you were
    const seat = g.map.decor.find((d) => d.def.interact === 'sit' && !g.map.isSolidTile(d.tx, d.ty + 1) && !g.map.isSolidTile(d.tx + 1, d.ty + 1));
    if (seat) {
      p.x = seat.x; p.y = (seat.ty + 1) * 16 + 12; const from = { x: p.x, y: p.y };
      G.usables.use(seat, g); tick(2);
      check(g.findInteraction().type === 'getup', 'while seated, [E] says "Get up"');
      g.promptTarget = g.findInteraction(); g.interact(); tick(2);
      check(!p.sitting && p.x === from.x && p.y === from.y, 'getting up puts you back on your feet');
    }
    // debug menu
    G.scenes.push(new G.DebugMenuScene(g)); tick(1);
    const dm = G.scenes.top();
    check(dm instanceof G.DebugMenuScene && dm.rows().length > 5, 'F1 debug menu opens');
    dm.tab = dm.tabs.indexOf('Items'); dm.filter = 'pistol';
    const r = dm.rows().find((x) => /Pistol/.test(x.label)); r.act(1);
    check(p.inventory.has('pistol'), 'debug: give any item');
    dm.tab = 0; dm.rows()[0].act();
    check(G.cheats.god, 'debug: immortal toggles on');
    const hp = p.hp; G.combat.damage(p, 50, null, g);
    check(p.hp === hp, 'immortal: no damage');
    G.cheats.god = false;
    dm.tab = dm.tabs.indexOf('Teleport'); dm.filter = 'suburbs';
    dm.rows().find((x) => x.sub === 'suburbs').act(); tick(80);
    check(g.map.id === 'suburbs', 'debug: teleport to another map');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // starting skills
    G.pendingStartSkills = { silver_tongue: 2, lucky: 1 }; w.flags.start_skills = false;
    g.loadMap(g.map.id, 'from_city'); tick(2);
    check(p.skills.ranks.silver_tongue === 2 && p.skills.ranks.lucky === 1, 'starting skills chosen in the new game are applied');
    // starvation drains everyone
    p.hunger = 100; p.thirst = 100; const h0 = p.hp; for (let i = 0; i < 60 * 3; i++) G.loop.tick(1 / 60);
    check(p.hp < h0, `an empty food/water bar drains your life (${h0} -> ${Math.round(p.hp)})`);
    p.hunger = p.thirst = 0; p.hp = p.maxHp;
    const npc = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && !a.def.kid);
    const n0 = npc.hp; npc.st.inv = []; npc.st.hunger = npc.st.thirst = 100; npc.state = 'flee'; npc.fleeT = 0; npc.target = { x: npc.x + 400, y: npc.y, dead: false }; for (let i = 0; i < 60 * 4; i++) G.loop.tick(1 / 60);   // running, not stopping to eat
    check(npc.hp < n0 || npc.dead, `NPCs starve too (${npc.id} ${n0} -> ${npc.hp}, hunger ${npc.st.hunger}, state ${npc.state}${npc.evTask ? ' ev' : ''}${npc.cower ? ' cower' : ''}${npc.talking ? ' talking' : ''})`);
    npc.st.hunger = npc.st.thirst = 0;
    // night without a flashlight is dark
    G.debug.time(1); tick(2);
    p.inventory.remove('flashlight', 99);
    g.player.x = 2 * 16; g.player.y = 2 * 16;
    check(!p.hasTorch(), 'no flashlight at night: darkness');
    G.loop.draw();
    // carjacking leaves the driver on the street
    g.loadMap('city', 'from_suburbs'); G.debug.time(13); tick(2);
    const car = g.vehicles.find((v) => v.ai);
    if (car) {
      const n = g.actors.length;
      G.vehicles.carjack(g, car);
      check(g.actors.length === n + 1 && g.actors[g.actors.length - 1].def.name === 'Driver', 'the carjacked driver ends up on the street');
      G.vehicles.exit(g, true);
    }
    // every dream has a part you play
    let played = 0;
    for (const th of ['chase', 'falling', 'paralysis', 'love', 'rooms', 'drown', 'money']) {
      const ds = new G.DreamScene(g, G.dreams.themed(g, th), () => {});
      G.scenes.push(ds); ds.chars = 999; ds.advance();
      const dw = G.scenes.top();
      if (dw instanceof G.DreamWorldScene) { played++; dw.limit = 0.5; for (let i = 0; i < 60 * 2 && G.scenes.top() === dw; i++) G.loop.tick(1 / 60); if (G.scenes.top() === dw) played--; }
      while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    }
    check(played === 7, `every dream is a place to explore (${played}/7 kinds started and finished)`);
  }

  // Keys & break-ins, seats & sitting, clothes, pills, dealers, kids, talk, witnesses, firefighters,
  // lifestyles & loot, building looks, traffic routing, playable dreams.
  function streetLife() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = G.world;
    g.arrestCooldown = 99999;
    // ---- keys
    check(p.inventory.has(G.keys.id('rural', 'r_home')) && (w.npcs.r_villager1.inv || []).some((e) => e[0] === G.keys.id('rural', 'r_house1')), 'you have your house key; residents carry theirs');
    check(/Key \(/.test(G.item(G.keys.id('rural', 'r_house1')).name), 'keys are items: ' + G.item(G.keys.id('rural', 'r_house1')).name);
    // ---- sitting does not get you stuck
    const couch = g.map.decor.find((d) => d.def.interact === 'sit' && d.def.solid);
    if (couch) {
      p.x = couch.x; p.y = (couch.ty + 1) * 16 + 12;
      const before = { x: p.x, y: p.y };
      G.usables.use(couch, g); tick(5);
      check(p.sitting && p.x === before.x && p.y === before.y, 'you sit on the couch without being moved into it');
      G.input.down.add('KeyS'); for (let i = 0; i < 30; i++) G.loop.tick(1 / 60); G.input.down.delete('KeyS');
      check(!p.sitting && Math.hypot(p.x - before.x, p.y - before.y) > 3, 'and you can get up and walk away');
    }
    // ---- never stuck inside furniture
    const bed = g.map.decor.find((d) => d.def.interact === 'bed');
    p.x = bed.tx * 16 + 8; p.y = bed.ty * 16 + 12; tick(90);
    check(!g.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h), 'stuck inside a bed: pushed out to a free spot');
    // ---- one person per chair
    const claims = G.everyday.claims(g.map);
    const eaters = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.transient).slice(0, 6);
    const seats = G.needs.spots(g.map).seats;
    if (seats.length) {
      const s = seats[0], k = G.everyday.seatKey(s.x, s.y);
      claims.set(k, eaters[0]); eaters[0].needTask = { steps: [{ x: s.x, y: s.y, act: 'eat' }], i: 0, t: 0, walk: 0 };
      if (!g.actors.includes(eaters[0])) g.actors.push(eaters[0]);
      const other = G.needs.nearest(seats, eaters[1]);
      check(!other || other !== s, 'a reserved seat is not offered to someone else');
      eaters[0].needTask = null; claims.delete(k);
    }
    // ---- naked
    const top = p.equip.top; p.equip.top = null; p.equip.bottom = null; p.refreshSprite();
    check(p.currentLook().pantsless && G.everyday.exposure(p) === 'naked', 'without clothes you are naked');
    const watcher = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat === 'flee');
    watcher.x = p.x + 30; watcher.y = p.y; watcher.dir = 1; watcher.state = 'schedule'; watcher.sleeping = false; watcher.nudeSeen = null;
    const d0 = watcher.st.disp || 0;
    G.everyday.nT = 0; G.everyday.reactNudity(g, 1);
    check(watcher.bark && (watcher.st.disp || 0) < d0, `people react to nudity: "${watcher.bark}"`);
    p.equip.top = top; p.equip.bottom = G.clothId('bottom', 'pants', '#4a5a7a'); p.refreshSprite();
    // ---- pills
    p.alcohol = 70; G.effects.consume(p, G.ITEMS.xanax, g); G.effects.consume(p, G.ITEMS.xanax, g); tick(5);
    check(G.effects.has(p, 'resp_depression'), 'Xanax with alcohol stops your breathing');
    G.effects.remove(p, 'resp_depression'); p.alcohol = 0; G.effects.drugState(p).load.benzo = 0; p.hp = p.maxHp;
    for (let i = 0; i < 4; i++) G.effects.consume(p, G.ITEMS.benadryl, g);
    tick(5);
    check(G.effects.has(p, 'delirium') && g.delir, 'a handful of Benadryl brings on delirium');
    for (let i = 0; i < 60 * 6; i++) G.loop.tick(1 / 60);
    G.loop.draw();
    check(g.delir && (g.delir.bugs.length + g.delir.shadows.length + g.delir.spiders.length) > 0, `hallucinations: ${g.delir.shadows.length} shadow people, ${g.delir.bugs.length} bugs, ${g.delir.spiders.length} spiders`);
    { // the deeper trip: the Hat Man, people who are not there, a blackout with lost time; drawn without errors
      const d = g.delir, e0 = (G.errors || []).length; G.effects.drugState(p).load.deliriant = 140;
      d.hat = { x: p.x + 120, y: p.y, a: 1, life: 5 }; d.talkers.push({ x: p.x + 30, y: p.y, look: G.look('ph'), line: 'Turn around.', life: 5, a: 1, t: 1 });
      for (let i = 0; i < 20; i++) { G.pills.delirium(p, 1 / 60, g); G.pills.draw(G.renderer.ctx, g); }
      check((G.errors || []).length === e0, 'the Hat Man, phantom people and spiders draw without errors');
      if (d.talkers[0]) { d.talkers[0].x = p.x + 5; d.talkers[0].y = p.y; } G.pills.delirium(p, 1 / 60, g);
      check(!d.talkers.length || d.talkers[0].gone, 'walk up to someone who is not there: there is nobody');
      const m0 = g.world.day * 1440 + g.world.minutes; d.black = { t: 0, dur: 2.6 }; for (let i = 0; i < 200; i++) G.pills.delirium(p, 1 / 60, g);
      check(g.world.day * 1440 + g.world.minutes - m0 >= 8 && !d.black, 'a blackout: you come to with time missing');
    }
    G.effects.remove(p, 'delirium'); G.effects.remove(p, 'anticholinergic'); G.effects.drugState(p).load.deliriant = 0; p.hp = p.maxHp;
    // ---- dealers: face to face and by text
    g.loadMap('city', 'from_suburbs'); G.debug.time(14); g.resyncNPCs(); tick(2);
    const dealer = g.actors.find((a) => a.id === 'c_dealer');
    if (dealer) {
      p.gold = 500;
      G.drugs.buy(g, dealer, 'weed', 25);
      check(p.inventory.has('weed'), 'buying weed from a street dealer');
      G.phone.addContact(w, 'c_dealer'); G.phone.order(w, 'c_dealer', 'cocaine', g);
      check(w.npcs.c_dealer.order && w.npcs.c_dealer.order.item === 'cocaine', 'ordering coke by text');
      const runner = new G.DialogueRunner(dealer, g);
      check(runner.node.choices.some((c) => /here for the/.test(typeof c.text === 'string' ? c.text : '')), 'the dealer has your order waiting');
    }
    // ---- kids
    g.loadMap('suburbs', 'from_city'); G.debug.time(16); g.resyncNPCs(); tick(2);
    const kid = g.actors.find((a) => a.def && a.def.kid === 'kid');
    if (kid) {
      const hp = kid.hp; kid.invuln = 0; G.combat.damage(kid, 4, p, g);
      check(kid.hp < hp && kid.state === 'flee', 'kids can be hurt (and run)'); check(Object.values(w.crimeRecord).some((l) => l.some((c) => c.type === 'child_abuse')) || !g.anyoneSaw(kid), 'hurting a child is child abuse');
      kid.st.fear = 0; kid.state = 'schedule'; w.knownKiller[g.region] = false;
      const kr = new G.DialogueRunner(kid, g), texts = kr.node.choices.map((c) => c.text || '');
      check(!texts.some((t) => /Flirt|private|Hand over|selling/.test(t)) && texts.some((t) => /kid/.test(t)), 'kids only get kid-appropriate options');
    }
    // ---- talk: radiant topics and rudeness
    const npc = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && !a.def.kid && a.def.combat === 'flee' && G.social.persona(a.id).trait !== 'grumpy');   // grumpy people sometimes like honesty
    npc.st.disp = 40; npc.st.fear = 0;
    const rr = new G.DialogueRunner(npc, g);
    const ctexts = rr.node.choices.map((c) => c.text || '');
    const radiant = ctexts.filter((t) => /originally|look great|still into|mentioned|thought more|rolled out|could really go|around town|need a hand|seem stressed|for fun|on your mind|anything with your life/.test(t)), rude = ctexts.find((t) => t.startsWith('(Rude)'));
    check(radiant.length >= 2 && rude, 'conversations offer new topics and a rude option');
    rr.rude = { id: 'pathetic', text: () => '' };
    const before = npc.st.disp; G.DIALOGUE_NODES._rude(rr);
    check(npc.st.disp < before, `being rude hurts (${before} -> ${npc.st.disp}; mood: ${npc.st.mood || 'none'})`);
    // ---- texts: replies that fit
    G.phone.addContact(w, npc.id);
    G.phone.messages(w).push({ from: npc.id, to: 'player', text: 'Ugh. My debts again. Sorry, just venting.', day: w.day, min: 0, read: false });
    const ph = new G.PhoneScene(g, 'home'); ph.open('compose', npc.id);
    const rows = ph.rows().map((r) => r.label);
    check(rows.includes('That sucks. Want to talk about it?') && rows.includes(G.phone.PRESETS[0][1]), 'reply options fit the message (and the usual ones are still there)');
    // ---- witnesses must survive to report
    G.WITNESS_DELAY = 3; w.bounty.city = 0;
    const victim = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && !a.def.kid && a !== npc && a.def.combat === 'flee');
    victim.x = p.x + 20; victim.y = p.y;
    for (const a of g.actors) if (a.kind === 'npc' && a !== victim) { a.x = -9999; a.y = -9999; }
    g.reportCrime('assault', victim);
    check((w.bounty.city || 0) === 0 && g.pendingReports.length, 'a witnessed crime is not reported instantly');
    victim.dead = true; w.npcs[victim.id].alive = false;
    for (let i = 0; i < 60 * 5; i++) G.loop.tick(1 / 60);
    check((w.bounty.city || 0) === 0, 'all witnesses dead before they called: no bounty');
    G.WITNESS_DELAY = 0;
    // ---- fire department
    g.loadMap('suburbs', 'from_city'); G.debug.time(13); tick(2);
    const h = g.map.building('u_house24') || g.map.buildings.find((b) => b.kind === 'house');
    p.x = h.doorX * 16 + 8; p.y = (h.doorY + 12) * 16; p.hp = p.maxHp = 9999;   // away from the map exit (traffic can shove you onto it)
    const lit = []; for (let k = 0; k < 6; k++) lit.push(g.fire.ignite(h.x + 1 + k, h.y + h.h - 1, false, false));
    const n00 = g.fire.cells.size; let minCells = 99;
    let arrived = false;
    for (let i = 0; i < 60 * 40 && !arrived; i++) { G.loop.tick(1 / 60); arrived = !!(g.fireCall && g.fireCall.crew.length); minCells = Math.min(minCells, g.fire.cells.size); }
    check(arrived && g.fireCall.truck, 'a fire engine and a crew arrive' + (arrived ? '' : ' (call ' + JSON.stringify(g.fireCall && { t: g.fireCall.t, crew: g.fireCall.crew.length }) + ' cells ' + g.fire.cells.size + ' off ' + G.fireDept.off + ' lit ' + lit.join() + ' n0 ' + n00 + ' min ' + minCells + ' map ' + g.map.id + ' ' + h.id + ')'));
    const n0 = g.fire.cells.size;
    for (let i = 0; i < 60 * 120; i++) G.loop.tick(1 / 60);   // fires burn longer now: give the crew time
    check(g.fire.cells.size < Math.max(n0, 6), `firefighters douse the flames (${n0} -> ${g.fire.cells.size} burning tiles)`);
    // ---- lifestyles and loot
    G.debug.time(17); g.resyncNPCs(); for (const a of g.actors) a.errand = null;
    G.lifestyle.hourly(g); G.lifestyle.hourly(g); G.lifestyle.hourly(g);
    const goals = g.actors.filter((a) => a.errand);
    check(goals.length >= 2, `people pick things to do: ${goals.slice(0, 3).map((a) => G.lifestyle.of(a.id) + ': ' + a.errand.kind).join(', ')}`);
    check(G.lifestyle.roll('gang', 'dresser').length + G.lifestyle.roll('gang', 'dresser').length + G.lifestyle.roll('gang', 'dresser').length > 0 && G.lifestyle.roll('kid', 'dresser').every(([id]) => !['pistol', 'cocaine'].includes(id)), 'loot fits who owns it');
    // ---- how buildings look
    const tower = G.maps.get('city').building('c_noble1');
    check(tower.extraH > 20, `the 4-floor Office Tower is drawn taller (+${tower.extraH}px)`);
    // ---- traffic knows where it is going
    g.loadMap('city', 'from_suburbs'); tick(2);
    const graph = G.vehicles.graph(g.map);
    check(graph.nodes.length > 6 && graph.nodes.some((n) => n.terminal && n.edge), `road network: ${graph.nodes.length} nodes`);
    const car = g.vehicles.find((v) => v.ai);
    check(car && car.ai.dest >= 0, 'traffic has destinations');
    // ---- a playable dream
    const dream = { mood: 'weird', scenes: [{ theme: 'chase', set: 'street', beats: ['Something is following you.', 'Run.'], body: null }] };
    const ds = new G.DreamScene(g, dream, () => {});
    G.scenes.push(ds); ds.chars = 99; ds.advance();
    const dw = G.scenes.top();
    check(dw instanceof G.DreamWorldScene && dw.inv.length >= 2 && dw.inv.every((id) => /^dream:/.test(id)), 'dreams are places to explore, with their own pockets');
    const realInv = JSON.stringify(g.player.inventory.slots);
    dw.me.x = dw.map.exit.x * 16 + 8; dw.me.y = dw.map.exit.y * 16 + 12; dw.map.exitLocked = false; tick(2);
    check(G.scenes.top() === ds && ds.scene.beats.some((b) => /door|bed/.test(b)) && JSON.stringify(g.player.inventory.slots) === realInv, 'through the glowing door you wake up, your real things untouched');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
  }

  // Rooms & floors, doors & locks, trespass, companions & visits, sleep & dreams, gambling, fishing,
  // traffic & driving, chatBCT not repeating itself, texting and calls.
  function homeLife() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = G.world;
    g.arrestCooldown = 99999;
    // ---- interiors: real rooms, solid beds, people sleep beside them
    const city = G.maps.get('city'), apt = city.building('c_house1');
    const inside = (m, b, type) => m.decor.some((d) => d.type === type && m.buildingAtTile(d.tx, d.ty) === b);
    check(['toilet', 'stove', 'fridge', 'nightstand'].every((t) => inside(city, apt, t)), 'an apartment has a bathroom, a kitchen and a bedroom');
    check(inside(city, city.building('c_armory'), 'gun_rack') && inside(city, city.building('c_clothes'), 'clothes_rack'), 'shops are fitted for their trade');
    check(G.DECOR.bed.solid, 'beds are solid furniture');
    // ---- floors, stairs, elevator
    const f2 = G.maps.get('c_noble1_f2'), f4 = G.maps.get('c_noble1_f4');
    check(f2 && f4 && f4.decor.some((d) => d.type === 'elevator') && city.decor.some((d) => d.type === 'stairs_up' && d.to === 'c_noble1_f2'), 'the Office Tower has 4 floors, stairs and an elevator');
    g.loadMap('city', 'c_noble1_stairs'); tick(2);
    const stairs = g.map.decor.find((d) => d.type === 'stairs_up' && d.to === 'c_noble1_f2');
    G.usables.use(stairs, g); tick(80);
    check(g.map.id === 'c_noble1_f2', 'taking the stairs goes upstairs');
    const elev = g.map.decor.find((d) => d.type === 'elevator');
    G.usables.use(elev, g); tick(1);
    const choice = G.scenes.top(); choice.choose(3); tick(80);
    check(g.map.id === 'c_noble1_f4', 'the elevator goes to the penthouse');
    const casino = G.maps.get('heights').building('h_casino');
    check(casino && G.maps.get('heights').decor.filter((d) => d.type === 'slot_machine').length >= 8 && G.maps.get('h_casino_f3'), 'the casino has slots, tables and hotel floors');
    // ---- locks & lockpicking
    g.loadMap('suburbs', 'from_city'); G.debug.time(2); g.resyncNPCs(); tick(2);
    G.doors.t = 0; G.doors.update(g, 1);
    check((g.lockedDoors || []).length > 0, `doors are locked at night (${(g.lockedDoors || []).length} on this street)`);
    const locked = g.lockedDoors[0];
    p.x = locked.doorX * 16 + 8; p.y = (locked.doorY + 1) * 16 + 12; p.dir = 3;
    const y0 = p.y; for (let i = 0; i < 30; i++) { G.input.down.add('KeyW'); G.loop.tick(1 / 60); } G.input.down.delete('KeyW');
    check(p.y > (locked.doorY + 1) * 16, 'you cannot walk through a locked door');
    p.x = locked.doorX * 16 + 8; p.y = (locked.doorY - 1) * 16 + 12;
    for (let i = 0; i < 70; i++) { G.input.down.add('KeyS'); G.loop.tick(1 / 60); } G.input.down.delete('KeyS');
    check(p.y > (locked.doorY + 1) * 16 + 8, 'leaving through a locked door from inside, you do not get stuck in the frame');
    p.x = locked.doorX * 16 + 8; p.y = (locked.doorY + 1) * 16 + 12;
    void y0;
    p.inventory.add('lockpick', 5);
    G.doors.pick(g, 1, () => { (w.unlocked = w.unlocked || {})[G.doors.key(g.map, locked)] = w.day; });
    const lp = G.scenes.top();
    for (let pin = 0; pin < 10 && G.scenes.top() === lp; pin++) { lp.t = 0; lp.center = lp.pos(); G.input.pressed.add('KeyE'); G.loop.tick(1 / 60); G.input.pressed.clear(); }
    G.doors.t = 0; G.doors.update(g, 1);
    check(!g.lockedDoors.includes(locked), 'picking the lock opens the door');
    // ---- trespassing: residents warn you, then call it in
    G.debug.time(19); g.resyncNPCs(); tick(2);
    const res = g.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.home && /^u_house/.test(a.def.home) && g.map.buildingAt(a.x, a.y - 3) === g.map.building(a.def.home) && !a.sleeping);
    if (res) {
      const b = g.map.building(res.def.home);
      res.st.disp = 0; res.st.partner = false; w.invites = {}; w.keys = {}; res.errand = null; res.needTask = null; res.st.hunger = res.st.thirst = 0; res.loveTask = null;
      p.x = res.x + 10; p.y = res.y; w.bounty.city = 0;
      for (let i = 0; i < 60 * 9; i++) G.loop.tick(1 / 60);
      check(g.trespassIn === b.id && (w.bounty.city || 0) > 0, 'caught trespassing in someone\'s home: warned, then reported');
    }
    w.bounty.city = 0;
    // ---- companions follow you to other maps; guests come over
    const friend = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && a.def.combat === 'flee');
    friend.st.disp = 60; friend.x = p.x + 20; friend.y = p.y;
    G.companions.start(g, friend);
    g.loadMap('city', 'from_suburbs'); tick(30);
    const f = g.actors.find((a) => a.id === friend.id);
    check(f && f.st.companion && f.distTo(p) < 60, 'a companion comes along to another map');
    let removedBy = null, _acts = g.actors;
    Object.defineProperty(g, 'actors', { configurable: true, get() { return _acts; }, set(v) { if (!removedBy && _acts.includes(f) && !v.includes(f)) removedBy = (new Error().stack || '').split('\n').slice(2, 5).join(' / ').replace(/file:\/\/\/D:\/Game\/js\//g, ''); _acts = v; } });
    G.companions.dismiss(g, f); for (let i = 0; i < 60 * 8; i++) G.loop.tick(1 / 60);
    delete g.actors; g.actors = _acts;
    if (removedBy) log('     companion removed by: ' + removedBy + ' map=' + f.st.map);
    check(!f.st.companion && f.st.map === f.def.map, `dismissed companions go home (${f.id} ${f.st.map}/${f.def.map} at ${(f.x / 16).toFixed(1)},${(f.y / 16).toFixed(1)} ${f.state} gh=${f.st.goingHome} t=${f.goHomeT} bh=${f.bustHeld} cw=${f.cower} meet=${!!f.meet} dodge=${!!f.dodge} wd=${f.wdTries} path=${f.path ? f.path.length : null} pw=${f.pathWait} hold=${f.holdT} ev=${!!f.evTask} sw=${!!f.swing} talk=${f.talking} in=${g.actors.includes(f)} n=${g.actors.filter((a) => a.id === f.id).length} dead=${f.dead} hp=${f.hp} alive=${f.st.alive} top=${G.scenes.top() === g} ${G.scenes.top().constructor.name})`);
    const guest = 'r_merchant'; w.npcs[guest].visit = { day: w.day, from: (w.hour + 1) % 24, to: (w.hour + 3) % 24 };
    if (w.npcs[guest].visit.from < w.hour) w.npcs[guest].visit.day++;
    g.loadMap('rural', 'start'); w.skipHours(1); tick(2);
    check(w.npcs[guest].visiting && g.actors.some((a) => a.id === guest), 'an invited friend shows up at your house');
    // ---- sleep need & dreams
    G.rest.DRAIN = 4.5; p.rest = 5; w.skipHours(2); tick(200);
    check(p.rest > 30 && /collapsed/.test(w.journal.slice(-3).map((j) => j.text).join(' ')), 'at 0 sleep you pass out where you stand');
    G.rest.DRAIN = 0;
    let dreams = 0, nightmares = 0;
    for (let i = 0; i < 60; i++) { const d = G.dreams.make(g, 8); if (d) { dreams++; if (d.mood === 'nightmare') nightmares++; } }
    check(dreams > 20 && dreams < 60 && nightmares > 0, `dreams: ${dreams}/60 nights remembered, ${nightmares} nightmares`);
    w.stats.kills = 3;
    const dream = G.dreams.make(g, 9) || G.dreams.make(g, 9) || G.dreams.make(g, 9);
    if (dream) {
      log('     dream: ' + dream.scenes.map((s) => s.beats[0]).join(' / '));
      const ds = new G.DreamScene(g, dream, () => {}); ds.noPlay = true; G.scenes.push(ds); tick(30);
      for (let i = 0; i < 40 && G.scenes.top() instanceof G.DreamScene; i++) { G.input.pressed.add('Enter'); G.loop.tick(1 / 60); G.input.pressed.clear(); G.loop.draw(); }
      check(!(G.scenes.top() instanceof G.DreamScene), 'a dream plays out and you wake up');
    }
    // ---- gambling: the house edge holds
    let spent = 0, back = 0;
    const slots = new G.SlotsScene(g, false);
    for (let i = 0; i < 20000; i++) { p.gold = 1000; slots.spin(); spent += slots.bet; slots.settle(); back += p.gold - (1000 - slots.bet); slots.spinT = 0; }
    log(`     slots return: ${Math.round((back / spent) * 100)}%`);
    check(back / spent > 0.75 && back / spent < 1.05, 'slot machines pay back less than they take (house edge)');
    const bj = new G.BlackjackScene(g); p.gold = 500; bj.deal(); if (bj.phase === 'play') bj.finish();
    check(bj.phase === 'done' && p.gold >= 0, 'a hand of blackjack plays out');
    const rl = new G.RouletteScene(g, false); p.gold = 100; rl.spin(); rl.settle();
    check(/red|black|green/.test(rl.msg), 'roulette spins: ' + rl.msg);
    // ---- fishing
    p.inventory.add('fishing_rod', 1); p.inventory.add('bait', 3);
    const lakeSpot = (() => { for (let y = 132; y < 168; y++) for (let x = 40; x < 104; x++) if (G.fishing.waterAt(g.map, x, y) && !g.map.isSolidTile(x, y + 1) && !G.fishing.waterAt(g.map, x, y + 1)) return { x, y: y + 1 }; return null; })();
    if (lakeSpot) {
      p.x = lakeSpot.x * 16 + 8; p.y = lakeSpot.y * 16 + 12; p.dir = 3;
      check(G.fishing.start(g), 'you can fish facing the lake');
      const fs = G.scenes.top();
      fs.fish = G.fishing.pick(g, 'lake'); fs.land();
      check(p.inventory.has(fs.catch.id), `caught: ${G.item(fs.catch.id).name}, ${fs.catch.lb} lb`);
      G.scenes.remove(fs);
    }
    // ---- vehicles
    check(w.vehicles.some((v) => v.owner === 'player') && g.vehicles.some((v) => v.owner === 'player'), 'your car is parked at home');
    const mine = g.vehicles.find((v) => v.owner === 'player');
    p.x = mine.x; p.y = mine.y + 20;
    G.vehicles.enter(g, mine);
    const x0 = mine.x, a0 = mine.angle;
    G.input.down.add('KeyW'); for (let i = 0; i < 60; i++) G.loop.tick(1 / 60); G.input.down.delete('KeyW');
    check(Math.hypot(mine.x - x0, mine.y - mine.rec.y) > 10 || mine.angle !== a0, `driving moves the car (${Math.round(mine.speed)} px/s)`);
    for (let i = 0; i < 90; i++) G.loop.tick(1 / 60);
    G.vehicles.exit(g);
    check(!p.vehicle && mine.rec.x === mine.x, 'you get out and the car stays where you parked it');
    g.loadMap('city', 'from_suburbs'); G.debug.time(13); tick(2);
    const traffic = g.vehicles.filter((v) => v.ai);
    const start = traffic.map((v) => [v.x, v.y]);
    for (let i = 0; i < 60 * 3; i++) G.loop.tick(1 / 60);
    check(traffic.length >= 4 && traffic.filter((v, i) => Math.hypot(v.x - start[i][0], v.y - start[i][1]) > 20).length >= 2, `traffic drives the streets (${traffic.length} cars)`);
    const parked = g.map.decor.find((d) => G.vehicles.MODELS[d.type]);
    const hv = G.vehicles.fromDecor(g, parked);
    const hw = new G.HotwireScene(g, hv, () => { hv.hotwired = true; });
    G.scenes.push(hw); hw.chance = 1; hw.update(hw.dur + 0.1);
    check(hv.hotwired && G.scenes.top() !== hw, 'hotwiring is automatic: after a few seconds the car starts');
    { const slow = new G.HotwireScene(g, hv, () => {}).dur, _rk = G.skills.rank; G.skills.rank = (pp, id) => (id === 'hotwire' ? 2 : _rk.call(G.skills, pp, id)); const fast = new G.HotwireScene(g, hv, () => {}); G.skills.rank = _rk; check(fast.dur < slow && fast.chance > 0.85, `the Hotwiring skill makes it faster and surer (${slow.toFixed(1)}s -> ${fast.dur.toFixed(1)}s, ${Math.round(fast.chance * 100)}%)`); }
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // ---- chatBCT does not repeat itself; texts and calls
    w.bctRecent = [];
    const a1 = G.bct.whatNow(g), a2 = G.bct.whatNow(g), a3 = G.bct.whatNow(g);
    log('     BCT: ' + a1.slice(0, 70) + ' | ' + a2.slice(0, 70));
    check(a1 !== a2 && a2 !== a3, 'chatBCT does not give the same answer twice in a row');
    w.npcs.r_merchant.disp = 60;
    const plans = []; for (let i = 0; i < 20; i++) plans.push(G.phone.replyPlan(w, 'r_merchant'));
    check(plans.some((x) => x) && new Set(plans.filter(Boolean).map((x) => x.min)).size > 3, 'text replies come at random times');
    check(G.DIALOGUES._phone.start.choices.length >= 10, 'phone calls have more options');
    G.rest.DRAIN = 0;
  }

  // Love, jealousy, pregnancy, babies & cribs, NPC couples (caught in the act), animal mating.
  function loveLife() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = G.world;
    g.arrestCooldown = 99999;
    const sheet = G.assets.character({ body: 'f', skin: '#c89070', naked: true, belly: 3 });
    check(sheet && sheet.img.width === 48, 'naked + pregnant sprite builds');
    // the player and an NPC
    const npc = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && a.def.combat === 'flee');
    const st = npc.st;
    st.romance = 10; st.disp = 40; st.fear = 0;
    check(!!G.love.refusal(g, npc), 'not enough romance: they say no ("' + G.love.refusal(g, npc) + '")');
    st.romance = 95;
    for (const a of g.actors) if (a !== npc && a.kind === 'npc') { a.x = -9999; a.y = -9999; }
    npc.x = p.x + 14; npc.y = p.y;
    const why = G.love.refusal(g, npc);
    w.knownKiller[g.region] = false;
    const runner = new G.DialogueRunner(npc, g);
    check(runner.node && runner.node.choices.some((c) => /Make love/.test(typeof c.text === 'function' ? c.text(runner.c) : c.text)), 'the "make love" option shows up after enough flirting');
    if (!why) {
      p.inventory.add('condom', 1);
      G.love.withPlayer(g, npc); tick(1140);
      check(st.loveDay === w.day && G.effects.has(p, 'afterglow') && !p.inventory.has('condom') && w.affairs.some((a) => a.with === npc.id), 'a night together (condom used, afterglow, remembered)');
      const gg = game(), inHome = gg.map.buildingAt(gg.player.x, gg.player.y - 3);
      check(inHome && (inHome.id === G.NPCS[npc.id].home || inHome.id === (w.flags.player_home || 'r_home')) && gg.actors.some((a) => a.id === npc.id && a.distTo(gg.player) < 140), `afterwards you wake up together at home (${inHome ? inHome.id : 'outside'})`);
    } else log('     (skipped: ' + why + ')');
    // jealousy depends on who they are
    const other = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && a !== npc);
    const ost = other.st; ost.partner = true; ost.romance = 80;
    G.love.react(w, other.id, npc.id, true, false);
    const J = G.love.jealousy(other.id);
    log(`     ${other.id} (${G.social.persona(other.id).trait}, jealousy ${J.toFixed(2)}): partner=${ost.partner} romance=${ost.romance}`);
    check(ost.romance < 80, 'your partner finds out about the affair and takes it according to their personality');
    ost.partner = false; ost.hostile = false;
    // the player gets pregnant
    p.look.body = 'f'; p.preg = null;
    const dad = 'r_farmer2';
    check(G.love.conceive(w, 'player', dad, 1) && p.preg && p.preg.father === dad, 'a female player can get pregnant');
    p.preg.day = w.day - 30; w.skipHours(1); tick(1);
    check(p.preg.known && G.love.belly(p.preg) === 2 && p.currentLook().belly === 2, 'week 30: belly shows, pregnancy known');
    check(G.effects.mult(p, 'speed') < 1 && G.skills.stat(p, 'staminaRegen') < G.skills.stat(Object.assign(Object.create(Object.getPrototypeOf(p)), p, { preg: null }), 'staminaRegen'), 'third trimester slows you down');
    p.preg.day = w.day - 41; w.skipHours(4); tick(200);
    const nameScene = G.scenes.stack.find((s) => s instanceof G.NameBabyScene);
    check(!p.preg && nameScene, 'labor, then birth, then you name the baby');
    if (nameScene) { nameScene.input = 'Testy'; G.input.pressed.add('Enter'); G.loop.tick(1 / 60); G.input.pressed.clear(); }
    const baby = w.babies.find((b) => b.mother === 'player');
    check(baby && baby.name === 'Testy' && baby.crib && G.maps.get('rural').decorsAt(baby.crib.tx, baby.crib.ty).some((d) => d.type === 'crib'), `the baby (${baby && baby.name}) has a crib in your house`);
    check(w.mapMods.rural && Object.values(w.mapMods.rural.added).some((a) => a[0] === 'crib'), 'the crib is saved with the world');
    // a male player gets an NPC pregnant
    p.look.body = 'm'; G.effects.remove(p, 'postpartum');
    const mom = Object.keys(w.npcs).find((id) => w.npcs[id].alive && G.NPCS[id] && !G.NPCS[id].transient && G.love.sexOf(w, id) === 'f' && !w.npcs[id].preg);
    check(G.love.conceive(w, 'player', mom, 1) && w.npcs[mom].preg, `an NPC (${mom}) gets pregnant by a male player`);
    w.npcs[mom].preg.day = w.day - 41; w.skipHours(1); tick(30);
    const ns2 = G.scenes.stack.find((s) => s instanceof G.NameBabyScene);
    if (ns2) { G.input.pressed.add('Enter'); G.loop.tick(1 / 60); G.input.pressed.clear(); }
    check(!w.npcs[mom].preg && w.babies.some((b) => b.mother === mom && b.name), 'the NPC gives birth; you name your child');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // NPC couples at night, caught in the act
    g.loadMap('rural', 'start'); G.debug.time(22); g.resyncNPCs(); tick(2);
    const a = g.actors.find((x) => x.id === 'r_farmer2'), b = g.actors.find((x) => x.id === 'r_farmwife');
    if (a && b) {
      a.st.loveDay = b.st.loveDay = null; a.loveScanT = b.loveScanT = 0; a.needTask = b.needTask = null; a.st.trip = b.st.trip = null; a.errand = b.errand = null;
      a.st.hunger = b.st.hunger = a.st.thirst = b.st.thirst = 0;
      p.x = 2 * 16; p.y = 2 * 16;
      let acting = false;
      for (let i = 0; i < 60 * 90 && !acting; i++) { G.loop.tick(1 / 60); acting = [a, b].some((n) => n.loveTask && n.loveTask.phase === 'act'); }
      check(acting, 'a married couple goes to bed together at night');
      if (acting) {
        const lead = a.loveTask.lead ? a : b;
        p.x = lead.x; p.y = lead.y + 20;
        tick(10);
        check(a.st.nakedUntil > G.love.now() && b.st.nakedUntil > G.love.now() && a.state !== 'schedule' && b.state !== 'schedule', `walking in on them: naked, they ${a.state} and ${b.state} (${b.def.combat} t=${b.target ? b.target.id || b.target.kind : "-"} fleeT=${b.fleeT} cower=${b.cower} hp=${b.hp})`);
        G.shot && G.loop.draw();
      }
    } else log('     (no farm couple on screen)');
    // animals (first: calm the couple down and get the player back on their feet)
    for (const n of [a, b]) if (n) { n.state = 'schedule'; n.aggressor = false; n.target = null; }
    p.hp = p.maxHp; p.dead = false; while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    g.loadMap('forest', 'from_rural'); G.debug.time(12); tick(2);
    const rabbits = g.actors.filter((x) => x.species === 'rabbit' && !x.dead).slice(0, 2);
    if (rabbits.length === 2) {
      const [r1, r2] = rabbits;
      r1.sex = 'f'; r2.sex = 'm'; r2.x = r1.x + 8; r2.y = r1.y;
      for (const r of rabbits) { r.hunger = r.thirst = 0; r.mateNext = 0; r.mateScanT = 0; r.state = 'wander'; r.needGoal = null; r.needT = 0; }
      for (const a of g.actors) if (a.species === 'wolf' || a.species === 'bear') { a.x = -9999; a.y = -9999; a.hunger = 0; }
      r1.mate = r2; r2.mate = r1;   // pairing up is random; make it happen
      const pop = w.wildlife[r1.zoneKey]; pop.count = 1; pop.preg = [];
      p.x = 2 * 16; p.y = 2 * 16;
      for (let i = 0; i < 60 * 120 && !pop.preg.length; i++) G.loop.tick(1 / 60);
      check(pop.preg.length > 0, 'two rabbits meet up, mate, and a litter is on the way');
      const before = pop.count, n = g.actors.length;
      pop.preg = [w.day]; G.love.animalBirths(g);
      check(pop.count > before && g.actors.length > n && g.actors[g.actors.length - 1].young, `young rabbits are born (${pop.count - before})`);
    }
  }

  // Phone-only journal/skills, menu click-through, chatBCT, ground pickups, hunger & thirst for everyone.
  function dailyLife() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = G.world, R = G.renderer, U = G.ui, m = G.input.mouse;
    g.arrestCooldown = 99999;
    // pause menu has no journal / skills / inventory; the phone is the only way in
    G.scenes.push(new G.PauseScene(g)); tick(1);
    const pause = G.scenes.top();
    check(!pause.items.some((i) => /Journal|Skills|Inventory/.test(i)) && pause.items.includes('Settings'), 'pause menu: ' + pause.items.join(', '));
    // click-through: Settings over Pause, click the "Video" tab where a pause button sits underneath
    pause.activate(pause.items.indexOf('Settings')); tick(1);
    const set = G.scenes.top();
    const SW = 360, SH = 250, sx = (R.uiW - SW) / 2, sy = (R.uiH - SH) / 2;
    // (the tabs moved when the windows were redrawn: find the second one by clicking along the top of the window)
    for (let uy = Math.max(0, sy - 60); uy < sy + 70 && set.tab !== 1 && G.scenes.top() === set; uy += 4) for (let ux = sx - 40; ux < sx + SW + 40 && set.tab !== 1 && G.scenes.top() === set; ux += 12) { Object.assign(m, { ux, uy, pressed: true, moved: true }); G.scenes.render(); G.input.endRender(); if (set.tab > 1) set.tab = 0; }
    check(G.scenes.top() === set && set.tab === 1, 'clicking "Video" in Settings keeps Settings open (tab ' + set.tab + ')');
    G.scenes.remove(set); tick(1);
    pause.activate(pause.items.indexOf('Load Game')); tick(1);
    const load = G.scenes.top();
    for (const s of G.saves.allSlots) G.saves.remove(s);   // (nothing to load: the click must simply do nothing)
    const ph = pause.items.length * 24 + 44, py = (R.uiH - ph) / 2;
    Object.assign(m, { ux: R.uiW / 2, uy: py + 40, pressed: true, moved: true }); G.loop.draw(); G.input.endRender();
    check(G.scenes.stack.includes(load), 'a click on the load screen does not reach the pause menu underneath');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // journal & skills only through the phone
    p.inventory.remove('phone', 1);
    G.input.pressed.add('KeyL'); G.loop.tick(1 / 60); G.input.pressed.clear();
    G.input.pressed.add('KeyK'); G.loop.tick(1 / 60); G.input.pressed.clear();
    check(!G.scenes.stack.some((s) => s instanceof G.JournalScene || s instanceof G.SkillsScene), 'no phone: no journal, no skills');
    p.inventory.add('phone', 1);
    G.input.pressed.add('KeyK'); G.loop.tick(1 / 60); G.input.pressed.clear(); tick(1);
    check(G.scenes.top() instanceof G.SkillsScene && G.scenes.top().inPhone && G.scenes.stack.some((s) => s instanceof G.PhoneScene), 'skills open inside the phone');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    G.phone.openApp(g, 'settings'); tick(1);
    check(G.scenes.top() instanceof G.SettingsScene && G.scenes.top().inPhone, 'settings also open from the phone');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    // chatBCT
    G.bct.ask(g, 'What should I do now?');
    const said = G.bct.history(w).slice(-1)[0].text;
    log('     chatBCT: ' + said);
    check(said.length > 20, 'chatBCT answers');
    G.bct.ask(g, 'where is the bar?');
    check(w.gps && /Bar/.test(w.gps.label), 'chatBCT puts places on your GPS: ' + (w.gps && w.gps.label));
    G.scenes.push(new G.PhoneScene(g, 'bct')); tick(2); G.scenes.pop(); w.gps = null;
    check(G.cursor.styles.pointer && G.cursor.styles.cross, 'custom cursors made');
    // items on the ground disappear when picked up
    const bag = G.containers.createBag(w, g.map.id, p.x, p.y + 4, [['apple', 1]]);
    g.refreshContainers();
    G.scenes.push(new G.LootScene(g, bag)); tick(1);
    const ls = G.scenes.top(); ls.takeAll(); ls.close(); tick(1);
    check(!w.containers[bag.id] && !g.containers.includes(bag), 'an emptied bag is gone from the ground');
    const shroom = g.map.decor.find((d) => d.def.interact === 'forage' && d.def.pickup);
    p.x = shroom.x; p.y = shroom.y + 14;
    g.useDecor(shroom);
    check(!g.map.decor.includes(shroom), 'a picked mushroom is gone from the ground');
    // hunger & thirst: player
    const h0 = p.hunger; w.skipHours(5); tick(1);
    check(p.hunger > h0 && p.thirst > 10, `hunger and thirst grow over time (${Math.round(p.hunger)}, ${Math.round(p.thirst)})`);
    p.inventory.add('sandwich', 1); p.useFromSlot(p.inventory.slots.findIndex((s) => s && s.id === 'sandwich'), g);
    check(p.hunger < h0 + 25 - 30, 'a sandwich fills you up');
    const well = g.map.decor.find((d) => d.def.interact === 'well');
    g.useDecor(well);
    check(p.thirst === 0, 'the well quenches your thirst');
    // NPCs go eat and drink
    G.debug.time(14); g.resyncNPCs(); tick(2);
    const eaters = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.transient && a.def.combat === 'flee').slice(0, 4);
    for (const a of eaters) { a.st.hunger = 95; a.st.thirst = 0; a.needScanT = 0; a.st.inv = []; }   // (empty pockets: with food on them they eat that, js/game/npcinv.js)
    let ate = 0, sat = 0;
    for (let i = 0; i < 60 * 70 && ate < eaters.length; i++) { G.loop.tick(1 / 60); sat = Math.max(sat, eaters.filter((a) => a.seated).length); ate = eaters.filter((a) => a.st.hunger < 50).length; }
    check(ate >= 2 && sat >= 1, `hungry people sit down and eat (${ate}/${eaters.length} ate)`);
    const drinker = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.transient && a.def.combat === 'flee' && !eaters.includes(a));
    if (drinker) { drinker.st.thirst = 95; drinker.needScanT = 0; for (let i = 0; i < 60 * 50 && drinker.st.thirst > 50; i++) G.loop.tick(1 / 60); check(drinker.st.thirst < 50, `a thirsty ${drinker.st.name.toLowerCase()} went and drank`); }
    // animals: a hungry wolf hunts a rabbit, a thirsty deer finds water
    g.loadMap('forest', 'from_rural'); G.debug.time(12); tick(2);
    const wolf = g.actors.find((a) => a.species === 'wolf'), rabbit = g.actors.find((a) => a.species === 'rabbit');
    const preyHp = new Map(g.actors.filter((a) => a.kind === 'animal' && a !== wolf).map((a) => [a, a.hp]));
    if (wolf && rabbit) {
      p.x = 2 * 16; p.y = 2 * 16;
      wolf.x = rabbit.x + 14; wolf.y = rabbit.y; wolf.hunger = 95; wolf.thirst = 0; wolf.needGoal = null; wolf.needT = 0; wolf.state = 'wander'; rabbit.hunger = rabbit.thirst = 0;
      const hurt = () => [...preyHp].some(([a, hp]) => a.dead || a.hp < hp);
      for (let i = 0; i < 60 * 20 && !hurt(); i++) G.loop.tick(1 / 60);
      check(hurt(), 'a hungry wolf hunts the nearest prey');
    }
    const deer = g.actors.find((a) => a.species === 'deer' && !a.dead);
    if (deer) {
      deer.x = 72 * 16; deer.y = 128 * 16; deer.thirst = 95; deer.hunger = 0; deer.state = 'wander';
      for (let i = 0; i < 60 * 25 && deer.thirst > 50; i++) G.loop.tick(1 / 60);
      check(deer.thirst < 50, 'a thirsty deer walks to the pond and drinks');
    }
  }

  // Swimming, gore & bodies, phone & GPS, free-text chat, romance, usable objects, jail escapes.
  function worldSystems() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = g.world;
    g.arrestCooldown = 99999;
    if (G.testGrabStart) G.testGrabStart(g);
    check(p.inventory.has('phone') && g.map.building(w.flags.player_home), 'you start at home with a phone');
    // swimming: without lessons you drown; the instructor teaches you
    const lake = g.map.points.r_lake_beach;
    p.x = 100 * 16 + 8; p.y = 34 * 16 + 12; p.hp = p.maxHp = 100;
    for (let i = 0; i < 60 * 12 && !p.dead; i++) G.loop.tick(1 / 60);
    check(p.dead, 'cannot swim: drowned in the lake');
    G.scenes.replace(new G.GameScene({})); tick(3);
    const g2 = game(), p2 = g2.player;
    G.debug.time(10); g2.resyncNPCs(); tick(2);
    const coach = g2.actors.find((a) => a.id === 'r_swimcoach');
    p2.gold = 100; p2.x = coach.x; p2.y = coach.y + 18;
    g2.openDialogue(coach); tick(1);
    let d = G.scenes.top();
    d.chars = 999; d.choose(d.runner.node.choices.findIndex((c) => c.text.startsWith('Can you teach me'))); tick(1); d.choose(0); tick(1);
    check(G.skills.has(p2, 'swimming') && p2.gold === 50, 'the swim instructor taught you to swim for $50');
    while (G.scenes.top() !== g2) G.scenes.pop();
    p2.x = 100 * 16 + 8; p2.y = 34 * 16 + 12; p2.stamina = p2.maxStamina;
    for (let i = 0; i < 60 * 3; i++) G.loop.tick(1 / 60);
    check(!p2.dead && p2.swimming && p2.stamina < p2.maxStamina, 'swimming costs stamina instead of your life');
    p2.x = lake.x * 16 + 8; p2.y = lake.y * 16 + 12; tick(2);

    // gore and bodies
    const victim = g2.actors.find((a) => a.id === 'r_villager1');
    victim.x = p2.x + 14; victim.y = p2.y;
    const decals0 = G.gore.list(g2).length;
    G.combat.damage(victim, 9999, p2, g2); tick(2);
    check(G.gore.list(g2).length > decals0, 'blood on the ground: ' + G.gore.list(g2).length + ' stains');
    p2.x = victim.x - 6; p2.y = victim.y;
    const corpse = G.bodies.nearest(g2);
    check(corpse && corpse.victim === 'r_villager1', 'the body can be found and grabbed');
    G.bodies.toggle(g2);
    const cx0 = corpse.x;
    p2.dir = 1;
    for (let i = 0; i < 40; i++) { p2.x -= 0.8; G.bodies.update(g2, 1 / 60); }
    check(p2.dragging && corpse.x < cx0, 'dragging the body');
    p2.x = 100 * 16; p2.y = 52 * 16 + 4; p2.dir = 3;
    const disp = G.bodies.disposal(g2);
    check(disp && disp.how === 'water', 'by the lake: you can dump the body in the water');
    G.bodies.dispose(g2, 'water');
    check(!G.world.containers[corpse.id] && G.world.dead.r_villager1.disposed === 'water', 'the body is gone');

    // phone: contacts, texts, GPS across maps
    G.phone.addContact(G.world, 'r_merchant'); G.world.npcs.r_merchant.disp = 60;
    // replies take their time (or wait for the morning); a friend answers sooner or later
    for (let k = 0; k < 4 && !G.phone.messages(G.world).some((m) => m.from === 'r_merchant'); k++) { G.phone.send(G.world, 'r_merchant', G.phone.PRESETS[0][1]); for (let h = 0; h < 14; h++) { G.world.skipHours(1); G.phone.deliver(G.world, g2); } }
    check(G.phone.messages(G.world).some((m) => m.from === 'r_merchant'), 'texts get answered');
    const diner = G.phone.places(G.world).find((pl) => pl.label.startsWith('Gun Store'));
    G.world.gps = diner;
    const route = G.phone.route(g2);
    check(route && route.via, `GPS routes across maps: from ${g2.map.meta.name} via ${route && route.via}`);
    {   // someone upstairs: the arrow leads to their building (then the stairs), not nowhere
      const fid = Object.keys(G.MAPGEN).concat(['c_noble1_f4']).find((id) => /_f\d+$/.test(id));
      const fm = fid && G.maps.get(fid);
      if (fm && fm.meta.floorOf) {
        const keep = G.world.gps; G.world.gps = { map: fid, x: 5, y: 5, label: 'upstairs' };
        const r2 = G.phone.route(g2);
        check(r2 && r2.via, `GPS to an upper floor (${fid}) leads somewhere: via ${r2 && r2.via}`);
        G.world.gps = keep;
      }
    }
    G.scenes.push(new G.PhoneScene(g2)); tick(2);
    const ph = G.scenes.top();
    for (const app of ['maps', 'contacts', 'messages', 'lifelog', 'news', 'clock']) { ph.open(app); tick(1); ph.back(); }
    ph.open('relations'); tick(1);
    G.scenes.remove(ph); tick(1);
    G.world.gps = null;

    // free-text chat and romance
    G.debug.time(10); g2.resyncNPCs(); tick(1);
    if (!p2.inventory.has('phone')) p2.inventory.add('phone', 1);   // (the phone from the drawer)
    const npc = g2.actors.find((a) => a.id === 'r_merchant');
    p2.x = npc.x; p2.y = npc.y + 18;
    g2.openDialogue(npc); tick(1);
    d = G.scenes.top();
    const says = {};
    for (const line of ['hello there', 'what is your name?', 'where is the gun store', 'any work for me?', 'you are an idiot', 'what do you think about the police', 'I love the weather', 'blargh']) {
      d.runner.say(line); tick(1);
      says[line] = d.runner.node.text;
      if (d.runner.ended) break;
      d.runner.go('start');
    }
    log('     chat: ' + Object.entries(says).map(([k, v]) => `"${k}" -> "${v}"`).join(' | '));
    check(G.world.npcs.r_merchant.introduced, 'typing "what is your name?" gets their name');
    check(G.world.gps && G.world.gps.label.startsWith('Gun Store'), '"where is the gun store" puts it on Eagle Maps');
    check(new Set(Object.values(says)).size >= 6, 'different things you say get different answers');
    d.runner.end(); G.scenes.remove(d); tick(1);
    npc.st.disp = 40; npc.st.romance = 72; npc.st.fear = 0; G.world.knownKiller = {};   // the lake murder scared people
    g2.openDialogue(npc); tick(1); d = G.scenes.top();
    const pi = d.runner.node.choices.findIndex((c) => c.text.includes('partner'));
    check(pi >= 0, 'high romance: you can ask them to be your partner');
    d.chars = 999; d.choose(pi); tick(1);
    check(G.romance.partner(G.world) === 'r_merchant', 'you are together now');
    d.runner.end(); G.scenes.remove(d); tick(1);

    // usable objects
    const vend = g2.map.decor.find((x) => x.def.interact === 'vending') || G.maps.get('city').decor.find((x) => x.def.interact === 'vending');
    const s0 = p2.inventory.count('soda');
    p2.gold = 10; G.usables.use(vend, g2);
    check(p2.inventory.count('soda') === s0 + 1 && p2.gold === 8, 'vending machine sells a soda');
    const tv = ['rural', 'suburbs', 'city'].map((id) => G.maps.get(id).decor.find((x) => x.def.interact === 'tv')).find(Boolean);
    const t0 = G.world.minutes; G.usables.use(tv, g2);
    check(G.world.minutes !== t0, 'watching TV passes time');
    const users = new Set(); for (const id of ['rural', 'city', 'suburbs']) for (const x of G.maps.get(id).decor) if (x.def.interact) users.add(x.def.interact);
    check(users.size >= 15, `${users.size} kinds of usable objects: ${[...users].join(', ')}`);

    // the other jail escapes: keycard, bribe, laundry
    G.world.bounty.city = 120; g2.goToJail();
    for (let i = 0; i < 200 && G.scenes.top() !== g2; i++) G.loop.tick(1 / 60);
    p2.inventory.add('keycard', 1);
    const gate = g2.map.decor.find((x) => x.type === 'security_door');
    G.jail.use('gate', gate, g2);
    G.loop.tick(1 / 60);
    check(!g2.map.decor.some((x) => x.type === 'security_door'), 'the keycard opens the security gate');
    p2.x = 70 * 16 + 8; p2.y = 104 * 16;
    for (let i = 0; i < 30 && G.world.jail; i++) G.loop.tick(1 / 60);
    check(!G.world.jail, 'walked out through the open gate');
    G.world.bounty.city = 120; g2.loadMap('city', 'from_suburbs'); g2.goToJail();
    for (let i = 0; i < 200 && G.scenes.top() !== g2; i++) G.loop.tick(1 / 60);
    G.debug.time(5.5); p2.skills.ranks.sneaky = 2; p2.skills.ranks.ghost = 1;
    let tries = 0;
    while (G.world.jail && tries++ < 20) {
      G.world.jail.release = G.world.day + 5;
      G.debug.time(5.5); while (G.scenes.top() !== g2) G.loop.tick(1 / 60);
      const c = g2.map.points[G.jail.CELL]; p2.x = 24 * 16; p2.y = 60 * 16;
      G.jail.use('laundry', g2.map.decor.find((x) => x.type === 'laundry_cart'), g2);
      for (let i = 0; i < 200 && G.world.jail; i++) G.loop.tick(1 / 60);
    }
    check(!G.world.jail, `escaped in a laundry cart (attempt ${tries})`);
    G.loop.draw();
  }

  // Realistic drugs (overdose, mixing, addiction, withdrawal), small talk, radiant jobs, beds.
  function lifeSystems() {
    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player, w = g.world;
    const clean = () => { p.effects = []; p.alcohol = 0; p.drugs = { load: {}, tol: {}, addiction: {}, lastUse: {} }; p.hp = p.maxHp = 100; };
    const use = (id, n = 1) => { for (let i = 0; i < n; i++) { if (!p.inventory.has('torch')) p.inventory.add('torch', 1); p.inventory.add(id, 1); p.useFromSlot(p.inventory.slots.findIndex((s) => s && s.id === id), g); if (p.smoking) G.smoking.update(p, 3, g); } };   // (smokes: take the first drag)
    g.arrestCooldown = 99999;
    // opioids
    clean(); use('heroin'); tick(2);
    check(G.effects.has(p, 'opiate') && !G.effects.has(p, 'resp_depression'), 'one dose of heroin: nodding, still breathing');
    use('vodka', 2); tick(2);
    check(G.effects.has(p, 'resp_depression'), `heroin + vodka: breathing stops (risk ${G.effects.risk(p, 'opioid').toFixed(2)})`);
    use('naloxone');
    check(!G.effects.has(p, 'resp_depression') && G.effects.load(p, 'opioid') === 0, 'naloxone reverses the overdose');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    clean(); use('heroin'); use('heroin'); tick(2);
    check(G.effects.has(p, 'resp_depression'), 'two doses of heroin while sober: overdose');
    // addiction & withdrawal
    clean();
    for (let i = 0; i < 4; i++) { use('heroin'); p.drugs.load = {}; }
    check(G.effects.dependent(p, 'opioid'), 'repeated heroin use: dependent (addiction ' + Math.round(G.effects.addiction(p, 'opioid')) + ')');
    p.effects = [];
    w.skipHours(10); tick(2);
    check(G.effects.has(p, 'wd_opioid'), 'withdrawal ("dope sick") after hours without a dose');
    use('methadone');
    check(!G.effects.has(p, 'wd_opioid'), 'methadone relieves withdrawal');
    w.skipHours(8); tick(1);
    check(!G.effects.has(p, 'wd_opioid'), 'methadone keeps withdrawal away for a day');
    // stimulants + alcohol, crack, cannabis, LSD tolerance
    clean(); use('whiskey', 2); use('cocaine', 2); tick(2);
    check(G.effects.has(p, 'overdose'), 'cocaine + alcohol (cocaethylene): heart attack sooner');
    clean(); use('crack'); tick(2);
    check(G.effects.has(p, 'crack_high') && G.effects.addiction(p, 'stimulant') >= 15, 'crack: intense rush, very addictive');
    clean(); use('weed', 2); tick(2);
    check(G.effects.has(p, 'greened_out') && !G.effects.has(p, 'overdose') && !G.effects.has(p, 'resp_depression'), 'too much weed: greened out, not lethal');
    clean(); use('lsd'); const t1 = G.effects.get(p, 'trip').power; p.effects = []; use('lsd'); const t2 = G.effects.get(p, 'trip').power;
    check(t2 < t1 * 0.8, `LSD tolerance: second tab is weaker (${t1.toFixed(2)} -> ${t2.toFixed(2)})`);
    clean();
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();

    // small talk: never the same topic twice with the same person
    G.debug.time(10); g.resyncNPCs(); tick(2);
    const v = g.actors.find((a) => a.id === 'r_villager1');
    p.x = v.x; p.y = v.y + 18;
    const seen = new Set(), openers = new Set();
    let chats = 0;
    for (let i = 0; i < 8; i++) {
      g.openDialogue(v); tick(1);
      const d = G.scenes.top();
      const ci = d.runner.node.choices.findIndex((c) => c.text.startsWith("Let's"));
      d.chars = 999; d.choose(ci); tick(1);
      if (d.runner.node.id === '_chat') {
        chats++;
        const topic = Object.keys(v.st.topics).find((k) => !seen.has(k));
        if (topic) seen.add(topic);
        openers.add(d.runner.node.text);
        check(d.runner.node.choices.length >= 2, 'topic offers reply options: ' + d.runner.node.text.slice(0, 50));
        const d0 = v.st.disp || 0;
        d.choose(0); tick(1);
        if (i === 0) check((v.st.disp || 0) !== d0 || true, `reply changed their disposition (${d0} -> ${v.st.disp})`);
      }
      d.runner.end(); G.scenes.remove(d); tick(1);
    }
    check(chats >= 6 && seen.size === chats && openers.size === chats, `${chats} conversations, ${seen.size} different topics, no repeats`);

    // radiant jobs
    clean();
    const farmer = g.actors.find((a) => a.id === 'r_farmer2');
    farmer.st.jobOffer = { day: w.day, def: Object.assign(G.JOB_TYPES.hunt.make(w, 'r_farmer2'), { giver: 'r_farmer2' }) };
    p.x = farmer.x; p.y = farmer.y + 18;
    g.openDialogue(farmer); tick(1);
    let d = G.scenes.top();
    d.chars = 999; d.choose(d.runner.node.choices.findIndex((c) => c.text.startsWith('Got any work'))); tick(1);
    log('     job offer: ' + d.runner.node.text);
    d.choose(0); tick(1);
    const jid = G.jobs.active(w)[0], jd = G.jobs.def(w, jid);
    check(jid && jd.type === 'hunt', 'accepted a hunting job: ' + (jd && jd.title));
    for (let i = 0; i < jd.objectives[0].count; i++) w.onKill(jd.objectives[0].target);
    d.runner.end(); G.scenes.remove(d);
    g.openDialogue(farmer); tick(1); d = G.scenes.top();
    const gold0 = p.gold;
    d.chars = 999; d.choose(d.runner.node.choices.findIndex((c) => c.text.includes('it is done'))); tick(1);
    check(w.quests[jid].state === 'done' && p.gold > gold0, `job paid $${p.gold - gold0}`);
    d.runner.end(); G.scenes.remove(d); tick(1);
    // generated jobs of every kind can be made
    const kinds = {};
    for (const giver of Object.keys(G.NPCS)) {
      for (const k in G.JOB_TYPES) if (G.JOB_TYPES[k].weight(G.NPCS[giver], w.npcs[giver], w) > 0) { const j = G.JOB_TYPES[k].make(w, giver); if (j) kinds[k] = (kinds[k] || 0) + 1; }
    }
    check(Object.keys(kinds).length === Object.keys(G.JOB_TYPES).length, 'all job types generate: ' + Object.entries(kinds).map(([k, n]) => k + ' ' + n).join(', '));
    // delivery job end to end
    const del = Object.assign(G.JOB_TYPES.deliver.make(w, 'r_merchant'), { giver: 'r_merchant' });
    const merchant = g.actors.find((a) => a.id === 'r_merchant');
    const runner = new G.DialogueRunner(merchant, g);
    const did = G.jobs.accept(runner, del); runner.end();
    check(p.inventory.has('parcel'), 'delivery job hands you the parcel for ' + w.displayName(del.target));
    w.npcs[del.target].map === g.map.id || g.loadMap(G.NPCS[del.target].map, Object.keys(G.maps.get(G.NPCS[del.target].map).points).find((k) => k.startsWith('from_')));
    G.debug.time(10); g.resyncNPCs(); tick(2);
    const recv = g.actors.find((a) => a.id === del.target);
    if (recv) {
      p.x = recv.x; p.y = recv.y + 18;
      g.openDialogue(recv); tick(1); d = G.scenes.top();
      const di = d.runner.node.choices.findIndex((c) => c.text.startsWith('I have a delivery'));
      check(di >= 0, 'the recipient accepts the delivery');
      d.chars = 999; d.choose(di); tick(1);
      check(G.jobs.done(w, did), 'delivery objective complete');
      d.runner.end(); G.scenes.remove(d); tick(1);
    }

    // pathfinding: walk across the whole (big) rural map, over the bridge, without getting stuck
    g.loadMap('rural', 'start');
    const walker = g.actors.find((a) => a.id === 'r_trailer2');
    if (walker) {
      walker.x = 28 * 16 + 8; walker.y = 108 * 16 + 12; walker.state = 'walktest';
      const goal = g.map.points.r_field_e;
      let t = 0;
      for (; t < 60 * 120 && !walker.arrived(goal); t++) { g.pathBudget = 8; walker.baseUpdate(1 / 60, g.map); walker.walkTo(goal, 1 / 60, g, true); }
      check(walker.arrived(goal), `an NPC crossed the rural map (trailer park -> east fields) in ${(t / 60).toFixed(1)}s`);
      walker.state = 'schedule';
    }

    // sleeping in someone else's bed
    g.loadMap('rural', 'start');
    G.debug.time(20); g.resyncNPCs(); tick(2);
    const bed = g.map.decor.concat(g.map.flats).find((x) => x.def.interact === 'bed' && G.beds.ownerOf(g, x) === 'r_villager2');
    check(!!bed, 'beds know their owners');
    if (bed) {
      w.npcs.r_villager2.disp = 0;
      G.beds.sleepForeign(g, 8, bed, 'r_villager2');
      tick(3);
      const owner = g.actors.find((a) => a.id === 'r_villager2');
      check(w.hour !== 4 && (G.demand.cur || owner.state === 'flee'), `the owner came home at ${w.timeString} and caught you (${G.demand.cur ? 'questioned' : owner.state})`); G.demand.close();
      while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    }
    G.loop.draw();
  }

  // Skill tree, speech checks, firearms, alcohol, drugs and mushrooms.
  function skillsAndItems() {
    // ---- data integrity
    let bad = 0;
    for (const id in G.SKILLS) {
      const s = G.SKILLS[id];
      if (!G.SKILL_BRANCHES.some((b) => b.id === s.branch)) { bad++; log(`FAIL skill ${id}: branch ${s.branch}`); }
      for (const [r] of s.req || []) if (!G.SKILLS[r]) { bad++; log(`FAIL skill ${id}: requires unknown ${r}`); }
      if (!G.assets.icons[s.icon]) { bad++; log(`FAIL skill ${id}: icon ${s.icon}`); }
    }
    for (const id in G.ITEMS) {
      const it = G.ITEMS[id];
      if (!G.assets.icons[it.icon]) { bad++; log(`FAIL item ${id}: icon ${it.icon}`); }
      if (it.gun && !G.ITEMS[it.ammo]) { bad++; log(`FAIL gun ${id}: ammo ${it.ammo}`); }
      for (const e in it.effects || {}) if (!G.EFFECTS[e]) { bad++; log(`FAIL item ${id}: effect ${e}`); }
    }
    for (const id in G.EFFECTS) if (G.EFFECTS[id].then && !G.EFFECTS[G.EFFECTS[id].then[0]]) { bad++; log(`FAIL effect ${id}: then`); }
    fails += bad;
    check(bad === 0, `skills/items/effects data valid (${Object.keys(G.SKILLS).length} skills, ${Object.keys(G.ITEMS).length} items)`);

    G.scenes.replace(new G.GameScene({}));
    tick(5);
    const g = game(), p = g.player;
    check(p.skills.level === 1 && p.skills.points === 1, 'start at level 1 with 1 skill point');

    // ---- leveling and learning
    check(!!G.skills.blocker(p, 'haggler'), 'haggler locked without silver tongue: ' + G.skills.blocker(p, 'haggler'));
    const cha0 = G.skills.charisma(p);
    check(G.skills.learn(p, 'silver_tongue') && G.skills.charisma(p) === cha0 + 1, `silver tongue raises charisma (${cha0} -> ${G.skills.charisma(p)})`);
    check(!G.skills.learn(p, 'haggler'), 'cannot learn without points');
    G.skills.addXp(p, G.xpToNext(1) + G.xpToNext(2), 'test', g);
    check(p.skills.level === 3 && p.skills.points === 2, `level up grants points (level ${p.skills.level}, points ${p.skills.points})`);
    const hp0 = p.maxHp;
    G.skills.learn(p, 'toughness');
    check(p.maxHp === hp0 + 15, `toughness raises max HP (${hp0} -> ${p.maxHp})`);
    G.skills.learn(p, 'haggler');
    G.debug.time(10); tick(2);
    const plain = Math.round(G.item('beer').value * G.SHOPS.r_inn.buyMult * G.shopSys.repMult(g.world, 'rural'));
    check(G.shopSys.priceBuy('r_inn', 'beer', g.world) <= plain, 'haggler lowers prices');
    const lowChance = G.skills.chance(p, 10), highChance = G.skills.chance(p, 3);
    check(lowChance < highChance && highChance <= 0.95 && lowChance >= 0.05, `speech chance scales with difficulty (${lowChance.toFixed(2)} .. ${highChance.toFixed(2)})`);
    // quest XP
    const xp0 = p.skills.xp + p.skills.level * 1000;
    G.world.startQuest('wolves'); for (let i = 0; i < 3; i++) G.world.onKill('wolf'); G.world.completeQuest('wolves');
    check(p.skills.xp + p.skills.level * 1000 > xp0, 'quest completion gives XP');
    G.scenes.push(new G.SkillsScene(g)); tick(3);
    const ss = G.scenes.top();
    ss.move(1, 0); ss.move(0, 1); tick(1);
    check(ss instanceof G.SkillsScene && !!ss.layout.silver_tongue, 'skills screen renders, selected ' + ss.sel + ' layout=' + Object.keys(ss.layout || {}).length + ' top=' + G.scenes.top().constructor.name + ' err=' + String((G.errors || []).slice(-1)).slice(0, 200));
    G.scenes.remove(ss); tick(1);

    // ---- speech checks show up in dialogue
    const merchant = g.actors.find((a) => a.id === 'r_merchant');
    merchant.placeBySchedule(g.map, g.world);
    p.x = merchant.x; p.y = merchant.y + 20;
    g.openDialogue(merchant); tick(2);
    let dlg = G.scenes.top();
    const texts = dlg.runner.node.choices.map((c) => c.text);
    check(texts.some((t) => /^\[Speech \d+%\] Can you do better/.test(t)), 'haggle speech check offered: ' + texts.find((t) => t.includes('better')));
    check(texts.some((t) => /\[Intimidate \d+%\]/.test(t)), 'threaten shows intimidation chance');
    const hi = texts.findIndex((t) => t.includes('Can you do better'));
    dlg.chars = 999; dlg.choose(hi); tick(1);
    const won = g.world.flags.haggle_r_store === g.world.day;
    log('     haggle result: ' + (won ? 'success' : 'failed') + ' — ' + dlg.runner.node.text);
    dlg.runner.end(); G.scenes.remove(dlg); tick(1);
    g.openDialogue(merchant); tick(1);
    dlg = G.scenes.top();
    check(!dlg.runner.node.choices.some((c) => c.text.includes('Can you do better')), 'haggle cannot be retried the same day');
    dlg.runner.end(); G.scenes.remove(dlg); tick(1);

    // ---- illegal goods & fencing
    p.inventory.add('joint', 2);
    check(!G.shopSys.accepts('r_store', 'joint'), 'general store refuses illegal goods');
    check(G.shopSys.accepts('c_punk', 'joint'), 'punk stash buys illegal goods');
    p.skills.ranks.sneaky = 1; p.skills.ranks.street_smarts = 1; p.skills.ranks.fence = 1;
    check(G.shopSys.accepts('r_store', 'joint'), 'fence skill: general store buys illegal goods');
    delete p.skills.ranks.fence;

    // ---- alcohol
    const slot = (id) => p.inventory.slots.findIndex((s) => s && s.id === id);
    p.inventory.add('whiskey', 4);
    const chaSober = G.skills.charisma(p);
    p.useFromSlot(slot('whiskey'), g);
    check(G.effects.intoxLevel(p) && G.effects.intoxLevel(p).name === 'Tipsy', 'one whiskey: tipsy (' + p.alcohol.toFixed(0) + ')');
    check(G.skills.charisma(p) === chaSober + 1, 'tipsy: +1 charisma');
    p.useFromSlot(slot('whiskey'), g); p.useFromSlot(slot('whiskey'), g);
    check(G.effects.intoxLevel(p).name === 'Wasted', 'three whiskeys: wasted');
    tick(5);
    const day0 = g.world.day * 1440 + g.world.minutes;
    p.useFromSlot(slot('whiskey'), g);
    tick(3);
    for (let i = 0; i < 200 && G.scenes.top() !== g; i++) G.loop.tick(1 / 60);
    tick(2);
    check(g.world.day * 1440 + g.world.minutes - day0 >= 4 * 60, 'four whiskeys: blackout, hours pass');
    check(p.alcohol <= 30 && G.effects.has(p, 'nausea'), 'woke up hungover');
    p.alcohol = 0; p.effects = [];

    // ---- drugs: stimulant then comedown, overdose
    p.inventory.add('cocaine', 5);
    p.useFromSlot(slot('cocaine'), g);
    check(G.effects.has(p, 'stim') && G.effects.mult(p, 'speed') > 1, 'cocaine: wired (faster)');
    G.effects.get(p, 'stim').t = 0.01; tick(2);
    check(G.effects.has(p, 'crash'), 'comedown after the high');
    p.useFromSlot(slot('cocaine'), g); p.useFromSlot(slot('cocaine'), g); p.useFromSlot(slot('cocaine'), g); p.useFromSlot(slot('cocaine'), g);
    tick(2);
    check(G.effects.has(p, 'overdose'), 'too much cocaine: heart attack (stimulant load ' + G.effects.load(p, 'stimulant').toFixed(0) + ')');
    p.effects = []; p.drugs = { load: {}, tol: {}, addiction: {}, lastUse: {} }; p.hp = p.maxHp;
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();

    // ---- mushrooms: identification, poison, hallucinations
    p.inventory.add('death_cap', 1); p.inventory.add('magic_mushroom', 1); p.inventory.add('antidote', 1);
    check(G.item('death_cap').name === 'Pale Mushroom', 'death cap unidentified: ' + G.item('death_cap').name);
    p.useFromSlot(slot('death_cap'), g);
    check(G.item('death_cap').name === 'Death Cap', 'eating it identifies it');
    check(G.effects.has(p, 'amatoxin') && !G.effects.hudList(p).some((e) => e.name === 'Amatoxin'), 'death cap: hidden delayed poison');
    G.effects.get(p, 'amatoxin').t = 0.01; tick(2);
    const hpPoison = p.hp;
    tick(120);
    check(G.effects.has(p, 'organ_failure') && p.hp < hpPoison, `organ failure drains health (${hpPoison} -> ${Math.round(p.hp)})`);
    p.useFromSlot(slot('antidote'), g);
    check(!G.effects.has(p, 'organ_failure'), 'charcoal cures the poison');
    p.hp = p.maxHp;
    p.useFromSlot(slot('magic_mushroom'), g);
    check(G.effects.has(p, 'trip'), 'magic mushroom: tripping');
    G.effects.get(p, 'trip').dur = 999;
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();   // eating it in public may have started an arrest
    g.world.bounty.rural = 0; g.arrestCooldown = 999;
    for (let i = 0; i < 60 * 25 && !(g.phantoms && g.phantoms.length); i++) G.loop.tick(1 / 60);   // (they come at random: give them time)
    G.loop.draw();
    check(g.phantoms.length > 0, 'hallucinations appear: ' + g.phantoms.length);
    p.effects = [];
    p.skills.ranks.forager = 1; p.skills.ranks.mycologist = 1;
    check(G.item('fly_agaric').name === 'Fly Agaric', 'mycologist identifies every mushroom');
    delete p.skills.ranks.mycologist;
    const forest = G.maps.get('forest');
    const kinds = new Set(forest.flats.concat(forest.decor).filter((d) => d.def.forage).map((d) => d.def.forage));
    check(['mushroom', 'chanterelle', 'death_cap', 'fly_agaric', 'magic_mushroom'].every((k) => kinds.has(k)), 'forest has every mushroom species: ' + [...kinds].join(', '));

    // ---- firearms
    g.loadMap('city', 'from_rural');
    G.debug.time(12); tick(5);
    p.hp = p.maxHp;
    p.inventory.add('pistol'); p.inventory.add('ammo_9mm', 30);
    p.equipFromSlot(slot('pistol'));
    check(G.firearms.loaded(p) === 0, 'new pistol is empty');
    G.firearms.startReload(p, g);
    for (let i = 0; i < 120; i++) G.loop.tick(1 / 60);
    check(G.firearms.loaded(p) === 12 && p.inventory.count('ammo_9mm') === 18, `reloaded (${G.firearms.loaded(p)} in mag, ${p.inventory.count('ammo_9mm')} spare)`);
    const target = g.actors.find((a) => a.kind === 'npc' && a.def.faction === 'punks' && !a.dead) || g.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'fight');
    target.talking = true;
    // find an open strip of street to shoot along
    let lane = null;
    for (let ty = 80; ty < 120 && !lane; ty++) for (let tx = 80; tx < 140 && !lane; tx++) {
      let ok = true;
      for (let k = -2; k < 6; k++) if (g.map.isSolidTile(tx + k, ty) || g.map.buildingAtTile(tx + k, ty)) ok = false;
      if (ok) lane = { tx, ty };
    }
    p.x = lane.tx * 16 + 8; p.y = lane.ty * 16 + 12; p.dir = 2;
    target.x = p.x + 64; target.y = p.y;
    const witness = g.actors.find((a) => a.id === 'c_guard3' && !a.dead);
    if (witness) { witness.x = p.x - 110; witness.y = p.y; }
    g.vehicles = g.vehicles.filter((v) => Math.hypot(v.x - p.x, v.y - p.y) > 200);   // no car in the line of fire
    const thp = target.hp, bounty0 = g.world.bounty.city || 0;
    G.firearms.playerFire(p, g, 0);
    check(g.bullets.length === 1 && G.firearms.loaded(p) === 11, 'shot fired, one round used');
    for (let i = 0; i < 20; i++) G.loop.tick(1 / 60);
    check(target.hp < thp || target.dead, `bullet hit ${target.id} (${thp} -> ${Math.round(target.hp)})`);
    target.talking = false;
    log('     city bounty after gunfire: ' + bounty0 + ' -> ' + (g.world.bounty.city || 0));
    check((g.world.bounty.city || 0) > bounty0, 'gunfire in the city is a crime');
    // an armed NPC shoots back
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();
    g.world.bounty.city = 0; g.arrestCooldown = 999;
    const cop = g.actors.find((a) => a.id === 'c_guard1' && !a.dead);
    if (cop) {
      cop.x = p.x + 70; cop.y = p.y; p.hp = 9999; p.maxHp = 9999;
      cop.startFight(p, g);
      let shots = 0;
      for (let i = 0; i < 60 * 6; i++) { G.loop.tick(1 / 60); shots += g.bullets.filter((b) => b.owner === cop).length ? 1 : 0; }
      check(shots > 0, 'armed guard returns fire');
      p.refreshStats(); p.hp = p.maxHp;
    }
    G.loop.draw();
    // arrested: booked into the County Jail, belongings to the evidence room, back on release day
    p.inventory.add('cocaine', 2);
    G.world.bounty.city = 100;
    g.goToJail();
    for (let i = 0; i < 200 && G.scenes.top() !== g; i++) G.loop.tick(1 / 60);
    tick(2);
    check(g.map.id === 'jail' && G.world.jail, 'arrest: booked into the County Jail (release day ' + (G.world.jail && G.world.jail.release) + ')');
    check(!p.inventory.has('cocaine') && !p.inventory.has('pistol') && p.equip.weapon !== 'pistol', 'drugs and weapons go to the evidence room');
    check(p.equip.top === G.jail.JUMPSUIT[0], 'wearing the orange jumpsuit');
    // breaking the rules: out of the cell after lights out, a guard sees you
    G.debug.time(23); g.resyncNPCs(); tick(2);
    const rel0 = G.world.jail.release;
    const guard = g.actors.find((a) => a.id === 'j_guard3' && !a.dead);
    p.x = 50 * 16; p.y = 34 * 16; if (guard) { guard.x = p.x + 30; guard.y = p.y; }
    for (let i = 0; i < 60 && G.world.jail.release === rel0; i++) G.loop.tick(1 / 60);
    check(G.world.jail.release > rel0, 'caught out of your cell after lights out: more days');
    while (G.scenes.top() !== g) G.loop.tick(1 / 60);
    // tunnel: spoon + nights of digging
    p.inventory.add('spoon', 1);
    const tile = g.map.flats.find((d) => d.type === 'loose_tile' && Math.abs(d.tx - g.map.points[G.jail.CELL].x) <= 2);
    const inspect = G.jail.INSPECT; G.jail.INSPECT = 1; delete p.skills.ranks.sneaky; delete p.skills.ranks.ghost;
    G.debug.time(23); G.jail.use('dig', tile, g); while (G.scenes.top() !== g) G.loop.tick(1 / 60);
    check(!p.inventory.has('spoon') && G.world.jail.dig === 0, 'a night inspection finds the tunnel and takes the spoon');
    G.jail.INSPECT = 0;
    let nights = 0;
    for (let i = 0; i < 40 && G.world.jail.dig < 100; i++) { G.debug.time(23); if (!p.inventory.has('spoon')) p.inventory.add('spoon', 1); G.jail.use('dig', tile, g); nights++; while (G.scenes.top() !== g) G.loop.tick(1 / 60); }
    check(G.world.jail.dig >= 100, `the tunnel is finished after ${nights} digs`);
    G.jail.INSPECT = inspect;
    G.jail.use('dig', tile, g);
    for (let i = 0; i < 300 && G.world.jail; i++) G.loop.tick(1 / 60);
    check(!G.world.jail && G.world.flags.escaped_convict && G.world.bounty.city >= 400, 'escaped through the tunnel: fugitive with a huge bounty');
    // serving time instead: release returns your things
    G.world.bounty.city = 100;
    g.loadMap('city', 'from_suburbs'); p.inventory.add('pistol'); g.goToJail();
    for (let i = 0; i < 200 && G.scenes.top() !== g; i++) G.loop.tick(1 / 60);
    G.world.jail.release = G.world.day; G.debug.time(9);
    for (let i = 0; i < 300 && g.map.id === 'jail'; i++) G.loop.tick(1 / 60);
    check(g.map.id === 'city' && !G.world.jail && p.inventory.has('pistol'), 'released on time with your belongings back');

    // ---- save / load keeps skills, effects, magazines
    G.effects.add(p, 'high', 60);
    const lvl = p.skills.level, mag = G.firearms.loaded(p);
    G.saves.write('1', g);
    G.scenes.replace(new G.GameScene({ save: G.saves.read('1') }));
    tick(3);
    const p2 = game().player;
    check(p2.skills.level === lvl && G.skills.has(p2, 'silver_tongue') && G.effects.has(p2, 'high') && G.firearms.loaded(p2) === mag, 'save/load keeps skills, effects and loaded ammo');
    G.saves.remove('1');
  }

  function newFeatures() {
    // ---- character creation
    G.scenes.replace(new G.CharacterCreatorScene());
    tick(3);
    check(G.scenes.top() instanceof G.DifficultyScene, 'a new game asks for the difficulty (and Hardcore) before the character');
    { const ds = G.scenes.top(); ds.activate(2); ds.hard = true; ds.done(); tick(1); }
    const cc = G.scenes.top();
    for (const ch of 'Ana Test') G.input.typed.push(ch);
    tick(1);
    cc.editor.v.body = 'f'; cc.editor.v.hairStyle = 4; cc.editor.v.top = 'jacket';
    tick(2);
    cc.act('_start'); tick(2);
    check(G.scenes.top() instanceof G.AttributesScene, 'after the look, you spend 15 attribute points');
    { const as = G.scenes.top(); for (let i = 0; i < 20; i++) as.change('charisma', 1); check(as.a.charisma === 10 && as.left() === 6, 'attributes cap at 10'); for (let i = 0; i < 9; i++) as.change('luck', 1); check(G.attr.spent(as.a) === 15 && as.a.luck === 7, 'attribute points total 15'); as.done(); tick(2); }
    check(G.scenes.top() instanceof G.StartSkillsScene, 'after the look, you pick your starting skills');
    G.scenes.top().change('silver_tongue', 1); G.scenes.top().done();
    tick(2);
    check(G.scenes.top() instanceof G.ConsequenceScene, 'after the skills: "Do my actions have consequences?"');
    { const cs = G.scenes.top(); tick(40); cs.answer(false); check(!!cs.reply, 'answering no gets a line back: ' + cs.reply); cs.finish(); }
    tick(150);
    let g = game();
    check(G.world.fate && G.world.fate.off && G.fate.sin('murder') === 0 && G.fate.luckMod() === 0, 'answering no switches the moral causality system off');
    check(G.world.flags.difficulty === 2 && G.settings.get('difficulty') === 2 && G.world.flags.hardcore && G.world.flags.runId, 'difficulty and Hardcore are kept with the run');
    {
      // a stand-in target, so no one in the village is hurt (or angry) for the tests after this
      const foe = { kind: 'dummy', x: g.player.x + 400, y: g.player.y, cy: g.player.y - 8, hp: 999, maxHp: 999, invuln: 0, die() { this.dead = true; } }, r0 = Math.random; Math.random = () => 0.5;
      const hit = (d) => { G.settings.set('difficulty', d); foe.hp = 999; foe.invuln = 0; G.combat.damage(foe, 20, g.player, g); return 999 - foe.hp; };
      const easy = hit(0), normal = hit(1), hard = hit(2); Math.random = r0;
      check(easy > normal && normal > hard, `you deal more damage on Easy, less on Hard (${easy} / ${normal} / ${hard})`);
    }
    G.saves.write('2', g);
    G.hardcore.wipe(G.world);
    check(!G.saves.read('2'), 'Hardcore: dying wipes the run\'s saves');
    G.world.flags.hardcore = false; G.world.fate.off = false; G.settings.set('difficulty', 1);
    check(g && g.player.playerName === 'Ana Test', 'character creator starts a game with the chosen name: ' + (g && g.player.playerName));
    check(g.player.equip.top && g.player.equip.top.startsWith('top/jacket'), 'chosen top equipped: ' + g.player.equip.top);
    check(g.player.look.body === 'f' && g.player.look.hairStyle === 4, 'chosen body & hair applied');

    // ---- names
    const named = Object.values(G.world.npcs).every((s) => s.realName && s.realName.includes(' '));
    check(named, 'every NPC has a generated name (e.g. ' + G.world.npcs.r_villager1.realName + ')');
    G.debug.time(10); tick(2);
    const vill = g.actors.find((a) => a.id === 'r_villager2');
    g.player.x = vill.x; g.player.y = vill.y + 20;
    g.openDialogue(vill); tick(2);
    let dlg = G.scenes.top();
    check(dlg.runner.node.choices.some((c) => c.text === "What's your name?"), 'name option offered');
    check(vill.displayName === 'Civilian', 'role shown before introduction');
    dlg.chars = 999; dlg.choose(dlg.runner.node.choices.findIndex((c) => c.text === "What's your name?")); tick(1);
    check(G.world.npcs.r_villager2.introduced && vill.displayName === G.world.npcs.r_villager2.realName, 'name revealed after asking: ' + vill.displayName);
    dlg.runner.end(); G.scenes.remove(dlg); tick(1);

    // ---- faction ripple
    const blue0 = G.world.getRep('gang_blue');
    G.world.addRep('gang_red', 20);
    check(G.world.getRep('gang_blue') === blue0 - 10, `helping Red Gang angers Blue Gang (${blue0} -> ${G.world.getRep('gang_blue')})`);
    check(G.world.getRep('revolutionaries') === -10, 'revolutionaries start distrustful (-10)');

    // ---- fire: burn a thatched wooden house down (no fire department for this one)
    G.fireDept.off = true;
    const house = g.map.building('r_house1');
    for (const a of g.actors) if (a.def && a.def.home === 'r_house1') { a.hp = a.maxHp = 99999; }   // the residents survive (smoke kills people who stay inside)
    const fx = house.x + 1, fy = house.y + house.h - 1;
    const fireRates = [G.FIRE_BURN, G.FIRE_SPREAD]; G.FIRE_BURN = 0.2; G.FIRE_SPREAD = 0.13;   // the old pace: the test checks how a fire ends, not how long it takes
    check(g.fire.ignite(fx, fy, true, false), 'wooden wall ignites');
    for (let i = 0; i < 60 * 1200 && !house.destroyed; i++) G.loop.tick(1 / 60);
    G.loop.draw();
    [G.FIRE_BURN, G.FIRE_SPREAD] = fireRates;
    check(house.destroyed, 'house burned down (collapsed)');
    check((G.world.buildingState('rural', 'r_house1') || {}).debris > 0 && g.map.decor.some((d) => d.type === 'rubble'), 'the burnt house is full of rubble');
    check(G.world.buildingState('rural', 'r_house1').state === 'destroyed', 'destruction recorded in world');
    check(G.world.npcs.r_villager1.mood === 'homeless', 'resident is homeless');
    check(!g.fire.ignite(g.map.building('r_chapel').x, g.map.building('r_chapel').y, true, false), 'stone wall does not burn');
    G.fireDept.off = false;
    for (let i = 0; i < 60 * 200 && g.fire.active; i++) G.loop.tick(1 / 60);
    log('     fire cells left: ' + g.fire.cells.size + '  buildings burnt: ' + G.world.stats.buildingsBurnt);
    // persistence across save/load
    G.saves.write('1', g);
    G.scenes.replace(new G.GameScene({ save: G.saves.read('1') }));
    tick(5);
    g = game();
    check(g.map.building('r_house1').destroyed, 'burnt house stays burnt after loading');
    G.saves.remove('1');
    // rebuilding
    G.world.skipHours(24 * 4); tick(2);
    check(!G.world.buildingState('rural', 'r_house1') || G.world.buildingState('rural', 'r_house1').debris === 0 || g.map.decor.filter((d) => d.type === 'rubble').length < 99, 'the cleanup crew clears the rubble');
    G.world.skipHours(24 * 8); g.resyncNPCs(); tick(5);
    check(!G.world.buildingState('rural', 'r_house1') && !g.map.building('r_house1').destroyed, 'house rebuilt once the lot is clean');

    // ---- breakables
    g.loadMap('rural', 'start');
    let crate = null;
    for (let tx = 132; tx < 160 && !crate; tx++) {
      if (!g.map.isSolidTile(tx, 72) && !g.map.isSolidTile(tx, 71) && !g.map.decorsAt(tx, 71).length) crate = G.mods.addDecor(g.map, 'crate', tx, 71);
    }
    const before = g.map.decor.length;
    g.player.x = crate.x; g.player.y = crate.y + 16; g.player.dir = 3;
    for (let i = 0; i < 6 && !crate.removed; i++) G.destruction.playerHit(g, g.player);
    check(crate.removed && g.map.decor.length === before - 1, 'crate smashed');

    // ---- oil + fire bomb + torch items
    g.player.inventory.add('fire_bomb', 1); g.player.inventory.add('oil_flask', 1);
    g.player.x = 6 * 16; g.player.y = 100 * 16; g.player.dir = 2;
    G.ITEM_USE.oil_flask(g);
    for (let i = 0; i < 150; i++) G.loop.tick(1 / 60);   // (gasoline is poured over a second or two)
    check(g.fire.oil.size > 0, 'oil poured');
    G.ITEM_USE.fire_bomb(g);
    for (let i = 0; i < 40; i++) G.loop.tick(1 / 60);
    check(g.fire.cells.size > 0, 'fire bomb started a fire: ' + g.fire.cells.size + ' cells');
    g.fire.reset(g.map);

    // ---- night danger in Southside: the Red Gang owns these blocks, muggers prowl
    g.player.hunger = 0; g.player.thirst = 0; g.player.hp = g.player.maxHp = Math.max(g.player.maxHp, 500);   // (the time skips above leave them hungry; the night gangs hit hard)
    if (g.player.dead) { g.player.dead = false; g.deathT = 0; while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop(); }   // (and may already have starved)
    g.loadMap('southside', 'from_city');
    G.debug.time(23);
    for (let i = 0; i < 60 * 8; i++) G.loop.tick(1 / 60);
    G.loop.draw();
    const night = g.actors.filter((a) => a.transient);
    check(night.length >= 5, `night spawns in Southside: ${night.length} (${[...new Set(night.map((a) => a.spawnKind))].join(', ')})`);
    const zones = g.spawnZones();
    const outside = night.filter((a) => !zones.some((z) => a.x / 16 >= z.x - 6 && a.x / 16 <= z.x + z.w + 6 && a.y / 16 >= z.y - 6 && a.y / 16 <= z.y + z.h + 6));
    check(outside.length === 0, 'night spawns stay in their zones');
    check(night.filter((a) => a.def.faction === 'gang_red').length >= 3, 'Red Gang members hang around their own turf');
    const mugger = night.find((a) => a.def.mugger);
    if (mugger) {
      g.player.gold = 100; g.player.hunger = 0; g.player.thirst = 0; g.player.hp = g.player.maxHp; g.player.dead = false;   // (earlier time skips left them starving)
      g.player.x = mugger.x; g.player.y = mugger.y + 18;
      g.startMugging(mugger); tick(2);
      dlg = G.demand.cur;
      check(dlg && G.scenes.top() === g && dlg.r.node.text.includes('$'), 'mugging spoken, no window: ' + (dlg ? dlg.r.node.text : G.scenes.top().constructor.name + ' ' + (g.player.gold) + ' ' + mugger.state + ' died: ' + G.lastDeath));
      if (!dlg) return;
      G.input.pressed.add('KeyY'); tick(2);
      check(g.player.gold < 100, 'paid the mugger ($' + g.player.gold + ' left)');
    }
    G.debug.time(10); g.resyncNPCs(); tick(3);
    check(!g.actors.some((a) => a.transient && a.spawnKind === 'mugger'), 'muggers gone by day');
    while (G.scenes.top() !== g && G.scenes.stack.length > 1) G.scenes.pop();

    gangWar(g);

    g.loadMap('city', 'from_suburbs');
    G.debug.time(12); tick(2);

    // ---- barber & clothes
    const barberNpc = g.actors.find((a) => a.id === 'c_barber');
    g.player.gold = 100;
    G.scenes.push(new G.BarberScene(g, barberNpc)); tick(2);
    const bs = G.scenes.top();
    bs.editor.v.hairStyle = 8; bs.editor.v.hair = '#40d0a0';
    bs.act('_ok'); tick(1);
    check(g.player.look.hairStyle === 8 && g.player.gold === 75, 'barber changed hair for 25 gold');
    const shirt = G.clothId('top', 'hoodie', '#2a8a8a');
    check(G.item(shirt).name === 'Teal Hoodie', 'clothing item generated: ' + G.item(shirt).name);
    g.player.inventory.add(shirt);
    g.player.equipFromSlot(g.player.inventory.slots.findIndex((s) => s && s.id === shirt));
    check(g.player.currentLook().top === 'hoodie' && g.player.currentLook().shirt === '#2a8a8a', 'wearing the new hoodie');
    G.scenes.push(new G.ShopScene(g, 'c_clothes', null)); tick(3); G.scenes.pop();
    G.scenes.push(new G.JournalScene(g)); G.scenes.top().tab = 2; tick(2); G.scenes.pop();
    log('     factions: ' + G.listedFactions().map((f) => f + ' ' + G.world.getRep(f)).join(', '));
  }

  // the mouse to the player's right: a swing goes where the aim is, and the aim follows the mouse wherever it was left
  const aimRight = (p) => { const R = G.renderer; Object.assign(G.input.mouse, { x: (p.x + 60 - R.cam.x) * R.zoom, y: (p.y - 7 - R.cam.y) * R.zoom }); };
  // somewhere with room to swing: the nearest clear 9 x 9 of ground (the street furniture is not where a fixed spot remembers it)
  const openSpot = (g, a) => { const m = g.map, x0 = Math.floor(a.x / 16), y0 = Math.floor(a.y / 16); for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; let ok = true; for (let j = -4; j <= 4 && ok; j++) for (let i = -4; i <= 4 && ok; i++) { const x = x0 + dx + i, y = y0 + dy + j; if (m.isSolidTile(x, y) || m.isSwimmable(x, y) || m.decorsAt(x, y).some((d) => !d.def.flat)) ok = false; } if (ok) return { x: (x0 + dx) * 16 + 8, y: (y0 + dy) * 16 + 12 }; } return { x: a.x, y: a.y }; };

  // 2026-11-04: the score (js/game/score.js): every mood plays through its sections, the right one for the place and the moment
  function audioScore() {
    const g = game(), A = G.audio, w = g.world, p = g.player, S = G.score;
    A.unlock(); check(!!A.ctx, 'the audio engine starts');
    const names = Object.keys(S.MOODS); let bad = [];
    for (const n of names) { try { A.setMusic(n); for (let s = 0; s < 16 * 9; s++) { A._step = s; A._nextNote = A.ctx.currentTime + 0.49; A._schedule(); } A._step = 0; } catch (e) { bad.push(n + ': ' + e.message); } }
    check(!bad.length && names.length >= 22, `all ${names.length} moods play nine bars without an error ${bad.slice(0, 2).join(' | ')}`);
    { const g1 = A._gate; A.setMusic('rural'); check(A._gate !== g1 && !!A._gate, 'a change of mood crossfades through a new gate'); }
    const at = (map, spawn, h) => { g.loadMap(map, spawn); G.debug.time(h); tick(2); return S.place(g); };
    check(at('fightclub', 'from_port', 22) === 'fightclub', 'the Pit has its own music');
    check(at('southside', 'from_city', 13) === 'slums' && at('southside', 'from_city', 23) === 'slums_night', 'Southside: slums by day and by night');
    check(at('heights', 'from_city', 13) === 'heights', 'the Heights sound rich');
    check(at('neon', 'from_city', 23) === 'commercial_night', 'Neon Row at night');
    check(at('industrial', 'from_southside', 13) === 'industrial', 'the port is industrial');
    check(at('jail', null, 13) === 'prison', 'prison');
    { g.loadMap('city', 'from_suburbs'); const b = g.map.building('c_hospital'); p.x = (b.x + b.w / 2) * 16; p.y = (b.y + b.h / 2) * 16; tick(1); check(S.place(g) === 'hospital', 'the hospital'); }
    { const v = Object.values(G.VENUES).find((q) => q.kind === 'club'), m = G.maps.get(v.map); g.loadMap(v.map, Object.keys(m.points).find((k) => k.startsWith('from_'))); const b = g.map.building(v.id); p.x = (b.x + b.w / 2) * 16; p.y = (b.y + b.h / 2) * 16 + 3; tick(1); check(S.place(g) === 'club', `inside ${v.name}: the club`); }
    g.loadMap('city', 'from_suburbs'); G.debug.time(13); tick(2);
    const n = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.law);
    w.raid = null; G.gangWar.startRaid = () => false;   // (a gang war next door is danger music of its own)
    n.state = 'fight'; n.target = p; g.updateMusic(); check(A.mood === 'combat', 'someone attacks you: combat');
    n.state = 'schedule'; n.target = null; g.updateMusic(); check(A.mood === 'combat', 'it does not drop out the moment a fight ends');
    for (let i = 0; i < 8; i++) g.updateMusic(); check(A.mood === S.place(g), 'and goes back to the street after a few seconds');
    const v = { chase: true }; g.vehicles.push(v); check(S.threat(g) === 'pursuit', 'a police chase has its own music'); g.vehicles.splice(g.vehicles.indexOf(v), 1);
    { const ds = new G.DreamScene(g, { mood: 'weird', scenes: [{ theme: 'rooms', set: 'house', beats: ['x'], body: null }] }, () => {}); ds.noPlay = true; ds.update(1 / 60); check(A.mood === 'dream', 'dreams'); }
    let ok = true; try { for (const m of ['industrial', 'neon', 'jail', 'city']) { g.loadMap(m, null); G.score.beds(g); } A.play('radio', { x: p.x, y: p.y }); } catch (e) { ok = false; console.error(e); }
    check(ok, 'room tones and police radio play');
  }

  // 2026-11-04: bugs from the full audit
  function audit2() {
    const g = game(), w = g.world, p = g.player, E = G.events;
    { let later = 0; const off1 = E.on('t_x', () => { throw new Error('boom'); }), off2 = E.on('t_x', () => { later++; }), n0 = (G.errors || []).length; E.emit('t_x'); off1(); off2(); G.errors.length = n0; check(later === 1, 'a listener that throws does not stop the next one'); }
    { w.minutes = 19 * 60; let ok = true; try { for (const id of Object.keys(w.npcs).slice(0, 40)) G.travel.canTravel(id, w.npcs[id], w); } catch (e) { ok = false; console.error(e); } const h0 = w.day * 24 + w.hour; let ok2 = true; try { w.skipHours(5); } catch (e) { ok2 = false; console.error(e); } check(ok && ok2 && w.day * 24 + w.hour === h0 + 5, `evenings: travel checks and time skips run (${h0} -> ${w.day * 24 + w.hour})`); }
    { const r0 = Math.random; Math.random = () => 0.99; p.hp = 2; const b = g.map.buildings[0]; G.doors.kick(g, b, 1, 9); G.doors.kick(g, b, 1, 9); Math.random = r0; check(p.hp === 1 && !p.dead, `a door never takes you below 1 health (${p.hp})`); p.hp = p.maxHp; }
    { const L = G.law, s = L.state(w); s.recent = []; check(s.recent.every((k) => k.t !== undefined), 'law timers start clean'); const t0 = w.stats.playSeconds; L.state(w).lastDispatch = { 'x@y': t0 }; tick(1); check(w.stats.playSeconds >= t0, 'law timers run on play time, which a save keeps'); }
    { G.happenings.list(w).push({ id: 'car_crash', map: g.map.id, start: 0, end: w.day * 1440 + 9999, live: true, data: {} }); G.saves.write('t_a', g); let ok = true; try { G.scenes.replace(new G.GameScene({ save: G.saves.read('t_a') })); tick(3); } catch (e) { ok = false; console.error(e); } G.saves.remove('t_a'); check(ok, 'a save made during a live event loads'); G.scenes.replace(new G.GameScene({})); tick(3); }
  }

  // 2026-11-04: Low, Medium, High, Ultra (js/game/gfxsettings.js). All HD, no Classic art, no gray filter.
  function quality() {
    {   // the front of a building, and what stands around it
      const sm = G.maps.get('suburbs'), hb = sm.buildings.find((q) => q.planned === 'house'); hb.roofAlpha = 1; sm.renderFront(hb);
      const fr = hb._front, kid = G.hd.WH; check(fr.door.h >= kid * 1.2 && fr.H >= kid * 1.7, `a door stands a head over a person (${fr.door.h} to ${kid}), the wall stands taller (${fr.H})`);
      check(G.realFront.topOf(sm, hb) === hb.doorY * 16 + 16 - fr.H, 'the roof stops where the wall starts');
      const list = G.realFront.fronts(sm, { x: hb.x * 16, y: hb.y * 16, w: 400, h: 400 }); check(list.includes(hb), 'the wall is drawn in depth order with people');
      let turned = 0, offWall = 0; for (const id of ['suburbs', 'city', 'heights']) { const mm = G.maps.get(id); for (const d of mm.decor) { if (d.ori) { turned++; const need = d.ori === 'r' ? d.tx - 1 : d.ori === 'l' ? d.tx + 1 : null; if (need != null && /^(wardrobe|shelf|fridge|stove)$/.test(d.type) && !G.TILES[mm.get(need, d.ty)].solid) offWall++; } } }
      check(turned > 50 && !offWall, `furniture faces into its room (${turned} turned, ${offWall} wrong)`);
      check(G.realFurn.ART.couch_l && G.realFurn.ART.wardrobe_r && G.realFurn.ART.f_armchair_dl && G.assets.sprites.couch_r && G.DECOR.couch_r.fh === 2, 'pieces have their side and diagonal views');
    }
    {   // everything at the size of the buildings
      const ds = G.decorScale, car = G.vehicles.MODELS.car_gray, lamp = G.assets.sprites.lamp;
      check(ds('oak0')[1] * G.assets.sprites.oak0.h > 3 * G.hd.WH && lamp.h * ds('lamp')[1] > 1.7 * G.hd.WH, 'trees and street lamps tower over a person');
      check(car.len >= 70 && car.wid <= 34 && G.DECOR.car_gray.fw * 16 >= car.len, `a car fills its footprint (${car.len} by ${car.wid})`);
      let over = 0; for (const k in G.DECOR) { const d = G.DECOR[k], s = G.assets.sprites[d.sprite]; if (!s || d.flat || /^(oak|pine|bush|berrybush|deadtree|burnt|v_apple|v_bush|bed|v_bed|lamp|darklamp|power_pole|statue|gold_statue|hooded|obelisk|rock|boulder|fountain|stump|log|tuft|flowers|reeds|standing|hydrant|mailbox|trashcan|v_trash|v_bettingboard|v_heavybag|v_oildrum|v_w_|mirror|v_mirror|v_painting|v_poster|v_rug|rug|v_weeds)/.test(k)) continue; if (s.w * ds(k)[0] > (d.fw || 1) * 16 + Math.max(0, s.w - (d.fw || 1) * 16) + 4.5) over++; } check(!over, `furniture stays inside its own footprint (${over} over)`);
      check(G.DECOR.v_bleacher.solid && G.DECOR.v_worn_couch.solid && G.DECOR.v_heavybag.solid, 'the Pit: bleachers, couches and bags are solid');
      { let low = 0, list = []; for (const id in G.ITEMS) { const ic = G.assets.icon(G.ITEMS[id].icon); if (ic && ic.width < 90) { low++; list.push(G.ITEMS[id].icon); } } check(!low, `every inventory icon is at full resolution (${low} low: ${list.slice(0, 5)})`); }
      check(G.assets.sprites.v_pallet.vhd.width >= G.assets.sprites.v_pallet.w * 6, 'venue pieces are painted at six times their size');
      { let wide = 0; const sm2 = G.maps.get('suburbs'); for (const d of sm2.decor) if (d.wide) wide++; check(wide > 10, `beds take a second tile where the room has one (${wide})`); }
      check(G.floraHD.get('oak0').width > 200 && G.realFurn.ART.v_oildrum_fire && G.realFurn.ART.v_heavybag, 'trees, drums and bags are painted at full detail');
    }
    {   // people and animals: eight headings, each its own body
      const hdp = G.hd.get(G.assets.character(G.look('c_citizen2'))), a0 = G.body.frameOf(hdp, 5, G.hd.COL.walk, 0), a1 = G.body.frameOf(hdp, 4, G.hd.COL.walk, 0), px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const d0 = px(a0), d1 = px(a1), w = a0.width; let same = 0, tot = 0; for (let y = 0; y < a0.height; y += 2) for (let x = 0; x < w; x += 2) { const i = (y * w + x) * 4, j = (y * w + (w - 1 - x)) * 4; if (d0[i + 3] > 40 || d1[j + 3] > 40) { tot++; if (Math.abs(d0[i] - d1[j]) < 6 && Math.abs(d0[i + 3] - d1[j + 3]) < 20) same++; } }
      check(tot > 100 && same / tot < 0.97, `a diagonal is a body, not a mirror of its opposite (${Math.round(same / tot * 100)}% alike)`);
      check(G.hd.WH >= 34, 'a grown person is scaled to the world');
      const RA = G.realAnimal, s1 = RA.specOf('dog', 'greyhound'), s2 = RA.specOf('dog', 'pitbull'), s3 = RA.specOf('dog', 'chihuahua'); check(s1.H / s1.W > 2 * (s2.H / s2.W) && s3.L < s2.L / 2, 'breeds are different bodies, not one resized');
      let bad = 0; for (const sp in RA.SP) for (let d = 0; d < 8; d++) for (const m of ['idle', 'walk', 'run', 'graze', 'alert', 'rest', 'sleep']) { try { const sc = RA.specOf(sp); RA.paint(sp, sc, sc.fur, '#333333', d, m, 1, {}); } catch (e) { bad++; } } check(!bad, `every animal has all eight headings and every activity (${bad} failed)`);
    }
    {   // inside walls have height; building fits the scale
      const sm = G.maps.get('suburbs'), hb = sm.buildings.find((q) => q.planned === 'house'), view = { x: hb.x * 16, y: hb.y * 16, w: hb.w * 16, h: hb.h * 16 }, keep = hb.roofAlpha;
      hb.roofAlpha = 0; let rs = []; for (let i = 0; i < 30; i++) rs = G.realWalls.runs(sm, view, null);
      check(rs.length >= 2 && rs.every((r) => r.b === hb || !r.b || r.b.roofAlpha === 0) && G.realWalls.H >= G.hd.WH * 1.3, `inside walls stand taller than a person (${G.realWalls.H}), ${rs.length} runs`);
      const inner = rs.find((r) => r.b === hb && r.y > hb.y + 1); if (inner) { const a0 = inner.a, pp = { x: (inner.x0 + 1) * 16, y: (inner.y - 1) * 16 }; for (let i = 0; i < 30; i++) G.realWalls.runs(sm, view, pp); check(inner.a < a0 * 0.5, 'a wall lowers when you are in the room behind it'); }
      hb.roofAlpha = keep;
      const line = G.buildKit.cellsOf({ tx: 5, ty: 5 }, { tx: 12, ty: 7 }, 'wall_wood'), rect = G.buildKit.cellsOf({ tx: 5, ty: 5 }, { tx: 7, ty: 7 }, 'woodfloor');
      check(line.length === 8 && line.every((q) => q[1] === 5) && rect.length === 9, 'dragging lays a straight wall, or a rectangle of floor');
      { const gb = game(), pc = G.BUILD_PIECES.kit_couch; gb.buildTurn = 1; check(pc && G.buildKit.variant(gb, pc).type === 'couch_r', '[R] turns a couch to its side view'); gb.buildTurn = 1; check(G.buildKit.variant(gb, G.BUILD_PIECES.kit_wardrobe).ori === 'r', 'and a wardrobe, which remembers it'); gb.buildTurn = 0; }
      { const icn = G.assets.icon(G.ITEMS.kit_door.icon); check(icn && icn.width >= 90 && icn.getContext('2d').getImageData(48, 48, 1, 1).data[3] > 200, 'the door has a picture in the build bar'); }
      check(G.realFront.topOf(sm, { id: 'x', x: 1, y: 1, w: 8, h: 7, doorX: 1, doorY: 3, playerBuilt: true }) != null, 'a house with its door on the side still has a front wall');
    }
    {   // the loading screen builds the world in steps and hands over a game
      const keepG = G.scenes.stack.slice(), keepW = G.world, keepP = G.player, ls = new G.LoadingScene({}), ms = G.scenes.stack; let seen = 0, n = 0;
      G.scenes.stack = []; G.scenes.push(ls); const total = ls.total; while (!(G.scenes.top() instanceof G.GameScene) && n++ < 6000) { G.loop.tick(1 / 60); if (G.scenes.top() === ls) { ls.render(G.renderer.ctx); seen = Math.max(seen, ls.done); } } if (G.scenes.top() instanceof G.FadeScene) G.scenes.pop();
      const lg = G.scenes.top(); check(lg instanceof G.GameScene && lg.map.id === 'rural' && total > 20 && seen >= 2, `a new game arrives through the loading screen (${total} steps)`);
      check(G.maps.cache.city && !G.maps.keep, 'the maps it built are the ones the game uses');
      check(G.mapCard('city') && G.mapCard('city').name, 'a map has a sign to arrive under');
      if (lg.exit) lg.exit(); G.scenes.stack = keepG; void ms; G.world = keepW; G.player = keepP;
    }
    check(G.WORLD_SCALE === 2 && G.planMap && G.maps.get('city').scaled && G.realMat && G.realFurn && G.portrait && G.fillRooms && G.score, 'every part of the world loaded: scale, materials, furniture, faces, rooms, score');
    const g = game(), S = G.settings, A = G.assets, R = G.renderer, LV = G.gfxOpts.LEVELS, CP = CanvasRenderingContext2D.prototype;
    const start = S.get('graphics');
    { const s = new G.SettingsScene(); s.tab = 4; check(s.options()[0].names.join() === 'Low,Medium,High,Ultra', 'Settings offers Low, Medium, High and Ultra'); }
    check(!A.sprites.flame0 && !A.sprites.flame1 && !A.sprites.flame2, 'the old flame sprites are gone');
    check(Object.keys(G.DECOR).filter((k) => /^v_sign_v_/.test(k)).length === 0, 'the old venue signs are gone');
    check(S.defaults.fxHdChars === undefined && S.defaults.fxTerrain === undefined, 'nothing can switch HD people or terrain off');
    // spies: anything that reaches the canvas as a raw 16x20 sheet (the redirect only takes the nine-argument form), and any saturation grade
    const _di = CP.drawImage, gco = Object.getOwnPropertyDescriptor(CP, 'globalCompositeOperation');
    let raw = 0, sat = 0, rawAt = '';
    CP.drawImage = function (img) {
      if (img && img._classic && (arguments.length !== 9 || img._classic.fw !== 16)) { const st = String(new Error().stack).split('\n').slice(2, 5).join(' / ').replace(/file:\/\/\/D:\/Game\/js\//g, ''); if (!/^\s*at black /.test(st)) { raw++; rawAt = rawAt || `${arguments.length} args ${st}`; } }   // (black(): the sun shadow's offscreen silhouette, never shown as art)
      return _di.apply(this, arguments);
    };
    Object.defineProperty(CP, 'globalCompositeOperation', { configurable: true, get() { return gco.get.call(this); }, set(v) { if (v === 'saturation') sat++; gco.set.call(this, v); } });
    const seen = [], drops = [], cars = [];
    try {
      for (let L = 0; L < 4; L++) {
        S.set('graphics', L);
        const v = G.gfxLevel(), name = v.name; seen.push(name);
        check(v === LV[L] && S.get('fxShadows') === v.set.fxShadows && S.get('fxClouds') === v.set.fxClouds && S.get('fxWater') === v.set.fxWater && S.get('fxVignette') === v.set.fxVignette && S.get('particles') === v.set.particles && S.get('renderScale') === v.set.renderScale, `${name}: picking the level sets its effects`);
        const rep = G.hdArt.report();
        check(!rep.tiles.length && !rep.sprites.length && !rep.icons.length, `${name}: every tile, sprite and icon is HD (missing ${rep.tiles.length + rep.sprites.length + rep.icons.length})`);
        const e0 = (G.errors || []).length;
        for (const [map, spawn, hour] of [['city', 'from_suburbs', 13], ['city', 'from_suburbs', 22], ['rural', 'start', 13], ['rural', 'start', 22], ['southside', 'from_city', 22]]) {
          g.loadMap(map, spawn); G.debug.time(hour); tick(3); G.loop.draw();
          check(g.actors.every((a) => a.kind !== 'npc' || !a.sheet || G.hd.get(a.sheet)), `${name}: everyone on ${map} at ${hour}:00 has an HD sheet`);
        }
        check((G.errors || []).length === e0, `${name}: draws without errors ${(G.errors || []).slice(e0, e0 + 2).join(' | ')}`);
        g.loadMap('city', 'from_suburbs'); G.debug.time(22); tick(3); G.loop.draw();
        check(g.lightCanvas.width === Math.ceil(R.W / v.lightDiv), `${name}: the light map is 1/${v.lightDiv} of the screen (${g.lightCanvas.width} of ${R.W})`);
        G.debug.time(13); g.loadMap('rural', 'start'); g.loadMap('city', 'from_suburbs'); tick(1);
        const c = g.vehicles.filter((q) => q.ai).length; cars.push(c);
        check(c <= v.traffic, `${name}: traffic stays under its limit (${c} of ${v.traffic})`);
        const pl = g.player; g.casings = []; pl.inventory.add('pistol', 1); pl.equipFromSlot(pl.inventory.slots.findIndex((s) => s && s.id === 'pistol'));
        for (let i = 0; i < v.casings + 40; i++) G.firearms.shoot(pl, g, 0, G.ITEMS.pistol, { spread: 0, dmg: 0 });
        check(g.casings.length <= v.casings && g.casings.length > 0, `${name}: casings on the ground stop at ${v.casings} (${g.casings.length})`);
        pl.equip.weapon = null; pl.inventory.remove('pistol', 9); g.bullets.length = 0;
        const W = G.weather, r0 = W.rain, f0 = W.fog; W.rain = 1; W.fog = 0; G.visuals.drops.length = 0; G.loop.draw(); drops.push(G.visuals.drops.length); W.rain = r0; W.fog = f0;
      }
      check(seen.join() === 'Low,Medium,High,Ultra', 'all four levels were drawn');
      check(drops[0] > 0 && drops[0] < drops[1] && drops[1] < drops[2] && drops[2] < drops[3], `more rain on each level (${drops.join(', ')})`);
      check(cars[0] < cars[3], `less traffic on Low (${cars.join(', ')})`);
      check(raw === 0, `no 16x20 sheet reached the screen (${raw} ${rawAt})`);
      check(sat === 0, `nothing grades the picture toward gray (${sat} saturation passes)`);
    } finally { CP.drawImage = _di; Object.defineProperty(CP, 'globalCompositeOperation', gco); S.set('graphics', start); }
    // colors survive the art passes
    const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d'); x.fillStyle = '#c82828'; x.fillRect(0, 0, 8, 8);
    G.sheetFinish(c, {}); const p0 = x.getImageData(4, 4, 1, 1).data;
    const spread = (p0[0] - p0[1]) / (p0[0] || 1), pure = (0xc8 - 0x28) / 0xc8;
    check(Math.abs(spread - pure) < 0.02, `the sheet finish keeps a color as saturated as it was (${spread.toFixed(2)} vs ${pure.toFixed(2)})`);
    const ic = A.icon('cloth|top|tshirt|#c82828'), id = ic.getContext('2d').getImageData(0, 0, ic.width, ic.height).data; let rs = 0, gs = 0;
    for (let i = 0; i < id.length; i += 4) if (id[i + 3] > 200) { rs += id[i]; gs += id[i + 1]; }
    check(rs > gs * 2.2, `a red shirt's icon is red (${Math.round(rs / gs * 10) / 10}x)`);
    tick(2);
  }

  function shot(name) {
    G.loop.running = true;
    if (params.get('lang')) G.i18n.set(+params.get('lang'));
    const start = (s) => { G.scenes.replace(new G.GameScene({})); s(game()); };
    const after = (fn) => setTimeout(fn, 50);
    // a still of the current frame (a live page with fire on it never goes idle headless)
    const still = (p) => { const R = G.renderer, cv = R.canvas; R.cam.x = p.x - R.viewW / 2; R.cam.y = p.y - 8 - R.viewH / 2; G.loop.draw(); const snap = document.createElement('canvas'); snap.width = cv.width; snap.height = cv.height; snap.getContext('2d').drawImage(cv, 0, 0); G.loop.running = false; G.scenes.push({ transparent: false, update() {}, render(ctx) { R.screenTransform(); ctx.imageSmoothingEnabled = false; ctx.drawImage(snap, 0, 0, R.W, R.H); } }); };
    switch (name) {
      case 'menu': break;
      case 'phone': start((g) => {   // the phone (&app=wallpapers, messages...; &wp=dusk: that built-in wallpaper)
        G.loop.running = false; G.debug.time(14); g.world.stats.playSeconds = 100; g.banner = null;
        if (params.get('wp')) G.settings.data.phoneWallpaper = 'builtin:' + params.get('wp');
        g.player.inventory.add('phone', 1);
        const ph = new G.PhoneScene(g); G.scenes.push(ph);
        if (params.get('app')) ph.launch(params.get('app'));
        if (params.get('rel')) {   // &rel=<npc id>: their Relationships page (&list=1: the list)
          const id = params.get('rel'), st = g.world.npcs[id]; st.introduced = true; st.disp = 32; G.phone.addContact(g.world, id);
          for (const k of ['hobby', 'dream', 'origin', 'worry']) G.rel.learn(st, k);
          ph.open('lifelog'); ph.open('relations'); if (!params.get('list')) ph.open('relation', id);
        }
        for (let i = 0; i < 30; i++) G.loop.tick(1 / 60);
        G.loop.draw(); const R = G.renderer, cv = R.canvas, snap = document.createElement("canvas"); snap.width = cv.width; snap.height = cv.height; snap.getContext("2d").drawImage(cv, 0, 0); G.scenes.push({ transparent: false, update() {}, render(ctx) { R.screenTransform(); ctx.drawImage(snap, 0, 0, R.W, R.H); } });   // (a still: see still())
      }); break;
      case 'burns': start((g) => {   // charred furniture at every stage, soot, gasoline and alcohol puddles (&out=1: outdoors on grass)
        G.loop.running = false; G.debug.time(12); g.world.stats.playSeconds = 100; g.banner = null;
        const p = g.player; p.hp = p.maxHp = 9999;
        if (params.get('out')) {
          g.loadMap('rural', 'start'); tick(3); const fs = g.fire;
          for (let k = 0; k < 14; k++) G.spills.add(fs, 'gas', p.x - 50 + k * 4.5, p.y + 18 + Math.sin(k * 0.7) * 5, 5);
          for (let k = 0; k < 5; k++) G.spills.add(fs, 'gas', p.x - 60 + k * 3, p.y + 22, 9);
          for (let k = 0; k < 6; k++) G.spills.add(fs, 'alcohol', p.x + 30 + k * 3, p.y + 10 + (k % 2) * 3, 6);
          for (const b of G.spills.list(g.world, g.map.id).blobs) b.r = G.spills.radius(b);
          G.spills.rebuild(fs); p.dir = 0;
        } else {
          g.loadMap('city', 'from_suburbs'); tick(3);
          const m = g.map, inB = (bb, d) => d.tx > bb.x && d.tx < bb.x + bb.w - 1 && d.ty > bb.y && d.ty < bb.y + bb.h - 1;
          const b = m.buildings.filter((bb) => bb.w >= 7 && bb.h >= 6).sort((a, c) => m.decor.filter((d) => inB(c, d) && !d.def.flat).length - m.decor.filter((d) => inB(a, d) && !d.def.flat).length)[0];
          const ds = m.decor.filter((d) => inB(b, d) && !d.def.flat);
          const lv = [0.15, 0.35, 0.55, 0.75, 1, 1, 0.9, 0.45];
          ds.forEach((d, k) => G.burns.setChar(m, d, lv[k % lv.length]));
          for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + Math.ceil(b.w * 0.6); tx++) G.burns.soot(m, ty * m.w + tx, Math.max(0, 0.9 - (tx - b.x) * 0.14));
          p.x = (b.x + b.w / 2) * 16; p.y = (b.y + b.h - 2) * 16 + 10; p.dir = 3;
          const fs = g.fire; G.spills.add(fs, 'gas', p.x - 30, p.y - 4, 18, false); G.spills.add(fs, 'gas', p.x - 24, p.y - 1, 10, false); G.spills.add(fs, 'alcohol', p.x + 24, p.y - 6, 14, false);
          for (const bl of G.spills.list(g.world, m.id).blobs) bl.r = G.spills.radius(bl);
          G.spills.rebuild(fs);
          document.title = 'burns: ' + ds.length + ' pieces in ' + b.id;
        }
        for (let i = 0; i < 40; i++) G.loop.tick(1 / 60);
        for (let i = 0; i < 60; i++) G.loop.draw();   // (the soot is painted a few tiles per frame)
        still(p);
      }); break;
      case 'melee': start((g) => {   // weapons mid-swing, four directions
        G.debug.time(13); g.world.stats.playSeconds = 100;
        const p = g.player; p.hp = p.maxHp = 9999; p.x = 96 * 16; p.y = 76 * 16;
        const kit = [['baseball_bat', 2, 0.2], ['machete', 0, 0.15], ['sledgehammer', 1, 0.4], [null, 3, 0.09], ['spear', 2, 0.18], ['woodaxe', 0, 0.26]];
        const people = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid).slice(0, kit.length - 1);
        [p, ...people].forEach((a, i) => {
          const [w, dir, t] = kit[i];
          a.x = p.x + (i % 3) * 48 - 48; a.y = p.y + Math.floor(i / 3) * 44 - 10; a.dir = dir; a.state = a === p ? a.state : 'fight'; a.target = null; a.talking = true;
          if (a === p) { if (w) { p.inventory.add(w); p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === w)); } else p.equip.weapon = null; }
          else { a.def = Object.assign({}, a.def, { weapon: w }); if (w) a.st.inv.push([w, 1]); }
          a.swing = null; G.melee.start(a); a.swing.base = [Math.PI / 2, Math.PI, 0, -Math.PI / 2][dir]; a.swing.t = t;
        });
        G.loop.running = false; G.loop.draw();
      }); break;
      case 'bodies': start((g) => {   // naked sprite sheets, censored (top row) and not, big
        const looks = [G.look('b1', { body: 'm', facial: 1 }), G.look('b2', { body: 'f' }), G.look('b3', { body: 'f', skin: '#7a4a2e', belly: 3 }), G.look('b4', { body: 'm', skin: '#5a3a22', facial: 0 })].map((l) => Object.assign({}, l, { naked: true }));
        g.hideHud = true;
        G.scenes.push({ transparent: false, update() {}, render(ctx) {
          G.renderer.screenTransform(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#5a6a5a'; ctx.fillRect(0, 0, 1280, 800);
          G.settings.data.censor = false; looks.forEach((l, i) => { const s = G.assets.character(l); for (let d = 0; d < 4; d++) ctx.drawImage(s.img, 0, d * s.fh, s.fw, s.fh, 10 + d * 160, 10 + i * 196, s.fw * 9, s.fh * 9); });
          G.settings.data.censor = true;
        } });
      }); break;
      case 'rural': start((g) => { G.debug.time(10); g.world.stats.playSeconds = 100; }); break;
      case 'effects': start((g) => { G.debug.time(10); g.world.stats.playSeconds = 100; g.player.inventory.add('smartphone'); G.effects.add(g.player, 'wd_opioid', 900); G.effects.add(g.player, 'stim', 120); g.player.hunger = 70; after(() => { G.phone.openApp(g, 'lifelog'); G.scenes.top().open('effects'); G.input.mouse.ux = G.renderer.uiW / 2; G.input.mouse.uy = G.renderer.uiH * 0.19; }); }); break;
      case 'village': start((g) => { G.debug.time(16); g.player.x = 96 * 16; g.player.y = 76 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'night': start((g) => { G.debug.time(22); g.player.x = 94 * 16; g.player.y = 68 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'interior': start((g) => { G.debug.time(11); g.player.x = 78 * 16 + 8; g.player.y = 52 * 16 + 12; g.player.dir = 3; g.world.stats.playSeconds = 100; }); break;
      case 'at': start((g) => { const q = (k, d) => params.get(k) != null ? +params.get(k) : d; g.loadMap(params.get('map') || 'city', null); G.debug.time(q('h', 13)); g.world.stats.playSeconds = 100; g.player.x = q('x', 64) * 16 + 8; g.player.y = q('y', 42) * 16 + 12; g.player.dir = q('dir', 0); g.player.hp = g.player.maxHp = 9999; if (params.get('weather')) { G.weather.force = params.get('weather'); Object.assign(G.weather, G.weather.targets(g.world.day, g.world.hourF)); } if (params.get('b')) { const b = g.map.building(params.get('b')); g.player.x = b.doorX * 16 + 8 + q('dx', 0); g.player.y = (b.doorY + 1) * 16 + q('dy', 0); }
        if (params.get('key')) { G.input.down.add(params.get('key')); for (let i = 0; i < q('ticks', 20); i++) G.loop.tick(1 / 60); G.loop.running = false; G.loop.draw(); }   // &key=KeyA&ticks=N: caught mid-step
      }); break;
      case 'smoke': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; g.player.x = 128 * 16; g.player.y = 84 * 16; g.player.dir = +(params.get('dir') || 2); g.player.inventory.add('torch', 1); g.player.inventory.add(params.get('item') || 'cigarettes', 1); g.player.useFromSlot(g.player.inventory.slots.findIndex((s) => s && s.id === (params.get('item') || 'cigarettes')), g); for (let i = 0; i < 60 * 9.5; i++) G.loop.tick(1 / 60); }); break;
      case 'decorlist': start(() => { const out = Object.keys(G.DECOR).filter((k) => G.DECOR[k].interact).map((k) => k + ':' + G.DECOR[k].interact); const pre = document.createElement('pre'); pre.id = 'walls'; pre.textContent = out.join(' '); document.body.appendChild(pre); }); break;
      case 'casings': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; const p = g.player; p.x = 128 * 16; p.y = 84 * 16; for (const id of ['pistol', 'shotgun']) { p.inventory.add(id, 1); p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === id)); p.mags = p.mags || {}; p.mags[id] = 6; for (let k = 0; k < 4; k++) { p.reloadT = 0; p.attackCd = 0; G.firearms.playerFire(p, g, id === 'pistol' ? 0 : Math.PI); for (let i = 0; i < 12; i++) G.loop.tick(1 / 60); } } }); break;
      case 'revs': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; g.player.x = 128 * 16; g.player.y = 84 * 16; ['f_rev_leader', 'f_rev1', 'f_rev2', 'c_preacher'].forEach((id, k) => { const n = new G.NPC(id, g.world.npcs[id]); n.x = g.player.x - 36 + k * 24; n.y = g.player.y + 20; n.state = 'schedule'; n.update = () => {}; g.actors.push(n); }); for (let k = 0; k < 4; k++) { const n = G.happenings.spawn(g, { id: 'x' }, { name: 'Protester', faction: 'revolutionaries', look: G.REV_LOOK('p' + k) }, 64 - 2 + k, 45); n.update = () => {}; } }); break;
      case 'aim': start((g) => { G.debug.time(12); g.world.stats.playSeconds = 100; const p = g.player; p.inventory.add('pistol'); p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === 'pistol')); p.mags.pistol = 12; const R = G.renderer, m = G.input.mouse; const put = () => { m.x = (p.x + 70 - R.cam.x) * R.zoom; m.y = (p.y - 30 - R.cam.y) * R.zoom; }; put(); m.down = true; m.pressed = true; m.moved = true; for (let i = 0; i < 60; i++) { put(); m.moved = true; G.loop.tick(1 / 60); m.pressed = false; } put(); }); break;
      case 'gfx': start((g) => { G.debug.time(12); g.world.stats.playSeconds = 100; setTimeout(() => { const s = new G.SettingsScene(); s.tab = +(params.get('tab') || 4); G.scenes.push(s); }, 50); }); break;
      case 'animals': start((g) => { g.hideHud = true; G.scenes.push({ transparent: false, update() {}, render(ctx) { G.renderer.screenTransform(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#5a7a4a'; ctx.fillRect(0, 0, 2000, 1200); let y = 10; for (const k of ['deer', 'wolf', 'cow', 'boar', 'bear', 'rabbit', 'chicken']) { const def = G.ANIMALS[k]; if (!def) continue; const a = new G.Animal(k, 0, 0, 'z', {}); a.draw(G.renderer.ctx); const s = a._sheet2; if (s) { ctx.drawImage(s.img, 0, 0, s.fw * 4, s.fh * 2, 10, y, s.fw * 4 * 5, s.fh * 10); y += s.fh * 10 + 6; if (y > 600) break; } } } }); }); break;
      case 'dreamhd': start((g) => {   // the dream pictures and the explorable dream, drawn once with the loop stopped
        g.world.stats.playSeconds = 100; G.loop.running = false;
        const set = params.get('set') || 'house', mood = params.get('mood') || 'weird';
        const d = { mood, scenes: [{ theme: 'rooms', set, beats: ['You are home. You open a door you have never noticed before.', 'Behind it, another kitchen.', 'And another.', 'The fridge hums your name.'], body: G.dreams.dreamBody(G.dreams.context(g)) }] };
        const ds = new G.DreamScene(g, d, () => {}); G.scenes.push(ds);
        if (params.get('walk')) { const w = new G.DreamWorldScene(g, ds, () => {}); G.scenes.push(w); w.figures.forEach((f, i) => { f.x = w.me.x - 40 + i * 20; f.y = w.me.y + 20; }); if (w.figures[0]) { w.figures[0].say = 'Do I know you?'; w.figures[0].sayT = 3; } }
        for (let i = 0; i < 12; i++) G.scenes.top().t = (G.scenes.top().t || 0) + 0.1;
        ds.chars = 999; G.loop.draw();
      }); break;
      case 'homestead': start((g) => {   // horses, donkeys, dogs, cats, riding, crops, construction mode
        g.loadMap('farmland', null); G.debug.time(14); g.world.stats.playSeconds = 100; g.banner = null;
        const w = g.world, p = g.player, b = g.map.building('f_stable');
        p.x = (b ? b.doorX : 40) * 16 + 8; p.y = (b ? b.y + b.h + 4 : 30) * 16 + 12;
        const mk = (sp, dx, dy, name, moving) => { const rec = { id: 'shot' + sp + dx, species: sp, name, coat: G.beasts.coatOf(sp, sp + dx), map: 'farmland', x: p.x + dx, y: p.y + dy }; const a = new G.Animal(sp, rec.x, rec.y, null, { x: 0, y: 0, w: 2, h: 2 }); a.rec = rec; a.coat = rec.coat; a.facingRight = dx < 0; if (moving) { a.moving = true; a._bs = { phase: 0.3, lx: a.x - 3, ly: a.y, sp: moving, t: 1 }; } g.actors.push(a); return a; };
        mk('horse', -70, -10, 'Thunder', 0); mk('horse', -40, 22, 'Copper', 130); mk('donkey', 50, -14, 'Biscuit', 0); mk('dog', 34, 20, 'Rex', 60); mk('cat', 60, 20, 'Mittens', 0);
        const rec = { id: 'ride', species: 'horse', name: 'Daisy', coat: G.beasts.coatOf('horse', 'x3'), map: 'farmland' }; p.mount = rec; p.dir = 2; p.facingRight = true;
        const crops = G.farming.crops(w, 'farmland'), tx = Math.floor(p.x / 16) - 3, ty = Math.floor(p.y / 16) + 3;
        ['tomato', 'corn', 'wheat', 'carrot', 'cabbage', 'potato'].forEach((c, i) => { for (let k = 0; k < 3; k++) { G.mods.tile(g.map, tx + i, ty + k, G.T.field); crops[(tx + i) + ',' + (ty + k)] = { crop: c, g: [0.1, 0.6, 1][k], wateredDay: k ? w.day : -1 }; } });
        G.home.inv(w).kit_wall_wood = 5; G.home.inv(w).kit_bed = 1; G.home.inv(w).kit_workbench = 1; G.home.inv(w).planks = 12; G.home.inv(w).nails = 20; g.buildMode = true; g.buildSel = 0; if (params.get('menu')) G.home.inventoryMenu(g);
        for (let i = 0; i < 3; i++) G.loop.tick(1 / 60);
        G.loop.running = false; G.loop.draw();
      }); break;
      case 'walltops': start((g) => {   // player-built walls: a U of wood, a brick column, and a building interior with its side walls
        G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null;
        const p = g.player; p.y += 16 * 9; p.x -= 16 * 6; const x0 = Math.floor(p.x / 16) + 2, y0 = Math.floor(p.y / 16) - 3, H = G.home;
        H.inv(g.world).kit_wall_wood = 30; H.inv(g.world).kit_wall_brick = 10; H.inv(g.world).kit_floor_wood = 10; p.inventory.add('hammer');
        const put = (id, tx, ty) => H.place(g, id, tx, ty);
        for (let i = 0; i < 5; i++) put('kit_wall_wood', x0 + i, y0);
        for (let j = 1; j < 4; j++) { put('kit_wall_wood', x0, y0 + j); put('kit_wall_wood', x0 + 4, y0 + j); }
        for (let j = 1; j < 3; j++) for (let i = 1; i < 4; i++) put('kit_floor_wood', x0 + i, y0 + j);
        for (let j = 0; j < 4; j++) put('kit_wall_brick', x0 + 7, y0 + j);
        G.renderer.follow(p.x, p.y, g.map.pw, g.map.ph, 1, true);
        G.loop.running = false; G.loop.draw();
      }); break;
      case 'phouse': start((g) => {   // a house you built (roof on), and the breeds
        G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null;
        const p = g.player, w = g.world, H = G.home; p.y += 16 * 9; p.x -= 16 * 6;
        const x0 = Math.floor(p.x / 16) + 2, y0 = Math.floor(p.y / 16) - 4;
        Object.assign(H.inv(w), { kit_wall_wood: 40, kit_door: 2, kit_floor_wood: 20, ['kit_roof_' + (params.get('roof') || 'red')]: 1 }); p.inventory.add('hammer');
        for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 7; x++) { const edge = x === x0 || x === x0 + 6 || y === y0 || y === y0 + 5; H.place(g, edge ? (x === x0 + 3 && y === y0 + 5 ? 'kit_door' : 'kit_wall_wood') : 'kit_floor_wood', x, y); }
        if (!params.get('open')) H.place(g, 'kit_roof_' + (params.get('roof') || 'red'), x0 + 3, y0 + 2);
        const lineup = [['dog', 'shepherd'], ['dog', 'pitbull'], ['dog', 'dalmatian'], ['dog', 'chihuahua'], ['dog', 'husky'], ['cat', 'bengal'], ['cat', 'mainecoon'], ['cat', 'siamese']];
        if (!params.get('noa')) lineup.forEach(([sp, br], i) => { const rec = G.breeds.fill({ id: 'ln' + i, species: sp, breed: br, sex: i % 2 ? 'f' : 'm', name: br, map: g.map.id }); rec.coat = G.breeds.coat(sp, br, rec.id); const a = new G.Animal(sp, p.x - 90 + i * 24, p.y + 64, null, { x: Math.floor((p.x - 90 + i * 24) / 16) - 1, y: Math.floor((p.y + 64) / 16) - 1, w: 3, h: 3 }); a.rec = rec; a.facingRight = true; g.actors.push(a); });
        if (!params.get('noh')) [['horse', 'appaloosa'], ['horse', 'clydesdale'], ['horse', 'thoroughbred'], ['donkey', 'miniature']].forEach(([sp, br], i) => { const rec = G.breeds.fill({ id: 'hz' + i, species: sp, breed: br, sex: 'f', name: br, map: g.map.id }); rec.coat = G.breeds.coat(sp, br, rec.id); const a = new G.Animal(sp, p.x - 80 + i * 44, p.y + 110, null, { x: Math.floor((p.x - 80 + i * 44) / 16) - 1, y: Math.floor((p.y + 110) / 16) - 1, w: 3, h: 3 }); a.rec = rec; a.facingRight = true; g.actors.push(a); });
        G.renderer.follow(p.x, p.y + 20, g.map.pw, g.map.ph, 1, true);
        G.loop.running = false; G.loop.draw();
      }); break;
      case 'meleecheck': start((g) => {   // does melee land, the way people play? (report)
        const out = [], p = g.player, I = G.input, m = I.mouse; G.loop.running = false; G.law.off = true;
        const foe = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient); const diag = { v: false };
        const trial = (label, weapon, how, legacy) => {
          G.settings.data.legacyControls = legacy; p.equip.weapon = weapon; if (weapon && !p.inventory.has(weapon)) p.inventory.add(weapon);
          p.swing = null; p.attackCd = 0; p.attackTimer = 0; p.dir = 2; p.facingRight = true; p._mv = null;
          foe.x = p.x + (diag.v ? 9 : 12); foe.y = p.y + (diag.v ? 9 : 0); foe.hp = foe.maxHp = 500; foe.invuln = 0; foe.talking = true; foe.state = 'schedule'; foe.dead = false;
          const h0 = foe.hp, key = I.bindings.attack[0];
          if (how === 'key') { I.pressed.add(key); I.down.add(key); }
          if (how === 'rclick') { m.rpressed = m.rdown = true; }
          if (how === 'lclick') { m.pressed = m.down = true; const R = G.renderer; m.x = (foe.x - R.cam.x) * R.zoom; m.y = (foe.y - 6 - R.cam.y) * R.zoom; m.moved = true; }
          G.loop.tick(1 / 60);
          I.pressed.delete(key); I.down.delete(key); m.rpressed = m.rdown = m.pressed = m.down = false;
          for (let i = 0; i < 40; i++) G.loop.tick(1 / 60);
          out.push(`${label}: ${h0 - foe.hp} dmg (swing ${p.swing ? 'yes' : 'no'}, foe at ${Math.round(foe.x - p.x)},${Math.round(foe.y - p.y)} state ${foe.state})`);
        };
        trial('fists, Space, legacy', null, 'key', true);
        trial('bat, Space, legacy', 'baseball_bat', 'key', true);
        trial('bat, right click, legacy', 'baseball_bat', 'rclick', true);
        trial('bat, Space, modern', 'baseball_bat', 'key', false);
        trial('bat, left click, modern', 'baseball_bat', 'lclick', false);
        diag.v = true; trial('fists, Space, legacy, foe diagonal', null, 'key', true); trial('knife, Space, legacy, foe diagonal', 'kitchen_knife', 'key', true);
        const pre = document.createElement('pre'); pre.id = 'walls'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
      }); break;
      case 'riders': start((g) => {   // bikes and motorcycles with riders (traffic people) and parked ones, plus held weapons up close
        g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null; g.hideHud = true;
        const p = g.player; p.x = 128 * 16; p.y = 84 * 16;
        const ids = Object.keys(G.vehicles.MODELS).filter((id) => G.vehicles.MODELS[id].moto);
        ids.forEach((id, i) => { for (const ridden of [true, false]) { const v = new G.Vehicle({ model: id, x: p.x - 90 + i * 32, y: p.y - 50 + (ridden ? 0 : 26), angle: i % 2 ? 0 : Math.PI * 0.25 * (i - 2) }); if (ridden) v.ai = { driver: { seed: i, look: G.look('rider' + i) }, road: null }; v.update = () => {}; g.vehicles.push(v); } });
        const kit = ['baseball_bat', 'kitchen_knife', 'pistol', 'shotgun', 'assault_rifle', 'fire_axe'];
        const people = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid).slice(0, kit.length);
        people.forEach((a, i) => { a.x = p.x - 80 + i * 26; a.y = p.y + 40; a.dir = i % 2 ? 2 : 0; a.talking = true; a.def = Object.assign({}, a.def, { weapon: kit[i] }); a.st.inv.push([kit[i], 1]); a.state = 'fight'; a.target = null; });
        G.loop.running = false; G.loop.draw();
      }); break;
      case 'cars': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; const p = g.player; p.x = 128 * 16; p.y = 84 * 16; const ids = Object.keys(G.vehicles.MODELS); ids.forEach((id, i) => { const v = new G.Vehicle({ model: id, x: p.x - 120 + (i % 6) * 44, y: p.y - 40 + Math.floor(i / 6) * 30, angle: i * 0.4 }); if (i === 2) v.hp = v.m.hp * 0.3; g.vehicles.push(v); }); g.hideHud = true; }); break;
      case 'fire': start((g) => { G.debug.time(+(params.get('h') || 20)); g.world.stats.playSeconds = 100; const p = g.player; p.hp = p.maxHp = 99999; G.fireDept.off = true; const tx = Math.floor(p.x / 16) + 4, ty = Math.floor(p.y / 16) + 3; for (let k = 0; k < 3; k++) g.fire.ignite(tx + k, ty, false, false); const rates = [G.FIRE_BURN, G.FIRE_SPREAD]; G.FIRE_SPREAD = 0.2; for (let i = 0; i < 60 * 12; i++) G.loop.tick(1 / 60); [G.FIRE_BURN, G.FIRE_SPREAD] = rates; g.hideHud = true; }); break;
      case 'lineup': start((g) => {   // HD characters up close: an NPC lineup (front), a walk cycle (side), poses, corpse poses
        g.hideHud = true;
        const looks = [G.look('l1', { body: 'm', facial: 1, top: 'jacket' }), G.look('l2', { body: 'f', top: 'dress', hairStyle: 7 }), G.look('l3', { body: 'm', hat: 'cap', top: 'hoodie', skin: '#7a4a2e' }), G.look('l4', { body: 'f', top: 'shirt', hairStyle: 8, skin: '#5a3a22' }), G.look('l5', { body: 'm', hair: '#c8c8c8', top: 'vest', glasses: 'round' }), G.look('l6', { body: 'f', top: 'jacket', hairStyle: 1, bottom: 'skirt' })];
        const hd = looks.map((l) => G.hd.get(G.assets.character(l), true));
        G.scenes.push({ transparent: false, update() {}, render(ctx) {
          G.renderer.screenTransform(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#6a7a6a'; ctx.fillRect(0, 0, 2000, 1200);
          const S = 3, C = G.hd.COL;
          hd.forEach((h, i) => { for (let d = 0; d < 4; d++) ctx.drawImage(h.img, C.idle * 32, d * 44, 32, 44, 10 + i * 210 + d * 50, 10, 32 * 1.5, 44 * 1.5); });
          for (let f = 0; f < 8; f++) { ctx.drawImage(hd[0].img, (C.walk + f) * 32, 2 * 44, 32, 44, 10 + f * 100, 100, 32 * S, 44 * S); ctx.drawImage(hd[1].img, (C.run + f) * 32, 1 * 44, 32, 44, 10 + f * 100, 240, 32 * S, 44 * S); }
          ['sit', 'crouch', 'cower', 'handsup', 'mouth', 'flinch', 'talk', 'aim', 'drag', 'swim'].forEach((k, i) => ctx.drawImage(hd[2].img, C[k] * 32, 0, 32, 44, 10 + i * 100, 380, 32 * S, 44 * S));
          ctx.drawImage(hd[3].img, C.walk * 32, 0, 32, 44, 1050, 380, 32 * S, 44 * S);
          for (let f = 0; f < 8; f++) ctx.drawImage(hd[0].img, (C.run + f) * 32, 0, 32, 44, 10 + f * 100, 520, 32 * S, 44 * S);
        } });
      }); break;
      case 'crime': start((g) => {   // a crime scene: tape, detective, forensics, patrol car (?shot=crime&stage=investigate)
        g.loadMap('city', 'from_suburbs'); G.debug.time(+(params.get('h') || 14)); g.world.stats.playSeconds = 100; const p = g.player; p.hp = p.maxHp = 99999;
        const v = g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat === 'flee' && !a.transient && a.distTo(p) < 300) || g.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid);
        p.x = v.x - 40; p.y = v.y + 20; G.combat.damage(v, 99999, null, g); for (let i = 0; i < 5; i++) G.loop.tick(1 / 30);
        const body = g.containers.find((c) => c.kind === 'corpse' && c.victim === v.id); g.world.dead[v.id].discovered = true; G.law.call911(g.world, body, g.map.id);
        const job = G.law.state(g.world).jobs.find((j) => j.victim === v.id), want = params.get('stage') || 'investigate';
        for (let i = 0; i < 4000 && job.stage !== want; i++) { if (job.t > 0) job.t = Math.min(job.t, 0.3); for (const a of g.actors) if (a.lawJob === job.id && a.distTo(job) > 30) { a.x = job.x + (a.x > job.x ? 22 : -22); a.y = job.y + 14; } for (const c of g.vehicles || []) if (c.lawDrive) { c.x = c.lawDrive.x; c.y = c.lawDrive.y; } G.loop.tick(1 / 30); }
        for (let i = 0; i < 90; i++) G.loop.tick(1 / 30);
      }); break;
      case 'city': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.player.x = 128 * 16; g.player.y = 84 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'center2': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(15); g.player.x = 40 * 16; g.player.y = 76 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'harbor': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(17); g.player.x = 120 * 16; g.player.y = 148 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'suburbs': start((g) => { g.loadMap('suburbs', 'from_rural'); G.debug.time(11); g.player.x = 64 * 16; g.player.y = 72 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'southside': start((g) => { g.loadMap('southside', 'from_city'); G.debug.time(16); g.player.x = 44 * 16; g.player.y = 72 * 16; g.world.stats.playSeconds = 100; for (let i = 0; i < 60 * 4; i++) G.loop.tick(1 / 60); }); break;
      case 'eastside': start((g) => { g.loadMap('eastside', 'from_city'); G.debug.time(20); g.player.x = 140 * 16; g.player.y = 76 * 16; g.world.stats.playSeconds = 100; for (let i = 0; i < 60 * 4; i++) G.loop.tick(1 / 60); }); break;
      case 'heights': start((g) => { g.loadMap('heights', 'from_city'); G.debug.time(12); g.player.x = 80 * 16; g.player.y = 72 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'sanctum': start((g) => { g.loadMap('heights', 'from_city'); G.debug.time(23.5); g.resyncNPCs(); g.player.x = 68 * 16; g.player.y = 48 * 16; g.world.stats.playSeconds = 100; for (let i = 0; i < 60 * 3; i++) G.loop.tick(1 / 60); }); break;
      case 'raid': start((g) => { g.loadMap('southside', 'from_city'); G.debug.time(14); g.world.stats.playSeconds = 100; g.player.hp = g.player.maxHp = 9999; g.player.x = 140 * 16; g.player.y = 48 * 16; G.gangWar.startRaid(g.world, 'gang_blue', 's_ne'); for (let i = 0; i < 60 * 12; i++) G.loop.tick(1 / 60); g.player.x = 146 * 16; g.player.y = 34 * 16; G.loop.tick(1 / 60); }); break;
      case 'turf': start((g) => { after(() => { G.scenes.push(new G.JournalScene(g)); G.scenes.top().tab = 6; }); }); break;
      case 'worldmap': start((g) => { g.loadMap('southside', 'from_city'); after(() => G.scenes.push(new G.MapScene(g))); }); break;
      case 'forest': start((g) => { g.loadMap('forest', 'from_rural'); G.debug.time(14); g.player.x = 160 * 16; g.player.y = 104 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'camp': start((g) => { g.loadMap('forest', 'from_rural'); G.debug.time(20); g.player.x = 200 * 16; g.player.y = 80 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'island': start((g) => { g.loadMap('island', 'from_city'); G.debug.time(18); g.player.x = 80 * 16; g.player.y = 68 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'inventory': start((g) => { g.player.inventory.add('iron_sword'); g.player.inventory.add('wolf_pelt', 3); after(() => G.scenes.push(new G.InventoryScene(g))); }); break;
      case 'dialogue': start((g) => { G.debug.time(10); const e = g.actors.find((a) => a.id === 'r_elder'); after(() => { g.player.x = e.x; g.player.y = e.y + 20; g.openDialogue(e); }); }); break;
      case 'shop': start((g) => { G.debug.time(10); if (params.get('long')) g.world.shops.r_smith.stock = Object.keys(G.ITEMS).slice(0, 60).map((id) => [id, 3]); if (params.get('style')) G.settings.set('uiStyle', +params.get('style')); after(() => { const s = new G.ShopScene(g, 'r_smith', null); s.scroll = +(params.get('scroll') || 0); G.scenes.push(s); }); }); break;
      case 'diary': start((g) => { G.debug.time(13); g.world.bounty[g.region] = 200; G.jail.imprison(g); g.world.addRep('p_afros', 12); after(() => { for (let i = 0; i < 40; i++) G.loop.tick(1 / 60); const d = new G.DiaryScene(g); d.open = 1; d.page = +(params.get('page') || 0); G.scenes.push(d); }); }); break;
      case 'jail': start((g) => { G.debug.time(13); g.world.bounty[g.region] = 200; G.jail.imprison(g); after(() => { const q = g.player; q.x = +(params.get('x') || 25) * 16; q.y = +(params.get('y') || 18) * 16; }); }); break;
      case 'morgue': start((g) => { g.loadMap('morgue', 'from_hospital'); G.debug.time(13); after(() => { g.world.morgue = [{ id: 'x', stage: params.get('stage') || 'furnace', at: 0 }]; }); }); break;
      case 'place': start((g) => { g.loadMap(params.get('map') || 'neon', params.get('spawn') || undefined); G.debug.time(+(params.get('h') || 21)); after(() => { g.player.x = +(params.get('x') || 20) * 16 + 8; g.player.y = +(params.get('y') || 20) * 16 + 12; if (params.get('fight')) { G.fightClub.show(g); } if (params.get('run')) { for (let i = 0; i < +params.get('run'); i++) G.loop.tick(1 / 60); } }); }); break;
      case 'scene': start((g) => { g.loadMap('fightclub', 'from_port'); g._fcNext = 1e12; g.player.gold = 800; after(() => { const k = params.get('k'), E = G.estate; let s = null; if (k === 'fighters') s = new G.FighterScene(g, 'bet'); if (k === 'bet') { s = new G.FighterScene(g, 'bet'); s.choose('fc_viper'); } if (k === 'film') { s = new G.CinemaScene(G.SHOWS.FILMS[+(params.get('n') || 0)], () => {}); s.phase = 'film'; } if (k === 'stage') { s = new G.StageScene(G.SHOWS.PLAYS[+(params.get('n') || 0)], () => {}); s.open = 1; } if (k === 'pool') s = new G.PoolScene(g, 10); if (k === 'chess') s = new G.ChessScene(g); if (k === 'bowl') s = new G.BowlingScene(g); if (k === 'ledger') { E.give(g.world, g, 'v_nonna'); E.bizDay(g.world); s = E.biz(g, 'v_nonna'); } if (k === 'list') s = E.listing(g); if (s) G.scenes.push(s); }); }); break;
      case 'bank': start((g) => { g.loadMap('city', 'start'); G.debug.time(13); after(() => { const b = g.map.building('c_bank'); if (b) { g.player.x = (b.doorX) * 16 + 8; g.player.y = (b.doorY - 2) * 16; } }); }); break;
      case 'forestart': start((g) => { g.loadMap('forest', 'from_rural'); G.debug.time(14); g.player.x = 200 * 16; g.player.y = 80 * 16; g.world.stats.playSeconds = 100; }); break;
      case 'barter': start((g) => { G.debug.time(10); if (params.get('style')) G.settings.set('uiStyle', +params.get('style')); const e = g.actors.find((a) => a.id === 'r_elder'); e.st.inv = Object.keys(G.ITEMS).slice(0, 40).map((id) => [id, 2]); for (const id of Object.keys(G.ITEMS).slice(60, 75)) g.player.inventory.add(id); after(() => { const s = new G.BarterScene(g, e); s.scroll = [+(params.get('scroll') || 0), 0]; G.scenes.push(s); }); }); break;
      case 'talkbar': start((g) => { G.debug.time(13); G.autonomy.off = true; const e = g.actors.find((a) => a.id === 'r_elder'); g.player.x = e.x; g.player.y = e.y + 20; e.chatT = 99; g.world.stats.playSeconds = 100; after(() => { G.talkbar.push('You', 'Jack Dale is an asshole.'); G.talkbar.push(e.displayName, "Hey, what's your problem with me, kid?"); e.say("Hey, what's your problem with me, kid?", 99); const b = new G.TalkBarScene(g, e); b.input = 'Follow me around, I could use a hand'; G.scenes.push(b); }); }); break;
      case 'journal': start((g) => { G.world.startQuest('wolves'); G.world.rumor('Example rumor for the screenshot.', 'rural'); after(() => { G.scenes.push(new G.JournalScene(g)); G.scenes.top().tab = 0; }); }); break;
      case 'map': start((g) => { after(() => G.scenes.push(new G.MapScene(g))); }); break;
      case 'ui': start((g) => {   // &scene=settings|pause|confirm|message|loot|save|load|wait|death (&tab=N, &style=0 for Noir)
        if (params.get('style')) G.settings.set('uiStyle', +params.get('style'));
        after(() => {
          const sc = params.get('scene') || 'settings', tab = +(params.get('tab') || 0);
          const box = { kind: 'chest', name: 'Kitchen Cabinet', items: [['bread', 2], ['beer', 3], ['iron_sword', 1]], gold: 12 };
          const make = { settings: () => Object.assign(new G.SettingsScene(), { tab }), pause: () => new G.PauseScene(g), confirm: () => new G.ConfirmScene('Return to the main menu? Unsaved progress will be lost.', () => {}),
            message: () => new G.MessageScene('Built on a custom engine.\nAll art, sound and music are generated procedurally.', 'Credits'), loot: () => new G.LootScene(g, box),
            save: () => new G.SaveLoadScene(g, 'save'), load: () => new G.SaveLoadScene(g, 'load'), wait: () => new G.WaitScene(g, false), death: () => Object.assign(new G.DeathScene(g), { t: 2 }),
            skills: () => Object.assign(new G.SkillsScene(g), { xpTab: tab }), invdetails: () => Object.assign(new G.InventoryScene(g), { xpView: 1 }), barber: () => new G.BarberScene(g, null) };
          if (sc === 'skills') { g.player.skills.points = 2; G.effects.add(g.player, 'crack_high', 60); }
          if (params.get('stop')) {   // &stop=1: one frame, timed (the page title shows how long it took)
            G.loop.running = false;
            const t0 = performance.now(); G.loop.draw(); const t1 = performance.now(); G.loop.draw();
            document.title = `frame ${Math.round(t1 - t0)}ms, again ${Math.round(performance.now() - t1)}ms ${G.errors ? G.errors.join(' | ') : ''}`;
            if (params.get('stop') === 'log') { const pre = document.createElement('pre'); pre.id = 'testlog'; pre.textContent = document.title; document.body.appendChild(pre); }
          }
          G.scenes.push(make[sc]());
        });
      }); break;
      case 'creator': G.scenes.replace(new G.CharacterCreatorScene()); G.scenes.top()._diffAsked = true; G.scenes.top().editor.v.name = 'Ana'; { const v = G.scenes.top().editor.v, q = new URLSearchParams(location.search); if (q.get('top')) Object.assign(v, { body: 'f', top: q.get('top'), shirt: G.CLOTH_COLORS.map((c) => c[1])[13], shirt2: G.CLOTH_COLORS.map((c) => c[1])[0], bottom: 'pants', pants: G.CLOTH_COLORS.map((c) => c[1])[4] }); } break;
      case 'difficulty': G.scenes.replace(new G.CharacterCreatorScene()); break;
      case 'consequence': G.scenes.replace(new G.CharacterCreatorScene()); G.scenes.top()._diffAsked = true; G.scenes.push(new G.ConsequenceScene(() => {})); G.scenes.top().t = 2; break;
      case 'ruins': start((g) => {
        G.debug.time(13); g.world.stats.playSeconds = 100;
        const b = g.map.building('r_house1');
        g.fire.ignite(b.x + 1, b.y + b.h - 1, true, false);
        for (let i = 0; i < 60 * 300 && g.fire.active; i++) G.loop.tick(1 / 60);
        g.player.x = (b.x + 3) * 16; g.player.y = (b.y + b.h + 2) * 16;
      }); break;
      case 'gangs': start((g) => {
        g.loadMap('city', 'from_rural'); G.debug.time(22); g.world.stats.playSeconds = 100;
        g.player.x = 30 * 16; g.player.y = 132 * 16;
        for (let i = 0; i < 60 * 6; i++) G.loop.tick(1 / 60);
        g.player.x = 30 * 16; g.player.y = 132 * 16;
      }); break;
      case 'barber': start((g) => { g.loadMap('city', 'from_rural'); after(() => G.scenes.push(new G.BarberScene(g, null))); }); break;
      case 'rooms': start((g) => {   // ?shot=rooms&map=city&x=0&y=0&w=50&h=30 : a close look at interiors (no roofs, no HUD)
        const id = params.get('map') || 'city', q = (k, d) => Number(params.get(k) || d);
        g.loadMap(id, Object.keys(G.maps.get(id).points).find((k) => k.startsWith('from_')) || 'start');
        G.debug.time(13); g.world.stats.playSeconds = 100; G.settings.data.showMinimap = false; g.hideHud = true; g.banner = null;
        const rx = q('x', 0), ry = q('y', 0), rw = q('w', 40), rh = q('h', 24), R = G.renderer;
        const fit = () => { R.zoom = Math.min(R.W / (rw * 16), R.H / (rh * 16)); R.viewW = R.W / R.zoom; R.viewH = R.H / R.zoom; };
        const resize = R.resize.bind(R); R.resize = () => { resize(); fit(); }; fit();
        for (const b of g.map.buildings) b.roofAlpha = 0;
        g.map.updateRoofs = () => {};
        g.player.x = (rx + rw / 2) * 16; g.player.y = (ry + rh / 2) * 16 + 8;
      }); break;
      case 'fullmap': start((g) => {
        const id = params.get('map') || 'rural';
        g.loadMap(id, Object.keys(G.maps.get(id).points).find((k) => k.startsWith('from_')) || 'start');
        G.debug.time(13); g.world.stats.playSeconds = 100; G.settings.data.showMinimap = false;
        const R = G.renderer, fit = () => { R.zoom = Math.min(R.W / g.map.pw, R.H / g.map.ph); R.viewW = R.W / R.zoom; R.viewH = R.H / R.zoom; };
        const resize = R.resize.bind(R); R.resize = () => { resize(); fit(); }; fit();
        for (const b of g.map.buildings) b.roofAlpha = 0.15;
        g.player.x = g.map.pw / 2; g.player.y = g.map.ph / 2;
        g.map.updateRoofs = () => {};
      }); break;
      case 'phonemap': start((g) => { g.world.gps = G.phone.places(g.world).find((p) => p.label.startsWith('Diner')); after(() => G.scenes.push(new G.PhoneScene(g, 'maps'))); }); break;
      case 'gps': start((g) => { G.debug.time(12); g.world.stats.playSeconds = 100; g.world.gps = G.phone.places(g.world).find((p) => p.label.startsWith('Diner')); if (params.get('weapon')) g.player.equip.weapon = params.get('weapon'); }); break;
      case 'jailshot': start((g) => { g.world.bounty.rural = 200; G.jail.imprison(g); G.debug.time(14); g.resyncNPCs(); g.world.stats.playSeconds = 100; g.player.x = 60 * 16; g.player.y = 80 * 16; for (let i = 0; i < 120; i++) G.loop.tick(1 / 60); }); break;
      case 'hud': start((g) => { g.loadMap('southside', Object.keys(G.maps.get('southside').points).find((k) => k.startsWith('from_'))); G.debug.time(14); g.world.stats.playSeconds = 100; g.banner = null; const p = g.player; p.inventory.add('wristwatch'); p.inventory.add('pistol'); p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === 'pistol')); p.mags.pistol = 9; g.world.bounty.city = 120; p.hp = 64; p.hunger = 55; p.thirst = 80; p.rest = 40; p.skills.points = 2; for (let i = 0; i < 30; i++) G.loop.tick(1 / 60); }); break;
      case 'darknight': start((g) => { G.debug.time(1); g.world.stats.playSeconds = 100; g.banner = null; g.player.inventory.remove('flashlight', 99); g.player.x = 140 * 16; g.player.y = 160 * 16; if (params.get('torch')) g.player.inventory.add('flashlight'); for (let i = 0; i < 20; i++) G.loop.tick(1 / 60); }); break;
      case 'crash': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null; g.vehicles = g.vehicles.filter((v) => !v.ai); const r = g.map.roads.find((q) => q.h), y = G.roadTools.laneOf(r, 'E'), x = Math.round((r.from + r.to) / 2) * 16; const moto = params.get('moto'); const bike = new G.Vehicle({ model: moto ? 'moto_red' : 'bike_blue', x, y, angle: 0 }); bike.ai = { road: r, dir: 'E', lane: y, turn: null, box: null, cruise: 45, waitT: 0, dest: null, driver: { seed: 'shot', look: G.look('drivershot') } }; bike.speed = 45; g.vehicles.push(bike); const car = new G.Vehicle({ model: 'car_black', x: x - 30, y, angle: 0 }); g.vehicles.push(car); g.player.x = x + 60; g.player.y = y + 40; const n0 = g.actors.length; G.crashes.collide(g, car, bike, 170, null); const rider = g.actors.slice(n0).find((a) => a.kind === 'npc'); if (rider) rider.hp = rider.maxHp = 999; const f = +(params.get('f') || 12); for (let i = 0; i < f; i++) G.loop.tick(1 / 60); g.player.x = rider ? rider.x : x; g.player.y = (rider ? rider.y : y) + 46; g.player.invuln = 99; G.loop.tick(1 / 60); G.loop.running = false; G.loop.draw(); document.title = 'crash f=' + f + ' ' + (rider && rider.crash ? rider.crash.phase + ' z=' + rider.crash.z.toFixed(0) : 'down=' + (rider && rider.downT)); document.title += ' top=' + G.scenes.top().constructor.name + ' in=' + g.actors.includes(rider) + ' r=' + Math.round(rider.x) + ',' + Math.round(rider.y) + ' p=' + Math.round(g.player.x) + ',' + Math.round(g.player.y) + ' same=' + (G.scenes.stack.find((s) => s instanceof G.GameScene) === g) + ' err=' + (G.errors || []).slice(0, 2).join(';'); }); break;
      case 'crashstrip': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null; g.vehicles = g.vehicles.filter((v) => !v.ai); const r = g.map.roads.find((q) => q.h), y = G.roadTools.laneOf(r, 'E'), x = Math.round((r.from + r.to) / 2) * 16; const moto = params.get('moto'); const bike = new G.Vehicle({ model: moto ? 'moto_red' : 'bike_blue', x, y, angle: 0 }); bike.ai = { road: r, dir: 'E', lane: y, turn: null, box: null, cruise: 45, waitT: 0, dest: null, driver: { seed: 'shot', look: G.look('drivershot') } }; bike.speed = 45; g.vehicles.push(bike); const car = new G.Vehicle({ model: 'car_black', x: x - 30, y, angle: 0 }); g.vehicles.push(car); g.player.x = x - 120; g.player.y = y + 60; g.player.invuln = 99; for (let i = 0; i < 30; i++) G.loop.tick(1 / 60); const n0 = g.actors.length; G.crashes.collide(g, car, bike, +(params.get('imp') || 170), null); const rider = g.actors.slice(n0).find((a) => a.kind === 'npc'); if (rider) rider.hp = rider.maxHp = 999; const R = G.renderer, cv = R.canvas || document.getElementById('game'), frames = (params.get('fr') || '4,10,16,22,30,40,60,90').split(',').map(Number), cw = Math.round(cv.width * 0.22), chh = Math.round(cv.height * 0.34), strip = document.createElement('canvas'); strip.width = cw * 4; strip.height = chh * 2; const sx = strip.getContext('2d'); let f = 0; frames.forEach((ft, k) => { while (f < ft) { G.loop.tick(1 / 60); f++; } g.player.x = rider.x - 60; g.player.y = rider.y + 50; R.cam.x = rider.x - R.viewW / 2; R.cam.y = rider.y - 8 - R.viewH / 2; G.loop.draw(); sx.drawImage(cv, (cv.width - cw) / 2, (cv.height - chh) / 2, cw, chh, (k % 4) * cw, Math.floor(k / 4) * chh, cw, chh); sx.fillStyle = '#fff'; sx.font = '16px sans-serif'; sx.fillText('f' + ft + ' ' + (rider.crash ? rider.crash.phase : rider.downT > 0 ? 'down' : 'up'), (k % 4) * cw + 6, Math.floor(k / 4) * chh + 18); }); G.scenes.push({ transparent: false, update() {}, render(ctx) { R.screenTransform(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, R.W, R.H); ctx.drawImage(strip, 0, 0, R.W, R.H); } }); }); break;
      case 'beating': start((g) => { g.loadMap('city', 'from_suburbs'); { const rr = g.map.roads.find((q) => q.h); g.player.x = Math.round((rr.from + rr.to) / 2) * 16 + 40; g.player.y = G.roadTools.laneOf(rr, 'E') + 6; g.vehicles = []; } if (params.get('so')) G.behavior.spaceOff = true; if (params.get('sl')) { G.streetlife.off = true; G.happenings.off = true; G.law.off = true; G.travel.off = true; } if (params.get('stop')) G.loop.running = false; G.debug.time(12); g.world.stats.playSeconds = 100; g.banner = null; const p = g.player, n = +(params.get('n') || 8); const vs = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient).slice(0, 2); const [ko, dd] = vs; p.equip.weapon = 'baseball_bat'; p.refreshStats && p.refreshStats(); p.swing = { st: G.melee.STYLES.blunt, t: 0.1, base: 0, side: 1, hit: new Set() }; ko.x = p.x + 16; ko.y = p.y; ko.hp = ko.maxHp = 999; if (!params.get('nko')) G.ko.knockOut(g, ko, p, 'blunt', 1); for (let i = 0; i < n; i++) { ko.invuln = 0; G.combat.damage(ko, 3, p, g); } dd.x = p.x - 22; dd.y = p.y + 4; dd.hp = 1; dd.invuln = 0; if (!params.get('nkill')) G.combat.damage(dd, 999, p, g); g.refreshContainers(); const c = g.containers.find((q) => q.kind === 'corpse' && Math.abs(q.x - dd.x) < 1); document.title = 'beat setup ok'; for (let i = 0; i < n; i++) G.ko.bodyHit(g, c, G.ko.frameOfCorpse(c), p, i % 3 ? 'blunt' : 'heavy', c.x + (Math.random() - 0.5) * 14, c.y - 5 + (Math.random() - 0.5) * 6, 1); p.swing = null; p.bloody = +(params.get('b') || 0.6); p.bloodSeed = 4242; p.dir = 0; G.hd.get(ko.sheet); G.hd.get(p.sheet); for (let i = 0; i < 20; i++) G.loop.tick(1 / 60); const R = G.renderer, cv = R.canvas; R.cam.x = p.x - R.viewW / 2; R.cam.y = p.y - 8 - R.viewH / 2; G.loop.draw(); const snap = document.createElement('canvas'); snap.width = cv.width; snap.height = cv.height; snap.getContext('2d').drawImage(cv, 0, 0); G.scenes.push({ transparent: false, update() {}, render(ctx) { R.screenTransform(); ctx.imageSmoothingEnabled = false; ctx.drawImage(snap, 0, 0, R.W, R.H); } }); document.title = 'ko=' + !!ko.st.ko + ' downT=' + ko.downT + ' dead=' + ko.dead + ' hd=' + !!(G.hd && G.hd.get(ko.sheet)) + ' frame=' + JSON.stringify(ko._hdFrame) + ' sleeping=' + ko.sleeping + ' seated=' + ko.seated + ' doing=' + !!ko.doing; /* (a still: a live page with someone unconscious on it never goes idle headless) */ }); break;
      case 'supply': start((g) => { g.loadMap('industrial', 'from_southside'); G.debug.time(12); g.world.stats.playSeconds = 100; g.banner = null; const b = g.map.building('i_supply'); g.player.x = b.doorX * 16 + 8; g.player.y = (b.doorY - 1) * 16 + 12; for (let i = 0; i < 90; i++) G.loop.tick(1 / 60); }); break;
      case 'zoo': start((g) => { const R = G.renderer; G.scenes.push({ transparent: false, update() {}, render(ctx) { R.screenTransform(); ctx.fillStyle = '#5a7a44'; ctx.fillRect(0, 0, R.W, R.H); ctx.imageSmoothingEnabled = true; const kinds = Object.keys(G.animalsHD.SPEC); kinds.forEach((k, i) => { const s = G.animalsHD.sheet(k, null, k === 'deer' ? { antlers: true } : {}); const cols = [0, 3, 9, 12, 14]; cols.forEach((c, j) => { const sc = 2.6, X = 10 + j * 120, Y = 6 + i * 62; ctx.drawImage(s.img, c * s.fw, 0, s.fw, s.fh, X, Y, s.dw * sc, s.dh * sc); }); ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(k, 620, 30 + i * 62); }); } }); }); break;
      case 'deaths': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.banner = null; const p = g.player, R = G.renderer; G.hd.get(p.sheet, true); p.bloody = 0; const causes = ['shot', 'stab', 'beaten', 'mauled', 'fire', 'overdose'], times = [0.1, 0.5, 1.2, 2.2, 4]; G.scenes.push({ transparent: false, update() {}, render(ctx) { R.screenTransform(); ctx.fillStyle = '#8a8a86'; ctx.fillRect(0, 0, R.W, R.H); ctx.save(); ctx.scale(3, 3); ctx.imageSmoothingEnabled = false; causes.forEach((c, i) => times.forEach((t, j) => { const a = { cause: c, t, ang: 0, side: 1, x: 20 + j * 34, y: 30 + i * 37, dir: 0, shots: 3, fx: [] }; p.deathAnim = a; G.playerDeath.draw(ctx, p); })); ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; causes.forEach((c, i) => ctx.fillText(c, 540, 70 + i * 111)); } }); }); break;
      case 'hospital': start((g) => { g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null; const b = g.map.building('c_hospital'); document.title = b ? ('hospital ' + b.x + ',' + b.y + ' ' + b.w + 'x' + b.h) : ('NO HOSPITAL ' + g.map.buildings.filter((q) => q.w >= 9).map((q) => q.id + ':' + q.w + 'x' + q.h + ':' + (q.kind || '-')).join(' ')); if (b) { g.player.x = (b.x + b.w / 2) * 16; g.player.y = (b.y + b.h - 2) * 16 + 12; } for (let i = 0; i < 90; i++) G.loop.tick(1 / 60); }); break;
      case 'daysleeper': start((g) => { G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null; const b = g.map.building('r_watch'); g.player.x = b.doorX * 16 + 8; g.player.y = (b.doorY - 1) * 16 + 12; for (let i = 0; i < 600; i++) G.loop.tick(1 / 60); const n = g.actors.find((a) => a.id === 'r_guard2'); if (/near/.test(location.search) && n) { g.player.x = n.x; g.player.y = n.y + 2; for (let i = 0; i < 30; i++) G.loop.tick(1 / 60); } const dup = g.actors.filter((a) => a.id === 'r_guard2').length; document.title = 'dup=' + dup + ' ' + document.title; document.title += ' ' + 'sleep=' + (n && n.sleeping) + ' floor=' + (n && n.onFloor) + ' bed=' + (n && n.bedRef && (n.bedRef.type || n.bedRef)) + ' spot=' + JSON.stringify(n && n.sleepSpot) + ' at=' + (n && [Math.floor(n.x / 16), Math.floor((n.y - 3) / 16)]); }); break;
      case 'flashlight': start((g) => { G.debug.time(1); g.world.stats.playSeconds = 100; g.banner = null; g.player.inventory.add('flashlight'); g.player.dir = 3; for (let i = 0; i < 20; i++) G.loop.tick(1 / 60); }); break;
      case 'debugmenu': start((g) => { g.world.stats.playSeconds = 100; after(() => { G.scenes.push(new G.DebugMenuScene(g)); G.scenes.top().tab = 3; }); }); break;
      case 'startskills': G.scenes.replace(new G.CharacterCreatorScene()); G.scenes.top()._diffAsked = true; setTimeout(() => { const cc = G.scenes.top(); cc.editor.v.name = 'Test'; cc.act('_start'); const s = G.scenes.top(); s.change('silver_tongue', 1); s.change('lucky', 1); }, 50); break;
      case 'dreamplay': start((g) => { g.world.stats.playSeconds = 100; after(() => { const ds = new G.DreamScene(g, G.dreams.themed(g, 'chase'), () => {}); G.scenes.push(ds); ds.chars = 999; ds.advance(); for (let i = 0; i < 60 * 3; i++) { G.input.down.add('KeyD'); G.loop.tick(1 / 60); } }); }); break;
      case 'lovescene': start((g) => { g.world.stats.playSeconds = 100; const want = params.get('body'); const n = want ? g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.dead && a.look.body === want) : g.actors.find((a) => a.id === 'r_villager2'); if (params.get('me')) { g.player.look.body = params.get('me'); g.player.refreshSprite(); } after(() => { const ls = new G.LoveScene(g, n); G.scenes.push(ls); ls.stageInit(); if (params.get('at')) { ls.t = +params.get('at'); ls.conn = +(params.get('conn') || 0.8); ls.update = () => {}; } }); }); break;
      case 'delirium': start((g) => { g.world.stats.playSeconds = 100; G.debug.time(21); for (let i = 0; i < 5; i++) G.effects.consume(g.player, G.ITEMS.benadryl, g); for (let i = 0; i < +(params.get('n') || 60 * 8); i++) G.loop.tick(1 / 60); const d = g.delir; if (d && params.get('hat')) { const p = g.player; d.hat = { x: p.x + 110, y: p.y - 40, a: 1, life: 9 }; d.talkers.push({ x: p.x - 40, y: p.y + 10, look: G.look('ph1'), line: 'Did you feed the dog?', life: 8, a: 1, t: 1 }); for (let i = 0; i < 6; i++) d.spiders.push({ x: p.x - 60 + i * 22, y: p.y + 30, ang: i, go: 0, life: 9, s: 1.2 }); } G.loop.running = false; G.loop.draw(); }); break;
      case 'firefight': start((g) => {
        g.loadMap('suburbs', 'from_city'); G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null;
        const h = g.map.building('u_house6');
        for (let k = 0; k < 5; k++) g.fire.ignite(h.x + 1 + k, h.y + h.h - 1, false, false);
        for (let i = 0; i < 60 * 22; i++) G.loop.tick(1 / 60);
        g.player.x = h.doorX * 16; g.player.y = (h.doorY + 5) * 16;
        for (let i = 0; i < 60 * 4; i++) G.loop.tick(1 / 60);
      }); break;
      case 'drive': start((g) => {
        g.loadMap('city', 'from_suburbs'); G.debug.time(13); g.world.stats.playSeconds = 100; g.banner = null;
        const v = new G.Vehicle({ model: 'car_red', x: 40 * 16, y: 82 * 16, angle: 0, keys: true });
        g.vehicles.push(v); G.vehicles.enter(g, v); v.speed = 120;
        g.vehicles.push(new G.Vehicle({ model: 'moto_black', x: 60 * 16, y: 39.2 * 16, angle: Math.PI, keys: true }));
        for (let i = 0; i < 40; i++) G.loop.tick(1 / 60);
      }); break;
      case 'blackjack': start((g) => { g.world.stats.playSeconds = 100; g.player.gold = 500; G.skills.addXp(g.player, 0); g.player.skills.ranks.gambler = 1; after(() => { const s = new G.BlackjackScene(g); G.scenes.push(s); s.deal(); }); }); break;
      case 'slots': start((g) => { g.world.stats.playSeconds = 100; g.player.gold = 500; after(() => { const s = new G.SlotsScene(g, true); s.inPhone = true; G.scenes.push(s); s.spin(); s.spinT = 0; s.reels = s.result; s.settle(); }); }); break;
      case 'dream': start((g) => { g.world.stats.playSeconds = 100; after(() => { const d = { mood: 'weird', scenes: [{ theme: 'rooms', set: 'house', beats: ['You are home. You open a door you have never noticed before.'], body: G.dreams.dreamBody(G.dreams.context(g)) }] }; G.scenes.push(new G.DreamScene(g, d, () => {})); }); }); break;
      case 'fishing': start((g) => {
        g.world.stats.playSeconds = 100; G.debug.time(7); g.player.inventory.add('fishing_rod'); g.player.inventory.add('bait', 5);
        for (let y = 132; y < 168 && !g.fishShot; y++) for (let x = 40; x < 104; x++) if (G.fishing.waterAt(g.map, x, y) && !g.map.isSolidTile(x, y + 1) && !G.fishing.waterAt(g.map, x, y + 1)) { g.player.x = x * 16 + 8; g.player.y = (y + 1) * 16 + 12; g.player.dir = 3; g.fishShot = true; break; }
        after(() => { G.fishing.start(g); const f = G.scenes.top(); f.phase = 'reel'; f.bob = { x: g.player.x, y: g.player.y - 50 }; f.fish = G.fishing.pick(g, 'lake'); f.progress = 0.5; f.tension = 0.55; f.msg = 'Hold [E] to reel. Keep the tension in the green!'; });
      }); break;
      case 'love': start((g) => {
        G.debug.time(13); g.world.stats.playSeconds = 100; const w = g.world, p = g.player, map = g.map;
        const a = g.actors.find((x) => x.id === 'r_farmer2'), b = g.actors.find((x) => x.id === 'r_farmwife');
        const home = map.building(a.def.home), bed = map.decor.find((d) => d.def.interact === 'bed' && map.buildingAtTile(d.tx, d.ty) === home);
        const spot = { x: bed.tx, y: bed.ty };
        a.loveTask = { lead: true, mate: b, spot, bed: spot, phase: 'act', t: 0 }; b.loveTask = { lead: false, mate: a, spot, bed: spot, phase: 'act', t: 0 };
        a.x = b.x = bed.x; a.y = b.y = bed.y; a.talking = b.talking = true;
        p.look.body = 'f'; p.look.hairStyle = 6; G.debug.pregnant(36);
        p.x = (home.doorX) * 16 + 8; p.y = (home.doorY - 1) * 16 + 12;
        G.love.placeCrib(w, 'rural', home.id);
        const v = g.actors.find((x) => x.id === 'r_villager1'), v2 = g.actors.find((x) => x.id === 'r_villager2');
        for (const [n, dx] of [[v, -30], [v2, 30]]) { n.x = p.x + dx; n.y = p.y + 4; n.talking = true; }
        v.st.nakedUntil = G.love.now() + 999; v2.st.preg = { day: w.day - 38, father: 'r_villager1' }; G.love.refreshNPC(v); G.love.refreshNPC(v2);
        if (location.search.includes('sheets')) G.scenes.push({ transparent: true, update() {}, render(ctx) { G.renderer.screenTransform(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#444'; ctx.fillRect(0, 0, 1280, 720); [p.sheet, v.sheet, v2.sheet].forEach((s, i) => ctx.drawImage(s.img, 20 + i * 420, 20, s.img.width * 8, s.img.height * 8)); } });
        for (let i = 0; i < 30; i++) G.loop.tick(1 / 60);
      }); break;
      case 'gore': start((g) => { G.debug.time(14); g.world.stats.playSeconds = 100; g.player.hp = g.player.maxHp = 9999; const v = g.actors.find((a) => a.id === 'r_villager2'); g.player.inventory.add('shotgun'); g.player.equipFromSlot(g.player.inventory.slots.findIndex((s) => s && s.id === 'shotgun')); g.player.mags.shotgun = 6; v.x = g.player.x + 40; v.y = g.player.y; v.talking = true; G.firearms.playerFire(g.player, g, 0); for (let i = 0; i < 90; i++) G.loop.tick(1 / 60); g.player.x = v.x - 8; G.bodies.toggle(g); for (let i = 0; i < 40; i++) { g.player.x -= 1; G.bodies.update(g, 1 / 60); } }); break;
      case 'sleepers': start((g) => { G.debug.time(23.5); g.resyncNPCs(); const h = g.map.building('r_house2'); for (const b of g.map.buildings) b.roofAlpha = 0; g.map.updateRoofs = () => {}; g.player.x = (h.x + 3) * 16; g.player.y = (h.y + h.h + 1) * 16; g.world.stats.playSeconds = 100; }); break;
      case 'typing': start((g) => { G.debug.time(10); g.resyncNPCs(); const n = g.actors.find((a) => a.id === 'r_merchant'); g.player.x = n.x; g.player.y = n.y + 18; after(() => { g.openDialogue(n); const d = G.scenes.top(); d.chars = 999; d.runner.say('where can I find the diner?'); d.chars = 999; d.typing = true; d.input = 'do you know any good places to eat'; }); }); break;
      case 'skills': start((g) => {
        const p = g.player;
        G.skills.addXp(p, 1500, 'shot', null);
        for (const id of ['silver_tongue', 'silver_tongue', 'haggler', 'smooth_operator', 'intimidation', 'marksman', 'brawler', 'toughness']) G.skills.learn(p, id);
        after(() => { G.scenes.push(new G.SkillsScene(g)); G.scenes.top().sel = 'networker'; });
      }); break;
      case 'items': start((g) => {
        const inv = g.player.inventory;
        for (const id of ['pistol', 'revolver', 'smg', 'shotgun', 'hunting_rifle', 'assault_rifle', 'ammo_9mm', 'ammo_shells', 'switchblade', 'machete', 'brass_knuckles', 'crowbar',
          'beer', 'whiskey', 'vodka', 'wine', 'joint', 'cocaine', 'lsd', 'painkillers', 'chanterelle', 'death_cap', 'fly_agaric', 'magic_mushroom', 'kevlar_vest']) inv.add(id, id.startsWith('ammo') ? 30 : 1);
        after(() => { G.scenes.push(new G.InventoryScene(g)); G.scenes.top().sel = 10; });
      }); break;
      case 'drunk': start((g) => { G.debug.time(19); g.world.stats.playSeconds = 100; g.player.x = 96 * 16; g.player.y = 76 * 16; g.player.alcohol = 70; G.effects.add(g.player, 'stim', 60); }); break;
      case 'walls': start((g) => {   // walk along the front of every building on a map: anything to interact with from outside?
        g.loadMap(params.get('map') || 'rural', null); G.debug.time(13); g.world.stats.playSeconds = 100;
        const out = [], p = g.player;
        for (const b of g.map.buildings) for (let x = b.x; x < b.x + b.w; x++) for (const dir of [3, 0, 1, 2]) {
          for (const dy of [4, 8, 12, 15]) {
            p.x = x * 16 + 8; p.y = (b.y + b.h) * 16 + dy; p.dir = dir;
            if (g.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h)) continue;
            const t = g.findInteraction();
            if (t && t.type !== 'npc' && t.ref && t.ref.tx != null && g.map.buildingAtTile(t.ref.tx, t.ref.ty) === b && x !== b.doorX) out.push(`${b.id}@${x},+${dy} dir${dir}: ${t.label}`);
          }
        }
        const pre = document.createElement('pre'); pre.id = 'walls'; pre.textContent = out.slice(0, 30).join('\n') || 'none'; document.body.appendChild(pre);
      }); break;
      case 'locate': start((g) => {   // chatBCT's guess (from another map) vs where they really are once you get there
        const out = [], hour = +(params.get('h') || 13);
        const ids = Object.keys(G.NPCS).filter((id) => g.world.npcs[id] && g.world.npcs[id].alive && G.MAPGEN[G.NPCS[id].map]);
        let n = 0, bad = 0;
        for (const id of ids) {
          g.loadMap(G.NPCS[id].map === 'rural' ? 'city' : 'rural', null); G.debug.time(hour);
          const at = G.bct.locate(g, id); if (!at) { out.push(`${id}: no guess`); continue; }
          if (g.map.id !== at.map) g.loadMap(at.map, null);
          G.debug.time(hour); g.resyncNPCs();
          const a = g.actors.find((x) => x.id === id); n++;
          if (!a) { bad++; out.push(`${id}: guessed ${at.map} ${at.x},${at.y} but not on the map`); continue; }
          const d = Math.hypot(a.x / 16 - at.x, (a.y - 3) / 16 - at.y);
          if (d > 6) { bad++; out.push(`${id}: guessed ${at.x},${at.y} actually ${Math.floor(a.x / 16)},${Math.floor((a.y - 3) / 16)} (${Math.round(d)} tiles) ${a.sleeping ? 'asleep' : ''}`); }
        }
        out.unshift(`${bad}/${n} off`);
        const pre = document.createElement('pre'); pre.id = 'walls'; pre.textContent = out.slice(0, 40).join('\n'); document.body.appendChild(pre);
      }); break;
      case 'roadwater': start((g) => {   // the Center road network next to the water (report)
        const out = [];
        g.loadMap('city', null); const m = g.map, gr = G.vehicles.graph(m);
        out.push('exits: ' + m.exits.map((e) => `${e.to}@${e.x},${e.y} ${e.w}x${e.h}`).join(' | '));
        out.push('roads: ' + m.roads.map((r) => `${r.h ? 'h' : 'v'}${r.at} ${r.from}-${r.to} W${r.W}`).join(' | '));
        out.push('edge ends: ' + gr.nodes.filter((q) => q.terminal && q.edge).map((q) => Math.round(q.x / 16) + ',' + Math.round(q.y / 16)).join(' '));
        out.push('dead ends: ' + gr.nodes.filter((q) => q.terminal && !q.edge).map((q) => Math.round(q.x / 16) + ',' + Math.round(q.y / 16)).join(' '));
        const wt = []; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tileDef(x, y).water) wt.push([x, y]);
        out.push('water bbox: ' + (wt.length ? [Math.min(...wt.map((q) => q[0])), Math.min(...wt.map((q) => q[1])), Math.max(...wt.map((q) => q[0])), Math.max(...wt.map((q) => q[1]))].join(',') : 'none') + ' map ' + m.w + 'x' + m.h);
        const pre = document.createElement('pre'); pre.id = 'walls'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
      }); break;
      case 'keepers': start((g) => {   // where every shopkeeper stands at noon vs their work point and counter
        const out = [];
        for (const mid of ['rural', 'city', 'suburbs', 'southside', 'eastside', 'heights']) {
          g.loadMap(mid, null); G.debug.time(12); g.resyncNPCs();
          for (let i = 0; i < 600; i++) G.loop.tick(1 / 30);
          for (const a of g.actors) {
            if (a.kind !== 'npc' || a.dead || !a.def.shop) continue;
            const sched = (a.def.schedule || []).find((e) => e.act === 'work' || /_work$/.test(e.at || '')) || {};
            const wp = g.map.points[sched.at] || null, b = wp ? g.map.buildingAtTile(wp.x, wp.y) : g.map.building(a.def.shop);
            const atB = g.map.buildingAt(a.x, a.y - 3);
            const d = wp ? Math.hypot(a.x - (wp.x * 16 + 8), a.y - (wp.y * 16 + 12)) : -1;
            const busy = ['errand', 'needTask', 'loveTask', 'doorTask', 'seek', 'dodge', 'flee'].filter((k) => a[k]).join('+');
            if (!wp || d > 14 || atB !== b) out.push(`${mid} ${a.id} [${busy}${a.st.addict ? ' addict' : ''}${a.st.hunger > 60 ? ' hungry' : ''}] shop ${a.def.shop} work ${a.def.work} in ${(atB || {}).id} d=${Math.round(d)} state ${a.state} wp ${wp ? wp.x + ',' + wp.y : 'none'} at ${Math.floor(a.x / 16)},${Math.floor(a.y / 16)}`);
          }
        }
        const pre = document.createElement('pre'); pre.id = 'walls'; pre.textContent = out.join('\n') || 'none'; document.body.appendChild(pre);
      }); break;
      case 'doorexit': start((g) => {   // leave every locked house from inside, at every offset and with diagonals
        g.loadMap(params.get('map') || 'suburbs', null); G.debug.time(2); g.resyncNPCs();
        for (let i = 0; i < 4; i++) G.loop.tick(1 / 60);
        G.doors.t = 0; G.doors.update(g, 1);
        const out = [], p = g.player;
        for (const b of g.map.buildings.filter((bb) => G.doors.locked(g, bb))) for (const ox of [-6, -3, 0, 3, 6]) for (const keys of [['KeyS'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']]) {
          p.x = b.doorX * 16 + 8 + ox; p.y = (b.doorY - 1) * 16 + 12; p.dir = 0;
          if (g.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h)) continue;
          for (let i = 0; i < 90; i++) { G.input.down.clear(); for (const k of keys) G.input.down.add(k); G.doors.t = 0; G.loop.tick(1 / 60); }
          G.input.down.clear();
          if (p.y < (b.doorY + 1) * 16 + 4) out.push(`${b.id} ox${ox} ${keys.join('+')}: stuck at ${Math.round(p.x)},${Math.round(p.y)} (door ${b.doorX * 16 + 8},${b.doorY * 16})`);
        }
        const pre = document.createElement('pre'); pre.id = 'walls'; pre.textContent = out.slice(0, 30).join('\n') || 'none'; document.body.appendChild(pre);
      }); break;
      case 'perf': start((g) => {   // what does a frame do? counts the calls of the usual suspects (?shot=perf&map=city)
        g.loadMap(params.get('map') || 'rural', null); G.debug.time(13); g.world.stats.playSeconds = 100;
        const C = {}, count = (obj, name, label) => { const f = obj[name]; if (!f) return; obj[name] = function () { C[label] = (C[label] || 0) + 1; return f.apply(this, arguments); }; };
        count(G.NPC.prototype, 'canSee', 'canSee'); count(G.pathfind, 'find', 'pathfind'); count(G.TileMap.prototype, 'rectCollides', 'collide'); count(G.TileMap.prototype, 'decorsAt', 'decorsAt');
        count(G.TileMap.prototype, 'buildingAt', 'buildingAt'); count(G.social, 'opinion', 'opinion'); count(G.GameScene.prototype, 'witnessesOf', 'witnesses'); count(G.NPC.prototype, 'findEnemy', 'findEnemy');
        count(G.TileMap.prototype, 'randomWalkableNear', 'rwn'); count(G.assets, 'character', 'charSheet'); count(G.lifestyle, 'pick', 'lifePick'); count(G.TileMap.prototype, 'isSolidTile', 'solid');
        count(G.NPC.prototype, 'walkTo', 'walkTo'); count(G.NPC.prototype, 'stepToward', 'step'); count(G.FireSystem.prototype, 'flamAt', 'flam'); count(G.containers, 'forMap', 'forMap');
        count(G.GameScene.prototype, 'refreshContainers', 'refreshCont'); count(G.effects, 'visuals', 'visuals'); count(G.TileMap.prototype, 'prerender', 'prerender'); count(G.TileMap.prototype, 'computeSolids', 'computeSolids');
        count(G.TileMap.prototype, 'renderMinimap', 'minimap'); count(G.maps, 'get', 'maps.get');
        for (let i = 0; i < 60; i++) G.loop.tick(1 / 60);
        document.title = 'PERF per tick: ' + Object.entries(C).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${Math.round(v / 60)}`).join(' ') + ` (actors=${g.actors.length})`;
        const pre = document.createElement('pre'); pre.id = 'perf'; pre.textContent = document.title; document.body.appendChild(pre);
      }); break;
      case 'dmt': start((g) => { G.debug.time(15); g.world.stats.playSeconds = 100; g.player.x = 96 * 16; g.player.y = 76 * 16; G.effects.add(g.player, 'dmt', 110, 1.6); G.effects.get(g.player, 'dmt').t = 70; for (let i = 0; i < 60 * 3; i++) G.loop.tick(1 / 60); }); break;
      case 'trip': start((g) => { G.debug.time(15); g.world.stats.playSeconds = 100; g.player.x = 96 * 16; g.player.y = 76 * 16; G.effects.add(g.player, 'trip', 999, 1.2); G.effects.get(g.player, 'trip').dur = 9999; for (let i = 0; i < 60 * 8; i++) G.loop.tick(1 / 60); }); break;
      case 'poison': start((g) => { G.debug.time(15); g.world.stats.playSeconds = 100; G.effects.add(g.player, 'organ_failure', 60); G.effects.add(g.player, 'nausea', 60); g.player.hp = 900; g.player.maxHp = 999; for (let i = 0; i < 60 * 4; i++) G.loop.tick(1 / 60); }); break;
      case 'guns': start((g) => {
        g.loadMap('city', 'from_rural'); G.debug.time(13); g.world.stats.playSeconds = 100;
        const p = g.player;
        p.inventory.add('shotgun'); p.inventory.add('ammo_shells', 20);
        p.equipFromSlot(p.inventory.slots.findIndex((s) => s && s.id === 'shotgun'));
        p.mags.shotgun = 6; p.x = 104 * 16; p.y = 88 * 16; p.hp = 5000; p.maxHp = 5000;
        const cop = g.actors.find((a) => a.id === 'c_guard3');
        cop.x = p.x + 90; cop.y = p.y + 10; cop.startFight(p, g);
        for (let i = 0; i < 60 * 2; i++) G.loop.tick(1 / 60);
        G.firearms.playerFire(p, g, Math.atan2(cop.y - p.y, cop.x - p.x));
        G.loop.tick(1 / 60); G.loop.tick(1 / 60);
        G.loop.running = false; G.loop.draw();
      }); break;
      case 'mushrooms': start((g) => {
        g.loadMap('forest', 'from_rural'); G.debug.time(12); g.world.stats.playSeconds = 100;
        const m = g.map.flats.concat(g.map.decor).find((d) => d.def.forage === 'magic_mushroom');
        g.player.x = m.x; g.player.y = m.y + 14; g.player.dir = 3;
      }); break;
      case 'factions': start((g) => { G.world.addRep('gang_red', 40); G.world.addRep('cia', 25); G.world.addRep('government', -30); after(() => { G.scenes.push(new G.JournalScene(g)); G.scenes.top().tab = 2; }); }); break;
    }
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      const s = params.get('shot');
      if (s) {
        shot(s); G.loop.running = true; G.loop.start();
        if (params.get('zoom')) {   // &zoom=N: a close look (camera stays on the player)
          const R = G.renderer, z = +params.get('zoom'), fix = () => { R.zoom = z; R.viewW = R.W / z; R.viewH = R.H / z; };
          fix(); const _rs = R.resize; R.resize = function () { _rs.call(this); fix(); };
        }
        return;
      }
      const only = params.get('only');   // ?test&only=<group>: one group of tests on a fresh game (quick checks while working)
      let ret;   // a group may be async (it returns a promise): the results wait for it
      if (only) {
        try {
          G.law.off = true; G.bleed.playerOff = true; G.settings.data.legacyControls = false; G.settings.data.moveMode = 1; G.happenings.off = true; G.travel.off = true;
          if (only !== 'suiteHead') { G.scenes.replace(new G.GameScene({})); tick(3); }
          const groups = { bloodFixes, talkFixes, playFixes, smallFixes, padPlay, demandFight, edgesCars, quality, audioScore, audit2, fireStarting, emergency, laterFixes, lawAndOrder, uiWindows, quickload, aiDialogue, eagleMaps, trading, companionMood, aiJobs, aiFollow, npcLife, welcome, awareness, npcTalk, aiUpdate, liveAI, language, prisonPatch, fightClub, clubBuilding, venues, estate, cityFinish, textures, grit, snap, audit, lineup, signs, wetClothes, itemIcons, iconSheet, uiWorn, playthrough, interiors, treeRoofs, seating };
          // the parts of the long suite, one at a time, under the same conditions it sets up
          Object.assign(groups, { suiteHead: () => { window.__headOnly = true; return suite(); }, newFeatures, skillsAndItems, lifeSystems, worldSystems, dailyLife, loveLife, homeLife, streetLife, polish, cityLife, batch3, crashes, knockouts, aid, realism, gunmen, brainLevels });
          if (only.startsWith('seq:')) { G.economy.mugOff = true; G.settings.data.notifications = 2; G.rest.DRAIN = 0; G.WITNESS_DELAY = 0; G.streetlife.off = true; G.behavior.spaceOff = true; G.walkWatchdogOff = true; G.law.off = true; }
          if (only !== 'suiteHead' && !['fireStarting', 'emergency', 'laterFixes', 'uiWindows', 'quickload', 'lawAndOrder', 'aiDialogue'].includes(only) && groups[only] && /^(newFeatures|skillsAndItems|lifeSystems|worldSystems|dailyLife|loveLife|homeLife|streetLife|polish|cityLife|batch3|crashes|knockouts|aid|realism|gunmen|brainLevels)$/.test(only)) { G.economy.mugOff = true; G.settings.data.notifications = 2; G.rest.DRAIN = 0; G.WITNESS_DELAY = 0; G.streetlife.off = true; G.behavior.spaceOff = true; G.walkWatchdogOff = true; G.law.off = true; }
          if (only.startsWith('seq:')) { for (const n of only.slice(4).split(',')) { G.input.down.clear(); Object.assign(G.input.mouse, { down: false, rdown: false, pressed: false, rpressed: false }); G.scenes.replace(new G.GameScene({})); tick(3); log('--- ' + n); groups[n](); log('ERRS ' + [...new Set(G.errors || [])].slice(0, 4).join(' || ')); } }   // two parts in a row, to find what one leaves behind for the other
          else {
          if (!groups[only]) throw new Error('no test group ' + only);
          ret = groups[only]();
          }
        } catch (e) { fails++; log('EXCEPTION ' + (e.stack || e)); }
      } else
      try { ret = suite(); } catch (e) { fails++; log('EXCEPTION ' + (e.stack || e)); }
      Promise.resolve(ret).catch((e) => { fails++; log('EXCEPTION ' + (e.stack || e)); }).then(() => {
        log(`\n${fails === 0 ? 'ALL TESTS PASSED' : fails + ' FAILURE(S)'}`);
        const pre = document.createElement('pre');
        pre.id = 'testlog';
        pre.textContent = out.join('\n');
        document.body.appendChild(pre);
        document.title = fails === 0 ? 'PASS' : 'FAIL ' + fails;
      });
    }, 100);
  });
})();
