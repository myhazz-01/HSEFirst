/* ============================================================
   Lapisan komunikasi REST ke Google Apps Script
   Aturan CORS (gas-pro-api): POST WAJIB text/plain;charset=utf-8
   ============================================================ */
const Api = (function () {
  function token() { const s = Auth.session(); return s ? s.token : ''; }

  async function get(action, params) {
    try {
      const q = new URLSearchParams(Object.assign({ action, token: token() }, params || {}));
      const res = await fetch(CONFIG.GAS_URL + '?' + q.toString(), { method: 'GET' });
      const json = await res.json();
      if (json && json.success === false && /sesi tidak valid/i.test(json.message)) Auth.clear();
      return json || { success: false, message: 'Respon server tidak valid.' };
    } catch (err) {
      console.error('GET error', action, err);
      return { success: false, message: 'Gagal menghubungi server. Periksa koneksi / GAS_URL.' };
    }
  }

  async function post(action, data) {
    try {
      const payload = Object.assign({ action, token: token() }, data || {});
      const res = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // WAJIB untuk GAS (anti preflight OPTIONS)
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json && json.success === false && /sesi tidak valid/i.test(json.message)) Auth.clear();
      return json || { success: false, message: 'Respon server tidak valid.' };
    } catch (err) {
      console.error('POST error', action, err);
      return { success: false, message: 'Gagal menghubungi server. Periksa koneksi / GAS_URL.' };
    }
  }

  return { get, post, list: (sheet, status) => get('list', { sheet, status }), detail: (sheet, id) => get('detail', { sheet, id }) };
})();
