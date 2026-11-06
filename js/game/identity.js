'use strict';
// Who each person is, and who is speaking.
//   Names: full name, first name, street name, role, other aliases; G.identity.scan finds who a sentence is about,
//   whether it says "Jack Dale", "Jack" or "Razor". First names that are also words (June, Ruby, Wade) and surnames
//   (Stone, Price) only count when capitalized: "the price is right" is about nobody.
//   Sheet: everything a person knows about themselves: family, partner, friends, enemies, work, home, faction.
//   Personality: on top of the eight traits everything already reads, a temperament (courage, temper, loyalty, greed,
//   empathy, patience, honesty, sociability, wits), a way of talking and a quirk. Way of talking + quirk are dealt
//   from a deck per playthrough, so no two people in the world get the same pair.
//   Age: child, young adult, adult, middle-aged, elderly. Ethnicity: G.RACES (js/data/npcs.js) for everybody.
//   Perspective: persona lines are written in the first person ("my marriage"). P.you / P.they give the same thing
//   for someone else's mouth. fixLine and fixChoice hold generated text to who is speaking: an NPC never talks about
//   themselves in the third person, and the player never claims what belongs to the NPC.
//   Places: the real places in the game, for the AI's context and to catch invented ones. Never the island.
(() => {
const clamp = G.util.clamp;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORDY = new Set(['june', 'ruby', 'ivy', 'jade', 'hazel', 'iris', 'opal', 'wren', 'faye', 'una', 'dean', 'rex', 'hank', 'gus', 'wade', 'reid', 'grace', 'hope', 'may', 'mark', 'bill', 'will', 'finn', 'cole']);

// ---------------------------------------------------------------- ages
G.AGES = {
  child: { name: 'Child', years: [6, 12] },
  young: { name: 'Young adult', years: [18, 29] },
  adult: { name: 'Adult', years: [30, 49] },
  middle: { name: 'Middle-aged', years: [50, 64] },
  elderly: { name: 'Elderly', years: [65, 88] },
};
const GREY = /^#(c8c8c8|d8d8d8|b8b8b8|e0e0e0|a8a8a8)/i;
G.ages = {
  ids: () => Object.keys(G.AGES),
  // the age group of a person: set by hand (def.ageGroup), a child, grey hair and the like, or rolled once by id
  of(id) {
    const d = G.NPCS[id] || (id && id.def) || {}, key = typeof id === 'string' ? id : id && id.id;
    if (d.ageGroup && G.AGES[d.ageGroup]) return d.ageGroup;
    if (d.kid) return 'child';
    const look = d.look || {};
    if (GREY.test(look.hair || '') || /elder|retire|grand(ma|pa|mother|father)|old /i.test(`${key} ${d.name || ''}`)) return 'elderly';
    const roll = new G.RNG('age-' + key).next(), fighter = d.combat === 'fight' || d.combat === 'guard';
    if (fighter) return roll < 0.45 ? 'young' : roll < 0.9 ? 'adult' : 'middle';
    return roll < 0.26 ? 'young' : roll < 0.6 ? 'adult' : roll < 0.84 ? 'middle' : 'elderly';
  },
  years(id) { const g = G.AGES[this.of(id)]; return g.years[0] + (G.util.hashString('years' + id) % (g.years[1] - g.years[0] + 1)); },
  elderly(id) { return this.of(id) === 'elderly'; },
};
const ETH_FACTION = { notrael: 'notraeli' };
// Every person in the data ends up with a race, an age group and, if elderly, the look that goes with it (the HD
// drawing stoops and lines anyone with grey hair, js/game/hdchars.js). World files run through this as well.
const normalize = (id, d) => {
  if (!d || !d.look) return;
  const L = d.look;
  if (ETH_FACTION[d.faction]) { if (L.race !== ETH_FACTION[d.faction]) { L.race = ETH_FACTION[d.faction]; L.skin = G.races.nearest(L.race, L.skin); } }
  else if (!L.race || !G.RACES[L.race]) L.race = L.skin ? G.races.closest(L.skin) : 'other';
  if (d.kid) { d.ageGroup = 'child'; return; }
  d.ageGroup = d.ageGroup && G.AGES[d.ageGroup] ? d.ageGroup : G.ages.of(id);
  if (d.ageGroup === 'elderly' && !GREY.test(L.hair || '')) L.hair = new G.RNG('grey-' + id).pick(['#c8c8c8', '#d8d8d8', '#b8b8b8']);
};
const normalizeAll = () => { for (const id in G.NPCS) normalize(id, G.NPCS[id]); };
normalizeAll();
document.addEventListener('DOMContentLoaded', normalizeAll);

// ---------------------------------------------------------------- personality
const VOICES = ['short, clipped sentences', 'long-winded, wanders off the point', 'dry sarcasm', 'blunt and direct', 'polite to a fault', 'swears casually', 'answers questions with questions', 'talks in old sayings', 'quick, nervous rambling', 'slow and careful with words', 'jokes about everything', 'calls everybody "friend"', 'calls everybody "kid"', 'sighs a lot, sounds tired', 'loud, lots of exclamation', 'quiet, says as little as possible', 'very formal', 'streetwise slang', 'talks about themselves constantly', 'always complaining', 'warm and motherly or fatherly', 'cold, flat, unimpressed', 'gossipy, loves "did you hear"', 'philosophical, thinks out loud', 'bragging', 'cautious, hedges everything', 'teasing and flirty', 'gruff but fair'];
const QUIRKS = ['always counting their money', 'never trusts a stranger twice', 'superstitious about small things', 'keeps a grudge for years', 'forgives too easily', 'hates being touched', 'cannot keep a secret', 'keeps every promise, however small', 'lies about small things for no reason', 'hates bullies', 'loves animals more than people', 'thinks everybody is watching them', 'always hungry', 'proud of where they come from', 'wishes they were somewhere else', 'looks down on people with no money', 'soft spot for kids', 'quick to take offense', 'collects favors', 'cannot stand the police', 'respects the law, whatever else', 'believes in fate', 'hates the rich', 'wants to be liked by everyone', 'tests people before trusting them', 'avoids trouble at any price', 'cannot walk away from a dare', 'religious, in a quiet way'];
const TRAIT_BASE = {   // courage, temper, loyalty, greed, empathy, patience, honesty, sociable, wits
  friendly: [50, 25, 60, 35, 70, 65, 60, 70, 50], grumpy: [55, 70, 45, 50, 30, 25, 55, 25, 50], nervous: [20, 40, 50, 40, 55, 45, 50, 35, 55], chatty: [45, 40, 45, 40, 55, 50, 40, 90, 50],
  proud: [65, 60, 55, 55, 35, 35, 55, 50, 55], tired: [35, 45, 45, 40, 45, 60, 55, 30, 45], cheerful: [50, 20, 55, 35, 65, 70, 60, 75, 50], suspicious: [50, 55, 40, 50, 30, 40, 40, 30, 65],
};
const AXES = ['courage', 'temper', 'loyalty', 'greed', 'empathy', 'patience', 'honesty', 'sociable', 'wits'];
const ROLE_BIAS = { guard: { courage: 20, loyalty: 10, honesty: 5 }, fight: { courage: 22, temper: 18, empathy: -15, loyalty: 10 }, flee: { courage: -8 } };
const LIFE_BIAS = { gang: { greed: 12, honesty: -12 }, dealer: { greed: 20, honesty: -15 }, rich: { greed: 15, empathy: -10 }, homeless: { greed: -5, patience: 5 }, retiree: { patience: 15, courage: -8 }, cop: { honesty: 3 } };
const _persona = G.social.persona.bind(G.social), personas = new Map();
let deck = null;
const dealDeck = (w) => {
  const ids = Object.keys(G.NPCS).sort(), key = ids.length + '|' + ids.slice(0, 5).map((i) => (w.npcs[i] || {}).realName).join(',');
  if (deck && deck.key === key) return deck;
  const r = new G.RNG('deck-' + key), all = [];
  for (let v = 0; v < VOICES.length; v++) for (let q = 0; q < QUIRKS.length; q++) all.push([v, q]);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  deck = { key, map: {} };
  ids.forEach((id, i) => { deck.map[id] = all[i % all.length]; });
  return deck;
};
const pov = (s, who) => {   // a phrase from a persona, for someone else's mouth (only ever used on persona fields)
  const your = who === 'you';
  return String(s).replace(/\bmyself\b/g, your ? 'yourself' : 'themselves').replace(/\bmy\b/g, your ? 'your' : 'their').replace(/\bme\b/g, your ? 'you' : 'them');
};
G.social.persona = function (id) {
  const w = G.world, st = w && w.npcs[id], key = id + '|' + (st ? st.realName : '');
  const hit = personas.get(key);
  if (hit) return hit;
  const P = _persona(id), d = G.NPCS[id] || {}, r = new G.RNG('axes-' + key), base = TRAIT_BASE[P.trait] || TRAIT_BASE.friendly;
  AXES.forEach((a, i) => { P[a] = base[i] + r.int(-24, 24); });
  const life = G.lifestyle ? G.lifestyle.of(id) : null;
  for (const bias of [ROLE_BIAS[d.combat], LIFE_BIAS[life]]) if (bias) for (const a in bias) P[a] += bias[a];
  if (d.kid) { P.courage -= 20; P.greed -= 15; P.wits -= 15; }
  if (d.ageGroup === 'elderly') { P.patience += 12; P.courage -= 6; P.wits += 6; }
  AXES.forEach((a) => { P[a] = clamp(Math.round(P[a]), 3, 97); });
  if (w && G.NPCS[id]) { const [v, q] = dealDeck(w).map[id]; P.voice = VOICES[v]; P.quirk = QUIRKS[q]; }
  else { P.voice = r.pick(VOICES); P.quirk = r.pick(QUIRKS); }
  // the same facts, for someone else to say
  P.you = {}; P.they = {};
  for (const k of ['worry', 'dream', 'food', 'origin', 'hobby']) { P.you[k] = pov(P[k], 'you'); P.they[k] = pov(P[k], 'they'); }
  if (w && st) personas.set(key, P);
  return P;
};

// ---------------------------------------------------------------- names
const parseName = (real) => {
  const m = String(real || '').match(/^(\S+)(?:\s+"([^"]+)")?(?:\s+(.+))?$/) || [];
  return { first: m[1] || '', nick: m[2] || '', last: m[3] || '', full: [m[1], m[3]].filter(Boolean).join(' ') };
};
const STOP_ROLE = /^(civilian|driver|stranger|someone)$/i;
const I = G.identity = {
  normalize, parseName, pov, VOICES, QUIRKS,
  names(w, id) {
    const st = w.npcs[id] || {}, n = parseName(st.realName);
    return Object.assign(n, { role: st.name || (G.NPCS[id] || {}).name || '', aliases: (st.aliases || []).concat(n.nick ? [n.nick] : []) });
  },
  // how `text` refers to this person: 'full', 'alias', 'first', 'last', or null
  refers(w, id, text) {
    const n = this.names(w, id), t = String(text);
    if (n.full && n.last && new RegExp(`\\b${esc(n.full)}\\b`, 'i').test(t)) return 'full';
    if ((w.npcs[id] || {}).realName && t.toLowerCase().includes(w.npcs[id].realName.toLowerCase())) return 'full';
    for (const a of n.aliases) if (new RegExp(`\\b${esc(a)}\\b`).test(t)) return 'alias';
    if (n.first.length > 2) {
      const lower = WORDY.has(n.first.toLowerCase());
      if (new RegExp(`\\b${esc(n.first)}\\b`, lower ? '' : 'i').test(t)) return 'first';
    }
    if (n.last.length > 2 && new RegExp(`\\b${esc(n.last)}\\b`).test(t)) return 'last';
    return null;
  },
  // everyone a sentence names (cached: one sentence, many listeners): [{ id, how }]
  scan(w, text) {
    if (this._scanT === text) return this._scanR;
    const out = [];
    for (const id in w.npcs) { if (!w.npcs[id].realName || !G.NPCS[id]) continue; const how = this.refers(w, id, text); if (how) out.push({ id, how }); }
    this._scanT = text; this._scanR = out;
    return out;
  },
  // does `a` know who `b` is? (family, friends, the same faction or neighborhood, anyone they have dealt with)
  knowsOf(w, a, b) {
    if (a === b) return true;
    const da = G.NPCS[a], db = G.NPCS[b], st = w.npcs[a];
    if (!da || !db || !st) return false;
    if ((da.relations || {})[b] || (db.relations || {})[a]) return true;
    if (st.op && st.op[b] != null) return true;
    if ((st.convos || []).some((c) => c.with === b)) return true;
    if (da.map === db.map) return true;
    return !!da.faction && da.faction === db.faction && da.faction !== 'civilians';
  },
  // who `listener` understands the sentence to be about: with two Jacks around, the one they know best
  aboutFor(w, listener, text) {
    const hits = this.scan(w, text).filter((h) => this.knowsOf(w, listener, h.id));
    const self = hits.find((h) => h.id === listener);
    const strong = hits.filter((h) => h.how === 'full' || h.how === 'alias');
    if (strong.length) return strong.map((h) => h.id);
    if (self) return [listener];
    const firsts = {};
    for (const h of hits) { const k = this.names(w, h.id).first; (firsts[k] = firsts[k] || []).push(h.id); }
    return Object.values(firsts).map((l) => l.sort((x, y) => Math.abs(G.social.opinion(w, listener, y)) - Math.abs(G.social.opinion(w, listener, x)))[0]);
  },
  // the people in their life, by name, as they would say it
  circle(w, id) {
    const d = G.NPCS[id] || {}, out = { partner: [], family: [], friends: [], enemies: [], work: [] };
    for (const o in G.NPCS) {
      if (o === id || !w.npcs[o]) continue;
      const rel = (d.relations || {})[o] || (G.NPCS[o].relations || {})[id], name = w.npcs[o].realName, dead = !w.isAlive(o);
      const tag = name + (dead ? ' (dead)' : '');
      if (rel === 'spouse') out.partner.push(tag);
      else if (rel === 'family' || rel === 'child') out.family.push(tag);
      else if (rel === 'master' || rel === 'apprentice') out.work.push(tag);
      else if (rel === 'friend' || rel === 'comrade') out.friends.push(tag);
      else if (!dead && d.map === G.NPCS[o].map) { const v = G.social.opinion(w, id, o); if (v >= 45) out.friends.push(tag); else if (v <= -35) out.enemies.push(tag); }
    }
    return out;
  },
  homeName(id) {
    const d = G.NPCS[id]; if (!d || !d.home) return null;
    try { const m = G.maps.cache[d.map] || G.maps.get(d.map), b = m && m.building(d.home); return b ? `${b.name} (${m.meta.name})` : m ? m.meta.name : null; } catch (e) { return null; }
  },
  temperament(P) {
    const say = [[P.courage, 'brave', 'easily scared'], [P.temper, 'hot-tempered', 'slow to anger'], [P.loyalty, 'fiercely loyal', 'loyal only to yourself'], [P.greed, 'greedy', 'not interested in money'],
      [P.empathy, 'caring', 'cold-hearted'], [P.patience, 'patient', 'impatient'], [P.honesty, 'honest', 'a liar'], [P.sociable, 'outgoing', 'a loner'], [P.wits, 'sharp', 'not very bright']];
    return say.filter(([v]) => v >= 66 || v <= 34).sort((a, b) => Math.abs(b[0] - 50) - Math.abs(a[0] - 50)).slice(0, 4).map(([v, hi, lo]) => (v >= 66 ? hi : lo)).join(', ') || 'even-tempered';
  },
  // everything they know about themselves, for the AI: one person, nobody else
  sheet(w, id) {
    const st = w.npcs[id] || {}, d = G.NPCS[id] || {}, n = this.names(w, id), P = G.social.persona(id), c = this.circle(w, id), out = [];
    const list = (k, l) => { if (l.length) out.push(`${k}: ${l.slice(0, 5).join(', ')}`); };
    out.push(`Your name is ${n.full || st.realName}${n.nick ? `, people call you "${n.nick}"` : ''}${n.first ? `; ${n.first} for short` : ''}.`);
    const race = d.look && G.RACES[d.look.race], yrs = d.kid ? null : G.ages.years(id);
    out.push(`You are ${d.kid ? 'a child' : `${yrs} years old (${G.AGES[G.ages.of(id)].name.toLowerCase()})`}${race && d.look.race !== 'other' ? `, ${race.name}` : ''}${d.look && d.look.body === 'f' ? ', a woman' : d.look ? ', a man' : ''}.`);
    list('Your partner', c.partner); list('Your family', c.family); list('Your boss or apprentice', c.work);   // (friends and enemies: "People in your life", with how close they are)
    const home = this.homeName(id); if (home) out.push(`Your home: ${home}.`);
    return out.join(' ');
  },

  // ---------------------------------------------------------------- perspective
  // An NPC's own line: they are "I", never a third party. "What's your problem with Jack Dale, kid?" -> "...with me, kid?"
  fixLine(w, npc, line) {
    let t = String(line || '');
    t = t.replace(/\bthe player's\b/gi, 'your').replace(/\bthe player\b/gi, 'you');
    const n = this.names(w, npc.id);
    const shared = (name) => Object.keys(w.npcs).some((o) => o !== npc.id && parseName(w.npcs[o].realName).first === name);
    const forms = [n.full].concat(n.aliases, shared(n.first) ? [] : [n.first]).filter((f) => f && f.length > 2);
    for (const f of forms.sort((a, b) => b.length - a.length)) {
      const e = esc(f);
      const intro = new RegExp(`(\\b(?:I'?m|I am|name is|name's|call me|called|it's|this is|known as|they call me|people call me|go by)\\s+(?:"|the\\s)?)${e}\\b`, 'gi');
      const keep = '\u0001';
      t = t.replace(intro, (m, a) => a + keep);
      t = t.replace(new RegExp(`\\b${e}'s\\b`, 'gi'), 'my');
      t = t.replace(new RegExp(`\\b${e} (is|was|has|does|will|would|can|did|knows|thinks|said|says|wants|never|always)\\b`, 'gi'), (m, v) => ({ is: 'I am', was: 'I was', has: 'I have', does: 'I do', knows: 'I know', thinks: 'I think', says: 'I say', wants: 'I want' }[v.toLowerCase()] || `I ${v}`));
      t = t.replace(new RegExp(`\\b${e}\\b`, 'gi'), 'me');
      t = t.split(keep).join(f);
    }
    return t.replace(/(^|[.!?]\s+)(me|my)\b/g, (m, a, b) => a + b[0].toUpperCase() + b.slice(1)).replace(/(^|[.!?]\s+)me (am|was|have|do)\b/gi, '$1I $2');
  },
  // A generated answer in the player's mouth: what the NPC just said is theirs. "I've been having problems with my
  // wife" -> "You mentioned your marriage", never "my marriage". Words of one family count together (wife, marriage).
  OWN: [['wife', 'husband', 'marriage', 'spouse', 'partner', 'divorce'], ['kid', 'kids', 'son', 'daughter', 'child', 'children'], ['job', 'boss', 'work', 'shift', 'shop', 'store'], ['rent', 'landlord', 'house', 'place', 'home', 'apartment'], ['debt', 'debts', 'money', 'loan'], ['mother', 'father', 'mom', 'dad', 'parents', 'brother', 'sister', 'family'], ['health', 'back', 'knee', 'heart'], ['dream', 'dreams', 'plan', 'plans']],
  fixChoice(npcLine, text, o = {}) {
    let t = String(text || '');
    const n = o.names, said = String(npcLine || '');
    if (n && n.full && new RegExp(`\\b(I'?m|I am|my name is)\\s+${esc(n.first)}\\b`, 'i').test(t)) return null;   // (speaking as them)
    if (said && t.trim().toLowerCase() === said.trim().toLowerCase()) return null;
    // written from the NPC's side of the conversation: not something the player would say
    if (/\bwhat brings you\b|\bcan i help you\b|\bhow can i help you\b|\bwhat can i (do|get) for you\b|\bwelcome to my\b|\bget out of my\b|\bin my (house|home|shop|store|bar|office)\b|\bto my (house|home|shop|store|bar|office)\b/i.test(t)) return null;
    if (o.role && new RegExp(`\\bI(?:'m| am)(?: just)? (?:the |a |an |your )?(?:\\w+ )?${esc(o.role)}\\b`, 'i').test(t)) return null;
    const theirs = new Set(), re = /\bmy ((?:[a-z'-]+ ){0,2}?[a-z'-]+)\b/gi;
    let m;
    while ((m = re.exec(said))) theirs.add(m[1].toLowerCase().split(' ').pop());
    if (/\bI('ve| have| am|'m)? [a-z ]*\b(married|divorced|engaged)\b/i.test(said)) theirs.add('marriage');
    for (const g of this.OWN) if (g.some((x) => theirs.has(x))) g.forEach((x) => theirs.add(x));
    const own = o.playerOwns || (() => false);
    t = t.replace(/\b(my)\b( (?:[a-z'-]+ ){0,2}?)([a-z'-]+)\b/gi, (w0, my, mid, noun) => (theirs.has(noun.toLowerCase()) && !own(noun.toLowerCase()) ? `${my[0] === 'M' ? 'Your' : 'your'}${mid}${noun}` : w0));
    t = t.replace(/\bYou mentioned (my)\b/g, 'You mentioned your');
    return t;
  },

  // ---------------------------------------------------------------- places
  // The ones to tell someone about: where they are, their own part of the world, and the big names (a short list,
  // the model pays for every word). Everything real is still accepted when it comes up (known()).
  placesFor(w, mapId) {
    const here = new Set(), add = (id) => { const m = G.maps.cache[id]; if (m && m.meta && m.meta.name) here.add(m.meta.name); };
    for (const id of Object.keys(G.MAPGEN || {})) if (!/_f\d+$|^(island|jail|wilds)/.test(id) && !/^i_/.test(id)) add(id);
    try { for (const pl of G.phone.places(w)) if (pl.map === mapId && !/island/i.test(pl.label)) here.add(pl.label.replace(/ \(.*\)$/, '')); } catch (e) { /* */ }
    return [...here].filter((n) => !/island/i.test(n)).slice(0, 26);
  },
  // Real places NPCs may name. Not the island (it stays out of this system), and nothing that is not built.
  places(w) {
    if (this._pl && this._plDay === w.day) return this._pl;
    const names = new Set();
    for (const id of Object.keys(G.MAPGEN || {})) {
      if (/^(island|jail|wilds)/.test(id) || /_f\d+$/.test(id)) continue;
      const m = G.maps.cache[id]; if (m && m.meta && m.meta.name && !/island/i.test(m.meta.name)) names.add(m.meta.name);
    }
    try {
      for (const pl of G.phone.places(w)) {
        const map = G.maps.cache[pl.map];
        if (/^island/.test(pl.map) || /island|harbor boat/i.test(pl.label) || (map && map.meta.region === 'island')) continue;
        names.add(pl.label.replace(/ \(.*\)$/, ''));
      }
    } catch (e) { /* the map names will do */ }
    this._plDay = w.day; this._pl = [...names].filter((n) => n && !/^\[/.test(n));
    return this._pl;
  },
  known(w, name) { const t = String(name).toLowerCase().replace(/^the /, ''); return this.places(w).some((p) => { const q = p.toLowerCase().replace(/^the /, ''); return q === t || (t.length > 3 && q.includes(t)); }); },
  // A place that does not exist, named in a generated line: it becomes the plain thing ("the Rusty Anchor Bar" -> "the bar").
  PLACE_RE: /\b(?:[Tt]he )?((?:[A-Z][a-z'’]+ ){1,3}(Bar|Pub|Tavern|Lounge|Club|Cafe|Café|Diner|Restaurant|Grill|Hotel|Motel|Inn|Mall|Market|Plaza|Park|Square|Street|St|Avenue|Ave|Road|Rd|Boulevard|Lane|Alley|Bridge|Harbor|Beach|Heights|Hills|Gardens|Station|Hospital|Church|Cathedral|School|College|University|Theater|Theatre|Stadium|Museum|Library|Tower|Building|Warehouse|Factory|Docks|Pier|Quarter|District|Town|Village|City))\b/g,
  cleanPlaces(w, line) {
    return String(line || '').replace(this.PLACE_RE, (m, name, kind) => {
      if (/island/i.test(m) || this.known(w, name) || this.scan(w, name).length) return m;
      if (/^(St|Ave|Rd|Street|Avenue|Road|Boulevard|Lane|Alley|Bridge|Quarter|District|Town|Village|City|Heights|Hills|Gardens)$/.test(kind)) return 'around here';
      return `the ${kind.toLowerCase()}`;
    }).replace(/\b(?:(?:out|over|down|up|back|right) )?(?:on|at|in|near|by|off|from|to) around here\b/g, 'around here');
  },
};

// the old walk a little slower
const NP = G.NPC.prototype, _step = NP.stepToward;
NP.stepToward = function (tx, ty, dt, scene, run) {
  return _step.call(this, tx, ty, dt * (this.def && this.def.ageGroup === 'elderly' ? 0.8 : 1), scene, run);
};
// (the old stay down longer too: js/game/knockout.js reads the retiree lifestyle)
if (G.lifestyle) { const _of = G.lifestyle.of; G.lifestyle.of = function (id) { const r = _of.call(this, id); return r === 'worker' && G.NPCS[id] && G.NPCS[id].ageGroup === 'elderly' ? 'retiree' : r; }; }

// people added later (a world file, a grown-up child) go through the same door
const _loaded = G.onWorldLoaded;
G.onWorldLoaded = function (w) { normalizeAll(); return _loaded ? _loaded.apply(this, arguments) : undefined; };
})();
