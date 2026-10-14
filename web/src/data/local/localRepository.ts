import { addDays, format } from 'date-fns';
import type { Repository } from '../repository';
import {
  DEFAULT_SETTINGS,
  type DayCapacity,
  type PomodoroSession,
  type Settings,
  type Task,
  type TaskFilters,
  type TaskSlice,
  type WorkWindow,
} from '../types';

const STORAGE_KEY = 'todolist.v2';

interface LocalState {
  version: 1;
  tasks: Task[];
  settings: Settings;
  workWindows: WorkWindow[];
  dayCapacities: DayCapacity[];
  slices: TaskSlice[];
  pomodoroSessions: PomodoroSession[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function day(offset: number): string {
  return format(addDays(new Date(), offset), 'yyyy-MM-dd');
}

function seedState(): LocalState {
  const ts = nowIso();
  const demo: Array<
    Pick<Task, 'title' | 'category' | 'priority' | 'estimateHours'> & {
      deadlineIn: number;
      startIn?: number;
      status?: Task['status'];
    }
  > = [
    { title: 'Сделать домашку по матану', category: 'study', priority: 3, estimateHours: 5, startIn: -2, deadlineIn: 12 },
    { title: 'Подготовить отчёт для стендапа', category: 'work', priority: 4, estimateHours: 2, startIn: 0, deadlineIn: 1 },
    { title: 'Купить продукты на неделю', category: 'life', priority: 2, estimateHours: 1.5, startIn: 1, deadlineIn: 2 },
    { title: 'Разобрать ПРы в команде', category: 'work', priority: 3, estimateHours: 3, startIn: -3, deadlineIn: 3, status: 'in_progress' },
    { title: 'Прочитать главу про алгоритмы', category: 'study', priority: 2, estimateHours: 2, startIn: 0, deadlineIn: 7 },
    { title: 'Записаться к стоматологу', category: 'life', priority: 1, estimateHours: 0.5, startIn: 5, deadlineIn: 10 },
    { title: 'Пропланировать спринт', category: 'work', priority: 2, estimateHours: 1, startIn: 0, deadlineIn: 0 },
    { title: 'Подготовка к собеседованию', category: 'study', priority: 4, estimateHours: 8, startIn: -1, deadlineIn: 6 },
  ];

  return {
    version: 1,
    tasks: demo.map((d) => ({
      id: crypto.randomUUID(),
      title: d.title,
      status: d.status ?? 'todo',
      priority: d.priority,
      category: d.category,
      estimateHours: d.estimateHours,
      remainingHours: d.estimateHours,
      startDate: day(d.startIn ?? 0),
      deadline: day(d.deadlineIn),
      createdAt: ts,
      updatedAt: ts,
    })),
    settings: { ...DEFAULT_SETTINGS },
    workWindows: [1, 2, 3, 4, 5].map((weekday) => ({
      id: crypto.randomUUID(),
      weekday: weekday as WorkWindow['weekday'],
      startMin: 10 * 60,
      endMin: 19 * 60,
    })),
    dayCapacities: [],
    slices: [],
    pomodoroSessions: [],
  };
}

function loadState(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalState;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // повреждённые данные — пересоздаём
  }
  const seeded = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function matchesFilters(task: Task, filters?: TaskFilters): boolean {
  if (!filters) return true;
  if (filters.status?.length && !filters.status.includes(task.status)) return false;
  if (filters.priority?.length && !filters.priority.includes(task.priority)) return false;
  if (filters.category?.length && !filters.category.includes(task.category)) return false;
  const date = task.deadline ?? task.startDate;
  if (filters.from && date && date < filters.from) return false;
  if (filters.to && date && date > filters.to) return false;
  return true;
}

export function createLocalRepository(): Repository {
  let state = loadState();

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  return {
    async listTasks(filters) {
      return state.tasks
        .filter((t) => matchesFilters(t, filters))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async getTask(id) {
      return state.tasks.find((t) => t.id === id) ?? null;
    },

    async createTask(input) {
      const ts = nowIso();
      const task: Task = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        description: input.description,
        status: input.status ?? 'todo',
        priority: input.priority ?? 2,
        category: input.category ?? 'life',
        estimateHours: input.estimateHours,
        remainingHours: input.estimateHours,
        startDate: input.startDate ?? ts.slice(0, 10), // по умолчанию старт — сегодня
        deadline: input.deadline,
        createdAt: ts,
        updatedAt: ts,
      };
      state = { ...state, tasks: [...state.tasks, task] };
      persist();
      return task;
    },

    async updateTask(id, patch) {
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) throw new Error(`Task not found: ${id}`);
      const becameDone = patch.status === 'done' && existing.status !== 'done';
      const reopened = patch.status !== undefined && patch.status !== 'done' && existing.status === 'done';
      const updated: Task = {
        ...existing,
        ...patch,
        title: patch.title !== undefined ? patch.title.trim() : existing.title,
        doneAt: becameDone ? nowIso() : reopened ? undefined : existing.doneAt,
        updatedAt: nowIso(),
      };
      state = {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      };
      persist();
      return updated;
    },

    async deleteTask(id) {
      state = {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== id),
        slices: state.slices.filter((s) => s.taskId !== id),
      };
      persist();
    },

    async getSettings() {
      return state.settings;
    },

    async updateSettings(patch) {
      state = { ...state, settings: { ...state.settings, ...patch } };
      persist();
      return state.settings;
    },

    async listWorkWindows() {
      return [...state.workWindows].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
    },

    async setWorkWindows(windows) {
      const next = windows.map((w) => ({ ...w, id: crypto.randomUUID() }));
      state = { ...state, workWindows: next };
      persist();
      return next;
    },

    async listDayCapacities(from, to) {
      return state.dayCapacities.filter((c) => c.date >= from && c.date <= to);
    },

    async upsertDayCapacity(capacity) {
      const rest = state.dayCapacities.filter((c) => c.date !== capacity.date);
      state = { ...state, dayCapacities: [...rest, capacity] };
      persist();
    },

    async listSlices(from, to) {
      return state.slices.filter((s) => s.date >= from && s.date <= to);
    },

    async replaceTaskSlices(taskId, slices) {
      const rest = state.slices.filter((s) => s.taskId !== taskId);
      const next = slices.map((s) => ({ ...s, id: crypto.randomUUID(), taskId }));
      state = { ...state, slices: [...rest, ...next] };
      persist();
      return next;
    },

    async addDoneHoursToSlice(taskId, date, hours) {
      const existing = state.slices.find((s) => s.taskId === taskId && s.date === date);
      let result: TaskSlice;
      if (existing) {
        result = { ...existing, doneHours: Math.round((existing.doneHours + hours) * 100) / 100 };
        state = { ...state, slices: state.slices.map((s) => (s.id === existing.id ? result : s)) };
      } else {
        result = { id: crypto.randomUUID(), taskId, date, plannedHours: 0, doneHours: Math.round(hours * 100) / 100 };
        state = { ...state, slices: [...state.slices, result] };
      }
      persist();
      return result;
    },

    async listPomodoroSessions(from, to) {
      return state.pomodoroSessions.filter((s) => s.startedAt >= from && s.startedAt <= to);
    },

    async createPomodoroSession(session) {
      const full: PomodoroSession = { ...session, id: crypto.randomUUID(), startedAt: nowIso() };
      state = { ...state, pomodoroSessions: [...state.pomodoroSessions, full] };
      persist();
      return full;
    },

    async finishPomodoroSession(id, actualMin) {
      const existing = state.pomodoroSessions.find((s) => s.id === id);
      if (!existing) throw new Error(`Pomodoro session not found: ${id}`);
      const finished: PomodoroSession = { ...existing, endedAt: nowIso(), actualMin };
      state = {
        ...state,
        pomodoroSessions: state.pomodoroSessions.map((s) => (s.id === id ? finished : s)),
      };
      persist();
      return finished;
    },

    async completeWorkSession(id, actualMin) {
      const finished = await this.finishPomodoroSession(id, actualMin);
      if (finished.kind === 'work' && finished.taskId) {
        const hours = actualMin / 60;
        const task = state.tasks.find((t) => t.id === finished.taskId);
        if (task && task.remainingHours != null) {
          await this.updateTask(task.id, { remainingHours: Math.max(0, task.remainingHours - hours) });
          await this.addDoneHoursToSlice(task.id, finished.startedAt.slice(0, 10), hours);
        }
      }
      return finished;
    },

    async resetToSeed() {
      state = seedState();
      persist();
    },
  };
}
