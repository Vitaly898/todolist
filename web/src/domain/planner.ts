import { addDays, max, min, parseISO } from 'date-fns';
import type { DayCapacity, Settings, Task, TaskSlice, WorkWindow } from '../data/types';
import { taskStart, toISODate } from '../features/calendar/utils';
import { capacityForDate, isWorkingDay } from './schedule';

export interface PlannerContext {
  tasks: Task[];
  slices: TaskSlice[];
  settings: Settings;
  workWindows: WorkWindow[];
  dayCapacities: DayCapacity[];
  today: string;
}

export interface SpreadResult {
  slices: { date: string; plannedHours: number; doneHours: number }[];
  overflowHours: number;
}

export interface SpreadOptions {
  strategy?: 'even' | 'front' | 'back';
  deadline?: string;
}

function roundHalfUp(x: number): number {
  return roundUpToHalfHour(x);
}

/** Округление до 30 минут (0.5 часа) вверх. */
export function roundUpToHalfHour(x: number): number {
  return Math.ceil(x * 2) / 2;
}

/** Суббота/воскресенье. */
export function isWeekend(iso: string): boolean {
  const d = parseISO(iso).getDay();
  return d === 0 || d === 6;
}

function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = parseISO(from);
  const end = parseISO(to);
  while (cursor <= end) {
    days.push(toISODate(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

function otherSlicesSum(taskId: string, date: string, slices: TaskSlice[]): number {
  return slices.filter((s) => s.taskId !== taskId && s.date === date).reduce((sum, s) => sum + s.plannedHours, 0);
}

/**
 * Размазать задачу по дням (PLAN.md §5).
 * Учитывает рабочие окна, ёмкость дней и уже запланированные срезы.
 */
export function spreadTask(task: Task, ctx: PlannerContext, options?: SpreadOptions): SpreadResult {
  const strategy = options?.strategy ?? 'even';
  const deadline = options?.deadline ?? task.deadline;
  const remainingRaw = task.remainingHours ?? task.estimateHours ?? 0;
  let remaining = roundHalfUp(remainingRaw);

  const start = toISODate(max([parseISO(taskStart(task)), parseISO(ctx.today)]));
  const end = deadline ? toISODate(min([parseISO(deadline), addDays(parseISO(start), 60)])) : toISODate(addDays(parseISO(start), 14));

  const allDays = dayRange(start, end).filter((d) => {
    // рабочие задачи — только будни
    if (task.category === 'work' && isWeekend(d)) return false;
    return isWorkingDay(d, ctx.workWindows);
  });
  const days =
    strategy === 'back'
      ? [...allDays].reverse()
      : allDays;

  const planned: { date: string; plannedHours: number; doneHours: number }[] = [];

  for (let i = 0; i < days.length && remaining > 0; i++) {
    const date = days[i];
    const capacity = capacityForDate(date, ctx.dayCapacities, ctx.settings);
    const free = Math.max(0, roundHalfUp(capacity - otherSlicesSum(task.id, date, ctx.slices)));
    if (free <= 0) continue;

    const daysLeft = days.length - i;
    const share = roundHalfUp(remaining / daysLeft);
    const take = roundHalfUp(Math.min(free, share));

    if (take > 0) {
      planned.push({ date, plannedHours: take, doneHours: 0 });
      remaining = roundHalfUp(Math.max(0, remaining - take));
    }
  }

  // При обратной стратегии дни шли с конца — отсортируем по возрастанию для вывода
  const slices = strategy === 'back' ? planned.sort((a, b) => a.date.localeCompare(b.date)) : planned;
  return { slices, overflowHours: remaining };
}

/** Перепланировать активные задачи: приоритет desc, дедлайн asc.
 *  Задачи с ручными срезами (manual) не трогаем — их план сохраняется. */
export function replan(ctx: PlannerContext): Record<string, SpreadResult> {
  const manualTaskIds = new Set(ctx.slices.filter((s) => s.manual).map((s) => s.taskId));
  const active = ctx.tasks
    .filter(
      (t) => (t.status === 'todo' || t.status === 'in_progress') && !manualTaskIds.has(t.id),
    )
    .sort((a, b) => b.priority - a.priority || (a.deadline ?? '').localeCompare(b.deadline ?? '') || a.createdAt.localeCompare(b.createdAt));

  const results: Record<string, SpreadResult> = {};
  let runningSlices = [...ctx.slices];

  for (const task of active) {
    const res = spreadTask(task, { ...ctx, slices: runningSlices });
    results[task.id] = res;
    runningSlices = runningSlices.filter((s) => s.taskId !== task.id);
    for (const s of res.slices) {
      runningSlices.push({
        id: `${task.id}-${s.date}`,
        taskId: task.id,
        date: s.date,
        plannedHours: s.plannedHours,
        doneHours: s.doneHours,
      });
    }
  }

  return results;
}

/**
 * Подходящий дедлайн: первый день, при котором размазывание сходится
 * без overflow и с запасом ~20% от ёмкости (PLAN.md §5).
 */
export function earliestFitDeadline(task: Task, ctx: PlannerContext): { deadline: string; result: SpreadResult } | null {
  const start = toISODate(max([parseISO(taskStart(task)), parseISO(ctx.today)]));
  for (let offset = 0; offset <= 60; offset++) {
    const deadline = toISODate(addDays(parseISO(start), offset));
    if (!isWorkingDay(deadline, ctx.workWindows)) continue;
    const res = spreadTask(task, ctx, { deadline });
    if (res.overflowHours > 0) continue;
    const maxDaily = Math.max(...res.slices.map((s) => s.plannedHours), 0);
    const capacity = capacityForDate(deadline, ctx.dayCapacities, ctx.settings);
    if (maxDaily <= capacity * 0.8) {
      return { deadline, result: res };
    }
  }
  return null;
}
