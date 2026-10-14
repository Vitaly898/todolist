import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Task, TaskSlice } from '../../data/types';
import type { PlannerContext } from '../../domain/planner';
import { spreadTask } from '../../domain/planner';
import { toISODate } from '../calendar/utils';

interface SpreadPanelProps {
  task: Task;
  ctx: PlannerContext;
  onApply: (slices: Omit<TaskSlice, 'id' | 'taskId'>[]) => void;
  onCancel: () => void;
}

interface Row {
  date: string;
  hours: number;
}

const inputCls =
  'w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950';

function fmtDate(iso: string): string {
  return format(parseISO(iso), 'd MMM, EEE', { locale: ru });
}

export function SpreadPanel({ task, ctx, onApply, onCancel }: SpreadPanelProps) {
  const auto = useMemo(() => spreadTask(task, ctx), [task, ctx]);

  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    setRows(auto.slices.map((s) => ({ date: s.date, hours: s.plannedHours })));
  }, [auto]);

  const [newDate, setNewDate] = useState('');

  const remaining = task.remainingHours ?? task.estimateHours ?? 0;
  const total = rows.reduce((sum, r) => sum + r.hours, 0);
  const deficit = Math.max(0, Math.round((remaining - total) * 100) / 100);

  // Когда закончим с учётом распределения: последний день с часами, если всё уместилось
  const activeRows = rows.filter((r) => r.hours > 0).sort((a, b) => a.date.localeCompare(b.date));
  const completionDate = deficit <= 0 && activeRows.length > 0 ? activeRows[activeRows.length - 1].date : null;
  const deadline = task.deadline ?? null;
  const overDeadline = completionDate && deadline && completionDate > deadline;
  // вручную отредактировано (изменены часы / добавлен или удалён день)
  const isEdited =
    rows.length !== auto.slices.length ||
    rows.some((r, i) => auto.slices[i]?.date !== r.date || Math.abs((auto.slices[i]?.plannedHours ?? 0) - r.hours) > 1e-9);

  const setHours = (date: string, hours: number) => {
    setRows((prev) => prev.map((r) => (r.date === date ? { ...r, hours } : r)));
  };

  const removeRow = (date: string) => {
    setRows((prev) => prev.filter((r) => r.date !== date));
  };

  const addRow = () => {
    if (!newDate || rows.some((r) => r.date === newDate)) return;
    setRows((prev) => [...prev, { date: newDate, hours: 0 }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate('');
  };

  const addNextDay = () => {
    const last = activeRows.length ? activeRows[activeRows.length - 1].date : ctx.today;
    const next = toISODate(addDays(parseISO(last), 1));
    if (!rows.some((r) => r.date === next)) {
      setRows((prev) => [...prev, { date: next, hours: 0 }].sort((a, b) => a.date.localeCompare(b.date)));
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="mb-2 text-sm font-semibold">План по дням (можно править вручную)</h3>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Добавьте дни вручную или измените параметры задачи.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.date} className="flex items-center gap-2 text-sm">
              <span className="w-28 text-slate-600 dark:text-slate-300">{fmtDate(row.date)}</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={row.hours}
                onChange={(e) => setHours(row.date, Number(e.target.value))}
                className={inputCls}
              />
              <span className="text-xs text-slate-400">ч</span>
              <button
                type="button"
                onClick={() => removeRow(row.date)}
                aria-label="Убрать день"
                className="ml-auto text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-3 flex items-center gap-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          + День
        </button>
        <button
          type="button"
          onClick={addNextDay}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          + Следующий день
        </button>
      </div>

      <div className="mb-3 rounded-md bg-slate-50 p-2 text-sm dark:bg-slate-900">
        <div className="flex justify-between">
          <span className="text-slate-500">Распределено</span>
          <span className="font-medium">
            {total.toFixed(2)} из {remaining.toFixed(2)} ч
          </span>
        </div>
        {deficit > 0 && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Не распределено: {deficit.toFixed(2)} ч
          </p>
        )}
        {completionDate && (
          <p className={`mt-1 text-xs ${overDeadline ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            Закончим: {completionDate}
            {deadline && (overDeadline ? ` — позже дедлайна ${deadline}!` : ` — успеем к дедлайну ${deadline}`)}
          </p>
        )}
      </div>

      {auto.overflowHours > 0 && (
        <p className="mb-3 text-sm text-red-600">
          Автоплан не влез: не хватает {auto.overflowHours.toFixed(2)} ч ёмкости. Скорректируйте вручную или
          дедлайн.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onApply(
              rows
                .filter((r) => r.hours > 0)
                .map((r) => ({ date: r.date, plannedHours: r.hours, doneHours: 0, manual: isEdited })),
            )
          }
          disabled={rows.every((r) => r.hours <= 0)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Применить план
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
