'use strict';
// Telling the police what you did. js/game/overhear.js already handles disrespect (warning, arrest, force, by the
// officer's temper); this adds admissions. G.confession.read works on the sentence as a whole, in English or Portuguese:
// it must be the speaker saying they did it, not a question, a denial, or someone else's deed. What the words miss, the
// AI can name in its `order` field ("confess"). Officers then question, warn or arrest, each in their own way, through
// the same crimes and arrest code as everything else.
(() => {
const H = G.overhear, pick = (a) => G.rng.pick(a);
const DENY = /\b(never|didn'?t|did not|don'?t|do not|wouldn'?t|would not|won'?t|not me|if i|what if|someone else|they say i|accused|nunca|n[aã]o\s+(matei|vendo|roubei|fiz|bati|trafico|assaltei)|se eu|e se)\b/i;
const KINDS = [
  ['murder', 3, /\bi(?:'ve| have|'d| had)?\s+(?:\w+\s+){0,2}(?:killed|murdered|shot|stabbed|offed|whacked|smoked|took out|wasted|bodied|ended)\b|\bi\s+(?:\w+\s+){0,2}(?:put|left)\s+\w+\s+in the ground\b|\b(?:eu\s+)?(?:matei|assassinei|apaguei|executei|dei um tiro|esfaqueei|passei fogo|mandei pro saco|fiz a passagem)\b/i],
  ['drugs', 2, /\bi\s+(?:\w+\s+){0,2}(?:sell|sold|push|pushed|deal|dealt|move|moved|slang|run)\s+(?:\w+\s+){0,2}(?:drugs?|dope|coke|cocaine|crack|heroin|weed|meth|pills|product|rock|h\b)|\bi(?:'m| am)\s+(?:a\s+)?(?:drug\s+)?dealer\b|\b(?:eu\s+)?(?:vendo|vendi|trafico|traficava|passo|passei|mexo com)\s+(?:\w+\s+){0,2}(?:drogas?|droga|p[oó]|coca[ií]na|crack|maconha|erva|pedra|bagulho)\b|\bsou\s+(?:traficante|avi[aã]ozinho)\b/i],
  ['robbery', 3, /\bi\s+(?:\w+\s+){0,2}(?:robbed|held up|stuck up|knocked over|hit)\s+(?:\w+\s+){0,3}(?:bank|store|shop|guy|man|woman|someone|somebody|house|place)|\bi\s+(?:\w+\s+){0,2}(?:mugged|burglarized|stole|took)\b|\b(?:eu\s+)?(?:roubei|assaltei|furtei|arrombei|levei)\b/i],
  ['assault', 2, /\bi\s+(?:\w+\s+){0,2}(?:beat|assaulted|attacked|hit|punched|jumped|hurt|smacked)\s+(?:\w+\s+){0,3}(?:up|him|her|them|someone|somebody|a guy|that guy|a man|a woman)|\b(?:eu\s+)?(?:bati|espanquei|agredi|soquei|quebrei a cara|dei uma surra)\b/i],
];
const C = G.confession = {
  read(text) {
    const t = String(text || '').trim();
    if (!t || /\?\s*$/.test(t) || DENY.test(t)) return null;
    for (const [kind, sev, re] of KINDS) if (re.test(t)) return { kind, sev };
    return null;
  },
  // the officer takes it from here
  act(scene, cop, c) {
    const w = scene.world, st = cop.st, P = G.social.persona(cop.id), rec = st.heardConf = st.heardConf && st.heardConf.day === w.day ? st.heardConf : { day: w.day, n: 0 };
    rec.n++;
    G.mem.add(w, cop.id, { k: 'confession', t: `The player told me they committed ${c.kind}`, by: 'player', s: 'did', f: -2, i: 5, ti: 'faction', fc: 'government' });
    const sceptic = c.sev < 3 && rec.n === 1 && (P.patience >= 55 || P.wits >= 60);
    if (sceptic) { const line = pick(['Say that again? Careful what you tell a police officer.', 'That a joke? You want to explain that?', 'You realize who you are talking to?']); if (cop.talking) cop._warnLine = line; else cop.say(line, 3.5); return 'question'; }
    H.later((sc) => {
      if (cop.dead) return;
      w.commitCrime(c.kind === 'murder' ? 'assault' : c.kind === 'robbery' ? 'extortion' : c.kind === 'drugs' ? 'drugs' : 'assault', sc.region, true, cop.id, 0);
      w.bounty[sc.region] = (w.bounty[sc.region] || 0) + (c.sev >= 3 ? 150 : 40);
      if (!cop.talking) { cop.say(pick(['You just talked yourself into handcuffs.', 'Hands behind your back. Now.', 'Thanks for saving me the paperwork. You are under arrest.']), 3.5); cop.state = 'arrest'; sc.arrestCooldown = 0; }
    }, cop);
    return 'arrest';
  },
  isCop(a) { return a.def.combat === 'guard' || /detective|police|officer|sheriff|deputy|security/i.test(a.def.name || ''); },
};
// an officer who has lost patience with you calls it in, if that is the kind of officer they are
const _cop = H.cop;
H.cop = function (scene, cop, read, text) { const r = _cop.apply(this, arguments); if (r === 'force' && G.social.persona(cop.id).patience < 60 && G.law.dispatch) G.law.dispatch(scene, cop.x, cop.y, 'backup'); return r; };
const _listen = H.listen;
H.listen = function (scene, a, speaker, to, text, direct) {
  if (speaker === scene.player && C.isCop(a)) { const c = C.read(G.i18n.toEnglish(text)) || C.read(text); if (c) { C.act(scene, a, c); return { kind: 'confession', tone: 'confess', sev: c.sev }; } }
  return _listen.apply(this, arguments);
};
})();
