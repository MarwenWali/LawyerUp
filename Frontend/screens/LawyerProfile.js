import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Text, Button, Card, Avatar, Title, Paragraph, List, Divider, useTheme } from 'react-native-paper';

const LawyerProfile = ({ lawyer, navigate }) => {
  if (!lawyer) return <View style={{ padding: 16 }}><Text>No lawyer selected</Text></View>;

  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button icon="arrow-left" mode="text" compact onPress={() => navigate({ name: 'lawyers' })} style={{ alignSelf: 'flex-start' }}>
        Back to Lawyers
      </Button>

      <Card style={styles.card}>
        <Card.Title
          title={lawyer.name}
          subtitle={lawyer.specialization}
          left={(props) => <Avatar.Text {...props} label={lawyer.name.substring(0, 2).toUpperCase()} />}
        />
        <Card.Content>
          <Title>About</Title>
          <Paragraph>{lawyer.bio}</Paragraph>
          <Divider style={{ marginVertical: 10 }} />
          <View style={styles.row}>
            <Text style={{ fontWeight: 'bold' }}>Fees:</Text>
            <Text> {lawyer.fees} TND</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ fontWeight: 'bold' }}>Rating:</Text>
            <Text> {lawyer.rating} ⭐</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ fontWeight: 'bold' }}>Experience:</Text>
            <Text> {lawyer.experience} years</Text>
          </View>
        </Card.Content>
        <Card.Actions style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <Button
            mode="contained"
            icon="phone"
            onPress={() => Linking.openURL(`tel:${lawyer.phone}`)}
            style={styles.btn}
          >
            Call {lawyer.phone}
          </Button>
          <Button
            mode="contained"
            icon="email"
            onPress={() => Linking.openURL(`mailto:${lawyer.email}`)}
            style={[styles.btn, { backgroundColor: colors.secondary }]}
          >
            Email
          </Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  card: { marginTop: 10 },
  row: { flexDirection: 'row', marginBottom: 5 },
  btn: { marginVertical: 5 },
});

export default LawyerProfile;
