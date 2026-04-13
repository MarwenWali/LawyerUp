import { getToken } from './storage.js';

// In dev, use same-origin + Vite proxy so API calls work when opening the app via LAN IP or localhost.
export const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3000');
const BASE_URL = API_BASE_URL;

async function request(endpoint, options = {}) {
  const { body, method = 'GET', ...rest } = options;
  const token = getToken();

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...rest,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || `Error ${res.status}`);
  }

  return res.json();
}

export const authAPI = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
};

export const adminAPI = {
  getStats: () => request('/api/admin/stats'),
  getLogs: () => request('/api/admin/logs'),
  getUsers: () => request('/api/admin/users'),
  updateStatus: (id, status) =>
    request(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteUser: (id) =>
    request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  verifyLawyer: (id, action) =>
    // action: 'verify' | 'reject' | 'revoke'
    request(`/api/admin/lawyers/${id}/verify`, { method: 'PATCH', body: { action } }),
};
