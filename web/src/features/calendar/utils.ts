import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Task, TaskSlice } from '../../data/types';

export type CalendarView = 'day' | 'week' | 'month';

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseDate(s: string | null | undefined): Date {
  if (!s) return new Date();
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function shiftDate(date: Date, view: CalendarView, dir: 1 | -1): Date {
  if (view === 'day') return addDays(date, dir);
  if (view === 'week') return addWeeks(date, dir);
  return addMonths(date, dir);
}

/** Понедельник — первый день недели. */
export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Сетка месяца по неделям (пн–вс), включая дни соседних месяцев. */
export function monthGrid(date: Date): Date[][] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let cursor = start;
  while (cursor <= end) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function isTodayDate(d: Date): boolean {
  return isToday(d);
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Диапазон дат, видимых в календаре для данного вида. */
export function calendarRange(date: Date, view: CalendarView): [string, string] {
  if (view === 'day') {
    const iso = toISODate(date);
    return [iso, iso];
  }
  if (view === 'week') {
    const days = weekDays(date);
    return [toISODate(days[0]), toISODate(days[6])];
  }
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  return [toISODate(start), toISODate(end)];
}

// --- Полоски задач (старт → дедлайн) ---

/** Дата старта задачи: поле startDate, по умолчанию — день создания. */
export function taskStart(t: Task): string {
  return t.startDate ?? t.createdAt.slice(0, 10);
}

/** Дата окончания полоски: дедлайн, иначе однодневная полоска на старте. */
export function taskEnd(t: Task): string {
  return t.deadline ?? taskStart(t);
}

/** Задача «живёт» в этот день (startDate <= date <= deadline). */
export function taskOccursOn(t: Task, date: string): boolean {
  return taskStart(t) <= date && date <= taskEnd(t);
}

/** Задача пересекается с диапазоном [from, to]. */
export function taskOverlaps(t: Task, from: string, to: string): boolean {
  return taskStart(t) <= to && taskEnd(t) >= from;
}

/** Номер колонки (1-based) даты внутри недели, начинающейся с weekStart. */
export function columnOf(date: string, weekStart: Date): number {
  return differenceInCalendarDays(parseISO(date), weekStart) + 1;
}

/** Видна ли задача в конкретный день с учётом срезов (фаза 3). */
export function taskVisibleOnDate(t: Task, date: string, slices: TaskSlice[]): boolean {
  const taskSlices = slices.filter((s) => s.taskId === t.id);
  if (taskSlices.length) {
    return taskSlices.some((s) => s.date === date);
  }
  return taskOccursOn(t, date);
}

export interface LaneItem {
  id: string;
  startCol: number;
  endCol: number;
}

/** Жадная раскладка полосок по дорожкам (lanes), чтобы не пересекались. */
export function assignLanes(items: LaneItem[]): Map<string, number> {
  const sorted = [...items].sort(
    (a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol),
  );
  const lanes: LaneItem[][] = [];
  const result = new Map<string, number>();
  for (const item of sorted) {
    let placed = false;
    for (let li = 0; li < lanes.length; li++) {
      if (lanes[li].every((x) => x.endCol < item.startCol || x.startCol > item.endCol)) {
        lanes[li].push(item);
        result.set(item.id, li);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
      result.set(item.id, lanes.length - 1);
    }
  }
  return result;
}

/** Сегменты полоски задачи внутри недели с учётом срезов. */
export interface TaskSegment {
  task: Task;
  startCol: number;
  endCol: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

export function taskSegmentsInWeek(
  task: Task,
  slices: TaskSlice[],
  from: string,
  to: string,
  weekStart: Date,
): TaskSegment[] {
  const taskSlices = slices
    .filter((s) => s.taskId === task.id && s.date >= from && s.date <= to)
    .map((s) => s.date)
    .sort();

  if (taskSlices.length === 0) {
    const s = taskStart(task) < from ? from : taskStart(task);
    const e = taskEnd(task) > to ? to : taskEnd(task);
    if (s > e) return [];
    return [
      {
        task,
        startCol: columnOf(s, weekStart),
        endCol: columnOf(e, weekStart),
        continuesLeft: taskStart(task) < from,
        continuesRight: taskEnd(task) > to,
      },
    ];
  }

  const segments: string[][] = [];
  let current: string[] = [taskSlices[0]];
  for (let i = 1; i < taskSlices.length; i++) {
    const prev = taskSlices[i - 1];
    const curr = taskSlices[i];
    if (differenceInCalendarDays(parseISO(curr), parseISO(prev)) === 1) {
      current.push(curr);
    } else {
      segments.push(current);
      current = [curr];
    }
  }
  segments.push(current);

  return segments.map((seg) => ({
    task,
    startCol: columnOf(seg[0], weekStart),
    endCol: columnOf(seg[seg.length - 1], weekStart),
    continuesLeft: false,
    continuesRight: false,
  }));
}
