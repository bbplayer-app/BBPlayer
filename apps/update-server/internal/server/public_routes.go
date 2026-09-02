package server

import "github.com/go-chi/chi/v5"

func registerPublicRoutes(s *Server, r chi.Router) {
	r.Get("/api/manifest", s.manifest)
	r.Get("/api/assets/{assetID}", s.asset)
	r.Post("/api/events", s.event)
}
