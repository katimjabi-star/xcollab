import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Card, ProgressBar, StatusPill } from "../../src/components/ui";
import { usePrograms, taskTotals } from "../../src/hooks/use-programs";
import { updateTaskStatus } from "../../src/lib/api";
import { API_BASE, WORKSPACE } from "../../src/lib/config";
import type { TaskStatus } from "../../src/lib/types";
import { useUi } from "../../src/state/ui";
import { colors, spacing } from "../../src/theme";

/** Tap order: the natural forward path, then blocked, then back around. */
const CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "blocked",
  blocked: "todo",
};

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useUi();
  const { programs, refreshing, refresh, replaceProgram } = usePrograms();
  const [pendingTask, setPendingTask] = useState<string | null>(null);

  const program = programs?.find((p) => p.id === id) ?? null;

  const cycleStatus = async (taskId: string, status: TaskStatus) => {
    if (!program || pendingTask) return;
    setPendingTask(taskId);
    try {
      const { program: fresh } = await updateTaskStatus(API_BASE, {
        workspaceId: WORKSPACE,
        programId: program.id,
        taskId,
        status: CYCLE[status],
      });
      replaceProgram(fresh);
    } catch {
      /* leave the pill as-is; pull-to-refresh recovers */
    } finally {
      setPendingTask(null);
    }
  };

  const totals = program ? taskTotals(program) : { total: 0, done: 0 };

  return (
    <>
      <Stack.Screen options={{ title: program?.name ?? t.loading, headerBackTitle: "" }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        {program && (
          <>
            <Card>
              <Text style={styles.mission} numberOfLines={4}>
                {program.mission}
              </Text>
              <Text style={styles.meta}>
                {t.timeline}: {program.timeline.start} → {program.timeline.end}
              </Text>
              <ProgressBar done={totals.done} total={totals.total} />
              <Text style={styles.meta}>
                {totals.done}/{totals.total} {t.doneCount}
              </Text>
            </Card>

            {program.packages.map((pkg) => (
              <View key={pkg.id} style={styles.section}>
                <Text style={styles.sectionName}>{pkg.name}</Text>
                <Text style={styles.sectionScope} numberOfLines={2}>
                  {pkg.scope}
                </Text>
                {pkg.tasks.map((task) => (
                  <View
                    key={task.id}
                    style={[styles.taskRow, pendingTask === task.id && { opacity: 0.5 }]}
                  >
                    <View style={styles.taskMain}>
                      <Text style={styles.taskName}>{task.name}</Text>
                      <Text style={styles.taskMeta}>
                        {task.assignee ?? task.assigneeRole ?? t.unassigned}
                        {task.dueDate ? ` · ${t.due} ${task.dueDate}` : ""}
                      </Text>
                    </View>
                    <StatusPill
                      t={t}
                      status={task.status}
                      onPress={() => void cycleStatus(task.id, task.status)}
                    />
                  </View>
                ))}
              </View>
            ))}

            {program.milestones.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionName}>{t.milestones}</Text>
                {program.milestones.map((m) => (
                  <View key={m.id} style={styles.taskRow}>
                    <Text style={styles.taskName}>{m.name}</Text>
                    <Text style={styles.taskMeta}>{m.dueDate}</Text>
                  </View>
                ))}
              </View>
            )}

            {program.risks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionName}>{t.risks}</Text>
                {program.risks.map((r) => (
                  <View key={r.id} style={styles.taskRow}>
                    <Text style={styles.taskName}>{r.title}</Text>
                    <Text style={[styles.severity, severityStyle(r.severity)]}>{r.severity}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

function severityStyle(severity: string) {
  if (severity === "critical" || severity === "high") return { color: colors.bad };
  if (severity === "medium") return { color: colors.warn };
  return { color: colors.textDim };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  mission: { color: colors.text, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.textDim, fontSize: 13 },
  section: { gap: spacing.sm },
  sectionName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sectionScope: { color: colors.textDim, fontSize: 13 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  taskMain: { flex: 1, gap: 2 },
  taskName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  taskMeta: { color: colors.textDim, fontSize: 12 },
  severity: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
});
