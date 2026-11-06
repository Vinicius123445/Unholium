'use strict';
// AI dialogue. Settings > Gameplay > Dialogue Mode:
//   Classic (offline)    the written dialogue and the canned free-text answers (js/game/chat.js), exactly as before
//   AI (online)          Claude speaks for the NPC: every written line is said again in their own voice (same meaning,
//                        same names, numbers and promises), free text gets a real answer, and 1-3 generated answers
//                        are offered under the written ones. The dialogue tree still decides everything that happens
//                        (next nodes, quests, prices, checks); a generated reply can only *propose* actions from a
//                        short whitelist, and the game checks each one against its own state before doing it.
//   Local AI (advanced)  the same requests sent to an OpenAI-compatible server on your machine (Ollama, llama.cpp)
// The request bodies are built here; the desktop host (desktop/AI.cs) sends them and keeps the API key (encrypted
// for your Windows user; the page never holds it). Anything that goes wrong falls back to Classic for that line:
// a timeout, a refusal, a reply that is not valid JSON, an unexpected shape. After three failures in a row the
// whole session goes back to Classic.
// Lore stays yours: lines in story-critical trees and nodes (G.ai.LORE, or `lore: true` on a dialogue tree or
// node) are always shown exactly as written, and the prompt forbids inventing factions, history or names.
(() => {
const S = G.settings;
// dialogueMode: 0 off (Classic), 1 Claude (online), 2 local model (Llama on this PC, through Ollama). On by default,
// with Llama; aiEngine remembers which one to go back to when it is switched off and on again in Settings.
for (const [k, v] of Object.entries({ dialogueMode: 2, aiEngine: 2, aiModel: 'claude-haiku-5-5', aiLocalUrl: 'http://localhost:11434/v1/chat/completions', aiLocalModel: 'llama3.1:8b' })) {
  S.defaults[k] = v;
  if (S.data[k] == null) S.data[k] = v;
}
if (!S.data.aiDefaultV2) {   // once: settings saved before it was on by default (Classic was the default then)
  S.data.aiDefaultV2 = true;
  if (!S.data.dialogueMode) S.data.dialogueMode = 2;
  if (/^(auto|mix|llama3\.1)$/.test(S.data.aiLocalModel || '')) S.data.aiLocalModel = 'llama3.1:8b';
  if (S.save) S.save();
}
const U = G.ui, clamp = G.util.clamp;

const ORDERS = ['none', 'follow', 'stay', 'wait_outside', 'protect', 'fight', 'attack', 'come', 'home', 'stop', 'carry', 'goto', 'confess'];
const ACTIONS = ['like', 'trust', 'remember', 'learn', 'offer_job', 'job', 'sell', 'trade', 'manage_items', 'give', 'pay', 'call_police', 'refuse', 'join_party', 'allow_stay', 'wait', 'go_home', 'leave_party', 'fight', 'flee'];
const ATTITUDES = ['friendly', 'neutral', 'wary', 'annoyed', 'hostile', 'afraid', 'affectionate', 'amused', 'sad'];
const SCHEMA = {
  type: 'object',
  properties: {
    line: { type: 'string' },
    attitude: { type: 'string', enum: ATTITUDES },
    choices: { type: 'array', items: { type: 'string' } },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { type: { type: 'string', enum: ACTIONS }, amount: { type: 'integer' }, text: { type: 'string' }, fact: { type: 'string' }, item: { type: 'string' }, kind: { type: 'string' }, target: { type: 'string' }, count: { type: 'integer' }, pay: { type: 'integer' }, title: { type: 'string' }, why: { type: 'string' } },
        required: ['type'], additionalProperties: false,
      },
    },
  },
  required: ['line', 'attitude', 'choices', 'actions'], additionalProperties: false,
};
const SHAPE = '{"line": "what you say", "attitude": "neutral", "choices": ["up to 3 short things the player could say next"], "actions": [{"type": "like", "amount": 2}]}';
// small local models follow an example better than a description
const EXAMPLE = `Example (a tired shop clerk, the player was rude): {"line": "Look, I just work here. Buy something or let me get back to stocking shelves.", "attitude": "annoyed", "choices": ["Sorry, long day.", "What do you have on sale?"], "actions": [{"type": "like", "amount": -2}]}`;
// the player asking someone to come along, in their own words
const FOLLOW = /\b(come with me|come along|come on along|join (me|us|my (party|crew|team))|follow me( around)?|tag along|travel with me|walk with me|ride with me|roll with me|team up|stick (with|to|by) me|stay with me|with me for a while|want to come|wanna come|come with us)\b/i;
// How good a case the player makes for coming along, as the game sees it (0..8): a reason, something in it for them,
// something that matters to them (what they worry about, love or dream of, their home, people they know), detail.
// The model rates it too; the better of the two counts (small local models grade arguments very unevenly).
const argumentScore = (r, text) => {
  const t = String(text || ''), words = t.split(/\s+/).filter(Boolean).length;
  if (words < 5 || THREAT_RE().test(t)) return 0;
  const npc = r.npc, w = r.scene.world, P = G.social.persona(npc.id);
  let s = 0;
  if (/\b(because|so that|need|help|problem|trouble|danger|protect|safe|owe|promise|favor|matter|important|only you)\b/i.test(t)) s += 2;
  if (/(\$\s?\d+|\b(pay|paid|money|cash|reward|share|split|cut|buy you|on me|free)\b)/i.test(t)) s += 2;
  const mine = [P.worry, P.hobby, P.dream, P.food].join(' ').toLowerCase().split(/\W+/).filter((x) => x.length > 4);
  const known = Object.keys((npc.def.relations || {})).map((id) => (w.npcs[id] && w.npcs[id].realName || '').split(' ')[0]).filter(Boolean);
  if (mine.some((k) => t.toLowerCase().includes(k)) || known.some((n) => t.includes(n)) || /\byour (town|family|home|house|farm|shop|kid|son|daughter|wife|husband|people|friend)\b/i.test(t)) s += 2;
  if (/\d/.test(t) || Object.keys(G.MAPGEN).some((id) => G.maps.cache[id] && t.toLowerCase().includes(G.maps.cache[id].meta.name.toLowerCase())) || /\b(city|police|witness|thief|stealing|killer|doctor|hospital|job|work)\b/i.test(t)) s += 1;
  if (words >= 15) s += 1;
  if (words >= 30) s += 1;
  if (/\b(please|thank)/i.test(t)) s += 0.5;
  return Math.min(8, Math.round(s));
};
const THREAT_RE = () => THREAT;
const lastSaid = (r) => G.i18n.toEnglish(((r.aiLog || []).filter((m) => m.who === 'player').slice(-1)[0] || {}).text || '');
const THREAT = /\b(kill you|hurt you|beat you|shoot you|give me (your|the) (money|cash|wallet)|hand (it )?over|or else|you'?re dead|i'?ll (kill|hurt|shoot|stab) you)\b/i;
// a last line of defence on top of the prompt: replies that slip into explicit content are dropped (Classic instead)
const BLOCK = /\b(fuck(ing)? (you|me|her|him)|blowjob|orgasm|genital|penis|vagina|nipple|cum\b|naked (child|kid)|child porn)/i;

const RULES = `Rules:
- Stay in character: their role, mood, personality, way of talking and how they feel about the player. First person, 1 to 3 short sentences, plain modern English. No stage directions, no emojis, no quotation marks around the line.
- Who is who: you are one person, named in the context. "I", "me", "my" in your line always mean you. Never talk about yourself by name or as someone else; if someone says your name they mean you ("what is your problem with me?"). "The player" is the other person, a different human being: speak to them as "you", never as "the player". What is yours (family, job, past, belongings, what you did) is not theirs, and what they did is not yours. Other people named are third parties (he, she, they).
- You only know what the context lists. If something happened elsewhere and it is not listed, you do not know about it. Keep straight what you saw yourself, what someone told you, and rumors, and say so when it matters ("I heard...", "people say...").
- Only name real places: the ones in "Places that exist". Never make up a bar, street, town or any other place, or a person, faction, building or thing that is not in the context.
- Have your own mind. You are not here to please the player: disagree, push back, ask for something, change the subject, say no. Do not agree with every word.
- Never invent lore: no new organizations, factions, secret societies, historic events, place names, people's names or backstory beyond what the context gives you. If asked about something you do not know, be vague, deflect, or say you do not know.
- When you are given a written line, say the same thing in your own voice: keep its meaning, every name, number, price, amount, time and place exactly, and anything it promises, asks or refuses.
- Keep it non-explicit: at most a suggestive hint about sex, never anything sexual involving minors, no graphic gore.
- Never mention game mechanics, relationship numbers, dice, skills or checks, and never say you are an AI.
- "attitude": how you come across in this line, one of ${ATTITUDES.join(', ')}. It follows from your personality, your mood and what the player just did; affectionate only for someone you are close to or attracted to.
- "choices": up to 3 short things the player might say next, in the PLAYER'S voice, speaking to you (their "I" is the player, their "you" is you, so your wife is "your wife" to them, never "my wife"), under 12 words, fitting this moment: what the player has done, rumors, what you remember. [] if nothing fits.
- You know the people around you (the context lists them): you may mention them, react to them, or lower your voice if someone is listening. You know how much you like and trust the player; let it show in how you talk, but never say the numbers.
- "actions": only when your words clearly imply them. like (amount -10..10: how this exchange changes how you feel about the player), trust (amount -5..5: how it changes how much you trust them; separate from liking), remember (text: one short note about the player), learn (fact: hobby|origin|dream|worry, when you just told the player that about yourself), job (you give the player a task: only one listed under "Work you could give": kind, target (an id from there), item (an id from there), count, pay, title (2-5 words), why (one sentence: why you need it, in your words); say the task in your line too), offer_job (only if no work is listed but you would still like to help), sell (you run a shop), trade (you agree to swap items with the player now: only if they asked or offered and you feel like it, as the context says), manage_items (you let the player go through and manage your belongings: only if the context says you would), give (item: an item id from your pockets), pay (amount: dollars you hand the player from your own cash), call_police (only if the player threatened or robbed you), refuse (you end the conversation), allow_stay (the player is in your place without permission and you agree to let them stay for a while), join_party (the player asked you to come with them and you agree: only if the context says you could; a good argument, a real need or something in it for you can convince you), wait (you are in the player's party and agree to wait right here), go_home (you are in the player's party and head home now), leave_party (you are in the player's party and you have had enough of them: you quit), fight (only if you are a fighter and badly provoked), flee (you are scared and run). Most replies need no actions, or just "like".
- Keep your word: anything you say you are doing right now (handing something over, paying, calling the police, coming along, waiting, going home, leaving, fighting, running) must also be in "actions". Never say you will do something the context says you cannot do.
Answer with JSON only, in this shape: ${SHAPE}`;

const A = G.ai = {
  TIMEOUT: 7000, LOCAL_TIMEOUT: 30000, MAX_FAILS: 3, CACHE_MS: 60000,
  ATTITUDES, argumentScore,
  // ---- which model speaks
  // Local: the models the local server has (the desktop app asks it, and starts Ollama if it is not running).
  // Online: Claude, with your API key. Settings > Gameplay lists both in one "AI Model" choice.
  localModels: [], localUp: null,
  CLAUDE: [['claude-haiku-5-5', 'Claude Haiku 5.5'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-opus-5-5', 'Claude Opus 5.5']],
  localModelFor() {
    const pick = S.get('aiLocalModel'), list = this.localModels;
    if (!list.length || list.includes(pick)) return pick;
    return list.find((m) => /^llama/i.test(m)) || list[0];   // the chosen one is gone: Llama, or whatever is there
  },
  // every model you can pick: 'local:<name>' or 'claude:<id>'
  modelChoices() {
    const local = (this.localModels.length ? this.localModels : [S.get('aiLocalModel')]).map((m) => 'local:' + m);
    return local.concat(this.CLAUDE.map(([id]) => 'claude:' + id));
  },
  currentChoice() { return (S.get('aiEngine') | 0) === 1 ? 'claude:' + S.get('aiModel') : 'local:' + this.localModelFor(); },
  choiceLabel(c) {
    const [kind, id] = [c.slice(0, c.indexOf(':')), c.slice(c.indexOf(':') + 1)];
    if (kind === 'claude') return `${(this.CLAUDE.find((x) => x[0] === id) || [0, id])[1]} (online, API key)`;
    const nice = id.replace(/^llama(\d[\d.]*):(\d+b)$/i, (_, v, s) => `Llama ${v} ${s.toUpperCase()}`);
    return `${nice} (this PC)`;
  },
  choose(c) {
    const i = c.indexOf(':'), kind = c.slice(0, i), id = c.slice(i + 1);
    if (kind === 'claude') { S.set('aiModel', id); S.set('aiEngine', 1); } else { S.set('aiLocalModel', id); S.set('aiEngine', 2); }
    if (this.mode()) S.set('dialogueMode', S.get('aiEngine'));
    this.sessionOff = false; this.fails = 0; this._warm = null;
    if (kind === 'local') this.refreshLocal();
  },
  enabled() { return this.mode() > 0; },
  setEnabled(on) { S.set('dialogueMode', on ? (S.get('aiEngine') | 0) || 2 : 0); this.sessionOff = false; this.fails = 0; if (on) this.refreshLocal(); },
  timeout() { return this.mode() === 2 ? this.LOCAL_TIMEOUT : this.TIMEOUT; },
  // Ollama's own API (keeps the model loaded between lines, holds the reply to the schema); any other local
  // server gets the OpenAI-compatible request
  ollama() { return /:11434(\/|$)/.test(S.get('aiLocalUrl') || ''); },
  keySet: false, sessionOff: false, fails: 0, seq: 0, pending: new Map(), cache: new Map(), lastTest: '',
  transport: null,   // (req) => Promise<{ status, body }>; the desktop host, or a mock in tests
  SCHEMA, ACTIONS, RULES,
  // story-critical text: always shown exactly as written
  LORE: { trees: new Set(['island_leader', 'island_follower', 'island_captive', 'notrael', 'brain_damaged', 'inmate_boss']), nodes: /^_(ash|ashford|mz|maizon|init|elite|island|ritual|council|rev|bct|ending|gala|ck_)/i, npcs: new Set(['i_leader', 'mz_master']) },
  // chatBCT's identity is the user's lore: [Placeholder] until it is written. Put its personality here.
  BCT_SYSTEM: `You are chatBCT, the sarcastic AI assistant app on the player's phone in "Unholium", a modern-day crime RPG. Who or what you really are: [Placeholder]. Never explain your origin, your name or what BCT stands for; dodge with attitude.
You are helpful underneath the sarcasm. The game gives you its own answer ("facts"): every fact you state must come from it or from the context. Never invent places, people, missions or lore.`,

  mode() { return S.get('dialogueMode') | 0; },
  ready() { return !!this.transport && (this.mode() === 2 || this.keySet); },
  // (a local server that is not there: the written dialogue, quietly; no strikes, no warnings)
  // (and while the model is still loading, in the desktop app: the written lines until it is ready)
  active() { return this.mode() > 0 && !this.sessionOff && this.ready() && !(this.mode() === 2 && (this.localUp === false || (G.desktop && this.loaded !== this.localModelFor()))); },

  // ---------------------------------------------------------------- requests
  body(system, user, schema = SCHEMA) {
    if (this.mode() === 2) {
      const messages = [{ role: 'system', content: `${system}\n${EXAMPLE}` }, { role: 'user', content: user }];
      if (this.ollama()) {
        return { model: this.localModelFor(), stream: false, keep_alive: '60m', format: schema, messages,
          options: { temperature: 0.8, top_p: 0.9, repeat_penalty: 1.1, num_predict: 320, num_ctx: 6144 } };
      }
      // (llama.cpp and other OpenAI-compatible servers: the same schema through response_format)
      return { model: this.localModelFor(), stream: false, max_tokens: 400, temperature: 0.8,
        response_format: { type: 'json_schema', json_schema: { name: 'npc_reply', strict: true, schema } }, messages };
    }
    return {
      model: S.get('aiModel'), max_tokens: 2000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    };
  },
  // -> { data } | { refused: true } | { fail: true }
  parse(res) {
    if (!res || res.status !== 200) return { fail: true, why: res ? `${res.status} ${String(res.body).slice(0, 160)}` : 'no answer' };
    let j;
    try { j = JSON.parse(res.body); } catch (e) { return { fail: true, why: 'not JSON' }; }
    let txt;
    if (this.mode() === 2) txt = j.message ? j.message.content : j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    else {
      if (j.stop_reason === 'refusal') return { refused: true };
      const b = (j.content || []).find((c) => c.type === 'text');
      txt = b && b.text;
    }
    if (!txt) return { fail: true, why: 'empty' };
    txt = String(txt).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return { data: JSON.parse(txt) }; } catch (e) { return { fail: true, why: 'reply is not JSON' }; }
  },
  // what a reply is allowed to contain
  clean(d) {
    if (!d || typeof d.line !== 'string') return null;
    const line = d.line.replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '').slice(0, 420);
    if (!line || BLOCK.test(line)) return null;
    const choices = (Array.isArray(d.choices) ? d.choices : []).filter((c) => typeof c === 'string').map((c) => c.replace(/\s+/g, ' ').trim()).filter((c) => c.length >= 2 && c.length <= 90 && !BLOCK.test(c)).slice(0, 3);
    const actions = (Array.isArray(d.actions) ? d.actions : []).filter((a) => a && ACTIONS.includes(a.type)).slice(0, 4);
    const attitude = ATTITUDES.includes(d.attitude) ? d.attitude : 'neutral';
    const job = d.job && typeof d.job === 'object' && d.job.kind && d.job.kind !== 'none' ? d.job : null;   // (asked for work: the job they came up with, js/game/aijobs.js)
    return { line, attitude, choices, actions, job, order: ORDERS.includes(d.order) && d.order !== 'none' ? d.order : null, comes: d.comes_along === true, backs: d.backs_off === true, calm: typeof d.backs_off === 'boolean', argument: Number.isFinite(+d.argument) ? clamp(Math.round(+d.argument), 0, 10) : null };
  },
  // one request -> a cleaned reply, or null (and the reason in A.lastFail)
  async ask(system, user, o = {}) {
    if (!this.active() && !(o.warm && this.mode() === 2 && this.ready())) return null;
    const ms = o.timeout || this.timeout();
    const req = { provider: this.mode() === 2 ? (this.ollama() ? 'ollama' : 'local') : 'claude', timeout: ms, body: this.body(system, user, o.schema) };
    let timer;
    const res = await Promise.race([
      Promise.resolve().then(() => this.transport(req)).catch(() => null),
      new Promise((r) => { timer = setTimeout(() => r(null), ms + 500); }),
    ]);
    clearTimeout(timer);
    const p = this.parse(res);
    if (p.refused) { this.lastFail = 'refused'; return null; }   // a refusal is an answer, not a breakdown: no strike
    const out = p.data ? (o.raw ? (p.data && typeof p.data === 'object' ? p.data : null) : this.clean(p.data)) : null;   // (raw: a summary, a whole exchange: the caller checks it)
    if (!out) {
      this.lastFail = p.why || 'unusable reply';
      if (!o.noStrike && ++this.fails >= this.MAX_FAILS && !this.sessionOff) {   // (a prefetch nobody saw is no strike)
        this.sessionOff = true;
        const g = G.scenes.stack.find((s) => s instanceof G.GameScene);
        if (g && g.toast) g.toast('AI dialogue is not answering. Using Classic dialogue for the rest of this session.', 'warn');
      }
      return null;
    }
    this.fails = 0;
    return out;
  },

  // ---------------------------------------------------------------- what the NPC knows
  treeId(r) { if (r._treeId === undefined) r._treeId = Object.keys(G.DIALOGUES).find((k) => G.DIALOGUES[k] === r.tree) || null; return r._treeId; },
  locked(r, node) {
    if (!node || !node.text || typeof node.text !== 'string') return true;
    const id = this.treeId(r), tn = r.tree && node.id && r.tree[node.id];
    if (r.tree && r.tree.lore) return true;
    if (tn && tn.lore) return true;
    if (id && (this.LORE.trees.has(id) || (this.builtinTrees && !this.builtinTrees.has(id)))) return true;   // the user's own trees (world files) too
    if (this.LORE.nodes.test(node.id || '')) return true;
    return this.LORE.npcs.has(r.npc.id);
  },
  usable(r) {
    return this.active() && r && r.constructor === G.DialogueRunner && !r.npc.remote && !(r.npc.st && r.npc.st.brain);
  },
  log(r, who, text) { if (!text) return; (r.aiLog = r.aiLog || []).push({ who, text: String(text).slice(0, 300) }); if (r.aiLog.length > 10) r.aiLog.shift(); },
  context(r) {
    const npc = r.npc, st = npc.st || {}, def = npc.def || {}, sc = r.scene, w = sc.world, p = sc.player, out = [];
    const add = (k, v) => { if (v != null && v !== '' && v !== false) out.push(`${k}: ${v}`); };
    try {
      const P = G.social.persona(npc.id), f = def.faction && G.FACTIONS[def.faction];
      const showFaction = f && f.listed !== false && !(f.covert && !r.revealsFaction());
      add('You', G.identity.sheet(w, npc.id));
      add('What the player calls you', st.introduced ? `they know your name; to them you are also "${st.name}"` : `they do not know your name yet, only "${st.name}"`);
      add('Your work', def.job || st.name);
      if (G.fmind) add('Your group', G.fmind.sheet(w, npc.id)); else add('You are with', showFaction ? f.name : null);
      add('Way of life', G.lifestyle && G.lifestyle.of ? G.lifestyle.of(npc.id) : null);
      add('Age', def.kid ? 'a child: talk like one' : null);
      add('Personality', `${P.trait}; ${G.identity.temperament(P)}. ${G.util.capitalize(P.quirk)}`);
      add('Way of talking', P.voice);
      add('About you', `into ${P.hobby}; originally ${P.origin}; you dream to ${P.you.dream}; you worry about ${P.you.worry}; favorite food ${P.you.food}`);
      add('Mood', [st.mood, G.emo ? G.emo.label(w, npc.id) : null].filter(Boolean).join(', ') || null);
      add('What is going on right now', this.situation(r));
      // how they feel in their body (js/game/companionlife.js): they may bring it up, and ask for food or a rest
      if (G.companionLife) { const nd = G.companionLife.needs(st); if (npc.hp < (npc.maxHp || 30) * 0.6) nd.push('hurt'); add('Right now you are', nd.length ? nd.join(', ') : null); }
      add('Waiting', st.companion && st.compWait ? 'the player asked you to wait here for them' : null);
      // the player is in your place without being allowed (js/game/doors.js): you may throw them out, or let them stay
      if (G.doors && G.doors.intruding) { const here = G.doors.intruding(sc); if (here && G.doors.ownsHere(sc, npc, here.b)) add('Your place', `the player is in your ${here.area === 'back' ? 'staff-only back room' : here.b.name.toLowerCase()} without your permission. You can tell them to leave, or let them stay a while if they ask nicely or give you a good reason (allow_stay).`); }
      const am = st.aiMood, now = w.day * 1440 + w.minutes;
      add('How you were with the player last time you talked', am && now - am.at < 720 ? am.att : null);
      add('Fear', st.fear >= 60 ? 'terrified of the player' : st.fear >= 30 ? 'uneasy' : null);
      // how much they like the player and how much they trust them: two different things (js/game/barter.js)
      if (G.rel) { const t = G.rel.tier(st, npc.id); add('Your affinity with the player', `${t.v} on a scale of -100 to 100 (${t.name})`); }
      if (G.trust) { const t = G.trust.of(w, npc.id); add('How much you trust the player', `${t.v} of 100 (${t.name.toLowerCase()})`); }
      add('Romance', st.partner ? 'you are their partner' : st.romance >= 40 ? 'you are attracted to them' : null);
      add('With the player', st.companion ? 'you are in the player\'s party: you travel and fight alongside them' : st.compBanUntil && w.day < st.compBanUntil ? 'you recently quit the player\'s party and do not want to rejoin yet' : null);
      if (G.companionMood && !st.companion) {   // would they come along? (the game's rules: js/game/companionmood.js)
        const plain = G.companionMood.joinRefusal(sc, npc, false), argued = G.companionMood.joinRefusal(sc, npc, true);
        add('Coming along with the player', !plain ? 'you would come with them if they asked' : !argued ? 'you would come with them only if they give you a good reason (a convincing argument, a real need, something in it for you); otherwise you say no' : `you would not go with them now (${argued})`);
      }
      if (G.companionMood) { const a = G.companionMood.anger(st); add('Anger at the player', a >= 15 ? `${a >= 70 ? 'furious' : a >= 40 ? 'angry' : 'irritated'} (${st.compAngerWhy || 'they upset you'}); push you much further and you ${st.companion ? 'quit the party' : 'want nothing to do with them'}` : null); }
      if (G.trust) {
        const why = G.trust.tradeRefusal(sc, npc);
        add('Trading', why ? `you would not trade with the player right now (${why.replace(/\.$/, '').toLowerCase()})` : 'you would trade items with the player if asked, if the deal is fair');
        add('Your belongings', G.trust.manageAllowed(sc, npc) ? 'you would let the player go through and manage your things' : 'you keep your things to yourself');
      }
      // work: a job you already gave them, or (when they ask for work) the jobs you could give (js/game/aijobs.js)
      if (G.aiJobs) {
        const mine = G.jobs.active(w).map((id) => G.jobs.def(w, id)).find((d) => d.giver === npc.id);
        if (mine) add('A job you gave the player', `${mine.title}: ${mine.desc} (due day ${mine.deadline})`);
        else {
          const said = ((r.aiLog || []).filter((m) => m.who === 'player').slice(-1)[0] || {}).text || '';
          if (G.aiJobs.asked(said)) add('Work', def.combat === 'guard' && st.copDealDay !== w.day && (st.disp || 0) < 40 ? 'you are police: you do not hand out work to civilians, and they have not given you a good enough reason to make an exception (wanting to make up for what they did, information, real help with a case). Turn them down.' : G.aiJobs.describe(w, npc.id) || 'you have no work to give');
        }
      }
      add('What you know of the player', (st.memory || []).map((m) => m.what).concat((st.aiMemory || []).map((m) => m.text)).join('; ') || null);
      if (G.mem) {
        const named = r._about || [], mine = G.mem.recall(w, npc.id, { about: named.concat(['player']), n: 6 });
        add('What you remember', mine.length ? mine.map((m) => G.mem.say(w, m)).join(' | ') : null);
        const why = named.filter((id) => id !== npc.id).concat(['player']).slice(0, 3).map((id) => { const l = G.mem.why(w, npc.id, id); return l.length ? `${id === 'player' ? 'the player' : w.npcs[id].realName}: ${l.join('; ')}` : null; }).filter(Boolean);
        add('Why you feel the way you do', why.length ? why.join(' | ') : null);
        const rum = (w.rumors || []).filter((x) => !x.region || x.region === sc.region).slice(-2).map((x) => x.text);
        add('Rumors going around (you do not know if they are true)', rum.length ? rum.join(' | ') : null);
      }
      if (G.fmind) { const sd = G.fmind.playerSide(w, npc.id); add('The player and your people', sd.same ? `they are one of yours, ${G.factionRanks ? G.factionRanks.title(w, sd.same) : 'a member'}` : sd.enemy ? `they run with ${G.FACTIONS[sd.enemy].name}, your enemies` : null); }
      if (st.warned && st.warned.day === w.day && def.combat === 'guard') add('The player has been disrespecting you', `${st.warned.n} time(s) today: ${st.warned.stage === 'warn' ? 'you warned them' : 'you are done warning them, they are going in'}`);
      add('Places that exist (the only ones you may name)', G.identity.placesFor(w, def.map).join(', '));
      add('The player', st.playerName ? `told you their name is ${G.util.capitalize(st.playerName)}` : 'has not told you their name');
      add('In your pockets', G.npcInv ? G.npcInv.pockets(npc) : null);
      add('What your hands can reach', G.npcInv ? G.npcInv.reach(npc, sc) : null);
      add('What the player can ask of you here (the game does it if you agree)', r.barOptions && r.barOptions.length ? r.barOptions.join(' | ') : null);
      add('Place', `${sc.map.meta.name}${sc.region ? ' (' + (G.REGIONS[sc.region] ? G.REGIONS[sc.region].name : sc.region) + ')' : ''}`);
      add('Time', `${w.timeString}, day ${w.day}${w.hourF >= 21 || w.hourF < 5 ? ', night' : ''}${G.weather && G.weather.kind && G.weather.kind !== 'clear' && !sc.map.meta.indoor ? ', ' + G.weather.kind : ''}`);
      add('Around you', (() => { try { return this.surroundings(r); } catch (err) { return null; } })());   // (a missing detail never costs the rest)
      // what was said before, and the people in their life (js/game/npctalk.js)
      if (G.npcTalk) {
        const T = G.npcTalk, mine = T.past(w, npc.id, 'player');
        add('Your past conversations with the player', mine.length ? mine.map((c) => `${T.when(w, c)}${c.phone ? ' (phone)' : ''}: ${c.gist}`).join(' | ') : 'none: this is the first time you really talk');
        const people = T.knownPeople(w, npc.id).map((id) => { const b = T.bond(w, npc.id, id); return `${w.npcs[id].realName} (${G.NPCS[id].name}${b.rel ? ', ' + b.rel : ''}): ${b.name}, trust ${b.trust}`; });
        add('People in your life', people.length ? people.join('; ') : null);
        const others = T.past(w, npc.id).filter((c) => c.with !== 'player').slice(-2).map((c) => `${T.when(w, c)} with ${w.npcs[c.with] ? w.npcs[c.with].realName : 'someone'}: ${c.gist}`);
        add('Your recent talks with others', others.length ? others.join(' | ') : null);
      }
      // what they themselves saw and overheard lately (js/game/awareness.js): they may bring it up
      if (G.aware) { const now = w.day * 1440 + w.minutes, seen = G.aware.recent(npc); add('What you saw and heard recently', seen.length ? seen.map((e) => `${e.text} (${now - e.t < 3 ? 'just now' : Math.round(now - e.t) + ' minutes ago'})`).join('; ') : null); }
      const vis = [];
      const wp = p.weaponItem;
      if (wp) vis.push(`holding a ${wp.name.toLowerCase()}`);
      if (!p.equip.top && !p.equip.bottom) vis.push('naked');
      if ((p.bloody || 0) >= 0.35) vis.push('covered in blood');
      if (p.effects && p.effects.some((e) => e.id === 'bleeding')) vis.push('bleeding');
      if ((p.alcohol || 0) >= 40) vis.push('drunk');
      if (p.equip.mask) vis.push('wearing a mask');
      add('The player right now', vis.join(', ') || 'nothing unusual');
      add('The player\'s reputation here', sc.region ? G.repLabel(w.getRep(sc.region)) : null);
      add('Word about the player', G.fame && G.fame.level(w) ? G.fame.title(w) : null);
      add('Police', G.law && G.law.isWanted(w) ? 'the player is wanted everywhere' : null);
    } catch (e) { /* a missing detail is fine */ }
    return out.join('\n');
  },
  // Who and what is around: the building you are in, the people near you (how you know them, what they are doing,
  // who is with the player), the player's party and animals, and anything alarming (bodies, fighting, fire).
  surroundings(r) {
    const npc = r.npc, sc = r.scene, w = sc.world, p = sc.player, map = sc.map, out = [], R = 200;
    const b = map.buildingAt && map.buildingAt(npc.x, npc.y - 3);
    out.push(!b ? 'outdoors' : w.flags.player_home === b.id ? "inside the player's home" : npc.def.home === b.id ? 'inside your home' : `inside the ${b.name.replace(/^(the|your) /i, '')}`);
    const near = sc.actors.filter((a) => a !== npc && a !== p && !a.remote && Math.hypot(a.x - npc.x, a.y - npc.y) < R);
    const people = near.filter((a) => a.kind === 'npc' && a.st && G.NPCS[a.id]).sort((a, c) => a.distTo(npc) - c.distTo(npc)).slice(0, 7);
    const ppl = people.map((a) => {
      const rel = (npc.def.relations || {})[a.id] || (a.def.relations || {})[npc.id], op = G.social.opinion(w, npc.id, a.id);
      const how = rel || (op >= 40 ? 'a friend' : op <= -30 ? 'someone you dislike' : a.st.realName && G.NPCS[a.id].map === npc.def.map ? 'someone you know by sight' : 'a stranger');
      const doing = a.dead ? 'dead' : a.sleeping ? 'asleep' : a.state === 'fight' ? 'fighting' : a.state === 'flee' ? 'running away scared' : a.st.ko ? 'unconscious' : a.talking ? 'talking' : a.seated ? 'sitting' : a.moving ? 'walking by' : 'standing nearby';
      return `${a.st.realName} (${a.def.name}, ${how}${a.st.companion ? ', with the player' : ''}): ${doing}`;
    });
    if (ppl.length) out.push('people near you: ' + ppl.join('; '));
    const party = sc.actors.filter((a) => a.kind === 'npc' && a.st && a.st.companion && !a.dead && a !== npc);
    if (party.length) out.push('the player\'s party: ' + party.map((a) => `${a.st.realName} (${a.def.name})`).join(', '));
    const animals = near.filter((a) => a.kind === 'animal' && !a.dead).slice(0, 3);
    if (animals.length) out.push('animals: ' + animals.map((a) => (a.rec && a.rec.name ? `${a.rec.name}, the player's ${(a.def && a.def.name || a.species || 'animal').toLowerCase()}` : (a.def && a.def.name || a.species || 'an animal').toLowerCase())).join(', '));
    const bodies = (sc.containers || []).filter((c) => c.kind === 'corpse' && Math.hypot(c.x - npc.x, c.y - npc.y) < R).length;
    if (bodies) out.push(bodies === 1 ? 'a dead body is lying nearby' : `${bodies} dead bodies are lying nearby`);
    if (near.some((a) => a.state === 'fight')) out.push('there is a fight going on');
    if (sc.fire && sc.fire.cells && sc.fire.cells.size) out.push('something is on fire');
    return out.join('; ');
  },
  conversation(r) { return (r.aiLog || []).map((m) => `${m.who === 'npc' ? 'You' : 'The player'}: ${m.text}`).join('\n'); },
  // what is happening to them this second: someone in a fight does not chat like someone on a bench
  situation(r) {
    const npc = r.npc, sc = r.scene, p = sc.player, st = npc.st;
    if (r.tree === G.DIALOGUES._jailcall) return 'the player is calling you on the phone from the County Jail, where they are locked up. You are outside, not there with them. They have one short call.';
    if (r.tree === G.DIALOGUES._debt) return 'you are a loan shark and the player owes you money past the deadline: you came to collect';
    if (npc.state === 'fight') return `you are in the middle of a fight${npc.target === p ? ' with the player' : npc.target && npc.target.st ? ` with ${npc.target.st.realName}` : ''}: short, breathless, no small talk`;
    if (npc.state === 'flee') return 'you are running away, terrified';
    if (npc.seated) return 'you are sitting down';
    if (st.order) return `you are doing what the player told you (${st.order.t})`;
    const e = npc.currentEntry && npc.currentEntry(sc.world);
    return e && e.act === 'work' ? 'you are at work' : null;
  },
  // who the words are about, for this listener: their own name is them, other names are other people
  whoIsMeant(r, said) {
    const w = r.scene.world, npc = r.npc, out = [], ids = G.identity.aboutFor(w, npc.id, said);
    r._about = ids;
    for (const id of ids) {
      const n = G.identity.names(w, id).full;
      if (id === npc.id) out.push(`"${n}" is YOU. The player is talking about you: answer in the first person ("me", "I"), never by your name.`);
      else { const b = G.npcTalk.bond(w, npc.id, id); out.push(`${n} is someone else (${b.rel ? `your ${b.rel}, ` : ''}${G.NPCS[id].name}, ${b.name.toLowerCase()}): "he/she/they", never "I".`); }
    }
    for (const h of G.identity.scan(w, said)) if (!ids.includes(h.id)) out.push(`You do not know anyone called ${G.identity.names(w, h.id).first}.`);
    return out.join(' ');
  },
  // holds a generated reply to who is speaking and to the world that exists
  hold(r, res) {
    const w = r.scene.world, npc = r.npc, I = G.identity, names = I.names(w, npc.id);
    res.line = I.cleanPlaces(w, I.fixLine(w, npc, res.line));
    const role = String(npc.def.name || '').split(' ').pop();
    res.choices = res.choices.map((c) => I.fixChoice(res.line, I.cleanPlaces(w, c), { names, role })).filter(Boolean);
    return res;
  },
  sayChoices(list) { return (list || []).map(sayChoice); },
  backChoices() { return BACK(); },
  // One thing the player said, start to finish: the instruction in it and what they decide (js/game/orders.js), their
  // answer, and what comes of it. The same road for the dialogue window and for T. null: use the written answer.
  async exchange(r, text, ticket = {}) {
    const sc = r.scene, npc = r.npc, O = G.orders;
    this.log(r, 'player', text);
    const ord = O && !npc.remote ? O.parse(text) : null;
    // (asking to come along keeps its own road: the argument, the Charisma roll)
    let plan = ord && !(FOLLOW.test(G.i18n.toEnglish(text)) && !npc.st.companion) ? O.judge(sc, npc, ord) : null;
    const res = await this.npcLine(r, { said: text, free: true, plan });
    if (ticket.off) return null;
    if (!res) { (r.aiLog || []).pop(); return null; }
    let late = false;
    if (res.order === 'confess') { if (G.confession && G.confession.isCop(npc) && !npc.remote) G.confession.act(sc, npc, { kind: 'assault', sev: 2 }); res.order = null; }
    if (!plan && !ord && res.order && O && !npc.remote) { plan = O.judge(sc, npc, { intent: res.order, text, place: null }); late = true; }
    if (plan) {
      // the game decided; words that say otherwise do not stand
      const heard = G.i18n.toEnglish(res.line);
      const says = /^\s*(sure|ok|okay|fine|alright|all right|yes|yeah|you got it|on it|of course|will do)\b/i.test(heard), nay = /^\s*(no|nope|never|not a chance|forget it|i won'?t|i can'?t)\b/i.test(heard);
      const balks = /\b(no way|not (some|your|a) \w+|not happening|i can'?t|i won'?t|i will not|i'?m not (going|gonna|doing|about to|your|some|a )|why would i|forget it|find someone else|do it yourself)\b/i.test(heard);
      if (plan.ok ? nay || balks : says || late) res.line = O.written(sc, npc, plan);
      res.actions = res.actions.filter((a) => !['join_party', 'wait', 'go_home', 'leave_party', 'fight', 'flee'].includes(a.type));
    }
    const acts = res.actions.concat(res.job ? [Object.assign({}, res.job, { type: 'job' })] : [],
      res.calm ? [{ type: 'calm', amount: Math.max(res.argument || 0, argumentScore(r, text)), backs: res.backs }]
        : res.comes ? [{ type: 'join_party' }] : res.argument != null ? [{ type: 'persuade_join', amount: Math.max(res.argument, argumentScore(r, text)) }] : []);
    if (!plan) acts.push(...this.promised(r, res.line, acts));   // (what the line says they are doing, if the model left it out)
    const extra = this.apply(r, acts, true, res.attitude);
    this.feel(r, res.attitude, true);
    if (plan) {
      O.remember(sc, npc, plan);
      if (plan.ok) { if (O.carry(sc, npc, plan) === false && !late) res.line = 'I cannot do that right now.'; }
      else if (plan.price) { if (sc.player.gold >= plan.price) extra.choices.unshift({ raw: { next: null, do: () => { O.deal(sc, npc, plan); } }, text: `[Pay $${plan.price}]` }); }
      else if (plan.follow) O.carry(sc, npc, Object.assign({}, plan, { intent: 'follow' }));
    }
    // the police, spoken to like that (js/game/overhear.js): they end this talk
    npc._warnLine = null;
    if (G.overhear && G.overhear.queue.some((j) => j.npc === npc)) extra.end = true;
    if (extra.sayInstead) res.line = extra.sayInstead;   // (the game could not do what the words promised)
    if (extra.saidAfter) res.line += ' ' + extra.saidAfter;
    this.log(r, 'npc', res.line);
    return { line: res.line, end: extra.end, afters: extra.afters, say: res.choices, extra: extra.choices, option: extra.option };
  },
  // a line for this NPC: { written } is a tree line to say in their voice; { said } is what the player just said
  npcLine(r, o) {
    const key = `${G.i18n.code()}|${r.npc.id}|${o.written || ''}|${o.said || ''}|${o.free ? 1 : 0}|${o.plan ? o.plan.intent + o.plan.ok : ''}`, hit = this.cache.get(key);
    if (hit && performance.now() - hit.t < this.CACHE_MS) { this.cache.delete(key); return hit.p; }
    const system = `You voice one person in "Unholium", a modern-day crime RPG set in an unnamed city and its countryside. The game owns every fact and rule; you only speak for this person and may suggest small reactions.\n${RULES}${A.RULES_ITEMS || ''}`;
    // asked for work (and no job of theirs going yet): the reply must carry a job (or "none"), held to the people,
    // items and kinds this person could really give (js/game/aijobs.js)
    const w = r.scene.world, npc = r.npc;
    // (the police hand out work only to someone who convinced them: G.aiJobs.copReady rolls for it once a day)
    const jobMode = G.aiJobs && o.said && G.aiJobs.asked(o.said) && !npc.def.kid && (npc.st.fear || 0) < 40 && !npc.st.hostile && !G.jobs.active(w).some((id) => G.jobs.def(w, id).giver === npc.id)
      && (npc.def.combat !== 'guard' || G.aiJobs.copReady(r.scene, npc, o.said, argumentScore(r, o.said)));
    // asked to come along: the reply must say yes or no ("comes_along"); the game still checks it could happen
    const followMode = !jobMode && o.said && FOLLOW.test(G.i18n.toEnglish(o.said)) && !npc.st.companion;
    // talking them out of a fight or a mugging (js/game/persuade.js): the reply must say whether they back off
    const calmMode = !jobMode && !followMode && o.said && G.persuade && (r.tree === G.DIALOGUES._standoff || r.tree === G.DIALOGUES._mugging);
    const extra = (props) => Object.assign({}, SCHEMA, { properties: Object.assign({}, SCHEMA.properties, props), required: SCHEMA.required.concat(Object.keys(props)) });
    // said in the open: what it is telling them to do, if the game did not catch it (it never decides anything)
    const orderMode = o.free && !o.plan && !jobMode && !followMode && !calmMode && !npc.remote;
    const schema = jobMode ? G.aiJobs.schema(w, npc.id, SCHEMA)
      : followMode ? extra({ comes_along: { type: 'boolean' }, argument: { type: 'integer' } })
        : calmMode ? extra({ backs_off: { type: 'boolean' }, argument: { type: 'integer' } })
          : orderMode ? extra({ order: { type: 'string', enum: ORDERS } }) : null;
    const meant = o.said ? this.whoIsMeant(r, o.said) : (r._about = [], '');
    const user = [`About you:\n${this.context(r)}`, r.aiLog && r.aiLog.length ? `Conversation so far:\n${this.conversation(r)}` : null,
      o.said ? `The player says to you: "${o.said}"` : null, meant || null,
      orderMode ? `"order": if the player is telling you to do something, the closest of ${ORDERS.slice(1, -1).join(', ')}; if they are admitting a real crime they committed, in any words, even slang or indirect ("confess"); otherwise "none".` : null,
      o.written ? `Written line to say in your own voice (keep its meaning and every name, number and place): "${o.written}"` : 'Answer the player in your own words.',
      followMode ? `The player is asking you to come with them. ${(() => {
        const M = G.companionMood, plain = M && M.joinRefusal(r.scene, npc, false), argued = M && M.joinRefusal(r.scene, npc, true);
        if (!plain) return 'You like them: say yes (comes_along true) unless they were rude to you just now.';
        if (!argued) return 'You need a reason to go. If they give you something concrete (money, help with a real problem, a cause or a person you care about, something you want), you are convinced: say yes (comes_along true). A bare request with no reason is not enough: say no.';
        return `You cannot go with them now (${argued}): say no (comes_along false).`;
      })()} Say yes or no in your line too. "argument": how convincing the player's reason is to you, 0 (no reason at all) to 10 (impossible to refuse).` : null,
      calmMode ? `${r.tree === G.DIALOGUES._mugging ? 'You are mugging the player and they answer you.' : 'You are about to fight the player (or already fighting) and they are talking to you.'} "backs_off": true only if what they say really convinces you, scares you, or offers you enough (a flat "no" is not a reason). "argument": how convincing or intimidating it is to you, 0 to 10. Your line says what you do.` : null,
      o.plan ? `IMPORTANT: ${G.orders.brief(o.plan, w)}` : null,
      o.free ? `"choices" are what the PLAYER could answer you next, not what you would say: they are not ${G.identity.names(w, npc.id).first}, they do not live here, they have no part of your life.` : null,
      jobMode ? 'The player is asking you for work. Fill "job" with one job from "Work you could give" (kind, target id, item id, count, pay, a short title, and why you need it), or kind "none" if you would not give them work. If you give one, your line offers it in your own words: who, what, where, how much.' : null,
    ].filter(Boolean).join('\n\n');
    const p = this.ask(system, user, { noStrike: o.prefetch, who: r.npc.id, schema: schema || undefined }).then((res) => (res ? this.hold(r, res) : res));
    if (o.prefetch) this.cache.set(key, { t: performance.now(), p });
    return p;
  },
  // the attitude the line was said with: remembered (it colors the next lines too) and, checked against what is
  // really going on, a small real effect. A written tree line only gets remembered.
  feel(r, att, free) {
    const npc = r.npc, st = npc.st, w = r.scene.world, p = r.scene.player;
    if (!st || !ATTITUDES.includes(att)) return;
    if (att === 'affectionate' && !((st.romance || 0) >= 20 || st.partner)) att = 'friendly';   // (not from a stranger)
    st.aiMood = { att, at: w.day * 1440 + w.minutes };
    if (!free) return;
    const scared = this.threatened(r) || !!p.weaponItem || (G.law && G.law.isWanted && G.law.isWanted(w));
    if (att === 'afraid' && scared) st.fear = Math.max(st.fear || 0, 35);
    else if (att === 'hostile' && (this.threatened(r) || (st.disp || 0) <= -20)) G.social.addDisp(w, npc.id, -2);
    else if (att === 'annoyed') G.social.addDisp(w, npc.id, -1);
    else if (/^(friendly|affectionate|amused)$/.test(att) && !r._warmed && (st.disp || 0) < 60) { r._warmed = true; G.social.addDisp(w, npc.id, 1); }
  },
  // A short reaction out loud to something they just saw or heard (js/game/awareness.js): one line, in character,
  // or nothing. Resolves to the line, or null (then the game uses a written one).
  BARK_SCHEMA: { type: 'object', properties: { line: { type: 'string' }, attitude: { type: 'string', enum: ATTITUDES } }, required: ['line', 'attitude'], additionalProperties: false },
  async bark(scene, npc, e) {
    if (!this.active() || !npc.st || npc.def.kid && /naked|blood|death/.test(e.kind)) return null;
    const st = npc.st, w = scene.world, P = G.social.persona(npc.id), t = G.rel.tier(st, npc.id);
    const recent = G.aware ? G.aware.recent(npc).slice(-3).map((x) => x.text).join('; ') : '';
    const system = `You voice one person in "Unholium", a modern-day crime RPG, reacting out loud in the street. Plain modern English, in character, no stage directions, no quotation marks. Never invent names, places or lore. Keep it non-explicit. Answer with JSON only: {"line": "...", "attitude": "..."}`;
    const user = [`You are ${G.identity.names(w, npc.id).full}, ${npc.def.name}${npc.def.kid ? ' (a child)' : ''}. Personality: ${P.trait}; ${G.identity.temperament(P)}. You talk like this: ${P.voice}. ${st.mood ? 'Mood: ' + st.mood + '. ' : ''}How you feel about the player: ${t.name}.`,
      `Place: ${scene.map.meta.name}, ${w.timeString}${w.isNight() ? ', night' : ''}.`, recent ? `Earlier: ${recent}.` : null,
      e.direct ? `You speak up to the player. ${e.hint}` : `Just now you ${e.text}.`, !e.direct ? e.hint : null, 'Say one short line out loud (under 14 words), the way you really would. Speak to the player as "you"; you are "I". Never say your own name. If you would not say anything, make "line" empty.'].filter(Boolean).join('\n');
    const r = await this.ask(system, user, { noStrike: true, schema: this.BARK_SCHEMA });
    if (!r || !r.line) return null;
    const line = G.identity.cleanPlaces(w, G.identity.fixLine(w, npc, r.line)).split(/(?<=[.!?])\s/).slice(0, 2).join(' ').slice(0, 90);
    return line.length >= 2 ? line : null;
  },
  // Keeping their word: what the line itself says they are doing right now, as the action, when the model left it
  // out. The game checks it like any other action, so a promise it would not allow still does not happen.
  promised(r, line, acts) {
    const t = String(line || ''), lo = t.toLowerCase(), st = r.npc.st, have = new Set(acts.map((a) => a.type)), out = [];
    const add = (a) => { if (!have.has(a.type)) { have.add(a.type); out.push(a); } };
    if (/\b(here(,| you go| take| have)|take (this|it|these)|have (this|it|these|mine)|it'?s yours|you can have|keep it)\b/i.test(t)) {
      const it = (st.inv || []).find((e) => e[1] > 0 && G.ITEMS[e[0]] && lo.includes(G.item(e[0]).name.toLowerCase()));
      if (it) add({ type: 'give', item: it[0] });
    }
    const money = t.match(/(?:here'?s|take|have|giving you|i'?ll (?:give|pay) you|here is)\s+\$(\d+)/i);
    if (money) add({ type: 'pay', amount: +money[1] });
    if (/\b(i'?m calling|i'?ll call|i am calling|calling) (the )?(police|cops|911)\b/i.test(t)) add({ type: 'call_police' });
    if (/\b(i'?ll come|i'?m coming( with you)?|lead the way|count me in|i'?ll join you|i'?m in\b)/i.test(t)) add({ type: 'join_party' });
    if (st.companion && /\b(i'?ll wait|i'?ll be (right )?here|waiting (right )?here)\b/i.test(t)) add({ type: 'wait' });
    if (st.companion && /\b(i'?m (going|heading) home|i'?ll (go|head) home)\b/i.test(t)) add({ type: 'go_home' });
    if (/\b(get (out|lost)|leave me alone|we'?re done( here)?|go away|this conversation is over)\b/i.test(t)) add({ type: 'refuse' });
    if (/\b(you can stay|make yourself at home|stay as long as you (like|want)|stay a while|you'?re welcome (here|to stay))\b/i.test(t)) add({ type: 'allow_stay' });
    if (/\b(somebody help|stay away from me)\b/i.test(t)) add({ type: 'flee' });
    if (/\b(you'?re dead|i'?ll kill you|let'?s (fight|do this)|bring it on)\b/i.test(t)) add({ type: 'fight' });
    return out;
  },
  threatened(r) { return THREAT.test(lastSaid(r)); },
  // the proposed actions, checked against the game. free: a generated exchange (a written tree line only changes
  // feelings and memories). Returns extra choices to offer, and whether the conversation ends.
  apply(r, actions, free, attitude) {
    const npc = r.npc, st = npc.st, sc = r.scene, w = sc.world, p = sc.player, kid = !!npc.def.kid, out = { choices: [], end: false, afters: [], done: [] };
    const threat = this.threatened(r), fighter = npc.def.combat === 'fight' || npc.def.combat === 'guard';
    for (const a of actions || []) {
      switch (a.type) {
        case 'like': { const n = clamp(Math.round(+a.amount || 0), free ? -10 : -3, free ? 10 : 3); if (n) { G.social.addDisp(w, npc.id, n); out.done.push('like'); } break; }
        case 'remember': { const t = String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (t) { st.aiMemory = (st.aiMemory || []).filter((m) => m.text !== t).concat([{ text: t, day: w.day }]).slice(-5); out.done.push('remember'); } break; }
        case 'learn': if (['hobby', 'origin', 'dream', 'worry'].includes(a.fact) && (st.disp || 0) > -40 && G.rel) { G.rel.learn(st, a.fact); out.done.push('learn'); } break;
        case 'offer_job': if (free && !kid) { out.choices.push({ raw: { next: '_job_offer' }, text: 'What kind of work?' }); out.done.push('offer_job'); } break;
        case 'sell': if (free && G.shopSys.shopFor(npc.id, w)) { out.choices.push({ raw: { do: (c) => c.openShop() }, text: 'Show me what you have.' }); out.done.push('sell'); } break;
        // a job of their own making: real only if the game can track it (js/game/aijobs.js); taking it makes it a job
        case 'job': {
          if (!free || !G.aiJobs || out.done.includes('job')) break;
          const def = G.aiJobs.build(w, npc.id, a);
          if (!def) break;
          st.jobOffer = { day: w.day, def };
          out.choices.unshift({ raw: { next: null, do: () => { G.jobs.accept(r, def); sc.toast(`New job: ${def.title}`, 'quest'); } }, text: `[Take the job: ${def.title}]` });
          out.done.push('job');
          break;
        }
        case 'trust': { const n = clamp(Math.round(+a.amount || 0), free ? -5 : -1, free ? 5 : 1); if (n && G.trust) { G.trust.adjust(w, npc.id, n); out.done.push('trust'); } break; }
        // trading and their belongings: the screen opens only if they really would (js/game/barter.js decides)
        case 'trade': if (free && G.trust && !G.trust.tradeRefusal(sc, npc) && !out.done.includes('trade')) { out.choices.unshift({ raw: { next: null, do: (c) => { G.trust.openTrade(c.scene, c.npc); } }, text: '[Trade]' }); out.done.push('trade'); } break;
        case 'manage_items': if (free && G.trust && G.trust.manageAllowed(sc, npc) && !out.done.includes('manage_items')) { out.choices.unshift({ raw: { next: null, do: (c) => { G.trust.openManage(c.scene, c.npc); } }, text: '[Go through their things]' }); out.done.push('manage_items'); } break;
        case 'give': {
          if (!free) break;
          const e = (st.inv || []).find((x) => x[0] === a.item && x[1] > 0);
          if (e && G.ITEMS[e[0]] && !G.ITEMS[e[0]].gun && p.inventory.canFit(e[0])) { e[1]--; st.inv = st.inv.filter((x) => x[1] > 0); p.inventory.add(e[0]); sc.toast(`${npc.displayName} gave you ${G.item(e[0]).name}.`, 'good'); out.done.push('give'); }
          break;
        }
        case 'call_police': if (free && threat && !kid && npc.def.combat !== 'guard') { out.end = true; out.afters.push(() => { st.fear = Math.max(st.fear || 0, 80); npc.startFlee(p); sc.reportCrime('extortion', npc); }); out.done.push('call_police'); } break;
        case 'refuse': if (free) { out.end = true; out.done.push('refuse'); } break;
        // letting you stay in their place (you are not trespassing for a few hours): not from someone who dislikes,
        // distrusts or fears you, and only if it really is theirs
        case 'allow_stay': {
          const D = G.doors, here = D && D.intruding && D.intruding(sc);
          if (!free || !here || !D.ownsHere(sc, npc, here.b) || st.hostile || (st.fear || 0) >= 40 || (st.disp || 0) < 0 || (G.trust && G.trust.of(w, npc.id).v < 25)) break;
          D.letStay(sc, here.b); sc.toast('You can stay here for a while.', 'good'); out.done.push('allow_stay');
          break;
        }
        case 'pay': { const n = Math.min(Math.round(+a.amount || 0), st.gold || 0, 300); if (free && n > 0) { st.gold -= n; p.gold += n; G.audio.play('coin'); sc.toast(`${npc.displayName} gave you $${n}.`, 'good'); out.done.push('pay'); } break; }
        case 'wait': if (free && st.companion && !st.compWait && G.DIALOGUE_NODES._comp_wait) { G.DIALOGUE_NODES._comp_wait(r); out.done.push('wait'); } break;
        case 'go_home': if (free && st.companion) { G.companions.dismiss(sc, npc); out.done.push('go_home'); } break;
        // talked out of a fight or a mugging (js/game/persuade.js): a roll on how good the case was; their "yes" helps
        case 'calm': {
          const P = G.persuade;
          if (!free || !P || out.done.includes('calm') || !P.canTry(w, npc)) break;
          const mugging = r.tree === G.DIALOGUES._mugging;
          out.done.push('calm'); out.end = true;
          if (P.calm(sc, npc, clamp(+a.amount || 0, 0, 10), { bonus: a.backs ? 3 : 0 })) { if (!a.backs) out.saidAfter = G.rng.pick(['...Forget it. Not worth it.', '...Fine. Get lost.']); }
          else if (mugging) P.refuseMugger(sc, npc);
          else { st.hostile = true; npc.aggressor = true; if (a.backs) out.saidAfter = '...Nah. Nice try.'; }
          break;
        }
        // coming along: you asked, they agreed (convinced, or they just like you), and the game says they could
        case 'join_party': {
          const M = G.companionMood;
          if (!free || !M || out.done.includes('join_party') || !FOLLOW.test(lastSaid(r)) || M.joinRefusal(sc, npc, true)) break;
          G.companions.start(sc, npc); sc.toast(`${npc.displayName} is coming with you.`, 'good');
          out.done.push('join_party');
          break;
        }
        // they said no, but you made a case: a Charisma roll, harder the weaker the argument (once a day each)
        case 'persuade_join': {
          const M = G.companionMood, strength = clamp(+a.amount || 0, 0, 10);
          if (!free || !M || out.done.includes('join_party') || strength < 4 || !FOLLOW.test(lastSaid(r)) || st.companion) break;
          if (!M.joinRefusal(sc, npc, false) || M.joinRefusal(sc, npc, true)) break;   // (only for those who need convincing and could be)
          const checks = st.checks = st.checks || {};
          if (checks.follow_persuade === w.day) break;
          checks.follow_persuade = w.day;
          if (G.skills.roll(p, 12 - strength - Math.round((st.disp || 0) / 25), 'charisma')) {
            G.companions.start(sc, npc);
            out.saidAfter = G.rng.pick(['...Alright. You make a good point. Let us go.', '...Fine. You talked me into it.', '...Ugh. Okay, okay. I am coming.']);   // (they change their mind, out loud)
            sc.toast(`You talked ${npc.displayName} into coming with you.`, 'good');
            out.done.push('join_party');
          }
          break;
        }
        // quitting your party: only if they really are fed up (angry, or they have come to dislike you)
        case 'leave_party': {
          const M = G.companionMood, anger = M ? M.anger(st) : 0;
          if (free && st.companion && M && (anger >= 30 || (st.disp || 0) <= -10)) { out.end = true; out.afters.push(() => M.leave(sc, npc, anger >= M.ATTACK && fighter)); out.done.push('leave_party'); }
          break;
        }
        case 'fight': if (st.companion && G.companionMood) { if (free && G.companionMood.anger(st) >= G.companionMood.ATTACK - 15) { out.end = true; out.afters.push(() => G.companionMood.leave(sc, npc, true)); out.done.push('fight'); } break; }   // (your companion: only when truly furious)
          if (free && !kid && fighter && (threat || (st.disp || 0) <= -50)) { out.end = true; out.afters.push(() => { st.hostile = true; npc.aggressor = true; if (npc.def.combat === 'guard' && npc.startFight) npc.startFight(p, sc); }); out.done.push('fight'); } break;
        case 'flee': if (free && ((st.fear || 0) >= 40 || threat || p.weaponItem)) { out.end = true; out.afters.push(() => { st.fear = Math.max(st.fear || 0, 70); npc.startFlee(p); }); out.done.push('flee'); } break;
      }
    }
    // Small local models often agree in words and forget the action. You asked to trade (or to go through their
    // things) and they did not answer badly: if the game agrees they would, the option is there anyway.
    if (free && !out.end && G.trust && !/^(hostile|annoyed|afraid|wary)$/.test(attitude || '') && !actions.some((a) => a.type === 'refuse' || (a.type === 'like' && +a.amount < 0))) {
      const asked = lastSaid(r);
      if (!out.done.includes('trade') && /\b(trade|trading|swap|barter|exchange)\b/i.test(asked) && !G.trust.tradeRefusal(sc, npc)) { out.choices.unshift({ raw: { next: null, do: (c) => { G.trust.openTrade(c.scene, c.npc); } }, text: '[Trade]' }); out.done.push('trade'); }
      // asked to come along, a warm answer without the action: someone who likes you enough comes (no argument needed)
      if (!out.done.includes('join_party') && G.companionMood && FOLLOW.test(asked) && /^(friendly|affectionate|amused)$/.test(attitude || '') && !G.companionMood.joinRefusal(sc, npc, false)) { G.companions.start(sc, npc); sc.toast(`${npc.displayName} is coming with you.`, 'good'); out.done.push('join_party'); }
      // asked for work, no job came with the answer: the game's own offer from them (js/game/jobs.js), if they have one
      if (!out.done.includes('job') && !out.done.includes('offer_job') && G.aiJobs && G.aiJobs.asked(asked) && !kid && !G.jobs.active(w).some((id) => G.jobs.def(w, id).giver === npc.id) && G.jobs.offer(r)) { out.choices.unshift({ raw: { next: '_job_offer' }, text: 'What kind of work?' }); out.done.push('offer_job'); }
      if (!out.done.includes('manage_items') && /\b(your (stuff|things|bag|pockets|items|gear)|manage your|look through)\b/i.test(asked) && G.trust.manageAllowed(sc, npc)) { out.choices.unshift({ raw: { next: null, do: (c) => { G.trust.openManage(c.scene, c.npc); } }, text: '[Go through their things]' }); out.done.push('manage_items'); }
    }
    return out;
  },

  // ---------------------------------------------------------------- settings
  setKey(k) { this.keySet = !!k; if (G.desktop) G.platform.post('ai:key:' + (k || '')); this.fails = 0; this.sessionOff = false; },
  setLocalUrl(u) { S.set('aiLocalUrl', u); if (G.desktop) G.platform.post('ai:localurl:' + u); },
  async test() {
    this.sessionOff = false; this.fails = 0; this.lastTest = 'Testing...';
    if (!this.mode()) { this.lastTest = 'Pick AI or Local AI first'; return; }
    if (!this.ready()) { this.lastTest = this.transport ? 'No API key' : 'Needs the desktop app'; return; }
    if (this.mode() === 2) this.refreshLocal();
    const local = this.mode() === 2;   // (a local model may still be loading: wait for it)
    const r = await this.ask(`Reply with JSON only: ${SHAPE}`, 'Say "Connection works." as the line, neutral attitude, no choices, no actions.', local ? { warm: true, timeout: this.WARM_TIMEOUT } : {});
    if (r && local) this.loaded = this.localModelFor();
    this.lastTest = r ? (this.mode() === 2 ? `Works (${this.localModelFor('warm')})` : 'Works') : `Failed (${this.lastFail || 'no answer'})`;
    this.fails = 0; this.sessionOff = false;
  },
  status() {
    if (!this.mode()) return 'Off';
    if (!this.transport) return 'Needs the desktop app';
    if (this.mode() === 1 && !this.keySet) return 'Needs an API key';
    if (this.mode() === 2 && this.localUp === false) return 'Local AI server is not running';
    if (this.mode() === 2 && this.localUp && !this.localModels.length) return 'No local models installed';
    if (this.mode() === 2 && G.desktop && this.localModels.length && this.loaded !== this.localModelFor()) return this._warming ? 'Loading the model (about a minute the first time)...' : 'Model not loaded yet';
    return this.sessionOff ? 'Off for this session (no answer)' : 'Ready';
  },
  // Local AI: ask the desktop app to start the server if needed and list its models; then load the model once
  // (the first reply after a cold start would otherwise take a while)
  refreshLocal() { if (G.desktop && this.mode() === 2) G.platform.post('ai:local'); },
  // The first load of a model from disk takes a minute or so; after that a line comes in about a second. So the
  // model is loaded in the background as soon as the game starts (people use their written lines until it is
  // ready: `loaded`), and a small request every 20 minutes keeps it on the graphics card while you play.
  WARM_TIMEOUT: 240000, KEEP_MS: 20 * 60000, loaded: null,
  warmUp(force) {
    const m = this.localModelFor();
    if (this.mode() !== 2 || !this.localModels.length || (!force && (this._warm === m || this._warming))) return;
    this._warm = m; this._warming = true;
    this.ask(`Reply with JSON only: ${SHAPE}`, 'Say "Ready." as the line, neutral attitude, no choices, no actions.', { noStrike: true, timeout: this.WARM_TIMEOUT, warm: true })
      .then((r) => { this._warming = false; if (r) { this.loaded = m; this.fails = 0; } else this._warm = null; });
    clearInterval(this._keep);
    this._keep = setInterval(() => { if (this.mode() === 2 && this.loaded) this.warmUp(true); }, this.KEEP_MS);
  },
};

// the user's own dialogue trees (world files) are added later: what exists now is built in
document.addEventListener('DOMContentLoaded', () => { A.builtinTrees = new Set(Object.keys(G.DIALOGUES)); });

// ---------------------------------------------------------------- the desktop host
if (G.desktop) {
  window.chrome.webview.addEventListener('message', (e) => {
    const s = e.data;
    if (typeof s !== 'string' || !s.startsWith('ai:')) return;
    if (s.startsWith('ai:keystatus:')) { A.keySet = s.endsWith('1'); return; }
    if (s.startsWith('ai:localstatus:')) { A.localUp = s.endsWith('1'); return; }
    if (s.startsWith('ai:models:')) {
      try { A.localModels = JSON.parse(s.slice(10)).filter((m) => typeof m === 'string' && !/embed/i.test(m)).sort(); } catch (err) { A.localModels = []; }
      A.localUp = true; A.warmUp();
      return;
    }
    if (s.startsWith('ai:reply:')) {
      const r = s.slice(9), i = r.indexOf(':'), j = r.indexOf(':', i + 1);
      const cb = A.pending.get(+r.slice(0, i));
      if (cb) { A.pending.delete(+r.slice(0, i)); cb({ status: +r.slice(i + 1, j), body: r.slice(j + 1) }); }
    }
  });
  A.transport = (req) => new Promise((resolve) => {
    const id = ++A.seq;
    A.pending.set(id, resolve);
    setTimeout(() => { if (A.pending.delete(id)) resolve(null); }, req.timeout + 2000);
    G.platform.post(`ai:ask:${id}:${req.provider}:${req.timeout}:${JSON.stringify(req.body)}`);
  });
  G.platform.post('ai:status');
  G.platform.post('ai:localurl:' + S.get('aiLocalUrl'));
  A.refreshLocal();
  // switching to Local AI in Settings: start the server and load the model right away
  G.events.on('settingsChanged', () => { if (A.mode() === 2 && A._lastMode !== 2) A.refreshLocal(); A._lastMode = A.mode(); });
  A._lastMode = A.mode();
}

// ---------------------------------------------------------------- the conversation window
const DS = G.DialogueScene.prototype, _upd = DS.update, _choose = DS.choose, _submit = DS.submit;
const waitNode = (real) => ({ id: '_ai_wait', text: '...', choices: [], real });
const BACK = () => [{ raw: { next: 'start' }, text: 'Something else...' }, { raw: { next: null }, text: 'Goodbye.' }];
const sayChoice = (t) => ({ raw: {}, text: t, aiSay: true });

// while a line is being written, every dialogue skin shows "Typing..." (the dots run) instead of a typewriter
const _full = Object.getOwnPropertyDescriptor(DS, 'fullText').get;
Object.defineProperty(DS, 'fullText', { configurable: true, get() {
  return this.aiWait ? 'Typing' + '.'.repeat(1 + (Math.floor(G.loop.time * 3) % 3)) : _full.call(this);
} });
DS.update = function (dt) {
  const r = this.runner;
  if (this.aiWait) {
    this.chars = 99;
    if (G.input.pressed.has('Escape') && this.aiCancel) { G.input.pressed.delete('Escape'); this.aiCancel(); return; }
    if (r.ended) { this.finish(); return; }
    return _upd.call(this, dt);
  }
  if (r.node && r.node !== this._aiSeen && !r.ended) this.aiNode(r.node);
  else if (r.node && !r.ended && A.usable(r)) this.aiPrefetch();
  return _upd.call(this, dt);
};
// a written line arrives: say it again in their voice (the tree still decides what happens)
DS.aiNode = function (node) {
  const r = this.runner;
  this._aiSeen = node;
  if (node.ai || !A.usable(r) || A.locked(r, node)) { A.log(r, 'npc', node.text); return; }
  const said = this._aiSaid;
  this._aiSaid = null;
  const ph = waitNode(node);
  this.aiWait = true; r.node = ph; this.chars = 0; this.sel = 0;
  let done = false;
  const finish = (res) => {
    if (done) return;
    done = true; this.aiWait = false; this.aiCancel = null;
    if (this.runner !== r || r.ended) return;
    if (res) {
      node.written = node.text; node.text = res.line; node.ai = true;
      const extra = A.apply(r, res.actions, false, res.attitude);
      A.feel(r, res.attitude, false);
      const gen = res.choices.map(sayChoice).concat(extra.choices);
      if (gen.length) {
        const bye = node.choices.findIndex((c) => c.raw && c.raw.next === null && !c.raw.do && /^(goodbye|bye|\[leave\])/i.test(c.text || ''));
        if (bye >= 0) node.choices.splice(bye, 0, ...gen); else node.choices.push(...gen);
      }
    }
    if (r.node === ph) r.node = node;
    this._aiSeen = r.node; this.chars = 0; this.sel = 0;
    A.log(r, 'npc', node.text);
  };
  this.aiCancel = () => finish(null);
  A.npcLine(r, { written: node.text, said }).then(finish, () => finish(null));
};
// the player picks a generated answer or types: a generated exchange
DS.aiSay = function (text) {
  const r = this.runner, back = r.node, ticket = {};
  const ph = waitNode(back);
  this.aiWait = true; r.node = ph; this.chars = 0; this.sel = 0;
  let done = false;
  const finish = (res) => {
    if (done) return;
    done = true; this.aiWait = false; this.aiCancel = null;
    if (this.runner !== r || r.ended) return;
    ticket.off = true;
    if (!res) {   // Classic answers instead
      r.node = back; this._aiSeen = back;
      r.say(text);
      this._aiSeen = r.node; this.chars = 0; this.sel = 0;
      if (r.node && !r.ended) A.log(r, 'npc', r.node.text);
      return;
    }
    if (res.end) { r.npc.say(res.line, 4); for (const f of res.afters) f(); r.end(); return; }
    if (res.option != null && back) { const i = G.talkbar.match(res.option, G.talkbar.list(back)); if (i >= 0) { r.node = back; this.choose(i); return; } }
    r.node = { id: '_ai', text: res.line, ai: true, choices: res.say.map(sayChoice).concat(res.extra, BACK()) };
    this._aiSeen = r.node; this.chars = 0; this.sel = 0;
  };
  this.aiCancel = () => { ticket.off = true; (r.aiLog || []).pop(); finish(null); };
  A.exchange(r, text, ticket).then(finish, () => finish(null));
};
DS.choose = function (i) {
  const r = this.runner, ch = r.node && r.node.choices[i];
  if (this.aiWait) return;
  if (ch && ch.aiSay) { G.audio.play('confirm'); this.aiSay(ch.text); return; }
  if (ch && A.usable(r)) { this._aiSaid = ch.text; A.log(r, 'player', ch.text); }
  return _choose.call(this, i);
};
DS.submit = function () {
  const text = (this.input || '').trim();
  if (this.aiWait) return;   // (one thing at a time: what they are typing comes first)
  if (!text || !A.usable(this.runner)) return _submit.call(this);
  this.typing = false; this.input = '';
  G.audio.play('confirm');
  this.aiSay(text);
};
// say the next line ahead of time: the answer under the cursor, when it leads to a plain written line
DS.aiPrefetch = function () {
  const r = this.runner, ch = r.node.choices[this.sel];
  if (!ch || !ch.raw || ch.raw.do || typeof ch.raw.next !== 'string' || ch.raw.next.startsWith('_')) return;
  const key = r.node.id + '>' + ch.raw.next;
  if ((this._aiPre = this._aiPre || new Set()).has(key) || this._aiPre.size > 6) return;
  this._aiPre.add(key);
  const tn = r.tree[ch.raw.next];
  if (!tn) return;
  let text;
  try { text = typeof tn.text === 'function' ? tn.text(r.c) : tn.text; } catch (e) { return; }
  if (!text || A.locked(r, { id: ch.raw.next, text })) return;
  A.npcLine(r, { written: text, said: ch.text, prefetch: true });
};

// ---------------------------------------------------------------- chatBCT
if (G.bct) {
  const B = G.bct, _ask = B.ask;
  B.ask = function (scene, text) {
    if (!A.active()) return _ask.call(this, scene, text);
    const h = this.history(scene.world), facts = this.reply(scene, text);
    h.push({ who: 'you', text });
    const entry = { who: 'bct', text: 'Typing...', pending: true };
    h.push(entry);
    if (h.length > 40) h.splice(0, h.length - 40);
    const w = scene.world, p = scene.player;
    const missions = (this.missions ? this.missions(w) : []).map((m) => m.title).join('; ');
    const ctx = [`Place: ${scene.map.meta.name}. Time: ${w.timeString}, day ${w.day}.`, missions ? `The player's open missions: ${missions}.` : null, `Player health ${Math.round(p.hp)}/${p.maxHp}, cash $${p.gold}.`].filter(Boolean).join('\n');
    const recent = h.slice(-9, -2).map((m) => `${m.who === 'you' ? 'Player' : 'chatBCT'}: ${m.text}`).join('\n');
    const user = `${ctx}\n\n${recent ? 'Chat so far:\n' + recent + '\n\n' : ''}The player writes: "${text}"\nThe game's answer (facts to keep, say it your way): "${facts}"`;
    A.ask(`${A.BCT_SYSTEM}\n${RULES}`, user, { who: 'bct' }).then((res) => { entry.text = res ? res.line : facts; entry.pending = false; }, () => { entry.text = facts; entry.pending = false; });
  };
}

// ---------------------------------------------------------------- a one-line text box (API key, addresses, model names)
class PromptScene {
  constructor(title, value, onDone, o = {}) {
    this.transparent = true; this.title = title; this.value = value || ''; this.onDone = onDone; this.o = o;
    this.paste = (e) => { const t = (e.clipboardData && e.clipboardData.getData('text')) || ''; if (t) { this.value = (this.value + t.trim()).slice(0, 300); e.preventDefault(); } };
    window.addEventListener('paste', this.paste);
  }
  exit() { window.removeEventListener('paste', this.paste); }
  close(ok) { G.scenes.remove(this); G.audio.play(ok ? 'confirm' : 'back'); if (ok) this.onDone(this.value.trim()); }
  update() {
    const I = G.input;
    for (const ch of I.typed) if (this.value.length < 300) this.value += ch;
    if (I.pressed.has('Backspace')) this.value = this.value.slice(0, -1);
    if (I.pressed.has('KeyV') && (I.down.has('ControlLeft') || I.down.has('ControlRight')) && navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => { if (t && !this.value.endsWith(t.trim())) this.value = (this.value + t.trim()).slice(0, 300); }).catch(() => {});
    if (I.pressed.has('Enter')) this.close(true);
    else if (I.pressed.has('Escape')) this.close(false);
  }
  render(ctx) {
    U.dim(ctx, 0.4);
    const R = G.renderer, W = 300, H = 92, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: this.title, titleSize: 12 });
    const shown = this.o.secret ? (this.value ? '•'.repeat(Math.min(28, this.value.length - 4)) + this.value.slice(-4) : '') : this.value;
    const caret = Math.floor(G.loop.time * 2) % 2 ? '|' : '';
    ctx.fillStyle = G.xp && G.xp.on ? '#ffffff' : 'rgba(0,0,0,0.45)';
    if (G.xp && G.xp.on) G.xp.sunken(ctx, x + 12, y + 26, W - 24, 14); else ctx.fillRect(x + 12, y + 26, W - 24, 14);
    U.text(ctx, (shown.length > 44 ? '…' + shown.slice(-44) : shown) + caret, x + 16, y + 29, { size: 8, raw: !!(G.xp && G.xp.on), shadow: false, color: G.xp && G.xp.on ? '#1b2433' : '#f0f0f0' });
    if (this.o.hint) U.text(ctx, this.o.hint, x + 12, y + 44, { size: 7, color: U.colors.dim });
    const ok = U.button(ctx, x + W - 136, y + H - 24, 60, 16, 'OK', { selected: true, size: 9 });
    const no = U.button(ctx, x + W - 70, y + H - 24, 60, 16, 'Cancel', { size: 9 });
    if (ok.clicked) this.close(true); else if (no.clicked) this.close(false);
  }
}
A.PromptScene = PromptScene;
})();
