import React, { useContext, useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, TextInput, Button, Title, Subheading, Surface } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { AppContext } from '../context/AppContext';
import { ThemeContext } from '../context/ThemeContext';

import { API_URL } from '../config';

const AuthScreen = ({ navigate }) => {
  const { setUser } = useContext(AppContext);
  const { colors } = useContext(ThemeContext);
  const [step, setStep] = useState('choose');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [diplomaUri, setDiplomaUri] = useState(null);

  const pickDiploma = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      if (!result.canceled) {
        setDiplomaUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open image picker: ' + error.message);
    }
  };

  const handleCitizenSignup = async () => {
    if (!email || !name) return Alert.alert('Fill all fields');
    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, type: 'citizen' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Signup failed');

      setUser({ ...data.user, approved: true });
      navigate({ name: 'chat' });
    } catch (error) {
      console.error('Signup Error:', error);
      Alert.alert('Signup Failed', error.message || 'Network request failed. Check your internet or server.');
    }
  };

  const handleLawyerSignup = async () => {
    if (!email || !name || !diplomaUri) return Alert.alert('Fill all fields and upload diploma');
    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          type: 'lawyer',
          diploma: diplomaUri // Sending the URI string for now
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Signup failed');

      Alert.alert('Success', 'Your lawyer application has been submitted and is awaiting approval.');
      setUser({ ...data.user, approved: false }); // Pending
      navigate({ name: 'chat' });
    } catch (error) {
      console.error('Signup Error:', error);
      Alert.alert('Signup Failed', error.message || 'Network request failed. Check your internet or server.');
    }
  };

  const handleSignin = () => {
    if (!email) return Alert.alert('Enter email');
    // Basic mock signin - in real app would verify credentials
    setUser({ type: 'citizen', name: name || email, email, approved: true });
    navigate({ name: 'chat' });
  };

  if (step === 'choose') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Title style={[styles.title, { color: colors.primary }]}>Welcome to LawyerUp</Title>
        <Subheading style={[styles.subtitle, { color: colors.text }]}>What would you like to do?</Subheading>
        <Button mode="contained" style={styles.btn} contentStyle={styles.btnContent} onPress={() => setStep('citizenSignup')}>
          👤 Sign Up as a Citizen
        </Button>
        <Button mode="contained" style={styles.btn} contentStyle={styles.btnContent} onPress={() => setStep('lawyerSignup')}>
          ⚖️ Sign Up as a Lawyer
        </Button>
        <Button mode="outlined" style={styles.btnSecondary} contentStyle={styles.btnContent} onPress={() => setStep('signin')}>
          Already have an account? Sign In
        </Button>
      </View>
    );
  }

  if (step === 'citizenSignup') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Button icon="arrow-left" mode="text" compact onPress={() => setStep('choose')} style={{ alignSelf: 'flex-start' }}>Back</Button>
        <Title style={[styles.title, { color: colors.primary }]}>Sign Up as Citizen</Title>
        <TextInput mode="outlined" label="Full Name" value={name} onChangeText={setName} style={styles.input} />
        <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput mode="outlined" label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
        <Button mode="contained" onPress={handleCitizenSignup} style={styles.actionBtn}>
          Sign Up
        </Button>
      </View>
    );
  }

  if (step === 'lawyerSignup') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Button icon="arrow-left" mode="text" compact onPress={() => setStep('choose')} style={{ alignSelf: 'flex-start' }}>Back</Button>
        <Title style={[styles.title, { color: colors.primary }]}>Sign Up as Lawyer</Title>
        <TextInput mode="outlined" label="Full Name" value={name} onChangeText={setName} style={styles.input} />
        <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput mode="outlined" label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />

        <Button mode="outlined" icon={diplomaUri ? 'check' : 'upload'} onPress={pickDiploma} style={styles.uploadBtn}>
          {diplomaUri ? 'Diploma Uploaded' : 'Upload Diploma/License'}
        </Button>

        <Button mode="contained" onPress={handleLawyerSignup} style={styles.actionBtn}>
          Sign Up
        </Button>
      </View>
    );
  }

  if (step === 'signin') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Button icon="arrow-left" mode="text" compact onPress={() => setStep('choose')} style={{ alignSelf: 'flex-start' }}>Back</Button>
        <Title style={[styles.title, { color: colors.primary }]}>Sign In</Title>
        <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <Button mode="contained" onPress={handleSignin} style={styles.actionBtn}>
          Sign In
        </Button>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 24, textAlign: 'center' },
  btn: { marginBottom: 12, paddingVertical: 6 },
  btnSecondary: { marginBottom: 12, paddingVertical: 6, borderColor: '#2b6cb0' },
  btnContent: { height: 48 },
  input: { marginBottom: 12, backgroundColor: '#fff' },
  uploadBtn: { marginBottom: 16, borderColor: '#2b6cb0' },
  actionBtn: { marginTop: 8, paddingVertical: 6 },
});

export default AuthScreen;
