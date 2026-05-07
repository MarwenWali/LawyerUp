import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/constants/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";


function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const safeAreaInsets = useSafeAreaInsets();
  const C = useTheme();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.tint,
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : C.headerBg,
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
          ...(!isWeb ? { paddingBottom: safeAreaInsets.bottom } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.headerBg }]} />
          ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.home, tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="cases" options={{ title: t.cases, tabBarIcon: ({ color, size }) => <Ionicons name="folder" size={size} color={color} /> }} />
      <Tabs.Screen name="requests" options={{ title: t.requests || 'Requests', tabBarIcon: ({ color, size }) => <Ionicons name="mail" size={size} color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: t.inbox || 'Inbox', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t.profile, tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }} />
      
      {/* Hide redundant files from showing up in the bottom tab bar */}
      <Tabs.Screen name="inbox-chat" options={{ href: null }} />
      <Tabs.Screen name="inbox-old-tabs" options={{ href: null }} />
      <Tabs.Screen name="inbox-unified" options={{ href: null }} />
      <Tabs.Screen name="all-appointments" options={{ href: null }} />
      <Tabs.Screen name="create-appointment" options={{ href: null }} />
    </Tabs>
  );
}

export default function LawyerTabLayout() {
  return <ClassicTabLayout />;
}
