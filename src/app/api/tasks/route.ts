import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentMember, notify } from '@/lib/collab';

const COLUMN_IDS = ['todo', 'in-progress', 'review', 'done'] as const;

const taskUpdateSchema = z.object({
  id: z.string().min(1),
  columnId: z.enum(COLUMN_IDS),
  sortOrder: z.number().int().min(0),
});

// Accepts a single update or a batch (e.g. a drag that reorders two columns).
const postSchema = z.object({
  updates: z.array(taskUpdateSchema).min(1).max(200),
});

export async function GET() {
  try {
    // Scope to the active program — with multiple programs in the database,
    // the board must only ever show the one you're working in.
    const tasks = await db.task.findMany({
      where: { wbp: { program: { status: 'active' } } },
      include: {
        assignee: { include: { team: true } },
        wbp: { include: { ownerTeam: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('[API /api/tasks GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const { updates } = parsed.data;

    // All-or-nothing: a drag must never leave the board half-reordered.
    await db.$transaction(
      updates.map((u) =>
        db.task.update({
          where: { id: u.id },
          data: { columnId: u.columnId, status: u.columnId, sortOrder: u.sortOrder },
        }),
      ),
    );

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (error) {
    console.error('[API /api/tasks POST] Error:', error);
    return NextResponse.json({ error: 'Failed to update tasks' }, { status: 500 });
  }
}

const assignSchema = z.object({
  id: z.string().min(1),
  assigneeId: z.string().min(1).nullable(),
});

// Reassign a task
export async function PATCH(request: NextRequest) {
  try {
    const parsed = assignSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const { id, assigneeId } = parsed.data;
    const me = await getCurrentMember();

    const task = await db.task.update({
      where: { id },
      data: { assigneeId },
      include: {
        assignee: { include: { team: true } },
        wbp: { include: { ownerTeam: true } },
      },
    });

    if (assigneeId && assigneeId !== me.id) {
      await notify({
        memberId: assigneeId,
        type: 'assignment',
        title: `${me.name} assigned you a task`,
        body: `${task.wbp.code}: ${task.title}`,
        entityType: 'task',
        entityId: task.id,
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('[API /api/tasks PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to reassign task' }, { status: 500 });
  }
}
