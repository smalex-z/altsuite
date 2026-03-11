package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/smalex/altsuite/collectors"
	"github.com/smalex/altsuite/db"
	"github.com/smalex/altsuite/routes"
)

type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

type ServiceStatusResponse struct {
	ServiceName string `json:"service_name"`
	IsRunning   bool   `json:"is_running"`
	Output      string `json:"output,omitempty"`
	Error       string `json:"error,omitempty"`
}

type ServiceActionRequest struct {
	ServiceName string `json:"service_name"`
	Action      string `json:"action"` // start, stop, restart, enable, disable
}

type SetupConfigureRequest struct {
	Domain string `json:"domain"`
}

type PackageListResponse struct {
	Packages []SupportedApp `json:"packages"`
	Count    int            `json:"count"`
}

const shutdownTimeout = 5 * time.Second

// spaFileServer serves a Next.js static export where pages are written as
// <route>.html rather than <route>/index.html. For each request it tries
// the path as-is, then appends ".html", then falls back to index.html.
func spaFileServer(dir string) http.Handler {
	fs := http.Dir(dir)
	plain := http.FileServer(fs)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upath := r.URL.Path

		// Try the path as-is (covers root, _next/*, static assets, etc.)
		if f, err := fs.Open(upath); err == nil {
			info, statErr := f.Stat()
			f.Close()
			if statErr == nil {
				if !info.IsDir() {
					plain.ServeHTTP(w, r)
					return
				}
				// Directory exists — check for an index.html inside it.
				if idx, err2 := fs.Open(upath + "/index.html"); err2 == nil {
					idx.Close()
					plain.ServeHTTP(w, r)
					return
				}
				// Dir has no index.html — fall through to try the .html sibling.
			}
		}

		// Try <path>.html (the Next.js static export pattern).
		if f, err := fs.Open(upath + ".html"); err == nil {
			f.Close()
			r.URL.Path = upath + ".html"
			plain.ServeHTTP(w, r)
			return
		}

		// Fallback: serve index.html for any unmatched route.
		r.URL.Path = "/index.html"
		plain.ServeHTTP(w, r)
	})
}

var privOps *PrivilegedOps
var userDB *db.DB

func main() {
	// Initialize privileged operations handler
	privOps = NewPrivilegedOps()

	// Connect to Postgres for user management if configured
	if url := os.Getenv("DATABASE_URL"); url != "" {
		var err error
		userDB, err = db.Open(url)
		if err != nil {
			log.Printf("User DB: could not connect (user management disabled): %v", err)
		} else {
			defer userDB.Close()
			log.Println("User DB: connected")
		}
	}

	// Create a cancellable context for the metrics collector; it will be
	// cancelled during graceful shutdown so the background goroutine exits.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start metrics collector
	metricsCollector := collectors.NewMetricsCollector()
	metricsCollector.Start(ctx)

	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", healthHandler).Methods("GET")

	// System metrics endpoints
	routes.RegisterMetricsRoutes(api, metricsCollector)

	// User management endpoints (when DATABASE_URL is set)
	api.HandleFunc("/users", listUsersHandler).Methods("GET")
	api.HandleFunc("/users", createUserHandler).Methods("POST")
	api.HandleFunc("/users/{id}/password", changePasswordHandler).Methods("PUT")

	// Service management endpoints
	api.HandleFunc("/services/{name}/status", getServiceStatusHandler).Methods("GET")
	api.HandleFunc("/services/action", serviceActionHandler).Methods("POST")
	api.HandleFunc("/services/install", installServiceHandler).Methods("POST")

	// Package management endpoints
	api.HandleFunc("/packages", listPackagesHandler).Methods("GET")
	api.HandleFunc("/packages/{name}", getPackageInfoHandler).Methods("GET")
	api.HandleFunc("/packages/install", installPackageHandler).Methods("POST")

	// Docker endpoints (if Docker is installed)
	api.HandleFunc("/docker/containers", listDockerContainersHandler).Methods("GET")

	// First-time setup endpoints
	api.HandleFunc("/setup/status", setupStatusHandler).Methods("GET")
	api.HandleFunc("/setup/configure", setupConfigureHandler).Methods("POST")

	// Serve frontend static files
	frontendDir := "/opt/altsuite/frontend"
	r.PathPrefix("/").Handler(spaFileServer(frontendDir))

	// CORS middleware for development
	r.Use(corsMiddleware)

	// Start server
	port := ":8080"
	srv := &http.Server{
		Addr:    port,
		Handler: r,
	}

	// Listen for OS signals to trigger graceful shutdown.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Server starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	<-quit
	log.Println("Server shutting down...")

	// Cancel the metrics collector context first.
	cancel()

	// Give in-flight requests up to 5 seconds to complete.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	response := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func setupStatusHandler(w http.ResponseWriter, r *http.Request) {
	status := privOps.GetSetupStatus()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func setupConfigureHandler(w http.ResponseWriter, r *http.Request) {
	var req SetupConfigureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	output, err := privOps.ConfigureDashboard(req.Domain)
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error(), "output": output})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"output": output, "domain": req.Domain})
}

// Handler for service status
func getServiceStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["name"]

	isRunning, err := privOps.GetServiceStatus(serviceName)

	response := ServiceStatusResponse{
		ServiceName: serviceName,
		IsRunning:   isRunning,
	}

	if err != nil {
		response.Error = err.Error()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Handler for service actions (start, stop, restart, etc.)
func serviceActionHandler(w http.ResponseWriter, r *http.Request) {
	var req ServiceActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var operation SystemctlOperation
	switch req.Action {
	case "start":
		operation = SystemctlStart
	case "stop":
		operation = SystemctlStop
	case "restart":
		operation = SystemctlRestart
	case "enable":
		operation = SystemctlEnable
	case "disable":
		operation = SystemctlDisable
	default:
		http.Error(w, "Invalid action. Use: start, stop, restart, enable, or disable", http.StatusBadRequest)
		return
	}

	output, err := privOps.SystemctlCommand(operation, req.ServiceName)

	response := ServiceStatusResponse{
		ServiceName: req.ServiceName,
		Output:      output,
	}

	if err != nil {
		response.Error = err.Error()
		w.WriteHeader(http.StatusInternalServerError)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Handler for listing installed packages
func listPackagesHandler(w http.ResponseWriter, r *http.Request) {
	packages, err := privOps.ListInstalledPackages()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := PackageListResponse{
		Packages: packages,
		Count:    len(packages),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Handler for getting package info
func getPackageInfoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	packageName := vars["name"]

	info, err := privOps.GetPackageInfo(packageName)

	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(info))
}

// First ensure that it is one of the supported packages in side of supported_apps.json before installing
func installPackageHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Packages []string `json:"packages"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Packages) == 0 {
		http.Error(w, "No packages specified", http.StatusBadRequest)
		return
	}

	output, err := privOps.PackageCommand(PackageInstall, req.Packages...)

	response := map[string]interface{}{
		"output": output,
	}

	if err != nil {
		response["error"] = err.Error()
		w.WriteHeader(http.StatusInternalServerError)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// installServiceHandler installs a named service via the deploy/install.sh script.
func installServiceHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Service string            `json:"service"`
		Domain  string            `json:"domain"`
		Config  map[string]string `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Service == "" || req.Domain == "" {
		http.Error(w, "service and domain are required", http.StatusBadRequest)
		return
	}
	if req.Config == nil {
		req.Config = map[string]string{}
	}

	output, err := privOps.InstallService(req.Service, req.Domain, req.Config)
	response := map[string]interface{}{"output": output}
	if err != nil {
		response["error"] = err.Error()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Handler for listing Docker containers
func listDockerContainersHandler(w http.ResponseWriter, r *http.Request) {
	output, err := privOps.ListDockerContainers()

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(output))
}

// --- User management ---

func listUsersHandler(w http.ResponseWriter, r *http.Request) {
	if userDB == nil {
		http.Error(w, "user management not configured (set DATABASE_URL)", http.StatusServiceUnavailable)
		return
	}
	users, err := userDB.ListUsers()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"users": users})
}

func createUserHandler(w http.ResponseWriter, r *http.Request) {
	if userDB == nil {
		http.Error(w, "user management not configured (set DATABASE_URL)", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	u, err := userDB.CreateUser(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, db.ErrDuplicateUsername) {
			http.Error(w, "username already exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

func changePasswordHandler(w http.ResponseWriter, r *http.Request) {
	if userDB == nil {
		http.Error(w, "user management not configured (set DATABASE_URL)", http.StatusServiceUnavailable)
		return
	}
	vars := mux.Vars(r)
	id, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := userDB.UpdatePassword(id, req.Password); err != nil {
		if err.Error() == "user not found" {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
