import type { Task, TaskInput } from '../data/types';
import type { PlannerContext } from './planner';
import { earliestFitDeadline } from './planner';

export interface DeadlineSuggestion {
  deadline: string;
  explanation: string;
}

/**
 * Помощник по срокам (rule-based, фаза 5).
 * Находит ближайший дедлайн, при котором задача размазывается без overflow
 * с запасом ~20% от ёмкости дня.
 */
export function suggestDeadline(
  input: TaskInput & { id?: string; createdAt?: string; status?: Task['status'] },
  ctx: PlannerContext,
): DeadlineSuggestion | null {
  const task: Task = {
    id: input.id ?? 'temp',
    title: input.title ?? '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 2,
    category: input.category ?? 'life',
    estimateHours: input.estimateHours,
    remainingHours: input.estimateHours,
    startDate: input.startDate,
    deadline: input.deadline,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const fit = earliestFitDeadline(task, ctx);
  if (!fit) return null;

  const days = fit.result.slices.length;
  const total = task.remainingHours ?? task.estimateHours ?? 0;
  const daily = days ? total / days : 0;
  const safeCapacity = ctx.settings.defaultDailyCapacityHours * 0.8;

  return {
    deadline: fit.deadline,
    explanation: `Дедлайн ${fit.deadline} подходит: ≈${daily.toFixed(1)}ч в день (${days} раб.дн), запас до ${safeCapacity.toFixed(1)}ч/день.`,
  };
}
