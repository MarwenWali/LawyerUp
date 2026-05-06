import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocket } from '@/src/hooks/useSocket';
import { ConversationCard } from '@/src/components/ConversationCard';
import { messageService } from '@/src/services/messageService';
import { messagingApi } from '@/services/messagingApi';

function sortByLatest(conversations) {
  return [...conversations].sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
    const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

function isAdminConversation(conversation) {
  const participant = conversation?.other_participant || {};
  const role = String(participant.role || '').toLowerCase();
  return role === 'admin';
}

export default function LawyerInboxPage() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t } = useLanguage();
  const {
    conversations,
    refreshConversations,
    connectionStatus,
    onlineUsers,
    lastError,
  } = useSocket();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [startingAdminChat, setStartingAdminChat] = useState(false);

  const rows = useMemo(() => sortByLatest(conversations), [conversations]);
  const adminConversation = useMemo(
    () => rows.find((item) => isAdminConversation(item)) || null,
    [rows]
  );
  const totalUnread = useMemo(
    () => rows.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [rows]
  );

  const openConversation = useCallback((conversation) => {
    const participant = conversation.other_participant || conversation.citizen || conversation.lawyer || {};
    router.push({
      pathname: '/(messaging)/chat',
      params: {
        conversationId: conversation.id,
        title: participant.name || participant.full_name || 'Conversation',
      },
    });
  }, []);

  const loadConversations = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setError(null);
      await refreshConversations();
    } catch (err) {
      setError(err?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const startAdminConversation = useCallback(async () => {
    if (startingAdminChat) return;
    setStartingAdminChat(true);
    setError(null);

    try {
      if (adminConversation) {
        openConversation(adminConversation);
        return;
      }

      const adminUser = await messagingApi.getFirstAdminUser();
      const payload = await messageService.startConversation({ participantId: adminUser.id });
      const conversation = payload?.conversation || null;
      const conversationId = conversation?.id || payload?.conversationId || payload?.id;

      if (!conversationId) {
        throw new Error('Could not start admin conversation');
      }

      await refreshConversations();
      openConversation(
        conversation || {
          id: conversationId,
          other_participant: { name: 'Admin Team' },
        }
      );
    } catch (err) {
      setError(err?.message || 'Failed to start admin chat');
    } finally {
      setStartingAdminChat(false);
    }
  }, [adminConversation, openConversation, refreshConversations, startingAdminChat]);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: C.border, backgroundColor: C.headerBg }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.kicker, { color: C.mutedForeground }]}>{t.inbox || 'Inbox'}</Text>
            <Text style={[styles.title, { color: C.foreground }]}>Messages</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: connectionStatus === 'connected' ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)' }]}>
            <View style={[styles.statusDot, { backgroundColor: connectionStatus === 'connected' ? C.success : C.warning }]} />
            <Text style={[styles.statusText, { color: connectionStatus === 'connected' ? C.success : C.warning }]}>
              {connectionStatus === 'connected' ? 'Live' : 'Connecting'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryText, { color: C.mutedForeground }]}>
            Lawyer inbox
          </Text>
          {totalUnread > 0 && (
            <View style={[styles.unreadPill, { backgroundColor: C.tint }]}>
              <Text style={[styles.unreadPillText, { color: C.primaryForeground }]}>
                {totalUnread} unread
              </Text>
            </View>
          )}
        </View>

        {!adminConversation && (
          <Pressable
            style={({ pressed }) => [
              styles.adminBtn,
              { backgroundColor: C.tint },
              (pressed || startingAdminChat) && { opacity: 0.84 },
            ]}
            onPress={startAdminConversation}
            disabled={startingAdminChat}
          >
            {startingAdminChat ? (
              <ActivityIndicator size="small" color={C.primaryForeground} />
            ) : (
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.primaryForeground} />
            )}
            <Text style={[styles.adminBtnText, { color: C.primaryForeground }]}>Start Admin Chat</Text>
          </Pressable>
        )}

        {error && (
          <Text style={[styles.errorText, { color: C.destructive }]} numberOfLines={2}>
            {error}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.tint} size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={rows.length ? styles.listContent : styles.emptyContent}
          renderItem={({ item }) => (
            <ConversationCard
              conversation={item}
              theme={C}
              online={Boolean(onlineUsers[String(item.other_participant?.id || '')])}
              onPress={() => openConversation(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadConversations({ isRefresh: true })}
              tintColor={C.tint}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={42} color={C.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: C.foreground }]}>No conversations yet</Text>
              <Text style={[styles.emptySubtitle, { color: C.mutedForeground }]}>
                Start messaging a client from Cases, or open admin support chat.
              </Text>
            </View>
          }
          ListFooterComponent={lastError ? (
            <Text style={[styles.footerError, { color: C.destructive }]}>{lastError}</Text>
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  summaryRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  unreadPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unreadPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  adminBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  adminBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  listContent: {
    padding: 20,
    gap: 12,
    paddingBottom: 100,
  },
  emptyContent: {
    flexGrow: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  footerError: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
