import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const program = await db.program.findFirst({
      where: { status: 'active' },
      include: {
        organization: true,
        wbps: {
          include: {
            ownerTeam: true,
            tasks: { include: { assignee: { include: { team: true } } }, orderBy: { sortOrder: 'asc' } },
            risks: { orderBy: { createdAt: 'desc' } },
            milestones: { orderBy: { date: 'asc' } },
            dependenciesFrom: { include: { fromWbp: { select: { id: true, code: true, name: true } }, toWbp: { select: { id: true, code: true, name: true } } } },
            dependenciesTo: { include: { fromWbp: { select: { id: true, code: true, name: true } }, toWbp: { select: { id: true, code: true, name: true } } } },
          },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: 'No active program found' }, { status: 404 });
    }

    // Teams that actually work on this program (own at least one of its WBPs),
    // plus any team with members — the org roster stays visible either way.
    const teams = await db.team.findMany({
      where: {
        organizationId: program.organizationId,
        OR: [
          { wbps: { some: { programId: program.id } } },
          { members: { some: {} } },
        ],
      },
      include: { members: { include: { team: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    const members = await db.member.findMany({
      where: { organizationId: program.organizationId },
      include: { team: true },
      orderBy: { name: 'asc' },
    });

    // Build parent-child tree client-side
    const wbpMap = new Map(program.wbps.map((w) => [w.id, { ...w, children: [] as typeof program.wbps }]));
    const rootWbps: typeof program.wbps = [];
    for (const wbp of program.wbps) {
      const node = wbpMap.get(wbp.id)!;
      if (wbp.parentId && wbpMap.has(wbp.parentId)) {
        wbpMap.get(wbp.parentId)!.children.push(node);
      } else {
        rootWbps.push(node);
      }
    }

    return NextResponse.json({
      id: program.id,
      name: program.name,
      description: program.description,
      status: program.status,
      startDate: program.startDate,
      targetDate: program.targetDate,
      organizationId: program.organizationId,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
      organization: program.organization,
      wbps: rootWbps,
      teams,
      members,
    });
  } catch (error) {
    console.error('[API /api/program] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch program data' }, { status: 500 });
  }
}
