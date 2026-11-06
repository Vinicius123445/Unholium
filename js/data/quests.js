'use strict';
// Quests. Two generic sample quests demonstrate the system — replace them with your own.
//   objectives: { type: 'kill', target: animal kind or npc id, count } | { type: 'flag', flag }
//   reward: { gold, rep: { key: amount }, items: [[id, qty]] }    rewardGoldFlag: world flag overriding gold
//   failIfDead: npc id(s) whose death fails the quest

G.QUESTS = {
  wolves: {
    title: 'Wolf Trouble', giver: 'r_elder', region: 'rural',
    desc: 'The town mayor asked me to kill three wolves in the forest, then return for a reward.',
    objectives: [{ type: 'kill', target: 'wolf', count: 3, text: 'Kill wolves in the forest' }],
    reward: { gold: 60, rep: { rural: 10, civilians: 10 } }, rewardGoldFlag: 'wolves_reward',
    failIfDead: ['r_elder'],
  },
  delivery: {
    title: 'Sealed Package', giver: 'c_noble1', region: 'city',
    desc: 'A businessman downtown asked me to deliver a sealed package to the shopkeeper in the rural zone. I was told not to open it.',
    objectives: [{ type: 'flag', flag: 'package_delivered', text: 'Deliver the package to the rural shopkeeper' }],
    reward: { gold: 40, rep: { city: 5, rural: 3 } },
    failIfDead: ['r_merchant'],
  },
  // Gang contracts: each boss wants the rival boss dead. Taking one side is a big faction decision.
  red_contract: {
    title: 'Red Contract', giver: 'c_red_boss', region: 'city',
    desc: 'The Red Gang Boss wants the Blue Gang Boss dead. Their hideout is on the Eastside docks.',
    objectives: [{ type: 'kill', target: 'c_blue_boss', count: 1, text: 'Kill the Blue Gang Boss' }],
    reward: { gold: 150, rep: { gang_red: 25 } }, failIfDead: ['c_red_boss'],
  },
  blue_contract: {
    title: 'Blue Contract', giver: 'c_blue_boss', region: 'city',
    desc: 'The Blue Gang Boss wants the Red Gang Boss dead. Their hideout is in Southside.',
    objectives: [{ type: 'kill', target: 'c_red_boss', count: 1, text: 'Kill the Red Gang Boss' }],
    reward: { gold: 150, rep: { gang_blue: 25 } }, failIfDead: ['c_blue_boss'],
  },
};

// Custom behavior when the player "uses" an item from the inventory.
// Return true if the item was handled. `game` is the GameScene.
G.ITEM_USE = {
  sealed_package(game) {
    game.confirm('Open the sealed package? You were told not to.', () => {
      const p = game.player;
      p.inventory.remove('sealed_package', 1);
      p.inventory.add('gem', 1);
      const w = G.world;
      w.flags.package_opened = true;
      w.flags.package_opened_day = w.day;
      w.failQuest('delivery', 'You opened the package.');
      game.toast('Inside: a Gemstone.');
    });
    return true;
  },
};

// Quest definition: hand-written quests live in G.QUESTS; radiant jobs (js/game/jobs.js) store theirs in
// the quest state itself.
G.questDef = (w, id) => G.QUESTS[id] || (w && w.quests[id] && w.quests[id].def) || { title: id, desc: '', objectives: [] };
