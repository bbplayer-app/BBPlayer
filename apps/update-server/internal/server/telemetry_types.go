package server

// EventType is the versioned client telemetry vocabulary accepted by
// POST /api/events. Keep values stable: they are stored and queried as data.
type EventType string

const (
	EventTypeActivity             EventType = "activity"
	EventTypeUpdateCheckStarted   EventType = "update_check_started"
	EventTypeUpdateCheckSucceeded EventType = "update_check_succeeded"
	EventTypeUpdateCheckFailed    EventType = "update_check_failed"
	EventTypeDownloadStarted      EventType = "download_started"
	EventTypeDownloadSucceeded    EventType = "download_succeeded"
	EventTypeDownloadFailed       EventType = "download_failed"
	EventTypeLaunchStarted        EventType = "launch_started"
	EventTypeLaunchSucceeded      EventType = "launch_succeeded"
	EventTypeLaunchHealthy        EventType = "launch_healthy"
	EventTypeLaunchFailed         EventType = "launch_failed"
	EventTypeLaunchCrashed        EventType = "launch_crashed"
	EventTypeErrorRecovery        EventType = "error_recovery"
	EventTypeEmergencyLaunch      EventType = "emergency_launch"
)

func (t EventType) valid() bool {
	switch t {
	case EventTypeActivity,
		EventTypeUpdateCheckStarted, EventTypeUpdateCheckSucceeded, EventTypeUpdateCheckFailed,
		EventTypeDownloadStarted, EventTypeDownloadSucceeded, EventTypeDownloadFailed,
		EventTypeLaunchStarted, EventTypeLaunchSucceeded, EventTypeLaunchHealthy,
		EventTypeLaunchFailed, EventTypeLaunchCrashed, EventTypeErrorRecovery,
		EventTypeEmergencyLaunch:
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
