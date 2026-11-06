'use strict';
// Social life: every NPC has a personality (hobby, worry, dream...), an opinion of the people they know,
// and a disposition toward the player (st.disp, -100..100).
//   - Friends greet and chat with each other in the street, rivals trade insults (and sometimes blows).
//   - Gossip: when two people who like each other talk, their opinion of you rubs off on each other.
//   - Hurting or killing someone makes their friends and family hate you.

G.PERSONA = {
  traits: ['friendly', 'grumpy', 'nervous', 'chatty', 'proud', 'tired', 'cheerful', 'suspicious'],
  hobbies: ['fishing', 'cooking', 'chess', 'basketball', 'old movies', 'gardening', 'video games', 'poker', 'jogging', 'painting', 'fixing cars', 'birdwatching', 'karaoke', 'reading crime novels', 'woodworking', 'collecting vinyl records'],
  worries: ['the rent', 'my health', 'my kid', 'the gangs', 'losing my job', 'my debts', 'the police', 'getting old', 'my landlord', 'the price of everything', 'my neighbor', 'my marriage'],
  dreams: ['leave this town for good', 'open my own business', 'see the ocean on the other side of the world', 'win the lottery', 'write a book', 'buy a house with a yard', 'start a band', 'retire somewhere warm', 'go back to school', 'buy a boat'],
  foods: ['tacos', 'pizza', 'my grandmother\'s stew', 'burgers from the diner', 'fried chicken', 'noodles', 'pancakes', 'barbecue', 'spicy wings'],
  origins: ['born and raised right here', 'moved here from up north', 'came here for a job that did not last', 'grew up on a farm out west', 'moved here after my divorce', 'came over on a ship years ago', 'was raised in the city'],
};

G.social = {
  persona(id) {
    const st = G.world && G.world.npcs[id];
    const r = new G.RNG('persona-' + id + (st ? st.realName : ''));
    const P = G.PERSONA;
    return { trait: r.pick(P.traits), hobby: r.pick(P.hobbies), worry: r.pick(P.worries), dream: r.pick(P.dreams), food: r.pick(P.foods), origin: r.pick(P.origins) };
  },

  REL_BASE: { spouse: 80, family: 60, friend: 50, comrade: 40, master: 40, apprentice: 40 },

  // What `a` thinks of `b` (-100..100).
  opinion(w, a, b) {
    const st = w.npcs[a];
    if (st && st.op && st.op[b] != null) return st.op[b];
    const da = G.NPCS[a], db = G.NPCS[b];
    if (!da || !db) return 0;
    let v = this.REL_BASE[da.relations[b]] || 0;
    if (!v) {
      if (da.faction === db.faction && da.faction !== 'civilians') v = 15;
      if (G.factionsAtWar(da.faction, db.faction)) v = -60;
      if (da.home && da.home === db.home) v = Math.max(v, 30);
      if (!v && da.map === db.map) v = (G.util.hashString(a < b ? a + b : b + a) % 51) - 25;   // neighbors: some get along, some do not
    }
    return v;
  },
  adjust(w, a, b, n) {
    const st = w.npcs[a];
    if (!st) return;
    st.op = st.op || {};
    st.op[b] = G.util.clamp(this.opinion(w, a, b) + n, -100, 100);
  },
  // The person `id` feels most strongly about (positive or negative), among people alive.
  strongest(w, id, sign) {
    let best = null, bv = 0;
    for (const o in G.NPCS) {
      if (o === id || !w.isAlive(o) || G.NPCS[o].map !== G.NPCS[id].map && !G.NPCS[id].relations[o]) continue;
      const v = this.opinion(w, id, o);
      if ((sign > 0 ? v > bv : v < bv)) { bv = v; best = o; }
    }
    return best && Math.abs(bv) >= 20 ? { id: best, v: bv } : null;
  },
  relationWord(id, other) {
    const r = G.NPCS[id].relations[other];
    return { spouse: 'my partner', family: 'my family', friend: 'my friend', comrade: 'my buddy', master: 'my boss', apprentice: 'my apprentice' }[r] || 'my neighbor';
  },

  disp(st) { return st.disp || 0; },
  addDisp(w, id, n) {
    const st = w.npcs[id];
    if (st) st.disp = G.util.clamp((st.disp || 0) + n, -100, 100);
  },

  // The player killed someone: their loved ones never forgive you (if they know).
  onPlayerKilled(w, victim, witnessed) {
    for (const id in w.npcs) {
      if (id === victim || !w.isAlive(id)) continue;
      const op = this.opinion(w, id, victim);
      if (op >= 30 && (witnessed || G.NPCS[id].relations[victim])) this.addDisp(w, id, -Math.round(op * 0.8));
      else if (op <= -50 && witnessed) this.addDisp(w, id, 10);   // "good riddance"
    }
  },

  // ---------------- street life ----------------
  LINES: {
    friendly: [
      (a, b) => `Hey, ${b}! How are you doing?`, (a, b) => `${b}! Good to see you.`, () => 'Long time no see!',
      (a, b, P) => `Still into ${P.hobby}?`, () => 'Did you hear the news?', () => 'Let\'s grab a drink sometime.',
    ],
    friendlyReply: [() => 'Doing alright, you?', () => 'Ha, you know me.', () => 'Same old, same old.', () => 'Hanging in there.', () => 'Always good to see you.'],
    spouse: [() => 'Hey, honey.', () => 'Did you eat yet?', () => 'Don\'t be home late.', () => 'Love you.'],
    hostile: [(a, b) => `Look who it is. ${b}.`, () => 'What are you looking at?', () => 'Keep walking.', () => 'You owe me money.'],
    hostileReply: [() => 'Mind your business.', () => 'Get lost.', () => 'Whatever.', () => 'Say that again.'],
    gossip: [() => 'You see that stranger around? I do not trust them.', () => 'That newcomer... a good sort, I think.'],
  },

  // Called by NPCs while they go about their day.
  update(npc, dt, scene) {
    if (npc.pendingSay && (npc.pendingSay.t -= dt) <= 0) { npc.say(npc.pendingSay.text); npc.pendingSay = null; }
    if (npc.transient || npc.state !== 'schedule' || npc.sleeping || npc.talking) return;
    if ((npc.socialT = (npc.socialT == null ? G.rng.range(4, 14) : npc.socialT) - dt) > 0) return;
    npc.socialT = G.rng.range(10, 22);
    const w = scene.world;
    let other = null, op = 0;
    for (const a of scene.actors) {
      if (a === npc || a.kind !== 'npc' || a.dead || a.transient || a.sleeping || a.talking || a.state !== 'schedule' || a.distTo(npc) > 40) continue;
      const v = this.opinion(w, npc.id, a.id);
      if (Math.abs(v) >= 20 && Math.abs(v) > Math.abs(op)) { other = a; op = v; }
    }
    if (!other) return;
    npc.faceTowards(other); other.faceTowards(npc);
    npc.chatT = other.chatT = 3;                   // stop and talk for a moment
    const P = this.persona(other.id), L = this.LINES;
    const nameB = w.npcs[other.id].realName.split(' ')[0];
    const spouse = G.NPCS[npc.id].relations[other.id] === 'spouse';
    if (op > 0) {
      npc.say(G.rng.pick(spouse ? L.spouse : L.friendly)(npc, nameB, P));
      other.pendingSay = { t: 1.4, text: G.rng.pick(L.friendlyReply)() };
      // gossip: opinions of the player spread between friends
      const da = this.disp(npc.st), db = this.disp(other.st);
      if (Math.abs(da - db) > 10) { other.st.disp = Math.round(db + (da - db) * 0.2); npc.st.disp = Math.round(da + (db - da) * 0.1); }
      this.adjust(w, npc.id, other.id, 1); this.adjust(w, other.id, npc.id, 1);
    } else {
      npc.say(G.rng.pick(L.hostile)(npc, nameB, P));
      other.pendingSay = { t: 1.4, text: G.rng.pick(L.hostileReply)() };
      this.adjust(w, npc.id, other.id, -2);
      // bad blood between two people who can fight sometimes turns into a brawl
      if (op <= -70 && npc.def.combat === 'fight' && other.def.combat === 'fight' && !G.factionsAtWar(npc.def.faction, other.def.faction) && G.rng.chance(0.15)) {
        npc.pendingSay = { t: 2.6, text: 'That is it!' };
        npc.startFight(other, scene);
      }
    }
  },
};
