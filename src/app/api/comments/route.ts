import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentMember, notifyMentions, notify } from '@/lib/collab';

const postSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    wbpId: z.string().optional(),
    taskId: z.string().optional(),
  })
  .refine((d) => !!d.wbpId !== !!d.taskId, { message: 'Provide exactly one of wbpId or taskId' });

export async function GET(request: NextRequest) {
  try {
    const wbpId = request.nextUrl.searchParams.get('wbpId');
    const taskId = request.nextUrl.searchParams.get('taskId');
    if (!wbpId && !taskId) {
      return NextResponse.json({ error: 'wbpId or taskId is required' }, { status: 400 });
    }
    const comments = await db.comment.findMany({
      where: wbpId ? { wbpId } : { taskId },
      include: { author: { select: { id: true, name: true, role: true, team: { select: { color: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error('[API /api/comments GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
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
    const { body, wbpId, taskId } = parsed.data;
    const me = await getCurrentMember();

    let entityLabel = '';
    if (wbpId) {
      const wbp = await db.wBP.findUnique({ where: { id: wbpId }, select: { code: true, name: true } });
      if (!wbp) return NextResponse.json({ error: 'WBP not found' }, { status: 404 });
      entityLabel = `${wbp.code} ${wbp.name}`;
    } else if (taskId) {
      const task = await db.task.findUnique({ where: { id: taskId }, select: { title: true, assigneeId: true } });
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      entityLabel = task.title;
      // The assignee always hears about discussion on their task.
      if (task.assigneeId && task.assigneeId !== me.id) {
        await notify({
          memberId: task.assigneeId,
          type: 'comment',
          title: `${me.name} commented on your task`,
          body: `${entityLabel}: ${body.slice(0, 140)}`,
          entityType: 'task',
          entityId: taskId,
        });
      }
    }

    const comment = await db.comment.create({
      data: { body, authorId: me.id, wbpId: wbpId ?? null, taskId: taskId ?? null },
      include: { author: { select: { id: true, name: true, role: true, team: { select: { color: true } } } } },
    });

    await notifyMentions({
      body,
      authorId: me.id,
      authorName: me.name,
      entityType: wbpId ? 'wbp' : 'task',
      entityId: (wbpId ?? taskId)!,
      entityLabel,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('[API /api/comments POST] Error:', error);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
