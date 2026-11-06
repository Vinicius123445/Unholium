'use strict';
// Animal species.
//   behavior: skittish (flees from player) | docile (ignores, flees when hurt) | predator (hunts player)
//             territorial (attacks when player gets close) | defensive (fights back when hurt)
//   owned: livestock — killing it is a crime against the owner's region
//   drops: [itemId, min, max, chance]

G.ANIMALS = {
  rabbit:  { name: 'Rabbit', color: '#a08a70', hp: 5, speed: 62, behavior: 'skittish', sight: 60, w: 8, h: 5,
             drops: [['raw_meat', 1, 1, 1], ['pelt', 1, 1, 0.4]] },
  deer:    { name: 'Deer', color: '#9a6a3e', hp: 22, speed: 72, behavior: 'skittish', sight: 90, w: 12, h: 6,
             drops: [['raw_meat', 2, 3, 1], ['pelt', 1, 1, 0.9], ['antler', 1, 1, 0.5]], antlerChance: 0.5 },
  wolf:    { name: 'Wolf', color: '#6e6e74', hp: 32, speed: 64, behavior: 'predator', sight: 100, nightSight: 150, dmg: 8, w: 12, h: 6,
             drops: [['wolf_pelt', 1, 1, 0.9], ['raw_meat', 1, 1, 0.6]] },
  boar:    { name: 'Boar', color: '#5a4334', hp: 38, speed: 60, behavior: 'defensive', sight: 50, dmg: 10, w: 12, h: 6,
             drops: [['raw_meat', 2, 2, 1], ['tusk', 1, 1, 0.7]] },
  bear:    { name: 'Bear', color: '#4a3426', hp: 110, speed: 52, behavior: 'territorial', sight: 64, dmg: 20, w: 16, h: 8,
             drops: [['bear_pelt', 1, 1, 1], ['raw_meat', 3, 4, 1]] },
  chicken: { name: 'Chicken', color: '#efece4', hp: 4, speed: 34, behavior: 'skittish', sight: 30, owned: true, w: 7, h: 4,
             drops: [['raw_meat', 1, 1, 1], ['feather', 1, 3, 1]] },
  cow:     { name: 'Cow', color: '#efece4', hp: 45, speed: 22, behavior: 'docile', sight: 0, owned: true, w: 16, h: 7,
             drops: [['raw_meat', 3, 4, 1], ['pelt', 1, 2, 1]] },
};
