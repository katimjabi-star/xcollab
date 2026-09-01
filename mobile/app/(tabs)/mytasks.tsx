import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusPill } from "../../src/components/ui";
import { usePrograms } from "../../src/hooks/use-programs";
import type { Task } from "../../src/lib/types";
import { useAuth } from "../../src/state/auth";
import { useUi } from "../../src/state/ui";
import { colors, spacing } from "../../src/theme";

interface Row {
  programId: string;
  programName: string;
  task: Task;
}

export default function MyTasks() {
  const { t } = useUi();
  const { session } = useAuth();
  const { programs, error, refreshing, refresh } = usePrograms();

  const rows: Row[] = [];
  for (const program of programs ?? []) {
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (task.assignee === session?.username) {
          rows.push({ programId: program.id, programName: program.name, task });
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
      {error && <Text style={styles.error}>{t.loadError}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(row) => `${row.programId}:${row.task.id}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          programs && !error ? <Text style={styles.empty}>{t.emptyMyTasks}</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({ pathname: "/program/[id]", params: { id: item.programId } })
            }
          >
            <View style={styles.main}>
              <Text style={styles.name}>{item.task.name}</Text>
              <Text style={styles.meta}>
                {item.programName}
                {item.task.dueDate ? ` · ${t.due} ${item.task.dueDate}` : ""}
              </Text>
            </View>
            <StatusPill t={t} status={item.task.status} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.md },
  error: { color: colors.bad, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  empty: { color: colors.textDim, textAlign: "center", marginTop: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  main: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  meta: { color: colors.textDim, fontSize: 12 },
});
