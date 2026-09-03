package server

// ClientEventType is the versioned client telemetry vocabulary accepted by
// POST /api/events. Keep values stable: they are stored and queried as data.
//
// The vocabulary is intentionally minimal: the app currently emits only
// activity / launch_succeeded / launch_failed. Per-update launch and crash
// stats are primarily inferred from expo-updates' manifest request headers
// (see manifest_insights.go); these events carry installation attribution and
// the emergency-launch fallback signal that headers cannot express.
type ClientEventType string

const (
	EventTypeActivity        ClientEventType = "activity"
	EventTypeLaunchSucceeded ClientEventType = "launch_succeeded"
	EventTypeLaunchFailed    ClientEventType = "launch_failed"
)

func (t ClientEventType) valid() bool {
	switch t {
	case EventTypeActivity, EventTypeLaunchSucceeded, EventTypeLaunchFailed:
		return true
	default:
		return false
	}
}

type deliveryMetricKind string

const (
	deliveryMetricManifestServed deliveryMetricKind = "manifest_served"
	deliveryMetricPatch          deliveryMetricKind = "patch"
	deliveryMetricPatchFallback  deliveryMetricKind = "patch_fallback"
	deliveryMetricLaunchBundle   deliveryMetricKind = "launch_bundle"
)

type deliveryMetricOutcome string

const (
	deliveryMetricServed      deliveryMetricOutcome = "served"
	deliveryMetricObjectError deliveryMetricOutcome = "object_error"
	deliveryMetricFallback    deliveryMetricOutcome = "fallback"
)
