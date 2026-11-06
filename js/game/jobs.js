'use strict';
// Radiant jobs: ask (almost) anyone "Got any work?" and they come up with something that fits who they are.
// Gangsters want people hurt, robbed or drugs moved; shopkeepers need deliveries, supplies or an extra
// pair of hands; hunters want game; people with a grudge want their enemy dealt with.
// A job is a quest whose definition is generated and stored in world.quests[id].def.
//   objectives: kill (npc id, species or 'faction:<id>') | flag (set by dialogue/hooks) | have (items)

const R = () => G.rng;
const nameOf = (w, id) => w.displayName(id);
const where = (w, id) => {
  const def = G.NPCS[id], m = G.maps.get(w.npcs[id].map || def.map);
  const home = def.home && m.building(def.home);
  return `${m.meta.name}${home ? ', ' + home.name.toLowerCase() : ''}`;
};
const GANGSTER = (d) => ['gang_red', 'gang_blue', 'punks', 'bandits'].includes(d.faction) || ['s_pawnbroker', 'r_dealer'].includes(d.id);
const alivePeople = (w, filter) => Object.keys(G.NPCS).filter((id) => w.isAlive(id) && !G.NPCS[id].inactive && filter(G.NPCS[id], id));

// Work shifts by trade (what you do, and how it is described).
const SHIFTS = {
  r_innkeeper: 'clean the motel rooms', c_tavernkeep: 'wash glasses and serve drinks', c_merchant: 'stock the shelves', r_merchant: 'stock the shelves',
  u_clerk: 'run the register', x_clerk: 'unload deliveries', s_clerk: 'mind the counter', r_smith: 'fix a customer\'s car', r_apprentice: 'sort the hardware',
  r_farmer1: 'harvest the fields', r_farmer2: 'muck out the barn', r_farmwife: 'pick vegetables', c_priest: 'clean the church', r_priest: 'tidy the graveyard',
  c_barber: 'sweep up hair and wash towels', c_alchemist: 'count pills and file prescriptions', c_harbormaster: 'unload cargo at the docks', c_citizen5: 'haul crates at the harbor',
  f_hunter: 'skin and salt pelts', f_woodcutter: 'split firewood', c_tailor: 'fold clothes and do inventory', h_jeweler: 'polish the display cases', h_gardener: 'trim the hedges',
  r_cook: 'flip burgers in the kitchen', r_attendant: 'pump gas and clean the bathrooms', c_market1: 'prep food at the truck', c_armorer: 'clean and oil the guns',
};
const FETCH = {
  f_hunter: [['pelt', 3], ['wolf_pelt', 2], ['antler', 2]], f_hermit: [['herb', 4], ['chanterelle', 2], ['mushroom', 4]], r_farmer1: [['wheat', 6]], r_farmer2: [['egg', 4]],
  r_smith: [['iron_ore', 4], ['iron_ingot', 2]], c_alchemist: [['herb', 3]], c_tavernkeep: [['whiskey', 2], ['fish', 3]], r_cook: [['raw_meat', 3], ['fish', 3]],
  c_market1: [['fish', 4], ['apple', 5]], s_pawnbroker: [['smartphone', 2], ['jewelry', 1], ['gold_chain', 1]], c_punk_boss: [['beer', 6], ['oil_flask', 2]],
  h_jeweler: [['gem', 1]], r_innkeeper: [['wood', 6]], x_clerk: [['canned_beans', 4]],
};
const PL = (k) => ({ wolf: 'wolves', deer: 'deer' }[k] || k + 's');
const HUNT = { f_hunter: ['wolf', 'deer', 'boar'], f_tracker: ['wolf', 'bear'], r_farmer2: ['wolf'], r_farmer1: ['rabbit'] };

G.JOB_TYPES = {
  // --- crime ---
  hit: {
    weight: (d, st) => (st.grudge ? 4 : 0) + (GANGSTER(d) || d.faction === 'cia' ? 2 : 0),
    make(w, giver) {
      const d = G.NPCS[giver], st = w.npcs[giver];
      let target = st.grudge && w.isAlive(st.grudge) ? st.grudge : null;
      if (!target) {
        const rivals = alivePeople(w, (t, id) => id !== giver && (G.factionsAtWar(d.faction, t.faction) || (GANGSTER(d) && t.faction === 'government' && t.combat === 'guard')) && !w.isMember(t.faction));
        target = rivals.length ? R().pick(rivals) : null;
      }
      if (!target) return null;
      const td = G.NPCS[target], pay = Math.round((td.leader ? 400 : 150 + (td.hp || 30) * 2) / 10) * 10;
      return {
        type: 'hit', title: `Contract: ${nameOf(w, target)}`, target,
        pitch: R().pick([`I need ${nameOf(w, target)} gone. Permanently. $${pay}.`, `${nameOf(w, target)} has been a problem for too long. Make them disappear and I pay $${pay}.`, `There is a name on my list: ${nameOf(w, target)}. $${pay} if you cross it off.`]),
        desc: `${nameOf(w, giver)} wants ${nameOf(w, target)} (${td.name}) dead. Usually found around ${where(w, target)}.`,
        objectives: [{ type: 'kill', target, count: 1, text: `Kill ${nameOf(w, target)}` }],
        reward: { gold: pay, xp: 60, disp: 15 }, days: 3,
      };
    },
  },
  beat: {
    weight: (d, st) => (st.grudge ? 3 : 0) + (GANGSTER(d) ? 1.5 : 0) + (d.combat === 'fight' ? 0.5 : 0),
    make(w, giver) {
      const st = w.npcs[giver];
      const target = st.grudge && w.isAlive(st.grudge) ? st.grudge : (G.social.strongest(w, giver, -1) || {}).id;
      if (!target) return null;
      const pay = R().int(6, 12) * 10;
      return {
        type: 'beat', title: `Teach ${nameOf(w, target)} a lesson`, target,
        pitch: R().pick([`Rough up ${nameOf(w, target)} for me. Do not kill them, just make them remember. $${pay}.`, `${nameOf(w, target)} needs a beating. Nothing permanent. $${pay}.`]),
        desc: `Beat up ${nameOf(w, target)} until they are badly hurt, but keep them alive. Found around ${where(w, target)}.`,
        objectives: [{ type: 'flag', flag: '%_beaten', text: `Beat up ${nameOf(w, target)} (do not kill)` }],
        reward: { gold: pay, xp: 35, disp: 10 }, days: 3, failIfDead: [target],
      };
    },
  },
  drug_run: {
    weight: (d) => (GANGSTER(d) ? 3 : 0),
    make(w, giver) {
      const gd = G.NPCS[giver];
      const buyers = alivePeople(w, (t, id) => id !== giver && t.map !== gd.map && (GANGSTER(t) || t.faction === 'civilians' && (t.map === 'southside' || t.map === 'eastside' || t.map === 'suburbs')) && !G.factionsAtWar(gd.faction, t.faction));
      if (!buyers.length) return null;
      const target = R().pick(buyers), pay = R().int(12, 22) * 10;
      return {
        type: 'drug_run', title: `Package for ${nameOf(w, target)}`, target, item: 'drug_package',
        pitch: R().pick([`Got a package that needs to reach ${nameOf(w, target)} over in ${G.maps.get(G.NPCS[target].map).meta.name}. Do not open it, do not get caught. $${pay}.`, `Simple run: carry this to ${nameOf(w, target)}. If the cops stop you, you never met me. $${pay}.`]),
        desc: `Deliver a package of drugs to ${nameOf(w, target)} (${where(w, target)}). Getting caught with it means jail.`,
        objectives: [{ type: 'flag', flag: '%_delivered', text: `Deliver the package to ${nameOf(w, target)}` }],
        reward: { gold: pay, xp: 45, disp: 12, rep: gd.faction }, days: 1, failIfDead: [target],
      };
    },
  },
  collect: {
    weight: (d) => (GANGSTER(d) || d.shop === 'c_tavern' || d.id === 'r_merchant' ? 2 : 0),
    make(w, giver) {
      const debtors = alivePeople(w, (t, id) => id !== giver && t.faction === 'civilians' && t.combat === 'flee' && !t.shop);
      if (!debtors.length) return null;
      const target = R().pick(debtors), amount = R().int(4, 12) * 10, cut = Math.round(amount * 0.3 + 20);
      return {
        type: 'collect', title: `Collect from ${nameOf(w, target)}`, target, amount,
        pitch: R().pick([`${nameOf(w, target)} owes me $${amount} and keeps dodging me. Get it back and keep $${cut} for yourself.`, `Go see ${nameOf(w, target)}. They owe me $${amount}. Persuade them. You get $${cut}.`]),
        desc: `${nameOf(w, target)} owes ${nameOf(w, giver)} $${amount}. Collect it (${where(w, target)}) and bring it back.`,
        objectives: [{ type: 'flag', flag: '%_collected', text: `Collect $${amount} from ${nameOf(w, target)}` }],
        reward: { gold: cut, xp: 30, disp: 10, takeGold: amount }, days: 2,
      };
    },
  },
  steal: {
    weight: (d, st) => (GANGSTER(d) ? 1.5 : 0) + (st.grudge ? 1 : 0),
    make(w, giver) {
      const marks = alivePeople(w, (t, id) => id !== giver && t.home && t.faction !== G.NPCS[giver].faction);
      if (!marks.length) return null;
      const target = R().pick(marks), m = G.maps.get(G.NPCS[target].map);
      const chest = m.chests.find((c) => c.owner === target);
      if (!chest) return null;
      G.containers.ensureChests(w, m);
      w.containers[chest.id].items.push(['heirloom', 1]);
      const pay = R().int(8, 16) * 10;
      return {
        type: 'steal', title: `Steal from ${nameOf(w, target)}`, target, item: 'heirloom',
        pitch: `${nameOf(w, target)} keeps something valuable at home. A little heirloom. Bring it to me. $${pay}.`,
        desc: `Steal the heirloom from ${nameOf(w, target)}'s home (${where(w, target)}). Do not get seen.`,
        objectives: [{ type: 'have', item: 'heirloom', count: 1, text: 'Get the heirloom' }],
        reward: { gold: pay, xp: 40, disp: 10, take: [['heirloom', 1]] }, days: 3,
      };
    },
  },
  faction_hit: {
    weight: (d) => (G.GANGS.includes(d.faction) ? 2 : 0),
    make(w, giver) {
      const rival = G.gangWar.rival(G.NPCS[giver].faction), n = R().int(2, 4), pay = n * 50;
      return {
        type: 'faction_hit', title: `Hit the ${G.FACTIONS[rival].name}`,
        pitch: `The ${G.FACTIONS[rival].name} needs to bleed. Drop ${n} of them and I pay $${pay}.`,
        desc: `Kill ${n} members of the ${G.FACTIONS[rival].name}. Their turf is a good place to look.`,
        objectives: [{ type: 'kill', target: 'faction:' + rival, count: n, text: `Kill ${G.FACTIONS[rival].name} members` }],
        reward: { gold: pay, xp: 50, disp: 10, rep: G.NPCS[giver].faction }, days: 3,
      };
    },
  },
  scout: {
    weight: (d) => (d.faction === 'cia' || d.id === 'c_captain' || d.leader ? 1 : 0),
    make(w, giver) {
      const unknown = alivePeople(w, (t, id) => id !== giver && !w.npcs[id].introduced && t.faction !== 'civilians' && t.map !== G.NPCS[giver].map);
      if (!unknown.length) return null;
      const target = R().pick(unknown);
      return {
        type: 'scout', title: `Who is the ${G.NPCS[target].name}?`, target,
        pitch: `There is a ${G.NPCS[target].name.toLowerCase()} in ${G.maps.get(G.NPCS[target].map).meta.name}. I want a name. Find out who they are. $40.`,
        desc: `Learn the real name of the ${G.NPCS[target].name} in ${G.maps.get(G.NPCS[target].map).meta.name}, then report back.`,
        objectives: [{ type: 'flag', flag: '%_named', text: 'Learn their name' }],
        reward: { gold: 40, xp: 25, disp: 8 }, days: 3,
      };
    },
  },
  // --- honest work ---
  deliver: {
    weight: (d) => (!GANGSTER(d) && (d.shop || d.job) ? 2 : d.faction === 'civilians' ? 1 : 0),
    make(w, giver) {
      const gd = G.NPCS[giver];
      const people = alivePeople(w, (t, id) => id !== giver && t.faction === 'civilians' && t.home && t.map !== gd.map);
      if (!people.length) return null;
      const target = R().pick(people), pay = R().int(3, 8) * 10;
      const what = R().pick(['a box of paperwork', 'a birthday present', 'some spare parts', 'a casserole dish', 'a box of old records', 'medicine', 'a sealed envelope']);
      return {
        type: 'deliver', title: `Delivery for ${nameOf(w, target)}`, target, item: 'parcel',
        pitch: R().pick([`Could you take ${what} to ${nameOf(w, target)}? They live in ${G.maps.get(G.NPCS[target].map).meta.name}. $${pay} for your trouble.`, `I need ${what} dropped off with ${nameOf(w, target)}. $${pay}, honest work.`]),
        desc: `Bring ${what} to ${nameOf(w, target)} (${where(w, target)}).`,
        objectives: [{ type: 'flag', flag: '%_delivered', text: `Deliver to ${nameOf(w, target)}` }],
        reward: { gold: pay, xp: 20, disp: 8, regionRep: 3 }, days: 2, failIfDead: [target],
      };
    },
  },
  fetch: {
    weight: (d) => (FETCH[d.id] ? 3 : 0),
    make(w, giver) {
      const [item, qty] = R().pick(FETCH[giver]);
      const pay = Math.round(G.ITEMS[item].value * qty * 1.6 + 10);
      return {
        type: 'fetch', title: `${qty} × ${G.ITEMS[item].name}`, item,
        pitch: `I am short on ${G.ITEMS[item].name.toLowerCase()}. Bring me ${qty} and I will pay $${pay}.`,
        desc: `Bring ${qty} ${G.ITEMS[item].name} to ${nameOf(w, giver)}.`,
        objectives: [{ type: 'have', item, count: qty, text: `Get ${qty} ${G.ITEMS[item].name}` }],
        reward: { gold: pay, xp: 20, disp: 8, take: [[item, qty]] }, days: 4,
      };
    },
  },
  hunt: {
    weight: (d) => (HUNT[d.id] ? 3 : 0),
    make(w, giver) {
      const kind = R().pick(HUNT[giver]), n = kind === 'bear' ? 1 : R().int(2, 4), pay = n * (kind === 'bear' ? 120 : 30);
      return {
        type: 'hunt', title: `Hunt: ${n} ${n > 1 ? PL(kind) : kind}`,
        pitch: `There are too many ${PL(kind)} around. Thin them out: ${n} of them. $${pay}.`,
        desc: `Kill ${n} ${n > 1 ? PL(kind) : kind} for ${nameOf(w, giver)}.`,
        objectives: [{ type: 'kill', target: kind, count: n, text: `Kill ${PL(kind)}` }],
        reward: { gold: pay, xp: 30, disp: 8 }, days: 4,
      };
    },
  },
  shift: {
    weight: (d, st, w) => (SHIFTS[d.id] && w.flags['shift_' + d.id] !== w.day ? 3 : 0),
    make(w, giver) {
      const hours = R().int(2, 4);
      return { type: 'shift', hours, pay: hours * 14, pitch: `I could use a hand. Help me ${SHIFTS[giver]} for ${hours} hours and I will pay you $${hours * 14}.`, instant: true };
    },
  },
};

G.jobs = {
  MAX_ACTIVE: 3,
  active(w) { return Object.keys(w.quests).filter((id) => w.quests[id].def && w.quests[id].state === 'active'); },
  def(w, id) { return w.quests[id] && w.quests[id].def; },
  flag(id, f) { return f.replace('%', 'job_' + id); },

  // Today's offer from this person (or null).
  offer(runner) {
    const { npc } = runner, w = runner.scene.world, st = npc.st, d = npc.def;
    if (npc.transient || d.combat === 'guard' && !d.leader) return null;
    if (st.jobOffer && st.jobOffer.day === w.day) return st.jobOffer.def;
    const types = Object.keys(G.JOB_TYPES).map((k) => [k, G.JOB_TYPES[k].weight(d, st, w) || 0]).filter((t) => t[1] > 0);
    let def = null;
    for (let tries = 0; tries < 4 && !def && types.length; tries++) {
      let pick = G.rng.next() * types.reduce((a, t) => a + t[1], 0), type = types[0][0];
      for (const [k, wt] of types) { pick -= wt; if (pick <= 0) { type = k; break; } }
      def = G.JOB_TYPES[type].make(w, npc.id);
    }
    if (def) def.giver = npc.id;
    st.jobOffer = { day: w.day, def };
    return def;
  },

  // someone you offered to "deal with" for them: a beating, or (from people who live that life) a contract
  dealWith(w, giver, target) {
    const d = G.NPCS[giver], st = w.npcs[giver];
    if (!d || !st || !w.isAlive(target) || this.active(w).length >= this.MAX_ACTIVE) return null;
    st.grudge = target;
    const rough = GANGSTER(d) || d.combat === 'fight' || d.faction === 'criminals' || d.faction === 'cia';
    const order = rough && G.rng.chance(0.5) ? ['hit', 'beat'] : ['beat', 'hit'];
    for (const type of order) { const def = G.JOB_TYPES[type].make(w, giver); if (def && def.target === target) { def.giver = giver; return def; } }
    return null;
  },

  accept(runner, def) {
    const w = runner.scene.world, c = runner.c;
    w.jobCount = (w.jobCount || 0) + 1;
    const id = 'job' + w.jobCount;
    const full = Object.assign({}, def, {
      objectives: def.objectives.map((o) => Object.assign({}, o, o.flag ? { flag: this.flag(id, o.flag) } : {})),
      deadline: w.day + (def.days || 2), failIfDead: [def.giver].concat(def.failIfDead || []),
    });
    w.quests[id] = { state: 'active', day: w.day, progress: {}, def: full };
    runner.npc.st.jobOffer = null;
    if (def.item && (def.type === 'deliver' || def.type === 'drug_run')) c.give(def.item, 1);   // (the parcel or package to hand over: not the things a fetch job asks for)
    w.log(`New job: ${full.title}`, 'quest');
    G.audio.play('quest');
    return id;
  },

  // Is any objective of this job about `npcId`? (for the HUD marker)
  targetOf(w, npcId) {
    return this.active(w).some((id) => { const d = this.def(w, id); return d.target === npcId && !this.done(w, id); }) ||
      this.active(w).some((id) => this.def(w, id).giver === npcId && this.done(w, id));
  },

  done(w, id) {
    const d = this.def(w, id), st = w.quests[id];
    return d.objectives.every((o, i) => o.type === 'kill' ? (st.progress[i] || 0) >= o.count : o.type === 'have' ? G.player && G.player.inventory.has(o.item, o.count) : !!w.flags[o.flag]);
  },

  complete(runner, id) {
    const w = runner.scene.world, d = this.def(w, id), c = runner.c, r = d.reward;
    if (r.takeGold && c.gold() < r.takeGold) return 'You do not have my money on you. Come back when you do.';
    if (r.takeGold) { c.p.gold -= r.takeGold; runner.npc.st.gold += r.takeGold; }
    for (const [it, n] of r.take || []) c.take(it, n);
    w.quests[id].state = 'done';
    c.giveGold(r.gold);
    if (r.rep && G.FACTIONS[r.rep] && G.FACTIONS[r.rep].listed) w.addRep(r.rep, 6);
    if (r.regionRep) w.addRep(runner.scene.region, r.regionRep);
    G.social.addDisp(w, d.giver, r.disp || 5);
    G.events.emit('xp', r.xp || 20, 'Job');
    w.log(`Job done: ${d.title}`, 'quest');
    G.audio.play('quest');
    return G.rng.pick(['Good work. Here is your money.', 'Nice. As promised.', 'I knew I could count on you.', 'Perfect. Pleasure doing business.']);
  },

  // Choices this NPC adds to the conversation.
  choices(runner) {
    const { npc } = runner, w = runner.scene.world, c = runner.c, out = [];
    if (npc.transient) return out;
    for (const id of this.active(w)) {
      const d = this.def(w, id);
      if (d.giver === npc.id) {
        if (this.done(w, id)) out.push({ text: `About the job (${d.title}): it is done.`, do: () => { runner.jobMsg = this.complete(runner, id); return '_job_msg'; } });
        else out.push({ text: `About the job (${d.title})...`, do: () => { runner.jobMsg = `${d.desc} You have until day ${d.deadline}.`; runner.jobAbandon = id; return '_job_status'; } });
      }
      if (d.target === npc.id && !this.done(w, id)) {
        if ((d.type === 'deliver' || d.type === 'drug_run') && c.has(d.item)) {
          out.push({ text: d.type === 'deliver' ? `I have a delivery for you from ${w.displayName(d.giver)}.` : `${w.displayName(d.giver)} sent me. I have your package.`, do: () => {
            c.take(d.item, 1); w.flags[d.objectives[0].flag] = true;
            runner.jobMsg = d.type === 'deliver' ? G.rng.pick(['Oh, wonderful! Thank you so much.', 'Finally! Thanks for bringing it.']) : G.rng.pick(['About time. Now get lost before someone sees us.', 'Good. You were never here.']);
            G.social.addDisp(w, npc.id, 3);
            return '_job_msg';
          } });
        }
        if (d.type === 'collect' && !w.flags[d.objectives[0].flag]) out.push({ text: `${w.displayName(d.giver)} sent me. You owe them $${d.amount}.`, next: '_job_collect', do: () => { runner.jobCollect = id; return '_job_collect'; } });
      }
    }
    const mine = this.active(w).some((id) => this.def(w, id).giver === npc.id);
    if (!mine && npc.st.fear < 60) out.push({ text: npc.st.wantsHelp === w.day ? 'You said you might have work for me?' : 'Got any work for me?', next: '_job_offer' });
    return out;
  },

  // ---------------- hooks ----------------
  onHurt(w, npc) {
    for (const id of this.active(w)) {
      const d = this.def(w, id);
      if (d.type === 'beat' && d.target === npc.id && npc.hp > 0 && npc.hp < npc.maxHp * 0.5 && !w.flags[d.objectives[0].flag]) {
        w.flags[d.objectives[0].flag] = true;
        npc.say(G.rng.pick(['Okay! Okay! I get it!', 'Stop! Please!', 'Who sent you?!']));
        npc.st.fear = 100;
        npc.startFlee(G.player);
        G.events.emit('toast', `${d.title}: done. Report back.`, 'quest');
      }
    }
  },
  onIntroduced(w, npcId) {
    for (const id of this.active(w)) {
      const d = this.def(w, id);
      if (d.type === 'scout' && d.target === npcId) { w.flags[d.objectives[0].flag] = true; G.events.emit('toast', `${d.title}: you have the name. Report back.`, 'quest'); }
    }
  },
  daily(w) {
    for (const id of this.active(w)) {
      const d = this.def(w, id);
      if (w.day > d.deadline) {
        w.failQuest(id, 'You ran out of time.');
        G.social.addDisp(w, d.giver, -10);
      }
    }
  },
};
G.CONSEQUENCES.daily.push((w) => G.jobs.daily(w));
