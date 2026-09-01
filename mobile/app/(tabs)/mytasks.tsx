import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Card, StatusChip, StatusCircle, Swatch } from "../../src/components/ui";
import { usePrograms } from "../../src/hooks/use-programs";
import { formatIsoDate, programColor, programDisplayName } from "../../src/lib/format";
import type { Task } from "../../src/lib/types";
import { useAuth } from "../../src/state/auth";
import { useUi } from "../../src/state/ui";
import { colors, font, spacing, type } from "../../src/theme";

interface Row {
  programId: string;
  programName: string;
  swatch: string;
  task: Task;
}

export default function MyTasks() {
  const { t, language } = useUi();
  const { session } = useAuth();
  const { programs, error, refreshing, refresh } = usePrograms();

  const rows: Row[] = [];
  for (const program of programs ?? []) {
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (task.assignee === session?.username) {
          rows.push({
            programId: program.id,
            programName: programDisplayName(program),
            swatch: programColor(program.id),
            task,
          });
        }
      }
    }
  }
  // Open work first, then by due date.
  rows.sort((a, b) => {
    const doneDelta = Number(a.task.status === "done") - Number(b.task.status === "done");
    if (doneDelta !== 0) return doneDelta;
    return (a.task.dueDate ?? "9999").localeCompare(b.task.dueDate ?? "9999");
  });

  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={(row) => `${row.programId}:${row.task.id}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.error}>{t.loadError}</Text> : null
        }
        ListEmptyComponent={
          programs && !error ? <Text style={styles.empty}>{t.emptyMyTasks}</Text> : null
        }
        renderItem={({ item, index }) => (
          <Card style={index > 0 ? styles.cardGap : undefined}>
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({ pathname: "/program/[id]", params: { id: item.programId } })
              }
            >
              <StatusCircle status={item.task.status} />
              <View style={styles.main}>
                <Text style={styles.name}>{item.task.name}</Text>
                <View style={styles.metaRow}>
                  <Swatch color={item.swatch} size={10} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.programName}
                    {item.task.dueDate
                      ? ` · ${t.due} ${formatIsoDate(item.task.dueDate, language)}`
                      : ""}
                  </Text>
                </View>
              </View>
              <StatusChip t={t} status={item.task.status} />
            </Pressable>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing[4], paddingBottom: spacing[8] },
  cardGap: {},
  error: {
    color: colors.error,
    fontSize: type.md,
    fontFamily: font.regular,
    marginBottom: spacing[2],
  },
  empty: { color: colors.textMedium, fontSize: type.md, fontFamily: font.regular },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
  },
  main: { flex: 1, gap: 3 },
  name: { color: colors.textHigh, fontSize: type.md, fontFamily: font.medium },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
  meta: { color: colors.textLow, fontSize: type.sm, fontFamily: font.regular, flexShrink: 1 },
});
