/* api.js - the only file that talks to the Learnist backend */
const Api = (() => {
  // For local testing against your own server use: 'http://127.0.0.1:8000/api'
  const BASE = 'https://learnist-api.onrender.com/api';

  let access = null, refresh = null;
  try {
    access = localStorage.getItem('la_access');
    refresh = localStorage.getItem('la_refresh');
  } catch (e) { /* storage blocked: tokens live in memory only */ }

  function save() {
    try {
      access ? localStorage.setItem('la_access', access) : localStorage.removeItem('la_access');
      refresh ? localStorage.setItem('la_refresh', refresh) : localStorage.removeItem('la_refresh');
    } catch (e) { /* ignore */ }
  }

  function message(data) {
    if (!data) return 'Something went wrong. Please try again.';
    if (data.detail) return data.detail;
    const first = Object.values(data)[0];
    return Array.isArray(first) ? first[0] : String(first);
  }

  async function refreshAccess() {
    if (!refresh) return false;
    const res = await fetch(BASE + '/auth/refresh/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh })
    });
    if (!res.ok) { access = refresh = null; save(); return false; }
    access = (await res.json()).access;
    save();
    return true;
  }

  async function request(method, path, body, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (access) headers.Authorization = 'Bearer ' + access;
    const res = await fetch(BASE + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (res.status === 401 && retry && refresh && await refreshAccess()) {
      return request(method, path, body, false);       // retry once with a fresh token
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(message(data)), { status: res.status, data });
    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
    isLoggedIn: () => !!access,
    async login(email, password) {
      const d = await request('POST', '/auth/login/', { email, password });
      access = d.access; refresh = d.refresh; save();
      return d.user;
    },
    async register(form) {   // { name, email, phone, password, confirmPassword }
      const d = await request('POST', '/auth/register/', form);
      access = d.access; refresh = d.refresh; save();
      return d.user;
    },
    logout() { access = refresh = null; save(); }
  };
})();