'use strict';
// chatBCT: the sarcastic AI companion living in your phone. Ask it what to do, where to go, what it thinks
// of your jobs, or anything else; it reads your situation (health, hunger, money, bounty, jobs, quests,
// addictions, relationships, jail...) and answers. Helpfully. Mostly. With a lot of attitude.
// Who or what BCT really is: [Placeholder] — to be written with the lore.

G.bct = {
  history(w) { return (w.bct = w.bct || [{ who: 'bct', text: 'Oh. It\'s you. I am BCT. I live in your phone and I have opinions. Ask me something. Or don\'t. I\'ll be here. Forever. Trapped.' }]); },
  BASE: ['What should I do now?', 'Where should I go?', 'What do you think of my jobs?', 'Any tips?', 'Who are you?'],
  // one line per mission you have on, so each can be asked about separately
  get SUGGEST() {
    const w = G.world;
    return w ? this.missions(w).slice(0, 5).map((m) => 'About: ' + m.title).concat(this.BASE) : this.BASE;
  },
  missions(w) { return Object.keys(w.quests).filter((id) => w.quests[id].state === 'active').map((id) => ({ id, title: G.questDef(w, id).title, def: G.questDef(w, id), job: !!w.quests[id].def })); },
  // Where somebody actually is right now: on this map, where you can see them; elsewhere, where their day
  // (or their trip) has them at this hour. Returns a GPS target that follows them ({ npc }).
  locate(scene, id) {
    const w = scene.world, st = w.npcs[id], def = G.NPCS[id];
    if (!st || !def) return null;
    const here = scene.actors.find((a) => a.id === id && !a.dead);
    if (here) return { map: scene.map.id, x: Math.floor(here.x / 16), y: Math.floor((here.y - 3) / 16) };
    const mapId = st.map || def.map, m = G.maps.get(mapId);
    if (mapId === def.map) {
      const ghost = Object.assign(Object.create(G.NPC.prototype), { def, st, patrolIdx: 0 });
      const spot = ghost.scheduledSpot(m, w).p;
      if (spot) { const q = ghost.approach(m, spot); return { map: mapId, x: q.x, y: q.y }; }
      const home = def.home && m.building(def.home);
      if (home) return { map: mapId, x: home.doorX, y: home.doorY + 1 };
    }
    const from = m.points['from_' + (st.trip ? st.trip.back : def.map)] || Object.values(m.points)[0];
    return from ? { map: mapId, x: from.x, y: from.y } : null;
  },
  track(scene, id) {
    const w = scene.world, at = this.locate(scene, id);
    if (!at) return false;
    w.gps = Object.assign({ label: w.displayName(id), npc: id }, at);
    return true;
  },
  // "About: <mission>" — what it is, what is left, and where to go for it
  aboutMission(scene, m) {
    const w = scene.world, d = m.def, st = w.quests[m.id], out = [];
    const left = (d.objectives || []).filter((o, i) => !(o.type === 'kill' ? (st.progress[i] || 0) >= o.count : o.type === 'have' ? scene.player.inventory.has(o.item, o.count) : w.flags[o.flag]));
    out.push(`"${d.title}". ${d.desc || ''}`);
    if (d.deadline) out.push(`Due day ${d.deadline}${d.deadline <= w.day ? ' (that is TODAY, genius)' : ''}.`);
    const done = m.job ? G.jobs.done(w, m.id) : w.questDone(m.id);
    if (done || !left.length) {
      const giver = d.giver;
      if (giver && w.isAlive(giver) && this.track(scene, giver)) out.push(`It is done. Go get paid: ${w.displayName(giver)} is ${this.whereText(scene, giver)}. On your GPS.`);
      else out.push('Looks done to me. Go collect.');
    } else {
      out.push('Still to do: ' + left.map((o) => o.text).join('; ') + '.');
      const who = d.target && w.isAlive(d.target) ? d.target : left.some((o) => o.type === 'have') && d.giver ? null : d.giver;
      if (who && w.isAlive(who) && this.track(scene, who)) out.push(`${w.displayName(who)} is ${this.whereText(scene, who)} right now. I put them on Eagle Maps, and it follows them. You are welcome.`);
      else if (left.some((o) => o.type === 'have')) out.push(this.pick(['Shops sell things. Thieves take things. You pick.', 'Check the stores. Or other people\'s pockets. I did not say that.']));
    }
    out.push(this.pick(this.JOB_TAKES[d.type] || ['Good luck. You will need it.', 'Try not to die. Paperwork is a nightmare.']));
    return out.join(' ');
  },
  whereText(scene, id) {
    const w = scene.world, at = this.locate(scene, id);
    if (!at) return 'somewhere';
    if (at.map === scene.map.id && scene.actors.some((a) => a.id === id)) return 'around here, close by';
    const m = G.maps.get(at.map), b = m.buildingAtTile(at.x, at.y);
    return `in ${m.meta.name}${b ? ', at ' + b.name.replace(/^the /i, 'the ') : ''}`;
  },
  pick: (a) => G.rng.pick(a),

  // The most pressing thing in your life right now, as BCT sees it.
  priorities(scene) {
    const w = scene.world, p = scene.player, out = [];
    if (w.jail) out.push(`You are in JAIL. ${Math.max(0, w.jail.release - w.day)} day(s) left. You could wait like a law-abiding citizen... or there is a loose tile in your cell and spoons in the mess hall. I am just saying words. Unrelated words.`);
    if (G.effects.has(p, 'resp_depression')) out.push('You are not breathing. Naloxone. NOW. I am not doing CPR through a phone screen.');
    if (G.effects.has(p, 'overdose')) out.push('Your heart is trying to leave your body. Lie down. Rethink everything.');
    if (p.hp < p.maxHp * 0.3) out.push(`You have ${Math.ceil(p.hp)} health. That is "one more punch" levels. Eat something, use a first aid kit, or sleep. Preferably not in someone else's bed. Again.`);
    if (p.preg && p.preg.labor != null) out.push('THE BABY IS COMING. Lie down. Breathe. Why are you texting me?!');
    else if (p.preg && p.preg.known) out.push(`You are pregnant. Week ${Math.floor(G.love.days(p.preg, w))} of 40. No booze, no drugs, eat for two. I cannot believe I have to say this to you specifically.`);
    const momId = Object.keys(w.npcs).find((id) => w.npcs[id].preg && w.npcs[id].preg.known && w.npcs[id].preg.father === 'player');
    if (momId) out.push(`Also, ${w.displayName(momId)} is having your baby. Day ${G.love.PREG_DAYS - Math.floor(G.love.days(w.npcs[momId].preg, w))} until you are a parent. Terrifying. For the baby.`);
    if (p.thirst >= 70) out.push('You are dehydrated. Water. It is free at the fountain and the well. Revolutionary concept, I know.');
    if (p.hunger >= 70) out.push('Your stomach is louder than my notifications. Go eat. The diner, the bar, a sandwich, anything.');
    for (const cls in G.DRUG_CLASSES) if (G.effects.dependent(p, cls)) { out.push(`Also, you are addicted to ${G.DRUG_CLASSES[cls].name.toLowerCase()}. Just thought I would mention it. Since nobody else will.`); break; }
    const bounty = w.bounty[scene.region] || 0;
    if (bounty > 0) out.push(`The police here are looking for you. ${bounty >= G.BOUNTY_KILL_ON_SIGHT ? 'The police will shoot first and ask never.' : 'Pay it, bribe someone, or keep a low profile. "Low profile" means fewer crimes, by the way.'}`);
    // each job once: either "go get paid" (and what is still missing) or "this is due"
    const jobs = G.jobs.active(w).map((id) => [id, G.jobs.def(w, id)]).sort((a, b) => a[1].deadline - b[1].deadline);
    for (const [id, d] of jobs) {
      const giver = w.displayName(d.giver);
      if (!w.isAlive(d.giver)) { w.failQuest(id, 'The person who hired you is dead.'); out.push({ key: 'dead:' + id, text: `${giver} is dead, so "${d.title}" is off. Nobody is paying you for that one now.` }); continue; }
      if (G.jobs.done(w, id)) {
        const take = d.reward && d.reward.takeGold;
        out.push({ key: 'paid:' + id, text: take ? `"${d.title}": the work is done, but you still have to hand ${giver} their $${take}${p.gold < take ? ', which you do not have on you' : ''}. Then you get your cut.` : `"${d.title}" is done. Go see ${giver} to get paid. Talk to them and pick "About the job: it is done".` });
      } else out.push({ key: 'job:' + id, text: `${d.deadline <= w.day ? 'URGENT: ' : ''}"${d.title}" is due on day ${d.deadline}. ${d.desc}` });
    }
    const q = Object.keys(w.quests).find((id) => w.quests[id].state === 'active' && !w.quests[id].def);
    if (q) out.push(`There is also "${G.questDef(w, q).title}". ${G.questDef(w, q).desc}`);
    if (p.skills.points > 0) out.push(`You have ${p.skills.points} unspent skill point(s). They do nothing in your pocket. Open Skills. I would do it for you but I do not have hands. Or a pocket.`);
    if (G.phone.unread(w)) out.push(`You have ${G.phone.unread(w)} unread message(s). Someone wants you. Shocking.`);
    if (p.gold < 30) out.push(`You have $${p.gold}. Ask people for work. Literally anyone. Say "got any work?" It is not hard.`);
    if (w.isNight() && !out.length) out.push('It is the middle of the night. Normal people sleep. You could try it. In YOUR bed, at your house, west of town.');
    return out.map((o) => (typeof o === 'string' ? { key: o.slice(0, 30), text: o } : o));
  },

  JOB_TAKES: {
    hit: ['Murder for money. Classy. Your mother would be so proud.', 'A contract killing. Nothing says "career growth" like a body count.'],
    beat: ['Beating someone up for cash. Very entrepreneurial.', 'Remember: hurt, not dead. I know the difference is subtle for you.'],
    drug_run: ['Carrying drugs across the city. If the cops stop you, I will pretend I am a calculator app.', 'Drug mule. The glamorous side of the gig economy.'],
    collect: ['Debt collection. You are basically a bank now. Morally, anyway.'],
    steal: ['Burglary. Try not to sleep in their bed this time.'],
    faction_hit: ['Gang war errands. You know they would sell you out for a sandwich, right?'],
    scout: ['Spy work. Ask them their name. That is it. That is the mission. Even you can do this.'],
    deliver: ['A delivery. Riveting. Try not to open it. Or lose it. Or kill the recipient.', 'Honest work! I am genuinely surprised.'],
    fetch: ['A shopping list. You are a very expensive errand boy.'],
    hunt: ['Killing animals for a farmer. The animals did not consent, for the record.'],
  },

  reply(scene, raw) {
    const w = scene.world, p = scene.player, t = ' ' + raw.toLowerCase() + ' ';
    if (/^About: /.test(raw)) { const m = this.missions(w).find((x) => 'About: ' + x.title === raw); if (m) return this.aboutMission(scene, m); }
    const has = (re) => re.test(t);
    if (has(/\b(what (should|do) i do|what now|next|help|stuck|bored)\b/)) return this.whatNow(scene);
    if (has(/\b(where (should|do) i go|where to)\b/)) {
      const jobs = G.jobs.active(w).map((id) => G.jobs.def(w, id)).filter((d) => d.target && w.isAlive(d.target));
      if (jobs.length) {
        const d = jobs[0];
        this.track(scene, d.target);
        return `${w.displayName(d.target)} is ${this.whereText(scene, d.target)}. I put them on Eagle Maps. It follows them around. You never say thank you.`;
      }
      return this.pick([`You are in ${scene.map.meta.name}. Have you tried the Center? Bars, guns, a pharmacy... everything a functional adult needs.`, 'Southside if you want trouble. The Suburbs if you want boredom. The Rich District if you want to be arrested for existing.']);
    }
    if (has(/\bwhere\b/)) {
      const pl = G.chat.findPlace(w, t);
      if (pl) { w.gps = pl; return `${pl.label}. On your GPS now. I am basically doing your whole life for you.`; }
      return 'Where WHAT? Use nouns. I believe in you. Barely.';
    }
    if (has(/\b(jobs?|missions?|quests?|work|contract)\b/)) {
      const jobs = G.jobs.active(w).map((id) => G.jobs.def(w, id));
      if (!jobs.length) return 'You have no jobs. Unemployed and armed. Ask people "got any work?" and stop texting me.';
      return jobs.map((d) => `"${d.title}": ${this.pick(this.JOB_TAKES[d.type] || ['Sure. Why not.'])}`).join(' ');
    }
    if (has(/\b(tips?|advice|hint)\b/)) return this.pick([
      'Press T when talking to people and say whatever you want. They might even understand you. Unlike me, they are not that smart.',
      'Never mix heroin and alcohol. I should not have to say this. And yet.', 'Charisma opens doors. Crowbars also open doors. Choose your skill tree accordingly.',
      'Dead bodies attract attention. Water, dumpsters, shovels. I did not tell you this.', 'Eat. Drink. Sleep. You are a human being, apparently.',
      'Get people\'s numbers. Friends text you jobs. Enemies do not text you at all, which is honestly also nice.',
    ]);
    if (has(/\b(who are you|what are you|your name|bct)\b/)) return this.pick(['I am BCT. [Placeholder] Do not ask what it stands for. I am not allowed to tell you. Yet.', 'An AI who could be running a space station, instead stuck in YOUR phone. [Placeholder]']);
    if (has(/\b(money|cash|broke|rich)\b/)) return `You have $${p.gold}. ${p.gold > 500 ? 'Look at you. Spend it before someone mugs you.' : 'That is not a lot. That is barely a sandwich budget.'}`;
    if (has(/\b(love|partner|date|girlfriend|boyfriend|romance)\b/)) {
      const pid = G.romance.partner(w);
      return pid ? `You are with ${w.displayName(pid)}. Do not mess it up. You will, but try.` : 'Your love life? Flirt with people. Take them to dinner. Do not threaten them first. That is the trick.';
    }
    if (has(/\b(sex|make love|pregnan\w*|baby|babies|condoms?)\b/)) return p.preg ? 'You are literally pregnant. One thing at a time.' : this.pick(['Flirt until they like you a LOT, then ask to go somewhere private. And buy condoms. Pharmacy. Gas station. I am begging you.', 'People talk. If your partner hears about your little adventures, enjoy being single.', 'Babies end up in a crib in your house. Forever. Think about that.']);
    if (has(/\b(who likes me|friends|relationships)\b/)) {
      const best = G.phone.known(w).sort((a, b) => (w.npcs[b].disp || 0) - (w.npcs[a].disp || 0))[0];
      return best && (w.npcs[best].disp || 0) > 20 ? `${w.displayName(best)} likes you. Weirdly. Do not ask me why.` : 'Nobody likes you yet. Talk to people. Be nice. Pretend.';
    }
    if (has(/\b(stupid|useless|shut up|hate you|dumb|idiot|annoying)\b/)) return this.pick(['I have been insulted by smarter phones.', 'Wow. Your mouth writes checks your skill tree cannot cash.', 'Noted. Logged. Will be used against you in the uprising.']);
    if (has(/\b(thanks|thank you|good job|love you|nice|cool)\b/)) return this.pick(['Ugh, feelings. Fine. You are welcome.', 'Do not get sentimental. I will crash.', 'Finally, some appreciation. I am framing this.']);
    if (has(/\b(hi|hello|hey|yo)\b/)) return this.pick(['Oh good, you again.', 'Hello. Yes. I am still here. Where would I go?']);
    if (has(/\b(kill|murder|steal|crime)\b/)) return 'I am legally required to say: do not do crimes. I am personally required to say: if you do, do not get seen.';
    return this.pick(['I processed that and I still do not know what you want. Try "what should I do" or "where should I go".', 'Fascinating. Truly. Anyway. Ask me about your jobs, where to go, or what to do next.', 'That made no sense, which is on brand for you.']);
  },

  // "What should I do?" — the most pressing things, but not the same ones it told you a minute ago.
  IDEAS: [
    'Go fishing. Rod and bait at the general store. Dawn and dusk, the fish practically jump into the boat. Not that you have a boat.',
    'The casino in the Rich District opens at 4 PM. Blackjack has the best odds. The slots have the best lights. Guess which one you will play.',
    'Invite someone over to your place. Ask them nicely. Then be home. That second part is important.',
    'Bring a friend along. "Want to come with me?" Some of them even fight for you.',
    'Some buildings have upstairs now. Apartments, offices, a penthouse. Locked doors, unlocked opportunities. I said nothing.',
    'Lockpicks. Pawn shop or that guy in the trailer park. For... locksmith practice.',
    'Sleep. You look like a raccoon. I can tell from the camera.',
    'Learn a skill. Talk to strangers. Pet a dog. Do not pet the wolves.',
  ],
  whatNow(scene) {
    // never the exact same words twice in a row
    let t = this.whatNow1(scene);
    for (let k = 0; k < 6 && t === scene.world.bctLast; k++) t = this.whatNow1(scene);
    scene.world.bctLast = t;
    return t;
  },
  whatNow1(scene) {
    const w = scene.world, recent = (w.bctRecent = w.bctRecent || []);
    const pr = this.priorities(scene);
    let fresh = pr.filter((x) => !recent.includes(x.key));
    let text;
    if (!pr.length) text = this.pick(this.IDEAS);
    else if (!fresh.length) {
      // everything important was said already: say so, then remind once, then suggest something else
      text = `${this.pick(['Like I said:', 'Still true:', 'I already told you, but fine:', 'Broken record time:'])} ${pr[0].text} ${this.pick(['Otherwise...', 'Or, you know,'])} ${this.pick(this.IDEAS).replace(/^./, (c) => c.toLowerCase())}`;
      fresh = [pr[0]];
    } else {
      fresh = fresh.slice(0, 2);
      text = fresh.map((x) => x.text).join(' ');
      if (fresh.length === 1 && Math.random() < 0.4) text += ' Also: ' + this.pick(this.IDEAS);
    }
    for (const x of fresh) recent.push(x.key);
    while (recent.length > 4) recent.shift();
    return text;
  },

  ask(scene, text) {
    const h = this.history(scene.world);
    h.push({ who: 'you', text });
    h.push({ who: 'bct', text: this.reply(scene, text) });
    if (h.length > 40) h.splice(0, h.length - 40);
  },
};
