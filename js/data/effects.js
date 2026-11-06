'use strict';
// Status effects from food, alcohol, drugs and poison. Items add them via `effects: { id: seconds }`
// (or `{ id: [seconds, power] }`); see js/game/effects.js for the rules.
//   stats:    added to player stats while active (charisma, intimidate, meleeDmg, gunDmg, staminaRegen ...)
//   speed:    movement multiplier      dmgTaken: damage taken multiplier      spread: extra gun inaccuracy (rad)
//   regen:    health per second        dps: damage per second (poison)
//   visual:   screen effect (high | stim | crash | trip | nausea | poison | painkiller | opiate | resp)
//   then:     [effectId, seconds] started when this one runs out (comedowns, delayed onset)
//   hidden:   not shown on the HUD (the player does not know yet)
//   kind:     'drug' | 'poison' | 'buff' | 'withdrawal' — skills scale drug durations / poison strength
//   munchies: food heals more while active

G.EFFECTS = {
  nicotine:   { name: 'Nicotine', kind: 'drug', color: '#c8c0a8', stats: { staminaRegen: 0.15 }, desc: 'Better stamina recovery. Very addictive.' },
  caffeine:   { name: 'Caffeinated', kind: 'buff', color: '#c89a5a', stats: { staminaRegen: 0.35 }, speed: 1.04, desc: 'Faster stamina recovery.' },
  // cannabis: relaxed, slow, hungry, pain relief; too much "greens you out" (nausea, anxiety) but cannot kill you
  high:       { name: 'High', kind: 'drug', color: '#7ac85a', stats: { charisma: 1, staminaRegen: -0.25 }, speed: 0.9, regen: 0.5, dmgTaken: 0.95, spread: 0.05, visual: 'high', munchies: true, desc: 'Relaxed and hungry. Food heals more. Slower, worse aim.' },
  thc_onset:  { name: 'Edible kicking in', kind: 'drug', hidden: true, then: ['high', 300], desc: 'Nothing yet... is it working?' },
  paranoia:   { name: 'Paranoid', kind: 'drug', bad: true, color: '#9ac85a', stats: { charisma: -2 }, visual: 'high', desc: 'Everyone is looking at you. Probably.' },
  greened_out:{ name: 'Greened Out', kind: 'drug', bad: true, color: '#6aa84a', stats: { charisma: -2, staminaRegen: -0.5 }, speed: 0.8, visual: 'nausea', vomit: true, desc: 'Way too much weed. Dizzy, sweaty, sick. It will pass.' },
  // stimulants: euphoria, energy and confidence, then a comedown; strain on the heart
  stim:       { name: 'Wired', kind: 'drug', color: '#f0f0ff', stats: { charisma: 2, intimidate: 1, meleeDmg: 0.15, staminaRegen: 1.0 }, speed: 1.18, visual: 'stim', then: ['crash', 70], desc: 'Fast, strong, confident.' },
  crack_high: { name: 'Crack Rush', kind: 'drug', color: '#ffffff', stats: { charisma: 1, intimidate: 2, meleeDmg: 0.25, staminaRegen: 1.4 }, speed: 1.25, spread: 0.06, visual: 'stim', then: ['crash', 110], desc: 'An intense, short rush. The crash is brutal.' },
  crash:      { name: 'Comedown', kind: 'drug', bad: true, color: '#8a8aa0', stats: { charisma: -2, staminaRegen: -0.6, meleeDmg: -0.1 }, speed: 0.9, visual: 'crash', desc: 'Everything feels grey.' },
  // opioids: euphoria, sedation, strong pain relief; in large doses (or mixed with alcohol) breathing stops
  painkiller: { name: 'Painkillers', kind: 'drug', color: '#e07070', dmgTaken: 0.7, regen: 0.25, spread: 0.02, visual: 'painkiller', desc: 'Opioid pain relief. You take 30% less damage.' },
  opiate:     { name: 'Nodding', kind: 'drug', color: '#d0a070', stats: { charisma: -1, staminaRegen: -0.3 }, dmgTaken: 0.5, regen: 0.4, speed: 0.75, spread: 0.08, visual: 'opiate', desc: 'Warm, heavy, nothing hurts. You can barely keep your eyes open.' },
  methadone:  { name: 'Methadone', kind: 'drug', color: '#c0a0e0', dmgTaken: 0.9, desc: 'Keeps opioid withdrawal away.' },
  // psychedelics
  trip:       { name: 'Tripping', kind: 'drug', color: '#e070f0', stats: { charisma: -1 }, spread: 0.1, visual: 'trip', desc: 'Reality is negotiable.' },
  // poisons
  nausea:     { name: 'Nauseous', kind: 'poison', bad: true, color: '#a8c060', stats: { charisma: -2, staminaRegen: -0.4 }, visual: 'nausea', vomit: true, desc: 'You might throw up.' },
  poison:     { name: 'Poisoned', kind: 'poison', bad: true, color: '#60c050', dps: 1.2, visual: 'poison', desc: 'Losing health.' },
  amatoxin:   { name: 'Amatoxin', kind: 'poison', hidden: true, then: ['organ_failure', 40], desc: 'You feel fine. For now.' },
  organ_failure: { name: 'Organ Failure', kind: 'poison', bad: true, color: '#40a040', dps: 2.4, speed: 0.85, stats: { charisma: -3 }, visual: 'poison', desc: 'Death cap poisoning. Find charcoal, fast.' },
  // overdoses
  overdose:   { name: 'Heart Attack', kind: 'drug', bad: true, color: '#ff5050', dps: 3, speed: 0.7, visual: 'crash', desc: 'Stimulant overdose. Your heart is giving out.' },
  resp_depression: { name: 'Not Breathing', kind: 'drug', bad: true, color: '#7080ff', dps: 2.6, speed: 0.4, visual: 'resp', desc: 'Opioid overdose. Use Naloxone, NOW.' },
  // withdrawal (addiction)
  wd_opioid:  { name: 'Dope Sick', kind: 'withdrawal', bad: true, color: '#c08060', stats: { charisma: -3, staminaRegen: -0.6, meleeDmg: -0.1 }, dmgTaken: 1.25, speed: 0.85, visual: 'nausea', vomit: true, desc: 'Opioid withdrawal: sweats, cramps, vomiting. Only more opioids or methadone help.' },
  wd_stim:    { name: 'Stimulant Withdrawal', kind: 'withdrawal', bad: true, color: '#8a8aa0', stats: { charisma: -2, meleeDmg: -0.15, staminaRegen: -0.3 }, speed: 0.9, visual: 'crash', desc: 'Exhausted, hopeless, craving.' },
  wd_alcohol: { name: 'The Shakes', kind: 'withdrawal', bad: true, color: '#d0a040', stats: { charisma: -1, staminaRegen: -0.3 }, spread: 0.15, seizures: true, desc: 'Alcohol withdrawal. Shaking hands; severe cases have seizures.' },
  wd_nicotine:{ name: 'Craving a Smoke', kind: 'withdrawal', bad: true, color: '#c8c0a8', stats: { charisma: -1, staminaRegen: -0.1 }, desc: 'Irritable and restless.' },
  wd_cannabis:{ name: 'Irritable', kind: 'withdrawal', bad: true, color: '#7ac85a', stats: { charisma: -1 }, desc: 'Cannot relax without it.' },
};

// Alcohol intoxication levels (player.alcohol, 0..100+). Above 100 you black out.
G.INTOX_LEVELS = [
  { min: 20, name: 'Tipsy', color: '#f0c060', stats: { charisma: 1, intimidate: 1, meleeDmg: 0.05 }, spread: 0.03, sway: 0.15 },
  { min: 45, name: 'Drunk', color: '#f0a040', stats: { charisma: -1, intimidate: 2, meleeDmg: 0.1 }, dmgTaken: 0.9, spread: 0.1, speed: 0.95, sway: 0.5 },
  { min: 75, name: 'Wasted', color: '#f07030', stats: { charisma: -3, intimidate: 2, meleeDmg: 0.1 }, dmgTaken: 0.85, spread: 0.22, speed: 0.85, sway: 1, stumble: true },
];
G.ALCOHOL_DECAY = 0.16;   // intoxication points lost per second

// Drug classes (items: drug: { cls, load, addict, tol }).
//   load:   how much of the class is in your body (decays per second). Over the threshold = overdose.
//   addict: addiction gained per use      tol: tolerance gained per use (weaker highs; for opioids it also
//           raises the overdose threshold — and loses it again when you stay clean, so relapses are deadly)
//   withdrawal: effect started once dependent and `after` game hours without a dose
G.DRUG_CLASSES = {
  opioid:      { name: 'Opioids', decay: 0.2, od: 100, odEffect: 'resp_depression', withdrawal: 'wd_opioid', after: 8, dependent: 25 },
  stimulant:   { name: 'Stimulants', decay: 0.45, od: 100, odEffect: 'overdose', withdrawal: 'wd_stim', after: 16, dependent: 30 },
  cannabis:    { name: 'Cannabis', decay: 0.2, od: 70, odEffect: 'greened_out', withdrawal: 'wd_cannabis', after: 24, dependent: 45, harmless: true },
  psychedelic: { name: 'Psychedelics', decay: 0.3 },
  alcohol:     { name: 'Alcohol', withdrawal: 'wd_alcohol', after: 10, dependent: 35 },
  nicotine:    { name: 'Nicotine', decay: 0.5, withdrawal: 'wd_nicotine', after: 3, dependent: 20 },
};
G.ADDICTION_DECAY_PER_HOUR = 0.6;   // addiction fades slowly while you stay clean
G.TOLERANCE_DECAY_PER_HOUR = 1.2;

for (const id in G.EFFECTS) G.EFFECTS[id].id = id;
