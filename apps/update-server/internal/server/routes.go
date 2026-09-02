package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(s.instrument)
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	registerPublicRoutes(s, r)
	registerAdminRoutes(s, r)
	return r
}
