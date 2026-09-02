package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(s.instrument)
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	r.Handle("/metrics", promhttp.HandlerFor(s.Metrics.registry, promhttp.HandlerOpts{}))
	registerPublicRoutes(s, r)
	registerAdminRoutes(s, r)
	return r
}
