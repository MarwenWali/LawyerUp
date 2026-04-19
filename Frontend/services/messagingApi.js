import { supabase } from '@/utils/supabase';
import { clearSupabaseSessionCache } from '@/utils/supabaseSession';
import { api } from '@/services/api';

function getSupabaseRuntimeConfig() {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (!base || !apikey) {
    throw new Error(
      'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in Frontend/.env and restart Expo.'
    );
  }

  return { base, apikey };
}

function buildUrl(functionName, query = {}) {
  const { base } = getSupabaseRuntimeConfig();
  const qs = new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString();

  return `${base}/functions/v1/${functionName}${qs ? `?${qs}` : ''}`;
}

async function getAccessToken() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const token = data.session?.access_token;
    if (!token) {
      throw new Error('No Supabase session found. Please sign in again to use inbox chat.');
    }

    return token;
  } catch (error) {
    const message = String(error?.message || '');
    if (message.toLowerCase().includes('invalid refresh token')) {
      await clearSupabaseSessionCache();
    }
    if (message.toLowerCase().includes('missing') || message.toLowerCase().includes('session')) {
      await clearSupabaseSessionCache();
    }
    throw new Error('No Supabase session found. Please sign in again to use inbox chat.');
  }
}

async function callFunction(functionName, { method = 'GET', query, body, isFormData = false } = {}) {
  const { apikey } = getSupabaseRuntimeConfig();
  const token = await getAccessToken();
  const url = buildUrl(functionName, query);

  const headers = {
    Authorization: `Bearer ${token}`,
    apikey,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body
      ? (isFormData ? body : JSON.stringify(body))
      : undefined,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Messaging request failed');
  }

  return payload;
}

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

  sendMessageWithAttachment: ({ conversationId, content, attachment }) => {
    const formData = new FormData();
    if (content) formData.append('content', content);
    formData.append('attachment', attachment);

    return api.post(`/api/conversations/${conversationId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  markConversationRead: (conversationId) =>
    api.patch(`/api/conversations/${conversationId}/read`, {}),
};
