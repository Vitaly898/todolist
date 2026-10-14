package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"todolist/server/internal/domain"

	"github.com/google/uuid"
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func uuidStr() string {
	return uuid.New().String()
}

// --- Tasks ---

func (s *Store) ListTasks(ctx context.Context, status []domain.TaskStatus, priority []int, category []domain.Category, from, to string) ([]domain.Task, error) {
	q := `SELECT id, title, description, status, priority, category, estimate_hours, remaining_hours, start_date, deadline, created_at, updated_at, done_at FROM tasks WHERE 1=1`
	args := []any{}
	if len(status) > 0 {
		placeholders := "?" + strings.Repeat(",?", len(status)-1)
		q += ` AND status IN (` + placeholders + `)`
		for _, st := range status {
			args = append(args, st)
		}
	}
	if len(priority) > 0 {
		placeholders := "?" + strings.Repeat(",?", len(priority)-1)
		q += ` AND priority IN (` + placeholders + `)`
		for _, p := range priority {
			args = append(args, p)
		}
	}
	if len(category) > 0 {
		placeholders := "?" + strings.Repeat(",?", len(category)-1)
		q += ` AND category IN (` + placeholders + `)`
		for _, c := range category {
			args = append(args, c)
		}
	}
	if from != "" && to != "" {
		q += ` AND ((start_date IS NOT NULL AND start_date <= ?) OR (deadline IS NOT NULL AND deadline >= ?))`
		args = append(args, to, from)
	}
	q += ` ORDER BY created_at`

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]domain.Task, 0)
	for rows.Next() {
		var t domain.Task
		var desc, status, category string
		var estimate, remaining *float64
		var start, deadline *string
		var createdAt, updatedAt string
		var doneAt *string
		var priority int

		err := rows.Scan(&t.ID, &t.Title, &desc, &status, &priority, &category, &estimate, &remaining, &start, &deadline, &createdAt, &updatedAt, &doneAt)
		if err != nil {
			return nil, err
		}
		t.Description = desc
		t.Status = domain.TaskStatus(status)
		t.Priority = domain.Priority(priority)
		t.Category = domain.Category(category)
		t.EstimateHours = estimate
		t.RemainingHours = remaining
		t.StartDate = start
		t.Deadline = deadline
		t.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		t.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		if doneAt != nil {
			dt, _ := time.Parse(time.RFC3339, *doneAt)
			t.DoneAt = &dt
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (s *Store) GetTask(ctx context.Context, id string) (*domain.Task, error) {
	row := s.db.QueryRowContext(ctx, `SELECT id, title, description, status, priority, category, estimate_hours, remaining_hours, start_date, deadline, created_at, updated_at, done_at FROM tasks WHERE id = ?`, id)
	var t domain.Task
	var desc, status, category string
	var estimate, remaining *float64
	var start, deadline *string
	var createdAt, updatedAt string
	var doneAt *string
	var priority int
	err := row.Scan(&t.ID, &t.Title, &desc, &status, &priority, &category, &estimate, &remaining, &start, &deadline, &createdAt, &updatedAt, &doneAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t.Description = desc
	t.Status = domain.TaskStatus(status)
	t.Priority = domain.Priority(priority)
	t.Category = domain.Category(category)
	t.EstimateHours = estimate
	t.RemainingHours = remaining
	t.StartDate = start
	t.Deadline = deadline
	t.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	t.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	if doneAt != nil {
		dt, _ := time.Parse(time.RFC3339, *doneAt)
		t.DoneAt = &dt
	}
	return &t, nil
}

func (s *Store) CreateTask(ctx context.Context, input domain.TaskInput) (*domain.Task, error) {
	now := nowRFC3339()
	t := domain.Task{
		ID:             uuidStr(),
		Title:          input.Title,
		Description:    input.Description,
		Status:         input.Status,
		Priority:       input.Priority,
		Category:       input.Category,
		EstimateHours:  input.EstimateHours,
		RemainingHours: input.RemainingHours,
		StartDate:      input.StartDate,
		Deadline:       input.Deadline,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if t.Status == "" {
		t.Status = domain.StatusTodo
	}
	if t.Priority == 0 {
		t.Priority = domain.PriorityMedium
	}
	if t.Category == "" {
		t.Category = domain.CategoryLife
	}
	if t.RemainingHours == nil {
		t.RemainingHours = t.EstimateHours
	}
	if t.StartDate == nil {
		sd := time.Now().Format("2006-01-02")
		t.StartDate = &sd
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO tasks(id, title, description, status, priority, category, estimate_hours, remaining_hours, start_date, deadline, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
	`, t.ID, t.Title, t.Description, t.Status, t.Priority, t.Category, t.EstimateHours, t.RemainingHours, t.StartDate, t.Deadline, now, now)
	if err != nil {
		return nil, err
	}
	return s.GetTask(ctx, t.ID)
}

func (s *Store) UpdateTask(ctx context.Context, id string, patch domain.TaskPatch) (*domain.Task, error) {
	existing, err := s.GetTask(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, nil
	}

	t := *existing
	if patch.Title != nil {
		t.Title = *patch.Title
	}
	if patch.Description != nil {
		t.Description = *patch.Description
	}
	if patch.Status != nil {
		t.Status = *patch.Status
	}
	if patch.Priority != nil {
		t.Priority = *patch.Priority
	}
	if patch.Category != nil {
		t.Category = *patch.Category
	}
	if patch.EstimateHours != nil {
		t.EstimateHours = patch.EstimateHours
	}
	if patch.RemainingHours != nil {
		t.RemainingHours = patch.RemainingHours
	}
	if patch.StartDate != nil {
		t.StartDate = patch.StartDate
	}
	if patch.Deadline != nil {
		t.Deadline = patch.Deadline
	}
	t.UpdatedAt = time.Now().UTC()
	if patch.Status != nil {
		if *patch.Status == domain.StatusDone && existing.Status != domain.StatusDone {
			now := time.Now().UTC()
			t.DoneAt = &now
		} else if *patch.Status != domain.StatusDone && existing.Status == domain.StatusDone {
			t.DoneAt = nil
		}
	}

	var doneAt *string
	if t.DoneAt != nil {
		s := t.DoneAt.Format(time.RFC3339)
		doneAt = &s
	}

	_, err = s.db.ExecContext(ctx, `
		UPDATE tasks SET title=?, description=?, status=?, priority=?, category=?, estimate_hours=?, remaining_hours=?, start_date=?, deadline=?, updated_at=?, done_at=?
		WHERE id=?
	`, t.Title, t.Description, t.Status, t.Priority, t.Category, t.EstimateHours, t.RemainingHours, t.StartDate, t.Deadline, nowRFC3339(), doneAt, id)
	if err != nil {
		return nil, err
	}
	return s.GetTask(ctx, id)
}

func (s *Store) DeleteTask(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ?`, id)
	return err
}

// --- Settings ---

func (s *Store) GetSettings(ctx context.Context) (domain.Settings, error) {
	settings := domain.Settings{
		DefaultDailyCapacityHours: 4,
		PomodoroWorkMin:          25,
		PomodoroBreakMin:         5,
	}
	rows, err := s.db.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return settings, err
	}
	defer rows.Close()
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return settings, err
		}
		switch key {
		case "default_daily_capacity_hours":
			fmt.Sscanf(value, "%f", &settings.DefaultDailyCapacityHours)
		case "pomodoro_work_min":
			fmt.Sscanf(value, "%d", &settings.PomodoroWorkMin)
		case "pomodoro_break_min":
			fmt.Sscanf(value, "%d", &settings.PomodoroBreakMin)
		}
	}
	return settings, rows.Err()
}

func (s *Store) UpdateSettings(ctx context.Context, input domain.SettingsInput) (domain.Settings, error) {
	if input.DefaultDailyCapacityHours != nil {
		if _, err := s.db.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES('default_daily_capacity_hours', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, *input.DefaultDailyCapacityHours); err != nil {
			return domain.Settings{}, err
		}
	}
	if input.PomodoroWorkMin != nil {
		if _, err := s.db.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES('pomodoro_work_min', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, *input.PomodoroWorkMin); err != nil {
			return domain.Settings{}, err
		}
	}
	if input.PomodoroBreakMin != nil {
		if _, err := s.db.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES('pomodoro_break_min', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, *input.PomodoroBreakMin); err != nil {
			return domain.Settings{}, err
		}
	}
	return s.GetSettings(ctx)
}

// --- Work windows ---

func (s *Store) ListWorkWindows(ctx context.Context) ([]domain.WorkWindow, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, weekday, start_min, end_min FROM work_windows ORDER BY weekday, start_min`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	windows := make([]domain.WorkWindow, 0)
	for rows.Next() {
		var w domain.WorkWindow
		if err := rows.Scan(&w.ID, &w.Weekday, &w.StartMin, &w.EndMin); err != nil {
			return nil, err
		}
		windows = append(windows, w)
	}
	return windows, rows.Err()
}

func (s *Store) SetWorkWindows(ctx context.Context, windows []domain.WorkWindowInput) ([]domain.WorkWindow, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM work_windows`); err != nil {
		return nil, err
	}
	for _, w := range windows {
		if _, err := tx.ExecContext(ctx, `INSERT INTO work_windows(id, weekday, start_min, end_min) VALUES(?,?,?,?)`, uuidStr(), w.Weekday, w.StartMin, w.EndMin); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.ListWorkWindows(ctx)
}

// --- Day capacities ---

func (s *Store) ListDayCapacities(ctx context.Context, from, to string) ([]domain.DayCapacity, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT date, capacity_hours FROM day_capacities WHERE date >= ? AND date <= ? ORDER BY date`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	caps := make([]domain.DayCapacity, 0)
	for rows.Next() {
		var c domain.DayCapacity
		if err := rows.Scan(&c.Date, &c.CapacityHours); err != nil {
			return nil, err
		}
		caps = append(caps, c)
	}
	return caps, rows.Err()
}

func (s *Store) UpsertDayCapacity(ctx context.Context, cap domain.DayCapacity) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO day_capacities(date, capacity_hours) VALUES(?, ?) ON CONFLICT(date) DO UPDATE SET capacity_hours=excluded.capacity_hours`, cap.Date, cap.CapacityHours)
	return err
}

// --- Task slices ---

func (s *Store) ListSlices(ctx context.Context, from, to string) ([]domain.TaskSlice, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, task_id, date, planned_hours, done_hours, manual FROM task_slices WHERE date >= ? AND date <= ? ORDER BY date`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	slices := make([]domain.TaskSlice, 0)
	for rows.Next() {
		var sl domain.TaskSlice
		if err := rows.Scan(&sl.ID, &sl.TaskID, &sl.Date, &sl.PlannedHours, &sl.DoneHours, &sl.Manual); err != nil {
			return nil, err
		}
		slices = append(slices, sl)
	}
	return slices, rows.Err()
}

func (s *Store) ReplaceTaskSlices(ctx context.Context, taskID string, slices []domain.TaskSliceInput) ([]domain.TaskSlice, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM task_slices WHERE task_id = ?`, taskID); err != nil {
		return nil, err
	}
	for _, sl := range slices {
		if _, err := tx.ExecContext(ctx, `INSERT INTO task_slices(id, task_id, date, planned_hours, done_hours, manual) VALUES(?,?,?,?,?,?)`, uuidStr(), taskID, sl.Date, sl.PlannedHours, sl.DoneHours, sl.Manual); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.ListSlices(ctx, "0000-01-01", "9999-12-31")
}

func (s *Store) AddDoneHoursToSlice(ctx context.Context, taskID, date string, hours float64) (*domain.TaskSlice, error) {
	var existing domain.TaskSlice
	row := s.db.QueryRowContext(ctx, `SELECT id, task_id, date, planned_hours, done_hours, manual FROM task_slices WHERE task_id = ? AND date = ?`, taskID, date)
	err := row.Scan(&existing.ID, &existing.TaskID, &existing.Date, &existing.PlannedHours, &existing.DoneHours, &existing.Manual)
	if err == sql.ErrNoRows {
		_, err := s.db.ExecContext(ctx, `INSERT INTO task_slices(id, task_id, date, planned_hours, done_hours) VALUES(?,?,?,0,?)`, uuidStr(), taskID, date, hours)
		if err != nil {
			return nil, err
		}
		return s.getSlice(ctx, taskID, date)
	}
	if err != nil {
		return nil, err
	}
	newDone := existing.DoneHours + hours
	_, err = s.db.ExecContext(ctx, `UPDATE task_slices SET done_hours = ? WHERE id = ?`, newDone, existing.ID)
	if err != nil {
		return nil, err
	}
	existing.DoneHours = newDone
	return &existing, nil
}

func (s *Store) getSlice(ctx context.Context, taskID, date string) (*domain.TaskSlice, error) {
	row := s.db.QueryRowContext(ctx, `SELECT id, task_id, date, planned_hours, done_hours, manual FROM task_slices WHERE task_id = ? AND date = ?`, taskID, date)
	var sl domain.TaskSlice
	if err := row.Scan(&sl.ID, &sl.TaskID, &sl.Date, &sl.PlannedHours, &sl.DoneHours, &sl.Manual); err != nil {
		return nil, err
	}
	return &sl, nil
}

// --- Pomodoro ---

func (s *Store) ListPomodoroSessions(ctx context.Context, from, to string) ([]domain.PomodoroSession, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, task_id, started_at, ended_at, kind, planned_min, actual_min FROM pomodoro_sessions WHERE started_at >= ? AND started_at <= ? ORDER BY started_at DESC`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sessions := make([]domain.PomodoroSession, 0)
	for rows.Next() {
		var ps domain.PomodoroSession
		var taskID *string
		var startedAt string
		var endedAt *string
		var actualMin *int
		if err := rows.Scan(&ps.ID, &taskID, &startedAt, &endedAt, &ps.Kind, &ps.PlannedMin, &actualMin); err != nil {
			return nil, err
		}
		ps.TaskID = taskID
		ps.StartedAt, _ = time.Parse(time.RFC3339, startedAt)
		if endedAt != nil {
			et, _ := time.Parse(time.RFC3339, *endedAt)
			ps.EndedAt = &et
		}
		ps.ActualMin = actualMin
		sessions = append(sessions, ps)
	}
	return sessions, rows.Err()
}

func (s *Store) CreatePomodoroSession(ctx context.Context, input domain.PomodoroStartRequest) (*domain.PomodoroSession, error) {
	id := uuidStr()
	startedAt := nowRFC3339()
	_, err := s.db.ExecContext(ctx, `INSERT INTO pomodoro_sessions(id, task_id, started_at, kind, planned_min) VALUES(?,?,?,?,?)`, id, input.TaskID, startedAt, input.Kind, input.PlannedMin)
	if err != nil {
		return nil, err
	}
	return &domain.PomodoroSession{
		ID:         id,
		TaskID:     input.TaskID,
		StartedAt:  time.Now().UTC(),
		Kind:       input.Kind,
		PlannedMin: input.PlannedMin,
	}, nil
}

func (s *Store) FinishPomodoroSession(ctx context.Context, id string, actualMin int) (*domain.PomodoroSession, error) {
	endedAt := nowRFC3339()
	_, err := s.db.ExecContext(ctx, `UPDATE pomodoro_sessions SET ended_at = ?, actual_min = ? WHERE id = ?`, endedAt, actualMin, id)
	if err != nil {
		return nil, err
	}
	row := s.db.QueryRowContext(ctx, `SELECT id, task_id, started_at, ended_at, kind, planned_min, actual_min FROM pomodoro_sessions WHERE id = ?`, id)
	var ps domain.PomodoroSession
	var taskID *string
	var startedAt string
	var endedAtStr *string
	var actualMinPtr *int
	if err := row.Scan(&ps.ID, &taskID, &startedAt, &endedAtStr, &ps.Kind, &ps.PlannedMin, &actualMinPtr); err != nil {
		return nil, err
	}
	ps.TaskID = taskID
	ps.StartedAt, _ = time.Parse(time.RFC3339, startedAt)
	if endedAtStr != nil {
		et, _ := time.Parse(time.RFC3339, *endedAtStr)
		ps.EndedAt = &et
	}
	ps.ActualMin = actualMinPtr
	return &ps, nil
}

// --- Calendar ---

func (s *Store) Calendar(ctx context.Context, from, to string) (map[string]any, error) {
	tasks, err := s.ListTasks(ctx, nil, nil, nil, from, to)
	if err != nil {
		return nil, err
	}
	slices, err := s.ListSlices(ctx, from, to)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"tasks":  tasks,
		"slices": slices,
	}, nil
}

// --- Import ---

// Import переносит снимок localStorage в SQLite (INSERT OR IGNORE — не затирает существующее).
func (s *Store) Import(ctx context.Context, payload domain.ImportPayload) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, t := range payload.Tasks {
		var doneAt *string
		if t.DoneAt != nil {
			s := t.DoneAt.Format(time.RFC3339)
			doneAt = &s
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT OR IGNORE INTO tasks(id, title, description, status, priority, category, estimate_hours, remaining_hours, start_date, deadline, created_at, updated_at, done_at)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
		`, t.ID, t.Title, t.Description, t.Status, t.Priority, t.Category, t.EstimateHours, t.RemainingHours, t.StartDate, t.Deadline,
			t.CreatedAt.Format(time.RFC3339), t.UpdatedAt.Format(time.RFC3339), doneAt); err != nil {
			return err
		}
	}

	for _, w := range payload.WorkWindows {
		if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO work_windows(id, weekday, start_min, end_min) VALUES(?,?,?,?)`, w.ID, w.Weekday, w.StartMin, w.EndMin); err != nil {
			return err
		}
	}

	for _, c := range payload.DayCapacities {
		if _, err := tx.ExecContext(ctx, `INSERT INTO day_capacities(date, capacity_hours) VALUES(?, ?) ON CONFLICT(date) DO UPDATE SET capacity_hours=excluded.capacity_hours`, c.Date, c.CapacityHours); err != nil {
			return err
		}
	}

	for _, sl := range payload.Slices {
		if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO task_slices(id, task_id, date, planned_hours, done_hours, manual) VALUES(?,?,?,?,?,?)`, sl.ID, sl.TaskID, sl.Date, sl.PlannedHours, sl.DoneHours, sl.Manual); err != nil {
			return err
		}
	}

	for _, ps := range payload.PomodoroSessions {
		var endedAt *string
		if ps.EndedAt != nil {
			s := ps.EndedAt.Format(time.RFC3339)
			endedAt = &s
		}
		if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO pomodoro_sessions(id, task_id, started_at, ended_at, kind, planned_min, actual_min) VALUES(?,?,?,?,?,?,?)`,
			ps.ID, ps.TaskID, ps.StartedAt.Format(time.RFC3339), endedAt, ps.Kind, ps.PlannedMin, ps.ActualMin); err != nil {
			return err
		}
	}

	if payload.Settings != nil {
		if _, err := tx.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES('default_daily_capacity_hours', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, payload.Settings.DefaultDailyCapacityHours); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES('pomodoro_work_min', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, payload.Settings.PomodoroWorkMin); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES('pomodoro_break_min', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, payload.Settings.PomodoroBreakMin); err != nil {
			return err
		}
	}

	return tx.Commit()
}
