import type { Track } from '@/types/core/media'
import type { LyricLine } from '@/types/player/lyrics'
import ImageThemeColors from '@roitium/expo-image-theme-colors'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import ViewShot from 'react-native-view-shot'

interface LyricsShareCardProps {
	track: Track
	selectedLyrics: LyricLine[]
	viewShotRef: React.RefObject<ViewShot | null>
}

export const LyricsShareCard = ({
	track,
	selectedLyrics,
	viewShotRef,
}: LyricsShareCardProps) => {
	const theme = useTheme()
	const [backgroundColor, setBackgroundColor] = useState(
		theme.colors.elevation.level3,
	)

	const shareUrl = `https://bbplayer.roitium.com/share/track?id=${encodeURIComponent(track.uniqueKey)}&title=${encodeURIComponent(track.title)}&cover=${encodeURIComponent(track.coverUrl ?? '')}`

	useEffect(() => {
		if (track.coverUrl) {
			ImageThemeColors.extractThemeColorAsync(track.coverUrl)
				.then((palette) => {
					const bgColor = theme.dark
						? (palette.darkMuted?.hex ?? palette.muted?.hex)
						: (palette.lightMuted?.hex ?? palette.muted?.hex)

					if (bgColor) {
						setBackgroundColor(bgColor)
						// 简单的对比度判断，如果背景太亮则用黑字，反之白字
						// 这里简单起见直接根据 dark mode 和取色结果做个大概
						// 实际可能需要更复杂的 contrast 算法，或者直接固定某种文字颜色配遮罩
					}
				})
				.catch(() => undefined)
		}
	}, [track.coverUrl, theme.dark])

	return (
		<ViewShot
			ref={viewShotRef}
			options={{
				format: 'png',
				quality: 1,
				fileName: `share-${track.uniqueKey}`,
			}}
			style={[styles.container, { backgroundColor }]}
		>
			<LinearGradient
				colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)']}
				style={StyleSheet.absoluteFill}
			/>

			<View style={styles.content}>
				<View style={styles.header}>
					<Image
						source={{ uri: track.coverUrl ?? undefined }}
						style={styles.cover}
						contentFit='cover'
					/>
					<View style={styles.trackInfo}>
						<Text
							variant='titleLarge'
							style={[styles.title, { color: '#fff' }]}
						>
							{track.title}
						</Text>
						<Text
							variant='bodyMedium'
							style={{ color: 'rgba(255,255,255,0.8)' }}
							numberOfLines={1}
						>
							{track.artist?.name ?? 'Unknown Artist'}
						</Text>
					</View>
				</View>

				<View style={styles.lyricsContainer}>
					{selectedLyrics.map((lyric, index) => (
						<View
							key={`${lyric.timestamp}-${index}`}
							style={styles.lyricLine}
						>
							<Text
								variant='headlineSmall'
								style={[styles.lyricText, { color: '#fff' }]}
							>
								{lyric.text}
							</Text>
							{lyric.translation && (
								<Text
									variant='bodyMedium'
									style={[
										styles.translationText,
										{ color: 'rgba(255,255,255,0.7)' },
									]}
								>
									{lyric.translation}
								</Text>
							)}
						</View>
					))}
				</View>

				<View style={styles.footer}>
					<View style={styles.qrContainer}>
						<QRCode
							value={shareUrl}
							size={60}
							color='#000'
							backgroundColor='#fff'
							quietZone={4}
						/>
					</View>
					<View style={styles.footerTextContainer}>
						<Text
							variant='bodyMedium'
							style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}
						>
							长按识别二维码查看
						</Text>
						<Text
							variant='labelSmall'
							style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4 }}
						>
							一起来听歌！
						</Text>
						<View style={styles.logoContainer}>
							<Text
								variant='labelLarge'
								style={{ color: '#fff', fontWeight: '900', letterSpacing: 1 }}
							>
								BBPLAYER
							</Text>
						</View>
					</View>
				</View>
			</View>
		</ViewShot>
	)
}

const styles = StyleSheet.create({
	container: {
		width: 375, // 固定宽度以保证生成图片的一致性
		padding: 24,
		borderRadius: 0, // 图片不需要圆角，或者可以要一点
	},
	content: {
		flexDirection: 'column',
		gap: 24,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
	},
	cover: {
		width: 80,
		height: 80,
		borderRadius: 12,
		backgroundColor: 'rgba(255,255,255,0.1)',
	},
	trackInfo: {
		flex: 1,
		justifyContent: 'center',
	},
	title: {
		fontWeight: 'bold',
		marginBottom: 4,
	},
	lyricsContainer: {
		paddingVertical: 12,
		gap: 16,
	},
	lyricLine: {
		flexDirection: 'column',
	},
	lyricText: {
		fontWeight: '600',
		lineHeight: 32,
	},
	translationText: {
		marginTop: 4,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 12,
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: 'rgba(255,255,255,0.2)',
	},
	qrContainer: {
		borderRadius: 8,
		overflow: 'hidden',
	},
	footerTextContainer: {
		alignItems: 'flex-end',
	},
	logoContainer: {
		marginTop: 8,
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.4)',
		borderRadius: 4,
	},
})
