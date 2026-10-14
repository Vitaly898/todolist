import { useEffect, useState } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { useDayCapacities, useUpsertDayCapacity, useWorkWindows, useSetWorkWindows } from '../hooks/useSchedule';
import { toISODate } from '../features/calendar/utils';
import { repo, isApiMode } from '../data';

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function minToTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMin(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-400';

export function SettingsPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const { data: windows, isLoading: windowsLoading } = useWorkWindows();
  const setWorkWindows = useSetWorkWindows();

  const today = toISODate(new Date());
  const { data: dayCapacities } = useDayCapacities(today, today);
  const upsertCapacity = useUpsertDayCapacity();
  const todayCapacity = dayCapacities?.find((c) => c.date === today)?.capacityHours;

  // Локальное состояние форм
  const [draftWindows, setDraftWindows] = useState<Record<number, { enabled: boolean; start: string; end: string }>>({
    0: { enabled: false, start: '10:00', end: '19:00' },
    1: { enabled: true, start: '10:00', end: '19:00' },
    2: { enabled: true, start: '10:00', end: '19:00' },
    3: { enabled: true, start: '10:00', end: '19:00' },
    4: { enabled: true, start: '10:00', end: '19:00' },
    5: { enabled: true, start: '10:00', end: '19:00' },
    6: { enabled: false, start: '10:00', end: '19:00' },
  });

  const [draftDefaultCapacity, setDraftDefaultCapacity] = useState(settings?.defaultDailyCapacityHours ?? 4);
  const [draftPomodoroWork, setDraftPomodoroWork] = useState(settings?.pomodoroWorkMin ?? 25);
  const [draftPomodoroBreak, setDraftPomodoroBreak] = useState(settings?.pomodoroBreakMin ?? 5);
  const [todayCapacityInput, setTodayCapacityInput] = useState(todayCapacity ?? settings?.defaultDailyCapacityHours ?? 4);

  useEffect(() => {
    if (!windows) return;
    const next: Record<number, { enabled: boolean; start: string; end: string }> = {};
    for (let wd = 0; wd <= 6; wd++) {
      const w = windows.find((x) => x.weekday === wd);
      next[wd] = w
        ? { enabled: true, start: minToTime(w.startMin), end: minToTime(w.endMin) }
        : { enabled: false, start: '10:00', end: '19:00' };
    }
    setDraftWindows(next);
  }, [windows]);

  useEffect(() => {
    if (!settings) return;
    setDraftDefaultCapacity(settings.defaultDailyCapacityHours);
    setDraftPomodoroWork(settings.pomodoroWorkMin);
    setDraftPomodoroBreak(settings.pomodoroBreakMin);
    if (todayCapacity == null) setTodayCapacityInput(settings.defaultDailyCapacityHours);
  }, [settings, todayCapacity]);

  const saveWindows = () => {
    const payload = Object.entries(draftWindows)
      .filter(([, v]) => v.enabled)
      .map(([weekday, v]) => ({
        weekday: Number(weekday) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        startMin: timeToMin(v.start),
        endMin: timeToMin(v.end),
      }));
    setWorkWindows.mutate(payload);
  };

  const saveSettings = () => {
    updateSettings.mutate({
      defaultDailyCapacityHours: draftDefaultCapacity,
      pomodoroWorkMin: draftPomodoroWork,
      pomodoroBreakMin: draftPomodoroBreak,
    });
    upsertCapacity.mutate({ date: today, capacityHours: todayCapacityInput });
  };

  if (settingsLoading || windowsLoading) return <p className="text-slate-500">Загрузка…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Настройки</h1>

      <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="mb-3 font-medium">Рабочие окна по дням недели</h2>
        <div className="flex flex-col gap-2">
          {WEEKDAYS.map((label, wd) => (
            <div key={wd} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draftWindows[wd]?.enabled ?? false}
                onChange={(e) =>
                  setDraftWindows((prev) => ({
                    ...prev,
                    [wd]: { ...prev[wd], enabled: e.target.checked },
                  }))
                }
                className="h-4 w-4"
              />
              <span className="w-10 text-sm">{label}</span>
              <input
                type="time"
                value={draftWindows[wd]?.start ?? '10:00'}
                onChange={(e) =>
                  setDraftWindows((prev) => ({ ...prev, [wd]: { ...prev[wd], start: e.target.value } }))
                }
                disabled={!draftWindows[wd]?.enabled}
                className={`${inputCls} w-28`}
              />
              <span className="text-slate-400">—</span>
              <input
                type="time"
                value={draftWindows[wd]?.end ?? '19:00'}
                onChange={(e) =>
                  setDraftWindows((prev) => ({ ...prev, [wd]: { ...prev[wd], end: e.target.value } }))
                }
                disabled={!draftWindows[wd]?.enabled}
                className={`${inputCls} w-28`}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={saveWindows}
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Сохранить окна
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="mb-3 font-medium">Ёмкость дня, часы</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm">Дефолтная ёмкость на день</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={draftDefaultCapacity}
              onChange={(e) => setDraftDefaultCapacity(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">Ёмкость на сегодня ({today})</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={todayCapacityInput}
              onChange={(e) => setTodayCapacityInput(Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="mb-3 font-medium">Помидоро</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm">Работа, мин</label>
            <input
              type="number"
              step="1"
              min="1"
              max="120"
              value={draftPomodoroWork}
              onChange={(e) => setDraftPomodoroWork(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">Перерыв, мин</label>
            <input
              type="number"
              step="1"
              min="1"
              max="60"
              value={draftPomodoroBreak}
              onChange={(e) => setDraftPomodoroBreak(Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {isApiMode && (
        <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="mb-2 font-medium">Импорт данных</h2>
          <p className="mb-3 text-sm text-slate-500">
            Перенести задачи и настройки из localStorage (режим без бэкенда) в SQLite.
          </p>
          <button
            type="button"
            onClick={async () => {
              const raw = localStorage.getItem('todolist.v2');
              if (!raw) {
                alert('В localStorage нет данных для импорта');
                return;
              }
              if (!confirm('Импортировать данные из localStorage в SQLite?')) return;
              try {
                const res = await fetch('/api/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: raw,
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const result = await res.json();
                alert(`Импортировано: задач ${result.importedTasks}, срезов ${result.importedSlices}, сессий ${result.importedSessions}`);
                window.location.reload();
              } catch (e) {
                alert(`Ошибка импорта: ${(e as Error).message}`);
              }
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Импортировать из localStorage
          </button>
        </section>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveSettings}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Сохранить настройки
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!confirm('Сбросить все данные на демо-задачи?')) return;
            try {
              await repo.resetToSeed();
              window.location.reload();
            } catch (e) {
              alert((e as Error).message);
            }
          }}
          className="rounded-md px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
        >
          Сбросить на демо-данные
        </button>
      </div>
    </div>
  );
}
