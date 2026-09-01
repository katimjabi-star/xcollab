import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Avatar, Card, Hairline, StatusChip, StatusCircle, Swatch } from "../../src/components/ui";
import { usePrograms, taskTotals } from "../../src/hooks/use-programs";
import { updateTaskStatus } from "../../src/lib/api";
import { API_BASE, WORKSPACE } from "../../src/lib/config";
import { formatIsoDate, programColor, programDisplayName } from "../../src/lib/format";
import type { TaskStatus } from "../../src/lib/types";
import { useUi } from "../../src/state/ui";
import { colors, font, spacing, statusTokens, type } from "../../src/theme";

/** Tap order: the natural forward path, then blocked, then back around. */
const CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "blocked",
  blocked: "todo",
};

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useUi();
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
      /* leave the chip as-is; pull-to-refresh recovers */
    } finally {
      setPendingTask(null);
    }
  };

  const totals = program ? taskTotals(program) : { total: 0, done: 0 };

  return (
    <>
      <Stack.Screen options={{ title: "", headerBackTitle: "" }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />
        }
      >
        {program && (
          <>
            <View style={styles.titleRow}>
              <Swatch color={programColor(program.id)} size={26} />
              <Text style={styles.title} numberOfLines={2}>
                {programDisplayName(program)}
              </Text>
            </View>
            <Text style={styles.dates}>
              {formatIsoDate(program.timeline.start, language)} →{" "}
              {formatIsoDate(program.timeline.end, language)} · {totals.done}/{totals.total}{" "}
              {t.doneCount}
            </Text>
            <Text style={styles.mission} numberOfLines={3}>
              {program.mission}
            </Text>

            {program.packages.map((pkg) => (
              <View key={pkg.id} style={styles.section}>
                <Text style={styles.sectionName}>{pkg.name}</Text>
                <Card>
                  {pkg.tasks.map((task, index) => (
                    <View key={task.id}>
                      {index > 0 && <Hairline />}
                      <View
                        style={[styles.taskRow, pendingTask === task.id && { opacity: 0.5 }]}
                      >
                        <StatusCircle status={task.status} />
                        <View style={styles.taskMain}>
                          <Text style={styles.taskName}>{task.name}</Text>
                          {(task.assignee ?? task.dueDate) && (
                            <Text style={styles.taskMeta}>
                              {task.assignee ?? ""}
                              {task.assignee && task.dueDate ? " · " : ""}
                              {task.dueDate ? formatIsoDate(task.dueDate, language) : ""}
                            </Text>
                          )}
                        </View>
                        {task.assignee && <Avatar name={task.assignee} size={22} />}
                        <StatusChip
                          t={t}
                          status={task.status}
                          onPress={() => void cycleStatus(task.id, task.status)}
                        />
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            ))}

            {program.milestones.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionName}>{t.milestones}</Text>
                <Card>
                  {program.milestones.map((m, index) => (
                    <View key={m.id}>
                      {index > 0 && <Hairline />}
                      <View style={styles.taskRow}>
                        <Text style={[styles.taskName, { flex: 1 }]}>{m.name}</Text>
                        <Text style={styles.taskMeta}>{formatIsoDate(m.dueDate, language)}</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {program.risks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionName}>{t.risks}</Text>
                <Card>
                  {program.risks.map((r, index) => (
                    <View key={r.id}>
                      {index > 0 && <Hairline />}
                      <View style={styles.taskRow}>
                        <Text style={[styles.taskName, { flex: 1 }]}>{r.title}</Text>
                        <View style={[styles.severity, { backgroundColor: severityBg(r.severity) }]}>
                          <Text style={[styles.severityText, { color: severityFg(r.severity) }]}>
                            {r.severity}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

function severityFg(severity: string): string {
  if (severity === "critical" || severity === "high") return statusTokens.blocked.fg;
  if (severity === "medium") return statusTokens.in_progress.fg;
  return statusTokens.todo.fg;
}

function severityBg(severity: string): string {
  if (severity === "critical" || severity === "high") return statusTokens.blocked.bg;
  if (severity === "medium") return statusTokens.in_progress.bg;
  return statusTokens.todo.bg;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[8] },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  title: { flex: 1, color: colors.text, fontSize: type.xl, fontFamily: font.semibold },
  dates: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  mission: {
    color: colors.textMedium,
    fontSize: type.md,
    fontFamily: font.regular,
    lineHeight: 19,
    marginBottom: spacing[2],
  },
  section: { gap: spacing[2], marginTop: spacing[3] },
  sectionName: { color: colors.text, fontSize: type.md, fontFamily: font.semibold },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  taskMain: { flex: 1, gap: 2 },
  taskName: { color: colors.textHigh, fontSize: type.md, fontFamily: font.regular },
  taskMeta: { color: colors.textLow, fontSize: type.sm, fontFamily: font.regular },
  severity: {
    height: 22,
    paddingHorizontal: spacing[2],
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  severityText: { fontSize: type.xs, fontFamily: font.medium, textTransform: "uppercase" },
});
