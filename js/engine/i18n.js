'use strict';
// Languages. The game is written in English; other languages are a dictionary over that text (js/data/lang_pt.js,
// made by tools/ from the game's own source), applied where text reaches the screen: G.ui.text, wrap, measure.
// So nothing is translated in saves or game state: a save made in one language opens in the other, logs and rumors
// already stored follow the language, and switching takes effect on the next frame, even in the middle of a game.
//   t(str)         the text in the current language. Exact match, then ignoring case (window titles are upper-cased),
//                  then templates ("Talk to {0}"; what fills {0} is translated too), then line by line and sentence
//                  by sentence for text put together at run time. Text it does not know stays as it is, which is what
//                  generated dialogue needs: that is already in the player's language.
//   toEnglish(s)   what the player typed, for the parts of the game that read intent from English words.
(() => {
const NAMES = ['English', 'Português do Brasil'], CODES = ['en', 'pt'];
G.LANG_COLOR = new Set(['White', 'Grey', 'Black', 'Crimson', 'Red', 'Orange', 'Mustard', 'Olive', 'Green', 'Teal', 'Navy', 'Blue', 'Sky', 'Purple', 'Pink', 'Brown', 'Tan', 'Denim', 'Plain']);
const I = G.i18n = {
  NAMES, CODES,
  lang: 'en', cache: new Map(), out: new Set(), lower: new Map(), tpl: null, open: [], missing: new Set(), track: false,
  code() { return CODES[G.settings.get('language') | 0] || 'en'; },
  pt() { return this.code() === 'pt'; },
  name() { return NAMES[G.settings.get('language') | 0] || NAMES[0]; },
  set(i) { G.settings.set('language', i); this.sync(); },
  toggle() { this.set(this.pt() ? 0 : 1); G.audio.play('select'); },
  menuLabel() { return this.pt() ? `Idioma: ${this.name()}` : `Language: ${this.name()}`; },
  sync() { const c = this.code(); if (c !== this.lang) { this.lang = c; this.cache.clear(); if (c === 'pt') this.load(); document.documentElement.lang = c === 'pt' ? 'pt-BR' : 'en'; G.events.emit('languageChanged', c); } },
  load() {
    if (this.tpl) return;
    const D = G.LANG_PT || { s: {}, t: [] };
    for (const k in D.s) { this.out.add(D.s[k]); this.lower.set(k.toLowerCase(), D.s[k]); }
    const list = D.t.map(([en, pt]) => {
      const lit = en.replace(/\{\d+\}/g, '').length, slots = [];
      const re = new RegExp('^' + en.split(/(\{\d+\})/).map((p) => { const m = p.match(/^\{(\d+)\}$/); if (m) { slots.push(+m[1]); return '(.+?)'; } return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('') + '$', 'is');
      const head = (en.match(/^[^{\s]+/) || [''])[0].toLowerCase();
      return { re, pt, slots, lit, head };
    }).sort((a, b) => b.lit - a.lit);
    this.tpl = new Map();
    for (const e of list) { if (!e.head) { this.open.push(e); continue; } const l = this.tpl.get(e.head); if (l) l.push(e); else this.tpl.set(e.head, [e]); }
  },
  t(s) {
    if (typeof s !== 'string' || !s) return s;
    this.sync();
    if (this.lang === 'en') return s;
    const hit = this.cache.get(s);
    if (hit !== undefined) return hit;
    const r = this.work(s, 0);
    if (this.cache.size > 8000) this.cache.clear();
    this.cache.set(s, r);
    return r;
  },
  word(s) {   // exact, or the same words in another case
    const D = G.LANG_PT;
    if (!D) return null;
    if (Object.prototype.hasOwnProperty.call(D.s, s)) return D.s[s];
    const low = this.lower.get(s.toLowerCase());
    if (low === undefined) return null;
    if (s === s.toUpperCase()) return low.toUpperCase();
    return s[0] !== s[0].toLowerCase() ? low[0].toUpperCase() + low.slice(1) : low;
  },
  template(s, depth) {
    const fit = (list) => {
      for (const e of list) {
        const m = s.match(e.re);
        if (m) return e.pt.replace(/\{(\d+)\}/g, (x, n) => { const i = e.slots.indexOf(+n); return i < 0 ? x : this.work(m[i + 1], depth + 1); });
      }
      return null;
    };
    const head = (s.match(/^[^\s]+/) || [''])[0].toLowerCase(), near = this.tpl.get(head);
    return (near && fit(near)) || fit(this.open);
  },
  work(s, depth) {
    if (!/[A-Za-z]/.test(s) || depth > 5 || this.out.has(s)) return s;
    let r = this.word(s);
    if (r != null) return r;
    // the same phrase in someone else's mouth (G.social.persona: P.you, P.they): "your marriage" from "my marriage"
    const own = s.match(/^(your|their) (.+)$/i);
    if (own) {
      const mine = this.word('my ' + own[2]);
      if (mine) return mine.replace(/^(meu|minha|meus|minhas)(?![\p{L}])/iu, (m) => (own[1].toLowerCase() === 'your' ? { meu: 'seu', minha: 'sua', meus: 'seus', minhas: 'suas' }[m.toLowerCase()] : { meu: 'o dele', minha: 'a dela', meus: 'os dele', minhas: 'as dela' }[m.toLowerCase()]));
    }
    r = this.template(s, depth);
    if (r != null) return r;
    if (s.includes('\n')) return s.split('\n').map((l) => this.work(l, depth + 1)).join('\n');
    // what is put in front: a number, a [check], a (kind): "2. [Speech 50%] Tell me.", and in brackets at the end: "Beer ($3)"
    const pre = s.match(/^(\d+\.\s+|\[[^\]]{1,24}\]\s+|\([^)]{1,24}\)\s+|[-+]?\d+\s+)(.+)$/s);
    if (pre) return this.work(pre[1].trimEnd(), depth + 1) + pre[1].slice(pre[1].trimEnd().length) + this.work(pre[2], depth + 1);
    const post = s.match(/^(.+?)(\s*)(\(([^()]+)\))([.!?$]*)$/s);
    if (post) return `${this.work(post[1], depth + 1)}${post[2]}(${this.work(post[4], depth + 1)})${post[5]}`;
    // a value between arrows: "< Fast >"
    const arrows = s.match(/^([<‹«]\s*)?(.+?)(\s*[>›»])?$/s);
    if (arrows && (arrows[1] || arrows[3]) && arrows[2] !== s) return (arrows[1] || '') + this.work(arrows[2], depth + 1) + (arrows[3] || '');
    // "White Shirt": generated clothes. In Portuguese the color comes after, and agrees with the noun
    const pair = s.match(/^([A-Z][a-z-]+) ([A-Z][A-Za-z -]+)$/);
    if (pair) {
      const adj = this.word(pair[1]), noun = this.word(pair[2]);
      if (adj && noun && (G.LANG_COLOR || new Set()).has(pair[1])) { const fem = /a$|gem$|ção$/.test(noun.split(' ')[0]) && !/^(Tênis|Moletom)/.test(noun); return `${noun} ${fem ? adj.replace(/o$/, 'a') : adj}`; }
    }
    // around the words: "3. Goodbye.", "[E] Talk", "(Hostile)...", quotes, and the punctuation at the end
    const m = s.match(/^(\s*(?:\d+\.\s+|[-•]\s+|\[[^\]]{1,12}\]\s+|\([^)]{1,16}\)\s+|>\s*)?["“'(]?)(.*?)(["”')]?[.!?…:,;]*\s*)$/s);
    if (m && (m[1] || m[3]) && m[2] && m[2] !== s) { const inner = this.word(m[2]) || this.template(m[2], depth + 1); if (inner != null) return m[1] + inner + m[3]; }
    // numbers on the end: "Bandage x3", "Beer (2)"
    const q = s.match(/^(.*?)(\s+(?:x\d+|\(\d+\)|\d+))$/);
    if (q) { const inner = this.word(q[1]); if (inner != null) return inner + q[2]; }
    // separators: "Friend · Wary of you", "Key: value"
    for (const sep of [' · ', ' - ', ' — ', ': ', ', ']) if (s.includes(sep)) { const parts = s.split(sep), tr = parts.map((p) => this.work(p, depth + 1)); if (tr.some((x, i) => x !== parts[i])) return tr.join(sep); }
    // several sentences put together
    const parts = s.match(/[^.!?…]+[.!?…]+["”']?\s*|[^.!?…]+$/g);
    if (parts && parts.length > 1) { let any = false; const tr = parts.map((p) => { const tail = p.match(/\s*$/)[0], b = p.slice(0, p.length - tail.length), x = this.work(b, depth + 1); if (x !== b) any = true; return x + tail; }); if (any) return tr.join(''); }
    if (this.track && !depth) this.missing.add(s);
    return s;
  },
  // the same in both languages (a name, a brand): the dictionary says so
  same(s) { return !!(G.LANG_SAME && G.LANG_SAME.has(s)); },
  // pixel fonts have no accents
  plain(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); },
  // ---------------------------------------------------------------- what the player typed
  PHRASES: [
    ['me siga por ai', 'follow me around'], ['me segue', 'follow me'], ['me siga', 'follow me'], ['segue comigo', 'follow me'], ['siga-me', 'follow me'], ['vem comigo', 'come with me'], ['venha comigo', 'come with me'], ['vem junto', 'come along'], ['fica comigo', 'stay with me'], ['fique comigo', 'stay with me'], ['cola comigo', 'stick with me'], ['vamos embora', "let's go"], ['bora', "let's go"], ['vamos', "let's go"],
    ['vem aqui', 'come here'], ['venha aqui', 'come here'], ['chega aqui', 'come here'], ['fica aqui', 'stay here'], ['fique aqui', 'stay here'], ['espera aqui', 'stay here'], ['espere aqui', 'stay here'], ['me espera', 'wait for me'], ['me espere', 'wait for me'], ['nao se mexe', "don't move"], ['nao se mova', "don't move"],
    ['espera la fora', 'wait outside'], ['espere la fora', 'wait outside'], ['espera do lado de fora', 'wait outside'], ['me protege', 'protect me'], ['me proteja', 'protect me'], ['cuida de mim', 'watch my back'], ['cuide de mim', 'watch my back'], ['me da cobertura', 'cover me'], ['fica de olho', 'watch my back'],
    ['me ajuda a lutar', 'help me fight'], ['me ajude a lutar', 'help me fight'], ['me ajuda aqui', 'give me a hand'], ['me da uma mao', 'give me a hand'], ['me de uma mao', 'give me a hand'], ['me ajuda a carregar', 'help me carry'], ['carrega isso', 'carry this'], ['carregue isso', 'carry this'], ['leva minhas coisas', 'carry my stuff'],
    ['ataca', 'attack'], ['ataque', 'attack'], ['mata', 'kill'], ['mate', 'kill'], ['bate nele', 'beat him'], ['bata nele', 'beat him'], ['bate nela', 'beat her'], ['atira nele', 'shoot him'], ['pega ele', 'get him'], ['pega ela', 'get her'], ['aquele cara', 'that guy'], ['aquela pessoa', 'that person'], ['aquela mulher', 'that woman'],
    ['vai pra casa', 'go home'], ['va para casa', 'go home'], ['vai para casa', 'go home'], ['volta pra casa', 'go home'], ['para de me seguir', 'stop following me'], ['pare de me seguir', 'stop following me'], ['nao preciso de voce', "i don't need you"], ['pode ir', 'you can go'], ['para de brigar', 'stop fighting'], ['pare de brigar', 'stop fighting'],
    ['vou te matar', "i'll kill you"], ['te mato', "i'll kill you"], ['passa a grana', 'give me the money'], ['passa o dinheiro', 'give me the money'], ['me da o dinheiro', 'give me the money'], ['senao', 'or else'], ['voce ta morto', "you're dead"], ['voce esta morto', "you're dead"],
    ['filho da puta', 'piece of shit'], ['pedaco de merda', 'piece of shit'], ['vai se foder', 'fuck you'], ['vai tomar no cu', 'fuck you'], ['babaca', 'asshole'], ['otario', 'asshole'], ['cuzao', 'asshole'], ['desgracado', 'bastard'], ['idiota', 'idiot'], ['imbecil', 'idiot'], ['burro', 'stupid'], ['feio', 'ugly'], ['perdedor', 'loser'], ['fracassado', 'loser'], ['lixo', 'trash'], ['escroto', 'scumbag'], ['covarde', 'coward'], ['cala a boca', 'shut up'], ['te odeio', 'hate you'], ['porco', 'pig'],
    ['ladrao', 'thief'], ['mentiroso', 'liar'], ['assassino', 'murderer'], ['traidor', 'traitor'], ['dedo-duro', 'snitch'], ['roubou', 'stole'], ['matou', 'killed'], ['eu ouvi', 'i heard'], ['ouvi dizer', 'i heard'], ['dizem que', 'they say'], ['parece que', 'apparently'],
    ['qual o seu nome', "what's your name"], ['qual seu nome', "what's your name"], ['como voce se chama', "what's your name"], ['quem e voce', 'who are you'], ['como vai', 'how are you'], ['tudo bem', 'how are you'], ['e ai', 'hey'], ['oi', 'hi'], ['ola', 'hello'], ['bom dia', 'good morning'], ['boa tarde', 'good afternoon'], ['boa noite', 'good evening'], ['tchau', 'bye'], ['ate mais', 'see you'], ['obrigado', 'thanks'], ['obrigada', 'thanks'], ['valeu', 'thanks'], ['desculpa', 'sorry'], ['desculpe', 'sorry'], ['foi mal', 'sorry'], ['por favor', 'please'],
    ['voce e legal', "you're nice"], ['voce e o melhor', "you're the best"], ['voce e a melhor', "you're the best"], ['gosto de voce', 'i like you'], ['te amo', 'love you'], ['tem trabalho', 'any work'], ['preciso de trabalho', 'need a job'], ['trabalho', 'work'], ['emprego', 'job'], ['quer trocar', 'want to trade'], ['trocar', 'trade'], ['comprar', 'buy'], ['vender', 'sell'], ['onde fica', 'where is'], ['onde e', 'where is'], ['onde', 'where'], ['que horas', 'what time'], ['telefone', 'number'], ['sim', 'yes'], ['claro', 'sure'], ['ta bom', 'okay'], ['tudo certo', 'alright'], ['beleza', 'okay'], ['pode deixar', 'will do'], ['nao vou', "i won't"], ['nao posso', "i can't"], ['de jeito nenhum', 'no way'], ['nem pensar', 'no way'], ['nao', 'no'],
  ],
  toEnglish(s) {
    if (!this.pt() || !s) return s;
    if (!this._ph) { const l = this.PHRASES.slice().sort((a, b) => b[0].length - a[0].length); this._map = new Map(l); this._ph = new RegExp(`(?<![\\p{L}])(?:${l.map((x) => x[0]).join('|')})(?![\\p{L}])`, 'giu'); }
    return this.plain(s).replace(this._ph, (m) => this._map.get(m.toLowerCase()) || m);
  },
};
})();
