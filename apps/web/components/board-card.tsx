"use client";

import { useState } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, CalendarDays, CheckCircle2, Circle, CircleDot, OctagonAlert } from "lucide-react";
import type { Task } from "@xcollab/core";
import type { BoardCard } from "../lib/board-filter.ts";
import { isOverdue } from "../lib/board-filter.ts";
import type { STRINGS } from "../lib/i18n.ts";
import { Chip } from "./ui/chip.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";

type Strings = (typeof STRINGS)["en"];

/** One lucide glyph per status — shared by column headers and the move menu. */
export const STATUS_ICONS: Record<Task["status"], LucideIcon> = {
  todo: Circle,
  in_progress: CircleDot,
  blocked: OctagonAlert,
  done: CheckCircle2,
};

/** Initials for the 20px assignee-role avatar: first letter of the first two words. */
function roleInitials(role: string): string {
  return role
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

interface BoardCardItemProps {
  card: BoardCard;
  t: Strings;
  /** ISO date injected by the board so overdue rendering matches filtering. */
  today: string;
  dragging: boolean;
  revertError: boolean;
  /** The other three columns, in board order. */
  moveTargets: { status: Task["status"]; label: string }[];
  onSelect: () => void;
  onMove: (to: Task["status"]) => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

/** Kanban card: package eyebrow → 2-line title → chip row → id/avatar footer.
    Tabbable; Enter opens the panel; the move affordance is keyboard DnD. */
export function BoardCardItem({
  card,
  t,
  today,
  dragging,
  revertError,
  moveTargets,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}: BoardCardItemProps) {
  const { task, packageName } = card;
  const [moveOpen, setMoveOpen] = useState(false);
  const overdue = isOverdue(task, today);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      onSelect();
    }
  };

  const handleMoveClick = (event: MouseEvent) => {
    event.stopPropagation();
    setMoveOpen((prev) => !prev);
  };

  return (
    <article
      className={`board-card${dragging ? " dragging" : ""}${revertError ? " revert-error" : ""}`}
      draggable
      tabIndex={0}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="board-card-top">
        <span className="board-card-eyebrow">{packageName}</span>
        <Popover
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          align="end"
          role="menu"
          className="board-card-move-root"
          anchor={
            <button
              type="button"
              className="board-card-move"
              aria-haspopup="menu"
              aria-expanded={moveOpen}
              aria-label={`${t.moveTaskLabel}: ${task.name}`}
              onClick={handleMoveClick}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Icon icon={ArrowRightLeft} size={14} />
            </button>
          }
        >
          <p className="board-move-heading">{t.moveTo}</p>
          {moveTargets.map(({ status, label }) => (
            <button
              key={status}
              type="button"
              role="menuitem"
              className="board-move-item"
              onClick={(event) => {
                event.stopPropagation();
                setMoveOpen(false);
                onMove(status);
              }}
            >
              <Icon icon={STATUS_ICONS[status]} size={14} className={`board-status-icon ${status}`} />
              {label}
            </button>
          ))}
        </Popover>
      </div>

      <span className="board-card-name">{task.name}</span>

      <div className="board-card-chips">
        {task.dueDate ? (
          <Chip
            variant="dueDate"
            overdue={overdue}
            icon={<Icon icon={CalendarDays} size={12} />}
            title={overdue ? t.overdueLabel : t.dueLabel}
          >
            {task.dueDate}
          </Chip>
        ) : null}
        <span className="board-chip-estimate" title={t.taskEstimate}>
          {task.estimateDays} {t.estimateDaysSuffix}
        </span>
      </div>

      <div className="board-card-foot">
        <span className="board-card-id">{task.id}</span>
        {task.assigneeRole ? (
          <span className="board-card-avatar" title={task.assigneeRole} aria-label={task.assigneeRole}>
            {roleInitials(task.assigneeRole)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
