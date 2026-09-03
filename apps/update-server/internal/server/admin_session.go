package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// registerAdminSessionRoute exposes a lightweight probe the WebUI uses to
// validate a token before storing it. It sits behind the same admin middleware
// as every other /admin route, so any 200 response means the supplied
// credentials are valid.
func registerAdminSessionRoute(s *Server, r chi.Router) {
	r.Group(func(a chi.Router) {
		a.Use(s.admin)
		a.Get("/admin/session", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"authenticated":true}`))
		})
	})
}
