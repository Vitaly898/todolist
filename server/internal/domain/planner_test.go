package domain

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestSpreadTaskEven(t *testing.T) {
	settings := Settings{DefaultDailyCapacityHours: 4, PomodoroWorkMin: 25, PomodoroBreakMin: 5}
	windows := []WorkWindow{
		{ID: "1", Weekday: 1, StartMin: 600, EndMin: 1140},
		{ID: "2", Weekday: 2, StartMin: 600, EndMin: 1140},
		{ID: "3", Weekday: 3, StartMin: 600, EndMin: 1140},
		{ID: "4", Weekday: 4, StartMin: 600, EndMin: 1140},
		{ID: "5", Weekday: 5, StartMin: 600, EndMin: 1140},
	}
	estimate := 5.0
	remaining := 5.0
	start := "2026-08-24"
	deadline := "2026-09-07"
	createdAt, _ := time.Parse(time.RFC3339, "2026-08-24T00:00:00Z")
	task := Task{
		ID:             "t1",
		Title:          "Test",
		Status:         StatusTodo,
		Priority:       PriorityMedium,
		Category:       CategoryWork,
		EstimateHours:  &estimate,
		RemainingHours: &remaining,
		StartDate:      &start,
		Deadline:       &deadline,
		CreatedAt:      createdAt,
		UpdatedAt:      createdAt,
	}
	ctx := PlannerContext{
		Tasks:         nil,
		Slices:        nil,
		Settings:      settings,
		WorkWindows:   windows,
		DayCapacities: nil,
		Today:         "2026-08-24",
	}

	res := SpreadTask(task, ctx, nil)
	if res.OverflowHours != 0 {
		t.Fatalf("expected no overflow, got %v", res.OverflowHours)
	}
	total := 0.0
	for _, s := range res.Slices {
		total += s.PlannedHours
		if s.PlannedHours > 4 {
			t.Fatalf("day %s exceeds capacity: %v", s.Date, s.PlannedHours)
		}
	}
	if math.Abs(total-5) > 1e-9 {
		t.Fatalf("expected total 5h, got %v", total)
	}
}

func TestSpreadTaskOverflow(t *testing.T) {
	settings := Settings{DefaultDailyCapacityHours: 1, PomodoroWorkMin: 25, PomodoroBreakMin: 5}
	windows := []WorkWindow{{ID: "1", Weekday: 1, StartMin: 600, EndMin: 700}}
	estimate := 10.0
	remaining := 10.0
	start := "2026-08-24"
	deadline := "2026-08-24"
	createdAt, _ := time.Parse(time.RFC3339, "2026-08-24T00:00:00Z")
	task := Task{
		ID:             "t1",
		Title:          "Big",
		Status:         StatusTodo,
		Priority:       PriorityMedium,
		Category:       CategoryWork,
		EstimateHours:  &estimate,
		RemainingHours: &remaining,
		StartDate:      &start,
		Deadline:       &deadline,
		CreatedAt:      createdAt,
		UpdatedAt:      createdAt,
	}
	ctx := PlannerContext{
		Tasks:         nil,
		Slices:        nil,
		Settings:      settings,
		WorkWindows:   windows,
		DayCapacities: nil,
		Today:         "2026-08-24",
	}
	res := SpreadTask(task, ctx, nil)
	if res.OverflowHours == 0 {
		t.Fatal("expected overflow")
	}
}

func TestReplan(t *testing.T) {
	settings := Settings{DefaultDailyCapacityHours: 4, PomodoroWorkMin: 25, PomodoroBreakMin: 5}
	windows := []WorkWindow{
		{ID: "1", Weekday: 1, StartMin: 600, EndMin: 1140},
		{ID: "2", Weekday: 2, StartMin: 600, EndMin: 1140},
		{ID: "3", Weekday: 3, StartMin: 600, EndMin: 1140},
		{ID: "4", Weekday: 4, StartMin: 600, EndMin: 1140},
		{ID: "5", Weekday: 5, StartMin: 600, EndMin: 1140},
	}
	estimate := 4.0
	remaining := 4.0
	start := "2026-08-24"
	deadline := "2026-09-07"
	createdAt, _ := time.Parse(time.RFC3339, "2026-08-24T00:00:00Z")
	a := Task{ID: "a", Title: "A", Status: StatusTodo, Priority: PriorityCritical, Category: CategoryWork, EstimateHours: &estimate, RemainingHours: &remaining, StartDate: &start, Deadline: &deadline, CreatedAt: createdAt, UpdatedAt: createdAt}
	b := Task{ID: "b", Title: "B", Status: StatusTodo, Priority: PriorityMedium, Category: CategoryWork, EstimateHours: &estimate, RemainingHours: &remaining, StartDate: &start, Deadline: &deadline, CreatedAt: createdAt, UpdatedAt: createdAt}
	ctx := PlannerContext{Tasks: []Task{a, b}, Settings: settings, WorkWindows: windows, Today: "2026-08-24"}
	res := Replan(ctx)
	if res["a"].OverflowHours != 0 || res["b"].OverflowHours != 0 {
		t.Fatalf("unexpected overflow: a=%v b=%v", res["a"].OverflowHours, res["b"].OverflowHours)
	}
}


func TestReplanSkipsManualSlices(t *testing.T) {
	settings := Settings{DefaultDailyCapacityHours: 4, PomodoroWorkMin: 25, PomodoroBreakMin: 5}
	windows := []WorkWindow{
		{ID: "1", Weekday: 1, StartMin: 600, EndMin: 1140},
		{ID: "2", Weekday: 2, StartMin: 600, EndMin: 1140},
	}
	estimate := 4.0
	remaining := 4.0
	start := "2026-08-24"
	deadline := "2026-09-07"
	createdAt, _ := time.Parse(time.RFC3339, "2026-08-24T00:00:00Z")
	a := Task{ID: "a", Title: "A", Status: StatusTodo, Priority: PriorityCritical, Category: CategoryWork, EstimateHours: &estimate, RemainingHours: &remaining, StartDate: &start, Deadline: &deadline, CreatedAt: createdAt, UpdatedAt: createdAt}
	b := Task{ID: "b", Title: "B", Status: StatusTodo, Priority: PriorityMedium, Category: CategoryWork, EstimateHours: &estimate, RemainingHours: &remaining, StartDate: &start, Deadline: &deadline, CreatedAt: createdAt, UpdatedAt: createdAt}
	manual := []TaskSlice{{ID: "m1", TaskID: "a", Date: "2026-08-24", PlannedHours: 3, Manual: true}}
	ctx := PlannerContext{Tasks: []Task{a, b}, Slices: manual, Settings: settings, WorkWindows: windows, Today: "2026-08-24"}
	res := Replan(ctx)
	if _, ok := res["a"]; ok {
		t.Fatal("task with manual slices must not be replanned")
	}
	if _, ok := res["b"]; !ok {
		t.Fatal("task without manual slices must be replanned")
	}
}

func TestSpreadWorkTaskSkipsWeekends(t *testing.T) {
	settings := Settings{DefaultDailyCapacityHours: 4, PomodoroWorkMin: 25, PomodoroBreakMin: 5}
	var windows []WorkWindow
	for wd := 0; wd <= 6; wd++ {
		windows = append(windows, WorkWindow{ID: fmt.Sprintf("%d", wd), Weekday: wd, StartMin: 600, EndMin: 1140})
	}
	estimate := 4.0
	remaining := 4.0
	start := "2026-08-28" // пятница
	deadline := "2026-08-31" // понедельник
	createdAt, _ := time.Parse(time.RFC3339, "2026-08-28T00:00:00Z")
	work := Task{ID: "w", Title: "W", Status: StatusTodo, Priority: PriorityMedium, Category: CategoryWork, EstimateHours: &estimate, RemainingHours: &remaining, StartDate: &start, Deadline: &deadline, CreatedAt: createdAt, UpdatedAt: createdAt}
	ctx := PlannerContext{Tasks: []Task{work}, Settings: settings, WorkWindows: windows, Today: "2026-08-28"}

	res := SpreadTask(work, ctx, nil)
	for _, s := range res.Slices {
		if s.Date == "2026-08-29" || s.Date == "2026-08-30" {
			t.Fatalf("work task must not be spread to weekend: %v", s.Date)
		}
	}
	if len(res.Slices) != 2 {
		t.Fatalf("expected 2 weekday slices, got %v", len(res.Slices))
	}

	life := Task{ID: "l", Title: "L", Status: StatusTodo, Priority: PriorityMedium, Category: CategoryLife, EstimateHours: &estimate, RemainingHours: &remaining, StartDate: &start, Deadline: &deadline, CreatedAt: createdAt, UpdatedAt: createdAt}
	res2 := SpreadTask(life, ctx, nil)
	hasWeekend := false
	for _, s := range res2.Slices {
		if s.Date == "2026-08-29" || s.Date == "2026-08-30" {
			hasWeekend = true
		}
	}
	if !hasWeekend {
		t.Fatal("life task should be allowed on weekends")
	}
}
