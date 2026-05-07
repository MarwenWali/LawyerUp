import { api, BASE_URL, getToken } from '@/services/api';

export const messagingApi = {
  getFirstAdminUser: async () => {
    const data = await api.get('/api/users/admin');
    if (!data?.id) {
      throw new Error('No admin account found');
    }
    return data;
  },

  createConversation: (typeOrTargetUserId, maybeTargetUserId) => {
    const targetUserId = maybeTargetUserId || typeOrTargetUserId;
    return api.post('/api/conversations', {
      participantId: targetUserId,
    });
  },

  listConversations: () =>
    api.get('/api/conversations'),

  listMessages: (conversationId, { page = 1, limit = 30, before } = {}) => {
    const qs = before
      ? `limit=${limit}&before=${encodeURIComponent(before)}`
      : `page=${page}&limit=${limit}`;
    return api.get(`/api/conversations/${conversationId}/messages?${qs}`);
  },

  sendMessage: ({ conversationId, content, clientMessageId = null }) =>
    api.post(`/api/conversations/${conversationId}/messages`, {
      content,
      clientMessageId,
    }),

  sendMessageWithAttachment: async ({ conversationId, content, attachment }) => {
    const token = await getToken();
    const formData = new FormData();

    if (content && content.trim()) {
      formData.append('content', content.trim());
    }

    if (attachment) {
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
