// One-off Program Architect run (offline): converts the SAQR brief into a
// complete program in the live database — same shapes the /api/architect
// endpoint writes. Run: node scripts/create-saqr-program.mjs
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const DESIGN = {
  name: 'SAQR Counter-UAS Defense Grid',
  description:
    'Distributed counter-drone defense grid: radar and RF sensor mesh, electronic-warfare soft-kill, and effector command-and-control over Katim secure links — protecting critical infrastructure against hostile UAS swarms.',
  durationMonths: 16,
  teams: [
    { name: 'Radar & Sensor Mesh', color: '#FF4713', type: 'internal' },
    { name: 'EW & Soft-Kill', color: '#E8850C', type: 'internal' },
    { name: 'C2 & Secure Links', color: '#D4A017', type: 'internal' },
    { name: 'Effector Integration', color: '#FF6B35', type: 'internal' },
    { name: 'Field Trials & Certification', color: '#B85C38', type: 'internal' },
    { name: 'OryxWave RF Modules', color: '#7B8794', type: 'vendor' },
  ],
  wbps: [
    { code: 'WBP-100', name: 'Sensor Grid', teamName: 'Radar & Sensor Mesh', status: 'in-progress', priority: 'critical', health: 'on-track', progress: 45, startOffsetWeeks: 0, durationWeeks: 32,
      description: 'Networked X-band micro-radars and passive RF detection nodes forming a self-healing sensor mesh with 360° low-altitude coverage.',
      scope: 'Deliver 24-node sensor grid with sub-second track initiation on Group 1-2 UAS at 5 km.',
      tasks: [
        { title: 'Micro-radar antenna array bring-up', status: 'done', priority: 'critical' },
        { title: 'Passive RF fingerprint library v1', status: 'in-progress', priority: 'high' },
        { title: 'Mesh self-healing failover logic', status: 'in-progress', priority: 'high' },
        { title: 'Clutter rejection tuning for urban sites', status: 'todo', priority: 'medium' },
      ],
      milestones: [
        { name: 'First 4-node mesh tracking live targets', offsetWeeks: 14, status: 'reached' },
        { name: '24-node grid deployed at test range', offsetWeeks: 30, status: 'upcoming' },
      ],
      risks: [{ title: 'Urban multipath degrades track quality below spec at two pilot sites', severity: 'high', status: 'mitigating' }] },
    { code: 'WBP-110', name: 'RF Detection Nodes', teamName: 'OryxWave RF Modules', parentCode: 'WBP-100', status: 'in-progress', priority: 'high', health: 'at-risk', progress: 35, startOffsetWeeks: 2, durationWeeks: 24,
      description: 'Vendor-supplied wideband RF sensing modules for drone-controller signal detection and direction finding.',
      scope: 'OryxWave delivers 30 qualified RF modules with acceptance testing at EDGE.',
      tasks: [
        { title: 'Module environmental qualification', status: 'in-progress', priority: 'critical' },
        { title: 'DF accuracy acceptance procedure', status: 'review', priority: 'high' },
      ],
      milestones: [{ name: 'First article acceptance', offsetWeeks: 18, status: 'upcoming' }],
      risks: [{ title: 'Vendor component substitution requires re-qualification', severity: 'medium', status: 'open' }] },
    { code: 'WBP-200', name: 'EW Soft-Kill Suite', teamName: 'EW & Soft-Kill', status: 'in-progress', priority: 'critical', health: 'at-risk', progress: 38, startOffsetWeeks: 4, durationWeeks: 34,
      description: 'Directional jamming and protocol-takeover effectors that neutralize UAS without kinetic engagement.',
      scope: 'Smart jammer with adaptive waveforms plus takeover capability for the top 12 commercial UAS protocols.',
      tasks: [
        { title: 'Adaptive jamming waveform engine', status: 'in-progress', priority: 'critical' },
        { title: 'Protocol takeover library — 8 of 12 protocols', status: 'in-progress', priority: 'high' },
        { title: 'Fratricide prevention interlocks', status: 'todo', priority: 'critical' },
      ],
      milestones: [{ name: 'Soft-kill demo against swarm of 6', offsetWeeks: 28, status: 'upcoming' }],
      risks: [
        { title: 'Frequency authority clearance for urban jamming trials pending', severity: 'critical', status: 'open' },
        { title: 'New FHSS controllers resist current takeover method', severity: 'high', status: 'mitigating' },
      ] },
    { code: 'WBP-300', name: 'C2 Core on Katim Links', teamName: 'C2 & Secure Links', status: 'in-progress', priority: 'critical', health: 'on-track', progress: 50, startOffsetWeeks: 2, durationWeeks: 36,
      description: 'Command-and-control layer fusing sensor tracks into a single air picture, with engagement authorization workflow, over Katim post-quantum secured links.',
      scope: 'C2 node handling 200 simultaneous tracks with two-person engagement authorization and full audit trail.',
      tasks: [
        { title: 'Multi-sensor track fusion engine', status: 'done', priority: 'critical' },
        { title: 'Engagement authorization workflow', status: 'in-progress', priority: 'critical' },
        { title: 'Katim link integration layer', status: 'in-progress', priority: 'high' },
        { title: 'Operator UI threat prioritization', status: 'todo', priority: 'medium' },
      ],
      milestones: [{ name: 'C2 alpha with live sensor feed', offsetWeeks: 20, status: 'reached' }, { name: 'Two-site federated C2', offsetWeeks: 40, status: 'upcoming' }],
      risks: [] },
    { code: 'WBP-310', name: 'Threat Classification AI', teamName: 'C2 & Secure Links', parentCode: 'WBP-300', status: 'in-progress', priority: 'high', health: 'on-track', progress: 42, startOffsetWeeks: 6, durationWeeks: 26,
      description: 'On-edge classifier separating hostile UAS from birds, friendly aircraft, and clutter using fused radar/RF signatures.',
      scope: 'Classifier at >95% precision on the reference threat set, running on grid edge compute.',
      tasks: [
        { title: 'Training set curation from range recordings', status: 'done', priority: 'high' },
        { title: 'Edge inference optimization', status: 'in-progress', priority: 'high' },
      ],
      milestones: [{ name: 'Classifier v1 field evaluation', offsetWeeks: 24, status: 'upcoming' }],
      risks: [{ title: 'False-positive rate on large birds above target', severity: 'medium', status: 'mitigating' }] },
    { code: 'WBP-400', name: 'Effector Integration', teamName: 'Effector Integration', status: 'planned', priority: 'high', health: 'on-track', progress: 15, startOffsetWeeks: 12, durationWeeks: 30,
      description: 'Integration of kinetic interceptors and directed soft-kill effectors with C2 engagement chains.',
      scope: 'Two effector types integrated with closed-loop engagement assessment.',
      tasks: [
        { title: 'Effector interface control document', status: 'in-progress', priority: 'high' },
        { title: 'Hardware-in-the-loop engagement sim', status: 'todo', priority: 'high' },
        { title: 'Battle-damage assessment feed', status: 'todo', priority: 'medium' },
      ],
      milestones: [{ name: 'First closed-loop engagement in sim', offsetWeeks: 34, status: 'upcoming' }],
      risks: [{ title: 'Interceptor supplier ITAR review may delay integration data', severity: 'high', status: 'open' }] },
    { code: 'WBP-500', name: 'Desert Field Trials', teamName: 'Field Trials & Certification', status: 'planned', priority: 'critical', health: 'on-track', progress: 5, startOffsetWeeks: 36, durationWeeks: 20,
      description: 'Three escalating trial campaigns at the desert range: single UAS, coordinated raid, and 20-drone swarm defense.',
      scope: 'Culminates in full-grid swarm defense demonstration for the national customer.',
      tasks: [
        { title: 'Range instrumentation and safety case', status: 'in-progress', priority: 'high' },
        { title: 'Red-team UAS raid scenarios', status: 'todo', priority: 'high' },
      ],
      milestones: [{ name: 'Campaign 1 — single UAS defeats', offsetWeeks: 42, status: 'upcoming' }, { name: 'Swarm defense demonstration', offsetWeeks: 54, status: 'upcoming' }],
      risks: [{ title: 'Summer heat window restricts trial slots at the range', severity: 'medium', status: 'open' }] },
    { code: 'WBP-600', name: 'Certification & Handover', teamName: 'Field Trials & Certification', status: 'planned', priority: 'critical', health: 'on-track', progress: 0, startOffsetWeeks: 48, durationWeeks: 18,
      description: 'National security certification of the engagement chain and operational handover package for the customer.',
      scope: 'Certification evidence, operator training curriculum, and sustainment plan.',
      tasks: [
        { title: 'Engagement-chain safety certification dossier', status: 'todo', priority: 'critical' },
        { title: 'Operator training program', status: 'todo', priority: 'high' },
      ],
      milestones: [{ name: 'Certification submitted', offsetWeeks: 62, status: 'upcoming' }],
      risks: [{ title: 'Certification authority requires additional jamming-safety evidence', severity: 'high', status: 'open' }] },
  ],
  dependencies: [
    { fromCode: 'WBP-110', toCode: 'WBP-100', type: 'blocks' },
    { fromCode: 'WBP-100', toCode: 'WBP-300', type: 'blocks' },
    { fromCode: 'WBP-310', toCode: 'WBP-300', type: 'relates-to' },
    { fromCode: 'WBP-200', toCode: 'WBP-400', type: 'blocks' },
    { fromCode: 'WBP-300', toCode: 'WBP-400', type: 'blocks' },
    { fromCode: 'WBP-400', toCode: 'WBP-500', type: 'blocks' },
    { fromCode: 'WBP-100', toCode: 'WBP-500', type: 'blocks' },
    { fromCode: 'WBP-500', toCode: 'WBP-600', type: 'blocks' },
  ],
};

const org = await db.organization.findFirst();
const start = new Date();
const weeks = (n) => new Date(start.getTime() + n * 7 * 24 * 3600 * 1000);

const program = await db.$transaction(async (tx) => {
  const program = await tx.program.create({
    data: {
      name: DESIGN.name,
      description: DESIGN.description,
      status: 'paused',
      startDate: start,
      targetDate: weeks(Math.round(DESIGN.durationMonths * 4.33)),
      organizationId: org.id,
    },
  });

  const teamIds = new Map();
  for (const t of DESIGN.teams) {
    const slug = `${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${program.id.slice(-4)}`;
    const team = await tx.team.create({ data: { name: t.name, slug, color: t.color, type: t.type, organizationId: org.id } });
    teamIds.set(t.name, team.id);
  }

  const wbpIds = new Map();
  const ordered = [...DESIGN.wbps.filter((w) => !w.parentCode), ...DESIGN.wbps.filter((w) => w.parentCode)];
  let sort = 0;
  for (const w of ordered) {
    const wbp = await tx.wBP.create({
      data: {
        code: w.code, name: w.name, description: w.description, scope: w.scope,
        ownerTeamId: teamIds.get(w.teamName) ?? null,
        programId: program.id,
        parentId: w.parentCode ? (wbpIds.get(w.parentCode) ?? null) : null,
        status: w.status, priority: w.priority, health: w.health,
        progress: w.progress,
        startDate: weeks(w.startOffsetWeeks),
        dueDate: weeks(w.startOffsetWeeks + w.durationWeeks),
        sortOrder: sort++,
      },
    });
    wbpIds.set(w.code, wbp.id);
    if (w.tasks?.length) await tx.task.createMany({ data: w.tasks.map((t, i) => ({ title: t.title, status: t.status, priority: t.priority, wbpId: wbp.id, columnId: t.status, sortOrder: i })) });
    if (w.milestones?.length) await tx.milestone.createMany({ data: w.milestones.map((m) => ({ name: m.name, date: weeks(m.offsetWeeks), status: m.status, wbpId: wbp.id })) });
    if (w.risks?.length) await tx.risk.createMany({ data: w.risks.map((r) => ({ title: r.title, severity: r.severity, status: r.status, wbpId: wbp.id })) });
  }

  const deps = DESIGN.dependencies.filter((d) => wbpIds.has(d.fromCode) && wbpIds.has(d.toCode));
  await tx.dependency.createMany({ data: deps.map((d) => ({ fromWbpId: wbpIds.get(d.fromCode), toWbpId: wbpIds.get(d.toCode), type: d.type, status: 'active' })) });

  await tx.program.updateMany({ where: { status: 'active' }, data: { status: 'paused' } });
  await tx.program.update({ where: { id: program.id }, data: { status: 'active' } });

  await tx.aIConversation.create({
    data: {
      role: 'assistant',
      programId: program.id,
      content: `**Program created: ${DESIGN.name}**\n\nDesigned from your brief: ${DESIGN.teams.length} teams (including the OryxWave RF vendor), ${DESIGN.wbps.length} work packages, ${deps.length} dependencies over ${DESIGN.durationMonths} months.\n\n${DESIGN.description}\n\nAll structures are provisional — review the Work Packages screen and adjust anything before circulating.`,
    },
  });

  return program;
}, { timeout: 30000 });

console.log(`Created: ${program.id} — ${DESIGN.name}`);
await db.$disconnect();
