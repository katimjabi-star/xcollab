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

  // Teams
  'team.title': string;
  'team.members': string;
  'team.lead': string;

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

    // Teams
    'team.title': 'Team',
    'team.members': 'Members',
    'team.lead': 'Lead',

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

    // Teams
    'team.title': 'الفريق',
    'team.members': 'الأعضاء',
    'team.lead': 'القائد',

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

export { translations };
