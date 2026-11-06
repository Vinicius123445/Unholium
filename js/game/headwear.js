'use strict';
// What people wear on their heads and faces says who they are. Set once on everyone in the book, by trade and company, never on children.
(() => {
const pick = (r, a) => r.pick(a), gangColor = { gang_red: '#a02a2a', gang_blue: '#2a4a8a' };
const dress = (id, d) => {
  const L = d.look; if (!L || d.kid || L.kid || L.hat === null) return;
  const r = new G.RNG('wear-' + id), n = (d.name || '') + ' ' + (d.job || ''), f = d.faction || '';
  if (/doctor|nurse|surgeon|medic|paramedic|dentist/i.test(n)) { if (r.chance(0.55)) L.mask = 'surgical'; return; }
  if (/firefighter/i.test(n)) { L.hat = L.hat || 'helmet'; L.hatColor = L.hatColor || '#b83020'; return; }
  if (/builder|construction|worker|miner|mechanic|welder/i.test(n)) { if (!L.hat && r.chance(0.6)) { L.hat = 'hardhat'; L.hatColor = '#d8b020'; } return; }
  if (/farmer|rancher|gardener/i.test(n)) { if (!L.hat) L.hat = 'straw'; return; }
  if (/lawyer|banker|mayor|judge|boss|detective/i.test(n)) { if (!L.hat && r.chance(0.35)) { L.hat = 'fedora'; L.hatColor = pick(r, ['#2a2a30', '#3a3028', '#20242c']); } return; }
  if (gangColor[f]) { if (!L.hat && r.chance(0.5)) { L.hat = 'bandana'; L.hatColor = gangColor[f]; } if (r.chance(0.22)) { L.mask = 'bandana'; L.maskColor = gangColor[f]; } return; }
  if (d.mugger || /bandit|criminals|punks/.test(f)) { const k = r.int(0, 9); if (k < 3) { L.mask = 'bandana'; L.maskColor = pick(r, ['#2a2a30', '#7a1e22', '#3a4a3a']); } else if (k < 5) { L.mask = 'balaclava'; L.hat = null; } else if (k < 7 && !L.hat) { L.hat = 'hood'; L.hatColor = L.shirt || '#3a3a40'; } else if (!L.hat) { L.hat = 'beanie'; L.hatColor = '#26262c'; } }
};
for (const id of Object.keys(G.NPCS)) { try { dress(id, G.NPCS[id]); } catch (e) { /* a person without a look of their own */ } }
Object.assign(G.LANG_PT.s, {
  'Surgical Mask': 'Máscara Cirúrgica', 'Bandana Mask': 'Bandana no Rosto', 'Hockey Mask': 'Máscara de Hóquei', 'Gas Mask': 'Máscara de Gás', Balaclava: 'Touca Ninja',
  Cap: 'Boné', Beanie: 'Gorro', 'Straw Hat': 'Chapéu de Palha', Fedora: 'Chapéu Fedora', 'Top Hat': 'Cartola', 'Bucket Hat': 'Chapéu Bucket', 'Head Bandana': 'Bandana', 'Hard Hat': 'Capacete de Obra', Helmet: 'Capacete', Hood: 'Capuz',
  'A hat. Equip it to wear it.': 'Um chapéu. Equipe para usar.',
});
})();
