package server_test

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"maps"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/config"
	dbq "github.com/bbplayer-app/BBPlayer/apps/update-server/internal/database/sqlc"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/objectstore"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/server"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// This suite is intentionally opt-in: it exercises the real PostgreSQL schema
// and the Expo HTTP surface, while replacing only R2 byte storage with Memory.
// Run with E2E_DATABASE_URL=postgres://... go test ./internal/server -run E2E.
func TestE2EExpoProtocol(t *testing.T) {
	url := os.Getenv("E2E_DATABASE_URL")
	if url == "" {
		t.Skip("set E2E_DATABASE_URL to run PostgreSQL protocol integration tests")
	}
	ctx := context.Background()
	db, err := store.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = db.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Pool.Exec(ctx, "TRUNCATE service_metric_minutes, delivery_metric_minutes, update_events, patches, channel_history, channel_heads, assets, updates, source_commits, update_groups CASCADE"); err != nil {
		t.Fatal(err)
	}

	s := server.NewWithObjectStore(config.Config{PublicBaseURL: "http://unused", AdminToken: "admin", InstallationHMACKey: "01234567890123456789012345678901"}, db, objectstore.NewMemory())
	h := httptest.NewServer(s.Router())
	defer h.Close()
	s.C.PublicBaseURL = h.URL
	if r := request(t, http.MethodGet, h.URL+"/admin/openapi.json", nil, nil); r.StatusCode != http.StatusUnauthorized {
		_ = r.Body.Close()
		t.Fatalf("unauthenticated OpenAPI status: %s", r.Status)
	}
	spec := request(t, http.MethodGet, h.URL+"/admin/openapi.json", nil, map[string]string{"Authorization": "Bearer admin"})
	var openAPI struct {
		OpenAPI string                     `json:"openapi"`
		Paths   map[string]json.RawMessage `json:"paths"`
	}
	if err := json.NewDecoder(spec.Body).Decode(&openAPI); err != nil {
		_ = spec.Body.Close()
		t.Fatal(err)
	}
	_ = spec.Body.Close()
	if openAPI.OpenAPI != "3.1.0" || len(openAPI.Paths) != 16 {
		t.Fatalf("admin OpenAPI document: version=%q paths=%d", openAPI.OpenAPI, len(openAPI.Paths))
	}
	for _, path := range []string{"/admin/publish", "/admin/updates/{id}", "/admin/channels/{channel}/rollback", "/admin/source/compare/{from}/{to}", "/admin/insights/groups/{groupID}/lifecycle", "/admin/metrics/delivery"} {
		if _, ok := openAPI.Paths[path]; !ok {
			t.Fatalf("admin OpenAPI missing path %q", path)
		}
	}
	noHead := request(t, http.MethodGet, h.URL+"/api/manifest", nil, map[string]string{"expo-platform": "android", "expo-runtime-version": "1", "expo-channel-name": "test"})
	if noHead.StatusCode != http.StatusNoContent || noHead.Header.Get("expo-protocol-version") != "1" {
		_ = noHead.Body.Close()
		t.Fatalf("no-head manifest response: status=%s protocol=%q", noHead.Status, noHead.Header.Get("expo-protocol-version"))
	}
	_ = noHead.Body.Close()
	// Android appVersion runtime policies deliberately omit fingerprint metadata.
	// Keep this wire case covered so Huma does not make it required again.
	firstGroup := publish(t, h.URL, archive(t), "first", false)
	secondGroup := publish(t, h.URL, archive(t), "second")
	compare := request(t, http.MethodGet, h.URL+"/admin/source/compare/"+firstGroup.String()+"/"+secondGroup.String(), nil, map[string]string{"Authorization": "Bearer admin"})
	compareBody, _ := io.ReadAll(compare.Body)
	_ = compare.Body.Close()
	if compare.StatusCode != http.StatusOK || !bytes.Contains(compareBody, []byte(`"from_artifacts"`)) || !bytes.Contains(compareBody, []byte(`"launch_bundle_sha256"`)) {
		t.Fatalf("source compare response: %s %s", compare.Status, compareBody)
	}
	latest := request(t, http.MethodGet, h.URL+"/admin/source/latest?channel=test&runtime_version=1", nil, map[string]string{"Authorization": "Bearer admin"})
	latestBody, _ := io.ReadAll(latest.Body)
	_ = latest.Body.Close()
	if latest.StatusCode != http.StatusOK || !bytes.Contains(latestBody, []byte(`"commit_sha"`)) {
		t.Fatalf("source latest response: %s %s", latest.Status, latestBody)
	}
	manifest := request(t, http.MethodGet, h.URL+"/api/manifest", nil, map[string]string{"expo-platform": "android", "expo-runtime-version": "1", "expo-channel-name": "test"})
	if manifest.StatusCode != http.StatusOK {
		t.Fatalf("manifest status: %s", manifest.Status)
	}
	var decoded struct {
		ID          uuid.UUID `json:"id"`
		LaunchAsset struct {
			URL  string `json:"url"`
			Hash string `json:"hash"`
		} `json:"launchAsset"`
	}
	if err := json.NewDecoder(manifest.Body).Decode(&decoded); err != nil {
		t.Fatal(err)
	}
	_ = manifest.Body.Close()
	current := request(t, http.MethodGet, h.URL+"/api/manifest", nil, map[string]string{"expo-platform": "android", "expo-runtime-version": "1", "expo-channel-name": "test", "Expo-Current-Update-ID": decoded.ID.String()})
	if current.StatusCode != http.StatusNoContent || current.Header.Get("expo-protocol-version") != "1" {
		_ = current.Body.Close()
		t.Fatalf("current-head manifest response: status=%s protocol=%q", current.Status, current.Header.Get("expo-protocol-version"))
	}
	_ = current.Body.Close()
	asset := request(t, http.MethodGet, decoded.LaunchAsset.URL, nil, nil)
	b, _ := io.ReadAll(asset.Body)
	_ = asset.Body.Close()
	if asset.StatusCode != http.StatusOK || len(b) == 0 {
		t.Fatalf("asset delivery failed: %s", asset.Status)
	}
	update, err := db.Queries.GetUpdateForGroupPlatform(ctx, dbq.GetUpdateForGroupPlatformParams{GroupID: pgtype.UUID{Bytes: [16]byte(firstGroup), Valid: true}, Platform: "android"})
	if err != nil {
		t.Fatal(err)
	}
	firstUpdate := uuid.UUID(update.ID.Bytes)
	stale := request(t, http.MethodGet, h.URL+"/api/manifest", nil, map[string]string{"expo-platform": "android", "expo-runtime-version": "1", "expo-channel-name": "test", "Expo-Current-Update-ID": firstUpdate.String()})
	if stale.StatusCode != http.StatusOK {
		_ = stale.Body.Close()
		t.Fatalf("stale manifest response: %s", stale.Status)
	}
	_ = stale.Body.Close()
	// The second update owns a pending adjacent patch. Expo's bsdiff request
	// must safely receive the full bundle until a worker marks it ready.
	fallback := request(t, http.MethodGet, decoded.LaunchAsset.URL, nil, map[string]string{"A-IM": "bsdiff", "Expo-Current-Update-ID": firstUpdate.String()})
	fallbackBody, _ := io.ReadAll(fallback.Body)
	_ = fallback.Body.Close()
	if fallback.StatusCode != http.StatusOK || !bytes.Equal(fallbackBody, b) {
		t.Fatalf("pending patch should fall back to full asset: %s", fallback.Status)
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	s.Signer, s.KeyID = key, "test"
	signed := request(t, http.MethodGet, h.URL+"/api/manifest", nil, map[string]string{"expo-platform": "android", "expo-runtime-version": "1", "expo-channel-name": "test", "expo-expect-signature": "sig, keyid=\"test\", alg=\"rsa-v1_5-sha256\""})
	signedBody, _ := io.ReadAll(signed.Body)
	_ = signed.Body.Close()
	signatureHeader := signed.Header.Get("expo-signature")
	parts := strings.Split(signatureHeader, ":")
	if len(parts) < 3 {
		t.Fatalf("invalid signature header: %q", signatureHeader)
	}
	signature, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(signedBody)
	if err = rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, digest[:], signature); err != nil {
		t.Fatalf("signature verification: %v", err)
	}

	bad := []byte(`{"schema_version":1}`)
	if r := request(t, http.MethodPost, h.URL+"/api/events", bad, nil); r.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid event status: %s", r.Status)
	}
	// Mobile clients know the running update ID but not the server-side group ID;
	// the event endpoint must resolve that association before aggregating insights.
	event := map[string]any{"event_id": uuid.New(), "schema_version": 1, "event_type": string(server.EventTypeLaunchSucceeded), "occurred_at": time.Now().UTC(), "installation_id": "device-id", "client_version": "1", "client_build_version": "1", "expo_updates_version": "57", "updates_protocol_version": "1", "platform": "android", "runtime_version": "1", "channel": "test", "launched_update_id": decoded.ID, "embedded_update_id": nil, "update_group_id": nil, "launch_source": "ota", "payload": map[string]any{}}
	missingRequired := make(map[string]any, len(event))
	maps.Copy(missingRequired, event)
	delete(missingRequired, "embedded_update_id")
	missingRequiredBody, _ := json.Marshal(missingRequired)
	if r := request(t, http.MethodPost, h.URL+"/api/events", missingRequiredBody, nil); r.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing event field status: %s", r.Status)
	}
	unknownEvent := make(map[string]any, len(event))
	maps.Copy(unknownEvent, event)
	unknownEvent["event_id"] = uuid.New()
	unknownEvent["event_type"] = "future_event_without_schema_upgrade"
	unknownEventBody, _ := json.Marshal(unknownEvent)
	if r := request(t, http.MethodPost, h.URL+"/api/events", unknownEventBody, nil); r.StatusCode != http.StatusBadRequest {
		t.Fatalf("unknown event type status: %s", r.Status)
	}
	body, _ := json.Marshal(event)
	if r := request(t, http.MethodPost, h.URL+"/api/events", body, nil); r.StatusCode != http.StatusAccepted {
		t.Fatalf("event status: %s", r.Status)
	}
	if r := request(t, http.MethodPost, h.URL+"/api/events", body, nil); r.StatusCode != http.StatusAccepted {
		t.Fatalf("idempotent event status: %s", r.Status)
	}
	crashEvent := make(map[string]any, len(event))
	maps.Copy(crashEvent, event)
	crashEvent["event_id"] = uuid.New()
	crashEvent["event_type"] = string(server.EventTypeLaunchFailed)
	crashBody, _ := json.Marshal(crashEvent)
	if r := request(t, http.MethodPost, h.URL+"/api/events", crashBody, nil); r.StatusCode != http.StatusAccepted {
		t.Fatalf("crash event status: %s", r.Status)
	}
	var count int64
	if err := db.Pool.QueryRow(ctx, "SELECT count(*) FROM update_events WHERE id=$1", pgtype.UUID{Bytes: [16]byte(event["event_id"].(uuid.UUID)), Valid: true}).Scan(&count); err != nil || count != 1 {
		t.Fatalf("event idempotency: %d %v", count, err)
	}
	insights := request(t, http.MethodGet, h.URL+"/admin/insights?channel=test", nil, map[string]string{"Authorization": "Bearer admin"})
	insightBody, _ := io.ReadAll(insights.Body)
	_ = insights.Body.Close()
	if insights.StatusCode != http.StatusOK || !bytes.Contains(insightBody, []byte(`"unique_users":1`)) || !bytes.Contains(insightBody, []byte(`"bsdiff_fallbacks":1`)) {
		t.Fatalf("insights response: %s %s", insights.Status, insightBody)
	}
	deliveryMetrics := request(t, http.MethodGet, h.URL+"/admin/metrics/delivery?channel=test", nil, map[string]string{"Authorization": "Bearer admin"})
	deliveryMetricBody, _ := io.ReadAll(deliveryMetrics.Body)
	_ = deliveryMetrics.Body.Close()
	if deliveryMetrics.StatusCode != http.StatusOK || !bytes.Contains(deliveryMetricBody, []byte(`"kind":"launch_bundle"`)) || !bytes.Contains(deliveryMetricBody, []byte(`"kind":"patch_fallback"`)) {
		t.Fatalf("delivery metric response: %s %s", deliveryMetrics.Status, deliveryMetricBody)
	}
	serviceMetrics := request(t, http.MethodGet, h.URL+"/admin/metrics/service", nil, map[string]string{"Authorization": "Bearer admin"})
	serviceMetricBody, _ := io.ReadAll(serviceMetrics.Body)
	_ = serviceMetrics.Body.Close()
	if serviceMetrics.StatusCode != http.StatusOK || !bytes.Contains(serviceMetricBody, []byte(`"requests":`)) {
		t.Fatalf("service metric response: %s %s", serviceMetrics.Status, serviceMetricBody)
	}
	lifecycle := request(t, http.MethodGet, h.URL+"/admin/insights/groups/"+secondGroup.String()+"/lifecycle", nil, map[string]string{"Authorization": "Bearer admin"})
	lifecycleBody, _ := io.ReadAll(lifecycle.Body)
	_ = lifecycle.Body.Close()
	if lifecycle.StatusCode != http.StatusOK || !bytes.Contains(lifecycleBody, []byte(`"known_launches":1`)) || !bytes.Contains(lifecycleBody, []byte(`"known_crashes":1`)) {
		t.Fatalf("lifecycle insight response: %s %s", lifecycle.Status, lifecycleBody)
	}
	rollback := []byte(`{"runtime_version":"1","platform":"android","mode":"embedded"}`)
	if r := request(t, http.MethodPost, h.URL+"/admin/channels/test/rollback", rollback, map[string]string{"Authorization": "Bearer admin", "Content-Type": "application/json"}); r.StatusCode != http.StatusOK {
		t.Fatalf("embedded rollback status: %s", r.Status)
	}
	directive := request(t, http.MethodGet, h.URL+"/api/manifest", nil, map[string]string{"expo-platform": "android", "expo-runtime-version": "1", "expo-channel-name": "test", "Accept": "multipart/mixed"})
	directiveBody, _ := io.ReadAll(directive.Body)
	_ = directive.Body.Close()
	if directive.StatusCode != http.StatusOK || !bytes.Contains(directiveBody, []byte("rollBackToEmbedded")) || !strings.HasPrefix(directive.Header.Get("Content-Type"), "multipart/mixed") {
		t.Fatalf("directive response: %s %s", directive.Status, directive.Header.Get("Content-Type"))
	}
}

func archive(t *testing.T) []byte {
	t.Helper()
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	meta := `{"fileMetadata":{"android":{"bundle":"_expo/static/js/android/index.hbc","assets":[{"path":"assets/a.png","ext":"png"}]}}}`
	for name, data := range map[string]string{"metadata.json": meta, "expoConfig.json": `{"runtimeVersion":"1"}`, "_expo/static/js/android/index.hbc": "hermes bundle", "assets/a.png": "asset"} {
		w, err := z.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = w.Write([]byte(data)); err != nil {
			t.Fatal(err)
		}
	}
	if err := z.Close(); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}
func publish(t *testing.T, base string, archive []byte, message string, withFingerprint ...bool) uuid.UUID {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fingerprint := `,"fingerprint":{"hash":"1","sources":[{"type":"contents","id":"fixture","reasons":["test"],"hash":"fixture"}]}`
	if len(withFingerprint) > 0 && !withFingerprint[0] {
		fingerprint = ""
	}
	req := `{"channel":"test","runtime_version":"1","message":"` + message + `","source":{"commit_sha":"` + uuid.NewString() + `","working_tree_clean":true}` + fingerprint + `}`
	if err := mw.WriteField("request", req); err != nil {
		t.Fatal(err)
	}
	part, err := mw.CreateFormFile("archive", "export.zip")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = part.Write(archive); err != nil {
		t.Fatal(err)
	}
	_ = mw.Close()
	r := request(t, http.MethodPost, base+"/admin/publish", body.Bytes(), map[string]string{"Authorization": "Bearer admin", "Content-Type": mw.FormDataContentType()})
	if r.StatusCode != http.StatusCreated {
		t.Fatalf("publish status: %s", r.Status)
	}
	var response struct {
		GroupID uuid.UUID `json:"group_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&response); err != nil || response.GroupID == uuid.Nil {
		t.Fatalf("publish response: %v", err)
	}
	_ = r.Body.Close()
	return response.GroupID
}
func request(t *testing.T, method, url string, body []byte, headers map[string]string) *http.Response {
	t.Helper()
	r, err := http.NewRequest(method, url, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	res, err := http.DefaultClient.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	return res
}
