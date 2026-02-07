import { Skia } from '@shopify/react-native-skia'
import type {
	SkParagraph,
	SkPicture,
	SkTypefaceFontProvider,
} from '@shopify/react-native-skia'
import { useEffect } from 'react'
import { useTheme } from 'react-native-paper'
import type { SharedValue } from 'react-native-reanimated'
import {
	useAnimatedReaction,
	useFrameCallback,
	useSharedValue,
} from 'react-native-reanimated'

import type { BilibiliDanmakuItem } from '@/types/apis/bilibili'

import { CONFIG } from './constants'

interface ActiveBullet {
	paragraph: SkParagraph
	x: number
	y: number
	width: number
	opacity: number
	vx: number
	birthTime: number
}

function binarySearch(data: BilibiliDanmakuItem[], targetTime: number): number {
	'worklet'
	let left = 0
	let right = data.length - 1
	let result = data.length

	while (left <= right) {
		const mid = Math.floor((left + right) / 2)
		if (data[mid].progress >= targetTime) {
			result = mid
			right = mid - 1
		} else {
			left = mid + 1
		}
	}
	return result
}

const createBlankPicture = () => {
	const recorder = Skia.PictureRecorder()
	recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1))
	return recorder.finishRecordingAsPicture()
}

/**
 * Heuristic to find the best track for a scrolling bullet.
 * Prefers middle tracks, avoids overlapping.
 */
function findBestScrollTrack(tracks: number[], width: number) {
	'worklet'
	const totalTracks = tracks.length
	const reserve = totalTracks > 6 ? 2 : 0
	const startTrack = reserve
	const endTrack = totalTracks - reserve

	const validTracks: number[] = []
	let minRightX = Number.POSITIVE_INFINITY

	for (let i = startTrack; i < endTrack; i++) {
		const rightX = tracks[i]

		if (rightX < minRightX - 1) {
			minRightX = rightX
			validTracks.length = 0
			validTracks.push(i)
		} else if (rightX < minRightX + 1) {
			validTracks.push(i)
		}
	}

	if (validTracks.length > 0 && minRightX + CONFIG.SAFE_GAP < width) {
		const idx = Math.floor(Math.random() * validTracks.length)
		return validTracks[idx]
	}
	return -1
}

export const useDanmakuRender = ({
	rawDataSV,
	currentTime,
	isPlaying,
	fontMgr,
	width,
	height,
	fontFamilyName,
	enabled,
}: {
	rawDataSV: SharedValue<BilibiliDanmakuItem[]>
	currentTime: SharedValue<number>
	isPlaying: boolean
	fontMgr: SkTypefaceFontProvider | null
	width: number
	height: number
	fontFamilyName: string
	enabled: boolean
}) => {
	const defaultColor = useTheme().colors.primary
	const activeBullets = useSharedValue<ActiveBullet[]>([])
	const tracks = useSharedValue<number[]>(new Array<number>(1).fill(0))
	const staticTopTracks = useSharedValue<number[]>(new Array<number>(1).fill(0))
	const staticBottomTracks = useSharedValue<number[]>(
		new Array<number>(1).fill(0),
	)
	const heightSV = useSharedValue(height)

	useEffect(() => {
		heightSV.value = height
	}, [height, heightSV])

	const cursor = useSharedValue(0)
	const picture = useSharedValue<SkPicture>(createBlankPicture())

	const resetEngine = (targetTime: number) => {
		activeBullets.set([])
		const newTracksCount = Math.max(
			Math.floor(heightSV.value / CONFIG.LINE_HEIGHT),
			1,
		)
		tracks.set(new Array<number>(newTracksCount).fill(0))
		staticTopTracks.set(new Array<number>(newTracksCount).fill(0))
		staticBottomTracks.set(new Array<number>(newTracksCount).fill(0))
		cursor.set(binarySearch(rawDataSV.value, targetTime))
	}

	useAnimatedReaction(
		() => heightSV.value,
		(newHeight, oldHeight) => {
			if (newHeight === oldHeight) return
			const newTrackCount = Math.max(
				Math.floor(newHeight / CONFIG.LINE_HEIGHT),
				1,
			)

			tracks.set(new Array<number>(newTrackCount).fill(0))
			staticTopTracks.set(new Array<number>(newTrackCount).fill(0))
			staticBottomTracks.set(new Array<number>(newTrackCount).fill(0))
		},
	)

	useFrameCallback((info) => {
		if (!enabled || !isPlaying || !currentTime || !fontMgr) return

		const now = currentTime.value
		const dt = info.timeSincePreviousFrame ?? 0
		const scrollMoveDist = CONFIG.SPEED * dt

		tracks.modify((t) => {
			'worklet'
			for (let i = 0; i < t.length; i++) {
				if (t[i] > -9999) {
					t[i] -= scrollMoveDist
				}
			}
			return t
		})

		const MAX_SPAWN_PER_FRAME = 10
		let spawnedCount = 0

		while (
			cursor.value < rawDataSV.value.length &&
			spawnedCount < MAX_SPAWN_PER_FRAME
		) {
			const item = rawDataSV.value[cursor.value]

			if (item.progress > now) break

			if (item.progress < now - 5000) {
				cursor.value++
				continue
			}

			spawnedCount++

			const strColor = item.color?.toString(16)
			const color = item.color
				? Skia.Color(`#${strColor}`)
				: Skia.Color(defaultColor)

			let fontSize = CONFIG.FONT_SIZE
			if (item.fontsize === 18) fontSize = 12
			else if (item.fontsize === 25) fontSize = 16
			else if (item.fontsize === 36) fontSize = 22

			const isBlack = item.color === 0

			const shadows = isBlack
				? undefined
				: [
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: 1, y: 1 },
						},
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: -1, y: -1 },
						},
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: 1, y: -1 },
						},
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: -1, y: 1 },
						},
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: 1, y: 0 },
						},
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: -1, y: 0 },
						},
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: 0, y: 1 },
						},
						{
							blurRadius: 0,
							color: Skia.Color('black'),
							offset: { x: 0, y: -1 },
						},
					]

			const builder = Skia.ParagraphBuilder.Make(
				{
					maxLines: 1,
					textStyle: {
						fontSize,
						color,
						fontFamilies: [fontFamilyName],
						shadows,
					},
				},
				fontMgr,
			)
			builder.addText(item.content)
			const paragraph = builder.build()
			paragraph.layout(Number.POSITIVE_INFINITY)
			const textWidth = paragraph.getMinIntrinsicWidth()
			const mode = item.mode || 1

			if (mode === 5) {
				staticTopTracks.modify((t) => {
					'worklet'
					for (let i = 0; i < t.length; i++) {
						const index = i
						if (t[i] <= now) {
							t[i] = now + 4000
							activeBullets.modify((bullets) => {
								bullets.push({
									paragraph,
									x: (width - textWidth) / 2,
									y: index * CONFIG.LINE_HEIGHT + 10,
									width: textWidth,
									opacity: CONFIG.OPACITY,
									vx: 0,
									birthTime: now,
								})
								return bullets
							})
							break
						}
					}
					return t
				})
			} else if (mode === 4) {
				staticBottomTracks.modify((t) => {
					'worklet'
					for (let i = 0; i < t.length; i++) {
						const index = i
						if (t[i] <= now) {
							t[i] = now + 4000
							activeBullets.modify((bullets) => {
								bullets.push({
									paragraph,
									x: (width - textWidth) / 2,
									y: heightSV.value - (index + 1) * CONFIG.LINE_HEIGHT - 10,
									width: textWidth,
									opacity: CONFIG.OPACITY,
									vx: 0,
									birthTime: now,
								})
								return bullets
							})
							break
						}
					}
					return t
				})
			} else {
				const bestTrack = findBestScrollTrack(tracks.value, width)
				if (bestTrack !== -1) {
					tracks.modify((t) => {
						t[bestTrack] = width + textWidth
						return t
					})
					activeBullets.modify((bullets) => {
						bullets.push({
							paragraph,
							x: width,
							y: bestTrack * CONFIG.LINE_HEIGHT + 10,
							width: textWidth,
							opacity: CONFIG.OPACITY,
							vx: CONFIG.SPEED,
							birthTime: now,
						})
						return bullets
					})
				}
			}

			cursor.value++
		}

		activeBullets.modify((bullets) => {
			'worklet'
			for (let i = bullets.length - 1; i >= 0; i--) {
				const b = bullets[i]
				if (b.vx > 0) {
					b.x -= b.vx * dt
					if (b.x + b.width < 0) {
						bullets.splice(i, 1)
					}
				} else {
					if (now > b.birthTime + 4000) {
						bullets.splice(i, 1)
					}
				}
			}
			return bullets
		})
	})

	useFrameCallback(() => {
		const recorder = Skia.PictureRecorder()
		const canvas = recorder.beginRecording(
			Skia.XYWHRect(0, 0, width, heightSV.value),
		)

		const bullets = activeBullets.value
		for (const b of bullets) {
			if (b.vx > 0) {
				b.paragraph.paint(canvas, b.x, b.y)
			}
		}
		for (const b of bullets) {
			if (b.vx === 0) {
				b.paragraph.paint(canvas, b.x, b.y)
			}
		}

		picture.value = recorder.finishRecordingAsPicture()
	})

	return { picture, resetEngine }
}
