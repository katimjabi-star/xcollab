import { db } from './db';

// ============================================
// Server-side collaboration helpers.
// The POC has no authentication (documented limitation) — the signed-in
// persona is the seeded program admin, resolved here in one place so a real
// auth integration later only has to change this function.
// ============================================

export async function getCurrentMember() {
  const admin = await db.member.findFirst({ where: { role: 'admin' } });
  if (!admin) throw new Error('No admin member seeded');
  return admin;
}

/**
 * Parse @mentions out of a comment body and create a notification for each
 * mentioned member. Mentions match on first name or full name,
 * case-insensitive (e.g. "@alice" or "@Alice Al-Rashid").
 */
export async function notifyMentions(opts: {
  body: string;
  authorId: string;
  authorName: string;
  entityType: 'wbp' | 'task';
  entityId: string;
  entityLabel: string;
}) {
  const members = await db.member.findMany({ select: { id: true, name: true } });
  const lower = opts.body.toLowerCase();
  const mentioned = members.filter((m) => {
    if (m.id === opts.authorId) return false;
    const first = m.name.split(' ')[0].toLowerCase();
    return lower.includes(`@${m.name.toLowerCase()}`) || lower.includes(`@${first}`);
  });

  if (mentioned.length === 0) return [];
  await db.notification.createMany({
    data: mentioned.map((m) => ({
      memberId: m.id,
      type: 'mention',
      title: `${opts.authorName} mentioned you`,
      body: `${opts.entityLabel}: ${opts.body.slice(0, 140)}`,
      entityType: opts.entityType,
      entityId: opts.entityId,
    })),
  });
  return mentioned.map((m) => m.id);
}

export async function notify(opts: {
  memberId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}) {
  return db.notification.create({ data: opts });
}
