import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card, Hairline } from "../../src/components/ui";
import { getLedger } from "../../src/lib/api";
import { API_BASE, WORKSPACE } from "../../src/lib/config";
import type { LedgerResult } from "../../src/lib/types";
import { useUi } from "../../src/state/ui";
import { colors, font, radius, spacing, type } from "../../src/theme";

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
  const valid = result?.verification.valid ?? false;

  return (
    <View style={styles.screen}>
      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.seq)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {result && (
              <Card style={styles.chainCard}>
                <Ionicons
                  name={valid ? "shield-checkmark" : "alert-circle"}
                  size={18}
                  color={valid ? colors.success : colors.error}
                />
                <View>
                  <Text style={[styles.chainState, { color: valid ? colors.success : colors.error }]}>
                    {valid ? t.chainValid : t.chainInvalid}
                  </Text>
                  <Text style={styles.chainMeta}>
                    {result.entries.length} {t.verifiedEntries}
                  </Text>
                </View>
              </Card>
            )}
            {error && <Text style={styles.error}>{t.loadError}</Text>}
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            {index > 0 && <Hairline />}
            <View style={styles.row}>
              <Text style={styles.seq}>#{item.seq}</Text>
              <View style={styles.main}>
                <Text style={styles.action}>{item.action}</Text>
                <Text style={styles.meta}>
                  {item.actor.kind === "ai" ? t.actorAi : t.actorHuman} · {item.actor.id}
                  {item.modelId ? ` · ${item.modelId}` : ""}
                </Text>
              </View>
              <View style={styles.side}>
                {item.actor.kind === "ai" && (
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={10} color={colors.brand} />
                  </View>
                )}
                <Text style={styles.time}>
                  {item.occurredAt.replace("T", " ").slice(5, 16)}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing[4], paddingBottom: spacing[8] },
  header: { gap: spacing[2], marginBottom: spacing[3] },
  chainCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
  },
  chainState: { fontSize: type.md, fontFamily: font.semibold },
  chainMeta: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  error: { color: colors.error, fontSize: type.md, fontFamily: font.regular },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  seq: {
    color: colors.textLow,
    fontSize: type.sm,
    fontFamily: font.medium,
    minWidth: 34,
    fontVariant: ["tabular-nums"],
  },
  main: { flex: 1, gap: 2 },
  action: { color: colors.textHigh, fontSize: type.md, fontFamily: font.medium },
  meta: { color: colors.textLow, fontSize: type.sm, fontFamily: font.regular },
  side: { alignItems: "flex-end", gap: 4 },
  aiBadge: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.chipSelected,
    alignItems: "center",
    justifyContent: "center",
  },
  time: {
    color: colors.textLow,
    fontSize: type.xs,
    fontFamily: font.regular,
    fontVariant: ["tabular-nums"],
  },
});
