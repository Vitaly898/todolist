import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Task, TaskSlice } from '../../data/types';
import { TaskCard } from '../tasks/TaskCard';
import { CapacityBar } from './CapacityBar';
import { isTodayDate, taskEnd, taskStart, taskVisibleOnDate, toISODate } from './utils';
import { useSettings } from '../../hooks/useSettings';
import { useWorkWindows } from '../../hooks/useSchedule';
import { useDayCapacities } from '../../hooks/useSchedule';
import { capacityForDate, workWindowForDate, windowHoursText } from '../../domain/schedule';
import { plannedHoursForDate } from '../../domain/dayLoad';

interface DayViewProps {
  day: Date;
  tasks: Task[];
  slices?: TaskSlice[];
  onTaskClick: (task: Task) => void;
}

export function DayView({ day, tasks, slices = [], onTaskClick }: DayViewProps) {
  const iso = toISODate(day);
  const visibleTasks = tasks
    .filter((t) => taskVisibleOnDate(t, iso, slices))
    .sort((a, b) => b.priority - a.priority);
  const { data: settings } = useSettings();
  const { data: windows } = useWorkWindows();
  const { data: capacities } = useDayCapacities(iso, iso);

  const capacity = settings ? capacityForDate(iso, capacities ?? [], settings) : 0;
  const planned = plannedHoursForDate(iso, tasks, slices);
  const window = windows ? workWindowForDate(iso, windows) : undefined;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <div
        className={`border-b border-slate-200 px-4 py-3 dark:border-slate-800 ${
          isTodayDate(day) ? 'bg-sky-50 dark:bg-sky-950/30' : 'bg-slate-50 dark:bg-slate-900'
        }`}
      >
        <p className="text-sm text-slate-500">{format(day, 'EEEE', { locale: ru })}</p>
        <p className="text-lg font-semibold">{format(day, 'd MMMM', { locale: ru })}</p>
        {window && <p className="mt-0.5 text-xs text-slate-400">Окно: {windowHoursText(window)}</p>}
        {settings && capacity > 0 && (
          <div className="mt-2">
            <CapacityBar planned={planned} capacity={capacity} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        {visibleTasks.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">На этот день задач нет</p>
        )}
        {visibleTasks.map((t) => {
          const total = differenceInCalendarDays(parseISO(taskEnd(t)), parseISO(taskStart(t))) + 1;
          const dayNum = differenceInCalendarDays(parseISO(iso), parseISO(taskStart(t))) + 1;
          return (
            <div key={t.id}>
              <TaskCard task={t} onClick={() => onTaskClick(t)} />
              {total > 1 && (
                <p className="mt-0.5 pl-11 text-[11px] text-slate-400">
                  день {dayNum} из {total} · {taskStart(t)} → {taskEnd(t)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
