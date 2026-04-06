import { supabase } from '@/utils/supabase';

function buildUrl(functionName, query = {}) {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const qs = new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString();

  return `${base}/functions/v1/${functionName}${qs ? `?${qs}` : ''}`;
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    throw new Error('No Supabase session found. Please sign in first.');
  }

  return token;
}

async function callFunction(functionName, { method = 'GET', query, body, isFormData = false } = {}) {
  const token = await getAccessToken();
  const url = buildUrl(functionName, query);
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(apikey ? { apikey } : {}),
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
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error('Failed to load admin user');
    }

    if (!data?.id) {
      throw new Error('No admin account found');
    }

    return data;
  },

  createConversation: (type, targetUserId) =>
    callFunction('conversations-create', {
      method: 'POST',
      body: { type, target_user_id: targetUserId },
    }),

  listConversations: (type) =>
    callFunction('conversations-list', {
      method: 'GET',
      query: { type },
    }),

  listMessages: (conversationId, { limit = 30, before } = {}) =>
    callFunction('conversations-messages', {
      method: 'GET',
      query: {
        conversation_id: conversationId,
        limit,
        before,
      },
    }),

  sendMessage: ({ conversationId, content }) =>
    callFunction('send-message', {
      method: 'POST',
      body: {
        conversation_id: conversationId,
        content,
      },
    }),

  sendMessageWithAttachment: ({ conversationId, content, attachment }) => {
    const formData = new FormData();
    formData.append('conversation_id', conversationId);
    if (content) formData.append('content', content);
    formData.append('attachment', attachment);

    return callFunction('send-message', {
      method: 'POST',
      body: formData,
      isFormData: true,
    });
  },

  markConversationRead: (conversationId) =>
    callFunction('conversations-read', {
      method: 'POST',
      body: { conversation_id: conversationId },
    }),
};
