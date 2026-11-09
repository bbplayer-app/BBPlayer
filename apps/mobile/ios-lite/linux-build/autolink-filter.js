// Runs Expo's community autolinking for iOS and drops native modules the first iOS build leaves out.
const { execFileSync } = require('child_process')
const DENY = new Set([
	'@react-native-firebase/app',
	'@react-native-firebase/analytics',
	'@sentry/react-native',
	'react-native-release-profiler',
])
const out = execFileSync(
	process.execPath,
	[
		'--no-warnings',
		'--eval',
		"require('expo/bin/autolinking')",
		'expo-modules-autolinking',
		'react-native-config',
		'--json',
		'--platform',
		'ios',
	],
	{ encoding: 'utf8', maxBuffer: 1 << 28 },
)
const json = JSON.parse(out)
for (const name of Object.keys(json.dependencies || {}))
	if (DENY.has(name)) delete json.dependencies[name]
process.stdout.write(JSON.stringify(json))
