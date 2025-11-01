import { useNavigation } from 'expo-router'
import { useEffect } from 'react'

export default function usePreventRemove(
	shouldPrevent: boolean,
	callback: () => void,
) {
	const navigation = useNavigation()
	useEffect(() => {
		const listener = navigation.addListener('beforeRemove', (e) => {
			if (shouldPrevent) {
				e.preventDefault()
				callback()
			}
		})
		return () => {
			navigation.removeListener('beforeRemove', listener)
		}
	}, [shouldPrevent, callback, navigation])
}
