import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, TextInput, ScrollView, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/useTheme';
import { userApi } from '@/services/api';
import { messagingApi } from '@/services/messagingApi';
import { router } from 'expo-router';

export default function CreateAppointmentModal({ visible, onClose, onSuccess }) {
  const C = useTheme();
  
  const [step, setStep] = useState(1); // 1: type, 2: details
  const [type, setType] = useState('lawyer'); // lawyer, court, other
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [lawyerId, setLawyerId] = useState(null);
  
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [lawyers, setLawyers] = useState([]);
  const [loadingLawyers, setLoadingLawyers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && type === 'lawyer' && lawyers.length === 0) {
      fetchLawyers();
    }
  }, [visible, type]);

  const fetchLawyers = async () => {
    setLoadingLawyers(true);
    try {
      const payload = await messagingApi.listConversations('lawyer_user');
      const conversations = Array.isArray(payload?.conversations) ? payload.conversations : [];
      const extractedLawyers = conversations
        .filter(c => c.other_participant?.role !== 'admin')
        .map(c => ({
          id: c.other_participant?.id,
          name: c.other_participant?.full_name || c.other_participant?.name || 'Unknown Lawyer'
        }));
      setLawyers(extractedLawyers);
    } catch (e) {
      console.error(e);
    }
    setLoadingLawyers(false);
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      let finalTitle = title;
      if (type === 'lawyer') {
        const selectedLawyer = lawyers.find(l => l.id === lawyerId);
        finalTitle = selectedLawyer ? `Meeting with ${selectedLawyer.name}` : 'Lawyer Appointment';
      } else if (type === 'court') {
        finalTitle = 'Court Appointment';
      }
      
      await userApi.createAppointment({
        title: finalTitle,
        type,
        date: date.toISOString(),
        location: type === 'court' ? location : null,
        lawyer_id: type === 'lawyer' ? lawyerId : null
      });
      
      onSuccess();
      onClose();
      reset();
      router.push('/(user-tabs)/appointments');
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setType('lawyer');
    setTitle('');
    setLocation('');
    setLawyerId(null);
    setDate(new Date());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: C.background }]}>
          <View style={[styles.header, { borderBottomColor: C.border }]}>
            <Text style={[styles.headerTitle, { color: C.foreground }]}>
              {step === 1 ? 'Select Appointment Type' : 'Appointment Details'}
            </Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={C.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {step === 1 ? (
              <View style={styles.typesContainer}>
                <TypeCard 
                  title="Appointment with Lawyer" 
                  icon="briefcase" 
                  selected={type === 'lawyer'} 
                  onPress={() => setType('lawyer')} 
                  theme={C} 
                />
                <TypeCard 
                  title="Court Appointment" 
                  icon="business" 
                  selected={type === 'court'} 
                  onPress={() => setType('court')} 
                  theme={C} 
                />
                <TypeCard 
                  title="Other" 
                  icon="calendar" 
                  selected={type === 'other'} 
                  onPress={() => setType('other')} 
                  theme={C} 
                />
                <Pressable 
                  style={[styles.nextButton, { backgroundColor: C.tint }]} 
                  onPress={() => setStep(2)}
                >
                  <Text style={styles.nextText}>Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.detailsContainer}>
                {type === 'lawyer' && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.foreground }]}>Select Lawyer</Text>
                    {loadingLawyers ? <ActivityIndicator color={C.tint} /> : (
                      <View style={styles.lawyerList}>
                        {lawyers.length === 0 ? (
                          <Text style={{ color: C.mutedForeground }}>No recent lawyers found.</Text>
                        ) : lawyers.map(l => (
                          <Pressable 
                            key={l.id} 
                            style={[styles.lawyerChip, lawyerId === l.id && { backgroundColor: C.tint, borderColor: C.tint }]}
                            onPress={() => setLawyerId(l.id)}
                          >
                            <Text style={[styles.lawyerChipText, lawyerId === l.id && { color: '#fff' }]}>{l.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {type === 'court' && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.foreground }]}>Place (Optional)</Text>
                    <TextInput 
                      style={[styles.input, { color: C.foreground, borderColor: C.border, backgroundColor: C.card }]}
                      placeholder="e.g. Supreme Court"
                      placeholderTextColor={C.mutedForeground}
                      value={location}
                      onChangeText={setLocation}
                    />
                  </View>
                )}

                {type === 'other' && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.foreground }]}>Appointment Name</Text>
                    <TextInput 
                      style={[styles.input, { color: C.foreground, borderColor: C.border, backgroundColor: C.card }]}
                      placeholder="e.g. Notary Meeting"
                      placeholderTextColor={C.mutedForeground}
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={[styles.label, { color: C.foreground }]}>Date & Time</Text>
                  <View style={styles.row}>
                    <Pressable 
                      style={[styles.pickerButton, { borderColor: C.border, backgroundColor: C.card }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={18} color={C.tint} style={{ marginRight: 8 }} />
                      <Text style={{ color: C.foreground }}>{date.toLocaleDateString()}</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.pickerButton, { borderColor: C.border, backgroundColor: C.card }]}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={18} color={C.tint} style={{ marginRight: 8 }} />
                      <Text style={{ color: C.foreground }}>
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                  </View>

                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          const newDate = new Date(date);
                          newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                          setDate(newDate);
                        }
                      }}
                    />
                  )}
                  {showTimePicker && (
                    <DateTimePicker
                      value={date}
                      mode="time"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowTimePicker(false);
                        if (selectedDate) {
                          const newDate = new Date(date);
                          newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                          setDate(newDate);
                        }
                      }}
                    />
                  )}
                </View>

                <View style={styles.actions}>
                  <Pressable style={[styles.backBtn, { borderColor: C.border }]} onPress={() => setStep(1)}>
                    <Text style={{ color: C.foreground }}>Back</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.saveBtn, { backgroundColor: C.tint }, (!title && type==='other') || (!lawyerId && type==='lawyer') ? {opacity: 0.5} : null]}
                    onPress={handleSave}
                    disabled={submitting || (!title && type==='other') || (!lawyerId && type==='lawyer')}
                  >
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Appointment</Text>}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const TypeCard = ({ title, icon, selected, onPress, theme: C }) => (
  <Pressable 
    style={[
      styles.typeCard, 
      { backgroundColor: C.card, borderColor: selected ? C.tint : C.border }
    ]} 
    onPress={onPress}
  >
    <View style={[styles.iconWrap, { backgroundColor: selected ? C.tint : 'rgba(0,0,0,0.05)' }]}>
      <Ionicons name={icon} size={24} color={selected ? '#fff' : C.mutedForeground} />
    </View>
    <Text style={[styles.typeTitle, { color: C.foreground }]}>{title}</Text>
    <Ionicons 
      name={selected ? "radio-button-on" : "radio-button-off"} 
      size={24} 
      color={selected ? C.tint : C.border} 
    />
  </Pressable>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  typesContainer: {
    gap: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  typeTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginRight: 8,
  },
  detailsContainer: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  lawyerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lawyerChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  lawyerChipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  backBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
