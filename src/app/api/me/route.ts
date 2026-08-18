import { NextResponse } from 'next/server';
import { getCurrentMember } from '@/lib/collab';

export async function GET() {
  try {
    const me = await getCurrentMember();
    return NextResponse.json(me);
  } catch (error) {
    console.error('[API /api/me] Error:', error);
    return NextResponse.json({ error: 'Failed to resolve current member' }, { status: 500 });
  }
}
