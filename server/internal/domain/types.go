package domain

import "time"

type TaskStatus string

const (
	StatusTodo       TaskStatus = "todo"
	StatusInProgress TaskStatus = "in_progress"
	StatusDone       TaskStatus = "done"
	StatusCancelled  TaskStatus = "cancelled"
)

type Category string

const (
	CategoryWork  Category = "work"
	CategoryStudy Category = "study"
	CategoryLife  Category = "life"
)

type Priority int

const (
	PriorityLow      Priority = 1
	PriorityMedium   Priority = 2
	PriorityHigh     Priority = 3
	PriorityCritical Priority = 4
)

type Task struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description,omitempty"`
	Status         TaskStatus `json:"status"`
	Priority       Priority  `json:"priority"`
	Category       Category  `json:"category"`
	EstimateHours  *float64  `json:"estimateHours,omitempty"`
	RemainingHours *float64  `json:"remainingHours,omitempty"`
	StartDate      *string   `json:"startDate,omitempty"`
	Deadline       *string   `json:"deadline,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
	DoneAt         *time.Time `json:"doneAt,omitempty"`
}

type WorkWindow struct {
	ID       string `json:"id"`
	Weekday  int    `json:"weekday"` // 0=вс..6=сб
	StartMin int    `json:"startMin"`
	EndMin   int    `json:"endMin"`
}

type DayCapacity struct {
	Date          string  `json:"date"`
	CapacityHours float64 `json:"capacityHours"`
}

type Settings struct {
	DefaultDailyCapacityHours float64 `json:"defaultDailyCapacityHours"`
	PomodoroWorkMin          int     `json:"pomodoroWorkMin"`
	PomodoroBreakMin         int     `json:"pomodoroBreakMin"`
}

type TaskSlice struct {
	ID           string  `json:"id"`
	TaskID       string  `json:"taskId"`
	Date         string  `json:"date"`
	PlannedHours float64 `json:"plannedHours"`
	DoneHours    float64 `json:"doneHours"`
	Manual       bool    `json:"manual"`
}

type PomodoroSession struct {
	ID         string     `json:"id"`
	TaskID     *string    `json:"taskId,omitempty"`
	StartedAt  time.Time  `json:"startedAt"`
	EndedAt    *time.Time `json:"endedAt,omitempty"`
	Kind       string     `json:"kind"` // work|break
	PlannedMin int        `json:"plannedMin"`
	ActualMin  *int       `json:"actualMin,omitempty"`
}

// --- Входные DTO ---

type TaskInput struct {
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Status         TaskStatus `json:"status,omitempty"`
	Priority       Priority  `json:"priority,omitempty"`
	Category       Category  `json:"category,omitempty"`
	EstimateHours  *float64  `json:"estimateHours,omitempty"`
	RemainingHours *float64  `json:"remainingHours,omitempty"`
	StartDate      *string   `json:"startDate,omitempty"`
	Deadline       *string   `json:"deadline,omitempty"`
}

// TaskPatch: частичное обновление — только непустые (не nil) поля.
type TaskPatch struct {
	Title          *string    `json:"title,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Status         *TaskStatus `json:"status,omitempty"`
	Priority       *Priority  `json:"priority,omitempty"`
	Category       *Category  `json:"category,omitempty"`
	EstimateHours  *float64   `json:"estimateHours,omitempty"`
	RemainingHours *float64   `json:"remainingHours,omitempty"`
	StartDate      *string    `json:"startDate,omitempty"`
	Deadline       *string    `json:"deadline,omitempty"`
}

type SettingsInput struct {
	DefaultDailyCapacityHours *float64 `json:"defaultDailyCapacityHours,omitempty"`
	PomodoroWorkMin          *int     `json:"pomodoroWorkMin,omitempty"`
	PomodoroBreakMin         *int     `json:"pomodoroBreakMin,omitempty"`
}

type WorkWindowInput struct {
	Weekday  int `json:"weekday"`
	StartMin int `json:"startMin"`
	EndMin   int `json:"endMin"`
}

type PlannerSpreadRequest struct {
	TaskID string `json:"taskId"`
}

type PlannerApplyRequest struct {
	TaskID string            `json:"taskId"`
	Slices []TaskSliceInput  `json:"slices"`
}

type TaskSliceInput struct {
	Date         string  `json:"date"`
	PlannedHours float64 `json:"plannedHours"`
	DoneHours    float64 `json:"doneHours"`
	Manual       bool    `json:"manual"`
}

type PomodoroStartRequest struct {
	TaskID    *string `json:"taskId,omitempty"`
	Kind      string  `json:"kind"`
	PlannedMin int    `json:"plannedMin"`
}

type PomodoroFinishRequest struct {
	ActualMin int `json:"actualMin"`
}

// ImportPayload: полный снимок localStorage для переноса в SQLite.
type ImportPayload struct {
	Tasks            []Task            `json:"tasks"`
	Settings         *Settings         `json:"settings,omitempty"`
	WorkWindows      []WorkWindow      `json:"workWindows"`
	DayCapacities    []DayCapacity     `json:"dayCapacities"`
	Slices           []TaskSlice       `json:"slices"`
	PomodoroSessions []PomodoroSession `json:"pomodoroSessions"`
}
