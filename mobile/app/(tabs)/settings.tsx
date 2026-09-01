import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Card } from "../../src/components/ui";
import { API_BASE } from "../../src/lib/config";
import { useAuth } from "../../src/state/auth";
import { useUi } from "../../src/state/ui";
import { colors, spacing } from "../../src/theme";

export default function Settings() {
  const { t, language, rtlPending, setLanguage } = useUi();
  const { session, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <Card>
        <Text style={styles.label}>{t.signedInAs}</Text>
        <Text style={styles.value}>{session?.name ?? session?.username}</Text>
        <Text style={styles.dim}>@{session?.username}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>{t.languageLabel}</Text>
        <View style={styles.langRow}>
          {(["en", "ar"] as const).map((lang) => (
            <Pressable
              key={lang}
              onPress={() => setLanguage(lang)}
              style={[styles.langBtn, language === lang && styles.langBtnActive]}
            >
              <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                {lang === "en" ? t.english : t.arabic}
              </Text>
            </Pressable>
          ))}
        </View>
        {rtlPending && <Text style={styles.note}>{t.restartNote}</Text>}
      </Card>

      <Card>
        <Text style={styles.label}>{t.serverLabel}</Text>
        <Text style={styles.dim}>{API_BASE}</Text>
      </Card>

      <Pressable
        style={styles.signOut}
        onPress={() => {
          void signOut().then(() => router.replace("/login"));
        }}
      >
        <Text style={styles.signOutText}>{t.signOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.lg },
  label: { color: colors.textDim, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { color: colors.text, fontSize: 17, fontWeight: "700" },
  dim: { color: colors.textDim, fontSize: 13 },
  langRow: { flexDirection: "row", gap: spacing.sm },
  langBtn: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  langBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  langText: { color: colors.textDim, fontWeight: "600" },
  langTextActive: { color: colors.accent },
  note: { color: colors.warn, fontSize: 12 },
  signOut: {
    borderColor: colors.bad,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  signOutText: { color: colors.bad, fontWeight: "700" },
});
