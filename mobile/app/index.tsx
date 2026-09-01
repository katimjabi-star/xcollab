import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/state/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { session, ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return session ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />;
}
