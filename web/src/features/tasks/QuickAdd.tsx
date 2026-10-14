import { useState } from 'react';
import { useCreateTask } from '../../hooks/useTasks';

/** Быстрое добавление: название + Enter → задача с дефолтами (PLAN.md §4). */
export function QuickAdd({ placeholder = '+ Быстро добавить задачу…' }: { placeholder?: string }) {
  const [title, setTitle] = useState('');
  const createTask = useCreateTask();

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask.mutate({ title: trimmed });
    setTitle('');
  };

  return (
    <input
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
      }}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400"
    />
  );
}
