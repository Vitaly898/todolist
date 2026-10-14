import { describe, expect, it } from 'vitest';
import type { DayCapacity, Settings, Task, TaskSlice, WorkWindow } from '../data/types';
import { spreadTask, replan, earliestFitDeadline } from './planner';

const settings: Settings = {
  defaultDailyCapacityHours: 4,
  pomodoroWorkMin: 25,
  pomodoroBreakMin: 5,
};

const windows: WorkWindow[] = [
  { id: '1', weekday: 1, startMin: 600, endMin: 1140 }, // пн
  { id: '2', weekday: 2, startMin: 600, endMin: 1140 }, // вт
  { id: '3', weekday: 3, startMin: 600, endMin: 1140 }, // ср
  { id: '4', weekday: 4, startMin: 600, endMin: 1140 }, // чт
  { id: '5', weekday: 5, startMin: 600, endMin: 1140 }, // пт
];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Test',
    status: 'todo',
    priority: 2,
    category: 'work',
    estimateHours: 5,
    remainingHours: 5,
    startDate: '2026-08-24',
    deadline: '2026-09-07',
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...overrides,
  };
}

function ctx(overrides: Partial<{ tasks: Task[]; slices: TaskSlice[]; dayCapacities: DayCapacity[]; today: string }> = {}) {
  return {
    tasks: [],
    slices: [],
    settings,
    workWindows: windows,
    dayCapacities: [],
    today: '2026-08-24',
    ...overrides,
  };
}

describe('spreadTask', () => {
  it('размазывает 5ч на 2 недели равномерно по рабочим дням', () => {
    const res = spreadTask(task(), ctx());
    expect(res.overflowHours).toBe(0);
    expect(res.slices.length).toBeGreaterThan(5);
    expect(res.slices.length).toBeLessThanOrEqual(10);
    // каждый день не более ёмкости
    for (const s of res.slices) {
      expect(s.plannedHours).toBeLessThanOrEqual(4);
    }
    const total = res.slices.reduce((sum, s) => sum + s.plannedHours, 0);
    expect(total).toBeCloseTo(5);
  });

  it('рабочие задачи не размазываются на выходные, даже если окна есть', () => {
    const allWeekWindows: WorkWindow[] = [0, 1, 2, 3, 4, 5, 6].map((wd) => ({
      id: String(wd),
      weekday: wd as WorkWindow['weekday'],
      startMin: 600,
      endMin: 1140,
    }));
    // пт 28.08 — пн 31.08, 4ч
    const workTask = task({ category: 'work', estimateHours: 4, remainingHours: 4, startDate: '2026-08-28', deadline: '2026-08-31' });
    const res = spreadTask(workTask, { ...ctx({ today: '2026-08-28' }), workWindows: allWeekWindows });
    const dates = res.slices.map((s) => s.date);
    expect(dates).not.toContain('2026-08-29'); // сб
    expect(dates).not.toContain('2026-08-30'); // вс
    expect(dates).toEqual(['2026-08-28', '2026-08-31']);

    // а бытовая задача — может и на выходные
    const lifeTask = task({ id: 't2', category: 'life', estimateHours: 4, remainingHours: 4, startDate: '2026-08-28', deadline: '2026-08-31' });
    const res2 = spreadTask(lifeTask, { ...ctx({ today: '2026-08-28' }), workWindows: allWeekWindows });
    const dates2 = res2.slices.map((s) => s.date);
    expect(dates2).toContain('2026-08-29');
    expect(dates2).toContain('2026-08-30');
  });

  it('сигналит overflow, если не хватает ёмкости', () => {
    const big = task({ estimateHours: 100, remainingHours: 100 });
    const res = spreadTask(big, ctx());
    expect(res.overflowHours).toBeGreaterThan(0);
  });

  it('учитывает уже запланированные срезы других задач', () => {
    const slices: TaskSlice[] = [
      { id: 's1', taskId: 'other', date: '2026-08-24', plannedHours: 3.5, doneHours: 0 },
    ];
    const res = spreadTask(task({ estimateHours: 2, remainingHours: 2 }), ctx({ slices }));
    // 24 авг — понедельник, свободно 0.5ч, дневная доля 2/11 → округление до 0.5ч
    const mon = res.slices.find((s) => s.date === '2026-08-24');
    expect(mon?.plannedHours).toBe(0.5);
  });
});

describe('replan', () => {
  it('перепланирует две задачи с учётом приоритетов', () => {
    const tasks: Task[] = [
      task({ id: 'a', priority: 4, estimateHours: 4, remainingHours: 4 }),
      task({ id: 'b', priority: 2, estimateHours: 4, remainingHours: 4 }),
    ];
    const res = replan(ctx({ tasks }));
    expect(res.a).toBeDefined();
    expect(res.b).toBeDefined();
    // обе умещаются, т.к. ёмкость 4ч/день и окно 2 недели
    expect(res.a.overflowHours).toBe(0);
    expect(res.b.overflowHours).toBe(0);
  });

  it('не трогает задачи с ручными срезами', () => {
    const tasks: Task[] = [
      task({ id: 'a', priority: 4, estimateHours: 4, remainingHours: 4 }),
      task({ id: 'b', priority: 2, estimateHours: 4, remainingHours: 4 }),
    ];
    const manualSlices: TaskSlice[] = [
      { id: 'm1', taskId: 'a', date: '2026-08-24', plannedHours: 3, doneHours: 0, manual: true },
      { id: 'm2', taskId: 'a', date: '2026-08-25', plannedHours: 1, doneHours: 0, manual: true },
    ];
    const res = replan(ctx({ tasks, slices: manualSlices }));
    expect(res.a).toBeUndefined(); // ручная задача не перепланируется
    expect(res.b).toBeDefined();
  });
});

describe('earliestFitDeadline', () => {
  it('находит дедлайн с запасом 20%', () => {
    const res = earliestFitDeadline(task({ estimateHours: 2, remainingHours: 2 }), ctx());
    expect(res).not.toBeNull();
    expect(res!.result.overflowHours).toBe(0);
  });
});
