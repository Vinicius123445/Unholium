'use strict';
(() => {
// Dreams and nightmares while you sleep, modeled on real dreaming:
//   - Most nights you remember nothing, or only a fragment. Long sleeps make longer dreams.
//   - Dreams are scene-shifting and illogical but feel normal while they happen; places are "yours" even
//     when they look nothing like it; people's faces change; text will not stay still; you are someone else.
//   - Common themes (chased, falling, teeth, naked in public, unprepared for a test, can't find a toilet,
//     the phone will not dial, rooms you never knew your house had, flying, the dead visiting...).
//   - The day leaks in: people you know, your partner, your baby, the people you killed, jail, drowning.
//   - The body leaks in: thirst, hunger, pregnancy. Alcohol suppresses dreaming (then a vivid rebound),
//     cannabis mutes dreams but quitting brings intensely vivid ones; withdrawal and guilt bring nightmares.
//   - Rarely, you realize you are dreaming (lucid), and you can fly.
// Nightmares can wake you early (less rest, "Shaken"); good dreams leave you "Well Rested".

G.EFFECTS.shaken = { name: 'Shaken', kind: 'buff', bad: true, color: '#9a6ac8', stats: { charisma: -1 }, desc: 'A bad dream is still clinging to you.' };
G.EFFECTS.well_rested = { name: 'Well Rested', kind: 'buff', color: '#f0d890', stats: { staminaRegen: 0.3, charisma: 1 }, desc: 'You slept well and dreamed of good things.' };

// Places a dream can happen. ground: tile texture; props: decor sprites scattered around
const SETTINGS = {
  school:   { ground: 'tilefloor', wall: 'wall_brick', props: ['desk', 'desk', 'chair', 'chair', 'shelf'], tint: '#d8d0ff', line: ['Your old school. The hallways are longer than they used to be.', 'A classroom. Everyone is already sitting down. They are all looking at you.'] },
  house:    { ground: 'woodfloor', wall: 'wall_plaster', props: ['bed', 'couch', 'tv', 'shelf', 'table', 'fridge'], tint: '#ffe0c0', line: ['Your house. It is definitely your house, even though it looks nothing like it.', 'The house you grew up in. The furniture is wrong. Everything smells like it did back then.'] },
  beach:    { ground: 'sand', wall: null, props: ['rock', 'tent', 'boulder'], water: 'water', tint: '#ffe8b0', line: ['A beach at sunset. The sand is warm. You do not remember arriving.', 'The ocean, very close. The waves are slow, like they are thinking.'] },
  street:   { ground: 'asphalt', wall: null, props: ['lamp', 'car_black', 'trashcan', 'hydrant', 'lamp'], tint: '#a0b0ff', line: ['A city street at night. Every window is lit, but nobody is home.', 'Downtown, but the streets loop back on themselves.'] },
  forest:   { ground: 'grass', wall: null, props: ['pine0', 'pine1', 'oak0', 'oak1', 'pine0', 'bush'], tint: '#a8e0b0', line: ['A forest. The trees are taller than buildings.', 'The woods behind the house. It is getting dark between the trees.'] },
  mall:     { ground: 'tilefloor', wall: 'wall_concrete', props: ['shelf', 'cooler', 'shelf', 'plant', 'cooler', 'counter'], tint: '#f0f0ff', line: ['A shopping mall, closed for the night. The music is still playing.', 'A supermarket with endless aisles. You came here for something. You cannot remember what.'] },
  hospital: { ground: 'tilefloor', wall: 'wall_plaster', props: ['bed', 'bed', 'sink', 'plant'], tint: '#d8fff0', line: ['A hospital corridor. The lights hum.', 'A waiting room. Your name is called, but in a voice you do not recognize.'] },
  airport:  { ground: 'tilefloor', wall: 'wall_concrete', props: ['chair', 'chair', 'chair', 'vending', 'plant'], tint: '#e0f0ff', line: ['An airport. Your flight is boarding. You do not have your ticket.', 'A departure gate. The board says your flight leaves in two minutes. Then one minute. Then it is gone.'] },
  ocean:    { ground: 'deepwater', wall: null, props: [], tint: '#7090ff', line: ['Open water in every direction. Dark, and very deep.', 'You are underwater, somehow breathing. Then, suddenly, not.'] },
  jail:     { ground: 'concrete', wall: 'wall_concrete', props: ['bed_red', 'toilet', 'sink'], tint: '#c0c0c8', line: ['A cell. The door was open a second ago.', 'The County Jail, but it goes down floor after floor after floor.'] },
  farm:     { ground: 'wheat', wall: null, props: ['haybale', 'haybale', 'trough'], tint: '#fff0a0', line: ['A wheat field under a huge sky. Somewhere, a radio is playing a song you love.', 'The farm. The animals are all watching you. One of them clears its throat.'] },
  stairs:   { ground: 'stonefloor', wall: null, props: ['stairs_up', 'stairs_up', 'stairs_up', 'stairs_up'], tint: '#d0c0ff', line: ['Stairs. Only stairs, going up. You have been climbing for hours.', 'A staircase that keeps adding steps under your feet.'] },
  void:     { ground: null, wall: null, props: [], tint: '#ffffff', line: ['...', 'Nothing. A soft nothing.'] },
};

const CLOTHES = ['a wedding dress', 'your old school uniform', 'a tuxedo', 'pajamas', 'a police uniform', 'nothing at all', 'a hospital gown', 'a clown costume', 'your grandfather\'s coat', 'a swimsuit', 'a business suit, three sizes too big'];

G.dreams = {
  // every dream theme has a part you play
  PLAY: {
    chase: 'chase', falling: 'fall', teeth: 'collect', naked: 'search', exam: 'search', rooms: 'search', phone: 'collect', toilet: 'search',
    thirst: 'collect', feast: 'collect', flying: 'fly', money: 'collect', love: 'walk', cheat: 'chase', visit: 'walk', guilt: 'chase',
    jailed: 'search', drown: 'swim', paralysis: 'struggle', baby: 'search', bugs: 'collect', late: 'search', animals: 'walk', lsd: 'fly',
  },
  // a dream of one particular kind (debug menu, tests)
  themed(g, id) {
    const c = this.context(g), t = this.THEMES.find((x) => x.id === id) || this.THEMES[0];
    return { scenes: [{ theme: t.id, set: G.rng.pick(t.set), beats: t.beats(c), body: this.dreamBody(c) }], mood: t.mood, lucid: false, wake: 0, title: t.id };
  },
  // Everything about the day and the body that leaks into dreams.
  context(g) {
    const w = g.world, p = g.player;
    const names = (ids) => ids.filter((id) => w.npcs[id]).map((id) => w.displayName(id));
    const partner = G.romance.partner(w);
    const contacts = G.phone.contacts(w);
    const dead = Object.keys(w.npcs).filter((id) => !w.npcs[id].alive && G.NPCS[id] && !G.NPCS[id].transient);
    const killed = dead.filter((id) => w.dead[id] && w.dead[id].byPlayer).slice(-5);
    const babies = (w.babies || []).filter((b) => (b.mother === 'player' || b.father === 'player') && b.name);
    const s = G.effects.drugState(p);
    return {
      w, p,
      partner: partner && w.displayName(partner),
      friend: G.rng.pick(names(contacts)) || null,
      deadName: G.rng.pick(names(dead.filter((id) => (w.npcs[id].disp || 0) > 20))) || null,
      victim: G.rng.pick(names(killed)) || (w.stats.kills > 0 ? 'someone you hurt' : null),
      baby: babies.length ? G.rng.pick(babies).name : null,
      pregnant: !!(p.preg && p.preg.known),
      jail: !!w.jail || (w.flags.jailed_before),
      killer: (w.stats.kills || 0) > 0,
      drank: p.alcohol > 25,
      thirsty: (p.thirst || 0) > 55, hungry: (p.hunger || 0) > 55,
      weedQuit: (s.addiction.cannabis || 0) > 20 && (s.load.cannabis || 0) < 5,
      weed: (s.load.cannabis || 0) > 10,
      withdrawal: G.effects.has(p, 'wd_opioid') || p.effects.some((e) => G.EFFECTS[e.id].kind === 'withdrawal'),
      tripping: G.effects.has(p, 'trip'),
      bounty: (w.bounty[g.region] || 0) > 0,
      broke: p.gold < 20, rich: p.gold > 1500,
      lowHp: p.hp < p.maxHp * 0.4,
      strangeBed: !!g.strangeBed,
      luck: G.skills.stat(p, 'luck') || 0,
      place: g.map.meta.name,
    };
  },

  // Themes: weight(c) (0 = impossible tonight), mood, settings, and the beats (sentences) of the dream.
  THEMES: [
    { id: 'chase', mood: 'nightmare', w: (c) => 3 + (c.bounty ? 3 : 0) + (c.withdrawal ? 2 : 0), set: ['street', 'forest', 'house', 'mall'], beats: (c) => [
      'Something is following you. You never get a good look at it. You just know.',
      'You run, but your legs are so heavy. It is like running through syrup.',
      c.bounty ? 'Sirens. The police are chasing you, but they all have your face.' : 'You hide behind a door, but the door has no handle on your side.',
      'It is right behind you. You can hear it breathing—'] },
    { id: 'falling', mood: 'nightmare', w: (c) => 3, set: ['stairs', 'street', 'void'], beats: () => [
      'You are standing at the edge of something very high.',
      'You step forward without meaning to.',
      'Falling. Your stomach drops. The ground is coming up fast—'] },
    { id: 'teeth', mood: 'weird', w: (c) => 2 + (c.broke ? 2 : 0), set: ['house', 'school', 'mall'], beats: () => [
      'Something is wrong with your mouth.',
      'You touch a tooth and it comes loose. Then another. They come out like seeds.',
      'You hold them in your hands and try to push them back in. Nobody else seems to notice.'] },
    { id: 'naked', mood: 'weird', w: (c) => 2, set: ['school', 'mall', 'street', 'airport'], beats: () => [
      'Everyone is staring at you.',
      'You look down. You are completely naked. You have been the whole time.',
      'You try to cover yourself with a newspaper. The newspaper is about you.'] },
    { id: 'exam', mood: 'weird', w: (c) => 2, set: ['school'], beats: () => [
      'You are back in school. There is a test today. You did not know.',
      'You turn the paper over. The questions are in a language that looks almost like yours.',
      'You never went to this class. Not once. All semester.'] },
    { id: 'rooms', mood: 'weird', w: (c) => 3, set: ['house'], beats: (c) => [
      'You are home. You open a door you have never noticed before.',
      'Behind it there are more rooms. Whole wings of the house. Dusty furniture, a piano, a swimming pool.',
      c.deadName ? `${c.deadName} is in one of the rooms, reading. They look up and smile like nothing happened.` : 'How did you live here all this time and never know?'] },
    { id: 'phone', mood: 'weird', w: (c) => 2, set: ['street', 'house', 'airport'], beats: (c) => [
      `You need to call ${c.partner || c.friend || 'someone'}. It is urgent.`,
      'You dial. The numbers on the screen keep changing. You dial again. Wrong again.',
      'Finally it rings. Somebody picks up. It is your own voice.'] },
    { id: 'toilet', mood: 'weird', w: (c) => (c.drank || c.thirsty ? 6 : 1), set: ['mall', 'school', 'airport'], beats: () => [
      'You really need to find a bathroom.',
      'Every bathroom door opens onto another hallway. Or a closet. Or a busy restaurant.',
      'You find one. It has no walls.'] },
    { id: 'thirst', mood: 'weird', w: (c) => (c.thirsty ? 6 : 0), set: ['beach', 'farm'], beats: () => [
      'You are so thirsty.',
      'You drink from a fountain, a glass, a river. It does nothing. Your mouth stays dry.',
      'The water tastes like sand.'] },
    { id: 'feast', mood: 'good', w: (c) => (c.hungry ? 6 : 1), set: ['house', 'farm'], beats: () => [
      'A long table, covered in food. Your grandmother\'s cooking. Burgers from the diner. Cake.',
      'You eat and eat and it never runs out.',
      'Everyone you love is at the table, passing plates.'] },
    { id: 'flying', mood: 'good', w: (c) => 2 + c.luck, set: ['street', 'forest', 'beach', 'farm'], beats: () => [
      'You jump, and you just... keep going up.',
      'The town is tiny below you. The wind is warm. You are not afraid at all.',
      'You always knew you could do this. How did you forget?'] },
    { id: 'money', mood: 'good', w: (c) => 1 + (c.broke ? 3 : 0) + c.luck, set: ['street', 'house', 'mall'], beats: () => [
      'You find a bill on the sidewalk. Then another. Then a whole drawer full of cash.',
      'You stuff your pockets. It keeps coming.',
      'You count it. The number keeps changing. It is a lot, though. That you know.'] },
    { id: 'love', mood: 'good', w: (c) => (c.partner ? 4 : 1), set: ['beach', 'house', 'forest'], beats: (c) => [
      c.partner ? `${c.partner} is holding your hand.` : 'Someone is holding your hand. You cannot see their face, but you know them.',
      'You are not saying anything. You do not need to.',
      'It feels like a summer afternoon that will never end.'] },
    { id: 'cheat', mood: 'nightmare', w: (c) => (c.partner ? 3 : 0), set: ['house', 'street'], beats: (c) => [
      `${c.partner} is acting strange.`,
      `You follow them. They meet someone. They laugh with them like they never laugh with you.`,
      'You shout, but no sound comes out. They do not even turn around.'] },
    { id: 'visit', mood: 'good', w: (c) => (c.deadName ? 4 : 0), set: ['house', 'farm', 'void'], beats: (c) => [
      `${c.deadName} is here. Alive. They look well.`,
      'You want to tell them they died. You decide not to.',
      'They say something important. You will not remember it when you wake up. Only that it was kind.'] },
    { id: 'guilt', mood: 'nightmare', w: (c) => (c.killer ? 3 + (c.victim ? 3 : 0) : 0), set: ['street', 'house', 'void'], beats: (c) => [
      `${c.victim} is standing at the end of the street.`,
      'They are not angry. They just keep looking at you.',
      'You wash your hands. The water will not run clear.',
      'Everywhere you go, they are already there, waiting.'] },
    { id: 'jailed', mood: 'nightmare', w: (c) => (c.jail ? 4 : 1), set: ['jail'], beats: () => [
      'You are back in the cell.',
      'You do not know what you did. Your sentence is "forever and a day".',
      'Every time you get to the gate, it is the cell again.'] },
    { id: 'drown', mood: 'nightmare', w: (c) => 1 + (c.p.drownScare ? 4 : 0), set: ['ocean'], beats: () => [
      'You are in deep water. You cannot see the bottom.',
      'You try to swim, but your arms move so slowly.',
      'Something brushes against your leg.'] },
    { id: 'paralysis', mood: 'nightmare', w: (c) => 1 + (c.withdrawal ? 3 : 0) + (c.strangeBed ? 2 : 0), set: ['void'], beats: () => [
      'You wake up in bed. Except you cannot move. Not a finger.',
      'There is someone standing at the foot of the bed. Tall. Very still.',
      'You try to scream. Your mouth will not open.',
      'It leans closer—'] },
    { id: 'baby', mood: 'weird', w: (c) => (c.pregnant ? 6 : c.baby ? 3 : 0), set: ['house', 'mall', 'hospital'], beats: (c) => [
      c.pregnant ? 'You give birth. It does not hurt. The baby is the size of a cat and can already talk.' : `${c.baby} is with you, but much older. They call you by your full name.`,
      'You put the baby down for a second in the supermarket. When you turn around, the aisle is endless.',
      'You run up and down the aisles calling. You find them sitting on a shelf, perfectly calm, eating cereal.'] },
    { id: 'bugs', mood: 'nightmare', w: (c) => (c.withdrawal ? 6 : 0), set: ['house', 'void'], beats: () => [
      'Your skin itches. Something is moving under it.',
      'You scratch and scratch. The walls are breathing.',
      'You are cold and sweating at the same time. You need it. You need it.'] },
    { id: 'late', mood: 'weird', w: (c) => 2, set: ['airport', 'street', 'school'], beats: (c) => [
      'You are late. You do not know for what, but it is important.',
      'Your car will not start. Your shoes are on the wrong feet. The clock jumps forward an hour.',
      `${c.friend ? c.friend + ' is waiting' : 'Everyone is waiting'}, and you are still in your pajamas.`] },
    { id: 'animals', mood: 'weird', w: (c) => 1, set: ['farm', 'forest'], beats: () => [
      'A deer walks up to you and asks for directions.',
      'You tell it, and it thanks you politely. A wolf apologizes for something it did years ago.',
      'This all makes complete sense.'] },
    { id: 'lsd', mood: 'weird', w: (c) => (c.tripping ? 10 : 0), set: ['void', 'forest'], beats: () => [
      'The colors have sounds. Green hums.',
      'Your hands are made of tiny, polite birds.',
      'You understand everything. Then you forget the word for "everything".'] },
  ],

  pick(list, c) {
    const total = list.reduce((s, t) => s + Math.max(0, t.w(c)), 0);
    let r = Math.random() * total;
    for (const t of list) { r -= Math.max(0, t.w(c)); if (r <= 0) return t; }
    return list[0];
  },

  // How (or whether) you dream tonight. Returns null for a dreamless night.
  make(g, hours) {
    const c = this.context(g);
    let none = 0.35;
    if (c.drank) none += 0.25;               // alcohol suppresses REM
    if (c.weed) none += 0.3;                 // cannabis mutes dream recall
    if (c.weedQuit || c.withdrawal || c.pregnant) none -= 0.3;   // rebound: vivid dreams
    if (hours < 4) none += 0.25;
    if (Math.random() < Math.max(0.05, none)) return null;
    const scenes = [];
    const length = Math.max(1, Math.min(3, Math.floor(hours / 3) + (c.weedQuit || c.pregnant ? 1 : 0)));
    let mood = 'weird';
    for (let i = 0; i < length; i++) {
      const t = this.pick(this.THEMES, c);
      if (t.mood === 'nightmare') mood = 'nightmare'; else if (t.mood === 'good' && mood !== 'nightmare') mood = 'good';
      const set = G.rng.pick(t.set);
      scenes.push({ theme: t.id, set, beats: t.beats(c), body: this.dreamBody(c) });
    }
    // a fragment only: often you remember just one image
    if (Math.random() < 0.1) { scenes.length = 1; scenes[0].beats = scenes[0].beats.slice(0, 1).concat(['...and then it slips away.']); }
    const lucid = Math.random() < 0.04 + c.luck * 0.01;
    if (lucid) { scenes[scenes.length - 1].beats.push('Wait. You know this is a dream.', 'You lift off the ground and fly, laughing, over everything.'); if (mood === 'nightmare') mood = 'weird'; }
    const wake = mood === 'nightmare' && Math.random() < 0.6 ? G.rng.int(2, Math.max(2, hours - 2)) : 0;
    return { scenes, mood, lucid, wake, title: scenes.map((s) => s.theme).join(', ') };
  },
  // You, as the dream shows you: yourself in strange clothes, someone else entirely, or not seen at all.
  dreamBody(c) {
    const r = Math.random();
    if (r < 0.12) return null;   // first person: you never see yourself
    if (r < 0.4) { const seed = 'dream' + Math.floor(Math.random() * 1e6); return { look: G.look(seed), note: 'You are someone else. It feels completely normal.' }; }
    const look = Object.assign({}, c.p.currentLook());
    const outfit = G.rng.pick(CLOTHES);
    const L = G.LOOK_PALETTE;
    Object.assign(look, { shirt: G.rng.pick(L.SHIRTS), shirt2: G.rng.pick(L.SHIRTS), pants: G.rng.pick(L.PANTS), top: G.rng.pick(['shirt', 'jacket', 'vest', 'hoodie', 'dress', 'robe']), bottom: G.rng.pick(['pants', 'shorts', 'skirt']), armor: null });
    if (outfit === 'nothing at all') look.naked = true;
    if (Math.random() < 0.25) look.hair = G.rng.pick(L.HAIRS);
    return { look, note: `You are wearing ${outfit}.` };
  },
  remember(g, dream) {
    const w = g.world;
    (w.dreams = w.dreams || []).push({ day: w.day, mood: dream.mood, text: dream.scenes.map((s) => s.beats[0]).join(' / ') });
    if (w.dreams.length > 40) w.dreams.shift();
  },
};

// ---------------------------------------------------------------- the dream itself
class DreamScene {
  constructor(game, dream, done) {
    this.game = game; this.dream = dream; this.done = done;
    this.si = 0; this.bi = 0; this.t = 0; this.chars = 0; this.fade = 0;
    this.buildScene();
  }
  get scene() { return this.dream.scenes[this.si]; }
  buildScene() {
    const s = SETTINGS[this.scene.set] || SETTINGS.void;
    const W = 320, H = 180, { c, x } = G.assets.mk(W, H);
    if (s.ground) {
      const t = G.assets.tile(s.ground, 0);
      for (let yy = 0; yy < H; yy += 16) for (let xx = 0; xx < W; xx += 16) if (t) x.drawImage(G.assets.tile(s.ground, (xx + yy) % 3) || t, xx, yy);
    } else { x.fillStyle = '#05040a'; x.fillRect(0, 0, W, H); }
    if (s.water) { const t = G.assets.tile(s.water, 0); for (let xx = 0; xx < W; xx += 16) for (let yy = 0; yy < 48; yy += 16) if (t) x.drawImage(t, xx, yy); }
    if (s.wall) { const t = G.assets.tile(s.wall, 0); for (let xx = 0; xx < W; xx += 16) if (t) { x.drawImage(t, xx, 0); x.drawImage(t, xx, 16); } }
    const props = [];
    for (let i = 0; i < 9 && s.props.length; i++) props.push({ spr: G.assets.sprites[G.rng.pick(s.props)], x: G.rng.int(20, W - 20), y: G.rng.int(50, H - 10) });
    props.sort((a, b) => a.y - b.y);
    for (const p of props) if (p.spr) x.drawImage(p.spr.img, p.x - p.spr.ax, p.y - p.spr.ay);
    this.bg = c;
    this.body = this.scene.body && G.assets.character(this.scene.body.look);
    // faceless strangers or people you know
    this.figures = [];
    const n = this.scene.set === 'void' ? 0 : G.rng.int(0, 3);
    for (let i = 0; i < n; i++) {
      const look = G.look('dreamfig' + Math.floor(Math.random() * 1e6));
      if (Math.random() < 0.5) { look.eyes = look.skin; look.hair = G.rng.pick(['#111', look.hair]); }   // no face
      this.figures.push({ sheet: G.assets.character(look), x: G.rng.int(30, 290), y: G.rng.int(90, 160) });
    }
  }
  beatText() {
    const b = this.scene.beats;
    if (this.bi === 0 && this.scene.body && this.si === 0) return b[0] + ' ' + this.scene.body.note;
    return b[this.bi];
  }
  // ---- the parts you play (a few seconds of control, then the dream goes on) ----
  startPlay(kind) {
    const r = () => Math.random();
    this.play = { kind, t: 0, x: 160, y: 130, items: [], doors: [], shadow: { x: 20, y: 40 }, limit: { chase: 14, fly: 18, search: 20, swim: 15, collect: 15, walk: 16, fall: 12, struggle: 12 }[kind], obstacles: [], meter: 0, target: { x: 160 + (r() - 0.5) * 200, y: 40 + r() * 40 } };
    const P = this.play;
    if (kind === 'fly' || kind === 'collect') for (let i = 0; i < 6; i++) P.items.push({ x: 30 + r() * 260, y: 20 + r() * 130, got: false });
    if (kind === 'search') { for (let i = 0; i < 4; i++) P.doors.push({ x: 40 + i * 75 + r() * 20, y: 40 + r() * 60 }); P.right = Math.floor(r() * 4); }
    if (kind === 'swim') P.y = 165;
    if (kind === 'fall') { P.y = 50; }
    if (kind === 'struggle') { P.x = 160; P.y = 110; P.shadow = { x: 160, y: 20 }; }
  }
  updatePlay(dt) {
    const P = this.play, I = G.input;
    P.t += dt;
    const sp = { chase: 55, swim: 40, struggle: 0 }[P.kind] ?? 85;
    let mx = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0), my = (I.isDown('down') ? 1 : 0) - (I.isDown('up') ? 1 : 0);
    const n = Math.hypot(mx, my) || 1;
    P.x = G.util.clamp(P.x + (mx / n) * sp * dt, 8, 312); P.y = G.util.clamp(P.y + (my / n) * sp * dt, 12, 172);
    P.moving = !!(mx || my);
    let end = null;
    if (P.kind === 'chase' || P.kind === 'struggle') {
      const s = P.shadow, d = Math.hypot(P.x - s.x, P.y - s.y) || 1, v = 38 + P.t * 2.6;
      s.x += ((P.x - s.x) / d) * v * dt; s.y += ((P.y - s.y) / d) * v * dt;
      if (d < 10) end = ['It catches you. Cold hands on your shoulders—', false];
      else if (P.t >= P.limit) end = ['You turn a corner and it is gone. You lost it.', true];
    } else if (P.kind === 'fly' || P.kind === 'collect') {
      for (const it of P.items) if (!it.got && Math.hypot(it.x - P.x, it.y - P.y) < 12) { it.got = true; G.audio.play('pickup'); }
      if (P.items.every((it) => it.got)) end = [P.kind === 'fly' ? 'You laugh as the wind carries you higher than the clouds.' : 'Your pockets are full. You are rich. You are so rich.', true];
      else if (P.t >= P.limit) end = [P.kind === 'fly' ? 'You start to sink. Gently. Back down to the ground.' : 'The money turns into leaves in your hands.', null];
    } else if (P.kind === 'search') {
      const hit = P.doors.findIndex((d) => Math.hypot(d.x - P.x, d.y - P.y) < 12);
      if (hit === P.right) end = ['Behind this door is a room you remember from when you were small. Everything is exactly where you left it.', true];
      else if (hit >= 0 && !P.tried) { P.tried = true; G.audio.play('door'); this.fade = 0.5; P.x = 160; P.y = 140; }
      else if (hit >= 0 && P.tried && hit !== P.lastHit) { G.audio.play('door'); this.fade = 0.5; P.x = 160; P.y = 140; }
      if (hit >= 0) P.lastHit = hit;
      if (!end && P.t >= P.limit) end = ['Every door opens onto the same hallway. Again. And again.', null];
    } else if (P.kind === 'swim') {
      P.y = Math.min(172, P.y + 24 * dt);   // the deep pulls at you
      if (P.y <= 18) end = ['You break the surface, gasping for air.', true];
      else if (P.t >= P.limit) end = ['Your lungs burn. The light above gets farther away—', false];
    }
    if (P.kind === 'walk') {
      const tg = P.target, d = Math.hypot(tg.x - P.x, tg.y - P.y) || 1;
      tg.x = G.util.clamp(tg.x + ((tg.x - P.x) / d) * 18 * dt + Math.sin(P.t * 2) * 10 * dt, 20, 300); tg.y = G.util.clamp(tg.y + ((tg.y - P.y) / d) * 12 * dt, 20, 160);
      if (d < 12) end = ['You reach them at last. They hold you, and everything is warm.', true];
      else if (P.t >= P.limit) end = ['They fade before you can get there.', null];
    } else if (P.kind === 'fall') {
      P.y = 50;
      if (Math.random() < dt * 2.2) P.obstacles.push({ x: 20 + Math.random() * 280, y: 190, w: 30 + Math.random() * 50 });
      for (const o of P.obstacles) { o.y -= 110 * dt; if (Math.abs(o.y - P.y) < 6 && P.x > o.x - o.w / 2 - 4 && P.x < o.x + o.w / 2 + 4) end = ['You hit something hard— and wake with a jerk.', false]; }
      P.obstacles = P.obstacles.filter((o) => o.y > -10);
      if (!end && P.t >= P.limit) end = ['The ground never comes. You land softly in your own bed.', true];
    } else if (P.kind === 'struggle') {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => I.pressed.has(k))) P.meter += 0.07;
      P.meter = Math.max(0, P.meter - dt * 0.12);
      P.shadow.y += (P.y - 20 - 10) / P.limit * dt;
      if (P.meter >= 1) end = ['You tear yourself free and sit up, gasping. The room is empty.', null];
      else if (P.t >= P.limit) end = ['It is right over you now. You cannot even scream—', false];
    }
    if (G.input.wasPressed('cancel')) end = ['You force yourself awake.', false];
    if (end) {
      const [text, good] = end;
      this.play = null;
      this.scene.played = true;
      this.scene.beats.splice(this.bi, 0, text);
      if (good === true && this.dream.mood !== 'nightmare') this.dream.mood = 'good';
      if (good === false) { this.dream.mood = 'nightmare'; this.scene.beats.length = this.bi + 1; this.dream.scenes.length = this.si + 1; this.dream.wake = this.dream.wake || 1; }
      this.chars = 0;
    }
  }
  drawPlay(ctx, ox, oy, scale) {
    const P = this.play, s = (x, y) => [ox + x * scale, oy + y * scale];
    if (P.kind === 'chase' || P.kind === 'struggle') {
      const [x, y] = s(P.shadow.x, P.shadow.y);
      ctx.fillStyle = 'rgba(5,0,10,0.9)'; ctx.beginPath(); ctx.ellipse(x, y - 14 * scale, 7 * scale, 9 * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 8 * scale, y - 8 * scale, 16 * scale, 14 * scale);
      ctx.fillStyle = '#ff2a2a'; ctx.fillRect(x - 3 * scale, y - 16 * scale, 2 * scale, 1.5 * scale); ctx.fillRect(x + 2 * scale, y - 16 * scale, 2 * scale, 1.5 * scale);
    }
    for (const it of P.items) if (!it.got) { const [x, y] = s(it.x, it.y + Math.sin(this.t * 3 + it.x) * 3); ctx.fillStyle = P.kind === 'fly' ? '#fff0a0' : '#5ac05a'; ctx.fillRect(x - 3 * scale, y - 3 * scale, 6 * scale, (P.kind === 'fly' ? 6 : 4) * scale); }
    P.doors.forEach((d, i) => { const [x, y] = s(d.x, d.y); ctx.fillStyle = '#5a2e14'; ctx.fillRect(x - 6 * scale, y - 14 * scale, 12 * scale, 18 * scale); ctx.fillStyle = i === P.right ? `rgba(255,230,150,${0.15 + Math.sin(this.t * 2) * 0.1})` : '#8a4a2a'; ctx.fillRect(x - 5 * scale, y - 13 * scale, 10 * scale, 16 * scale); ctx.fillStyle = '#e8c040'; ctx.fillRect(x + 2 * scale, y - 5 * scale, 1.5 * scale, 1.5 * scale); });
    if (P.kind === 'swim') { ctx.fillStyle = 'rgba(180,220,255,0.35)'; ctx.fillRect(ox, oy, 320 * scale, 14 * scale); }
    if (P.kind === 'walk') { const [x, y] = s(P.target.x, P.target.y); const gl = ctx.createRadialGradient(x, y - 8 * scale, 0, x, y - 8 * scale, 22 * scale); gl.addColorStop(0, 'rgba(255,240,200,0.8)'); gl.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 22 * scale, y - 30 * scale, 44 * scale, 44 * scale); ctx.fillStyle = 'rgba(40,30,50,0.85)'; ctx.fillRect(x - 4 * scale, y - 16 * scale, 8 * scale, 16 * scale); ctx.beginPath(); ctx.arc(x, y - 18 * scale, 4 * scale, 0, Math.PI * 2); ctx.fill(); }
    if (P.kind === 'fall') { ctx.fillStyle = '#3a2e26'; for (const o of P.obstacles) { const [x, y] = s(o.x - o.w / 2, o.y); ctx.fillRect(x, y, o.w * scale, 5 * scale); } for (let k = 0; k < 12; k++) { const [x, y] = s((k * 53 + P.t * 7) % 320, (k * 37 - P.t * 160) % 180 + 180); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, 1 * scale, 8 * scale); } }
    if (P.kind === 'struggle') { const [bx, by] = s(160, 118); ctx.fillStyle = '#4a6aa8'; ctx.fillRect(bx - 14 * scale, by - 20 * scale, 28 * scale, 26 * scale); ctx.fillStyle = '#1a1620'; ctx.fillRect(ox + 40 * scale, oy + 165 * scale, 240 * scale, 6 * scale); ctx.fillStyle = '#e8c86a'; ctx.fillRect(ox + 40 * scale, oy + 165 * scale, 240 * scale * Math.min(1, P.meter), 6 * scale); }
    const sheet = this.body || this.game.player.sheet, f = P.moving ? Math.floor(this.t * 8) % 3 : 0;
    const [ax, ay] = s(P.x, P.y);
    ctx.drawImage(sheet.img, f * sheet.fw, 0, sheet.fw, sheet.fh, ax - (sheet.fw / 2) * scale, ay - sheet.fh * scale, sheet.fw * scale, sheet.fh * scale);
    const R = G.renderer;
    R.uiTransform();
    const hint = { chase: 'RUN', fly: 'Catch the lights', search: 'Which door?', swim: 'Swim up', collect: 'Grab it', walk: 'Go to them', fall: 'Dodge', struggle: 'Fight it' }[P.kind];   // (few words: js/game/dreamhd.js)
    if (P.t < 4) { ctx.globalAlpha = Math.min(1, 4 - P.t); G.ui.text(ctx, hint, R.uiW / 2, 12, { align: 'center', size: 9, color: '#ffffff' }); ctx.globalAlpha = 1; }
  }

  advance() {
    const text = G.i18n.t(this.beatText());
    if (this.chars < text.length) { this.chars = text.length; return; }
    this.chars = 0; this.bi++;
    const PLAY = G.dreams.PLAY;
    if (this.bi === 1 && PLAY[this.scene.theme] && !this.scene.played && !this.noPlay) { this.startPlay(PLAY[this.scene.theme]); return; }
    if (this.bi >= this.scene.beats.length) {
      this.bi = 0; this.si++;
      if (this.si >= this.dream.scenes.length) { this.finish(); return; }
      this.fade = 1;   // the scene shifts without warning
      this.buildScene();
    }
  }
  finish() {
    G.scenes.remove(this);
    if (this.done) this.done();
  }
  update(dt) {
    const I = G.input;
    this.t += dt;
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 1.2);
    if (this.play) { this.updatePlay(dt); return; }
    this.chars += dt * 38;
    if (this.chars > this.beatText().length + 70) this.advance();   // moves on by itself, slowly
    if (I.wasPressed('confirm') || I.wasPressed('interact') || G.input.mouse.pressed) this.advance();
    if (I.wasPressed('cancel')) this.finish();
  }
  render(ctx) {
    const R = G.renderer, U = G.ui, mood = this.dream.mood, s = SETTINGS[this.scene.set] || SETTINGS.void;
    R.screenTransform();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, R.W, R.H);
    // the dream image, drawn in wavy slices (nothing holds still)
    const scale = Math.min(R.W / 320, R.H / 180) * 0.92, iw = 320 * scale, ih = 180 * scale, ox = (R.W - iw) / 2, oy = (R.H - ih) / 2 - 20;
    ctx.imageSmoothingEnabled = false;
    const wob = mood === 'nightmare' ? 4 : 2.5;
    for (let y = 0; y < 180; y += 2) {
      const off = Math.sin(this.t * 1.3 + y * 0.06) * wob;
      ctx.drawImage(this.bg, 0, y, 320, 2, ox + off * scale, oy + y * scale, iw, 2 * scale);
    }
    const drawSheet = (sheet, x, y, flip) => {
      const f = Math.floor(this.t * 3) % 3, dir = flip ? 2 : 0;
      ctx.drawImage(sheet.img, f * sheet.fw, dir * sheet.fh, sheet.fw, sheet.fh, ox + (x - sheet.fw / 2) * scale, oy + (y - sheet.fh) * scale, sheet.fw * scale, sheet.fh * scale);
    };
    this.figures.forEach((fg, i) => { ctx.globalAlpha = 0.55 + Math.sin(this.t * 0.7 + i) * 0.3; drawSheet(fg.sheet, fg.x + Math.sin(this.t * 0.4 + i * 2) * 10, fg.y, i % 2); });
    ctx.globalAlpha = 1;
    if (!this.play && this.body) drawSheet(this.body, 160 + Math.sin(this.t * 0.5) * 6, 132 + (this.scene.theme === 'flying' || this.dream.lucid && this.si === this.dream.scenes.length - 1 ? -40 + Math.sin(this.t * 2) * 6 : 0), false);
    // color grading: warm for good dreams, red and dark for nightmares, a drifting hue otherwise
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = mood === 'nightmare' ? '#a04060' : mood === 'good' ? '#ffe0a0' : s.tint;
    ctx.fillRect(ox, oy, iw, ih);
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(R.W / 2, oy + ih / 2, ih * 0.2, R.W / 2, oy + ih / 2, iw * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, mood === 'nightmare' ? 'rgba(20,0,5,0.95)' : 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, R.W, R.H);
    if (mood === 'nightmare' && Math.random() < 0.02) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 0, R.W, R.H); }
    if (this.fade > 0) { ctx.fillStyle = `rgba(255,255,255,${this.fade})`; ctx.fillRect(0, 0, R.W, R.H); }
    if (this.play) { R.screenTransform(); this.drawPlay(ctx, ox, oy, scale); return; }
    // the words
    R.uiTransform();
    const text = G.i18n.t(this.beatText()).slice(0, Math.floor(this.chars));
    const lines = U.wrap(ctx, text, Math.min(420, R.uiW - 40), 11);
    lines.forEach((l, i) => U.text(ctx, l, R.uiW / 2, R.uiH - 64 + i * 15, { align: 'center', size: 11, color: mood === 'nightmare' ? '#ffc8d0' : '#f4ecff', font: 'serif' }));
  }
}
G.DreamScene = DreamScene;
G.dreams.SETTINGS = SETTINGS;   // (explorable dreams: js/game/dreamworld.js)

// ---------------------------------------------------------------- sleeping: dream, maybe wake early
G.WaitScene.prototype.go = function () {
  const g = this.game, sleeping = this.sleeping, foreign = this.foreign;
  let h = this.hours;
  G.scenes.remove(this);
  const dream = sleeping && h >= 2 ? G.dreams.make(g, h) : null;
  if (dream && dream.wake) h = Math.max(1, Math.min(h - 1, dream.wake));
  if (sleeping) G.audio.play('sleep');
  G.scenes.push(new G.FadeScene(() => {
    g.strangeBed = !!foreign;
    if (dream && dream.mood === 'nightmare') g.sleepQuality = 0.7;
    if (foreign) G.beds.sleepForeign(g, h, foreign.bed, foreign.owner);
    else g.passTime(h, sleeping);
    const after = () => {
      if (sleeping && !foreign) { G.saves.write('auto', g); }
      if (dream) {
        G.dreams.remember(g, dream);
        if (dream.mood === 'nightmare') { G.effects.add(g.player, 'shaken', 600); g.toast(dream.wake ? 'You jolt awake, heart pounding. It was just a dream.' : 'You wake up uneasy. A bad dream.', 'warn'); }
        else if (dream.mood === 'good') { G.effects.add(g.player, 'well_rested', 900); g.toast('You wake up smiling.', 'good'); }
        else g.toast('You wake up. What a weird dream.', 'info');
      } else if (sleeping && !foreign) g.toast('You slept deeply. No dreams you can remember. (Autosaved)', 'good');
      g.banner = { text: `Day ${g.world.day}`, sub: g.world.timeString, t: 2.5 };
    };
    if (dream) G.scenes.push(new DreamScene(g, dream, after)); else after();
  }, 1.4));
};
})();
