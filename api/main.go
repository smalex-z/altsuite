// @title Altsuite API
// @version 1.0
// @description Altsuite backend API documentation
// @termsOfService http://swagger.io/terms/
// @contact.name API Support
// @contact.url http://www.example.com/support
// @contact.email support@example.com
// @license.name MIT
// @license.url https://opensource.org/licenses/MIT
// @host localhost:8080
// @BasePath /api

package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/smalex/altsuite/docs"
	httpSwagger "github.com/swaggo/http-swagger"

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

type UninstallServiceRequest struct {
	ServiceName   string `json:"service_name"`
	RemoveVolumes bool   `json:"remove_volumes"`
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

// --- Session management ---

type sessionEntry struct {
	userID    int64
	expiresAt time.Time
}

var (
	sessionStore sync.Map // map[string]sessionEntry
	authEnabled  atomic.Bool
)

const (
	sessionCookieName = "altsuite_session"
	sessionTTL        = 24 * time.Hour
)

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func createSession(w http.ResponseWriter, userID int64) error {
	token, err := generateToken()
	if err != nil {
		return err
	}
	sessionStore.Store(token, sessionEntry{
		userID:    userID,
		expiresAt: time.Now().Add(sessionTTL),
	})
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionTTL.Seconds()),
	})
	return nil
}

func getSessionUser(r *http.Request) (int64, bool) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return 0, false
	}
	val, ok := sessionStore.Load(cookie.Value)
	if !ok {
		return 0, false
	}
	entry := val.(sessionEntry)
	if time.Now().After(entry.expiresAt) {
		sessionStore.Delete(cookie.Value)
		return 0, false
	}
	return entry.userID, true
}

func deleteSessionCookie(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		sessionStore.Delete(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

// apiAuthMiddleware enforces authentication for all /api routes once users exist.
// Public prefixes are always allowed without a valid session.
func apiAuthMiddleware(next http.Handler) http.Handler {
	publicPrefixes := []string{
		"/api/health",
		"/api/auth/",
		"/api/setup/status",
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !authEnabled.Load() {
			next.ServeHTTP(w, r)
			return
		}
		path := r.URL.Path
		for _, p := range publicPrefixes {
			if strings.HasPrefix(path, p) {
				next.ServeHTTP(w, r)
				return
			}
		}
		if _, ok := getSessionUser(r); !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

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
			// Enable auth if users already exist.
			if has, err := userDB.HasUsers(); err == nil && has {
				authEnabled.Store(true)
				log.Println("Auth: enabled (users found)")
			}
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
	api.Use(apiAuthMiddleware)
	api.HandleFunc("/health", healthHandler).Methods("GET")

	// Auth endpoints (always public)
	api.HandleFunc("/auth/status", authStatusHandler).Methods("GET")
	api.HandleFunc("/auth/login", loginHandler).Methods("POST")
	api.HandleFunc("/auth/logout", logoutHandler).Methods("POST")
	api.HandleFunc("/auth/setup", firstUserSetupHandler).Methods("POST")

	// System metrics endpoints
	routes.RegisterMetricsRoutes(api, metricsCollector)

	// User management endpoints (when DATABASE_URL is set)
	api.HandleFunc("/users", listUsersHandler).Methods("GET")
	api.HandleFunc("/users", createUserHandler).Methods("POST")
	api.HandleFunc("/users/{id}/password", changePasswordHandler).Methods("PUT")

	// Service management endpoints
	api.HandleFunc("/services/{name}/status", getServiceStatusHandler).Methods("GET")
	api.HandleFunc("/services/{name}/logs", getServiceLogsHandler).Methods("GET")
	api.HandleFunc("/services/{name}/stats", getServiceStatsHandler).Methods("GET")
	api.HandleFunc("/services/{name}/config", getServiceConfigHandler).Methods("GET")
	api.HandleFunc("/services/action", serviceActionHandler).Methods("POST")
	api.HandleFunc("/services/install", installServiceHandler).Methods("POST")
	api.HandleFunc("/services/uninstall", uninstallServiceHandler).Methods("POST")

	// Package management endpoints
	api.HandleFunc("/packages", listPackagesHandler).Methods("GET")
	api.HandleFunc("/packages/{name}", getPackageInfoHandler).Methods("GET")
	api.HandleFunc("/packages/install", installPackageHandler).Methods("POST")

	// Docker endpoints (if Docker is installed)
	api.HandleFunc("/docker/containers", listDockerContainersHandler).Methods("GET")

	// Serve swagger UI (generated by `swag init` into ./docs)
	// The swagger JSON will be expected at /docs/swagger.json
	r.PathPrefix("/docs").Handler(httpSwagger.WrapHandler)

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

// healthHandler godoc
// @Summary Health check
// @Description Returns service health and timestamp
// @Tags Health
// @Produce json
// @Success 200 {object} HealthResponse
// @Router /health [get]
func healthHandler(w http.ResponseWriter, r *http.Request) {
	response := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// setupStatusHandler godoc
// @Summary Get setup status
// @Description Returns the current setup status of the dashboard
// @Tags Setup
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /setup/status [get]
func setupStatusHandler(w http.ResponseWriter, r *http.Request) {
	status := privOps.GetSetupStatus()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// setupConfigureHandler godoc
// @Summary Configure dashboard
// @Description Configure the dashboard with a domain name
// @Tags Setup
// @Accept json
// @Produce json
// @Param request body SetupConfigureRequest true "Domain configuration"
// @Success 200 {object} map[string]string "Configuration output and domain"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 500 {object} map[string]string "Configuration error"
// @Router /setup/configure [post]
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

// getServiceStatusHandler godoc
// @Summary Get service status
// @Description Return running status for a given service
// @Tags Services
// @Produce json
// @Param name path string true "Service name"
// @Success 200 {object} ServiceStatusResponse
// @Failure 404 {object} map[string]string
// @Router /services/{name}/status [get]
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

// serviceActionHandler godoc
// @Summary Perform a service action
// @Description Start/stop/restart/enable/disable a system service
// @Tags Services
// @Accept json
// @Produce json
// @Param request body ServiceActionRequest true "Service action request"
// @Success 200 {object} ServiceStatusResponse
// @Failure 400 {object} map[string]string
// @Router /services/action [post]
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

	output, err := privOps.ServiceCommand(operation, req.ServiceName)

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

// getServiceLogsHandler godoc
// @Summary Get service logs
// @Description Retrieve logs for a specific service with optional tail limit
// @Tags Services
// @Produce json
// @Param name path string true "Service name"
// @Param tail query int false "Number of log lines to retrieve (default: 200)"
// @Success 200 {object} map[string]string "Service logs"
// @Failure 500 {object} map[string]string "Error retrieving logs"
// @Router /services/{name}/logs [get]
func getServiceLogsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["name"]
	tail := 200
	if t := r.URL.Query().Get("tail"); t != "" {
		if n, err := strconv.Atoi(t); err == nil && n > 0 {
			tail = n
		}
	}
	logs, err := privOps.GetServiceLogs(serviceName, tail)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"logs": logs})
}

// getServiceStatsHandler godoc
// @Summary Get service stats
// @Description Retrieve CPU, memory, and uptime statistics for a specific service
// @Tags Services
// @Produce json
// @Param name path string true "Service name"
// @Success 200 {object} map[string]interface{} "Service statistics"
// @Failure 500 {object} map[string]string "Error retrieving stats"
// @Router /services/{name}/stats [get]
func getServiceStatsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["name"]
	stats, err := privOps.GetServiceStats(serviceName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// getServiceConfigHandler godoc
// @Summary Get service configuration
// @Description Retrieve domain and port configuration for a specific service
// @Tags Services
// @Produce json
// @Param name path string true "Service name"
// @Success 200 {object} map[string]interface{} "Service configuration"
// @Failure 400 {object} map[string]string "Error retrieving configuration"
// @Router /services/{name}/config [get]
func getServiceConfigHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["name"]
	config, err := privOps.GetServiceConfig(serviceName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// uninstallServiceHandler godoc
// @Summary Uninstall a service
// @Description Remove a service installation with optional volume deletion
// @Tags Services
// @Accept json
// @Produce json
// @Param request body UninstallServiceRequest true "Service name and volume removal preference"
// @Success 200 {object} map[string]string "Uninstall successful"
// @Failure 400 {object} map[string]string "Invalid request or missing service name"
// @Failure 500 {object} map[string]string "Uninstall error"
// @Router /services/uninstall [post]
func uninstallServiceHandler(w http.ResponseWriter, r *http.Request) {
	var req UninstallServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.ServiceName == "" {
		http.Error(w, "service_name is required", http.StatusBadRequest)
		return
	}
	if err := privOps.UninstallService(req.ServiceName, req.RemoveVolumes); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// listPackagesHandler godoc
// @Summary List packages
// @Description Return list of installed packages
// @Tags Packages
// @Produce json
// @Success 200 {object} PackageListResponse
// @Failure 500 {object} map[string]string
// @Router /packages [get]
// Handler for service logs
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
// getPackageInfoHandler godoc
// @Summary Get package information
// @Description Retrieve detailed information about a specific package
// @Tags Packages
// @Produce plain
// @Param name path string true "Package name"
// @Success 200 {string} string "Package information"
// @Failure 404 {object} map[string]string
// @Router /packages/{name} [get]
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

// installPackageHandler godoc
// @Summary Install packages
// @Description Install one or more supported packages
// @Tags Packages
// @Accept json
// @Produce json
// @Param packages body []string true "Package names"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /packages/install [post]
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

// installServiceHandler godoc
// @Summary Install a service
// @Description Install a named service with specified domain and optional configuration
// @Tags Services
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Service installation request with service, domain, and optional config"
// @Success 200 {object} map[string]interface{} "Installation output"
// @Failure 400 {object} map[string]string "Missing required fields or invalid request"
// @Failure 500 {object} map[string]interface{} "Installation error with output"
// @Router /services/install [post]
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
	if err := SetInstalledStateByServiceName(req.Service, true); err != nil {
		log.Printf("could not update installed state for service %q: %v", req.Service, err)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Handler for listing Docker containers
// listDockerContainersHandler godoc
// @Summary List Docker containers
// @Description List all Docker containers running on the system
// @Tags Docker
// @Produce plain
// @Success 200 {string} string "Docker containers output"
// @Failure 500 {object} map[string]string "Docker not installed or error"
// @Router /docker/containers [get]
func listDockerContainersHandler(w http.ResponseWriter, r *http.Request) {
	output, err := privOps.ListDockerContainers()

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(output))
}

// --- Auth handlers ---

type AuthStatusResponse struct {
	Authenticated      bool   `json:"authenticated"`
	HasUsers           bool   `json:"hasUsers"`
	UserMgmtConfigured bool   `json:"userMgmtConfigured"`
	SetupComplete      bool   `json:"setupComplete"`
	Domain             string `json:"domain,omitempty"`
}

// authStatusHandler godoc
// @Summary Get authentication status
// @Description Check current authentication status and system setup state
// @Tags Auth
// @Produce json
// @Success 200 {object} AuthStatusResponse "Authentication and setup status"
// @Router /auth/status [get]
func authStatusHandler(w http.ResponseWriter, r *http.Request) {
	_, authenticated := getSessionUser(r)
	setupStatus := privOps.GetSetupStatus()
	resp := AuthStatusResponse{
		Authenticated:      authenticated,
		HasUsers:           authEnabled.Load(),
		UserMgmtConfigured: userDB != nil,
		SetupComplete:      setupStatus.Configured,
		Domain:             setupStatus.Domain,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// loginHandler godoc
// @Summary User login
// @Description Authenticate a user with username and password to create a session
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Username and password"
// @Success 200 {object} map[string]interface{} "User information and session created"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Invalid credentials"
// @Failure 503 {object} map[string]string "User management not configured"
// @Router /auth/login [post]
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if userDB == nil {
		http.Error(w, `{"error":"user management not configured"}`, http.StatusServiceUnavailable)
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	user, err := userDB.AuthenticateUser(req.Username, req.Password)
	if err != nil {
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}
	if err := createSession(w, user.ID); err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// logoutHandler godoc
// @Summary User logout
// @Description Clear user session and invalidate authentication
// @Tags Auth
// @Success 204 "Logout successful"
// @Router /auth/logout [post]
func logoutHandler(w http.ResponseWriter, r *http.Request) {
	deleteSessionCookie(w, r)
	w.WriteHeader(http.StatusNoContent)
}

// firstUserSetupHandler godoc
// @Summary Create first admin user
// @Description Create the initial admin user for the system (only works when no users exist)
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Username and password for first admin user"
// @Success 201 {object} map[string]interface{} "Admin user created and session established"
// @Failure 400 {object} map[string]string "Invalid request or setup already complete"
// @Failure 409 {object} map[string]string "Username already exists"
// @Failure 503 {object} map[string]string "User management not configured"
// @Router /auth/setup [post]
func firstUserSetupHandler(w http.ResponseWriter, r *http.Request) {
	if userDB == nil {
		http.Error(w, `{"error":"user management not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if authEnabled.Load() {
		http.Error(w, `{"error":"setup already complete"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	user, err := userDB.CreateUser(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, db.ErrDuplicateUsername) {
			http.Error(w, `{"error":"username already exists"}`, http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	authEnabled.Store(true)
	log.Println("Auth: enabled (first user created)")
	if err := createSession(w, user.ID); err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// --- User management ---

// listUsersHandler godoc
// @Summary List users
// @Description Returns a list of all users (requires DATABASE_URL to be configured)
// @Tags Users
// @Produce json
// @Success 200 {object} map[string]interface{} "List of users"
// @Failure 503 {object} map[string]string "User management not configured"
// @Failure 500 {object} map[string]string "Database error"
// @Router /users [get]
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

// createUserHandler godoc
// @Summary Create a new user
// @Description Create a new user with username and password (requires DATABASE_URL to be configured)
// @Tags Users
// @Accept json
// @Produce json
// @Param request body map[string]string true "Username and password"
// @Success 201 {object} map[string]interface{} "Created user"
// @Failure 400 {object} map[string]string "Invalid request body"
// @Failure 409 {object} map[string]string "Username already exists"
// @Failure 503 {object} map[string]string "User management not configured"
// @Router /users [post]
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

// changePasswordHandler godoc
// @Summary Change user password
// @Description Update the password for a specific user (requires DATABASE_URL to be configured)
// @Tags Users
// @Accept json
// @Param id path int true "User ID"
// @Param request body map[string]string true "New password"
// @Success 204 "Password changed successfully"
// @Failure 400 {object} map[string]string "Invalid user ID or request body"
// @Failure 404 {object} map[string]string "User not found"
// @Failure 503 {object} map[string]string "User management not configured"
// @Router /users/{id}/password [put]
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
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
