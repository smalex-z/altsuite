package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/smalex/altsuite/collectors"
)

// noopReader satisfies collectors.SystemReader with zero-value returns.
type noopReader struct{}

func (n *noopReader) CPUPercent() (float64, error)          { return 0, nil }
func (n *noopReader) MemoryPercent() (float64, error)       { return 0, nil }
func (n *noopReader) NetworkBytes() (uint64, error)         { return 0, nil }
func (n *noopReader) DiskPercent(_ string) (float64, error) { return 0, nil }

// newTestRouter builds a router that mirrors the main.go setup.
func newTestRouter() *mux.Router {
	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	RegisterMetricsRoutes(api, collectors.NewMetricsCollectorWithReader(&noopReader{}))
	return r
}

func TestRoutes_CurrentRegistered(t *testing.T) {
	r := newTestRouter()
	req := httptest.NewRequest("GET", "/api/metrics/current", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code == http.StatusNotFound {
		t.Error("GET /api/metrics/current should be registered (got 404)")
	}
}

func TestRoutes_HistoryRegistered(t *testing.T) {
	r := newTestRouter()
	req := httptest.NewRequest("GET", "/api/metrics/history?range=minute", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code == http.StatusNotFound {
		t.Error("GET /api/metrics/history should be registered (got 404)")
	}
}

func TestRoutes_WrongMethod_Current(t *testing.T) {
	r := newTestRouter()
	req := httptest.NewRequest("POST", "/api/metrics/current", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	// gorilla/mux returns 405 at the top-level router; subrouters may return 404.
	// Either way, POST must not succeed.
	if w.Code == http.StatusOK {
		t.Error("POST /api/metrics/current should be rejected (GET-only route)")
	}
}

func TestRoutes_WrongMethod_History(t *testing.T) {
	r := newTestRouter()
	req := httptest.NewRequest("POST", "/api/metrics/history", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code == http.StatusOK {
		t.Error("POST /api/metrics/history should be rejected (GET-only route)")
	}
}
