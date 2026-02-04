import { View } from "react-native";
import { Text, Card } from "@rneui/themed";
import { faker } from "@faker-js/faker";
export default function User({ firstName, lastName, picture, cellPhone, age }) {
return (
<Card
containerStyle={{
borderRadius: 30,
shadowRadius: 10,
marginTop: 10,
marginBottom: 10,
}}
>
<Card.Title style={{ fontSize: 14 }}>
{firstName} {lastName}
</Card.Title>
<Card.Divider />
<View style={{ flexDirection: "row" }}>
<Card.Image
style={{
width: 90,
marginHorizontal: 9,
height: 100,
borderRadius: 80,
}}
source={{ uri: picture }}
/>
<View>
<Text style={{ marginTop: 10, fontSize: 12, fontWeight: "bold" }}>
Phone: <Text style={{ fontWeight: "500" }}>{cellPhone}</Text>
</Text>
<Text style={{ marginTop: 10, fontSize: 12, fontWeight: "bold" }}>
{"Country: "}
<Text style={{ fontWeight: "500" }}>
{faker.location.country()}
</Text>
</Text>
<Text style={{ marginTop: 10, fontSize: 12, fontWeight: "bold" }}>
Age: <Text style={{ fontWeight: "500" }}>{age}</Text>
</Text>
<Text style={{ marginTop: 10, fontSize: 12, fontWeight: "bold" }}>
Job:{" "}
<Text style={{ fontWeight: "500" }}>{faker.person.jobType()}</Text>
</Text>
</View>
</View>
</Card>
);
}
