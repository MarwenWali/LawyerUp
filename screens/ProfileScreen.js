import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { AppContext } from '../context/AppContext';

const ProfileScreen = ({ navigate }) => {
  const { user, setUser } = useContext(AppContext);
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const save = () => {
    setUser({ ...user, bio, phone });
    alert('Saved (placeholder)');
  };

  const handleLogout = () => {
    setUser(null);
    navigate({ name: 'chat' });
  };

  if (!user) return <View style={{ padding: 16 }}><Text>Please sign in</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={{ marginBottom: 8 }}>Name: {user.name}</Text>
      <Text style={{ marginBottom: 8 }}>Type: {user.type}</Text>
      {user.type === 'lawyer' && (
        <>
          <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} />
          <TextInput style={[styles.input, { minHeight: 80 }]} placeholder="Bio" value={bio} onChangeText={setBio} multiline />
          <TouchableOpacity style={styles.saveBtn} onPress={save}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
        </>
      )}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={{ color: '#fff' }}>🚪 Log Out</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e6e6e6', padding: 10, borderRadius: 6, marginBottom: 8 },
  saveBtn: { backgroundColor: '#2b6cb0', padding: 12, borderRadius: 6, alignItems: 'center' },
  logoutBtn: { backgroundColor: '#d32f2f', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 12 },
});

export default ProfileScreen;
