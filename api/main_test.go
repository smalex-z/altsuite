package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
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
