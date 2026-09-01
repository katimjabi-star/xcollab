import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { deleteTask, updateTask, type WorkspaceUser } from "../lib/api";
import { API_BASE, WORKSPACE } from "../lib/config";
import type { Program, Task, TaskStatus } from "../lib/types";
import type { Strings } from "../lib/i18n";
import { colors, font, radius, spacing, statusTokens, type } from "../theme";
import { Avatar, statusLabel } from "./ui";
import { TaskSubtasks } from "./task-subtasks";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

interface Props {
  t: Strings;
  programId: string;
  /** Latest task snapshot (parent re-derives it from the fresh program). */
  task: Task | null;
  users: WorkspaceUser[];
  onProgram: (program: Program) => void;
  onClose: () => void;
}

/** Bottom-sheet task editor — the mobile counterpart of the web task panel:
    status, assignee, description, subtasks checklist, delete. */
export function TaskSheet({ t, programId, task, users, onProgram, onClose }: Props) {
  const [description, setDescription] = useState(task?.description ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDescription(task?.description ?? "");
  }, [task?.id]);

  if (!task) return null;
  const ids = { workspaceId: WORKSPACE, programId, taskId: task.id };

  const run = async (op: () => Promise<{ program: Program }>) => {
    if (busy) return;
    setBusy(true);
    try {
      const { program } = await op();
      onProgram(program);
    } catch {
      /* sheet stays; the row keeps its previous state */
    } finally {
      setBusy(false);
    }
  };

  const saveDescription = () => {
    const trimmed = description.trim();
    if ((task.description ?? "") === trimmed) return;
    void run(() => updateTask(API_BASE, { ...ids, patch: { description: trimmed || null } }));
  };

  const confirmDelete = () => {
    Alert.alert(t.deleteTask, t.deleteTaskConfirm, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.delete,
        style: "destructive",
        onPress: () => {
          void run(() => deleteTask(API_BASE, ids)).then(onClose);
        },
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.name}>{task.name}</Text>
            {task.estimateDays > 0 && (
              <Text style={styles.meta}>
                {t.estimateField}: {task.estimateDays}
                {t.daysShort}
                {task.dueDate ? `  ·  ${t.due} ${task.dueDate}` : ""}
              </Text>
            )}

            <Text style={styles.label}>{t.statusField}</Text>
            <View style={styles.chipRow}>
              {STATUSES.map((status) => {
                const tone = statusTokens[status];
                const active = task.status === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() =>
                      void run(() => updateTask(API_BASE, { ...ids, patch: { status } }))
                    }
                    style={[
                      styles.statusChip,
                      { backgroundColor: tone.bg },
                      active && { borderColor: tone.fg, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.statusChipText, { color: tone.fg }]}>
                      {statusLabel(t, status)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t.assigneeField}</Text>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() =>
                  void run(() => updateTask(API_BASE, { ...ids, patch: { assignee: null } }))
                }
                style={[styles.userChip, !task.assignee && styles.userChipActive]}
              >
                <Text style={[styles.userChipText, !task.assignee && styles.userChipTextActive]}>
                  {t.unassigned}
                </Text>
              </Pressable>
              {users.map((user) => {
                const active = task.assignee === user.username;
                return (
                  <Pressable
                    key={user.username}
                    onPress={() =>
                      void run(() =>
                        updateTask(API_BASE, { ...ids, patch: { assignee: user.username } }),
                      )
                    }
                    style={[styles.userChip, active && styles.userChipActive]}
                  >
                    <Avatar name={user.username} size={18} />
                    <Text style={[styles.userChipText, active && styles.userChipTextActive]}>
                      {user.username}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t.descriptionField}</Text>
            <TextInput
              style={styles.description}
              value={description}
              onChangeText={setDescription}
              onBlur={saveDescription}
              placeholder={t.noDescription}
              placeholderTextColor={colors.textLow}
              multiline
            />

            <Text style={styles.label}>{t.subtasksField}</Text>
            <TaskSubtasks t={t} ids={ids} subtasks={task.subtasks ?? []} run={run} />

            <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={15} color={colors.error} />
              <Text style={styles.deleteText}>{t.deleteTask}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "84%",
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing[2],
  },
  content: { padding: spacing[5], gap: spacing[2], paddingBottom: spacing[8] },
  name: { color: colors.text, fontSize: type.xl, fontFamily: font.semibold },
  meta: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.regular },
  label: {
    color: colors.textLow,
    fontSize: type.xs,
    fontFamily: font.medium,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing[4],
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  statusChip: {
    height: 28,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipText: { fontSize: type.sm, fontFamily: font.medium },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.surfaceThin,
  },
  userChipActive: { backgroundColor: colors.chipSelected, borderColor: colors.chipSelectedBorder, borderWidth: 1 },
  userChipText: { color: colors.textMedium, fontSize: type.sm, fontFamily: font.medium },
  userChipTextActive: { color: colors.textBrand },
  description: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    color: colors.text,
    padding: spacing[3],
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: type.md,
    fontFamily: font.regular,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    marginTop: spacing[6],
    height: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.errorTint,
    backgroundColor: colors.errorTint,
  },
  deleteText: { color: colors.error, fontSize: type.md, fontFamily: font.medium },
});
