'use strict';
// Small talk ("Let's talk."). Each topic is something on the NPC's mind, picked from their personality,
// their relationships, where they live and what has been happening. A topic is never repeated with the
// same person, and the wording is chosen from several variants so different people sound different.
//
//   when(c, P)  -> false, or extra data `x` the lines can use     (P = the NPC's personality)
//   lines:      NPC opening line variants (c, P, x) => text
//   replies:    [{ text, res: [variants], disp, check? }]  — three ways to respond: warm, cold, curious...
//               disp changes how the NPC feels about you; check = [difficulty, stat] for a speech check
//               (res is used on success, fail on failure); do(c, x) runs extra logic
// Lore-specific talk is placeholder-free on purpose: everything here is everyday life.

const first = (c, id) => c.w.npcs[id] ? c.w.npcs[id].realName.split(' ')[0] : 'someone';

G.TOPICS = {
  hobby: {
    lines: [
      (c, P) => `You know what keeps me sane? ${G.util.capitalize(P.hobby)}. Every free minute I get.`,
      (c, P) => `I spent the whole weekend on ${P.hobby}. Best weekend in months.`,
      (c, P) => `People laugh, but I am serious about ${P.hobby}.`,
    ],
    replies: [
      { text: (c, P) => `${G.util.capitalize(P.hobby)}? That is great. Tell me more.`, res: [(c, P) => `Most people just nod. Thanks for actually asking. Maybe we can do some ${P.hobby} sometime.`, () => 'Ha! Careful, I could talk about it for hours.'], disp: 6 },
      { text: 'Sounds boring.', res: [() => 'Wow. Okay. Forget I said anything.', () => 'Well, nobody asked you.'], disp: -6 },
      { text: 'I used to be into that too.', res: [() => 'Really? Then you get it. It is like nothing else matters for a while.', () => 'No way! Small world.'], disp: 4 },
    ],
  },
  worry: {
    lines: [
      (c, P) => `Honestly? I cannot stop worrying about ${P.worry}.`,
      (c, P) => `I have not slept well. It is ${P.worry}. Always ${P.worry}.`,
      (c, P) => `Sorry if I seem distracted. ${G.util.capitalize(P.worry)}... you know how it is.`,
    ],
    replies: [
      { text: 'That sounds hard. It will work out.', res: [() => 'I hope so. Thanks. It helps to say it out loud.', () => 'You are kind. Not many people are, around here.'], disp: 7 },
      { text: 'Everybody has problems.', res: [() => 'Sure. Thanks for nothing.', () => 'Yeah, I guess I should just shut up about it.'], disp: -4 },
      { text: 'Maybe I can help.', res: [() => 'Maybe you can. If you are looking for work, ask me about it.', () => 'Really? Ask me if I have any work for you, then. I might.'], disp: 5, do: (c) => { c.st.wantsHelp = c.w.day; } },
    ],
  },
  dream: {
    lines: [
      (c, P) => `One day I am going to ${P.dream}. Just you watch.`,
      (c, P) => `You ever dream about something? I want to ${P.dream}.`,
    ],
    replies: [
      { text: 'You should go for it.', res: [() => 'You think so? Yeah... maybe I should stop waiting.', () => 'Ha. Maybe I will. Thanks.'], disp: 6 },
      { text: 'Dreams do not pay the bills.', res: [() => 'No. But they get me out of bed in the morning.', () => 'You sound like my father.'], disp: -3 },
      { text: (c) => `${c.tag(6)} Why haven't you done it yet?`, check: [6], res: [() => 'Fear, I guess. Fear and money. Mostly fear. ...Huh. I never admitted that before.'], fail: [() => 'That is none of your business.'], disp: 8, failDisp: -3 },
    ],
  },
  origin: {
    lines: [(c, P) => `I ${P.origin}. Funny how life works out.`, (c, P) => `Me? I ${P.origin}. What about you?`],
    replies: [
      { text: 'I am new around here myself.', res: [() => 'I could tell. Well, welcome. Watch your back after dark.', () => 'Then let me give you some advice: be nice to the people who feed you.'], disp: 4 },
      { text: 'I did not ask for your life story.', res: [() => 'Charming.', () => 'Then why are you talking to me?'], disp: -6 },
      { text: 'Do you ever miss it?', res: [() => 'Every single day.', () => 'Sometimes. Mostly the food.'], disp: 4 },
    ],
  },
  food: {
    lines: [(c, P) => `I am starving. I would kill for some ${P.food} right now.`, (c, P) => `Best thing in the world? ${G.util.capitalize(P.food)}. Fight me.`],
    replies: [
      { text: 'Now I am hungry too.', res: [() => 'Ha! Sorry. Go get yourself something.', () => 'Right? Now we are both suffering.'], disp: 4 },
      { text: 'Gross.', res: [() => 'Your loss.', () => 'Okay, now I know not to trust you.'], disp: -3 },
      { text: 'Where do you get the good stuff?', res: [() => 'Ask around. The vendors know. Everyone knows who makes the best.', () => 'That is a secret I will take to my grave.'], disp: 3 },
    ],
  },
  // about someone they love
  loved_one: {
    when: (c) => G.social.strongest(c.w, c.npc.id, 1),
    lines: [
      (c, P, x) => `Have you met ${first(c, x.id)}? ${G.util.capitalize(G.social.relationWord(c.npc.id, x.id))}. Best person I know.`,
      (c, P, x) => `${first(c, x.id)} has been good to me. I do not say it enough.`,
    ],
    replies: [
      { text: 'You are lucky to have them.', res: [(c, P, x) => `I know. If anything happened to ${first(c, x.id)}...`, () => 'I am. Thanks for saying that.'], disp: 5 },
      { text: 'Nobody is that good.', res: [() => 'You do not know them.', () => 'That is a sad way to see people.'], disp: -4 },
      { text: (c, P, x) => `I will look out for ${first(c, x.id)}.`, res: [() => 'That means a lot.'], disp: 6 },
    ],
  },
  // about someone they cannot stand — can turn into a job
  grudge: {
    when: (c) => G.social.strongest(c.w, c.npc.id, -1),
    lines: [
      (c, P, x) => `Do not get me started on ${first(c, x.id)}. I swear, one of these days...`,
      (c, P, x) => `If ${first(c, x.id)} talks to you, do not believe a word.`,
      (c, P, x) => `${first(c, x.id)}. That name makes my blood boil.`,
    ],
    replies: [
      { text: 'You two should talk it out.', res: [() => 'Talk? I tried talking. Talking does not work with people like that.', () => 'Maybe. Maybe not.'], disp: 1 },
      { text: 'Want me to deal with them?', job: true, res: [(c, P, x) => `...You would do that? No. Forget it. Forget I said anything about ${first(c, x.id)}.`], disp: 4, do: (c, x) => { c.st.grudge = x.id; } },
      { text: 'Sounds like you are the problem.', res: [() => 'Excuse me?! Get lost.', () => 'Wow. Unbelievable.'], disp: -8 },
    ],
  },
  job_talk: {
    when: (c) => c.def.job || c.def.shop,
    lines: [
      (c) => `Work has been ${G.rng.pick(['busy', 'slow', 'a nightmare', 'fine, I guess'])}. ${c.def.shop ? 'People only come in when they want a discount.' : 'Same thing every day.'}`,
      () => 'Some days I love my job. Today is not one of them.',
    ],
    replies: [
      { text: 'Hang in there.', res: [() => 'I will. Thanks.', () => 'What choice do I have?'], disp: 4 },
      { text: 'At least you have a job.', res: [() => 'Yeah, yeah.', () => 'Lucky me.'], disp: -1 },
      { text: 'Need a hand with anything?', res: [() => 'Ask me about work. I could use help.'], disp: 3, do: (c) => { c.st.wantsHelp = c.w.day; } },
    ],
  },
  // the neighborhood they live in
  district: {
    lines: [
      (c) => ({ rural: 'Out here, everyone knows everyone. That is good and bad.', city: 'Downtown never sleeps. Neither do I, thanks to the sirens.', suburbs: 'Nice lawns, nice cars, nice people. Mostly. Behind closed doors, who knows.', southside: 'People talk bad about Southside, but this is home. We look out for each other.', eastside: 'The docks feed half of Eastside. When the ships stop, people get desperate.', heights: 'It is very... exclusive, up here. Not everyone belongs.', forest: 'The forest is quiet. Too quiet, some nights.', island: '...' }[c.scene.map.meta.district || c.region] || 'This place is alright.'),
    ],
    replies: [
      { text: 'I like it here.', res: [() => 'Good. Stick around, then.', () => 'Give it time.'], disp: 4 },
      { text: 'This place is a dump.', res: [() => 'Then leave.', () => 'Nobody is keeping you here.'], disp: -6 },
      { text: 'What should I know about it?', res: [() => 'Stay out of the alleys at night. Be polite. Pay your debts.', () => 'Who is in charge, who is not, and who you never cross.'], disp: 3 },
    ],
  },
  gang_war: {
    when: (c) => c.region === 'city' && Object.values(c.w.territories || {}).some((t) => t.owner),
    lines: [
      (c) => c.w.raid ? `Did you hear the shooting? They are fighting over ${G.TERRITORIES[c.w.raid.territory].name} again.` : 'The gangs are quiet today. That is usually when you should worry.',
      () => 'Red, Blue... I just want to walk to the store without picking a color.',
    ],
    replies: [
      { text: 'Somebody should stop them.', res: [() => 'Somebody. Not me. And not the police, apparently.', () => 'Good luck with that.'], disp: 2 },
      { text: 'Pick a side. It is safer.', res: [() => 'Is it? People who pick sides end up in the ground.', () => 'Spoken like one of them.'], disp: -2 },
      { text: 'Who is winning?', res: [(c) => { const r = G.gangWar.ownedBy(c.w, 'gang_red').length, b = G.gangWar.ownedBy(c.w, 'gang_blue').length; return r > b ? 'The Reds have more blocks right now.' : b > r ? 'The Blues have the upper hand lately.' : 'Nobody. Everybody loses.'; }], disp: 1 },
    ],
  },
  recent_death: {
    when: (c) => { const ids = c.w.deadInRegion(c.region).filter((id) => c.w.dead[id].day >= c.w.day - 5); return ids.length ? { id: ids[ids.length - 1] } : false; },
    lines: [(c, P, x) => `Did you hear about ${c.w.displayName(x.id)}? Dead. Just like that.`, (c, P, x) => `I keep thinking about ${c.w.displayName(x.id)}. Who would do something like that?`],
    replies: [
      { text: 'Terrible news.', res: [() => 'It is. Life is short around here.', () => 'Lock your doors, that is all I can say.'], disp: 3 },
      { text: 'People die every day.', res: [() => 'That is a cold thing to say.', () => 'Wow. You are something else.'], disp: -6 },
      { text: 'Do they know who did it?', res: [(c, P, x) => (c.w.dead[x.id].byPlayer && c.w.dead[x.id].witnessed ? 'People say it was a stranger. Someone who looks a lot like you, actually...' : 'Nobody knows. Or nobody is talking.')], disp: 1 },
    ],
  },
  // reactions to the player
  your_reputation: {
    when: (c) => Math.abs(c.rep(c.region)) >= 25 || c.bounty() > 0,
    lines: [(c) => (c.rep(c.region) >= 25 ? 'People speak well of you around here, you know.' : c.bounty() > 0 ? 'Word is the police are looking for you.' : 'People talk about you. Not nicely.')],
    replies: [
      { text: 'Good to know.', res: [() => 'Just thought you should hear it.'], disp: 2 },
      { text: 'Let them talk.', res: [() => 'Ha. That is the spirit, I guess.', () => 'Brave. Or stupid.'], disp: 0 },
      { text: (c) => `${c.tag(6)} And what do YOU think of me?`, check: [6], res: [(c) => (c.st.disp >= 20 ? 'Honestly? I like you.' : c.st.disp <= -20 ? 'Honestly? I do not trust you.' : 'I have not decided yet.')], fail: [() => 'I would rather not say.'], disp: 3 },
    ],
  },
  your_state: {
    when: (c) => c.p.alcohol >= 30 || G.effects.has(c.p, 'high') || G.effects.has(c.p, 'stim') || G.effects.has(c.p, 'opiate') || G.effects.has(c.p, 'trip'),
    lines: [(c) => (c.p.alcohol >= 30 ? 'Are you drunk? You smell like a bar floor.' : G.effects.has(c.p, 'high') ? 'Your eyes are so red. Rough day, or good day?' : G.effects.has(c.p, 'opiate') ? 'Hey. Hey! Stay awake. Are you okay?' : G.effects.has(c.p, 'trip') ? 'Why are you staring at my face like that?' : 'Whoa, you are twitchy. What are you on?')],
    replies: [
      { text: 'I am fine. Totally fine.', res: [() => 'Sure you are.', () => 'If you say so.'], disp: -1 },
      { text: 'Mind your own business.', res: [() => 'Gladly.', () => 'Fine. Just do not throw up on me.'], disp: -4 },
      { text: 'Maybe I overdid it a little.', res: [() => 'Drink some water. Sit down somewhere. Please do not die in front of me.', () => 'Honesty. I respect that. Take care of yourself.'], disp: 4 },
    ],
  },
  your_weapon: {
    when: (c) => c.p.weaponItem && c.p.weaponItem.gun,
    lines: [(c) => `Is that a ${c.p.weaponItem.name.toLowerCase()}? Do you really need to carry that around?`, () => 'Put the gun away. You are making people nervous.'],
    replies: [
      { text: 'Just for protection.', res: [() => 'That is what they all say.', () => 'Protection from who? Never mind. I do not want to know.'], disp: 0 },
      { text: (c) => `${c.tag(5, 'intimidate')} Do I make YOU nervous?`, check: [5, 'intimidate'], res: [() => 'N-no. No. We are fine. Everything is fine.'], fail: [() => 'Not really. You just look like an idiot.'], disp: -5, do: (c) => { c.st.fear = Math.max(c.st.fear, 40); } },
      { text: 'You are right. Sorry.', res: [() => 'Thank you. It is appreciated.'], disp: 4 },
    ],
  },
  your_looks: {
    lines: [(c) => { const t = c.p.equip.top && G.item(c.p.equip.top); return t ? `Nice ${t.name.toLowerCase()}. Where did you get it?` : 'You look like you have been on the road a long time.'; }],
    replies: [
      { text: 'Thanks! You look good too.', res: [() => 'Oh, stop it. ...Thank you.', () => 'Ha! Flattery will get you everywhere.'], disp: 5 },
      { text: 'Stop looking at me.', res: [() => 'Sorry I said anything.', () => 'Touchy.'], disp: -4 },
      { text: (c) => `${c.tag(7)} I am hard to miss.`, check: [7], res: [() => 'Ha! Confident. I like that.'], fail: [() => '...Okay then.'], disp: 6, failDisp: -2 },
    ],
  },
  night_fear: {
    when: (c) => c.w.isNight() || c.w.hour >= 19,
    lines: [() => 'I should be home already. It gets dangerous after dark.', () => 'Every night I hear something out there. I stopped checking what.'],
    replies: [
      { text: 'Want me to walk you home?', res: [() => 'That is sweet. I will be fine. But thank you.', () => 'Ha. I would rather not be seen with a stranger. No offense.'], disp: 5 },
      { text: 'Scared of the dark?', res: [() => 'Scared of what is in it.', () => 'You will be too, one day.'], disp: -2 },
      { text: 'What do you hear?', res: [() => 'Shouting. Running. Sometimes gunshots. Sometimes nothing, which is worse.'], disp: 2 },
    ],
  },
  money: {
    lines: [() => 'Money is so tight right now. Prices keep going up and my pay does not.', () => 'I counted my savings this morning. Took about two seconds.'],
    replies: [
      { text: (c) => 'Here, take $10.', if: (c) => c.gold() >= 10, res: [() => 'What? No, I could not... okay, I could. Thank you. Really.'], disp: 12, do: (c) => { c.pay(10); } },
      { text: 'Get a better job.', res: [() => 'Wow. Why did I not think of that.', () => 'Thanks for the brilliant advice.'], disp: -5 },
      { text: 'I hear you.', res: [() => 'Everybody does. Nobody does anything.', () => 'At least we are broke together.'], disp: 2 },
    ],
  },
  philosophy: {
    when: (c, P) => P.trait === 'chatty' || P.trait === 'tired' || c.w.hour >= 21,
    lines: [() => 'Do you ever wonder if any of this matters? Work, sleep, work, sleep...', () => 'My grandmother used to say: the city eats the ones who stand still.'],
    replies: [
      { text: 'It matters. You matter.', res: [() => '...Thank you. I needed that.', () => 'Huh. Nobody ever says things like that to me.'], disp: 8 },
      { text: 'Too deep for me.', res: [() => 'Yeah. Forget it.', () => 'Ha, fair enough.'], disp: -1 },
      { text: 'What do you think?', res: [() => 'I think we make it matter. Or we do not.', () => 'I think I need more sleep.'], disp: 3 },
    ],
  },
  joke: {
    when: (c, P) => P.trait === 'cheerful' || P.trait === 'chatty' || P.trait === 'friendly',
    lines: [() => 'Want to hear a joke? Why did the cop bring a ladder to the bar? He heard the drinks were on the house.', () => 'I told my landlord I would pay rent with a smile. He did not laugh either.'],
    replies: [
      { text: 'Ha! That is a good one.', res: [() => 'Right?! I have a million of them.', () => 'Finally, someone with taste.'], disp: 6 },
      { text: 'That was terrible.', res: [() => 'Tough crowd.', () => 'Fine, I will save my material for someone who appreciates it.'], disp: -2 },
      { text: (c) => `${c.tag(6)} I have a better one...`, check: [6], res: [() => 'Ha! Okay, okay. You win.'], fail: [() => '...Was that the joke? Was that the whole thing?'], disp: 5, failDisp: -1 },
    ],
  },
  faction_talk: {
    when: (c) => c.npc.faction.listed && !c.npc.faction.covert,
    lines: [(c) => `Being with the ${c.npc.faction.name} is not just a job. It is family.`, (c) => `People have opinions about the ${c.npc.faction.name}. Most of them are wrong.`],
    replies: [
      { text: 'Respect.', res: [() => 'Good answer.'], disp: 5, do: (c) => c.addRep(c.def.faction, 1) },
      { text: 'Sounds like a cult.', res: [() => 'Watch your mouth.', () => 'Say that again and see what happens.'], disp: -8 },
      { text: 'How did you get in?', res: [() => 'Showed I was loyal. That is all it takes. And that is everything.'], disp: 3 },
    ],
  },
};
for (const id in G.TOPICS) G.TOPICS[id].id = id;
