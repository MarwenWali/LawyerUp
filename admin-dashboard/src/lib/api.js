import { getToken } from './storage.js';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
