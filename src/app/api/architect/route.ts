import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';

// ============================================
// Program Architect — one prompt designs an entire program.
// With Anthropic credentials, Claude generates the design via structured
// outputs; without them, a curated showcase design keeps the demo alive.
// The design is written to the database in one transaction and becomes the
// active program.
// ============================================

const requestSchema = z.object({
  brief: z.string().trim().min(10).max(2000),
});

interface DesignTask {
  title: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
}
interface DesignMilestone {
  name: string;
  offsetWeeks: number;
  status: 'upcoming' | 'reached' | 'overdue';
}
interface DesignRisk {
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'mitigating';
}
interface DesignWbp {
  code: string;
  name: string;
  description: string;
  scope: string;
  teamName: string;
  parentCode?: string | null;
  status: 'planned' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  health: 'on-track' | 'at-risk' | 'off-track';
  progress: number;
  startOffsetWeeks: number;
  durationWeeks: number;
  tasks: DesignTask[];
  milestones: DesignMilestone[];
  risks: DesignRisk[];
}
interface ProgramDesign {
  name: string;
  description: string;
  durationMonths: number;
  teams: Array<{ name: string; color: string; type: 'internal' | 'vendor' }>;
  wbps: DesignWbp[];
  dependencies: Array<{ fromCode: string; toCode: string; type: 'blocks' | 'relates-to' }>;
}

const DESIGN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'durationMonths', 'teams', 'wbps', 'dependencies'],
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    durationMonths: { type: 'integer' },
    teams: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'color', 'type'],
        properties: {
          name: { type: 'string' },
          color: { type: 'string', description: 'hex color like #FF8C42' },
          type: { type: 'string', enum: ['internal', 'vendor'] },
        },
      },
    },
    wbps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'name', 'description', 'scope', 'teamName', 'status', 'priority', 'health', 'progress', 'startOffsetWeeks', 'durationWeeks', 'tasks', 'milestones', 'risks'],
        properties: {
          code: { type: 'string', description: 'like WBP-100' },
          name: { type: 'string' },
          description: { type: 'string' },
          scope: { type: 'string' },
          teamName: { type: 'string', description: 'must match a team name' },
          parentCode: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['planned', 'in-progress', 'completed'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          health: { type: 'string', enum: ['on-track', 'at-risk', 'off-track'] },
          progress: { type: 'integer' },
          startOffsetWeeks: { type: 'integer' },
          durationWeeks: { type: 'integer' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'status', 'priority'],
              properties: {
                title: { type: 'string' },
                status: { type: 'string', enum: ['todo', 'in-progress', 'review', 'done'] },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              },
            },
          },
          milestones: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'offsetWeeks', 'status'],
              properties: {
                name: { type: 'string' },
                offsetWeeks: { type: 'integer' },
                status: { type: 'string', enum: ['upcoming', 'reached', 'overdue'] },
              },
            },
          },
          risks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'severity', 'status'],
              properties: {
                title: { type: 'string' },
                severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                status: { type: 'string', enum: ['open', 'mitigating'] },
              },
            },
          },
        },
      },
    },
    dependencies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fromCode', 'toCode', 'type'],
        properties: {
          fromCode: { type: 'string' },
          toCode: { type: 'string' },
          type: { type: 'string', enum: ['blocks', 'relates-to'] },
        },
      },
    },
  },
} as const;

const ARCHITECT_PROMPT = `You are the program architect for EDGE Group / Katim, a UAE defense technology group. Design a complete, realistic program plan from the brief below.

Requirements:
- 4-6 teams (one may be an external vendor), each with a distinct warm-spectrum hex color.
- 6-9 top-level Work Breakdown Packages with codes WBP-100, WBP-200, ... plus 2-4 child packages (parentCode set) where natural.
- Every WBP: a crisp description, a scope statement, 2-4 realistic tasks with mixed statuses, 1-2 milestones, 0-2 risks.
- A coherent dependency chain reflecting the real critical path (hardware before firmware, integration before certification, etc.).
- Progress values consistent with statuses; a couple of packages at-risk with matching open risks — make it feel like a living program, not a fresh one.
- Timeline offsets in weeks from program start; total duration matching durationMonths.

Brief: `;

// ============================================
// Offline generator — used when Claude is unreachable. Unlike a canned
// fallback, it PARSES the brief (project name, timeline, team mentions) and
// synthesizes a tailored plan, so the prompt-to-program demo works with no
// API key. With credentials, Claude replaces all of this with a real design.
// ============================================

const TEAM_KEYWORDS: Array<{ match: RegExp; name: string; color: string }> = [
  { match: /design|ux|ui\b/i, name: 'Design', color: '#FF6B35' },
  { match: /front[- ]?end|react|web app/i, name: 'Frontend Engineering', color: '#E8850C' },
  { match: /back[- ]?end|api|server/i, name: 'Backend Engineering', color: '#D4A017' },
  { match: /mobile|ios|android/i, name: 'Mobile Engineering', color: '#C97B2D' },
  { match: /qa|quality|test/i, name: 'Quality Assurance', color: '#B85C38' },
  { match: /devops|infra|platform|deploy/i, name: 'DevOps & Platform', color: '#8C6A4F' },
  { match: /data|ai\b|ml\b|machine learning/i, name: 'Data & AI', color: '#A0522D' },
  { match: /security|crypto/i, name: 'Security', color: '#8B4513' },
  { match: /marketing|growth|launch campaign/i, name: 'Marketing', color: '#CD853F' },
];

const NAME_STOPWORDS = new Set(['where', 'which', 'with', 'and', 'that', 'for', 'the', 'is', 'this', 'a', 'an', 'to', 'in', 'it']);

function extractName(brief: string): string {
  // Capture after "called/named/titled" up to any delimiter (comma, dash,
  // period, quote, newline), then trim trailing prose at the first stopword.
  const called = brief.match(/(?:called|named|titled)\s+["'“]?([^,.\n"'“”—–;]{2,60})/i);
  if (called) {
    const words: string[] = [];
    for (const word of called[1].trim().split(/\s+/)) {
      if (word === '-' || NAME_STOPWORDS.has(word.toLowerCase())) break;
      words.push(word);
      if (words.length >= 5) break;
    }
    if (words.length > 0) return words.join(' ').slice(0, 40);
  }
  const quoted = brief.match(/["'“]([A-Za-z][\w .-]{1,40})["'”]/);
  if (quoted) return quoted[1].trim();
  const project = brief.match(/(?:project|app|platform|product|program)\s+([A-Z][\w-]{2,30})/);
  if (project) return project[1].trim();
  return 'New Initiative';
}

function extractWeeks(brief: string): number {
  const m = brief.match(/(\d+)\s*[- ]?\s*(week|month)/i);
  if (!m) return 12;
  const n = Number(m[1]);
  const weeks = /month/i.test(m[2]) ? n * 4.33 : n;
  return Math.min(104, Math.max(2, Math.round(weeks)));
}

function generateOfflineDesign(brief: string): ProgramDesign {
  const name = extractName(brief);
  const totalWeeks = extractWeeks(brief);
  const at = (fraction: number) => Math.round(fraction * totalWeeks);
  const span = (from: number, to: number) => Math.max(1, at(to) - at(from));

  const detected = TEAM_KEYWORDS.filter((t) => t.match.test(brief)).map(({ name: n, color }) => ({ name: n, color, type: 'internal' as const }));
  const hasEng = detected.some((t) => t.name.includes('Engineering'));
  const teams: ProgramDesign['teams'] = [
    ...(hasEng ? [] : [{ name: 'Engineering', color: '#E8850C', type: 'internal' as const }]),
    ...detected,
    { name: 'Program Management', color: '#7B8794', type: 'internal' as const },
  ];
  if (/vendor|contractor|external|agency|outsourc/i.test(brief)) {
    teams.push({ name: 'External Vendor', color: '#94A3B8', type: 'vendor' });
  }

  const buildTeam = detected.find((t) => t.name.includes('Engineering'))?.name ?? (hasEng ? detected[0].name : 'Engineering');
  const designTeam = teams.find((t) => t.name === 'Design')?.name;
  const qaTeam = teams.find((t) => t.name === 'Quality Assurance')?.name;

  const wbps: DesignWbp[] = [
    {
      code: 'WBP-100', name: 'Discovery & Requirements', teamName: 'Program Management',
      description: `Scope definition, stakeholder alignment, and success criteria for ${name}.`,
      scope: `Signed-off requirements and delivery plan for ${name}.`,
      status: 'in-progress', priority: 'critical', health: 'on-track', progress: 60,
      startOffsetWeeks: 0, durationWeeks: span(0, 0.2),
      tasks: [
        { title: 'Stakeholder interviews and goals workshop', status: 'done', priority: 'high' },
        { title: `${name} requirements document`, status: 'in-progress', priority: 'critical' },
        { title: 'Delivery plan sign-off', status: 'todo', priority: 'high' },
      ],
      milestones: [{ name: 'Requirements approved', offsetWeeks: at(0.2), status: 'upcoming' }],
      risks: [{ title: 'Late stakeholder input could shift scope after design starts', severity: 'medium', status: 'open' }],
    },
    ...(designTeam ? [{
      code: 'WBP-200', name: 'Experience Design', teamName: designTeam,
      description: `End-to-end UX flows, visual identity, and a clickable prototype for ${name}.`,
      scope: 'Approved design system and prototypes covering every core flow.',
      status: 'in-progress' as const, priority: 'high' as const, health: 'on-track' as const, progress: 35,
      startOffsetWeeks: at(0.1), durationWeeks: span(0.1, 0.4),
      tasks: [
        { title: 'Core user flows and wireframes', status: 'in-progress' as const, priority: 'high' as const },
        { title: 'Design system foundations', status: 'in-progress' as const, priority: 'medium' as const },
        { title: 'Clickable prototype for stakeholder review', status: 'todo' as const, priority: 'high' as const },
      ],
      milestones: [{ name: 'Design review gate', offsetWeeks: at(0.4), status: 'upcoming' as const }],
      risks: [],
    }] : []),
    {
      code: 'WBP-300', name: 'Core Build', teamName: buildTeam,
      description: `Implementation of ${name}'s core features and integrations.`,
      scope: 'Feature-complete build deployed to the staging environment.',
      status: totalWeeks <= 4 ? 'in-progress' : 'planned', priority: 'critical', health: 'on-track',
      progress: totalWeeks <= 4 ? 15 : 5,
      startOffsetWeeks: at(0.25), durationWeeks: span(0.25, 0.75),
      tasks: [
        { title: 'Project scaffolding and CI pipeline', status: 'in-progress', priority: 'high' },
        { title: 'Core feature implementation', status: 'todo', priority: 'critical' },
        { title: 'Integrations and data layer', status: 'todo', priority: 'high' },
        { title: 'Staging deployment', status: 'todo', priority: 'medium' },
      ],
      milestones: [{ name: 'Feature-complete on staging', offsetWeeks: at(0.75), status: 'upcoming' }],
      risks: [{ title: 'Scope creep against the fixed timeline', severity: 'high', status: 'open' }],
    },
    ...(qaTeam ? [{
      code: 'WBP-400', name: 'Quality & Hardening', teamName: qaTeam,
      description: `Test strategy, automated coverage, and release hardening for ${name}.`,
      scope: 'Green test suite, performance baseline, and release sign-off.',
      status: 'planned' as const, priority: 'high' as const, health: 'on-track' as const, progress: 0,
      startOffsetWeeks: at(0.6), durationWeeks: span(0.6, 0.9),
      tasks: [
        { title: 'Test plan and coverage targets', status: 'todo' as const, priority: 'high' as const },
        { title: 'Automated regression suite', status: 'todo' as const, priority: 'high' as const },
        { title: 'Performance and accessibility pass', status: 'todo' as const, priority: 'medium' as const },
      ],
      milestones: [{ name: 'Release candidate approved', offsetWeeks: at(0.9), status: 'upcoming' as const }],
      risks: [{ title: 'Compressed QA window if build slips', severity: 'high' as const, status: 'open' as const }],
    }] : []),
    {
      code: 'WBP-500', name: 'Launch & Handover', teamName: 'Program Management',
      description: `Release of ${name}, rollout communications, and operational handover.`,
      scope: 'Production launch with monitoring, docs, and support handover.',
      status: 'planned', priority: 'critical', health: 'on-track', progress: 0,
      startOffsetWeeks: at(0.85), durationWeeks: span(0.85, 1),
      tasks: [
        { title: 'Launch checklist and rollback plan', status: 'todo', priority: 'critical' },
        { title: 'Production release', status: 'todo', priority: 'critical' },
        { title: 'Handover documentation', status: 'todo', priority: 'medium' },
      ],
      milestones: [{ name: `${name} live`, offsetWeeks: totalWeeks, status: 'upcoming' }],
      risks: [],
    },
  ];

  // Rounding of phase fractions can spill past the requested window on short
  // timelines — clamp every package inside it.
  for (const w of wbps) {
    w.startOffsetWeeks = Math.min(w.startOffsetWeeks, Math.max(0, totalWeeks - 1));
    w.durationWeeks = Math.max(1, Math.min(w.durationWeeks, totalWeeks - w.startOffsetWeeks));
    for (const m of w.milestones) m.offsetWeeks = Math.min(m.offsetWeeks, totalWeeks);
  }

  const deps: ProgramDesign['dependencies'] = [];
  const codes = wbps.map((w) => w.code);
  for (let i = 0; i < codes.length - 1; i++) {
    deps.push({ fromCode: codes[i], toCode: codes[i + 1], type: 'blocks' });
  }

  return {
    name,
    description: brief.length <= 240 ? brief : `${brief.slice(0, 237)}…`,
    durationMonths: Math.max(1, Math.round(totalWeeks / 4.33)),
    teams,
    wbps,
    dependencies: deps,
  };
}

/** Curated showcase design retained for reference demos. */
const FALLBACK_DESIGN: ProgramDesign = {
  name: 'SHAHEEN Tactical Data Link',
  description:
    'Jam-resistant, post-quantum secured tactical data link connecting UAS swarms to ground control — a Katim program for sovereign battlefield communications.',
  durationMonths: 14,
  teams: [
    { name: 'RF & Antenna Engineering', color: '#FF4713', type: 'internal' },
    { name: 'Waveform & Crypto', color: '#E8850C', type: 'internal' },
    { name: 'Airborne Firmware', color: '#D4A017', type: 'internal' },
    { name: 'Ground Control Software', color: '#FF6B35', type: 'internal' },
    { name: 'Test & Certification', color: '#B85C38', type: 'internal' },
    { name: 'FALCONWORKS Antenna Systems', color: '#7B8794', type: 'vendor' },
  ],
  wbps: [
    { code: 'WBP-100', name: 'RF Front-End & Antennas', description: 'Multi-band software-defined RF front-end with electronically steered antenna arrays for airborne and ground terminals.', scope: 'Deliver flight-qualified RF hardware meeting MIL-STD-461G EMC requirements.', teamName: 'RF & Antenna Engineering', status: 'in-progress', priority: 'critical', health: 'at-risk', progress: 40, startOffsetWeeks: 0, durationWeeks: 28, tasks: [
      { title: 'SDR transceiver board bring-up', status: 'done', priority: 'critical' },
      { title: 'Phased-array element characterization', status: 'in-progress', priority: 'high' },
      { title: 'EMC pre-compliance testing', status: 'todo', priority: 'high' },
    ], milestones: [ { name: 'RF prototype on air', offsetWeeks: 16, status: 'reached' }, { name: 'Flight-qualified RF unit', offsetWeeks: 28, status: 'upcoming' } ], risks: [ { title: 'GaN amplifier lead times slipping beyond 12 weeks', severity: 'high', status: 'open' } ] },
    { code: 'WBP-110', name: 'Airborne Antenna Array', description: 'Conformal antenna array for UAS airframes, subcontracted to FALCONWORKS.', scope: 'Vendor-delivered conformal array with acceptance testing at EDGE facilities.', teamName: 'FALCONWORKS Antenna Systems', parentCode: 'WBP-100', status: 'in-progress', priority: 'high', health: 'at-risk', progress: 30, startOffsetWeeks: 4, durationWeeks: 20, tasks: [
      { title: 'Conformal array mechanical fit check', status: 'in-progress', priority: 'high' },
      { title: 'Vendor acceptance test procedure sign-off', status: 'review', priority: 'critical' },
    ], milestones: [ { name: 'First article delivery', offsetWeeks: 20, status: 'upcoming' } ], risks: [ { title: 'Vendor first-article schedule confidence is low', severity: 'medium', status: 'mitigating' } ] },
    { code: 'WBP-200', name: 'Waveform & Link Security', description: 'LPI/LPD frequency-hopping waveform with post-quantum key exchange derived from the Katim crypto suite.', scope: 'Waveform implementation on SDR with FIPS-validated crypto core.', teamName: 'Waveform & Crypto', status: 'in-progress', priority: 'critical', health: 'on-track', progress: 55, startOffsetWeeks: 2, durationWeeks: 30, tasks: [
      { title: 'Hopping sequence generator implementation', status: 'done', priority: 'critical' },
      { title: 'PQ key encapsulation integration', status: 'in-progress', priority: 'critical' },
      { title: 'Anti-jam performance simulation', status: 'in-progress', priority: 'high' },
    ], milestones: [ { name: 'Waveform v1 over-the-air', offsetWeeks: 24, status: 'upcoming' } ], risks: [ { title: 'Crypto module certification dependency on national lab slots', severity: 'critical', status: 'open' } ] },
    { code: 'WBP-300', name: 'Airborne Terminal Firmware', description: 'Real-time firmware for the airborne terminal: link management, secure boot, OTA updates.', scope: 'DO-178C-informed firmware development with hardware root of trust.', teamName: 'Airborne Firmware', status: 'in-progress', priority: 'high', health: 'on-track', progress: 35, startOffsetWeeks: 8, durationWeeks: 28, tasks: [
      { title: 'Secure boot chain on flight hardware', status: 'in-progress', priority: 'critical' },
      { title: 'Link-state manager module', status: 'in-progress', priority: 'high' },
      { title: 'Firmware OTA rollback mechanism', status: 'todo', priority: 'medium' },
    ], milestones: [ { name: 'Firmware beta on bench rig', offsetWeeks: 26, status: 'upcoming' } ], risks: [] },
    { code: 'WBP-400', name: 'Ground Control Integration', description: 'Swarm-aware ground control station software with live link telemetry and mission replay.', scope: 'GCS plugin suite integrating link health into the operator picture.', teamName: 'Ground Control Software', status: 'in-progress', priority: 'high', health: 'on-track', progress: 45, startOffsetWeeks: 6, durationWeeks: 30, tasks: [
      { title: 'Link telemetry dashboard', status: 'done', priority: 'high' },
      { title: 'Swarm topology visualization', status: 'in-progress', priority: 'medium' },
      { title: 'Mission replay with link events', status: 'todo', priority: 'medium' },
    ], milestones: [ { name: 'GCS integration demo', offsetWeeks: 30, status: 'upcoming' } ], risks: [ { title: 'Operator workload concerns from early usability sessions', severity: 'medium', status: 'mitigating' } ] },
    { code: 'WBP-500', name: 'System Integration & Field Trials', description: 'End-to-end integration: airborne terminals, ground stations, swarm scenarios in desert trials.', scope: 'Three field trial campaigns culminating in a 12-node swarm demonstration.', teamName: 'Test & Certification', status: 'planned', priority: 'critical', health: 'on-track', progress: 5, startOffsetWeeks: 28, durationWeeks: 20, tasks: [
      { title: 'Trial range coordination and permits', status: 'in-progress', priority: 'high' },
      { title: 'Integration test plan', status: 'todo', priority: 'high' },
    ], milestones: [ { name: 'First field trial', offsetWeeks: 36, status: 'upcoming' }, { name: '12-node swarm demo', offsetWeeks: 46, status: 'upcoming' } ], risks: [ { title: 'Range availability conflicts with national exercise calendar', severity: 'medium', status: 'open' } ] },
    { code: 'WBP-600', name: 'Certification & Export Compliance', description: 'National security certification of the crypto chain and export-control classification.', scope: 'Sovereign certification plus export documentation for allied markets.', teamName: 'Test & Certification', status: 'planned', priority: 'critical', health: 'on-track', progress: 0, startOffsetWeeks: 40, durationWeeks: 16, tasks: [
      { title: 'Certification evidence package', status: 'todo', priority: 'critical' },
      { title: 'Export classification dossier', status: 'todo', priority: 'high' },
    ], milestones: [ { name: 'Certification submitted', offsetWeeks: 52, status: 'upcoming' } ], risks: [ { title: 'Evidence package depends on final waveform freeze', severity: 'high', status: 'open' } ] },
  ],
  dependencies: [
    { fromCode: 'WBP-100', toCode: 'WBP-300', type: 'blocks' },
    { fromCode: 'WBP-200', toCode: 'WBP-300', type: 'blocks' },
    { fromCode: 'WBP-110', toCode: 'WBP-100', type: 'blocks' },
    { fromCode: 'WBP-300', toCode: 'WBP-500', type: 'blocks' },
    { fromCode: 'WBP-400', toCode: 'WBP-500', type: 'blocks' },
    { fromCode: 'WBP-500', toCode: 'WBP-600', type: 'blocks' },
    { fromCode: 'WBP-200', toCode: 'WBP-600', type: 'relates-to' },
  ],
};

async function generateDesign(brief: string): Promise<{ design: ProgramDesign; source: 'claude' | 'fallback' }> {
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: {
        format: { type: 'json_schema', schema: DESIGN_JSON_SCHEMA as unknown as Record<string, unknown> },
      },
      messages: [{ role: 'user', content: ARCHITECT_PROMPT + brief }],
    });
    if (response.stop_reason === 'refusal') throw new Error('refused');
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return { design: JSON.parse(text) as ProgramDesign, source: 'claude' };
  } catch (error) {
    console.warn('[Architect] Claude unavailable, synthesizing from the brief:', error instanceof Error ? error.message : error);
    // The showcase design answers drone/tactical briefs better than the
    // generic synthesizer; everything else gets a brief-tailored plan.
    if (/drone|uas|tactical|data link/i.test(brief) && /secure|comms|communication/i.test(brief)) {
      return { design: FALLBACK_DESIGN, source: 'fallback' };
    }
    return { design: generateOfflineDesign(brief), source: 'fallback' };
  }
}

async function applyDesign(design: ProgramDesign) {
  const org = await db.organization.findFirst();
  if (!org) throw new Error('No organization seeded');

  const start = new Date();
  const weeks = (n: number) => new Date(start.getTime() + n * 7 * 24 * 3600 * 1000);
  // Derive the end from the actual schedule — durationMonths is an integer
  // and would round a 3-week program up to a whole month.
  const end = weeks(
    design.wbps.length > 0
      ? Math.max(...design.wbps.map((w) => w.startOffsetWeeks + w.durationWeeks))
      : Math.round(design.durationMonths * 4.33),
  );

  return db.$transaction(async (tx) => {
    const program = await tx.program.create({
      data: {
        name: design.name,
        description: design.description,
        status: 'paused',
        startDate: start,
        targetDate: end,
        organizationId: org.id,
      },
    });

    const teamIds = new Map<string, string>();
    for (const t of design.teams) {
      const slug = `${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${program.id.slice(-4)}`;
      const team = await tx.team.create({
        data: { name: t.name, slug, color: t.color, type: t.type, organizationId: org.id },
      });
      teamIds.set(t.name, team.id);
    }

    const wbpIds = new Map<string, string>();
    // Parents first so children can reference them
    const ordered = [...design.wbps.filter((w) => !w.parentCode), ...design.wbps.filter((w) => w.parentCode)];
    let sort = 0;
    for (const w of ordered) {
      const wbp = await tx.wBP.create({
        data: {
          code: w.code,
          name: w.name,
          description: w.description,
          scope: w.scope,
          ownerTeamId: teamIds.get(w.teamName) ?? null,
          programId: program.id,
          parentId: w.parentCode ? (wbpIds.get(w.parentCode) ?? null) : null,
          status: w.status,
          priority: w.priority,
          health: w.health,
          progress: Math.max(0, Math.min(100, w.progress)),
          startDate: weeks(w.startOffsetWeeks),
          dueDate: weeks(w.startOffsetWeeks + w.durationWeeks),
          sortOrder: sort++,
        },
      });
      wbpIds.set(w.code, wbp.id);

      if (w.tasks.length > 0) {
        await tx.task.createMany({
          data: w.tasks.map((t, i) => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            wbpId: wbp.id,
            columnId: t.status,
            sortOrder: i,
          })),
        });
      }
      if (w.milestones.length > 0) {
        await tx.milestone.createMany({
          data: w.milestones.map((m) => ({ name: m.name, date: weeks(m.offsetWeeks), status: m.status, wbpId: wbp.id })),
        });
      }
      if (w.risks.length > 0) {
        await tx.risk.createMany({
          data: w.risks.map((r) => ({ title: r.title, severity: r.severity, status: r.status, wbpId: wbp.id })),
        });
      }
    }

    const deps = design.dependencies.filter((d) => wbpIds.has(d.fromCode) && wbpIds.has(d.toCode));
    if (deps.length > 0) {
      await tx.dependency.createMany({
        data: deps.map((d) => ({ fromWbpId: wbpIds.get(d.fromCode)!, toWbpId: wbpIds.get(d.toCode)!, type: d.type, status: 'active' })),
      });
    }

    // Make the new program active
    await tx.program.updateMany({ where: { status: 'active' }, data: { status: 'paused' } });
    await tx.program.update({ where: { id: program.id }, data: { status: 'active' } });

    // Seed the program's conversation with the architect's summary
    await tx.aIConversation.create({
      data: {
        role: 'assistant',
        programId: program.id,
        content: `**Program created: ${design.name}**\n\nI designed this program with ${design.teams.length} teams, ${design.wbps.length} work packages, and ${deps.length} dependencies over ${design.durationMonths} months.\n\n${design.description}\n\nAll structures are provisional — review the Work Packages screen and adjust anything before circulating.`,
      },
    });

    return program;
  }, { timeout: 30000 });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'A program brief of at least 10 characters is required' },
        { status: 400 },
      );
    }
    const { design, source } = await generateDesign(parsed.data.brief);
    const program = await applyDesign(design);
    return NextResponse.json({
      ok: true,
      source,
      programId: program.id,
      name: program.name,
      teams: design.teams.length,
      wbps: design.wbps.length,
    });
  } catch (error) {
    console.error('[API /api/architect] Error:', error);
    return NextResponse.json({ error: 'Failed to create the program' }, { status: 500 });
  }
}
