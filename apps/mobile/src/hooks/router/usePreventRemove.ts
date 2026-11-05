import { usePreventRemove as useRouterPreventRemove } from 'expo-router/react-navigation'

export default function usePreventRemove(
	shouldPrevent: boolean,
	callback: NonNullable<Parameters<typeof useRouterPreventRemove>[1]>,
) {
	useRouterPreventRemove(shouldPrevent, callback)
}
