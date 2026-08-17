'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertCircle, Columns3, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { TaskWithAssignee, WBPFlat, ProgramDashboardData } from '@/lib/types';

const COLUMNS = ['todo', 'in-progress', 'review', 'done'] as const;
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

interface TaskCardProps {
  task: TaskWithAssignee;
  teamColor: string;
  overlay?: boolean;
}

function TaskCard({ task, teamColor, overlay }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task, columnId: task.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColor = PRIORITY_COLORS[task.priority] || '#71717A';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging && !overlay ? 'opacity-40' : ''}`}
    >
      <Card className="bg-xcollab-surface-2 border-xcollab-border/40 rounded-xl card-glass card-hover group cursor-grab active:cursor-grabbing relative overflow-hidden">
        {/* Team color strip */}
        <div className="absolute start-0 top-0 bottom-0 w-1 rounded-s-xl" style={{ backgroundColor: teamColor }} />
        <CardContent className="p-4 ps-5">
          <div className="flex items-start gap-2.5">
            {!overlay && (
              <button
                className="mt-0.5 text-[#71717A] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#E8E8ED] font-medium leading-snug truncate">{task.title}</p>
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
                <span className="text-[11px] font-mono text-[#71717A]">{task.wbp.code}</span>
                <div className="ms-auto">
                  {task.assignee ? (
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px] bg-xcollab-surface-3 text-[#71717A]">
                        {getInitials(task.assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-[11px] text-[#71717A]">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---- Kanban Column ---- */

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: TaskWithAssignee[];
  wipLimit: number;
  wbpTeamColors: Record<string, string>;
}

function KanbanColumn({ id, title, tasks, wipLimit, wbpTeamColors }: KanbanColumnProps) {
  const isOverWip = tasks.length > wipLimit;

  return (
    <div className="flex flex-col w-[300px] md:w-[320px] shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-[#E8E8ED]">{title}</h3>
          <span className="text-xs font-bold text-[#71717A] bg-xcollab-surface-3 rounded-md px-2 py-0.5 tabular-nums">
            {tasks.length}
          </span>
          {isOverWip && (
            <span className="flex items-center gap-1 text-[11px] text-[#EF4444] font-medium">
              <AlertCircle className="w-3 h-3" />
              WIP
            </span>
          )}
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 bg-xcollab-surface/30 rounded-xl p-2 border border-xcollab-border/30 min-h-[200px]">
        <ScrollArea className="max-h-[calc(100vh-16rem)]">
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 pb-2">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-[#71717A] gap-2">
                  <Inbox className="w-6 h-6 opacity-40" />
                  <span className="text-xs">No tasks</span>
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    teamColor={wbpTeamColors[task.wbpId] || '#71717A'}
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
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<TaskWithAssignee | null>(null);
  const [wbpTeamColors, setWbpTeamColors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/program').then((r) => r.json()),
    ])
      .then(([tasksData, programData]) => {
        setTasks(tasksData || []);
        const colors: Record<string, string> = {};
        const flatten = (w: WBPFlat) => {
          if (w.ownerTeam?.color) colors[w.id] = w.ownerTeam.color;
          w.children?.forEach(flatten);
        };
        (programData as ProgramDashboardData).wbps.forEach(flatten);
        setWbpTeamColors(colors);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const getColumnTasks = useCallback(
    (columnId: string) =>
      tasks.filter((t) => t.columnId === columnId).sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks],
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

    let targetColumnId = currentTask.columnId;

    if (COLUMNS.includes(over.id as typeof COLUMNS[number])) {
      targetColumnId = over.id as string;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetColumnId = overTask.columnId;
    }

    if (targetColumnId === currentTask.columnId) return;

    const columnTasks = getColumnTasks(targetColumnId);
    const newSortOrder = columnTasks.length;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, columnId: targetColumnId, sortOrder: newSortOrder } : t,
      ),
    );

    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, columnId: targetColumnId, sortOrder: newSortOrder }),
      });
    } catch {
      fetch('/api/tasks')
        .then((r) => r.json())
        .then((d) => setTasks(d || []))
        .catch(() => {});
    }
  };

  if (loading) {
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
        <div className="w-1.5 h-6 bg-[#FF4713] rounded-full" />
        <Columns3 className="w-5 h-5 text-[#FF4713]" />
        <h2 className="text-xl font-bold text-[#E8E8ED]">{t('kanban.title')}</h2>
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
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="opacity-90 rotate-2 scale-105">
              <TaskCard
                task={activeTask}
                teamColor={wbpTeamColors[activeTask.wbpId] || '#71717A'}
                overlay
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
