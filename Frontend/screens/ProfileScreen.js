import React, { useContext, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Avatar, Title, Subheading, Surface, useTheme, ActivityIndicator } from 'react-native-paper';
import { AppContext } from '../context/AppContext';
import { API_URL } from '../config';

const ProfileScreen = ({ navigate }) => {
  const { user, setUser } = useContext(AppContext);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const { colors } = useTheme();

  const save = async () => {
    setSaving(true);
    try {
      if (user?.id) {
        const response = await fetch(`${API_URL}/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, bio }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Update failed');
        setUser({ ...user, ...data.user, type: data.user.role || user.type });
      } else {
        // Local-only update for mock sign-in users
        setUser({ ...user, name, bio, phone });
      }
      Alert.alert('Success', 'Profile saved successfully.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigate({ name: 'chat' });
  };

  if (!user) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text>Please sign in</Text>
      <Button mode="contained" onPress={() => navigate({ name: 'auth' })} style={{ marginTop: 20 }}>Sign In</Button>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Avatar.Text size={80} label={(name || user.name) ? (name || user.name).substring(0, 2).toUpperCase() : 'U'} />
        <Title style={{ marginTop: 10 }}>{name || user.name}</Title>
        <Subheading>{user.type.toUpperCase()}</Subheading>
        {user.email && <Text style={{ color: 'gray' }}>{user.email}</Text>}
      </View>

      <Surface style={styles.form} elevation={1}>
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          mode="outlined"
          keyboardType="phone-pad"
          style={styles.input}
        />
        {user.type === 'lawyer' && (
          <TextInput
            label="Bio"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            mode="outlined"
            style={styles.input}
          />
        )}
        <Button mode="contained" onPress={save} style={styles.btn} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : 'Save Profile'}
        </Button>

        <Button
          mode="outlined"
          onPress={handleLogout}
          style={[styles.btn, { borderColor: colors.error }]}
          textColor={colors.error}
          icon="logout"
        >
          Log Out
        </Button>
      </Surface>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  header: { alignItems: 'center', marginBottom: 30 },
  form: { padding: 20, borderRadius: 10 },
  input: { marginBottom: 15, backgroundColor: 'transparent' },
  btn: { marginTop: 10 },
});

export default ProfileScreen;
