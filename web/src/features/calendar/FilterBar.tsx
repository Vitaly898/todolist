import type { Category, Priority, TaskStatus } from '../../data/types';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '../../data/types';

interface FilterBarProps {
  status: TaskStatus[];
  priority: Priority[];
  category: Category[];
  onToggle: (key: 'status' | 'priority' | 'category', value: string) => void;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

export function FilterBar({ status, priority, category, onToggle }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">Статус:</span>
        {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
          <Chip key={s} active={status.includes(s)} onClick={() => onToggle('status', s)}>
            {STATUS_LABELS[s]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">Приоритет:</span>
        {([1, 2, 3, 4] as Priority[]).map((p) => (
          <Chip key={p} active={priority.includes(p)} onClick={() => onToggle('priority', String(p))}>
            {PRIORITY_LABELS[p]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">Сфера:</span>
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
          <Chip key={c} active={category.includes(c)} onClick={() => onToggle('category', c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>
    </div>
  );
}
