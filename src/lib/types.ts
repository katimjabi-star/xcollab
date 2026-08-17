// ============================================
// XCollab — TypeScript Types & Interfaces
// ============================================

// --- View Types ---
export type ViewType = 'dashboard' | 'wbp' | 'kanban' | 'dependencies' | 'ai-chat';

export type Locale = 'en' | 'ar';

// --- Prisma Base Types (matching schema exactly) ---

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  color: string;
  type: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  organizationId: string;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WBP {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: string | null;
  ownerTeamId: string | null;
  programId: string;
  parentId: string | null;
  status: string;
  priority: string;
  health: string;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  wbpId: string;
  columnId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Risk {
  id: string;
  title: string;
  severity: string;
  status: string;
  wbpId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  name: string;
  date: string | null;
  status: string;
  wbpId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: string;
  fromWbpId: string;
  toWbpId: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversation {
  id: string;
  role: string;
  content: string;
  programId: string | null;
  createdAt: string;
}

// --- Relation Types (for API responses with includes) ---

export interface TaskWithAssignee extends Task {
  assignee: Member | null;
  wbp: WBP;
}

export interface RiskWithWBP extends Risk {
  wbp: WBP;
}

export interface MilestoneWithWBP extends Milestone {
  wbp: WBP;
}

export interface DependencyWithWBPs extends Dependency {
  fromWbp: WBP;
  toWbp: WBP;
}

export interface WBPWithRelations extends WBP {
  ownerTeam: Team | null;
  program: Program;
  parent: WBPWithRelations | null;
  children: WBPWithRelations[];
  tasks: TaskWithAssignee[];
  risks: Risk[];
  milestones: Milestone[];
  dependenciesFrom: DependencyWithWBPs[];
  dependenciesTo: DependencyWithWBPs[];
}

export interface WBPFlat extends WBP {
  ownerTeam: Team | null;
  children: WBPFlat[];
  tasks: TaskWithAssignee[];
  risks: Risk[];
  milestones: Milestone[];
  _taskStats?: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
  };
}

export interface MemberWithTeam extends Member {
  team: Team | null;
}

export interface TeamWithMembers extends Team {
  members: MemberWithTeam[];
}

export interface ProgramWithWBPs extends Program {
  wbps: WBPWithRelations[];
  organization: Organization;
}

export interface ProgramDashboardData extends Program {
  wbps: WBPFlat[];
  teams: TeamWithMembers[];
  members: MemberWithTeam[];
  organization: Organization;
}

// --- Kanban Types ---

export interface KanbanColumn {
  id: string;
  title: string;
  taskIds: string[];
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  tasks: Record<string, TaskWithAssignee>;
}

// --- Dashboard Stats ---

export interface DashboardStats {
  totalWBPs: number;
  completedWBPs: number;
  inProgressWBPs: number;
  atRiskWBPs: number;
  totalTasks: number;
  completedTasks: number;
  totalRisks: number;
  openRisks: number;
  teamsCount: number;
  membersCount: number;
  overallProgress: number;
}

// --- AI Chat Types ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  programId: string;
}

export interface ChatResponse {
  reply: string;
  conversationId?: string;
}

// --- API Request/Response Types ---

export interface UpdateTaskPositionRequest {
  id: string;
  columnId: string;
  sortOrder: number;
}

// --- Utility Types ---

export type WBPStatus = 'planned' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
export type WBPPriority = 'low' | 'medium' | 'high' | 'critical';
export type WBPHealth = 'on-track' | 'at-risk' | 'off-track' | 'completed';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'mitigated' | 'closed';
export type MilestoneStatus = 'upcoming' | 'reached' | 'overdue' | 'cancelled';
export type DependencyType = 'blocks' | 'depends-on' | 'relates-to';
export type DependencyStatus = 'active' | 'resolved' | 'broken';
