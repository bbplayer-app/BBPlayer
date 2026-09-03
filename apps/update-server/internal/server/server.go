package server

import (
	"context"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/config"
	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/objectstore"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Server struct {
	C       config.Config
	DB      *store.Store
	Objects objectstore.Store
	Log     *slog.Logger
	Signer  *rsa.PrivateKey
	KeyID   string
}

func New(ctx context.Context, c config.Config, db *store.Store) (*Server, error) {
	endpoint := c.R2Endpoint
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.R2AccountID)
	}
	cfg, e := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion("auto"), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(c.R2AccessKeyID, c.R2SecretAccessKey, "")), awsconfig.WithBaseEndpoint(endpoint))
	if e != nil {
		return nil, e
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.UsePathStyle = c.R2Endpoint != "" })
	s := NewWithObjectStore(c, db, objectstore.NewR2(client, c.R2Bucket))
	if c.CodeSigningPrivateKey != "" {
		key, err := parseSigningKey(c.CodeSigningPrivateKey)
		if err != nil {
			return nil, err
		}
		s.Signer, s.KeyID = key, c.CodeSigningKeyID
	}
	return s, nil
}
func NewWithObjectStore(c config.Config, db *store.Store, objects objectstore.Store) *Server {
	return &Server{C: c, DB: db, Objects: objects, Log: slog.Default()}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}

// access logs every HTTP request with its route pattern, status and latency.
// Errors surface above the surrounding noise: 5xx at error level, 4xx at warn,
// everything else at info. Liveness probes stay at debug so pollers do not
// flood the log.
func (s *Server) access(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		wrapped := &statusWriter{ResponseWriter: w}
		next.ServeHTTP(wrapped, r)
		route := r.URL.Path
		if pattern := chi.RouteContext(r.Context()).RoutePattern(); pattern != "" {
			route = pattern
		}
		status := wrapped.status
		if status == 0 {
			status = http.StatusOK
		}
		kv := []any{"method", r.Method, "route", route, "status", status, "duration_ms", time.Since(started).Milliseconds(), "remote", r.RemoteAddr, "user_agent", r.UserAgent()}
		switch {
		case status >= 500:
			s.Log.Error("http request", kv...)
		case status >= 400:
			s.Log.Warn("http request", kv...)
		case route == "/health":
			s.Log.Debug("http request", kv...)
		default:
			s.Log.Info("http request", kv...)
		}
	})
}
func (s *Server) instrument(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		wrapped := &statusWriter{ResponseWriter: w}
		next.ServeHTTP(wrapped, r)
		route := r.URL.Path
		if contextRoute := chi.RouteContext(r.Context()).RoutePattern(); contextRoute != "" {
			route = contextRoute
		}
		if wrapped.status == 0 {
			wrapped.status = http.StatusOK
		}
		if err := s.DB.Queries.RecordServiceMetric(r.Context(), dbq.RecordServiceMetricParams{Route: route, Status: int32(wrapped.status), DurationMs: time.Since(started).Milliseconds()}); err != nil {
			s.Log.Error("service metric: record", "error", err, "route", route, "status", wrapped.status)
		}
	})
}
func (s *Server) admin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !hmac.Equal([]byte(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")), []byte(s.C.AdminToken)) {
			http.Error(w, "unauthorized", 401)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func pgUUID(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: [16]byte(*id), Valid: true}
}

func parseSigningKey(value string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(strings.ReplaceAll(value, `\n`, "\n")))
	if block == nil {
		return nil, fmt.Errorf("CODE_SIGNING_PRIVATE_KEY is not PEM")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("CODE_SIGNING_PRIVATE_KEY is not RSA")
	}
	return rsaKey, nil
}
