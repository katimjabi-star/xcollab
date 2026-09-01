import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Card, ProgressBar } from "../../src/components/ui";
import { usePrograms, taskTotals } from "../../src/hooks/use-programs";
import { createProgram } from "../../src/lib/api";
import { API_BASE, WORKSPACE } from "../../src/lib/config";
import { useUi } from "../../src/state/ui";
import { colors, spacing } from "../../src/theme";

export default function Programs() {
  const { t, language } = useUi();
  const { programs, error, refreshing, refresh } = usePrograms();
  const [mission, setMission] = useState("");
  const [creating, setCreating] = useState(false);

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
      /* stay on screen; the composer keeps the text for retry */
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={mission}
          onChangeText={setMission}
          placeholder={t.missionPlaceholder}
          placeholderTextColor={colors.textDim}
          multiline
          testID="mission-input"
        />
        <Pressable
          style={[styles.createBtn, creating && { opacity: 0.7 }]}
          onPress={() => void create()}
          disabled={creating}
          testID="mission-create"
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createText}>{t.createProgram}</Text>
          )}
        </Pressable>
      </View>
      {creating && <Text style={styles.creating}>{t.creating}</Text>}
      {error && <Text style={styles.error}>{t.loadError}</Text>}
      <FlatList
        data={programs ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          programs && !error ? <Text style={styles.empty}>{t.emptyPrograms}</Text> : null
        }
        renderItem={({ item }) => {
          const { total, done } = taskTotals(item);
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/program/[id]", params: { id: item.id } })}
            >
              <Card>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.packages.length} {t.sectionsCount} · {total} {t.tasksCount} · {done}{" "}
                  {t.doneCount}
                </Text>
                <ProgressBar done={done} total={total} />
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  createText: { color: "#fff", fontWeight: "700" },
  creating: { color: colors.textDim, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  error: { color: colors.bad, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: { color: colors.textDim, textAlign: "center", marginTop: spacing.xl },
  name: { color: colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.textDim, fontSize: 13 },
});
