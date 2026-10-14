package domain

import "fmt"

type DeadlineSuggestion struct {
	Deadline    string `json:"deadline"`
	Explanation string `json:"explanation"`
}

// SuggestDeadline: помощник по срокам (rule-based).
func SuggestDeadline(task Task, ctx PlannerContext) *DeadlineSuggestion {
	fit := EarliestFitDeadline(task, ctx)
	if fit == nil {
		return nil
	}
	days := len(fit.Slices)
	total := deref(task.RemainingHours, task.EstimateHours)
	daily := 0.0
	if days > 0 {
		daily = total / float64(days)
	}
	safeCapacity := ctx.Settings.DefaultDailyCapacityHours * 0.8
	return &DeadlineSuggestion{
		Deadline: fit.Slices[len(fit.Slices)-1].Date,
		Explanation: fmt.Sprintf(
			"Дедлайн %s подходит: ≈%.1fч в день (%d раб.дн), запас до %.1fч/день.",
			fit.Slices[len(fit.Slices)-1].Date, daily, days, safeCapacity,
		),
	}
}
