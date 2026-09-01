import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { addSubtask, deleteSubtask, updateSubtask, type TaskMutationResult } from "../lib/api";
import { API_BASE } from "../lib/config";
import type { Subtask } from "../lib/types";
import type { Strings } from "../lib/i18n";
import { colors, font, radius, spacing, type } from "../theme";
import { Hairline } from "./ui";

interface Ids {
  workspaceId: string;
  programId: string;
  taskId: string;
}

/** Subtasks checklist inside the task sheet: toggle, delete, append. */
export function TaskSubtasks({
  t,
  ids,
  subtasks,
  run,
}: {
  t: Strings;
  ids: Ids;
  subtasks: Subtask[];
  run: (op: () => Promise<TaskMutationResult>) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <View style={styles.box}>
      {subtasks.map((subtask, index) => (
        <View key={subtask.id}>
          {index > 0 && <Hairline />}
          <View style={styles.row}>
            <Pressable
              hitSlop={8}
              onPress={() =>
                void run(() =>
                  updateSubtask(API_BASE, {
                    ...ids,
                    subtaskId: subtask.id,
                    patch: { done: !subtask.done },
                  }),
                )
              }
            >
              <Ionicons
                name={subtask.done ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={subtask.done ? colors.success : colors.textLow}
              />
            </Pressable>
            <Text style={[styles.text, subtask.done && styles.done]}>{subtask.name}</Text>
            <Pressable
              hitSlop={8}
              onPress={() => void run(() => deleteSubtask(API_BASE, { ...ids, subtaskId: subtask.id }))}
            >
              <Ionicons name="close" size={16} color={colors.textLow} />
            </Pressable>
          </View>
        </View>
      ))}
      <View style={[styles.add, subtasks.length > 0 && styles.addDivider]}>
        <Ionicons name="add" size={18} color={colors.textLow} />
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t.addSubtask}
          placeholderTextColor={colors.textLow}
          onSubmitEditing={() => {
            const name = draft.trim();
            if (!name) return;
            setDraft("");
            void run(() => addSubtask(API_BASE, { ...ids, name }));
          }}
          returnKeyType="done"
          submitBehavior="submit"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  text: { flex: 1, color: colors.textHigh, fontSize: type.md, fontFamily: font.regular },
  done: { color: colors.textLow, textDecorationLine: "line-through" },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  addDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: type.md,
    fontFamily: font.regular,
    paddingVertical: spacing[2],
  },
});
