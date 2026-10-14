import type {
  DayCapacity,
  PomodoroSession,
  Settings,
  Task,
  TaskFilters,
  TaskInput,
  TaskPatch,
  TaskSlice,
  WorkWindow,
} from './types';

/**
 * Единый интерфейс доступа к данным (PLAN.md §2).
 * Сейчас реализован на localStorage (local/localRepository.ts),
 * в фазе 7 появится http/httpRepository.ts — UI меняться не должен.
 */
export interface Repository {
  // Задачи
  listTasks(filters?: TaskFilters): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Настройки
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  // Рабочие окна и ёмкость дней
  listWorkWindows(): Promise<WorkWindow[]>;
  setWorkWindows(windows: Omit<WorkWindow, 'id'>[]): Promise<WorkWindow[]>;
  listDayCapacities(from: string, to: string): Promise<DayCapacity[]>;
  upsertDayCapacity(capacity: DayCapacity): Promise<void>;

  // Срезы планирования (фаза 3)
  listSlices(from: string, to: string): Promise<TaskSlice[]>;
  replaceTaskSlices(taskId: string, slices: Omit<TaskSlice, 'id' | 'taskId'>[]): Promise<TaskSlice[]>;
  /** Списать выполненные часы в срез (помидоро, фаза 4). Создаёт срез, если его нет. */
  addDoneHoursToSlice(taskId: string, date: string, hours: number): Promise<TaskSlice>;

  // Помидоро (фаза 4)
  listPomodoroSessions(from: string, to: string): Promise<PomodoroSession[]>;
  createPomodoroSession(
    session: Omit<PomodoroSession, 'id' | 'startedAt' | 'endedAt'>,
  ): Promise<PomodoroSession>;
  finishPomodoroSession(id: string, actualMin: number): Promise<PomodoroSession>;
  /**
   * Завершить work-сессию и списать часы в задачу/срез.
   * Локальная реализация делает это сама; HTTP-реализация делегирует бэкенду.
   */
  completeWorkSession(id: string, actualMin: number): Promise<PomodoroSession>;

  // Сервисное
  resetToSeed(): Promise<void>;
}
