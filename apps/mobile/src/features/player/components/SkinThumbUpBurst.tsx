import { memo, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { RNSvgaPlayer, SvgaPlayerRef } from 'rn-newarch-svga-player'

import useSkinStore from '@/hooks/stores/useSkinStore'
import type { AppSkin } from '@/lib/theme/types'
import log from '@/utils/log'

interface SkinThumbUpBurstProps {
	skin: AppSkin | null
	playSignal: number
}

const DISPLAY_SIZE = 96

const SkinThumbUpBurst = memo(function SkinThumbUpBurst({
	skin,
	playSignal,
}: SkinThumbUpBurstProps) {
	const [visible, setVisible] = useState(false)
	const playerRef = useRef<SvgaPlayerRef>(null)

	const thumbUpIndex = useSkinStore((state) => state.activeThumbUpIndex)
	const thumbUp = skin?.thumbUps[thumbUpIndex]
	const animation = thumbUp?.animation
	const playbackDuration = thumbUp?.durationMs ?? 2000

	useEffect(() => {
		if (!animation || playSignal === 0) return

		log.debug('[thumbUp] svga animation start', {
			animation,
			durationMs: playbackDuration,
		})

		const visibleDuration = playbackDuration + 520

		setVisible(true)

		playerRef.current?.startAnimation()

		const hideTimer = setTimeout(() => setVisible(false), visibleDuration)
		return () => {
			clearTimeout(hideTimer)
		}
	}, [animation, playSignal, playbackDuration])

	if (!visible || !animation) return null

	return (
		<View
			pointerEvents='none'
			style={[
				{
					position: 'absolute',
					right: -25,
					bottom: 40,
					width: DISPLAY_SIZE,
					height: DISPLAY_SIZE,
					zIndex: 10,
				},
			]}
		>
			<RNSvgaPlayer
				ref={playerRef}
				source={animation}
				autoPlay={true}
				loops={1}
				clearsAfterStop={false}
				style={{
					width: DISPLAY_SIZE,
					height: DISPLAY_SIZE,
				}}
			/>
		</View>
	)
})

export default SkinThumbUpBurst
