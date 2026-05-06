import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/src/hooks/useMessages';
import { useSocket } from '@/src/hooks/useSocket';
import { MessageBubble } from '@/src/components/MessageBubble';
import { TypingIndicator } from '@/src/components/TypingIndicator';

function formatDateLabel(value) {
  const date = new Date(value);
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function buildGroupedItems(messages) {
  const items = [];
  let currentLabel = '';

  for (const message of messages) {
    const label = formatDateLabel(message.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      items.push({
        type: 'date',
        id: `date-${label}-${message.id}`,
        label,
      });
    }

    items.push({
      type: 'message',
      id: message.id || message.client_message_id,
      message,
    });
  }

  return items;
}

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const conversationId = String(params.conversationId || params.id || '');
  const titleParam = String(params.title || 'Conversation');
  const listRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const [draft, setDraft] = useState('');

  const {
    conversation,
    messages,
    loading,
    refreshing,
    sending,
    error,
    isTyping,
    isOtherOnline,
    refreshMessages,
    sendMessage,
    sendTyping,
  } = useMessages(conversationId);

  const { connectionStatus } = useSocket();

  const groupedItems = useMemo(() => buildGroupedItems(messages), [messages]);

  const participant = conversation?.other_participant || conversation?.citizen || conversation?.lawyer || {};
  const title = participant.name || titleParam;
  const subtitle = participant.specialization
    ? participant.specialization
    : isOtherOnline
      ? 'Online now'
      : 'Secure legal messaging';

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [groupedItems.length, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }
    };
  }, []);

  const handleChangeText = useCallback((value) => {
    setDraft(value);
    sendTyping(Boolean(value.trim()));

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      sendTyping(false);
    }, 1100);
  }, [sendTyping]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;

    setDraft('');
    sendTyping(false);

    try {
      await sendMessage(content);
      scrollToBottom(true);
    } catch {
      setDraft(content);
    }
  }, [draft, scrollToBottom, sendMessage, sendTyping, sending]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateWrap}>
          <View style={[styles.datePill, { backgroundColor: C.muted }]}>
            <Text style={[styles.dateText, { color: C.mutedForeground }]}>{item.label}</Text>
          </View>
        </View>
      );
    }

    return (
      <MessageBubble
        message={item.message}
        isOwn={item.message.sender_id === user?.id}
        theme={C}
      />
    );
  }, [C, user?.id]);

  if (!conversationId) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={[styles.errorTitle, { color: C.foreground }]}>Conversation not found</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: C.tint }]} onPress={() => router.back()}>
          <Text style={[styles.retryText, { color: C.primaryForeground }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.headerBg, borderBottomColor: C.border, paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: C.card }]}>
          <Ionicons name="arrow-back" size={22} color={C.foreground} />
        </Pressable>
        <View style={styles.headerBody}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: C.foreground }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={[styles.liveDot, { backgroundColor: isOtherOnline ? C.success : C.mutedForeground }]} />
          </View>
          <Text style={[styles.subtitle, { color: C.mutedForeground }]} numberOfLines={1}>
            {isTyping ? 'Typing...' : subtitle}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: connectionStatus === 'connected' ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)' }]}>
          {loading ? (
            <ActivityIndicator size="small" color={C.tint} />
          ) : (
            <Text style={[styles.statusText, { color: connectionStatus === 'connected' ? C.success : C.warning }]}>
              {connectionStatus === 'connected' ? 'Live' : 'Syncing'}
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        {error ? (
          <View style={styles.center}>
            <View style={[styles.errorIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Ionicons name="alert-circle-outline" size={30} color={C.destructive} />
            </View>
            <Text style={[styles.errorTitle, { color: C.foreground }]}>Unable to load chat</Text>
            <Text style={[styles.errorText, { color: C.mutedForeground }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: C.tint }]} onPress={refreshMessages}>
              <Text style={[styles.retryText, { color: C.primaryForeground }]}>Retry</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.tint} />
            <Text style={[styles.loadingText, { color: C.mutedForeground }]}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={groupedItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesContent}
            refreshing={refreshing}
            onRefresh={() => refreshMessages().catch(() => {})}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={isTyping ? <TypingIndicator theme={C} /> : <View style={{ height: 6 }} />}
            onContentSizeChange={() => scrollToBottom(false)}
          />
        )}

        <View style={[styles.inputBar, { backgroundColor: C.headerBg, borderTopColor: C.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={[styles.inputWrap, { backgroundColor: C.background, borderColor: C.border }]}>
            <TextInput
              value={draft}
              onChangeText={handleChangeText}
              placeholder="Write a message"
              placeholderTextColor={C.mutedForeground}
              style={[styles.input, { color: C.foreground }]}
              multiline
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: C.tint },
              (!draft.trim() || sending) && { opacity: 0.45 },
              pressed && draft.trim() && !sending && { opacity: 0.9 },
            ]}
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
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  keyboardWrap: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  dateWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  datePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  inputBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 46,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    maxHeight: 120,
    minHeight: 28,
    paddingVertical: 2,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
