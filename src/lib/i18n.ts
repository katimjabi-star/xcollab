import type { Locale } from './types';

// ============================================
// XCollab — i18n (English / Arabic)
// ============================================

type TranslationKeys = {
  // Navigation
  'nav.dashboard': string;
  'nav.wbp': string;
  'nav.kanban': string;
  'nav.dependencies': string;
  'nav.aiChat': string;
  'nav.teams': string;
  'nav.timeline': string;
  'nav.inbox': string;

  // Collaboration
  'inbox.title': string;
  'inbox.empty': string;
  'inbox.emptyHint': string;
  'inbox.markAll': string;
  'inbox.markRead': string;
  'inbox.unread': string;
  'discussion.title': string;
  'discussion.placeholder': string;
  'discussion.post': string;
  'discussion.empty': string;
  'approvals.title': string;
  'approvals.request': string;
  'approvals.requestTitle': string;
  'approvals.approver': string;
  'approvals.send': string;
  'approvals.approve': string;
  'approvals.requestChanges': string;
  'approvals.reject': string;
  'approvals.status.pending': string;
  'approvals.status.approved': string;
  'approvals.status.changes_requested': string;
  'approvals.status.rejected': string;
  'architect.title': string;
  'architect.desc': string;
  'architect.placeholder': string;
  'architect.create': string;
  'architect.designing': string;
  'architect.successTitle': string;
  'architect.successDesc': string;
  'architect.error': string;
  'kanban.assign': string;
  'kanban.unassigned': string;
  'program.switch': string;
  'program.new': string;
  'create.headline': string;
  'create.sub': string;
  'create.placeholder': string;
  'create.attach': string;
  'create.examples': string;
  'create.button': string;
  'create.skip': string;
  'create.stepTeams': string;
  'create.stepWbps': string;
  'create.stepSchedule': string;
  'create.stepFinish': string;
  'nav.settings': string;
  'nav.collapseSidebar': string;
  'nav.expandSidebar': string;

  // Dashboard
  'dashboard.title': string;
  'dashboard.overview': string;
  'dashboard.programProgress': string;
  'dashboard.activeWBPs': string;
  'dashboard.completedWBPs': string;
  'dashboard.atRisk': string;
  'dashboard.totalTasks': string;
  'dashboard.openRisks': string;
  'dashboard.teams': string;
  'dashboard.members': string;
  'dashboard.recentActivity': string;
  'dashboard.healthSummary': string;
  'dashboard.onTrack': string;
  'dashboard.offTrack': string;
  'dashboard.milestones': string;
  'dashboard.upcomingMilestones': string;
  'dashboard.burndownChart': string;
  'dashboard.teamTasks': string;
  'dashboard.countDone': string;
  'dashboard.countTotal': string;
  'dashboard.countMembers': string;
  'dashboard.ideal': string;
  'dashboard.actual': string;

  // WBP
  'wbp.title': string;
  'wbp.workBreakdown': string;
  'wbp.code': string;
  'wbp.name': string;
  'wbp.status': string;
  'wbp.priority': string;
  'wbp.health': string;
  'wbp.progress': string;
  'wbp.ownerTeam': string;
  'wbp.startDate': string;
  'wbp.dueDate': string;
  'wbp.scope': string;
  'wbp.tasks': string;
  'wbp.risks': string;
  'wbp.milestones': string;
  'wbp.dependencies': string;
  'wbp.children': string;
  'wbp.noWBPs': string;
  'wbp.expand': string;
  'wbp.collapse': string;
  'wbp.backToProgram': string;

  // WBP Statuses
  'wbp.status.planned': string;
  'wbp.status.in-progress': string;
  'wbp.status.completed': string;
  'wbp.status.on-hold': string;
  'wbp.status.cancelled': string;

  // WBP Priorities
  'wbp.priority.low': string;
  'wbp.priority.medium': string;
  'wbp.priority.high': string;
  'wbp.priority.critical': string;

  // WBP Health
  'wbp.health.on-track': string;
  'wbp.health.at-risk': string;
  'wbp.health.off-track': string;
  'wbp.health.completed': string;

  // Kanban
  'kanban.title': string;
  'kanban.board': string;
  'kanban.todo': string;
  'kanban.inProgress': string;
  'kanban.review': string;
  'kanban.done': string;
  'kanban.addTask': string;
  'kanban.noTasks': string;
  'kanban.dragHere': string;
  'kanban.taskCount': string;
  'kanban.wipExceeded': string;
  'kanban.moveFailed': string;
  'kanban.moveFailedDesc': string;

  // Task
  'task.title': string;
  'task.description': string;
  'task.assignee': string;
  'task.priority': string;
  'task.status': string;
  'task.unassigned': string;

  // Dependencies
  'dependencies.title': string;
  'dependencies.graph': string;
  'dependencies.blocks': string;
  'dependencies.dependsOn': string;
  'dependencies.relatesTo': string;
  'dependencies.active': string;
  'dependencies.resolved': string;
  'dependencies.broken': string;
  'dependencies.noDependencies': string;
  'dependencies.from': string;
  'dependencies.to': string;

  // Risks
  'risk.title': string;
  'risk.severity': string;
  'risk.severity.low': string;
  'risk.severity.medium': string;
  'risk.severity.high': string;
  'risk.severity.critical': string;
  'risk.status': string;
  'risk.status.open': string;
  'risk.status.mitigated': string;
  'risk.status.closed': string;
  'risk.noRisks': string;

  // Milestones
  'milestone.title': string;
  'milestone.date': string;
  'milestone.status': string;
  'milestone.status.upcoming': string;
  'milestone.status.reached': string;
  'milestone.status.overdue': string;
  'milestone.status.cancelled': string;
  'milestone.noMilestones': string;

  // AI Chat
  'aiChat.title': string;
  'aiChat.placeholder': string;
  'aiChat.send': string;
  'aiChat.thinking': string;
  'aiChat.welcome': string;
  'aiChat.error': string;
  'aiChat.clearChat': string;
  'aiChat.clearFailed': string;
  'aiChat.clearFailedDesc': string;
  'aiChat.actionBlockers': string;
  'aiChat.actionStandup': string;
  'aiChat.actionRisk': string;
  'aiChat.actionSprint': string;
  'aiChat.actionResource': string;
  'aiChat.actionWbpSummary': string;
  'aiChat.agentRisk': string;
  'aiChat.agentOrchestrator': string;
  'aiChat.agentAnalyst': string;

  // Teams
  'team.title': string;
  'team.members': string;
  'team.lead': string;
  'team.allRoles': string;
  'team.allTeams': string;
  'team.noMembers': string;
  'team.joined': string;
  'team.role.admin': string;
  'team.role.team-lead': string;
  'team.role.member': string;
  'team.role.vendor': string;

  // Timeline
  'timeline.title': string;
  'timeline.packages': string;

  // Header
  'header.notifications': string;
  'header.markAllRead': string;
  'header.profile': string;
  'header.toggleNav': string;

  // Command Palette
  'palette.placeholder': string;
  'palette.groupViews': string;
  'palette.groupAiActions': string;
  'palette.groupWorkPackages': string;
  'palette.groupMembers': string;
  'palette.navigateToView': string;
  'palette.noResults': string;
  'palette.navigate': string;
  'palette.select': string;
  'palette.actionStandup': string;
  'palette.actionBlockers': string;
  'palette.actionRisk': string;
  'palette.actionCreateWbp': string;
  'palette.actionTaskSummary': string;

  // Settings
  'settings.appearance': string;
  'settings.theme': string;
  'settings.themeDesc': string;
  'settings.themeDark': string;
  'settings.themeLight': string;
  'settings.themeSystem': string;
  'settings.accentColor': string;
  'settings.accentColorDesc': string;
  'settings.languageDesc': string;
  'settings.notifications': string;
  'settings.notifRisk': string;
  'settings.notifRiskDesc': string;
  'settings.notifMilestone': string;
  'settings.notifMilestoneDesc': string;
  'settings.notifTasks': string;
  'settings.notifTasksDesc': string;
  'settings.notifWbp': string;
  'settings.notifWbpDesc': string;
  'settings.notifAi': string;
  'settings.notifAiDesc': string;
  'settings.security': string;
  'settings.securityNote': string;
  'settings.planned': string;
  'settings.zeroTrust': string;
  'settings.zeroTrustDesc': string;
  'settings.encryption': string;
  'settings.encryptionDesc': string;
  'settings.auditLog': string;
  'settings.auditLogDesc': string;
  'settings.aiGuardrails': string;
  'settings.aiGuardrailsDesc': string;
  'settings.integrations': string;
  'settings.integrationJiraDesc': string;
  'settings.integrationClaudeDesc': string;
  'settings.integrationSlackDesc': string;
  'settings.integrationTeamsDesc': string;
  'settings.connected': string;
  'settings.connect': string;
  'settings.aboutTagline': string;
  'settings.build': string;

  // Common
  'common.search': string;
  'common.filter': string;
  'common.sort': string;
  'common.add': string;
  'common.edit': string;
  'common.delete': string;
  'common.save': string;
  'common.cancel': string;
  'common.close': string;
  'common.confirm': string;
  'common.loading': string;
  'common.noData': string;
  'common.error': string;
  'common.success': string;
  'common.all': string;
  'common.none': string;
  'common.back': string;
  'common.next': string;
  'common.previous': string;
  'common.of': string;
  'common.showing': string;
  'common.results': string;
  'common.urgent': string;
  'common.overdue': string;
  'common.today': string;
  'common.tomorrow': string;
  'common.yesterday': string;
  'common.language': string;
  'common.english': string;
  'common.arabic': string;
  'common.retry': string;
  'common.failedToLoad': string;
  'common.somethingWentWrong': string;
  'common.active': string;
  'common.pending': string;
  'common.noDescription': string;
};

const translations: Record<Locale, TranslationKeys> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.wbp': 'Work Packages',
    'nav.kanban': 'Kanban Board',
    'nav.dependencies': 'Dependencies',
    'nav.aiChat': 'AI Assistant',
    'nav.teams': 'Teams',
    'nav.timeline': 'Timeline',
    'nav.inbox': 'Inbox',

    'inbox.title': 'Inbox',
    'inbox.empty': 'You are all caught up',
    'inbox.emptyHint': 'Mentions, assignments, and approvals will land here',
    'inbox.markAll': 'Mark all read',
    'inbox.markRead': 'Mark read',
    'inbox.unread': 'Unread',
    'discussion.title': 'Discussion',
    'discussion.placeholder': 'Write a comment — use @ to mention a teammate',
    'discussion.post': 'Post',
    'discussion.empty': 'No comments yet — start the discussion',
    'approvals.title': 'Approvals',
    'approvals.request': 'Request approval',
    'approvals.requestTitle': 'What needs sign-off?',
    'approvals.approver': 'Approver',
    'approvals.send': 'Send request',
    'approvals.approve': 'Approve',
    'approvals.requestChanges': 'Request changes',
    'approvals.reject': 'Reject',
    'approvals.status.pending': 'Pending',
    'approvals.status.approved': 'Approved',
    'approvals.status.changes_requested': 'Changes requested',
    'approvals.status.rejected': 'Rejected',
    'architect.title': 'Design a program',
    'architect.desc': 'Describe the program and the AI architect will design the full structure — teams, work packages, tasks, milestones, risks, and dependencies. Everything it creates is provisional until you review it.',
    'architect.placeholder': 'e.g. A secure tactical drone communications program with an external antenna vendor, 14 months, including certification…',
    'architect.create': 'Design program',
    'architect.designing': 'Designing the program…',
    'architect.successTitle': 'Program created',
    'architect.successDesc': '{name} is now the active program — review the work packages',
    'architect.error': 'The architect could not create the program. Try again.',
    'kanban.assign': 'Assign to',
    'kanban.unassigned': 'Unassigned',
    'program.switch': 'Switch program',
    'program.new': 'New program',
    'create.headline': 'What are you building?',
    'create.sub': 'Describe the project — timeline, teams, goals — or attach a PRD. The AI architect designs the whole program: teams, work packages, tasks, milestones, risks, and dependencies.',
    'create.placeholder': 'e.g. I am developing a project called XCollab — a cross-team collaboration platform. Timeline is 3 weeks. Teams: design and QA, plus whoever else you think we need. Create the full plan…',
    'create.attach': 'Attach PRD (.md / .txt)',
    'create.examples': 'Try an example',
    'create.button': 'Create the program',
    'create.skip': 'Open current program',
    'create.stepTeams': 'Assembling the teams…',
    'create.stepWbps': 'Structuring work packages and tasks…',
    'create.stepSchedule': 'Scheduling milestones and dependencies…',
    'create.stepFinish': 'Opening your workspace…',
    'nav.settings': 'Settings',
    'nav.collapseSidebar': 'Collapse sidebar',
    'nav.expandSidebar': 'Expand sidebar',

    // Dashboard
    'dashboard.title': 'Program Dashboard',
    'dashboard.overview': 'Overview',
    'dashboard.programProgress': 'Program Progress',
    'dashboard.activeWBPs': 'Active WBPs',
    'dashboard.completedWBPs': 'Completed WBPs',
    'dashboard.atRisk': 'At Risk',
    'dashboard.totalTasks': 'Total Tasks',
    'dashboard.openRisks': 'Open Risks',
    'dashboard.teams': 'Teams',
    'dashboard.members': 'Members',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.healthSummary': 'Health Summary',
    'dashboard.onTrack': 'On Track',
    'dashboard.offTrack': 'Off Track',
    'dashboard.milestones': 'Milestones',
    'dashboard.upcomingMilestones': 'Upcoming Milestones',
    'dashboard.burndownChart': 'Burndown Chart',
    'dashboard.teamTasks': 'Team Tasks',
    'dashboard.countDone': '{count} done',
    'dashboard.countTotal': '{count} total',
    'dashboard.countMembers': '{count} members',
    'dashboard.ideal': 'Ideal',
    'dashboard.actual': 'Actual',

    // WBP
    'wbp.title': 'Work Breakdown Structure',
    'wbp.workBreakdown': 'Work Breakdown',
    'wbp.code': 'Code',
    'wbp.name': 'Name',
    'wbp.status': 'Status',
    'wbp.priority': 'Priority',
    'wbp.health': 'Health',
    'wbp.progress': 'Progress',
    'wbp.ownerTeam': 'Owner Team',
    'wbp.startDate': 'Start Date',
    'wbp.dueDate': 'Due Date',
    'wbp.scope': 'Scope',
    'wbp.tasks': 'Tasks',
    'wbp.risks': 'Risks',
    'wbp.milestones': 'Milestones',
    'wbp.dependencies': 'Dependencies',
    'wbp.children': 'Sub-packages',
    'wbp.noWBPs': 'No work packages found',
    'wbp.expand': 'Expand',
    'wbp.collapse': 'Collapse',
    'wbp.backToProgram': 'Back to Program',

    // WBP Statuses
    'wbp.status.planned': 'Planned',
    'wbp.status.in-progress': 'In Progress',
    'wbp.status.completed': 'Completed',
    'wbp.status.on-hold': 'On Hold',
    'wbp.status.cancelled': 'Cancelled',

    // WBP Priorities
    'wbp.priority.low': 'Low',
    'wbp.priority.medium': 'Medium',
    'wbp.priority.high': 'High',
    'wbp.priority.critical': 'Critical',

    // WBP Health
    'wbp.health.on-track': 'On Track',
    'wbp.health.at-risk': 'At Risk',
    'wbp.health.off-track': 'Off Track',
    'wbp.health.completed': 'Completed',

    // Kanban
    'kanban.title': 'Kanban Board',
    'kanban.board': 'Board',
    'kanban.todo': 'To Do',
    'kanban.inProgress': 'In Progress',
    'kanban.review': 'Review',
    'kanban.done': 'Done',
    'kanban.addTask': 'Add Task',
    'kanban.noTasks': 'No tasks',
    'kanban.dragHere': 'Drag tasks here',
    'kanban.taskCount': '{count} task(s)',
    'kanban.wipExceeded': 'WIP',
    'kanban.moveFailed': 'Move failed',
    'kanban.moveFailedDesc': 'Could not save the new task position.',

    // Task
    'task.title': 'Title',
    'task.description': 'Description',
    'task.assignee': 'Assignee',
    'task.priority': 'Priority',
    'task.status': 'Status',
    'task.unassigned': 'Unassigned',

    // Dependencies
    'dependencies.title': 'Dependencies',
    'dependencies.graph': 'Dependency Graph',
    'dependencies.blocks': 'Blocks',
    'dependencies.dependsOn': 'Depends On',
    'dependencies.relatesTo': 'Relates To',
    'dependencies.active': 'Active',
    'dependencies.resolved': 'Resolved',
    'dependencies.broken': 'Broken',
    'dependencies.noDependencies': 'No dependencies found',
    'dependencies.from': 'From',
    'dependencies.to': 'To',

    // Risks
    'risk.title': 'Risk',
    'risk.severity': 'Severity',
    'risk.severity.low': 'Low',
    'risk.severity.medium': 'Medium',
    'risk.severity.high': 'High',
    'risk.severity.critical': 'Critical',
    'risk.status': 'Status',
    'risk.status.open': 'Open',
    'risk.status.mitigated': 'Mitigated',
    'risk.status.closed': 'Closed',
    'risk.noRisks': 'No risks identified',

    // Milestones
    'milestone.title': 'Milestone',
    'milestone.date': 'Date',
    'milestone.status': 'Status',
    'milestone.status.upcoming': 'Upcoming',
    'milestone.status.reached': 'Reached',
    'milestone.status.overdue': 'Overdue',
    'milestone.status.cancelled': 'Cancelled',
    'milestone.noMilestones': 'No milestones',

    // AI Chat
    'aiChat.title': 'AI Assistant',
    'aiChat.placeholder': 'Ask about WBP status, risks, dependencies...',
    'aiChat.send': 'Send',
    'aiChat.thinking': 'AI is analyzing...',
    'aiChat.welcome': 'Hello! I am the XCollab AI assistant. I can help you analyze WBP status, identify risks, trace dependencies, and provide project management insights for the BRAIN Network Encryptor program.',
    'aiChat.error': 'Failed to get AI response. Please try again.',
    'aiChat.clearChat': 'Clear Chat',
    'aiChat.clearFailed': 'Clear failed',
    'aiChat.clearFailedDesc': 'Could not clear the conversation.',
    'aiChat.actionBlockers': 'Identify Blockers',
    'aiChat.actionStandup': 'Standup Report',
    'aiChat.actionRisk': 'Risk Analysis',
    'aiChat.actionSprint': 'Sprint Plan',
    'aiChat.actionResource': 'Resource Allocation',
    'aiChat.actionWbpSummary': 'WBP Summary',
    'aiChat.agentRisk': 'Risk Analyst',
    'aiChat.agentOrchestrator': 'Orchestrator',
    'aiChat.agentAnalyst': 'Analyst',

    // Teams
    'team.title': 'Team',
    'team.members': 'Members',
    'team.lead': 'Lead',
    'team.allRoles': 'All Roles',
    'team.allTeams': 'All Teams',
    'team.noMembers': 'No members found',
    'team.joined': 'Joined {time}',
    'team.role.admin': 'Admin',
    'team.role.team-lead': 'Team Lead',
    'team.role.member': 'Member',
    'team.role.vendor': 'Vendor',

    // Timeline
    'timeline.title': 'Program Timeline',
    'timeline.packages': 'packages',

    // Header
    'header.notifications': 'Notifications',
    'header.markAllRead': 'Mark all read',
    'header.profile': 'Profile',
    'header.toggleNav': 'Toggle navigation',

    // Command Palette
    'palette.placeholder': 'Search WBPs, tasks, members, actions...',
    'palette.groupViews': 'Views',
    'palette.groupAiActions': 'AI Actions',
    'palette.groupWorkPackages': 'Work Packages',
    'palette.groupMembers': 'Members',
    'palette.navigateToView': 'Navigate to view',
    'palette.noResults': 'No results found',
    'palette.navigate': 'Navigate',
    'palette.select': 'Select',
    'palette.actionStandup': 'Generate standup report',
    'palette.actionBlockers': 'Identify blockers',
    'palette.actionRisk': 'Risk assessment',
    'palette.actionCreateWbp': 'Create new WBP',
    'palette.actionTaskSummary': 'Task summary',

    // Settings
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.themeDesc': 'Obsidian Dark is tuned for operations rooms; Signal Light for daylight review',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
    'settings.themeSystem': 'System',
    'settings.accentColor': 'Accent Color',
    'settings.accentColorDesc': 'EDGE Orange is the default; Katim Teal honors the secure-comms subsidiary',
    'settings.languageDesc': 'Interface display language',
    'settings.notifications': 'Notifications',
    'settings.notifRisk': 'Risk Alerts',
    'settings.notifRiskDesc': 'Get notified when risks are flagged or escalated',
    'settings.notifMilestone': 'Milestone Reminders',
    'settings.notifMilestoneDesc': 'Alerts 7 days before milestone deadlines',
    'settings.notifTasks': 'Task Assignments',
    'settings.notifTasksDesc': 'Notify when tasks are assigned to you',
    'settings.notifWbp': 'WBP Status Changes',
    'settings.notifWbpDesc': 'Alerts on health or status transitions',
    'settings.notifAi': 'AI Insights',
    'settings.notifAiDesc': 'Proactive AI analysis and recommendations',
    'settings.security': 'Security & Compliance',
    'settings.securityNote': "Security hardening is out of scope for this POC; production would inherit Katim's certified security stack.",
    'settings.planned': 'Planned',
    'settings.zeroTrust': 'Zero-Trust Architecture',
    'settings.zeroTrustDesc': 'Planned: 6-layer zero-trust security model',
    'settings.encryption': 'Encryption at Rest',
    'settings.encryptionDesc': 'Planned: AES-256-GCM encryption at rest',
    'settings.auditLog': 'Audit Logging',
    'settings.auditLogDesc': 'Planned: complete event trail with tamper protection',
    'settings.aiGuardrails': 'AI Security Guardrails',
    'settings.aiGuardrailsDesc': 'Planned: prompt injection prevention and output filtering',
    'settings.integrations': 'Integrations',
    'settings.integrationJiraDesc': 'Bidirectional WBP ↔ Epic/Story sync',
    'settings.integrationClaudeDesc': 'AI program assistant powered by Claude',
    'settings.integrationSlackDesc': 'Notifications and standup summaries',
    'settings.integrationTeamsDesc': 'Cross-team collaboration channels',
    'settings.connected': 'Connected',
    'settings.connect': 'Connect',
    'settings.aboutTagline': 'AI-Native Cross-Team Workflow Platform — EDGE Group',
    'settings.build': 'Build',

    // Common
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.sort': 'Sort',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.noData': 'No data available',
    'common.error': 'An error occurred',
    'common.success': 'Success',
    'common.all': 'All',
    'common.none': 'None',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.of': 'of',
    'common.showing': 'Showing',
    'common.results': 'results',
    'common.urgent': 'Urgent',
    'common.overdue': 'Overdue',
    'common.today': 'Today',
    'common.tomorrow': 'Tomorrow',
    'common.yesterday': 'Yesterday',
    'common.language': 'Language',
    'common.english': 'English',
    'common.arabic': 'العربية',
    'common.retry': 'Retry',
    'common.failedToLoad': 'Failed to load data',
    'common.somethingWentWrong': 'Something went wrong',
    'common.active': 'Active',
    'common.pending': 'Pending',
    'common.noDescription': 'No description',
  },

  ar: {
    // Navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.wbp': 'حزم العمل',
    'nav.kanban': 'لوحة كانبان',
    'nav.dependencies': 'التبعيات',
    'nav.aiChat': 'المساعد الذكي',
    'nav.teams': 'الفرق',
    'nav.timeline': 'الجدول الزمني',
    'nav.inbox': 'الوارد',

    'inbox.title': 'الوارد',
    'inbox.empty': 'أنجزت كل شيء',
    'inbox.emptyHint': 'ستصل الإشارات والمهام وطلبات الاعتماد هنا',
    'inbox.markAll': 'تعليم الكل كمقروء',
    'inbox.markRead': 'تعليم كمقروء',
    'inbox.unread': 'غير مقروء',
    'discussion.title': 'النقاش',
    'discussion.placeholder': 'اكتب تعليقًا — استخدم @ للإشارة إلى زميل',
    'discussion.post': 'نشر',
    'discussion.empty': 'لا توجد تعليقات بعد — ابدأ النقاش',
    'approvals.title': 'الاعتمادات',
    'approvals.request': 'طلب اعتماد',
    'approvals.requestTitle': 'ما الذي يحتاج إلى توقيع؟',
    'approvals.approver': 'المعتمِد',
    'approvals.send': 'إرسال الطلب',
    'approvals.approve': 'اعتماد',
    'approvals.requestChanges': 'طلب تعديلات',
    'approvals.reject': 'رفض',
    'approvals.status.pending': 'قيد الانتظار',
    'approvals.status.approved': 'معتمد',
    'approvals.status.changes_requested': 'مطلوب تعديلات',
    'approvals.status.rejected': 'مرفوض',
    'architect.title': 'تصميم برنامج',
    'architect.desc': 'صف البرنامج وسيقوم المهندس الذكي بتصميم الهيكل الكامل — الفرق وحزم العمل والمهام والمعالم والمخاطر والتبعيات. كل ما يُنشأ مبدئي حتى تراجعه.',
    'architect.placeholder': 'مثال: برنامج اتصالات آمنة للطائرات المسيّرة مع مورّد هوائيات خارجي، ١٤ شهرًا، شاملًا الاعتماد…',
    'architect.create': 'تصميم البرنامج',
    'architect.designing': 'جارٍ تصميم البرنامج…',
    'architect.successTitle': 'تم إنشاء البرنامج',
    'architect.successDesc': '{name} هو الآن البرنامج النشط — راجع حزم العمل',
    'architect.error': 'تعذر على المهندس إنشاء البرنامج. حاول مرة أخرى.',
    'kanban.assign': 'إسناد إلى',
    'kanban.unassigned': 'غير مسند',
    'program.switch': 'تبديل البرنامج',
    'program.new': 'برنامج جديد',
    'create.headline': 'ماذا تبني؟',
    'create.sub': 'صف المشروع — الجدول الزمني والفرق والأهداف — أو أرفق وثيقة المتطلبات. سيصمم المهندس الذكي البرنامج كاملًا: الفرق وحزم العمل والمهام والمعالم والمخاطر والتبعيات.',
    'create.placeholder': 'مثال: أطوّر مشروعًا اسمه XCollab — منصة تعاون بين الفرق. الجدول الزمني ثلاثة أسابيع. الفرق: التصميم والجودة، ومن تراه ضروريًا. أنشئ الخطة الكاملة…',
    'create.attach': 'إرفاق وثيقة متطلبات (.md / .txt)',
    'create.examples': 'جرّب مثالًا',
    'create.button': 'إنشاء البرنامج',
    'create.skip': 'فتح البرنامج الحالي',
    'create.stepTeams': 'جارٍ تشكيل الفرق…',
    'create.stepWbps': 'جارٍ هيكلة حزم العمل والمهام…',
    'create.stepSchedule': 'جارٍ جدولة المعالم والتبعيات…',
    'create.stepFinish': 'جارٍ فتح مساحة العمل…',
    'nav.settings': 'الإعدادات',
    'nav.collapseSidebar': 'طي القائمة الجانبية',
    'nav.expandSidebar': 'توسيع القائمة الجانبية',

    // Dashboard
    'dashboard.title': 'لوحة تحكم البرنامج',
    'dashboard.overview': 'نظرة عامة',
    'dashboard.programProgress': 'تقدم البرنامج',
    'dashboard.activeWBPs': 'حزم العمل النشطة',
    'dashboard.completedWBPs': 'حزم العمل المكتملة',
    'dashboard.atRisk': 'معرّضة للخطر',
    'dashboard.totalTasks': 'إجمالي المهام',
    'dashboard.openRisks': 'المخاطر المفتوحة',
    'dashboard.teams': 'الفرق',
    'dashboard.members': 'الأعضاء',
    'dashboard.recentActivity': 'النشاط الأخير',
    'dashboard.healthSummary': 'ملخص الحالة',
    'dashboard.onTrack': 'في المسار الصحيح',
    'dashboard.offTrack': 'خارج المسار',
    'dashboard.milestones': 'المعالم',
    'dashboard.upcomingMilestones': 'المعالم القادمة',
    'dashboard.burndownChart': 'مخطط الإنجاز التنازلي',
    'dashboard.teamTasks': 'مهام الفرق',
    'dashboard.countDone': '{count} منجزة',
    'dashboard.countTotal': '{count} إجمالًا',
    'dashboard.countMembers': '{count} عضوًا',
    'dashboard.ideal': 'المثالي',
    'dashboard.actual': 'الفعلي',

    // WBP
    'wbp.title': 'هيكل تقسيم العمل',
    'wbp.workBreakdown': 'تقسيم العمل',
    'wbp.code': 'الرمز',
    'wbp.name': 'الاسم',
    'wbp.status': 'الحالة',
    'wbp.priority': 'الأولوية',
    'wbp.health': 'الصحة',
    'wbp.progress': 'التقدم',
    'wbp.ownerTeam': 'الفريق المالك',
    'wbp.startDate': 'تاريخ البدء',
    'wbp.dueDate': 'تاريخ الاستحقاق',
    'wbp.scope': 'النطاق',
    'wbp.tasks': 'المهام',
    'wbp.risks': 'المخاطر',
    'wbp.milestones': 'المعالم',
    'wbp.dependencies': 'التبعيات',
    'wbp.children': 'الحزم الفرعية',
    'wbp.noWBPs': 'لا توجد حزم عمل',
    'wbp.expand': 'توسيع',
    'wbp.collapse': 'طي',
    'wbp.backToProgram': 'العودة إلى البرنامج',

    // WBP Statuses
    'wbp.status.planned': 'مخطط',
    'wbp.status.in-progress': 'قيد التنفيذ',
    'wbp.status.completed': 'مكتمل',
    'wbp.status.on-hold': 'معلق',
    'wbp.status.cancelled': 'ملغى',

    // WBP Priorities
    'wbp.priority.low': 'منخفضة',
    'wbp.priority.medium': 'متوسطة',
    'wbp.priority.high': 'عالية',
    'wbp.priority.critical': 'حرجة',

    // WBP Health
    'wbp.health.on-track': 'في المسار',
    'wbp.health.at-risk': 'معرّض للخطر',
    'wbp.health.off-track': 'خارج المسار',
    'wbp.health.completed': 'مكتمل',

    // Kanban
    'kanban.title': 'لوحة كانبان',
    'kanban.board': 'اللوحة',
    'kanban.todo': 'للتنفيذ',
    'kanban.inProgress': 'قيد التنفيذ',
    'kanban.review': 'مراجعة',
    'kanban.done': 'مكتمل',
    'kanban.addTask': 'إضافة مهمة',
    'kanban.noTasks': 'لا توجد مهام',
    'kanban.dragHere': 'اسحب المهام هنا',
    'kanban.taskCount': '{count} مهمة',
    'kanban.wipExceeded': 'تجاوز حد العمل',
    'kanban.moveFailed': 'فشل النقل',
    'kanban.moveFailedDesc': 'تعذر حفظ الموضع الجديد للمهمة.',

    // Task
    'task.title': 'العنوان',
    'task.description': 'الوصف',
    'task.assignee': 'المسؤول',
    'task.priority': 'الأولوية',
    'task.status': 'الحالة',
    'task.unassigned': 'غير معيّن',

    // Dependencies
    'dependencies.title': 'التبعيات',
    'dependencies.graph': 'رسم التبعيات',
    'dependencies.blocks': 'يعيق',
    'dependencies.dependsOn': 'يعتمد على',
    'dependencies.relatesTo': 'مرتبط بـ',
    'dependencies.active': 'نشط',
    'dependencies.resolved': 'تم الحل',
    'dependencies.broken': 'مكسور',
    'dependencies.noDependencies': 'لا توجد تبعيات',
    'dependencies.from': 'من',
    'dependencies.to': 'إلى',

    // Risks
    'risk.title': 'الخطر',
    'risk.severity': 'الخطورة',
    'risk.severity.low': 'منخفضة',
    'risk.severity.medium': 'متوسطة',
    'risk.severity.high': 'عالية',
    'risk.severity.critical': 'حرجة',
    'risk.status': 'الحالة',
    'risk.status.open': 'مفتوح',
    'risk.status.mitigated': 'تم التخفيف',
    'risk.status.closed': 'مغلق',
    'risk.noRisks': 'لا توجد مخاطر محددة',

    // Milestones
    'milestone.title': 'المعلم',
    'milestone.date': 'التاريخ',
    'milestone.status': 'الحالة',
    'milestone.status.upcoming': 'قادم',
    'milestone.status.reached': 'تم تحقيقه',
    'milestone.status.overdue': 'متأخر',
    'milestone.status.cancelled': 'ملغى',
    'milestone.noMilestones': 'لا توجد معالم',

    // AI Chat
    'aiChat.title': 'المساعد الذكي',
    'aiChat.placeholder': 'اسأل عن حالة حزم العمل، المخاطر، التبعيات...',
    'aiChat.send': 'إرسال',
    'aiChat.thinking': 'الذكاء الاصطناعي يحلل...',
    'aiChat.welcome': 'مرحباً! أنا المساعد الذكي لمنصة XCollab. يمكنني تحليل حالة حزم العمل، تحديد المخاطر، تتبع التبعيات، وتقديم رؤى إدارية لمشروع مشفّر الشبكة BRAIN.',
    'aiChat.error': 'فشل في الحصول على استجابة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
    'aiChat.clearChat': 'مسح المحادثة',
    'aiChat.clearFailed': 'فشل المسح',
    'aiChat.clearFailedDesc': 'تعذر مسح المحادثة.',
    'aiChat.actionBlockers': 'تحديد العوائق',
    'aiChat.actionStandup': 'تقرير الاجتماع اليومي',
    'aiChat.actionRisk': 'تحليل المخاطر',
    'aiChat.actionSprint': 'خطة السبرنت',
    'aiChat.actionResource': 'توزيع الموارد',
    'aiChat.actionWbpSummary': 'ملخص حزم العمل',
    'aiChat.agentRisk': 'محلل المخاطر',
    'aiChat.agentOrchestrator': 'المنسّق',
    'aiChat.agentAnalyst': 'المحلل',

    // Teams
    'team.title': 'الفريق',
    'team.members': 'الأعضاء',
    'team.lead': 'القائد',
    'team.allRoles': 'جميع الأدوار',
    'team.allTeams': 'جميع الفرق',
    'team.noMembers': 'لم يتم العثور على أعضاء',
    'team.joined': 'انضم {time}',
    'team.role.admin': 'مسؤول',
    'team.role.team-lead': 'قائد فريق',
    'team.role.member': 'عضو',
    'team.role.vendor': 'مورّد',

    // Timeline
    'timeline.title': 'الجدول الزمني للبرنامج',
    'timeline.packages': 'حزمة',

    // Header
    'header.notifications': 'الإشعارات',
    'header.markAllRead': 'تعليم الكل كمقروء',
    'header.profile': 'الملف الشخصي',
    'header.toggleNav': 'تبديل التنقل',

    // Command Palette
    'palette.placeholder': 'ابحث في حزم العمل والمهام والأعضاء والإجراءات...',
    'palette.groupViews': 'العروض',
    'palette.groupAiActions': 'إجراءات الذكاء الاصطناعي',
    'palette.groupWorkPackages': 'حزم العمل',
    'palette.groupMembers': 'الأعضاء',
    'palette.navigateToView': 'الانتقال إلى العرض',
    'palette.noResults': 'لم يتم العثور على نتائج',
    'palette.navigate': 'تنقّل',
    'palette.select': 'اختيار',
    'palette.actionStandup': 'إنشاء تقرير الاجتماع اليومي',
    'palette.actionBlockers': 'تحديد العوائق',
    'palette.actionRisk': 'تقييم المخاطر',
    'palette.actionCreateWbp': 'إنشاء حزمة عمل جديدة',
    'palette.actionTaskSummary': 'ملخص المهام',

    // Settings
    'settings.appearance': 'المظهر',
    'settings.theme': 'السمة',
    'settings.themeDesc': 'السمة الداكنة مصممة لغرف العمليات؛ والسمة الفاتحة للمراجعة النهارية',
    'settings.themeDark': 'داكن',
    'settings.themeLight': 'فاتح',
    'settings.themeSystem': 'النظام',
    'settings.accentColor': 'لون التمييز',
    'settings.accentColorDesc': 'برتقالي EDGE هو الافتراضي؛ وتركواز كاتم تكريمًا لشركة الاتصالات الآمنة',
    'settings.languageDesc': 'لغة عرض الواجهة',
    'settings.notifications': 'الإشعارات',
    'settings.notifRisk': 'تنبيهات المخاطر',
    'settings.notifRiskDesc': 'تلقّي إشعار عند رصد المخاطر أو تصعيدها',
    'settings.notifMilestone': 'تذكيرات المعالم',
    'settings.notifMilestoneDesc': 'تنبيهات قبل 7 أيام من مواعيد المعالم النهائية',
    'settings.notifTasks': 'إسناد المهام',
    'settings.notifTasksDesc': 'إشعار عند إسناد مهام إليك',
    'settings.notifWbp': 'تغييرات حالة حزم العمل',
    'settings.notifWbpDesc': 'تنبيهات عند تغيّر الصحة أو الحالة',
    'settings.notifAi': 'رؤى الذكاء الاصطناعي',
    'settings.notifAiDesc': 'تحليلات وتوصيات استباقية من الذكاء الاصطناعي',
    'settings.security': 'الأمن والامتثال',
    'settings.securityNote': 'تعزيز الأمان خارج نطاق هذا النموذج التجريبي؛ وسترث النسخة الإنتاجية منظومة الأمان المعتمدة لدى Katim.',
    'settings.planned': 'مخطط له',
    'settings.zeroTrust': 'بنية انعدام الثقة',
    'settings.zeroTrustDesc': 'مخطط له: نموذج أمني من 6 طبقات قائم على انعدام الثقة',
    'settings.encryption': 'تشفير البيانات المخزّنة',
    'settings.encryptionDesc': 'مخطط له: تشفير AES-256-GCM للبيانات المخزّنة',
    'settings.auditLog': 'سجل التدقيق',
    'settings.auditLogDesc': 'مخطط له: سجل كامل للأحداث مع حماية من العبث',
    'settings.aiGuardrails': 'ضوابط أمان الذكاء الاصطناعي',
    'settings.aiGuardrailsDesc': 'مخطط له: منع حقن التعليمات وتصفية المخرجات',
    'settings.integrations': 'التكاملات',
    'settings.integrationJiraDesc': 'مزامنة ثنائية الاتجاه بين حزم العمل والملاحم/القصص',
    'settings.integrationClaudeDesc': 'مساعد برامج ذكي مدعوم من Claude',
    'settings.integrationSlackDesc': 'الإشعارات وملخصات الاجتماعات اليومية',
    'settings.integrationTeamsDesc': 'قنوات تعاون بين الفرق',
    'settings.connected': 'متصل',
    'settings.connect': 'ربط',
    'settings.aboutTagline': 'منصة سير عمل عابرة للفرق قائمة على الذكاء الاصطناعي — مجموعة EDGE',
    'settings.build': 'إصدار',

    // Common
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.sort': 'ترتيب',
    'common.add': 'إضافة',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.close': 'إغلاق',
    'common.confirm': 'تأكيد',
    'common.loading': 'جارٍ التحميل...',
    'common.noData': 'لا توجد بيانات',
    'common.error': 'حدث خطأ',
    'common.success': 'تم بنجاح',
    'common.all': 'الكل',
    'common.none': 'لا شيء',
    'common.back': 'رجوع',
    'common.next': 'التالي',
    'common.previous': 'السابق',
    'common.of': 'من',
    'common.showing': 'يعرض',
    'common.results': 'نتائج',
    'common.urgent': 'عاجل',
    'common.overdue': 'متأخر',
    'common.today': 'اليوم',
    'common.tomorrow': 'غداً',
    'common.yesterday': 'أمس',
    'common.language': 'اللغة',
    'common.english': 'English',
    'common.arabic': 'العربية',
    'common.retry': 'إعادة المحاولة',
    'common.failedToLoad': 'فشل تحميل البيانات',
    'common.somethingWentWrong': 'حدث خطأ ما',
    'common.active': 'نشط',
    'common.pending': 'قيد الانتظار',
    'common.noDescription': 'لا يوجد وصف',
  },
};

// --- useTranslation hook ---
export function useTranslation(locale: Locale) {
  const t = (key: keyof TranslationKeys): string => {
    return translations[locale]?.[key] ?? translations.en[key] ?? key;
  };
  return { t };
}

// --- RTL helper ---
export function isRTL(locale: Locale): boolean {
  return locale === 'ar';
}

// --- Relative time helper ---
export function formatTimeAgo(locale: Locale, date: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, 'second');
  if (abs < 3600) return rtf.format(Math.trunc(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.trunc(seconds / 3600), 'hour');
  return rtf.format(Math.trunc(seconds / 86400), 'day');
}

export { translations };
