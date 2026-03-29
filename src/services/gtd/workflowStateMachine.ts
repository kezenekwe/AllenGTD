import {WorkflowStep, WorkflowDecision} from '@types/index';

// ─── Workflow Step Definitions ─────────────────────────────────────────────

export interface WorkflowStepConfig {
  step: WorkflowStep;
  title: string;
  question: string;
  buttons: WorkflowButton[];
  showBack?: boolean;
  showExit?: boolean;
  backTo?: WorkflowStep;
  inputType?: 'text' | 'textarea' | null;
  inputPlaceholder?: string;
}

export interface WorkflowButton {
  label: string;
  emoji?: string;
  nextStep?: WorkflowStep;
  action?: 'reference' | 'someday' | 'trash' | 'complete';
}

// ─── Workflow Configuration ────────────────────────────────────────────────
// This defines the entire GTD decision tree

export const WORKFLOW_STEPS: Record<WorkflowStep, WorkflowStepConfig> = {
  'what-is-it': {
    step: 'what-is-it',
    title: 'Process Item',
    question: 'What is it?',
    showExit: true,
    buttons: [
      {
        label: "It's actionable",
        emoji: '✅',
        nextStep: 'is-actionable',
      },
      {
        label: "It's reference material",
        emoji: '📚',
        action: 'reference',
      },
      {
        label: 'Someday/Maybe',
        emoji: '💭',
        action: 'someday',
      },
      {
        label: "It's trash",
        emoji: '🗑️',
        action: 'trash',
      },
    ],
  },

  'is-actionable': {
    step: 'is-actionable',
    title: 'Is it actionable?',
    question: 'Can this be done in less than 2 minutes?',
    showBack: true,
    showExit: true,
    backTo: 'what-is-it',
    buttons: [
      {
        label: 'Yes — Do it now!',
        emoji: '⚡',
        action: 'complete',
      },
      {
        label: "No — It's a project",
        emoji: '📋',
        nextStep: 'project-or-action',
      },
      {
        label: 'Delegate it',
        emoji: '👤',
        nextStep: 'delegate',
      },
      {
        label: 'Defer it',
        emoji: '📅',
        nextStep: 'defer',
      },
    ],
  },

  'project-or-action': {
    step: 'project-or-action',
    title: 'Multi-step or Single Action?',
    question: 'Is this a multi-step project or a single action?',
    showBack: true,
    showExit: true,
    backTo: 'is-actionable',
    buttons: [
      {
        label: 'Multi-step project',
        emoji: '📋',
        nextStep: 'create-project',
      },
      {
        label: 'Single next action',
        emoji: '⚡',
        nextStep: 'next-action',
      },
    ],
  },

  'create-project': {
    step: 'create-project',
    title: 'Create Project',
    question: 'Describe the steps to complete this project (one per line):',
    showBack: true,
    showExit: true,
    backTo: 'project-or-action',
    inputType: 'textarea',
    inputPlaceholder: 'Step 1\nStep 2\nStep 3...',
    buttons: [
      {
        label: 'Create Project',
        emoji: '✓',
      },
    ],
  },

  'next-action': {
    step: 'next-action',
    title: 'Define Next Action',
    question: "What's the next physical action?",
    showBack: true,
    showExit: true,
    backTo: 'project-or-action',
    inputType: 'text',
    inputPlaceholder: 'e.g., Call John to discuss budget',
    buttons: [
      {
        label: 'Add to Next Actions',
        emoji: '⚡',
      },
      {
        label: 'Add to Next Actions + Calendar',
        emoji: '📅',
      },
    ],
  },

  delegate: {
    step: 'delegate',
    title: 'Delegate',
    question: 'Who are you waiting for?',
    showBack: true,
    showExit: true,
    backTo: 'is-actionable',
    inputType: 'text',
    inputPlaceholder: 'e.g., Sarah from marketing',
    buttons: [
      {
        label: 'Add to Waiting For',
        emoji: '⏳',
      },
    ],
  },

  defer: {
    step: 'defer',
    title: 'Defer',
    question: 'When do you want to do this?',
    showBack: true,
    showExit: true,
    backTo: 'is-actionable',
    buttons: [
      {
        label: 'Add to Next Actions',
        emoji: '⚡',
        nextStep: 'next-action',
      },
    ],
  },
};

// ─── State Machine Logic ───────────────────────────────────────────────────

export class WorkflowStateMachine {
  private currentStep: WorkflowStep;
  private history: WorkflowStep[] = [];

  constructor(initialStep: WorkflowStep = 'what-is-it') {
    this.currentStep = initialStep;
  }

  getCurrentStep(): WorkflowStepConfig {
    return WORKFLOW_STEPS[this.currentStep];
  }

  goToStep(step: WorkflowStep): void {
    this.history.push(this.currentStep);
    this.currentStep = step;
  }

  goBack(): boolean {
    const previous = this.history.pop();
    if (previous) {
      this.currentStep = previous;
      return true;
    }
    return false;
  }

  reset(): void {
    this.currentStep = 'what-is-it';
    this.history = [];
  }

  canGoBack(): boolean {
    return this.history.length > 0;
  }
}
