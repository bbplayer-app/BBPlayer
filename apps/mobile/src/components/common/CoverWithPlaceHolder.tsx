import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { memo, useMemo, useState } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, Text, useColorScheme } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { runes } from 'runes2'

import { getGradientColors } from '@/utils/color'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'

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
	 * 封面图片源 (URL string or ImageRef)
	 */
	cover?: string | null | undefined | ImageRef
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
 * 没有 cover 或图片加载失败时显示渐变和首字母；有 cover 时只渲染图片，加载完成前用渐变的起始色垫底。
 * 列表里每一行都有一个封面，不常驻占位符能少挂载两个原生视图，冷启动首屏更轻。
 */
const CoverWithPlaceHolder = memo(function CoverWithPlaceHolder({
	id,
	title,
	cover,
	size,
	borderRadius,
	cachePolicy = 'disk',
	style,
}: CoverWithPlaceHolderProps) {
	const colorScheme = useColorScheme()
	const isDark: boolean = colorScheme === 'dark'

	const computedBorderRadius = borderRadius ?? size * 0.22

	const validTitle = title.trim()

	const { color1, color2 } = getGradientColors(
		validTitle ? validTitle : String(id),
		isDark,
	)

	const firstChar =
		validTitle.length > 0 ? runes(validTitle)[0].toUpperCase() : undefined

	const coverSource = useMemo(() => {
		if (typeof cover === 'string') {
			const resolvedUri = resolveBilibiliImageUrl(cover, 400)

			return resolvedUri ? { uri: resolvedUri } : cover
		}

		return cover
	}, [cover])

	// 记录失败的是哪个 cover，列表复用本组件换了 cover 后自然重置
	const [failedCover, setFailedCover] = useState<typeof cover>(undefined)
	const showPlaceholder = !coverSource || failedCover === cover

	const policy =
		typeof cover === 'string' && cover.startsWith('file://')
			? 'none'
			: cachePolicy

	return (
		<SquircleView
			style={[
				styles.container,
				{
					width: size,
					height: size,
					borderRadius: computedBorderRadius,
					backgroundColor: color1,
				},
				style,
			]}
			cornerSmoothing={0.6}
		>
			{showPlaceholder ? (
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
			) : (
				<Image
					source={coverSource}
					recyclingKey={String(id)}
					style={[styles.image, { width: size, height: size }]}
					transition={0}
					cachePolicy={policy}
					onError={() => setFailedCover(cover)}
				/>
			)}
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
