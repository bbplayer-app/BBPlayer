import Svg, { Path } from 'react-native-svg'

export default function RangeLoopIcon({
	size,
	color,
}: {
	size: number
	color: string
}) {
	return (
		<Svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke={color}
			strokeWidth={1.8}
			strokeLinecap='round'
			strokeLinejoin='round'
			accessible={false}
		>
			{/* 两端标记限定播放区间，单支回返箭头表示回到起点。 */}
			<Path d='M5 4v6m14-6v6M5 7h14' />
			<Path d='M19 13v1a3 3 0 0 1-3 3H5m3-3-3 3 3 3' />
		</Svg>
	)
}
