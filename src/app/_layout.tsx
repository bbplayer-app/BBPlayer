import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { NavigationService } from '@/lib/router/NavigationService'

export default function RootLayout() {
	const router = useRouter()

	useEffect(() => {
		const onNavigate = ({ path, params }: { path: string; params?: Record<string, any> }) => {
			router.push({ pathname: path, params });
		};

		NavigationService.events.on('navigate', onNavigate);

		return () => {
			NavigationService.events.off('navigate', onNavigate);
		};
	}, [router]);

	return (
		<Stack>
			<Stack.Screen
				name='(tabs)'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='player'
				options={{
					animation: 'slide_from_bottom',
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name='test'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='playlist/remote/search-result/global/[query]'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='playlist/remote/collection/[id]'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='playlist/remote/favorite/[id]'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='playlist/remote/multipage/[bvid]'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='playlist/remote/uploader/[mid]'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='playlist/remote/search-result/fav/[query]'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='playlist/local/[id]'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='leaderboard'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='download'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='not-found'
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name='modal-host'
				options={{
					presentation: 'transparentModal',
					gestureEnabled: false,
					animation: 'fade',
					headerShown: false,
				}}
			/>
		</Stack>
	)
}
