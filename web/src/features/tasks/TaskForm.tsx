import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toISODate } from '../calendar/utils';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Category,
  type Priority,
  type Task,
  type TaskInput,
  type TaskStatus,
} from '../../data/types';
import type { PlannerContext } from '../../domain/planner';
import { suggestDeadline } from '../../domain/assistant';

const schema = z.object({
  title: z.string().trim().min(1, 'Название обязательно'),
  category: z.enum(['work', 'study', 'life']),
  priority: z.number().int().min(1).max(4),
  estimateHours: z
    .number()
    .min(0.5, 'Минимум 0.5 ч')
    .max(500, 'Слишком много')
    .optional(),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
});

type FormValues = z.infer<typeof schema>;

const CATEGORIES: Category[] = ['work', 'study', 'life'];
const PRIORITIES: Priority[] = [1, 2, 3, 4];
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-400';

interface TaskFormProps {
  task?: Task;
  ctx?: PlannerContext;
  spentHours?: number;
  onSubmit: (input: TaskInput & { status?: TaskStatus }) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSpread?: () => void;
  isSaving?: boolean;
}

export function TaskForm({ task, ctx, spentHours = 0, onSubmit, onCancel, onDelete, onSpread, isSaving }: TaskFormProps) {
  const [showExtra, setShowExtra] = useState(Boolean(task?.description));
  const [suggestion, setSuggestion] = useState<{ deadline: string; explanation: string } | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      category: task?.category ?? 'life',
      priority: task?.priority ?? 2,
      estimateHours: task?.estimateHours,
      startDate: task?.startDate ?? toISODate(new Date()),
      deadline: task?.deadline ?? '',
      description: task?.description ?? '',
      status: task?.status,
    },
  });

  const category = watch('category');
  const priority = watch('priority');
  const estimate = watch('estimateHours');
  const deadline = watch('deadline');
  const startDate = watch('startDate');
  const title = watch('title');

  const canSpread = task && estimate != null && estimate > 0 && !!deadline;
  const canSuggest = ctx && estimate != null && estimate > 0 && !!startDate;

  const handleSuggest = () => {
    if (!ctx || estimate == null) return;
    const res = suggestDeadline(
      {
        id: task?.id,
        title,
        status: task?.status,
        category,
        priority: (priority ?? 2) as Priority,
        estimateHours: estimate,
        startDate,
        deadline,
        createdAt: task?.createdAt,
      },
      ctx,
    );
    setSuggestion(res);
  };

  const pct = estimate && estimate > 0 ? Math.min(100, Math.round((spentHours / estimate) * 100)) : 0;

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          title: values.title,
          category: values.category,
          priority: (values.priority ?? 2) as Priority,
          estimateHours: values.estimateHours,
          startDate: values.startDate || undefined,
          deadline: values.deadline || undefined,
          description: values.description || undefined,
          status: values.status,
        }),
      )}
      className="flex flex-col gap-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium">Название</label>
        <input autoFocus className={inputCls} placeholder="Что нужно сделать?" {...register('title')} />
        {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Сфера</label>
        <div className="flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('category', c)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${
                category === c
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Приоритет</label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValue('priority', p)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${
                priority === p
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Естимейт, ч</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            className={inputCls}
            placeholder="напр. 2"
            {...register('estimateHours', {
              setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
            })}
          />
          {errors.estimateHours && (
            <p className="mt-1 text-xs text-red-500">{errors.estimateHours.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Старт</label>
          <input
            type="date"
            className={inputCls}
            {...register('startDate', { setValueAs: (v) => v || undefined })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Дедлайн</label>
          <input
            type="date"
            className={inputCls}
            {...register('deadline', { setValueAs: (v) => v || undefined })}
          />
          {canSuggest && (
            <button
              type="button"
              onClick={handleSuggest}
              className="mt-1 text-xs text-slate-500 underline-offset-2 hover:underline"
            >
              Подскажи срок
            </button>
          )}
        </div>
      </div>

      {task && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Потрачено по помидоро</span>
            <span>
              {estimate
                ? `${Math.round(spentHours * 60)} / ${Math.round(estimate * 60)} мин`
                : `${Math.round(spentHours * 60)} мин`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {estimate && estimate > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Остаток: {Math.max(0, Math.round(estimate * 60 - spentHours * 60))} мин
            </p>
          )}
        </div>
      )}

      {suggestion && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-700 dark:text-slate-300">{suggestion.explanation}</p>
          <button
            type="button"
            onClick={() => {
              setValue('deadline', suggestion.deadline);
              setSuggestion(null);
            }}
            className="mt-1 text-xs font-medium text-slate-900 underline dark:text-slate-100"
          >
            Применить дедлайн
          </button>
        </div>
      )}

      {task && (
        <div>
          <label className="mb-1 block text-sm font-medium">Статус</label>
          <select className={inputCls} {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="self-start text-sm text-slate-500 underline-offset-2 hover:underline"
      >
        {showExtra ? 'Скрыть описание' : 'Ещё: описание'}
      </button>
      {showExtra && (
        <textarea
          rows={3}
          className={inputCls}
          placeholder="Детали, ссылки, контекст…"
          {...register('description')}
        />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {task ? 'Сохранить' : 'Создать'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Отмена
        </button>
        {canSpread && (
          <button
            type="button"
            onClick={onSpread}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Размазать
          </button>
        )}
        {task && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
          >
            Удалить
          </button>
        )}
      </div>
    </form>
  );
}
