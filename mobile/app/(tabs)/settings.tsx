import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar, Card, Hairline } from "../../src/components/ui";
import { API_BASE } from "../../src/lib/config";
import { useAuth } from "../../src/state/auth";
import { useUi } from "../../src/state/ui";
import { colors, font, radius, spacing, type } from "../../src/theme";

export default function Settings() {
  const { t, language, rtlPending, setLanguage } = useUi();
  const { session, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <Card style={styles.userCard}>
        <Avatar name={session?.name ?? session?.username ?? "?"} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{session?.name ?? session?.username}</Text>
          <Text style={styles.userSub}>@{session?.username}</Text>
        </View>
      </Card>

      <Card>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t.languageLabel}</Text>
          <View style={styles.langRow}>
            {(["en", "ar"] as const).map((lang) => (
              <Pressable
                key={lang}
                onPress={() => setLanguage(lang)}
                style={[styles.langBtn, language === lang && styles.langBtnActive]}
              >
                <Text
                  style={[styles.langText, language === lang && styles.langTextActive]}
                >
                  {lang === "en" ? t.english : t.arabic}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {rtlPending && (
          <>
            <Hairline />
            <Text style={styles.note}>{t.restartNote}</Text>
          </>
        )}
        <Hairline />
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t.serverLabel}</Text>
          <Text style={styles.settingValue} numberOfLines={1}>
            {API_BASE.replace("https://", "")}
          </Text>
        </View>
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
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing[4], gap: spacing[3] },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
  },
  userName: { color: colors.text, fontSize: type.lg, fontFamily: font.semibold },
  userSub: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    padding: spacing[4],
  },
  settingLabel: { color: colors.textHigh, fontSize: type.md, fontFamily: font.medium },
  settingValue: {
    color: colors.textMedium,
    fontSize: type.md,
    fontFamily: font.regular,
    flexShrink: 1,
  },
  langRow: { flexDirection: "row", gap: spacing[1] },
  langBtn: {
    paddingHorizontal: spacing[3],
    height: 30,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceThin,
  },
  langBtnActive: {
    backgroundColor: colors.chipSelected,
    borderColor: colors.chipSelectedBorder,
    borderWidth: 1,
  },
  langText: { color: colors.textMedium, fontSize: type.md, fontFamily: font.medium },
  langTextActive: { color: colors.textBrand },
  note: {
    color: colors.textMedium,
    fontSize: type.sm,
    fontFamily: font.regular,
    padding: spacing[4],
    paddingVertical: spacing[2],
  },
  signOut: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  signOutText: { color: colors.error, fontFamily: font.medium, fontSize: type.md },
});
