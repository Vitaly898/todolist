package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"todolist/server/internal/domain"
	"todolist/server/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	store *store.Store
}

func NewServer(store *store.Store) *Server {
	return &Server{store: store}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", s.health)

		r.Route("/tasks", func(r chi.Router) {
			r.Get("/", s.listTasks)
			r.Post("/", s.createTask)
			r.Route("/{taskId}", func(r chi.Router) {
				r.Get("/", s.getTask)
				r.Patch("/", s.updateTask)
				r.Delete("/", s.deleteTask)
			})
		})

		r.Route("/calendar", func(r chi.Router) {
			r.Get("/", s.calendar)
		})

		r.Route("/settings", func(r chi.Router) {
			r.Get("/", s.getSettings)
			r.Put("/", s.updateSettings)
		})

		r.Route("/schedule", func(r chi.Router) {
			r.Get("/windows", s.listWorkWindows)
			r.Put("/windows", s.setWorkWindows)
			r.Get("/capacity", s.listDayCapacities)
			r.Put("/capacity", s.upsertDayCapacity)
		})

		r.Route("/planner", func(r chi.Router) {
			r.Post("/spread/{taskId}", s.spreadTask)
			r.Post("/apply", s.applyPlan)
			r.Post("/replan", s.replan)
		})

		r.Route("/pomodoro", func(r chi.Router) {
			r.Post("/start", s.startPomodoro)
			r.Post("/{sessionId}/finish", s.finishPomodoro)
			r.Get("/sessions", s.listPomodoroSessions)
			r.Get("/stats", s.pomodoroStats)
		})

		r.Post("/assistant/suggest-deadline", s.suggestDeadline)

		r.Post("/import", s.importData)
	})

	return r
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body")
		return err
	}
	return nil
}

func queryCSV(r *http.Request, key string) []string {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return nil
	}
	return strings.Split(raw, ",")
}

func parseStatusList(raw []string) []domain.TaskStatus {
	if len(raw) == 0 {
		return nil
	}
	out := make([]domain.TaskStatus, 0, len(raw))
	for _, s := range raw {
		out = append(out, domain.TaskStatus(s))
	}
	return out
}

func parseIntList(raw []string) []int {
	if len(raw) == 0 {
		return nil
	}
	out := make([]int, 0, len(raw))
	for _, s := range raw {
		if n, err := strconv.Atoi(s); err == nil {
			out = append(out, n)
		}
	}
	return out
}

func parseCategoryList(raw []string) []domain.Category {
	if len(raw) == 0 {
		return nil
	}
	out := make([]domain.Category, 0, len(raw))
	for _, s := range raw {
		out = append(out, domain.Category(s))
	}
	return out
}

// --- Tasks ---

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	status := parseStatusList(queryCSV(r, "status"))
	priority := parseIntList(queryCSV(r, "priority"))
	category := parseCategoryList(queryCSV(r, "category"))
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	tasks, err := s.store.ListTasks(r.Context(), status, priority, category, from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	var input domain.TaskInput
	if decodeJSON(w, r, &input) != nil {
		return
	}
	if strings.TrimSpace(input.Title) == "" {
		writeError(w, http.StatusBadRequest, "validation", "title is required")
		return
	}
	task, err := s.store.CreateTask(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (s *Server) getTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "taskId")
	task, err := s.store.GetTask(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "not_found", "task not found")
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "taskId")
	var input domain.TaskPatch
	if decodeJSON(w, r, &input) != nil {
		return
	}
	task, err := s.store.UpdateTask(r.Context(), id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "not_found", "task not found")
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "taskId")
	if err := s.store.DeleteTask(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Calendar ---

func (s *Server) calendar(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		writeError(w, http.StatusBadRequest, "validation", "from and to are required")
		return
	}
	data, err := s.store.Calendar(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, data)
}

// --- Settings ---

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.store.GetSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (s *Server) updateSettings(w http.ResponseWriter, r *http.Request) {
	var input domain.SettingsInput
	if decodeJSON(w, r, &input) != nil {
		return
	}
	settings, err := s.store.UpdateSettings(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

// --- Work windows ---

func (s *Server) listWorkWindows(w http.ResponseWriter, r *http.Request) {
	windows, err := s.store.ListWorkWindows(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, windows)
}

func (s *Server) setWorkWindows(w http.ResponseWriter, r *http.Request) {
	var input []domain.WorkWindowInput
	if decodeJSON(w, r, &input) != nil {
		return
	}
	windows, err := s.store.SetWorkWindows(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, windows)
}

// --- Day capacities ---

func (s *Server) listDayCapacities(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		writeError(w, http.StatusBadRequest, "validation", "from and to are required")
		return
	}
	caps, err := s.store.ListDayCapacities(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, caps)
}

func (s *Server) upsertDayCapacity(w http.ResponseWriter, r *http.Request) {
	var input domain.DayCapacity
	if decodeJSON(w, r, &input) != nil {
		return
	}
	if input.Date == "" {
		writeError(w, http.StatusBadRequest, "validation", "date is required")
		return
	}
	if err := s.store.UpsertDayCapacity(r.Context(), input); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Planner ---

func (s *Server) plannerContext(ctx context.Context, from, to string) (domain.PlannerContext, error) {
	tasks, err := s.store.ListTasks(ctx, nil, nil, nil, "", "")
	if err != nil {
		return domain.PlannerContext{}, err
	}
	slices, err := s.store.ListSlices(ctx, from, to)
	if err != nil {
		return domain.PlannerContext{}, err
	}
	settings, err := s.store.GetSettings(ctx)
	if err != nil {
		return domain.PlannerContext{}, err
	}
	windows, err := s.store.ListWorkWindows(ctx)
	if err != nil {
		return domain.PlannerContext{}, err
	}
	caps, err := s.store.ListDayCapacities(ctx, from, to)
	if err != nil {
		return domain.PlannerContext{}, err
	}
	return domain.PlannerContext{
		Tasks:         tasks,
		Slices:        slices,
		Settings:      settings,
		WorkWindows:   windows,
		DayCapacities: caps,
		Today:         timeNowDate(),
	}, nil
}

func timeNowDate() string {
	return time.Now().Format("2006-01-02")
}

func (s *Server) spreadTask(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "taskId")
	task, err := s.store.GetTask(r.Context(), taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "not_found", "task not found")
		return
	}
	ctx, err := s.plannerContext(r.Context(), timeNowDate(), time.Now().AddDate(0, 0, 90).Format("2006-01-02"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	res := domain.SpreadTask(*task, ctx, nil)
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) applyPlan(w http.ResponseWriter, r *http.Request) {
	var input domain.PlannerApplyRequest
	if decodeJSON(w, r, &input) != nil {
		return
	}
	if input.TaskID == "" {
		writeError(w, http.StatusBadRequest, "validation", "taskId is required")
		return
	}
	slices, err := s.store.ReplaceTaskSlices(r.Context(), input.TaskID, input.Slices)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, slices)
}

func (s *Server) replan(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		from = timeNowDate()
		to = time.Now().AddDate(0, 0, 90).Format("2006-01-02")
	}
	ctx, err := s.plannerContext(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	plans := domain.Replan(ctx)
	for taskID, plan := range plans {
		if _, err := s.store.ReplaceTaskSlices(r.Context(), taskID, plan.Slices); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, plans)
}

// --- Pomodoro ---

func (s *Server) startPomodoro(w http.ResponseWriter, r *http.Request) {
	var input domain.PomodoroStartRequest
	if decodeJSON(w, r, &input) != nil {
		return
	}
	if input.Kind != "work" && input.Kind != "break" {
		writeError(w, http.StatusBadRequest, "validation", "kind must be work or break")
		return
	}
	session, err := s.store.CreatePomodoroSession(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, session)
}

func (s *Server) finishPomodoro(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionId")
	var input domain.PomodoroFinishRequest
	if decodeJSON(w, r, &input) != nil {
		return
	}
	session, err := s.store.FinishPomodoroSession(r.Context(), sessionID, input.ActualMin)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not_found", "session not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}

	// списываем часы в задачу и срез
	if session.TaskID != nil && session.Kind == "work" {
		task, err := s.store.GetTask(r.Context(), *session.TaskID)
		if err == nil && task != nil && task.RemainingHours != nil {
			hours := math.Round(float64(input.ActualMin)/60.0*100) / 100
			newRemaining := *task.RemainingHours - hours
			if newRemaining < 0 {
				newRemaining = 0
			}
			_, _ = s.store.UpdateTask(r.Context(), task.ID, domain.TaskPatch{
				RemainingHours: &newRemaining,
			})
			_, _ = s.store.AddDoneHoursToSlice(r.Context(), task.ID, timeNowDate(), hours)
		}
	}

	writeJSON(w, http.StatusOK, session)
}

func (s *Server) listPomodoroSessions(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		writeError(w, http.StatusBadRequest, "validation", "from and to are required")
		return
	}
	sessions, err := s.store.ListPomodoroSessions(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, sessions)
}

func (s *Server) pomodoroStats(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		writeError(w, http.StatusBadRequest, "validation", "from and to are required")
		return
	}
	sessions, err := s.store.ListPomodoroSessions(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	var workMin, breakMin int
	for _, ps := range sessions {
		if ps.ActualMin == nil {
			continue
		}
		if ps.Kind == "work" {
			workMin += *ps.ActualMin
		} else {
			breakMin += *ps.ActualMin
		}
	}
	writeJSON(w, http.StatusOK, map[string]int{"workMin": workMin, "breakMin": breakMin})
}

// --- Import ---

func (s *Server) importData(w http.ResponseWriter, r *http.Request) {
	var payload domain.ImportPayload
	if decodeJSON(w, r, &payload) != nil {
		return
	}
	if err := s.store.Import(r.Context(), payload); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"importedTasks":    len(payload.Tasks),
		"importedSlices":   len(payload.Slices),
		"importedSessions": len(payload.PomodoroSessions),
	})
}

// --- Assistant ---

func (s *Server) suggestDeadline(w http.ResponseWriter, r *http.Request) {
	var input domain.TaskInput
	if decodeJSON(w, r, &input) != nil {
		return
	}
	if input.EstimateHours == nil || *input.EstimateHours <= 0 {
		writeError(w, http.StatusBadRequest, "validation", "estimateHours is required")
		return
	}
	if input.StartDate == nil || *input.StartDate == "" {
		writeError(w, http.StatusBadRequest, "validation", "startDate is required")
		return
	}
	ctx, err := s.plannerContext(r.Context(), timeNowDate(), time.Now().AddDate(0, 0, 90).Format("2006-01-02"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}

	task := domain.Task{
		Title:          input.Title,
		Description:    input.Description,
		Status:         input.Status,
		Priority:       input.Priority,
		Category:       input.Category,
		EstimateHours:  input.EstimateHours,
		RemainingHours: input.EstimateHours,
		StartDate:      input.StartDate,
		Deadline:       input.Deadline,
	}
	if task.Status == "" {
		task.Status = domain.StatusTodo
	}
	if task.Priority == 0 {
		task.Priority = domain.PriorityMedium
	}
	if task.Category == "" {
		task.Category = domain.CategoryLife
	}

	res := domain.SuggestDeadline(task, ctx)
	if res == nil {
		writeError(w, http.StatusNotFound, "not_found", "no fitting deadline found")
		return
	}
	writeJSON(w, http.StatusOK, res)
}
