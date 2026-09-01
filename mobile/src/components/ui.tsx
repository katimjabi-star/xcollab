import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, statusColors } from "../theme";
import type { TaskStatus } from "../lib/types";
import type { Strings } from "../lib/i18n";

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

export function StatusPill({
  t,
  status,
  onPress,
}: {
  t: Strings;
  status: TaskStatus;
  onPress?: () => void;
}) {
  const tint = statusColors[status] ?? colors.textDim;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={[styles.pill, { borderColor: tint }]}
    >
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.pillText, { color: tint }]}>{statusLabel(t, status)}</Text>
    </Pressable>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const ratio = total > 0 ? done / total : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.brandRow}>
      <Text style={[styles.brand, { fontSize: size }]}>
        X<Text style={{ color: colors.accent }}>Collab</Text>
      </Text>
      <View style={styles.brandBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: "600" },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  brandRow: { alignItems: "flex-start", gap: 4 },
  brand: { color: colors.text, fontWeight: "800", letterSpacing: 0.5 },
  brandBar: { width: 34, height: 4, borderRadius: 2, backgroundColor: colors.accent },
});
