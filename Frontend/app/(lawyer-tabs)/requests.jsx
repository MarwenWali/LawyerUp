import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList,
  Platform, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';
import { contactsApi } from '@/services/api';

function formatTimeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}${t.mAgo}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${t.hAgo}`;
  return `${Math.floor(hours / 24)}${t.dAgo}`;
}

const STATUS_CONFIG = {
  pending:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  icon: 'time-outline'          },
  accepted: { color: '#16A34A', bg: 'rgba(22,163,74,0.12)',   icon: 'checkmark-circle-outline' },
  rejected: { color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   icon: 'close-circle-outline'   },
};

function RequestCard({ item, onAccept, onReject, index, C, t }) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const initials = (item.requester_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const isPending = item.status === 'pending';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()} style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: C.accentLight }]}>
          <Text style={[styles.avatarText, { color: C.accent }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.requesterName, { color: C.foreground }]} numberOfLines={1}>
            {item.requester_name || 'Unknown User'}
          </Text>
          {item.requester_email ? (
            <Text style={[styles.requesterEmail, { color: C.textSecondary }]} numberOfLines={1}>
              {item.requester_email}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{t[item.status] || item.status}</Text>
        </View>
      </View>

      {/* Phone */}
      {item.requester_phone ? (
        <View style={styles.phoneRow}>
          <Ionicons name="call-outline" size={13} color={C.textSecondary} />
          <Text style={[styles.phoneText, { color: C.textSecondary }]}>{item.requester_phone}</Text>
        </View>
      ) : null}

      {/* Message */}
      <View style={[styles.messageBox, { backgroundColor: C.muted }]}>
        <Text style={[styles.messageText, { color: C.foreground }]}>{item.message}</Text>
      </View>

      {/* Timestamp */}
      <Text style={[styles.timeAgo, { color: C.mutedForeground }]}>{formatTimeAgo(item.created_at, t)}</Text>

      {/* Action buttons (only for pending) */}
      {isPending && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.rejectBtn, { borderColor: C.destructive }, pressed && { opacity: 0.75 }]}
            onPress={() => onReject(item.id)}
          >
            <Feather name="x" size={15} color={C.destructive} />
            <Text style={[styles.actionBtnText, { color: C.destructive }]}>{t.reject}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.acceptBtn, { backgroundColor: C.tint }, pressed && { opacity: 0.85 }]}
            onPress={() => onAccept(item.id)}
          >
            <Feather name="check" size={15} color={C.primaryForeground} />
            <Text style={[styles.actionBtnText, { color: C.primaryForeground }]}>{t.accept}</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

export default function RequestsPage() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t } = useLanguage();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'accepted' | 'rejected'
  const [search, setSearch] = useState('');

  const fetchRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const data = await contactsApi.getAll();
      setRequests(data.requests || []);
    } catch {
      Alert.alert('Error', 'Failed to load contact requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleAccept(id) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await contactsApi.respond(id, 'accepted');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' } : r));
    } catch {
      Alert.alert('Error', 'Failed to accept request');
    }
  }

  async function handleReject(id) {
    Alert.alert(
      t.rejectRequest,
      t.rejectRequestConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.reject, style: 'destructive', onPress: async () => {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await contactsApi.respond(id, 'rejected');
              setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
            } catch {
              Alert.alert('Error', 'Failed to reject request');
            }
          }
        },
      ]
    );
  }

  const FILTERS = [
    { key: 'all',      label: t.allRequests || 'All' },
    { key: 'pending',  label: t.pendingRequests || 'Pending' },
    { key: 'accepted', label: t.accepted || 'Accepted' },
    { key: 'rejected', label: t.rejected || 'Rejected' },
  ];

  const filtered = useMemo(() => {
    let list = requests;
    if (filter !== 'all') list = list.filter(r => r.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.requester_name?.toLowerCase().includes(q) ||
        r.requester_email?.toLowerCase().includes(q) ||
        r.message?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, filter, search]);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: C.headerBg, borderBottomColor: C.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: C.tint }]}>{t.contactRequests || 'Contact Requests'}</Text>
            {pendingCount > 0 && (
              <Text style={[styles.subtitle, { color: C.textSecondary }]}>
                {t.pendingRequestsSubtitle(pendingCount)}
              </Text>
            )}
          </View>
          <Pressable
            style={[styles.refreshBtn, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => fetchRequests(true)}
          >
            <Ionicons name="refresh" size={18} color={C.tint} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
          <Ionicons name="search" size={16} color={C.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: C.foreground }]}
            placeholder={t.searchRequests || 'Search requests...'}
            placeholderTextColor={C.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Filter pills */}
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f.key}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            const count = f.key === 'all' ? requests.length : requests.filter(r => r.status === f.key).length;
            return (
              <Pressable
                style={[styles.filterPill, { borderColor: active ? C.tint : C.border, backgroundColor: active ? C.tint : C.card }]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, { color: active ? C.primaryForeground : C.foreground }]}>
                  {f.label}
                </Text>
                <View style={[styles.filterBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : C.muted }]}>
                  <Text style={[styles.filterBadgeText, { color: active ? C.primaryForeground : C.mutedForeground }]}>{count}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="mail-open-outline" size={64} color={C.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: C.foreground }]}>
            {search ? t.noResultsFound : (t.noRequests || 'No requests yet')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: C.textSecondary }]}>
            {search ? t.tryDifferentSearch : (t.noRequestsDesc || "You haven't received any contact requests yet")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.id}
          renderItem={({ item, index }) => (
            <RequestCard
              item={item}
              onAccept={handleAccept}
              onReject={handleReject}
              index={index}
              C={C}
              t={t}
            />
          )}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => fetchRequests(true)}
          refreshing={refreshing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingBottom: 0 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  refreshBtn: { padding: 8, borderRadius: 10, borderWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, gap: 8, height: 42 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  filterBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  // Card
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  requesterName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  requesterEmail: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  messageBox: { borderRadius: 10, padding: 12 },
  messageText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  timeAgo: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  rejectBtn: { borderWidth: 1.5 },
  acceptBtn: {},
  actionBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
