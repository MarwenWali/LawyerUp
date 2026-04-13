import { API_BASE_URL } from './api';
import { getToken } from './storage.js';

async function request(endpoint, options = {}) {
  const token = getToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || `Messaging Error: ${res.status}`);
  }

  return res.json();
}

export const messagingAPI = {
  // listConversations returns { conversations: [...] }
  listConversations: (type = 'admin_lawyer') =>
    request('/api/conversations'),

  // createConversation returns { conversation: { id, ... } }
  createConversation: (targetUserId) =>
    request('/api/conversations', {
      method: 'POST',
      body: { participantId: targetUserId },
    }),

  // listMessages returns { messages: [...] }
  listMessages: (conversationId, limit = 50) =>
    request(`/api/conversations/${conversationId}/messages?limit=${limit}`),

  // sendMessage returns { message: { ... } }
  sendMessage: (conversationId, content) =>
    request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { content },
    }),

  markRead: (conversationId) =>
    request(`/api/conversations/${conversationId}/read`, {
      method: 'PATCH',
    }),
};
