import { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar, Card, Hairline, ProgressBar, StatusChip, Swatch } from "../../src/components/ui";
import { ProgramOverview } from "../../src/components/program-overview";
import { TaskSheet } from "../../src/components/task-sheet";
import { usePrograms, taskTotals } from "../../src/hooks/use-programs";
import { createTask, listUsers, updateTask, type WorkspaceUser } from "../../src/lib/api";
import { API_BASE, WORKSPACE } from "../../src/lib/config";
import { formatIsoDate, programColor, programDisplayName } from "../../src/lib/format";
import type { Task } from "../../src/lib/types";
import { useUi } from "../../src/state/ui";
import { colors, font, radius, spacing, type } from "../../src/theme";

type ViewTab = "list" | "overview";

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useUi();
  const { programs, refreshing, refresh, replaceProgram } = usePrograms();
  const [tab, setTab] = useState<ViewTab>("list");
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const program = programs?.find((p) => p.id === id) ?? null;
  const openTask: Task | null =
    (openTaskId &&
      program?.packages.flatMap((pkg) => pkg.tasks).find((task) => task.id === openTaskId)) ||
    null;

  useEffect(() => {
    listUsers(API_BASE, WORKSPACE)
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const toggleDone = (task: Task) => {
    if (!program) return;
    void updateTask(API_BASE, {
      workspaceId: WORKSPACE,
      programId: program.id,
      taskId: task.id,
      patch: { status: task.status === "done" ? "todo" : "done" },
    })
      .then(({ program: fresh }) => replaceProgram(fresh))
      .catch(() => undefined);
  };

  const submitDraft = (packageId: string) => {
    const name = (drafts[packageId] ?? "").trim();
    if (!name || !program) return;
    setDrafts((prev) => ({ ...prev, [packageId]: "" }));
    void createTask(API_BASE, { workspaceId: WORKSPACE, programId: program.id, packageId, name })
      .then(({ program: fresh }) => replaceProgram(fresh))
      .catch(() => setDrafts((prev) => ({ ...prev, [packageId]: name })));
  };

  const totals = program ? taskTotals(program) : { total: 0, done: 0 };

  return (
    <>
      <Stack.Screen options={{ title: "", headerBackTitle: "" }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
              {formatIsoDate(program.timeline.end, language)}
            </Text>
            <View style={styles.progressRow}>
              <View style={{ flex: 1 }}>
                <ProgressBar done={totals.done} total={totals.total} />
              </View>
              <Text style={styles.progressText}>
                {totals.done}/{totals.total}
              </Text>
            </View>

            <View style={styles.tabs}>
              {(["list", "overview"] as const).map((next) => (
                <Pressable
                  key={next}
                  onPress={() => setTab(next)}
                  style={[styles.tabBtn, tab === next && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, tab === next && styles.tabTextActive]}>
                    {next === "list" ? t.viewList : t.viewOverview}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === "overview" ? (
              <ProgramOverview t={t} program={program} language={language} />
            ) : (
              program.packages.map((pkg) => {
                const done = pkg.tasks.filter((task) => task.status === "done").length;
                return (
                  <View key={pkg.id} style={styles.section}>
                    <View style={styles.sectionHead}>
                      <Text style={styles.sectionName}>{pkg.name}</Text>
                      <Text style={styles.sectionMeta}>
                        {done}/{pkg.tasks.length}
                      </Text>
                    </View>
                    <Card>
                      {pkg.tasks.map((task, index) => (
                        <View key={task.id}>
                          {index > 0 && <Hairline />}
                          <Pressable style={styles.taskRow} onPress={() => setOpenTaskId(task.id)}>
                            <Pressable hitSlop={8} onPress={() => toggleDone(task)}>
                              <Ionicons
                                name={
                                  task.status === "done" ? "checkmark-circle" : "ellipse-outline"
                                }
                                size={20}
                                color={task.status === "done" ? colors.success : colors.textLow}
                              />
                            </Pressable>
                            <View style={styles.taskMain}>
                              <Text
                                style={[
                                  styles.taskName,
                                  task.status === "done" && styles.taskNameDone,
                                ]}
                                numberOfLines={2}
                              >
                                {task.name}
                              </Text>
                              {(task.dueDate != null || (task.subtasks?.length ?? 0) > 0) && (
                                <Text style={styles.taskMeta}>
                                  {task.dueDate ? formatIsoDate(task.dueDate, language) : ""}
                                  {task.dueDate && task.subtasks?.length ? "  ·  " : ""}
                                  {task.subtasks?.length
                                    ? `${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length} ☑`
                                    : ""}
                                </Text>
                              )}
                            </View>
                            {task.assignee && <Avatar name={task.assignee} size={22} />}
                            {task.status !== "done" && task.status !== "todo" && (
                              <StatusChip t={t} status={task.status} />
                            )}
                          </Pressable>
                        </View>
                      ))}
                      <Hairline />
                      <View style={styles.addRow}>
                        <Ionicons name="add" size={18} color={colors.textLow} />
                        <TextInput
                          style={styles.addInput}
                          value={drafts[pkg.id] ?? ""}
                          onChangeText={(text) =>
                            setDrafts((prev) => ({ ...prev, [pkg.id]: text }))
                          }
                          placeholder={t.addTask}
                          placeholderTextColor={colors.textLow}
                          onSubmitEditing={() => submitDraft(pkg.id)}
                          returnKeyType="done"
                          submitBehavior="submit"
                        />
                      </View>
                    </Card>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
      {openTask && program && (
        <TaskSheet
          t={t}
          programId={program.id}
          task={openTask}
          users={users}
          onProgram={replaceProgram}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[8] * 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  title: { flex: 1, color: colors.text, fontSize: type.xl, fontFamily: font.semibold },
  dates: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  progressText: {
    color: colors.textMedium,
    fontSize: type.sm,
    fontFamily: font.medium,
    fontVariant: ["tabular-nums"],
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.full,
    padding: 3,
    marginVertical: spacing[2],
    alignSelf: "flex-start",
  },
  tabBtn: {
    paddingHorizontal: spacing[4],
    height: 30,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: { backgroundColor: colors.sheet },
  tabText: { color: colors.textMedium, fontSize: type.md, fontFamily: font.medium },
  tabTextActive: { color: colors.text },
  section: { gap: spacing[2], marginTop: spacing[2] },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionName: { color: colors.text, fontSize: type.md, fontFamily: font.semibold },
  sectionMeta: {
    color: colors.textLow,
    fontSize: type.sm,
    fontFamily: font.regular,
    fontVariant: ["tabular-nums"],
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  taskMain: { flex: 1, gap: 2 },
  taskName: { color: colors.textHigh, fontSize: type.md, fontFamily: font.regular },
  taskNameDone: { color: colors.textLow, textDecorationLine: "line-through" },
  taskMeta: { color: colors.textLow, fontSize: type.sm, fontFamily: font.regular },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  addInput: {
    flex: 1,
    color: colors.text,
    fontSize: type.md,
    fontFamily: font.regular,
    paddingVertical: spacing[2],
  },
});
