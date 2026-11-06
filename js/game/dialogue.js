'use strict';
// Dialogue runner: resolves nodes from G.DIALOGUES, builds the context API used by dialogue data,
// appends standard choices, and handles reactions (fear, grief, arrests, threats).

// Other systems register extra conversation nodes and standard choices here.
G.DIALOGUE_NODES = G.DIALOGUE_NODES || {};
G.DIALOGUE_CHOICES = G.DIALOGUE_CHOICES || [];

class DialogueRunner {
  constructor(npc, scene, treeId) {
    this.npc = npc;
    this.scene = scene;
    this.tree = G.DIALOGUES[treeId || npc.def.dialogue || 'generic'] || G.DIALOGUES.generic;
    this.ended = false;
    this.c = this.makeContext();
    npc.st.talked = (npc.st.talked || 0) + 1;
    const st = npc.st;
    if (treeId === '_arrest' || treeId === '_mugging' || treeId === '_jailcall' || treeId === '_debt') this.go('start');
    else if (st.mood === 'grieving' && !npc.def.shop) this.go('_grieving');
    else if (st.fear >= 60 || (scene.world.knownKiller[scene.region] && npc.def.combat === 'flee' && G.rng.chance(0.5))) this.go('_afraid');
    else this.go('start');
  }

  makeContext() {
    const npc = this.npc, scene = this.scene, w = scene.world, p = scene.player, self = this;
    const c = {
      npc, def: npc.def, st: npc.st, w, p, scene, region: scene.region,
      flag: (k) => w.flags[k],
      set: (k, v = true) => { w.flags[k] = v; },
      rep: (k) => w.getRep(k),
      addRep: (k, n) => w.addRep(k, n),
      gold: () => p.gold,
      pay: (n) => { if (p.gold < n) return false; p.gold -= n; npc.st.gold += n; G.audio.play('coin'); return true; },
      giveGold: (n) => { p.gold += n; G.audio.play('coin'); scene.toast(`+$${n}`); },
      has: (id, n = 1) => p.inventory.has(id, n),
      give: (id, n = 1) => { const left = p.inventory.add(id, n); if (left) G.containers.createBag(w, scene.map.id, p.x, p.y, [[id, left]]); scene.refreshContainers(); scene.toast(`Received ${G.item(id).name}${n > 1 ? ' x' + n : ''}`); },
      take: (id, n = 1) => p.inventory.remove(id, n),
      quest: (id) => w.quest(id),
      startQuest: (id) => { w.startQuest(id); G.audio.play('quest'); },
      completeQuest: (id) => { if (w.completeQuest(id)) G.audio.play('quest'); },
      failQuest: (id) => w.failQuest(id),
      openShop: () => { const sid = G.shopSys.shopFor(npc.id, w); if (sid) self.afterEnd = () => G.scenes.push(new G.ShopScene(scene, sid, npc)); self.end(); },
      wait: (h) => scene.passTime(h, false),
      heal: (n) => { p.hp = Math.min(p.maxHp, p.hp + n); },
      hostile: (all = false) => {
        npc.st.hostile = true;
        if (all) for (const a of scene.actors) if (a.kind === 'npc' && a.def.faction === npc.def.faction) a.st.hostile = true;
        self.end();
      },
      bounty: () => w.bounty[scene.region] || 0,
      clearBounty: () => w.clearBounty(scene.region),
      dead: (id) => !w.isAlive(id),
      log: (t) => w.log(t),
      rumor: (t, r) => w.rumor(t, r === undefined ? scene.region : r),
      travel: (map, spawn) => { self.afterEnd = () => scene.changeMap(map, spawn); },
      ending: () => {},   // the game is endless for now: no ending triggers (EndingScene is kept for later)
      roomPrice: () => { const sid = G.shopSys.shopFor(npc.id, w); return sid && G.SHOPS[sid].room ? Math.round(G.SHOPS[sid].room * G.shopSys.repMult(w, scene.region)) : 10; },
      hasRoom: () => w.rooms[scene.map.id] === w.day + (w.hour >= 12 ? 1 : 0),
      rentRoom: () => { w.rooms[scene.map.id] = w.day + (w.hour >= 12 ? 1 : 0); },
      greet: () => self.greeting(),
      openBarber: () => { self.afterEnd = () => G.scenes.push(new G.BarberScene(scene, npc)); self.end(); },
      // Speech checks. A failed check cannot be retried with the same person until tomorrow.
      // people who like you are easier to persuade (disposition shifts the difficulty)
      tag: (diff, stat = 'charisma') => G.checkTag(p, diff - Math.round((npc.st.disp || 0) / 25), stat),
      canTry: (key) => !(npc.st.checks && npc.st.checks[key] === w.day),
      check: (key, diff, stat = 'charisma') => {
        const ok = G.skills.roll(p, diff - Math.round((npc.st.disp || 0) / 25), stat);
        if (!ok) (npc.st.checks = npc.st.checks || {})[key] = w.day;
        return ok;
      },
      skill: (id) => G.skills.has(p, id),
    };
    return c;
  }

  greeting() {
    const { npc, scene } = this;
    const w = scene.world;
    const rep = w.getRep(scene.region);
    if (npc.def.combat === 'guard' && (w.bounty[scene.region] || 0) > 0) return 'I have got my eye on you, punk.';
    if (npc.st.mood === 'homeless') return 'My home... it is all ashes now. What do you want?';
    if (this.revealsFaction()) {
      const fr = w.getRep(npc.def.faction);
      if (w.isMember(npc.def.faction)) return G.rng.pick(['Good to see you, comrade.', 'One of us. What do you need?']);
      if (fr >= 35) return 'Good to see you. We do not forget our friends.';
      if (fr <= -25) return 'You have some nerve showing your face around us.';
    }
    if (rep >= 40) return G.rng.pick(['Ah, a friend! Good to see you.', 'Always a pleasure.', 'Welcome back, friend.']);
    if (rep <= -30) return G.rng.pick(['You again. What do you want?', 'Make it quick.', 'I would rather not talk to you.']);
    const disp = npc.st.disp || 0;
    if (disp >= 50) return G.rng.pick(['There you are! Good to see you.', 'Hey, it is my favorite person!', 'Oh, hi! I was hoping you would stop by.']);
    if (disp <= -50) return G.rng.pick(['You. What do you want now?', 'I have nothing to say to you.', 'Make it quick. I do not like you.']);
    if (w.hour >= 22 || w.hour < 6) return G.rng.pick(['It is late. What do you want?', 'Do you know what time it is?', 'Can this wait until morning?']);
    // each personality greets differently, and nobody says exactly the same thing every day
    const P = G.social.persona(npc.id);
    const byTrait = {
      friendly: ['Hi! How are you?', 'Hey there, friend.', 'Good to see a friendly face.'],
      grumpy: ['What.', 'Yeah? What is it?', 'Ugh. Hello.'],
      nervous: ['Oh! You scared me.', 'H-hello?', 'Can I... help you?'],
      chatty: ['Hey! Have I got stories for you.', 'Oh good, someone to talk to!', 'Hi hi hi! What is new?'],
      proud: ['Ah. Hello.', 'You are talking to me? Good choice.', 'Yes? I am rather busy.'],
      tired: ['Mm. Hey.', 'Long day... what do you need?', 'Hi. Sorry, I barely slept.'],
      cheerful: ['Hello! Lovely day, is it not?', 'Hey hey!', 'Hi! Nice to see you!'],
      suspicious: ['Who is asking?', 'What do you want?', 'I do not know you. Do I?'],
    }[P.trait];
    if (disp >= 20) return G.rng.pick(['Hey, good to see you again.', 'Oh, hello again!', 'Back again? Good.']);
    return byTrait[G.util.hashString(npc.id + w.day + (npc.st.talked || 0)) % byTrait.length];
  }

  // Is this NPC openly part of their faction to the player? Covert factions deny everything until trusted.
  revealsFaction() {
    const f = this.npc.faction, w = this.scene.world;
    const trust = G.skills.has(this.scene.player, 'read_people') ? 0 : 20;
    return f.listed && (!f.covert || w.getRep(this.npc.def.faction) >= trust || w.isMember(this.npc.def.faction));
  }

  // Standard choices appended to `common` nodes
  commonChoices() {
    const { npc, scene } = this;
    const w = scene.world;
    const out = [];
    const f = npc.faction, fid = npc.def.faction;
    if (!npc.st.introduced) out.push({ text: "What's your name?", next: '_name' });
    if (f.listed && !npc.def.leader) out.push({ text: 'Who do you run with?', next: '_f_member' });
    if (npc.def.leader && f.listed) {
      out.push({ text: 'Who are you people?', next: '_f_about' });
      if (this.revealsFaction()) {
        out.push({ text: 'Is there work for me?', next: '_f_work' });
        if (!w.isMember(fid)) out.push({ text: `I want to join ${/^the /i.test(f.name) ? 'the ' + f.name.slice(4) : 'the ' + f.name}.`, next: '_f_join' });
        out.push({ text: 'A contribution for the cause. ($50)', next: '_f_give' });
        if ((fid === 'cia' || fid === 'government') && w.flags.knows_rev_hideout && !w.flags.rev_betrayed && w.isAlive('f_rev_leader')) {
          out.push({ text: 'I know where the revolutionaries meet.', next: '_f_betray' });
        }
        const contract = fid === 'gang_red' ? 'red_contract' : fid === 'gang_blue' ? 'blue_contract' : null;
        if (contract && !w.quest(contract) && w.getRep(fid) >= 15) out.push({ text: 'Need someone to deal with the other gang?', next: '_f_contract' });
        if (contract && w.questDone(contract)) out.push({ text: 'It is done. Their boss is dead.', do: (c) => c.completeQuest(contract), next: null });
        if (G.GANGS.includes(fid) && w.isMember(fid) && !w.raid && G.gangWar.targets(w, fid).length) out.push({ text: 'Let\'s take some territory.', next: '_gang_attack' });
      }
      out.push({ text: 'Your days are numbered.', next: '_f_threat' });
    }
    const sid = G.shopSys.shopFor(npc.id, w);
    if (sid) {
      if (G.shopSys.isOpen(sid, scene)) {
        out.push({ text: 'Let me see your wares.', do: (c) => c.openShop() });
        if (w.flags['haggle_' + sid] !== w.day && this.c.canTry('haggle')) out.push({ text: `${this.c.tag(G.haggleDifficulty(w, sid))} Can you do better on the prices?`, next: '_haggle' });
      } else out.push({ text: 'Are you open?', next: '_closed' });
    }
    if (this.availableTopics().length) out.push({ text: npc.st.talkedTopics ? 'Let\'s keep talking.' : 'Let\'s talk.', next: '_chat' });
    else out.push({ text: 'Let\'s talk.', next: '_chat_none' });
    for (const ch of G.jobs.choices(this)) out.push(ch);
    for (const fn of G.DIALOGUE_CHOICES) for (const ch of fn(this)) out.push(ch);
    out.push({ text: 'Any news?', next: '_rumor' });
    if (npc.def.combat !== 'guard' && !npc.faction.outlaw) out.push({ text: `Hand over your cash. ${this.c.tag(G.threatDifficulty(npc), 'intimidate')}`, next: '_threaten' });
    out.push({ text: 'Goodbye.', next: null });
    return out;
  }

  // Topics this person has not talked about with you recently (never the same one twice in a week).
  availableTopics() {
    const { npc } = this, w = this.scene.world, c = this.c;
    if (npc.transient || npc.st.fear >= 60) return [];
    const used = npc.st.topics || {};
    const P = G.social.persona(npc.id);
    const out = [];
    for (const id in G.TOPICS) {
      if (used[id] != null && w.day - used[id] < 7) continue;
      const t = G.TOPICS[id];
      const x = t.when ? t.when(c, P) : true;
      if (x) out.push({ t, x: typeof x === 'object' ? x : {} });
    }
    return out;
  }

  builtinNode(id) {
    const { npc, scene } = this;
    const w = scene.world;
    if (G.DIALOGUE_NODES[id]) return G.DIALOGUE_NODES[id](this);   // nodes added by other systems (romance, chat, jail...)
    switch (id) {
      case '_chat': {
        const topics = this.availableTopics();
        if (!topics.length) return this.builtinNode('_chat_none');
        // prefer topics about the here and now, then personal ones; avoid what other people just talked about
        const recent = w.recentTopics || [];
        topics.sort((a, b) => (recent.includes(a.t.id) ? 1 : 0) - (recent.includes(b.t.id) ? 1 : 0) || (b.t.when ? 1 : 0) - (a.t.when ? 1 : 0) || G.rng.next() - 0.5);
        const pick = G.rng.chance(0.75) ? topics[0] : G.rng.pick(topics);
        const P = G.social.persona(npc.id), c = this.c;
        (npc.st.topics = npc.st.topics || {})[pick.t.id] = w.day;
        if (G.rel && ['hobby', 'worry', 'dream', 'origin'].includes(pick.t.id)) G.rel.learn(npc.st, pick.t.id);   // now you know it (LifeLog > Relationships)
        npc.st.talkedTopics = (npc.st.talkedTopics || 0) + 1;
        w.recentTopics = recent.concat(pick.t.id).slice(-6);
        const variant = pick.t.lines[G.util.hashString(npc.id + pick.t.id + npc.st.talkedTopics) % pick.t.lines.length];
        return {
          text: variant(c, P, pick.x),
          choices: pick.t.replies.filter((r) => !r.if || r.if(c)).map((r) => ({
            text: typeof r.text === 'function' ? r.text(c, P, pick.x) : r.text,
            do: () => {
              let ok = true;
              if (r.check) ok = c.check('topic_' + pick.t.id, r.check[0], r.check[1] || 'charisma');
              const list = ok ? r.res : r.fail || r.res;
              this.chatRes = list[G.rng.int(0, list.length - 1)](c, P, pick.x);
              G.social.addDisp(w, npc.id, ok ? r.disp || 0 : r.failDisp != null ? r.failDisp : -Math.abs(r.disp || 0));
              if (ok && r.do) r.do(c, pick.x);
              // "Want me to deal with them?": the job is offered right here (a beating, or a contract)
              if (ok && r.job && pick.x && G.jobs.dealWith) { const def = G.jobs.dealWith(w, npc.id, pick.x.id); if (def) { npc.st.jobOffer = { day: w.day, def }; return '_job_offer'; } }
              return '_chat_r';
            },
          })),
        };
      }
      case '_chat_r': {
        const more = this.availableTopics().length > 0;
        const d = npc.st.disp || 0;
        const mood = d >= 40 ? ' They smile at you.' : d <= -40 ? ' They glare at you.' : '';
        return {
          text: this.chatRes + (mood ? `\n(${mood.trim()})` : ''),
          choices: [{ text: 'What else is on your mind?', if: () => more, next: '_chat' }, { text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }],
        };
      }
      // ---- radiant jobs (js/game/jobs.js)
      case '_job_offer': {
        const back = [{ text: 'Something else...', next: 'start' }];
        if (G.jobs.active(w).length >= G.jobs.MAX_ACTIVE) return { text: 'You look busy enough already. Finish what you have first.', choices: back };
        if ((npc.st.disp || 0) <= -40) return { text: 'Work? For you? No.', choices: back };
        const def = G.jobs.offer(this);
        if (!def) return { text: G.rng.pick(['Nothing right now. Check back another day.', 'Not today, sorry.', 'I have nothing for you.']), choices: back };
        if (def.type === 'shift') {
          return {
            text: def.pitch,
            choices: [{ text: `Let's do it. (${def.hours} hours)`, do: () => {
              w.flags['shift_' + npc.id] = w.day;
              npc.st.jobOffer = null;
              scene.passTime(def.hours, false);
              scene.player.stamina = Math.max(0, scene.player.stamina - 30 * def.hours);
              this.c.giveGold(def.pay);
              G.social.addDisp(w, npc.id, 6);
              G.events.emit('xp', 8 * def.hours, 'Work');
              this.jobMsg = G.rng.pick(['Thanks. That was a big help.', 'Good, honest work. Here is your pay.', 'You are a hard worker. Come back any time.']);
              return '_job_msg';
            } }, { text: 'Maybe later.', next: 'start' }],
          };
        }
        return {
          text: def.pitch,
          choices: [
            { text: 'Consider it done.', do: () => { G.jobs.accept(this, def); this.jobMsg = def.type === 'hit' ? 'Good. Do not get caught, and do not mention my name.' : 'Great. Come back when it is done.'; return '_job_msg'; } },
            { text: `${this.c.tag(7)} Make it worth my while. More money.`, if: () => this.c.canTry('job_haggle') && def.reward, do: () => {
              if (this.c.check('job_haggle', 7)) { def.reward.gold = Math.round(def.reward.gold * 1.4); this.jobMsg = `Fine. $${def.reward.gold}. Not a cent more.`; }
              else this.jobMsg = 'Take it or leave it.';
              return '_job_haggled';
            } },
            { text: 'Not interested.', next: 'start' },
          ],
        };
      }
      case '_job_haggled':
        return { text: this.jobMsg, choices: [{ text: 'Deal.', do: () => { G.jobs.accept(this, npc.st.jobOffer.def); this.jobMsg = 'Good. Get to it.'; return '_job_msg'; } }, { text: 'No thanks.', next: 'start' }] };
      case '_job_msg':
        return { text: this.jobMsg, choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
      case '_job_status':
        return {
          text: this.jobMsg,
          choices: [{ text: 'I am on it.', next: 'start' }, { text: 'I am not doing this job anymore.', do: () => { w.failQuest(this.jobAbandon, 'You quit.'); G.social.addDisp(w, npc.id, -8); this.jobMsg = 'Figures. Do not bother asking again for a while.'; return '_job_msg'; } }],
        };
      case '_job_collect': {
        const id = this.jobCollect, d = G.jobs.def(w, id), f = d.objectives[0].flag, c = this.c;
        return {
          text: G.rng.pick([`$${d.amount}?! I do not have that kind of money!`, `Please... I just need a few more days.`, `I already told them I would pay. Eventually.`]),
          choices: [
            { text: `${c.tag(npc.def.combat === 'flee' ? 4 : 8, 'intimidate')} Pay up, or this gets ugly.`, if: () => c.canTry('collect_' + id), do: () => {
              if (c.check('collect_' + id, npc.def.combat === 'flee' ? 4 : 8, 'intimidate')) { c.p.gold += d.amount; w.flags[f] = true; npc.st.fear = Math.max(npc.st.fear, 60); G.social.addDisp(w, npc.id, -15); G.audio.play('coin'); this.jobMsg = 'Okay! Okay. Here. Take it and leave me alone.'; scene.reportCrime('extortion', npc); }
              else this.jobMsg = 'No. Get out of my face.';
              return '_job_msg';
            } },
            { text: `${c.tag(6)} Pay what you can now and I will cover the rest.`, if: () => c.canTry('collect2_' + id), do: () => {
              if (c.check('collect2_' + id, 6)) { const part = Math.round(d.amount / 2); c.p.gold += part; w.flags[f] = true; G.social.addDisp(w, npc.id, 8); this.jobMsg = `...Here is $${part}. Thank you for understanding. Really.`; }
              else this.jobMsg = 'I cannot. I am sorry.';
              return '_job_msg';
            } },
            { text: 'Never mind.', next: 'start' },
          ],
        };
      }
      case '_chat_none':
        return { text: G.rng.pick(['I think we have talked enough for one day.', 'I am all talked out. Come back another time.', 'Not much else to say, really.']), choices: [{ text: 'Something else...', next: 'start' }] };
      case '_rumor': {
        const rel = w.rumors.filter((r) => !r.region || r.region === scene.region).slice(-4);
        const fallback = {
          rural: ['Harvest looks good this year.', 'The river has been high lately.', 'Quiet day. I like quiet days.'],
          city: ['The cops have been busy lately.', 'Ships from far away have been arriving at the harbor.', 'Prices at the market keep going up.'],
          forest: ['Watch out for wolves at night.', 'The deer have been skittish.', 'Something moves in the old ruins.'],
          island: ['...'],
        }[scene.region] || ['Nothing new.'];
        const text = rel.length ? rel[G.util.hashString(npc.id + w.day) % rel.length].text : G.rng.pick(fallback);
        return { text: `"${text}"`, choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
      }
      case '_closed': {
        const s = G.SHOPS[G.shopSys.shopFor(npc.id, w)];
        let text = 'We are closed. Come back during working hours.';
        if (w.isHomeLost(npc.def)) text = 'Closed? It burned to the ground! There is nothing left to sell.';
        else if (s && s.faction && w.getRep(s.faction) < (s.minRep || 0)) text = 'We do not sell to people we do not trust.';
        return { text, choices: [{ text: 'Something else...', next: 'start' }] };
      }
      // A gang member picks the next block to hit. The attack starts now; be there to make it count.
      case '_gang_attack': {
        const fid = npc.def.faction;
        const choices = G.gangWar.targets(w, fid).map((tid) => {
          const st = w.territories[tid], t = G.TERRITORIES[tid];
          return {
            text: `${t.name} (${st.owner ? G.FACTIONS[st.owner].name + ', control ' + st.control : 'unclaimed'})`,
            do: () => {
              G.gangWar.startRaid(w, fid, tid, { playerLed: true });
              npc.say('Let\'s roll.');
              return '_gang_go';
            },
          };
        });
        return { text: 'Where do we hit them?', choices: choices.concat([{ text: 'Not yet.', next: 'start' }]) };
      }
      case '_gang_go': {
        const t = w.raid && G.TERRITORIES[w.raid.territory];
        return { text: t ? `Our crew is moving on ${t.name}. Get over there in the next two hours, and make sure we win.` : 'Go.', choices: [{ text: '[Leave]', next: null }] };
      }
      case '_haggle': {
        const sid = G.shopSys.shopFor(npc.id, w);
        const ok = this.c.check('haggle', G.haggleDifficulty(w, sid));
        if (ok) w.flags['haggle_' + sid] = w.day;
        return {
          text: ok ? G.rng.pick(['Fine, fine. For you, 15% off today. Do not tell anyone.', 'You drive a hard bargain. Alright, a better price, just for today.'])
            : G.rng.pick(['Nice try. Prices are prices.', 'Do I look like a charity to you?']),
          choices: [{ text: 'Let me see your wares.', if: () => ok, do: (c) => c.openShop() }, { text: 'Something else...', next: 'start' }],
        };
      }
      case '_name': {
        const back = [{ text: 'Something else...', next: 'start' }];
        if (npc.st.fear >= 60 || w.getRep(scene.region) <= -40) {
          return {
            text: 'Why would I tell YOU that?',
            choices: [{ text: `${this.c.tag(6)} Relax. I just want to talk.`, if: (c) => c.canTry('name'), do: (c) => { if (c.check('name', 6)) { npc.st.fear = Math.min(npc.st.fear, 40); return '_name_ok'; } return '_name_no'; } }].concat(back),
          };
        }
        npc.st.introduced = true; G.jobs.onIntroduced(w, npc.id);
        const role = npc.st.name;
        const intro = npc.faction.gang || npc.def.faction === 'punks' ? `They call me ${npc.st.realName}.` : `I'm ${npc.st.realName}.`;
        return { text: role === 'Civilian' ? intro : `${intro} ${role}, at your service... more or less.`, choices: back };
      }
      case '_name_ok': {
        npc.st.introduced = true; G.jobs.onIntroduced(w, npc.id);
        return { text: `...Fine. I'm ${npc.st.realName}. Happy now?`, choices: [{ text: 'Something else...', next: 'start' }] };
      }
      case '_name_no':
        return { text: 'Nice try. Keep walking.', choices: [{ text: 'Something else...', next: 'start' }] };
      case '_f_member': {
        const f = npc.faction;
        const back = [{ text: 'Something else...', next: 'start' }];
        if (!this.revealsFaction()) return { text: f.cover || 'Nobody. I keep to myself.', choices: back };
        const rep = w.getRep(npc.def.faction);
        const tone = rep >= 35 ? 'You are one of the good ones.' : rep <= -25 ? 'And we know all about you.' : 'Remember that.';
        return { text: `I'm with the ${f.name}. ${tone}`, choices: back };
      }
      case '_f_about': {
        const f = npc.faction;
        const back = [{ text: 'Something else...', next: 'start' }];
        if (!this.revealsFaction()) return { text: f.cover || 'People? There are no people here.', choices: back };
        const rep = w.getRep(npc.def.faction);
        return { text: `${f.desc} To us, you are ${G.repLabel(rep).toLowerCase()}.${w.isMember(npc.def.faction) ? ' One of our own.' : ''}`, choices: back };
      }
      case '_f_work': {
        const fid = npc.def.faction, back = [{ text: 'Something else...', next: 'start' }];
        if (w.getRep(fid) < -10) return { text: 'Work? For you? Earn some trust first.', choices: back };
        if (w.flags['work_' + fid] === w.day) return { text: 'You already did your part today. Come back tomorrow.', choices: back };
        return {
          text: `[Placeholder job] There is always something that needs doing for the ${npc.faction.name}. It will take a couple of hours.`,
          choices: [
            { text: 'Do the job. (2 hours, +reputation, +$20)', do: (c) => {
              w.flags['work_' + fid] = w.day;
              c.wait(2);
              w.addRep(fid, 8);
              c.giveGold(20);
              w.log(`You did a job for the ${npc.faction.name}.`);
            }, next: '_f_done' },
            back[0],
          ],
        };
      }
      case '_f_done':
        return { text: 'Good work. We remember who helps us.', choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
      case '_f_join': {
        const fid = npc.def.faction, f = npc.faction;
        const need = G.skills.has(scene.player, 'cult_of_personality') ? 35 : 50;
        if (w.getRep(fid) < need) return { text: `Not yet. Prove yourself to the ${f.name} first. (Needs ${need} reputation, you have ${w.getRep(fid)})`, choices: [{ text: 'Something else...', next: 'start' }] };
        return {
          text: `Joining the ${f.name} means our enemies become yours. There is no going back. Are you sure?`,
          choices: [
            { text: 'I am sure.', do: () => {
              w.flags['member_' + fid] = true;
              w.addRep(fid, 10);
              for (const other of G.listedFactions()) if (G.factionsAtWar(fid, other)) w.addRep(other, -20, false, false);
              w.log(`You joined the ${f.name}.`, 'quest');
              w.rumor(`Word is a newcomer has joined the ${f.name}.`, null);
              G.audio.play('quest');
              G.events.emit('xp', G.XP.joinFaction, 'Joined');
            }, next: '_f_welcome' },
            { text: 'Let me think about it.', next: 'start' },
          ],
        };
      }
      case '_f_welcome':
        return { text: `Welcome to the ${npc.faction.name}.`, choices: [{ text: 'Goodbye.', next: null }] };
      case '_f_give':
        return {
          text: scene.player.gold >= 50 ? (scene.player.gold -= 50, npc.st.gold += 50, w.addRep(npc.def.faction, 5), G.audio.play('coin'), 'Generous. We will remember this.') : 'You do not have it. Do not waste my time.',
          choices: [{ text: 'Something else...', next: 'start' }],
        };
      case '_f_threat': {
        const fid = npc.def.faction;
        w.addRep(fid, -15);
        const hostile = w.getRep(fid) < (npc.faction.hostileBelow ?? -100);
        return {
          text: hostile ? 'You just made a very big mistake.' : 'Bold words. We will see whose days are numbered.',
          choices: [{ text: hostile ? '[Fight]' : '[Leave]', next: null }],
          after: () => { if (hostile) { npc.st.hostile = true; npc.aggressor = true; } },
        };
      }
      case '_f_betray':
        return {
          text: 'The ruins in the forest? Excellent. We will handle it from here. You have done your country a service.',
          choices: [{ text: 'Glad to help.', do: () => {
            w.flags.rev_betrayed = true;
            w.addRep(npc.def.faction, 25);
            w.addRep('revolutionaries', -40, false, false);
            if (w.isMember('revolutionaries')) { w.flags.member_revolutionaries = false; w.log('You betrayed the revolution.', 'bad'); }
            w.schedule(1, 'rev_raid');
            w.log('You told the authorities where the revolutionaries meet.', 'warn');
          }, next: null }],
        };
      case '_f_contract': {
        const q = npc.def.faction === 'gang_red' ? 'red_contract' : 'blue_contract';
        return {
          text: `${G.QUESTS[q].desc} Do it and you will be family.`,
          choices: [
            { text: 'Consider it done.', do: (c) => c.startQuest(q), next: null },
            { text: 'Not my war.', next: 'start' },
          ],
        };
      }
      case '_afraid':
        return {
          text: G.rng.pick(['P-please... I do not want any trouble.', 'Stay back! I know what you did!', 'W-what do you want from me?']),
          choices: [
            { text: 'Hand over your cash. (Threaten)', if: () => !npc.faction.outlaw && npc.def.combat !== 'guard', next: '_threaten' },
            { text: 'Relax. I mean no harm.', do: () => { npc.st.fear = Math.max(0, npc.st.fear - 30); }, next: null },
          ],
        };
      case '_grieving': {
        const who = npc.st.grievingFor && w.npcs[npc.st.grievingFor] ? w.npcs[npc.st.grievingFor].name : 'someone';
        return { text: `Leave me be... ${who} is dead. I cannot talk right now.`, choices: [{ text: 'I am sorry.', next: null }, { text: 'Goodbye.', next: null }] };
      }
      case '_threaten': {
        const p = scene.player;
        // Intimidation check: easy against frightened civilians, hard against people who can fight back.
        const scared = G.skills.roll(p, G.threatDifficulty(npc), 'intimidate');
        if (scared) {
          const g = npc.st.gold;
          npc.st.gold = 0;
          p.gold += g;
          npc.st.fear = 100;
          scene.reportCrime('extortion', npc);
          G.audio.play('coin');
          return { text: g > 0 ? `T-take it! $${g}, that is all I have!` : 'I... I have nothing! Please!', choices: [{ text: '[Leave]', next: null }] };
        }
        if (npc.def.combat === 'flee') {
          npc.st.fear = Math.max(npc.st.fear, 40);
          return { text: 'Get away from me! Police!', choices: [{ text: '[Leave]', next: null }], after: () => { npc.startFlee(scene.player); scene.reportCrime('extortion', npc); } };
        }
        return { text: 'You picked the wrong person to threaten.', choices: [{ text: '[Fight]', next: null }], after: () => { npc.st.hostile = true; } };
      }
    }
    return null;
  }

  go(nodeId) {
    if (nodeId == null) { this.end(); return; }
    let node = nodeId.startsWith('_') ? this.builtinNode(nodeId) : this.tree[nodeId];
    if (!node) { this.end(); return; }
    const c = this.c;
    const text = typeof node.text === 'function' ? node.text(c) : node.text;
    let choices = (node.choices || []).filter((ch) => !ch.if || ch.if(c));
    if (node.common) {
      const own = choices.map((ch) => (typeof ch.text === 'function' ? '' : ch.text || ''));
      let common = this.commonChoices();
      // a tree with its own way of asking for work (faction leaders, the captain) does not need the generic one too
      if (own.some((t) => /work for me|any work|job for me/i.test(t))) common = common.filter((ch) => typeof ch.text === 'function' || !/^(Got any work for me\?|You said you might have work for me\?)$/.test(ch.text));
      choices = choices.concat(common);
      const seen = new Set();   // a tree's own "Goodbye." and the common one: show it once (at the end)
      choices = choices.reverse().filter((ch) => { const t = typeof ch.text === 'function' ? null : ch.text; if (t == null) return true; if (seen.has(t)) return false; seen.add(t); return true; }).reverse();
    }
    if (!choices.length) choices = [{ text: 'Goodbye.', next: null }];
    this.node = { id: nodeId, text, choices: choices.map((ch) => ({ raw: ch, text: typeof ch.text === 'function' ? ch.text(c) : ch.text })), after: node.after };
  }

  choose(i) {
    const ch = this.node && this.node.choices[i];
    if (!ch) return;
    if (this.node.after) this.node.after();
    let next = ch.raw.next;
    if (ch.raw.do) {
      const r = ch.raw.do(this.c);
      if (typeof r === 'string') next = r;
    }
    if (this.ended) return;
    if (next === undefined) next = null;
    this.go(next);
  }

  // Free text typed by the player (js/game/chat.js decides the answer).
  say(text) {
    this.chatReply = G.chat.reply(this, text);
    if (this.chatReply.end) { if (this.chatReply.after) this.chatReply.after(); this.npc.say(this.chatReply.text); this.end(); return; }
    this.go('_said');
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.npc.talking = false;
  }
}

G.DialogueRunner = DialogueRunner;

// ---- speech check helpers
G.checkTag = (p, diff, stat = 'charisma') => `[${stat === 'intimidate' ? 'Intimidate' : 'Speech'} ${Math.round(G.skills.chance(p, diff, stat) * 100)}%]`;
// Threatening: scared civilians are easy, fighters hard, already-frightened people easier still.
G.threatDifficulty = (npc) => (npc.def.combat === 'flee' ? 4 : npc.def.combat === 'guard' ? 12 : 9) - (npc.st.fear > 30 ? 2 : 0) + (npc.def.leader ? 2 : 0);
G.arrestTalkDifficulty = (bounty) => Math.min(12, 5 + Math.floor(bounty / 100));
G.haggleDifficulty =(w, sid) => 6 + (w.getRep(G.SHOPS[sid].region) < 0 ? 2 : 0) - (w.getRep(G.SHOPS[sid].region) >= 40 ? 1 : 0);

// Muggers ("your money or your life") and gang members collecting a night-time toll on their turf.
// Street Smarts halves the demand.
G.muggingAmount = (npc, player) => {
  const amt = npc.def.mugger ? Math.max(10, Math.floor(player.gold * 0.4)) : 15 + Math.floor(player.gold * 0.1);
  return G.skills.has(player, 'street_smarts') ? Math.ceil(amt / 2) : amt;
};
G.DIALOGUES._mugging = {
  start: {
    text: (c) => {
      const amt = G.muggingAmount(c.npc, c.p);
      return c.npc.def.mugger
        ? `Your money or your life. Hand over $${amt}, nice and slow.`
        : `This is ${c.npc.faction.name} turf after dark. Toll is $${amt}.`;
    },
    choices: [
      { text: (c) => `${c.tag(c.npc.def.mugger ? 7 : 8, 'intimidate')} You really want to do this? Walk away.`, if: (c) => c.canTry('mug_scare'), do: (c) => {
        if (c.check('mug_scare', c.npc.def.mugger ? 7 : 8, 'intimidate')) { c.npc.mugDone = true; c.npc.st.fear = Math.max(c.npc.st.fear, 50); c.npc.say(c.npc.def.mugger ? 'Whoa, whoa. Easy. My mistake.' : 'Tch. Fine. Keep moving.'); return null; }
        c.npc.st.hostile = true; c.npc.aggressor = true; c.npc.say('You think you scare me?');
        return null;
      } },
      { text: (c) => `${c.tag(6)} Come on, we are on the same side here. Let me pass.`, if: (c) => (c.skill('smooth_operator') || c.skill('street_smarts')) && c.canTry('mug_talk'), do: (c) => {
        if (c.check('mug_talk', 6)) { c.npc.mugDone = true; c.npc.say(G.rng.pick(['Heh. Alright, smooth talker. Go.', 'Fine. This once.'])); return null; }
        c.npc.say('Nice speech. Now pay up.');
        return 'start';
      } },
      { text: (c) => `Pay. ($${G.muggingAmount(c.npc, c.p)})`, if: (c) => c.p.gold >= G.muggingAmount(c.npc, c.p), do: (c) => {
        const amt = G.muggingAmount(c.npc, c.p);
        c.p.gold -= amt; c.npc.st.gold += amt;
        G.audio.play('coin');
        c.scene.toast(`You lost $${amt}.`, 'bad');
        if (!c.npc.def.mugger) c.w.addRep(c.npc.def.faction, 2, true);
        c.npc.say(c.npc.def.mugger ? 'Pleasure doing business.' : 'Smart. Move along.');
      } },
      { text: 'I do not have that kind of money.', if: (c) => c.p.gold < G.muggingAmount(c.npc, c.p), do: (c) => {
        if (c.npc.def.mugger) { c.npc.st.hostile = true; c.npc.aggressor = true; c.npc.say('Then you pay in blood!'); }
        else { c.w.addRep(c.npc.def.faction, -2, true); c.npc.say('Then get off our street.'); }
      } },
      { text: 'Make me.', do: (c) => { c.npc.st.hostile = true; c.npc.aggressor = true; c.npc.say('Gladly.'); } },
    ],
  },
};

// Arrest conversation (used by guards when the player has a bounty)
G.DIALOGUES._arrest = {
  start: {
    text: (c) => `Police! Stop right there! You have a bounty of $${c.bounty()} in ${G.REGIONS[c.region].name}. Pay the fine, or you are coming with me.`,
    choices: [
      { text: 'What have I done wrong?', next: 'wrong' },
      { text: (c) => `Pay the bounty. ($${c.bounty()})`, if: (c) => c.gold() >= c.bounty(), do: (c) => { c.p.gold -= c.bounty(); c.clearBounty(); c.scene.toast('Bounty paid.'); c.w.log('You paid your bounty.'); } },
      { text: (c) => `Maybe this makes the problem go away? (Bribe: $${Math.ceil(c.bounty() / 2)})`, if: (c) => c.skill('bribery') && c.gold() >= Math.ceil(c.bounty() / 2), do: (c) => {
        const n = Math.ceil(c.bounty() / 2);
        c.p.gold -= n; c.npc.st.gold += n; c.clearBounty();
        G.audio.play('coin');
        c.npc.say('I never saw you.');
        c.w.log('You bribed a cop to forget your bounty.', 'warn');
      } },
      { text: (c) => `${c.tag(G.arrestTalkDifficulty(c.bounty()))} Officer, this is all a big misunderstanding.`, if: (c) => c.skill('smooth_operator') && c.canTry('arrest_talk'), do: (c) => {
        if (c.check('arrest_talk', G.arrestTalkDifficulty(c.bounty()))) {
          c.w.bounty[c.region] = Math.floor(c.bounty() / 2);
          c.scene.arrestCooldown = 120;
          c.npc.say('...Fine. But I am watching you.');
          c.w.log('You talked a cop out of arresting you. Your bounty was halved.', 'good');
          return null;
        }
        c.npc.say('Save it for the judge.');
        return 'start';
      } },
      { text: 'Go to jail.', do: (c) => { c.scene.goToJail(); } },
      { text: 'I will never surrender!', do: (c) => { c.scene.resistArrest(c.npc); } },
    ],
  },
  // The officer reads out the crimes that were witnessed in this region.
  wrong: {
    text: (c) => {
      const list = c.w.crimeSummary(c.region);
      if (!list.length) return `Don't play dumb. Your record says you owe $${c.bounty()}.`;
      return `Don't play dumb. Witnesses saw you:\n- ${list.join('\n- ')}\nThat adds up to $${c.bounty()}.`;
    },
    choices: [
      { text: (c) => `${c.tag(G.arrestTalkDifficulty(c.bounty()) + 1)} That was self-defense!`, if: (c) => c.canTry('arrest_selfdef') && c.w.crimeSummary(c.region).length > 0, do: (c) => {
        if (c.check('arrest_selfdef', G.arrestTalkDifficulty(c.bounty()) + 1)) {
          c.w.bounty[c.region] = Math.floor(c.bounty() * 0.7);
          c.npc.say('Hm. Maybe. I will knock some off your fine.');
          return 'start';
        }
        c.npc.say('Tell it to the judge.');
        return 'start';
      } },
      { text: 'Alright, alright.', next: 'start' },
    ],
  },
};
