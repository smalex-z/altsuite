package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/smalex/altsuite/collectors"
)

// noopReader satisfies collectors.SystemReader with zero-value returns.
type noopReader struct{}

func (n *noopReader) CPUPercent() (float64, error)          { return 0, nil }
func (n *noopReader) MemoryPercent() (float64, error)       { return 0, nil }
func (n *noopReader) NetworkBytes() (uint64, error)         { return 0, nil }
func (n *noopReader) DiskPercent(_ string) (float64, error) { return 0, nil }

// makeCollector returns a MetricsCollector pre-seeded with the given points.
func makeCollector(points ...collectors.MetricsPoint) *collectors.MetricsCollector {
	c := collectors.NewMetricsCollectorWithReader(&noopReader{})
	for _, p := range points {
		c.Store.Add(p)
	}
	return c
}

// --- HandleCurrent ---

func TestHandleCurrent_EmptyStore(t *testing.T) {
	t.Parallel()
	ctrl := NewMetricsController(makeCollector())
	req := httptest.NewRequest("GET", "/metrics/current", nil)
	w := httptest.NewRecorder()
	ctrl.HandleCurrent(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestHandleCurrent_WithData_Status(t *testing.T) {
	t.Parallel()
	p := collectors.MetricsPoint{Timestamp: time.Now(), CPU: 50}
	ctrl := NewMetricsController(makeCollector(p))
	req := httptest.NewRequest("GET", "/metrics/current", nil)
	w := httptest.NewRecorder()
	ctrl.HandleCurrent(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandleCurrent_WithData_Body(t *testing.T) {
	t.Parallel()
	ts := time.Date(2024, 3, 1, 12, 0, 0, 0, time.UTC)
	p := collectors.MetricsPoint{Timestamp: ts, CPU: 42.5, Memory: 75.0, Network: 2.5, Disk: 55.0}
	ctrl := NewMetricsController(makeCollector(p))
	req := httptest.NewRequest("GET", "/metrics/current", nil)
	w := httptest.NewRecorder()
	ctrl.HandleCurrent(w, req)

	var got collectors.MetricsPoint
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if got.CPU != 42.5 {
		t.Errorf("CPU: expected 42.5, got %f", got.CPU)
	}
	if got.Memory != 75.0 {
		t.Errorf("Memory: expected 75.0, got %f", got.Memory)
	}
	if got.Network != 2.5 {
		t.Errorf("Network: expected 2.5, got %f", got.Network)
	}
	if got.Disk != 55.0 {
		t.Errorf("Disk: expected 55.0, got %f", got.Disk)
	}
}

func TestHandleCurrent_ContentType(t *testing.T) {
	t.Parallel()
	p := collectors.MetricsPoint{Timestamp: time.Now(), CPU: 10}
	ctrl := NewMetricsController(makeCollector(p))
	req := httptest.NewRequest("GET", "/metrics/current", nil)
	w := httptest.NewRecorder()
	ctrl.HandleCurrent(w, req)
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}

// --- HandleHistory ---

func TestHandleHistory_EmptyStore(t *testing.T) {
	t.Parallel()
	ctrl := NewMetricsController(makeCollector())
	req := httptest.NewRequest("GET", "/metrics/history?range=minute", nil)
	w := httptest.NewRecorder()
	ctrl.HandleHistory(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	var resp historyResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Metrics == nil {
		t.Error("expected non-nil metrics array")
	}
	if len(resp.Metrics) != 0 {
		t.Errorf("expected empty metrics, got %d points", len(resp.Metrics))
	}
}

func TestHandleHistory_DefaultRange(t *testing.T) {
	t.Parallel()
	ctrl := NewMetricsController(makeCollector())
	req := httptest.NewRequest("GET", "/metrics/history", nil) // no range param
	w := httptest.NewRecorder()
	ctrl.HandleHistory(w, req)
	var resp historyResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Range != "minute" {
		t.Errorf("expected default range=minute, got %q", resp.Range)
	}
}

func TestHandleHistory_InvalidRange(t *testing.T) {
	t.Parallel()
	ctrl := NewMetricsController(makeCollector())
	req := httptest.NewRequest("GET", "/metrics/history?range=invalid", nil)
	w := httptest.NewRecorder()
	ctrl.HandleHistory(w, req)
	var resp historyResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Range != "minute" {
		t.Errorf("expected invalid range to default to minute, got %q", resp.Range)
	}
}

func TestHandleHistory_AllRanges(t *testing.T) {
	t.Parallel()
	tests := []struct {
		rangeParam string
	}{
		{"minute"},
		{"hour"},
		{"day"},
		{"week"},
		{"month"},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.rangeParam, func(t *testing.T) {
			t.Parallel()
			ctrl := NewMetricsController(makeCollector())
			req := httptest.NewRequest("GET", "/metrics/history?range="+tt.rangeParam, nil)
			w := httptest.NewRecorder()
			ctrl.HandleHistory(w, req)
			if w.Code != http.StatusOK {
				t.Errorf("expected 200, got %d", w.Code)
			}
			var resp historyResponse
			if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
				t.Fatalf("decode error: %v", err)
			}
			if resp.Range != tt.rangeParam {
				t.Errorf("expected range=%q in response, got %q", tt.rangeParam, resp.Range)
			}
		})
	}
}

func TestHandleHistory_ContentType(t *testing.T) {
	t.Parallel()
	ctrl := NewMetricsController(makeCollector())
	req := httptest.NewRequest("GET", "/metrics/history?range=minute", nil)
	w := httptest.NewRecorder()
	ctrl.HandleHistory(w, req)
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}

func TestHandleHistory_NoDownsample_Minute(t *testing.T) {
	t.Parallel()
	now := time.Now()
	var pts []collectors.MetricsPoint
	for i := 0; i < 5; i++ {
		pts = append(pts, collectors.MetricsPoint{
			Timestamp: now.Add(-time.Duration(i*5) * time.Second),
		})
	}
	ctrl := NewMetricsController(makeCollector(pts...))
	req := httptest.NewRequest("GET", "/metrics/history?range=minute", nil)
	w := httptest.NewRecorder()
	ctrl.HandleHistory(w, req)
	var resp historyResponse
	json.NewDecoder(w.Body).Decode(&resp)
	// minute range has no downsampling; all 5 raw points should be returned
	if len(resp.Metrics) != 5 {
		t.Errorf("minute range: expected 5 raw points, got %d", len(resp.Metrics))
	}
}

func TestHandleHistory_NoDownsample_Hour(t *testing.T) {
	t.Parallel()
	now := time.Now()
	var pts []collectors.MetricsPoint
	for i := 0; i < 4; i++ {
		pts = append(pts, collectors.MetricsPoint{
			Timestamp: now.Add(-time.Duration(i*5) * time.Second),
		})
	}
	ctrl := NewMetricsController(makeCollector(pts...))
	req := httptest.NewRequest("GET", "/metrics/history?range=hour", nil)
	w := httptest.NewRecorder()
	ctrl.HandleHistory(w, req)
	var resp historyResponse
	json.NewDecoder(w.Body).Decode(&resp)
	// hour range has no downsampling; all 4 raw points should be returned
	if len(resp.Metrics) != 4 {
		t.Errorf("hour range: expected 4 raw points, got %d", len(resp.Metrics))
	}
}

func TestHandleHistory_Downsamples_Day(t *testing.T) {
	t.Parallel()
	// Add 10 points within the same minute bucket (5s apart).
	// The "day" handler downsamples with a 1-minute interval,
	// so all 10 points should collapse into 1 bucket.
	base := time.Now().Add(-30 * time.Second)
	base = base.Truncate(time.Minute) // align to a minute boundary

	var pts []collectors.MetricsPoint
	for i := 0; i < 10; i++ {
		pts = append(pts, collectors.MetricsPoint{
			Timestamp: base.Add(time.Duration(i) * time.Second),
			CPU:       float64(10 + i),
		})
	}
	ctrl := NewMetricsController(makeCollector(pts...))
	req := httptest.NewRequest("GET", "/metrics/history?range=day", nil)
	w := httptest.NewRecorder()
	ctrl.HandleHistory(w, req)
	var resp historyResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if len(resp.Metrics) != 1 {
		t.Errorf("day range: expected 1 downsampled bucket, got %d", len(resp.Metrics))
	}
}
