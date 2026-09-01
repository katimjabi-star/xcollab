import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { BrandMark, Card, PrimaryButton } from "../src/components/ui";
import {
  TokenGrantError,
  x4Complete,
  x4Config,
  x4Initiate,
  x4Status,
  type PushSession,
} from "../src/lib/auth-api";
import { API_BASE, DEMO_USERNAME } from "../src/lib/config";
import { useAuth } from "../src/state/auth";
import { useUi } from "../src/state/ui";
import { colors, font, radius, spacing, type } from "../src/theme";

type Mode = "katim" | "password";

export default function Login() {
  const { t } = useUi();
  const { loginWithPassword, adoptSession, session } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [katimAvailable, setKatimAvailable] = useState(false);
  const [username, setUsername] = useState(DEMO_USERNAME);
  const [password, setPassword] = useState("");
  const [push, setPush] = useState<PushSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pushRef = useRef<PushSession | null>(null);
  pushRef.current = push;

  useEffect(() => {
    if (session) router.replace("/(tabs)");
  }, [session]);

  // Which doors exist is the API's call — password-only until it says so.
  useEffect(() => {
    x4Config(API_BASE).then(({ configured }) => {
      if (configured) {
        setKatimAvailable(true);
        setMode("katim");
      }
    });
  }, []);

  // Waiting for device approval: poll status, then trade the completion
  // secret for a session. Tokens never ride the status endpoint.
  useEffect(() => {
    if (!push) return;
    let stopped = false;
    const timer = setInterval(async () => {
      const current = pushRef.current;
      if (!current) return;
      try {
        const status = await x4Status(API_BASE, current.transactionId);
        if (stopped || status === "pending") return;
        if (status !== "approved") {
          setPush(null);
          setError(status === "denied" ? t.x4Denied : t.x4Expired);
          return;
        }
        clearInterval(timer);
        const grant = await x4Complete(API_BASE, current);
        if (!stopped) await adoptSession(grant, "katim");
      } catch {
        if (!stopped) {
          setPush(null);
          setError(t.loginFailed);
        }
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [push, adoptSession, t]);

  const startKatim = async () => {
    if (!username.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setPush(await x4Initiate(API_BASE, username.trim()));
    } catch {
      setError(t.loginFailed);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithPassword(username.trim(), password);
    } catch (cause) {
      setError(
        cause instanceof TokenGrantError && cause.status === 401
          ? t.wrongCredentials
          : t.loginFailed,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Card style={styles.panel}>
        <BrandMark size={22} />
        <Text style={styles.heading}>{t.welcomeBack}</Text>
        <Text style={styles.hint}>{t.signInHint}</Text>

        {push ? (
          <View style={styles.pushWait}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.pushText}>{t.pushWaiting}</Text>
            <Text style={styles.pushCodeLabel}>{t.pushCode}</Text>
            <Text style={styles.pushCode}>{push.verificationCode}</Text>
            <Pressable onPress={() => setPush(null)} hitSlop={8}>
              <Text style={styles.quietLink}>{t.pushCancel}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>
              {mode === "katim" ? t.katimIdOrEmail : t.usernameLabel}
            </Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={colors.ring}
              testID="login-username"
            />
            {mode === "password" && (
              <>
                <Text style={styles.label}>{t.passwordLabel}</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  selectionColor={colors.ring}
                  onSubmitEditing={() => void submitPassword()}
                  testID="login-password"
                />
              </>
            )}
            <View style={{ height: spacing[2] }} />
            <PrimaryButton
              onPress={() => void (mode === "katim" ? startKatim() : submitPassword())}
              disabled={busy}
              testID="login-submit"
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "katim" ? t.continueKatim : t.signIn}
                </Text>
              )}
            </PrimaryButton>
            {katimAvailable && (
              <Pressable
                onPress={() => {
                  setMode(mode === "katim" ? "password" : "katim");
                  setError(null);
                }}
                hitSlop={8}
                style={styles.switchLink}
              >
                <Text style={styles.quietLink}>
                  {mode === "katim" ? t.usePasswordInstead : t.useKatimInstead}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </Card>
      <Text style={styles.footer}>{t.sovereignFooter}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
  panel: { width: "100%", maxWidth: 400, padding: spacing[7], gap: spacing[2] },
  heading: {
    color: colors.text,
    fontSize: type.xxl,
    fontFamily: font.semibold,
    marginTop: spacing[5],
  },
  hint: { color: colors.textMedium, fontSize: type.md, fontFamily: font.regular },
  form: { gap: spacing[2], marginTop: spacing[4] },
  label: {
    color: colors.textHigh,
    fontSize: type.sm,
    fontFamily: font.medium,
    marginTop: spacing[1],
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.inputLine,
    borderWidth: 1,
    borderRadius: radius.lg,
    color: colors.text,
    paddingHorizontal: spacing[3],
    height: 44,
    fontSize: type.lg,
    fontFamily: font.regular,
  },
  submitText: { color: colors.onPrimary, fontFamily: font.semibold, fontSize: type.lg },
  switchLink: { alignItems: "center", marginTop: spacing[3] },
  quietLink: { color: colors.textMedium, fontSize: type.md, fontFamily: font.medium },
  pushWait: { alignItems: "center", gap: spacing[2], paddingVertical: spacing[6] },
  pushText: { color: colors.textHigh, fontSize: type.md, textAlign: "center", fontFamily: font.regular },
  pushCodeLabel: {
    color: colors.textLow,
    fontSize: type.xs,
    fontFamily: font.medium,
    marginTop: spacing[3],
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pushCode: { color: colors.brand, fontSize: 30, fontFamily: font.semibold, letterSpacing: 6 },
  error: { color: colors.error, fontSize: type.md, fontFamily: font.regular, marginTop: spacing[2] },
  footer: {
    color: colors.textLow,
    fontSize: type.sm,
    fontFamily: font.regular,
    marginTop: spacing[4],
  },
});
