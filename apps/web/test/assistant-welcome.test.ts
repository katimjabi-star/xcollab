import { describe, expect, it } from "vitest";
import type { Program } from "@xcollab/core";
import {
  buildWelcome,
  countOpenTasks,
  resolveFirstName,
} from "../lib/assistant-welcome.ts";
import { STRINGS } from "../lib/i18n.ts";
import type { WorkspaceUser } from "../lib/api-client.ts";

const users: WorkspaceUser[] = [
  { username: "jabbir", firstName: "Jabbir", lastName: "Parlapati", email: "j@x.dev" },
  { username: "amina", firstName: "Amina", lastName: "Hassan", email: "a@x.dev" },
];

function program(name: string, tasks: { assignee?: string; status: string }[]): Program {
  return {
    id: `p-${name}`,
    name,
    mission: "m",
    language: "en",
    packages: [
      {
        id: "pkg-1",
        name: "Section 1",
        scope: "s",
        dependsOn: [],
        tasks: tasks.map((t, i) => ({
          id: `t-${i}`,
          name: `Task ${i}`,
          status: t.status,
          estimateDays: 1,
          ...(t.assignee === undefined ? {} : { assignee: t.assignee }),
        })),
      },
    ],
  } as unknown as Program;
}

describe("resolveFirstName", () => {
  it("prefers the workspace directory firstName for the signed-in username", () => {
    expect(resolveFirstName({ username: "jabbir", fullName: "Jabbir Parlapati" }, users)).toBe(
      "Jabbir",
    );
  });

  it("falls back to the full name's first word when the directory has no match", () => {
    expect(resolveFirstName({ username: "ghost", fullName: "Ghost Writer" }, users)).toBe("Ghost");
    expect(resolveFirstName({ username: "ghost", fullName: "Ghost Writer" }, null)).toBe("Ghost");
  });

  it("falls back to the username when the full name is empty", () => {
    expect(resolveFirstName({ username: "ghost", fullName: "  " }, null)).toBe("ghost");
  });
});

describe("countOpenTasks", () => {
  it("counts only the user's non-done tasks across programs", () => {
    const programs = [
      program("Alpha", [
        { assignee: "jabbir", status: "todo" },
        { assignee: "jabbir", status: "done" },
        { assignee: "amina", status: "blocked" },
      ]),
      program("Beta", [{ assignee: "jabbir", status: "in_progress" }, { status: "todo" }]),
    ];
    expect(countOpenTasks(programs, "jabbir")).toBe(2);
    expect(countOpenTasks(programs, "amina")).toBe(1);
    expect(countOpenTasks(programs, "nobody")).toBe(0);
    expect(countOpenTasks([], "jabbir")).toBe(0);
  });
});

describe("buildWelcome (en)", () => {
  const t = STRINGS.en;

  it("personalizes the greeting and the track line", () => {
    const content = buildWelcome(t, { firstName: "Jabbir", openTasks: 3, projectName: "Alpha" });
    expect(content.greeting).toBe("👋 Welcome to XCollab AI, Jabbir!");
    expect(content.sections[0]?.body).toContain("3 open tasks");
    expect(content.sections[0]?.examples).toEqual(["Show my overdue tasks"]);
  });

  it("uses the real project name in parser-supported example prompts", () => {
    const content = buildWelcome(t, {
      firstName: "Jabbir",
      openTasks: 0,
      projectName: "Field Ops",
    });
    expect(content.sections).toHaveLength(3);
    expect(content.sections[1]?.examples).toEqual(['Add task "Review vendor contract" to Field Ops']);
    expect(content.sections[2]?.examples).toEqual([
      "Summarize Field Ops",
      "What's blocked in Field Ops",
    ]);
  });

  it("degrades without projects: create-project example, no insight section", () => {
    const content = buildWelcome(t, { firstName: "Jabbir", openTasks: 0, projectName: null });
    expect(content.sections).toHaveLength(2);
    expect(content.sections[1]?.examples).toEqual([t.aiWelcomeExCreateProject]);
  });
});

describe("buildWelcome (ar)", () => {
  it("produces Arabic content with the name and project interpolated", () => {
    const content = buildWelcome(STRINGS.ar, {
      firstName: "Jabbir",
      openTasks: 2,
      projectName: "Field Ops",
    });
    expect(content.greeting).toContain("Jabbir");
    expect(content.greeting).toMatch(/[؀-ۿ]/);
    expect(content.sections[0]?.body).toContain("2");
    expect(content.sections[0]?.examples).toEqual(["اعرض مهامي المتأخرة"]);
    expect(content.sections[2]?.examples).toEqual([
      "لخص Field Ops",
      "ما المعطل في Field Ops",
    ]);
  });
});
