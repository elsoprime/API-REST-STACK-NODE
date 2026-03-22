import { type ExpenseRequestStatus } from '@/modules/expenses/types/expenses.types';

export type ExpenseWorkflowAction =
  | 'submit'
  | 'review'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'mark_paid';

const TRANSITIONS: Record<ExpenseWorkflowAction, readonly ExpenseRequestStatus[]> = {
  submit: ['draft', 'returned'],
  review: ['submitted'],
  approve: ['submitted'],
  reject: ['submitted'],
  cancel: ['draft', 'returned'],
  mark_paid: ['approved']
} as const;

export function isExpenseWorkflowTransitionAllowed(
  action: ExpenseWorkflowAction,
  currentStatus: ExpenseRequestStatus
): boolean {
  return TRANSITIONS[action].includes(currentStatus);
}
