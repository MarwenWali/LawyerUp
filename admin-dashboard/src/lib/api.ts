// API Client for LawyerUp Admin Dashboard — keep auth in sync with storage.js / useAuth.js
import { getToken } from './storage.js';

const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3000');

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiCall(endpoint: string, options: RequestOptions = {}) {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    ).toString();
    if (queryString) url += `?${queryString}`;
  }

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || error.error || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Call Failed: ${endpoint}`, error);
    throw error;
  }
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// ── Admin Consolidated API ────────────────────────────────────────────────────
// This matches the expectations of useProfiles.ts and useData.js
export const adminAPI = {
  getStats: () => apiCall('/api/admin/stats', { method: 'GET' }),
  getLogs: (page = 1) => apiCall('/api/admin/logs', { method: 'GET', params: { page } }),
  getUsers: (page = 1) => apiCall('/api/admin/users', { method: 'GET', params: { page } }),
  updateStatus: (id: string, status: 'active' | 'suspended') =>
    apiCall(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteUser: (id: string) => apiCall(`/api/admin/users/${id}`, { method: 'DELETE' }),
  verifyLawyer: (id: string, action: 'verify' | 'reject' | 'revoke') =>
    apiCall(`/api/admin/lawyers/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),
};

// ── Compatibility Exports ─────────────────────────────────────────────────────
export const statsAPI = { getStats: adminAPI.getStats };
export const logsAPI = { getLogs: adminAPI.getLogs };
export const citizensAPI = {
  getAll: adminAPI.getUsers,
  getById: (id: string) => adminAPI.getUsers(1), // Fallback
  updateStatus: adminAPI.updateStatus,
  delete: adminAPI.deleteUser,
};
export const lawyersAPI = {
  getAll: (page = 1) =>
    adminAPI.getUsers(page).then((data: any) => ({
      ...data,
      users: data.users?.filter((u: any) => u.role === 'lawyer') ?? [],
    })),
  verify: (id: string) => adminAPI.verifyLawyer(id, 'verify'),
  reject: (id: string) => adminAPI.verifyLawyer(id, 'reject'),
  revoke: (id: string) => adminAPI.verifyLawyer(id, 'revoke'),
  delete: adminAPI.deleteUser,
};

export const casesAPI = {
  getAll: () => apiCall('/api/cases', { method: 'GET' }),
};

export const chatAPI = {
  sendMessage: (data: any) =>
    apiCall('/api/chat', { method: 'POST', body: JSON.stringify(data) }),
};

export { API_BASE_URL };
export default apiCall;
