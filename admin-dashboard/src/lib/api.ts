// API Client for LawyerUp Admin Dashboard
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

async function apiCall(endpoint: string, options: RequestOptions = {}) {
  const { params, ...fetchOptions } = options;
  
  // Build URL with query parameters
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    ).toString();
    if (queryString) url += `?${queryString}`;
  }

  // Set default headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include', // Include cookies if needed
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Call Failed: ${endpoint}`, error);
    throw error;
  }
}

// Lawyers API
export const lawyersAPI = {
  getPending: () => apiCall('/api/pending-lawyers', { method: 'GET' }),
  getApproved: () => apiCall('/api/approved-lawyers', { method: 'GET' }),
  getRejected: () => apiCall('/api/rejected-lawyers', { method: 'GET' }),
  getById: (id: string) => apiCall(`/api/lawyers/${id}`, { method: 'GET' }),
  create: (data: any) => apiCall('/api/lawyers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/api/lawyers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/api/lawyers/${id}`, { method: 'DELETE' }),
  approve: (id: string, data?: any) => apiCall(`/api/approve-lawyer/${id}`, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  reject: (id: string, data?: any) => apiCall(`/api/reject-lawyer/${id}`, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
};

// Citizens API
export const citizensAPI = {
  getAll: () => apiCall('/api/citizens', { method: 'GET' }),
  getById: (id: string) => apiCall(`/api/citizens/${id}`, { method: 'GET' }),
  create: (data: any) => apiCall('/api/citizens', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiCall(`/api/citizens/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall(`/api/citizens/${id}`, { method: 'DELETE' }),
};

// Auth API
export const authAPI = {
  signup: (data: any) => apiCall('/api/signup', { method: 'POST', body: JSON.stringify(data) }),
};

// Stats API
export const statsAPI = {
  getStats: () => apiCall('/api/stats', { method: 'GET' }),
};

// Chat API
export const chatAPI = {
  sendMessage: (data: any) => apiCall('/api/chat', { method: 'POST', body: JSON.stringify(data) }),
};

export default apiCall;
