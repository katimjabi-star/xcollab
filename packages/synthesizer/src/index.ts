import type { Language, Program, Task, WorkPackage } from "@xcollab/core";

export interface ProgramBrief {
  mission: string;
  language: Language;
  timeline?: { start: string; end: string };
  teamHints?: string[];
}

const DEFAULT_TIMELINE = { start: "2026-09-01", end: "2026-12-01" };

interface PhaseTemplate {
  key: string;
  name: Record<Language, string>;
  scope: Record<Language, string>;
  tasks: Record<Language, string[]>;
}

const PHASES: PhaseTemplate[] = [
  {
    key: "discovery",
    name: { en: "Discovery & Requirements", ar: "الاستكشاف والمتطلبات" },
    scope: {
      en: "Clarify mission scope, stakeholders, and success criteria",
      ar: "توضيح نطاق المهمة وأصحاب المصلحة ومعايير النجاح",
    },
    tasks: {
      en: ["Stakeholder interviews", "Requirements baseline", "Success metrics definition"],
      ar: ["مقابلات أصحاب المصلحة", "خط أساس المتطلبات", "تحديد مقاييس النجاح"],
    },
  },
  {
    key: "architecture",
    name: { en: "Architecture & Design", ar: "الهندسة المعمارية والتصميم" },
    scope: {
      en: "System architecture, interfaces, and design decisions",
      ar: "بنية النظام والواجهات وقرارات التصميم",
    },
    tasks: {
      en: ["Architecture blueprint", "Interface contracts", "Design review"],
      ar: ["مخطط البنية", "عقود الواجهات", "مراجعة التصميم"],
    },
  },
  {
    key: "implementation",
    name: { en: "Core Implementation", ar: "التنفيذ الأساسي" },
    scope: {
      en: "Build the core capabilities against the agreed contracts",
      ar: "بناء القدرات الأساسية وفق العقود المتفق عليها",
    },
    tasks: {
      en: ["Foundation build", "Feature implementation", "Continuous integration hardening"],
      ar: ["بناء الأساس", "تنفيذ الميزات", "تعزيز التكامل المستمر"],
    },
  },
  {
    key: "quality",
    name: { en: "Quality & Hardening", ar: "الجودة والتحصين" },
    scope: {
      en: "Verification, security hardening, and acceptance",
      ar: "التحقق والتحصين الأمني والقبول",
    },
    tasks: {
      en: ["End-to-end verification", "Security review", "Acceptance run"],
      ar: ["التحقق الشامل", "المراجعة الأمنية", "جولة القبول"],
    },
  },
];

const TEXT = {
  programPrefix: { en: "Project:", ar: "مشروع:" },
  coreTeam: { en: "Engineering", ar: "الهندسة" },
  milestones: {
    en: ["Kickoff complete", "Design frozen", "Delivery accepted"],
    ar: ["اكتمال الانطلاق", "تجميد التصميم", "قبول التسليم"],
  },
  risks: {
    en: ["Schedule pressure on integration", "Key dependency availability"],
    ar: ["ضغط الجدول الزمني على التكامل", "توفر التبعيات الرئيسية"],
  },
} as const;

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`);
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** ISO dates compare lexicographically; keeps every generated date ≤ end. */
function minIso(a: string, b: string): string {
  return a <= b ? a : b;
}

function titleFromMission(mission: string, language: Language): string {
  const head = mission.trim().split(/\s+/).slice(0, 5).join(" ");
  return `${TEXT.programPrefix[language]} ${head}`;
}

function buildTasks(
  template: PhaseTemplate,
  language: Language,
  phaseIndex: number,
  phaseWindow: { start: string; days: number },
  timelineEnd: string,
): Task[] {
  const count = template.tasks[language].length;
  // Tasks stagger across the phase window; clamping to the timeline end keeps
  // degenerate (shorter-than-phase-count) timelines inside start–end while
  // preserving dueDate ≥ startDate. Pure in the inputs — no clock reads.
  return template.tasks[language].map((name, i) => ({
    id: `task-${phaseIndex + 1}-${i + 1}`,
    name,
    status: "todo" as const,
    estimateDays: 3 + i,
    startDate: minIso(addDays(phaseWindow.start, Math.round((phaseWindow.days * i) / count)), timelineEnd),
    dueDate: minIso(addDays(phaseWindow.start, Math.round((phaseWindow.days * (i + 1)) / count)), timelineEnd),
  }));
}

/**
 * Deterministic program synthesis: the zero-connectivity guarantee and the
 * quality baseline every model must beat (Charter; ADR pending for V1 gates).
 * Same brief in, same program out — no randomness, no clock reads.
 */
/** True for a parseable YYYY-MM-DD; guards the date arithmetic below, which
    would otherwise throw RangeError on an Invalid Date (total function). */
function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function synthesizeProgram(brief: ProgramBrief): Program {
  const language = brief.language;
  const requested = brief.timeline;
  // A malformed or inverted timeline degrades to the default window instead of
  // throwing: the synthesizer is the always-available fallback and must be
  // total over its inputs (validated callers never hit this branch).
  const timeline =
    requested !== undefined &&
    isValidIsoDate(requested.start) &&
    isValidIsoDate(requested.end) &&
    requested.start < requested.end
      ? requested
      : DEFAULT_TIMELINE;
  const totalDays = daysBetween(timeline.start, timeline.end);

  const phaseDays = Math.max(1, Math.floor(totalDays / PHASES.length));
  const packages: WorkPackage[] = PHASES.map((phase, i) => ({
    id: `wbp-${i + 1}`,
    name: phase.name[language],
    scope: phase.scope[language],
    tasks: buildTasks(
      phase,
      language,
      i,
      { start: minIso(addDays(timeline.start, phaseDays * i), timeline.end), days: phaseDays },
      timeline.end,
    ),
    dependsOn: i === 0 ? [] : [`wbp-${i}`],
  }));

  const teams = [
    { id: "team-1", name: TEXT.coreTeam[language], kind: "internal" as const },
    // Whitespace-only hints are dropped: an empty team name would violate
    // TeamSchema and turn a valid brief into a schema-invalid program.
    ...(brief.teamHints ?? [])
      .map((hint) => hint.trim())
      .filter((hint) => hint !== "")
      .map((hint, i) => ({
        id: `team-${i + 2}`,
        name: hint.slice(0, 500),
        kind: "internal" as const,
      })),
  ];

  const milestones = TEXT.milestones[language].map((name, i) => ({
    id: `ms-${i + 1}`,
    name,
    dueDate: addDays(timeline.start, Math.min(totalDays, Math.round((totalDays * (i + 1)) / 3))),
  }));

  const risks = TEXT.risks[language].map((title, i) => ({
    id: `risk-${i + 1}`,
    title,
    severity: (i === 0 ? "high" : "medium") as "high" | "medium",
  }));

  return {
    id: "prog-synth-1",
    name: titleFromMission(brief.mission, language),
    mission: brief.mission,
    language,
    timeline,
    teams,
    packages,
    milestones,
    risks,
  };
}
