import type { Program } from "@xcollab/core";
import type { WorkspaceUser } from "./api-client.ts";
import type { AuthProfile } from "./auth.ts";
import type { STRINGS } from "./i18n.ts";

/**
 * Pure builder for the personalized XCollab AI welcome (fix-wave-M). No model
 * call: the content is composed client-side from the i18n dictionary plus live
 * workspace data. Every example string MUST stay a phrasing the deterministic
 * intent grammar accepts (services/ai-gateway deterministic-intent.ts) —
 * clicking one sends it verbatim as a chat message.
 */

type Strings = (typeof STRINGS)["en"];

export interface WelcomeSection {
  title: string;
  body: string;
  /** Clickable example prompts, sent verbatim via the chat send mechanism. */
  examples: string[];
}

export interface WelcomeContent {
  greeting: string;
  intro: string;
  canDo: string;
  sections: WelcomeSection[];
  tipTitle: string;
  tipBody: string;
}

export interface WelcomeInput {
  firstName: string;
  openTasks: number;
  /** A real project name from the workspace, or null when none exist yet. */
  projectName: string | null;
}

/** First name for the greeting: workspace directory (GET /api/users) first,
    then the ID-token full name's first word, then the username. */
export function resolveFirstName(
  profile: Pick<AuthProfile, "username" | "fullName">,
  users: readonly WorkspaceUser[] | null,
): string {
  const match = users?.find((u) => u.username === profile.username);
  if (match && match.firstName.trim() !== "") return match.firstName.trim();
  const fromFullName = profile.fullName.trim().split(/\s+/)[0];
  return fromFullName !== undefined && fromFullName !== "" ? fromFullName : profile.username;
}

/** Tasks assigned to `username` that are not done, across all programs. */
export function countOpenTasks(programs: readonly Program[], username: string): number {
  let count = 0;
  for (const program of programs) {
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (task.assignee === username && task.status !== "done") count += 1;
      }
    }
  }
  return count;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? String(whole));
}

export function buildWelcome(
  t: Strings,
  { firstName, openTasks, projectName }: WelcomeInput,
): WelcomeContent {
  const sections: WelcomeSection[] = [
    {
      title: t.aiWelcomeTrackTitle,
      body: fill(t.aiWelcomeTrackBody, { n: String(openTasks) }),
      examples: [t.aiWelcomeExMyTasks],
    },
    {
      title: t.aiWelcomeCreateTitle,
      body: t.aiWelcomeCreateBody,
      examples: [
        projectName === null
          ? t.aiWelcomeExCreateProject
          : fill(t.aiWelcomeExAddTask, { project: projectName }),
      ],
    },
  ];
  if (projectName !== null) {
    sections.push({
      title: t.aiWelcomeInsightTitle,
      body: t.aiWelcomeInsightBody,
      examples: [
        fill(t.aiWelcomeExSummarize, { project: projectName }),
        fill(t.aiWelcomeExBlocked, { project: projectName }),
      ],
    });
  }
  return {
    greeting: fill(t.aiWelcomeGreeting, { name: firstName }),
    intro: t.aiWelcomeIntro,
    canDo: t.aiWelcomeCanDo,
    sections,
    tipTitle: t.aiWelcomeTipTitle,
    tipBody: t.aiWelcomeTipBody,
  };
}
