'use strict';
// HUD: health/stamina, money, clock, region, bounty, minimap, prompts, toasts, names and speech bubbles.

G.hud = {
  draw(ctx, scene) {
    const R = G.renderer, U = G.ui, w = scene.world, p = scene.player;
    R.uiTransform();
    this.drawLabels(ctx, scene);

    // vitals
    const sk = p.skills;
    U.panel(ctx, 6, 6, 128, 70);
    U.text(ctx, 'HP', 12, 12, { size: 8, color: U.colors.dim });
    U.bar(ctx, 28, 11, 100, 10, p.hp / p.maxHp, U.colors.hp, { label: `${Math.ceil(p.hp)} / ${p.maxHp}` });
    U.text(ctx, 'ST', 12, 25, { size: 8, color: U.colors.dim });
    U.bar(ctx, 28, 25, 100, 6, p.stamina / p.maxStamina, U.colors.stamina);
    U.text(ctx, 'Lv' + sk.level, 12, 34, { size: 7, color: sk.points > 0 ? '#ffd86a' : U.colors.dim, weight: sk.points > 0 ? 'bold' : 'normal' });
    U.bar(ctx, 28, 35, 100, 4, sk.xp / G.xpToNext(sk.level), '#5a8ae0');
    U.icon(ctx, 'coin', 10, 42, 0.75);
    U.text(ctx, '$' + p.gold, 24, 44, { size: 9, color: U.colors.gold });
    const wp = p.weaponItem;
    if (wp) {
      U.icon(ctx, wp.icon, 112, 41, 0.8);
      if (wp.gun) {
        const loaded = G.firearms.loaded(p, wp), spare = p.inventory.count(wp.ammo);
        U.text(ctx, p.reloadT > 0 ? 'Reloading' : `${loaded}/${wp.mag} · ${spare}`, 108, 44, { size: 8, align: 'right', color: loaded === 0 ? '#ff8a6a' : U.colors.text });
      }
    }
    // hunger and thirst (bars show how full you are)
    U.text(ctx, 'FD', 12, 52, { size: 6, color: U.colors.dim });
    U.bar(ctx, 24, 53, 46, 4, 1 - (p.hunger || 0) / 100, (p.hunger || 0) >= 85 ? '#e05a4a' : '#d8a040');
    U.text(ctx, 'H2O', 74, 52, { size: 6, color: U.colors.dim });
    U.bar(ctx, 90, 53, 38, 4, 1 - (p.thirst || 0) / 100, (p.thirst || 0) >= 85 ? '#e05a4a' : '#4a9ae0');
    const rest = G.rest.get(p);
    U.text(ctx, 'SLEEP', 12, 60, { size: 6, color: U.colors.dim });
    U.bar(ctx, 36, 61, 92, 4, rest / 100, rest < 10 ? '#e05a4a' : rest < 25 ? '#c8a0e0' : '#9a8ae0');
    if (sk.points > 0) U.text(ctx, `${sk.points} skill point${sk.points > 1 ? 's' : ''}`, 70, 78, { size: 7, align: 'center', color: '#ffd86a' });

    // status effects (alcohol, drugs, poison)
    let ey = (sk.points > 0 ? 90 : 80) + (G.phone.unread(w) && G.phone.has(p) ? 9 : 0);
    for (const e of G.effects.hudList(p)) {
      const label = e.t != null ? `${e.name} ${Math.ceil(e.t)}s` : e.name;
      const tw = U.measure(ctx, label, 8) + 10;
      ctx.fillStyle = e.bad ? 'rgba(60,14,14,0.8)' : 'rgba(15,12,20,0.75)';
      ctx.fillRect(6, ey, tw, 12);
      ctx.fillStyle = e.color;
      ctx.fillRect(6, ey, 2, 12);
      U.text(ctx, label, 11, ey + 2, { size: 8, color: e.color });
      ey += 14;
    }
    this.toastY = ey + 2;
    G.phone.drawHud(ctx, scene);
    const unread = G.phone.unread(w);
    if (unread && G.phone.has(p)) U.text(ctx, `${unread} new message${unread > 1 ? 's' : ''} [P]`, 70, sk.points > 0 ? 87 : 78, { size: 7, align: 'center', color: '#8aea7a' });

    // reload bar over the player, crosshair at the mouse
    if (p.reloadT > 0 && wp && wp.gun) {
      const s = R.worldToUI(p.x, p.y - 26), tot = G.firearms.reloadTime(p, wp);
      U.bar(ctx, s.x - 14, s.y, 28, 4, 1 - p.reloadT / tot, '#e0d070');
    }
    if (wp && wp.gun && scene.mouseSeenT > 0 && G.scenes.top() === scene) {
      const mx = G.input.mouse.ux, my = G.input.mouse.uy, sp = 3 + G.effects.spread(p) * 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.beginPath();
        ctx.moveTo(mx + ax * sp, my + ay * sp);
        ctx.lineTo(mx + ax * (sp + 4), my + ay * (sp + 4));
        ctx.stroke();
      }
    }

    // clock & region
    const W = R.uiW;
    const night = w.isNight();
    U.panel(ctx, W - 132, 6, 126, 30);
    U.text(ctx, `Day ${w.day}`, W - 126, 10, { size: 10, weight: 'bold' });
    U.text(ctx, w.timeString, W - 12, 10, { size: 10, align: 'right', color: night ? '#9ab0ff' : '#ffe39a' });
    if (!scene.map.meta.wilds) U.text(ctx, scene.map.meta.name, W - 126, 23, { size: 8, color: U.colors.dim });
    const bounty = 0;   // (no bounty on the HUD: js/game/law.js)
    let y = 40;
    const terr = G.gangWar.label(w, scene.map.id, Math.floor(p.x / 16), Math.floor((p.y - 3) / 16));
    if (terr) {
      const f = terr.owner && G.FACTIONS[terr.owner];
      U.panel(ctx, W - 132, y, 126, 31, { border: f ? f.color : U.colors.border });
      U.text(ctx, terr.name, W - 126, y + 3, { size: 8 });
      U.text(ctx, f ? f.name : 'Unclaimed', W - 126, y + 13, { size: 7, color: f ? f.color : U.colors.dim });
      if (terr.contested) U.text(ctx, 'UNDER ATTACK', W - 12, y + 13, { size: 7, align: 'right', weight: 'bold', color: '#ff6a5a' });
      if (f) U.bar(ctx, W - 126, y + 23, 114, 4, terr.control / 100, f.color);
      y += 35;
    }
    if (bounty > 0) {
      U.panel(ctx, W - 132, y, 126, 15, { border: '#a03a2a' });
      U.text(ctx, `Bounty: $${bounty}`, W - 126, y + 3, { size: 8, color: bounty >= G.BOUNTY_KILL_ON_SIGHT ? '#ff4a3a' : '#ffa060' });
      y += 19;
    }

    if (G.settings.get('showMinimap')) this.drawMinimap(ctx, scene, W - 132, y, 126, 80);

    // interaction prompt
    const t = scene.promptTarget;
    if (t) {
      const key = G.pad ? G.pad.prompt('interact') : G.input.keyName(G.input.bindings.interact[0]);
      const label = `[${key}] ${t.label}${t.type === 'npc' && !t.ref.sleeping ? '  ·  [Enter] Say something' : ''}`;
      const tw = U.measure(ctx, label, 10) + 16;
      U.panel(ctx, (W - tw) / 2, R.uiH - 58, tw, 18);
      U.text(ctx, label, W / 2, R.uiH - 54, { size: 10, align: 'center' });
    }

    // toasts
    let ty = this.toastY || 64;
    for (const tt of scene.toasts) {
      const a = Math.min(1, tt.t);
      ctx.globalAlpha = a;
      const col = { bad: '#ff7a6a', good: '#8aea7a', quest: '#ffd86a', warn: '#ffb060' }[tt.type] || U.colors.text;
      const tw = U.measure(ctx, tt.text, 9) + 12;
      ctx.fillStyle = 'rgba(15,12,20,0.8)';
      ctx.fillRect(6, ty, tw, 14);
      U.text(ctx, tt.text, 12, ty + 2.5, { size: 9, color: col });
      ty += 16;
      ctx.globalAlpha = 1;
    }

    // region banner
    if (scene.banner && scene.banner.t > 0) {
      const a = Math.min(1, scene.banner.t, (3.5 - scene.banner.t) * 2);
      ctx.globalAlpha = Math.max(0, a);
      U.text(ctx, scene.banner.text, W / 2, 60, { size: 22, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#f4e4b8' });
      U.text(ctx, scene.banner.sub || '', W / 2, 88, { size: 10, align: 'center', color: U.colors.dim });
      ctx.globalAlpha = 1;
    }

  },

  drawMinimap(ctx, scene, x, y, w, h) {
    const map = scene.map, p = scene.player;
    const U = G.ui;
    U.panel(ctx, x, y, w, h);
    const scale = 2;
    const vw = (w - 6) / scale, vh = (h - 6) / scale;
    const ptx = p.x / 16, pty = p.y / 16;
    const sx = G.util.clamp(ptx - vw / 2, 0, Math.max(0, map.w - vw)), sy = G.util.clamp(pty - vh / 2, 0, Math.max(0, map.h - vh));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, w - 6, h - 6);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map.minimap, sx, sy, Math.min(vw, map.w), Math.min(vh, map.h), x + 3, y + 3, Math.min(vw, map.w) * scale, Math.min(vh, map.h) * scale);
    for (const a of scene.actors) {
      if (a.dead || a === p) continue;
      const ax = (a.x / 16 - sx) * scale + x + 3, ay = (a.y / 16 - sy) * scale + y + 3;
      if (ax < x + 3 || ay < y + 3 || ax > x + w - 3 || ay > y + h - 3) continue;
      if (a.kind === 'npc') {
        if (map.buildingAt(a.x, a.y - 3) && map.buildingAt(a.x, a.y - 3) !== map.buildingAt(p.x, p.y - 3)) continue;
        ctx.fillStyle = a.state === 'fight' || a.st.hostile ? '#ff3a2a' : '#f0e0a0';
      } else ctx.fillStyle = a.state === 'attack' ? '#ff3a2a' : '#c0a080';
      ctx.fillRect(ax - 1, ay - 1, 2, 2);
    }
    for (const id in G.TERRITORIES) {
      const t = G.TERRITORIES[id], owner = scene.world.territories[id].owner;
      if (t.map !== map.id || !owner) continue;
      ctx.strokeStyle = G.FACTIONS[owner].color;
      ctx.globalAlpha = 0.7;
      ctx.strokeRect((t.x - sx) * scale + x + 3.5, (t.y - sy) * scale + y + 3.5, t.w * scale - 1, t.h * scale - 1);
      ctx.globalAlpha = 1;
    }
    for (const e of map.exits) {
      ctx.fillStyle = '#60c0ff';
      ctx.fillRect((e.x - sx) * scale + x + 3, (e.y - sy) * scale + y + 3, Math.max(2, e.w * scale), Math.max(2, e.h * scale));
    }
    const px = (ptx - sx) * scale + x + 3, py = (pty - sy) * scale + y + 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    ctx.restore();
  },

  // Names above nearby NPCs, speech bubbles, damage numbers — drawn in UI space for crisp text.
  drawLabels(ctx, scene) {
    const R = G.renderer, U = G.ui, p = scene.player;
    for (const a of scene.actors) {
      if (a.dead || a === p || a.kind !== 'npc') continue;
      if (scene.isHiddenByRoof(a)) continue;
      const near = a.distTo(p) < 48;
      if (!near && !a.bark && !a.sleeping && !G.jobs.targetOf(scene.world, a.id)) continue;
      const s = R.worldToUI(a.x, a.y - (a.sleeping ? 14 : 22));
      if (a.sleeping) {
        const z = 'z'.repeat(1 + (Math.floor(G.loop.time * 2) % 3));
        U.text(ctx, z, s.x + 6, s.y - 4, { size: 8, color: '#c8d8ff' });
        continue;
      }
      if (a.bark) {
        const tw = U.measure(ctx, a.bark, 9) + 10;
        ctx.fillStyle = 'rgba(250,245,230,0.95)';
        ctx.fillRect(s.x - tw / 2, s.y - 22, tw, 14);
        ctx.fillRect(s.x - 2, s.y - 8, 4, 3);
        U.text(ctx, a.bark, s.x, s.y - 19, { size: 9, align: 'center', color: '#2a2018', shadow: false });
      } else if (near) {
        const hostile = a.state === 'fight' || a.st.hostile;
        const fc = a.faction.listed && (!a.faction.covert || scene.world.getRep(a.def.faction) >= 20 || G.skills.has(p, 'read_people')) ? a.faction.color : null;
        U.text(ctx, a.displayName, s.x, s.y - 8, { size: 8, align: 'center', color: hostile ? '#ff6a5a' : fc || '#f4ecd8' });
      }
      if (a.hp < a.maxHp && (near || a.state === 'fight')) U.bar(ctx, s.x - 12, s.y + 1, 24, 4, a.hp / a.maxHp, U.colors.hp);
      if (a.emote) U.icon(ctx, G.item(a.emote).icon, s.x - 6, s.y - 34 + Math.sin(G.loop.time * 3), 0.75);   // eating or drinking
      if (G.jobs.targetOf(scene.world, a.id)) { const bob = Math.sin(G.loop.time * 4) * 2; ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 22 + bob); ctx.lineTo(s.x + 4, s.y - 22 + bob); ctx.lineTo(s.x, s.y - 16 + bob); ctx.fill(); }
    }
    for (const a of scene.actors) {
      if (a.kind !== 'animal' || a.dead || a.hp >= a.maxHp) continue;
      const s = R.worldToUI(a.x, a.y - a.sheet.fh - 4);
      U.bar(ctx, s.x - 10, s.y, 20, 4, a.hp / a.maxHp, U.colors.hp);
    }
    for (const f of scene.floaters) {
      const s = R.worldToUI(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.t * 2);
      U.text(ctx, f.text, s.x, s.y, { size: 10, align: 'center', weight: 'bold', color: f.color });
      ctx.globalAlpha = 1;
    }
  },
};
