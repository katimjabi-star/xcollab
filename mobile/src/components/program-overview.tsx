import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Program } from "../lib/types";
import type { Strings } from "../lib/i18n";
import { formatIsoDate } from "../lib/format";
import { colors, font, spacing, statusTokens, type } from "../theme";
import { Card, Hairline } from "./ui";

/** Overview tab: milestones, risks, teams — the web project sidebar facts. */
export function ProgramOverview({
  t,
  program,
  language,
}: {
  t: Strings;
  program: Program;
  language: "en" | "ar";
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.mission}>{program.mission}</Text>

      {program.milestones.length > 0 && (
        <>
          <Text style={styles.label}>{t.milestones}</Text>
          <Card>
            {program.milestones.map((m, index) => (
              <View key={m.id}>
                {index > 0 && <Hairline />}
                <View style={styles.row}>
                  <Ionicons name="flag-outline" size={15} color={colors.textMedium} />
                  <Text style={styles.rowText}>{m.name}</Text>
                  <Text style={styles.rowMeta}>{formatIsoDate(m.dueDate, language)}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {program.risks.length > 0 && (
        <>
          <Text style={styles.label}>{t.risks}</Text>
          <Card>
            {program.risks.map((r, index) => (
              <View key={r.id}>
                {index > 0 && <Hairline />}
                <View style={styles.row}>
                  <Ionicons name="warning-outline" size={15} color={severityFg(r.severity)} />
                  <Text style={styles.rowText}>{r.title}</Text>
                  <View style={[styles.severity, { backgroundColor: severityBg(r.severity) }]}>
                    <Text style={[styles.severityText, { color: severityFg(r.severity) }]}>
                      {r.severity}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {program.teams.length > 0 && (
        <>
          <Text style={styles.label}>{t.teamsField}</Text>
          <Card>
            {program.teams.map((team, index) => (
              <View key={team.id}>
                {index > 0 && <Hairline />}
                <View style={styles.row}>
                  <Ionicons name="people-outline" size={15} color={colors.textMedium} />
                  <Text style={styles.rowText}>{team.name}</Text>
                  <Text style={styles.rowMeta}>
                    {team.kind === "vendor" ? t.vendorKind : t.internalKind}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </View>
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
  wrap: { gap: spacing[2] },
  mission: {
    color: colors.textMedium,
    fontSize: type.md,
    fontFamily: font.regular,
    lineHeight: 20,
  },
  label: {
    color: colors.textLow,
    fontSize: type.xs,
    fontFamily: font.medium,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing[3],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  rowText: { flex: 1, color: colors.textHigh, fontSize: type.md, fontFamily: font.regular },
  rowMeta: { color: colors.textLow, fontSize: type.sm, fontFamily: font.regular },
  severity: {
    height: 20,
    paddingHorizontal: spacing[2],
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  severityText: { fontSize: type.xs, fontFamily: font.medium, textTransform: "uppercase" },
});
