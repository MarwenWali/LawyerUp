import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList,
  Modal, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/constants/useTheme';
import { notificationsApi } from '@/services/api';

const TYPE_META = {
  contact_request:  { icon: 'person-add-outline',      color: '#3B82F6' },
  contact_accepted: { icon: 'checkmark-circle-outline', color: '#16A34A' },
  contact_rejected: { icon: 'close-circle-outline',     color: '#DC2626' },
  case_accepted:    { icon: 'briefcase-outline',         color: '#16A34A' },
  case_rejected:    { icon: 'close-circle-outline',      color: '#DC2626' },
  case_completed:   { icon: 'ribbon-outline',            color: '#7C3AED' },
  case_pending:     { icon: 'time-outline',              color: '#F59E0B' },
  default:          { icon: 'notifications-outline',     color: '#6B7280' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function NotifItem({ item, onRead, onDelete, C, index }) {
  const meta = TYPE_META[item.type] || TYPE_META.default;
  const unread = !item.is_read;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <Pressable
        style={[styles.item, { backgroundColor: unread ? C.accentLight : C.card, borderColor: C.border }]}
        onPress={() => !item.is_read && onRead(item.id)}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, { color: C.foreground }]} numberOfLines={1}>
              {item.title}
            </Text>
            {unread && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
          </View>
          <Text style={[styles.itemBody, { color: C.textSecondary }]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={[styles.itemTime, { color: C.mutedForeground }]}>{timeAgo(item.created_at)}</Text>
        </View>
        <Pressable style={styles.deleteBtn} onPress={() => onDelete(item.id)} hitSlop={10}>
          <Feather name="x" size={14} color={C.mutedForeground} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function NotificationsModal({ visible, onClose, onUnreadCountChange }) {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.getAll();
      setNotifications(data.notifications || []);
      onUnreadCountChange?.(data.unreadCount || 0);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (visible) fetchNotifications();
  }, [visible, fetchNotifications]);

  async function handleRead(id) {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      const unread = notifications.filter(n => n.id !== id && !n.is_read).length;
      onUnreadCountChange?.(unread);
    } catch {}
  }

  async function handleDelete(id) {
    try {
      await notificationsApi.delete(id);
      const remaining = notifications.filter(n => n.id !== id);
      setNotifications(remaining);
      onUnreadCountChange?.(remaining.filter(n => !n.is_read).length);
    } catch {}
  }

  async function handleMarkAllRead() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      onUnreadCountChange?.(0);
    } catch {}
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: C.background }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: C.border }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <View>
            <Text style={[styles.title, { color: C.foreground }]}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={[styles.subtitle, { color: C.textSecondary }]}>
                {unreadCount} unread
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Pressable
                style={({ pressed }) => [styles.markAllBtn, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
                onPress={handleMarkAllRead}
              >
                <Text style={[styles.markAllText, { color: C.tint }]}>Mark all read</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: C.muted }]}>
              <Ionicons name="close" size={18} color={C.foreground} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="notifications-off-outline" size={64} color={C.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: C.foreground }]}>All caught up!</Text>
            <Text style={[styles.emptyBody, { color: C.textSecondary }]}>
              No notifications yet. We'll let you know when something happens.
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={n => n.id}
            renderItem={({ item, index }) => (
              <NotifItem item={item} onRead={handleRead} onDelete={handleDelete} C={C} index={index} />
            )}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            onRefresh={fetchNotifications}
            refreshing={loading}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  markAllText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptyBody: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  // Item
  item: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  itemBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  itemTime: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  deleteBtn: { paddingLeft: 4, justifyContent: 'center' },
});
