import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';

const sample = [
  { id: '1', name: 'Mehdi Ben Ali', specialization: 'Family Law', phone: '+216 20 000 000', email: 'mehdi@example.com', fees: 50, rating: 4.5, bio: 'Experienced family lawyer.', experience: 10 },
  { id: '2', name: 'Amina Trabelsi', specialization: 'Criminal Law', phone: '+216 21 111 111', email: 'amina@example.com', fees: 80, rating: 4.8, bio: 'Criminal defense specialist.', experience: 12 },
  { id: '3', name: 'Karim Jarray', specialization: 'Corporate Law', phone: '+216 22 222 222', email: 'karim@example.com', fees: 120, rating: 4.2, bio: 'Expert in business law.', experience: 15 },
  { id: '4', name: 'Fatima Nouira', specialization: 'Family Law', phone: '+216 23 333 333', email: 'fatima@example.com', fees: 60, rating: 4.7, bio: 'Specialized in family disputes.', experience: 8 },
];

const LawyersList = ({ navigate }) => {
  const [lawyers, setLawyers] = useState(sample);
  const [loading, setLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [minFees, setMinFees] = useState('');
  const [maxFees, setMaxFees] = useState('');
  const [minRating, setMinRating] = useState('');
  const [minExp, setMinExp] = useState('');
  const [maxExp, setMaxExp] = useState('');

  useEffect(() => {
    fetchApprovedLawyers();
  }, []);

  const fetchApprovedLawyers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/approved-lawyers');
      const data = await response.json();
      if (data.length > 0) {
        setLawyers(data);
      }
    } catch (error) {
      console.log('Using sample lawyers (admin dashboard not accessible)');
      setLawyers(sample);
    } finally {
      setLoading(false);
    }
  };

  const filteredLawyers = useMemo(() => {
    return lawyers.filter((lawyer) => {
      if (selectedSpec && lawyer.specialization !== selectedSpec) return false;
      if (minFees && lawyer.fees < parseInt(minFees, 10)) return false;
      if (maxFees && lawyer.fees > parseInt(maxFees, 10)) return false;
      if (minRating && lawyer.rating < parseFloat(minRating)) return false;
      if (minExp && lawyer.experience < parseInt(minExp, 10)) return false;
      if (maxExp && lawyer.experience > parseInt(maxExp, 10)) return false;
      return true;
    });
  }, [lawyers, selectedSpec, minFees, maxFees, minRating, minExp, maxExp]);

  const specializations = [...new Set(lawyers.map((l) => l.specialization))];

  const handleResetFilters = () => {
    setSelectedSpec('');
    setMinFees('');
    setMaxFees('');
    setMinRating('');
    setMinExp('');
    setMaxExp('');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2b6cb0" style={{ marginTop: 50 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Lawyers</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterVisible(true)}>
          <Text style={styles.filterBtnText}>🔍 Filter</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredLawyers}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => navigate({ name: 'lawyerProfile', params: { lawyer: item } })}>
            <Text style={{ fontWeight: '700' }}>{item.name}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>{item.specialization}</Text>
            <Text style={{ color: '#999', fontSize: 12 }}>⭐ {item.rating} | {item.fees} TND | {item.experience} yrs</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>No lawyers match your filters</Text>}
      />

      <Modal visible={filterVisible} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <ScrollView style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Lawyers</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Specialization</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <TouchableOpacity
                style={[styles.tag, selectedSpec === '' && styles.tagActive]}
                onPress={() => setSelectedSpec('')}
              >
                <Text style={[styles.tagText, selectedSpec === '' && styles.tagTextActive]}>All</Text>
              </TouchableOpacity>
              {specializations.map((spec) => (
                <TouchableOpacity
                  key={spec}
                  style={[styles.tag, selectedSpec === spec && styles.tagActive]}
                  onPress={() => setSelectedSpec(spec)}
                >
                  <Text style={[styles.tagText, selectedSpec === spec && styles.tagTextActive]}>{spec}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Fee Range (TND)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Min"
                value={minFees}
                onChangeText={setMinFees}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Max"
                value={maxFees}
                onChangeText={setMaxFees}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.label}>Minimum Rating</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 4.0"
              value={minRating}
              onChangeText={setMinRating}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Experience (Years)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Min"
                value={minExp}
                onChangeText={setMinExp}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Max"
                value={maxExp}
                onChangeText={setMaxExp}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterVisible(false)}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
              <Text style={{ color: '#2b6cb0', fontWeight: '600' }}>Reset</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  filterBtn: { backgroundColor: '#2b6cb0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  filterBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  item: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { fontSize: 20, color: '#666' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  tag: { backgroundColor: '#f4f6fb', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e6e6e6' },
  tagActive: { backgroundColor: '#2b6cb0', borderColor: '#2b6cb0' },
  tagText: { color: '#666', fontSize: 12 },
  tagTextActive: { color: '#fff' },
  row: { flexDirection: 'row', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e6e6e6', padding: 10, borderRadius: 6, marginBottom: 16 },
  applyBtn: { backgroundColor: '#2b6cb0', padding: 12, borderRadius: 6, alignItems: 'center', marginBottom: 8 },
  resetBtn: { borderWidth: 1, borderColor: '#2b6cb0', padding: 12, borderRadius: 6, alignItems: 'center' },
});

export default LawyersList;
