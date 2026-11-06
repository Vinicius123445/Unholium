'use strict';
// Gang territories: the blocks the Red and Blue gangs fight over (see js/game/gangwar.js).
//   map + x, y, w, h: the block (tiles)      owner: starting owner (null = nobody)
//   adj: neighboring territories a gang can attack from here      hq: the gang's home block (harder to take)
// Owners change during play; the current state lives in world.territories.

G.GANGS = ['gang_red', 'gang_blue'];

G.TERRITORIES = {
  s_nw: { name: 'Southside: Pawn Row', map: 'southside', x: 0, y: 0, w: 46, h: 34, owner: 'gang_red', adj: ['s_ne', 's_sw', 'c_harbor'] },
  s_ne: { name: 'Southside: The Courts', map: 'southside', x: 50, y: 0, w: 46, h: 34, owner: 'gang_red', adj: ['s_nw', 's_se', 'x_sw'] },
  s_sw: { name: 'Southside: Red Block', map: 'southside', x: 0, y: 38, w: 46, h: 34, owner: 'gang_red', hq: 'gang_red', adj: ['s_nw', 's_se'] },
  s_se: { name: 'Southside: Park Blocks', map: 'southside', x: 50, y: 38, w: 46, h: 34, owner: 'gang_red', adj: ['s_ne', 's_sw', 'x_sw'] },
  x_nw: { name: 'Eastside: Tenements', map: 'eastside', x: 0, y: 0, w: 48, h: 36, owner: 'gang_blue', adj: ['x_ne', 'x_sw', 'c_harbor'] },
  x_ne: { name: 'Eastside: The Docks', map: 'eastside', x: 52, y: 0, w: 34, h: 36, owner: 'gang_blue', hq: 'gang_blue', adj: ['x_nw', 'x_se'] },
  x_sw: { name: 'Eastside: The Lots', map: 'eastside', x: 0, y: 40, w: 48, h: 32, owner: 'gang_blue', adj: ['x_nw', 'x_se', 's_ne', 's_se'] },
  x_se: { name: 'Eastside: Cold Storage', map: 'eastside', x: 52, y: 40, w: 34, h: 32, owner: 'gang_blue', adj: ['x_ne', 'x_sw'] },
  c_harbor: { name: 'Center: Harbor Front', map: 'city', x: 56, y: 63, w: 56, h: 15, owner: null, adj: ['s_nw', 'x_nw'] },
};
for (const id in G.TERRITORIES) G.TERRITORIES[id].id = id;

G.GANG_WAR = {
  raidChancePerHour: 0.1,      // chance a gang starts an attack each hour (when none is going on)
  raidHours: 2,                // how long an attack lasts
  attackers: 4, defenders: 3,  // fighters spawned when you are there to see it
  dayMembers: 1, nightMembers: 3,
  killControl: 6,              // control a gang loses when one of its members dies in its own territory
  winControl: 50,              // control lost by the defender when an attack succeeds
  holdControl: 15,             // control gained by the defender when an attack fails
  dailyRegen: 5,
};
