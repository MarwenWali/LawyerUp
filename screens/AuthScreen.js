import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppContext } from '../context/AppContext';

const AuthScreen = ({ navigate }) => {
  const { setUser } = useContext(AppContext);
  const [step, setStep] = useState('choose');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [diplomaUri, setDiplomaUri] = useState(null);

  const pickDiploma = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setDiplomaUri(result.assets[0].uri);
    }
  };

  const handleCitizenSignup = () => {
    if (!email || !name) return Alert.alert('Fill all fields');
    setUser({ type: 'citizen', name, email, phone, approved: true });
    navigate({ name: 'chat' });
  };

  const handleLawyerSignup = () => {
    if (!email || !name || !diplomaUri) return Alert.alert('Fill all fields and upload diploma');
    Alert.alert('Lawyer Signup', 'Your application has been submitted. Await admin approval.');
    setUser({ type: 'lawyer', name, email, phone, diploma: diplomaUri, approved: false });
    navigate({ name: 'chat' });
  };

  const handleSignin = () => {
    if (!email) return Alert.alert('Enter email');
    setUser({ type: 'citizen', name: name || email, email, approved: true });
    navigate({ name: 'chat' });
  };

  if (step === 'choose') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to LawyerUp</Text>
        <Text style={styles.subtitle}>What would you like to do?</Text>
        <TouchableOpacity style={styles.largeBtn} onPress={() => setStep('citizenSignup')}>
          <Text style={styles.largeBtnText}>👤 Sign Up as a Citizen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.largeBtn} onPress={() => setStep('lawyerSignup')}>
          <Text style={styles.largeBtnText}>⚖️ Sign Up as a Lawyer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.largeBtnSecondary} onPress={() => setStep('signin')}>
          <Text style={styles.largeBtnTextSecondary}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'citizenSignup') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setStep('choose')}><Text style={{ color: '#2b6cb0', marginBottom: 12 }}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Sign Up as Citizen</Text>
        <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Phone (optional)" value={phone} onChangeText={setPhone} />
        <TouchableOpacity style={styles.actionBtn} onPress={handleCitizenSignup}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'lawyerSignup') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setStep('choose')}><Text style={{ color: '#2b6cb0', marginBottom: 12 }}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Sign Up as Lawyer</Text>
        <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} />
        <TouchableOpacity style={styles.uploadBtn} onPress={pickDiploma}>
          <Text style={styles.uploadBtnText}>{diplomaUri ? '📄 Diploma Uploaded' : '📤 Upload Diploma/License'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLawyerSignup}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'signin') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setStep('choose')}><Text style={{ color: '#2b6cb0', marginBottom: 12 }}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Sign In</Text>
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
        <TouchableOpacity style={styles.actionBtn} onPress={handleSignin}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  largeBtn: { backgroundColor: '#2b6cb0', paddingVertical: 16, paddingHorizontal: 14, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  largeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  largeBtnSecondary: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f4f6fb', marginTop: 8 },
  largeBtnTextSecondary: { color: '#2b6cb0', fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e6e6e6', padding: 12, borderRadius: 6, marginBottom: 10 },
  uploadBtn: { borderWidth: 2, borderColor: '#2b6cb0', borderStyle: 'dashed', paddingVertical: 14, borderRadius: 6, alignItems: 'center', marginBottom: 10 },
  uploadBtnText: { color: '#2b6cb0', fontSize: 14, fontWeight: '600' },
  actionBtn: { backgroundColor: '#2b6cb0', padding: 14, borderRadius: 6, alignItems: 'center', marginTop: 8 },
});

export default AuthScreen;
