'use strict';
// Skill tree. Earn XP (fights, quests, talking your way through things, foraging, exploring), level up,
// spend skill points. Every node lists what it does; the rules live in js/game/skills.js and in the
// systems that ask for a stat or a flag (G.skills.stat / G.skills.has).
//
//   branch: column in the skill screen      pos: [sub-column 0..1 (0.5 = centered), row]
//   ranks:  how many points it can take     req: [[skillId, rank], ...] all required (the first is drawn as the link)
//   fx:     stat bonuses PER RANK           (anything without fx is a flag checked by G.skills.has)
//   icon:   any item icon name
//
// Stats: charisma (base 5, used by speech checks), intimidate, barter, repGain, stealth, alcoholResist,
//        drugMastery, meleeDmg, meleeStamina, defense, gunDmg, accuracy, reloadSpeed, maxHp, maxStamina,
//        staminaRegen, poisonResist, healBonus

G.SKILL_BRANCHES = [
  { id: 'speech', name: 'Speech', color: '#e8c060', desc: 'Charisma, persuasion, intimidation and the art of the deal.' },
  { id: 'street', name: 'Street', color: '#b070e0', desc: 'Stealth, vices and the underworld.' },
  { id: 'melee', name: 'Melee', color: '#e07050', desc: 'Knives, bats and bare knuckles.' },
  { id: 'firearms', name: 'Firearms', color: '#7090e0', desc: 'Pistols, shotguns and rifles.' },
  { id: 'survival', name: 'Survival', color: '#70c070', desc: 'Toughness, foraging and staying alive.' },
  { id: 'luck', name: 'Luck & Leisure', color: '#e0a0d0', desc: 'Fortune, gambling and fishing.' },
];

G.SKILLS = {
  // ---------------------------------------------------------------- SPEECH (charisma)
  silver_tongue: { branch: 'speech', pos: [0.5, 0], ranks: 3, icon: 'speech', name: 'Silver Tongue', fx: { charisma: 1 },
    desc: '+1 Charisma per rank. Charisma decides every speech check.' },
  haggler: { branch: 'speech', pos: [0, 1], ranks: 3, icon: 'coin', name: 'Haggler', fx: { barter: 0.05 }, req: [['silver_tongue', 1]],
    desc: 'Buy 5% cheaper and sell 5% higher per rank.' },
  intimidation: { branch: 'speech', pos: [1, 1], ranks: 2, icon: 'knuckles', name: 'Intimidation', fx: { intimidate: 2 }, req: [['silver_tongue', 1]],
    desc: '+2 Intimidation per rank. Threats work more often, and some people back down instead of fighting.' },
  smooth_operator: { branch: 'speech', pos: [0.5, 2], ranks: 1, icon: 'speech', name: 'Smooth Operator', req: [['silver_tongue', 2]],
    desc: 'Talk your way out of arrests and muggings, and talk merchants into better deals.' },
  bribery: { branch: 'speech', pos: [0, 3], ranks: 1, icon: 'coin', name: 'Bribery', req: [['smooth_operator', 1], ['haggler', 1]],
    desc: 'Bribe guards to forget your bounty for half the price.' },
  networker: { branch: 'speech', pos: [0.5, 4], ranks: 2, icon: 'letter', name: 'Networker', fx: { repGain: 0.2 }, req: [['smooth_operator', 1]],
    desc: '+20% reputation gained per rank, with everyone.' },
  read_people: { branch: 'speech', pos: [1, 3], ranks: 1, icon: 'eye', name: 'Read People', req: [['smooth_operator', 1]],
    desc: 'Spot members of secret groups before they trust you, and see their faction colors.' },
  cult_of_personality: { branch: 'speech', pos: [0.5, 5], ranks: 1, icon: 'crown', name: 'Cult of Personality', fx: { charisma: 2 }, req: [['networker', 1]],
    desc: '+2 Charisma. Factions offer you membership at 35 reputation instead of 50.' },

  // ---------------------------------------------------------------- STREET
  sneaky: { branch: 'street', pos: [0, 0], ranks: 2, icon: 'eye', name: 'Sneaky', fx: { stealth: 0.2 },
    desc: 'Witnesses notice your crimes from 20% less distance per rank.' },
  iron_liver: { branch: 'street', pos: [1, 0], ranks: 2, icon: 'beer', name: 'Iron Liver', fx: { alcoholResist: 0.3 },
    desc: 'Alcohol hits you 30% less per rank.' },
  street_smarts: { branch: 'street', pos: [0, 1], ranks: 1, icon: 'switchblade', name: 'Street Smarts', req: [['sneaky', 1]],
    desc: 'Muggers and gang tolls ask for half, and you can talk your way past them.' },
  hardened_user: { branch: 'street', pos: [1, 1], ranks: 2, icon: 'pills_white', name: 'Hardened User', fx: { drugMastery: 0.25 }, req: [['iron_liver', 1]],
    desc: 'Per rank: drug highs last 25% longer, comedowns 25% shorter, and overdoses are less likely.' },
  fence: { branch: 'street', pos: [0, 2], ranks: 1, icon: 'package', name: 'Fence', req: [['street_smarts', 1]],
    desc: 'Any general merchant buys illegal goods from you, and you get 25% more for them.' },
  liquid_courage: { branch: 'street', pos: [1, 2], ranks: 1, icon: 'whiskey', name: 'Liquid Courage', req: [['hardened_user', 1], ['iron_liver', 2]],
    desc: 'Being tipsy gives +2 Charisma, and being drunk no longer hurts your Charisma.' },
  ghost: { branch: 'street', pos: [0.5, 3], ranks: 1, icon: 'mask', name: 'Ghost', fx: { stealth: 0.15 }, req: [['fence', 1], ['sneaky', 2]],
    desc: 'Even harder to spot, and witnessed crimes carry 25% smaller bounties.' },

  // ---------------------------------------------------------------- MELEE
  brawler: { branch: 'melee', pos: [0.5, 0], ranks: 3, icon: 'knuckles', name: 'Brawler', fx: { meleeDmg: 0.15 },
    desc: '+15% melee damage per rank.' },
  knife_expert: { branch: 'melee', pos: [0, 1], ranks: 1, icon: 'combat_knife', name: 'Knife Expert', req: [['brawler', 1]],
    desc: 'Knives attack 25% faster and have a 20% chance to deal double damage.' },
  heavy_hitter: { branch: 'melee', pos: [1, 1], ranks: 1, icon: 'bat', name: 'Heavy Hitter', req: [['brawler', 1]],
    desc: 'Blunt weapons deal 20% more damage and knock enemies further back.' },
  conditioning: { branch: 'melee', pos: [0, 2], ranks: 2, icon: 'energy', name: 'Conditioning', fx: { meleeStamina: -0.25 }, req: [['knife_expert', 1]],
    desc: 'Melee attacks cost 25% less stamina per rank.' },
  iron_hide: { branch: 'melee', pos: [1, 2], ranks: 3, icon: 'armor_leather', name: 'Iron Hide', fx: { defense: 1 }, req: [['heavy_hitter', 1]],
    desc: '+1 defense per rank.' },
  berserker: { branch: 'melee', pos: [0.5, 3], ranks: 1, icon: 'sledge', name: 'Berserker', req: [['brawler', 3]],
    desc: 'Below 30% health you deal 40% more melee damage and take 20% less damage.' },

  // ---------------------------------------------------------------- FIREARMS
  marksman: { branch: 'firearms', pos: [0.5, 0], ranks: 3, icon: 'pistol', name: 'Marksman', fx: { gunDmg: 0.1, accuracy: 0.15 },
    desc: '+10% gun damage and 15% tighter aim per rank.' },
  quick_reload: { branch: 'firearms', pos: [0, 1], ranks: 2, icon: 'ammo_9mm', name: 'Quick Reload', fx: { reloadSpeed: 0.3 }, req: [['marksman', 1]],
    desc: 'Reload 30% faster per rank.' },
  steady_hands: { branch: 'firearms', pos: [1, 1], ranks: 1, icon: 'rifle', name: 'Steady Hands', req: [['marksman', 1]],
    desc: 'Alcohol and drugs ruin your aim only half as much, and moving does not hurt accuracy.' },
  scavenger: { branch: 'firearms', pos: [0, 2], ranks: 1, icon: 'ammo_shells', name: 'Scavenger', req: [['quick_reload', 1]],
    desc: '20% chance a shot uses no ammo, and you find 50% more ammo on bodies.' },
  gunslinger: { branch: 'firearms', pos: [1, 2], ranks: 1, icon: 'revolver', name: 'Gunslinger', req: [['steady_hands', 1], ['marksman', 2]],
    desc: 'Pistols and revolvers fire 30% faster and reload 20% faster.' },
  deadeye: { branch: 'firearms', pos: [0.5, 3], ranks: 1, icon: 'eye', name: 'Deadeye', req: [['marksman', 3]],
    desc: '15% chance for any bullet to deal 2.5x damage.' },

  // ---------------------------------------------------------------- SURVIVAL
  toughness: { branch: 'survival', pos: [0, 0], ranks: 3, icon: 'medkit', name: 'Toughness', fx: { maxHp: 15 },
    desc: '+15 maximum health per rank.' },
  endurance: { branch: 'survival', pos: [1, 0], ranks: 2, icon: 'energy', name: 'Endurance', fx: { maxStamina: 20, staminaRegen: 0.25 },
    desc: '+20 maximum stamina and 25% faster stamina recovery per rank.' },
  strong_stomach: { branch: 'survival', pos: [0, 1], ranks: 2, icon: 'charcoal', name: 'Strong Stomach', fx: { poisonResist: 0.35 }, req: [['toughness', 1]],
    desc: 'Poison and nausea are 35% weaker per rank.' },
  forager: { branch: 'survival', pos: [1, 1], ranks: 1, icon: 'herb', name: 'Forager', req: [['endurance', 1]],
    desc: '40% chance to gather twice as much.' },
  field_medic: { branch: 'survival', pos: [0, 2], ranks: 1, icon: 'bandage', name: 'Field Medic', fx: { healBonus: 0.5 }, req: [['strong_stomach', 1]],
    desc: 'Food and medicine heal 50% more.' },
  mycologist: { branch: 'survival', pos: [1, 2], ranks: 1, icon: 'chanterelle', name: 'Mycologist', req: [['forager', 1]],
    desc: 'You know every mushroom on sight: edible, poisonous or hallucinogenic.' },
  swimming: { branch: 'survival', pos: [1, 3], ranks: 3, icon: 'swim', name: 'Swimming',
    desc: 'Rank 1 is taught by the Swim Instructor at the lake (you cannot learn it alone). Ranks 2-3: swim faster and tire slower. Without it you drown.' },
  second_wind: { branch: 'survival', pos: [0, 3], ranks: 1, icon: 'heart', name: 'Second Wind', req: [['field_medic', 1], ['toughness', 3]],
    desc: 'Once per day, a killing blow leaves you at 25% health instead.' },
  // ---------------------------------------------------------------- STREET: breaking in
  lockpicking: { branch: 'street', pos: [0, 4], ranks: 3, icon: 'lockpick', name: 'Lockpicking', req: [['sneaky', 1]],
    desc: 'Wider sweet spot when picking locks and safes, and picks break less, per rank.' },
  locksmith: { branch: 'street', pos: [0, 5], ranks: 1, icon: 'key', name: 'Locksmith', req: [['lockpicking', 2]],
    desc: 'Pick high-security locks (mansions, the casino vault). Picks almost never break.' },
  hotwire: { branch: 'street', pos: [1, 4], ranks: 2, icon: 'key', name: 'Hotwiring', req: [['street_smarts', 1]],
    desc: 'Start cars without the keys more easily, and set off fewer alarms, per rank.' },
  cat_burglar: { branch: 'street', pos: [1, 5], ranks: 1, icon: 'eye', name: 'Cat Burglar', req: [['hotwire', 1], ['lockpicking', 1]],
    desc: 'Residents notice you 40% later when you are somewhere you should not be.' },
  // ---------------------------------------------------------------- LUCK & LEISURE
  lucky: { branch: 'luck', pos: [0.5, 0], ranks: 3, icon: 'dice', name: 'Lucky', fx: { luck: 1 },
    desc: '+1 Luck per rank: better odds at the casino, rarer fish, easier locks, more loot.' },
  gambler: { branch: 'luck', pos: [0, 1], ranks: 2, icon: 'chips_casino', name: 'Gambler', req: [['lucky', 1]],
    desc: 'Blackjack: rank 1 shows the odds of busting; rank 2 lets you peek at the dealer\'s hole card sometimes. Slots pay a little more.' },
  lucky_find: { branch: 'luck', pos: [1, 1], ranks: 1, icon: 'coin', name: 'Lucky Find', req: [['lucky', 1]],
    desc: 'Trash cans, gloveboxes and drawers sometimes hold something extra.' },
  four_leaf: { branch: 'luck', pos: [0.5, 2], ranks: 1, icon: 'dice', name: 'Four-Leaf Clover', fx: { luck: 2 }, req: [['lucky', 2]],
    desc: '+2 Luck. Once a day, something that should have gone very wrong... does not.' },
  angler: { branch: 'luck', pos: [0, 3], ranks: 3, icon: 'rod', name: 'Angler',
    desc: 'Fish bite faster and the line is easier to keep in the green, per rank.' },
  big_one: { branch: 'luck', pos: [0, 4], ranks: 1, icon: 'fish_pike', name: 'The Big One', req: [['angler', 2]],
    desc: 'Rare and trophy fish bite much more often.' },
  high_roller: { branch: 'luck', pos: [1, 3], ranks: 1, icon: 'chips_casino', name: 'High Roller', req: [['gambler', 1]],
    desc: 'Bet up to $1000 a hand. Casino staff comp you free drinks and treat you like royalty.' },
};
for (const id in G.SKILLS) G.SKILLS[id].id = id;

G.BASE_STATS = { charisma: 5 };

// XP needed to go from `level` to level + 1. Every level grants 1 skill point (you start with 1).
G.xpToNext = (level) => 80 + level * 40;
G.MAX_LEVEL = 50;

// XP rewards
G.XP = {
  questDone: 60,        // + quest.xp if set
  speechEasy: 8, speechHard: 20,   // scales with check difficulty
  forage: 2,
  identify: 10,         // learning what a mushroom is
  newPlace: 25,
  joinFaction: 50,
  killNpc: 20,          // hostile or armed people
  killInnocent: 6,
  animal: (def) => Math.max(3, Math.round((def.hp || 10) / 4)),
};

// ---------------------------------------------------------------- STRENGTH and RESISTANCE
// Two trees for taking a beating: Strength is how much body there is to hurt (health, power), Resistance
// is how much of the hurt gets through (damageResist: a share of every hit shrugged off, see js/game/initiation.js).
G.SKILL_BRANCHES.push(
  { id: 'strength', name: 'Strength', color: '#d88a40', desc: 'A bigger, harder body: more health and heavier blows.' },
  { id: 'resistance', name: 'Resistance', color: '#80b0c8', desc: 'Taking punishment: less damage gets through, and you stay on your feet.' },
);
Object.assign(G.SKILLS, {
  big_frame: { branch: 'strength', pos: [0.5, 0], ranks: 3, icon: 'heart', name: 'Big Frame', fx: { maxHp: 10 },
    desc: '+10 maximum health per rank.' },
  heavy_bones: { branch: 'strength', pos: [0, 1], ranks: 2, icon: 'sledge', name: 'Heavy Bones', fx: { maxHp: 15 }, req: [['big_frame', 1]],
    desc: '+15 maximum health per rank.' },
  power: { branch: 'strength', pos: [1, 1], ranks: 2, icon: 'knuckles', name: 'Power', fx: { meleeDmg: 0.1 }, req: [['big_frame', 1]],
    desc: 'Your blows land 10% harder per rank.' },
  juggernaut: { branch: 'strength', pos: [0.5, 2], ranks: 1, icon: 'armor_kevlar', name: 'Juggernaut', fx: { maxHp: 30 }, req: [['heavy_bones', 2]],
    desc: '+30 maximum health.' },
  unbreakable: { branch: 'strength', pos: [0.5, 3], ranks: 1, icon: 'crown', name: 'Unbreakable', req: [['juggernaut', 1], ['power', 1]],
    desc: 'Twice per day, a killing blow leaves you standing on 1 health.' },
  pain_tolerance: { branch: 'resistance', pos: [0.5, 0], ranks: 3, icon: 'bandage', name: 'Pain Tolerance', fx: { damageResist: 0.05 },
    desc: '5% less damage from every hit per rank.' },
  hard_head: { branch: 'resistance', pos: [0, 1], ranks: 2, icon: 'mask', name: 'Hard Head', fx: { defense: 1 }, req: [['pain_tolerance', 1]],
    desc: '-1 damage from every hit per rank, and you are knocked around less.' },
  constitution: { branch: 'resistance', pos: [1, 1], ranks: 2, icon: 'charcoal', name: 'Constitution', fx: { poisonResist: 0.2 }, req: [['pain_tolerance', 1]],
    desc: 'Poison, sickness and nausea are 20% weaker per rank.' },
  thick_skin: { branch: 'resistance', pos: [0.5, 2], ranks: 2, icon: 'armor_kevlar', name: 'Thick Skin', fx: { damageResist: 0.06 }, req: [['hard_head', 1]],
    desc: '6% less damage from every hit per rank.' },
  last_stand: { branch: 'resistance', pos: [0.5, 3], ranks: 1, icon: 'heart', name: 'Last Stand', req: [['thick_skin', 1], ['constitution', 1]],
    desc: 'Below a quarter of your health, you take 30% less damage.' },
});
