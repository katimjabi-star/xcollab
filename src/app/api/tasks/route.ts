import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateTaskPositionRequest } from '@/lib/types';

export async function GET() {
  try {
    const tasks = await db.task.findMany({
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
    const body: UpdateTaskPositionRequest = await request.json();
    const { id, columnId, sortOrder } = body;
    if (!id || !columnId) {
      return NextResponse.json({ error: 'Task id and columnId are required' }, { status: 400 });
    }
    const updatedTask = await db.task.update({
      where: { id },
      data: { columnId, sortOrder: sortOrder ?? 0 },
      include: { assignee: true, wbp: true },
    });
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('[API /api/tasks POST] Error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}
