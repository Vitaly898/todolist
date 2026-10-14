import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { endOfMonth, endOfWeek, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Task } from '../data/types';
import { DayView } from '../features/calendar/DayView';
import { FilterBar } from '../features/calendar/FilterBar';
import { MonthView } from '../features/calendar/MonthView';
import { useDashboardParams } from '../features/calendar/useDashboardParams';
import {
  calendarRange,
  shiftDate,
  taskStart,
  toISODate,
  VIEW_LABELS,
  type CalendarView,
} from '../features/calendar/utils';
import { WeekView } from '../features/calendar/WeekView';
import { QuickAdd } from '../features/tasks/QuickAdd';
import { TaskDrawer, type TaskDrawerState } from '../features/tasks/TaskDrawer';
import { useTasks } from '../hooks/useTasks';
import { useSlices } from '../hooks/useSlices';
import { usePlannerContext } from '../hooks/usePlannerContext';
import { replan } from '../domain/planner';
import { repo } from '../data';

const VIEWS: CalendarView[] = ['day', 'week', 'month'];

function titleFor(view: CalendarView, date: Date): string {
  if (view === 'day') return format(date, 'd MMMM yyyy', { locale: ru });
  if (view === 'week') return `Неделя, ${format(date, 'd MMM', { locale: ru })}`;
  return format(date, 'LLLL yyyy', { locale: ru });
}

/** Конец периода, содержащего дату, для данного вида. */
function periodEnd(date: Date, view: CalendarView): string {
  if (view === 'week') return toISODate(endOfWeek(date, { weekStartsOn: 1 }));
  if (view === 'month') return toISODate(endOfMonth(date));
  return toISODate(date);
}

export function DashboardPage() {
  const { view, date, filters, setView, setDate, shift, goToday, toggleIn } = useDashboardParams();
  const { data: tasks, isLoading } = useTasks();
  const [rangeFrom, rangeTo] = calendarRange(date, view);
  const { data: slices, isLoading: slicesLoading } = useSlices(rangeFrom, rangeTo);
  const { ctx, isLoading: ctxLoading } = usePlannerContext(rangeFrom, rangeTo);
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<TaskDrawerState>(null);
  const [replanning, setReplanning] = useState(false);

  const filtered = useMemo(() => {
    return (tasks ?? []).filter(
      (t) =>
        filters.status.includes(t.status) &&
        (filters.priority.length === 0 || filters.priority.includes(t.priority)) &&
        (filters.category.length === 0 || filters.category.includes(t.category)),
    );
  }, [tasks, filters]);

  // Прошлое ограничено стартом самой ранней неотменённой задачи (активной или выполненной)
  const minDate = useMemo(() => {
    const today = toISODate(new Date());
    const starts = (tasks ?? [])
      .filter((t) => t.status !== 'cancelled')
      .map((t) => taskStart(t));
    return starts.length ? [today, ...starts].sort()[0] : today;
  }, [tasks]);

  const canGoBack = periodEnd(shiftDate(date, view, -1), view) >= minDate;

  const openTask = (task: Task) => setDrawer({ mode: 'edit', task });
  const openDay = (d: Date) => {
    setDate(d);
    setView('day');
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold capitalize">{titleFor(view, date)}</h1>
        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700">
          <button
            type="button"
            onClick={() => shift(-1)}
            disabled={!canGoBack}
            aria-label="Назад"
            title={canGoBack ? 'Назад' : 'Раньше задач нет'}
            className="px-2.5 py-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Вперёд"
            className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            →
          </button>
        </div>
        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm ${
                view === v
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              } ${v === 'day' ? 'rounded-l-lg' : ''} ${v === 'month' ? 'rounded-r-lg' : ''}`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ mode: 'create' })}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          + Задача
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <QuickAdd />
        <button
          type="button"
          disabled={ctxLoading || replanning || !ctx}
          onClick={async () => {
            if (!ctx) return;
            setReplanning(true);
            const plans = replan(ctx);
            for (const [taskId, plan] of Object.entries(plans)) {
              await repo.replaceTaskSlices(taskId, plan.slices);
            }
            await qc.invalidateQueries({ queryKey: ['slices'] });
            setReplanning(false);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {replanning ? 'Планируем…' : 'Перепланировать всё'}
        </button>
      </div>
      <FilterBar
        status={filters.status}
        priority={filters.priority}
        category={filters.category}
        onToggle={toggleIn}
      />

      {(isLoading || slicesLoading || ctxLoading) && <p className="text-slate-500">Загрузка…</p>}

      {!isLoading && !slicesLoading && !ctxLoading && view === 'month' && (
        <MonthView month={date} tasks={filtered} slices={slices} onTaskClick={openTask} onDayClick={openDay} />
      )}
      {!isLoading && !slicesLoading && !ctxLoading && view === 'week' && (
        <WeekView week={date} tasks={filtered} slices={slices} onTaskClick={openTask} onDayClick={openDay} />
      )}
      {!isLoading && !slicesLoading && !ctxLoading && view === 'day' && (
        <DayView day={date} tasks={filtered} slices={slices} onTaskClick={openTask} />
      )}

      <TaskDrawer state={drawer} onClose={() => setDrawer(null)} />
    </section>
  );
}
