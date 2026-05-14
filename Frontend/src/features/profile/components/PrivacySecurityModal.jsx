import React from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { glassmorphism as styles } from '../../../theme/glassmorphism';

export default function PrivacyModal({ 
  visible, 
  onClose, 
  C, 
  t, 
  isDark,
  insets 
}) {
  const privacyItems = [
    { icon: 'lock-closed-outline', title: t('dataEncryptionTitle'), desc: t('dataEncryptionDesc') },
    { icon: 'eye-off-outline', title: t('dataPrivacyTitle'), desc: t('dataPrivacyDesc') },
    { icon: 'shield-checkmark-outline', title: t('accountSecurityTitle'), desc: t('accountSecurityDesc') },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.card, paddingBottom: (insets?.bottom || 0) + 24 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
          <Text style={[styles.sheetTitle, { color: C.foreground }]}>{t('privacy')}</Text>
          {privacyItems.map((item, i) => (
            <View key={i} style={[styles.actionCard, { backgroundColor: isDark ? '#1A1A1A' : C.secondary }]}>
              <View style={styles.infoIconBoxSimple}><Ionicons name={item.icon} size={18} color={C.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitleSimple, { color: C.foreground }]}>{item.title}</Text>
                <Text style={[styles.infoDescSimple, { color: C.textSecondary }]}>{item.desc}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={C.accent} />
            </View>
          ))}
          <Pressable style={styles.btnCloseModern} onPress={onClose}>
            <Text style={[styles.btnCloseText, { color: C.foreground }]}>{t('close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
