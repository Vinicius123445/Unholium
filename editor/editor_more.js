'use strict';
// World Editor, part two: writing what people say and sell.
//   - Dialogues tab: every conversation in the game, and your own. Make a new one (or an editable copy of a
//     built-in one), then edit it node by node: what they say, the player's answers, where each answer
//     leads, what it needs (a flag, an item, money, reputation) and what it does (give or take items or
//     money, set a flag, change reputation, heal, open their shop, turn hostile, start a quest, log a line).
//     Saved in world.json ("dialogues"); the game turns them into real conversations (js/game/worldfile.js).
//   - People: a fixed real name, the line they give for "What do you do here?", a dialogue written here
//     (with a button to edit it), and for shopkeepers the shop's stock, cash and prices ("shops" in world.json).
// Built-in conversations written in code can be copied (their words come along; logic written in code does
// not, and is marked so you can rewrite it).
(() => {
const E = window.Editor;
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in attrs) { if (k === 'on') for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); else if (k === 'style' && typeof attrs[k] === 'string') e.setAttribute('style', attrs[k]); else e[k] = attrs[k]; }
  for (const c of kids) if (c != null) e.append(c);
  return e;
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const ITEM_IDS = () => Object.keys(Object.assign({}, G.ITEMS, E.items || {})).sort();
const sel = (opts, value, onchange, labels) => { const s = el('select', { on: { change: (e) => onchange(e.target.value) } }); for (const o of opts) s.append(el('option', { value: o, textContent: labels ? labels(o) : (o === '' ? '(none)' : o) })); s.value = value == null ? '' : value; return s; };
const inp = (value, onchange, type = 'text', ph = '') => el('input', { type, value: value == null ? '' : value, placeholder: ph, on: { change: (e) => onchange(type === 'number' ? (e.target.value === '' ? null : +e.target.value) : e.target.value) } });

// ---------------------------------------------------------------- the data
const _reset = E.reset, _load = E.load, _files = E.files, _check = E.check, _ui = E.ui, _npcForm = E.npcForm, _snap = E.snap, _restore = E.restore;
E.reset = function () { _reset.apply(this, arguments); this.dialogues = {}; this.shops = {}; };
E.load = function (name, files) { _load.apply(this, arguments); const w = JSON.parse(files['world.json']); this.dialogues = w.dialogues || {}; this.shops = w.shops || {}; this.refreshDialogues(); };
E.files = function () { const out = _files.apply(this, arguments); const w = JSON.parse(out['world.json']); w.dialogues = this.dialogues; w.shops = this.shops; out['world.json'] = JSON.stringify(w); return out; };
E.snap = function () { _snap.apply(this, arguments); const s = this.undo[this.undo.length - 1]; if (s) { s.dialogues = JSON.stringify(this.dialogues); s.shops = JSON.stringify(this.shops); } };
E.restore = function (s) { _restore.apply(this, arguments); if (s.dialogues) this.dialogues = JSON.parse(s.dialogues); if (s.shops) this.shops = JSON.parse(s.shops); this.refreshDialogues(); };
E.check = function () {
  // (the base check shows its own window; dialogue problems are added to the toast)
  const probs = [];
  for (const id in this.dialogues) {
    const D = this.dialogues[id];
    if (!D.start) probs.push(`dialogue ${id}: no "start" node`);
    for (const n in D) for (const ch of D[n].choices || []) {
      if (ch.next && !D[ch.next]) probs.push(`dialogue ${id} / ${n}: "${ch.text}" leads to missing node "${ch.next}"`);
      if (ch.failNext && !D[ch.failNext]) probs.push(`dialogue ${id} / ${n}: "${ch.text}" (cannot pay) leads to missing node "${ch.failNext}"`);
    }
  }
  for (const id in this.npcs) { const d = this.npcs[id]; if (d.dialogue && !G.DIALOGUES[d.dialogue] && !this.dialogues[d.dialogue]) probs.push(`${id}: dialogue "${d.dialogue}" does not exist`); }
  _check.apply(this, arguments);
  if (probs.length) { const b = $('modalBody'); if (b) b.insertAdjacentHTML('beforeend', '<h3>Dialogues</h3>' + probs.slice(0, 40).map((p) => '<p class="small">' + p.replace(/</g, '&lt;') + '</p>').join('')); }
};

// ---------------------------------------------------------------- the Dialogues tab
E.ui = function () {
  _ui.apply(this, arguments);
  const tabs = $('tabs');
  const btn = el('button', { textContent: 'Dialogues' }); btn.dataset.tab = 'dialogues';
  tabs.insertBefore(btn, tabs.querySelector('[data-tab="world"]'));
  const pane = el('section', { className: 'pane hidden', id: 'pane-dialogues' },
    el('div', { className: 'row' }, el('input', { id: 'dlgSearch', placeholder: 'Search dialogues…', on: { input: () => this.refreshDialogues() } }), el('button', { textContent: '+', title: 'A new dialogue', on: { click: () => this.newDialogue() } })),
    el('label', { className: 'small' }, el('input', { type: 'checkbox', id: 'dlgMine', on: { change: () => this.refreshDialogues() } }), ' Only the ones written here'),
    el('div', { className: 'list', id: 'dlgList' }));
  $('pane-world').before(pane);
  // the tab buttons were wired before ours existed: wire them all again
  for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => { for (const x of document.querySelectorAll('#tabs button')) x.classList.toggle('on', x === b); for (const p of document.querySelectorAll('.pane')) p.classList.toggle('hidden', p.id !== 'pane-' + b.dataset.tab); };
  this.dialogues = this.dialogues || {}; this.shops = this.shops || {};
  this.refreshDialogues();
};
E.refreshDialogues = function () {
  const box = $('dlgList'); if (!box) return; box.innerHTML = '';
  const q = ($('dlgSearch').value || '').toLowerCase(), mine = $('dlgMine').checked;
  const ids = [...new Set(Object.keys(this.dialogues).concat(mine ? [] : Object.keys(G.DIALOGUES)))].filter((id) => !q || id.toLowerCase().includes(q)).sort();
  for (const id of ids) {
    const custom = !!this.dialogues[id], users = Object.keys(this.npcs).filter((n) => this.npcs[n].dialogue === id);
    box.append(el('div', { className: 'it' + (this.dlgSel === id ? ' on' : '') + (custom ? ' custom' : ''), title: users.length ? 'Used by: ' + users.join(', ') : '', on: { click: () => { this.dlgSel = id; this.dialogueForm(id); this.refreshDialogues(); } } },
      el('span', { textContent: (custom ? '✎ ' : '') + id + (users.length ? `  (${users.length})` : '') })));
  }
};
E.newDialogue = function (forNpc) {
  this.modal('New dialogue', [{ k: 'id', label: 'Id (letters, numbers, _)', v: forNpc ? forNpc + '_talk' : 'my_dialogue' + (Object.keys(this.dialogues).length + 1) }], (o) => {
    const id = o.id.replace(/[^a-zA-Z0-9_]/g, '_');
    if (this.dialogues[id] || G.DIALOGUES[id]) { this.toast('That id is taken.'); return; }
    this.dialogues[id] = { start: { text: 'Hello there.', common: true, choices: [{ text: 'Goodbye.', next: null }] } };
    if (forNpc && this.npcs[forNpc]) this.npcs[forNpc].dialogue = id;
    this.setDirty(true); this.dlgSel = id; this.refreshDialogues(); this.dialogueForm(id);
  });
};
// a built-in conversation as editable data (words come along; logic written in code does not)
E.copyBuiltin = function (id) {
  const src = G.DIALOGUES[id], out = {};
  for (const n in src) {
    const node = src[n] || {};
    out[n] = {
      text: typeof node.text === 'string' ? node.text : '(This line was written in code. Write what they say here.)',
      common: !!node.common,
      choices: (node.choices || []).map((ch) => ({ text: typeof ch.text === 'string' ? ch.text : '(written in code)', next: typeof ch.next === 'string' ? ch.next : null, note: ch.do || ch.if ? 'Had logic written in code: add conditions and actions here.' : undefined })),
    };
  }
  const nid = id + '_custom'; this.dialogues[nid] = out; this.setDirty(true); this.dlgSel = nid; this.refreshDialogues(); this.dialogueForm(nid);
  this.toast('Copied as "' + nid + '". Give it to someone in their NPC form.');
};
E.dialogueForm = function (id) {
  const box = $('inspector'); box.innerHTML = '';
  const D = this.dialogues[id];
  box.append(el('h3', { textContent: 'Dialogue' }), el('p', { className: 'small', textContent: id }));
  const users = Object.keys(this.npcs).filter((n) => this.npcs[n].dialogue === id);
  box.append(el('p', { className: 'small', textContent: users.length ? 'Used by: ' + users.map((n) => this.npcs[n].name + ' (' + n + ')').join(', ') : 'Nobody uses it yet (pick it in someone\'s NPC form).' }));
  if (!D) {
    box.append(el('p', { className: 'dim', textContent: 'Built into the game. Make an editable copy to change it (then give the copy to the people who should use it).' }),
      el('button', { className: 'accent', textContent: 'Make an editable copy', on: { click: () => this.copyBuiltin(id) } }));
    const src = G.DIALOGUES[id] || {};
    for (const n in src) box.append(el('p', { className: 'small' }, el('b', { textContent: n + ': ' }), typeof src[n].text === 'string' ? src[n].text : '(written in code)'));
    return;
  }
  const ch = () => { this.setDirty(true); };
  const nodes = () => Object.keys(D);
  const render = () => {
    box.querySelectorAll('.dlg-node, .dlg-tail').forEach((x) => x.remove());
    for (const n of nodes()) {
      const node = D[n];
      const wrap = el('div', { className: 'dlg-node', style: 'border:1px solid #3a3a4a;border-radius:4px;padding:6px;margin:6px 0' });
      const head = el('div', { className: 'row' },
        el('b', { textContent: n === 'start' ? 'start (what they say first)' : n }),
        n !== 'start' ? el('button', { textContent: 'Rename', on: { click: () => { const nn = (prompt('New name for this node', n) || '').replace(/[^a-zA-Z0-9_]/g, '_'); if (!nn || D[nn]) return; D[nn] = D[n]; delete D[n]; for (const k in D) for (const c of D[k].choices || []) { if (c.next === n) c.next = nn; if (c.failNext === n) c.failNext = nn; } ch(); render(); } } }) : null,
        n !== 'start' ? el('button', { textContent: 'Delete', on: { click: () => { if (!confirm('Delete node ' + n + '?')) return; delete D[n]; for (const k in D) for (const c of D[k].choices || []) { if (c.next === n) c.next = null; } ch(); render(); } } }) : null);
      wrap.append(head);
      wrap.append(el('textarea', { rows: 3, value: node.text || '', style: 'width:100%', on: { change: (e) => { node.text = e.target.value; ch(); } } }));
      wrap.append(el('label', { className: 'small' }, el('input', { type: 'checkbox', checked: !!node.common, on: { change: (e) => { node.common = e.target.checked; ch(); } } }), ' Also offer the standard options (name, chat, trade, work, romance...)'));
      const t = el('div');
      (node.choices = node.choices || []).forEach((c, i) => {
        const row = el('div', { style: 'border-top:1px dashed #333;padding-top:4px;margin-top:4px' });
        row.append(el('div', { className: 'row' },
          inp(c.text, (v) => { c.text = v; ch(); }, 'text', 'What the player says'),
          sel([''].concat(nodes()), c.next || '', (v) => { c.next = v || null; ch(); }, (o) => (o ? '→ ' + o : '→ (end the conversation)')),
          el('button', { textContent: '✕', title: 'Remove this answer', on: { click: () => { node.choices.splice(i, 1); ch(); render(); } } })));
        if (c.note) row.append(el('p', { className: 'small dim', textContent: c.note }));
        const more = el('details', {}, el('summary', { className: 'small', textContent: 'Needs / does' + (Object.keys(c).some((k) => !['text', 'next', 'note'].includes(k) && c[k] != null && c[k] !== '') ? ' •' : '') }));
        const g = el('div', { className: 'grid2 small' });
        const f = (label, node2) => g.append(el('label', {}, label, node2));
        f('Needs flag', inp(c.ifFlag, (v) => { c.ifFlag = v || undefined; ch(); }));
        f('Needs NOT flag', inp(c.ifNotFlag, (v) => { c.ifNotFlag = v || undefined; ch(); }));
        f('Needs item', sel([''].concat(ITEM_IDS()), c.ifItem || '', (v) => { c.ifItem = v || undefined; ch(); }));
        f('Needs cash ($)', inp(c.ifGold, (v) => { c.ifGold = v || undefined; ch(); }, 'number'));
        f('Needs reputation with', sel([''].concat(Object.keys(G.FACTIONS).concat(Object.keys(G.REGIONS))), (c.ifRep || [])[0] || '', (v) => { c.ifRep = v ? [v, (c.ifRep || [])[1] || 0] : undefined; ch(); }));
        f('...at least', inp((c.ifRep || [])[1], (v) => { if (c.ifRep) c.ifRep[1] = v || 0; ch(); }, 'number'));
        f('Sets flag', inp(c.setFlag, (v) => { c.setFlag = v || undefined; ch(); }));
        f('Player pays ($)', inp(c.pay, (v) => { c.pay = v || undefined; ch(); }, 'number'));
        f('...if they cannot, go to', sel([''].concat(nodes()), c.failNext || '', (v) => { c.failNext = v || undefined; ch(); }));
        f('Player gets ($)', inp(c.gold, (v) => { c.gold = v || undefined; ch(); }, 'number'));
        f('Gives item', sel([''].concat(ITEM_IDS()), (c.give || [])[0] || '', (v) => { c.give = v ? [v, (c.give || [])[1] || 1] : undefined; ch(); }));
        f('...how many', inp((c.give || [])[1], (v) => { if (c.give) c.give[1] = v || 1; ch(); }, 'number'));
        f('Takes item', sel([''].concat(ITEM_IDS()), (c.take || [])[0] || '', (v) => { c.take = v ? [v, (c.take || [])[1] || 1] : undefined; ch(); }));
        f('...how many', inp((c.take || [])[1], (v) => { if (c.take) c.take[1] = v || 1; ch(); }, 'number'));
        f('Reputation with', sel([''].concat(Object.keys(G.FACTIONS).concat(Object.keys(G.REGIONS))), (c.rep || [])[0] || '', (v) => { c.rep = v ? [v, (c.rep || [])[1] || 5] : undefined; ch(); }));
        f('...change by', inp((c.rep || [])[1], (v) => { if (c.rep) c.rep[1] = v || 0; ch(); }, 'number'));
        f('Heals the player', inp(c.heal, (v) => { c.heal = v || undefined; ch(); }, 'number'));
        f('Starts quest (id)', sel([''].concat(Object.keys(G.QUESTS || {})), c.startQuest || '', (v) => { c.startQuest = v || undefined; ch(); }));
        f('Journal line', inp(c.log, (v) => { c.log = v || undefined; ch(); }));
        f('Opens their shop', el('input', { type: 'checkbox', checked: !!c.shop, on: { change: (e) => { c.shop = e.target.checked || undefined; ch(); } } }));
        f('They turn hostile', el('input', { type: 'checkbox', checked: !!c.hostile, on: { change: (e) => { c.hostile = e.target.checked || undefined; ch(); } } }));
        more.append(g); row.append(more);
        t.append(row);
      });
      t.append(el('button', { textContent: '+ Add an answer', on: { click: () => { node.choices.push({ text: 'Goodbye.', next: null }); ch(); render(); } } }));
      wrap.append(t);
      box.append(wrap);
    }
    box.append(el('div', { className: 'row dlg-tail' },
      el('button', { textContent: '+ Add a node', on: { click: () => { let k = nodes().length; while (D['node' + k]) k++; D['node' + k] = { text: '...', choices: [{ text: 'Goodbye.', next: null }] }; ch(); render(); } } }),
      el('button', { textContent: 'Delete this dialogue', on: { click: () => { if (!confirm('Delete dialogue ' + id + '?')) return; delete this.dialogues[id]; for (const n in this.npcs) if (this.npcs[n].dialogue === id) delete this.npcs[n].dialogue; ch(); this.dlgSel = null; this.refreshDialogues(); box.innerHTML = ''; } } })));
  };
  render();
};

// ---------------------------------------------------------------- more about each person
E.npcForm = function (box, id) {
  _npcForm.apply(this, arguments);
  const d = this.npcs[id], ch = () => this.setDirty(true);
  const extra = el('div');
  extra.append(el('h3', { textContent: 'Name and words' }));
  const g = el('div', { className: 'grid2' });
  g.append(this.field('Real name (blank: random)', d.realName || '', (v) => { d.realName = v || undefined; ch(); }));
  g.append(this.field('"What do you do here?"', d.job || '', (v) => { d.job = v || undefined; ch(); }));
  extra.append(g);
  const mine = Object.keys(this.dialogues);
  extra.append(el('div', { className: 'row' },
    el('span', { className: 'small', textContent: 'Dialogue written here: ' }),
    sel([''].concat(mine), mine.includes(d.dialogue) ? d.dialogue : '', (v) => { d.dialogue = v || undefined; ch(); this.inspect(); }),
    el('button', { textContent: 'Edit', on: { click: () => { const did = d.dialogue; if (!did) { this.toast('Pick or make a dialogue first.'); return; } if (!this.dialogues[did] && G.DIALOGUES[did]) this.copyBuiltin(did); else { this.dlgSel = did; this.dialogueForm(did); } } } }),
    el('button', { textContent: 'New', on: { click: () => this.newDialogue(id) } })));
  // the shop, if they keep one
  if (d.shop && G.SHOPS[d.shop]) {
    const sid = d.shop;
    extra.append(el('h3', { textContent: `Their shop: ${(this.shops[sid] || G.SHOPS[sid]).name || sid}` }));
    if (!this.shops[sid]) extra.append(el('button', { textContent: 'Change what this shop sells', on: { click: () => { const s = G.SHOPS[sid]; this.shops[sid] = { name: s.name, gold: s.gold, buyMult: s.buyMult, sellMult: s.sellMult, stock: clone(s.stock) }; ch(); this.inspect(); } } }));
    else {
      const S = this.shops[sid], sg = el('div', { className: 'grid2' });
      sg.append(this.field('Shop name', S.name || '', (v) => { S.name = v; ch(); }), this.field('Shop cash', S.gold || 0, (v) => { S.gold = +v; ch(); }, 'number'));
      sg.append(this.field('Price multiplier (selling to you)', S.buyMult || 1, (v) => { S.buyMult = +v; ch(); }, 'number'), this.field('What they pay you (share)', S.sellMult || 0.5, (v) => { S.sellMult = +v; ch(); }, 'number'));
      extra.append(sg, this.itemTable('Stock (restocks every morning)', S.stock = S.stock || [], ch),
        el('button', { textContent: 'Back to the original stock', on: { click: () => { delete this.shops[sid]; ch(); this.inspect(); } } }));
    }
  }
  // put it just before the buttons at the bottom
  const last = box.lastElementChild;
  box.insertBefore(extra, last);
};
})();
