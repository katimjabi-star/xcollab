import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentMember } from '@/lib/collab';

const postSchema = z
  .object({
    ids: z.array(z.string()).max(500).optional(),
    all: z.boolean().optional(),
  })
  .refine((d) => d.all || (d.ids && d.ids.length > 0), { message: 'Provide ids or all: true' });

export async function GET() {
  try {
    const me = await getCurrentMember();
    const notifications = await db.notification.findMany({
      where: { memberId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unreadCount = await db.notification.count({ where: { memberId: me.id, read: false } });
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('[API /api/inbox GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
  }
}

// Mark notifications read
export async function POST(request: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const me = await getCurrentMember();
    const where = parsed.data.all
      ? { memberId: me.id, read: false }
      : { memberId: me.id, id: { in: parsed.data.ids! } };
    await db.notification.updateMany({ where, data: { read: true } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API /api/inbox POST] Error:', error);
    return NextResponse.json({ error: 'Failed to update inbox' }, { status: 500 });
  }
}
