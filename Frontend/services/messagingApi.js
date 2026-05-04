import { api, BASE_URL, getToken } from '@/services/api';

export const messagingApi = {
  getFirstAdminUser: async () => {
    const data = await api.get('/api/users/admin');
    if (!data?.id) {
      throw new Error('No admin account found');
    }
    return data;
  },

  createConversation: (type, targetUserId) =>
    api.post('/api/conversations', {
      participantId: targetUserId,
    }),

  listConversations: (type) =>
    api.get('/api/conversations'),

  listMessages: (conversationId, { limit = 30, before } = {}) =>
    api.get(`/api/conversations/${conversationId}/messages?limit=${limit}`),

  sendMessage: ({ conversationId, content }) =>
    api.post(`/api/conversations/${conversationId}/messages`, {
      content,
    }),

  /**
   * Send a message with an optional file attachment.
   * Uses multipart/form-data so the file bytes reach the backend.
   */
  sendMessageWithAttachment: async ({ conversationId, content, attachment }) => {
    const token = await getToken();

    const formData = new FormData();
    if (content && content.trim()) {
      formData.append('content', content.trim());
    }
    if (attachment) {
      // React Native FormData expects { uri, name, type }
      formData.append('attachment', {
        uri: attachment.uri,
        name: attachment.name || 'attachment',
        type: attachment.type || 'application/octet-stream',
      });
    }

    const res = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || 'Upload failed');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  markConversationRead: (conversationId) =>
    api.patch(`/api/conversations/${conversationId}/read`, {}),
};
