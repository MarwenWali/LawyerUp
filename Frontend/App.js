import React, { useState } from "react";
import { View, StyleSheet, StatusBar, Modal, ScrollView } from "react-native";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider, ThemeContext } from "./context/ThemeContext";
import { LanguageProvider, LanguageContext } from "./context/LanguageContext";
import ChatScreen from "./screens/ChatScreen";
import LawyersList from "./screens/LawyersList";
import LawyerProfile from "./screens/LawyerProfile";
import AuthScreen from "./screens/AuthScreen";
import ProfileScreen from "./screens/ProfileScreen";
import { AppContext } from "./context/AppContext";

import { Provider as PaperProvider, DefaultTheme, MD3DarkTheme, Appbar, Drawer, Surface, Text, TouchableRipple, Menu, Divider } from 'react-native-paper';

// Define a custom theme using Paper's defaults but capable of extending
// Custom themes
const lightTheme = {
	...DefaultTheme,
	colors: {
		...DefaultTheme.colors,
		primary: '#2b6cb0',
		secondary: '#4a5568',
		accent: '#f1c40f',
	},
};

const darkTheme = {
	...MD3DarkTheme,
	colors: {
		...MD3DarkTheme.colors,
		primary: '#90cdf4',
		secondary: '#a0aec0',
		accent: '#f6e05e',
	},
};

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

	const paperTheme = isDark ? darkTheme : lightTheme;

	return (
		<PaperProvider theme={paperTheme}>
			<View style={[styles.container, { backgroundColor: colors.background }]}>
				<StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
				<Appbar.Header style={{ backgroundColor: colors.surface }} elevated>
					<Appbar.Action icon="menu" onPress={() => setDrawerOpen(true)} />
					<Appbar.Content title="LawyerUp" titleStyle={{ color: colors.primary, fontWeight: 'bold' }} />
					<Appbar.Action icon="web" onPress={() => setLangMenuOpen(!langMenuOpen)} />
					<Appbar.Action icon={isDark ? "weather-sunny" : "weather-night"} onPress={toggleTheme} />
				</Appbar.Header>

				<Menu
					visible={langMenuOpen}
					onDismiss={() => setLangMenuOpen(false)}
					anchor={{ x: 300, y: 60 }} // Approximate, or use a proper anchor ref if possible, but simpler here
				>
					<Menu.Item onPress={() => { changeLanguage('en'); setLangMenuOpen(false); }} title="🇬🇧 English" />
					<Menu.Item onPress={() => { changeLanguage('fr'); setLangMenuOpen(false); }} title="🇫🇷 Français" />
					<Menu.Item onPress={() => { changeLanguage('ar'); setLangMenuOpen(false); }} title="🇹🇳 Darija" />
				</Menu>

				<View style={styles.content}>{renderScreen()}</View>
				<Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
					<View style={styles.overlay}>
						<Surface style={[styles.drawer, { backgroundColor: colors.surface }]} elevation={4}>
							<View style={styles.drawerHeader}>
								<Text variant="headlineSmall" style={{ fontWeight: 'bold', color: colors.primary, padding: 16 }}>LawyerUp</Text>
								<Appbar.Action icon="close" onPress={() => setDrawerOpen(false)} />
							</View>
							<Divider />
							<Drawer.Section>
								<Drawer.Item
									label="Chat"
									icon="chat"
									active={route.name === 'chat'}
									onPress={() => navigate({ name: "chat" })}
								/>
								<Drawer.Item
									label="Contact a Lawyer"
									icon="gavel"
									active={route.name === 'lawyers'}
									onPress={() => navigate({ name: "lawyers" })}
								/>
								{user ? (
									<Drawer.Item
										label="Profile"
										icon="account"
										active={route.name === 'profile'}
										onPress={() => navigate({ name: "profile" })}
									/>
								) : (
									<Drawer.Item
										label="Sign In / Sign Up"
										icon="login"
										active={route.name === 'auth'}
										onPress={() => navigate({ name: "auth" })}
									/>
								)}
							</Drawer.Section>
						</Surface>
						<TouchableRipple style={{ flex: 1 }} onPress={() => setDrawerOpen(false)}>
							<View />
						</TouchableRipple>
					</View>
				</Modal>
			</View>
		</PaperProvider>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f6f7fb" },
	content: { flex: 1 },
	overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row" },
	drawer: { width: "75%", height: "100%" },
	drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
