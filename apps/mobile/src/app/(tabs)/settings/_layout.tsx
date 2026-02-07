import { Stack } from 'expo-router'

export default function SettingsLayout() {
	return (
		<Stack
			screenOptions={{
				headerShown: false,
			}}
		>
			<Stack.Screen name='index' />
			<Stack.Screen name='appearance' />
			<Stack.Screen name='playback' />
			<Stack.Screen name='general' />
			<Stack.Screen name='lyrics' />
			<Stack.Screen name='donate' />
		</Stack>
	)
}
