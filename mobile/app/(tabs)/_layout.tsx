import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../../src/state/auth";
import { useUi } from "../../src/state/ui";
import { colors, font } from "../../src/theme";

export default function TabsLayout() {
  const { session, ready } = useAuth();
  const { t } = useUi();
  if (ready && !session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: font.semibold, fontSize: 20 },
        headerTitleAlign: "left",
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.surfaceSidebar,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.textBrand,
        tabBarInactiveTintColor: colors.textMedium,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabHome,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="mytasks"
        options={{
          title: t.tabMyTasks,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: t.tabLedger,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" color={color} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabSettings,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size - 2} />
          ),
        }}
      />
    </Tabs>
  );
}
