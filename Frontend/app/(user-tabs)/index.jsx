import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, FlatList, Platform, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { casesApi, notificationsApi, lawyersApi } from '@/services/api';
import NotificationsModal from '@/components/NotificationsModal';

function formatTimeAgo(dateStr, t) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return t.justNow;
  if (hours < 24) return `${hours}${t.hAgo}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${t.dAgo}`;
  return `${Math.floor(days / 7)}${t.wAgo}`;
}

const SPECIALIZATIONS = [
  { key: 'Family',      icon: 'people',          labelEn: 'Family',      labelFr: 'Famille',   labelAr: 'عائلي'  },
  { key: 'Criminal',   icon: 'shield',          labelEn: 'Criminal',    labelFr: 'Pénal',     labelAr: 'جنائي'  },
  { key: 'Business',   icon: 'briefcase',       labelEn: 'Business',    labelFr: 'Commerce',  labelAr: 'تجاري'  },
  { key: 'Real Estate',icon: 'home',            labelEn: 'Real Estate', labelFr: 'Immobilier',labelAr: 'عقاري'  },
  { key: 'Labor',      icon: 'construct',       labelEn: 'Labor',       labelFr: 'Travail',   labelAr: 'شغل'    },
  { key: 'Civil',      icon: 'document-text',   labelEn: 'Civil',       labelFr: 'Civil',     labelAr: 'مدني'   },
];

export default function UserDashboard() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t, language } = useLanguage();
  const { isDark } = useThemeContext();
  const firstName = user?.name?.split(' ')[0] || 'User';

  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [lawyers, setLawyers] = useState([]);
  const [loadingLawyers, setLoadingLawyers] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [notifVisible, setNotifVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationsApi.getAll().then(data => setUnreadCount(data?.unreadCount ?? 0)).catch(() => {});
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      setLoadingCases(true);
      const data = await casesApi.getAll();
      setCases(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchCases error', e);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const fetchLawyers = useCallback(async () => {
    try {
      setLoadingLawyers(true);
      const params = { available: 'true' };
      if (selectedSpec) params.specialization = selectedSpec;
      const data = await lawyersApi.getAll(params);
      setLawyers(Array.isArray(data?.lawyers) ? data.lawyers.slice(0, 8) : []);
    } catch (e) {
      console.error('fetchLawyers error', e);
    } finally {
      setLoadingLawyers(false);
    }
  }, [selectedSpec]);

  useEffect(() => { fetchCases(); }, [fetchCases]);
  useEffect(() => { fetchLawyers(); }, [fetchLawyers]);

  const STATUS_META = {
    pending:   { icon: 'time',             label: t.caseSubmitted },
    accepted:  { icon: 'checkmark-circle', label: t.caseAccepted  },
    closed:    { icon: 'checkmark-circle', label: t.caseResolved  },
    rejected:  { icon: 'close-circle',     label: t.caseRejected  },
  };

  const quickActions = [
    { icon: 'people', label: t.findLawyer, color: C.tint, bg: isDark ? 'rgba(212,160,60,0.12)' : 'rgba(20,33,61,0.08)', route: '/(user-tabs)/lawyers' },
    { icon: 'chatbubbles-outline', label: t.messages || 'Messages', color: C.accent, bg: C.accentLight, route: '/(messaging)/conversations' },
  ];

  const recentCases = [...cases]
    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
    .slice(0, 3);

  const getSpecLabel = (spec) => {
    if (language === 'fr') return spec.labelFr;
    if (language === 'ar') return spec.labelAr;
    return spec.labelEn;
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: C.textSecondary }]}>{t.greeting}</Text>
            <Text style={[styles.userName, { color: C.tint }]}>{firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={[styles.iconBtn, { backgroundColor: C.card }]} onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNotifVisible(true); }}>
              <Ionicons name="notifications-outline" size={22} color={C.foreground} />
              {unreadCount > 0 && (
                <View style={[styles.notifDot, { backgroundColor: C.accent, minWidth: 16, paddingHorizontal: 2 }]}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={[styles.avatar, { backgroundColor: C.tint }]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(user-tabs)/profile');
              }}
            >
              <Text style={[styles.avatarText, { color: C.primaryForeground }]}>{firstName[0]}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient colors={isDark ? [C.accent, '#B8872F'] : ['#14213D', '#1a2a4a']} style={styles.heroGradient}>
            <View style={styles.heroContent}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: isDark ? '#0B1120' : '#FDF6E3' }]}>{t.heroCardTitle}</Text>
                <Text style={[styles.heroDesc, { color: isDark ? 'rgba(11,17,32,0.6)' : 'rgba(253,246,227,0.7)' }]}>{t.heroCardDesc}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ── Quick Actions 2-col grid ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.foreground }]}>{t.quickActions}</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((a, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.actionCardGrid, { backgroundColor: C.card }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(a.route);
                }}
              >
                <View style={[styles.actionIconGrid, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={26} color={a.color} />
                </View>
                <Text style={[styles.actionLabelGrid, { color: C.foreground }]}>{a.label}</Text>
                <Feather name="chevron-right" size={14} color={C.mutedForeground} style={{ marginTop: 4 }} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Specialization chips ── */}
        <View style={{ marginBottom: 24 }}>
          <Text style={[styles.sectionTitle, { color: C.foreground, paddingHorizontal: 20, marginBottom: 14 }]}>{t.browseBySpecialty}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
            <Pressable
              style={[styles.chip, { backgroundColor: selectedSpec === null ? C.tint : C.card, borderColor: selectedSpec === null ? C.tint : C.border }]}
              onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedSpec(null); }}
            >
              <Text style={[styles.chipText, { color: selectedSpec === null ? (isDark ? '#0B1120' : '#fff') : C.mutedForeground }]}>{t.allSpecializations}</Text>
            </Pressable>
            {SPECIALIZATIONS.map(spec => {
              const active = selectedSpec === spec.key;
              return (
                <Pressable
                  key={spec.key}
                  style={[styles.chip, { backgroundColor: active ? C.tint : C.card, borderColor: active ? C.tint : C.border }]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedSpec(active ? null : spec.key);
                  }}
                >
                  <Ionicons name={spec.icon} size={14} color={active ? (isDark ? '#0B1120' : '#fff') : C.accent} />
                  <Text style={[styles.chipText, { color: active ? (isDark ? '#0B1120' : '#fff') : C.foreground }]}>{getSpecLabel(spec)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Available lawyers strip ── */}
        <View style={{ marginBottom: 28 }}>
          <View style={[styles.sectionHeaderRow, { paddingHorizontal: 20, marginBottom: 14 }]}>
            <Text style={[styles.sectionTitle, { color: C.foreground, marginBottom: 0 }]}>{t.availableNow}</Text>
            <Pressable onPress={() => router.push('/(user-tabs)/lawyers')}>
              <Text style={{ color: C.accent, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{t.seeAll}</Text>
            </Pressable>
          </View>
          {loadingLawyers ? (
            <ActivityIndicator color={C.accent} style={{ paddingVertical: 32 }} />
          ) : lawyers.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.mutedForeground, paddingHorizontal: 20 }]}>{t.noAvailableLawyers}</Text>
          ) : (
            <FlatList
              horizontal
              data={lawyers}
              keyExtractor={item => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.lawyerCard, { backgroundColor: C.card }, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/(user-tabs)/lawyers');
                  }}
                >
                  <View style={[styles.lawyerAvatar, { backgroundColor: C.tint }]}>
                    {item.profilePhotoUrl ? (
                      <Image source={{ uri: item.profilePhotoUrl }} style={styles.lawyerAvatarImg} />
                    ) : (
                      <Text style={[styles.lawyerAvatarText, { color: isDark ? '#0B1120' : C.primaryForeground }]}>
                        {item.name?.charAt(0) ?? '?'}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.lawyerName, { color: C.foreground }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.lawyerSpec, { color: C.mutedForeground }]} numberOfLines={1}>{item.specialization || '—'}</Text>
                  <View style={styles.lawyerMeta}>
                    <Ionicons name="star" size={12} color={C.accent} />
                    <Text style={[styles.lawyerRating, { color: C.accent }]}>{Number(item.rating || 0).toFixed(1)}</Text>
                  </View>
                  <View style={[styles.availablePill, { backgroundColor: 'rgba(22,163,74,0.12)' }]}>
                    <View style={styles.availableDot} />
                    <Text style={[styles.availableTxt, { color: C.success }]}>{t.available}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.foreground }]}>{t.recentActivity}</Text>
          <View style={[styles.activityCard, { backgroundColor: C.card }]}>
            {loadingCases ? (
              <ActivityIndicator color={C.accent} style={{ padding: 24 }} />
            ) : recentCases.length === 0 ? (
              <Text style={[styles.emptyText, { color: C.mutedForeground }]}>{t.noActivityYet}</Text>
            ) : recentCases.map((item, i) => {
              const meta = STATUS_META[item.status] || STATUS_META.pending;
              return (
                <View
                  key={item.id || i}
                  style={[styles.activityRow, i < recentCases.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                >
                  <Ionicons
                    name={meta.icon}
                    size={20}
                    color={item.status === 'pending' ? C.warning : item.status === 'rejected' ? C.destructive : C.success}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activityText, { color: C.foreground }]}>
                      {item.subject || item.title || t.legalCase}
                    </Text>
                    <Text style={[styles.activityTime, { color: C.mutedForeground }]}>
                      {meta.label} · {formatTimeAgo(item.created_at || item.createdAt, t)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <NotificationsModal
        visible={notifVisible}
        onClose={() => setNotifVisible(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  greeting: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  userName: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  heroCard: { marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', marginBottom: 28 },
  heroGradient: { padding: 24 },
  heroContent: { flexDirection: 'row' },
  heroTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  heroDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 16 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  heroBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // 2-col actions grid
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionCardGrid: { flex: 1, borderRadius: 16, padding: 18, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, alignItems: 'flex-start', gap: 10 },
  actionIconGrid: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionLabelGrid: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  messagesCard: { marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  messagesIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  messagesTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  messagesSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  // Chips
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  // Lawyer cards
  lawyerCard: { width: 140, borderRadius: 16, padding: 14, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
  lawyerAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden' },
  lawyerAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  lawyerAvatarText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  lawyerName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginBottom: 2 },
  lawyerSpec: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 8 },
  lawyerMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  lawyerRating: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  availablePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10 },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  availableTxt: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  // Activity
  activityCard: { borderRadius: 14, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  activityText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  activityTime: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', padding: 24 },
});
