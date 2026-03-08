package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/smalex/altsuite/collectors"
)

// MetricsController handles HTTP requests for system metrics.
type MetricsController struct {
	Collector *collectors.MetricsCollector
}

// NewMetricsController creates a new controller backed by the given collector.
func NewMetricsController(c *collectors.MetricsCollector) *MetricsController {
	return &MetricsController{Collector: c}
}

// HandleCurrent returns the most recent metrics snapshot.
func (mc *MetricsController) HandleCurrent(w http.ResponseWriter, r *http.Request) {
	latest := mc.Collector.Store.GetLatest()
	if latest == nil {
		http.Error(w, "no metrics available yet", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(latest)
}

// historyResponse wraps historical metrics with the requested range.
type historyResponse struct {
	Range   string                    `json:"range"`
	Metrics []collectors.MetricsPoint `json:"metrics"`
}

// HandleHistory returns historical metrics for the requested time range.
func (mc *MetricsController) HandleHistory(w http.ResponseWriter, r *http.Request) {
	rangeParam := r.URL.Query().Get("range")

	var duration time.Duration
	var downsampleInterval time.Duration

	switch rangeParam {
	case "hour":
		duration = time.Hour
	case "day":
		duration = 24 * time.Hour
		downsampleInterval = time.Minute
	case "week":
		duration = 7 * 24 * time.Hour
		downsampleInterval = 5 * time.Minute
	case "month":
		duration = 30 * 24 * time.Hour
		downsampleInterval = 30 * time.Minute
	default:
		rangeParam = "minute"
		duration = time.Minute
	}

	points := mc.Collector.Store.GetRange(duration)

	if downsampleInterval > 0 {
		points = collectors.Downsample(points, downsampleInterval)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(historyResponse{
		Range:   rangeParam,
		Metrics: points,
	})
}
