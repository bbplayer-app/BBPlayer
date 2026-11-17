import noNavigateRule from './rules/no-navigate-after-modal-close.js'
import structuredLogEvent from './rules/structured-log-event.js'

export default {
	rules: {
		'no-navigate-after-modal-close': noNavigateRule,
		'structured-log-event': structuredLogEvent,
	},
}
