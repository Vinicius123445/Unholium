'use strict';
// Where the language reaches beyond the screen: what the player types goes through G.i18n.toEnglish on its way to the
// parts of the game that read intent, and every generated line is asked for in the player's language.
// the desktop host shows a few messages of its own, outside the game: it needs to know the language too
if (G.events) { const tell = () => { if (G.platform) G.platform.post('lang:' + (G.settings.get('language') || 0)); }; G.events.on('languageChanged', tell); setTimeout(tell, 0); }
(() => {
const I = G.i18n, A = G.ai, O = G.orders, H = G.overhear;
// ---- generated text: one rule, on every request (conversations, barks, NPC-to-NPC talk, chatBCT, summaries)
const RULE = `\nLANGUAGE: everything anyone says (every text value: "line", "choices", "lines", "text", "topic", "title", "why", "gist") must be in natural spoken Brazilian Portuguese, as people really talk in Brazil: "você", "a gente", "tá", "pra", "cara", Brazilian slang and contractions. Never European Portuguese (no "tu estás", "estou a fazer", "telemóvel", "autocarro", "rapariga"). Never English, even if the context and the conversation are in English: translate what you mean. Names of people stay as they are. Keys and fixed values such as "attitude" and "order" stay in English exactly as defined.`;
const _body = A.body;
A.body = function (system, user, schema) { return _body.call(this, I.pt() ? system + RULE : system, user, schema); };
// ---- typed text
const _parse = O.parse;
O.parse = function (text) { const r = _parse.call(this, I.toEnglish(text)); return r; };
const _read = H.read, _groups = H.groups;
H.read = function (text) { return _read.call(this, I.toEnglish(text)); };
H.groups = function (text) { return _groups.call(this, I.toEnglish(text)); };
const _reply = G.chat.reply;
G.chat.reply = function (runner, raw) { return _reply.call(this, runner, I.toEnglish(raw)); };
if (G.aiJobs && G.aiJobs.asked) { const _a = G.aiJobs.asked; G.aiJobs.asked = function (t) { return _a.call(this, I.toEnglish(t)); }; }
const _promised = A.promised;
A.promised = function (r, line, acts) { return _promised.call(this, r, I.toEnglish(line), acts); };
// place names go to the model the way the player reads them
const ID = G.identity, _for = ID.placesFor, _known = ID.known, _clean = ID.cleanPlaces, _fix = ID.fixLine;
ID.placesFor = function (w, map) { const l = _for.call(this, w, map); return I.pt() ? l.map((n) => I.t(n)) : l; };
ID.known = function (w, name) { if (_known.call(this, w, name)) return true; if (!I.pt()) return false; const t = I.plain(name).toLowerCase(); return this.places(w).some((p) => I.plain(I.t(p)).toLowerCase().includes(t)); };
const PT_PLACE = /\b(?:o |a |no |na |do |da )?(?:Bar|Boteco|Clube|Café|Restaurante|Lanchonete|Hotel|Mercado|Parque|Praça|Rua|Avenida|Ponte|Bairro|Vila|Cidade) (?:d[aoe]s? )?[A-Z][\wÀ-ú']+(?: [A-Z][\wÀ-ú']+)*/g;
ID.cleanPlaces = function (w, line) {
  if (!I.pt()) return _clean.call(this, w, line);
  return String(line || '').replace(PT_PLACE, (m) => (/ilha/i.test(m) || this.known(w, m.replace(/^(o|a|no|na|do|da) /, '')) || this.scan(w, m).length ? m : 'por aqui'));
};
// (in Portuguese the grammar of "me" and "I" is the model's: only the outright slip is fixed)
ID.fixLine = function (w, npc, line) { return I.pt() ? String(line || '').replace(/\bo jogador\b/gi, 'você').replace(/\bdo jogador\b/gi, 'seu') : _fix.call(this, w, npc, line); };
// a language change on the settings screen or the menu takes effect at once
G.events.on('settingsChanged', () => I.sync());
I.sync();
})();
