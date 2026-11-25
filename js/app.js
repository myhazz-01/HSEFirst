/* ============================================================
   SAFETY FIRST — HSE SPA (Vanilla JS, hash router)
   Arsitektur: frontend statis ↔ GAS REST (lihat Kode.gs)
   ============================================================ */

const App = {
  cache: {},
  current: 'dashboard',
  settings: {},
  query: '',
  pendingCount: 0,
  dash: null
};
const Views = {};

/* ---------------- Util data ---------------- */
async function loadSheet(sheet, force) {
  if (!force && App.cache[sheet]) return App.cache[sheet];
  const r = await Api.list(sheet);
  App.cache[sheet] = r.success ? r.data : [];
  return App.cache[sheet];
}
async function saveRecord(sheet, data, msg) {
  const r = await Api.post('save', { sheet, data });
  if (r.success) { UI.toast(r.message || msg || 'Data tersimpan.', 'ok'); delete App.cache[sheet]; }
  else UI.toast(r.message || 'Gagal menyimpan.', 'err');
  return r;
}
async function approve(sheet, id) {
  const r = await Api.post('approve', { sheet, id });
  if (r.success) { UI.toast('Berkas disetujui Owner.', 'ok'); delete App.cache[sheet]; route(); }
  else UI.toast(r.message, 'err');
}
async function rejectRow(sheet, id) {
  const m = UI.modal({
    title: 'Kembalikan / Tolak Dokumen ke Staff HSE',
    body: `
      <div class="field"><span>Kategori Alasan Penolakan <span class="req">*</span></span>
        <select name="alasan" id="rejAlasan">
          <option value="Uji Gas Belum Memenuhi (Masa Uji > 2 Jam)">Uji Gas Belum Memenuhi (Masa Uji > 2 Jam)</option>
          <option value="APD tidak lengkap / tidak standar">APD tidak lengkap / tidak standar</option>
          <option value="Kualifikasi petugas belum memenuhi syarat">Kualifikasi petugas belum memenuhi syarat</option>
          <option value="Dokumen/JSA belum lengkap">Dokumen/JSA belum lengkap</option>
          <option value="Temuan inspeksi belum ditindaklanjuti">Temuan inspeksi belum ditindaklanjuti</option>
        </select></div>
      <div class="field"><span>Catatan Wajib Perbaikan untuk Tim HSE Lapangan <span class="req">*</span></span>
        <textarea name="catatan" id="rejCatatan" placeholder="Jelaskan secara spesifik poin K3 yang harus dipenuhi sebelum izin dilanjutkan…"></textarea></div>
      <p class="small muted">Status berkas otomatis terkunci dan tidak dapat dieksekusi di lapangan.</p>`,
    footer: `<button class="btn btn-outline" data-x>Batal</button>
      <button class="btn btn-danger" data-y>Kembalikan ke Staff HSE</button>`
  });
  m.root.querySelector('[data-x]').onclick = () => m.close();
  m.root.querySelector('[data-y]').onclick = async () => {
    const alasan = m.root.querySelector('#rejAlasan').value;
    const catatan = m.root.querySelector('#rejCatatan').value.trim();
    if (!catatan) { UI.toast('Catatan perbaikan wajib diisi.', 'err'); return; }
    const r = await Api.post('reject', { sheet, id, alasan, catatan });
    if (r.success) { UI.toast('Berkas dikembalikan ke Staff HSE.', 'ok'); m.close(); delete App.cache[sheet]; route(); }
    else UI.toast(r.message, 'err');
  };
}
async function removeRow(sheet, id, label) {
  const ok = await UI.confirm({ title: 'Hapus Data', message: `Hapus ${label || 'data'} ini secara permanen? Tindakan hanya dapat dilakukan Owner.`, danger: true, confirmLabel: 'Hapus Permanen' });
  if (!ok) return;
  const r = await Api.post('remove', { sheet, id });
  if (r.success) { UI.toast('Data dihapus Owner.', 'ok'); delete App.cache[sheet]; route(); }
  else UI.toast(r.message, 'err');
}
function parseJ(s) { try { return JSON.parse(s || '[]'); } catch (e) { return []; } }
function num(v) { const n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }

/* ---------------- Komponen tabel & header ---------------- */
function pageHead({ title, sub, actions }) {
  return `<div class="page-head">
    <div><div class="breadcrumb">Safety First › <b>${title}</b></div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
    <div class="page-actions">${actions || ''}</div></div>`;
}
function table(columns, rows, actionCol) {
  const head = columns.map(c => `<th>${c.label}</th>`).join('');
  const body = rows.length ? rows.map((r, i) =>
    `<tr>${columns.map(c => `<td>${c.render ? c.render(r, i) : esc(r[c.key])}</td>`).join('')}${actionCol ? `<td style="text-align:right;white-space:nowrap">${actionCol(r)}</td>` : ''}</tr>`
  ).join('') : '';
  return `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap">
    <table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    ${rows.length ? `<div class="table-foot"><span>Menampilkan ${rows.length} entri</span></div>` : ''}</div>
    ${rows.length ? '' : UI.emptyState()}`;
}
function field(name, label, type, value, opts, required) {
  const req = required ? ' <span class="req">*</span>' : '';
  let control;
  if (type === 'select') {
    control = `<select name="${name}">${(opts || []).map(o => `<option value="${o.v}" ${o.v === value ? 'selected' : ''}>${o.t}</option>`).join('')}</select>`;
  } else if (type === 'textarea') {
    control = `<textarea name="${name}" placeholder="${opts || ''}">${esc(value || '')}</textarea>`;
  } else {
    control = `<input type="${type || 'text'}" name="${name}" value="${esc(value || '')}" placeholder="${opts || ''}">`;
  }
  return `<label class="field"><span>${label}${req}</span>${control}</label>`;
}
function searchFilterBar(extraHTML) {
  return `<div class="filter-bar">
    <div class="search-input">${UI.icon('m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 15)}
      <input type="search" id="fSearch" placeholder="Cari kata kunci…"></div>${extraHTML || ''}</div>`;
}
function bindSearch(rows, filterFn) {
  const el = document.getElementById('fSearch');
  if (!el) return;
  el.addEventListener('input', () => { App.query = el.value.toLowerCase(); filterFn(); });
}

/* ---------------- Kerangka aplikasi ---------------- */
function showLogin() {
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  const name = (App.settings.APP_NAME) || CONFIG.APP_DEFAULT_NAME;
  document.getElementById('loginAppName').textContent = name;
}
function fillUser() {
  const u = Auth.user(); if (!u) return;
  ['sideUserName', 'topUserName'].forEach(id => document.getElementById(id).textContent = u.nama);
  const roleLabel = u.peran === 'owner' ? 'HSE Owner' : 'Staff HSE';
  document.getElementById('topUserRole').textContent = roleLabel;
  document.getElementById('sideUserRole').textContent = u.peran === 'owner' ? 'OWNER' : 'STAFF';
  document.getElementById('sideUserRole').className = 'pill ' + (u.peran === 'owner' ? 'pill-owner' : 'pill-staff');
  const ini = (u.nama[0] || 'A').toUpperCase();
  document.getElementById('sideAvatar').textContent = ini;
  document.getElementById('topAvatar').textContent = ini;
}
function renderNav() {
  const items = CONFIG.NAV.filter(n => Auth.can(n.roles));
  document.getElementById('sideNav').innerHTML = items.map(n =>
    `<button class="nav-item ${App.current === n.key ? 'active' : ''}" data-nav="${n.key}">
      ${UI.icon(n.icon, 18)}<span>${n.label}</span>
      ${n.key === 'persetujuan' && App.pendingCount ? `<i class="nav-badge">${App.pendingCount}</i>` : ''}
    </button>`).join('');
  document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => location.hash = '#/' + b.dataset.nav);
}
function renderBottomNav() {
  const items = CONFIG.BOTTOM_NAV.map(k => CONFIG.NAV.find(n => n.key === k)).filter(n => n && Auth.can(n.roles));
  document.getElementById('bottomNav').innerHTML = items.map(n =>
    `<button class="bn-item ${App.current === n.key ? 'active' : ''}" data-bn="${n.key}">${UI.icon(n.icon, 20)}<span>${n.label.split(' ')[0]}</span></button>`).join('');
  document.querySelectorAll('[data-bn]').forEach(b => b.onclick = () => location.hash = '#/' + b.dataset.bn);
}
async function ensureSettings() {
  const r = await Api.get('config');
  if (r.success) App.settings = r.settings || {};
  applyTheme(App.settings.THEME);
  const name = App.settings.APP_NAME || CONFIG.APP_DEFAULT_NAME;
  document.title = name + ' — HSE System';
  ['sideAppName'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = name; });
}
async function loadPendingCount() {
  const r = await Api.get('pendingQueue');
  App.pendingCount = r.success ? r.total : 0;
  const b = document.getElementById('bellBadge');
  if (b) { b.textContent = App.pendingCount; b.style.display = App.pendingCount ? 'flex' : 'none'; }
}

async function route() {
  if (!Auth.session()) { await ensureSettings(); showLogin(); return; }
  await ensureSettings();
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  let hash = (location.hash || '').replace('#/', '');
  if (!hash || !Views[hash]) hash = 'dashboard';
  App.current = hash;
  const def = CONFIG.NAV.find(n => n.key === hash);
  if (def && !Auth.can(def.roles)) { UI.toast('Anda tidak memiliki hak akses ke modul tersebut.', 'err'); App.current = 'dashboard'; hash = 'dashboard'; }
  renderNav(); renderBottomNav(); fillUser();
  await loadPendingCount();
  const view = document.getElementById('view');
  view.innerHTML = `<div class="empty-state">Memuat data HSE…</div>`;
  try { await Views[hash](view); } catch (err) { console.error(err); view.innerHTML = `<div class="card"><b>Gagal memuat modul.</b><p class="muted">${esc(err.message)}</p></div>`; }
  window.scrollTo(0, 0);
}

/* ---------------- Dashboard ---------------- */
Views.dashboard = async function (view) {
  const r = await Api.get('dashboard');
  if (!r.success) { view.innerHTML = `<div class="card">${esc(r.message)}</div>`; return; }
  App.dash = r; const s = r.stats;
  const money = n => Number(n).toLocaleString('id-ID');

  view.innerHTML = `
  ${pageHead({
    title: 'HSE Executive Dashboard',
    sub: 'Ringkasan performa keselamatan, kepatuhan izin kerja (PTW), temuan inspeksi, dan mitigasi risiko operasional.',
    actions: `
      <button class="btn btn-outline btn-sm" id="dashExport">${UI.icon('M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2', 15)} Ekspor</button>
      <button class="btn btn-primary btn-sm" id="dashPtw">+ Buat PTW</button>
      <button class="btn btn-urgent btn-sm" id="dashIncident">+ Lapor Insiden</button>`
  })}
  <div class="grid grid-cols-4 mb-1">
    ${UI.statCard({ label: 'Total Pekerja', value: money(s.totalPekerja), small: 'orang', tone: 'indigo', icon: UI.icon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 18), foot: `98 Aktif di Lapangan` })}
    ${UI.statCard({ label: 'Kontraktor', value: money(s.totalKontraktor), small: 'vendor', tone: 'blue', icon: UI.icon('M17 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8', 18), foot: 'Vendor aktif' })}
    ${UI.statCard({ label: 'Insiden LTI', value: money(s.insidenLTI), small: 'Aman', tone: 'green', icon: UI.icon('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 18), foot: 'Zero Accident Target' })}
    ${UI.statCard({ label: 'Near Miss', value: money(s.nearMiss), small: 'Review', tone: 'orange', icon: UI.icon('M12 9v4m0 4h.01', 18), foot: 'Dilaporkan Pekan Ini' })}
    ${UI.statCard({ label: 'PTW Aktif', value: money(s.ptwTotal), small: `(${s.ptwMenunggu} menunggu)`, tone: 'indigo', icon: UI.icon('M9 12l2 2 4-4M21 12c0 5-4 8-9 9-5-1-9-4-9-9V5l9-3 9 3v7z', 18), foot: `${s.ptwDisetujui} Disetujui` })}
    ${UI.statCard({ label: 'Temuan Terbuka', value: money(s.inspeksiTerbuka), small: 'Open', tone: 'orange', icon: UI.icon('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 18), foot: 'Butuh tindak lanjut CAPA' })}
    ${UI.statCard({ label: 'APD Perlu Cek', value: money(s.apdMendekatiExpired), small: 'unit', tone: 'red', icon: UI.icon('M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z', 18), foot: 'Mendekati masa berlaku (<30 hari)' })}
    ${UI.statCard({ label: 'Sertifikat Kritis', value: money(s.sertifikatKritis), small: 'orang', tone: 'red', icon: UI.icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z', 18), foot: 'Perlu perpanjangan' })}
  </div>

  <div class="grid grid-cols-2 mb-1">
    <div class="card">
      <div class="card-head"><div><h3>Tren Insiden & Near Miss Bulanan</h3><div class="hint">Periode 6 bulan terakhir</div></div>
        <div class="legend"><span><i style="background:#4F46E5"></i>Near Miss</span><span><i style="background:#EF4444"></i>Kecelakaan (LTI)</span></div></div>
      <div id="dashLine" style="height:230px"></div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Status Permit to Work (PTW)</h3><div class="hint">Total ${s.ptwTotal} pengajuan</div></div></div>
      <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
        <div id="dashDonut" style="width:180px;height:180px"></div>
        <div style="flex:1;min-width:180px;display:flex;flex-direction:column;gap:.5rem" id="dashPtwLegend"></div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-2 mb-1">
    <div class="card">
      <div class="card-head"><h3>Unsafe Action vs Unsafe Condition</h3><span class="hint">Distribusi observasi lapangan</span></div>
      <div id="dashStack"></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Capaian KPI HSE (Target vs Realisasi)</h3><span class="hint">Periode berjalan</span></div>
      <div id="dashKpi" style="display:flex;flex-direction:column;gap:.9rem"></div>
    </div>
  </div>

  <div class="grid grid-cols-2">
    <div class="card">
      <div class="card-head"><h3>Temuan Inspeksi Terbaru</h3><button class="btn btn-ghost btn-sm" data-nav-goto="inspeksi">Lihat Semua</button></div>
      ${table([
        { label: 'Inspeksi / Area', render: r => `<b class="mono">${esc(r.kode || '-')}</b><div class="small muted">${esc(r.area || r.jenisNama || '-')}</div>` },
        { label: 'Jenis', render: r => esc(r.jenisNama || '-') },
        { label: 'Temuan', render: r => { const t = parseJ(r.temuan); return t.length ? esc(t[0].deskripsi || '-') : '<span class="muted">Nihil / 0 Temuan</span>'; } },
        { label: 'Status', render: r => UI.statusPill(r.status) }
      ], r.temuanTerbaru.slice(0, 5), r => `
        ${r.status === 'pending' && Auth.isOwner() ? `<button class="btn btn-primary btn-sm" data-approve="${r.id}">Setujui</button>` : ''}
        <button class="icon-btn" data-detail-inspeksi="${r.id}" title="Detail">${UI.icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 15)}</button>`)}
    </div>
    <div class="card">
      <div class="card-head"><h3>PTW Menunggu Persetujuan ${App.pendingCount ? `<span class="pill pill-warning">${App.pendingCount}</span>` : ''}</h3><button class="btn btn-ghost btn-sm" data-nav-goto="persetujuan">Semua PTW</button></div>
      ${table([
        { label: 'No. PTW', render: r => `<b class="mono">${esc(r.nomor)}</b><div class="small muted">${esc(r.kategori || '-')}</div>` },
        { label: 'Pemohon', render: r => esc(r.pemohon || r.dibuatOleh || '-') },
        { label: 'Tanggal', render: r => fmtDate(r.tglMulai || r.createdAt) },
        { label: 'Aksi Owner', render: r => `<button class="btn btn-success btn-sm" data-approve="${r.id}">Setujui</button> <button class="btn btn-outline btn-sm" data-detail-doc="${r.id}">Tinjau</button>` }
      ], r.ptwMenungguList)}
      <p class="small muted mt-1">Setiap izin kerja panas & ruang terbatas wajib dilengkapi JSA dan alat gas detector terkalibrasi.</p>
    </div>
  </div>`;

  // Grafik tren
  Charts.line(document.getElementById('dashLine'), r.trenBulanan.map(m => m.label), [
    { name: 'Near Miss', color: '#4F46E5', values: r.trenBulanan.map(m => m.nearMiss) },
    { name: 'LTI', color: '#EF4444', values: r.trenBulanan.map(m => m.lti) }
  ]);
  // Donut PTW
  const seg = [
    { label: 'Disetujui', value: r.ptwStatus.disetujui, color: '#16A34A' },
    { label: 'Menunggu', value: r.ptwStatus.menunggu, color: '#F59E0B' },
    { label: 'Ditolak', value: r.ptwStatus.ditolak, color: '#DC2626' }
  ];
  Charts.donut(document.getElementById('dashDonut'), seg, s.ptwTotal);
  document.getElementById('dashPtwLegend').innerHTML = seg.map(x =>
    `<div class="row spread small"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${x.color};margin-right:6px"></i>${x.label}</span><b>${x.value}</b></div>`).join('');
  // Stack unsafe action/condition (agregasi lokasi)
  const locs = {};
  r.temuanTerbaru.forEach(() => {});
  const insiden = await loadSheet('Insiden_Accident');
  insiden.forEach(i => { const l = i.lokasi || 'Lainnya'; locs[l] = locs[l] || { a: 0, b: 0 }; if (i.kategori === 'unsafe_action') locs[l].a++; else if (i.kategori === 'unsafe_condition') locs[l].b++; });
  const stackRows = Object.entries(locs).slice(0, 5).map(([label, v]) => ({ label, a: v.a, b: v.b }));
  Charts.hStack(document.getElementById('dashStack'), stackRows.length ? stackRows : [{ label: 'Belum ada observasi', a: 0, b: 0 }]);
  // KPI progress
  document.getElementById('dashKpi').innerHTML = (r.kpi || []).slice(0, 5).map(k => {
    const target = num(k.target), real = num(k.realisasi);
    const pct = target ? Math.min(100, Math.round(real / target * 100)) : 0;
    return `<div><div class="row spread small"><b>${esc(k.nama)}</b><span class="muted">${money(real)} / ${money(target)} ${esc(k.satuan || '')}</span></div>
      <div class="progress mt-1 ${k.status === 'tercapai' ? 'g' : ''}"><i style="width:${pct}%"></i></div></div>`;
  }).join('') || '<p class="muted small">Belum ada indikator KPI. Tambahkan pada modul Report & KPI.</p>';

  // Aksi cepat
  document.getElementById('dashPtw').onclick = () => DocForm.open('PTW');
  document.getElementById('dashIncident').onclick = () => IncidentForm.open();
  document.getElementById('dashExport').onclick = async () => {
    const rr = await Api.get('exportCsv', { sheet: 'Insiden_Accident' });
    if (rr.success) UI.downloadCSV(rr.filename, rr.csv); else UI.toast(rr.message, 'err');
  };
  view.querySelectorAll('[data-nav-goto]').forEach(b => b.onclick = () => location.hash = '#/' + b.dataset.navGoto);
  view.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => approve('Dokumen_K3', b.dataset.approve));
  view.querySelectorAll('[data-detail-doc]').forEach(b => b.onclick = () => DocView.detail(b.dataset.detailDoc));
  view.querySelectorAll('[data-detail-inspeksi]').forEach(b => b.onclick = () => InspeksiView.detail(b.dataset.detailInspeksi));
};

/* ================= MODUL: DOKUMEN K3 (HIRADC / JSA / PTW) ================= */
Views.dokumen = async function (view) {
  const rows = await loadSheet('Dokumen_K3');
  const st = { tab: 'Semua', q: '', status: '', area: '' };
  const counts = t => rows.filter(r => t === 'Semua' || r.tipe === t).length;

  function render() {
    let list = rows.filter(r => (st.tab === 'Semua' || r.tipe === st.tab)
      && (!st.status || r.status === st.status)
      && (!st.area || r.area === st.area)
      && (!st.q || (r.judul + ' ' + r.nomor + ' ' + (r.dibuatOleh || '')).toLowerCase().includes(st.q)));

    const stats = [
      UI.statCard({ label: 'Total Terarsip', value: rows.length, tone: 'indigo', icon: UI.icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z', 18), foot: `${counts('HIRADC') + counts('JSA') + counts('PTW')} dokumen aktif` }),
      UI.statCard({ label: 'Menunggu Review', value: counts('Semua') && rows.filter(r => r.status === 'pending').length, tone: 'orange', icon: UI.icon('M12 8v4l3 2', 18), foot: 'Butuh aksi Owner' }),
      UI.statCard({ label: 'PTW Aktif Lapangan', value: rows.filter(r => r.tipe === 'PTW' && r.status === 'approved').length, tone: 'blue', icon: UI.icon('M9 12l2 2 4-4', 18), foot: 'Operasional aktif' }),
      UI.statCard({ label: 'Rata-rata Otorisasi', value: '1.5', small: 'Jam', tone: 'green', icon: UI.icon('M13 2 3 14h7l-1 8 10-12h-7l1-8z', 18), foot: 'SLA Optimal (Target < 2h)' })
    ].join('');

    const areas = [...new Set(rows.map(r => r.area).filter(Boolean))];
    view.innerHTML = pageHead({
      title: 'Dokumen Keselamatan Kerja',
      sub: 'Repositori sentral HIRADC, JSA, dan Permit to Work (PTW) terintegrasi validasi risiko lapangan serta alur verifikasi bertingkat.',
      actions: `<button class="btn btn-primary" id="docNew">+ Buat Dokumen Baru</button>`
    }) + `<div class="grid grid-cols-4 mb-1">${stats}</div>
      <div class="tabs">${['Semua', 'HIRADC', 'JSA', 'PTW'].map(t => `<button class="tab ${st.tab === t ? 'active' : ''}" data-tab="${t}">${t} <span class="count">${counts(t)}</span></button>`).join('')}</div>
      ${searchFilterBar(`
        <select id="fStatus"><option value="">Semua Status</option><option value="approved">Disetujui</option><option value="pending">Menunggu</option><option value="rejected">Ditolak</option><option value="draft">Draft</option></select>
        <select id="fArea"><option value="">Semua Area Kerja</option>${areas.map(a => `<option>${esc(a)}</option>`).join('')}</select>`)}
      ${table([
        { label: 'Nomor Dokumen', render: r => `<b class="mono">${esc(r.nomor || r.id.slice(0, 8))}</b>` },
        { label: 'Tipe', render: r => `<span class="pill ${(CONFIG.DOKUMEN_TIPE[r.tipe] || {}).cls || 'pill-neutral'}">${esc((CONFIG.DOKUMEN_TIPE[r.tipe] || {}).label || r.tipe)}</span>` },
        { label: 'Judul Pekerjaan & Deskripsi', render: r => `<b>${esc(r.judul || '-')}</b><div class="small muted">${esc(r.deskripsi || '')}</div>${r.alasanTolak ? `<div class="small" style="color:var(--red-fg)">Alasan ditolak: ${esc(r.alasanTolak)}</div>` : ''}` },
        { label: 'Area Kerja', render: r => esc(r.area || '-') },
        { label: 'Dibuat Oleh', render: r => esc(r.dibuatOleh || '-') },
        { label: 'Masa Berlaku', render: r => r.tglSelesai ? `${fmtDate(r.tglMulai)} s/d ${fmtDate(r.tglSelesai)}` : '—' },
        { label: 'Status', render: r => UI.statusPill(r.status) }
      ], list, r => `
        <button class="icon-btn" data-docview="${r.id}" title="Detail">${UI.icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 15)}</button>
        <button class="icon-btn" data-docedit="${r.id}" title="Ubah">${UI.icon('M17 3a2.8 2.8 0 0 1 4 4L7 21l-5 1 1-5z', 15)}</button>
        ${r.status === 'pending' && Auth.isOwner() ? `<button class="icon-btn" data-docok="${r.id}" title="Setujui">${UI.icon('M20 6 9 17l-5-5', 15)}</button>
        <button class="icon-btn danger" data-docno="${r.id}" title="Tolak">${UI.icon('M18 6 6 18M6 6l12 12', 15)}</button>` : ''}
        ${Auth.isOwner() ? `<button class="icon-btn danger" data-docdel="${r.id}" title="Hapus">${UI.icon('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6', 15)}</button>` : ''}`)}`;

    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; render(); });
    view.querySelector('#fStatus').onchange = e => { st.status = e.target.value; render(); };
    view.querySelector('#fArea').onchange = e => { st.area = e.target.value; render(); };
    view.querySelector('#fSearch').oninput = e => { st.q = e.target.value.toLowerCase(); render(); };
    view.querySelector('#docNew').onclick = () => DocForm.open('PTW');
    view.querySelectorAll('[data-docview]').forEach(b => b.onclick = () => DocView.detail(b.dataset.docview));
    view.querySelectorAll('[data-docedit]').forEach(b => b.onclick = () => DocForm.open(null, rows.find(x => x.id === b.dataset.docedit)));
    view.querySelectorAll('[data-docok]').forEach(b => b.onclick = () => approve('Dokumen_K3', b.dataset.docok));
    view.querySelectorAll('[data-docno]').forEach(b => b.onclick = () => rejectRow('Dokumen_K3', b.dataset.docno));
    view.querySelectorAll('[data-docdel]').forEach(b => b.onclick = () => removeRow('Dokumen_K3', b.dataset.docdel, 'dokumen'));
  }
  render();
};

const DocForm = {
  open(tipe, record) {
    const rows = App.cache['Dokumen_K3'] || [];
    const nomorBaru = (record && record.nomor) || (({ PTW: 'PTW', JSA: 'JSA', HIRADC: 'HIRA' }[tipe] || 'DOC') + '-2026-' + String(89 + rows.length).padStart(3, '0'));
    let matrix = record ? parseJ(record.matriks) : [{ a: '', b: '', c: '', r: 'Rendah' }];
    const apdChecked = record ? parseJ(record.apd) : ['Safety Helmet', 'Safety Shoes'];
    const gas = record ? parseJ(record.gas) : {};

    const m = UI.modal({
      wide: true,
      title: (record ? 'Ubah' : 'Buat') + ' Dokumen PTW / JSA / HIRADC',
      body: `
      <div class="stepper">
        <div class="step active"><span class="num">1</span> Informasi Umum</div><span class="step-line"></span>
        <div class="step"><span class="num">2</span> Identifikasi Bahaya (JSA)</div><span class="step-line"></span>
        <div class="step"><span class="num">3</span> APD & Uji Gas</div>
      </div>
      <div class="card mb-1"><h3 class="mb-1">1. Informasi Umum</h3>
        <div class="form-grid">
          ${field('tipe', 'Jenis Dokumen', 'select', record ? record.tipe : tipe, [{ v: 'PTW', t: 'Permit to Work (PTW)' }, { v: 'JSA', t: 'Job Safety Analysis (JSA)' }, { v: 'HIRADC', t: 'HIRADC' }], true)}
          ${field('nomor', 'Nomor Dokumen', 'text', nomorBaru)}
          ${field('judul', 'Judul Pekerjaan', 'text', record ? record.judul : '', '', true)}
          ${field('area', 'Lokasi / Area Kerja', 'text', record ? record.area : '', 'cth: Kilang Unit B / Tangki Reaktor C')}
          ${field('pemohon', 'Pemohon Izin', 'text', record ? record.pemohon : Auth.user().nama, '', true)}
          ${field('supervisor', 'Supervisor / PIC Lapangan', 'text', record ? record.supervisor : '')}
          ${field('tglMulai', 'Waktu Mulai Kerja', 'datetime-local', record ? record.tglMulai : '')}
          ${field('tglSelesai', 'Waktu Selesai (maks. 12 jam)', 'datetime-local', record ? record.tglSelesai : '')}
          <div class="full"><span class="field" style="margin-bottom:.4rem"><span>Kategori Bahaya Pekerjaan (boleh lebih dari satu)</span></div>
          <div class="check-grid" style="grid-template-columns:repeat(3,1fr)">
            ${['Hot Work', 'Confined Space', 'Height (>1.8m)', 'Excavation', 'High Voltage', 'Heavy Lifting'].map(c =>
              `<label class="field-check"><input type="checkbox" name="kat" value="${c}" ${(record && (record.kategori || '').includes(c)) || (!record && c === 'Hot Work') ? 'checked' : ''}><span><b>${c}</b></span></label>`).join('')}
          </div></div>
      </div>
      <div class="card mb-1"><div class="card-head"><h3>2. Matriks Identifikasi Bahaya & Mitigasi</h3>
        <button class="btn btn-outline btn-sm" id="mAddRow">+ Tambah Baris Bahaya</button></div>
        <div id="mRows"></div>
      </div>
      <div class="card mb-1"><h3 class="mb-1">3. APD Wajib & Uji Gas Atmosfer</h3>
        <div class="check-grid mb-1">
          ${['Safety Helmet', 'Safety Shoes', 'Kacamata / Shield', 'Full Body Harness', 'Sarung Tangan Las', 'Respirator Gas', 'Earplug / Earmuff', 'Apron Pelindung Dada'].map(a =>
            `<label class="field-check"><input type="checkbox" name="apd" value="${a}" ${apdChecked.includes(a) ? 'checked' : ''}><span><b>${a}</b></span></label>`).join('')}
        </div>
        <div class="form-grid">
          ${field('o2', 'Oksigen (O₂) %', 'text', gas.o2 || '20.9')}
          ${field('lel', 'Gas Mudah Terbakar (LEL) %', 'text', gas.lel || '0')}
          ${field('h2s', 'H₂S (ppm)', 'text', gas.h2s || '0')}
          ${field('co', 'Karbon Monoksida (ppm)', 'text', gas.co || '0')}
        </div>
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button>
        <button class="btn btn-primary" data-y>${record ? 'Simpan Perubahan' : 'Ajukan untuk Persetujuan Owner'}</button>`
    });

    function renderMatrix() {
      const box = m.root.querySelector('#mRows');
      box.innerHTML = `<table class="data" style="min-width:560px"><thead><tr><th style="width:34%">Langkah Pekerjaan</th><th>Potensi Bahaya</th><th>Pengendalian / Mitigasi</th><th style="width:130px">Risiko</th><th></th></tr></thead>
        <tbody>${matrix.map((r, i) => `<tr>
          <td><input class="input" data-m="a" data-i="${i}" value="${esc(r.a)}" placeholder="cth: Pengelasan flange"></td>
          <td><input class="input" data-m="b" data-i="${i}" value="${esc(r.b)}" placeholder="cth: Percikan api"></td>
          <td><input class="input" data-m="c" data-i="${i}" value="${esc(r.c)}" placeholder="cth: Fire watch, APAR siap"></td>
          <td><select class="input" data-m="r" data-i="${i}">${['Rendah', 'Sedang', 'Tinggi'].map(x => `<option ${r.r === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
          <td><button class="icon-btn danger" data-mdel="${i}">${UI.icon('M3 6h18', 14)}</button></td>
        </tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('[data-m]').forEach(inp => inp.oninput = () => { matrix[inp.dataset.i][inp.dataset.m] = inp.value; });
      box.querySelectorAll('[data-mdel]').forEach(b => b.onclick = () => { matrix.splice(Number(b.dataset.mdel), 1); renderMatrix(); });
    }
    renderMatrix();
    m.root.querySelector('#mAddRow').onclick = () => { matrix.push({ a: '', b: '', c: '', r: 'Rendah' }); renderMatrix(); };
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const judul = f.querySelector('[name=judul]').value.trim();
      if (!judul) { UI.toast('Judul pekerjaan wajib diisi.', 'err'); return; }
      const data = {
        id: record ? record.id : undefined,
        nomor: f.querySelector('[name=nomor]').value,
        tipe: f.querySelector('[name=tipe]').value,
        judul,
        deskripsi: f.querySelector('[name=deskripsi]') ? f.querySelector('[name=deskripsi]').value : '',
        area: f.querySelector('[name=area]').value,
        pemohon: f.querySelector('[name=pemohon]').value,
        supervisor: f.querySelector('[name=supervisor]').value,
        tglMulai: f.querySelector('[name=tglMulai]').value,
        tglSelesai: f.querySelector('[name=tglSelesai]').value,
        kategori: [...f.querySelectorAll('[name=kat]:checked')].map(c => c.value).join(', '),
        matriks: JSON.stringify(matrix.filter(r => r.a || r.b)),
        apd: JSON.stringify([...f.querySelectorAll('[name=apd]:checked')].map(c => c.value)),
        gas: JSON.stringify({ o2: f.querySelector('[name=o2]').value, lel: f.querySelector('[name=lel]').value, h2s: f.querySelector('[name=h2s]').value, co: f.querySelector('[name=co]').value })
      };
      const res = await saveRecord('Dokumen_K3', data);
      if (res.success) { m.close(); route(); }
    };
  }
};

const DocView = {
  async detail(id) {
    const rows = await loadSheet('Dokumen_K3');
    const r = rows.find(x => x.id === id); if (!r) return UI.toast('Dokumen tidak ditemukan.', 'err');
    const matriks = parseJ(r.matriks), apd = parseJ(r.apd), gas = parseJ(r.gas);
    const m = UI.modal({
      wide: true, title: `${r.nomor || 'Dokumen'} — ${r.tipe}`,
      body: `
      <div class="kv mb-1">
        <div><div class="k">Judul Pekerjaan</div><div class="v"><b>${esc(r.judul || '-')}</b></div></div>
        <div><div class="k">Status</div><div class="v">${UI.statusPill(r.status)}</div></div>
        <div><div class="k">Area</div><div class="v">${esc(r.area || '-')}</div></div>
        <div><div class="k">Pemohon / Supervisor</div><div class="v">${esc(r.pemohon || '-')} / ${esc(r.supervisor || '-')}</div></div>
        <div><div class="k">Masa Berlaku</div><div class="v">${fmtDate(r.tglMulai)} s/d ${fmtDate(r.tglSelesai)}</div></div>
        <div><div class="k">Kategori</div><div class="v">${esc(r.kategori || '-')}</div></div>
      </div>
      ${matriks.length ? `<div class="card mb-1"><h3 class="mb-1">Matriks JSA</h3>
        <table class="data"><thead><tr><th>Langkah Kerja</th><th>Bahaya</th><th>Mitigasi</th><th>Risiko</th></tr></thead>
        <tbody>${matriks.map(x => `<tr><td>${esc(x.a)}</td><td>${esc(x.b)}</td><td>${esc(x.c)}</td>
        <td><span class="risk-tag ${x.r === 'Tinggi' ? 'risk-high' : x.r === 'Sedang' ? 'risk-mid' : 'risk-low'}">${esc(x.r)}</span></td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="grid grid-cols-2 mb-1">
        <div class="card"><h3 class="mb-1">APD Terpasang</h3><div class="row">${apd.map(a => `<span class="pill pill-success">${esc(a)}</span>`).join('') || '<span class="muted small">Belum ada APD tercatat</span>'}</div></div>
        <div class="card"><h3 class="mb-1">Uji Gas Atmosfer</h3>
          <div class="row">${[['O₂', gas.o2], ['LEL', gas.lel], ['H₂S', gas.h2s], ['CO', gas.co]].map(g => `<div class="sign-card" style="flex:1"><div class="k">${g[0]}</div><div class="v" style="font-size:20px;font-weight:800">${esc(g[1] || '—')}</div></div>`).join('')}</div></div>
      </div>
      ${r.alasanTolak ? `<div class="card" style="border-color:var(--red-bg)"><b style="color:var(--red-fg)">Alasan Penolakan:</b> ${esc(r.alasanTolak)}</div>` : ''}`,
      footer: Auth.isOwner() && r.status === 'pending'
        ? `<button class="btn btn-outline" data-x>Tutup</button>
           <button class="btn btn-outline" data-no>Kembalikan ke Staff</button>
           <button class="btn btn-success" data-y>Setujui & Terbitkan Izin</button>`
        : `<button class="btn btn-outline" data-x>Tutup</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    const y = m.root.querySelector('[data-y]'); if (y) y.onclick = async () => { await approve('Dokumen_K3', r.id); m.close(); };
    const no = m.root.querySelector('[data-no]'); if (no) no.onclick = () => { m.close(); rejectRow('Dokumen_K3', r.id); };
  }
};

/* ================= MODUL: INSPEKSI HSE ================= */
Views.inspeksi = async function (view) {
  const [rows, jenis] = await Promise.all([loadSheet('Inspeksi'), loadSheet('Jenis_Inspeksi')]);
  const st = { tab: 'Semua', q: '', status: '' };

  function render() {
    const list = rows.filter(r => (st.tab === 'Semua' || r.jenisNama === st.tab)
      && (!st.status || r.status === st.status)
      && (!st.q || (r.kode + ' ' + (r.area || '') + ' ' + (r.auditor || '')).toLowerCase().includes(st.q)));
    const open = rows.filter(r => r.status === 'pending').length;
    const closed = rows.filter(r => r.status === 'closed' || r.status === 'approved').length;
    const skorAvg = rows.length ? Math.round(rows.reduce((n, r) => n + num(r.skor), 0) / rows.length) : 0;

    view.innerHTML = pageHead({
      title: 'Inspeksi & Patroli Lapangan',
      sub: 'Pencatatan kepatuhan K3, temuan observasi bahaya (unsafe act/condition), dan pemantauan perbaikan CAPA.',
      actions: `${Auth.isOwner() ? `<button class="btn btn-outline" id="jenisBtn">Kelola Jenis Inspeksi</button>` : ''}
        <button class="btn btn-primary" id="inspNew">+ Inspeksi Baru</button>`
    }) + `<div class="grid grid-cols-4 mb-1">
      ${UI.statCard({ label: 'Inspeksi Terkini', value: rows.length, small: 'berkas', tone: 'indigo', icon: UI.icon('M9 11l3 3L22 4', 18) })}
      ${UI.statCard({ label: 'Temuan Terbuka (Open)', value: open, tone: 'orange', icon: UI.icon('M12 9v4m0 4h.01', 18), foot: 'Butuh aksi' })}
      ${UI.statCard({ label: 'Temuan Selesai (Closed)', value: closed, tone: 'green', icon: UI.icon('M20 6 9 17l-5-5', 18), foot: 'Terselesaikan' })}
      ${UI.statCard({ label: 'Rata-rata Kepatuhan', value: skorAvg + '%', tone: 'blue', icon: UI.icon('M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z', 18), foot: 'Target minimal 90%' })}
    </div>
    <div class="tabs">${['Semua', ...new Set(rows.map(r => r.jenisNama).filter(Boolean))].map(t =>
      `<button class="tab ${st.tab === t ? 'active' : ''}" data-tab="${t}">${t} <span class="count">${rows.filter(r => t === 'Semua' || r.jenisNama === t).length}</span></button>`).join('')}</div>
    ${searchFilterBar(`<select id="fStatus"><option value="">Semua Status Temuan</option><option value="pending">Menunggu Review Owner</option><option value="approved">Disetujui</option><option value="closed">Selesai</option></select>`)}
    ${table([
      { label: 'Kode', render: r => `<b class="mono">${esc(r.kode || r.id.slice(0, 8))}</b>` },
      { label: 'Waktu', render: r => fmtDateTime(r.tanggal || r.createdAt) },
      { label: 'Jenis', render: r => `<span class="pill pill-info pill-plain">${esc(r.jenisNama || '-')}</span>` },
      { label: 'Area', render: r => esc(r.area || '-') },
      { label: 'Auditor', render: r => esc(r.auditor || '-') },
      { label: 'Kepatuhan', render: r => `<div class="row"><span>${esc(r.skor || '—')}%</span><div class="progress" style="width:80px"><i style="width:${num(r.skor)}%"></i></div></div>` },
      { label: 'Temuan', render: r => { const t = parseJ(r.temuan); return t.length ? `<b style="color:var(--red-fg)">${t.length} Temuan</b>` : '<span class="pill pill-success">Nihil / 0 Temuan</span>'; } },
      { label: 'Status Alur', render: r => UI.statusPill(r.status) }
    ], list, r => `
      <button class="icon-btn" data-inspview="${r.id}" title="Detail">${UI.icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 15)}</button>
      ${r.status === 'pending' && Auth.isOwner() ? `<button class="icon-btn" data-inspok="${r.id}" title="Setujui">${UI.icon('M20 6 9 17l-5-5', 15)}</button>
      <button class="icon-btn danger" data-inspno="${r.id}">${UI.icon('M18 6 6 18M6 6l12 12', 15)}</button>` : ''}
      ${Auth.isOwner() ? `<button class="icon-btn danger" data-inspdel="${r.id}">${UI.icon('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6', 15)}</button>` : ''}`)}`;

    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; render(); });
    view.querySelector('#fStatus').onchange = e => { st.status = e.target.value; render(); };
    view.querySelector('#fSearch').oninput = e => { st.q = e.target.value.toLowerCase(); render(); };
    view.querySelector('#inspNew').onclick = () => InspeksiForm.open();
    const jb = view.querySelector('#jenisBtn'); if (jb) jb.onclick = () => JenisMgr.open();
    view.querySelectorAll('[data-inspview]').forEach(b => b.onclick = () => InspeksiView.detail(b.dataset.inspview));
    view.querySelectorAll('[data-inspok]').forEach(b => b.onclick = () => approve('Inspeksi', b.dataset.inspok));
    view.querySelectorAll('[data-inspno]').forEach(b => b.onclick = () => rejectRow('Inspeksi', b.dataset.inspno));
    view.querySelectorAll('[data-inspdel]').forEach(b => b.onclick = () => removeRow('Inspeksi', b.dataset.inspdel, 'inspeksi'));
  }
  render();
};

const InspeksiForm = {
  async open(record) {
    const jenis = await loadSheet('Jenis_Inspeksi');
    let checklist = record ? parseJ(record.hasil) : [];
    let temuan = record ? parseJ(record.temuan) : [{ deskripsi: '', risiko: 'Sedang', tindakan: '', pic: '', due: '', status: 'menunggu' }];

    const m = UI.modal({
      wide: true, title: (record ? 'Ubah' : 'Formulir') + ' Inspeksi & Patroli K3L',
      body: `
      <div class="stepper">
        <div class="step active"><span class="num">1</span> Informasi Umum</div><span class="step-line"></span>
        <div class="step"><span class="num">2</span> Checklist Lapangan</div><span class="step-line"></span>
        <div class="step"><span class="num">3</span> Temuan & CAPA</div><span class="step-line"></span>
        <div class="step"><span class="num">4</span> Tanda Tangan</div>
      </div>
      <div class="card mb-1"><h3 class="mb-1">1. Informasi Umum</h3>
        <div class="form-grid">
          ${field('jenisId', 'Jenis Inspeksi', 'select', record ? record.jenisId || '' : '', [{ v: '', t: 'Pilih jenis inspeksi' }].concat(jenis.map(j => ({ v: j.id, t: j.nama }))), true)}
          ${field('tanggal', 'Tanggal & Waktu Audit', 'datetime-local', record ? record.tanggal : new Date().toISOString().slice(0, 16), '', true)}
          ${field('auditor', 'Auditor / Inspektur HSE', 'text', record ? record.auditor : Auth.user().nama, '', true)}
          ${field('supervisor', 'Supervisor Area', 'text', record ? record.supervisor : '')}
          ${field('area', 'Area Operasional', 'text', record ? record.area : '', 'cth: Gudang B3 / Workshop Mesin B')}
          ${field('kondisi', 'Kondisi Cuaca / Shift', 'select', record ? record.kondisi : 'Cerah, Operasional Shift 1', [{ v: 'Cerah, Operasional Shift 1', t: 'Shift 1' }, { v: 'Mendung, Shift 2 Berjalan', t: 'Shift 2' }])}
        </div>
      </div>
      <div class="card mb-1"><div class="card-head"><h3>2. Evaluasi Checklist K3L</h3><span class="hint" id="skorHint">Centang Sesuai untuk menghitung skor</span></div>
        <div id="ckRows"></div>
      </div>
      <div class="card mb-1"><div class="card-head"><h3>3. Temuan Kritis & Tindakan Korektif (CAPA)</h3>
        <button class="btn btn-outline btn-sm" id="tAdd">+ Tambah Temuan</button></div>
        <div id="tRows"></div>
      </div>
      <div class="card"><h3 class="mb-1">4. Pengesahan Petugas Lapangan</h3>
        <div class="form-grid">
          ${field('ttdAuditor', 'Nama Auditor (terverifikasi)', 'text', record ? record.auditor : Auth.user().nama)}
          ${field('ttdSupervisor', 'Nama Supervisor Area', 'text', record ? record.supervisor : '')}
        </div>
        <p class="small muted mt-1">Laporan harus diaudit Owner untuk pengesahan final dan perbaikan ditutup pada RCT terkait.</p>
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button>
        <button class="btn btn-outline" data-draft>Simpan Draft</button>
        <button class="btn btn-primary" data-y>Kirim ke Persetujuan Owner</button>`
    });

    function paramsOf(jenisId) {
      const j = jenis.find(x => x.id === jenisId);
      return j ? parseJ(j.parameter) : [{ p: 'Area kerja bersih & rapi', risiko: 'medium' }, { p: 'APAR bertekanan & tidak terhalang', risiko: 'high' }, { p: 'APD lengkap dikenakan pekerja', risiko: 'high' }];
    }
    function renderChecklist() {
      const sel = m.root.querySelector('[name=jenisId]');
      if (!checklist.length) checklist = paramsOf(sel.value).map(p => ({ param: p.p, hasil: '', catatan: '' }));
      const box = m.root.querySelector('#ckRows');
      box.innerHTML = `<table class="data"><thead><tr><th style="width:44%">Parameter Pemeriksaan</th><th style="width:18%">Evaluasi</th><th>Catatan Lapangan</th></tr></thead>
        <tbody>${checklist.map((c, i) => `<tr>
          <td>${esc(c.param)}</td>
          <td><select class="input" data-c="hasil" data-i="${i}"><option value="">Pilih</option><option ${c.hasil === 'Sesuai' ? 'selected' : ''}>Sesuai</option><option ${c.hasil === 'Tidak Sesuai' ? 'selected' : ''}>Tidak Sesuai</option><option ${c.hasil === 'N/A' ? 'selected' : ''}>N/A</option></select></td>
          <td><input class="input" data-c="catatan" data-i="${i}" value="${esc(c.catatan || '')}" placeholder="Catatan hasil…"></td>
        </tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('[data-c]').forEach(inp => inp.onchange = inp.oninput = () => { checklist[inp.dataset.i][inp.dataset.c] = inp.value; hitungSkor(); });
      hitungSkor();
    }
    function hitungSkor() {
      const done = checklist.filter(c => c.hasil && c.hasil !== 'N/A');
      const sesuai = checklist.filter(c => c.hasil === 'Sesuai').length;
      const skor = done.length ? Math.round(sesuai / done.length * 100) : 0;
      m.root.querySelector('#skorHint').textContent = `Indeks Kepatuhan: ${skor}%`;
    }
    function renderTemuan() {
      const box = m.root.querySelector('#tRows');
      box.innerHTML = temuan.map((t, i) => `<div class="card mb-1" style="box-shadow:none">
        <div class="form-grid">
          ${field('t-desc', 'Deskripsi Temuan', 'textarea', t.deskripsi).replace('name="t-desc"', `name="tdesc" data-t="deskripsi" data-i="${i}"`)}
          <div class="field"><span>Tingkat Risiko</span>
            <select data-t="risiko" data-i="${i}">${['Rendah', 'Sedang', 'Tinggi'].map(x => `<option ${t.risiko === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          ${field('t-act', 'Tindakan Perbaikan (CAPA)', 'text', t.tindakan).replace('name="t-act"', `data-t="tindakan" data-i="${i}"`)}
          ${field('t-pic', 'PIC Penanggung Jawab', 'text', t.pic).replace('name="t-pic"', `data-t="pic" data-i="${i}"`)}
          ${field('t-due', 'Batas Waktu (Due Date)', 'date', t.due).replace('name="t-due"', `data-t="due" data-i="${i}"`)}
          <div class="field"><span>Status CAPA</span>
            <select data-t="status" data-i="${i}"><option ${t.status === 'menunggu' ? 'selected' : ''}>menunggu</option><option ${t.status === 'proses' ? 'selected' : ''}>proses</option><option ${t.status === 'selesai' ? 'selected' : ''}>selesai</option></select></div>
        </div>
        <div class="row"><button class="btn btn-outline btn-sm danger-text" data-tdel="${i}">Hapus Temuan</button></div>
      </div>`).join('');
      box.querySelectorAll('[data-t]').forEach(inp => inp.oninput = () => { temuan[inp.dataset.i][inp.dataset.t] = inp.value; });
      box.querySelectorAll('[data-tdel]').forEach(b => b.onclick = () => { temuan.splice(Number(b.dataset.tdel), 1); renderTemuan(); });
    }
    renderChecklist(); renderTemuan();
    m.root.querySelector('[name=jenisId]').onchange = e => { checklist = paramsOf(e.target.value).map(p => ({ param: p.p, hasil: '', catatan: '' })); renderChecklist(); };
    m.root.querySelector('#tAdd').onclick = () => { temuan.push({ deskripsi: '', risiko: 'Sedang', tindakan: '', pic: '', due: '', status: 'menunggu' }); renderTemuan(); };
    m.root.querySelector('[data-x]').onclick = () => m.close();

    async function submit(asDraft) {
      const f = m.root;
      const jenisRow = jenis.find(j => j.id === f.querySelector('[name=jenisId]').value);
      const done = checklist.filter(c => c.hasil && c.hasil !== 'N/A');
      const skor = done.length ? Math.round(checklist.filter(c => c.hasil === 'Sesuai').length / done.length * 100) : 0;
      const data = {
        id: record ? record.id : undefined,
        kode: record ? record.kode : 'INSP-2026-' + String(100 + (App.cache['Inspeksi'] || []).length).padStart(3, '0'),
        jenisId: f.querySelector('[name=jenisId]').value,
        jenisNama: jenisRow ? jenisRow.nama : (record ? record.jenisNama : ''),
        tanggal: f.querySelector('[name=tanggal]').value,
        auditor: f.querySelector('[name=auditor]').value,
        supervisor: f.querySelector('[name=supervisor]').value,
        area: f.querySelector('[name=area]').value,
        kondisi: f.querySelector('[name=kondisi]').value,
        hasil: JSON.stringify(checklist),
        skor: String(skor),
        temuan: JSON.stringify(temuan.filter(t => t.deskripsi)),
        status: asDraft ? 'draft' : undefined
      };
      const res = await saveRecord('Inspeksi', data);
      if (res.success) { m.close(); route(); }
    }
    m.root.querySelector('[data-y]').onclick = () => submit(false);
    m.root.querySelector('[data-draft]').onclick = () => submit(true);
  }
};

const InspeksiView = {
  async detail(id) {
    const rows = await loadSheet('Inspeksi');
    const r = rows.find(x => x.id === id); if (!r) return UI.toast('Data tidak ditemukan.', 'err');
    const hasil = parseJ(r.hasil), temuan = parseJ(r.temuan);
    const m = UI.modal({
      wide: true, title: `${r.kode || 'Inspeksi'} — ${r.jenisNama || 'Detail Inspeksi'}`,
      body: `
      <div class="kv mb-1">
        <div><div class="k">Waktu Pelaksanaan</div><div class="v">${fmtDateTime(r.tanggal)}</div></div>
        <div><div class="k">Status Alur</div><div class="v">${UI.statusPill(r.status)}</div></div>
        <div><div class="k">Auditor</div><div class="v">${esc(r.auditor || '-')}</div></div>
        <div><div class="k">Supervisor</div><div class="v">${esc(r.supervisor || '-')}</div></div>
        <div><div class="k">Area</div><div class="v">${esc(r.area || '-')}</div></div>
        <div><div class="k">Skor Kepatuhan</div><div class="v"><b>${esc(r.skor || '—')}%</b></div></div>
      </div>
      ${hasil.length ? `<div class="card mb-1"><h3 class="mb-1">Hasil Checklist</h3>
        <table class="data"><thead><tr><th>Parameter</th><th>Hasil</th><th>Catatan</th></tr></thead>
        <tbody>${hasil.map(c => `<tr><td>${esc(c.param)}</td><td>${UI.statusPill(c.hasil === 'Sesuai' ? 'approved' : c.hasil === 'Tidak Sesuai' ? 'rejected' : 'draft')}</td><td>${esc(c.catatan || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="card"><h3 class="mb-1">Temuan & CAPA (${temuan.length})</h3>
        ${temuan.map(t => `<div class="card mb-1" style="box-shadow:none;border-left:3px solid ${t.risiko === 'Tinggi' ? '#DC2626' : t.risiko === 'Sedang' ? '#F59E0B' : '#16A34A'}">
          <div class="row spread"><b>${esc(t.deskripsi)}</b><span class="risk-tag ${t.risiko === 'Tinggi' ? 'risk-high' : t.risiko === 'Sedang' ? 'risk-mid' : 'risk-low'}">${esc(t.risiko)}</span></div>
          <p class="small mt-1">Tindakan: ${esc(t.tindakan || '-')} · PIC: ${esc(t.pic || '-')} · Due: ${fmtDate(t.due)}</p>
          <span class="pill ${t.status === 'selesai' ? 'pill-success' : t.status === 'proses' ? 'pill-info' : 'pill-warning'}">${esc(t.status)}</span>
        </div>`).join('') || '<p class="muted small">Tidak ada temuan. Kondisi area sesuai standar.</p>'}
      </div>`,
      footer: Auth.isOwner() && r.status === 'pending'
        ? `<button class="btn btn-outline" data-x>Tutup</button><button class="btn btn-outline" data-no>Kembalikan ke Staff</button><button class="btn btn-success" data-y>Setujui Temuan</button>`
        : `<button class="btn btn-outline" data-x>Tutup</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    const y = m.root.querySelector('[data-y]'); if (y) y.onclick = async () => { await approve('Inspeksi', r.id); m.close(); };
    const no = m.root.querySelector('[data-no]'); if (no) no.onclick = () => { m.close(); rejectRow('Inspeksi', r.id); };
  }
};

const JenisMgr = {
  async open() {
    const rows = await loadSheet('Jenis_Inspeksi', true);
    const d = UI.drawer({
      title: 'Kelola Template & Jenis Inspeksi K3',
      body: `<div class="row mb-1"><button class="btn btn-primary btn-sm" id="jNew">+ Jenis Inspeksi Baru</button></div>
        <div id="jList">${rows.map(j => `<div class="card mb-1" style="padding:1rem">
          <div class="row spread"><b>${esc(j.nama)}</b><span class="mono small muted">${esc(j.kode)}</span></div>
          <div class="small muted mt-1">${esc(j.regulasi || '-')} · Pass minimal ${esc(j.minPass || 85)}% · ${parseJ(j.parameter).length} parameter</div>
          <div class="row mt-1"><button class="btn btn-outline btn-sm" data-jedit="${j.id}">Ubah</button>
          <button class="btn btn-outline btn-sm danger-text" data-jdel="${j.id}">Hapus</button></div>
        </div>`).join('') || UI.emptyState('Belum ada jenis inspeksi.')}</div>`,
      footer: `<button class="btn btn-outline" data-x>Tutup</button>`
    });
    d.root.querySelector('[data-x]').onclick = () => d.close();
    d.root.querySelector('#jNew').onclick = () => JenisMgr.form(d, null);
    d.root.querySelectorAll('[data-jedit]').forEach(b => b.onclick = () => JenisMgr.form(d, rows.find(x => x.id === b.dataset.jedit)));
    d.root.querySelectorAll('[data-jdel]').forEach(b => b.onclick = async () => {
      await removeRow('Jenis_Inspeksi', b.dataset.jdel, 'jenis inspeksi'); d.close(); JenisMgr.open();
    });
  },
  form(d, record) {
    let params = record ? parseJ(record.parameter) : [{ p: '', risiko: 'high' }];
    const overlay = document.createElement('div');
    overlay.className = 'card mb-1';
    overlay.innerHTML = `<h3 class="mb-1">${record ? 'Ubah' : 'Tambah'} Jenis Inspeksi</h3>
      <div class="form-grid">
        ${field('nama', 'Nama Jenis Inspeksi', 'text', record ? record.nama : '', '', true)}
        ${field('kode', 'Kode Modul (ID)', 'text', record ? record.kode : '', 'cth: CHK-APAR-01')}
        ${field('frekuensi', 'Frekuensi', 'select', record ? record.frekuensi : 'Harian (Shift 1 & 2)', [{ v: 'Harian (Shift 1 & 2)', t: 'Harian (Shift 1 & 2)' }, { v: 'Mingguan', t: 'Mingguan' }, { v: 'Bulanan', t: 'Bulanan' }])}
        ${field('regulasi', 'Dasar Regulasi / Standar', 'text', record ? record.regulasi : '')}
        ${field('minPass', 'Standar Minimum Pass (%)', 'number', record ? record.minPass : '85')}
      </div>
      <div class="card-head mt-1"><h3>Parameter Pemeriksaan</h3><button class="btn btn-outline btn-sm" id="jpAdd">+ Parameter</button></div>
      <div id="jpRows"></div>
      <div class="row mt-1"><button class="btn btn-primary btn-sm" id="jpSave">Simpan Template</button>
      <button class="btn btn-outline btn-sm" id="jpCancel">Batal</button></div>`;
    d.root.appendChild(overlay);
    function renderParams() {
      overlay.querySelector('#jpRows').innerHTML = params.map((p, i) => `<div class="row mb-1" style="gap:.6rem">
        <input class="input" data-p="p" data-i="${i}" value="${esc(p.p)}" placeholder="Poin pemeriksaan…" style="flex:1">
        <select class="input" data-p="risiko" data-i="${i}" style="width:170px">
          <option value="high" ${p.risiko === 'high' ? 'selected' : ''}>High Risk (Kritis)</option>
          <option value="medium" ${p.risiko === 'medium' ? 'selected' : ''}>Medium Risk (Sedang)</option>
          <option value="low" ${p.risiko === 'low' ? 'selected' : ''}>Low Risk (Rendah)</option>
        </select>
        <button class="icon-btn danger" data-pdel="${i}">${UI.icon('M3 6h18', 14)}</button></div>`).join('');
      overlay.querySelectorAll('[data-p]').forEach(inp => inp.oninput = () => params[inp.dataset.i][inp.dataset.p] = inp.value);
      overlay.querySelectorAll('[data-pdel]').forEach(b => b.onclick = () => { params.splice(Number(b.dataset.pdel), 1); renderParams(); });
    }
    renderParams();
    overlay.querySelector('#jpAdd').onclick = () => { params.push({ p: '', risiko: 'high' }); renderParams(); };
    overlay.querySelector('#jpCancel').onclick = () => overlay.remove();
    overlay.querySelector('#jpSave').onclick = async () => {
      const f = overlay;
      const data = {
        id: record ? record.id : undefined,
        nama: f.querySelector('[name=nama]').value.trim(),
        kode: f.querySelector('[name=kode]').value,
        frekuensi: f.querySelector('[name=frekuensi]').value,
        regulasi: f.querySelector('[name=regulasi]').value,
        minPass: f.querySelector('[name=minPass]').value,
        roleBoleh: 'staff,safety_officer,supervisor',
        parameter: JSON.stringify(params.filter(p => p.p))
      };
      if (!data.nama) return UI.toast('Nama jenis inspeksi wajib diisi.', 'err');
      const r = await Api.post('jenisUpsert', { data });
      if (r.success) { UI.toast('Template tersimpan.', 'ok'); d.close(); JenisMgr.open(); }
      else UI.toast(r.message, 'err');
    };
  }
};

/* ================= MODUL: INSIDEN & ACCIDENT ================= */
Views.insiden = async function (view) {
  const rows = await loadSheet('Insiden_Accident');
  const st = { tab: 'Semua', q: '', severity: '', status: '' };
  const catCount = k => rows.filter(r => k === 'Semua' || r.kategori === k).length;

  function render() {
    const list = rows.filter(r => (st.tab === 'Semua' || r.kategori === st.tab)
      && (!st.severity || r.severity === st.severity)
      && (!st.status || r.status === st.status)
      && (!st.q || (r.nomor + ' ' + (r.lokasi || '') + ' ' + (r.pelapor || '') + ' ' + (r.kronologi || '')).toLowerCase().includes(st.q)));

    const catCards = Object.keys(CONFIG.INSIDEN_KATEGORI).map(k => UI.statCard({
      label: CONFIG.INSIDEN_KATEGORI[k].label, value: catCount(k),
      tone: /lti|accident|unsafe_condition/.test(k) ? 'red' : /near/.test(k) ? 'orange' : 'blue',
      icon: UI.icon('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 16)
    })).join('');

    view.innerHTML = pageHead({
      title: 'Manajemen Insiden, Kecelakaan & Bahaya K3',
      sub: 'Pencatatan real-time insiden kerja, penyelidikan akar masalah (RCA), penetapan tindakan CAPA, dan pencegahan berulang lintas site.',
      actions: `<button class="btn btn-outline" id="incExport">Ekspor Laporan (Excel/CSV)</button>
        <button class="btn btn-urgent" id="incNew">${UI.icon('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 16)} Lapor Insiden Baru</button>`
    }) + `<div class="grid grid-cols-4 mb-1">${catCards}</div>
      <div class="tabs">${['Semua'].concat(Object.keys(CONFIG.INSIDEN_KATEGORI)).map(k =>
        `<button class="tab ${st.tab === k ? 'active' : ''}" data-tab="${k}">${k === 'Semua' ? 'Semua Laporan' : CONFIG.INSIDEN_KATEGORI[k].label} <span class="count">${catCount(k)}</span></button>`).join('')}</div>
      ${searchFilterBar(`
        <select id="fSeverity"><option value="">Semua Tingkat Bahaya</option><option value="Tinggi">Tinggi / High</option><option value="Sedang">Sedang / Medium</option><option value="Rendah">Rendah / Low</option></select>
        <select id="fStatus"><option value="">Status Persetujuan</option><option value="approved">Disetujui</option><option value="pending">Menunggu Owner</option><option value="rejected">Ditolak</option></select>`)}
      ${table([
        { label: 'No. Laporan', render: r => `<b class="mono">${esc(r.nomor || r.id.slice(0, 8))}</b><div class="small muted">${fmtDateTime(r.tanggal)}</div>` },
        { label: 'Kategori', render: r => `<span class="pill ${(CONFIG.INSIDEN_KATEGORI[r.kategori] || {}).cls || 'pill-neutral'}">${esc((CONFIG.INSIDEN_KATEGORI[r.kategori] || {}).label || r.kategori)}</span>` },
        { label: 'Lokasi / Unit', render: r => esc(r.lokasi || '-') },
        { label: 'Pihak Terlibat', render: r => esc(r.pelapor || '-') },
        { label: 'Kronologi Singkat', render: r => `<div style="max-width:340px">${esc((r.kronologi || '').slice(0, 90))}${(r.kronologi || '').length > 90 ? '…' : ''}</div>` },
        { label: 'Status', render: r => UI.statusPill(r.status) }
      ], list, r => `
        <button class="icon-btn" data-incview="${r.id}" title="Detail RCA">${UI.icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 15)}</button>
        ${r.status === 'pending' && Auth.isOwner() ? `<button class="icon-btn" data-incok="${r.id}">${UI.icon('M20 6 9 17l-5-5', 15)}</button>
        <button class="icon-btn danger" data-incno="${r.id}">${UI.icon('M18 6 6 18M6 6l12 12', 15)}</button>` : ''}
        ${Auth.isOwner() ? `<button class="icon-btn danger" data-incdel="${r.id}">${UI.icon('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6', 15)}</button>` : ''}`)}`;

    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; render(); });
    view.querySelector('#fSeverity').onchange = e => { st.severity = e.target.value; render(); };
    view.querySelector('#fStatus').onchange = e => { st.status = e.target.value; render(); };
    view.querySelector('#fSearch').oninput = e => { st.q = e.target.value.toLowerCase(); render(); };
    view.querySelector('#incNew').onclick = () => IncidentForm.open();
    view.querySelector('#incExport').onclick = async () => { const r = await Api.get('exportCsv', { sheet: 'Insiden_Accident' }); r.success ? UI.downloadCSV(r.filename, r.csv) : UI.toast(r.message, 'err'); };
    view.querySelectorAll('[data-incview]').forEach(b => b.onclick = () => IncidentDetail.detail(b.dataset.incview));
    view.querySelectorAll('[data-incok]').forEach(b => b.onclick = () => approve('Insiden_Accident', b.dataset.incok));
    view.querySelectorAll('[data-incno]').forEach(b => b.onclick = () => rejectRow('Insiden_Accident', b.dataset.incno));
    view.querySelectorAll('[data-incdel]').forEach(b => b.onclick = () => removeRow('Insiden_Accident', b.dataset.incdel, 'laporan insiden'));
  }
  render();
};

const IncidentForm = {
  open(record) {
    const list = App.cache['Insiden_Accident'] || [];
    let why = record ? parseJ(record.rootWhy) : ['', '', '', '', ''];
    let capa = record ? parseJ(record.capa) : [{ jenis: 'korrektif', tindakan: '', pic: '', target: '', status: 'proses' }];

    const m = UI.modal({
      wide: true, title: (record ? 'Ubah' : 'Pelaporan') + ' Insiden & Investigasi K3',
      body: `
      <div class="stepper">
        <div class="step active"><span class="num">1</span> Detail Kejadian</div><span class="step-line"></span>
        <div class="step"><span class="num">2</span> Root Cause (5-Why)</div><span class="step-line"></span>
        <div class="step"><span class="num">3</span> Tindakan CAPA</div>
      </div>
      <div class="card mb-1"><h3 class="mb-1">1. Informasi & Klasifikasi Insiden</h3>
        <div class="form-grid">
          ${field('nomor', 'No. Laporan Otomatis', 'text', record ? record.nomor : 'INC-2026-' + String(15 + list.length).padStart(3, '0'))}
          ${field('kategori', 'Kategori Kejadian', 'select', record ? record.kategori : 'near_miss', Object.keys(CONFIG.INSIDEN_KATEGORI).map(k => ({ v: k, t: CONFIG.INSIDEN_KATEGORI[k].label })), true)}
          ${field('severity', 'Tingkat Dampak / Bahaya', 'select', record ? record.severity : 'Sedang', [{ v: 'Rendah', t: 'Rendah (Low)' }, { v: 'Sedang', t: 'Sedang (Medium)' }, { v: 'Tinggi', t: 'Tinggi / High Risk' }], true)}
          ${field('tanggal', 'Tanggal & Waktu Kejadian', 'datetime-local', record ? record.tanggal : new Date().toISOString().slice(0, 16), '', true)}
          ${field('lokasi', 'Lokasi Fisik Kejadian', 'text', record ? record.lokasi : '', 'cth: Workshop Fabrikasi Silo B', true)}
          ${field('pelapor', 'Pelapor / PIC', 'text', record ? record.pelapor : Auth.user().nama, '', true)}
          ${field('terlibat', 'Pihak Terlibat (pisahkan koma)', 'text', record ? parseJ(record.terlibat).join(', ') : '')}
          <div class="full"><label class="field"><span>Kronologi & Rincian Kejadian <span class="req">*</span></span>
            <textarea name="kronologi" placeholder="Jelaskan urutan kejadian, lokasi, korban, dan tindakan awal yang dilakukan…">${esc(record ? record.kronologi : '')}</textarea></label></div>
        </div>
      </div>
      <div class="card mb-1"><h3 class="mb-1">2. Analisis Akar Masalah (Metode 5-Why)</h3>
        <div id="whyRows">${why.map((w, i) => `<label class="field"><span>Why Tingkat ${i + 1}</span>
          <input class="input" data-w="${i}" value="${esc(w)}" placeholder="Pertanyaan jawaban tingkat ${i + 1}…"></label>`).join('')}
          <label class="field"><span><b>ROOT CAUSE UTAMA (Root Cause)</b></span>
          <textarea name="rootCause" placeholder="Rumuskan akar masalah sistemik di sini…">${esc(record ? (record.rootCause || '') : '')}</textarea></label>
        </div>
      </div>
      <div class="card mb-1"><div class="card-head"><h3>3. Rencana Tindakan Korektif & Preventif (CAPA)</h3>
        <button class="btn btn-outline btn-sm" id="capaAdd">+ Tambah Baris Tindakan</button></div>
        <div id="capaRows"></div>
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button>
        <button class="btn btn-primary" data-y>Kirim untuk Persetujuan Owner</button>`
    });

    function renderCapa() {
      m.root.querySelector('#capaRows').innerHTML = capa.map((c, i) => `<div class="card mb-1" style="box-shadow:none">
        <div class="form-grid">
          <div class="field"><span>Jenis Tindakan</span>
            <select data-c="jenis" data-i="${i}"><option value="korrektif" ${c.jenis === 'korrektif' ? 'selected' : ''}>Korektif (Langsung)</option><option value="preventif" ${c.jenis === 'preventif' ? 'selected' : ''}>Preventif (Pencegahan)</option></select></div>
          <div class="field"><span>PIC Penanggung Jawab</span><input class="input" data-c="pic" data-i="${i}" value="${esc(c.pic)}"></div>
          <div class="full field"><span>Tindakan / Rekomendasi</span><textarea data-c="tindakan" data-i="${i}">${esc(c.tindakan)}</textarea></div>
          <div class="field"><span>Target Selesai</span><input type="date" class="input" data-c="target" data-i="${i}" value="${esc(c.target)}"></div>
          <div class="field"><span>Status</span>
            <select data-c="status" data-i="${i}"><option value="proses" ${c.status === 'proses' ? 'selected' : ''}>Dalam Proses</option><option value="selesai" ${c.status === 'selesai' ? 'selected' : ''}>Selesai</option><option value="belum" ${c.status === 'belum' ? 'selected' : ''}>Belum Dimulai</option></select></div>
        </div>
        <div class="row"><button class="btn btn-outline btn-sm danger-text" data-cdel="${i}">Hapus Baris</button></div></div>`).join('');
      m.root.querySelectorAll('[data-c]').forEach(inp => inp.oninput = inp.onchange = () => { capa[inp.dataset.i][inp.dataset.c] = inp.value; });
      m.root.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => { capa.splice(Number(b.dataset.cdel), 1); renderCapa(); });
    }
    renderCapa();
    m.root.querySelector('#capaAdd').onclick = () => { capa.push({ jenis: 'preventif', tindakan: '', pic: '', target: '', status: 'belum' }); renderCapa(); };
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      why = [...f.querySelectorAll('[data-w]')].map(i => i.value.trim());
      const data = {
        id: record ? record.id : undefined,
        nomor: f.querySelector('[name=nomor]').value,
        kategori: f.querySelector('[name=kategori]').value,
        severity: f.querySelector('[name=severity]').value,
        tanggal: f.querySelector('[name=tanggal]').value,
        lokasi: f.querySelector('[name=lokasi]').value,
        pelapor: f.querySelector('[name=pelapor]').value,
        terlibat: JSON.stringify(f.querySelector('[name=terlibat]').value.split(',').map(s => s.trim()).filter(Boolean)),
        kronologi: f.querySelector('[name=kronologi]').value.trim(),
        rootWhy: JSON.stringify(why),
        rootCause: f.querySelector('[name=rootCause]').value,
        capa: JSON.stringify(capa.filter(c => c.tindakan))
      };
      if (!data.kronologi) { UI.toast('Kronologi kejadian wajib diisi.', 'err'); return; }
      const res = await saveRecord('Insiden_Accident', data);
      if (res.success) { m.close(); route(); }
    };
  }
};

const InsidenDetail = {
  async detail(id) {
    const rows = await loadSheet('Insiden_Accident');
    const r = rows.find(x => x.id === id); if (!r) return UI.toast('Data tidak ditemukan.', 'err');
    const why = parseJ(r.rootWhy), capa = parseJ(r.capa), terlibat = parseJ(r.terlibat);
    const m = UI.modal({
      wide: true, title: `${r.nomor} — Investigasi Insiden & Rencana CAPA`,
      body: `
      <div class="kv mb-1">
        <div><div class="k">Waktu Kejadian</div><div class="v">${fmtDateTime(r.tanggal)}</div></div>
        <div><div class="k">Kategori</div><div class="v">${UI.statusPill(r.kategori, CONFIG.INSIDEN_KATEGORI)}</div></div>
        <div><div class="k">Lokasi</div><div class="v">${esc(r.lokasi || '-')}</div></div>
        <div><div class="k">Pelapor</div><div class="v">${esc(r.pelapor || '-')}</div></div>
      </div>
      ${terlibat.length ? `<div class="card mb-1"><h3 class="mb-1">Pihak Terlibat</h3><div class="row">${terlibat.map(t => `<span class="pill pill-info">${esc(t)}</span>`).join('')}</div></div>` : ''}
      <div class="card mb-1"><h3 class="mb-1">Kronologi Kejadian</h3><p style="color:var(--text-2)">${esc(r.kronologi || '-')}</p></div>
      ${why.length ? `<div class="card mb-1"><h3 class="mb-1">Analisis 5-Why</h3>
        <ul class="timeline">${why.map((w, i) => w ? `<li><div class="t-time">Why ${i + 1}</div><div class="t-body">${esc(w)}</div></li>` : '').join('')}</ul>
        ${r.rootCause ? `<div class="card mt-1" style="background:var(--yellow-bg)"><b style="color:var(--yellow-fg)">Akar Masalah:</b> ${esc(r.rootCause)}</div>` : ''}
      </div>` : ''}
      <div class="card"><h3 class="mb-1">CAPA Tracker (${capa.length} tindakan)</h3>
        ${capa.map(c => `<div class="card mb-1" style="box-shadow:none">
          <div class="row spread"><span class="pill ${c.jenis === 'korrektif' ? 'pill-info' : 'pill-success'}">${c.jenis === 'korrektif' ? 'Korektif' : 'Preventif'}</span>
          <span class="pill ${c.status === 'selesai' ? 'pill-success' : c.status === 'proses' ? 'pill-info' : 'pill-warning'}">${esc(c.status)}</span></div>
          <p class="mt-1">${esc(c.tindakan)}</p>
          <div class="small muted">PIC: ${esc(c.pic || '-')} · Target: ${fmtDate(c.target)}</div>
        </div>`).join('') || '<p class="muted small">Belum ada tindakan CAPA.</p>'}
      </div>`,
      footer: `<button class="btn btn-outline" data-pdf>Ekspor Berita Acara PDF</button>
        <button class="btn btn-outline" data-x>Tutup</button>
        ${Auth.isOwner() && r.status === 'pending' ? `<button class="btn btn-success" data-y>Setujui Investigasi</button>
        <button class="btn btn-outline" data-no>Tolak & Kembalikan</button>` : ''}`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-pdf]').onclick = () => window.print();
    const y = m.root.querySelector('[data-y]'); if (y) y.onclick = async () => { await approve('Insiden_Accident', r.id); m.close(); };
    const no = m.root.querySelector('[data-no]'); if (no) no.onclick = () => { m.close(); rejectRow('Insiden_Accident', r.id); };
  }
};

/* ================= MODUL: APD MANAGEMENT ================= */
Views.apd = async function (view) {
  const [dist, master] = await Promise.all([loadSheet('APD_Distribusi'), loadSheet('APD_Master')]);
  const st = { tab: 'dist', q: '', kondisi: '' };
  function render() {
    const list = dist.filter(r => (!st.kondisi || r.kondisi === st.kondisi)
      && (!st.q || (r.pekerjaNama + ' ' + r.apdNama + ' ' + (r.serial || '')).toLowerCase().includes(st.q)));
    const expiredSoon = dist.filter(r => { const h = hariSisa(r.tglExpiry); return h != null && h <= 30; }).length;
    const rusak = dist.filter(r => r.kondisi === 'retak_rusak').length;
    const baik = dist.filter(r => r.kondisi === 'baik' || r.kondisi === 'mendekati_expired').length;
    const patuh = dist.length ? Math.round(baik / dist.length * 100) : 0;

    const matrixJobs = [
      { job: 'Pengelasan (Hot Work / Welder)', items: [1, 1, 1, 1, 1, 1, 1] },
      { job: 'Bekerja di Ketinggian (>1.8m)', items: [1, 1, 0, 1, 1, 0, 1] },
      { job: 'Ruang Terbatas (Confined Space)', items: [1, 1, 1, 1, 1, 1, 1] },
      { job: 'Petugas Penanganan B3 / Kimia', items: [1, 1, 0, 1, 1, 1, 0] },
      { job: 'Teknik Listrik Gardu & Panel', items: [1, 1, 1, 0, 1, 0, 1] }
    ];
    const matrixCols = ['Helm', 'Sepatu', 'Kacamata', 'Harness', 'Sarung', 'Respirator', 'Earplug'];

    view.innerHTML = pageHead({
      title: 'Manajemen Alat Pelindung Diri (APD)',
      sub: 'Pengawasan stok master APD pabrik, riwayat distribusi per pekerja, pemantauan masa berlaku, dan kesiapan fisik di lapangan.',
      actions: `<button class="btn btn-outline" id="apdMasterNew">+ Tambah Master APD</button>
        <button class="btn btn-primary" id="apdDistNew">Distribusikan APD Baru</button>`
    }) + `<div class="grid grid-cols-4 mb-1">
      ${UI.statCard({ label: 'Total APD Terdistribusi', value: dist.length, small: 'Unit', tone: 'indigo', icon: UI.icon('M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z', 18) })}
      ${UI.statCard({ label: 'Masa Pakai Habis / Rusak', value: rusak, small: 'Unit', tone: 'red', icon: UI.icon('M12 9v4m0 4h.01', 18), foot: 'Perlu ganti segera' })}
      ${UI.statCard({ label: 'Stok Master Tersedia', value: master.length, small: 'Jenis', tone: 'green', icon: UI.icon('M20 7h-9M14 17H5m12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 17a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 18), foot: 'Buffer 3 bulan' })}
      ${UI.statCard({ label: 'Kepatuhan APD Lapangan', value: patuh + '%', tone: 'blue', icon: UI.icon('M9 12l2 2 4-4', 18), foot: 'Target ≥ 95% (ISO 45001)' })}
    </div>
    ${expiredSoon ? `<div class="card mb-1" style="border-color:#FED7AA;background:#FFF7ED"><b style="color:var(--orange-hover)">${UI.icon('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 15)} Peringatan Kritis:</b> ${expiredSoon} unit APD mendekati masa kedaluwarsa (<30 hari) atau melewati masa pakai standar K3.</div>` : ''}
    <div class="tabs">
      <button class="tab ${st.tab === 'dist' ? 'active' : ''}" data-tab="dist">Distribusi Pekerja <span class="count">${dist.length}</span></button>
      <button class="tab ${st.tab === 'master' ? 'active' : ''}" data-tab="master">Master Jenis APD <span class="count">${master.length}</span></button>
    </div>
    ${st.tab === 'dist' ? searchFilterBar(`<select id="fKondisi"><option value="">Semua Kondisi</option><option value="baik">Baik / Layak</option><option value="mendekati_expired">Mendekati Expired</option><option value="retak_rusak">Rusak / Retak</option></select>`) +
      table([
        { label: 'Pekerja & Afiliasi', render: r => `<b>${esc(r.pekerjaNama || '-')}</b>` },
        { label: 'Jenis APD & Serial', render: r => `<b>${esc(r.apdNama || '-')}</b><div class="small muted">${esc(r.serial || '-')}</div>` },
        { label: 'Tgl Distribusi', render: r => fmtDate(r.tglTerima) },
        { label: 'Sisa Masa Pakai', render: r => { const h = hariSisa(r.tglExpiry); const pct = h == null ? 0 : Math.max(0, Math.min(100, Math.round(h / 365 * 100))); return `<div class="row"><span class="small">${h == null ? '—' : expLabel(h, 'Hari')}</span><div class="progress ${h != null && h <= 30 ? 'r' : 'g'}" style="width:90px"><i style="width:${pct}%"></i></div></div><div class="small muted">Exp: ${fmtDate(r.tglExpiry)}</div>`; } },
        { label: 'Kondisi', render: r => UI.statusPill(r.kondisi) }
      ], list, r => `
        <button class="icon-btn" data-apddel="${r.id}">${UI.icon('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6', 15)}</button>`)
    : table([
        { label: 'Nama APD', render: r => `<b>${esc(r.nama)}</b>` },
        { label: 'Kategori', render: r => esc(r.kategori || '-') },
        { label: 'Standar', render: r => esc(r.standar || '-') },
        { label: 'Masa Baku', render: r => `${esc(r.masaBakuHari || '-')} hari` },
        { label: 'Cocok Untuk', render: r => parseJ(r.cocokUntuk).map(c => `<span class="pill pill-info pill-plain">${esc(c)}</span>`).join(' ') }
      ], master, r => `
        <button class="icon-btn" data-apmedit="${r.id}">${UI.icon('M17 3a2.8 2.8 0 0 1 4 4L7 21l-5 1 1-5z', 15)}</button>
        <button class="icon-btn danger" data-apmdel="${r.id}">${UI.icon('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6', 15)}</button>`)}
    <div class="card mt-2"><div class="card-head"><h3>Matriks Kebutuhan APD Wajib (Berdasarkan HIRADC & SOP K3)</h3></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Pekerjaan / Risiko</th>${matrixCols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${matrixJobs.map(j => `<tr><td><b>${j.job}</b></td>${j.items.map(v => `<td style="text-align:center">${v ? '<span style="color:var(--green-fg)">✓</span>' : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;

    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; render(); });
    const fs = view.querySelector('#fSearch'); if (fs) fs.oninput = e => { st.q = e.target.value.toLowerCase(); render(); };
    const fk = view.querySelector('#fKondisi'); if (fk) fk.onchange = e => { st.kondisi = e.target.value; render(); };
    view.querySelector('#apdDistNew').onclick = () => ApdForm.distribusi(master);
    view.querySelector('#apdMasterNew').onclick = () => ApdForm.master();
    view.querySelectorAll('[data-apmedit]').forEach(b => b.onclick = () => ApdForm.master(master.find(x => x.id === b.dataset.apmedit)));
    view.querySelectorAll('[data-apmdel]').forEach(b => b.onclick = () => removeRow('APD_Master', b.dataset.apmdel, 'master APD'));
    view.querySelectorAll('[data-apddel]').forEach(b => b.onclick = () => removeRow('APD_Distribusi', b.dataset.apddel, 'data distribusi APD'));
  }
  render();
};

const ApdForm = {
  distribusi(master) {
    const pekerja = (App.cache['Pekerja_Kontraktor'] || []);
    const m = UI.modal({
      title: 'Distribusikan APD ke Pekerja',
      body: `<div class="form-grid">
        <label class="field"><span>Pekerja <span class="req">*</span></span>
          <select name="pekerjaId">${pekerja.map(p => `<option value="${p.id}" data-name="${esc(p.nama)}">${esc(p.nama)} — ${esc(p.jabatan || p.jenis)}</option>`).join('')}</select></label>
        <label class="field"><span>Jenis APD <span class="req">*</span></span>
          <select name="apdId">${master.map(a => `<option value="${a.id}" data-name="${esc(a.nama)}" data-hari="${a.masaBakuHari || 365}">${esc(a.nama)} (${esc(a.standar || '')})</option>`).join('')}</select></label>
        ${field('serial', 'Nomor Serial / Tag', 'text', '', 'cth: 3M-HAR-092')}
        ${field('tglTerima', 'Tanggal Terima', 'date', new Date().toISOString().slice(0, 10), '', true)}
        ${field('tglExpiry', 'Jadwal Ganti / Expiry', 'date', '', 'Otomatis mengikuti masa baku master')}
        <label class="field"><span>Kondisi</span><select name="kondisi">
          <option value="baik">Baik / Layak</option><option value="mendekati_expired">Mendekati Expired</option><option value="retak_rusak">Retak / Rusak</option></select></label>
        ${field('pic', 'PIC Pemberi', 'text', Auth.user().nama)}
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" data-y>Simpan Distribusi</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const optP = f.querySelector('[name=pekerjaId] option:checked');
      const optA = f.querySelector('[name=apdId] option:checked');
      const data = {
        pekerjaId: f.querySelector('[name=pekerjaId]').value,
        pekerjaNama: optP.dataset.name,
        apdId: f.querySelector('[name=apdId]').value,
        apdNama: optA.dataset.name,
        serial: f.querySelector('[name=serial]').value,
        tglTerima: f.querySelector('[name=tglTerima]').value,
        tglExpiry: f.querySelector('[name=tglExpiry]').value,
        kondisi: f.querySelector('[name=kondisi]').value,
        pic: f.querySelector('[name=pic]').value
      };
      const res = await saveRecord('APD_Distribusi', data);
      if (res.success) { m.close(); route(); }
    };
  },
  master(record) {
    const m = UI.modal({
      title: record ? 'Ubah Master APD' : 'Tambah Master Jenis APD',
      body: `<div class="form-grid">
        ${field('nama', 'Nama Jenis APD', 'text', record ? record.nama : '', '', true)}
        ${field('kategori', 'Kategori', 'select', record ? record.kategori : 'Pelindung Kepala', [
          { v: 'Pelindung Kepala', t: 'Pelindung Kepala' }, { v: 'Pelindung Kaki', t: 'Pelindung Kaki' },
          { v: 'Pelindung Diri Ketinggian', t: 'Pelindung Diri Ketinggian' }, { v: 'Pelindung Pernapasan', t: 'Pelindung Pernapasan' },
          { v: 'Pelindung Tangan', t: 'Pelindung Tangan' }, { v: 'Pelindung Pendengaran', t: 'Pelindung Pendengaran' }])}
        ${field('standar', 'Standar / SNI / ANSI', 'text', record ? record.standar : '')}
        ${field('masaBakuHari', 'Masa Baku (hari)', 'number', record ? record.masaBakuHari : '365')}
        <div class="full"><label class="field"><span>Cocok Untuk Pekerjaan (pisahkan koma)</span>
          <input class="input" name="cocokUntuk" value="${esc(record ? parseJ(record.cocokUntuk).join(', ') : '')}" placeholder="Pengelasan, Ketinggian, Ruang Terbatas"></label></div>
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" data-y>Simpan Master</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const data = {
        id: record ? record.id : undefined,
        nama: f.querySelector('[name=nama]').value.trim(),
        kategori: f.querySelector('[name=kategori]').value,
        standar: f.querySelector('[name=standar]').value,
        masaBakuHari: f.querySelector('[name=masaBakuHari]').value,
        cocokUntuk: JSON.stringify(f.querySelector('[name=cocokUntuk]').value.split(',').map(s => s.trim()).filter(Boolean))
      };
      if (!data.nama) return UI.toast('Nama APD wajib diisi.', 'err');
      const r = await Api.post('apdMasterUpsert', { data });
      if (r.success) { UI.toast('Master APD tersimpan.', 'ok'); m.close(); delete App.cache['APD_Master']; route(); }
      else UI.toast(r.message, 'err');
    };
  }
};

/* ================= MODUL: TRAINING & SERTIFIKASI ================= */
Views.training = async function (view) {
  const [sesi, sert] = await Promise.all([loadSheet('Training_Jadwal'), loadSheet('Sertifikat_Pekerja')]);
  const kritis = sert.filter(s => { const h = hariSisa(s.expiry); return h != null && h <= 30; }).length;
  const monthKey = new Date().toISOString().slice(0, 7);
  const bulanIni = sesi.filter(s => (s.tanggal || '').slice(0, 7) === monthKey).length;

  // Kalender bulan berjalan
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  const startDay = (new Date(y, mo, 1).getDay() + 6) % 7;
  const days = new Date(y, mo + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < startDay; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const marks = sesi.filter(s => (s.tanggal || '').slice(0, 10) === iso).length;
    cells += `<div style="padding:6px;border:1px solid var(--border);border-radius:8px;min-height:44px;font-size:12px"><b>${d}</b>${marks ? '<div style="color:var(--primary);font-weight:700">● ' + marks + '</div>' : ''}</div>`;
  }

  view.innerHTML = pageHead({
    title: 'Pelatihan K3 & Sertifikasi Kompetensi',
    sub: 'Manajemen agenda safety induction, toolbox meeting, pelatihan teknis, serta masa berlaku sertifikat BNSP dan Kemenaker lapangan.',
    actions: `<button class="btn btn-outline" id="sertNew">+ Sertifikat Pekerja</button>
      <button class="btn btn-primary" id="trainNew">Jadwalkan Training Baru</button>`
  }) + `<div class="grid grid-cols-4 mb-1">
    ${UI.statCard({ label: 'Total Jam Pelatihan K3', value: sesi.length, small: 'Sesi', tone: 'indigo', icon: UI.icon('M22 10 12 5 2 10l10 5 10-5v6', 18), foot: 'Target kenaikan Q1' })}
    ${UI.statCard({ label: 'Pekerja Bersertifikat', value: sert.filter(s => s.status === 'aktif').length, small: 'Orang', tone: 'green', icon: UI.icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z', 18), foot: 'Standard compliance' })}
    ${UI.statCard({ label: 'Sertifikat Kritis (<30 Hari)', value: kritis, small: 'Perlu Perpanjang', tone: 'red', icon: UI.icon('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 18) })}
    ${UI.statCard({ label: 'Agenda Bulan Ini', value: bulanIni, small: 'Sesi Terjadwal', tone: 'blue', icon: UI.icon('M8 2v4m8-4v4M3 9h18M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 18), foot: '5 Selesai · 3 Mendatang' })}
  </div>
  <div class="grid grid-cols-2 mb-1">
    <div class="card"><div class="card-head"><h3>Kalender Pelatihan — ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3></div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(h => `<div style="font-size:11px;font-weight:700;color:var(--text-3);text-align:center">${h}</div>`).join('')}
        ${cells}</div></div>
    <div class="card"><div class="card-head"><h3>Database Sertifikat & Lisensi</h3><button class="btn btn-outline btn-sm" id="sertBroadcast">Broadcast Pengingat</button></div>
      ${table([
        { label: 'Pekerja', render: r => `<b>${esc(r.pekerjaNama)}</b>` },
        { label: 'Sertifikat', render: r => `${esc(r.namaSertifikat)}<div class="small muted">${esc(r.lembaga || '')} · ${esc(r.nomor || '')}</div>` },
        { label: 'Masa Berlaku', render: r => { const h = hariSisa(r.expiry); return `${fmtDate(r.expiry)}<div class="small ${h != null && h <= 30 ? 'trend-down' : ''}">${h == null ? '' : expLabel(h, 'Hari Lagi')}</div>`; } },
        { label: 'Status', render: r => UI.statusPill(r.status) }
      ], sert.slice(0, 8), r => `<button class="icon-btn" data-selldel="${r.id}">${UI.icon('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6', 15)}</button>`)}
    </div>
  </div>
  <div class="card"><div class="card-head"><h3>Daftar Sesi Pelatihan Terjadwal</h3><span class="hint">${sesi.length} program terjadwal</span></div>
  ${table([
    { label: 'Kode Sesi', render: r => `<b class="mono">${esc(r.kode || '-')}</b>` },
    { label: 'Judul Program', render: r => `<b>${esc(r.judul)}</b><div class="small muted">${esc(r.kategori || '')}</div>` },
    { label: 'Tanggal', render: r => fmtDateTime(r.tanggal) },
    { label: 'Instruktur', render: r => esc(r.instruktur || '-') },
    { label: 'Peserta', render: r => { const n = parseJ(r.peserta).length; return `<div class="row"><div class="progress" style="width:70px"><i style="width:${r.kapasitas ? Math.min(100, n / r.kapasitas * 100) : 50}%"></i></div><span class="small">${n}/${r.kapasitas || '—'}</span></div>`; } },
    { label: 'Status', render: r => UI.statusPill(r.status) }
  ], sesi)}</div>`;

  view.querySelector('#trainNew').onclick = () => TrainingForm.open();
  view.querySelector('#sertNew').onclick = () => SertForm.open();
  view.querySelector('#sertBroadcast').onclick = async () => { const r = await Api.post('sendReminders', {}); r.success ? UI.toast(`Pengingat terkirim: ${r.apd} APD, ${r.sertifikat} sertifikat.`, 'ok') : UI.toast(r.message, 'err'); };
  view.querySelectorAll('[data-selldel]').forEach(b => b.onclick = () => removeRow('Sertifikat_Pekerja', b.dataset.selldel, 'sertifikat'));
};

const TrainingForm = {
  open(record) {
    const m = UI.modal({
      title: record ? 'Ubah Sesi Training' : 'Jadwalkan Training Baru',
      body: `<div class="form-grid">
        ${field('judul', 'Judul Program Pelatihan', 'text', record ? record.judul : '', '', true)}
        ${field('kategori', 'Kategori', 'select', record ? record.kategori : 'Induction Dasar', [
          { v: 'Induction Dasar', t: 'Safety Induction / Induction Dasar' }, { v: 'Toolbox Meeting', t: 'Toolbox Meeting' },
          { v: 'Ketinggian (TPK)', t: 'Ketinggian / Scaffolding (TPK)' }, { v: 'Tanggap Darurat', t: 'P3K & Tanggap Darurat' }, { v: 'Keahlian Teknis', t: 'Keahlian Teknis' }])}
        ${field('tanggal', 'Tanggal Mulai', 'datetime-local', record ? record.tanggal : new Date().toISOString().slice(0, 16), '', true)}
        ${field('selesai', 'Tanggal Selesai', 'datetime-local', record ? record.selesai : '')}
        ${field('lokasi', 'Lokasi / Ruang', 'text', record ? record.lokasi : 'Ruang Rapat HSE Center')}
        ${field('instruktur', 'Instruktur / Pengajar', 'text', record ? record.instruktur : '')}
        ${field('kapasitas', 'Kapasitas Peserta', 'number', record ? record.kapasitas : '20')}
        ${field('kode', 'Kode Sesi (opsional)', 'text', record ? record.kode : '')}
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" data-y>Simpan Jadwal</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const data = {
        id: record ? record.id : undefined,
        kode: f.querySelector('[name=kode]').value || 'TRN-2026-' + String(1 + (App.cache['Training_Jadwal'] || []).length).padStart(3, '0'),
        judul: f.querySelector('[name=judul]').value,
        kategori: f.querySelector('[name=kategori]').value,
        tanggal: f.querySelector('[name=tanggal]').value,
        selesai: f.querySelector('[name=selesai]').value,
        lokasi: f.querySelector('[name=lokasi]').value,
        instruktur: f.querySelector('[name=instruktur]').value,
        kapasitas: f.querySelector('[name=kapasitas]').value,
        peserta: '[]', status: 'terjadwal'
      };
      if (!data.judul) return UI.toast('Judul pelatihan wajib diisi.', 'err');
      const res = await saveRecord('Training_Jadwal', data);
      if (res.success) { m.close(); route(); }
    };
  }
};
const SertForm = {
  open(record) {
    const m = UI.modal({
      title: record ? 'Ubah Sertifikat' : 'Tambah Sertifikat Pekerja',
      body: `<div class="form-grid">
        ${field('pekerjaNama', 'Nama Pekerja', 'text', record ? record.pekerjaNama : '', '', true)}
        ${field('namaSertifikat', 'Nama Sertifikat / Lisensi', 'text', record ? record.namaSertifikat : '', '', true)}
        ${field('lembaga', 'Lembaga Penerbit', 'select', record ? record.lembaga : 'Kemenaker', [{ v: 'Kemenaker', t: 'Kemenaker' }, { v: 'BNSP RI', t: 'BNSP RI' }, { v: 'Disnaker Prov', t: 'Disnaker Provinsi' }, { v: 'Vendor Eksternal', t: 'Vendor Eksternal' }])}
        ${field('nomor', 'No. Registrasi Lisensi', 'text', record ? record.nomor : '')}
        ${field('expiry', 'Masa Berlaku Sampai', 'date', record ? record.expiry : '', '', true)}
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" data-y>Simpan Sertifikat</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const h = hariSisa(f.querySelector('[name=expiry]').value);
      const data = {
        id: record ? record.id : undefined,
        pekerjaNama: f.querySelector('[name=pekerjaNama]').value,
        namaSertifikat: f.querySelector('[name=namaSertifikat]').value,
        lembaga: f.querySelector('[name=lembaga]').value,
        nomor: f.querySelector('[name=nomor]').value,
        expiry: f.querySelector('[name=expiry]').value,
        status: h != null && h <= 30 ? 'kritis' : h != null && h <= 90 ? 'menexpired' : 'aktif'
      };
      const res = await saveRecord('Sertifikat_Pekerja', data);
      if (res.success) { m.close(); route(); }
    };
  }
};

/* ================= MODUL: PEKERJA & KONTRAKTOR ================= */
Views.pekerja = async function (view) {
  const rows = await loadSheet('Pekerja_Kontraktor');
  const st = { q: '', jenis: '', status: '' };
  function render() {
    const list = rows.filter(r => (!st.jenis || r.jenis === st.jenis)
      && (!st.status || r.status === st.status)
      && (!st.q || (r.nama + ' ' + (r.nik || '') + ' ' + (r.jabatan || '')).toLowerCase().includes(st.q)));
    view.innerHTML = pageHead({
      title: 'Pekerja & Kontraktor',
      sub: 'Manajemen tenaga kerja internal, mitra vendor, dan masa berlaku sertifikasi kompetensi K3.',
      actions: `<button class="btn btn-outline" id="pkExport">Ekspor Excel/CSV</button>
        <button class="btn btn-primary" id="pkNew">+ Tambah Pekerja / Kontraktor</button>`
    }) + `<div class="grid grid-cols-4 mb-1">
      ${UI.statCard({ label: 'Total Pekerja', value: rows.filter(r => r.jenis === 'pekerja').length, small: 'orang', tone: 'indigo', icon: UI.icon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 18) })}
      ${UI.statCard({ label: 'Kontraktor & Vendor', value: rows.filter(r => r.jenis === 'kontraktor').length, small: 'orang', tone: 'blue', icon: UI.icon('M17 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8', 18) })}
      ${UI.statCard({ label: 'Status Aktif Lapangan', value: rows.filter(r => r.status === 'aktif').length, small: 'orang', tone: 'green', icon: UI.icon('M9 12l2 2 4-4', 18), foot: 'On-Duty' })}
      ${UI.statCard({ label: 'Sertifikat Kritis <30 Hari', value: rows.filter(r => { const h = hariSisa(r.sertifikatExpiry); return h != null && h <= 30; }).length, small: 'orang', tone: 'red', icon: UI.icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z', 18) })}
    </div>
    ${searchFilterBar(`
      <select id="fJenis"><option value="">Jenis: Semua</option><option value="pekerja">Pekerja Tetap</option><option value="kontraktor">Kontraktor</option></select>
      <select id="fStatus"><option value="">Status: Semua</option><option value="aktif">Aktif Lapangan</option><option value="nonaktif">Non-Aktif</option></select>`)}
    ${table([
      { label: 'ID', render: r => `<b class="mono">${esc(r.id.slice(0, 8).toUpperCase())}</b>` },
      { label: 'Profil & NIK', render: r => `<div class="row">${UI.avatar(r.nama)}<div><b>${esc(r.nama)}</b><div class="small muted">NIK: ${esc(r.nik || '-')}</div></div></div>` },
      { label: 'Jenis / Instansi', render: r => `<span class="pill ${r.jenis === 'kontraktor' ? 'pill-info' : 'pill-owner'}">${r.jenis === 'kontraktor' ? 'Kontraktor' : 'Pekerja Tetap'}</span><div class="small muted">${esc(r.instansi || '-')}</div>` },
      { label: 'Jabatan / Departemen', render: r => `<b>${esc(r.jabatan || '-')}</b><div class="small muted">${esc(r.departemen || '')}</div>` },
      { label: 'Sertifikat K3', render: r => { const h = hariSisa(r.sertifikatExpiry); return `${esc(r.sertifikatNama || 'Belum ada')}<div class="small ${h != null && h <= 30 ? 'trend-down' : 'muted'}">${r.sertifikatExpiry ? fmtDate(r.sertifikatExpiry) + (h != null && h >= 0 ? ` (${expLabel(h, 'hari lagi')})` : h != null ? ' (Kedaluwarsa)' : '') : ''}</div>`; } },
      { label: 'Status', render: r => UI.statusPill(r.status) }
    ], list, r => `
      <button class="icon-btn" data-pkedit="${r.id}">${UI.icon('M17 3a2.8 2.8 0 0 1 4 4L7 21l-5 1 1-5z', 15)}</button>
      ${Auth.isOwner() ? `<button class="icon-btn danger" data-pkdel="${r.id}">${UI.icon('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6', 15)}</button>` : ''}`)}`;

    view.querySelector('#fJenis').onchange = e => { st.jenis = e.target.value; render(); };
    view.querySelector('#fStatus').onchange = e => { st.status = e.target.value; render(); };
    view.querySelector('#fSearch').oninput = e => { st.q = e.target.value.toLowerCase(); render(); };
    view.querySelector('#pkNew').onclick = () => PekerjaForm.open(null);
    view.querySelector('#pkExport').onclick = async () => { const r = await Api.get('exportCsv', { sheet: 'Pekerja_Kontraktor' }); r.success ? UI.downloadCSV(r.filename, r.csv) : UI.toast(r.message, 'err'); };
    view.querySelectorAll('[data-pkedit]').forEach(b => b.onclick = () => PekerjaForm.open(rows.find(x => x.id === b.dataset.pkedit)));
    view.querySelectorAll('[data-pkdel]').forEach(b => b.onclick = () => removeRow('Pekerja_Kontraktor', b.dataset.pkdel, 'data pekerja'));
  }
  render();
};

const PekerjaForm = {
  open(record) {
    const m = UI.modal({
      title: record ? 'Ubah Pekerja / Kontraktor' : 'Tambah Pekerja / Kontraktor',
      body: `<div class="form-grid">
        ${field('nama', 'Nama Lengkap', 'text', record ? record.nama : '', '', true)}
        ${field('nik', 'NIK / Nomor Identitas', 'text', record ? record.nik : '')}
        ${field('jenis', 'Jenis', 'select', record ? record.jenis : 'pekerja', [{ v: 'pekerja', t: 'Pekerja Tetap' }, { v: 'kontraktor', t: 'Kontraktor / Vendor' }], true)}
        ${field('instansi', 'Instansi / Vendor', 'text', record ? record.instansi : '')}
        ${field('jabatan', 'Jabatan', 'text', record ? record.jabatan : '')}
        ${field('departemen', 'Departemen / Divisi', 'text', record ? record.departemen : '')}
        ${field('sertifikatNama', 'Sertifikat / Lisensi K3', 'text', record ? record.sertifikatNama : '')}
        ${field('sertifikatExpiry', 'Masa Berlaku Sertifikat', 'date', record ? record.sertifikatExpiry : '')}
        <label class="field"><span>Status Lapangan</span><select name="status">
          <option value="aktif" ${record && record.status === 'aktif' ? 'selected' : ''}>Aktif Lapangan</option>
          <option value="nonaktif" ${record && record.status === 'nonaktif' ? 'selected' : ''}>Non-Aktif / Izin Cuti</option></select></label>
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" data-y>Simpan</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const data = {
        id: record ? record.id : undefined,
        nama: f.querySelector('[name=nama]').value, nik: f.querySelector('[name=nik]').value,
        jenis: f.querySelector('[name=jenis]').value, instansi: f.querySelector('[name=instansi]').value,
        jabatan: f.querySelector('[name=jabatan]').value, departemen: f.querySelector('[name=departemen]').value,
        sertifikatNama: f.querySelector('[name=sertifikatNama]').value,
        sertifikatExpiry: f.querySelector('[name=sertifikatExpiry]').value,
        status: f.querySelector('[name=status]').value
      };
      if (!data.nama) return UI.toast('Nama wajib diisi.', 'err');
      const res = await saveRecord('Pekerja_Kontraktor', data);
      if (res.success) { m.close(); route(); }
    };
  }
};

/* ================= MODUL: REPORT & KPI ================= */
Views.laporan = async function (view) {
  const [kpis, insiden, inspeksi] = await Promise.all([loadSheet('KPI_HSE'), loadSheet('Insiden_Accident'), loadSheet('Inspeksi')]);
  const period = { t: 'Bulanan' };

  // Tren 6 bulan
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    months.push({ key, label: d.toLocaleDateString('id-ID', { month: 'short' }), near: 0, bahaya: 0 });
  }
  insiden.forEach(r => {
    const b = months.find(m => m.key === String(r.tanggal || '').slice(0, 7));
    if (!b) return;
    if (r.kategori === 'near_miss') b.near++; else b.bahaya++;
  });

  function render() {
    const kpiCards = kpis.slice(0, 5).map(k => {
      const target = num(k.target), real = num(k.realisasi);
      const pct = target ? Math.min(100, Math.round(real / target * 100)) : 0;
      return UI.statCard({ label: k.nama, value: money(real), small: k.satuan, tone: k.status === 'tercapai' ? 'green' : 'indigo',
        icon: UI.icon('M9 11l3 3L22 4', 16),
        foot: `Target ${money(target)} · <b class="${pct >= 100 ? 'trend-up' : ''}">${pct}%</b>` });
    }).join('');

    view.innerHTML = pageHead({
      title: 'Laporan & Kinerja K3L (HSE KPI)',
      sub: 'Evaluasi indikator keselamatan kerja, tren frekuensi kecelakaan, serta konsolidasi laporan berkala siap ekspor.',
      actions: `<button class="btn btn-outline" id="repCsvKpi">Ekspor Excel (.csv)</button>
        <button class="btn btn-primary" id="repPdf">Ekspor Laporan PDF</button>`
    }) + `
    <div class="tabs">${['Harian', 'Mingguan', 'Bulanan'].map(p => `<button class="tab ${period.t === p ? 'active' : ''}" data-p="${p}">${p}</button>`).join('')}</div>
    <div class="grid grid-cols-4 mb-1">${kpiCards || UI.emptyState('Belum ada indikator KPI.')}</div>
    <div class="grid grid-cols-2 mb-1">
      <div class="card"><div class="card-head"><h3>Tren Insiden & Observasi</h3><div class="legend"><span><i style="background:#F97316"></i>Unsafe Condition</span><span><i style="background:#4F46E5"></i>Near Miss</span></div></div>
        <div id="repBars" style="height:220px"></div></div>
      <div class="card"><div class="card-head"><h3>Tindak Lanjut Inspeksi</h3><span class="hint">Resolusi temuan audit</span></div>
        <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap">
          <div id="repDonut" style="width:170px;height:170px"></div>
          <div style="flex:1;min-width:180px;display:flex;flex-direction:column;gap:.5rem">
            ${[['Selesai (CAPA)', inspeksi.filter(r => r.status === 'closed' || r.status === 'approved').length, '#16A34A'],
               ['Tindak Lanjut', inspeksi.filter(r => r.status === 'pending').length, '#F59E0B'],
               ['Validasi Owner', inspeksi.length, '#4F46E5']].map(x => `<div class="row spread small"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${x[2]};margin-right:6px"></i>${x[0]}</span><b>${x[1]} (${inspeksi.length ? Math.round(x[1] / inspeksi.length * 100) : 0}%)</b></div>`).join('')}
          </div></div></div>
    </div>
    <div class="card"><div class="card-head"><h3>Registri Indikator KPI K3L</h3>
      ${Auth.isOwner() ? `<button class="btn btn-primary btn-sm" id="kpiAdd">+ Tambah Indikator KPI</button>` : ''}</div>
      ${table([
        { label: 'Kode', render: r => `<b class="mono">${esc(r.kode)}</b>` },
        { label: 'Indikator', render: r => `<b>${esc(r.nama)}</b><div class="small muted">${esc(r.kategori)} · ${esc(r.satuan || '')}</div>` },
        { label: 'Target', render: r => esc(r.target) },
        { label: 'Realisasi', render: r => `<b>${esc(r.realisasi)}</b>` },
        { label: 'Deviasi', render: r => { const t = num(r.target), v = num(r.realisasi); const d = t ? ((v - t) / t * 100).toFixed(1) + '%' : '—'; return `<span class="${v >= t ? 'trend-up' : 'trend-down'}">${d}</span>`; } },
        { label: 'Status', render: r => `<span class="pill ${r.status === 'tercapai' ? 'pill-success' : r.status === 'atensi' ? 'pill-warning' : 'pill-info'}">${esc(r.status)}</span>` }
      ], kpis, r => Auth.isOwner() ? `<button class="icon-btn" data-kpiedit="${r.id}">${UI.icon('M17 3a2.8 2.8 0 0 1 4 4L7 21l-5 1 1-5z', 15)}</button>` : '')}
    </div>
    ${kpis.some(k => k.status === 'atensi') ? `<div class="card mt-2" style="border-color:#FED7AA"><b>Rekomendasi Strategis</b>
      <p class="small mt-1">Fokus tindakan prioritas: percepat penutupan CAPA mayor dan lengkapi dokumen sertifikasi auditor sebelum audit eksternal kuartal berjalan.</p></div>` : ''}`;

    view.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { period.t = b.dataset.p; render(); });
    Charts.bars(document.getElementById('repBars'), months.map(m => m.label), [
      { name: 'Near Miss', color: '#4F46E5', values: months.map(m => m.near) },
      { name: 'Unsafe Condition', color: '#F97316', values: months.map(m => m.bahaya) }
    ]);
    const done = inspeksi.filter(r => r.status === 'closed' || r.status === 'approved').length;
    Charts.donut(document.getElementById('repDonut'), [
      { label: 'Selesai', value: done, color: '#16A34A' },
      { label: 'Proses', value: inspeksi.length - done, color: '#F59E0B' }
    ], inspeksi.length);
    view.querySelector('#repPdf').onclick = () => window.print();
    view.querySelector('#repCsvKpi').onclick = async () => { const r = await Api.get('exportCsv', { sheet: 'KPI_HSE' }); r.success ? UI.downloadCSV(r.filename, r.csv) : UI.toast(r.message, 'err'); };
    const addBtn = view.querySelector('#kpiAdd'); if (addBtn) addBtn.onclick = () => KpiForm.open(null);
    view.querySelectorAll('[data-kpiedit]').forEach(b => b.onclick = () => KpiForm.open(kpis.find(x => x.id === b.dataset.kpiedit)));
  }
  render();
};

function money(n) { return Number(n || 0).toLocaleString('id-ID'); }

const KpiForm = {
  open(record) {
    const m = UI.modal({
      title: record ? 'Ubah Indikator KPI' : 'Tambah Indikator KPI',
      body: `<div class="form-grid">
        ${field('kode', 'Kode Indikator', 'text', record ? record.kode : 'KPI-HSE-06')}
        ${field('nama', 'Nama Indikator', 'text', record ? record.nama : '', '', true)}
        ${field('kategori', 'Kategori', 'select', record ? record.kategori : 'Leading', [{ v: 'Leading', t: 'Leading (Budaya Pencegahan)' }, { v: 'Lagging', t: 'Lagging (Hasil / Outcome)' }])}
        ${field('satuan', 'Satuan', 'text', record ? record.satuan : 'Persentase')}
        ${field('target', 'Target', 'text', record ? record.target : '')}
        ${field('realisasi', 'Realisasi', 'text', record ? record.realisasi : '0')}
        ${field('periode', 'Periode', 'select', record ? record.periode : '2026-Q1', [{ v: '2026-Q1', t: '2026-Q1' }, { v: '2026-Q2', t: '2026-Q2' }, { v: 'Bulanan', t: 'Bulanan' }])}
        ${field('status', 'Status', 'select', record ? record.status : 'ontrack', [{ v: 'tercapai', t: 'Tercapai' }, { v: 'ontrack', t: 'On-Track' }, { v: 'atensi', t: 'Atensi / Perlu Perhatian' }])}
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" data-y>Simpan KPI</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const data = {
        id: record ? record.id : undefined,
        kode: f.querySelector('[name=kode]').value, nama: f.querySelector('[name=nama]').value,
        kategori: f.querySelector('[name=kategori]').value, satuan: f.querySelector('[name=satuan]').value,
        target: f.querySelector('[name=target]').value, realisasi: f.querySelector('[name=realisasi]').value,
        periode: f.querySelector('[name=periode]').value, status: f.querySelector('[name=status]').value
      };
      const r = await Api.post('kpiUpsert', { data });
      if (r.success) { UI.toast('KPI tersimpan.', 'ok'); m.close(); delete App.cache['KPI_HSE']; route(); }
      else UI.toast(r.message, 'err');
    };
  }
};

/* ================= MODUL: PERSETUJUAN ================= */
Views.persetujuan = async function (view) {
  const r = await Api.get('pendingQueue');
  const queue = r.success ? r.data : [];
  const st = { tab: 'Semua', q: '' };
  function sheetLabel(s) { return { Dokumen_K3: 'Dokumen / PTW', Inspeksi: 'Temuan Inspeksi', Insiden_Accident: 'Laporan Insiden' }[s] || s; }
  function render() {
    const list = queue.filter(x => (st.tab === 'Semua' || x.sheet === st.tab)
      && (!st.q || (x.judul + ' ' + x.nomor + ' ' + x.pembuat).toLowerCase().includes(st.q)));
    view.innerHTML = pageHead({
      title: 'Pusat Antrean Persetujuan Owner',
      sub: 'Otorisasi tunggal berkas K3: Permit to Work (PTW), laporan investigasi insiden, temuan inspeksi kritis, dan dokumen HIRADC/JSA sebelum eksekusi lapangan dimulai.',
      actions: `<button class="btn btn-primary" id="batchOk">✓ Setujui Terpilih (Batch)</button>`
    }) + `<div class="grid grid-cols-4 mb-1">
      ${UI.statCard({ label: 'Total Butuh Otorisasi', value: queue.length, tone: 'indigo', icon: UI.icon('M9 12l2 2 4-4M21 12c0 5-4 8-9 9-5-1-9-4-9-9V5l9-3 9 3v7z', 18) })}
      ${UI.statCard({ label: 'Permit to Work (PTW)', value: queue.filter(x => x.sheet === 'Dokumen_K3').length, tone: 'orange', icon: UI.icon('M9 12l2 2 4-4', 18) })}
      ${UI.statCard({ label: 'Insiden & CAPA', value: queue.filter(x => x.sheet === 'Insiden_Accident').length, tone: 'blue', icon: UI.icon('M12 9v4m0 4h.01', 18) })}
      ${UI.statCard({ label: 'Temuan Inspeksi & JSA', value: queue.filter(x => x.sheet === 'Inspeksi').length, tone: 'green', icon: UI.icon('M9 11l3 3L22 4', 18) })}
    </div>
    <div class="tabs">${['Semua', 'Dokumen_K3', 'Insiden_Accident', 'Inspeksi'].map(t =>
      `<button class="tab ${st.tab === t ? 'active' : ''}" data-tab="${t}">${t === 'Semua' ? 'Semua' : sheetLabel(t)} <span class="count">${t === 'Semua' ? queue.length : queue.filter(x => x.sheet === t).length}</span></button>`).join('')}</div>
    ${searchFilterBar('')}
    ${table([
      { label: 'No. Berkas', render: x => `<b class="mono">${esc(x.nomor)}</b><div class="small muted">${fmtDateTime(x.tanggal)}</div>` },
      { label: 'Judul & Modul', render: x => `<b>${esc(x.judul)}</b><div><span class="pill pill-neutral pill-plain">${sheetLabel(x.sheet)}</span></div>` },
      { label: 'Staff HSE', render: x => esc(x.pembuat || '-') },
      { label: 'Kategori / Risiko', render: x => esc(x.kategori || x.risiko || '-') }
    ], list, x => `
      <button class="icon-btn" data-qview="${x.sheet}|${x.id}" title="Detail">${UI.icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 15)}</button>
      ${Auth.isOwner() ? `<button class="icon-btn" data-qok="${x.sheet}|${x.id}" title="Setujui">${UI.icon('M20 6 9 17l-5-5', 15)}</button>
      <button class="icon-btn danger" data-qno="${x.sheet}|${x.id}" title="Tolak">${UI.icon('M18 6 6 18M6 6l12 12', 15)}</button>` : '<span class="muted small">Menunggu Owner</span>'}`)}`;

    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; render(); });
    view.querySelector('#fSearch').oninput = e => { st.q = e.target.value.toLowerCase(); render(); };
    view.querySelector('#batchOk').onclick = async () => {
      if (!Auth.isOwner()) return UI.toast('Hanya Owner yang dapat menyetujui.', 'err');
      const target = queue.filter(x => ['Dokumen_K3', 'Insiden_Accident', 'Inspeksi'].includes(x.sheet));
      let n = 0;
      for (const x of target) { const res = await Api.post('approve', { sheet: x.sheet, id: x.id }); if (res.success) n++; }
      UI.toast(n + ' berkas disetujui.', 'ok'); route();
    };
    view.querySelectorAll('[data-qok]').forEach(b => b.onclick = async () => {
      const [sheet, id] = b.dataset.qok.split('|'); await approve(sheet, id);
    });
    view.querySelectorAll('[data-qno]').forEach(b => b.onclick = () => { const [sheet, id] = b.dataset.qno.split('|'); rejectRow(sheet, id); });
    view.querySelectorAll('[data-qview]').forEach(b => b.onclick = async () => {
      const [sheet, id] = b.dataset.qview.split('|');
      const res = await Api.detail(sheet, id);
      if (!res.success) return UI.toast(res.message, 'err');
      const d = res.data;
      UI.modal({ title: `${sheetLabel(sheet)} — ${d.nomor || d.kode || d.id.slice(0, 8)}`,
        body: `<div class="kv">${Object.keys(d).filter(k => !['matriks', 'hasil', 'temuan', 'capa', 'rootWhy', 'apd', 'gas', 'terlibat', 'peserta'].includes(k))
          .map(k => `<div><div class="k">${esc(k)}</div><div class="v">${typeof d[k] === 'object' ? esc(JSON.stringify(d[k])) : esc(d[k] ?? '—')}</div></div>`).join('')}</div>`,
        footer: `<button class="btn btn-outline" data-x>Tutup</button>` }).root.querySelector('[data-x]').onclick = e => e.target.closest('.modal-overlay').remove();
    });
  }
  render();
};

/* ================= MODUL: PENGATURAN ================= */
function applyTheme(name) {
  const presets = {
    'indigo-orange': { p: '#4F46E5', ph: '#4338CA', o: '#F97316', oh: '#EA580C' },
    'emerald-amber': { p: '#059669', ph: '#047857', o: '#F59E0B', oh: '#D97706' },
    'slate-blue': { p: '#334155', ph: '#1E293B', o: '#0284C7', oh: '#0369A1' },
    'navy-amber': { p: '#1E3A8A', ph: '#172554', o: '#F59E0B', oh: '#B45309' },
    'forest-green': { p: '#15803D', ph: '#166534', o: '#EA580C', oh: '#C2410C' }
  };
  const t = presets[name] || presets['indigo-orange'];
  const root = document.documentElement.style;
  root.setProperty('--primary', t.p); root.setProperty('--primary-hover', t.ph);
  root.setProperty('--orange', t.o); root.setProperty('--orange-hover', t.oh);
}

Views.pengaturan = async function (view) {
  if (!Auth.isOwner()) {
    view.innerHTML = pageHead({ title: 'Pengaturan', sub: '' }) + `<div class="card">Modul ini khusus Owner. Kembali ke <a href="#/dashboard">Dashboard</a>.</div>`;
    return;
  }
  const users = await loadSheet('Users_Akun');
  const s = App.settings;
  view.innerHTML = pageHead({
    title: 'Pengaturan Sistem & Manajemen Pengguna (RBAC)',
    sub: 'Konfigurasi identitas aplikasi, tema visual, akun Google Workspace, serta matriks hak akses berbasis peran.'
  }) + `
  <div class="grid grid-cols-2">
    <div class="card"><div class="card-head"><h3>Umum & Identitas Aplikasi</h3><span class="hint">Section 01</span></div>
      <div class="form-grid">
        ${field('APP_NAME', 'Nama Aplikasi Web', 'text', s.APP_NAME || 'Safety First', '', true)}
        ${field('TIMEZONE', 'Zona Waktu Operasional', 'select', s.TIMEZONE || 'Asia/Jakarta', [{ v: 'Asia/Jakarta', t: 'WIB (UTC+07:00)' }, { v: 'Asia/Makassar', t: 'WITA (UTC+08:00)' }, { v: 'Asia/Jayapura', t: 'WIT (UTC+09:00)' }])}
        ${field('DATE_FORMAT', 'Format Tanggal', 'select', s.DATE_FORMAT || 'DD/MM/YYYY', [{ v: 'DD/MM/YYYY', t: 'DD/MM/YYYY' }, { v: 'MM/DD/YYYY', t: 'MM/DD/YYYY' }])}
      </div>
      <div class="field"><span>Pola Tema Visual</span>
        <div class="check-grid">${[
          ['indigo-orange', 'Indigo & Safety Orange', '#4F46E5'],
          ['emerald-amber', 'Emerald & Amber', '#059669'],
          ['slate-blue', 'Slate Industrial & Blue', '#334155'],
          ['navy-amber', 'Navy Deep & Amber', '#1E3A8A'],
          ['forest-green', 'Forest Green & Orange', '#15803D']
        ].map(t => `<label class="field-check"><input type="radio" name="THEME" value="${t[0]}" ${(s.THEME || 'indigo-orange') === t[0] ? 'checked' : ''}><span><b style="color:${t[2]}">●</b> ${t[1]}</span></label>`).join('')}</div>
      <button class="btn btn-primary btn-sm mt-1" id="setSave">Simpan Pengaturan</button>
    </div>
    <div class="card"><div class="card-head"><h3>Notifikasi Gmail & Integrasi Otomatis</h3><span class="hint">Section 04</span></div>
      <label class="field-check mb-1"><input type="checkbox" name="NOTIF_INSIDEN" ${s.NOTIF_INSIDEN !== 'false' ? 'checked' : ''}><span><b>Peringatan Kecelakaan & Near Miss</b><span>Email prioritas ke Owner setiap insiden kritikal / LTI.</span></span></label>
      <label class="field-check mb-1"><input type="checkbox" name="NOTIF_PTW" ${s.NOTIF_PTW !== 'false' ? 'checked' : ''}><span><b>Pengingat Izin Kerja (PTW Expiry)</b><span>Kirim notifikasi 2 jam sebelum masa aktif PTW habis.</span></span></label>
      <label class="field-check"><input type="checkbox" name="NOTIF_EXPIRY" ${s.NOTIF_EXPIRY !== 'false' ? 'checked' : ''}><span><b>Kedaluwarsa APD & Sertifikat</b><span>Ringkasan harian pukul 07:00 via trigger harian.</span></span></label>
    </div>
  </div>

  <div class="card mt-2"><div class="card-head"><h3>Akun Pengguna & Google Workspace</h3>
    <button class="btn btn-primary btn-sm" id="userAdd">+ Tambah Akun Staff</button></div>
    ${table([
      { label: 'Pengguna', render: u => `<div class="row">${UI.avatar(u.nama)}<div><b>${esc(u.nama)}</b><div class="small muted">${esc(u.email)}</div></div></div>` },
      { label: 'Peran', render: u => `<span class="pill ${u.peran === 'owner' ? 'pill-owner' : 'pill-staff'}">${u.peran === 'owner' ? 'Owner' : 'Staff HSE'}</span>` },
      { label: 'Bergabung', render: u => fmtDate(u.createdAt) },
      { label: 'Status', render: u => UI.statusPill(u.status) }
    ], users, u => Auth.user().email === u.email ? '<span class="muted small">Akun Anda</span>' : `
      ${u.status !== 'active' ? `<button class="btn btn-success btn-sm" data-uok="${u.id}">Setujui Akun</button>` : `<button class="btn btn-outline btn-sm" data-udis="${u.id}">Nonaktifkan</button>`}`)}
  </div>

  <div class="card mt-2"><div class="card-head"><h3>Matriks Hak Akses (RBAC Matrix)</h3><span class="hint">Read-Only Matrix</span></div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Fitur & Ruang Lingkup Modul</th><th>Owner (Anda)</th><th>Staff HSE (Maks. 2 Orang)</th></tr></thead><tbody>
      <tr><td>Lihat Seluruh Data & Laporan HSE</td><td>✓ Ya (Penuh)</td><td>✓ Ya (Penuh)</td></tr>
      <tr><td>Input / Ubah Dokumen & Temuan Lapangan</td><td>✓ Ya (Final)</td><td>✓ Draft → Menunggu Review</td></tr>
      <tr><td>Otorisasi Final (PTW, Insiden & Audit Lapangan)</td><td>✓ Disetujui Final</td><td>✗ Tidak (Menunggu Owner)</td></tr>
      <tr><td>Hapus Data Arus Lapangan</td><td>✓ Ya</td><td>✗ Tidak Diberikan</td></tr>
      <tr><td>Kelola Pengaturan, Akun & Lisensi Google</td><td>✓ Hak Eksklusif</td><td>✗ Akses Ditolak</td></tr>
    </tbody></table></div>
    <p class="small muted mt-1">Staff HSE bertindak sebagai validator data, sedangkan otorisasi legal sepenuhnya dipegang Owner sesuai regulasi K3L internal.</p>
  </div>`;

  view.querySelector('#setSave').onclick = async () => {
    const f = view;
    const items = [
      { key: 'APP_NAME', value: f.querySelector('[name=APP_NAME]').value },
      { key: 'TIMEZONE', value: f.querySelector('[name=TIMEZONE]').value },
      { key: 'DATE_FORMAT', value: f.querySelector('[name=DATE_FORMAT]').value },
      { key: 'THEME', value: f.querySelector('input[name=THEME]:checked').value },
      { key: 'NOTIF_INSIDEN', value: f.querySelector('[name=NOTIF_INSIDEN]').checked ? 'true' : 'false' },
      { key: 'NOTIF_PTW', value: f.querySelector('[name=NOTIF_PTW]').checked ? 'true' : 'false' },
      { key: 'NOTIF_EXPIRY', value: f.querySelector('[name=NOTIF_EXPIRY]').checked ? 'true' : 'false' }
    ];
    const r = await Api.post('settingsUpsert', { items });
    if (r.success) { UI.toast('Pengaturan disimpan.', 'ok'); App.settings = Object.assign(App.settings, Object.fromEntries(items.map(i => [i.key, i.value]))); applyTheme(items.find(i => i.key === 'THEME').value); route(); }
    else UI.toast(r.message, 'err');
  };
  view.querySelector('#userAdd').onclick = () => {
    const m = UI.modal({
      title: 'Tambah Akun Staff HSE',
      body: `<div class="form-grid">
        ${field('email', 'Email Google', 'email', '', 'nama@perusahaan.com', true)}
        ${field('nama', 'Nama Lengkap', 'text', '', '', true)}
        ${field('peran', 'Peran', 'select', 'staff', [{ v: 'staff', t: 'Staff HSE / Pengawas' }, { v: 'owner', t: 'Owner (hati-hati)' }])}
      </div>`,
      footer: `<button class="btn btn-outline" data-x>Batal</button><button class="btn btn-primary" data-y>Buat Akun</button>`
    });
    m.root.querySelector('[data-x]').onclick = () => m.close();
    m.root.querySelector('[data-y]').onclick = async () => {
      const f = m.root;
      const r = await Api.post('userUpsert', { data: { email: f.querySelector('[name=email]').value.trim().toLowerCase(), nama: f.querySelector('[name=nama]').value, peran: f.querySelector('[name=peran]').value, status: 'active' } });
      if (r.success) { UI.toast('Akun dibuat aktif.', 'ok'); m.close(); delete App.cache['Users_Akun']; route(); }
      else UI.toast(r.message, 'err');
    };
  };
  view.querySelectorAll('[data-uok]').forEach(b => b.onclick = async () => { await Api.post('userSetStatus', { id: b.dataset.uok, status: 'active' }); UI.toast('Akun disetujui aktif.', 'ok'); delete App.cache['Users_Akun']; route(); });
  view.querySelectorAll('[data-udis]').forEach(b => b.onclick = async () => { await Api.post('userSetStatus', { id: b.dataset.udis, status: 'disabled' }); UI.toast('Akun dinonaktifkan.', 'ok'); delete App.cache['Users_Akun']; route(); });
};


/* ---------------- Bootstrap ---------------- */
function bindStaticEvents() {
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    const res = await Auth.login(
      document.getElementById('loginEmail').value.trim(),
      document.getElementById('loginNama').value.trim()
    );
    btn.disabled = false;
    if (res.success) { UI.toast('Selamat datang, ' + res.user.nama, 'ok'); location.hash = '#/dashboard'; route(); }
    else UI.toast(res.message || 'Gagal masuk.', 'err');
  });
  document.getElementById('btnLogout').onclick = async () => { await Auth.logout(); location.hash = ''; route(); };
  document.getElementById('btnMenu').onclick = () => document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sideBackdrop').onclick = () => document.getElementById('sidebar').classList.remove('open');
  document.getElementById('fabReport').onclick = () => IncidentForm.open();
  document.getElementById('btnBell').onclick = async () => {
    const r = await Api.get('pendingQueue');
    if (!r.success) return UI.toast(r.message, 'err');
    const rows = r.data;
    UI.modal({
      title: `Antrean Persetujuan (${rows.length})`,
      body: rows.length ? table([
        { label: 'Berkas', render: x => `<b class="mono">${esc(x.nomor)}</b><div class="small muted">${esc(x.judul)}</div>` },
        { label: 'Modul', render: x => `<span class="pill pill-neutral pill-plain">${esc(x.kategori || x.sheet)}</span>` },
        { label: 'Staff', render: x => esc(x.pembuat) },
        { label: 'Tanggal', render: x => fmtDate(x.tanggal) }
      ], rows, x => `<button class="btn btn-primary btn-sm" onclick="location.hash='#/persetujuan'">Buka</button>`) : UI.emptyState('Tidak ada berkas menunggu persetujuan.'),
      footer: `<button class="btn btn-outline" data-x>Tutup</button>`
    }).root.querySelector('[data-x]').onclick = e => e.target.closest('.modal-overlay').remove();
  };
  document.getElementById('globalSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') { App.query = e.target.value.toLowerCase(); route(); }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindStaticEvents();
  window.addEventListener('hashchange', route);
  await route();
});
