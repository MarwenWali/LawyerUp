import { StyleSheet, Text, View } from "react-native";
import Header from "../HeadersFooters/Header";
import ListUsers from "./ListUsers";
import Footer from "../HeadersFooters/Footer";
export default function Top10Main() {
return (
<View style={styles.container}>
<Header />
<Text style={styles.title}> TOP 10 Matching Users For you!</Text>
<ListUsers />
<Footer />
</View>
);
}
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#fff",
alignItems: "center",
justifyContent: "space-between",
},
title: {
fontSize: 18,
fontWeight: "bold",
},
});
