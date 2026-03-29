// ─── GTD Categories ────────────────────────────────────────────────────────

export type GTDCategory =
  | 'inbox'
  | 'nextActions'
  | 'projects'
  | 'waiting'
  | 'someday'
  | 'reference';

export type ItemStatus = 'active' | 'completed' | 'archived';

// ─── Core Item ─────────────────────────────────────────────────────────────

export interface Item {
  id: string;
  text: string;
  category: GTDCategory;
  status: ItemStatus;

  // GTD-specific fields
  nextAction?: string;
  waitingFor?: string;
  projectPlan?: string;
  steps?: ProjectStep[];
  hasCalendar: boolean;

  // Sync
  serverId?: string;
  syncedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ProjectStep {
  id: string;
  projectId: string;
  stepText: string;
  stepOrder: number;
  createdAt: Date;
}

// ─── GTD Workflow ──────────────────────────────────────────────────────────

export type WorkflowStep =
  | 'what-is-it'
  | 'is-actionable'
  | 'project-or-action'
  | 'create-project'
  | 'next-action'
  | 'delegate'
  | 'defer';

export interface WorkflowDecision {
  step: WorkflowStep;
  choice: string;
  payload?: Record<string, unknown>;
}

export interface WorkflowState {
  currentStep: WorkflowStep;
  item: Item | null;
  history: WorkflowStep[]; // for back navigation
}

// ─── API ───────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface SyncChange {
  id: string;
  action: 'create' | 'update' | 'delete';
  data?: Partial<Item>;
  deletedAt?: string;
}

export interface SyncResponse {
  changes: SyncChange[];
  syncToken: string;
  timestamp: string;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
