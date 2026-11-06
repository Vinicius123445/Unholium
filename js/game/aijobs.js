'use strict';
// Jobs written by the AI dialogue (js/game/aidialogue.js), made real by the game.
//   Ask someone for work in your own words: they come up with a task in their own voice (why they need it, who
//   it is for), but only from what the game can track. G.aiJobs.options() tells the model exactly which jobs this
//   person could give (real people with their ids, real items, real animals, a fair pay range), and
//   G.aiJobs.build() checks what it proposes and turns it into an ordinary job (js/game/jobs.js): it goes to the
//   Journal and My Jobs, chatBCT can point you at the target, it has a deadline, it fails if someone it needs
//   dies, and you turn it in with "About the job...".
//   Kinds: deliver (a parcel), message (words to pass on), fetch (bring items), hunt (animals), scout (learn
//   someone's name), beat (rough someone up), kill, collect (money someone owes them).
(() => {
const clamp = G.util.clamp;
const GANG = (d) => ['gang_red', 'gang_blue', 'punks', 'bandits', 'criminals'].includes(d.faction) || ['s_pawnbroker', 'r_dealer'].includes(d.id);
const ROUGH = (d, st) => GANG(d) || d.faction === 'cia' || !!st.grudge || d.combat === 'fight';
const BLOCK = /\b(fuck|rape|child|kid|minor|porn|naked)\b/i;
const CONTRABAND = ['weed', 'cocaine', 'heroin', 'crack', 'drug_package', 'lsd', 'meth', 'joint'];   // (what the police want brought in as evidence)
const HUNTABLE = ['rabbit', 'deer', 'wolf', 'boar', 'bear'];
const WANTS = ['apple', 'bread', 'fish', 'raw_meat', 'egg', 'milk', 'cheese', 'wheat', 'herb', 'mushroom', 'chanterelle', 'wood', 'iron_ore', 'pelt', 'wolf_pelt', 'beer', 'whiskey', 'coffee', 'cigarettes', 'painkillers', 'bandage', 'book', 'flowers', 'oil_flask', 'soda', 'chips', 'canned_beans'];
// pay: [min, max] (for fetch: a multiple of what the items are worth; hunt: per animal)
const PAY = { deliver: [20, 120], message: [10, 60], fetch: [1.2, 3], hunt: [20, 150], scout: [20, 90], beat: [40, 260], kill: [120, 600], collect: [0, 0] };
const DAYS = { deliver: 2, message: 2, fetch: 4, hunt: 4, scout: 3, beat: 3, kill: 3, collect: 2 };
const name = (w, id) => w.displayName(id);
const whereOf = (w, id) => { const d = G.NPCS[id], m = G.maps.get((w.npcs[id] && w.npcs[id].map) || d.map); const b = d.home && m.building(d.home); return `${m.meta.name}${b ? ', ' + b.name.toLowerCase() : ''}`; };

const J = G.aiJobs = {
  PAY, DAYS,
  asked: (text) => /\b(work|job|jobs|task|gig|errand|hustle|earn|money|hire|help you|anything for me|need anything|need a hand)\b/i.test(text || ''),
  // what this person could give (only these): kinds, and the people / items / animals to choose from
  options(w, giverId) {
    const d = G.NPCS[giverId], st = w.npcs[giverId];
    if (!d || !st || d.kid && !d.errands) return { kinds: [] };
    const alive = (id) => id !== giverId && w.isAlive(id) && G.NPCS[id] && !G.NPCS[id].inactive && !(w.npcs[id] && w.npcs[id].companion);
    const ids = Object.keys(G.NPCS).filter(alive);
    const op = (id) => G.social.opinion(w, giverId, id);
    const rel = (id) => (d.relations || {})[id] || (G.NPCS[id].relations || {})[giverId];
    // people they care about or know (messages, deliveries), people they hate (rough work)
    // (the whole pools, for checking; the prompt shows a few of each, the same few all day for this person)
    const r = new G.RNG(`aijobs-${giverId}-${w.day}`), few = (list, n) => list.map((id) => [r.next(), id]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
    const pool = {
      close: ids.filter((id) => rel(id) || op(id) >= 30),
      elsewhere: ids.filter((id) => G.NPCS[id].home && G.NPCS[id].map !== d.map && !G.NPCS[id].kid),
      enemies: ids.filter((id) => (id === st.grudge || op(id) <= -30 || G.factionsAtWar(d.faction, G.NPCS[id].faction)) && !G.NPCS[id].kid && !w.isMember(G.NPCS[id].faction)),
      unknown: ids.filter((id) => !w.npcs[id].introduced && G.NPCS[id].faction !== 'civilians' && G.NPCS[id].map !== d.map),
    };
    // the police: their targets are criminals (js/game/aijobs.js copReady: they only hire someone who convinced them)
    const cop = d.combat === 'guard';
    if (cop) {
      pool.enemies = ids.filter((id) => G.CRIMINAL_FACTIONS.includes(G.NPCS[id].faction) && !G.NPCS[id].kid && !w.isMember(G.NPCS[id].faction));
      pool.unknown = ids.filter((id) => !w.npcs[id].introduced && G.CRIMINAL_FACTIONS.includes(G.NPCS[id].faction));
    }
    const close = few(pool.close, 4), elsewhere = few(pool.elsewhere, 3), enemies = few(pool.enemies, 3), unknown = few(pool.unknown, 2);
    const kinds = ['deliver', 'message', 'fetch'];
    if (d.combat === 'fight' || ['hunters'].includes(d.faction) || /^(f_|r_farmer)/.test(giverId)) kinds.push('hunt');
    if (pool.unknown.length && (d.leader || d.faction === 'cia' || GANG(d))) kinds.push('scout');
    if (!d.kid && pool.enemies.length && ROUGH(d, st)) kinds.push('beat');
    if (!d.kid && pool.enemies.length && (GANG(d) || d.faction === 'cia' || (st.grudge && op(st.grudge) <= -60))) kinds.push('kill');
    if (!d.kid && GANG(d)) kinds.push('collect');
    if (d.kid) kinds.splice(0, kinds.length, 'deliver', 'message', 'fetch');
    // the police: criminals to rough up or take down, someone to identify, contraband to bring in as evidence, a
    // file to deliver. The pay is your record (the bounty wipe on completion).
    if (cop) {
      kinds.splice(0, kinds.length, 'deliver', 'fetch', 'scout', 'beat', 'kill');
      if (!pool.unknown.length) kinds.splice(kinds.indexOf('scout'), 1);
      if (!pool.enemies.length) kinds.splice(kinds.indexOf('beat'), 2);
    }
    const people = [...new Set(close.concat(elsewhere, enemies, unknown))];
    return { kinds, people, close, elsewhere, enemies, unknown, pool, cop, items: (cop ? CONTRABAND : WANTS).filter((id) => G.ITEMS[id]), animals: HUNTABLE };
  },
  // the part of the prompt that says what is possible
  describe(w, giverId) {
    const o = this.options(w, giverId); if (!o.kinds.length) return null;
    const who = (id) => `${G.NPCS[id] ? w.npcs[id].realName : id} (id ${id}, ${G.NPCS[id].name}, ${whereOf(w, id)}${id === w.npcs[giverId].grudge || o.enemies.includes(id) ? ', someone you hold a grudge against' : o.close.includes(id) ? ', someone close to you' : ''})`;
    const lines = [`Work you could give the player. Only these are possible: use a kind, a target id and an item id from here, exactly.`];
    for (const k of o.kinds) {
      const p = PAY[k];
      if (k === 'deliver') lines.push(`- deliver: a parcel to someone. target from: ${o.close.concat(o.elsewhere).map(who).join('; ') || 'none'}. pay $${p[0]}-${p[1]}`);
      if (k === 'message') lines.push(`- message: pass words on to someone you know (put the message in "why"). target from: ${o.close.concat(o.elsewhere).map(who).join('; ') || 'none'}. pay $${p[0]}-${p[1]}`);
      if (k === 'fetch') lines.push(`- fetch: bring you items. item ids: ${o.items.join(', ')}; count 1-6. pay about ${p[0]}-${p[1]} times their value`);
      if (k === 'hunt') lines.push(`- hunt: kill animals. item = species: ${o.animals.join(', ')}; count 1-4. pay $${p[0]}-${p[1]} each`);
      if (k === 'scout') lines.push(`- scout: find out someone's real name. target from: ${o.unknown.map(who).join('; ')}. pay $${p[0]}-${p[1]}`);
      if (k === 'beat') lines.push(`- beat: rough someone up, not kill. target from: ${o.enemies.map(who).join('; ')}. pay $${p[0]}-${p[1]}`);
      if (k === 'kill') lines.push(`- kill: someone dead. target from: ${o.enemies.map(who).join('; ')}. pay $${p[0]}-${p[1]}`);
      if (k === 'collect') lines.push(`- collect: money someone owes you (count = dollars, 50-300; the player brings it all back). target from: ${o.enemies.concat(o.elsewhere).map(who).join('; ')}`);
    }
    return lines.join('\n');
  },
  // the reply format when the player asks for work: the usual one plus a "job", whose kind, target and item can
  // only be what this person could really give (the model cannot write anything else)
  schema(w, giverId, base) {
    const o = this.options(w, giverId);
    const ids = [...new Set(o.close.concat(o.elsewhere, o.enemies, o.unknown))];
    const job = {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: o.kinds.concat(['none']) },
        target: { type: 'string', enum: ids.concat(['']) },
        item: { type: 'string', enum: (o.kinds.includes('fetch') ? o.items : []).concat(o.kinds.includes('hunt') ? o.animals : [], ['']) },
        count: { type: 'integer' }, pay: { type: 'integer' }, title: { type: 'string' }, why: { type: 'string' },
      },
      required: ['kind', 'target', 'item', 'count', 'pay', 'title', 'why'], additionalProperties: false,
    };
    return Object.assign({}, base, { properties: Object.assign({}, base.properties, { job }), required: base.required.concat(['job']) });
  },
  // The police do not hand out work. Unless you convince one: a real reason (score from aidialogue's argumentScore)
  // and a Charisma roll, once a day per cop; or a cop who already likes you. -> true if this cop will hire you today.
  copReady(scene, npc, said, score) {
    const w = scene.world, st = npc.st;
    if (st.copDealDay === w.day || (st.disp || 0) >= 40) return true;
    if (st.copTryDay === w.day || (score || 0) < 3) return false;
    st.copTryDay = w.day;
    if (!G.skills.roll(scene.player, clamp(13 - score - Math.round((st.disp || 0) / 25), 2, 18), 'charisma')) return false;
    st.copDealDay = w.day;
    return true;
  },
  // a proposed job -> a job definition the game tracks, or null (and why in J.lastWhy)
  build(w, giverId, a) {
    const no = (why) => { this.lastWhy = why; return null; };
    const o = this.options(w, giverId), kind = String(a.kind || '').toLowerCase();
    if (!o.kinds.includes(kind)) return no('not a job they could give: ' + kind);
    if (G.jobs.active(w).length >= G.jobs.MAX_ACTIVE) return no('too many jobs');
    if (G.jobs.active(w).some((id) => G.jobs.def(w, id).giver === giverId)) return no('already working for them');
    const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '').slice(0, n);
    const why = clean(a.why || a.text, 160), title0 = clean(a.title, 40);
    if (BLOCK.test(why) || BLOCK.test(title0)) return no('content');
    const target = a.target && String(a.target), count = clamp(Math.round(+a.count || 1), 1, kind === 'collect' ? 300 : kind === 'hunt' ? 4 : 6);
    const p = PAY[kind], payIn = Math.round(+a.pay || 0);
    const giver = name(w, giverId);
    let def;
    const needTarget = (list) => (target && list.includes(target) && w.isAlive(target) ? target : null);
    switch (kind) {
      case 'deliver': case 'message': {
        const t = needTarget(o.pool.close.concat(o.pool.elsewhere)); if (!t) return no('unknown target');
        const pay = clamp(payIn || p[0] * 2, p[0], p[1]);
        def = kind === 'deliver'
          ? { type: 'deliver', item: 'parcel', target: t, title: title0 || `Delivery for ${name(w, t)}`, desc: `Bring ${giver}'s parcel to ${name(w, t)} (${whereOf(w, t)}).${why ? ' ' + why : ''}`, objectives: [{ type: 'flag', flag: '%_delivered', text: `Deliver to ${name(w, t)}` }], reward: { gold: pay, xp: 20, disp: 8, regionRep: 2 }, failIfDead: [t] }
          : { type: 'message', target: t, message: why || 'They wanted you to hear it from them.', title: title0 || `A message for ${name(w, t)}`, desc: `Pass ${giver}'s words on to ${name(w, t)} (${whereOf(w, t)}): "${why || '...'}"`, objectives: [{ type: 'flag', flag: '%_told', text: `Tell ${name(w, t)}` }], reward: { gold: pay, xp: 15, disp: 10 }, failIfDead: [t] };
        break;
      }
      case 'fetch': {
        const item = a.item && o.items.includes(a.item) ? a.item : null; if (!item) return no('unknown item');
        const value = (G.ITEMS[item].value || 2) * count, pay = clamp(payIn || Math.round(value * 1.8), Math.round(value * p[0]) + 5, Math.round(value * p[1]) + 20);
        def = { type: 'fetch', item, title: title0 || `${count} × ${G.ITEMS[item].name}`, desc: `Bring ${count} ${G.ITEMS[item].name} to ${giver}.${why ? ' ' + why : ''}`, objectives: [{ type: 'have', item, count, text: `Get ${count} ${G.ITEMS[item].name}` }], reward: { gold: pay, xp: 20, disp: 8, take: [[item, count]] } };
        break;
      }
      case 'hunt': {
        const sp = a.item && o.animals.includes(a.item) ? a.item : null; if (!sp) return no('unknown animal');
        const n = sp === 'bear' ? 1 : count, pay = clamp(payIn || n * 40, p[0] * n, p[1] * n);
        def = { type: 'hunt', title: title0 || `Hunt: ${n} ${sp}`, desc: `Kill ${n} ${sp}${n > 1 ? 's' : ''} for ${giver}.${why ? ' ' + why : ''}`, objectives: [{ type: 'kill', target: sp, count: n, text: `Kill ${sp}${n > 1 ? 's' : ''}` }], reward: { gold: pay, xp: 30, disp: 8 } };
        break;
      }
      case 'scout': {
        const t = needTarget(o.pool.unknown); if (!t) return no('unknown target');
        def = { type: 'scout', target: t, title: title0 || `Who is the ${G.NPCS[t].name}?`, desc: `Learn the real name of the ${G.NPCS[t].name} in ${whereOf(w, t)}, then report back.${why ? ' ' + why : ''}`, objectives: [{ type: 'flag', flag: '%_named', text: 'Learn their name' }], reward: { gold: clamp(payIn || 40, p[0], p[1]), xp: 25, disp: 8 } };
        break;
      }
      case 'beat': case 'kill': {
        const t = needTarget(o.pool.enemies); if (!t) return no('unknown target');
        const pay = clamp(payIn || (kind === 'kill' ? 250 : 100), p[0], p[1]);
        def = kind === 'beat'
          ? { type: 'beat', target: t, title: title0 || `Teach ${name(w, t)} a lesson`, desc: `${giver} wants ${name(w, t)} (${G.NPCS[t].name}) beaten up, not killed. Usually around ${whereOf(w, t)}.${why ? ' ' + why : ''}`, objectives: [{ type: 'flag', flag: '%_beaten', text: `Beat up ${name(w, t)} (do not kill)` }], reward: { gold: pay, xp: 35, disp: 12 }, failIfDead: [t] }
          : { type: 'hit', target: t, title: title0 || `Contract: ${name(w, t)}`, desc: `${giver} wants ${name(w, t)} (${G.NPCS[t].name}) dead. Usually around ${whereOf(w, t)}.${why ? ' ' + why : ''}`, objectives: [{ type: 'kill', target: t, count: 1, text: `Kill ${name(w, t)}` }], reward: { gold: pay, xp: 60, disp: 15 } };
        break;
      }
      case 'collect': {
        const t = needTarget(o.pool.enemies.concat(o.pool.elsewhere)); if (!t) return no('unknown target');
        const amount = clamp(count >= 50 ? count : 100, 50, 300), cut = Math.round(amount * 0.25);
        def = { type: 'collect', target: t, amount, title: title0 || `Collect from ${name(w, t)}`, desc: `${name(w, t)} owes ${giver} $${amount}. Get it and bring it all back; your cut is $${cut}.${why ? ' ' + why : ''}`, objectives: [{ type: 'flag', flag: '%_collected', text: `Collect $${amount} from ${name(w, t)}` }], reward: { gold: cut, xp: 30, disp: 8, takeGold: amount } };
        break;
      }
    }
    def.days = DAYS[kind]; def.giver = giverId; def.ai = true; def.why = why;
    // a job for the police: the real pay is a clean record (every bounty wiped, no longer wanted)
    if (o.cop) { def.reward.clearBounty = true; def.reward.gold = Math.round(def.reward.gold * 0.3); def.desc += ' Do it and your record gets cleaned up.'; def.title = def.title.slice(0, 34) + ' (police)'; }
    def.pitch = def.desc;
    return def;
  },
};

// ---------------------------------------------------------------- the police keep their side of the deal
const _complete = G.jobs.complete;
G.jobs.complete = function (runner, id) {
  const w = runner.scene.world, d = this.def(w, id), clean = d && d.reward && d.reward.clearBounty;
  const r = _complete.apply(this, arguments);
  if (clean && w.quests[id].state === 'done') {
    for (const k of Object.keys(w.bounty || {})) w.clearBounty(k);
    if (G.law && G.law.endWanted) G.law.endWanted(w, 'a deal with the police');
    w.log('Your record was cleaned up.', 'good');
    runner.scene.toast('Your record is clean.', 'good');
  }
  return r;
};

// the written way (AI dialogue off, or being arrested): "Let me work it off." A Charisma roll; the job is the game's pick
G.DIALOGUE_NODES._cop_deal = (r) => {
  const sc = r.scene, w = sc.world, npc = r.npc;
  const back = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
  if (G.jobs.active(w).some((id) => G.jobs.def(w, id).giver === npc.id)) return { text: 'You already have something to do for me. Do it.', choices: back };
  if (!J.copReady(sc, npc, '', 5)) return { text: G.rng.pick(['Nice try. That is not how this works.', 'You think I make deals with people like you?']), choices: back };
  const o = J.options(w, npc.id);
  let def = null;
  for (const kind of ['beat', 'scout', 'fetch', 'deliver']) {
    if (!o.kinds.includes(kind)) continue;
    const target = kind === 'beat' ? o.enemies[0] : kind === 'scout' ? o.unknown[0] : kind === 'deliver' ? o.close.concat(o.elsewhere)[0] : null;
    def = J.build(w, npc.id, { kind, target, item: kind === 'fetch' ? o.items[0] : '', count: 2, title: '', why: kind === 'beat' ? 'They have been getting away with too much.' : '' });
    if (def) break;
  }
  if (!def) return { text: 'I have nothing for you. Keep your head down.', choices: back };
  G.jobs.accept(r, def);
  sc.arrestCooldown = Math.max(sc.arrestCooldown || 0, 600);
  return { text: `Alright. Off the record: ${def.desc}`, choices: [{ text: 'Deal.', next: null }] };
};
G.DIALOGUE_CHOICES.push((runner) => (runner.npc.def.combat === 'guard' && !runner.npc.remote && !G.jobs.active(runner.scene.world).some((id) => G.jobs.def(runner.scene.world, id).giver === runner.npc.id) ? [{ text: `${runner.c.tag(8)} Let me work it off. Give me a job.`, next: '_cop_deal' }] : []));
if (G.DIALOGUES._arrest && G.DIALOGUES._arrest.start) G.DIALOGUES._arrest.start.choices.splice(1, 0, { text: (c) => `${c.tag(8)} Let me make it up to you. Give me a job.`, next: '_cop_deal' });

// ---------------------------------------------------------------- passing a message on (the one new kind)
const _choices = G.jobs.choices;
G.jobs.choices = function (runner) {
  const out = _choices.call(this, runner), { npc } = runner, w = runner.scene.world;
  for (const id of this.active(w)) {
    const d = this.def(w, id), f = d.objectives[0] && d.objectives[0].flag;
    if (d.type === 'message' && d.target === npc.id && f && !w.flags[f]) {
      out.unshift({ text: `I have a message from ${w.displayName(d.giver)}.`, do: () => {
        w.flags[f] = true;
        runner.jobMsg = `"${d.message}" ...${G.rng.pick([' Huh. Thanks for telling me.', ' Tell them I heard it.', ' I did not expect that. Thank you.', ' ...I need a minute.'])}`;
        G.social.addDisp(w, npc.id, 2);
        G.events.emit('toast', `${d.title}: done. Report back.`, 'quest');
        return '_job_msg';
      } });
    }
  }
  return out;
};
})();
