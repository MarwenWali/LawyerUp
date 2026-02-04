import React, { useState } from "react";
import { View, StyleSheet, StatusBar, TouchableOpacity, Text, Modal, ScrollView } from "react-native";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider, ThemeContext } from "./context/ThemeContext";
import { LanguageProvider, LanguageContext } from "./context/LanguageContext";
import ChatScreen from "./screens/ChatScreen";
import LawyersList from "./screens/LawyersList";
import LawyerProfile from "./screens/LawyerProfile";
import AuthScreen from "./screens/AuthScreen";
import ProfileScreen from "./screens/ProfileScreen";
import { AppContext } from "./context/AppContext";

export default function App() {
	const [route, setRoute] = useState({ name: "chat", params: {} });
	const [drawerOpen, setDrawerOpen] = useState(false);

	return (
		<LanguageProvider>
			<ThemeProvider>
				<AppProvider>
					<MainApp route={route} setRoute={setRoute} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
				</AppProvider>
			</ThemeProvider>
		</LanguageProvider>
	);
}

function MainApp({ route, setRoute, drawerOpen, setDrawerOpen }) {
	const { user } = React.useContext(AppContext);
	const { colors, isDark, toggleTheme } = React.useContext(ThemeContext);
	const { language, changeLanguage } = React.useContext(LanguageContext);
	const [langMenuOpen, setLangMenuOpen] = React.useState(false);

	const navigate = (nextRoute) => {
		setRoute(nextRoute);
		setDrawerOpen(false);
	};

	const renderScreen = () => {
		switch (route.name) {
			case "chat":
				return <ChatScreen navigate={setRoute} />;
			case "lawyers":
				return <LawyersList navigate={setRoute} />;
			case "lawyerProfile":
				return <LawyerProfile lawyer={route.params?.lawyer} navigate={setRoute} />;
			case "auth":
				return <AuthScreen navigate={setRoute} />;
			case "profile":
				return <ProfileScreen navigate={setRoute} />;
			default:
				return <ChatScreen navigate={setRoute} />;
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
			<View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
				<TouchableOpacity onPress={() => setDrawerOpen(!drawerOpen)} style={styles.hamburger}>
					<Text style={styles.hamburgerText}>☰</Text>
				</TouchableOpacity>
				<Text style={[styles.appTitle, { color: colors.primary }]}>LawyerUp</Text>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					<TouchableOpacity onPress={() => setLangMenuOpen(!langMenuOpen)} style={styles.langBtn}>
						<Text style={styles.langBtnText}>🌐 {language.toUpperCase()}</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
						<Text style={styles.themeBtnText}>{isDark ? "☀️" : "🌙"}</Text>
					</TouchableOpacity>
				</View>
			</View>

			{langMenuOpen && (
				<View style={[styles.langMenu, { backgroundColor: colors.surface }]}>
					<TouchableOpacity onPress={() => { changeLanguage('en'); setLangMenuOpen(false); }} style={styles.langOption}>
						<Text style={{ color: language === 'en' ? colors.primary : colors.text }}>🇬🇧 English</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={() => { changeLanguage('fr'); setLangMenuOpen(false); }} style={styles.langOption}>
						<Text style={{ color: language === 'fr' ? colors.primary : colors.text }}>🇫🇷 Français</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={() => { changeLanguage('ar'); setLangMenuOpen(false); }} style={styles.langOption}>
						<Text style={{ color: language === 'ar' ? colors.primary : colors.text }}>🇹🇳 Darija</Text>
					</TouchableOpacity>
				</View>
			)}

			<View style={styles.content}>{renderScreen()}</View>
			<Modal visible={drawerOpen} transparent animationType="fade">
				<View style={styles.overlay}>
					<View style={[styles.drawer, { backgroundColor: colors.surface }]}>
						<TouchableOpacity onPress={() => setDrawerOpen(false)} style={styles.closeBtn}>
							<Text style={styles.closeText}>✕</Text>
						</TouchableOpacity>
						<ScrollView style={styles.drawerContent}>
							<TouchableOpacity style={[styles.drawerBtn, { backgroundColor: colors.background }]} onPress={() => navigate({ name: "chat" })}>
								<Text style={[styles.drawerBtnText, { color: colors.text }]}>💬 Chat</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.drawerBtn, { backgroundColor: colors.background }]} onPress={() => navigate({ name: "lawyers" })}>
								<Text style={[styles.drawerBtnText, { color: colors.text }]}>⚖️ Contact a Lawyer</Text>
							</TouchableOpacity>
							{user ? (
								<TouchableOpacity style={[styles.drawerBtn, { backgroundColor: colors.background }]} onPress={() => navigate({ name: "profile" })}>
									<Text style={[styles.drawerBtnText, { color: colors.text }]}>👤 Profile</Text>
								</TouchableOpacity>
							) : (
								<TouchableOpacity style={[styles.drawerBtn, { backgroundColor: colors.background }]} onPress={() => navigate({ name: "auth" })}>
									<Text style={[styles.drawerBtnText, { color: colors.text }]}>🔐 Sign In / Sign Up</Text>
								</TouchableOpacity>
							)}
						</ScrollView>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f6f7fb" },
	header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e6e6e6" },
	hamburger: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
	hamburgerText: { fontSize: 24, color: "#2b6cb0" },
	appTitle: { fontSize: 16, fontWeight: "700", color: "#2b6cb0" },
	themeBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
	themeBtnText: { fontSize: 20 },
	langBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, backgroundColor: "#e8f0f8" },
	langBtnText: { fontSize: 12, fontWeight: "600", color: "#2b6cb0" },
	langMenu: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e6e6e6", paddingVertical: 8 },
	langOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
	content: { flex: 1 },
	overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row" },
	drawer: { width: "70%", backgroundColor: "#fff", height: "100%" },
	drawerContent: { padding: 16 },
	drawerBtn: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 6, marginBottom: 8, backgroundColor: "#f4f6fb" },
	drawerBtnText: { fontSize: 14, fontWeight: "600" },
	closeBtn: { alignSelf: "flex-end", padding: 12 },
	closeText: { fontSize: 20, color: "#666" },
});