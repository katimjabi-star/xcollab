"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, WORKSPACE, ApiError, listPrograms } from "../../lib/api-client.ts";
import {
  fetchMyTasks,
  setMyTasksAuthTokenProvider,
  type MyTask,
} from "../../lib/api-my-tasks.ts";
import { useAuth } from "../../lib/auth-context.tsx";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { setDocumentTitle } from "../../lib/nav.ts";
import {
  addDaysIso,
  BUCKET_ORDER,
  bucketTasks,
  localTodayIso,
  type BucketId,
} from "../../lib/my-tasks.ts";
import { programColor } from "../../lib/program-format.ts";
import { TaskTable, type TaskRow } from "../../components/task-table.tsx";
import { MyTasksBoard } from "../../components/my-tasks-board.tsx";
import { AddTaskForm } from "../../components/my-tasks-add-form.tsx";
import { MyTasksToolbar, type MyTasksSort } from "../../components/my-tasks-toolbar.tsx";
import { CalendarView, type CalendarItem } from "../../components/calendar-view.tsx";
import { FilesView } from "../../components/files-view.tsx";
import { Avatar } from "../../components/ui/avatar.tsx";

/** Views that persist in ?view=; "list" is the default and keeps a clean URL. */
const URL_VIEWS = ["board", "calendar", "files"] as const;
type ViewId = "list" | (typeof URL_VIEWS)[number];

/** Contract #1 narrows status to todo/in_progress/done; blocked is active work. */
function toRow(task: MyTask): TaskRow {
  const { status, ...rest } = task;
  return { ...rest, status: status === "blocked" ? "in_progress" : status };
}

/** Ghost-row adds preset a due date matching the bucket they started from. */
function presetFor(bucket: BucketId, today: string): string | null {
  if (bucket === "doToday") return today;
  if (bucket === "doNextWeek") return addDaysIso(today, 7);
  if (bucket === "doLater") return addDaysIso(today, 14);
  return null;
}

function sortTasks(tasks: MyTask[], sort: MyTasksSort, language: "en" | "ar"): MyTask[] {
  const sorted = [...tasks];
  if (sort === "dueDate") {
    sorted.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  } else if (sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, language));
  }
  return sorted;
}

/** The active view's body; ternary chain lives here to keep the page simple. */
function MyTasksBody({
  view,
  sorted,
  buckets,
  bucketLabels,
  language,
  filesProgramId,
  emptyLabel,
  onOpenTask,
  onStartAdd,
  composingBucket,
  renderComposer,
}: {
  view: ViewId;
  sorted: MyTask[];
  buckets: Record<BucketId, MyTask[]>;
  bucketLabels: Record<BucketId, string>;
  language: "en" | "ar";
  filesProgramId: string | null;
  emptyLabel: string;
  onOpenTask: (task: { programId: string; id: string }) => void;
  onStartAdd: (bucket: BucketId) => void;
  composingBucket: BucketId | null;
  renderComposer: (bucket: BucketId) => ReactNode;
}) {
  if (view === "list") {
    return (
      <TaskTable
        rows={sorted.map(toRow)}
        groups={BUCKET_ORDER.map((id) => ({
          id,
          label: bucketLabels[id],
          rowIds: buckets[id].map((task) => task.id),
        }))}
        uiLanguage={language}
        onOpenTask={onOpenTask}
        onAddTask={(groupId) => onStartAdd(groupId as BucketId)}
        composingGroupId={composingBucket}
        renderComposer={(groupId) => renderComposer(groupId as BucketId)}
      />
    );
  }
  if (view === "board") {
    return (
      <MyTasksBoard
        buckets={BUCKET_ORDER.map((id) => ({ id, label: bucketLabels[id], tasks: buckets[id] }))}
        uiLanguage={language}
        onOpenTask={onOpenTask}
        onAddTask={onStartAdd}
        composingBucketId={composingBucket}
        renderComposer={renderComposer}
      />
    );
  }
  if (view === "calendar") {
    const items: CalendarItem[] = sorted.map((task) => ({
      id: task.id,
      name: task.name,
      ...(task.startDate ? { startDate: task.startDate } : {}),
      ...(task.dueDate ? { dueDate: task.dueDate } : {}),
      color: programColor(task.programId),
      programId: task.programId,
      done: task.status === "done",
    }));
    return (
      <CalendarView
        items={items}
        uiLanguage={language}
        onOpenItem={(item) => onOpenTask({ programId: item.programId, id: item.id })}
      />
    );
  }
  if (filesProgramId) {
    return <FilesView programId={filesProgramId} uiLanguage={language} />;
  }
  return <p className="empty">{emptyLabel}</p>;
}

export default function MyTasksPage() {
  const { t, language } = useUi();
  const { user, getToken } = useAuth();
  const router = useRouter();
  const { data: programs } = useWorkspaceData(listPrograms);
  const [tasks, setTasks] = useState<MyTask[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [view, setViewState] = useState<ViewId>("list");
  const [filterProgramId, setFilterProgramId] = useState<string | null>(null);
  const [sort, setSort] = useState<MyTasksSort>("default");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    fetchMyTasks(API_BASE, WORKSPACE)
      .then((list) => {
        setTasks(list);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      });
  }, []);

  useEffect(() => {
    setMyTasksAuthTokenProvider(getToken);
    load();
  }, [getToken, load]);

  useEffect(() => {
    setDocumentTitle([t.myTasksTitle]);
  }, [t]);

  // View choice lives in ?view=; read post-mount to avoid hydration mismatch
  // (same pattern as the project detail page).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const match = URL_VIEWS.find((v) => v === params.get("view"));
    if (match) setViewState(match);
  }, []);
  const setView = (next: ViewId) => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "list") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  };

  const today = localTodayIso();
  const filtered = (tasks ?? []).filter(
    (task) => !filterProgramId || task.programId === filterProgramId,
  );
  const sorted = sortTasks(filtered, sort, language);
  const buckets = bucketTasks(sorted, today);
  const bucketLabels: Record<BucketId, string> = {
    recentlyAssigned: t.bucketRecentlyAssigned,
    doToday: t.bucketDoToday,
    doNextWeek: t.bucketDoNextWeek,
    doLater: t.bucketDoLater,
  };

  const openTask = (task: { programId: string; id: string }) => {
    router.push(`/projects/${task.programId}?view=board&task=${task.id}`);
  };
  // Bucket adds compose INLINE at the clicked row/column (the toolbar popover
  // stays reserved for the toolbar's own "+ Add task" button).
  const [composingBucket, setComposingBucket] = useState<BucketId | null>(null);
  const startAdd = (bucket: BucketId) => {
    setCreateOpen(false);
    setComposingBucket(bucket);
  };
  const renderComposer = (bucket: BucketId): ReactNode => (
    <AddTaskForm
      programs={programs ?? []}
      uiLanguage={language}
      username={user?.username ?? ""}
      presetDueDate={presetFor(bucket, today)}
      defaultProgramId={filterProgramId}
      onCreated={load}
      onClose={() => setComposingBucket(null)}
      compact
    />
  );

  const viewLabels: Record<ViewId, string> = {
    list: t.viewList,
    board: t.viewBoard,
    calendar: t.viewCalendar,
    files: t.viewFiles,
  };
  const filesProgramId = filterProgramId ?? programs?.[0]?.id ?? null;

  return (
    <div className="content mt-page">
      <header className="mt-head">
        <div className="mt-title-row">
          <Avatar name={user?.fullName ?? user?.username ?? ""} size={36} />
          <h1 className="mt-title">{t.myTasksTitle}</h1>
          <div className="mt-head-end">
            <button type="button" className="mt-ghost-btn">
              {t.myTasksShare}
            </button>
            <button type="button" className="mt-ghost-btn">
              {t.myTasksCustomize}
            </button>
          </div>
        </div>
        <div className="view-switcher" role="group" aria-label={t.viewSwitcherLabel}>
          {(["list", ...URL_VIEWS] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {viewLabels[id]}
            </button>
          ))}
        </div>
      </header>

      <MyTasksToolbar
        programs={programs ?? []}
        uiLanguage={language}
        username={user?.username ?? ""}
        filterProgramId={filterProgramId}
        onFilterProgram={setFilterProgramId}
        sort={sort}
        onSort={setSort}
        createOpen={createOpen}
        onCreateOpenChange={(open) => {
          setCreateOpen(open);
          if (open) setComposingBucket(null);
        }}
        presetDueDate={null}
        onCreated={load}
      />

      {error ? (
        <p className="error-note" role="alert">
          {t.loadFailed}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      ) : null}

      <MyTasksBody
        view={view}
        sorted={sorted}
        buckets={buckets}
        bucketLabels={bucketLabels}
        language={language}
        filesProgramId={filesProgramId}
        emptyLabel={t.myTasksEmpty}
        onOpenTask={openTask}
        onStartAdd={startAdd}
        composingBucket={composingBucket}
        renderComposer={renderComposer}
      />
    </div>
  );
}
