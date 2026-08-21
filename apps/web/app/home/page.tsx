"use client";

import Link from "next/link";
import { CircleCheck, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Program, Task } from "@xcollab/core";
import { listPrograms } from "../../lib/api-client.ts";
import { STRINGS } from "../../lib/i18n.ts";
import { useAuth } from "../../lib/auth-context.tsx";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import {
  formatIsoDate,
  programColor,
  programDisplayName,
} from "../../lib/program-format.ts";
import { Icon } from "../../components/ui/icon.tsx";

const PREVIEW_LIMIT = 5;

type Strings = (typeof STRINGS)["en"];

interface MyTaskRef {
  task: Task;
  programId: string;
  programName: string;
}

function greetingKey(hour: number): keyof Strings {
  if (hour < 12) return "homeGreetingMorning";
  if (hour < 17) return "homeGreetingAfternoon";
  return "homeGreetingEvening";
}

function collectMyTasks(programs: Program[], username: string): MyTaskRef[] {
  const mine: MyTaskRef[] = [];
  for (const program of programs) {
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (task.assignee === username) {
          mine.push({ task, programId: program.id, programName: programDisplayName(program) });
        }
      }
    }
  }
  return mine;
}

/** Everyone assigned to any task in the workspace, minus me. */
function collaboratorCount(programs: Program[], username: string): number {
  const people = new Set<string>();
  for (const program of programs) {
    for (const pkg of program.packages) {
      for (const task of pkg.tasks) {
        if (task.assignee && task.assignee !== username) people.add(task.assignee);
      }
    }
  }
  return people.size;
}

export default function HomePage() {
  const { t, language } = useUi();
  const { user } = useAuth();
  const { data } = useWorkspaceData(listPrograms);
  /* Clock reads happen post-mount so SSR and client markup can't disagree. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const username = user?.username ?? "";
  const firstName = (user?.fullName ?? username).split(/\s+/)[0] ?? username;
  const programs = data ?? [];
  const myTasks = collectMyTasks(programs, username);
  const completed = myTasks.filter((ref) => ref.task.status === "done").length;
  const collaborators = collaboratorCount(programs, username);
  const locale = language === "ar" ? "ar" : "en";
  const dateLine = now
    ? new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(now)
    : "";
  const greeting = now ? t[greetingKey(now.getHours())] : "";

  return (
    <div className="content s2-home">
      <header className="s2-home-head">
        <p className="s2-home-date">{dateLine}</p>
        <h1 className="s2-home-greeting">
          {greeting ? `${greeting}${language === "ar" ? "،" : ","} ${firstName}` : " "}
        </h1>
        <div className="s2-home-week">
          <span className="s2-home-week-label">{t.homeMyWeek}</span>
          <span className="s2-home-stat">
            <Icon icon={CircleCheck} size={14} />
            <span className="num">{completed}</span> {t.homeTasksCompleted}
          </span>
          <span className="s2-home-stat">
            <span className="num">{collaborators}</span> {t.homeCollaborators}
          </span>
        </div>
      </header>

      <div className="s2-home-grid">
        <section className="s2-home-card">
          <div className="s2-home-card-head">
            <h2>{t.navMyTasks}</h2>
            <Link className="s2-home-card-link" href="/my-tasks">
              {t.viewAllLabel}
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="empty">{t.homeNoTasks}</p>
          ) : (
            <ul className="s2-home-tasks">
              {myTasks.slice(0, PREVIEW_LIMIT).map(({ task, programId, programName }) => (
                <li key={task.id}>
                  <Link
                    className="s2-home-task"
                    href={`/projects/${programId}?view=board&task=${task.id}`}
                  >
                    <Icon icon={CircleCheck} size={14} className="s2-home-task-check" />
                    <span className="s2-home-task-name" dir="auto">
                      {task.name}
                    </span>
                    <span className="s2-home-task-meta" dir="auto">
                      {programName}
                      {task.dueDate ? ` · ${formatIsoDate(task.dueDate, language)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="s2-home-card">
          <div className="s2-home-card-head">
            <h2>{t.programsHeading}</h2>
          </div>
          <div className="s2-home-projects">
            <Link className="s2-home-project s2-home-project-new" href="/">
              <span className="s2-home-project-icon s2-home-project-plus" aria-hidden>
                <Icon icon={Plus} size={16} />
              </span>
              <span className="s2-home-project-name">{t.generate}</span>
            </Link>
            {programs.map((program) => (
              <Link
                key={program.id}
                className="s2-home-project"
                href={`/projects/${program.id}`}
              >
                <span
                  className="s2-home-project-icon"
                  style={{ background: programColor(program.id) }}
                  aria-hidden
                />
                <span className="s2-home-project-name" dir="auto">
                  {programDisplayName(program)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
