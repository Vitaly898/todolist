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

import { request, requestJson } from './httpClient';

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
      return requestJson<Task>(`/tasks`, 'POST', input);
    },
    async updateTask(id, patch) {
      return requestJson<Task>(`/tasks/${id}`, 'PATCH', patch);
    },
    async deleteTask(id) {
      await request<void>(`/tasks/${id}`, { method: 'DELETE' });
    },

    async getSettings() {
      return request<Settings>(`/settings`);
    },
    async updateSettings(patch) {
      return requestJson<Settings>(`/settings`, 'PUT', patch);
    },

    async listWorkWindows() {
      const res = await request<WorkWindow[]>(`/schedule/windows`);
      return res ?? [];
    },
    async setWorkWindows(windows) {
      return requestJson<WorkWindow[]>(`/schedule/windows`, 'PUT', windows);
    },

    async listDayCapacities(from, to) {
      const res = await request<DayCapacity[]>(`/schedule/capacity?from=${from}&to=${to}`);
      return res ?? [];
    },
    async upsertDayCapacity(capacity) {
      await requestJson<void>(`/schedule/capacity`, 'PUT', capacity);
    },

    async listSlices(from, to) {
      const res = await request<CalendarResponse>(`/calendar?from=${from}&to=${to}`);
      return res.slices ?? [];
    },
    async replaceTaskSlices(taskId, slices) {
      return requestJson<TaskSlice[]>(`/planner/apply`, 'POST', { taskId, slices });
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
      return requestJson<PomodoroSession>(`/pomodoro/start`, 'POST', session);
    },
    async finishPomodoroSession(id, actualMin) {
      return requestJson<PomodoroSession>(`/pomodoro/${id}/finish`, 'POST', { actualMin });
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
