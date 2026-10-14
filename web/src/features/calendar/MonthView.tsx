import { format } from 'date-fns';
import type { Task, TaskSlice } from '../../data/types';
import { CalendarTaskChip } from './CalendarTaskChip';
import { isTodayDate, monthGrid, sameMonth, taskVisibleOnDate, toISODate } from './utils';

interface MonthViewProps {
  month: Date;
  tasks: Task[];
  slices?: TaskSlice[];
  onTaskClick: (task: Task) => void;
  onDayClick: (date: Date) => void;
}

const WEEKDAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MAX_PER_DAY = 3;

export function MonthView({ month, tasks, slices = [], onTaskClick, onDayClick }: MonthViewProps) {
  const weeks = monthGrid(month);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-xs font-medium text-slate-500">
            {d}
          </div>
        ))}
      </div>

      {weeks.map((weekDaysArr) => (
        <div
          key={toISODate(weekDaysArr[0])}
          className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-200 last:border-b-0 dark:divide-slate-800/60 dark:border-slate-800"
        >
          {weekDaysArr.map((day) => {
            const iso = toISODate(day);
            const dayTasks = tasks
              .filter((t) => taskVisibleOnDate(t, iso, slices))
              .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
            const visible = dayTasks.slice(0, MAX_PER_DAY);
            const hidden = dayTasks.length - visible.length;

            return (
              <div
                key={iso}
                onClick={() => onDayClick(day)}
                className={`flex min-h-24 cursor-pointer flex-col gap-0.5 p-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                  sameMonth(day, month) ? '' : 'bg-slate-50/50 text-slate-400 dark:bg-slate-900/50'
                } ${isTodayDate(day) ? 'bg-sky-50 dark:bg-sky-950/30' : ''}`}
              >
                <span
                  className={`self-start text-xs ${
                    isTodayDate(day)
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 font-bold text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {visible.map((t) => (
                    <CalendarTaskChip key={t.id} task={t} onClick={onTaskClick} />
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDayClick(day);
                      }}
                      className="rounded px-1 py-0.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:underline dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      и ещё {hidden} задач
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
