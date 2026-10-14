import { useState } from 'react';
import { addDays } from 'date-fns';
import { Drawer } from '../../components/ui/Drawer';
import { useCreateTask, useDeleteTask, useUpdateTask } from '../../hooks/useTasks';
import { useReplaceTaskSlices, useSlices } from '../../hooks/useSlices';
import { usePlannerContext } from '../../hooks/usePlannerContext';
import { usePomodoroSessions } from '../../hooks/usePomodoro';
import { usePomodoroState } from '../pomodoro/PomodoroContext';
import type { Task } from '../../data/types';
import { toISODate } from '../calendar/utils';
import { plannedHoursForDate } from '../../domain/dayLoad';
import { TaskForm } from './TaskForm';
import { SpreadPanel } from '../planner/SpreadPanel';

export type TaskDrawerState = { mode: 'create' } | { mode: 'edit'; task: Task } | null;

interface TaskDrawerProps {
  state: TaskDrawerState;
  onClose: () => void;
}

export function TaskDrawer({ state, onClose }: TaskDrawerProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const replaceSlices = useReplaceTaskSlices();
  const { start: startPomodoro, setIsOpen: openPomodoro } = usePomodoroState();

  const [showSpread, setShowSpread] = useState(false);

  const today = toISODate(new Date());
  const { ctx, isLoading: ctxLoading } = usePlannerContext(today, toISODate(addDays(new Date(), 90)));

  const open = state !== null;
  const task = state?.mode === 'edit' ? state.task : undefined;
  const canStartPomodoro = task && (task.status === 'todo' || task.status === 'in_progress');

  // текущее размазанное время задачи (срезы) за её окно
  const sliceFrom = task?.startDate ?? today;
  const sliceTo = task?.deadline ?? toISODate(addDays(new Date(), 90));
  const { data: windowSlices } = useSlices(sliceFrom, sliceTo);
  const taskSlices = (windowSlices ?? []).filter((s) => s.taskId === task?.id);

  // блок «Сегодня»: план на сегодня + факт по помидоро
  const todaySlice = taskSlices.find((s) => s.date === today);
  const plannedToday = task ? plannedHoursForDate(today, [task], taskSlices) : 0;
  const spentToday = todaySlice?.doneHours ?? 0;
  const todayPct = plannedToday > 0 ? Math.min(100, Math.round((spentToday / plannedToday) * 100)) : 0;

  const { data: sessions } = usePomodoroSessions('2024-01-01', today);
  const spentHours = task
    ? ((sessions ?? [])
        .filter((s) => s.taskId === task.id && s.kind === 'work')
        .reduce((sum, s) => sum + (s.actualMin ?? 0), 0) / 60)
    : 0;

  return (
    <Drawer open={open} onClose={onClose} title={task ? 'Редактировать задачу' : 'Новая задача'}>
      {open && (
        <TaskForm
          key={task?.id ?? 'new'}
          task={task}
          ctx={ctxLoading ? undefined : ctx}
          spentHours={spentHours}
          isSaving={createTask.isPending || updateTask.isPending}
          onCancel={onClose}
          onSubmit={(input) => {
            if (task) {
              updateTask.mutate({ id: task.id, patch: input }, { onSuccess: onClose });
            } else {
              createTask.mutate(input, { onSuccess: onClose });
            }
          }}
          onSpread={() => setShowSpread(true)}
          onDelete={
            task
              ? () => {
                  deleteTask.mutate(task.id, { onSuccess: onClose });
                }
              : undefined
          }
        />
      )}

      {open && task && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <h3 className="mb-2 text-sm font-semibold">Сегодня ({today})</h3>
          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>По плану сегодня: {plannedToday.toFixed(2)} ч</span>
            <span>Потрачено по помидоро: {spentToday.toFixed(2)} ч</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${spentToday > plannedToday ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${todayPct}%` }}
            />
          </div>
          {plannedToday === 0 && (
            <p className="mt-1 text-xs text-slate-400">На сегодня по этой задаче ничего не запланировано</p>
          )}
        </div>
      )}

      {open && task && taskSlices.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <h3 className="mb-2 text-sm font-semibold">Текущее распределение</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-1 font-normal">День</th>
                <th className="pb-1 text-right font-normal">План</th>
                <th className="pb-1 text-right font-normal">Факт</th>
              </tr>
            </thead>
            <tbody>
              {taskSlices
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 text-slate-600 dark:text-slate-300">{s.date}</td>
                    <td className="py-1 text-right">{s.plannedHours} ч</td>
                    <td className="py-1 text-right text-emerald-600 dark:text-emerald-400">
                      {s.doneHours > 0 ? `${s.doneHours} ч` : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Итого: {taskSlices.reduce((sum, s) => sum + s.plannedHours, 0).toFixed(2)} ч план ·{' '}
            {taskSlices.reduce((sum, s) => sum + s.doneHours, 0).toFixed(2)} ч факт
          </p>
        </div>
      )}

      {open && canStartPomodoro && (
        <button
          type="button"
          onClick={() => {
            startPomodoro(task.id, 'work');
            openPomodoro(true);
            onClose();
          }}
          className="mt-4 w-full rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          🍅 Старт помидоро по задаче
        </button>
      )}

      {open && task && showSpread && (
        <>
          {ctxLoading || !ctx ? (
            <p className="mt-4 text-sm text-slate-500">Считаем план…</p>
          ) : (
            <SpreadPanel
              task={task}
              ctx={ctx}
              onApply={(slices) => {
                replaceSlices.mutate(
                  { taskId: task.id, slices },
                  { onSuccess: () => setShowSpread(false) },
                );
              }}
              onCancel={() => setShowSpread(false)}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
