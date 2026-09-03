package server

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// logError records a server-side error that a handler is about to fold into a
// generic HTTP response, so operators can tell failures apart.
func (s *Server) logError(r *http.Request, msg string, err error, kv ...any) {
	s.Log.Error(msg, append([]any{"error", err, "method", r.Method, "path", r.URL.Path}, kv...)...)
}

// dbError logs a failure and returns the generic 500 a huma handler should
// surface, mirroring logError for handlers that have no *http.Request in
// scope. It deliberately swallows the message sent to the client.
func (s *Server) dbError(msg string, err error, kv ...any) error {
	s.Log.Error(msg, append([]any{"error", err}, kv...)...)
	return huma.Error500InternalServerError("database")
}
