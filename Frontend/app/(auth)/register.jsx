import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform, Keyboard, TouchableWithoutFeedback, Image, Modal, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/constants/useTheme';
import { useLanguage } from '@/contexts/LanguageContext';
import { SPECIALIZATION_OPTIONS } from '@/constants/mockData';

export default function RegisterPage() {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [diploma, setDiploma] = useState(null);
  const [specialization, setSpecialization] = useState('Family');
  const [experienceYears, setExperienceYears] = useState('');
  const [specPickerOpen, setSpecPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function pickDiploma() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setDiploma(result.assets[0]);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  }

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (role === 'lawyer' && !diploma) {
      Alert.alert('Error', 'Please upload your diploma to register as a lawyer');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setLoading(true);
    try {
      const registeredUser = await register(name, email, password, role, phone, diploma, specialization, null, parseInt(experienceYears) || 0);
      const userRole = registeredUser.role;
      if (userRole === 'lawyer') {
        Alert.alert('Registration Submitted', 'Your account is pending admin verification. You will be able to log in once approved.');
        router.replace('/(auth)/login');
      } else {
        router.replace('/(user-tabs)');
      }
    } catch (e) {
      Alert.alert('Registration Failed', e.message || 'Please try again');
      setLoading(false);
    }
  }

  return (
    <View style={[{ flex: 1, backgroundColor: C.background }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoIcon, { backgroundColor: C.muted }]}>
              <Ionicons name="scale" size={28} color={C.accent} />
            </View>
            <Text style={[styles.title, { color: C.tint }]}>{t.createAccount}</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>{t.joinSubtitle}</Text>
          </View>

          <Text style={[styles.label, { color: C.textSecondary }]}>{t.selectRole}</Text>
          <View style={styles.roleRow}>
            {([{ key: 'user', label: t.individual, icon: 'person' }, { key: 'lawyer', label: t.lawyer, icon: 'briefcase' }]).map(r => (
              <Pressable
                key={r.key}
                style={[styles.roleCard, { backgroundColor: C.card, borderColor: C.border }, role === r.key && { borderColor: C.accent, backgroundColor: C.accentLight }]}
                onPress={() => {
                  setRole(r.key);
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
              >
                <Ionicons name={r.icon} size={22} color={role === r.key ? C.accent : C.mutedForeground} />
                <Text style={[styles.roleLabel, { color: C.textSecondary }, role === r.key && { color: C.accent, fontFamily: 'Inter_600SemiBold' }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          {role === 'lawyer' && (
            <View style={[styles.infoBox, { backgroundColor: C.accentLight }]}>
              <Ionicons name="information-circle" size={18} color={C.accent} />
              <Text style={[styles.infoText, { color: C.textSecondary }]}>{t.lawyerVerificationNote}</Text>
            </View>
          )}

          {role === 'lawyer' && (
            <View style={styles.lawyerFields}>
              <Text style={[styles.label, { color: C.textSecondary }]}>Specialization</Text>
              <Pressable
                style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: C.border }]}
                onPress={() => setSpecPickerOpen(true)}
              >
                <Ionicons name="briefcase-outline" size={18} color={C.accent} />
                <Text style={[styles.pickerBtnText, { color: C.foreground }]}>{specialization}</Text>
                <Feather name="chevron-down" size={16} color={C.mutedForeground} />
              </Pressable>

              <Text style={[styles.label, { color: C.textSecondary, marginTop: 16 }]}>Years of Experience</Text>
              <View style={[styles.inputWrapper, { backgroundColor: C.inputBg, borderColor: C.border }]}>
                <Feather name="award" size={18} color={C.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: C.foreground }]}
                  placeholder="e.g. 5"
                  placeholderTextColor={C.mutedForeground}
                  value={experienceYears}
                  onChangeText={setExperienceYears}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}

          {role === 'lawyer' && (
            <View style={styles.diplomaSection}>
              <Text style={[styles.label, { color: C.textSecondary }]}>{t.uploadDiploma}</Text>
              {!diploma ? (
                <Pressable
                  style={({ pressed }) => [styles.uploadBtn, { backgroundColor: C.card, borderColor: C.border }, pressed && { opacity: 0.7 }]}
                  onPress={pickDiploma}
                >
                  <Ionicons name="cloud-upload-outline" size={32} color={C.accent} />
                  <Text style={[styles.uploadText, { color: C.textSecondary }]}>{t.tapToUpload}</Text>
                  <Text style={[styles.uploadHint, { color: C.mutedForeground }]}>{t.requiredForVerification}</Text>
                </Pressable>
              ) : (
                <View style={[styles.diplomaPreview, { backgroundColor: C.card, borderColor: C.accent }]}>
                  <Image source={{ uri: diploma.uri }} style={styles.diplomaImage} />
                  <View style={styles.diplomaInfo}>
                    <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                    <Text style={[styles.diplomaText, { color: C.accent }]}>{t.diplomaUploaded}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.removeBtn, { backgroundColor: C.destructive }, pressed && { opacity: 0.7 }]}
                    onPress={() => setDiploma(null)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.removeBtnText}>{t.remove}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            {[
              { icon: 'user', placeholder: t.fullName, value: name, setter: setName, kb: 'default' },
              { icon: 'mail', placeholder: t.emailAddress, value: email, setter: setEmail, kb: 'email-address' },
              { icon: 'phone', placeholder: t.phoneNumber, value: phone, setter: setPhone, kb: 'phone-pad' },
            ].map((f, i) => (
              <View key={i} style={[styles.inputWrapper, { backgroundColor: C.inputBg, borderColor: C.border }]}>
                <Feather name={f.icon} size={18} color={C.mutedForeground} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: C.foreground }]} placeholder={f.placeholder} placeholderTextColor={C.mutedForeground} value={f.value} onChangeText={f.setter} keyboardType={f.kb} autoCapitalize={f.kb === 'email-address' ? 'none' : 'words'} />
              </View>
            ))}
            <View style={[styles.inputWrapper, { backgroundColor: C.inputBg, borderColor: C.border }]}>
              <Feather name="lock" size={18} color={C.mutedForeground} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: C.foreground }]} placeholder={t.password} placeholderTextColor={C.mutedForeground} value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: C.inputBg, borderColor: C.border }]}>
              <Feather name="lock" size={18} color={C.mutedForeground} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: C.foreground }]} placeholder={t.confirmPassword} placeholderTextColor={C.mutedForeground} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.registerBtn, { backgroundColor: C.tint }, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={C.primaryForeground} /> : <Text style={[styles.registerBtnText, { color: C.primaryForeground }]}>{t.createAccount}</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: C.textSecondary }]}>{t.alreadyHaveAccount}</Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Text style={[styles.footerLink, { color: C.accent }]}>{t.signIn}</Text>
            </Pressable>
          </View>
        </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      {/* Specialization Picker Modal */}
      <Modal visible={specPickerOpen} transparent animationType="fade" onRequestClose={() => setSpecPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSpecPickerOpen(false)}>
          <View style={[styles.modalCard]}>
            <Text style={[styles.modalTitle]}>Select Specialization</Text>
            <FlatList
              data={SPECIALIZATION_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.specOption, item === specialization && styles.specOptionActive]}
                  onPress={() => { setSpecialization(item); setSpecPickerOpen(false); }}
                >
                  <Text style={[styles.specOptionText, item === specialization && styles.specOptionTextActive]}>{item}</Text>
                  {item === specialization && <Ionicons name="checkmark" size={16} color="#1e3a5f" />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 16 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logoIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, gap: 6 },
  roleLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  diplomaSection: { marginBottom: 20 },
  uploadBtn: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 14, padding: 32, alignItems: 'center', gap: 8 },
  uploadText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  uploadHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  diplomaPreview: { borderWidth: 2, borderRadius: 14, padding: 12, gap: 12 },
  diplomaImage: { width: '100%', height: 200, borderRadius: 10 },
  diplomaInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diplomaText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 8 },
  removeBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputGroup: { gap: 12, marginBottom: 24 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1 },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  registerBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  registerBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 20 },
  footerText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  lawyerFields: { marginBottom: 16 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 4 },
  pickerBtnText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxHeight: 420 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#1e3a5f', marginBottom: 14, textAlign: 'center' },
  specOption: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  specOptionActive: { backgroundColor: '#e8f0fe' },
  specOptionText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#333' },
  specOptionTextActive: { fontFamily: 'Inter_600SemiBold', color: '#1e3a5f' },
});
