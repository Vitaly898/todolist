import { useSearchParams } from 'react-router-dom';
import type { Category, Priority, TaskStatus } from '../../data/types';
import { parseDate, shiftDate, toISODate, type CalendarView } from './utils';

export interface DashboardFilters {
  status: TaskStatus[];
  priority: Priority[];
  category: Category[];
}

// Выполненные не скрываем — остаются на дашборде зачёркнутыми (PLAN.md §4)
const DEFAULT_STATUS: TaskStatus[] = ['todo', 'in_progress', 'done'];

function defaultView(): CalendarView {
  // <640px — «День», десктоп — «Неделя» (PLAN.md §4)
  return window.matchMedia('(min-width: 640px)').matches ? 'week' : 'day';
}

function parseList(raw: string | null, allowed: readonly string[]): string[] {
  if (!raw) return [];
  return raw.split(',').filter((v) => allowed.includes(v));
}

/** Состояние дашборда в URL: вид, дата, фильтры (шарибельные ссылки, PLAN.md §2). */
export function useDashboardParams() {
  const [params, setParams] = useSearchParams();

  const viewParam = params.get('view');
  const view: CalendarView =
    viewParam === 'day' || viewParam === 'week' || viewParam === 'month' ? viewParam : defaultView();
  const date = parseDate(params.get('date'));

  const filters: DashboardFilters = {
    status: params.get('status')
      ? (parseList(params.get('status'), ['todo', 'in_progress', 'done', 'cancelled']) as TaskStatus[])
      : DEFAULT_STATUS,
    priority: parseList(params.get('priority'), ['1', '2', '3', '4']).map(Number) as Priority[],
    category: parseList(params.get('category'), ['work', 'study', 'life']) as Category[],
  };

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const setView = (v: CalendarView) => update({ view: v });
  const setDate = (d: Date) => update({ date: toISODate(d) });
  const shift = (dir: 1 | -1) => setDate(shiftDate(date, view, dir));
  const goToday = () => setDate(new Date());

  const toggleIn = (key: 'status' | 'priority' | 'category', value: string) => {
    const current = new Set<string>(
      key === 'priority' ? filters.priority.map(String) : (filters[key] as string[]),
    );
    if (current.has(value)) current.delete(value);
    else current.add(value);
    update({ [key]: [...current].join(',') });
  };

  return { view, date, filters, setView, setDate, shift, goToday, toggleIn };
}
