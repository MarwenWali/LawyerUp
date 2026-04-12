import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useSocket } from '@/src/hooks/useSocket';
import { ConversationCard } from '@/src/components/ConversationCard';

function SkeletonCard({ theme }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.skeletonAvatar, { backgroundColor: theme.muted }]} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { backgroundColor: theme.muted, width: '42%' }]} />
        <View style={[styles.skeletonLine, { backgroundColor: theme.muted, width: '74%' }]} />
      </View>
    </View>
  );
}

export function ConversationsListScreen() {
  const C = useTheme();
  const { user } = useAuth();
  const {
    conversations,
    refreshConversations,
    connectionStatus,
    onlineUsers,
    lastError,
  } = useSocket();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(conversations.length === 0);
  const [error, setError] = useState(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshConversations();
    } catch (err) {
      setError(err?.message || 'Failed to refresh conversations');
    } finally {
      setRefreshing(false);
    }
  }, [refreshConversations]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        await refreshConversations();
      } catch (err) {
        if (active) {
          setError(err?.message || 'Failed to load conversations');
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
  }, [refreshConversations]);

  const sortedConversations = useMemo(() => conversations, [conversations]);
  const totalUnread = useMemo(
    () => sortedConversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [sortedConversations]
  );

  const openConversation = useCallback((conversation) => {
    const participant = conversation.other_participant || conversation.citizen || conversation.lawyer || {};
    router.push({
      pathname: '/(messaging)/chat',
      params: {
        conversationId: conversation.id,
        title: participant.name || 'Conversation',
      },
    });
  }, []);

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconWrap, { backgroundColor: C.accentLight }]}>
        <Ionicons name="chatbubbles-outline" size={28} color={C.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: C.foreground }]}>No conversations yet</Text>
      <Text style={[styles.emptySubtitle, { color: C.mutedForeground }]}>
        {user?.role === 'lawyer'
          ? 'Citizen chats will appear here once a client starts messaging you.'
          : 'Start a chat from a lawyer profile to begin secure messaging.'}
      </Text>
      {user?.role === 'lawyer' ? (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: C.tint }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.primaryBtnText, { color: C.primaryForeground }]}>Go back</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: C.tint }]}
          onPress={() => router.push('/(user-tabs)/lawyers')}
        >
          <Text style={[styles.primaryBtnText, { color: C.primaryForeground }]}>Browse lawyers</Text>
        </Pressable>
      )}
    </View>
  );

  const renderError = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
        <Ionicons name="alert-circle-outline" size={28} color={C.destructive} />
      </View>
      <Text style={[styles.emptyTitle, { color: C.foreground }]}>Could not load messages</Text>
      <Text style={[styles.emptySubtitle, { color: C.mutedForeground }]}>
        {error || lastError || 'Please try again.'}
      </Text>
      <Pressable
        style={[styles.primaryBtn, { backgroundColor: C.tint }]}
        onPress={onRefresh}
      >
        <Text style={[styles.primaryBtnText, { color: C.primaryForeground }]}>Retry</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.headerBg, borderBottomColor: C.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.kicker, { color: C.mutedForeground }]}>Secure chat</Text>
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
            {user?.role === 'lawyer' ? 'Lawyer inbox' : 'Citizen inbox'}
          </Text>
          {totalUnread > 0 && (
            <View style={[styles.unreadPill, { backgroundColor: C.tint }]}>
              <Text style={[styles.unreadPillText, { color: C.primaryForeground }]}>
                {totalUnread} unread
              </Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.listWrap}>
          {[0, 1, 2, 3, 4].map((index) => (
            <SkeletonCard key={index} theme={C} />
          ))}
        </View>
      ) : error || (lastError && sortedConversations.length === 0) ? (
        renderError()
      ) : (
        <FlatList
          data={sortedConversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={sortedConversations.length ? styles.listContent : styles.listWrap}
          renderItem={({ item }) => (
            <ConversationCard
              conversation={item}
              theme={C}
              online={Boolean(onlineUsers[String(item.other_participant?.id || '')])}
              onPress={() => openConversation(item)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />
          }
          ListEmptyComponent={renderEmpty}
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
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  listContent: {
    padding: 20,
    gap: 12,
    paddingBottom: 100,
  },
  listWrap: {
    flexGrow: 1,
    padding: 20,
    gap: 12,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 999,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 6,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
