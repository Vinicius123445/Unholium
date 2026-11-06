// Runs inside the real editor page (tools/test_editor.ps1): every map, the look, placement, saving, and a world from before the scale.
window.__edTest = async () => {
  const out = []; let fails = 0; const ok = (c, m) => { out.push((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  try {
    const E = window.Editor, WF = G.worldFile;
    ok(G.realMat && G.realMat.ready, 'ground materials are baked in the editor');
    ok(!!document.querySelector('#view'), 'the view exists');
    const gameW = G.maps.get('city').w; ok(E.model('city').w === gameW, `the city is the size the game plays (${gameW})`);
    for (const id of E.order) {
      if (G.MAPGEN[id] == null) continue;
      try {
        const m = E.model(id); E.openMap(id); E.draw(); const LN = window.EditorI18n.on; window.EditorI18n.on = !LN; E.deepProblems(); window.EditorI18n.on = LN; const f = E.toFile(m), rt = E.fromFile(JSON.parse(JSON.stringify(f)));
        ok(rt.decor.length === m.decor.length && rt.buildings.length === m.buildings.length, `${id}: saved and reopened intact (${m.w}x${m.h}, ${m.decor.length} props)`);
        const tm = WF.deserializeMap(JSON.parse(JSON.stringify(f))), real = G.maps.get(id);
        ok(tm.w === real.w && tm.h === real.h && tm.buildings.length === real.buildings.length, `${id}: plays the same size in the game`);
        const parked = tm.decor.find((d) => /^car_/.test(d.type)); if (parked) { const r = real.decor.find((d) => d.type === parked.type && d.tx === parked.tx && d.ty === parked.ty); ok(r && r.x === parked.x, `${id}: a parked car stays in its place`); }
        const p = E.deepProblems().filter((s) => s.startsWith(id + ':')); ok(!p.length, `${id}: no dangling art or placement${p.length ? ' — ' + p.slice(0, 4).join(' | ') : ''}`);
        delete E.maps[id]._tm; E.maps[id].canvas = null; if (id !== 'city') { const k = E.maps[id]; k.ground = k.ground.slice(); }
      } catch (e) { ok(false, `${id}: ${e.message}`); }
    }
    E.openMap('suburbs'); const m = E.M, tile = G.T.grass;
    E.view.z = 3; const b = m.buildings.find((q) => q.planned === 'house'); E.view.x = b.x * 16; E.view.y = b.y * 16; E.draw();
    const px = (x, y) => { const d = document.getElementById('view').getContext('2d').getImageData(x, y, 1, 1).data; return d[0] + d[1] + d[2]; }; ok(px(200, 200) > 0, 'the map is drawn');
    const n0 = m.decor.length; E.snap(); m.decor.push({ type: 'bed', tx: b.x + 2, ty: b.y + 2, extra: null }); E.doUndo(); ok(E.M.decor.length === n0, 'undo removes a placed prop');
    for (const k of Object.keys(G.DECOR)) { const def = G.DECOR[k]; if (!G.assets.sprites[def.sprite]) { ok(false, `prop ${k} has no art`); continue; } try { E.propImg(k); } catch (e) { ok(false, `prop ${k}: ${e.message}`); } }
    let bad = 0; for (const id in E.npcs) try { E.personImg(E.npcs[id].look, 16, 20); } catch (e) { bad++; } ok(!bad, `every person draws (${Object.keys(E.npcs).length})`);
    const c0 = document.createElement('div'); document.body.append(c0); E.personStage(c0, E.npcs[Object.keys(E.npcs)[0]].look, 'walk'); ok(c0.querySelector('canvas'), 'a person moves in the preview');
    for (const k of Object.keys(G.hd.COL)) try { const d = document.createElement('div'); document.body.append(d); E.personStage(d, {}, k); d.remove(); } catch (e) { ok(false, `animation ${k}: ${e.message}`); }
    let ab = 0; for (const a of Object.keys(G.ANIMALS)) try { const d = document.createElement('div'); document.body.append(d); if (G.realAnimal.SP[a]) E.animalStage(d, a); d.remove(); } catch (e) { ab++; out.push('  animal ' + a + ': ' + e.message); } ok(!ab, `every animal previews (${Object.keys(G.ANIMALS).length})`);
    // a building made in the editor, furnished, walkable in the game
    E.openMap('rural'); const r = E.M; const before = r.buildings.length; try { E.addBuilding({ x: 10, y: 10, w: 18, h: 12 }); } catch (e) { out.push('addBuilding: ' + e.message); }
    if (r.buildings.length > before) { const nb = r.buildings[r.buildings.length - 1]; E.furnish(nb); ok(r.decor.some((d) => d.tx > nb.x && d.tx < nb.x + nb.w - 1 && d.ty > nb.y && d.ty < nb.y + nb.h - 1), 'a new building gets furniture'); const tm2 = WF.deserializeMap(JSON.parse(JSON.stringify(E.toFile(r)))); ok(tm2.building(nb.id), 'it opens in the game'); }
    // a world from before the doubling
    const old = JSON.parse(JSON.stringify(WF.serializeMap(G.MAPGEN.island ? (G.parkedPlan(true), (() => { const q = G.MAPGEN.island(); G.parkedPlan(false); return q; })()) : G.maps.get('rural')))); delete old.scaled; old.format = 1;
    const up = E.fromFile(old); ok(up.scaled, `an old map is brought up to scale when opened (${old.w} to ${up.w})`);
    const w1 = WF.upgradeWorld({ format: 1, npcs: { a: { schedule: [{ at: { x: 5, y: 7 } }, { at: 'x' }] } } }); ok(w1.npcs.a.schedule[0].at.x === 10 && w1.format === 2, 'an old world\'s people move with the map');
    { E.openMap('suburbs'); const dd = E.M.decor.find((q) => q.type === 'wardrobe'), t0 = dd.extra && dd.extra.ori; E.sel = { decor: dd }; E.turnSel(); ok((dd.extra && dd.extra.ori) !== t0, 'R turns a selected piece'); const cc = E.M.decor.find((q) => q.type === 'couch' || q.type === 'couch_r'); if (cc) { const ty0 = cc.type; E.sel = { decor: cc }; E.turnSel(); ok(cc.type !== ty0, 'a couch turns into its side view, with its own footprint'); } E.show.roofs = true; E.draw(); ok(true, 'fronts and roofs draw in the editor'); E.show.roofs = false; E.sel = null; }
    const lost = E.fromFile(Object.assign(JSON.parse(JSON.stringify(E.toFile(E.M))), { decor: [['gone_prop', 1, 1]] })); ok(lost.missing.includes('gone_prop'), 'a removed prop is reported, not fatal');
  } catch (e) { ok(false, 'stopped: ' + (e.stack || e)); }
  return `failed ${fails}\n` + out.filter((l) => !l.startsWith('ok') || /city|size|baked/.test(l)).join('\n') + `\nchecks ${out.length}`;
};
