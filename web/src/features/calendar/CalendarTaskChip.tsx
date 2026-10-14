import type { Task } from '../../data/types';
import { categoryDot, taskColor } from '../../data/colors';

const PRIORITY_MARK: Partial<Record<Task['priority'], string>> = {
  3: '❗',
  4: '🔥',
};

interface CalendarTaskChipProps {
  task: Task;
  onClick: (task: Task) => void;
}

/** Однодневный чип задачи в ячейке месяца: цвет = задача, точка = сфера. */
export function CalendarTaskChip({ task, onClick }: CalendarTaskChipProps) {
  const isDone = task.status === 'done';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(task);
      }}
      title={task.title}
      className={`flex h-5 w-full items-center gap-1 rounded px-1.5 text-left text-[11px] leading-none text-white ${taskColor(task.id)} ${
        isDone ? 'opacity-45 line-through' : ''
      } shadow-sm hover:brightness-110`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/70 ${categoryDot[task.category]}`} />
      <span className="truncate">{task.title}</span>
      {PRIORITY_MARK[task.priority] && <span className="shrink-0 text-[9px]">{PRIORITY_MARK[task.priority]}</span>}
    </button>
  );
}
