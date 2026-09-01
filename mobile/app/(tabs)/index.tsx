import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card, Hairline, PrimaryButton, StatusChip, Swatch } from "../../src/components/ui";
import { usePrograms, taskTotals } from "../../src/hooks/use-programs";
import { createProgram, getLedger } from "../../src/lib/api";
import { API_BASE, WORKSPACE } from "../../src/lib/config";
import { programColor, programDisplayName, programStatus } from "../../src/lib/format";
import { useUi } from "../../src/state/ui";
import { colors, font, radius, spacing, type } from "../../src/theme";

export default function Home() {
  const { t, language } = useUi();
  const { programs, error, refreshing, refresh } = usePrograms();
  const [mission, setMission] = useState("");
  const [creating, setCreating] = useState(false);
  const [ledgerCount, setLedgerCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      getLedger(API_BASE, WORKSPACE)
        .then((r) => setLedgerCount(r.verification.valid ? r.entries.length : null))
        .catch(() => setLedgerCount(null));
    }, []),
  );

  const create = async () => {
    const brief = mission.trim();
    if (!brief || creating) return;
    setCreating(true);
    try {
      const { program } = await createProgram(API_BASE, {
        workspaceId: WORKSPACE,
        mission: brief,
        language,
      });
      setMission("");
      refresh();
      router.push({ pathname: "/program/[id]", params: { id: program.id } });
    } catch {
      /* composer keeps the text for retry */
    } finally {
      setCreating(false);
    }
  };

  const totals = (programs ?? []).reduce(
    (acc, p) => {
      const { total } = taskTotals(p);
      acc.sections += p.packages.length;
      acc.tasks += total;
      return acc;
    },
    { sections: 0, tasks: 0 },
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />
      }
    >
      <Card style={styles.aiCard}>
        <View style={styles.aiHeader}>
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles" size={14} color={colors.brand} />
          </View>
          <Text style={styles.aiTitle}>{t.createWithAi}</Text>
        </View>
        <TextInput
          style={styles.aiInput}
          value={mission}
          onChangeText={setMission}
          placeholder={t.aiPlaceholder}
          placeholderTextColor={colors.textLow}
          multiline
          testID="mission-input"
        />
        <PrimaryButton onPress={() => void create()} disabled={creating} testID="mission-create">
          {creating ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.aiBtnText}>{t.generateProject}</Text>
          )}
        </PrimaryButton>
        {creating && <Text style={styles.creating}>{t.creating}</Text>}
      </Card>

      <View style={styles.statRow}>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>{t.statProjects}</Text>
          <Text style={styles.statValue}>{programs?.length ?? "–"}</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>{t.statSections}</Text>
          <Text style={styles.statValue}>{programs ? totals.sections : "–"}</Text>
        </Card>
      </View>
      <View style={styles.statRow}>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>{t.statTasks}</Text>
          <Text style={styles.statValue}>{programs ? totals.tasks : "–"}</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>{t.chainIntegrity}</Text>
          <View style={styles.chainRow}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.success }]}>
              {ledgerCount ?? "–"}
            </Text>
          </View>
          <Text style={styles.statHint}>{t.verifiedEntries}</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>{t.recentProjects}</Text>
        {error && <Text style={styles.error}>{t.loadError}</Text>}
        {programs?.length === 0 && !error && (
          <Text style={styles.empty}>{t.emptyPrograms}</Text>
        )}
        {(programs ?? []).map((program, index) => {
          const { total } = taskTotals(program);
          return (
            <View key={program.id}>
              {index > 0 && <Hairline />}
              <Pressable
                style={styles.projectRow}
                onPress={() =>
                  router.push({ pathname: "/program/[id]", params: { id: program.id } })
                }
              >
                <Swatch color={programColor(program.id)} size={20} />
                <Text style={styles.projectName} numberOfLines={1}>
                  {programDisplayName(program)}
                </Text>
                <Text style={styles.projectMeta}>
                  {program.packages.length} {t.sectionsCount} · {total} {t.tasksCount}
                </Text>
                <StatusChip t={t} status={programStatus(program)} />
              </Pressable>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  aiCard: { padding: spacing[4], gap: spacing[3] },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  aiIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.md,
    backgroundColor: colors.chipSelected,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: { color: colors.text, fontSize: type.lg, fontFamily: font.semibold },
  aiInput: {
    color: colors.text,
    fontSize: type.lg,
    fontFamily: font.regular,
    minHeight: 64,
    maxHeight: 140,
    textAlignVertical: "top",
    padding: 0,
  },
  aiBtnText: { color: colors.onPrimary, fontFamily: font.semibold, fontSize: type.md },
  creating: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  statRow: { flexDirection: "row", gap: spacing[3] },
  stat: { flex: 1, padding: spacing[4], gap: spacing[1] },
  statLabel: { color: colors.textMedium, fontSize: type.md, fontFamily: font.regular },
  statValue: { color: colors.text, fontSize: type.xxl, fontFamily: font.semibold },
  chainRow: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
  statHint: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  sectionTitle: {
    color: colors.text,
    fontSize: type.lg,
    fontFamily: font.semibold,
    padding: spacing[4],
    paddingBottom: spacing[2],
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  projectName: { flex: 1, color: colors.textHigh, fontSize: type.md, fontFamily: font.medium },
  projectMeta: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  empty: {
    color: colors.textMedium,
    fontSize: type.md,
    fontFamily: font.regular,
    padding: spacing[4],
    paddingTop: 0,
  },
  error: {
    color: colors.error,
    fontSize: type.md,
    fontFamily: font.regular,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
});
