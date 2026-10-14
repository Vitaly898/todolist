import { useState } from 'react';
import type { TaskStatus } from '../data/types';
import { STATUS_LABELS } from '../data/types';
import { QuickAdd } from '../features/tasks/QuickAdd';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { TaskCard } from '../features/tasks/TaskCard';
import { TaskDrawer, type TaskDrawerState } from '../features/tasks/TaskDrawer';
import { useTasks } from '../hooks/useTasks';

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'done', 'cancelled'];

export function TasksPage() {
  const { data: tasks, isLoading, isError } = useTasks();
  const [drawer, setDrawer] = useState<TaskDrawerState>(null);
  const [mode, setMode] = useState<'list' | 'board'>('board');

  const groups = STATUS_ORDER.map((status) => ({
    status,
    tasks: (tasks ?? []).filter((t) => t.status === status),
  })).filter((g) => g.tasks.length > 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Задачи</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700">
            {(['list', 'board'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-sm ${
                  mode === m
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${m === 'list' ? 'rounded-l-lg' : 'rounded-r-lg'}`}
              >
                {m === 'list' ? 'Список' : 'Доска'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDrawer({ mode: 'create' })}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            + Новая задача
          </button>
        </div>
      </div>

      <QuickAdd />

      {isLoading && <p className="text-slate-500">Загрузка…</p>}
      {isError && <p className="text-red-500">Не удалось загрузить задачи</p>}

      {!isLoading && tasks?.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          Задач пока нет — добавьте первую выше
        </p>
      )}

      {!isLoading && mode === 'board' && (
        <TaskBoard tasks={tasks ?? []} onTaskClick={(task) => setDrawer({ mode: 'edit', task })} />
      )}

      {!isLoading && mode === 'list' &&
        groups.map((group) => (
          <div key={group.status}>
            <h2 className="mb-2 text-sm font-medium text-slate-500">
              {STATUS_LABELS[group.status]} · {group.tasks.length}
            </h2>
            <div className="flex flex-col gap-2">
              {group.tasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => setDrawer({ mode: 'edit', task })} />
              ))}
            </div>
          </div>
        ))}

      <TaskDrawer state={drawer} onClose={() => setDrawer(null)} />
    </section>
  );
}
