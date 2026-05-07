import React, { useState, useRef, memo } from 'react';
import { 
  View, Text, Modal, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, TextInput, ScrollView 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const MemoizedGlassInput = memo(({ 
  icon, 
  defaultValue, 
  onChangeText, 
  placeholder, 
  secureTextEntry, 
  onFocus, 
  onBlur, 
  isFocused, 
  styles,
  C,
  inputKey,
  isDark
}) => (
  <View style={[styles.glassInputWrapper, isFocused && styles.glassInputFocused]}>
    {icon && <Feather name={icon} size={18} color={isFocused ? C.accent : 'rgba(212,175,55,0.4)'} style={styles.inputIcon} />}
    <TextInput
      key={inputKey}
      style={[styles.glassInput, { color: isDark ? '#FFF' : '#000' }]}
      defaultValue={defaultValue}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={C.mutedForeground}
      secureTextEntry={secureTextEntry}
      cursorColor={C.accent}
      selectionColor={C.accent + '44'}
      underlineColorAndroid="transparent"
    />
  </View>
));

export default function PersonalInformationModal({ 
  visible, 
  onClose, 
  C, 
  t, 
  styles, 
  saving, 
  onSave,
  user,
  isDark,
  insets 
}) {
  const nameRef = useRef(user?.name || '');
  const phoneRef = useRef(user?.phone_number || '');
  const [focusedField, setFocusedField] = useState(null);

  const handleSave = () => {
    onSave({
      full_name: nameRef.current,
      phone_number: phoneRef.current
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.modalOverlay} 
        behavior="padding"
      >
        <Pressable style={styles.modalBackdrop} onPress={() => { onClose(); setFocusedField(null); }} />
        <View style={[styles.sheet, { backgroundColor: C.card, maxHeight: '90%' }]}>
          <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
          <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t.personalInfoModalTitle}</Text>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: (insets?.bottom || 24) + 40 }}
          >
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Email Address</Text>
            <View style={[styles.glassInputWrapper, { opacity: 0.6, backgroundColor: isDark ? '#1E293B' : C.muted }]}>
              <Feather name="lock" size={18} color={C.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.glassInput, { color: isDark ? '#FFF' : '#000', opacity: 0.7 }]}
                value={user?.email}
                editable={false}
                underlineColorAndroid="transparent"
              />
            </View>

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.fullName}</Text>
            <MemoizedGlassInput
              inputKey="user-name-input"
              icon="user"
              defaultValue={nameRef.current}
              onChangeText={(v) => nameRef.current = v}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'name'}
              placeholder="Your full name"
              styles={styles}
              C={C}
              isDark={isDark}
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{t.phoneNumber}</Text>
            <MemoizedGlassInput
              inputKey="user-phone-input"
              icon="phone"
              defaultValue={phoneRef.current}
              onChangeText={(v) => phoneRef.current = v}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              isFocused={focusedField === 'phone'}
              placeholder="+216 XX XXX XXX"
              keyboardType="phone-pad"
              styles={styles}
              C={C}
              isDark={isDark}
            />

            <View style={styles.sheetActionsFull}>
              <Pressable style={styles.btnGhostGold} onPress={onClose}>
                <Text style={[styles.btnGhostText, { color: C.accent }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
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
  );
}
