"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
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

  return (
    <>
    <div className="content">
      <Link className="back-link" href="/programs">
        <span aria-hidden>{dir === "rtl" ? "→" : "←"}</span> {t.backToPrograms}
      </Link>

      {error ? (
        <p className="error-note" role="alert">
          {t.errorGeneric}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      ) : null}

      {loaded && !error && !program ? <p className="empty">{t.notFound}</p> : null}

      {program ? (
        <>
          <div>
            <div className="view-switcher" role="group" aria-label={t.viewSwitcherLabel}>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
                {t.viewList}
              </button>
              <button
                type="button"
                aria-pressed={view === "board"}
                onClick={() => setView("board")}
              >
                {t.viewBoard}
              </button>
            </div>
          </div>
          {view === "list" ? (
            <ProgramView
              program={program}
              uiLanguage={language}
              detail
              onTaskSelect={setSelectedTaskId}
              onProgramUpdate={setPatched}
            />
          ) : (
            <Board
              program={program}
              uiLanguage={language}
              onProgramUpdate={setPatched}
              onTaskSelect={setSelectedTaskId}
            />
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
