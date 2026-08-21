"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Program } from "@xcollab/core";
import { ApiError, listPrograms } from "../../../lib/api-client.ts";
import { setDocumentTitle } from "../../../lib/nav.ts";
import { useUi } from "../../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../../lib/use-workspace-data.ts";
import { ProgramView } from "../../../components/program-view.tsx";
import { Board } from "../../../components/board.tsx";
import { TimelineView } from "../../../components/timeline-view.tsx";
import { InsightsView } from "../../../components/insights-view.tsx";
import { CalendarView, type CalendarItem } from "../../../components/calendar-view.tsx";
import { FilesView } from "../../../components/files-view.tsx";
import { TaskPanel } from "../../../components/task-panel.tsx";
import { locateTask } from "../../../components/task-panel-content.tsx";
import { formatIsoDate, programColor, programDisplayName } from "../../../lib/program-format.ts";
import { Icon } from "../../../components/ui/icon.tsx";

/** Views that persist in ?view=; "list" is the default and keeps a clean URL.
    Tab order matches the target IA: List · Board · Timeline · Dashboard ·
    Calendar · Files. */
const URL_VIEWS = ["board", "timeline", "dashboard", "calendar", "files"] as const;
type ViewId = "list" | (typeof URL_VIEWS)[number];

/** Old deep links used ?view=insights; it stays an alias of dashboard. */
function normalizeViewParam(raw: string | null): string | null {
  return raw === "insights" ? "dashboard" : raw;
}

/** Program tasks → calendar bars; one stable accent per program. */
function toCalendarItems(program: Program): CalendarItem[] {
  const color = programColor(program.id);
  return program.packages.flatMap((pkg) =>
    pkg.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate,
      dueDate: task.dueDate,
      color,
      programId: program.id,
      done: task.status === "done",
    })),
  );
}

function taskExists(program: Program | null, taskId: string | null): boolean {
  if (!program || !taskId) return false;
  return program.packages.some((pkg) => pkg.tasks.some((task) => task.id === taskId));
}

/** Open-panel task name for the contextual <title>; null when closed. */
function openTaskNameOf(
  program: Program | null,
  taskId: string | null,
  panelOpen: boolean,
): string | null {
  if (!panelOpen || !program || !taskId) return null;
  return locateTask(program, taskId)?.task.name ?? null;
}

/** Parent from the same workspace fetch; a dangling parentId yields no crumb. */
function resolveParent(program: Program | null, all: Program[] | null): Program | null {
  if (!program?.parentId || !all) return null;
  return all.find((p) => p.id === program.parentId) ?? null;
}

/** Fetch-error and not-found notices, branch-isolated from the page body. */
function PageNotices({ error, notFound }: { error: unknown; notFound: boolean }) {
  const { t } = useUi();
  return (
    <>
      {error ? (
        <p className="error-note" role="alert">
          {t.errorGeneric}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      ) : null}
      {notFound ? <p className="empty">{t.notFound}</p> : null}
    </>
  );
}

/** View-switcher row; non-list views add the compact program line beside it,
    prefixed with a "ParentName ›" crumb when the program has a parent. */
function ProgramTopline({
  program,
  parent,
  view,
  onViewChange,
}: {
  program: Program;
  parent: { id: string; name: string } | null;
  view: ViewId;
  onViewChange: (view: ViewId) => void;
}) {
  const { t } = useUi();
  const labels: Record<ViewId, string> = {
    list: t.viewList,
    board: t.viewBoard,
    timeline: t.viewTimeline,
    dashboard: t.viewInsights,
    calendar: t.viewCalendar,
    files: t.viewFiles,
  };
  const compact = view !== "list";
  return (
    <div className={view === "board" ? "board-topline" : compact ? "view-topline" : undefined}>
      {compact ? (
        <div className="board-program-line" dir={program.language === "ar" ? "rtl" : "ltr"}>
          {parent ? (
            <p className="program-parent-crumb">
              <Link href={`/projects/${parent.id}`} dir="auto">
                {programDisplayName(parent)}
              </Link>
              <Icon icon={ChevronRight} size={12} directional />
            </p>
          ) : null}
          <h2 className="board-program-name">{programDisplayName(program)}</h2>
          {/* Locale dates; ISO stays in the tooltip for auditors (audit #4) */}
          <span
            className="board-program-dates"
            title={`${program.timeline.start} → ${program.timeline.end}`}
          >
            {formatIsoDate(program.timeline.start, program.language)} →{" "}
            {formatIsoDate(program.timeline.end, program.language)}
          </span>
        </div>
      ) : null}
      <div className="view-switcher" role="group" aria-label={t.viewSwitcherLabel}>
        {(["list", ...URL_VIEWS] as const).map((id) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => onViewChange(id)}>
            {labels[id]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Body for the active tab — branch chain lives here to keep the page's own
    cyclomatic complexity within the lint budget. */
function SelectedView({
  view,
  program,
  parent,
  language,
  onTaskSelect,
  onProgramUpdate,
}: {
  view: ViewId;
  program: Program;
  parent: Program | null;
  language: "en" | "ar";
  onTaskSelect: (taskId: string) => void;
  onProgramUpdate: (program: Program) => void;
}) {
  return view === "list" ? (
    <ProgramView
      program={program}
      uiLanguage={language}
      detail
      parent={parent}
      onTaskSelect={onTaskSelect}
      onProgramUpdate={onProgramUpdate}
    />
  ) : view === "board" ? (
    /* Board reads filter/sort from useSearchParams — Suspense keeps
       the prerender contract (see next/docs use-search-params). */
    <Suspense fallback={null}>
      <Board
        program={program}
        uiLanguage={language}
        onProgramUpdate={onProgramUpdate}
        onTaskSelect={onTaskSelect}
      />
    </Suspense>
  ) : view === "timeline" ? (
    <TimelineView program={program} uiLanguage={language} onTaskSelect={onTaskSelect} />
  ) : view === "dashboard" ? (
    <InsightsView program={program} uiLanguage={language} onTaskSelect={onTaskSelect} />
  ) : view === "calendar" ? (
    <CalendarView
      items={toCalendarItems(program)}
      uiLanguage={language}
      onOpenItem={(item) => onTaskSelect(item.id)}
    />
  ) : (
    <FilesView programId={program.id} uiLanguage={language} />
  );
}

export default function ProgramDetailPage() {
  const { t, language, dir } = useUi();
  const { id } = useParams<{ id: string }>();
  const { data, error, loaded } = useWorkspaceData(listPrograms);
  const [view, setViewState] = useState<ViewId>("list");
  // Freshest server state after a task mutation; wins over the initial fetch.
  const [patched, setPatched] = useState<Program | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // View choice lives in ?view=, open task in ?task= — a reload or shared
  // link restores both (the panel's copy-link button emits ?task= URLs).
  // Read post-mount (like the board's collapse state) to avoid a hydration
  // mismatch; useSearchParams here would force Suspense around the whole page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const match = URL_VIEWS.find((v) => v === normalizeViewParam(params.get("view")));
    if (match) setViewState(match);
    const task = params.get("task");
    if (task) setSelectedTaskId(task);
  }, []);
  const setView = (next: ViewId) => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "list") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  };
  // ?task= mirrors the open panel; replaceState preserves the other params.
  const syncTaskParam = (taskId: string | null) => {
    const url = new URL(window.location.href);
    if (taskId) url.searchParams.set("task", taskId);
    else url.searchParams.delete("task");
    window.history.replaceState(null, "", url);
  };
  const selectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    syncTaskParam(taskId);
  };
  const closePanel = () => {
    setSelectedTaskId(null);
    syncTaskParam(null);
  };
  const fetched = data?.find((p) => p.id === id) ?? null;
  const program = patched && patched.id === id ? patched : fetched;
  const parent = resolveParent(program, data);
  // Panel is open only while the selected task still exists in the program.
  const panelOpen = taskExists(program, selectedTaskId);
  const boardMode = view === "board" && program !== null;

  // Contextual <title>: "Task · Program · XCollab" while the panel is open,
  // else "Program · XCollab" (audit #10). setDocumentTitle wins the race
  // against the App Router's async metadata re-apply; on route change the
  // app shell's own call takes over, so no unmount cleanup is needed.
  const openTaskName = openTaskNameOf(program, selectedTaskId, panelOpen);
  useEffect(() => {
    if (!program) return;
    const programName = programDisplayName(program);
    setDocumentTitle(openTaskName ? [openTaskName, programName] : [programName]);
  }, [program, openTaskName]);

  return (
    <>
      {/* Board mode drops the centered program card: edge-to-edge surface with
          a compact program line; the board owns the remaining viewport. */}
      <div className={boardMode ? "content board-mode" : "content"}>
        <Link className="back-link" href="/projects">
          <span aria-hidden>{dir === "rtl" ? "→" : "←"}</span> {t.backToPrograms}
        </Link>

        <PageNotices error={error} notFound={loaded && !error && !program} />

        {program ? (
          <>
            <ProgramTopline program={program} parent={parent} view={view} onViewChange={setView} />
            <SelectedView
              view={view}
              program={program}
              parent={parent}
              language={language}
              onTaskSelect={selectTask}
              onProgramUpdate={setPatched}
            />
          </>
        ) : null}
      </div>
      <TaskPanel
        program={program}
        taskId={selectedTaskId}
        uiLanguage={language}
        onClose={closePanel}
        onProgramUpdate={setPatched}
      />
      <div
        className={`task-panel-overlay${panelOpen ? " open" : ""}`}
        onClick={closePanel}
        aria-hidden="true"
      />
    </>
  );
}
