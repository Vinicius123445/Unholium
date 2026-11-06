'use strict';
// What is on. Films, plays, stand-up, music, poetry, and the stage at the strip clubs.
//   G.SHOWS: everything that can be on. G.showSys.programme(w, venue): what a place runs today and when.
//   Film and stage are watched in their own scene (CinemaScene, StageScene): a real presentation, drawn live, with its own
//   text, score and audience; leaving early is allowed. The clock moves on by the running time when it ends.
//   In the world, people with a ticket sit and watch while it runs, clap when it ends, and go. Staff actors stand on the
//   stage while a show is on. At the strip clubs the performers take turns on the stage (G.showSys.stage): routines that
//   walk the stage, work the pole, pose, then a break; the crowd cheers and throws money, the bills fly and land, and
//   the performer picks them up afterwards. Tips are real money moving from the customer to the performer.
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, U = G.ui, pick = (a) => G.rng.pick(a), S0 = G.venueSys, clamp = G.util.clamp;
// ---------------------------------------------------------------- films (all original)
const FILMS = [
  { id: 'rain', title: 'The Last Fare', genre: 'Noir', mood: [220, 196, 165], scenes: [
    { bg: 'rain', cast: ['#2a2a30', '#6a2030'], lines: [['Driver', 'She got in at the corner of Fifth. Paid in cash. Nobody pays in cash.'], ['Passenger', 'Just drive. And do not look in the mirror.']] },
    { bg: 'office', cast: ['#2a2a30'], lines: [['Driver', 'The envelope was still warm when I opened it. Bad sign.']] },
    { bg: 'rain', cast: ['#2a2a30', '#6a2030'], lines: [['Passenger', 'You could have kept driving.'], ['Driver', 'Yeah. That was the whole problem.']] } ] },
  { id: 'star', title: 'Orbit of Glass', genre: 'Science Fiction', mood: [330, 262, 392], scenes: [
    { bg: 'space', cast: ['#c8ccd2'], lines: [['Commander', 'Day four hundred. The station has started answering questions we have not asked.']] },
    { bg: 'station', cast: ['#c8ccd2', '#7ad0e0'], lines: [['Station', 'You miss the rain.'], ['Commander', 'How do you know that?'], ['Station', 'You talk in your sleep. I do not sleep.']] },
    { bg: 'space', cast: ['#c8ccd2'], lines: [['Commander', 'If anyone finds this: turn around. We were the signal.']] } ] },
  { id: 'love', title: 'Two Tickets to Nowhere', genre: 'Romance', mood: [262, 330, 349], scenes: [
    { bg: 'sunset', cast: ['#a04060', '#3a5a8a'], lines: [['Ana', 'You missed the train on purpose.'], ['Leo', 'I missed it twice, actually.']] },
    { bg: 'house', cast: ['#a04060', '#3a5a8a'], lines: [['Leo', 'Stay. Or do not. But tell me which before the kettle boils.'], ['Ana', 'You do not even have a kettle.']] },
    { bg: 'sunset', cast: ['#a04060', '#3a5a8a'], lines: [['Ana', 'Next time, buy the tickets first.']] } ] },
  { id: 'dark', title: 'The Basement Knows', genre: 'Horror', mood: [110, 116, 104], scenes: [
    { bg: 'house', dark: true, cast: ['#5a5a50'], lines: [['Mara', 'Hello? Is someone down there?']] },
    { bg: 'cellar', dark: true, cast: ['#5a5a50', '#101010'], lines: [['Mara', 'That is my voice. Why is that my voice?']] },
    { bg: 'cellar', dark: true, cast: ['#101010'], lines: [['The Voice', 'Hello? Is someone up there?']] } ] },
  { id: 'dust', title: 'Nine Miles of Dust', genre: 'Western', mood: [196, 247, 294], scenes: [
    { bg: 'desert', cast: ['#6a4a2a'], lines: [['Stranger', 'This town has one well, one sheriff, and one chance.']] },
    { bg: 'desert', cast: ['#6a4a2a', '#2a2a2a'], lines: [['Sheriff', 'Ride on.'], ['Stranger', 'My horse disagrees.']] },
    { bg: 'sunset', cast: ['#6a4a2a'], lines: [['Stranger', 'I left the town its well. I took the sheriff\'s hat. It seemed fair.']] } ] },
  { id: 'duck', title: 'Duck Tax', genre: 'Comedy', mood: [392, 440, 494], scenes: [
    { bg: 'office', cast: ['#e8c040', '#3a3a44'], lines: [['Auditor', 'Sir, you declared a duck as a dependent.'], ['Gary', 'He depends on me.']] },
    { bg: 'house', cast: ['#e8c040', '#3a3a44'], lines: [['Auditor', 'And the duck\'s business expenses?'], ['Gary', 'Bread. Mostly bread.']] },
    { bg: 'office', cast: ['#e8c040'], lines: [['Gary', 'We settled out of court. The duck got the house.']] } ] },
  { id: 'hard', title: 'Harbor Justice III', genre: 'Action', mood: [147, 165, 196], scenes: [
    { bg: 'harbor', cast: ['#3a3a44', '#a02020'], lines: [['Stone', 'You blew up my boat.'], ['Vargas', 'Which one?'], ['Stone', 'The third one.']] },
    { bg: 'harbor', cast: ['#3a3a44'], boom: true, lines: [['Stone', 'I am too old for this. I said that in the first movie too.']] } ] },
  { id: 'town', title: 'What the Water Left', genre: 'Documentary', mood: [220, 262, 294], scenes: [
    { bg: 'harbor', cast: [], lines: [['Narrator', 'For sixty years the port fed this city. Then the ships got bigger, and the town did not.']] },
    { bg: 'office', cast: ['#5a5a62'], lines: [['Old Docker', 'We knew every crane by name. Nobody writes that down.']] } ] },
];
// ---------------------------------------------------------------- the stage
const PLAYS = [
  { id: 'crown', title: 'The Salt Crown', kind: 'Play', cast: [['Queen', '#a02838'], ['Fool', '#d8b050']], lines: [['Queen', 'They bring me salt and call it tribute.'], ['Fool', 'Majesty, they bring you what the sea left them.'], ['Queen', 'And what does the sea leave me?'], ['Fool', 'Them. For now.']] },
  { id: 'letters', title: 'Letters Not Sent', kind: 'Drama', cast: [['Elena', '#3a5a8a'], ['Tomas', '#5a4a3a']], lines: [['Elena', 'I found them in the drawer. All of them. Thirty years.'], ['Tomas', 'I meant to mail them.'], ['Elena', 'You lived in the next room.'], ['Tomas', 'It was a very long hallway.']] },
  { id: 'stand', title: 'An Evening with Dolores Quick', kind: 'Stand-up', cast: [['Dolores', '#8a3a7a']], laugh: true, lines: [['Dolores', 'My doctor told me to cut out salt, sugar and stress.'], ['Dolores', 'So I cut out my doctor.'], ['Dolores', 'I joined a gym. I go there to sit in the car and feel guilty.'], ['Dolores', 'My husband says I never listen. Or something like that.']] },
  { id: 'farce', title: 'Wrong Door, Wrong Husband', kind: 'Comedy', cast: [['Betty', '#c84a6a'], ['Mr. Plum', '#6a8a3a']], laugh: true, lines: [['Betty', 'You cannot be in here! My husband will be home!'], ['Mr. Plum', 'Madam, I am your plumber.'], ['Betty', 'Then why are you hiding in the wardrobe?'], ['Mr. Plum', 'Because you told me to!']] },
  { id: 'poems', title: 'Poems for the Night Bus', kind: 'Poetry', cast: [['Poet', '#3a3a44']], lines: [['Poet', 'The last bus knows all our names and says none of them.'], ['Poet', 'A woman asleep against the window, holding tomorrow in a plastic bag.'], ['Poet', 'We ride, and the city folds behind us like a letter.']] },
  { id: 'spoken', title: 'Concrete Tongue', kind: 'Spoken Word', cast: [['Voice', '#a03020']], lines: [['Voice', 'They paved my street and called it progress.'], ['Voice', 'I said: progress to where? The street said nothing. Streets know better.'], ['Voice', 'So I am saying it for them. Loud.']] },
  { id: 'exp', title: 'Untitled (Seven Chairs)', kind: 'Experimental', cast: [['Performer', '#e8e4dc']], shapes: true, lines: [['Performer', 'Chair.'], ['Performer', 'Chair?'], ['Performer', '...'], ['Performer', 'Now you are the chair.']] },
  { id: 'band', title: 'The Harbor Lights', kind: 'Live Music', cast: [['Singer', '#c04030'], ['Guitar', '#3a5a8a'], ['Bass', '#3a7a4a']], music: true, lines: [['Singer', 'Oh the tide comes in, and the tide goes out...'], ['Singer', 'And I am still waiting on this pier...'], ['Singer', 'One more for the road, one more for the rain!']] },
  { id: 'noise', title: 'Rat King Sound System', kind: 'Live Music', cast: [['Screamer', '#e83030'], ['Guitar', '#141418'], ['Drums', '#40c080']], music: true, fast: true, lines: [['Screamer', 'NO FUTURE! NO PARKING!'], ['Screamer', 'THIS ONE IS ABOUT MY LANDLORD!'], ['Screamer', 'ONE TWO THREE FOUR!']] },
];
G.SHOWS = { FILMS, PLAYS };
const TIMES = { cinema: [14, 17, 20, 22.5], theater: [19.5], blackbox: [20.5], live: [21] };
const SHOWS_BY = { theater: ['crown', 'letters', 'farce', 'stand'], blackbox: ['poems', 'spoken', 'exp', 'stand'], live: ['band', 'noise'], punk: ['noise'] };
const Sh = G.showSys = {
  film(w, vid, room = 0) { return FILMS[(w.day + room * 3 + G.util.hashString(vid)) % FILMS.length]; },
  play(w, vid) { const v = G.VENUES[vid], list = SHOWS_BY[v.kind] || []; return PLAYS.find((p) => p.id === list[(w.day + G.util.hashString(vid)) % list.length]); },
  programme(w, vid) {
    const v = G.VENUES[vid], t = TIMES[v.kind]; if (!t) return [];
    if (v.kind === 'cinema') { const out = []; for (let r = 0; r < (v.rooms || 1); r++) t.forEach((h, i) => { if ((i + r) % (v.rooms || 1) === 0 || (v.rooms || 1) === 1) out.push({ at: h + (r ? 0.5 : 0), room: r, film: this.film(w, vid, r + i) }); }); return out.sort((a, b) => a.at - b.at); }
    return t.map((h) => ({ at: h, play: this.play(w, vid) }));
  },
  clock(h) { const m = Math.round((h % 1) * 60); return `${String(Math.floor(h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
  // box office, in any venue with a programme
  tickets(scene, vid) {
    const w = scene.world, p = scene.player, v = G.VENUES[vid], k = G.VENUE_KINDS[v.kind], price = S0.price(w, vid, k.entry || 8), h = w.hourF, on = this.programme(w, vid).filter((s) => s.at >= h - 0.3);
    if (!S0.isOpen(w, vid)) { scene.toast(`${v.name} is closed.`, 'warn'); return; }
    if (!on.length) { scene.toast('Nothing more today. Come back tomorrow.', 'warn'); return; }
    G.scenes.push(new G.ListScene(`${v.name} · $${price}`, (ls) => on.map((s) => { const t = s.film ? s.film.title : s.play.title, g = s.film ? s.film.genre : s.play.kind; return { label: `${this.clock(s.at)}  ${t}`, sub: g, disabled: p.gold < price, act: () => { p.gold -= price; S0.st(w, vid).till += price; S0.st(w, vid).visits++; G.audio.play('coin'); G.scenes.remove(ls); this.attend(scene, vid, s); } }; })));
  },
  attend(scene, vid, s) {
    const w = scene.world, p = scene.player, m = scene.map, seats = (m.vseats || {})[vid] || [], room = (m.vrooms || {})[vid] && m.vrooms[vid][s.room || 0], list = room ? seats.filter((q) => q.x >= room.x0 && q.x <= room.x1) : seats;
    const seat = list[G.rng.int(0, Math.max(0, list.length - 1))];
    if (s.at > w.hourF) w.skipHours(s.at - w.hourF);    // you wait in the lobby until it starts
    if (seat) { p.x = seat.x * 16 + 8; p.y = seat.y * 16 + 12; p.dir = 3; }
    G.autonomyPause = true;
    const done = (full) => { const hours = s.film ? 1.8 : s.play.music ? 1.6 : 1.4; if (full) { w.skipHours(hours); G.needs && 0; this.mood(p); for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a.seated && a.distTo(p) < 200) { a.seated = false; a.errand = null; a.say(pick(['Well, that was something.', 'I want my money back.', 'I would see it again.', 'Beautiful.']), 3); } } G.autonomyPause = false; };
    G.scenes.push(s.film ? new CinemaScene(s.film, done) : new StageScene(s.play, done, vid));
  },
  mood(p) { if (p.stress != null) p.stress = Math.max(0, p.stress - 20); },
  // ---------------------------------------------------------------- the clubs' stage
  ST: new WeakMap(),
  bills: [],
  tip(scene, from, perf, n, amt) {
    const w = scene.world, pay = Math.min(amt, from === scene.player ? from.gold : (from.st.gold || 0));
    if (pay <= 0) return 0;
    if (from === scene.player) from.gold -= pay; else from.st.gold -= pay;
    perf.st.gold = (perf.st.gold || 0) + pay;
    const v = perf.def.venue && S0.st(w, perf.def.venue); if (v) v.visits++;
    for (let i = 0; i < n; i++) this.bills.push({ map: scene.map.id, x: from.x, y: from.y - 12, tx: perf.x + (Math.random() - 0.5) * 34, ty: perf.y + (Math.random() - 0.5) * 16, t: 0, dur: 0.7 + Math.random() * 0.5, spin: Math.random() * 6, delay: i * 0.08, by: perf.id });
    if (perf.distTo(scene.player) < 240 && Math.random() < 0.6) perf.say(pick(['Thank you, love!', 'You are too kind!', 'That is what I like to see!']), 2.2);
    return pay;
  },
  routine(a, t, s) {
    const stage = s.stage, cx = (stage.x0 + stage.x1 + 1) * 8, mid = (stage.y0 + stage.y1 + 1) * 8 + 4, phase = Math.floor(t / 9) % 4, k = (t % 9) / 9;
    if (phase === 0) { a.x = cx + Math.sin(k * 6.28) * (stage.x1 - stage.x0) * 6; a.y = mid + Math.cos(k * 12.56) * 8; a.moving = true; a.dir = Math.cos(k * 6.28) > 0 ? 2 : 1; a.bob = 0; }           // the walk
    else if (phase === 1) { const o = k * 6.28 * 3, pl = stage.pole; a.x = pl.x * 16 + 8 + Math.cos(o) * 11; a.y = pl.y * 16 + 12 + Math.sin(o) * 5; a.moving = false; a.dir = [2, 0, 1, 3][Math.floor(o / 1.57) % 4]; a.bob = -3 - Math.abs(Math.sin(o)) * 6; }   // around the pole, feet off the floor
    else if (phase === 2) { a.moving = false; a.dir = 0; a.x = cx + Math.sin(t * 2) * 6; a.y = mid + 10; a.bob = Math.abs(Math.sin(t * 5)) * -2.5; a.handsUp = Math.floor(t * 1.5) % 2 === 0; }        // the pose, facing the room
    else { a.handsUp = false; a.moving = true; a.dir = 3 - Math.floor(k * 4) % 4; a.x = cx + Math.cos(k * 18) * 12; a.y = mid + Math.sin(k * 18) * 5; a.bob = 0; }                                       // a spin across the stage
  },
  tickStage(scene, dt) {
    const m = scene.map; if (!m.vstage) return;
    for (const b of m.buildings) {
      if (!b.venue || G.VENUES[b.venue].kind !== 'strip' || !m.vstage[b.venue]) continue;
      const vid = b.venue, w = scene.world, stage = m.vstage[vid], s = this.ST.get(b) || { i: 0, t: 0, rest: 2, stage }; this.ST.set(b, s);
      if (!S0.isOpen(w, vid)) continue;
      const perf = scene.actors.filter((a) => a.kind === 'npc' && a.def.performer && a.def.venue === vid && !a.dead && !a.talking && a.state === 'schedule');
      if (!perf.length) continue;
      if (s.on) {
        const a = s.on; if (a.dead || a.state !== 'schedule' || !scene.actors.includes(a)) { s.on = null; continue; }
        if (a.talking) { a.bob = 0; a.handsUp = false; continue; }
        s.t += dt; this.routine(a, s.t * (s.special ? 1.3 : 1), s);
        if (Math.random() < dt * 0.9) { const c = scene.actors.filter((n) => n.kind === 'npc' && !n.dead && !n.def.venue && n.seated && n.distTo(a) < 150 && (n.st.gold || 0) >= 2); const n = pick(c); if (n) { this.tip(scene, n, a, 1 + (Math.random() < 0.3 ? 2 : 0), G.rng.int(1, 5)); n.say(pick(['Woo!', 'Yeah!', 'Beautiful!', 'Over here!']), 1.8); } }
        if (s.t > (s.special ? 28 : 40)) { s.on = null; s.special = false; a.bob = 0; a.handsUp = false; a.moving = false; a.say(pick(['Thank you, thank you!', 'Be good to each other.']), 2.5); a.placeBySchedule(m, w); s.rest = 10 + Math.random() * 12; this.bills = this.bills.filter((q) => q.by !== a.id); G.audio.play('coin'); }
      } else if ((s.rest -= dt) <= 0) { s.i = (s.i + 1) % perf.length; s.on = perf[s.i]; s.t = 0; G.audio.play('crowd'); }
    }
  },
  request(scene, a) { const b = scene.map.building(a.def.venue), s = b && this.ST.get(b); if (!s) return false; if (s.on) { s.on.bob = 0; s.on.handsUp = false; s.on.placeBySchedule(scene.map, scene.world); } s.on = a; s.t = 0; s.special = true; return true; },
  isOnStage(a) { for (const b of (G.scenes.top() instanceof G.GameScene ? G.scenes.top().map.buildings : [])) { const s = this.ST.get(b); if (s && s.on === a) return true; } return false; },
  drawBills(ctx, scene) {
    for (const q of this.bills) {
      if (q.map !== scene.map.id) continue;
      const k = clamp((q.t - q.delay) / q.dur, 0, 1); if (q.t < q.delay) continue;
      const x = q.x + (q.tx - q.x) * k, y = q.y + (q.ty - q.y) * k - Math.sin(k * 3.14) * 22, a = q.spin + q.t * 9 * (1 - k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(k >= 1 ? q.spin : a); ctx.fillStyle = '#5aa050'; ctx.fillRect(-3, -1.5, 6, 3); ctx.fillStyle = '#c8e8b0'; ctx.fillRect(-1, -0.7, 2, 1.4); ctx.restore();
    }
  },
  // a play on: actors stand on the stage; the audience claps when it ends
  tickVenues(scene, dt) {
    const w = scene.world, m = scene.map;
    for (const q of this.bills) q.t += dt;
    if (this.bills.length > 90) this.bills.splice(0, this.bills.length - 90);
    for (const b of m.buildings) {
      if (!b.venue) continue;
      const v = G.VENUES[b.venue], t = TIMES[v.kind]; if (!t || v.kind === 'cinema') continue;
      const running = t.some((h) => w.hourF >= h && w.hourF < h + 1.4), was = b.vRun; b.vRun = running;
      if (was && !running) for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a.seated && m.buildingAt(a.x, a.y - 3) === b) { a.say(pick(['Bravo!', 'Encore!', '*applause*', 'More!']), 2.5); a.clapT = G.loop.time + 3; if (a.errand) a.errand.until = G.effects.now() + 8; }
    }
    if (m.vdance && (scene._thump = (scene._thump || 0) - dt) <= 0) { scene._thump = 0.48; const inside = m.buildingAt(scene.player.x, scene.player.y - 3); if (inside && m.vdance[inside.venue] && S0.isOpen(w, inside.venue)) G.audio.tone(52, 0.12, { type: 'sine', vol: 0.16 }); }
  },
};
// people dance on a dance floor, bob at gigs, and clap at the end
const _du = NP.update;
NP.update = function (dt, scene) {
  const r = _du.call(this, dt, scene);
  if (this.errand && this.errand.kind === 'venue' && !this.dead) { const v = G.VENUES[this.errand.venue]; if (this.errand.there && /club|punk|live/.test(v.kind) && !this.seated) this.bob = Math.abs(Math.sin(G.loop.time * 6 + this.x)) * -2; else if (!this.def.performer) this.bob = 0; }
  return r;
};
const AP = G.Actor.prototype, _ad = AP.draw;
AP.draw = function (ctx) {
  if (!this.bob) return _ad.call(this, ctx);
  const y = this.y; this.y = y + this.bob; try { return _ad.call(this, ctx); } finally { this.y = y; }
};
const _fd = G.firearms.draw;
G.firearms.draw = function (ctx, scene) { const r = _fd.call(this, ctx, scene); Sh.drawBills(ctx, scene); return r; };
const _u = GS.update;
GS.update = function (dt) { const r = _u.call(this, dt); if (this.actors && this.map) { try { Sh.tickStage(this, dt); Sh.tickVenues(this, dt); } catch (e) { if (G.reportError) G.reportError(e); else throw e; } } return r; };
const Wd = (w, h) => ({ W: Math.min(G.renderer.uiW, w), H: Math.min(G.renderer.uiH, h) });
// the speaker's line under the picture
const subtitle = (ctx, who, text, W, H) => { const R = G.renderer; U.text(ctx, who ? `${who}:` : '', R.uiW / 2, (R.uiH + H) / 2 + 4, { size: 8, align: 'center', color: '#c8c0a8' }); const lines = U.wrap(ctx, text, W - 40, 11); lines.forEach((l, i) => U.text(ctx, l, R.uiW / 2, (R.uiH + H) / 2 + 16 + i * 14, { size: 11, align: 'center', color: '#f0ece0', shadow: true })); };
// ---------------------------------------------------------------- the film
const BG = {
  rain(x, W, H, t) { x.fillStyle = '#10141c'; x.fillRect(0, 0, W, H); x.fillStyle = '#1a2230'; for (let i = 0; i < 7; i++) x.fillRect(i * W / 7 + 8, H * 0.2 + (i * 37) % 40, W / 9, H); x.fillStyle = 'rgba(240,210,120,0.5)'; for (let i = 0; i < 40; i++) x.fillRect((i * 83) % W, H * 0.25 + (i * 53) % (H * 0.5), 3, 4); x.strokeStyle = 'rgba(180,200,230,0.35)'; for (let i = 0; i < 60; i++) { const a = (i * 97 + t * 500) % W, b = (i * 61 + t * 900) % H; x.beginPath(); x.moveTo(a, b); x.lineTo(a - 2, b + 9); x.stroke(); } x.fillStyle = '#0a0e14'; x.fillRect(0, H * 0.82, W, H); },
  office(x, W, H) { x.fillStyle = '#3a3228'; x.fillRect(0, 0, W, H); x.fillStyle = '#c8b890'; x.fillRect(W * 0.1, H * 0.15, W * 0.25, H * 0.35); for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(30,20,10,0.6)'; x.fillRect(W * 0.1, H * 0.15 + i * H * 0.06, W * 0.25, H * 0.025); } x.fillStyle = '#2a2018'; x.fillRect(0, H * 0.7, W, H); x.fillStyle = '#5a3e26'; x.fillRect(W * 0.4, H * 0.62, W * 0.45, H * 0.08); },
  space(x, W, H, t) { x.fillStyle = '#04060c'; x.fillRect(0, 0, W, H); for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + ((i * 7) % 7) / 10})`; x.fillRect(((i * 113 - t * (i % 4)) % W + W) % W, (i * 71) % H, 1.5, 1.5); } x.fillStyle = '#3a5a8a'; x.beginPath(); x.arc(W * 0.8, H * 0.8, H * 0.5, 0, 6.3); x.fill(); x.fillStyle = '#8a929c'; x.fillRect(W * 0.3 + Math.sin(t) * 4, H * 0.35, W * 0.2, H * 0.08); x.fillRect(W * 0.38 + Math.sin(t) * 4, H * 0.22, W * 0.04, H * 0.34); },
  station(x, W, H, t) { x.fillStyle = '#1a2028'; x.fillRect(0, 0, W, H); x.fillStyle = '#2a323c'; for (let i = 0; i < 6; i++) x.fillRect(i * W / 6 + 6, H * 0.1, W / 6 - 12, H * 0.5); x.fillStyle = `rgba(90,220,240,${0.5 + Math.sin(t * 3) * 0.3})`; x.fillRect(W * 0.1, H * 0.2, W * 0.8, 3); x.fillStyle = '#10141a'; x.fillRect(0, H * 0.72, W, H); },
  sunset(x, W, H) { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a3a7a'); g.addColorStop(0.5, '#e87a50'); g.addColorStop(0.75, '#f8c870'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#ffe8a0'; x.beginPath(); x.arc(W * 0.5, H * 0.62, H * 0.13, 0, 6.3); x.fill(); x.fillStyle = '#2a1a26'; x.fillRect(0, H * 0.75, W, H); },
  house(x, W, H) { x.fillStyle = '#5a4a3a'; x.fillRect(0, 0, W, H); x.fillStyle = '#8a7a5a'; x.fillRect(W * 0.6, H * 0.15, W * 0.2, H * 0.3); x.fillStyle = '#c8d8e0'; x.fillRect(W * 0.62, H * 0.17, W * 0.16, H * 0.26); x.fillStyle = '#3a2a1e'; x.fillRect(0, H * 0.74, W, H); },
  cellar(x, W, H, t) { x.fillStyle = '#16120e'; x.fillRect(0, 0, W, H); x.fillStyle = `rgba(220,200,120,${0.25 + Math.random() * 0.1 * Math.sin(t * 13)})`; x.beginPath(); x.moveTo(W * 0.5, 0); x.lineTo(W * 0.2, H); x.lineTo(W * 0.8, H); x.fill(); },
  desert(x, W, H) { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7ab0d8'); g.addColorStop(0.7, '#f0d8a8'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = '#b87a4a'; x.beginPath(); x.moveTo(0, H * 0.7); x.lineTo(W * 0.2, H * 0.4); x.lineTo(W * 0.35, H * 0.7); x.lineTo(W * 0.75, H * 0.7); x.lineTo(W * 0.85, H * 0.45); x.lineTo(W, H * 0.7); x.fill(); x.fillStyle = '#c8965a'; x.fillRect(0, H * 0.7, W, H); },
  harbor(x, W, H, t) { x.fillStyle = '#6a7a8a'; x.fillRect(0, 0, W, H); x.fillStyle = '#2a3a4a'; x.fillRect(0, H * 0.6, W, H); x.fillStyle = '#3a3a44'; x.fillRect(W * 0.1, H * 0.2, 8, H * 0.4); x.fillRect(W * 0.1, H * 0.2, W * 0.25, 6); x.fillStyle = '#5a2a2a'; x.fillRect(W * 0.55 + Math.sin(t) * 3, H * 0.5, W * 0.3, H * 0.1); },
};
// an actor: a lit figure with shoulders, arms and legs, breathing, and gesturing when it is their line
const figure = (x, cx, base, h, col, t, talk) => {
  const bob = Math.sin(t * 1.6 + cx) * h * 0.006 + (talk ? Math.sin(t * 7) * h * 0.008 : 0), arm = talk ? Math.sin(t * 3.1) * 0.5 : 0.08, u = h / 100, dark = G.assets.shade(col, 0.7), top = base - h + bob;
  x.save(); x.translate(cx, 0);
  const sh = x.createRadialGradient(0, base, 2, 0, base, 26 * u); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sh; x.fillRect(-26 * u, base - 6 * u, 52 * u, 12 * u);
  x.fillStyle = dark; x.beginPath(); x.moveTo(-11 * u, base - 46 * u); x.lineTo(-13 * u, base); x.lineTo(-3 * u, base); x.lineTo(0, base - 38 * u); x.lineTo(3 * u, base); x.lineTo(13 * u, base); x.lineTo(11 * u, base - 46 * u); x.fill();
  const limb = (side, a) => { x.save(); x.translate(side * 15 * u, top + 28 * u); x.rotate(side * a); x.fillStyle = dark; x.fillRect(-3.4 * u, 0, 6.8 * u, 32 * u); x.fillStyle = '#d8b090'; x.beginPath(); x.arc(0, 34 * u, 3.6 * u, 0, 6.3); x.fill(); x.restore(); };
  limb(-1, 0.08); limb(1, arm);
  x.fillStyle = col; x.beginPath(); x.moveTo(-17 * u, top + 26 * u); x.quadraticCurveTo(0, top + 18 * u, 17 * u, top + 26 * u); x.lineTo(13 * u, base - 42 * u); x.lineTo(-13 * u, base - 42 * u); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(-13 * u, top + 26 * u, 6 * u, 26 * u);
  x.fillStyle = '#c8a080'; x.fillRect(-3.5 * u, top + 15 * u, 7 * u, 8 * u);
  x.fillStyle = '#d8b090'; x.beginPath(); x.ellipse(0, top + 9 * u, 9 * u, 11 * u, 0, 0, 6.3); x.fill();
  x.fillStyle = '#2a1e16'; x.beginPath(); x.ellipse(0, top + 3 * u, 9.6 * u, 7 * u, 0, Math.PI, 0); x.fill();
  x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(-4.5 * u, top + 8 * u, 2 * u, 1.6 * u); x.fillRect(2.5 * u, top + 8 * u, 2 * u, 1.6 * u); if (talk && Math.sin(t * 11) > 0) x.fillRect(-2 * u, top + 14 * u, 4 * u, 1.6 * u);
  x.restore();
};
class CinemaScene {
  constructor(film, done) { this.film = film; this.done = done; this.t = 0; this.i = 0; this.line = 0; this.lt = 0; this.note = 0; this.phase = 'title'; this.cv = document.createElement('canvas'); this.cv.width = 560; this.cv.height = 240; }
  close(full) { G.scenes.remove(this); this.done(full); }
  update(dt) {
    const I = G.input; this.t += dt; if (I.wasPressed('cancel')) { G.audio.play('back'); this.close(false); return; }
    const skip = I.wasPressed('interact') || I.pressed.has('Space') || I.pressed.has('Enter');
    if ((this.note -= dt) <= 0) { const m = this.film.mood, f = m[Math.floor(this.t / 2.2) % m.length]; this.note = 2.2; for (const [k, v] of [[0.5, 0.06], [1, 0.04], [1.25, 0.03], [1.5, 0.03]]) G.audio.tone(f * k, 2.1, { type: k < 1 ? 'sine' : 'triangle', vol: v }); }
    if (this.phase === 'title') { if (this.t > 3.5 || skip) { this.phase = 'film'; this.lt = 0; } return; }
    if (this.phase === 'end') { if (this.t > this.endT + 4 || skip) this.close(true); return; }
    const sc = this.film.scenes[this.i], ln = sc.lines[this.line]; this.lt += dt;
    if (sc.boom && this.lt < dt * 1.5) { G.audio.play('explosion'); }
    if (this.lt > 2.2 + ln[1].length * 0.05 || skip) { this.lt = 0; this.line++; if (this.line >= sc.lines.length) { this.line = 0; this.i++; if (this.i >= this.film.scenes.length) { this.phase = 'end'; this.endT = this.t; } } }
  }
  render(ctx) {
    const R = G.renderer, { W, H } = Wd(640, 280), x0 = (R.uiW - W) / 2, y0 = (R.uiH - H) / 2 - 18;
    R.uiTransform(); ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, R.uiW, R.uiH);
    const c = this.cv, x = c.getContext('2d'), cw = c.width, ch = c.height;
    x.fillStyle = '#000000'; x.fillRect(0, 0, cw, ch);
    if (this.phase === 'title') { ctx.drawImage(c, x0, y0, W, H); U.text(ctx, this.film.title, R.uiW / 2, y0 + H * 0.42, { size: 22, align: 'center', weight: 'bold', color: '#f0e8d0' }); U.text(ctx, this.film.genre, R.uiW / 2, y0 + H * 0.58, { size: 10, align: 'center', color: '#a8a090' }); return; }
    if (this.phase === 'end') { const k = this.t - this.endT; ctx.drawImage(c, x0, y0, W, H); U.text(ctx, 'THE END', R.uiW / 2, y0 + H * 0.3, { size: 18, align: 'center', weight: 'bold', color: '#f0e8d0' }); U.text(ctx, this.film.title, R.uiW / 2, y0 + H * 0.5 - k * 3, { size: 10, align: 'center', color: '#a8a090' }); return; }
    const sc = this.film.scenes[this.i], ln = sc.lines[this.line], pan = Math.sin(this.t * 0.2) * 8, n = (sc.cast || []).length, who = n ? this.line % n : 0;
    // the director's cut: wide on the first line of a scene, then in on whoever is speaking, with a slow push
    const close = n && this.line > 0, zoom = close ? 1.55 + this.lt * 0.012 : 1 + this.lt * 0.008, fx = n ? cw * (0.34 + who * 0.3) : cw / 2, fy = ch * 0.62;
    x.save(); if (zoom !== 1) { x.translate(cw / 2, ch / 2); x.scale(zoom, zoom); x.translate(-fx, -(close ? fy : ch / 2)); } x.translate(pan, 0); (BG[sc.bg] || BG.office)(x, cw + 20, ch, this.t); (sc.cast || []).forEach((col, i) => figure(x, cw * (0.34 + i * 0.3), ch * 0.92, ch * 0.62, col, this.t, ln[0] && i === this.line % Math.max(1, sc.cast.length))); x.restore();
    if (sc.dark) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, 0, cw, ch); }
    if (this.line === 0 && this.lt < 0.7) { x.fillStyle = `rgba(0,0,0,${1 - this.lt / 0.7})`; x.fillRect(0, 0, cw, ch); }   // scenes fade up from black
    if (sc.boom && this.lt < 1.2) { x.fillStyle = `rgba(255,${180 - this.lt * 100},60,${1 - this.lt / 1.2})`; x.fillRect(0, 0, cw, ch); }
    const vg = x.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, cw * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); x.fillStyle = vg; x.fillRect(0, 0, cw, ch);
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * cw, Math.random() * ch, 1, 1);
    ctx.drawImage(c, x0, y0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < H; i += 3) ctx.fillRect(x0, y0 + i, W, 1);
    subtitle(ctx, ln[0], ln[1], W, H - 36);
  }
}
// ---------------------------------------------------------------- the stage
class StageScene {
  constructor(play, done) { this.p = play; this.done = done; this.t = 0; this.l = 0; this.lt = 0; this.open = 0; this.clap = 0; this.note = 0; this.heads = Array.from({ length: 34 }, (_, i) => ({ x: (i * 53) % 640, r: (i * 3) % 3, c: ['#2a2a30', '#3a2a24', '#4a3a30', '#1e1e22'][i % 4], ph: i })); }
  close(full) { G.scenes.remove(this); this.done(full); }
  update(dt) {
    const I = G.input; this.t += dt; if (I.wasPressed('cancel')) { G.audio.play('back'); this.close(false); return; }
    const skip = I.wasPressed('interact') || I.pressed.has('Space') || I.pressed.has('Enter');
    if (this.clap > 0) { if ((this.clap -= dt) <= 0 || skip && this.clap < 3) this.close(true); if (Math.random() < dt * 6) G.audio.noise(0.08, { vol: 0.07, freq: 2400, type: 'highpass' }); return; }
    this.open = Math.min(1, this.open + dt / 1.8); if (this.open < 1) return;
    if (this.p.music && (this.note -= dt) <= 0) { const sc = this.p.fast ? [165, 196, 147, 165] : [262, 330, 294, 392]; this.note = this.p.fast ? 0.22 : 0.5; G.audio.tone(sc[Math.floor(this.t / this.note) % 4], this.note, { type: this.p.fast ? 'sawtooth' : 'triangle', vol: 0.06 }); if (this.p.fast) G.audio.noise(0.05, { vol: 0.06, freq: 300 }); }
    this.lt += dt; const ln = this.p.lines[this.l];
    if (this.lt > 2.2 + ln[1].length * 0.055 || skip) { this.lt = 0; if (this.p.laugh) G.audio.play('crowd'); this.l++; if (this.l >= this.p.lines.length) { this.l = this.p.lines.length - 1; this.clap = 5; G.audio.play('crowd'); } }
  }
  render(ctx) {
    const R = G.renderer, { W, H } = Wd(640, 330), x = (R.uiW - W) / 2, y = (R.uiH - H) / 2 - 12, ln = this.p.lines[this.l], t = this.t;
    R.uiTransform(); ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, R.uiW, R.uiH);
    ctx.fillStyle = '#20141a'; ctx.fillRect(x, y, W, H * 0.72);
    ctx.fillStyle = '#3a2418'; ctx.fillRect(x, y + H * 0.62, W, H * 0.12); ctx.fillStyle = '#5a3a24'; ctx.fillRect(x, y + H * 0.62, W, 2);
    if (this.p.shapes) { for (let i = 0; i < 7; i++) { const a = i * 0.9 + t * 0.4; ctx.fillStyle = `hsl(${(i * 51 + t * 20) % 360},50%,50%)`; const cx = x + W / 2 + Math.cos(a) * W * 0.3, cy = y + H * 0.34 + Math.sin(a * 1.3) * H * 0.16; ctx.fillRect(cx - 8, cy - 8, 16, 16); } }
    // light from above
    const g = ctx.createRadialGradient(x + W / 2, y + H * 0.2, 10, x + W / 2, y + H * 0.45, W * 0.46); g.addColorStop(0, 'rgba(255,235,180,0.34)'); g.addColorStop(1, 'rgba(255,235,180,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, W, H * 0.72);
    this.p.cast.forEach((c, i) => { const n = this.p.cast.length, cx = x + W * ((i + 1) / (n + 1)), speaking = c[0] === ln[0]; figure(ctx, cx + Math.sin(t * 0.6 + i) * 6, y + H * 0.66, H * 0.38, c[1], t, speaking && this.open >= 1 && this.clap <= 0); });
    const cw = (W / 2) * (1 - this.open * 0.86); ctx.fillStyle = '#8a1420'; ctx.fillRect(x, y, cw, H * 0.7); ctx.fillRect(x + W - cw, y, cw, H * 0.7); ctx.fillStyle = '#6a0e18'; for (let i = 0; i < cw; i += 14) { ctx.fillRect(x + i, y, 5, H * 0.7); ctx.fillRect(x + W - i - 5, y, 5, H * 0.7); }
    ctx.fillStyle = '#a01824'; ctx.fillRect(x, y, W, 12); ctx.fillStyle = '#d8b050'; ctx.fillRect(x, y + 12, W, 2);
    for (const h of this.heads) { const hop = this.clap > 0 ? Math.abs(Math.sin(t * 9 + h.ph)) * 3 : 0, hy = y + H * 0.8 + h.r * 16 - hop; ctx.fillStyle = h.c; ctx.beginPath(); ctx.arc(x + (h.x / 640) * W, hy, 10, 0, 6.3); ctx.fill(); ctx.fillRect(x + (h.x / 640) * W - 12, hy + 8, 24, 30); }
    if (this.open >= 1 && this.clap <= 0) subtitle(ctx, ln[0], ln[1], W, H - 42);
    else if (this.clap > 0) U.text(ctx, this.p.title, R.uiW / 2, y + H * 0.08, { size: 13, align: 'center', weight: 'bold', color: '#f0e8d0', shadow: true });
    else U.text(ctx, `${this.p.title} · ${this.p.kind}`, R.uiW / 2, y + H * 0.34, { size: 13, align: 'center', weight: 'bold', color: '#f0e8d0', shadow: true });
  }
}
Object.assign(G, { CinemaScene, StageScene });
// ---------------------------------------------------------------- talking to the performers
const PERS = ['bright', 'dry', 'student', 'pro'];
const persOf = (id) => PERS[G.util.hashString(id) % PERS.length];
const LIFE = { bright: 'I came here for a summer. That was six summers ago. I still like the lights.', dry: 'It pays the rent. The rent is the only thing here I take seriously.', student: 'Second year of nursing school. The anatomy exam is the easy part.', pro: 'Twelve years on stages. Gymnast first. My knees could tell you stories.' };
const HI = { bright: ['Hi! Having a good night?', 'There you are! Good crowd tonight.'], dry: ['What can I do for you?', 'You are blocking my light.'], student: ['Sorry, I was reading. On a break. Hi.', 'Twenty minutes till my set. What is up?'], pro: ['Evening. Enjoying the show?', 'You came on a good night.'] };
G.DIALOGUES.v_performer = {
  start: {
    text: (c) => { const st = c.st, n = (st.fanVisits = (st.fanDay === c.w.day ? st.fanVisits : (st.fanVisits || 0) + 1)); st.fanDay = c.w.day; const P = persOf(c.npc.id); return n >= 4 ? pick(['You again! They will start charging you rent.', 'My favorite regular. How have you been?']) : n >= 2 ? `Back again? ${pick(HI[P])}` : pick(HI[P]); },
    choices: [
      { text: 'Here, a little something. ($5)', if: (c) => c.gold() >= 5, do: (c) => { Sh.tip(c.scene, c.p, c.npc, 3, 5); G.social.addDisp(c.w, c.npc.id, 1); return 'start'; } },
      { text: 'For a great show. ($20)', if: (c) => c.gold() >= 20, do: (c) => { Sh.tip(c.scene, c.p, c.npc, 8, 20); G.social.addDisp(c.w, c.npc.id, 3); return 'start'; } },
      { text: 'That was a great performance.', do: (c) => { G.social.addDisp(c.w, c.npc.id, 1); c.w.flags.perfSaid = pick(['Thank you. That new turn took me a month.', 'You noticed? Most people look at their drinks.', 'Tell the boss. He thinks I can do better.']); return 'said'; } },
      { text: 'What is your story?', do: (c) => { c.w.flags.perfSaid = LIFE[persOf(c.npc.id)]; return 'said'; } },
      { text: 'Hear anything interesting lately?', do: (c) => { const r = (c.st.disp || 0) >= 5 ? (c.w.rumors && c.w.rumors.length ? pick(c.w.rumors.slice(-6)) : null) : null; c.w.flags.perfSaid = r ? (r.text || r) : pick(['People tell me things. Buy a drink first.', 'Be a regular first. Then we will talk.']); return 'said'; } },
      { text: 'Would you do a special show? ($50)', if: (c) => c.gold() >= 50, do: (c) => { const p = c.p; if (!Sh.request(c.scene, c.npc)) return 'start'; p.gold -= 50; c.npc.st.gold = (c.npc.st.gold || 0) + 40; S0.st(c.w, c.npc.def.venue).till += 10; G.audio.play('coin'); c.npc.say('Watch closely.', 2.5); return null; } },
      { text: 'Goodbye.', next: null },
    ],
  },
  said: { text: (c) => c.w.flags.perfSaid || '...', choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] },
};
// bouncers keep people off the stage
const _sg = GS.update;
GS.update = function (dt) {
  const r = _sg.call(this, dt), p = this.player, m = this.map;
  if (p && m && m.vstage) { const b = m.buildingAt(p.x, p.y - 3); if (b && b.venue && G.VENUES[b.venue].kind === 'strip') { const s = m.vstage[b.venue], tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16); if (tx >= s.x0 && tx <= s.x1 && ty >= s.y0 && ty <= s.y1) { p.y = (s.y1 + 2) * 16 + 14; const k = this.actors.find((a) => a.kind === 'npc' && a.def.venue === b.venue && a.def.name === 'Bouncer'); if (k) k.say('Off the stage. Now.', 2.5); } } }
  return r;
};
})();
