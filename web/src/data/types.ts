// Доменные типы — единственный источник правды для enum'ов и сущностей (см. PLAN.md §3).
// Время в UI и хранилище — часы (шаг 0.5). Даты — ISO 'YYYY-MM-DD', timestamp — RFC3339.

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type Category = 'work' | 'study' | 'life';
export type Priority = 1 | 2 | 3 | 4; // 1=low 2=medium 3=high 4=critical

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  category: Category;
  estimateHours?: number;
  remainingHours?: number;
  deadline?: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD, не раньше какого дня планировать
  createdAt: string;
  updatedAt: string;
  doneAt?: string;
}

export interface WorkWindow {
  id: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=вс..6=сб
  startMin: number; // минуты от полуночи, напр. 600 = 10:00
  endMin: number;
}

export interface DayCapacity {
  date: string; // YYYY-MM-DD
  capacityHours: number;
}

export interface Settings {
  defaultDailyCapacityHours: number;
  pomodoroWorkMin: number;
  pomodoroBreakMin: number;
}

export interface TaskSlice {
  id: string;
  taskId: string;
  date: string; // YYYY-MM-DD, unique(taskId, date)
  plannedHours: number;
  doneHours: number;
  /** true = план задан вручную через «Размазать»; replan такие срезы не трогает */
  manual?: boolean;
}

export interface PomodoroSession {
  id: string;
  taskId?: string;
  startedAt: string;
  endedAt?: string;
  kind: 'work' | 'break';
  plannedMin: number;
  actualMin?: number;
}

// --- Ввод/фильтры ---

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  category?: Category;
  estimateHours?: number;
  remainingHours?: number;
  deadline?: string;
  startDate?: string;
}

export type TaskPatch = Partial<TaskInput>;

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  category?: Category[];
  from?: string; // YYYY-MM-DD — задачи/срезы не раньше
  to?: string; // YYYY-MM-DD
}

// --- Справочники для UI ---

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменено',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  work: 'Работа',
  study: 'Учёба',
  life: 'Быт',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: 'Низкий',
  2: 'Средний',
  3: 'Высокий',
  4: 'Критический',
};

export const DEFAULT_SETTINGS: Settings = {
  defaultDailyCapacityHours: 4,
  pomodoroWorkMin: 25,
  pomodoroBreakMin: 5,
};
