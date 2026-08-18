'use client';

import { useMemo, useState, useCallback, type ButtonHTMLAttributes } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertCircle, Columns3, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorState from '@/components/ErrorState';
import { toast } from '@/hooks/use-toast';
import { postJson, fetchJson } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useProgram, useTasks, queryKeys } from '@/hooks/use-app-data';
import { useTranslation } from '@/lib/i18n';
import type { TaskWithAssignee, WBPFlat, UpdateTaskPositionRequest, MemberWithTeam } from '@/lib/types';

const COLUMNS = ['todo', 'in-progress', 'review', 'done'] as const;
type ColumnId = (typeof COLUMNS)[number];
const COLUMN_KEYS = { todo: 'kanban.todo', 'in-progress': 'kanban.inProgress', review: 'kanban.review', done: 'kanban.done' } as const;
const COLUMN_WIP = { todo: 99, 'in-progress': 5, review: 3, done: 99 } as const;

const PRIORITY_COLORS: Record<string, string> = {
  low: '#71717A',
  medium: '#3B82F6',
  high: '#F59E0B',
  critical: '#EF4444',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '113,113,122';
}

/* ---- Sortable Task Card ---- */

interface TaskCardViewProps {
  task: TaskWithAssignee;
  teamColor: string;
  gripProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  members?: MemberWithTeam[];
  onAssign?: (taskId: string, assigneeId: string | null) => void;
}

/** Pure presentation — safe to render inside DragOverlay without registering a
 *  second draggable for the same id. */
function TaskCardView({ task, teamColor, gripProps, members, onAssign }: TaskCardViewProps) {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const priorityColor = PRIORITY_COLORS[task.priority] || '#71717A';

  return (
    <>
      <Card className="bg-xcollab-surface-2 border-xcollab-border/40 rounded-xl card-glass card-hover group cursor-grab active:cursor-grabbing relative overflow-hidden">
        {/* Team color strip */}
        <div className="absolute start-0 top-0 bottom-0 w-1 rounded-s-xl" style={{ backgroundColor: teamColor }} />
        <CardContent className="p-4 ps-5">
          <div className="flex items-start gap-2.5">
            {gripProps && (
              <button
                className="mt-0.5 text-[var(--ink-3)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab"
                aria-label={`Drag ${task.title}`}
                {...gripProps}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--ink-1)] font-medium leading-snug truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge
                  className="text-[11px] h-5 rounded-md"
                  style={{
                    backgroundColor: `rgba(${hexToRgb(priorityColor)}, 0.12)`,
                    color: priorityColor,
                    borderColor: `rgba(${hexToRgb(priorityColor)}, 0.2)`,
                  }}
                  variant="outline"
                >
                  {task.priority}
                </Badge>
                <span className="text-[11px] font-mono text-[var(--ink-3)]">{task.wbp.code}</span>
                <div className="ms-auto" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  {members && onAssign ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label={t('kanban.assign')}
                          className="flex items-center rounded-full ring-offset-1 transition-shadow hover:ring-2 hover:ring-[var(--brand)]/40"
                        >
                          {task.assignee ? (
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] bg-xcollab-surface-3 text-[var(--ink-3)]">
                                {getInitials(task.assignee.name)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-xcollab-border text-[10px] text-[var(--ink-3)]">+</span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 border-xcollab-border bg-xcollab-surface">
                        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                          {t('kanban.assign')}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => onAssign(task.id, null)}
                          className="cursor-pointer text-sm text-[var(--ink-3)] focus:bg-xcollab-surface-2"
                        >
                          {t('kanban.unassigned')}
                        </DropdownMenuItem>
                        {members.map((m) => (
                          <DropdownMenuItem
                            key={m.id}
                            onClick={() => onAssign(task.id, m.id)}
                            className="cursor-pointer gap-2 text-sm text-[var(--ink-2)] focus:bg-xcollab-surface-2"
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.team?.color ?? 'var(--ink-3)' }} />
                            <span className="min-w-0 flex-1 truncate">{m.name}</span>
                            {task.assignee?.id === m.id && <span className="text-[var(--brand)]">✓</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : task.assignee ? (
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px] bg-xcollab-surface-3 text-[var(--ink-3)]">
                        {getInitials(task.assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-[11px] text-[var(--ink-3)]">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

interface TaskCardProps {
  task: TaskWithAssignee;
  teamColor: string;
  members?: MemberWithTeam[];
  onAssign?: (taskId: string, assigneeId: string | null) => void;
}

function TaskCard({ task, teamColor, members, onAssign }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task, columnId: task.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-40' : ''}>
      <TaskCardView task={task} teamColor={teamColor} gripProps={{ ...attributes, ...listeners }} members={members} onAssign={onAssign} />
    </div>
  );
}

/* ---- Kanban Column ---- */

interface KanbanColumnProps {
  id: ColumnId;
  title: string;
  tasks: TaskWithAssignee[];
  wipLimit: number;
  wbpTeamColors: Record<string, string>;
  members?: MemberWithTeam[];
  onAssign?: (taskId: string, assigneeId: string | null) => void;
  emptyLabel: string;
  wipLabel: string;
}

function KanbanColumn({ id, title, tasks, wipLimit, wbpTeamColors, members, onAssign, emptyLabel, wipLabel }: KanbanColumnProps) {
  const isOverWip = tasks.length > wipLimit;
  // Register the column itself as a drop target so empty columns accept cards.
  const { setNodeRef, isOver } = useDroppable({ id, data: { columnId: id } });

  return (
    <div className="flex flex-col w-[300px] md:w-[320px] shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-[var(--ink-1)]">{title}</h3>
          <span className="text-xs font-bold text-[var(--ink-3)] bg-xcollab-surface-3 rounded-md px-2 py-0.5 tabular-nums">
            {tasks.length}
          </span>
          {isOverWip && (
            <span className="flex items-center gap-1 text-[11px] text-[#EF4444] font-medium">
              <AlertCircle className="w-3 h-3" />
              {wipLabel}
            </span>
          )}
        </div>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={`flex-1 bg-xcollab-surface/30 rounded-xl p-2 border min-h-[200px] transition-colors ${
          isOver ? 'border-[var(--brand)]/50' : 'border-xcollab-border/30'
        }`}
      >
        <ScrollArea className="max-h-[calc(100vh-16rem)]">
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 pb-2">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-[var(--ink-3)] gap-2">
                  <Inbox className="w-6 h-6 opacity-40" />
                  <span className="text-xs">{emptyLabel}</span>
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    teamColor={wbpTeamColors[task.wbpId] || '#71717A'}
                    members={members}
                    onAssign={onAssign}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

/* ---- Main Kanban View ---- */

export default function KanbanView() {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const queryClient = useQueryClient();
  const tasksQuery = useTasks();
  const programQuery = useProgram();
  const [activeTask, setActiveTask] = useState<TaskWithAssignee | null>(null);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const wbpTeamColors = useMemo(() => {
    const colors: Record<string, string> = {};
    const flatten = (w: WBPFlat) => {
      if (w.ownerTeam?.color) colors[w.id] = w.ownerTeam.color;
      w.children?.forEach(flatten);
    };
    programQuery.data?.wbps.forEach(flatten);
    return colors;
  }, [programQuery.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const getColumnTasks = useCallback(
    (columnId: string) =>
      tasks.filter((t) => t.columnId === columnId).sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks],
  );

  const handleAssign = useCallback(
    async (taskId: string, assigneeId: string | null) => {
      const member = assigneeId ? programQuery.data?.members.find((m) => m.id === assigneeId) ?? null : null;
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      queryClient.setQueryData<TaskWithAssignee[]>(queryKeys.tasks, (old) =>
        (old ?? []).map((task) => (task.id === taskId ? { ...task, assigneeId, assignee: member } : task)),
      );
      try {
        await fetchJson('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, assigneeId }),
        });
      } catch (err) {
        toast({
          title: t('common.error'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      }
    },
    [programQuery.data, queryClient, t],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    // Resolve the target column: either a column droppable or another task's column.
    const overTask = tasks.find((t) => t.id === over.id);
    const targetColumnId = (COLUMNS as readonly string[]).includes(over.id as string)
      ? (over.id as ColumnId)
      : overTask
        ? (overTask.columnId as ColumnId)
        : null;
    if (!targetColumnId) return;

    const sourceColumnId = currentTask.columnId as ColumnId;
    const sourceTasks = getColumnTasks(sourceColumnId);

    // Build the new ordered card lists for the affected column(s).
    let nextSource: TaskWithAssignee[];
    let nextTarget: TaskWithAssignee[];

    if (targetColumnId === sourceColumnId) {
      const fromIdx = sourceTasks.findIndex((t) => t.id === taskId);
      const toIdx = overTask ? sourceTasks.findIndex((t) => t.id === overTask.id) : sourceTasks.length - 1;
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      nextSource = arrayMove(sourceTasks, fromIdx, toIdx);
      nextTarget = nextSource;
    } else {
      const targetTasks = getColumnTasks(targetColumnId);
      nextSource = sourceTasks.filter((t) => t.id !== taskId);
      const insertAt = overTask ? targetTasks.findIndex((t) => t.id === overTask.id) : targetTasks.length;
      const moved = { ...currentTask, columnId: targetColumnId, status: targetColumnId };
      nextTarget = [...targetTasks];
      nextTarget.splice(insertAt === -1 ? targetTasks.length : insertAt, 0, moved);
    }

    // Diff against current state so we only persist what actually changed.
    const updates: UpdateTaskPositionRequest[] = [];
    const reindex = (list: TaskWithAssignee[], columnId: ColumnId) => {
      list.forEach((task, idx) => {
        const original = tasks.find((t) => t.id === task.id);
        if (original && (original.columnId !== columnId || original.sortOrder !== idx)) {
          updates.push({ id: task.id, columnId, sortOrder: idx });
        }
      });
    };
    reindex(nextTarget, targetColumnId);
    if (targetColumnId !== sourceColumnId) reindex(nextSource, sourceColumnId);
    if (updates.length === 0) return;

    // Optimistic cache update. Cancel any in-flight refetch first so a stale
    // response can't overwrite the new positions, and reconcile with the
    // server afterwards instead of restoring a snapshot (a snapshot rollback
    // would also wipe out concurrent drags).
    await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
    queryClient.setQueryData<TaskWithAssignee[]>(queryKeys.tasks, (old) =>
      (old ?? []).map((task) => {
        const update = updates.find((u) => u.id === task.id);
        return update
          ? { ...task, columnId: update.columnId, status: update.columnId, sortOrder: update.sortOrder }
          : task;
      }),
    );

    try {
      await postJson('/api/tasks', { updates });
    } catch (err) {
      toast({
        title: t('kanban.moveFailed'),
        description: err instanceof Error ? err.message : t('kanban.moveFailedDesc'),
        variant: 'destructive',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    }
  };

  if (tasksQuery.error) {
    return <ErrorState message={tasksQuery.error.message} onRetry={() => tasksQuery.refetch()} />;
  }

  if (tasksQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-xcollab-surface-2" />
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[300px] shrink-0 space-y-4">
              <Skeleton className="h-6 w-24 bg-xcollab-surface-2" />
              <Skeleton className="h-40 bg-xcollab-surface-2 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-6 bg-[var(--brand)] rounded-full" />
        <Columns3 className="w-5 h-5 text-[var(--brand)]" />
        <h2 className="text-xl font-bold text-[var(--ink-1)]">{t('kanban.title')}</h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((colId) => (
            <KanbanColumn
              key={colId}
              id={colId}
              title={t(COLUMN_KEYS[colId] as Parameters<typeof t>[0])}
              tasks={getColumnTasks(colId)}
              wipLimit={COLUMN_WIP[colId]}
              wbpTeamColors={wbpTeamColors}
              members={programQuery.data?.members}
              onAssign={handleAssign}
              emptyLabel={t('kanban.noTasks')}
              wipLabel={t('kanban.wipExceeded')}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="opacity-90 rotate-2 scale-105">
              <TaskCardView
                task={activeTask}
                teamColor={wbpTeamColors[activeTask.wbpId] || '#71717A'}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
