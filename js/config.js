/* ============================================================
   SAFETY FIRST — Konfigurasi & metadata modul
   Ganti GAS_URL dengan URL deployment Web App (lihat README)
   ============================================================ */
const CONFIG = {
  // URL Web App GAS (deploy > New deployment > Web app > salin /exec)
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwQ9XKGt4lcLqj8ZH3bhULZtt-Q8NX5Q-wbhuereL2wiOy3WhvL31guHq5iTNwexwHv/exec',

  APP_DEFAULT_NAME: 'Safety First',

  // Daftar navigasi: key (hash route), label, sheet backend, icon (svg path), peran minimal
  NAV: [
    { key: 'dashboard',  label: 'Dashboard',            sheet: null,            icon: 'M3 12 12 3l9 9M5 10v10h5v-6h4v6h5V10', roles: ['owner', 'staff'] },
    { key: 'dokumen',    label: 'Dokumen K3',           sheet: 'Dokumen_K3',    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 0v6h6', roles: ['owner', 'staff'] },
    { key: 'inspeksi',   label: 'Inspeksi HSE',         sheet: 'Inspeksi',      icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', roles: ['owner', 'staff'] },
    { key: 'insiden',    label: 'Insiden & Accident',   sheet: 'Insiden_Accident', icon: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', roles: ['owner', 'staff'] },
    { key: 'apd',        label: 'APD Management',       sheet: 'APD_Distribusi', icon: 'M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z', roles: ['owner', 'staff'] },
    { key: 'training',   label: 'Training & Sertifikasi', sheet: 'Training_Jadwal', icon: 'M22 10 12 5 2 10l10 5 10-5v6M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5', roles: ['owner', 'staff'] },
    { key: 'pekerja',    label: 'Pekerja & Kontraktor',  sheet: 'Pekerja_Kontraktor', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8', roles: ['owner', 'staff'] },
    { key: 'laporan',    label: 'Report & KPI',         sheet: 'KPI_HSE',       icon: 'M9 17v-6m6 6V7M3 21h18', roles: ['owner'] },
    { key: 'persetujuan', label: 'Persetujuan',         sheet: null,            icon: 'M9 12l2 2 4-4M21 12c0 5-4 8-9 9-5-1-9-4-9-9V5l9-3 9 3v7z', roles: ['owner', 'staff'] },
    { key: 'pengaturan', label: 'Pengaturan',            sheet: null,            icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z', roles: ['owner'] }
  ],

  // Navigasi bawah mobile
  BOTTOM_NAV: ['dashboard', 'insiden', 'inspeksi', 'dokumen', 'apd'],

  STATUS: {
    approved:   { label: 'Disetujui',    cls: 'pill-success' },
    pending:    { label: 'Menunggu Persetujuan', cls: 'pill-warning' },
    rejected:   { label: 'Ditolak',     cls: 'pill-danger' },
    draft:      { label: 'Draft',       cls: 'pill-neutral' },
    closed:     { label: 'Selesai',    cls: 'pill-success' },
    aktif:      { label: 'Aktif',       cls: 'pill-success' },
    active:     { label: 'Aktif',       cls: 'pill-success' },
    nonaktif:   { label: 'Non-Aktif',  cls: 'pill-neutral' },
    disabled:   { label: 'Dinonaktifkan', cls: 'pill-neutral' },
    terjadwal:  { label: 'Terjadwal',  cls: 'pill-info' },
    selesai:    { label: 'Selesai',    cls: 'pill-success' },
    kritis:     { label: 'Kritis Segera', cls: 'pill-danger' },
    menexpired: { label: 'Mendekati Habis', cls: 'pill-warning' },
    retak_rusak:{ label: 'Rusak / Retak', cls: 'pill-danger' },
    baik:       { label: 'Baik / Layak', cls: 'pill-success' },
    mendekati_expired: { label: 'Mendekati Expired', cls: 'pill-warning' }
  },

  INSIDEN_KATEGORI: {
    accident:          { label: 'Accident',          cls: 'pill-danger' },
    near_miss:         { label: 'Near Miss',          cls: 'pill-warning' },
    first_aid:         { label: 'First Aid',          cls: 'pill-info' },
    medical_treatment: { label: 'Medical Treatment',  cls: 'pill-info' },
    lti:               { label: 'LTI',                cls: 'pill-danger' },
    property_damage:   { label: 'Property Damage',    cls: 'pill-neutral' },
    unsafe_action:     { label: 'Unsafe Action',      cls: 'pill-warning' },
    unsafe_condition:  { label: 'Unsafe Condition',   cls: 'pill-danger' }
  },

  DOKUMEN_TIPE: {
    PTW:    { label: 'Permit to Work', cls: 'pill-danger' },
    JSA:    { label: 'JSA',            cls: 'pill-info' },
    HIRADC: { label: 'HIRADC',         cls: 'pill-neutral' }
  }
};

// Format tanggal lokal Indonesia (dd Mmm yyyy)
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
         d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function hariSisa(v) {
  if (!v) return null;
  const d = new Date(v); if (isNaN(d)) return null;
  return Math.ceil((d - new Date()) / 86400000);
}
function expLabel(h, unit) {
  if (h == null) return '';
  if (h < 0) return 'Kedaluwarsa';
  return h + ' ' + unit;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
