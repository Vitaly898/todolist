import type { Task } from '../../data/types';
import { PRIORITY_LABELS, STATUS_LABELS } from '../../data/types';
import { categoryDot, priorityBorder } from '../../data/colors';
import { useUpdateTask } from '../../hooks/useTasks';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { CSSProperties, Ref } from 'react';

const priorityChip: Record<Task['priority'], string> = {
  1: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  2: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  4: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  dragRef?: Ref<HTMLDivElement>;
  dragListeners?: SyntheticListenerMap;
  dragAttributes?: DraggableAttributes;
  dragTransform?: string;
}

export function TaskCard({ task, onClick, dragRef, dragListeners, dragAttributes, dragTransform }: TaskCardProps) {
  const updateTask = useUpdateTask();
  const isDone = task.status === 'done';

  const toggleDone = () => {
    updateTask.mutate({ id: task.id, patch: { status: isDone ? 'todo' : 'done' } });
  };

  const style: CSSProperties | undefined = dragTransform ? { transform: dragTransform } : undefined;

  return (
    <div
      ref={dragRef}
      {...(dragListeners ?? {})}
      {...(dragAttributes ?? {})}
      style={style}
      className={`flex touch-none items-center gap-3 rounded-lg border border-l-4 border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ${priorityBorder[task.priority]} ${
        dragTransform ? 'z-20 shadow-lg opacity-90' : ''
      }`}
    >
      <button
        type="button"
        onClick={toggleDone}
        aria-label={isDone ? 'Вернуть в работу' : 'Отметить выполненной'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] transition-colors ${
          isDone
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-slate-300 hover:border-green-500 dark:border-slate-600'
        }`}
      >
        {isDone && '✓'}
      </button>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium ${isDone ? 'text-slate-400 line-through' : ''}`}>
            {task.title}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${categoryDot[task.category]}`} />
              {STATUS_LABELS[task.status]}
            </span>
            {task.estimateHours != null && <span>≈ {task.estimateHours} ч</span>}
            {task.startDate && <span>c {task.startDate}</span>}
            {task.deadline && <span>до {task.deadline}</span>}
          </span>
        </span>
      </button>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${priorityChip[task.priority]}`}
      >
        {PRIORITY_LABELS[task.priority]}
      </span>
    </div>
  );
}
