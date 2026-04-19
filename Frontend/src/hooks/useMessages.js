import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChatContext } from '@/src/contexts/ChatContext';
import { messageService } from '@/src/services/messageService';

function buildOptimisticMessage({ conversationId, user, content, clientMessageId }) {
  const now = new Date().toISOString();

  return {
    id: clientMessageId,
    client_message_id: clientMessageId,
    conversation_id: conversationId,
    sender_id: user.id,
    content,
    is_read: false,
    created_at: now,
    sender: {
      id: user.id,
      name: user.name || user.full_name || 'You',
      full_name: user.name || user.full_name || 'You',
      role: user.role === 'user' ? 'citizen' : user.role,
      profile_photo_url: user.profile_photo_url || null,
    },
  };
}

export function useMessages(conversationId) {
  const { user } = useAuth();
  const {
    conversations,
    messagesByConversation,
    typingByConversation,
    onlineUsers,
    setConversations,
    joinConversation,
    emitTyping,
    appendConversationMessages,
    setConversationMessages,
    clearConversationMessages,
    replaceTemporaryMessage,
    removeTemporaryMessage,
    markConversationReadLocal,
  } = useChatContext();

  const [loading, setLoading] = useState(Boolean(conversationId));
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });

  const conversation = useMemo(
    () => conversations.find((item) => item.id === conversationId) || null,
    [conversations, conversationId]
  );

  const messages = useMemo(
    () => messagesByConversation[conversationId] || [],
    [conversationId, messagesByConversation]
  );

  const isTyping = Boolean(typingByConversation[conversationId]);
  const isOtherOnline = conversation?.other_participant?.id
    ? Boolean(onlineUsers[String(conversation.other_participant.id)])
    : false;

  const joinConversationWithTimeout = useCallback(async (targetConversationId) => {
    if (!targetConversationId) {
      return null;
    }

    const joinPromise = joinConversation(targetConversationId);
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ success: false, timeout: true }), 2500);
    });

    try {
      return await Promise.race([joinPromise, timeoutPromise]);
    } catch {
      return null;
    }
  }, [joinConversation]);

  const loadMessages = useCallback(async ({ page = 1, prepend = false } = {}) => {
    if (!conversationId) return null;

    const payload = await messageService.getMessages(conversationId, {
      page,
      limit: pagination.limit,
    });

    const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
    
    // State guard: prevent updating if messages are identical
    const currentMessages = messagesByConversation[conversationId] || [];
    const messagesAreIdentical = currentMessages.length === nextMessages.length &&
      currentMessages.every((msg, index) => msg.id === nextMessages[index]?.id);
    
    if (!messagesAreIdentical) {
      if (prepend) {
        setConversationMessages(conversationId, [...nextMessages, ...currentMessages]);
      } else {
        setConversationMessages(conversationId, nextMessages);
      }
    }

    if (payload?.conversation) {
      setConversations((prev) => {
        const exists = prev.some((item) => item.id === payload.conversation.id);
        const nextConversation = payload.conversation;

        if (!exists) {
          return [nextConversation, ...prev];
        }

        return prev.map((item) => (
          item.id === nextConversation.id ? nextConversation : item
        ));
      });
    }

    if (payload?.pagination) {
      setPagination(payload.pagination);
    }

    return payload;
  }, [conversationId, pagination.limit, setConversationMessages, messagesByConversation]);

  const refreshMessages = useCallback(async () => {
    if (!conversationId) return null;
    setRefreshing(true);
    try {
      return await loadMessages({ page: 1, append: false });
    } catch (err) {
      setError(err?.message || 'Failed to refresh messages');
      throw err;
    } finally {
      setRefreshing(false);
    }
  }, [conversationId, loadMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !pagination.hasMore) return null;
    const nextPage = pagination.page + 1;
    const payload = await loadMessages({ page: nextPage, prepend: true });
    if (payload?.pagination) {
      setPagination(payload.pagination);
    }
    return payload;
  }, [conversationId, loadMessages, pagination.hasMore, pagination.page]);

  const markAsRead = useCallback(async () => {
    if (!conversationId || !user?.id) return null;

    const payload = await messageService.markConversationRead(conversationId);
    markConversationReadLocal(conversationId, user.id);
    return payload;
  }, [conversationId, markConversationReadLocal, user?.id]);

  const sendMessage = useCallback(async (text) => {
    if (!conversationId || !user?.id) return null;

    const content = String(text || '').trim();
    if (!content) return null;

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic = buildOptimisticMessage({
      conversationId,
      user,
      content,
      clientMessageId,
    });

    appendConversationMessages(conversationId, optimistic);
    setSending(true);
    setError(null);

    try {
      const payload = await messageService.sendMessage(conversationId, content, clientMessageId);
      const saved = payload?.message || payload;
      if (saved) {
        replaceTemporaryMessage(conversationId, clientMessageId, saved);
      }
      return saved;
    } catch (err) {
      removeTemporaryMessage(conversationId, clientMessageId);
      setError(err?.message || 'Failed to send message');
      throw err;
    } finally {
      setSending(false);
    }
  }, [
    appendConversationMessages,
    conversationId,
    removeTemporaryMessage,
    replaceTemporaryMessage,
    user,
  ]);

  const sendTyping = useCallback((isTypingValue) => {
    emitTyping(conversationId, Boolean(isTypingValue));
  }, [conversationId, emitTyping]);

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      // Clear messages when no conversation is selected
      clearConversationMessages(conversationId);
      return undefined;
    }

    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      // Clear previous conversation messages to prevent cross-contamination
      clearConversationMessages(conversationId);
      try {
        void joinConversationWithTimeout(conversationId);
        if (!active) return;
        await loadMessages({ page: 1, append: false });
        if (!active) return;
        await markAsRead();
      } catch (err) {
        if (active) {
          setError(err?.message || 'Failed to load messages');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [conversationId]); // Only depend on conversationId to prevent infinite loops

  return {
    conversation,
    messages,
    loading,
    refreshing,
    sending,
    error,
    pagination,
    isTyping,
    isOtherOnline,
    loadMessages,
    refreshMessages,
    loadOlderMessages,
    sendMessage,
    sendTyping,
    markAsRead,
  };
}
