import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const switchSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  try {
    const programs = await db.program.findMany({
      where: { status: { in: ['active', 'paused'] } },
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(programs);
  } catch (error) {
    console.error('[API /api/programs GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
  }
}

// Switch the active program — exactly one program is active at a time.
export async function POST(request: NextRequest) {
  try {
    const parsed = switchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Program id is required' }, { status: 400 });
    }
    const target = await db.program.findUnique({ where: { id: parsed.data.id } });
    if (!target) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    await db.$transaction([
      db.program.updateMany({ where: { status: 'active' }, data: { status: 'paused' } }),
      db.program.update({ where: { id: target.id }, data: { status: 'active' } }),
    ]);

    return NextResponse.json({ ok: true, activeProgramId: target.id });
  } catch (error) {
    console.error('[API /api/programs POST] Error:', error);
    return NextResponse.json({ error: 'Failed to switch program' }, { status: 500 });
  }
}
