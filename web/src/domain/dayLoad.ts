import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Task, TaskSlice } from '../data/types';
import { taskEnd, taskOccursOn, taskStart, toISODate } from '../features/calendar/utils';
import { isWeekend, roundUpToHalfHour } from './planner';

/**
 * Запланировано часов на дату.
 * - Если у задачи есть срезы (планировщик) — считаем только срез на этот день.
 * - Если срезов нет — размазываем remainingHours поровну по дням окна (start → deadline).
 * - Выполненные задачи считаем по факту (doneHours среза), отменённые пропускаем.
 */
export function plannedHoursForDate(date: string, tasks: Task[], slices: TaskSlice[]): number {
  let total = 0;
  for (const t of tasks) {
    if (t.status === 'cancelled') continue;

    const taskSlices = slices.filter((s) => s.taskId === t.id);
    if (taskSlices.length) {
      const s = taskSlices.find((x) => x.date === date);
      if (s) total += t.status === 'done' ? s.doneHours : s.plannedHours;
      continue;
    }

    if (t.status === 'done') continue;
    if (!taskOccursOn(t, date)) continue;
    // рабочие задачи не грузят выходные
    if (t.category === 'work' && isWeekend(date)) continue;

    // равномерное размазывание: для рабочих задач считаем только будни окна
    let days = differenceInCalendarDays(parseISO(taskEnd(t)), parseISO(taskStart(t))) + 1;
    if (t.category === 'work') {
      days = 0;
      let cursor = parseISO(taskStart(t));
      const end = parseISO(taskEnd(t));
      while (cursor <= end) {
        if (!isWeekend(toISODate(cursor))) days++;
        cursor = addDays(cursor, 1);
      }
    }
    const hours = t.remainingHours ?? t.estimateHours ?? 0;
    if (days > 0) total += roundUpToHalfHour(hours / days); // округление до 30 минут
  }
  return Math.round(total * 100) / 100;
}
