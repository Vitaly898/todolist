import type { Priority } from '../data/types';

/** Цветовое кодирование приоритета (PLAN.md: выделять задачи по приоритету цветом). */

export const priorityBar: Record<Priority, string> = {
  1: 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-100',
  2: 'bg-sky-500 text-white',
  3: 'bg-amber-500 text-white',
  4: 'bg-red-500 text-white',
};

export const priorityBorder: Record<Priority, string> = {
  1: 'border-l-slate-300 dark:border-l-slate-600',
  2: 'border-l-sky-500',
  3: 'border-l-amber-500',
  4: 'border-l-red-500',
};

export const categoryDot: Record<'work' | 'study' | 'life', string> = {
  work: 'bg-blue-300',
  study: 'bg-violet-300',
  life: 'bg-green-300',
};

/**
 * Палитра полосок: у каждой задачи свой контрастный цвет (по хэшу id).
 * Классы перечислены явно, чтобы Tailwind их не выкинул.
 */
const TASK_PALETTE = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-lime-600',
  'bg-orange-500',
  'bg-teal-500',
] as const;

export function taskColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TASK_PALETTE[hash % TASK_PALETTE.length];
}
