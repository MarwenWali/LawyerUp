import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, FlatList, Platform, ActivityIndicator, Image, Linking, Modal, Dimensions, ActionSheetIOS, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { casesApi, notificationsApi, userApi } from '@/services/api';
import { messagingApi } from '@/services/messagingApi';
import NotificationsModal from '@/components/NotificationsModal';
import ProfileImage from '@/components/ProfileImage';
import UploadActionSheet from '@/components/UploadActionSheet';
import CreateAppointmentModal from '@/components/CreateAppointmentModal';

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

const { width, height } = Dimensions.get('window');

function ImagePreviewModal({ uri, onClose }) {
  return (
    <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable style={{ position: 'absolute', top: 52, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 6 }} onPress={onClose} hitSlop={16}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {uri ? <Image source={{ uri }} style={{ width, height: height * 0.85 }} resizeMode="contain" /> : null}
      </View>
    </Modal>
  );
}

export default function UserDashboard() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t, language } = useLanguage();
  const { isDark } = useThemeContext();
  const firstName = user?.name?.split(' ')[0] || 'User';

  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);
  const [vaultFiles, setVaultFiles] = useState([]);
  const [loadingVault, setLoadingVault] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
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

  const fetchVaultFiles = useCallback(async () => {
    try {
      setLoadingVault(true);
      const data = await userApi.getVault();
      setVaultFiles(data.files ? data.files.slice(0, 3) : []);
    } catch (e) {
      console.error('fetchVault error', e);
    } finally {
      setLoadingVault(false);
    }
  }, []);

  const [isUploading, setIsUploading] = useState(false);

  const processUpload = async (fileObj) => {
    try {
      setIsUploading(true);
      await userApi.uploadVaultFile(fileObj);
      await fetchVaultFiles();
    } catch (error) {
      Alert.alert("Upload Failed", error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const [sheetVisible, setSheetVisible] = useState(false);

  const handleUploadClick = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetVisible(true);
  };

  const handleOptionSelect = async (option) => {
    setSheetVisible(false);
    // give modal time to close before opening picker
    setTimeout(async () => {
      if (option === 'camera') {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled) processUpload({ uri: result.assets[0].uri, name: 'camera.jpg', type: 'image/jpeg' });
      } else if (option === 'gallery') {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!result.canceled) processUpload({ uri: result.assets[0].uri, name: 'gallery.jpg', type: 'image/jpeg' });
      } else if (option === 'document') {
        const result = await DocumentPicker.getDocumentAsync({});
        if (!result.canceled) processUpload({ uri: result.assets[0].uri, name: result.assets[0].name, type: result.assets[0].mimeType });
      }
    }, 300);
  };

  const fetchAppointments = useCallback(async () => {
    try {
      setLoadingAppointments(true);
      const data = await userApi.getAppointments();
      setAppointments(data.appointments ? data.appointments.slice(0, 2) : []);
    } catch (e) {
      console.error('fetchAppointments error', e);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);
  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments])
  );
  useEffect(() => { fetchVaultFiles(); }, [fetchVaultFiles]);

  const STATUS_META = {
    pending:   { icon: 'time',             label: t.caseSubmitted },
    accepted:  { icon: 'checkmark-circle', label: t.caseAccepted  },
    closed:    { icon: 'checkmark-circle', label: t.caseResolved  },
    rejected:  { icon: 'close-circle',     label: t.caseRejected  },
  };

  const recentCases = [...cases]
    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
    .slice(0, 3);



  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <CreateAppointmentModal 
        visible={appointmentModalVisible} 
        onClose={() => setAppointmentModalVisible(false)} 
        onSuccess={fetchAppointments} 
      />
      <UploadActionSheet 
        visible={sheetVisible} 
        onClose={() => setSheetVisible(false)} 
        onOptionSelect={handleOptionSelect} 
      />
      {isUploading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ backgroundColor: C.card, padding: 24, borderRadius: 16, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.tint} style={{ marginBottom: 16 }} />
            <Text style={{ color: C.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Uploading...</Text>
          </View>
        </View>
      )}

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
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(user-tabs)/profile');
              }}
            >
              <ProfileImage url={user?.profile_photo_url} size={40} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient colors={isDark ? [C.accent, '#B8872F'] : ['#14213D', '#1a2a4a']} style={styles.heroGradient}>
            <View style={styles.heroContent}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: isDark ? '#0B1120' : '#FDF6E3' }]}>{t.heroCardTitle}</Text>
                <Text style={[styles.heroDesc, { color: isDark ? 'rgba(11,17,32,0.6)' : 'rgba(253,246,227,0.7)' }]}>{t.heroCardDesc}</Text>
                <Pressable
                  style={({ pressed }) => [styles.heroBtn, { backgroundColor: isDark ? '#0B1120' : C.accent }, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/(user-tabs)/chat');
                  }}
                >
                  <Ionicons name="chatbubble" size={16} color={isDark ? C.accent : '#14213D'} />
                  <Text style={[styles.heroBtnText, { color: isDark ? C.accent : '#14213D' }]}>{t.startConversation}</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </View>



        {/* ── My Appointments ── */}
        <View style={{ marginBottom: 28 }}>
          <View style={[styles.sectionHeaderRow, { paddingHorizontal: 20, marginBottom: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.sectionTitle, { color: C.foreground, marginBottom: 0, marginRight: 8 }]}>My Appointments</Text>
              <Pressable onPress={() => setAppointmentModalVisible(true)} style={{ backgroundColor: 'rgba(184, 135, 47, 0.1)', borderRadius: 12, padding: 4 }}>
                <Ionicons name="add" size={20} color={C.accent} />
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/(user-tabs)/appointments')}>
              <Text style={{ color: C.accent, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>See All</Text>
            </Pressable>
          </View>
          {loadingAppointments ? (
            <ActivityIndicator color={C.accent} style={{ paddingVertical: 32 }} />
          ) : appointments.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.mutedForeground, paddingHorizontal: 20 }]}>No upcoming appointments</Text>
          ) : (
            <FlatList
              horizontal
              data={appointments}
              keyExtractor={item => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => {
                const dateObj = new Date(item.date);
                const isLawyer = item.type === 'lawyer';
                const isCourt = item.type === 'court';
                return (
                  <Pressable
                    style={({ pressed }) => [{ width: 260, padding: 16, borderRadius: 16 }, { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 }, pressed && { opacity: 0.88 }]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isLawyer ? 'rgba(59,130,246,0.1)' : isCourt ? 'rgba(184, 135, 47, 0.1)' : 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name={isLawyer ? 'briefcase' : isCourt ? 'business' : 'calendar'} size={20} color={isLawyer ? '#3B82F6' : isCourt ? '#B8872F' : '#10B981'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.foreground }} numberOfLines={1}>{item.title}</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground }}>{isLawyer && item.lawyer_name ? item.lawyer_name : isCourt && item.location ? item.location : item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
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

        {/* ── My Legal Vault ── */}
        <View style={{ marginBottom: 24 }}>
          <View style={[styles.sectionHeaderRow, { paddingHorizontal: 20, marginBottom: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.sectionTitle, { color: C.foreground, marginBottom: 0, marginRight: 8 }]}>My Legal Vault</Text>
              <Pressable onPress={handleUploadClick} style={{ backgroundColor: 'rgba(184, 135, 47, 0.1)', borderRadius: 12, padding: 4 }}>
                <Ionicons name="add" size={20} color={C.accent} />
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/(user-tabs)/vault')}>
              <Text style={{ color: C.accent, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>See All</Text>
            </Pressable>
          </View>
          {loadingVault ? (
            <ActivityIndicator color={C.accent} style={{ paddingVertical: 20 }} />
          ) : vaultFiles.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.mutedForeground, paddingHorizontal: 20 }]}>No files uploaded yet</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {vaultFiles.map(file => {
                const isImage = file.message_type === 'image';
                const dateStr = new Date(file.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                
                let statusText = 'Not shared yet';
                let StatusIcon = null;
                if (file.source === 'lawyer' && file.receiver_name) {
                  statusText = `Sent to: ${file.receiver_name}`;
                  StatusIcon = <Ionicons name="paper-plane" size={10} color="#9BA1A6" style={{ marginRight: 4 }} />;
                } else if (file.source === 'ai') {
                  statusText = 'Analyzed by AI';
                }

                return (
                  <Pressable
                    key={file.id}
                    style={({ pressed }) => [styles.vaultCard, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.85 }]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (isImage) {
                        setPreviewImageUrl(file.attachment_url);
                      } else {
                        Linking.openURL(file.attachment_url).catch(() => {});
                      }
                    }}
                  >
                    <View style={[styles.vaultIconContainer, { backgroundColor: isImage ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                      <Ionicons name={isImage ? "image" : "document-text"} size={22} color={isImage ? "#3B82F6" : "#EF4444"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.vaultFileName, { color: C.foreground }]} numberOfLines={1}>{file.attachment_name || 'Document'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        {StatusIcon}
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9BA1A6' }} numberOfLines={1}>
                          {statusText}
                        </Text>
                      </View>
                      <Text style={[styles.vaultFileDate, { color: C.mutedForeground }]}>{dateStr}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>


      </ScrollView>
      <NotificationsModal
        visible={notifVisible}
        onClose={() => setNotifVisible(false)}
        onUnreadCountChange={setUnreadCount}
      />
      <ImagePreviewModal
        uri={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
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
  // Consultation cards
  consultationCard: { width: 220, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, gap: 12 },
  consultationAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  consultationAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  consultationName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  consultationPreview: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  consultationBadge: { position: 'absolute', right: 12, top: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  consultationBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  // Vault cards
  vaultCard: { width: 160, padding: 14, borderRadius: 16, borderWidth: 1, gap: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
  vaultIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  vaultFileName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  vaultFileDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', padding: 24 },
});
