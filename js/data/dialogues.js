'use strict';
// Dialogue trees. All text here is placeholder — replace with your lore.
//
// A tree is { nodeId: node }. Conversations begin at "start".
// node: { text: string | (c) => string, choices: [choice], common: true (append standard choices) }
// choice: { text: string | fn, if: (c) => bool, do: (c) => (optional node id), next: nodeId | null (end) }
//
// The context `c` passed to every function (see js/game/dialogue.js) exposes:
//   c.npc c.def c.st c.w c.p  c.region  c.flag(k) c.set(k, v) c.rep(k) c.addRep(k, n)
//   c.gold() c.pay(n) c.giveGold(n) c.has(id, n) c.give(id, n) c.take(id, n)
//   c.quest(id) c.startQuest(id) c.completeQuest(id) c.failQuest(id)
//   c.openShop() c.wait(hours) c.heal(n) c.hostile() c.bounty() c.clearBounty()
//   c.dead(id) c.log(text) c.rumor(text) c.travel(map, spawn) c.ending(type) c.greet()
//   Speech checks (charisma, or 'intimidate'):
//     c.tag(difficulty, stat) -> "[Speech 60%]" label   c.check(key, difficulty, stat) -> rolls, true on success
//     c.canTry(key) -> false after failing that check with this person today   c.skill(id) -> player has the skill
//
// Standard choices (Trade / Any news? / Threaten / Goodbye) are appended automatically to nodes
// with `common: true`, so trees only need their unique content.

const back = { text: 'Something else...', next: 'start' };

G.DIALOGUES = {
  generic: {
    start: { text: (c) => c.greet(), common: true, choices: [{ text: 'What do you do here?', next: 'job' }] },
    job: { text: (c) => c.def.job || 'I get by. Same as everyone.', choices: [back] },
  },

  // ---------------------------------------------------------------- RURAL
  // The swim instructor at the lake: the only way to learn to swim (rank 1 of the Swimming skill).
  swimcoach: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'Can you teach me how to swim? ($50, 2 hours)', if: (c) => !c.skill('swimming'), next: 'lesson' },
        { text: 'Any swimming tips?', if: (c) => c.skill('swimming'), next: 'tips' },
      ],
    },
    lesson: {
      text: (c) => (c.gold() >= 50 ? 'Sure! Two hours in the shallows and you will float like a duck. Ready?' : 'Fifty bucks for a lesson. Come back when you have it. And stay out of deep water until then!'),
      choices: [
        { text: 'Let\'s do it.', if: (c) => c.gold() >= 50, do: (c) => {
          c.pay(50); c.wait(2);
          c.p.skills.ranks.swimming = 1;
          c.p.stamina = Math.max(0, c.p.stamina - 50);
          c.log('You learned how to swim.');
          G.events.emit('xp', 30, 'Swimming');
          G.audio.play('quest');
        }, next: 'learned' },
        back,
      ],
    },
    learned: { text: 'Look at you, swimming like a pro. Well, like an amateur. Watch your stamina in deep water: when you are exhausted, you sink.', choices: [{ text: 'Thanks, coach.', next: null }] },
    tips: { text: 'Do not swim tired, do not swim drunk, and never swim alone at night. Practice makes you faster.', choices: [back] },
  },
  r_elder: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'Is there anything I can help with?', if: (c) => !c.quest('wolves'), next: 'wolves_offer' },
        { text: 'About the wolves...', if: (c) => c.quest('wolves') === 'active', next: 'wolves_progress' },
        { text: 'Tell me about this town.', next: 'village' },
      ],
    },
    village: { text: 'Farmers, a mechanic, a church, a motel. Quiet, mostly. We would like to keep it that way.', choices: [back] },
    wolves_offer: {
      text: (c) => c.bounty() > 0
        ? 'I have heard what you have done. I do not need help from the likes of you.'
        : 'Wolves from the forest have been taking our livestock. Kill three of them and the town will pay you $60.',
      choices: [
        { text: 'Consider it done.', if: (c) => c.bounty() === 0, do: (c) => c.startQuest('wolves'), next: 'wolves_accept' },
        { text: 'For $60? Make it 100.', if: (c) => c.bounty() === 0, next: 'wolves_haggle' },
        { text: (c) => `${c.tag(6)} Wolves are dangerous work. 100 is fair, and you know it.`, if: (c) => c.bounty() === 0 && c.canTry('wolves'), do: (c) => (c.check('wolves', 6) ? 'wolves_persuaded' : 'wolves_haggle') },
        { text: 'Not my problem.', do: (c) => c.addRep('rural', -2), next: null },
      ],
    },
    wolves_haggle: {
      text: (c) => c.rep('rural') >= 15 ? 'You have been good to us... fine. One hundred.' : 'Sixty is what we have. Take it or leave it.',
      choices: [
        { text: 'Deal.', do: (c) => { if (c.rep('rural') >= 15) c.set('wolves_reward', 100); c.startQuest('wolves'); }, next: 'wolves_accept' },
        { text: 'Forget it.', next: null },
      ],
    },
    wolves_persuaded: {
      text: 'Hm. You make a good point. One hundred it is, when the job is done.',
      choices: [{ text: 'Deal.', do: (c) => { c.set('wolves_reward', 100); c.startQuest('wolves'); }, next: 'wolves_accept' }],
    },
    wolves_accept: { text: 'Thank you. The wolves roam the east side of the forest. Come back when it is done.', choices: [{ text: 'Goodbye.', next: null }] },
    wolves_progress: {
      text: (c) => c.w.questDone('wolves') ? 'Three wolves! The farmers will sleep easier. Here, as promised.' : 'The wolves are still out there. Three of them, remember.',
      choices: [
        { text: 'Collect reward.', if: (c) => c.w.questDone('wolves'), do: (c) => c.completeQuest('wolves'), next: null },
        { text: 'I am on it.', if: (c) => !c.w.questDone('wolves'), next: null },
      ],
    },
  },

  r_merchant: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'I have a package for you.', if: (c) => c.has('sealed_package'), next: 'package' },
        { text: 'What do you do here?', next: 'job' },
      ],
    },
    job: { text: (c) => c.def.job, choices: [back] },
    package: {
      text: 'From the city? Excellent, I have been waiting for this. Here is your payment.',
      choices: [{ text: 'Pleasure doing business.', do: (c) => { c.take('sealed_package'); c.set('package_delivered'); c.completeQuest('delivery'); }, next: null }],
    },
  },

  innkeeper: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: (c) => `I need a room for the night. ($${c.roomPrice()})`, if: (c) => !c.hasRoom(), next: 'room' },
        { text: 'Where is my room again?', if: (c) => c.hasRoom(), next: 'room_where' },
        { text: 'Pour me a beer. ($3)', next: 'ale' },
      ],
    },
    room: {
      text: (c) => c.pay(c.roomPrice()) ? (c.rentRoom(), 'Your bed is the one by the far wall. Sleep well.') : 'No cash, no bed. Sorry.',
      choices: [back, { text: 'Goodbye.', next: null }],
    },
    room_where: { text: 'The beds against the far wall. Paid until morning.', choices: [back] },
    ale: {
      text: (c) => c.pay(3) ? (c.heal(4), c.p.stamina = c.p.maxStamina, 'There you go. On the house next time... just kidding.') : 'Three bucks. You do not have three bucks?',
      choices: [back],
    },
  },

  priest: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'Bless me. (Restores health, once a day)', next: 'bless' },
        { text: 'I want to make a donation. ($25)', next: 'donate' },
        { text: 'Who is buried in the graveyard?', if: (c) => c.region === 'rural', next: 'graves' },
      ],
    },
    bless: {
      text: (c) => {
        if (c.w.flags['blessed_' + c.region] === c.w.day) return 'I have already blessed you today. Come back tomorrow.';
        c.set('blessed_' + c.region, c.w.day);
        c.heal(999);
        return 'Go in peace.';
      },
      choices: [back],
    },
    donate: {
      text: (c) => c.pay(25) ? (c.addRep(c.region, 3), 'Your generosity will not go unnoticed.') : 'The intention matters... but so does the money.',
      choices: [back],
    },
    graves: {
      text: (c) => {
        const n = c.w.deadInRegion('rural').length;
        return n ? `We have buried ${G.util.plural(n, 'soul')} recently. Too many.` : 'Old families. No one new, thankfully.';
      },
      choices: [back],
    },
  },

  rancher: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'Need a hand with the animals? (2 hours)', if: (c) => c.w.flags.helped_rancher !== c.w.day, next: 'help' },
        { text: 'What do you do here?', next: 'job' },
      ],
    },
    job: { text: (c) => c.def.job, choices: [back] },
    help: {
      text: (c) => { c.wait(2); c.giveGold(15); c.addRep('rural', 3); c.set('helped_rancher', c.w.day); return 'Good work. Here is $15. Come back tomorrow if you want more.'; },
      choices: [back],
    },
  },

  // ---------------------------------------------------------------- CITY
  captain: {
    start: {
      text: (c) => c.bounty() > 0 ? `You have a bounty of $${c.bounty()} in this city. Pay up, or else.` : c.greet(), common: true,
      choices: [
        { text: (c) => `Pay the bounty. ($${c.bounty()})`, if: (c) => c.bounty() > 0, next: 'pay' },
        { text: 'Any work for me?', next: 'work' },
        { text: 'The bandit camp in the forest is gone.', if: (c) => c.flag('bandits_destroyed') && !c.flag('bandits_reported'), next: 'bandits' },
      ],
    },
    pay: {
      text: (c) => c.pay(c.bounty()) ? (c.clearBounty(), 'Your debt is paid. Stay out of trouble.') : 'You cannot afford it. Come back when you can, or turn yourself in.',
      choices: [back],
    },
    work: { text: '[Placeholder] Police work will go here once factions are designed.', choices: [back] },
    bandits: {
      text: 'You cleared the camp? The roads will be safer. Take this, with the city\'s thanks.',
      choices: [{ text: 'Thank you.', do: (c) => { c.set('bandits_reported'); c.giveGold(100); c.addRep('city', 10); c.addRep('government', 10); }, next: null }],
    },
  },

  lord: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'Who are you?', next: 'who' },
        { text: (c) => `Can you make my crimes disappear? ($${c.bounty() * 2})`, if: (c) => c.bounty() > 0, next: 'bribe' },
        { text: 'What do you know about the island?', next: 'island' },
      ],
    },
    who: { text: '[Placeholder] The Mayor of this city, and the Government\'s voice here. Replace with your lore.', choices: [back] },
    bribe: {
      text: (c) => {
        if (!c.pay(c.bounty() * 2)) return 'You waste my time.';
        c.clearBounty(); c.set('lord_bribed');
        c.rumor('They say the Mayor takes cash to pardon criminals.', 'city');
        return 'Consider it forgotten. This conversation never happened.';
      },
      choices: [back],
    },
    island: { text: '[Placeholder] We do not speak of the island. Not yet. (Epilogue hook)', choices: [back] },
  },

  noble: {
    start: {
      text: (c) => c.flag('package_opened') ? 'You opened my package. Get out of my sight.' : c.greet(), common: true,
      choices: [
        { text: 'You look like someone with a job to offer.', if: (c) => !c.quest('delivery') && !c.flag('package_opened'), next: 'offer' },
      ],
    },
    offer: {
      text: 'Perceptive. I need a sealed package delivered to the shopkeeper in the rural zone. Do NOT open it. $40 on delivery.',
      choices: [
        { text: 'I will deliver it.', do: (c) => { c.give('sealed_package'); c.startQuest('delivery'); }, next: 'accepted' },
        { text: 'Not interested.', next: null },
      ],
    },
    accepted: { text: 'Good. The shopkeeper will pay you. Do not disappoint me.', choices: [{ text: 'Goodbye.', next: null }] },
  },

  harbormaster: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'I need passage to the island.', next: 'island' },
        { text: 'What do you do here?', next: 'job' },
      ],
    },
    job: { text: (c) => c.def.job, choices: [back] },
    island: {
      text: () => 'The island? Private property. Rich people. The boat is at the end of the dock, if you are that curious. I never saw you.',
      choices: [
        { text: 'Take me there.', do: (c) => c.travel('island', 'from_city'), next: null },
        back,
      ],
    },
  },

  beggar: {
    start: {
      text: 'Spare some change, friend?', common: true,
      choices: [
        { text: 'Here. ($5)', next: 'give' },
        { text: 'Get a job.', do: (c) => c.addRep('city', -1), next: 'rude' },
      ],
    },
    give: { text: (c) => c.pay(5) ? (c.addRep('city', 2), 'Bless you. Truly.') : 'You have nothing either? Ha. Welcome to the club.', choices: [{ text: 'Goodbye.', next: null }] },
    rude: { text: 'Easy for you to say.', choices: [{ text: 'Goodbye.', next: null }] },
  },

  barber: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'I want a new look. (Haircut $15, dye +10)', next: 'cut' },
        { text: 'What do you do here?', next: 'job' },
      ],
    },
    job: { text: (c) => c.def.job, choices: [back] },
    cut: { text: 'Sit down, sit down. Let us see what we can do.', choices: [{ text: '[Sit in the chair]', do: (c) => c.openBarber() }, back] },
  },

  // the Revolutionaries: 2026 activists who gave up on hashtags and bought rifles (satire; see js/game/revolution.js)
  preacher: {
    start: {
      text: (c) => c.rep('revolutionaries') >= 20 ? 'Comrade! Love the energy today. Did you read the zine I gave you?' : 'Hi! Hi. Do you have a minute to dismantle the system? It takes, like, a minute.',
      common: true,
      choices: [
        { text: 'What system?', next: 'dawn' },
        { text: 'So what is the plan, exactly?', next: 'plan' },
        { text: 'Where do your people gather?', if: (c) => c.rep('revolutionaries') >= 20 && !c.flag('knows_rev_hideout'), next: 'where' },
      ],
    },
    dawn: {
      text: (c) => { if (!c.flag('heard_preacher')) { c.set('heard_preacher'); c.addRep('revolutionaries', 3); } return 'The Government. The Elite. Late-stage capitalism. All of it, it is all connected. We tried petitions. We tried hashtags. We painted a REALLY good mural. Nothing changed. So now we are trying... the other thing.'; },
      choices: [back],
    },
    plan: {
      text: 'Armed revolution! Peacefully, if possible. It will not be possible. The Mayor goes, the Philanthropist and his gala friends go, and then we build a fair, equitable, inclusive society. Participation is mandatory.',
      choices: [{ text: 'Mandatory?', next: 'mandatory' }, back],
    },
    mandatory: { text: 'Everyone is free to agree with us. Disagreeing is just harm with extra steps. There will be workshops.', choices: [back] },
    where: {
      text: 'There is a collective out in the forest ruins. After dark. Bring your own mug, we do not do disposables. And tell no one else.',
      choices: [{ text: 'I will be there.', do: (c) => { c.set('knows_rev_hideout'); c.log('You learned where the revolutionaries meet: the forest ruins, at night.'); }, next: null }],
    },
  },

  rev_leader: {
    start: {
      text: (c) => { c.set('knows_rev_hideout'); return c.rep('revolutionaries') >= 20 ? 'Comrade. The revolution needs you. Also, we are out of oat milk again.' : 'Who let you in? This is a safe space. Hands where I can see them.'; },
      common: true,
      choices: [{ text: 'What are you planning?', next: 'plan' }, { text: 'And after you win?', next: 'after' }],
    },
    plan: { text: 'An armed revolution. The Government and the Elite: the whole oppressive apparatus, gone. We have the numbers, we have the moral clarity, and as of last Tuesday we have rifles. Help us, or get out of the way of history.', choices: [back] },
    after: { text: 'Utopia, obviously. Committees. Committees to oversee the committees. Nobody will ever be wrong again, because being wrong will be illegal. ...What? It is a joke. Mostly.', choices: [back] },
  },
  // ---------------------------------------------------------------- FOREST
  hermit: {
    start: {
      text: (c) => c.greet(), common: true,
      choices: [
        { text: 'Can you treat my wounds? ($10)', next: 'heal' },
        { text: 'How is the forest?', next: 'forest' },
      ],
    },
    heal: { text: (c) => c.pay(10) ? (c.heal(999), 'There. Try not to bleed on my floor next time.') : 'Herbs are not free.', choices: [back] },
    forest: {
      text: (c) => {
        const p = c.w.wildlifeReport('forest');
        if (p.wolf === 0) return 'The wolves are gone. The deer will eat everything now. Balance matters.';
        if (p.deer <= 1) return 'Someone has been hunting the deer to nothing. The wolves grow hungry... and bold.';
        return 'The forest is in balance. For now.';
      },
      choices: [back],
    },
  },

  bandit_boss: {
    start: {
      text: (c) => c.flag('bandits_joined') ? 'Back again, partner?' : 'You are either lost or stupid. Which is it?',
      common: true,
      choices: [
        { text: 'I want to join you.', if: (c) => !c.flag('bandits_joined'), next: 'join' },
        { text: 'Any cut for me?', if: (c) => c.flag('bandits_joined'), next: 'cut' },
        { text: 'Your raids end today.', if: (c) => !c.flag('bandits_joined'), next: 'fight' },
      ],
    },
    join: {
      text: 'Ha! Bold. Fine. You ride with us now. Every few days there is a cut from the raids on the farms. Do not get sentimental.',
      choices: [{ text: 'Deal.', do: (c) => {
        c.set('bandits_joined'); c.addRep('bandits', 70);
        c.log('You joined the bandits.');
        c.rumor('Someone has been seen drinking with the bandits in the forest.', 'forest');
      }, next: null }],
    },
    cut: {
      text: (c) => {
        const last = c.w.flags.bandit_cut_day ?? -99;
        if (c.w.day - last < 3) return 'Too soon. The next raid has not paid out yet.';
        c.set('bandit_cut_day', c.w.day); c.giveGold(50);
        return 'Your share. Fifty bucks. Spend it somewhere the cops will not ask questions.';
      },
      choices: [back],
    },
    fight: { text: 'Then you die here.', choices: [{ text: '[Fight]', do: (c) => c.hostile(), next: null }] },
  },
  bandit: {
    start: {
      text: (c) => c.flag('bandits_joined') ? 'Hey. The boss says you are one of us.' : 'Talk to the boss, or walk away. Your choice.',
      common: true, choices: [],
    },
  },

  // The island's people and their (placeholder) dialogue are in js/data/island.js. The game is endless: there is
  // no ending trigger (EndingScene in js/scenes/overlays.js is kept for the one ending the lore will add later).
};
