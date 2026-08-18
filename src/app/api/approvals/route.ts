import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentMember, notify } from '@/lib/collab';

const createSchema = z.object({
  wbpId: z.string().min(1),
  approverId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
});

const decideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['approved', 'changes_requested', 'rejected']),
  note: z.string().trim().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const wbpId = request.nextUrl.searchParams.get('wbpId');
    if (!wbpId) return NextResponse.json({ error: 'wbpId is required' }, { status: 400 });
    const approvals = await db.approval.findMany({
      where: { wbpId },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(approvals);
  } catch (error) {
    console.error('[API /api/approvals GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 });
  }
}

// Request an approval
export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const { wbpId, approverId, title } = parsed.data;
    const me = await getCurrentMember();
    const wbp = await db.wBP.findUnique({ where: { id: wbpId }, select: { code: true, name: true } });
    if (!wbp) return NextResponse.json({ error: 'WBP not found' }, { status: 404 });

    const approval = await db.approval.create({
      data: { wbpId, requestedById: me.id, approverId, title },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    if (approverId !== me.id) {
      await notify({
        memberId: approverId,
        type: 'approval',
        title: `${me.name} requested your approval`,
        body: `${wbp.code} ${wbp.name}: ${title}`,
        entityType: 'wbp',
        entityId: wbpId,
      });
    }

    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    console.error('[API /api/approvals POST] Error:', error);
    return NextResponse.json({ error: 'Failed to request approval' }, { status: 500 });
  }
}

// Record a verdict
export async function PATCH(request: NextRequest) {
  try {
    const parsed = decideSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const { id, status, note } = parsed.data;
    const me = await getCurrentMember();

    const existing = await db.approval.findUnique({
      where: { id },
      include: { wbp: { select: { code: true, name: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Approval already decided' }, { status: 409 });
    }

    const approval = await db.approval.update({
      where: { id },
      data: { status, note: note ?? null, decidedAt: new Date() },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    if (existing.requestedById !== me.id) {
      const verdict = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'requested changes on';
      await notify({
        memberId: existing.requestedById,
        type: 'approval',
        title: `${me.name} ${verdict} your request`,
        body: `${existing.wbp.code} ${existing.wbp.name}: ${existing.title}${note ? ` — ${note}` : ''}`,
        entityType: 'wbp',
        entityId: existing.wbpId,
      });
    }

    return NextResponse.json(approval);
  } catch (error) {
    console.error('[API /api/approvals PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to record verdict' }, { status: 500 });
  }
}
