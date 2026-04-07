import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { supabase } from '@/utils/supabase';

export default function SupabaseTodosScreen() {
  const [todos, setTodos] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function getTodos() {
      try {
        const { data, error } = await supabase.from('todos').select();

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setTodos(Array.isArray(data) ? data : []);
      } catch (error) {
        setErrorMessage(error?.message || 'Unexpected error');
      }
    }

    getTodos();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Todo List</Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <FlatList
        data={todos}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Text style={styles.item}>{item.name}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No todos found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  item: {
    fontSize: 16,
    marginBottom: 8,
  },
  empty: {
    fontSize: 14,
    opacity: 0.7,
  },
  error: {
    color: '#B00020',
    textAlign: 'center',
  },
});
