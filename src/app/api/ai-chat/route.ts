import { NextRequest, NextResponse } from 'next/server';
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
- Reference specific WBP codes, task names, and team names when possible
- Use structured responses (bullet points, numbered lists) for clarity
- Highlight urgent items and blockers clearly
- Always consider cross-team dependencies
- Respond in the same language the user writes in (English or Arabic)`;

function generateMockResponse(message: string): string {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('risk') || lowerMsg.includes('خطر') || lowerMsg.includes('مخاطر')) {
    return `**Risk Analysis Summary**

Based on the current program data, here are the key risk areas:

🔴 **Critical Risks:**
- Supply chain delays on cryptographic module procurement (WBP-CRY-003) — impacts downstream integration timeline
- Key personnel availability constraint on firmware validation team

🟡 **Medium Risks:**
- Integration testing environment setup is behind schedule by 2 weeks
- Third-party certification dependency may slip into Q3

✅ **Recommendations:**
1. Escalate cryptographic module procurement to program director
2. Initiate cross-training for firmware validation team
3. Allocate additional resources to integration testing environment
4. Pre-engage with certification body to secure testing windows`;
  }

  if (lowerMsg.includes('status') || lowerMsg.includes('progress') || lowerMsg.includes('حالة') || lowerMsg.includes('تقدم')) {
    return `**Program Status Overview — BRAIN Network Encryptor**

📊 **Overall Progress: 42%**

| WBP | Status | Health | Progress |
|-----|--------|--------|----------|
| WBP-ARCH-001 System Architecture | In Progress | On Track | 68% |
| WBP-CRY-002 Crypto Engine | In Progress | At Risk | 35% |
| WBP-HW-003 Hardware Design | Planned | On Track | 10% |
| WBP-SW-004 Firmware Dev | In Progress | At Risk | 28% |
| WBP-INT-005 Integration | Planned | — | 0% |
| WBP-TST-006 Testing & QA | Planned | — | 0% |

⚠️ **Attention Required:** WBP-CRY-002 and WBP-SW-004 are both at-risk due to dependency on cryptographic library certification.

🎯 **Next milestone:** Architecture Review — Target: End of current sprint.`;
  }

  if (lowerMsg.includes('depend') || lowerMsg.includes('تبع') || lowerMsg.includes('block')) {
    return `**Dependency Map Analysis**

🔗 **Active Dependencies:**

1. **WBP-ARCH-001 → WBP-CRY-002** (Blocks)
   Architecture freeze required before crypto engine implementation
   ✅ Architecture is 68% complete — on track

2. **WBP-CRY-002 → WBP-SW-004** (Blocks)
   Crypto API must be stable before firmware integration
   ⚠️ Crypto engine at 35% — potential delay

3. **WBP-CRY-003 → WBP-HW-003** (Depends On)
   Hardware design needs certified cryptographic module specs
   🔴 Module procurement delayed — **BROKEN dependency risk**

4. **WBP-SW-004 → WBP-INT-005** (Blocks)
   Firmware must be feature-complete before integration testing

5. **WBP-INT-005 → WBP-TST-006** (Blocks)
   Integration complete before formal QA cycle

💡 **Recommendation:** Fast-track WBP-CRY-002 to unblock the critical path. Consider parallel work streams for hardware design using provisional specs.`;
  }

  return `**XCollab AI Analysis**

Thank you for your query. Here's my analysis of the BRAIN Network Encryptor program:

📋 **Current Snapshot:**
- 6 Work Breakdown Packages defined
- 42% overall program completion
- 2 WBPs currently at-risk (Crypto Engine, Firmware Development)
- 4 active dependencies, 1 potential blocker

🔍 **Key Observations:**
1. The critical path runs through Architecture → Crypto Engine → Firmware → Integration → QA
2. The cryptographic module procurement is the highest-impact risk
3. Team utilization is at ~78% — capacity exists for risk mitigation

🎯 **Suggested Actions:**
- Conduct a dependency cleanup meeting with all team leads
- Establish weekly cross-team sync for at-risk WBPs
- Review and update risk register with current severity assessments

Ask me about specific WBPs, risks, dependencies, or team workloads for more detailed analysis.`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, programId } = await request.json();

    if (!message || !programId) {
      return NextResponse.json(
        { error: 'message and programId are required' },
        { status: 400 }
      );
    }

    // Store user message
    await db.aIConversation.create({
      data: {
        role: 'user',
        content: message,
        programId,
      },
    });

    // Fetch recent conversation context (last 10 messages)
    const recentMessages = await db.aIConversation.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Build messages array for AI (oldest first)
    const chatMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...recentMessages
        .reverse()
        .map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        })),
    ];

    // Try to use z-ai-web-dev-sdk
    let reply: string;
    try {
      const { default: ZAI } = await import('z-ai-web-dev-sdk');
      const zAI = await ZAI.create();

      const response = await zAI.chat.completions.create({
        messages: chatMessages,
        stream: false,
      });

      // Extract the text content from the response
      reply =
        response?.choices?.[0]?.message?.content ??
        response?.content ??
        response?.text ??
        typeof response === 'string'
          ? response
          : JSON.stringify(response);
    } catch {
      // Fallback to mock response if SDK fails
      console.warn('[AI Chat] z-ai-web-dev-sdk unavailable, using mock response');
      reply = generateMockResponse(message);
    }

    // Store AI reply
    await db.aIConversation.create({
      data: {
        role: 'assistant',
        content: reply,
        programId,
      },
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[API /api/ai-chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI chat request' },
      { status: 500 }
    );
  }
}
