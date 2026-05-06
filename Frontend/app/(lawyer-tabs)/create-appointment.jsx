import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/constants/useTheme';
import CreateAppointmentModal from '@/components/CreateAppointmentModal';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function CreateAppointmentScreen() {
  const C = useTheme();
  const { user } = useAuth();
  
  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <CreateAppointmentModal 
        visible={true}
        onClose={() => router.back()}
        onSuccess={() => {}}
        isLawyer={true}
        currentUser={user}
      />
    </View>
  );
}
