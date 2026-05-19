import React, { useState, useEffect, memo, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Alert, Image, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { userApi, lawyersApi } from '@/services/api';
import { SPECIALIZATION_OPTIONS } from '@/constants/mockData';
import ProfileImage from '@/components/ProfileImage';
import StatusAvatar from '@/components/StatusAvatar';

import LawyerEditProfileModal from '@/components/LawyerEditProfileModal';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function LawyerProfilePage() {
  const { user, logout, updateUser, uploadPhoto } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { themeMode, toggleTheme } = useThemeContext();
  const { language, t, changeLanguage, availableLanguages } = useLanguage();
  const displayName = user?.name || 'Maître Lawyer';

  // ── Modal Visibility ──────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // ── Loading States ────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [availLoading, setAvailLoading] = useState(false);

  // ── Availability ──────────────────────────────────────────────────────
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (user?.id) {
      lawyersApi.getById(user.id)
        .then(data => { if (typeof data?.isAvailable === 'boolean') setIsAvailable(data.isAvailable); })
        .catch(() => { });
    }
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
      Alert.alert('Error', e.message || 'Failed to update availability status.');
    } finally {
      setAvailLoading(false);
    }
  }

  async function handlePhotoUpload() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      try {
        setPhotoLoading(true);
        await uploadPhoto(result.assets[0]);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        Alert.alert('Upload failed', e.message || 'Please try again.');
      } finally {
        setPhotoLoading(false);
      }
    }
  }

  async function onSaveProfile(data) {
    try {
      setSaving(true);
      await updateUser({
        full_name: data.full_name.trim(),
        phone_number: data.phone_number.trim() || null,
        bio: data.bio.trim() || null,
        specialization: data.specialization || null,
        experience_years: parseInt(data.experience_years) || 0,
      });
      setEditOpen(false);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Update failed', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onSavePassword(data) {
    try {
      setPwdSaving(true);
      await userApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Password changed successfully.');
      setPwdOpen(false);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to change password.');
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleLogout() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/(auth)/login');
  }

  const accountItems = [
    { icon: 'person-outline', label: t.editProfile, onPress: () => setEditOpen(true) },
    { icon: 'lock-closed-outline', label: t.changePasswordTitle, onPress: () => setPwdOpen(true) },
    { icon: 'document-text-outline', label: t.certifications },
  ];

  const supportItems = [
    { icon: 'shield-checkmark-outline', label: t.privacy, onPress: () => setPrivacyOpen(true) },
    { icon: 'help-circle-outline', label: t.help, onPress: () => setHelpOpen(true) },
  ];

  const sortedLanguages = [...availableLanguages].sort((a, b) => {
    if (a.key === 'ar') return -1;
    if (b.key === 'ar') return 1;
    return 0;
  });

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 60 }}
      >
        <View style={styles.headerSimple}>
          <View style={styles.headerSimpleTop}>
            <StatusAvatar
              url={user?.profile_photo_url}
              size={76}
              isAvailable={isAvailable}
              onPhotoPress={handlePhotoUpload}
              showEditIcon={true}
            />
            <View style={styles.headerInfoSimple}>
              <Text style={[styles.profileNameLarge, { color: C.foreground }]}>{displayName}</Text>
              <Text style={[styles.profileEmailSmall, { color: C.textSecondary }]}>{user?.email}</Text>
              <Text style={[styles.profileSpecSmall, { color: C.textSecondary }]}>{user?.specialization || 'Lawyer'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.preferencesCard, { backgroundColor: C.card }]}>
          <View style={styles.prefRowItem}>
            <View style={styles.prefLeft}>
              <Ionicons name="notifications-outline" size={18} color={C.accent} />
              <Text style={[styles.prefLabel, { color: C.foreground }]}>{t.acceptCases}</Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleAvailabilityToggle}
              trackColor={{ false: '#e5e7eb', true: C.success + '55' }}
              thumbColor={isAvailable ? C.success : '#9ca3af'}
              ios_backgroundColor="#e5e7eb"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
          <View style={[styles.dividerFull, { backgroundColor: C.border }]} />
          <View style={styles.prefRowItem}>
            <View style={styles.prefLeft}>
              <Ionicons name="moon-outline" size={18} color={C.accent} />
              <Text style={[styles.prefLabel, { color: C.foreground }]}>{t.displayMode}</Text>
            </View>
            <View style={styles.themeToggleCompact}>
              {['light', 'dark'].map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => toggleTheme(mode)}
                  style={[
                    styles.themeIconPill,
                    themeMode === mode && { backgroundColor: C.accent }
                  ]}
                >
                  <Ionicons
                    name={mode === 'light' ? 'sunny' : 'moon'}
                    size={13}
                    color={themeMode === mode ? '#fff' : C.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.languagePillCard, { backgroundColor: C.card }]}>
          <View style={styles.pillScroll}>
            {sortedLanguages.map((lang) => {
              const active = language === lang.key;
              return (
                <Pressable
                  key={lang.key}
                  style={[
                    styles.langPillCompact,
                    { backgroundColor: C.muted },
                    active && { backgroundColor: C.accent }
                  ]}
                  onPress={() => changeLanguage(lang.key)}
                >
                  <Text style={[styles.langPillTextSmall, { color: C.foreground }, active && { color: '#fff' }]}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: C.mutedForeground }]}>{t.accountSettings}</Text>
          <View style={[styles.menuGroupCard, { backgroundColor: C.card }]}>
            {accountItems.map((item, i) => (
              <Pressable
                key={i}
                style={[styles.menuRowSimple, i < accountItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                onPress={item.onPress}
              >
                <Ionicons name={item.icon} size={20} color={C.accent} style={{ width: 24 }} />
                <Text style={[styles.menuLabelSimple, { color: C.foreground }]}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={C.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: C.mutedForeground }]}>{t.support}</Text>
          <View style={[styles.menuGroupCard, { backgroundColor: C.card }]}>
            {supportItems.map((item, i) => (
              <Pressable
                key={i}
                style={[styles.menuRowSimple, i < supportItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                onPress={item.onPress}
              >
                <Ionicons name={item.icon} size={20} color={C.accent} style={{ width: 24 }} />
                <Text style={[styles.menuLabelSimple, { color: C.foreground }]}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={C.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <Pressable
            style={({ pressed }) => [styles.signOutBtnRed, { borderColor: C.destructive }, pressed && { opacity: 0.7 }]}
            onPress={handleLogout}
          >
            <Text style={[styles.signOutTextRed, { color: C.destructive }]}>{t.signOut}</Text>
          </Pressable>
        </View>
        <Text style={[styles.version, { color: C.mutedForeground }]}>LawyerUp v1.0.0</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <LawyerEditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        C={C}
        t={t}
        styles={styles}
        saving={saving}
        onSave={onSaveProfile}
        user={user}
        isDark={themeMode === 'dark'}
        insets={insets}
      />

      <ChangePasswordModal
        visible={pwdOpen}
        onClose={() => setPwdOpen(false)}
        C={C}
        t={t}
        styles={styles}
        pwdSaving={pwdSaving}
        onSave={onSavePassword}
        isDark={themeMode === 'dark'}
        insets={insets}
      />

      <Modal visible={privacyOpen} animationType="slide" transparent onRequestClose={() => setPrivacyOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPrivacyOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.privacy}</Text>
            {[
              { icon: 'lock-closed-outline', title: 'Data Encryption', desc: 'All your personal data is encrypted in transit and at rest.' },
              { icon: 'eye-off-outline', title: 'Data Privacy', desc: 'We never sell your personal information to third parties.' },
              { icon: 'shield-checkmark-outline', title: 'Account Security', desc: 'Use a strong password and keep your credentials private.' },
            ].map((item, i) => (
              <View key={i} style={[styles.actionCard, { backgroundColor: '#1A1A1A' }]}>
                <View style={styles.infoIconBox}><Ionicons name={item.icon} size={18} color={C.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: C.foreground }]}>{item.title}</Text>
                  <Text style={[styles.infoDesc, { color: C.textSecondary }]}>{item.desc}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={C.accent} />
              </View>
            ))}
            <Pressable style={styles.btnCloseModern} onPress={() => setPrivacyOpen(false)}>
              <Text style={[styles.btnCloseText, { color: C.foreground }]}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={helpOpen} animationType="slide" transparent onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setHelpOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.help}</Text>
            {[
              { icon: 'chatbubble-ellipses-outline', title: 'Contact Support', desc: 'Reach us at support@lawyerup.tn for any issues.' },
              { icon: 'help-circle-outline', title: 'FAQ', desc: 'Find answers to common questions in our Help Center.' },
              { icon: 'document-text-outline', title: 'Terms of Service', desc: 'Review our terms at lawyerup.tn/terms.' },
              { icon: 'information-circle-outline', title: 'App Version', desc: 'LawyerUp v1.0.0 — Keep the app updated for the best experience.' },
            ].map((item, i) => (
              <View key={i} style={[styles.actionCard, { backgroundColor: '#1A1A1A' }]}>
                <View style={styles.infoIconBox}><Ionicons name={item.icon} size={18} color={C.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: C.foreground }]}>{item.title}</Text>
                  <Text style={[styles.infoDesc, { color: C.textSecondary }]}>{item.desc}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={C.accent} />
              </View>
            ))}
            <Pressable style={styles.btnCloseModern} onPress={() => setHelpOpen(false)}>
              <Text style={[styles.btnCloseText, { color: C.foreground }]}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSimple: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 20 },
  headerSimpleTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  avatarWrapperSimple: { position: 'relative' },
  avatarRing: { padding: 3, borderRadius: 100, borderWidth: 2 },
  statusDotOverlay: { position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
  avatarEditSmall: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderColor: '#fff', borderWidth: 2 },
  headerInfoSimple: { flex: 1 },
  profileNameLarge: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  profileEmailSmall: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  profileSpecSmall: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },

  // Preferences Card
  preferencesCard: { marginHorizontal: 20, borderRadius: 24, padding: 4, marginBottom: 20, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  prefRowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  prefLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  dividerFull: { height: 1, marginHorizontal: 20, opacity: 0.6 },
  themeToggleCompact: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 20, padding: 2 },
  themeIconPill: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },

  // Language...
  languagePillCard: { marginHorizontal: 20, borderRadius: 20, padding: 12, marginBottom: 24 },
  pillScroll: { flexDirection: 'row', gap: 8 },
  langPillCompact: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  langPillTextSmall: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Grouped Menu
  menuSection: { marginBottom: 20 },
  menuSectionTitle: { marginHorizontal: 24, fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', marginBottom: 8 },
  menuGroupCard: { marginHorizontal: 20, borderRadius: 20, overflow: 'hidden' },
  menuRowSimple: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuLabelSimple: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },

  signOutBtnRed: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  signOutTextRed: { fontSize: 15, fontFamily: 'Inter_700Bold' },

  version: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 24, marginBottom: 40 },

  // Modal Aesthetics
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, opacity: 0.6 },
  // Glassmorphism Inputs
  glassInputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(212, 175, 55, 0.1)', marginBottom: 20, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.03)' },
  glassInputFocused: { borderColor: '#D4AF37', backgroundColor: 'transparent' },
  inputIcon: { marginRight: 12 },
  glassInput: { flex: 1, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular' },
  glassTextAreaWrapper: { alignItems: 'flex-start', paddingVertical: 4 },
  glassTextArea: { height: 100, textAlignVertical: 'top' },

  // Chips
  chipScroll: { marginBottom: 20 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)', marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Pwd Security
  pwdStrengthContainer: { marginBottom: 20, gap: 6 },
  pwdBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  pwdBarFill: { height: '100%', borderRadius: 2 },
  pwdText: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },

  sheetActionsFull: { flexDirection: 'row', gap: 12, marginTop: 12, paddingHorizontal: 4 },
  btnGhostGold: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.4)', alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  btnPrimaryWrapper: { flex: 2, borderRadius: 12, overflow: 'hidden' },
  btnPrimaryGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, marginBottom: 10 },
  infoIconBox: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  infoTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  infoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', opacity: 0.6 },

  btnCloseModern: { marginTop: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnCloseText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
