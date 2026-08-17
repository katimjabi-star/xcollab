import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET — Fetch a single WBP by ID with all relations
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'WBP ID is required' },
        { status: 400 }
      );
    }

    const wbp = await db.wBP.findUnique({
      where: { id },
      include: {
        ownerTeam: true,
        program: true,
        parent: {
          include: {
            ownerTeam: true,
          },
        },
        children: {
          include: {
            ownerTeam: true,
            tasks: {
              include: {
                wbp: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
            risks: {
              orderBy: { createdAt: 'desc' },
            },
            milestones: {
              orderBy: { date: 'asc' },
            },
            dependenciesFrom: {
              include: {
                fromWbp: true,
                toWbp: true,
              },
            },
            dependenciesTo: {
              include: {
                fromWbp: true,
                toWbp: true,
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
        tasks: {
          include: {
            wbp: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        risks: {
          orderBy: { createdAt: 'desc' },
        },
        milestones: {
          orderBy: { date: 'asc' },
        },
        dependenciesFrom: {
          include: {
            fromWbp: true,
            toWbp: true,
          },
        },
        dependenciesTo: {
          include: {
            fromWbp: true,
            toWbp: true,
          },
        },
      },
    });

    if (!wbp) {
      return NextResponse.json(
        { error: 'WBP not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(wbp);
  } catch (error) {
    console.error('[API /api/wbp/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WBP' },
      { status: 500 }
    );
  }
}
