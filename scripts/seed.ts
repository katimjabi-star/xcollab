import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function seed() {
  await db.dependency.deleteMany()
  await db.milestone.deleteMany()
  await db.risk.deleteMany()
  await db.task.deleteMany()
  await db.aIConversation.deleteMany()
  await db.wBP.deleteMany()
  await db.program.deleteMany()
  await db.member.deleteMany()
  await db.team.deleteMany()
  await db.organization.deleteMany()

  const org = await db.organization.create({
    data: { name: 'EDGE Group', slug: 'edge-group', type: 'enterprise' },
  })

  const hwTeam = await db.team.create({ data: { name: 'Hardware Engineering', slug: 'hw', color: '#FF4713', type: 'internal', organizationId: org.id } })
  const fwTeam = await db.team.create({ data: { name: 'Firmware Engineering', slug: 'fw', color: '#E94A26', type: 'internal', organizationId: org.id } })
  const secTeam = await db.team.create({ data: { name: 'Security & Crypto', slug: 'sec', color: '#FF6B35', type: 'internal', organizationId: org.id } })
  const swTeam = await db.team.create({ data: { name: 'Application Development', slug: 'app', color: '#FF8C42', type: 'internal', organizationId: org.id } })
  const qaTeam = await db.team.create({ data: { name: 'Testing & QA', slug: 'qa', color: '#FFA94D', type: 'internal', organizationId: org.id } })
  const mfgTeam = await db.team.create({ data: { name: 'Manufacturing', slug: 'mfg', color: '#FFC078', type: 'internal', organizationId: org.id } })
  const certTeam = await db.team.create({ data: { name: 'Certification', slug: 'cert', color: '#FFD8A8', type: 'internal', organizationId: org.id } })
  const pmTeam = await db.team.create({ data: { name: 'Program Management', slug: 'pm', color: '#444B52', type: 'internal', organizationId: org.id } })
  const vendorTeam = await db.team.create({ data: { name: 'KERNO Enterprises (Vendor)', slug: 'vendor-kerno', color: '#7B8794', type: 'vendor', organizationId: org.id } })

  const alice = await db.member.create({ data: { name: 'Alice Al-Rashid', email: 'alice@edgegroup.ae', role: 'team-lead', organizationId: org.id, teamId: hwTeam.id } })
  const bob = await db.member.create({ data: { name: 'Bob Chen', email: 'bob@edgegroup.ae', role: 'member', organizationId: org.id, teamId: fwTeam.id } })
  const charlie = await db.member.create({ data: { name: 'Charlie Santos', email: 'charlie@edgegroup.ae', role: 'member', organizationId: org.id, teamId: secTeam.id } })
  const diana = await db.member.create({ data: { name: 'Diana Kallio', email: 'diana@edgegroup.fi', role: 'team-lead', organizationId: org.id, teamId: swTeam.id } })
  const emma = await db.member.create({ data: { name: 'Emma Zhang', email: 'emma@edgegroup.ae', role: 'member', organizationId: org.id, teamId: qaTeam.id } })
  const frank = await db.member.create({ data: { name: 'Frank Muller', email: 'frank@kerno.com', role: 'vendor', organizationId: org.id, teamId: vendorTeam.id } })
  const grace = await db.member.create({ data: { name: 'Grace Hassan', email: 'grace@edgegroup.ae', role: 'admin', organizationId: org.id, teamId: pmTeam.id } })

  const program = await db.program.create({
    data: {
      name: 'BRAIN Network Encryptor',
      description: 'Next-generation sovereign network encryption platform with post-quantum cryptography for defense-grade secure communications.',
      status: 'active',
      startDate: new Date('2026-01-15'),
      targetDate: new Date('2026-12-31'),
      organizationId: org.id,
    },
  })

  const wbp100 = await db.wBP.create({ data: { code: 'WBP-100', name: 'Hardware Platform', description: 'Main chassis, PCB design, power supply, thermal management, and enclosure for the BRAIN encryptor unit.', scope: 'Design and manufacture the physical hardware platform meeting MIL-STD-810H requirements.', ownerTeamId: hwTeam.id, programId: program.id, status: 'in-progress', priority: 'critical', health: 'at-risk', progress: 45, startDate: new Date('2026-01-15'), dueDate: new Date('2026-06-30'), sortOrder: 1 } })
  const wbp110 = await db.wBP.create({ data: { code: 'WBP-110', name: 'PCB & Schematic Design', description: 'Multi-layer PCB design with high-speed crypto processor and network interface modules.', scope: 'Complete PCB schematic and layout for the main processing board.', ownerTeamId: hwTeam.id, programId: program.id, parentId: wbp100.id, status: 'in-progress', priority: 'critical', health: 'on-track', progress: 65, startDate: new Date('2026-01-15'), dueDate: new Date('2026-04-30'), sortOrder: 1 } })
  const wbp120 = await db.wBP.create({ data: { code: 'WBP-120', name: 'Enclosure & Thermal', description: 'Ruggedized enclosure design with active cooling system for continuous operation.', scope: 'Design enclosure meeting MIL-STD-810H and IP68 ratings.', ownerTeamId: hwTeam.id, programId: program.id, parentId: wbp100.id, status: 'planned', priority: 'high', health: 'on-track', progress: 20, startDate: new Date('2026-03-01'), dueDate: new Date('2026-06-30'), sortOrder: 2 } })

  const wbp200 = await db.wBP.create({ data: { code: 'WBP-200', name: 'Crypto Engine', description: 'Hardware-rooted cryptographic engine supporting AES-256, post-quantum algorithms, and sovereign UAE crypto suite.', scope: 'Implement FIPS 140-2 Level 4 compliant crypto engine.', ownerTeamId: secTeam.id, programId: program.id, status: 'in-progress', priority: 'critical', health: 'at-risk', progress: 35, startDate: new Date('2026-02-01'), dueDate: new Date('2026-07-31'), sortOrder: 2 } })
  const wbp210 = await db.wBP.create({ data: { code: 'WBP-210', name: 'Post-Quantum Crypto Module', description: 'Implementation of CRYSTALS-Kyber and CRYSTALS-Dilithium algorithms.', scope: 'Develop and integrate PQ algorithms into the crypto engine pipeline.', ownerTeamId: secTeam.id, programId: program.id, parentId: wbp200.id, status: 'in-progress', priority: 'critical', health: 'behind', progress: 25, startDate: new Date('2026-02-15'), dueDate: new Date('2026-06-15'), sortOrder: 1 } })
  const wbp220 = await db.wBP.create({ data: { code: 'WBP-220', name: 'Key Management System', description: 'Secure key generation, distribution, rotation, and revocation with HSM integration.', scope: 'Build enterprise key management with automated rotation.', ownerTeamId: secTeam.id, programId: program.id, parentId: wbp200.id, status: 'planned', priority: 'high', health: 'on-track', progress: 10, startDate: new Date('2026-04-01'), dueDate: new Date('2026-08-31'), sortOrder: 2 } })

  const wbp300 = await db.wBP.create({ data: { code: 'WBP-300', name: 'Firmware Layer', description: 'Embedded firmware for device management, secure boot chain, and HAL.', scope: 'Develop firmware with secure boot and OTA update capability.', ownerTeamId: fwTeam.id, programId: program.id, status: 'planned', priority: 'high', health: 'on-track', progress: 15, startDate: new Date('2026-03-15'), dueDate: new Date('2026-08-15'), sortOrder: 3 } })

  const wbp400 = await db.wBP.create({ data: { code: 'WBP-400', name: 'Management Software', description: 'Web-based management console for device provisioning, network configuration, and monitoring.', scope: 'Full-stack management application with real-time monitoring and multi-tenant support.', ownerTeamId: swTeam.id, programId: program.id, status: 'in-progress', priority: 'high', health: 'on-track', progress: 30, startDate: new Date('2026-02-15'), dueDate: new Date('2026-09-30'), sortOrder: 4 } })
  const wbp410 = await db.wBP.create({ data: { code: 'WBP-410', name: 'Network Management UI', description: 'Dashboard for network topology visualization and real-time traffic monitoring.', scope: 'Build the primary management interface with real-time device status.', ownerTeamId: swTeam.id, programId: program.id, parentId: wbp400.id, status: 'in-progress', priority: 'high', health: 'on-track', progress: 40, startDate: new Date('2026-02-15'), dueDate: new Date('2026-07-15'), sortOrder: 1 } })
  const wbp420 = await db.wBP.create({ data: { code: 'WBP-420', name: 'Policy Engine', description: 'Rule-based policy engine for automated encryption policy enforcement.', scope: 'Develop policy engine supporting complex rule chains.', ownerTeamId: swTeam.id, programId: program.id, parentId: wbp400.id, status: 'planned', priority: 'medium', health: 'on-track', progress: 5, startDate: new Date('2026-05-01'), dueDate: new Date('2026-09-30'), sortOrder: 2 } })

  const wbp500 = await db.wBP.create({ data: { code: 'WBP-500', name: 'Integration Testing', description: 'End-to-end testing across hardware, firmware, crypto, and software layers.', scope: 'Comprehensive test suite covering all integration points.', ownerTeamId: qaTeam.id, programId: program.id, status: 'planned', priority: 'high', health: 'on-track', progress: 0, startDate: new Date('2026-07-01'), dueDate: new Date('2026-10-31'), sortOrder: 5 } })
  const wbp600 = await db.wBP.create({ data: { code: 'WBP-600', name: 'Certification & Compliance', description: 'FIPS 140-2 Level 4 certification and UAE national security certification.', scope: 'Achieve FIPS 140-2 L4 and UAE national security certification.', ownerTeamId: certTeam.id, programId: program.id, status: 'planned', priority: 'critical', health: 'on-track', progress: 5, startDate: new Date('2026-09-01'), dueDate: new Date('2026-12-15'), sortOrder: 6 } })
  const wbp700 = await db.wBP.create({ data: { code: 'WBP-700', name: 'Manufacturing & Production', description: 'Production line setup, SMT assembly, and supply chain management.', scope: 'Establish production line with vendor KERNO Enterprises.', ownerTeamId: mfgTeam.id, programId: program.id, status: 'planned', priority: 'medium', health: 'on-track', progress: 0, startDate: new Date('2026-08-01'), dueDate: new Date('2026-12-31'), sortOrder: 7 } })

  await db.dependency.createMany({
    data: [
      { fromWbpId: wbp100.id, toWbpId: wbp300.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp200.id, toWbpId: wbp300.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp100.id, toWbpId: wbp500.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp200.id, toWbpId: wbp500.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp300.id, toWbpId: wbp500.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp400.id, toWbpId: wbp500.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp500.id, toWbpId: wbp600.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp100.id, toWbpId: wbp700.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp200.id, toWbpId: wbp700.id, type: 'blocks', status: 'active' },
      { fromWbpId: wbp110.id, toWbpId: wbp210.id, type: 'relates-to', status: 'active' },
    ],
  })

  await db.task.createMany({
    data: [
      { title: 'Complete schematic review', description: 'Final review of multi-layer PCB schematic with crypto processor integration', status: 'in-progress', priority: 'critical', assigneeId: alice.id, wbpId: wbp100.id, columnId: 'in-progress', sortOrder: 0 },
      { title: 'Power supply unit design', description: 'Design redundant PSU with surge protection for field deployment', status: 'in-progress', priority: 'high', assigneeId: alice.id, wbpId: wbp100.id, columnId: 'in-progress', sortOrder: 1 },
      { title: 'Thermal simulation validation', description: 'Validate CFD thermal simulation results against prototype measurements', status: 'todo', priority: 'medium', assigneeId: alice.id, wbpId: wbp100.id, columnId: 'todo', sortOrder: 0 },
      { title: 'MIL-STD-810H shock testing', description: 'Conduct drop and vibration testing per MIL-STD-810H', status: 'todo', priority: 'high', wbpId: wbp100.id, columnId: 'todo', sortOrder: 1 },
      { title: 'CRYSTALS-Kyber implementation', description: 'Implement Kyber-1024 key encapsulation mechanism in hardware', status: 'in-progress', priority: 'critical', assigneeId: charlie.id, wbpId: wbp200.id, columnId: 'in-progress', sortOrder: 0 },
      { title: 'FIPS 140-2 L4 test vectors', description: 'Validate all crypto modules against FIPS test vectors', status: 'review', priority: 'critical', assigneeId: charlie.id, wbpId: wbp200.id, columnId: 'review', sortOrder: 0 },
      { title: 'Side-channel resistance testing', description: 'Conduct power analysis and timing attack resistance tests', status: 'todo', priority: 'high', wbpId: wbp200.id, columnId: 'todo', sortOrder: 0 },
      { title: 'Secure boot chain implementation', description: 'Implement multi-stage verified boot with hardware root of trust', status: 'todo', priority: 'critical', assigneeId: bob.id, wbpId: wbp300.id, columnId: 'todo', sortOrder: 0 },
      { title: 'OTA update mechanism', description: 'Build secure over-the-air firmware update with rollback support', status: 'todo', priority: 'high', assigneeId: bob.id, wbpId: wbp300.id, columnId: 'todo', sortOrder: 1 },
      { title: 'Hardware abstraction layer', description: 'Create HAL for crypto modules and network interfaces', status: 'todo', priority: 'high', wbpId: wbp300.id, columnId: 'todo', sortOrder: 2 },
      { title: 'Dashboard wireframes approved', description: 'Finalize dashboard design with real-time topology visualization', status: 'done', priority: 'high', assigneeId: diana.id, wbpId: wbp400.id, columnId: 'done', sortOrder: 0 },
      { title: 'Device provisioning API', description: 'REST API for device registration, certificate provisioning, and policy assignment', status: 'in-progress', priority: 'high', assigneeId: diana.id, wbpId: wbp400.id, columnId: 'in-progress', sortOrder: 0 },
      { title: 'Real-time monitoring WebSocket', description: 'WebSocket service for live device status and traffic metrics', status: 'in-progress', priority: 'medium', assigneeId: diana.id, wbpId: wbp400.id, columnId: 'in-progress', sortOrder: 1 },
      { title: 'Multi-tenant RBAC', description: 'Role-based access control with organization and team scoping', status: 'todo', priority: 'high', wbpId: wbp400.id, columnId: 'todo', sortOrder: 0 },
      { title: 'Test plan document', description: 'Comprehensive integration test plan covering all module interfaces', status: 'todo', priority: 'high', assigneeId: emma.id, wbpId: wbp500.id, columnId: 'todo', sortOrder: 0 },
      { title: 'Automated test framework setup', description: 'Set up CI/CD integrated test automation with hardware-in-the-loop', status: 'todo', priority: 'medium', wbpId: wbp500.id, columnId: 'todo', sortOrder: 1 },
      { title: 'Vendor KERNO onboarding', description: 'Complete KERNO Enterprises production line setup and quality audit', status: 'in-progress', priority: 'high', assigneeId: frank.id, wbpId: wbp700.id, columnId: 'in-progress', sortOrder: 0 },
      { title: 'Supply chain qualification', description: 'Qualify all component suppliers for long-term production', status: 'todo', priority: 'medium', wbpId: wbp700.id, columnId: 'todo', sortOrder: 0 },
    ],
  })

  await db.risk.createMany({
    data: [
      { title: 'PQ algorithm NIST standardization delay may impact certification timeline', severity: 'high', status: 'open', wbpId: wbp200.id },
      { title: 'FPGA supply chain shortage could delay PCB production', severity: 'high', status: 'mitigating', wbpId: wbp100.id },
      { title: 'FIPS 140-2 Level 4 lab availability limited - 6-month lead time', severity: 'critical', status: 'open', wbpId: wbp600.id },
      { title: 'Cross-geo team coordination (Abu Dhabi + Oulu) timezone challenges', severity: 'medium', status: 'mitigating', wbpId: wbp400.id },
      { title: 'KERNO production line readiness not confirmed for Q3 start', severity: 'medium', status: 'open', wbpId: wbp700.id },
    ],
  })

  await db.milestone.createMany({
    data: [
      { name: 'Alpha Prototype Ready', date: new Date('2026-05-15'), status: 'upcoming', wbpId: wbp100.id },
      { name: 'Crypto Engine v1 Complete', date: new Date('2026-06-30'), status: 'upcoming', wbpId: wbp200.id },
      { name: 'Firmware Beta Release', date: new Date('2026-07-31'), status: 'upcoming', wbpId: wbp300.id },
      { name: 'Management Console MVP', date: new Date('2026-06-15'), status: 'upcoming', wbpId: wbp400.id },
      { name: 'System Integration Complete', date: new Date('2026-10-15'), status: 'upcoming', wbpId: wbp500.id },
      { name: 'FIPS Certification Submitted', date: new Date('2026-11-30'), status: 'upcoming', wbpId: wbp600.id },
      { name: 'First Production Unit', date: new Date('2026-12-15'), status: 'upcoming', wbpId: wbp700.id },
    ],
  })

  await db.aIConversation.createMany({
    data: [
      { role: 'user', content: 'What is blocking our release?', programId: program.id },
      { role: 'assistant', content: 'I identified **3 critical blockers** for the BRAIN Network Encryptor release:\n\n1. **Post-Quantum Crypto Module (WBP-210)** - Only 25% complete, 3 weeks behind schedule. This blocks both Firmware and Integration Testing.\n\n2. **FIPS Certification Lab (WBP-600)** - 6-month lead time for Level 4 lab booking. Must be initiated by end of Q2.\n\n3. **KERNO Vendor Onboarding (WBP-700)** - Production line readiness not confirmed. Risk to Q3 manufacturing start.\n\n**Recommendation:** Escalate WBP-210 to critical priority and consider adding a second crypto engineer from the Finland R&D center.', programId: program.id },
    ],
  })

  console.log('XCollab POC seeded successfully!')
}

seed().catch(console.error)
