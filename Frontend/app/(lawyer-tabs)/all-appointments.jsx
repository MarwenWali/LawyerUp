import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import { useTheme } from '@/constants/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import CreateAppointmentModal from '@/components/CreateAppointmentModal';

export default function LawyerAppointmentsScreen() {
  const C = useTheme();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('lawyer_id', user.id)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });
        
      if (!error && data) {
        setAppointments(data);
      }
    } catch (e) {
      console.error('fetchAppointments error', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments])
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <Stack.Screen options={{
        title: 'My Appointments',
        headerRight: () => (
          <Pressable onPress={() => router.push('/(lawyer-tabs)/create-appointment')} style={{ padding: 8 }}>
            <Ionicons name="add" size={26} color={C.tint} />
          </Pressable>
        )
      }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={C.mutedForeground} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyText, { color: C.mutedForeground }]}>No appointments found.</Text>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }}
          renderItem={({ item }) => {
            const dateObj = new Date(item.date);
            const isCitizen = item.type === 'lawyer' || item.type === 'user' || item.type === 'client';
            const isCourt = item.type === 'court';
            
            return (
              <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={[styles.iconBox, { backgroundColor: isCitizen ? 'rgba(59,130,246,0.1)' : isCourt ? 'rgba(184, 135, 47, 0.1)' : 'rgba(16,185,129,0.1)' }]}>
                    <Ionicons name={isCitizen ? 'people' : isCourt ? 'business' : 'calendar'} size={24} color={isCitizen ? '#3B82F6' : isCourt ? '#B8872F' : '#10B981'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: C.foreground }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.subtitle, { color: C.mutedForeground }]}>
                      {isCitizen ? 'Citizen Appointment' : isCourt && item.location ? item.location : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.timeRow, { backgroundColor: 'rgba(0,0,0,0.02)' }]}>
                  <Ionicons name="time-outline" size={16} color={C.mutedForeground} style={{ marginRight: 6 }} />
                  <Text style={[styles.timeText, { color: C.foreground }]}>
                    {dateObj.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  timeText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
