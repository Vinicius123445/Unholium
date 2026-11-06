'use strict';
// Regions and factions. Reputation ranges from -100 (hated) to +100 (revered).
//
// FACTIONS
//   listed: shown on the faction meters in the journal (the main factions of the game)
//   startRep: starting reputation             hostileBelow: members attack the player on sight below this rep
//   outlaw: attacking/killing members is not a crime
//   nightHostileBelow / tollBelow: (gangs/criminals at night) attack below the first value, demand "toll" below the second
//   color: UI color      desc: shown when asking "Who are you people?" (placeholder until the lore is written)
//   covert + cover: members deny everything (cover line) until your reputation with them reaches 20
//
// FACTION_RELATIONS: -1 = enemies (fight on sight), between -1 and 1 = how reputation ripples.
//   Gaining X rep with a faction changes every related faction by X * relation * 0.5.

G.REGIONS = {
  rural:  { name: 'Rural Zone', music: 'rural' },
  city:   { name: 'The City', music: 'city' },
  forest: { name: 'The Forest', music: 'forest' },
  island: { name: 'The Island', music: 'island' },
};

G.FACTIONS = {
  // ---- main factions (faction meters) ----
  government: {
    name: 'The Government', listed: true, startRep: 0, hostileBelow: -70, color: '#5a7ac8',
    desc: '[Placeholder] We keep order. The police, the courts and the Mayor answer to us.',
  },
  cia: {
    name: 'The CIA', listed: true, startRep: 0, hostileBelow: -50, color: '#9aa4b0', covert: true,
    cover: 'Import and export. Nothing you would find interesting.',
    desc: '[Placeholder] We were never here. You never saw us.',
  },
  revolutionaries: {
    name: 'The Revolutionaries', listed: true, startRep: -10, hostileBelow: -40, color: '#a83a6a', covert: true,
    cover: 'Revolution? I just keep to myself, friend.',
    desc: 'Peaceful protest did not work, so we bought rifles. The Government and the Elite are complicit in literally everything. Once they are gone we build a fair, safe, inclusive society for everyone. Attendance is mandatory.',
  },
  punks: {
    name: 'The Punks', listed: true, startRep: 0, hostileBelow: -45, color: '#d060d0',
    nightHostileBelow: -15, tollBelow: -100,
    desc: '[Placeholder] No masters, no rules, no future. Just us.',
  },
  gang_red: {
    name: 'Red Gang', listed: true, startRep: 0, hostileBelow: -40, color: '#d04040', gang: true,
    nightHostileBelow: -10, tollBelow: 20,
    desc: '[Placeholder] Southside is ours. Wear red or stay out.',
  },
  gang_blue: {
    name: 'Blue Gang', listed: true, startRep: 0, hostileBelow: -40, color: '#4070d8', gang: true,
    nightHostileBelow: -10, tollBelow: 20,
    desc: '[Placeholder] Eastside and the docks belong to us. Everyone pays.',
  },
  elite: {
    name: 'The Elite', listed: true, startRep: 0, hostileBelow: -40, nightHostileBelow: -10, color: '#c8a050', covert: true,
    cover: 'We are simply neighbors who enjoy charity work.',
    desc: '[Placeholder] Old money. We decide what happens in this city long before anyone votes on it.',
  },

  // ---- other affiliations (no faction meter) ----
  civilians: { name: 'Civilians', startRep: 0 },
  hunters:   { name: 'Hunters', startRep: 0 },
  bandits:   { name: 'Bandits', startRep: -20, hostileBelow: -40, outlaw: true },
  prisoners: { name: 'Inmates', startRep: 0, hostileBelow: -60 },
  criminals: { name: 'Criminals', startRep: 0, hostileBelow: 101, outlaw: true, tollBelow: 101 },
  islanders: { name: 'Islanders (placeholder)', startRep: 0, hostileBelow: -50, outlaw: true },
};

G.FACTION_RELATIONS = {
  'gang_red|gang_blue': -1,
  'government|revolutionaries': -1,
  'cia|revolutionaries': -1,
  'government|cia': 0.6,
  'government|punks': -0.5,
  'government|gang_red': -0.4,
  'government|gang_blue': -0.4,
  'punks|revolutionaries': 0.3,
  'punks|gang_red': -0.2,
  'punks|gang_blue': -0.2,
  'government|civilians': 0.2,
  'elite|government': 0.5,
  'elite|cia': 0.3,
  'elite|revolutionaries': -0.6,
  'elite|punks': -0.4,
};

G.factionRelation = (a, b) => {
  if (a === b) return 1;
  return G.FACTION_RELATIONS[a + '|' + b] ?? G.FACTION_RELATIONS[b + '|' + a] ?? 0;
};

G.factionsAtWar = (a, b) => !!a && !!b && G.factionRelation(a, b) <= -1;

G.listedFactions = () => Object.keys(G.FACTIONS).filter((f) => G.FACTIONS[f].listed);

// Rep label shown in the journal
G.repLabel = (v) => {
  if (v <= -60) return 'Hated';
  if (v <= -25) return 'Hostile';
  if (v < -5) return 'Disliked';
  if (v < 10) return 'Neutral';
  if (v < 35) return 'Friendly';
  if (v < 70) return 'Trusted';
  return 'Ally';
};
G.CRIMINAL_FACTIONS = ['gang_red', 'gang_blue', 'punks', 'criminals', 'bandits'];   // people who never call the police
