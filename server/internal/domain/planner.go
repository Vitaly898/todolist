package domain

import (
	"math"
	"sort"
	"time"
)

type SpreadOptions struct {
	Strategy string // even|front|back
	Deadline string
}

type SpreadResult struct {
	Slices         []TaskSliceInput `json:"slices"`
	OverflowHours  float64          `json:"overflowHours"`
}

type PlannerContext struct {
	Tasks         []Task
	Slices        []TaskSlice
	Settings      Settings
	WorkWindows   []WorkWindow
	DayCapacities []DayCapacity
	Today         string
}

func parseDate(s string) time.Time {
	d, _ := time.Parse("2006-01-02", s)
	return d
}

func dateStr(t time.Time) string {
	return t.Format("2006-01-02")
}

func roundHalfUp(x float64) float64 {
	// округление до 30 минут (0.5 часа) вверх
	return math.Ceil(x*2) / 2
}

func taskStart(t Task) string {
	if t.StartDate != nil {
		return *t.StartDate
	}
	return t.CreatedAt.Format("2006-01-02")
}

func taskEnd(t Task) string {
	if t.Deadline != nil {
		return *t.Deadline
	}
	return taskStart(t)
}

func capacityForDate(date string, capacities []DayCapacity, settings Settings) float64 {
	for _, c := range capacities {
		if c.Date == date {
			return c.CapacityHours
		}
	}
	return settings.DefaultDailyCapacityHours
}

func isWorkingDay(date string, windows []WorkWindow) bool {
	wd := int(parseDate(date).Weekday())
	for _, w := range windows {
		if w.Weekday == wd {
			return true
		}
	}
	return false
}

func isWeekend(date string) bool {
	wd := parseDate(date).Weekday()
	return wd == time.Saturday || wd == time.Sunday
}

func otherSlicesSum(taskID, date string, slices []TaskSlice) float64 {
	var sum float64
	for _, s := range slices {
		if s.TaskID != taskID && s.Date == date {
			sum += s.PlannedHours
		}
	}
	return sum
}

func dayRange(from, to string) []string {
	var days []string
	cursor := parseDate(from)
	end := parseDate(to)
	for !cursor.After(end) {
		days = append(days, dateStr(cursor))
		cursor = cursor.AddDate(0, 0, 1)
	}
	return days
}

func SpreadTask(task Task, ctx PlannerContext, opts *SpreadOptions) SpreadResult {
	strategy := "even"
	deadline := taskEnd(task)
	if opts != nil {
		if opts.Strategy != "" {
			strategy = opts.Strategy
		}
		if opts.Deadline != "" {
			deadline = opts.Deadline
		}
	}

	remaining := roundHalfUp(deref(task.RemainingHours, task.EstimateHours))
	start := maxDate(taskStart(task), ctx.Today)
	end := deadline
	if end == "" {
		end = dateStr(parseDate(start).AddDate(0, 0, 14))
	} else {
		end = minDate(end, dateStr(parseDate(start).AddDate(0, 0, 60)))
	}

	allDays := dayRange(start, end)
	var days []string
	for _, d := range allDays {
		// рабочие задачи — только будни
		if task.Category == CategoryWork && isWeekend(d) {
			continue
		}
		if isWorkingDay(d, ctx.WorkWindows) {
			days = append(days, d)
		}
	}
	if strategy == "back" {
		for i, j := 0, len(days)-1; i < j; i, j = i+1, j-1 {
			days[i], days[j] = days[j], days[i]
		}
	}

	planned := make([]TaskSliceInput, 0, len(days))
	for i, date := range days {
		if remaining <= 0 {
			break
		}
		capacity := capacityForDate(date, ctx.DayCapacities, ctx.Settings)
		free := roundHalfUp(capacity - otherSlicesSum(task.ID, date, ctx.Slices))
		if free <= 0 {
			continue
		}
		daysLeft := len(days) - i
		share := roundHalfUp(remaining / float64(daysLeft))
		take := roundHalfUp(minFloat(free, share))
		if take > 0 {
			planned = append(planned, TaskSliceInput{Date: date, PlannedHours: take})
			remaining = roundHalfUp(maxFloat(0, remaining-take))
		}
	}

	if strategy == "back" {
		sort.Slice(planned, func(i, j int) bool { return planned[i].Date < planned[j].Date })
	}
	return SpreadResult{Slices: planned, OverflowHours: remaining}
}

func Replan(ctx PlannerContext) map[string]SpreadResult {
	// задачи с ручными срезами не трогаем
	manualTaskIDs := map[string]bool{}
	for _, s := range ctx.Slices {
		if s.Manual {
			manualTaskIDs[s.TaskID] = true
		}
	}
	active := make([]Task, 0, len(ctx.Tasks))
	for _, t := range ctx.Tasks {
		if (t.Status == StatusTodo || t.Status == StatusInProgress) && !manualTaskIDs[t.ID] {
			active = append(active, t)
		}
	}
	sort.Slice(active, func(i, j int) bool {
		if active[i].Priority != active[j].Priority {
			return active[i].Priority > active[j].Priority
		}
		di, dj := "", ""
		if active[i].Deadline != nil {
			di = *active[i].Deadline
		}
		if active[j].Deadline != nil {
			dj = *active[j].Deadline
		}
		if di != dj {
			return di < dj
		}
		return active[i].CreatedAt.Before(active[j].CreatedAt)
	})

	results := make(map[string]SpreadResult, len(active))
	running := make([]TaskSlice, len(ctx.Slices))
	copy(running, ctx.Slices)

	for _, task := range active {
		subCtx := ctx
		subCtx.Slices = running
		res := SpreadTask(task, subCtx, nil)
		results[task.ID] = res
		// убираем старые срезы задачи и добавляем новые для следующих задач
		next := make([]TaskSlice, 0, len(running))
		for _, s := range running {
			if s.TaskID != task.ID {
				next = append(next, s)
			}
		}
		for _, s := range res.Slices {
			next = append(next, TaskSlice{TaskID: task.ID, Date: s.Date, PlannedHours: s.PlannedHours})
		}
		running = next
	}
	return results
}

// EarliestFitDeadline: ближайший дедлайн, при котором задача умещается без overflow с запасом 20%.
func EarliestFitDeadline(task Task, ctx PlannerContext) *SpreadResult {
	start := maxDate(taskStart(task), ctx.Today)
	for offset := 0; offset <= 60; offset++ {
		deadline := dateStr(parseDate(start).AddDate(0, 0, offset))
		if !isWorkingDay(deadline, ctx.WorkWindows) {
			continue
		}
		res := SpreadTask(task, ctx, &SpreadOptions{Deadline: deadline})
		if res.OverflowHours > 0 {
			continue
		}
		maxDaily := 0.0
		for _, s := range res.Slices {
			if s.PlannedHours > maxDaily {
				maxDaily = s.PlannedHours
			}
		}
		capacity := capacityForDate(deadline, ctx.DayCapacities, ctx.Settings)
		if maxDaily <= capacity*0.8 {
			return &res
		}
	}
	return nil
}

// helpers

func deref(a, b *float64) float64 {
	if a != nil {
		return *a
	}
	if b != nil {
		return *b
	}
	return 0
}

func maxDate(a, b string) string {
	if a > b {
		return a
	}
	return b
}

func minDate(a, b string) string {
	if a < b {
		return a
	}
	return b
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
