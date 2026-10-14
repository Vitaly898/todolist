interface CapacityBarProps {
  planned: number;
  capacity: number;
  label?: string;
}

export function CapacityBar({ planned, capacity, label }: CapacityBarProps) {
  const pct = capacity > 0 ? Math.min(100, Math.round((planned / capacity) * 100)) : 0;
  const over = planned > capacity;

  return (
    <div className="text-sm">
      <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label ?? 'Загрузка'}</span>
        <span>
          {planned.toFixed(1)} / {capacity.toFixed(1)} ч {over && '(перегруз)'}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
