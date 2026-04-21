import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_API_PORT = String(process.env.EXPO_PUBLIC_API_PORT || '3001');

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

// Derive the backend host from the Expo dev server URI so it works on
// physical devices, Android emulators, and iOS simulators automatically.
const getBaseUrls = () => {
  // Tunnel / deployed URL set via EXPO_PUBLIC_API_URL (works on any network)
  const tunnelUrl = process.env.EXPO_PUBLIC_API_URL;
  if (tunnelUrl) return [tunnelUrl.replace(/\/$/, '')];

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const ports = uniq([DEFAULT_API_PORT, '3001', '3000']);

    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip port
      const hostCandidates = ports.map((port) => `http://${host}:${port}`);
      const emulatorCandidates = ports.map((port) => `http://10.0.2.2:${port}`);
      return uniq([...hostCandidates, ...emulatorCandidates]);
    }
    // Android emulator fallback
    return ports.map((port) => `http://10.0.2.2:${port}`);
  }
  return [`http://localhost:${DEFAULT_API_PORT}`];
};

const BASE_URL_CANDIDATES = getBaseUrls();
export let BASE_URL = BASE_URL_CANDIDATES[0];

function isRetryableNetworkError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;

  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('socket') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

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

  const candidateUrls = uniq([BASE_URL, ...BASE_URL_CANDIDATES]);
  let lastNetworkError = null;

  for (let index = 0; index < candidateUrls.length; index += 1) {
    const baseUrl = candidateUrls[index];
    let res;

    try {
      res = await fetchWithTimeout(`${baseUrl}${path}`, options);
    } catch (error) {
      if (isRetryableNetworkError(error) && index < candidateUrls.length - 1) {
        lastNetworkError = error;
        continue;
      }

      const networkError = new Error(
        error?.name === 'AbortError'
          ? 'Request timed out. Please check backend server/network and try again.'
          : 'Network request failed. Please check backend server/network and try again.'
      );
      networkError.status = 0;
      throw networkError;
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

    // Pin to the first working backend URL for subsequent requests.
    BASE_URL = baseUrl;
    return data;
  }

  const fallbackError = new Error(
    lastNetworkError?.name === 'AbortError'
      ? 'Request timed out. Please check backend server/network and try again.'
      : 'Network request failed. Please check backend server/network and try again.'
  );
  fallbackError.status = 0;
  throw fallbackError;
}

// ── Convenience methods ──────────────────────────────────────────────────────
export const api = {
  get:    (path)              => request('GET',    path),
  post:   (path, body)        => request('POST',   path, body),
  put:    (path, body)        => request('PUT',    path, body),
  patch:  (path, body)        => request('PATCH',  path, body),
  delete: (path)              => request('DELETE', path),
  upload: (path, formData)    => request('POST',   path, formData, true),
};

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email, password)                  => api.post('/api/auth/login', { email, password }),
  register: (data)                             => api.post('/api/auth/register', data),
  verify:   ()                                 => api.get('/api/auth/verify'),
};

// ── Lawyers ──────────────────────────────────────────────────────────────────
export const lawyersApi = {
  getAll:          (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/lawyers${qs ? '?' + qs : ''}`);
  },
  getById:         (id)           => api.get(`/api/lawyers/${id}`),
  updateProfile:   (data)         => api.put('/api/lawyers/profile', data),
  setAvailability: (isAvailable)  => api.patch('/api/lawyers/availability', { isAvailable }),
};

// ── Cases ────────────────────────────────────────────────────────────────────
export const casesApi = {
  getAll:       (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/cases${qs ? '?' + qs : ''}`);
  },
  getById:      (id)          => api.get(`/api/cases/${id}`),
  create:       (data)        => api.post('/api/cases', data),
  updateStatus: (id, status)  => api.patch(`/api/cases/${id}/status`, { status }),
};

// ── Contact Requests ──────────────────────────────────────────────────────────
export const contactsApi = {
  getAll:   ()                     => api.get('/api/contacts'),
  create:   (lawyerId, message)    => api.post('/api/contacts', { lawyerId, message }),
  respond:  (id, status)           => api.patch(`/api/contacts/${id}`, { status }),
};

// ── Reviews ──────────────────────────────────────────────────────────────────
export const reviewsApi = {
  getForLawyer:      (lawyerId)  => api.get(`/api/reviews/lawyer/${lawyerId}`),
  getMyReview:       (lawyerId)  => api.get(`/api/reviews/mine/${lawyerId}`),
  create:            (data)      => api.post('/api/reviews', data),
  delete:            (id)        => api.delete(`/api/reviews/${id}`),
};

// ── User Profile ─────────────────────────────────────────────────────────────
export const userApi = {
  getMe:          ()       => api.get('/api/users/me'),
  updateMe:       (data)   => api.put('/api/users/me', data),
  changePassword: (data)   => api.patch('/api/users/me/password', data),
  uploadPhoto:    (fd)     => request('POST', '/api/users/me/photo', fd, true),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll:     ()   => api.get('/api/notifications'),
  markRead:   (id) => api.patch(`/api/notifications/${id}/read`, {}),
  markAllRead: ()  => api.patch('/api/notifications/read-all', {}),
  delete:     (id) => api.delete(`/api/notifications/${id}`),
};

// ── AI Chat ───────────────────────────────────────────────────────────────────
export const chatApi = {
  getSessions:   ()               => api.get('/api/chat/sessions'),
  createSession: (title)          => api.post('/api/chat/sessions', { title }),
  deleteSession: (id)             => api.delete(`/api/chat/sessions/${id}`),
  updateTitle:   (id, title)      => api.patch(`/api/chat/sessions/${id}/title`, { title }),
  getMessages:   (id)             => api.get(`/api/chat/sessions/${id}/messages`),
  saveMessages:  (id, messages)   => api.post(`/api/chat/sessions/${id}/messages`, { messages }),
  askAssistant:  (id, content)    => api.post(`/api/chat/sessions/${id}/reply`, { content }),
};

// Admin functionality has been moved to the web dashboard (admin-dashboard/).
// Mobile apps no longer contain any admin API calls.
