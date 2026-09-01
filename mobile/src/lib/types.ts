/**
 * Wire types for the XCollab API, mirroring @xcollab/core's schemas (the
 * server validates; the app only consumes). Kept as a hand-maintained mirror
 * because the mobile app builds standalone (npm + Metro) outside the pnpm
 * workspace — same pattern as the web bundle's relay-prompt mirror.
 */
export type Language = "en" | "ar";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface Subtask {
  id: string;
  name: string;
  done: boolean;
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  estimateDays: number;
  assigneeRole?: string;
  assignee?: string;
  startDate?: string;
  dueDate?: string;
  description?: string;
  subtasks?: Subtask[];
}

export interface WorkPackage {
  id: string;
  name: string;
  scope: string;
  tasks: Task[];
  dependsOn: string[];
}

export interface Milestone {
  id: string;
  name: string;
  dueDate: string;
}

export interface Risk {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  owner?: string;
}

export interface Program {
  id: string;
  parentId?: string;
  teamId?: string;
  name: string;
  mission: string;
  language: Language;
  timeline: { start: string; end: string };
  teams: { id: string; name: string; kind: "internal" | "vendor" }[];
  packages: WorkPackage[];
  milestones: Milestone[];
  risks: Risk[];
}

export interface LedgerEntry {
  workspaceId: string;
  seq: number;
  actor: { kind: "human" | "ai"; id: string };
  action: string;
  modelId?: string;
  occurredAt: string;
  hash: string;
}

export interface LedgerResult {
  entries: LedgerEntry[];
  verification: { valid: boolean };
}
