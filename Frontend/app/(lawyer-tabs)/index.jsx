import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, FlatList, Platform, ActivityIndicator, Switch, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { notificationsApi, lawyersApi, contactsApi, casesApi } from '@/services/api';
import { supabase } from '@/utils/supabase';
import NotificationsModal from '@/components/NotificationsModal';
import ProfileImage from '@/components/ProfileImage';
import StatusAvatar from '@/components/StatusAvatar';
import CreateAppointmentModal from '@/components/CreateAppointmentModal';

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
  const [pendingRequests, setPendingRequests] = useState(0);
  const [activeCases, setActiveCases] = useState(0);
  const [completedCases, setCompletedCases] = useState(0);
  const [thisMonthCases, setThisMonthCases] = useState(0);
  
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  
  const [notifVisible, setNotifVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(user?.is_available ?? true);
  const [availLoading, setAvailLoading] = useState(false);

  useEffect(() => {
    notificationsApi.getAll().then(data => setUnreadCount(data?.unreadCount ?? 0)).catch(() => {});
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

  const fetchMetrics = useCallback(async () => {
    if (!user?.id) return;
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const [reqData, casesData] = await Promise.all([
        contactsApi.getAll(),
        casesApi.getAll()
      ]);

      const requestsList = reqData?.requests || [];
      const casesList = casesData?.cases || [];

      // Unified Incoming count (Pending cases + Pending contact requests)
      const incCount = casesList.filter(c => c.status === 'pending').length + requestsList.filter(r => r.status === 'pending').length;
      
      const actCount = casesList.filter(c => c.status === 'accepted').length + requestsList.filter(r => r.status === 'accepted').length;
      const compCount = casesList.filter(c => c.status === 'completed').length;
      
      const monthCount = casesList.filter(c => new Date(c.createdAt || c.created_at).getTime() >= firstDayOfMonth).length +
                         requestsList.filter(r => new Date(r.created_at).getTime() >= firstDayOfMonth).length;

      setPendingRequests(incCount);
      setActiveCases(actCount);
      setCompletedCases(compCount);
      setThisMonthCases(monthCount);
    } catch (e) {
      console.error('fetchMetrics error:', e);
    }
  }, [user?.id]);

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingAppointments(true);
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('lawyer_id', user.id)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(2);
        
      if (!error && data) setAppointments(data);
    } catch (e) {
      console.error('fetchAppointments error:', e);
    } finally {
      setLoadingAppointments(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchMetrics();
      fetchAppointments();
      // Sync availability
      if (user?.id) {
        lawyersApi.getById(user.id)
          .then(data => { if (typeof data?.isAvailable === 'boolean') setIsAvailable(data.isAvailable); })
          .catch(() => {});
      }
    }, [fetchMetrics, fetchAppointments, user?.id])
  );

  const stats = [
    { label: t.statIncoming, value: String(pendingRequests), icon: 'mail-outline', color: C.warning, bg: 'rgba(245,158,11,0.1)', route: '/(lawyer-tabs)/cases?filter=Incoming' },
    { label: t.statActive, value: String(activeCases), icon: 'briefcase', color: C.success, bg: 'rgba(22,163,74,0.1)', route: '/(lawyer-tabs)/cases?filter=Active' },
    { label: t.statCompleted, value: String(completedCases), icon: 'checkmark-circle', color: C.tint, bg: isDark ? 'rgba(212,160,60,0.12)' : 'rgba(20,33,61,0.08)', route: '/(lawyer-tabs)/cases?filter=Completed' },
    { label: t.statThisMonth, value: `+${thisMonthCases}`, icon: 'trending-up', color: C.accent, bg: 'rgba(212,160,60,0.12)', route: '/(lawyer-tabs)/cases?filter=All' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}>
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
          <StatusAvatar 
            url={user?.profile_photo_url} 
            size={40} 
            isAvailable={isAvailable}
            onPhotoPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(lawyer-tabs)/profile');
            }}
          />
          <NotificationsModal
            visible={notifVisible}
            onClose={() => setNotifVisible(false)}
            onUnreadCountChange={setUnreadCount}
          />
        </View>



        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <Pressable 
              key={i} 
              style={({ pressed }) => [
                styles.statCard, 
                { backgroundColor: C.card, borderTopColor: s.color, borderTopWidth: !isDark ? 3 : 0, borderColor: C.border }, 
                pressed && { opacity: 0.8 }
              ]} 
              onPress={() => router.push(s.route)}
            >
              <View style={[styles.statIcon, { backgroundColor: isDark ? s.bg : 'transparent' }]}>
                <Ionicons name={s.icon} size={22} color={s.color} />
              </View>
              <View>
                <Text style={[styles.statValue, { color: C.foreground }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: C.textSecondary }]}>{s.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── My Appointments ── */}
        <View style={{ marginBottom: 28 }}>
          <View style={[styles.sectionHeaderRow, { paddingHorizontal: 20, marginBottom: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.sectionTitle, { color: C.foreground, marginBottom: 0, marginRight: 8 }]}>{t.myAppointments}</Text>
              <Pressable onPress={() => router.push('/(lawyer-tabs)/create-appointment')} style={{ backgroundColor: 'rgba(184, 135, 47, 0.1)', borderRadius: 12, padding: 4 }}>
                <Ionicons name="add" size={20} color={C.accent} />
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/(lawyer-tabs)/all-appointments')}>
              <Text style={{ color: C.accent, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{t.seeAll}</Text>
            </Pressable>
          </View>
          {loadingAppointments ? (
            <ActivityIndicator color={C.accent} style={{ paddingVertical: 32 }} />
          ) : appointments.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.mutedForeground, paddingHorizontal: 20 }]}>{t.noUpcomingAppointments}</Text>
          ) : (
            <FlatList
              horizontal
              data={appointments}
              keyExtractor={item => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => {
                const dateObj = new Date(item.date);
                const isCitizen = item.type === 'lawyer' || item.type === 'user' || item.type === 'client';
                const isCourt = item.type === 'court';
                return (
                  <Pressable
                    style={({ pressed }) => [{ width: 260, padding: 16, borderRadius: 16 }, { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 }, pressed && { opacity: 0.88 }]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isCitizen ? 'rgba(59,130,246,0.1)' : isCourt ? 'rgba(184, 135, 47, 0.1)' : 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name={isCitizen ? 'people' : isCourt ? 'business' : 'calendar'} size={20} color={isCitizen ? '#3B82F6' : isCourt ? '#B8872F' : '#10B981'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.foreground }} numberOfLines={1}>{item.title}</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground }}>{isCitizen ? t.citizenAppointment : isCourt && item.location ? item.location : item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 8 }}>
                      <Ionicons name="time-outline" size={16} color={C.mutedForeground} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: C.foreground }}>{dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
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
  statCard: { 
    width: '47%', 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1,
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10 
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
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
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', padding: 24 },
});
