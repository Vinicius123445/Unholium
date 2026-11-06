'use strict';
// Item database. Add new items here; the inventory, shops, loot and UI pick them up automatically.
//   type: weapon | armor | trinket | consumable | material | misc | quest | ammo
//   value: base price in gold      stack: max stack size (default 1 for gear, 20 otherwise)
//   weapon: dmg, cd (attack cooldown s), range (px), cat (knife | blade | blunt | pistol | smg | shotgun | rifle)
//   gun: ammo (item id), mag (rounds per magazine), reload (s), spread (radians), pellets, auto (hold to fire),
//        range (px the bullet travels), loud (how far the shot is heard, px)
//   armor: def      trinket: maxHp / def bonuses     quest: cannot be sold or dropped
//   consumable: heal, stamina, alcohol (intoxication points), tox (strain on the body; too much = overdose),
//               effects: { effectId: seconds } (see js/data/effects.js), poison (damage over time)
//   illegal: possession is confiscated in jail, use in front of the law is a crime
//   ident: [name, desc] shown until the item is identified (eaten once, or the Mycologist skill)

G.ITEMS = {
  // --- weapons ---
  club:          { name: 'Pool Cue', type: 'weapon', cat: 'blunt', icon: 'cue', dmg: 4, cd: 0.4, range: 20, value: 8, desc: 'Borrowed from a bar. Permanently.' },
  rusty_sword:   { name: 'Lead Pipe', type: 'weapon', cat: 'blunt', icon: 'pipe', dmg: 6, cd: 0.42, value: 10, desc: 'Heavy plumbing.' },
  dagger:        { name: 'Pocket Knife', type: 'weapon', cat: 'knife', icon: 'pocket_knife', dmg: 5, cd: 0.25, range: 14, value: 20, desc: 'Quick and quiet.' },
  hunting_knife: { name: 'Hunting Knife', type: 'weapon', cat: 'knife', icon: 'combat_knife', dmg: 7, cd: 0.28, range: 14, value: 45, desc: 'Made for skinning game.' },
  woodaxe:       { name: 'Hatchet', type: 'weapon', cat: 'blade', icon: 'axe', dmg: 9, cd: 0.5, value: 40, desc: 'Chops wood. Heavy, slow, effective.' },
  iron_sword:    { name: 'Fire Axe', type: 'weapon', cat: 'blade', icon: 'fire_axe', dmg: 12, cd: 0.55, value: 80, desc: 'Pulled from a glass case. In case of emergency.' },
  spear:         { name: 'Pitchfork', type: 'weapon', cat: 'blade', icon: 'pitchfork', dmg: 10, cd: 0.5, range: 24, value: 30, desc: 'Farm tool. Long reach.' },
  mace:          { name: 'Spiked Bat', type: 'weapon', cat: 'blunt', icon: 'spiked_bat', dmg: 13, cd: 0.55, range: 19, value: 60, illegal: true, desc: 'A baseball bat with nails through it.' },
  steel_sword:   { name: 'Katana', type: 'weapon', cat: 'blade', icon: 'katana', dmg: 16, cd: 0.38, range: 20, value: 400, desc: 'A collector piece. Very much not decorative.' },

  // --- modern melee ---
  kitchen_knife: { name: 'Kitchen Knife', type: 'weapon', cat: 'knife', icon: 'kitchen_knife', dmg: 5, cd: 0.26, range: 14, value: 12, desc: 'Meant for vegetables.' },
  switchblade:   { name: 'Switchblade', type: 'weapon', cat: 'knife', icon: 'switchblade', dmg: 6, cd: 0.22, range: 13, value: 35, illegal: true, desc: 'Flicks open with a click. Easy to hide.' },
  combat_knife:  { name: 'Combat Knife', type: 'weapon', cat: 'knife', icon: 'combat_knife', dmg: 9, cd: 0.25, range: 15, value: 90, desc: 'Military surplus. Serrated spine.' },
  machete:       { name: 'Machete', type: 'weapon', cat: 'blade', icon: 'machete', dmg: 11, cd: 0.42, range: 19, value: 70, desc: 'Clears brush. And other things.' },
  brass_knuckles:{ name: 'Brass Knuckles', type: 'weapon', cat: 'blunt', icon: 'knuckles', dmg: 5, cd: 0.2, range: 12, value: 30, illegal: true, desc: 'Punches that leave a mark.' },
  baseball_bat:  { name: 'Baseball Bat', type: 'weapon', cat: 'blunt', icon: 'bat', dmg: 8, cd: 0.45, range: 19, value: 25, desc: 'Nobody in this town plays baseball.' },
  crowbar:       { name: 'Crowbar', type: 'weapon', cat: 'blunt', icon: 'crowbar', dmg: 9, cd: 0.48, value: 30, desc: 'Opens doors and skulls.' },
  police_baton:  { name: 'Police Baton', type: 'weapon', cat: 'blunt', icon: 'baton', dmg: 7, cd: 0.36, value: 45, desc: 'Standard issue nightstick.' },
  sledgehammer:  { name: 'Sledgehammer', type: 'weapon', cat: 'blunt', icon: 'sledge', dmg: 17, cd: 0.75, range: 20, value: 60, desc: 'Slow. Devastating.' },

  // --- firearms ---
  pistol:        { name: '9mm Pistol', type: 'weapon', cat: 'pistol', icon: 'pistol', gun: true, ammo: 'ammo_9mm', mag: 12, dmg: 14, cd: 0.3, reload: 1.3, spread: 0.05, range: 230, loud: 300, value: 350, desc: 'Semi-automatic. Reliable and common.' },
  revolver:      { name: '.357 Revolver', type: 'weapon', cat: 'pistol', icon: 'revolver', gun: true, ammo: 'ammo_357', mag: 6, dmg: 24, cd: 0.55, reload: 2.0, spread: 0.035, range: 250, loud: 340, value: 420, desc: 'Six shots. Each one counts.' },
  smg:           { name: 'Submachine Gun', type: 'weapon', cat: 'smg', icon: 'smg', gun: true, auto: true, ammo: 'ammo_9mm', mag: 30, dmg: 9, cd: 0.09, reload: 1.8, spread: 0.13, range: 200, loud: 320, illegal: true, value: 900, desc: 'Hold the trigger. Sprays 9mm.' },
  shotgun:       { name: 'Pump Shotgun', type: 'weapon', cat: 'shotgun', icon: 'shotgun', gun: true, ammo: 'ammo_shells', mag: 6, pellets: 7, dmg: 7, cd: 0.85, reload: 2.6, spread: 0.3, range: 130, loud: 380, value: 600, desc: 'Seven pellets per shell. Brutal up close.' },
  hunting_rifle: { name: 'Hunting Rifle', type: 'weapon', cat: 'rifle', icon: 'rifle', gun: true, ammo: 'ammo_rifle', mag: 5, dmg: 42, cd: 1.2, reload: 2.4, spread: 0.012, range: 360, loud: 420, value: 750, desc: 'Bolt-action. Accurate at long range.' },
  assault_rifle: { name: 'Assault Rifle', type: 'weapon', cat: 'rifle', icon: 'assault_rifle', gun: true, auto: true, ammo: 'ammo_rifle', mag: 30, dmg: 15, cd: 0.12, reload: 2.2, spread: 0.07, range: 320, loud: 420, illegal: true, value: 1600, desc: 'Military hardware. Whoever owned this had friends.' },

  // --- ammunition ---
  ammo_9mm:      { name: '9mm Rounds', type: 'ammo', icon: 'ammo_9mm', value: 1, stack: 120, desc: 'Fits pistols and submachine guns.' },
  ammo_357:      { name: '.357 Rounds', type: 'ammo', icon: 'ammo_357', value: 2, stack: 60, desc: 'Revolver ammunition.' },
  ammo_shells:   { name: 'Shotgun Shells', type: 'ammo', icon: 'ammo_shells', value: 2, stack: 48, desc: '12 gauge buckshot.' },
  ammo_rifle:    { name: 'Rifle Rounds', type: 'ammo', icon: 'ammo_rifle', value: 3, stack: 90, desc: 'For hunting and assault rifles.' },

  // --- armor ---
  cloth_tunic:   { name: 'Denim Jacket', type: 'armor', icon: 'armor_cloth', def: 1, value: 25, desc: 'Better than nothing.' },
  leather_armor: { name: 'Leather Jacket', type: 'armor', icon: 'armor_leather', def: 3, value: 90, desc: 'Thick leather. Turns a knife, sometimes.' },
  chainmail:     { name: 'Stab Vest', type: 'armor', icon: 'armor_chain', def: 6, bulletDef: 2, value: 260, desc: 'Stops blades. Not great against bullets.' },
  plate_armor:   { name: 'Riot Armor', type: 'armor', icon: 'armor_plate', def: 10, bulletDef: 8, value: 900, desc: 'Full riot gear. Heavy and very protective.' },
  kevlar_vest:   { name: 'Kevlar Vest', type: 'armor', icon: 'armor_kevlar', def: 7, bulletDef: 6, value: 480, desc: 'Soft body armor. Extra protection against bullets.' },

  // --- trinkets (stats: added to player stats while worn) ---
  copper_ring:   { name: 'Silver Ring', type: 'trinket', icon: 'ring', def: 1, value: 60, desc: '+1 defense. Good for punching.' },
  amulet:        { name: 'Lucky Charm', type: 'trinket', icon: 'amulet', maxHp: 20, value: 120, desc: '+20 max health. Probably placebo.' },
  gold_chain:    { name: 'Gold Chain', type: 'trinket', icon: 'gold_chain', stats: { charisma: 1, intimidate: 1 }, value: 250, desc: '+1 Charisma, +1 Intimidation. People notice it.' },
  designer_watch:{ name: 'Designer Watch', type: 'trinket', icon: 'watch', watch: true, stats: { charisma: 2 }, value: 800, desc: '+2 Charisma. Money talks. And it tells the time.' },
  wristwatch:    { name: 'Wristwatch', type: 'trinket', icon: 'watch', watch: true, value: 15, desc: 'A cheap digital watch. Now you know what time it is (shown on your HUD while you carry it).' },

  // --- consumables ---
  bread:         { name: 'Bread', type: 'consumable', icon: 'bread', heal: 10, value: 4, desc: 'Restores 10 health.' },
  apple:         { name: 'Apple', type: 'consumable', icon: 'apple', heal: 6, value: 2, desc: 'Restores 6 health.' },
  cheese:        { name: 'Cheese', type: 'consumable', icon: 'cheese', heal: 12, value: 6, desc: 'Restores 12 health.' },
  egg:           { name: 'Egg', type: 'consumable', icon: 'egg', heal: 4, value: 2, desc: 'Restores 4 health.' },
  milk:          { name: 'Milk', type: 'consumable', icon: 'milk', heal: 6, stamina: 20, value: 3, desc: 'Restores health and stamina.' },
  // kids' stuff
  candy:         { name: 'Candy Bar', type: 'consumable', icon: 'candy', heal: 2, stamina: 10, value: 1, food: 10, desc: 'Pure sugar.' },
  comic_book:    { name: 'Comic Book', type: 'material', icon: 'comic', value: 4, desc: 'Issue #312. The hero is having a crisis. Again.' },
  // over-the-counter and prescription drugs (see js/game/pills.js)
  benadryl:      { name: 'Benadryl (2 pills)', type: 'consumable', icon: 'pills_pink', effects: { drowsy: 240 }, drug: { cls: 'deliriant', load: 16, tol: 3 }, value: 4, desc: 'Allergy pills. Makes you drowsy. Taken by the handful, it causes delirium: a waking nightmare you cannot tell from reality.' },
  xanax:         { name: 'Xanax', type: 'consumable', icon: 'pills_blue', effects: { calm: 300 }, drug: { cls: 'benzo', load: 22, addict: 10, tol: 8 }, cures: ['paranoia', 'shaken'], value: 12, illegal: true, desc: 'A benzodiazepine. Calms the nerves. Deadly with alcohol or opioids. Very hard to quit.' },
  // burglary
  lockpick:      { name: 'Lockpick', type: 'material', icon: 'lockpick', value: 8, desc: 'Opens doors and safes, if your hands are steady. Breaks when you slip.' },
  // fishing (see js/game/fishing.js): raw fish heals a little; cook it at a stove or campfire
  fishing_rod:   { name: 'Fishing Rod', type: 'material', icon: 'rod', value: 25, desc: 'Use it facing water to fish. Bait helps a lot.' },
  bait:          { name: 'Bait (worms)', type: 'material', icon: 'bait', value: 1, desc: 'Fish bite twice as fast. One per catch.' },
  fish_bluegill: { name: 'Bluegill', type: 'consumable', icon: 'fish_bluegill', heal: 3, value: 4, desc: 'A little panfish. Cook it.' },
  fish_bass:     { name: 'Largemouth Bass', type: 'consumable', icon: 'fish_bass', heal: 4, value: 12, desc: 'A fighter. Cook it.' },
  fish_catfish:  { name: 'Catfish', type: 'consumable', icon: 'fish_catfish', heal: 4, value: 10, desc: 'Bottom feeder. Bites at night. Cook it.' },
  fish_trout:    { name: 'Rainbow Trout', type: 'consumable', icon: 'fish_trout', heal: 4, value: 14, desc: 'Likes cold, clear water at dawn. Cook it.' },
  fish_carp:     { name: 'Carp', type: 'consumable', icon: 'fish_carp', heal: 4, value: 6, desc: 'Big, bony and stubborn. Cook it.' },
  fish_pike:     { name: 'Northern Pike', type: 'consumable', icon: 'fish_pike', heal: 5, value: 22, desc: 'All teeth. A trophy. Cook it.' },
  fish_snapper:  { name: 'Red Snapper', type: 'consumable', icon: 'fish_snapper', heal: 5, value: 18, desc: 'Saltwater. Cook it.' },
  fish_tuna:     { name: 'Bluefin Tuna', type: 'consumable', icon: 'fish_tuna', heal: 8, value: 60, desc: 'A monster from deep water. Restaurants pay well.' },
  fish_golden:   { name: 'Golden Carp', type: 'material', icon: 'fish_golden', value: 250, desc: 'A legend among anglers. Collectors pay a fortune. Some say it brings luck.' },
  cooked_fish:   { name: 'Grilled Fish', type: 'consumable', icon: 'fish', heal: 22, value: 10, desc: 'Restores 22 health.' },
  old_boot:      { name: 'Old Boot', type: 'material', icon: 'boot', value: 0, desc: 'Every angler catches one eventually.' },
  raw_meat:      { name: 'Raw Meat', type: 'consumable', icon: 'meat', heal: 3, value: 5, desc: 'Better cooked. Sells well.' },
  cooked_meat:   { name: 'Burger', type: 'consumable', icon: 'cooked_meat', heal: 20, value: 9, desc: 'Restores 20 health.' },
  fish:          { name: 'Fish', type: 'consumable', icon: 'fish', heal: 8, value: 5, desc: 'Restores 8 health.' },
  ale:           { name: 'Draft Beer', type: 'consumable', icon: 'ale', heal: 4, stamina: 30, alcohol: 12, value: 3, desc: 'A pint from the tap. Takes the edge off.' },
  herb:          { name: 'Medicinal Herbs', type: 'consumable', icon: 'herb', heal: 8, value: 4, desc: 'Restores 8 health.' },
  condom:        { name: 'Condom', type: 'material', icon: 'condom', value: 2, desc: 'Used automatically when you spend the night with someone. Pregnancy becomes very unlikely.' },
  bandage:       { name: 'Bandage', type: 'consumable', icon: 'bandage', heal: 15, value: 6, desc: 'Restores 15 health.' },
  sandwich:      { name: 'Sandwich', type: 'consumable', icon: 'sandwich', heal: 16, value: 6, desc: 'Ham and cheese. Slightly squashed.' },
  canned_beans:  { name: 'Canned Beans', type: 'consumable', icon: 'can', heal: 14, value: 4, desc: 'Cold, straight from the can.' },
  chips:         { name: 'Bag of Chips', type: 'consumable', icon: 'chips', heal: 5, value: 2, desc: 'Mostly air.' },
  water_bottle:  { name: 'Water Bottle', type: 'consumable', icon: 'water', stamina: 10, value: 1, desc: 'Plain water. Quenches thirst.' },
  soda:          { name: 'Soda', type: 'consumable', icon: 'soda', heal: 2, stamina: 25, value: 2, desc: 'Sugar rush in a can.' },
  coffee:        { name: 'Coffee', type: 'consumable', icon: 'coffee', stamina: 30, effects: { caffeine: 60 }, value: 3, desc: 'Black. Faster stamina recovery for a while.' },
  energy_drink:  { name: 'Energy Drink', type: 'consumable', icon: 'energy', stamina: 60, effects: { caffeine: 100 }, drug: { cls: 'stimulant', load: 6 }, value: 5, desc: 'Tastes like battery acid and ambition.' },
  first_aid_kit: { name: 'First Aid Kit', type: 'consumable', icon: 'medkit', heal: 50, value: 40, desc: 'Restores 50 health.' },
  antidote:      { name: 'Activated Charcoal', type: 'consumable', icon: 'charcoal', cures: ['poison', 'organ_failure', 'amatoxin', 'nausea'], value: 15, desc: 'Cures poisoning and nausea, if taken in time.' },

  // --- alcohol (intoxication: tipsy > drunk > wasted > blackout) ---
  beer:          { name: 'Beer', type: 'consumable', icon: 'beer', heal: 2, stamina: 20, alcohol: 14, value: 4, desc: 'A cold one.' },
  wine:          { name: 'Bottle of Wine', type: 'consumable', icon: 'wine', heal: 3, alcohol: 24, value: 12, desc: 'Red. Cheap. Strong enough.' },
  whiskey:       { name: 'Whiskey', type: 'consumable', icon: 'whiskey', alcohol: 32, value: 25, desc: 'Liquid courage. Tipsy people talk better.' },
  vodka:         { name: 'Vodka', type: 'consumable', icon: 'vodka', alcohol: 38, value: 20, desc: 'Clear, cold and dangerous.' },
  moonshine:     { name: 'Moonshine', type: 'consumable', icon: 'moonshine', alcohol: 52, effects: { nausea: 20 }, value: 8, illegal: true, desc: 'Homemade. Might make you blind.' },

  // --- drugs (drug: { cls, load, addict, tol } — see G.DRUG_CLASSES in js/data/effects.js) ---
  cigarettes:    { name: 'Cigarette', type: 'consumable', icon: 'cigarette', stamina: 10, effects: { nicotine: 90 }, drug: { cls: 'nicotine', load: 10, addict: 5 }, value: 2, desc: 'Calms the nerves. Better stamina recovery. Very addictive.' },
  joint:         { name: 'Joint', type: 'consumable', icon: 'joint', effects: { high: 150 }, drug: { cls: 'cannabis', load: 25, addict: 2, tol: 8 }, value: 15, illegal: true, desc: 'Marijuana. Relaxed, slow, hungry, worse aim. Too much makes you sick and paranoid, but it cannot kill you.' },
  weed:          { name: 'Bag of Weed', type: 'consumable', icon: 'weed', effects: { high: 200 }, drug: { cls: 'cannabis', load: 40, addict: 3, tol: 10 }, value: 30, illegal: true, desc: 'A strong strain. A bigger, longer high, and an easy way to green out.' },
  edible:        { name: 'Pot Brownie', type: 'consumable', icon: 'edible', heal: 4, effects: { thc_onset: 40 }, drug: { cls: 'cannabis', load: 50, addict: 2, tol: 8, delay: 40 }, value: 20, illegal: true, desc: 'Takes a while to kick in. Do not eat a second one because "it is not working".' },
  cocaine:       { name: 'Cocaine', type: 'consumable', icon: 'cocaine', effects: { stim: 90 }, drug: { cls: 'stimulant', load: 38, addict: 9, tol: 6 }, value: 60, illegal: true, desc: 'Euphoria, energy, confidence... then the comedown. Hard on the heart, worse with alcohol.' },
  crack:         { name: 'Crack Rock', type: 'consumable', icon: 'crack', effects: { crack_high: 35 }, drug: { cls: 'stimulant', load: 38, addict: 18, tol: 10 }, value: 25, illegal: true, desc: 'Smoked cocaine. A violent rush that is over in a minute. Extremely addictive.' },
  speed_pills:   { name: 'Speed Pills', type: 'consumable', icon: 'pills_white', effects: { stim: 140 }, drug: { cls: 'stimulant', load: 26, addict: 7, tol: 5 }, value: 35, illegal: true, desc: 'Amphetamines. Like cocaine, but longer and cheaper.' },
  painkillers:   { name: 'Painkillers', type: 'consumable', icon: 'pills_red', heal: 10, effects: { painkiller: 120 }, drug: { cls: 'opioid', load: 22, addict: 5, tol: 5 }, value: 18, desc: 'Prescription opioids. You take less damage. Addictive. Never mix with alcohol or heroin.' },
  heroin:        { name: 'Heroin', type: 'consumable', icon: 'heroin', heal: 15, effects: { opiate: 160 }, drug: { cls: 'opioid', load: 55, addict: 20, tol: 6 }, value: 50, illegal: true, desc: 'Warm, total euphoria and no pain. Incredibly addictive. Two doses, or one with alcohol, can stop your breathing.' },
  lsd:           { name: 'LSD Tab', type: 'consumable', icon: 'lsd', effects: { trip: [180, 1.2] }, drug: { cls: 'psychedelic', load: 10, tol: 45 }, value: 40, illegal: true, desc: 'A tiny square of paper. Hours of visions. Not addictive, but tolerance builds fast.' },
  naloxone:      { name: 'Naloxone', type: 'consumable', icon: 'naloxone', cures: ['resp_depression', 'opiate', 'painkiller'], antidote: 'opioid', value: 45, desc: 'Narcan nasal spray. Reverses an opioid overdose instantly. Brutal if you are dependent.' },
  methadone:     { name: 'Methadone', type: 'consumable', icon: 'pills_red', effects: { methadone: 600 }, cures: ['wd_opioid'], drug: { cls: 'opioid', load: 15, addict: 1, relief: true }, value: 30, desc: 'Treats opioid addiction: no high, but it holds off withdrawal for a long time.' },

  // --- wild mushrooms (unidentified until eaten once, or with the Mycologist skill) ---
  mushroom:      { name: 'Field Mushroom', type: 'consumable', icon: 'mushroom', heal: 4, value: 3, ident: ['Brown Mushroom', 'A brown cap with pink gills. Could be anything.'], desc: 'A common edible mushroom. Restores 4 health.' },
  chanterelle:   { name: 'Chanterelle', type: 'consumable', icon: 'chanterelle', heal: 10, value: 8, ident: ['Yellow Mushroom', 'Golden and funnel-shaped. Smells faintly of apricots.'], desc: 'A prized edible mushroom. Restores 10 health.' },
  death_cap:     { name: 'Death Cap', type: 'consumable', icon: 'death_cap', heal: 2, effects: { amatoxin: 20 }, value: 2, ident: ['Pale Mushroom', 'A smooth, pale greenish cap. Looks harmless.'], desc: 'Deadly poisonous. Symptoms start late, when it is almost too late.' },
  fly_agaric:    { name: 'Fly Agaric', type: 'consumable', icon: 'fly_agaric', effects: { nausea: 40, poison: 10, trip: [70, 0.55] }, drug: { cls: 'psychedelic', load: 6, tol: 20 }, value: 4, ident: ['Red Spotted Mushroom', 'Bright red with white spots. Straight out of a fairy tale.'], desc: 'Poisonous and hallucinogenic. Nausea, then strange visions.' },
  magic_mushroom:{ name: 'Magic Mushroom', type: 'consumable', icon: 'magic_mushroom', effects: { trip: [140, 1] }, drug: { cls: 'psychedelic', load: 8, tol: 35 }, value: 25, illegal: true, ident: ['Small Pointed Mushroom', 'Thin stem, little pointed cap. Bruises blue when pinched.'], desc: 'Psilocybin. A long, colorful trip.' },
  health_potion: { name: 'Wound Spray', type: 'consumable', icon: 'spray', heal: 45, value: 30, desc: 'Antiseptic and clotting agent. Restores 45 health.' },
  greater_potion:{ name: 'Trauma Kit', type: 'consumable', icon: 'trauma_kit', heal: 100, value: 80, desc: 'Paramedic grade. Restores 100 health.' },
  stamina_potion:{ name: 'Adrenaline Shot', type: 'consumable', icon: 'syringe', stamina: 100, effects: { caffeine: 60 }, drug: { cls: 'stimulant', load: 15 }, value: 25, desc: 'Fully restores stamina. Your heart goes boom.' },

  // --- materials / loot ---
  pelt:          { name: 'Hide', type: 'material', icon: 'pelt', value: 12, desc: 'Animal hide. Hunters buy these.' },
  wolf_pelt:     { name: 'Wolf Pelt', type: 'material', icon: 'wolf_pelt', value: 22, desc: 'Thick grey fur.' },
  bear_pelt:     { name: 'Bear Pelt', type: 'material', icon: 'bear_pelt', value: 70, desc: 'A trophy.' },
  antler:        { name: 'Antler', type: 'material', icon: 'antler', value: 15, desc: 'From a stag.' },
  tusk:          { name: 'Boar Tusk', type: 'material', icon: 'tusk', value: 14, desc: 'Sharp and curved.' },
  feather:       { name: 'Feather', type: 'material', icon: 'feather', value: 1, desc: 'Light as air.' },
  wheat:         { name: 'Wheat', type: 'material', icon: 'wheat', value: 2, desc: 'A bundle of wheat.' },
  wood:          { name: 'Firewood', type: 'material', icon: 'wood', value: 3, desc: 'Split logs.' },
  iron_ore:      { name: 'Scrap Metal', type: 'material', icon: 'ore', value: 8, desc: 'The scrapyard pays for this.' },
  iron_ingot:    { name: 'Copper Wire', type: 'material', icon: 'ingot', value: 22, desc: 'Stripped from somewhere. Sells well.' },
  gem:           { name: 'Diamond', type: 'material', icon: 'gem', value: 300, desc: 'Small, but real.' },

  // --- fire tools (use from the inventory, or press F with a lighter) ---
  torch:         { name: 'Lighter', type: 'tool', icon: 'torch', value: 3, stack: 5, desc: 'Use (or press F) to set fire to whatever is in front of you.' },
  shovel:        { name: 'Shovel', type: 'misc', icon: 'shovel', value: 25, stack: 1, desc: 'For digging. Gardens, mostly. Mostly.' },
  phone:         { name: 'Cellphone', type: 'tool', icon: 'phone', value: 0, stack: 1, desc: 'Your phone. Press P (or use it) for Eagle Maps, contacts, messages and LifeLog.' },
  flashlight:    { name: 'Flashlight', type: 'misc', icon: 'flashlight', value: 15, stack: 1, desc: 'Lights the way at night while you carry it.' },
  oil_flask:     { name: 'Gas Can', type: 'tool', icon: 'oil', value: 12, stack: 10, desc: 'Pour gasoline on the ground in front of you. It burns hotter and longer, even on concrete.' },
  fire_bomb:     { name: 'Molotov Cocktail', type: 'tool', icon: 'firebomb', value: 35, stack: 10, illegal: true, desc: 'Thrown a few steps ahead. Bursts into flames on impact.' },

  // --- misc ---
  book:          { name: 'Book', type: 'misc', icon: 'book', value: 15, desc: 'A placeholder book.' },
  smartphone:    { name: 'Smartphone', type: 'misc', icon: 'phone', value: 120, desc: 'Locked. Someone will buy it anyway.' },
  wallet:        { name: 'Wallet', type: 'misc', icon: 'wallet', value: 40, desc: 'Not yours. A few cards and a photo.' },
  keycard:       { name: 'Warden Keycard', type: 'misc', icon: 'keycard', value: 0, stack: 1, illegal: true, desc: 'Opens the security gate of the County Jail.' },
  spoon:         { name: 'Spoon', type: 'misc', icon: 'spoon', value: 1, stack: 1, illegal: true, desc: 'A metal spoon from the mess hall. Patient people dig tunnels with these.' },
  jewelry:       { name: 'Jewelry', type: 'material', icon: 'jewelry', value: 180, desc: 'Gold and pearls. Someone rich will miss it.' },
  key:           { name: 'Key', type: 'misc', icon: 'key', value: 1, desc: 'Opens something.' },

  // --- quest items (placeholders for sample quests) ---
  sealed_package:{ name: 'Sealed Package', type: 'quest', icon: 'package', value: 0, desc: 'Deliver it. Do not open it.' },
  letter:        { name: 'Letter', type: 'quest', icon: 'letter', value: 0, desc: 'A sealed letter.' },
  parcel:        { name: 'Parcel', type: 'quest', icon: 'package', value: 0, desc: 'Someone is waiting for this. Deliver it.' },
  drug_package:  { name: 'Taped Package', type: 'quest', icon: 'package', value: 0, illegal: true, desc: 'Tightly wrapped, smells faintly of chemicals. The police would love to see this.' },
  heirloom:      { name: 'Family Heirloom', type: 'quest', icon: 'amulet', value: 0, desc: 'A treasured keepsake. Stolen.' },
};

for (const id in G.ITEMS) {
  const it = G.ITEMS[id];
  it.id = id;
  if (it.stack == null) it.stack = ['weapon', 'armor', 'trinket', 'quest'].includes(it.type) ? 1 : 20;
}

// ---- Clothing ----
// Clothing items are generated from their id: "top/<style>/<color>/<color2>" or "bottom/<style>/<color>".
// Equip them in the Top / Bottom slots; the character sprite changes accordingly.
G.CLOTH_COLORS = [
  ['White', '#e8e4dc'], ['Grey', '#8a8a90'], ['Black', '#2a2a30'], ['Crimson', '#a83232'], ['Red', '#d04040'],
  ['Orange', '#d8782a'], ['Mustard', '#c8a038'], ['Olive', '#6a7a3a'], ['Green', '#3a8a4a'], ['Teal', '#2a8a8a'],
  ['Navy', '#2a3a6a'], ['Blue', '#4070d8'], ['Sky', '#6a9ad8'], ['Purple', '#6a3a8a'], ['Pink', '#d070a0'],
  ['Brown', '#6a4a2a'], ['Tan', '#b8a07a'], ['Denim', '#4a5a7a'],
];
G.CLOTH_STYLES = {
  top: { shirt: ['Shirt', 15], tshirt: ['T-Shirt', 12], longsleeve: ['Long Sleeve', 16], tank: ['Tank Top', 8], tunic: ['Long Tee', 18], jacket: ['Jacket', 40], hoodie: ['Hoodie', 30], vest: ['Vest', 22], dress: ['Dress', 35], robe: ['Robe', 30] },
  bottom: { pants: ['Pants', 15], shorts: ['Shorts', 10], skirt: ['Skirt', 15] },
  shoes: { sneakers: ['Sneakers', 25], boots: ['Boots', 40], dress_shoes: ['Dress Shoes', 45], sandals: ['Sandals', 12] },
  mask: { white: ['Masquerade Mask', 30], gold: ['Gold Mask', 120], black: ['Black Mask', 30], red: ['Red Mask', 40], silver: ['Silver Mask', 60], ski: ['Ski Mask', 15], surgical: ['Surgical Mask', 3], bandana: ['Bandana Mask', 8], hockey: ['Hockey Mask', 35], gas: ['Gas Mask', 90], balaclava: ['Balaclava', 18] },
  hat: { cap: ['Cap', 12], beanie: ['Beanie', 10], straw: ['Straw Hat', 14], fedora: ['Fedora', 45], tophat: ['Top Hat', 60], bucket: ['Bucket Hat', 15], bandana: ['Head Bandana', 8], hardhat: ['Hard Hat', 22], helmet: ['Helmet', 40], hood: ['Hood', 18] },
};
G.colorName = (hex) => {
  const h = (hex || '').toLowerCase();
  const exact = G.CLOTH_COLORS.find((c) => c[1] === h);
  if (exact) return exact[0];
  const rgb = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const a = rgb(h);
  let best = 'Plain', bd = 1e9;
  for (const [n, c] of G.CLOTH_COLORS) { const b = rgb(c); const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
};
G.clothId = (slot, style, color, color2) => [slot, style, (color || '#888888').replace('#', ''), (color2 || '').replace('#', '')].filter((p, i) => i < 3 || p).join('/');
const clothCache = {};
G.clothItem = (id) => {
  if (clothCache[id]) return clothCache[id];
  const [slot, style, c1, c2] = id.split('/');
  const st = G.CLOTH_STYLES[slot] && G.CLOTH_STYLES[slot][style];
  if (!st) return null;
  const color = '#' + c1, color2 = c2 ? '#' + c2 : null;
  const it = {
    id, type: 'clothing', slot, style, color, color2, stack: 1, value: st[1],
    name: slot === 'mask' ? st[0] : `${G.colorName(color)} ${st[0]}`, hides: slot === 'mask' && !/surgical/.test(style),
    icon: `cloth|${slot}|${style}|${color}|${color2 || ''}`,
    desc: { top: 'Clothing (top). Equip it to wear it.', bottom: 'Clothing (bottom). Equip it to wear it.', shoes: 'Shoes. Equip them to wear them.', mask: 'A mask. Equip it to hide your face.', hat: 'A hat. Equip it to wear it.' }[slot],
  };
  clothCache[id] = it;
  return it;
};

// Unidentified items (wild mushrooms) show a vague name until eaten once or the player learns Mycologist.
G.isIdentified = (id) => !!(G.world && (G.world.flags['known_' + id] || (G.player && G.skills.has(G.player, 'mycologist'))));
const identCache = {};
G.item = (id) => {
  const it = G.ITEMS[id];
  if (it) {
    if (!it.ident || G.isIdentified(id)) return it;
    return identCache[id] || (identCache[id] = Object.assign({}, it, { name: it.ident[0], desc: it.ident[1], unidentified: true }));
  }
  return (id && id.includes('/') && G.clothItem(id)) || { id, name: id, type: 'misc', icon: 'unknown', value: 0, stack: 1, desc: '' };
};
G.SMOKEABLE = ['cigarettes', 'joint', 'weed', 'crack', 'cigar'];   // need a lighter (js/game/player.js)
