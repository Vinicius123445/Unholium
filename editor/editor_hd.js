'use strict';
// Unholium Creation Tool: the game's newest look in the editor.
//   Walls: north-south runs draw as one continuous wall top, exactly like the game (G.wallTop).

//   Menus: the File / Edit / View / Tools / Help menu bar and the status bar of the new window chrome.
(() => {
const E = window.Editor, A = G.assets, $ = (id) => document.getElementById(id);
if (!E) return;
// ---------------------------------------------------------------- walls like the game
const isWall = (m, tx, ty) => { if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false; const d = G.TILES[m.ground[ty * m.w + tx]]; return !!(d && d.wall && d.tex); };
const _dt = E.drawTile;
E.drawTile = function (m, tx, ty, inner) {
  _dt.call(this, m, tx, ty);
  if (G.wallTop && isWall(m, tx, ty) && isWall(m, tx, ty + 1)) {
    const def = G.TILES[m.ground[ty * m.w + tx]], img = G.wallTop(def.tex, G.util.hash2(tx, ty, 7), isWall(m, tx, ty - 1));
    if (img) m.canvas.getContext('2d').drawImage(img, tx * 16, ty * 16);
  }
  if (!inner && ty > 0) this.drawTile(m, tx, ty - 1, true);   // the tile above may now be (or stop being) a wall top
};
// ---------------------------------------------------------------- menus
const MENUS = {
  File: [['New World', 'new', 'Ctrl+N'], ['Open World…', 'open', 'Ctrl+O'], '-', ['Save', 'save', 'Ctrl+S'], ['Save As…', 'saveAs', 'Ctrl+Shift+S'], '-', ['Play This World', 'play', 'F5']],
  Edit: [['Undo', 'undo', 'Ctrl+Z'], ['Redo', 'redo', 'Ctrl+Y']],
  View: [['Animation Preview…', 'anim'], '-', ['Show Grid', 'v:grid'], ['Show Buildings', 'v:buildings'], ['Show Points', 'v:points'], ['Show Exits', 'v:exits'], ['Show NPCs', 'v:npcs'], ['Show Containers', 'v:chests'], ['Show Roofs', 'v:roofs']],
  Tools: [['Check World for Problems', 'check'], '-', ['Maps', 't:maps'], ['NPCs', 't:npcs'], ['Items', 't:items'], ['World', 't:world']],
  Help: [['Keys and Tools', 'help'], ['About Unholium Creation Tool', 'about'], '-', ['Language: English', 'lang']],
};
function buildMenus() {
  const bar = $('menubar'); if (!bar) return;
  for (const name in MENUS) {
    const top = document.createElement('div'); top.className = 'mtop'; top.textContent = name;
    const drop = document.createElement('div'); drop.className = 'mdrop';
    for (const it of MENUS[name]) {
      if (it === '-') { const s = document.createElement('div'); s.className = 'msep'; drop.appendChild(s); continue; }
      const [label, cmd, key] = it, row = document.createElement('div'); row.className = 'mitem';
      row.innerHTML = `<span>${label}</span><span class="mkey">${key || ''}</span>`;
      if (cmd.startsWith('v:')) { const k = cmd.slice(2); const sync = () => row.classList.toggle('checked', !!E.show[k]); sync(); row.onclick = () => { E.show[k] = !E.show[k]; sync(); E.miniDirty = true; close(); }; }
      else if (cmd.startsWith('t:')) row.onclick = () => { const b = document.querySelector(`#tabs button[data-tab="${cmd.slice(2)}"]`); if (b) b.click(); close(); };
      else if (cmd === 'anim') row.onclick = () => { close(); E.animPreview(); };
      else if (cmd === 'lang') row.onclick = () => { close(); window.EditorI18n.set(!window.EditorI18n.on); };
      else if (cmd === 'about') row.onclick = () => { close(); E.toast('Unholium Creation Tool — build and edit the world of Unholium.'); };
      else row.onclick = () => { close(); E.cmd(cmd); };
      drop.appendChild(row);
    }
    top.appendChild(drop);
    top.onmousedown = (e) => { if (e.target !== top) return; const open = top.classList.contains('open'); close(); if (!open) top.classList.add('open'); };
    top.onmouseenter = () => { if (bar.querySelector('.mtop.open') && !top.classList.contains('open')) { close(); top.classList.add('open'); } };
    bar.appendChild(top);
  }
  const close = () => { for (const t of bar.querySelectorAll('.mtop.open')) t.classList.remove('open'); };
  document.addEventListener('mousedown', (e) => { if (!bar.contains(e.target)) close(); });
}
buildMenus();
// F5 plays, like the menu says
document.addEventListener('keydown', (e) => { if (e.key === 'F5') { e.preventDefault(); E.cmd('play'); } });
// the window title and the status bar's right-hand panes
document.title = 'Unholium Creation Tool';
const sb = $('statusRight');
if (sb) setInterval(() => { const m = E.cur && E.maps[E.cur]; sb.textContent = m ? `${m.meta && m.meta.name ? m.meta.name : E.cur}  |  ${m.w} × ${m.h}  |  zoom ${Math.round(E.view.z * 100)}%` : ''; }, 300);
})();
