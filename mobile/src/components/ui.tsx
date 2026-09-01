import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, font, radius, spacing, statusTokens, type } from "../theme";
import type { TaskStatus } from "../lib/types";
import type { Strings } from "../lib/i18n";
import { initials } from "../lib/format";

export function statusLabel(t: Strings, status: TaskStatus): string {
  switch (status) {
    case "in_progress":
      return t.statusInProgress;
    case "blocked":
      return t.statusBlocked;
    case "done":
      return t.statusDone;
    default:
      return t.statusTodo;
  }
}

/** 20px tinted status chip — web .ui-chip: tinted bg + full-strength fg. */
export function StatusChip({
  t,
  status,
  onPress,
}: {
  t: Strings;
  status: TaskStatus;
  onPress?: () => void;
}) {
  const tone = statusTokens[status] ?? statusTokens.todo;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={[styles.chip, { backgroundColor: tone.bg }]}
    >
      <Text style={[styles.chipText, { color: tone.fg }]}>{statusLabel(t, status)}</Text>
    </Pressable>
  );
}

/** Task status glyph — the circle in the web list rows, colored by status. */
export function StatusCircle({ status }: { status: TaskStatus }) {
  const tone = statusTokens[status] ?? statusTokens.todo;
  const name =
    status === "done"
      ? "checkmark-circle"
      : status === "blocked"
        ? "remove-circle-outline"
        : status === "in_progress"
          ? "contrast-outline"
          : "ellipse-outline";
  const color = status === "todo" ? colors.textLow : tone.fg;
  return <Ionicons name={name} size={18} color={color} />;
}

/** Project color square — web sidebar/browse swatch (12px, radius 4). */
export function Swatch({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size >= 24 ? 6 : 4, backgroundColor: color }}
    />
  );
}

/** Initials avatar — web: #3d3d3d bg, #ccc fg. */
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

/** Surface card — #212121 on #121212, hairline border, radius 10, no shadow. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Hairline row divider (web uses dividers, not per-row borders). */
export function Hairline() {
  return <View style={styles.hairline} />;
}

/** Wordmark: orange bar riding the top-right of "XCollab" (login card). */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <View style={styles.brandRow}>
      <Text style={[styles.brand, { fontSize: size }]}>XCollab</Text>
      <View style={styles.brandBar} />
    </View>
  );
}

/** Primary filled button — web button/highEmphasis (#f55c36, radius 8). */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  children,
  testID,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryBtn,
        (pressed || disabled) && { opacity: 0.75 },
      ]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      {children ?? <Text style={styles.primaryBtnText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 22,
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: type.sm, fontFamily: font.medium, lineHeight: 15 },
  avatar: {
    backgroundColor: colors.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.avatarFg, fontFamily: font.semibold },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
  },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  brandRow: { alignSelf: "flex-start" },
  brand: { color: colors.text, fontFamily: font.semibold, letterSpacing: 0.2 },
  brandBar: {
    position: "absolute",
    top: -6,
    right: -10,
    width: 18,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: colors.brand,
  },
  primaryBtn: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    paddingHorizontal: spacing[5],
  },
  primaryBtnText: { color: colors.onPrimary, fontFamily: font.semibold, fontSize: type.lg },
});
