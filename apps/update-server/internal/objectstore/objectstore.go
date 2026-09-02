package objectstore

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Store deliberately exposes only immutable-object operations needed by the
// update protocol. It keeps HTTP code independent from R2 and makes end-to-end
// protocol tests possible without a Cloudflare account.
type Store interface {
	Put(ctx context.Context, key, contentType string, body []byte) error
	Get(ctx context.Context, key string) (io.ReadCloser, string, error)
}

type R2 struct {
	client *s3.Client
	bucket string
}

func NewR2(client *s3.Client, bucket string) *R2 { return &R2{client: client, bucket: bucket} }

func (r *R2) Put(ctx context.Context, key, contentType string, body []byte) error {
	// Every object key is content-addressed by update/asset identity and must be
	// write-once. R2 honors S3's conditional PutObject header, which prevents a
	// retry or a malformed publisher from replacing a previously published byte.
	_, err := r.client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(r.bucket), Key: aws.String(key), Body: bytes.NewReader(body), ContentType: aws.String(contentType), IfNoneMatch: aws.String("*")})
	return err
}

func (r *R2) Get(ctx context.Context, key string) (io.ReadCloser, string, error) {
	o, err := r.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(r.bucket), Key: aws.String(key)})
	if err != nil {
		return nil, "", err
	}
	return o.Body, aws.ToString(o.ContentType), nil
}

type Memory struct {
	mu      sync.RWMutex
	objects map[string]memoryObject
}
type memoryObject struct {
	body        []byte
	contentType string
}

func NewMemory() *Memory { return &Memory{objects: make(map[string]memoryObject)} }
func (m *Memory) Put(_ context.Context, key, contentType string, body []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.objects[key]; exists {
		return fmt.Errorf("immutable object already exists: %s", key)
	}
	m.objects[key] = memoryObject{body: append([]byte(nil), body...), contentType: contentType}
	return nil
}
func (m *Memory) Get(_ context.Context, key string) (io.ReadCloser, string, error) {
	m.mu.RLock()
	o, ok := m.objects[key]
	m.mu.RUnlock()
	if !ok {
		return nil, "", fmt.Errorf("object not found: %s", key)
	}
	return io.NopCloser(bytes.NewReader(o.body)), o.contentType, nil
}
