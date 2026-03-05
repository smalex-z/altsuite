package routes

import (
	"github.com/gorilla/mux"
	"github.com/smalex/altsuite/collectors"
	"github.com/smalex/altsuite/controllers"
)

// RegisterMetricsRoutes wires the metrics endpoints onto the given router.
func RegisterMetricsRoutes(api *mux.Router, collector *collectors.MetricsCollector) {
	ctrl := controllers.NewMetricsController(collector)

	api.HandleFunc("/metrics/current", ctrl.HandleCurrent).Methods("GET")
	api.HandleFunc("/metrics/history", ctrl.HandleHistory).Methods("GET")
}
