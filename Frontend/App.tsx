import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { supabase } from './utils/supabase';

export default function App() {
  const [todos, setTodos] = useState<any[]>([]);

  useEffect(() => {
    const getTodos = async () => {
      try {
        const { data: todosData, error } = await supabase.from('todos').select();

        if (error) {
          console.error('Error fetching todos:', error.message);
          return;
        }

        if (todosData && todosData.length > 0) {
          setTodos(todosData);
        }
      } catch (error: any) {
        console.error('Error fetching todos:', error?.message);
      }
    };

    getTodos();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Todo List</Text>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <Text key={item.id}>{item.name}</Text>}
      />
    </View>
  );
}
