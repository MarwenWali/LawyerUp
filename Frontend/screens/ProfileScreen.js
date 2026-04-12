import React, { useContext, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, Avatar, Title, Subheading, Surface, useTheme } from 'react-native-paper';
import { AppContext } from '../context/AppContext';

const ProfileScreen = ({ navigate }) => {
  const { user, setUser } = useContext(AppContext);
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const { colors } = useTheme();

  const save = () => {
    setUser({ ...user, bio, phone });
    alert('Saved (placeholder)');
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
        <Avatar.Text size={80} label={user.name ? user.name.substring(0, 2).toUpperCase() : 'U'} />
        <Title style={{ marginTop: 10 }}>{user.name}</Title>
        <Subheading>{user.type.toUpperCase()}</Subheading>
        {user.email && <Text style={{ color: 'gray' }}>{user.email}</Text>}
      </View>

      <Surface style={styles.form} elevation={1}>
        {user.type === 'lawyer' && (
          <>
            <TextInput
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Bio"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              mode="outlined"
              style={styles.input}
            />
            <Button mode="contained" onPress={save} style={styles.btn}>
              Save Profile
            </Button>
          </>
        )}

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
