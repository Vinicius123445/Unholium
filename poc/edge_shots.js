window.addEventListener('load', () => setTimeout(() => {
  const pre = document.createElement('pre'); pre.id = 'res';
  PocScene((name) => { const i = new Image(); i.dataset.n = name; i.src = G.renderer.canvas.toDataURL('image/png'); document.body.appendChild(i); }, (e) => { pre.textContent = e ? String(e.stack) : `ok ${G.renderer.W}x${G.renderer.H}`; document.body.appendChild(pre); });
}, 300));
