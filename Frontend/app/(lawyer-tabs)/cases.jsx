import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ScrollView, Modal, Platform, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';
import { casesApi } from '@/services/api';

export default function CasesPage() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(t.all);
  const [selectedCase, setSelectedCase] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const STATUS_FILTERS = [t.all, t.pending, t.accepted, t.completed, t.rejected];

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const data = await casesApi.getAll();
      setCases(data.cases);
    } catch (e) {
      Alert.alert('Error', 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  async function handleUpdateStatus(caseId, status) {
    try {
      if (Platform.OS !== 'web') {
        status === 'accepted'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      await casesApi.updateStatus(caseId, status);
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, status } : c));
      if (selectedCase?.id === caseId) setSelectedCase(prev => ({ ...prev, status }));
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update case');
    }
  }

function formatTimeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}${t.hAgo}`;
  return `${Math.floor(hours / 24)}${t.dAgo}`;
}

function CaseCard({ c, onPress, onAccept, onReject, C, t }) {
  const PRIORITY_COLORS = { low: C.mutedForeground, medium: C.warning, high: C.destructive };
  const STATUS_COLORS = { pending: C.warning, accepted: C.tint, completed: C.success, rejected: C.destructive };

  return (
    <Pressable style={({ pressed }) => [styles.caseCard, { backgroundColor: C.card }, pressed && { opacity: 0.9 }]} onPress={onPress}>
      <View style={styles.caseTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.caseName, { color: C.foreground }]}>{c.userName || c.user_name}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[c.priority] + '20' }]}>
            <Text style={[styles.priorityText, { color: PRIORITY_COLORS[c.priority] }]}>{c.priority}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[c.status] + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[c.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[c.status] }]}>{c.status}</Text>
        </View>
      </View>
      <Text style={[styles.caseSubject, { color: C.accent }]}>{c.subject}</Text>
      <Text style={[styles.caseDesc, { color: C.textSecondary }]} numberOfLines={2}>{c.description}</Text>
      <View style={styles.caseFooter}>
        <View style={[styles.categoryTag, { backgroundColor: C.background }]}>
          <Text style={[styles.categoryText, { color: C.textSecondary }]}>{c.category}</Text>
        </View>
        <Text style={[styles.caseTime, { color: C.mutedForeground }]}>{formatTimeAgo(c.createdAt, t)}</Text>
      </View>
      {c.status === 'pending' && (
        <View style={styles.caseBtns}>
          <Pressable style={({ pressed }) => [styles.acceptBtn, { backgroundColor: C.success }, pressed && { opacity: 0.85 }]}
            onPress={onAccept}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.acceptBtnText}>{t.accept}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.rejectBtn, { borderColor: C.destructive }, pressed && { opacity: 0.7 }]}
            onPress={onReject}>
            <Ionicons name="close-circle" size={16} color={C.destructive} />
            <Text style={[styles.rejectBtnText, { color: C.destructive }]}>{t.reject}</Text>
          </Pressable>
        </View>
      )}
      {c.status === 'accepted' && (
        <View style={styles.caseBtns}>
          <Pressable style={({ pressed }) => [styles.msgBtn, { borderColor: C.tint }, pressed && { opacity: 0.7 }]}>
            <Feather name="message-circle" size={16} color={C.tint} />
            <Text style={[styles.msgBtnText, { color: C.tint }]}>{t.message}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.videoBtn, { backgroundColor: C.accent }, pressed && { opacity: 0.85 }]}>
            <Ionicons name="videocam" size={16} color={C.tint} />
            <Text style={[styles.videoBtnText, { color: C.tint }]}>{t.videoCall}</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

  const filtered = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = (c.userName || c.user_name || '').toLowerCase().includes(search.toLowerCase()) || c.subject.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === t.all || c.status === filter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [search, filter, t.all, cases]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.headerSection, { paddingTop: insets.top + 12, backgroundColor: C.headerBg, borderBottomColor: C.border }]}>
          <Text style={[styles.pageTitle, { color: C.tint }]}>{t.cases}</Text>
          <View style={[styles.searchBar, { backgroundColor: C.background }]}>
            <Feather name="search" size={18} color={C.mutedForeground} />
            <TextInput style={[styles.searchInput, { color: C.foreground }]} placeholder={t.searchCases} placeholderTextColor={C.mutedForeground} value={search} onChangeText={setSearch} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            {STATUS_FILTERS.map(s => (
              <Pressable key={s} style={[styles.filterPill, { backgroundColor: C.background, borderColor: C.border }, filter === s && { backgroundColor: C.tint, borderColor: C.tint }]} onPress={() => setFilter(s)}>
                <Text style={[styles.filterText, { color: C.textSecondary }, filter === s && { color: C.primaryForeground }]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filtered}
          renderItem={({ item }) => <CaseCard c={item} onPress={() => setSelectedCase(item)} onAccept={() => handleUpdateStatus(item.id, 'accepted')} onReject={() => handleUpdateStatus(item.id, 'rejected')} C={C} t={t} />}
          keyExtractor={c => c.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={loading ? <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} /> : null}
          ListEmptyComponent={!loading ? <View style={styles.emptyState}><Ionicons name="folder-open" size={40} color={C.mutedForeground} /><Text style={[styles.emptyText, { color: C.mutedForeground }]}>{t.noResultsFound}</Text></View> : null}
        />

        <Modal visible={!!selectedCase} animationType="slide" transparent onRequestClose={() => setSelectedCase(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: C.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: C.foreground }]}>{t.caseDetails}</Text>
                <Pressable onPress={() => setSelectedCase(null)}><Ionicons name="close" size={24} color={C.foreground} /></Pressable>
              </View>
              {selectedCase && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.detailRow}>
                    <View style={[styles.detailAvatar, { backgroundColor: C.tint }]}>
                      <Text style={[styles.detailAvatarText, { color: C.primaryForeground }]}>{selectedCase.userName[0]}</Text>
                    </View>
                    <View>
                      <Text style={[styles.detailName, { color: C.foreground }]}>{selectedCase.userName}</Text>
                      <Text style={[styles.detailEmail, { color: C.textSecondary }]}>{selectedCase.userEmail}</Text>
                    </View>
                  </View>
                  <Text style={[styles.detailSubject, { color: C.foreground }]}>{selectedCase.subject}</Text>
                  <Text style={[styles.detailDesc, { color: C.textSecondary }]}>{selectedCase.description}</Text>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  pageTitle: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  filtersRow: { gap: 8, paddingBottom: 4 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  caseCard: { borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  caseTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  caseName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
  priorityText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  caseSubject: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  caseDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 10 },
  caseFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  categoryTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  categoryText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  caseTime: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  caseBtns: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  acceptBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, paddingVertical: 10, borderRadius: 10 },
  rejectBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  msgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, paddingVertical: 10, borderRadius: 10 },
  msgBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  videoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  videoBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  detailAvatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  detailName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  detailEmail: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  detailSubject: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  detailDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
