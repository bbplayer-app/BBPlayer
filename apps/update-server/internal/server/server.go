package server

import (
	"context"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
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
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/objectstore"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/prometheus/client_golang/prometheus"
)

type Server struct {
	C       config.Config
	DB      *store.Store
	Objects objectstore.Store
	Log     *slog.Logger
	Signer  *rsa.PrivateKey
	KeyID   string
	Metrics *metrics
}
type metrics struct {
	registry *prometheus.Registry
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
}

func newMetrics() *metrics {
	r := prometheus.NewRegistry()
	m := &metrics{registry: r, requests: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "bbplayer_updates_http_requests_total", Help: "Update service responses"}, []string{"route", "status"}), duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "bbplayer_updates_http_duration_seconds", Help: "Update service request durations"}, []string{"route"})}
	r.MustRegister(m.requests, m.duration)
	return m
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
	return &Server{C: c, DB: db, Objects: objects, Log: slog.Default(), Metrics: newMetrics()}
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
		s.Metrics.requests.WithLabelValues(route, fmt.Sprint(wrapped.status)).Inc()
		s.Metrics.duration.WithLabelValues(route).Observe(time.Since(started).Seconds())
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
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// logError records a server-side error that a handler is about to fold into a
// generic HTTP response, so operators can tell failures apart.
func (s *Server) logError(r *http.Request, msg string, err error, kv ...any) {
	s.Log.Error(msg, append([]any{"error", err, "method", r.Method, "path", r.URL.Path}, kv...)...)
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
