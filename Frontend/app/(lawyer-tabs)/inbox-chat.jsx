import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { supabase } from '@/utils/supabase';
import { messagingApi } from '@/services/messagingApi';

function formatTime(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalizeMessages(input) {
  const raw = Array.isArray(input) ? input : [];
  return [...raw]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((msg) => ({
      ...msg,
      id: msg.id,
    }));
}

function Receipt({ readByAll, color }) {
  return (
    <Ionicons
      name={readByAll ? 'checkmark-done' : 'checkmark'}
      size={14}
      color={readByAll ? color : '#9ca3af'}
      style={{ marginLeft: 4 }}
    />
  );
}

export default function LawyerInboxChatPage() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const typingTimerRef = useRef(null);
  const typingChannelRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const loadVersionRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const conversationId = String(params.conversationId || '');
  const title = String(params.title || 'Conversation');

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const canSend = useMemo(() => Boolean(input.trim()) && !sending, [input, sending]);

  const loadMessages = useCallback(async ({ isRefresh = false } = {}) => {
    if (!conversationId) return;
    const loadVersion = ++loadVersionRef.current;

    if (isRefresh) setRefreshing(true);
    else if (!hasLoadedRef.current) setLoading(true);

    try {
      const payload = await messagingApi.listMessages(conversationId, { limit: 50 });
      if (loadVersion !== loadVersionRef.current) return;

      const normalized = normalizeMessages(payload?.messages);
      setMessages(normalized);
      hasLoadedRef.current = true;

      const hasUnreadIncoming = normalized.some(
        (item) => item.sender_id !== user?.id && !item.read_by_me
      );

      if (hasUnreadIncoming && user?.id) {
        try {
          await messagingApi.markConversationRead(conversationId);
          if (loadVersion !== loadVersionRef.current) return;
          setMessages((prev) =>
            prev.map((item) => (
              item.sender_id === user.id ? item : { ...item, read_by_me: true }
            ))
          );
        } catch (markError) {
          console.warn('Mark read error:', markError);
        }
      }
    } catch (error) {
      console.error('Chat load error:', error);
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    hasLoadedRef.current = false;
    setMessages([]);
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        loadMessages().catch(() => { });
      }, 140);
    };

    const dataChannel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          scheduleRefresh();
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel('typing-indicators')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const senderId = String(payload?.sender_id || '');
        const incomingConversationId = String(payload?.conversation_id || '');
        const isTyping = Boolean(payload?.is_typing);

        if (incomingConversationId !== conversationId || senderId === user.id) return;
        setOtherTyping(isTyping);
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    const intervalId = setInterval(() => {
      loadMessages().catch(() => { });
    }, 7000);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      typingChannelRef.current = null;
      supabase.removeChannel(dataChannel);
      supabase.removeChannel(typingChannel);
      clearInterval(intervalId);
    };
  }, [conversationId, loadMessages, user?.id]);

  const sendTyping = useCallback(async (isTyping) => {
    if (!conversationId || !user?.id) return;
    const channel = typingChannelRef.current;
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        conversation_id: conversationId,
        sender_id: user.id,
        is_typing: isTyping,
      },
    });
  }, [conversationId, user?.id]);

  async function handleSend() {
    if (!canSend || !conversationId) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    try {
      await sendTyping(false);
      await messagingApi.sendMessage({ conversationId, content });
      await loadMessages();
    } catch (error) {
      console.error('Send error:', error);
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  function onChangeInput(value) {
    setInput(value);

    if (!conversationId || !user?.id) return;

    sendTyping(Boolean(value.trim())).catch(() => { });

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      sendTyping(false).catch(() => { });
    }, 1200);
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 2, borderBottomColor: C.border, backgroundColor: C.headerBg }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.tint} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: C.foreground }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>{otherTyping ? 'Typing...' : 'Secure in-app chat'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.messages}
            onRefresh={() => loadMessages({ isRefresh: true })}
            refreshing={refreshing}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[styles.msgRow, mine ? styles.mineRow : styles.theirRow]}>
                  <View
                    style={[
                      styles.msgBubble,
                      mine ? { backgroundColor: C.tint } : { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.msgText, { color: mine ? C.primaryForeground : C.foreground }]}>{item.content}</Text>
                    <View style={styles.metaRow}>
                      <Text style={[styles.time, { color: mine ? C.primaryForeground : C.mutedForeground }]}>{formatTime(item.created_at)}</Text>
                      {mine && <Receipt readByAll={Boolean(item.read_by_all)} color={C.primaryForeground} />}
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={C.mutedForeground} />
                <Text style={[styles.emptyText, { color: C.textSecondary }]}>No messages yet</Text>
              </View>
            }
          />
        )}

        <View style={[styles.inputBar, { borderTopColor: C.border, backgroundColor: C.headerBg, paddingBottom: insets.bottom || 10 }]}>
          <TextInput
            style={[styles.input, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
            placeholder="Type a message"
            placeholderTextColor={C.mutedForeground}
            value={input}
            onChangeText={onChangeInput}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[styles.sendBtn, { backgroundColor: C.tint }, !canSend && { opacity: 0.45 }]}
          >
            {sending ? (
              <ActivityIndicator color={C.primaryForeground} />
            ) : (
              <Ionicons name="send" size={18} color={C.primaryForeground} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  messages: {
    padding: 10,
    gap: 8,
  },
  msgRow: {
    flexDirection: 'row',
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '84%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  msgText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  time: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  inputBar: {
    borderTopWidth: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 30,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
