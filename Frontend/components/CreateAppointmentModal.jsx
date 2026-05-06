import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, TextInput, ScrollView, Platform, ActivityIndicator, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/useTheme';
import { userApi, lawyersApi } from '@/services/api';
import { messagingApi } from '@/services/messagingApi';
import { router } from 'expo-router';
import { supabase } from '@/utils/supabase';

export default function CreateAppointmentModal({ visible, onClose, onSuccess, isLawyer = false, currentUser = null }) {
  const C = useTheme();
  
  const [step, setStep] = useState(1);
  const [type, setType] = useState(isLawyer ? 'client' : 'lawyer');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [participantId, setParticipantId] = useState(null);
  
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && (type === 'lawyer' || type === 'client') && participants.length === 0) {
      fetchParticipants();
    }
  }, [visible, type]);

  const fetchParticipants = async () => {
    setLoadingParticipants(true);
    try {
      const payload = await messagingApi.listConversations();
      const conversations = Array.isArray(payload?.conversations) ? payload.conversations : [];
      const extractedParticipants = conversations
        .filter(c => c.other_participant?.role !== 'admin')
        .map(c => ({
          id: c.other_participant?.id,
          name: c.other_participant?.full_name || c.other_participant?.name || 'Unknown'
        }));
      setParticipants(extractedParticipants);
    } catch (e) {
      console.error(e);
    }
    setLoadingParticipants(false);
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      let finalTitle = title;
      
      if ((type === 'lawyer' || type === 'client') && !participantId) {
        Alert.alert('Missing Selection', `Please select a ${type} for the appointment.`);
        setSubmitting(false);
        return;
      }

      const selectedParticipant = participants.find(p => p.id === participantId);
      
      if (type === 'lawyer') {
        finalTitle = selectedParticipant ? `Meeting with ${selectedParticipant.name}` : 'Lawyer Appointment';
      } else if (type === 'client') {
        finalTitle = selectedParticipant ? `Meeting with ${selectedParticipant.name}` : 'Client Appointment';
      } else if (type === 'court') {
        finalTitle = 'Court Appointment';
      }
      
      if (isLawyer) {
        await lawyersApi.createAppointment({
          title: finalTitle,
          type: type === 'client' ? 'lawyer' : type,
          date: date.toISOString(),
          location: type === 'court' ? location : null,
          user_id: type === 'client' ? participantId : null
        });
      } else {
        await userApi.createAppointment({
          title: finalTitle,
          type,
          date: date.toISOString(),
          location: type === 'court' ? location : null,
          lawyer_id: type === 'lawyer' ? participantId : null
        });
      }
      
      onSuccess();
      onClose();
      reset();
      router.push(isLawyer ? '/(lawyer-tabs)/all-appointments' : '/(user-tabs)/appointments');
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setType(isLawyer ? 'client' : 'lawyer');
    setTitle('');
    setLocation('');
    setParticipantId(null);
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
                  title={isLawyer ? "Appointment with Citizen" : "Appointment with Lawyer"} 
                  icon={isLawyer ? "people" : "briefcase"} 
                  selected={type === (isLawyer ? 'client' : 'lawyer')} 
                  onPress={() => setType(isLawyer ? 'client' : 'lawyer')} 
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
                {(type === 'lawyer' || type === 'client') && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.foreground }]}>{isLawyer ? 'Select Citizen' : 'Select Lawyer'}</Text>
                    {loadingParticipants ? <ActivityIndicator color={C.tint} /> : (
                      <View style={styles.lawyerList}>
                        {participants.length === 0 ? (
                          <Text style={{ color: C.mutedForeground }}>{isLawyer ? 'No recent citizens found.' : 'No recent lawyers found.'}</Text>
                        ) : participants.map(p => (
                          <Pressable 
                            key={p.id} 
                            style={[styles.lawyerChip, participantId === p.id && { backgroundColor: C.tint, borderColor: C.tint }]}
                            onPress={() => setParticipantId(p.id)}
                          >
                            <Text style={[styles.lawyerChipText, participantId === p.id && { color: '#fff' }]}>{p.name}</Text>
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
                    style={[styles.saveBtn, { backgroundColor: C.tint }, (!title && type==='other') || (!participantId && (type==='lawyer' || type==='client')) ? {opacity: 0.5} : null]}
                    onPress={handleSave}
                    disabled={submitting || (!title && type==='other') || (!participantId && (type==='lawyer' || type==='client'))}
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
