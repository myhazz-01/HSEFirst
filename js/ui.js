/* ============================================================
   Utilitas UI: modal, toast, pill, tabel, CSV, form
   ============================================================ */
const UI = (function () {
  function icon(path, size) {
    return `<svg viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  }

  function statusPill(status, map) {
    const source = map || CONFIG.STATUS;
    const s = source[status] || { label: status || '—', cls: 'pill-neutral' };
    return `<span class="pill ${s.cls}">${esc(s.label)}</span>`;
  }

  function avatar(name) {
    const parts = String(name || '?').split(/\s+/);
    const ini = (parts[0][0] || '?') + (parts[1] ? parts[1][0] : '');
    return `<div class="avatar">${esc(ini.toUpperCase())}</div>`;
  }

  function toast(msg, type) {
    const root = document.getElementById('toastRoot');
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // Modal promise-based; opsi: {title, body, footer(HTML), wide}
  function modal({ title, body, footer, wide }) {
    const root = document.getElementById('modalRoot');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" style="${wide ? 'max-width:880px' : ''}">
      <div class="modal-head"><h3>${title || ''}</h3>
        <button class="btn-ghost-icon" data-close>${icon('M18 6 6 18M6 6l12 12', 18)}</button></div>
      <div class="modal-body">${body || ''}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
    root.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.querySelector('[data-close]').onclick = close;
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    return { close, root: overlay };
  }

  function confirm({ title, message, confirmLabel, danger }) {
    return new Promise(resolve => {
      const m = modal({
        title: title || 'Konfirmasi',
        body: `<p style="color:var(--text-2)">${message || 'Yakin tindakan ini dilanjutkan?'}</p>`,
        footer: `<button class="btn btn-outline" data-x>Batal</button>
                 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-y>${confirmLabel || 'Ya, Lanjutkan'}</button>`
      });
      m.root.querySelector('[data-x]').onclick = () => { resolve(false); m.close(); };
      m.root.querySelector('[data-y]').onclick = () => { resolve(true); m.close(); };
    });
  }

  function drawer({ title, body, footer }) {
    const root = document.getElementById('drawerRoot');
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    const d = document.createElement('div');
    d.className = 'drawer';
    d.innerHTML = `<div class="card-head"><h3>${title || ''}</h3><button class="btn-ghost-icon" data-close>${icon('M18 6 6 18M6 6l12 12', 18)}</button></div>
      <div>${body || ''}</div>${footer ? `<div class="mt-2">${footer}</div>` : ''}`;
    root.appendChild(overlay); root.appendChild(d);
    function close() { overlay.remove(); d.remove(); }
    d.querySelector('[data-close]').onclick = close;
    overlay.onclick = close;
    return { close, root: d };
  }

  function downloadCSV(filename, csv) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function formData(form) {
    const out = {};
    form.querySelectorAll('[name]').forEach(n => {
      if (n.type === 'checkbox') out[n.name] = n.checked ? (n.value || true) : '';
      else out[n.name] = n.value.trim();
    });
    return out;
  }

  function emptyState(text) {
    return `<div class="empty-state">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#94A3B8" stroke-width="1.5"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
      <div>${text || 'Belum ada data. Tambahkan entri baru melalui tombol di atas.'}</div></div>`;
  }

  function statCard({ label, value, small, icon, tone, foot }) {
    return `<div class="stat-card">
      <div class="stat-top"><span class="stat-label">${label}</span>
        <span class="stat-icon ic-${tone || 'indigo'}">${icon || ''}</span></div>
      <div class="stat-value">${value}${small ? `<small>${small}</small>` : ''}</div>
      ${foot ? `<div class="stat-foot">${foot}</div>` : ''}
    </div>`;
  }

  return { icon, statusPill, avatar, toast, modal, confirm, drawer, downloadCSV, formData, emptyState, statCard };
})();
