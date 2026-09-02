package server

import "github.com/go-chi/chi/v5"

func registerAdminRoutes(s *Server, r chi.Router) {
	r.Group(func(a chi.Router) {
		a.Use(s.admin)
		a.Post("/admin/publish", s.publish)
		a.Get("/admin/updates", s.list)
		a.Get("/admin/updates/{id}", s.show)
		a.Get("/admin/channels", s.channels)
		a.Get("/admin/channels/{channel}", s.channel)
		a.Post("/admin/channels/{channel}/rollback", s.rollback)
		a.Get("/admin/channels/{channel}/history", s.history)
		a.Get("/admin/source/latest", s.sourceLatest)
		a.Get("/admin/source/compare/{from}/{to}", s.sourceCompare)
		a.Get("/admin/source/{commit}", s.sourceFind)
		a.Get("/admin/insights", s.insights)
	})
}
