"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import type { Program } from "@xcollab/core";
import { API_BASE, WORKSPACE, deleteProgram } from "../lib/api-client.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { formatIsoDate, programColor, programDisplayName } from "../lib/program-format.ts";
import { useToasts } from "../lib/toast-context.tsx";
import { invalidateWorkspaceData } from "../lib/use-workspace-data.ts";
import { Icon } from "./ui/icon.tsx";

/** Same arm/disarm window as the task-panel and team deletes. */
const DISARM_MS = 3000;

/** Armed-confirm project delete (teams pattern): first click arms ("Sure?"),
    second click deletes, blur/timeout disarms. On success: toast + home. */
function ProjectDeleteButton({ programId, t }: { programId: string; t: (typeof STRINGS)["en"] }) {
  const router = useRouter();
  const { push } = useToasts();
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  const disarm = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(false);
  };

  const handleDelete = () => {
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), DISARM_MS);
      return;
    }
    disarm();
    deleteProgram(API_BASE, { workspaceId: WORKSPACE, programId })
      .then(() => {
        // Sidebar/home hold mount-time program lists — make them refetch.
        invalidateWorkspaceData();
        push({ message: t.projectDeleted });
        router.push("/");
      })
      .catch(() => push({ message: t.actionFailed }));
  };

  return (
    <button
      type="button"
      className={armed ? "mt-ghost-btn proj-delete-btn armed" : "mt-ghost-btn proj-delete-btn"}
      aria-label={armed ? t.confirmDelete : t.deleteProject}
      title={armed ? t.confirmDelete : t.deleteProject}
      onClick={handleDelete}
      onBlur={disarm}
    >
      <Icon icon={Trash2} size={14} />
      {armed ? t.confirmDelete : t.deleteProject}
    </button>
  );
}

export const PROJECT_VIEWS = [
  "list",
  "board",
  "timeline",
  "dashboard",
  "calendar",
  "files",
] as const;
export type ProjectViewId = (typeof PROJECT_VIEWS)[number];

interface ProjectHeaderProps {
  program: Program;
  /** Resolved parent program — renders the subtle breadcrumb when present. */
  parent: { id: string; name: string } | null;
  uiLanguage: UiLanguage;
  view: ProjectViewId;
  onViewChange: (view: ProjectViewId) => void;
}

/** Project page chrome, mirroring the My Tasks header: color-swatch avatar +
    title (+ parent crumb, muted date range) with Share/Customize trailing,
    then the List…Files tabs row. Logical flow only — RTL-safe. */
export function ProjectHeader({
  program,
  parent,
  uiLanguage,
  view,
  onViewChange,
}: ProjectHeaderProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const viewLabels: Record<ProjectViewId, string> = {
    list: t.viewList,
    board: t.viewBoard,
    timeline: t.viewTimeline,
    dashboard: t.viewInsights,
    calendar: t.viewCalendar,
    files: t.viewFiles,
  };
  return (
    <header className="proj-head">
      <div className="proj-title-row">
        <span
          className="proj-avatar"
          style={{ background: programColor(program.id) }}
          aria-hidden
        />
        <div className="proj-title-block">
          {parent ? (
            <p className="program-parent-crumb">
              <Link href={`/projects/${parent.id}`} dir="auto">
                {programDisplayName(parent)}
              </Link>
              <Icon icon={ChevronRight} size={12} directional />
            </p>
          ) : null}
          <div className="proj-title-line">
            <h1 className="proj-title" dir="auto">
              {programDisplayName(program)}
            </h1>
            {/* Locale dates; the ISO pair stays in the tooltip for auditors. */}
            <span
              className="proj-dates"
              title={`${program.timeline.start} → ${program.timeline.end}`}
            >
              {formatIsoDate(program.timeline.start, program.language)} →{" "}
              {formatIsoDate(program.timeline.end, program.language)}
            </span>
          </div>
        </div>
        <div className="mt-head-end">
          <button type="button" className="mt-ghost-btn">
            {t.myTasksShare}
          </button>
          <button type="button" className="mt-ghost-btn">
            {t.myTasksCustomize}
          </button>
          <ProjectDeleteButton programId={program.id} t={t} />
        </div>
      </div>
      <div className="view-switcher" role="group" aria-label={t.viewSwitcherLabel}>
        {PROJECT_VIEWS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => onViewChange(id)}
          >
            {viewLabels[id]}
          </button>
        ))}
      </div>
    </header>
  );
}
