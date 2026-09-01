import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { getLedger } from "../../src/lib/api";
import { API_BASE, WORKSPACE } from "../../src/lib/config";
import type { LedgerResult } from "../../src/lib/types";
import { useUi } from "../../src/state/ui";
import { colors, spacing } from "../../src/theme";

export default function Ledger() {
  const { t } = useUi();
  const [result, setResult] = useState<LedgerResult | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    getLedger(API_BASE, WORKSPACE)
      .then((next) => {
        setResult(next);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }, []);

  // Focus, not mount: the ledger must show entries written since login.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const entries = result ? [...result.entries].reverse() : [];

  return (
    <View style={styles.screen}>
      {result && (
        <View
          style={[
            styles.badge,
            { borderColor: result.verification.valid ? colors.good : colors.bad },
          ]}
        >
          <Text
            style={{
              color: result.verification.valid ? colors.good : colors.bad,
              fontWeight: "700",
              fontSize: 12,
            }}
          >
            {result.verification.valid ? t.chainValid : t.chainInvalid}
          </Text>
        </View>
      )}
      {error && <Text style={styles.error}>{t.loadError}</Text>}
      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.seq)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.seq}>#{item.seq}</Text>
            <View style={styles.main}>
              <Text style={styles.action}>{item.action}</Text>
              <Text style={styles.meta}>
                {item.actor.kind === "ai" ? t.actorAi : t.actorHuman} · {item.actor.id}
                {item.modelId ? ` · ${item.modelId}` : ""}
              </Text>
              <Text style={styles.time}>{item.occurredAt.replace("T", " ").slice(0, 19)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  error: { color: colors.bad, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
  },
  seq: { color: colors.accent, fontWeight: "700", fontSize: 13, minWidth: 40 },
  main: { flex: 1, gap: 2 },
  action: { color: colors.text, fontWeight: "600", fontSize: 14 },
  meta: { color: colors.textDim, fontSize: 12 },
  time: { color: colors.textDim, fontSize: 11 },
});
