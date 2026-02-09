import { useEffect, useState } from 'react'
import { Dimensions, type ScaledSize } from 'react-native'

export function useScreenDimensions() {
	const [dimensions, setDimensions] = useState(() => Dimensions.get('screen'))

	useEffect(() => {
		const subscription = Dimensions.addEventListener(
			'change',
			({ screen }: { screen: ScaledSize }) => {
				setDimensions(screen)
			},
		)

		return () => subscription.remove()
	}, [])

	return dimensions
}
