'use strict';
// chatBCT "My Jobs": every job and quest you have (radiant jobs, faction work and ranks, kid errands,
// initiations, lodge jobs, contracts, story quests), with who gave it, what to do, where, the pay, the
// deadline and the progress; plus what you finished or failed. Each one: "Where is it?" (GPS) or "Drop it".
(() => {
const B = G.bct;
const KIND = (id, def) => (/^init_/.test(id) ? 'Initiation' : /^mz_|lodge/.test(id) ? 'Lodge' : /^fr_|faction/.test(id) ? 'Faction' : /kid/.test(id) ? 'Errand' : def && def.type === 'deal_with' ? 'Contract' : def && def.giver && G.QUESTS[id] ? 'Quest' : def && def.objectives ? 'Job' : 'Quest');

G.myJobs = {
  list(w) {
    const out = [];
    for (const id in w.quests) {
      const q = w.quests[id], d = G.questDef(w, id) || {};
      out.push({ id, state: q.state, def: d, kind: KIND(id, d), title: d.title || id });
    }
    return out;
  },
  progress(w, id) {
    const q = w.quests[id], d = G.questDef(w, id);
    if (!d.objectives || !d.objectives.length) return '';
    return d.objectives.map((o, i) => {
      const done = o.type === 'kill' ? (q.progress[i] || 0) >= o.count : o.type === 'have' ? G.player && G.player.inventory.has(o.item, o.count) : !!w.flags[o.flag];
      const n = o.type === 'kill' ? ` (${Math.min(o.count, q.progress[i] || 0)}/${o.count})` : '';
      return `${done ? '[x]' : '[ ]'} ${o.text || o.type}${n}`;
    }).join('  ');
  },
  // where to go: the target if not done, the giver once done
  target(w, id) {
    const d = G.questDef(w, id);
    const done = G.jobs && w.quests[id].def ? G.jobs.done(w, id) : false;
    return (!done && d.target && G.NPCS[d.target]) ? d.target : d.giver || d.target || null;
  },
  reward(d) {
    const r = d.reward || {};
    const bits = [];
    if (r.gold) bits.push('$' + r.gold);
    if (r.xp) bits.push(r.xp + ' XP');
    if (r.items) bits.push(r.items.map(([i, n]) => `${n}x ${G.item(i).name}`).join(', '));
    return bits.join(', ') || 'Unclear';
  },
};

B.BASE.unshift('My Jobs');
const _reply = B.reply;
B.reply = function (scene, raw) {
  if (/^\s*my jobs\s*$/i.test(raw)) {
    const n = G.myJobs.list(scene.world).filter((j) => j.state === 'active').length;
    const ps = G.scenes.stack.find((s) => s instanceof G.PhoneScene);
    if (ps) setTimeout(() => ps.open('myjobs'), 0);
    return n ? B.pick([`${n} job${n > 1 ? 's' : ''}. I made you a list, since you clearly cannot keep one in your head.`, `Here is everything you promised people. Ambitious. Delusional, but ambitious.`])
      : B.pick(['You have zero jobs. Living the dream.', 'Nothing. Not one person trusts you with anything. Respect.']);
  }
  return _reply.apply(this, arguments);
};

G.PHONE_SCREENS.myjobs = (ps) => {
  const w = ps.w, all = G.myJobs.list(w);
  const act = all.filter((j) => j.state === 'active'), old = all.filter((j) => j.state !== 'active').slice(-12).reverse();
  const rows = act.map((j) => {
    const d = j.def, giver = d.giver ? w.displayName(d.giver) : '?';
    return { label: `${j.kind}: ${j.title}`, sub: `From ${giver} · ${G.myJobs.reward(d)}${d.deadline ? ' · until day ' + d.deadline : ''}`, color: '#ffe8b0', act: () => ps.open('myjob', j.id) };
  });
  if (!rows.length) rows.push({ label: 'No active jobs.', info: true });
  if (old.length) rows.push({ label: '— Finished and failed —', info: true, color: '#8a8a9a' });
  for (const j of old) rows.push({ label: `${j.state === 'done' ? 'Done' : j.state === 'failed' ? 'Failed' : j.state}: ${j.title}`, sub: j.kind, color: j.state === 'done' ? '#8ae0b0' : '#ff9a7a', info: true });
  return rows;
};
G.PHONE_SCREENS.myjob = (ps) => {
  const w = ps.w, g = ps.game, id = ps.data, q = w.quests[id];
  if (!q) return [{ label: 'Gone.', info: true }];
  const d = G.questDef(w, id), tgt = G.myJobs.target(w, id);
  const where = tgt && w.npcs[tgt] ? `${w.displayName(tgt)}, ${G.maps.get(w.npcs[tgt].map || G.NPCS[tgt].map).meta.name}` : (d.region && G.REGIONS[d.region] ? G.REGIONS[d.region].name : 'Somewhere out there');
  const rows = [
    { label: d.title || id, color: '#ffe8b0', info: true },
    { label: d.desc || '', info: true },
    { label: 'Giver: ' + (d.giver ? w.displayName(d.giver) : 'unknown'), sub: 'Where: ' + where, info: true },
    { label: 'Reward: ' + G.myJobs.reward(d), sub: d.deadline ? `Deadline: day ${d.deadline} (today is day ${w.day})` : 'No deadline', info: true },
    { label: 'Progress', sub: G.myJobs.progress(w, id) || 'See the description', info: true },
  ];
  if (q.state === 'active') {
    rows.push({ label: 'Where is it?', color: '#8ad8ff', act: () => { if (tgt && B.track(g, tgt)) { g.toast(`Eagle Maps: route to ${w.displayName(tgt)}.`, 'good'); G.scenes.remove(ps); } else g.toast('BCT: no idea. Even I have limits. Barely.'); } });
    rows.push({ label: 'Drop it', color: '#ff9a7a', act: () => { w.failQuest(id, 'You dropped it.'); if (d.giver) G.social.addDisp(w, d.giver, -6); g.toast(`Dropped: ${d.title || id}.`); ps.back(); } });
  }
  return rows;
};
})();
