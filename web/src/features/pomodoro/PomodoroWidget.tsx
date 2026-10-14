import { useState } from 'react';
import { usePomodoroSessions } from '../../hooks/usePomodoro';
import { useTasks } from '../../hooks/useTasks';
import { toISODate } from '../calendar/utils';
import { usePomodoroState } from './PomodoroContext';

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function PomodoroWidget() {
  const { state, isOpen, setIsOpen, start, pause, resume, stop } = usePomodoroState();
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const { data: tasks } = useTasks();
  const today = toISODate(new Date());
  const { data: sessions } = usePomodoroSessions(today, today);

  const focusMinToday = (sessions ?? [])
    .filter((s) => s.kind === 'work')
    .reduce((sum, s) => sum + (s.actualMin ?? 0), 0);

  const activeTasks = (tasks ?? [])
    .filter((t) => t.status === 'todo' || t.status === 'in_progress')
    .sort((a, b) => b.priority - a.priority);

  const activeTask = state.status !== 'idle' && state.taskId ? tasks?.find((t) => t.id === state.taskId) : undefined;

  if (!isOpen) {
    const running = state.status === 'running' || state.status === 'paused';
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        title="Помидоро"
      >
        <span className="text-2xl leading-none">🍅</span>
        {running && (
          <span className="text-[10px] font-bold tabular-nums leading-none">
            {formatTime(state.remainingSec)}
          </span>
        )}
        {focusMinToday > 0 && !running && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {Math.round(focusMinToday)}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">🍅 Помидоро</span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-lg text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      </div>

      {state.status === 'idle' && (
        <>
          <label className="mb-1 block text-sm">Задача</label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="mb-3 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Без задачи</option>
            {activeTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => start(selectedTaskId || undefined, 'work')}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Старт
          </button>
        </>
      )}

      {state.status !== 'idle' && (
        <>
          <div className="mb-2 text-center">
            <div className="text-4xl font-bold tabular-nums">{formatTime(state.remainingSec)}</div>
            <div className="text-sm text-slate-500">
              {state.kind === 'work' ? 'Работа' : 'Перерыв'}
              {activeTask && state.kind === 'work' && (
                <span className="block truncate font-medium text-slate-700 dark:text-slate-200" title={activeTask.title}>
                  {activeTask.title}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {state.status === 'running' ? (
              <button
                type="button"
                onClick={pause}
                className="flex-1 rounded-md border border-slate-300 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Пауза
              </button>
            ) : (
              <button
                type="button"
                onClick={resume}
                className="flex-1 rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Продолжить
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              className="flex-1 rounded-md border border-slate-300 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/50"
            >
              Стоп
            </button>
          </div>
        </>
      )}

      <div className="mt-3 text-xs text-slate-400">Фокус сегодня: {focusMinToday} мин</div>
    </div>
  );
}
