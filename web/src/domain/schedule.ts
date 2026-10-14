import { getDay, parseISO } from 'date-fns';
import type { DayCapacity, Settings, WorkWindow } from '../data/types';

/** Емкость дня: переопределение из dayCapacities или default из настроек. */
export function capacityForDate(date: string, capacities: DayCapacity[], settings: Settings): number {
  return capacities.find((c) => c.date === date)?.capacityHours ?? settings.defaultDailyCapacityHours;
}

/** Рабочее окно для конкретного дня недели. */
export function workWindowForDate(date: string, windows: WorkWindow[]): WorkWindow | undefined {
  const weekday = getDay(parseISO(date));
  return windows.find((w) => w.weekday === weekday);
}

export function isWorkingDay(date: string, windows: WorkWindow[]): boolean {
  return !!workWindowForDate(date, windows);
}

export function windowHoursText({ startMin, endMin }: WorkWindow): string {
  return `${pad(startMin)}–${pad(endMin)}`;
}

function pad(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
