"use client";

import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import type { MyTask } from "../lib/api-my-tasks.ts";
import { dueRangeLabel, dueTone } from "../lib/date-label.ts";
import { localTodayIso, type BucketId } from "../lib/my-tasks.ts";
import { programColor, programDisplayName } from "../lib/program-format.ts";
import { Icon } from "./ui/icon.tsx";

export interface BoardBucket {
  id: BucketId;
  label: string;
  tasks: MyTask[];
}

interface MyTasksBoardProps {
  buckets: BoardBucket[];
  uiLanguage: UiLanguage;
  onOpenTask: (task: MyTask) => void;
  onAddTask: (bucketId: BucketId) => void;
  /** Bucket currently composing — its "+ Add task" footer becomes the inline
      composer card so the form opens in the clicked column. */
  composingBucketId?: BucketId | null;
  renderComposer?: (bucketId: BucketId) => ReactNode;
}

/** Board view of the derived buckets: one column per bucket with a count
    badge, cards in the shared board-card look (name + project chip + date
    line), "+ Add task" footer per column. Reuses board.css primitives. */
export function MyTasksBoard({
  buckets,
  uiLanguage,
  onOpenTask,
  onAddTask,
  composingBucketId = null,
  renderComposer,
}: MyTasksBoardProps): ReactElement {
  const t = STRINGS[uiLanguage];
  const today = localTodayIso();

  return (
    <div className="board-scroller mt-board-scroller">
      <div className="board mt-board">
        {buckets.map((bucket) => (
          <section key={bucket.id} className="board-col">
            <header className="board-col-head">
              <span className="board-col-title">{bucket.label}</span>
              <span className="board-col-count">{bucket.tasks.length}</span>
            </header>
            <div className="board-col-body">
              {bucket.tasks.map((task) => {
                const done = task.status === "done";
                const dueText = dueRangeLabel(task, uiLanguage, today);
                const tone = dueTone(task.dueDate, done, today);
                const open = () => onOpenTask(task);
                const onKeyDown = (event: KeyboardEvent) => {
                  if (event.key === "Enter" && event.target === event.currentTarget) {
                    event.preventDefault();
                    open();
                  }
                };
                return (
                  <article
                    key={`${task.programId}/${task.id}`}
                    className="board-card mt-card"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={onKeyDown}
                  >
                    <div className="mt-card-title">
                      <Icon
                        icon={CheckCircle2}
                        size={16}
                        className={`mt-card-check${done ? " done" : ""}`}
                      />
                      <span className="board-card-name">{task.name}</span>
                    </div>
                    <span className="project-pill" title={task.packageName}>
                      <span
                        className="project-swatch"
                        style={{ background: programColor(task.programId) }}
                        aria-hidden
                      />
                      {programDisplayName({ name: task.programName })}
                    </span>
                    {dueText ? (
                      <span className={`mt-card-date due-${tone}`} dir="auto">
                        {dueText}
                      </span>
                    ) : null}
                  </article>
                );
              })}
              {composingBucketId === bucket.id && renderComposer ? (
                <div className="mt-compose-card">{renderComposer(bucket.id)}</div>
              ) : (
                <button
                  type="button"
                  className="quick-add-btn"
                  onClick={() => onAddTask(bucket.id)}
                >
                  + {t.addTask}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
