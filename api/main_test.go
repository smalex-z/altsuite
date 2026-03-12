package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()

	healthHandler(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestCORSHeaders(t *testing.T) {
	req := httptest.NewRequest("OPTIONS", "/api/health", nil)
	w := httptest.NewRecorder()

	h := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	h.ServeHTTP(w, req)

	resp := w.Result()
	if resp.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Error("CORS header missing or incorrect")
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 for OPTIONS, got %d", resp.StatusCode)
	}
}

// TestGetServiceConfigHandler_InvalidServiceName ensures invalid service name returns 400.
func TestGetServiceConfigHandler_InvalidServiceName(t *testing.T) {
	// privOps must be set for the handler to run
	privOps = NewPrivilegedOps()
	defer func() { privOps = nil }()

	r := mux.NewRouter()
	r.HandleFunc("/api/services/{name}/config", getServiceConfigHandler).Methods("GET")

	req := httptest.NewRequest("GET", "/api/services/invalid%20name/config", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid service name, got %d", resp.StatusCode)
	}
}
