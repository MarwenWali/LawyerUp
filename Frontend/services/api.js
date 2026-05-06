import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Derive the backend host from the Expo dev server URI so it works on
// physical devices, Android emulators, and iOS simulators automatically.
const getBaseUrl = () => {

  // Tunnel / deployed URL set via EXPO_PUBLIC_API_URL (works on any network)
  const tunnelUrl = process.env.EXPO_PUBLIC_API_URL;
  if (tunnelUrl) return tunnelUrl;

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip port
      return `http://${host}:3000`;
    }
    // Android emulator default
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
};

export const BASE_URL = getBaseUrl();

// ── Token helpers ────────────────────────────────────────────────────────────
export const getToken = () => AsyncStorage.getItem('lawyerup_token');
export const setToken = (token) => AsyncStorage.setItem('lawyerup_token', token);
export const removeToken = () => AsyncStorage.removeItem('lawyerup_token');

// ── Core request helper ──────────────────────────────────────────────────────
async function request(method, path, body = null, isMultipart = false) {
  const token = await getToken();
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isMultipart) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body) options.body = isMultipart ? body : JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, options);
  } catch (networkError) {
    const err = new Error(`Network error: Unable to reach ${BASE_URL}${path}. ${networkError.message}`);
    err.isNetworkError = true;
    throw err;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || 'Request failed');
    err.status = res.status;
    throw err;
  }

  return data;
}

// ── Convenience methods ──────────────────────────────────────────────────────
export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData, true),
};

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  verify: () => api.get('/api/auth/verify'),
};

// ── Lawyers ──────────────────────────────────────────────────────────────────
export const lawyersApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/lawyers${qs ? '?' + qs : ''}`);
  },
  getById: (id) => api.get(`/api/lawyers/${id}`),
  updateProfile: (data) => api.put('/api/lawyers/profile', data),
  setAvailability: (isAvailable) => api.patch('/api/lawyers/availability', { isAvailable }),
  createAppointment: (data) => api.post('/api/lawyers/appointments', data),
};

// ── Cases ────────────────────────────────────────────────────────────────────
export const casesApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/cases${qs ? '?' + qs : ''}`);
  },
  getById: (id) => api.get(`/api/cases/${id}`),
  create: (data) => api.post('/api/cases', data),
  updateStatus: (id, status) => api.patch(`/api/cases/${id}/status`, { status }),
};

// ── Contact Requests ──────────────────────────────────────────────────────────
export const contactsApi = {
  getAll: () => api.get('/api/contacts'),
  create: (lawyerId, message) => api.post('/api/contacts', { lawyerId, message }),
  respond: (id, status) => api.patch(`/api/contacts/${id}`, { status }),
};

// ── Reviews ──────────────────────────────────────────────────────────────────
export const reviewsApi = {
  getForLawyer: (lawyerId) => api.get(`/api/reviews/lawyer/${lawyerId}`),
  getMyReview: (lawyerId) => api.get(`/api/reviews/mine/${lawyerId}`),
  create: (data) => api.post('/api/reviews', data),
  delete: (id) => api.delete(`/api/reviews/${id}`),
};

// ── User Profile ─────────────────────────────────────────────────────────────
export const userApi = {
  getMe: () => api.get('/api/users/me'),
  updateMe: (data) => api.put('/api/users/me', data),
  changePassword: (data) => api.patch('/api/users/me/password', data),
  uploadPhoto: (fd) => request('POST', '/api/users/me/photo', fd, true),
  getVault: () => api.get('/api/users/vault'),
  uploadVaultFile: (fileObj) => {
    const formData = new FormData();
    formData.append('attachment', {
      uri: fileObj.uri,
      name: fileObj.name || 'document',
      type: fileObj.type || 'application/octet-stream',
    });
    return api.upload('/api/users/vault', formData);
  },
  getAppointments: () => api.get('/api/users/appointments'),
  createAppointment: (data) => api.post('/api/users/appointments', data),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll: () => api.get('/api/notifications'),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`, {}),
  markAllRead: () => api.patch('/api/notifications/read-all', {}),
  delete: (id) => api.delete(`/api/notifications/${id}`),
};

// ── AI Chat ───────────────────────────────────────────────────────────────────
export const chatApi = {
  getSessions: () => api.get('/api/chat/sessions'),
  createSession: (title) => api.post('/api/chat/sessions', { title }),
  deleteSession: (id) => api.delete(`/api/chat/sessions/${id}`),
  updateTitle: (id, title) => api.patch(`/api/chat/sessions/${id}/title`, { title }),
  getMessages: (id) => api.get(`/api/chat/sessions/${id}/messages`),
  saveMessages: (id, messages) => api.post(`/api/chat/sessions/${id}/messages`, { messages }),
  askAssistant: (id, content, attachment = null) => {
    if (attachment) {
      const formData = new FormData();
      if (content) formData.append('content', content);
      formData.append('attachment', {
        uri: attachment.uri,
        name: attachment.name || 'attachment',
        type: attachment.type || 'application/octet-stream',
      });
      return api.upload(`/api/chat/sessions/${id}/reply`, formData);
    }
    return api.post(`/api/chat/sessions/${id}/reply`, { content });
  },
};

// Admin functionality has been moved to the web dashboard (admin-dashboard/).
// Mobile apps no longer contain any admin API calls.
