import { View, StyleSheet } from "react-native";
import { Text, Card, Avatar } from "react-native-paper";
import { faker } from "@faker-js/faker";

export default function User({ firstName, lastName, picture, cellPhone, age }) {
    return (
        <Card style={styles.card}>
            <Card.Title
                title={`${firstName} ${lastName}`}
                left={(props) => <Avatar.Image {...props} source={{ uri: picture }} />}
            />
            <Card.Content>
                <Text variant="bodyMedium">Phone: {cellPhone}</Text>
                <Text variant="bodyMedium">Country: {faker.location.country()}</Text>
                <Text variant="bodyMedium">Age: {age}</Text>
                <Text variant="bodyMedium">Job: {faker.person.jobType()}</Text>
            </Card.Content>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        margin: 10,
        borderRadius: 30, // Keeping the custom style
    },
});
