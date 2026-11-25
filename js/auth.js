/* ============================================================
   Sesi lokal (token dari backend). RBAC: owner / staff
   ============================================================ */
const Auth = (function () {
  const KEY = 'sf_session_v1';

  function session() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function set(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function clear() { localStorage.removeItem(KEY); }

  async function login(email, nama) {
    const res = await Api.post('login', { email, nama });
    if (res.success) {
      set({ token: res.token, user: res.user });
    }
    return res;
  }
  async function logout() {
    await Api.post('logout', {});
    clear();
  }
  function user() { const s = session(); return s ? s.user : null; }
  function isOwner() { const u = user(); return u && u.peran === 'owner'; }
  function can(roles) { const u = user(); return u && roles.indexOf(u.peran) >= 0; }

  return { session, set, clear, login, logout, user, isOwner, can };
})();
