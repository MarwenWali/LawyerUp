import React, { useState, useMemo, useEffect, useContext } from 'react';
import { View, FlatList, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Modal, Portal, TextInput, Chip, ActivityIndicator, Searchbar, IconButton, useTheme } from 'react-native-paper';
import { ThemeContext } from '../context/ThemeContext';
import { API_URL } from '../config';


const sample = [
  { id: '1', name: 'Mehdi Ben Ali', specialization: 'Family Law', phone: '+216 20 000 000', email: 'mehdi@example.com', fees: 50, rating: 4.5, bio: 'Experienced family lawyer.', experience: 10 },
  { id: '2', name: 'Amina Trabelsi', specialization: 'Criminal Law', phone: '+216 21 111 111', email: 'amina@example.com', fees: 80, rating: 4.8, bio: 'Criminal defense specialist.', experience: 12 },
  { id: '3', name: 'Karim Jarray', specialization: 'Corporate Law', phone: '+216 22 222 222', email: 'karim@example.com', fees: 120, rating: 4.2, bio: 'Expert in business law.', experience: 15 },
  { id: '4', name: 'Fatima Nouira', specialization: 'Family Law', phone: '+216 23 333 333', email: 'fatima@example.com', fees: 60, rating: 4.7, bio: 'Specialized in family disputes.', experience: 8 },
];

const LawyersList = ({ navigate }) => {
  const { colors: themeColors, isDark } = useContext(ThemeContext);
  const theme = useTheme();
  const colors = theme.colors; // Use Paper colors preferably, but keep custom theme logic if needed
  // Merging custom colors with paper colors for now or just using paper colors

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

      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_URL}/api/approved-lawyers`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setLawyers(data);
      } else {
        // If no lawyers in DB, use sample data
        setLawyers(sample);
      }
    } catch (error) {
      console.log('Using sample lawyers (backend not reachable or timeout):', error.message);
      // Always fall back to sample data if API fails
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
        <ActivityIndicator animating={true} size="large" color={colors.primary} style={{ marginTop: 50 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text variant="headlineMedium" style={{ color: colors.onBackground, fontWeight: 'bold' }}>Lawyers</Text>
        <Button mode="contained" icon="filter" onPress={() => setFilterVisible(true)}>
          Filter
        </Button>
      </View>
      <FlatList
        data={filteredLawyers}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => navigate({ name: 'lawyerProfile', params: { lawyer: item } })}>
            <Card.Title
              title={item.name}
              subtitle={item.specialization}
              left={(props) => <IconButton {...props} icon="account" />}
            />
            <Card.Content>
              <Text variant="bodyMedium">⭐ {item.rating} | {item.fees} TND | {item.experience} yrs</Text>
              <Text variant="bodySmall" numberOfLines={2} style={{ marginTop: 4, color: 'gray' }}>{item.bio}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No lawyers match your filters</Text>}
      />

      <Portal>
        <Modal visible={filterVisible} onDismiss={() => setFilterVisible(false)} contentContainerStyle={[styles.modalBox, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text variant="titleLarge">Filter Lawyers</Text>
            <IconButton icon="close" onPress={() => setFilterVisible(false)} />
          </View>

          <ScrollView>
            <Text style={styles.label}>Specialization</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <Chip
                selected={selectedSpec === ''}
                onPress={() => setSelectedSpec('')}
                style={styles.chip}
                mode="outlined"
              >
                All
              </Chip>
              {specializations.map((spec) => (
                <Chip
                  key={spec}
                  selected={selectedSpec === spec}
                  onPress={() => setSelectedSpec(spec)}
                  style={styles.chip}
                  mode="outlined"
                >
                  {spec}
                </Chip>
              ))}
            </ScrollView>

            <Text style={styles.label}>Fee Range (TND)</Text>
            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="Min"
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={minFees}
                onChangeText={setMinFees}
                keyboardType="numeric"
                dense
              />
              <TextInput
                mode="outlined"
                label="Max"
                style={[styles.input, { flex: 1 }]}
                value={maxFees}
                onChangeText={setMaxFees}
                keyboardType="numeric"
                dense
              />
            </View>

            <Text style={styles.label}>Minimum Rating</Text>
            <TextInput
              mode="outlined"
              label="e.g., 4.0"
              style={styles.input}
              value={minRating}
              onChangeText={setMinRating}
              keyboardType="decimal-pad"
              dense
            />

            <Text style={styles.label}>Experience (Years)</Text>
            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="Min"
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={minExp}
                onChangeText={setMinExp}
                keyboardType="numeric"
                dense
              />
              <TextInput
                mode="outlined"
                label="Max"
                style={[styles.input, { flex: 1 }]}
                value={maxExp}
                onChangeText={setMaxExp}
                keyboardType="numeric"
                dense
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button mode="text" onPress={handleResetFilters}>Reset</Button>
              <Button mode="contained" onPress={() => setFilterVisible(false)}>Apply</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  card: { marginBottom: 12 },
  modalBox: { padding: 20, margin: 20, borderRadius: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  label: { marginBottom: 8, fontWeight: 'bold' },
  chip: { marginRight: 8 },
  row: { flexDirection: 'row', marginBottom: 16 },
  input: { marginBottom: 10, backgroundColor: 'transparent' },
});

export default LawyersList;
