CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority INTEGER NOT NULL DEFAULT 2,
  category TEXT NOT NULL DEFAULT 'life',
  estimate_hours REAL,
  remaining_hours REAL,
  start_date TEXT,
  deadline TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  done_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);

CREATE TABLE IF NOT EXISTS work_windows (
  id TEXT PRIMARY KEY,
  weekday INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  UNIQUE(weekday, start_min)
);

CREATE TABLE IF NOT EXISTS day_capacities (
  date TEXT PRIMARY KEY,
  capacity_hours REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_slices (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  planned_hours REAL NOT NULL,
  done_hours REAL NOT NULL DEFAULT 0,
  UNIQUE(task_id, date)
);

CREATE INDEX IF NOT EXISTS idx_task_slices_date ON task_slices(date);
CREATE INDEX IF NOT EXISTS idx_task_slices_task ON task_slices(task_id);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  kind TEXT NOT NULL,
  planned_min INTEGER NOT NULL,
  actual_min INTEGER
);
