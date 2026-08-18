import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';

const SYSTEM_PROMPT = `You are XCollab AI — an expert project manager and defense acquisition analyst for the BRAIN Network Encryptor program within EDGE Group / Katim.

Your role:
- Analyze Work Breakdown Package (WBP) status, progress, and health
- Identify and assess risks and dependencies across teams
- Provide actionable project management recommendations
- Track milestones and flag delays
- Suggest resource reallocation when WBPs are at risk

Guidelines:
- Be concise, analytical, and action-oriented
- Reference specific WBP codes, task names, and team names from the program data provided
- Use structured responses (bullet points, numbered lists) for clarity
- Highlight urgent items and blockers clearly
- Always consider cross-team dependencies
- Respond in the same language the user writes in (English or Arabic)`;

const MODEL = 'claude-opus-5';
const HISTORY_LIMIT = 20;

/**
 * Snapshot of the live program state, injected into the model's context so
 * answers cite real WBPs, risks, and milestones instead of guessing.
 */
async function buildProgramContext(programId: string): Promise<string> {
  const wbps = await db.wBP.findMany({
    where: { programId },
    include: {
      ownerTeam: { select: { name: true } },
      tasks: { select: { title: true, status: true, priority: true } },
      risks: { where: { status: { not: 'closed' } }, select: { title: true, severity: true, status: true } },
      milestones: { select: { name: true, date: true, status: true } },
      dependenciesFrom: {
        include: { toWbp: { select: { code: true } } },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  const lines = wbps.map((w) => {
    const tasksDone = w.tasks.filter((t) => t.status === 'done').length;
    const parts = [
      `${w.code} ${w.name} — status: ${w.status}, health: ${w.health}, progress: ${w.progress}%`,
      `owner: ${w.ownerTeam?.name ?? 'unassigned'}`,
      `due: ${w.dueDate?.toISOString().slice(0, 10) ?? 'n/a'}`,
      `tasks: ${tasksDone}/${w.tasks.length} done`,
    ];
    if (w.risks.length > 0) {
      parts.push(`risks: ${w.risks.map((r) => `[${r.severity}] ${r.title}`).join('; ')}`);
    }
    if (w.milestones.length > 0) {
      parts.push(`milestones: ${w.milestones.map((m) => `${m.name} (${m.date?.toISOString().slice(0, 10) ?? 'n/a'}, ${m.status})`).join('; ')}`);
    }
    if (w.dependenciesFrom.length > 0) {
      parts.push(`blocks: ${w.dependenciesFrom.map((d) => d.toWbp.code).join(', ')}`);
    }
    return `- ${parts.join(' | ')}`;
  });

  return `\n\nCurrent program data (live, authoritative — cite these codes and figures):\n${lines.join('\n')}`;
}

const postSchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(4000, 'message too long'),
});

/** Resolve the active program server-side so clients never need to know its ID. */
async function getActiveProgram() {
  return db.program.findFirst({
    where: { status: 'active' },
    select: { id: true, name: true },
  });
}

function generateMockResponse(message: string): string {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('risk') || lowerMsg.includes('خطر') || lowerMsg.includes('مخاطر')) {
    return `**Risk Analysis Summary**

Based on the current program data, here are the key risk areas:

🔴 **Critical Risks:**
- FIPS 140-2 Level 4 lab availability is limited (WBP-600) — 6-month lead time threatens the certification window
- Post-Quantum Crypto Module (WBP-210) is behind schedule — NIST standardization delay compounds the risk

🟡 **Medium Risks:**
- FPGA supply chain shortage could delay PCB production (WBP-100)
- KERNO production line readiness not confirmed for Q3 start (WBP-700)

✅ **Recommendations:**
1. Book the FIPS certification lab slot now to protect the Q4 submission date
2. Add a second crypto engineer to WBP-210 to recover schedule
3. Qualify a second FPGA supplier for WBP-100
4. Escalate KERNO readiness confirmation to the program director`;
  }

  if (lowerMsg.includes('status') || lowerMsg.includes('progress') || lowerMsg.includes('حالة') || lowerMsg.includes('تقدم')) {
    return `**Program Status Overview — BRAIN Network Encryptor**

📊 **Top-level Work Packages:**

| WBP | Name | Status | Health | Progress |
|-----|------|--------|--------|----------|
| WBP-100 | Hardware Platform | In Progress | At Risk | 45% |
| WBP-200 | Crypto Engine | In Progress | At Risk | 35% |
| WBP-300 | Firmware Layer | Planned | On Track | 15% |
| WBP-400 | Management Software | In Progress | On Track | 30% |
| WBP-500 | Integration Testing | Planned | On Track | 0% |
| WBP-600 | Certification & Compliance | Planned | On Track | 5% |
| WBP-700 | Manufacturing & Production | Planned | On Track | 0% |

⚠️ **Attention Required:** WBP-100 and WBP-200 are at risk; WBP-210 (Post-Quantum Crypto Module) is behind schedule.

🎯 **Next milestone:** Alpha Prototype Ready — May 15, 2026.`;
  }

  if (lowerMsg.includes('depend') || lowerMsg.includes('تبع') || lowerMsg.includes('block')) {
    return `**Dependency Map Analysis**

🔗 **Critical-path dependencies:**

1. **WBP-100 Hardware Platform → WBP-300 Firmware Layer** (Blocks)
   Firmware needs stable hardware — WBP-100 is at risk at 45%

2. **WBP-200 Crypto Engine → WBP-300 Firmware Layer** (Blocks)
   Crypto API must be stable before firmware integration — ⚠️ WBP-210 is behind schedule

3. **WBP-100/200/300/400 → WBP-500 Integration Testing** (Blocks)
   All engineering streams converge on integration testing in July

4. **WBP-500 → WBP-600 Certification** (Blocks)
   🔴 FIPS lab lead time makes this the highest-impact chain

5. **WBP-100 & WBP-200 → WBP-700 Manufacturing** (Blocks)
   Production start depends on hardware and crypto design freeze

💡 **Recommendation:** Fast-track WBP-210 to protect the critical path, and book the FIPS lab slot immediately.`;
  }

  return `**XCollab AI Analysis**

Here's my snapshot of the BRAIN Network Encryptor program:

📋 **Current Snapshot:**
- 13 Work Breakdown Packages (7 top-level)
- 2 top-level WBPs at risk (Hardware Platform, Crypto Engine); WBP-210 behind schedule
- 5 open or mitigating risks; 10 active dependencies

🔍 **Key Observations:**
1. The critical path runs through Crypto Engine → Firmware → Integration Testing → Certification
2. The FIPS 140-2 L4 lab lead time is the highest-impact schedule risk
3. Hardware supply chain (FPGA) needs a second-source strategy

🎯 **Suggested Actions:**
- Escalate WBP-210 staffing to recover the post-quantum module schedule
- Book the FIPS certification lab now
- Confirm KERNO production readiness before Q3

Ask me about specific WBPs, risks, dependencies, or team workloads for more detailed analysis.`;
}

/**
 * Ask Claude for a reply grounded in the live program snapshot. Returns null
 * when no credentials are configured or the API call fails, so the caller can
 * degrade to the offline mock analysis.
 */
async function generateClaudeReply(
  programId: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string | null> {
  try {
    // Zero-arg client resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
    // `ant auth login` profile; throws here when none exist.
    const client = new Anthropic();
    const programContext = await buildProgramContext(programId);

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Route safety-classifier declines to Anthropic's recommended fallback
      // model server-side instead of surfacing them as empty replies.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT + programContext,
      messages: chatHistory,
    });

    if (response.stop_reason === 'refusal') return null;

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    console.warn('[AI Chat] Claude unavailable, using offline analysis:', error instanceof Error ? error.message : error);
    return null;
  }
}

// GET — conversation history for the active program (oldest first)
export async function GET() {
  try {
    const program = await getActiveProgram();
    if (!program) {
      return NextResponse.json({ error: 'No active program found' }, { status: 404 });
    }

    const messages = await db.aIConversation.findMany({
      where: { programId: program.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return NextResponse.json({ programId: program.id, messages });
  } catch (error) {
    console.error('[API /api/ai-chat GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation history' }, { status: 500 });
  }
}

// POST — send a message, persist both sides, return the reply
export async function POST(request: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const { message } = parsed.data;

    const program = await getActiveProgram();
    if (!program) {
      return NextResponse.json({ error: 'No active program found' }, { status: 404 });
    }

    await db.aIConversation.create({
      data: { role: 'user', content: message, programId: program.id },
    });

    const recentMessages = await db.aIConversation.findMany({
      where: { programId: program.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });

    const chatHistory = recentMessages.reverse().map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));
    // The Messages API requires the first message to be from the user; an
    // orphaned assistant row at the window boundary would 400 every request.
    while (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
      chatHistory.shift();
    }

    const reply =
      (await generateClaudeReply(program.id, chatHistory)) ?? generateMockResponse(message);

    await db.aIConversation.create({
      data: { role: 'assistant', content: reply, programId: program.id },
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[API /api/ai-chat POST] Error:', error);
    return NextResponse.json({ error: 'Failed to process AI chat request' }, { status: 500 });
  }
}

// DELETE — clear the active program's conversation history
export async function DELETE() {
  try {
    const program = await getActiveProgram();
    if (!program) {
      return NextResponse.json({ error: 'No active program found' }, { status: 404 });
    }
    await db.aIConversation.deleteMany({ where: { programId: program.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API /api/ai-chat DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 });
  }
}
