package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
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

type PackageListResponse struct {
	Packages []string `json:"packages"`
	Count    int      `json:"count"`
}

var privOps *PrivilegedOps

func main() {
	// Initialize privileged operations handler
	privOps = NewPrivilegedOps()

	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", healthHandler).Methods("GET")

	// Service management endpoints
	api.HandleFunc("/services/{name}/status", getServiceStatusHandler).Methods("GET")
	api.HandleFunc("/services/action", serviceActionHandler).Methods("POST")

	// Package management endpoints
	api.HandleFunc("/packages", listPackagesHandler).Methods("GET")
	api.HandleFunc("/packages/{name}", getPackageInfoHandler).Methods("GET")
	api.HandleFunc("/packages/install", installPackageHandler).Methods("POST")

	// Docker endpoints (if Docker is installed)
	api.HandleFunc("/docker/containers", listDockerContainersHandler).Methods("GET")

	// Serve frontend static files
	frontendDir := "/opt/altsuite/frontend"
	r.PathPrefix("/").Handler(http.FileServer(http.Dir(frontendDir)))

	// CORS middleware for development
	r.Use(corsMiddleware)

	// Start server
	port := ":8080"
	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(port, r); err != nil {
		log.Fatal(err)
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

// Handler for installing packages
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
