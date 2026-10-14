import type { Repository } from '../repository';
import type {
  DayCapacity,
  PomodoroSession,
  Settings,
  Task,
  TaskFilters,
  TaskSlice,
  WorkWindow,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function filtersQuery(filters?: TaskFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.priority?.length) params.set('priority', filters.priority.join(','));
  if (filters.category?.length) params.set('category', filters.category.join(','));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const s = params.toString();
  return s ? `?${s}` : '';
}

interface CalendarResponse {
  tasks: Task[];
  slices: TaskSlice[];
}

/** HTTP-реализация Repository поверх Go-бэкенда (фаза 7). */
export function createHttpRepository(): Repository {
  return {
    async listTasks(filters) {
      const res = await request<Task[]>(`/tasks${filtersQuery(filters)}`);
      return res ?? [];
    },
    async getTask(id) {
      return request<Task>(`/tasks/${id}`);
    },
    async createTask(input) {
      return request<Task>(`/tasks`, { method: 'POST', body: JSON.stringify(input) });
    },
    async updateTask(id, patch) {
      return request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    async deleteTask(id) {
      await request<void>(`/tasks/${id}`, { method: 'DELETE' });
    },

    async getSettings() {
      return request<Settings>(`/settings`);
    },
    async updateSettings(patch) {
      return request<Settings>(`/settings`, { method: 'PUT', body: JSON.stringify(patch) });
    },

    async listWorkWindows() {
      const res = await request<WorkWindow[]>(`/schedule/windows`);
      return res ?? [];
    },
    async setWorkWindows(windows) {
      return request<WorkWindow[]>(`/schedule/windows`, { method: 'PUT', body: JSON.stringify(windows) });
    },

    async listDayCapacities(from, to) {
      const res = await request<DayCapacity[]>(`/schedule/capacity?from=${from}&to=${to}`);
      return res ?? [];
    },
    async upsertDayCapacity(capacity) {
      await request<void>(`/schedule/capacity`, { method: 'PUT', body: JSON.stringify(capacity) });
    },

    async listSlices(from, to) {
      const res = await request<CalendarResponse>(`/calendar?from=${from}&to=${to}`);
      return res.slices ?? [];
    },
    async replaceTaskSlices(taskId, slices) {
      return request<TaskSlice[]>(`/planner/apply`, {
        method: 'POST',
        body: JSON.stringify({ taskId, slices }),
      });
    },
    async addDoneHoursToSlice(taskId, date, hours) {
      // списание происходит внутри completeWorkSession на бэкенде
      return { id: 'noop', taskId, date, plannedHours: 0, doneHours: hours };
    },

    async listPomodoroSessions(from, to) {
      const res = await request<PomodoroSession[]>(`/pomodoro/sessions?from=${from}&to=${to}`);
      return res ?? [];
    },
    async createPomodoroSession(session) {
      return request<PomodoroSession>(`/pomodoro/start`, { method: 'POST', body: JSON.stringify(session) });
    },
    async finishPomodoroSession(id, actualMin) {
      return request<PomodoroSession>(`/pomodoro/${id}/finish`, {
        method: 'POST',
        body: JSON.stringify({ actualMin }),
      });
    },
    async completeWorkSession(id, actualMin) {
      // бэкенд при finish сам списывает часы в задачу и срез
      return this.finishPomodoroSession(id, actualMin);
    },

    async resetToSeed() {
      throw new Error('resetToSeed is not supported by HTTP backend');
    },
  };
}
