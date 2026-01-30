import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { memo } from 'react'
import type { ColorSchemeName, StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, Text, useColorScheme } from 'react-native'
import SquircleView from 'react-native-fast-squircle'

import { getGradientColors } from '@/utils/color'

/**
 * 组件 Props 定义
 */
interface CoverWithPlaceHolderProps {
	/**
	 * 用于 recyclingKey 的唯一 ID (来自 item.id)
	 */
	id: string | number
	/**
	 * 用于生成渐变和首字母的标题 (来自 item.title)
	 */
	title: string
	/**
	 * 封面图片 URL (来自 item.coverUrl)，可以为空
	 */
	coverUrl?: string | null
	/**
	 * 封面/占位符的尺寸（宽高相同）
	 */
	size: number
	/**
	 * 圆角
	 */
	borderRadius?: number
	/**
	 * 允许外部传入的容器样式
	 */
	style?: StyleProp<ViewStyle>
	/**
	 * 图片缓存策略
	 */
	cachePolicy?: 'none' | 'memory' | 'disk' | 'memory-disk' | null | undefined
}

/**
 * 一个带渐变占位符的封面组件
 * 它会始终显示渐变占位符，如果 coverUrl 存在，
 * 则会将图片淡入显示在占位符之上。
 */
const CoverWithPlaceHolder = memo(function CoverWithPlaceHolder({
	id,
	title,
	coverUrl,
	size,
	borderRadius,
	cachePolicy = 'none',
	style,
}: CoverWithPlaceHolderProps) {
	const colorScheme: ColorSchemeName = useColorScheme()
	const isDark: boolean = colorScheme === 'dark'

	const computedBorderRadius = borderRadius ?? size * 0.22

	const validTitle = title.trim()
	const { color1, color2 } = getGradientColors(
		validTitle ? validTitle : String(id),
		isDark,
	)

	const firstChar =
		validTitle.length > 0 ? [...validTitle][0].toUpperCase() : undefined

	return (
		<SquircleView
			style={[
				styles.container,
				{ width: size, height: size, borderRadius: computedBorderRadius },
				style,
			]}
			cornerSmoothing={0.6}
		>
			<LinearGradient
				colors={[color1, color2]}
				style={styles.gradient}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
			>
				<Text style={[styles.placeholderText, { fontSize: size * 0.45 }]}>
					{firstChar}
				</Text>
			</LinearGradient>

			<Image
				source={{ uri: coverUrl ?? undefined }}
				recyclingKey={String(id)}
				style={[styles.image, { width: size, height: size }]}
				transition={300}
				cachePolicy={cachePolicy}
			/>
		</SquircleView>
	)
})

const styles = StyleSheet.create({
	container: {
		overflow: 'hidden',
	},
	gradient: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	placeholderText: {
		fontWeight: 'bold',
		color: 'rgba(255, 255, 255, 0.7)',
	},
	image: {
		position: 'absolute',
		left: 0,
		top: 0,
	},
})

CoverWithPlaceHolder.displayName = 'CoverWithPlaceHolder'

export default CoverWithPlaceHolder
