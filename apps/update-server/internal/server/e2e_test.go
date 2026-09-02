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
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/config"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/objectstore"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/server"
	"github.com/bbplayer-app/BBPlayer/apps/update-server/internal/store"
	"github.com/google/uuid"
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
	if _, err = db.Pool.Exec(ctx, "TRUNCATE update_events, patches, channel_history, channel_heads, assets, updates, source_commits, update_groups CASCADE"); err != nil {
		t.Fatal(err)
	}

	s := server.NewWithObjectStore(config.Config{PublicBaseURL: "http://unused", AdminToken: "admin", InstallationHMACKey: "01234567890123456789012345678901"}, db, objectstore.NewMemory())
	h := httptest.NewServer(s.Router())
	defer h.Close()
	s.C.PublicBaseURL = h.URL
	firstGroup := publish(t, h.URL, archive(t), "first")
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
	asset := request(t, http.MethodGet, decoded.LaunchAsset.URL, nil, nil)
	b, _ := io.ReadAll(asset.Body)
	_ = asset.Body.Close()
	if asset.StatusCode != http.StatusOK || len(b) == 0 {
		t.Fatalf("asset delivery failed: %s", asset.Status)
	}
	var firstUpdate uuid.UUID
	if err := db.Pool.QueryRow(ctx, "SELECT id FROM updates WHERE group_id=$1 AND platform='android'", firstGroup).Scan(&firstUpdate); err != nil {
		t.Fatal(err)
	}
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
	event := map[string]any{"event_id": uuid.New(), "schema_version": 1, "event_type": "launch_succeeded", "occurred_at": time.Now().UTC(), "installation_id": "device-id", "client_version": "1", "client_build_version": "1", "expo_updates_version": "57", "updates_protocol_version": "1", "platform": "android", "runtime_version": "1", "channel": "test", "launched_update_id": decoded.ID, "embedded_update_id": nil, "update_group_id": nil, "launch_source": "ota", "payload": map[string]any{}}
	missingRequired := make(map[string]any, len(event))
	for key, value := range event {
		missingRequired[key] = value
	}
	delete(missingRequired, "embedded_update_id")
	missingRequiredBody, _ := json.Marshal(missingRequired)
	if r := request(t, http.MethodPost, h.URL+"/api/events", missingRequiredBody, nil); r.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing event field status: %s", r.Status)
	}
	body, _ := json.Marshal(event)
	if r := request(t, http.MethodPost, h.URL+"/api/events", body, nil); r.StatusCode != http.StatusAccepted {
		t.Fatalf("event status: %s", r.Status)
	}
	if r := request(t, http.MethodPost, h.URL+"/api/events", body, nil); r.StatusCode != http.StatusAccepted {
		t.Fatalf("idempotent event status: %s", r.Status)
	}
	var count int
	if err := db.Pool.QueryRow(ctx, "SELECT count(*) FROM update_events WHERE id=$1", event["event_id"]).Scan(&count); err != nil || count != 1 {
		t.Fatalf("event idempotency: %d %v", count, err)
	}
	insights := request(t, http.MethodGet, h.URL+"/admin/insights?channel=test", nil, map[string]string{"Authorization": "Bearer admin"})
	insightBody, _ := io.ReadAll(insights.Body)
	_ = insights.Body.Close()
	if insights.StatusCode != http.StatusOK || !bytes.Contains(insightBody, []byte(`"unique_users":1`)) || !bytes.Contains(insightBody, []byte(`"bsdiff_fallbacks":1`)) {
		t.Fatalf("insights response: %s %s", insights.Status, insightBody)
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
func publish(t *testing.T, base string, archive []byte, message string) uuid.UUID {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	req := `{"channel":"test","runtime_version":"1","message":"` + message + `","source":{"commit_sha":"` + uuid.NewString() + `","working_tree_clean":true},"fingerprint":{"hash":"fingerprint-1","sources":[{"type":"contents","id":"fixture","reasons":["test"],"hash":"fixture"}]}}`
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
