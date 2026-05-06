import { StyleSheet, Text, View } from "react-native";
export default function Footer() {
return (
<View style={styles.container}>
<Text>All rights reserved by SMU, 2025-2026</Text>
</View>
);
}
const styles = StyleSheet.create({
container: {
backgroundColor: "grey",
alignItems: "center",justifyContent: "center",
width: "100%",
height: 50,
marginBottom: 50,
},
});
