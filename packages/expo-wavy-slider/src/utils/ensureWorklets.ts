let worklets: typeof import('react-native-worklets')

try {
	worklets = require('react-native-worklets')
} catch {
	throw new Error(
		'[expo-wavy-slider] react-native-worklets is required. Please install it first.',
	)
}

export { worklets }
