export type UnlockContext = {
  enrollmentHours: number;
  quizScore?: number;
  moduleComplete?: boolean;
  assignmentApproved?: boolean;
};

export type UnlockRule =
  | { type: 'instant' }
  | { type: 'time_based'; unlockAfterHours: number }
  | { type: 'conditional'; condition: 'quiz_score' | 'module_complete' | 'assignment_approved'; operator: '>=' | '==='; value: number | boolean };

export function canUnlock(rule: UnlockRule, context: UnlockContext) {
  if (rule.type === 'instant') return true;
  if (rule.type === 'time_based') return context.enrollmentHours >= rule.unlockAfterHours;
  if (rule.condition === 'quiz_score') return (context.quizScore ?? 0) >= Number(rule.value);
  if (rule.condition === 'module_complete') return Boolean(context.moduleComplete) === Boolean(rule.value);
  if (rule.condition === 'assignment_approved') return Boolean(context.assignmentApproved) === Boolean(rule.value);
  return false;
}

export function calculateProgress(completedLessons: number, totalLessons: number) {
  if (!totalLessons) return 0;
  return Math.round((completedLessons / totalLessons) * 10000) / 100;
}
