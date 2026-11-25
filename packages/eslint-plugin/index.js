import { eslintCompatPlugin } from '@oxlint/plugins'

import noNavigateRule from './rules/no-navigate-after-modal-close.js'
import structuredLogEvent from './rules/structured-log-event.js'

export default eslintCompatPlugin({
	meta: { name: 'bbplayer' },
	rules: {
		'no-navigate-after-modal-close': noNavigateRule,
		'structured-log-event': structuredLogEvent,
	},
})
