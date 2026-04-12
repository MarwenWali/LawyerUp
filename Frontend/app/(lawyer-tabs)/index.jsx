import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { casesApi, contactsApi, notificationsApi, lawyersApi } from '@/services/api';
import NotificationsModal from '@/components/NotificationsModal';

function formatTimeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}${t.hAgo}`;
  return `${Math.floor(hours / 24)}${t.dAgo}`;
}

export default function LawyerDashboard() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t } = useLanguage();
  const { isDark } = useThemeContext();
  const firstName = user?.name?.replace('Maître ', '').split(' ')[0] || 'Lawyer';

  const PRIORITY_COLORS = { low: C.mutedForeground, medium: C.warning, high: C.destructive };
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [notifVisible, setNotifVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(user?.is_available ?? true);
  const [availLoading, setAvailLoading] = useState(false);

  useEffect(() => {
    notificationsApi.getAll().then(data => setUnreadCount(data?.unreadCount ?? 0)).catch(() => {});
    // Sync availability from own profile
    lawyersApi.getById(user?.id).then(data => { if (typeof data?.isAvailable === 'boolean') setIsAvailable(data.isAvailable); }).catch(() => {});
  }, [user?.id]);

  async function handleAvailabilityToggle(val) {
    const prev = isAvailable;
    setIsAvailable(val);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setAvailLoading(true);
      const data = await lawyersApi.setAvailability(val);
      setIsAvailable(data.isAvailable);
    } catch (e) {
      setIsAvailable(prev);
      Alert.alert('Error', e.message || 'Failed to update availability.');
    } finally {
      setAvailLoading(false);
    }
  }

  const fetchRequests = useCallback(async () => {
    try {
      const data = await contactsApi.getAll();
      setPendingRequests((data.requests || []).filter(r => r.status === 'pending').length);
    } catch {}
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const data = await casesApi.getAll();
      setCases(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchCases error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const now = new Date();
  const thisMonth = cases.filter(c => {
    const d = new Date(c.created_at || c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { label: t.pending, value: String(cases.filter(c => c.status === 'pending').length), icon: 'time', color: C.warning, bg: 'rgba(245,158,11,0.1)' },
    { label: t.active, value: String(cases.filter(c => c.status === 'accepted').length), icon: 'briefcase', color: C.tint, bg: isDark ? 'rgba(212,160,60,0.12)' : 'rgba(20,33,61,0.08)' },
    { label: t.completed, value: String(cases.filter(c => c.status === 'closed').length), icon: 'checkmark-circle', color: C.success, bg: 'rgba(22,163,74,0.1)' },
    { label: t.thisMonth, value: `+${thisMonth}`, icon: 'trending-up', color: C.accent, bg: 'rgba(212,160,60,0.12)' },
  ];

  const pendingCases = cases.filter(c => c.status === 'pending').slice(0, 3);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: C.textSecondary }]}>{t.welcomeBackLawyer}</Text>
            <Text style={[styles.name, { color: C.tint }]}>{firstName}</Text>
          </View>
          <View style={{ position: 'relative', marginRight: 8 }}>
            <Pressable
              style={[styles.avatarSmall, { backgroundColor: C.card }]}
              onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNotifVisible(true); }}
            >
              <Ionicons name="notifications-outline" size={20} color={C.foreground} />
            </Pressable>
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: C.accent, borderRadius: 8, minWidth: 16, paddingHorizontal: 2, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Pressable
            style={[styles.avatarSmall, { backgroundColor: C.tint }]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(lawyer-tabs)/profile');
            }}
          >
            <Text style={[styles.avatarSmallText, { color: C.primaryForeground }]}>{firstName[0]}</Text>
          </Pressable>
          <NotificationsModal
            visible={notifVisible}
            onClose={() => setNotifVisible(false)}
            onUnreadCountChange={setUnreadCount}
          />
        </View>

        {/* Availability toggle */}
        <View style={[styles.availCard, { backgroundColor: C.card }]}>
          <View style={styles.availLeft}>
            <View style={[styles.availIcon, { backgroundColor: isAvailable ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.1)' }]}>
              <Ionicons name={isAvailable ? 'checkmark-circle' : 'close-circle'} size={20} color={isAvailable ? C.success : C.destructive} />
            </View>
            <View>
              <Text style={[styles.availTitle, { color: C.foreground }]}>{t.acceptingCasesTitle}</Text>
              <Text style={[styles.availSub, { color: C.textSecondary }]}>{isAvailable ? t.visibleToClients : t.hiddenFromSearches}</Text>
            </View>
          </View>
          {availLoading
            ? <ActivityIndicator size="small" color={C.accent} />
            : <Switch
                value={isAvailable}
                onValueChange={handleAvailabilityToggle}
                trackColor={{ false: '#e5e7eb', true: C.success + '55' }}
                thumbColor={isAvailable ? C.success : '#9ca3af'}
                ios_backgroundColor="#e5e7eb"
              />}
        </View>

        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: C.card }]}>
              <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: C.foreground }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: C.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: C.foreground }]}>{t.newRequests}</Text>
            <Pressable onPress={() => router.push('/(lawyer-tabs)/cases')}>
              <Text style={[styles.seeAll, { color: C.accent }]}>{t.viewAll}</Text>
            </Pressable>
          </View>
          {loading ? <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} /> : pendingCases.map(c => (
            <View key={c.id} style={[styles.caseCard, { backgroundColor: C.card }]}>
              <View style={styles.caseTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.caseName, { color: C.foreground }]}>{c.user_name || c.userName}</Text>
                  <Text style={[styles.caseSubject, { color: C.accent }]}>{c.subject}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[c.priority] || C.mutedForeground) + '20' }]}>
                  <Text style={[styles.priorityText, { color: PRIORITY_COLORS[c.priority] || C.mutedForeground }]}>{c.priority || 'medium'}</Text>
                </View>
              </View>
              <View style={styles.caseFooter}>
                <View style={[styles.categoryTag, { backgroundColor: C.background }]}>
                  <Text style={[styles.categoryText, { color: C.textSecondary }]}>{c.category}</Text>
                </View>
                <Text style={[styles.caseTime, { color: C.mutedForeground }]}>{formatTimeAgo(c.created_at || c.createdAt, t)}</Text>
              </View>
              <View style={styles.caseBtns}>
                <Pressable
                  style={({ pressed }) => [styles.acceptBtn, { backgroundColor: C.success }, pressed && { opacity: 0.85 }]}
                  onPress={async () => { try { await casesApi.updateStatus(c.id, 'accepted'); fetchCases(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} }}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.acceptBtnText}>{t.accept}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.rejectBtn, { borderColor: C.destructive }, pressed && { opacity: 0.7 }]}
                  onPress={async () => { try { await casesApi.updateStatus(c.id, 'rejected'); fetchCases(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {} }}
                >
                  <Ionicons name="close-circle" size={16} color={C.destructive} />
                  <Text style={[styles.rejectBtnText, { color: C.destructive }]}>{t.reject}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.foreground }]}>{t.quickActions}</Text>
          <View style={styles.quickActions}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => router.push('/(lawyer-tabs)/requests')}
            >
              <Ionicons name="mail-outline" size={20} color={C.accent} />
              <Text style={[styles.quickActionText, { color: C.foreground }]}>{t.requests || 'Requests'}</Text>
              {pendingRequests > 0 && (
                <View style={[styles.badge, { backgroundColor: C.destructive }]}>
                  <Text style={styles.badgeText}>{pendingRequests}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={[styles.quickAction, { backgroundColor: C.card, borderColor: C.border }]} onPress={() => {}}>
              <Ionicons name="calendar-outline" size={20} color={C.accent} />
              <Text style={[styles.quickActionText, { color: C.foreground }]}>{t.scheduleLabel}</Text>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.messagesCard,
              { backgroundColor: C.card, borderColor: C.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push('/(messaging)/conversations')}
          >
            <View style={[styles.messagesIcon, { backgroundColor: isDark ? 'rgba(212,160,60,0.12)' : 'rgba(20,33,61,0.08)' }]}>
              <Ionicons name="chatbubbles-outline" size={24} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.messagesTitle, { color: C.foreground }]}>Messages</Text>
              <Text style={[styles.messagesSubtitle, { color: C.mutedForeground }]}>
                View citizen conversations
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.mutedForeground} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  greeting: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold' },
  avatarSmall: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  statCard: { width: '47%', borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  seeAll: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  caseCard: { borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  caseTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  caseName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  caseSubject: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  caseFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  categoryTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  categoryText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  caseTime: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  caseBtns: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  acceptBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, paddingVertical: 10, borderRadius: 10 },
  rejectBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  quickActionText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  messagesCard: { marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  messagesIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  messagesTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  messagesSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  badge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  availCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  availLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  availIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  availTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  availSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
