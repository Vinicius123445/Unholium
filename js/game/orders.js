'use strict';
// Telling people what to do, and them deciding whether to.
//   parse: what an instruction means, in the player's words ("stick with me", "watch my back", "go after that guy").
//     What it does not catch, the AI can name for it (reply field `order`). The model only reads the sentence; it never
//     decides what happens.
//   judge: their decision, from who they are and how things stand: how they feel about you and trust you, fear, respect
//     (rank, shared faction), their temperament, what they are doing, how they feel, what they would risk, and who you
//     want them to go against. Some say no; the greedy name a price; the scared follow but will not fight.
//   The decision goes to the AI as a fact to put in their own words. carry() then does it through the game's own
//     behaviors: companions, combat, schedules, paths. If it cannot be done (no way to get there, nobody by that name
//     here), they say so instead of promising.
//   Later: an order in force is real state (st.order, saved), and people can change their minds when it gets dangerous.
(() => {
const clamp = G.util.clamp;
const pick = (a) => G.rng.pick(a);
const nowMin = (w) => w.day * 1440 + w.minutes;
const BE = "(?:please |just |now |go |hey |ok |okay |can you |could you |would you |will you |i want you to |i need you to |you should |you need to |you have to |help me |let'?s )*";
const INTENTS = [
  ['stop', /\b(stop following( me)?|you can go( now)?|i don'?t need you( anymore| any more)?|you'?re dismissed|go away now|leave me alone|quit following|we'?re done here)\b/i],
  ['stand_down', /\b(stop fighting|stand down|hold your fire|call it off|let (him|her|them) go|back off (him|her|them))\b/i],
  ['home', /\b(go|head|get|run|walk) (on )?(back )?home\b|\bgo to your (house|home|place)\b/i],
  ['wait_outside', /\b(wait|stay|stand) (for me )?(out ?side|out front|by the door|at the door|out here)\b|\bgo (wait )?outside\b/i],
  ['stay', /\b(stay|wait|remain) (right )?(here|put|there)\b|\bwait for me\b|\bdon'?t move\b|\bhold (your )?position\b|\bstand here\b|\bstay where you are\b/i],
  ['protect', /\b(protect me|watch my back|cover me|guard me|have my back|got my back|keep me safe|be my bodyguard|keep an eye out for me)\b/i],
  ['carry', /\b(help me carry|carry (this|these|that|my|some)|hold (this|these|my (stuff|things|bag))|take my (stuff|things|bag)|carry my)\b/i],
  ['fight', /\b(help me (fight|beat|take|deal with|with (these|those|this|that) (guys?|people|men|thugs))|fight with me|back me up|jump in|fight (them|him|her|these|those) with me|give me a hand|lend me a hand|help me out here)\b/i],
  ['attack', new RegExp(`^\\s*${BE}(attack|kill|shoot|stab|punch|hit|jump|take out|take down|beat up|beat|get|go after|deal with|rough up|waste|fight)\\b(?! (me|you|yourself|your|out of here|lost|away|going|a |some ))`, 'i')],
  ['come', /\b(come here|come over here|get over here|over here|come closer|come to me)\b/i],
  ['follow', /\b(follow me|come with me|come along|tag along|stick (with|to|by|close to) me|stay (with|by|close to|near) me|stay by my side|stay close|don'?t leave my side|keep up|walk with me|ride with me|roll with me|let'?s go|with me for a while|follow me around|come on)\b/i],
  ['goto', /\b(?:go|head|get|walk|run|meet me) (?:over |down |up )?(?:to|at) (?:the )?([a-z' ]{3,40})/i],
];
const NEEDS_WHO = { attack: true };
const WHO_WORDS = /\b(him|her|them|that (guy|man|woman|person|one|dude|cop|kid)|this (guy|man|woman|person|one|dude)|those (guys|people|men)|these (guys|people|men))\b/i;
const EASY = { come: 0, stop: -999, stand_down: -20, home: 0, stay: 5, wait_outside: 5, goto: 15, carry: 8, follow: 12, protect: 28, fight: 30, attack: 45 };
const PRICE = { follow: 40, stay: 10, wait_outside: 10, carry: 25, goto: 20, protect: 120, fight: 100, attack: 200 };
const VIOLENT = new Set(['fight', 'attack', 'protect']);
const FLAVOR = {   // how people say yes and no, when the AI is off; by their character
  yes: { grumpy: ['Fine.', 'Yeah, yeah.'], nervous: ['O-okay.', 'If you say so...'], proud: ['Very well.', 'As you wish. This once.'], chatty: ['Sure thing! Why not!', 'You got it!'], tired: ['...Alright.', 'If I must.'], cheerful: ['You got it!', 'Sure!'], suspicious: ['Alright. But I am watching you.', 'Okay. For now.'], friendly: ['Of course.', 'Sure, no problem.'] },
  no: { grumpy: ['No.', 'Not a chance.'], nervous: ['I-I do not think I can.', 'Please do not ask me that.'], proud: ['You do not give me orders.', 'Who do you think you are?'], chatty: ['Ha! No way. Not happening!'], tired: ['No. I do not have it in me.'], cheerful: ['Sorry, no can do!'], suspicious: ['Why would I do that for you?', 'What is your angle?'], friendly: ['Sorry, I cannot do that.'] },
};
const WHY = {
  hostile: 'you are against the player right now', dislike: 'you do not like the player enough', stranger: 'you barely know the player and owe them nothing', working: 'you are working and cannot leave', notFighter: 'you are no fighter and will not get into a fight', scared: 'it is too dangerous and you are scared',
  hurt: 'you are hurt and in no state for it', own: 'that is one of your own people', friend: 'that is someone you care about', innocent: 'you will not hurt someone for no reason', kid: 'you would never hurt a child', cop: 'attacking the police is suicide', tired: 'you are too tired', noHome: 'you do not really have a home to go to',
};
const WHY_LINE = { kidNo: ['I am not supposed to go anywhere with strangers.', 'No! I have to stay here.'], working: ['I am working. I cannot just leave.', 'Not while I am on the clock.'], notFighter: ['I am not a fighter!', 'Fight? Me? No way.'], scared: ['Are you crazy? It is way too dangerous.', 'No. No way. I am not getting killed for you.'], hurt: ['Look at me. I can barely stand.'], own: ['That is one of mine. Think very carefully about what you just asked me.', 'You want me to turn on my own people?'], friend: ['That is a friend of mine. Are you out of your mind?'], innocent: ['What did they ever do to me? No.', 'I am not hurting someone for no reason.'], kid: ['What is wrong with you?! That is a child!'], cop: ['Attack a cop? You are out of your mind.'], tired: ['I am dead on my feet. Not today.'], noHome: ['Home? I do not have one.'], nopath: ['I cannot get to you from here.', 'I do not see a way there.'], nobody: ['Who? I do not see anybody like that here.', 'Who are you talking about?'], who: ['Who do you mean?', 'Who?'], noplace: ['Never heard of it.', 'Where is that? No idea.'], faraway: ['That is way too far. Go yourself.'], full: ['You have got enough people with you.'] };

const O = G.orders = {
  VIOLENT,
  parse(text) {
    const t = String(text || '').trim();
    if (!t || t.endsWith('?') && !/\b(can|could|would|will) you\b/i.test(t)) return null;
    for (const [intent, re] of INTENTS) {
      const m = t.match(re);
      if (!m) continue;
      if (intent === 'attack' && /\b(i'?ll|i will|gonna|going to)\b/i.test(t)) continue;   // (that is a threat, not an order)
      return { intent, text: t, place: intent === 'goto' ? m[1].trim() : null };
    }
    return null;
  },
  // who `text` points at: a name here, "him" or "that guy": whoever the player is facing, or the closest hostile
  targetOf(scene, npc, text) {
    const w = scene.world, p = scene.player, here = (id) => scene.actors.find((a) => a.id === id && a.kind === 'npc' && !a.dead);
    const RANK = { full: 0, alias: 1, first: 2, last: 3 };
    const named = G.identity.scan(w, text).filter((h) => h.id !== npc.id).sort((x, y) => RANK[x.how] - RANK[y.how]).filter((h, i, l) => h.how === l[0].how).map((h) => h.id);
    if (named.length) { const a = named.map(here).find(Boolean); return a ? { actor: a } : { away: named[0] }; }
    const pool = scene.actors.filter((a) => a.kind === 'npc' && a !== npc && !a.dead && !a.st.companion && a.distTo(p) < 170);
    const foes = pool.filter((a) => a.state === 'fight' && a.target === p);
    if (foes.length) return { actor: foes.sort((a, b) => a.distTo(p) - b.distTo(p))[0], foes };
    if (!WHO_WORDS.test(text)) {   // a role: "attack the bartender", "shoot that cop"
      const role = pool.find((a) => new RegExp(`\\b${String(a.def.name).split(' ').pop()}\\b`, 'i').test(text) || (a.def.combat === 'guard' && /\b(cop|police|officer)\b/i.test(text)));
      return role ? { actor: role } : {};
    }
    const [fx, fy] = G.util.DIR_VEC[p.dir];
    const facing = pool.filter((a) => (a.x - p.x) * fx + (a.y - p.y) * fy > 0).sort((a, b) => a.distTo(p) - b.distTo(p));
    return facing.length ? { actor: facing[0] } : pool.length === 1 ? { actor: pool[0] } : {};
  },
  danger(scene, npc) {
    const p = scene.player, foes = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && a !== npc && !a.st.companion && a.state === 'fight' && (a.target === p || a.target === npc) && a.distTo(p) < 200);
    return foes.length * 12 + foes.filter((a) => a.hasGun).length * 12 + foes.filter((a) => a.def.combat === 'guard').length * 15;
  },
  reachable(scene, npc, tx, ty) {
    const map = scene.map, sx = Math.floor(npc.x / 16), sy = Math.floor((npc.y - 3) / 16);
    if (Math.abs(sx - tx) + Math.abs(sy - ty) < 3) return true;
    const path = G.pathfind.find(map, sx, sy, tx, ty, 8000);
    return !!(path && path.length);
  },
  // Their decision. { ok, why, line, price, follow (agrees to come, not to fight), plan... }
  judge(scene, npc, order) {
    const w = scene.world, st = npc.st, p = scene.player, d = npc.def, P = G.social.persona(npc.id), intent = order.intent;
    const out = { intent, ok: false, why: null, price: 0, order };
    const no = (why) => Object.assign(out, { ok: false, why, line: pick(WHY_LINE[why] || FLAVOR.no[P.trait] || FLAVOR.no.friendly) });
    if (intent === 'stop') { out.ok = true; return out; }
    // can it be done at all?
    if (NEEDS_WHO[intent] || intent === 'fight' || intent === 'protect') {
      const t = this.targetOf(scene, npc, order.text);
      out.target = t.actor || null; out.foes = t.foes;
      if (intent === 'attack' && !t.actor) { const res = no(t.away ? 'nobody' : 'who'); if (t.away) res.line = `${G.identity.names(w, t.away).first}? They are not here.`; return res; }
    }
    if (intent === 'goto') {
      const pl = G.identity.known(w, order.place) ? G.chat.findPlace(w, order.place.toLowerCase()) : null;
      if (!pl) return no('noplace');
      if (pl.map !== scene.map.id) return no('faraway');
      out.place = pl;
      if (!this.reachable(scene, npc, pl.x, pl.y)) return no('nopath');
    }
    if (intent === 'come' || intent === 'follow' || intent === 'protect') { if (!npc.st.companion && npc.distTo(p) > 40 && !this.reachable(scene, npc, Math.floor(p.x / 16), Math.floor((p.y - 3) / 16))) return no('nopath'); }
    if (intent === 'home' && !d.home) return no('noHome');
    if (intent === 'wait_outside' && !scene.map.buildingAt(npc.x, npc.y - 3) && !scene.map.buildingAt(p.x, p.y - 3)) out.intent = 'stay';
    if (intent === 'stand_down') { out.ok = true; return out; }
    // the same limits as asking them to come along (js/game/companionmood.js): children never go off with you, people
    // who only exist for a moment have somewhere to be, and three is a crew
    const joins = ['follow', 'protect', 'fight', 'carry', 'wait_outside', 'goto'].includes(intent) && !st.companion;
    if (joins && d.kid) return no('kidNo');
    if (joins && npc.transient) return no('working');
    if (joins && G.companions.list(scene).length >= 3 && intent !== 'wait_outside' && intent !== 'goto') return no('full');
    if (intent === 'home' && st.companion) { out.ok = true; return out; }
    // ---- would they?
    if (st.hostile || npc.state === 'fight' && npc.target === p) return no('hostile');
    const trust = G.trust ? G.trust.of(w, npc.id).v : 40, disp = G.rel ? G.rel.value(st) : st.disp || 0, side = G.fmind.playerSide(w, npc.id), fear = st.fear || 0;
    let s = disp * 0.55 + (trust - 45) * 0.45 + (P.loyalty - 50) * 0.12;
    if (st.partner) s += 25;
    if (st.companion) s += 22;
    // respect: one of their own, higher in the group than they are
    if (side.same) { const mine = G.fmind.rankIndex(w, npc.id), yours = G.factionRanks ? G.factionRanks.rank(w, side.same) : 0; s += 12 + (yours - mine) * 7; }
    if (side.enemy) s -= 30;
    if (G.fame && G.fame.level(w) >= 2) s += (100 - P.courage) * 0.1;
    // what they remember of you
    s -= Math.min(30, G.mem.count(w, npc.id, (x) => x.by === 'player' && x.f < 0) * 4);
    s += Math.min(15, G.mem.count(w, npc.id, (x) => x.by === 'player' && x.f > 0) * 2);
    if (G.mem.list(w, npc.id).some((x) => x.k === 'promise' && x.done === 'broken')) s -= 12;
    // someone scared of you does what they are told, as far as it keeps them away from harm
    if (fear >= 40 && !VIOLENT.has(intent)) s += (fear - 30) * 0.6;
    // how they are today
    const e = st.emo ? G.emo.get(w, npc.id) : { anger: 0, sad: 0, joy: 0 };
    s += e.joy * 0.15 - e.anger * 0.35 - e.sad * 0.2;
    if (st.mood === 'grieving') s -= 18;
    const entry = npc.currentEntry && npc.currentEntry(w);
    const working = entry && entry.act === 'work' && (d.shop || d.combat === 'guard');
    if (working && !['come', 'carry'].includes(intent) && !st.companion) { if (P.loyalty >= 40 || d.combat === 'guard') return no('working'); s -= 25; }
    const hurt = npc.hp < (npc.maxHp || 30) * 0.35;
    if (hurt && VIOLENT.has(intent)) return no('hurt');
    if (G.companionLife && (st.tired || 0) >= 85 && intent !== 'home' && intent !== 'stay') return no('tired');
    if (d.kid) { if (VIOLENT.has(intent)) return no('notFighter'); s -= 15; }
    if (G.companionMood && G.companionMood.anger(st) >= 40) s -= 30;
    if (w.isNight() && (w.hour >= 23 || w.hour < 5) && !st.companion && ['follow', 'goto', 'carry'].includes(intent)) s -= 10;
    // violence
    if (VIOLENT.has(intent)) {
      const risk = this.danger(scene, npc) * (1.3 - P.courage / 100);
      s -= risk;
      out.brave = P.courage;
      // the old are in no shape for it, unless fighting is what they do
      if (d.combat === 'flee' && (d.ageGroup === 'elderly' || P.courage < 62 || P.temper < 40)) {
        // a frightened one may still come along, just not to fight
        out.follow = intent !== 'attack' && !st.companion && s >= EASY.follow && !working;
        return no('notFighter');
      }
      if (intent === 'attack' || out.target) {
        const t = out.target;
        if (t) {
          const stake = G.overhear.stake(w, npc, t.id);
          if (t.def.kid) return no('kid');
          if (intent === 'attack') {
            if (stake.care >= 1.5) return no('friend');
            if (t.def.faction === d.faction && d.faction !== 'civilians' && P.loyalty >= 30) return no('own');
            if (t.def.combat === 'guard' && d.combat !== 'guard' && !G.factionsAtWar(d.faction, t.def.faction)) { if (P.courage < 80) return no('cop'); s -= 30; }
            if (d.combat === 'guard') return no('innocent');
            s += (P.temper - 50) * 0.4 - (P.empathy - 50) * 0.6;
            if (stake.kind === 'enemy') s += 35;
            if (G.factionsAtWar(d.faction, t.def.faction)) s += 40;
            if (t.state === 'fight' && t.target === p) s += 30;
            else if (t.def.faction === 'civilians' && P.empathy >= 60) return no('innocent');
          } else if (stake.care >= 1.5) return no('friend');
          else if (t.def.faction === d.faction && d.faction !== 'civilians') return no('own');
        }
      }
    }
    // the coin: nobody is the same every day
    s += (new G.RNG(`order-${npc.id}-${intent}-${w.day}`).next() - 0.5) * 14;
    // money on the table, if it was offered
    const offer = +((order.text.match(/\$\s?(\d+)/) || order.text.match(/\b(\d{2,5}) (?:bucks|dollars)\b/) || [])[1] || 0);
    if (offer && p.gold >= offer) { s += offer * 0.12 * (0.4 + P.greed / 60); out.offer = offer; }
    const need = EASY[intent] != null ? EASY[intent] : 15;
    out.margin = s - need;
    if (s >= need) { out.ok = true; out.line = pick(FLAVOR.yes[P.trait] || FLAVOR.yes.friendly); return out; }
    // for a price
    if (P.greed >= 52 && s >= need - 40 && !d.kid && d.combat !== 'guard' && PRICE[intent] && !(intent === 'attack' && P.empathy >= 70)) {
      out.price = Math.round(PRICE[intent] * (1 + (need - s) / 40) * (0.7 + P.greed / 100) / 5) * 5;
      if (out.offer && out.offer >= out.price) { out.ok = true; out.price = out.offer; out.paid = true; return out; }
      out.line = pick([`What is in it for me? $${out.price}, up front.`, `That will cost you. $${out.price}.`, `$${out.price} and I will think about being helpful.`]);
      return out;
    }
    return no(fear >= 40 ? 'scared' : disp <= -15 ? 'dislike' : disp < 15 ? 'stranger' : VIOLENT.has(intent) ? 'scared' : 'stranger');
  },
  // the decision, as a fact for the AI to voice
  brief(plan, w) {
    const words = { follow: 'come with the player', stay: 'wait here', wait_outside: 'wait outside', protect: 'act as the player\'s bodyguard', fight: 'fight alongside the player', attack: `attack ${plan.target ? plan.target.st.realName : 'someone'}`, come: 'come over to the player', home: 'go home', stop: 'stop following the player', carry: 'carry things for the player', goto: `go to ${plan.place ? plan.place.label.replace(/ \(.*\)$/, '') : 'that place'}`, stand_down: 'stop fighting' }[plan.intent] || plan.intent;
    if (plan.ok) return `The player is telling you to ${words}. You have decided to do it, and it really will happen: say so in your own way, with your own attitude.`;
    if (plan.price) return `The player is telling you to ${words}. You will only do it for $${plan.price}, paid now. Name that price.`;
    return `The player is telling you to ${words}. You have decided NOT to: ${WHY[plan.why] || WHY_LINE[plan.why] && WHY_LINE[plan.why][0] || 'you just will not'}${plan.follow ? ', though you would come along with them' : ''}. Do not agree to it, whatever the player says. Say no in your own way; you may give your reason, argue back or negotiate.`;
  },
  // ---------------------------------------------------------------- doing it, for real
  carry(scene, npc, plan) {
    const w = scene.world, st = npc.st, p = scene.player;
    const join = () => { if (!st.companion) { if (G.companions.list(scene).length >= 3) return false; G.companions.start(scene, npc); } return true; };
    const note = (t, f = 0) => G.mem.add(w, npc.id, { k: 'order', t, by: 'player', s: 'did', f, i: 2 });
    st.order = null;
    switch (plan.intent) {
      case 'follow': if (!join()) { npc.say(pick(WHY_LINE.full), 3); return false; } st.compWait = false; st.waitAt = null; note('The player asked me to come along, and I agreed'); break;
      case 'stop': if (st.companion) G.companions.dismiss(scene, npc); st.compGuard = false; st.order = null; note('The player told me to stop following them'); break;
      case 'stay':
        if (st.companion && G.DIALOGUE_NODES._comp_wait) G.DIALOGUE_NODES._comp_wait({ npc, scene, c: {} });
        else st.order = { t: 'stay', x: npc.x, y: npc.y, map: scene.map.id, until: nowMin(w) + 180 };
        note('The player asked me to wait for them here');
        break;
      case 'wait_outside': {
        const b = scene.map.buildingAt(npc.x, npc.y - 3) || scene.map.buildingAt(p.x, p.y - 3);
        const spot = b ? { x: b.doorX, y: b.doorY + 1 } : { x: Math.floor(npc.x / 16), y: Math.floor((npc.y - 3) / 16) };
        if (st.companion) { st.compWait = true; }
        st.order = { t: 'goto', x: spot.x, y: spot.y, map: scene.map.id, then: 'stay', until: nowMin(w) + 180 };
        note('The player asked me to wait outside');
        break;
      }
      case 'come': st.order = { t: 'come', map: scene.map.id, until: nowMin(w) + 15 }; break;
      case 'goto': st.order = { t: 'goto', x: plan.place.x, y: plan.place.y, map: scene.map.id, then: st.companion ? null : 'stay', until: nowMin(w) + 120 }; note(`The player sent me to ${plan.place.label}`); break;
      case 'home':
        if (st.companion) G.companions.dismiss(scene, npc);
        st.compGuard = false;
        if (npc.def.map === scene.map.id) st.order = { t: 'home', map: scene.map.id, until: nowMin(w) + 90 };
        break;
      case 'carry':
        if (st.companion || G.trust.manageAllowed(scene, npc)) { G.scenes.push(new G.CompanionTradeScene(scene, npc)); }
        else if (join()) npc.say('Fine, I will walk with you. Hand me what you need carried.', 3);
        break;
      case 'protect': if (!join()) return false; st.compGuard = true; st.compWait = false; st.courageAt = plan.margin; note('The player asked me to protect them, and I said I would', 1); if (plan.target && plan.target.state === 'fight') npc.startFight(plan.target, scene); break;
      case 'fight': { if (!join()) return false; st.compGuard = true; st.compWait = false; const t = plan.target; if (t) npc.startFight(t, scene); note('The player asked me to fight for them, and I did'); break; }
      case 'attack': {
        const t = plan.target; if (!t) return false;
        npc.state = 'schedule';
        npc.startFight(t, scene);
        st.order = { t: 'attack', who: t.id, map: scene.map.id, until: nowMin(w) + 10 };
        note(`The player told me to go after ${t.st.realName}, and I did`, -1);
        G.social.adjust(w, npc.id, t.id, -15);
        if (t.st) { G.social.addDisp(w, t.id, -12); G.mem.add(w, t.id, { k: 'attacked', t: `The player sent ${st.realName} after me`, by: 'player', ab: t.id, s: 'did', f: -3, i: 4 }); }
        break;
      }
      case 'stand_down': if (npc.state === 'fight') npc.endFight(); st.compGuard = false; if (st.order && st.order.t === 'attack') st.order = null; break;
      default: return false;
    }
    return true;
  },
  // they asked for money: the player pays, they do it
  deal(scene, npc, plan) {
    const p = scene.player, st = npc.st;
    if (p.gold < plan.price) return false;
    p.gold -= plan.price; st.gold = (st.gold || 0) + plan.price; G.audio.play('coin');
    G.mem.add(scene.world, npc.id, { k: 'paid', t: `The player paid me $${plan.price} to help them`, by: 'player', s: 'did', f: 1, i: 3 });
    return this.carry(scene, npc, plan);
  },
  // ---------------------------------------------------------------- written replies, when the AI is off or fails
  written(scene, npc, plan) {
    if (plan.ok) return plan.line || pick(FLAVOR.yes.friendly);
    return plan.line || pick(FLAVOR.no.friendly);
  },
  // every order leaves a trace, and being ordered around too much wears on people
  remember(scene, npc, plan) {
    const w = scene.world, P = G.social.persona(npc.id);
    if (plan.ok) return;
    const asks = (npc.st.askN = npc.st.askN && npc.st.askN.day === w.day ? npc.st.askN : { day: w.day, n: 0 });
    if (++asks.n >= 3) { G.social.addDisp(w, npc.id, -2); if (asks.n === 3) G.mem.add(w, npc.id, { k: 'pestered', t: 'The player keeps telling me what to do', by: 'player', s: 'did', f: -1, i: 3 }); }
    if (P.temper >= 60 && !plan.price) G.emo.add(w, npc.id, 'anger', 6);
  },
};

// ---------------------------------------------------------------- orders in force
const _cu = G.companions.update.bind(G.companions);
G.companions.update = function (npc, dt, scene) {
  const st = npc.st, o = st.order, w = scene.world, p = scene.player;
  // a bodyguard looks for trouble, further out than a friend would
  if (st.compGuard && st.companion && !npc.talking && npc.state === 'schedule') {
    const foe = scene.actors.find((a) => !a.dead && a !== npc && a.kind === 'npc' && !a.st.companion && a.state === 'fight' && a.target === p && a.distTo(p) < 240);
    if (foe) { npc.say(pick(['I have got you!', 'Stay behind me!', 'Back off!']), 2); npc.startFight(foe, scene); return true; }
    // having second thoughts: too hot for them, and they only just agreed
    if (O.danger(scene, npc) * (1.3 - G.social.persona(npc.id).courage / 100) > 34 + (st.courageAt || 0)) O.loseNerve(scene, npc);
  }
  if (o && !npc.talking && npc.state === 'schedule') {
    if (o.map !== scene.map.id || nowMin(w) > o.until) { st.order = null; if (o.then === 'stay') st.compWait = false; }
    else switch (o.t) {
      case 'stay': npc.moving = false; if (npc.lookAround) npc.lookAround(dt); return true;
      case 'come': {
        const to = o.who ? scene.actors.find((a) => a.id === o.who && !a.dead) : p;   // (the shark goes to whoever owes him)
        if (!to) { st.order = null; return false; }
        if (npc.distTo(to) < 26) { st.order = null; npc.moving = false; npc.faceTowards(to); return true; }
        npc.walkTo({ x: Math.floor(to.x / 16), y: Math.floor((to.y - 3) / 16) }, dt, scene, true);
        return true;
      }
      case 'goto': {
        if (npc.arrived({ x: o.x, y: o.y })) { npc.moving = false; st.order = o.then === 'stay' ? { t: 'stay', x: npc.x, y: npc.y, map: o.map, until: o.until } : null; if (o.done === 'bank' && G.bankSys) G.bankSys.counter(scene, npc); return true; }
        npc.walkTo({ x: o.x, y: o.y }, dt, scene);
        return true;
      }
      case 'home': {
        const pt = scene.map.points[npc.def.home + '_door'] || scene.map.points[npc.def.home + '_in'];
        if (!pt || npc.arrived(pt)) { st.order = null; return false; }
        npc.walkTo(pt, dt, scene);
        return true;
      }
      case 'attack': { const t = scene.actors.find((a) => a.id === o.who); if (!t || t.dead) { st.order = null; G.mem.add(w, npc.id, { k: 'order', t: `I did what the player asked to ${w.displayName(o.who)}`, by: 'player', s: 'did', i: 3, f: -1 }); } return false; }
    }
  }
  return _cu(npc, dt, scene);
};
O.loseNerve = function (scene, npc) {
  const w = scene.world, st = npc.st;
  if ((st.nerveT || 0) > G.loop.time) return;
  st.nerveT = G.loop.time + 30;
  if (G.rng.chance(0.5)) return;   // (they hold on, this time)
  st.compGuard = false;
  npc.say(pick(['No. No way. I did not sign up for this!', 'I am out! You are on your own!', 'This is insane. Forget it!']), 3);
  G.companions.dismiss(scene, npc);
  st.fear = Math.max(st.fear || 0, 55);
  npc.startFlee(scene.actors.find((a) => a.kind === 'npc' && a.state === 'fight' && a.target === scene.player) || scene.player);
  G.mem.add(w, npc.id, { k: 'order', t: 'I walked out on the player when it got too dangerous', by: 'player', s: 'did', f: -1, i: 3 });
};
// back on their map: where they were told to stay
const NP = G.NPC.prototype, _place = NP.placeBySchedule;
NP.placeBySchedule = function (map, w) {
  const o = this.st.order;
  if (o && o.t === 'stay' && o.map === map.id && nowMin(w) < o.until) { this.x = o.x; this.y = o.y; this.path = null; this.state = 'schedule'; return; }
  return _place.call(this, map, w);
};
// someone not following you can have an order too: the same update runs for them
const _nu = NP.update;
NP.update = function (dt, scene) {
  const st = this.st;
  if (st && st.order && !st.companion && !this.talking && !this.dead && this.state === 'schedule' && ['stay', 'come', 'goto', 'home'].includes(st.order.t)) {
    this.baseUpdate(dt, scene.map);
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    if (G.companions.update(this, dt, scene)) return;
  }
  return _nu.call(this, dt, scene);
};

// ---------------------------------------------------------------- orders in written dialogue (AI off, or it failed)
const _reply = G.chat.reply;
G.chat.reply = function (runner, raw) {
  const ord = O.parse(raw), npc = runner.npc, sc = runner.scene;
  if (ord && !npc.remote) {
    const plan = O.judge(sc, npc, ord);
    if (plan) {
      O.remember(sc, npc, plan);
      if (plan.ok) { if (plan.intent === 'carry') return { text: plan.line, after: () => { runner.pendingOrder = plan; }, choices: [{ text: '[Hand things over]', next: null, do: () => { O.carry(sc, npc, plan); } }] }; O.carry(sc, npc, plan); return { text: plan.line || O.written(sc, npc, plan) }; }
      if (plan.price) return { text: plan.line, choices: [{ text: `[Pay $${plan.price}]`, next: null, if: () => sc.player.gold >= plan.price, do: () => { O.deal(sc, npc, plan); } }] };
      if (plan.follow) return { text: `${plan.line} I will come with you, but that is all.`, after: () => { O.carry(sc, npc, Object.assign({}, plan, { intent: 'follow' })); } };
      return { text: plan.line };
    }
  }
  const res = _reply.apply(this, arguments);
  // the police, spoken to like that (js/game/overhear.js decided in the same breath)
  if (npc._warnLine) { res.text = npc._warnLine; npc._warnLine = null; }
  else if (G.overhear.queue.some((j) => j.npc === npc)) res.end = true;
  return res;
};
})();
