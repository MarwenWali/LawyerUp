import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

const LawyerProfile = ({ lawyer, navigate }) => {
  if (!lawyer) return <View style={{ padding: 16 }}><Text>No lawyer selected</Text></View>;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigate({ name: 'lawyers' })} style={styles.backBtn}>
        <Text style={styles.backText}>← Back to Lawyers</Text>
      </TouchableOpacity>
      <Text style={styles.name}>{lawyer.name}</Text>
      <Text style={{ color: '#666', marginBottom: 8 }}>{lawyer.specialization}</Text>
      <Text style={{ marginBottom: 8 }}>{lawyer.bio}</Text>
      <Text style={{ marginBottom: 4 }}>Fees: {lawyer.fees}</Text>
      <Text style={{ marginBottom: 4 }}>Rating: {lawyer.rating}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(`tel:${lawyer.phone}`)} style={styles.contactBtn}><Text style={{ color: '#fff' }}>Call {lawyer.phone}</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL(`mailto:${lawyer.email}`)} style={[styles.contactBtn, { backgroundColor: '#4a5568' }]}><Text style={{ color: '#fff' }}>Email</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  backBtn: { marginBottom: 12 },
  backText: { color: '#2b6cb0', fontSize: 14, fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  contactBtn: { marginTop: 8, padding: 12, backgroundColor: '#2b6cb0', borderRadius: 6, alignItems: 'center' },
});

export default LawyerProfile;
