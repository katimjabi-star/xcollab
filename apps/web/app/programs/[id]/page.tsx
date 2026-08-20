"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { Program } from "@xcollab/core";
import { ApiError, listPrograms } from "../../../lib/api-client.ts";
import { useUi } from "../../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../../lib/use-workspace-data.ts";
import { ProgramView } from "../../../components/program-view.tsx";
import { Board } from "../../../components/board.tsx";
import { TaskPanel } from "../../../components/task-panel.tsx";

function taskExists(program: Program | null, taskId: string | null): boolean {
  if (!program || !taskId) return false;
  return program.packages.some((pkg) => pkg.tasks.some((task) => task.id === taskId));
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

/** View-switcher row; board mode adds the compact program line beside it. */
function ProgramTopline({
  program,
  boardMode,
  view,
  onViewChange,
}: {
  program: Program;
  boardMode: boolean;
  view: "list" | "board";
  onViewChange: (view: "list" | "board") => void;
}) {
  const { t } = useUi();
  return (
    <div className={boardMode ? "board-topline" : undefined}>
      {boardMode ? (
        <div className="board-program-line" dir={program.language === "ar" ? "rtl" : "ltr"}>
          <h2 className="board-program-name">{program.name}</h2>
          <span className="board-program-dates">
            {program.timeline.start} → {program.timeline.end}
          </span>
        </div>
      ) : null}
      <div className="view-switcher" role="group" aria-label={t.viewSwitcherLabel}>
        <button type="button" aria-pressed={view === "list"} onClick={() => onViewChange("list")}>
          {t.viewList}
        </button>
        <button type="button" aria-pressed={view === "board"} onClick={() => onViewChange("board")}>
          {t.viewBoard}
        </button>
      </div>
    </div>
  );
}

export default function ProgramDetailPage() {
  const { t, language, dir } = useUi();
  const { id } = useParams<{ id: string }>();
  const { data, error, loaded } = useWorkspaceData(listPrograms);
  const [view, setView] = useState<"list" | "board">("list");
  // Freshest server state after a task mutation; wins over the initial fetch.
  const [patched, setPatched] = useState<Program | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const fetched = data?.find((p) => p.id === id) ?? null;
  const program = patched && patched.id === id ? patched : fetched;
  // Panel is open only while the selected task still exists in the program.
  const panelOpen = taskExists(program, selectedTaskId);
  const closePanel = () => setSelectedTaskId(null);
  const boardMode = view === "board" && program !== null;

  return (
    <>
      {/* Board mode drops the centered program card: edge-to-edge surface with
          a compact program line; the board owns the remaining viewport. */}
      <div className={boardMode ? "content board-mode" : "content"}>
        <Link className="back-link" href="/programs">
          <span aria-hidden>{dir === "rtl" ? "→" : "←"}</span> {t.backToPrograms}
        </Link>

        <PageNotices error={error} notFound={loaded && !error && !program} />

        {program ? (
          <>
            <ProgramTopline
              program={program}
              boardMode={boardMode}
              view={view}
              onViewChange={setView}
            />
            {view === "list" ? (
              <ProgramView
                program={program}
                uiLanguage={language}
                detail
                onTaskSelect={setSelectedTaskId}
                onProgramUpdate={setPatched}
              />
            ) : (
              /* Board reads filter/sort from useSearchParams — Suspense keeps
                 the prerender contract (see next/docs use-search-params). */
              <Suspense fallback={null}>
                <Board
                  program={program}
                  uiLanguage={language}
                  onProgramUpdate={setPatched}
                  onTaskSelect={setSelectedTaskId}
                />
              </Suspense>
            )}
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
