import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/state/auth";
import { UiProvider } from "../src/state/ui";
import { colors, font } from "../src/theme";

// Inter is embedded natively at build time (expo-font config plugin in
// app.json) — available synchronously by filename, no runtime loading.
export default function RootLayout() {
  return (
    <UiProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: font.semibold, fontSize: 15 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </UiProvider>
  );
}
