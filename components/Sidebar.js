import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { AppContext } from '../context/AppContext';

const Sidebar = ({ route, navigate }) => {
  const { user } = useContext(AppContext);

  return (
    <View style={styles.sidebar}>
      <ScrollView>
        <Text style={styles.title}>TunisianLawAI</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigate({ name: 'chat' })}>
          <Text>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => navigate({ name: 'lawyers' })}>
          <Text>Contact a Lawyer</Text>
        </TouchableOpacity>
        {user ? (
          <TouchableOpacity style={styles.btn} onPress={() => navigate({ name: 'profile' })}>
            <Text>Profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={() => navigate({ name: 'auth' })}>
            <Text>Sign In / Sign Up</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: { width: 260, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e6e6e6', padding: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  btn: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 6, marginBottom: 8, backgroundColor: '#f4f6fb' },
});

export default Sidebar;
