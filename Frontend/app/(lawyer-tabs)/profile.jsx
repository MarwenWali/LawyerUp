import React, { useState, useEffect, memo, useCallback } from 'react';
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

// ── Memoized Components to prevent cursor jumping ─────────────────────────
const MemoizedGlassInput = memo(({ 
  icon, 
  value, 
  onChangeText, 
  placeholder, 
  secureTextEntry, 
  keyboardType, 
  onFocus, 
  onBlur, 
  isFocused, 
  multiline,
  styles,
  C
}) => (
  <View style={[styles.glassInputWrapper, isFocused && styles.glassInputFocused]}>
    {icon && <Feather name={icon} size={18} color={isFocused ? C.accent : 'rgba(212,175,55,0.4)'} style={styles.inputIcon} />}
    <TextInput
      style={[styles.glassInput, multiline && styles.glassTextArea, { color: C.foreground }]}
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={C.mutedForeground}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      multiline={multiline}
      cursorColor={C.accent}
      selectionColor={C.accent + '44'}
    />
  </View>
));

export default function LawyerProfilePage() {
  const { user, logout, updateUser, uploadPhoto } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { themeMode, toggleTheme } = useThemeContext();
  const { language, t, changeLanguage, availableLanguages } = useLanguage();
  const displayName = user?.name || 'Lawyer';
  const initials = displayName.replace('Maître ', '').split(' ').map(n => n[0]).join('').slice(0, 2);

  // ── Edit modal state ──────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftSpec, setDraftSpec] = useState('Family');
  const [draftExp, setDraftExp] = useState('');
  const [specPickerOpen, setSpecPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Password change state ───────────────────────────────────────────────
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // ── Photo upload state ──────────────────────────────────────────────────
  const [photoLoading, setPhotoLoading] = useState(false);

  // ── Info modals ───────────────────────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // ── Focus state for inputs ──────────────────────────────────────────────
  const [focusedField, setFocusedField] = useState(null);

  // ── Availability state ─────────────────────────────────────────────────
  const [isAvailable, setIsAvailable] = useState(true);
  const [availLoading, setAvailLoading] = useState(false);

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

  async function handlePwdChange() {
    if (!currentPwd || !newPwd || !confirmPwd) { Alert.alert('', 'All fields are required.'); return; }
    if (newPwd !== confirmPwd) { Alert.alert('', 'New passwords do not match.'); return; }
    if (newPwd.length < 6) { Alert.alert('', 'Password must be at least 6 characters.'); return; }
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
    setDraftBio(user?.bio || '');
    setDraftSpec(user?.specialization || 'Family');
    setDraftExp(user?.experience_years != null ? String(user.experience_years) : '');
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!draftName.trim()) {
      Alert.alert('', 'Full name cannot be empty.');
      return;
    }
    try {
      setSaving(true);
      await updateUser({
        full_name: draftName.trim(),
        phone_number: draftPhone.trim() || null,
        bio: draftBio.trim() || null,
        specialization: draftSpec || null,
        experience_years: parseInt(draftExp) || 0,
      });
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

  const accountItems = [
    { icon: 'person-outline', label: t.editProfile, onPress: openEdit },
    { icon: 'lock-closed-outline', label: t.changePasswordTitle, onPress: () => setPwdOpen(true) },
    { icon: 'document-text-outline', label: t.certifications },
  ];

  const supportItems = [
    { icon: 'shield-checkmark-outline', label: t.privacy, onPress: () => setPrivacyOpen(true) },
    { icon: 'help-circle-outline', label: t.help, onPress: () => setHelpOpen(true) },
  ];

  // Ensure Tounsi is first
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
        {/* ── 1. Header with Status Dot ── */}
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

        {/* ── 2. Unified Preferences Row ── */}
        <View style={[styles.preferencesCard, { backgroundColor: C.card }]}>
          <View style={styles.prefRowItem}>
            <View style={styles.prefLeft}>
              <Ionicons name="notifications-outline" size={18} color={C.accent} />
              <Text style={[styles.prefLabel, { color: C.foreground }]}>Accept Cases</Text>
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
              <Text style={[styles.prefLabel, { color: C.foreground }]}>Display Mode</Text>
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

        {/* ── 3. Horizontal Language Picker ── */}
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

        {/* ── 4. Grouped Menu ── */}
        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: C.mutedForeground }]}>Account Settings</Text>
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
          <Text style={[styles.menuSectionTitle, { color: C.mutedForeground }]}>Support</Text>
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

        {/* ── Sign Out ── */}
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

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => { setEditOpen(false); setFocusedField(null); }} />
          <View style={[styles.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.editProfileTitle}</Text>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.fullName}</Text>
              <MemoizedGlassInput
                icon="user"
                value={draftName}
                onChangeText={setDraftName}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                isFocused={focusedField === 'name'}
                placeholder="Your full name"
                styles={styles}
                C={C}
              />

              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.phoneNumber}</Text>
              <MemoizedGlassInput
                icon="phone"
                value={draftPhone}
                onChangeText={setDraftPhone}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
                isFocused={focusedField === 'phone'}
                placeholder="+216 XX XXX XXX"
                keyboardType="phone-pad"
                styles={styles}
                C={C}
              />

              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.specializationLabel}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {SPECIALIZATION_OPTIONS.map(item => (
                  <Pressable
                    key={item}
                    onPress={() => setDraftSpec(item)}
                    style={[styles.chip, draftSpec === item && { backgroundColor: C.accent, borderColor: C.accent }]}
                  >
                    <Text style={[styles.chipText, { color: C.foreground }, draftSpec === item && { color: '#fff' }]}>{item}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.yearsExpLabel}</Text>
              <MemoizedGlassInput
                icon="award"
                value={draftExp}
                onChangeText={setDraftExp}
                onFocus={() => setFocusedField('exp')}
                onBlur={() => setFocusedField(null)}
                isFocused={focusedField === 'exp'}
                placeholder="Years of experience"
                keyboardType="number-pad"
                styles={styles}
                C={C}
              />

              <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.bioLabel}</Text>
              <MemoizedGlassInput
                value={draftBio}
                onChangeText={setDraftBio}
                onFocus={() => setFocusedField('bio')}
                onBlur={() => setFocusedField(null)}
                isFocused={focusedField === 'bio'}
                placeholder="About yourself..."
                multiline
                styles={styles}
                C={C}
              />

              <View style={styles.sheetActions}>
                <Pressable style={styles.btnGhostGold} onPress={() => setEditOpen(false)}>
                  <Text style={[styles.btnGhostText, { color: C.accent }]}>{t.cancel}</Text>
                </Pressable>
                <Pressable
                  onPress={saveEdit}
                  disabled={saving}
                  style={({ pressed }) => [styles.btnPrimaryWrapper, saving && { opacity: 0.7 }, pressed && { opacity: 0.9 }]}
                >
                  <LinearGradient
                    colors={['#D4AF37', '#FFD700']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btnPrimaryGradient}
                  >
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.btnPrimaryText}>{t.saveChanges}</Text>}
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
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
            {/* Action Cards for Privacy */}
            {[
              { icon: 'lock-closed-outline', title: 'Data Encryption', desc: 'All your personal data is encrypted in transit and at rest.' },
              { icon: 'eye-off-outline', title: 'Data Privacy', desc: 'We never sell your personal information to third parties.' },
              { icon: 'shield-checkmark-outline', title: 'Account Security', desc: 'Use a strong password and keep your credentials private.' },
            ].map((item, i) => (
              <View key={i} style={[styles.actionCard, { backgroundColor: '#1A1A1A' }]}>
                <View style={styles.infoIconBox}>
                  <Ionicons name={item.icon} size={18} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: C.foreground }]}>{item.title}</Text>
                  <Text style={[styles.infoDesc, { color: C.textSecondary }]}>{item.desc}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={C.accent} />
              </View>
            ))}
            <Pressable 
              style={({ pressed }) => [styles.btnCloseModern, { borderColor: C.border }, pressed && { opacity: 0.7 }]} 
              onPress={() => setPrivacyOpen(false)}
            >
              <Text style={[styles.btnCloseText, { color: C.foreground }]}>{t.close}</Text>
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
            {/* Action Cards for Help */}
            {[
              { icon: 'chatbubble-ellipses-outline', title: 'Contact Support', desc: 'Reach us at support@lawyerup.tn for any issues.' },
              { icon: 'help-circle-outline', title: 'FAQ', desc: 'Find answers to common questions in our Help Center.' },
              { icon: 'document-text-outline', title: 'Terms of Service', desc: 'Review our terms at lawyerup.tn/terms.' },
              { icon: 'information-circle-outline', title: 'App Version', desc: 'LawyerUp v1.0.0 — Keep the app updated for the best experience.' },
            ].map((item, i) => (
              <View key={i} style={[styles.actionCard, { backgroundColor: '#1A1A1A' }]}>
                <View style={styles.infoIconBox}>
                  <Ionicons name={item.icon} size={18} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: C.foreground }]}>{item.title}</Text>
                  <Text style={[styles.infoDesc, { color: C.textSecondary }]}>{item.desc}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={C.accent} />
              </View>
            ))}
            <Pressable 
              style={({ pressed }) => [styles.btnCloseModern, { borderColor: C.border }, pressed && { opacity: 0.7 }]} 
              onPress={() => setHelpOpen(false)}
            >
              <Text style={[styles.btnCloseText, { color: C.foreground }]}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Password Change Modal ── */}
      <Modal visible={pwdOpen} animationType="slide" transparent onRequestClose={() => setPwdOpen(false)}>
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => { setPwdOpen(false); setFocusedField(null); }} />
          <View style={[styles.sheet, { backgroundColor: C.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.changePasswordTitle}</Text>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.currentPasswordLabel}</Text>
            <MemoizedGlassInput
              icon="lock"
              value={currentPwd}
              onChangeText={setCurrentPwd}
              onFocus={() => setFocusedField('curPwd')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'curPwd'}
              secureTextEntry
              styles={styles}
              C={C}
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.newPasswordLabel}</Text>
            <MemoizedGlassInput
              icon="shield"
              value={newPwd}
              onChangeText={setNewPwd}
              onFocus={() => setFocusedField('newPwd')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'newPwd'}
              secureTextEntry
              styles={styles}
              C={C}
            />
            
            <View style={styles.pwdStrengthContainer}>
              <View style={[styles.pwdBar, { backgroundColor: C.border }]}>
                <View style={[
                  styles.pwdBarFill, 
                  { 
                    width: `${Math.min(100, (newPwd.length / 10) * 100)}%`,
                    backgroundColor: newPwd.length < 6 ? C.destructive : C.accent 
                  }
                ]} />
              </View>
              <Text style={[styles.pwdText, { color: C.textSecondary }]}>
                {newPwd.length < 6 ? 'Too short' : 'Secure'}
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.confirmNewPasswordLabel}</Text>
            <MemoizedGlassInput
              icon="check-circle"
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              onFocus={() => setFocusedField('confPwd')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'confPwd'}
              secureTextEntry
              styles={styles}
              C={C}
            />

            <View style={styles.sheetActions}>
              <Pressable style={styles.btnGhostGold} onPress={() => setPwdOpen(false)}>
                <Text style={[styles.btnGhostText, { color: C.accent }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={handlePwdChange}
                disabled={pwdSaving}
                style={({ pressed }) => [styles.btnPrimaryWrapper, pwdSaving && { opacity: 0.7 }, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={['#D4AF37', '#FFD700']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnPrimaryGradient}
                >
                  {pwdSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>{t.updatePasswordBtn}</Text>}
                </LinearGradient>
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
  glassInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(212, 175, 55, 0.1)', marginBottom: 20, paddingHorizontal: 16 },
  glassInputFocused: { borderColor: '#D4AF37', elevation: 4, shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8 },
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

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
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
