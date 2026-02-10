import React, { useState, useMemo, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { API_URL } from '../config';

const sample = [
  { id: '1', name: 'Mehdi Ben Ali', specialization: 'Family Law', phone: '+216 20 000 000', email: 'mehdi@example.com', fees: 50, rating: 4.5, bio: 'Experienced family lawyer.', experience: 10 },
  { id: '2', name: 'Amina Trabelsi', specialization: 'Criminal Law', phone: '+216 21 111 111', email: 'amina@example.com', fees: 80, rating: 4.8, bio: 'Criminal defense specialist.', experience: 12 },
  { id: '3', name: 'Karim Jarray', specialization: 'Corporate Law', phone: '+216 22 222 222', email: 'karim@example.com', fees: 120, rating: 4.2, bio: 'Expert in business law.', experience: 15 },
  { id: '4', name: 'Fatima Nouira', specialization: 'Family Law', phone: '+216 23 333 333', email: 'fatima@example.com', fees: 60, rating: 4.7, bio: 'Specialized in family disputes.', experience: 8 },
];

const LawyersList = ({ navigate }) => {
  const { colors, isDark } = useContext(ThemeContext);
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
      const response = await fetch(`${API_URL}/api/approved-lawyers`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setLawyers(data);
      }
    } catch (error) {
      console.log('Using sample lawyers (admin dashboard not accessible or empty)', error);
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Lawyers</Text>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.primary }]} onPress={() => setFilterVisible(true)}>
          <Text style={styles.filterBtnText}>🔍 Filter</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredLawyers}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.item, { backgroundColor: colors.surface }]} onPress={() => navigate({ name: 'lawyerProfile', params: { lawyer: item } })}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{item.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.specialization}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>⭐ {item.rating} | {item.fees} TND | {item.experience} yrs</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No lawyers match your filters</Text>}
      />

      <Modal visible={filterVisible} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <ScrollView style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filter Lawyers</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Specialization</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <TouchableOpacity
                style={[styles.tag, { backgroundColor: selectedSpec === '' ? colors.primary : colors.background, borderColor: colors.border }]}
                onPress={() => setSelectedSpec('')}
              >
                <Text style={[styles.tagText, { color: selectedSpec === '' ? '#fff' : colors.text }]}>All</Text>
              </TouchableOpacity>
              {specializations.map((spec) => (
                <TouchableOpacity
                  key={spec}
                  style={[styles.tag, { backgroundColor: selectedSpec === spec ? colors.primary : colors.background, borderColor: colors.border }]}
                  onPress={() => setSelectedSpec(spec)}
                >
                  <Text style={[styles.tagText, { color: selectedSpec === spec ? '#fff' : colors.text }]}>{spec}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: colors.text }]}>Fee Range (TND)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8, color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#333' : '#fff' }]}
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
                value={minFees}
                onChangeText={setMinFees}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#333' : '#fff' }]}
                placeholder="Max"
                placeholderTextColor={colors.textSecondary}
                value={maxFees}
                onChangeText={setMaxFees}
                keyboardType="numeric"
              />
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Minimum Rating</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#333' : '#fff' }]}
              placeholder="e.g., 4.0"
              placeholderTextColor={colors.textSecondary}
              value={minRating}
              onChangeText={setMinRating}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: colors.text }]}>Experience (Years)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8, color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#333' : '#fff' }]}
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
                value={minExp}
                onChangeText={setMinExp}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#333' : '#fff' }]}
                placeholder="Max"
                placeholderTextColor={colors.textSecondary}
                value={maxExp}
                onChangeText={setMaxExp}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={() => setFilterVisible(false)}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.primary }]} onPress={handleResetFilters}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Reset</Text>
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
  filterBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  filterBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  item: { padding: 12, borderRadius: 8, marginBottom: 8 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { padding: 16, borderRadius: 12, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { fontSize: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  tag: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  tagText: { fontSize: 12 },
  row: { flexDirection: 'row', marginBottom: 16 },
  input: { borderWidth: 1, padding: 10, borderRadius: 6, marginBottom: 16 },
  applyBtn: { padding: 12, borderRadius: 6, alignItems: 'center', marginBottom: 8 },
  resetBtn: { borderWidth: 1, padding: 12, borderRadius: 6, alignItems: 'center' },
});

export default LawyersList;
