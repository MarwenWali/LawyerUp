import { StyleSheet, Text, ScrollView, View } from "react-native";
import { useEffect, useState } from "react";

import axios from "axios";
import uuid from "react-native-uuid";
import User from "../User";
export default function ListUsers() {
const [userData, setUserData] = useState([]);
const url = "https://randomuser.me/api/?results=10";
useEffect(() => {
axios.get(url)
.then((res) => {
setUserData(res.data.results);
})
.catch((err) => {
console.log(err);
});
}, []);
return (
<ScrollView style={styles.container}>
{userData.length === 0 ? (
<Text>Loading...</Text>
) : (
userData.map((elt) => (
    
<User
key={uuid.v4()}
cellPhone={elt.cell}
firstName={elt.name.first}
lastName={elt.name.last}
picture={elt.picture.medium}
age={elt.dob.age}
/>
))
)}
</ScrollView>
);
}
const styles = StyleSheet.create({
container: {
width: "100%",
maxHeight: 500,
backgroundColor: "lightgrey",
},
});