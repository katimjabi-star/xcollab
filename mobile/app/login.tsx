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
import { BrandMark } from "../src/components/ui";
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
import { colors, spacing } from "../src/theme";

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
      <View style={styles.panel}>
        <BrandMark size={34} />
        <Text style={styles.tagline}>{t.loginTagline}</Text>

        {katimAvailable && (
          <View style={styles.switcher}>
            {(["katim", "password"] as const).map((door) => (
              <Pressable
                key={door}
                onPress={() => {
                  setMode(door);
                  setError(null);
                }}
                style={[styles.switchBtn, mode === door && styles.switchBtnActive]}
              >
                <Text style={[styles.switchText, mode === door && styles.switchTextActive]}>
                  {door === "katim" ? t.katimDoor : t.passwordDoor}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {push ? (
          <View style={styles.pushWait}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.pushText}>{t.pushWaiting}</Text>
            <Text style={styles.pushCodeLabel}>{t.pushCode}</Text>
            <Text style={styles.pushCode}>{push.verificationCode}</Text>
            <Pressable onPress={() => setPush(null)} hitSlop={8}>
              <Text style={styles.cancel}>{t.pushCancel}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>{t.usernameLabel}</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
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
                  onSubmitEditing={() => void submitPassword()}
                  testID="login-password"
                />
              </>
            )}
            <Pressable
              style={[styles.submit, busy && styles.submitBusy]}
              onPress={() => void (mode === "katim" ? startKatim() : submitPassword())}
              disabled={busy}
              testID="login-submit"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "katim" ? t.continueKatim : t.signIn}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  panel: { width: "100%", maxWidth: 380, gap: spacing.lg },
  tagline: { color: colors.textDim, fontSize: 14 },
  switcher: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  switchBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: "center" },
  switchBtnActive: { backgroundColor: colors.cardRaised },
  switchText: { color: colors.textDim, fontWeight: "600" },
  switchTextActive: { color: colors.text },
  form: { gap: spacing.sm },
  label: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  submitBusy: { opacity: 0.7 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  pushWait: {
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xl,
  },
  pushText: { color: colors.text, textAlign: "center" },
  pushCodeLabel: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm },
  pushCode: { color: colors.accent, fontSize: 32, fontWeight: "800", letterSpacing: 4 },
  cancel: { color: colors.textDim, marginTop: spacing.sm, textDecorationLine: "underline" },
  error: { color: colors.bad, textAlign: "center" },
});
