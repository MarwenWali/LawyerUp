import { StyleSheet, Text, View } from "react-native";
export default function Header() {
return (
<View style={styles.container}>
<Text>Welcome Back</Text>
</View>
);
}
const styles = StyleSheet.create({
container: {
backgroundColor: "pink",
height: 50,
width: "100%",
marginTop: 30,
alignItems: "center",
justifyContent: "center",
},
title:{

    fontsize:18,
    fontWeight:"bold",
},

});