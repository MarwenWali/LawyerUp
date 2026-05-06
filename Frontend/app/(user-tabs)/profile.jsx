import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { userApi } from '@/services/api';
import ProfileImage from '@/components/ProfileImage';

export default function ProfilePage() {
  const { user, logout, updateUser, uploadPhoto } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { themeMode, toggleTheme } = useThemeContext();
  const { language, t, changeLanguage, availableLanguages } = useLanguage();
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U';

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Password change state ─────────────────────────────────────────────────
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // ── Photo upload state ────────────────────────────────────────────────────
  const [photoLoading, setPhotoLoading] = useState(false);

  // ── Info modals ───────────────────────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

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

  async function handlePwdChange() {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Alert.alert('', 'All fields are required.');
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('', 'New passwords do not match.');
      return;
    }
    if (newPwd.length < 6) {
      Alert.alert('', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setPwdSaving(true);
      await userApi.changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Password changed successfully.');
      setPwdOpen(false);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to change password.');
    } finally {
      setPwdSaving(false);
    }
  }

  function openEdit() {
    setDraftName(user?.name || '');
    setDraftPhone(user?.phone_number || '');
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!draftName.trim()) {
      Alert.alert('', 'Full name cannot be empty.');
      return;
    }
    try {
      setSaving(true);
      await updateUser({ full_name: draftName.trim(), phone_number: draftPhone.trim() || null });
      setEditOpen(false);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Update failed', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/(auth)/login');
  }

  const menuItems = [
    { icon: 'person-outline', label: t.personalInfo, onPress: openEdit },
    { icon: 'lock-closed-outline', label: t.changePasswordTitle, onPress: () => setPwdOpen(true) },
    { icon: 'shield-checkmark-outline', label: t.privacy, onPress: () => setPrivacyOpen(true) },
    { icon: 'help-circle-outline', label: t.help, onPress: () => setHelpOpen(true) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}>
        <View style={styles.profileHeader}>
          <Pressable onPress={handlePhotoUpload} style={styles.avatarWrapper}>
            <ProfileImage url={user?.profile_photo_url} size={80} />
            {photoLoading
              ? <ActivityIndicator style={styles.avatarEdit} color={C.accent} />
              : <View style={[styles.avatarEdit, { backgroundColor: C.accent }]}><Feather name="camera" size={14} color="#fff" /></View>
            }
          </Pressable>
          <Text style={[styles.profileName, { color: C.foreground }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: C.textSecondary }]}>{user?.email}</Text>
          {user?.phone_number ? (
            <Text style={[styles.profilePhone, { color: C.textSecondary }]}>{user.phone_number}</Text>
          ) : null}
          <View style={[styles.roleBadge, { backgroundColor: C.accentLight }]}>
            <Text style={[styles.roleBadgeText, { color: C.accent }]}>{t.userAccount}</Text>
          </View>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: C.card }]}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>{t.theme}</Text>
          <View style={styles.themeRow}>
            {[{ key: 'light', icon: 'sunny-outline', label: t.light }, { key: 'dark', icon: 'moon-outline', label: t.dark }].map((mode) => (
              <Pressable
                key={mode.key}
                style={[styles.themeOption, { backgroundColor: C.muted, borderColor: C.border }, themeMode === mode.key && { backgroundColor: C.accentLight, borderColor: C.accent }]}
                onPress={() => {
                  toggleTheme(mode.key);
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
              >
                <Ionicons name={mode.icon} size={20} color={themeMode === mode.key ? C.accent : C.mutedForeground} />
                <Text style={[styles.themeLabel, { color: themeMode === mode.key ? C.accent : C.textSecondary }]}>{mode.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: C.card }]}>
          <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>{t.language}</Text>
          <View style={styles.languageList}>
            {availableLanguages.map((lang, i) => (
              <Pressable
                key={lang.key}
                style={[styles.languageRow, i < availableLanguages.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                onPress={() => {
                  changeLanguage(lang.key);
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.languageLabel, { color: C.foreground }]}>{lang.label}</Text>
                {language === lang.key && <Ionicons name="checkmark-circle" size={22} color={C.accent} />}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.menuCard, { backgroundColor: C.card }]}>
          {menuItems.map((item, i) => (
            <Pressable
              key={i}
              style={[styles.menuRow, i < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
              onPress={item.onPress}
            >
              <Ionicons name={item.icon} size={22} color={C.textSecondary} />
              <Text style={[styles.menuLabel, { color: C.foreground }]}>{item.label}</Text>
              <Feather name="chevron-right" size={18} color={C.mutedForeground} />
            </Pressable>
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.logoutBtn, { backgroundColor: C.card, borderColor: C.destructive }, pressed && { opacity: 0.85 }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={C.destructive} />
          <Text style={[styles.logoutText, { color: C.destructive }]}>{t.signOut}</Text>
        </Pressable>

        <Text style={[styles.version, { color: C.mutedForeground }]}>LawyerUp v1.0.0</Text>
      </ScrollView>

      {/* ── Edit Personal Info Modal ── */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.personalInfoModalTitle}</Text>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.fullName}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your full name"
              placeholderTextColor={C.mutedForeground}
              autoCapitalize="words"
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.phoneNumber}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
              value={draftPhone}
              onChangeText={setDraftPhone}
              placeholder="+216 XX XXX XXX"
              placeholderTextColor={C.mutedForeground}
              keyboardType="phone-pad"
            />

            <View style={styles.sheetActions}>
              <Pressable style={[styles.btnOutline, { borderColor: C.border }]} onPress={() => setEditOpen(false)}>
                <Text style={[styles.btnOutlineText, { color: C.foreground }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, { backgroundColor: C.accent }, saving && { opacity: 0.7 }]}
                onPress={saveEdit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnPrimaryText}>{t.saveChanges}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ── Privacy & Security Modal ── */}
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
              { icon: 'trash-outline', title: 'Delete Account', desc: 'Contact support to permanently delete your account and data.' },
            ].map((item, i) => (
              <View key={i} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                <View style={[styles.infoIconBox, { backgroundColor: C.accentLight }]}>
                  <Ionicons name={item.icon} size={20} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: C.foreground }]}>{item.title}</Text>
                  <Text style={[styles.infoDesc, { color: C.textSecondary }]}>{item.desc}</Text>
                </View>
              </View>
            ))}
            <Pressable style={[styles.btnPrimary, { backgroundColor: C.accent, marginTop: 20, flex: 0, alignSelf: 'stretch' }]} onPress={() => setPrivacyOpen(false)}>
              <Text style={styles.btnPrimaryText}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Help & Support Modal ── */}
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
              <View key={i} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                <View style={[styles.infoIconBox, { backgroundColor: C.accentLight }]}>
                  <Ionicons name={item.icon} size={20} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: C.foreground }]}>{item.title}</Text>
                  <Text style={[styles.infoDesc, { color: C.textSecondary }]}>{item.desc}</Text>
                </View>
              </View>
            ))}
            <Pressable style={[styles.btnPrimary, { backgroundColor: C.accent, marginTop: 20, flex: 0, alignSelf: 'stretch' }]} onPress={() => setHelpOpen(false)}>
              <Text style={styles.btnPrimaryText}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Password Change Modal ── */}
      <Modal visible={pwdOpen} animationType="slide" transparent onRequestClose={() => setPwdOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPwdOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.changePasswordTitle}</Text>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.currentPasswordLabel}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
              value={currentPwd} onChangeText={setCurrentPwd}
              placeholder="Enter current password" placeholderTextColor={C.mutedForeground}
              secureTextEntry
            />
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.newPasswordLabel}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
              value={newPwd} onChangeText={setNewPwd}
              placeholder="min. 6 characters" placeholderTextColor={C.mutedForeground}
              secureTextEntry
            />
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.confirmNewPasswordLabel}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
              value={confirmPwd} onChangeText={setConfirmPwd}
              placeholder="Repeat new password" placeholderTextColor={C.mutedForeground}
              secureTextEntry
            />
            <View style={styles.sheetActions}>
              <Pressable style={[styles.btnOutline, { borderColor: C.border }]} onPress={() => setPwdOpen(false)}>
                <Text style={[styles.btnOutlineText, { color: C.foreground }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, { backgroundColor: C.accent }, pwdSaving && { opacity: 0.7 }]}
                onPress={handlePwdChange} disabled={pwdSaving}
              >
                {pwdSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>{t.updatePasswordBtn}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeader: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarLargeText: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  profileEmail: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 },
  profilePhone: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  roleBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  settingsCard: { marginHorizontal: 20, borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeOption: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, gap: 6 },
  themeLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  languageList: { gap: 0 },
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  languageLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  menuCard: { marginHorizontal: 20, borderRadius: 14, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, marginBottom: 20 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  version: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  infoIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  infoTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 3 },
  infoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnOutline: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  btnOutlineText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  btnPrimary: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
  btnPrimaryText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
