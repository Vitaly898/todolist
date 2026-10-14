import { describe, expect, it } from 'vitest';
import type { Task, TaskSlice } from '../data/types';
import { plannedHoursForDate } from './dayLoad';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Test',
    status: 'todo',
    priority: 2,
    category: 'work',
    estimateHours: 4,
    remainingHours: 4,
    startDate: '2026-08-25',
    deadline: '2026-08-26',
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('plannedHoursForDate', () => {
  it('без срезов размазывает естимейт поровну по дням окна', () => {
    // 4ч на 2 дня (25–26) → по 2ч в день
    expect(plannedHoursForDate('2026-08-25', [task()], [])).toBe(2);
    expect(plannedHoursForDate('2026-08-26', [task()], [])).toBe(2);
    // вне окна — 0
    expect(plannedHoursForDate('2026-08-27', [task()], [])).toBe(0);
  });

  it('однодневная задача без срезов — полный естимейт на её день', () => {
    const t = task({ deadline: '2026-08-25', estimateHours: 3, remainingHours: 3 });
    expect(plannedHoursForDate('2026-08-25', [t], [])).toBe(3);
  });

  it('со срезами считает только срез на этот день', () => {
    const slices: TaskSlice[] = [
      { id: 's1', taskId: 't1', date: '2026-08-25', plannedHours: 1.5, doneHours: 0 },
      { id: 's2', taskId: 't1', date: '2026-08-26', plannedHours: 2.5, doneHours: 0 },
    ];
    expect(plannedHoursForDate('2026-08-25', [task()], slices)).toBe(1.5);
    expect(plannedHoursForDate('2026-08-26', [task()], slices)).toBe(2.5);
  });

  it('выполненная задача считается по doneHours, отменённая пропускается', () => {
    const done = task({ status: 'done' });
    const slices: TaskSlice[] = [
      { id: 's1', taskId: 't1', date: '2026-08-25', plannedHours: 2, doneHours: 1 },
    ];
    expect(plannedHoursForDate('2026-08-25', [done], slices)).toBe(1);

    const cancelled = task({ status: 'cancelled' });
    expect(plannedHoursForDate('2026-08-25', [cancelled], [])).toBe(0);
  });

  it('суммирует несколько задач', () => {
    const a = task({ id: 'a', estimateHours: 2, remainingHours: 2, deadline: '2026-08-25' });
    const b = task({ id: 'b', estimateHours: 4, remainingHours: 4 });
    // a: 2ч на 25-е; b: 2ч на 25-е и 2ч на 26-е
    expect(plannedHoursForDate('2026-08-25', [a, b], [])).toBe(4);
  });
});
