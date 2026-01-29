import { Image, type ImageRef } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import ViewShot from 'react-native-view-shot'

import type { LyricLine } from '@/types/player/lyrics'

interface LyricsShareCardProps {
	title: string
	artistName: string
	imageRef?: ImageRef | null
	shareUrl: string
	selectedLyrics: LyricLine[]
	viewShotRef: React.RefObject<ViewShot | null>
	backgroundColor: string
}

export const LyricsShareCard = ({
	title,
	artistName,
	imageRef,
	shareUrl,
	selectedLyrics,
	viewShotRef,
	backgroundColor,
}: LyricsShareCardProps) => {
	return (
		<ViewShot
			ref={viewShotRef}
			options={{
				format: 'png',
				quality: 1,
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
						source={imageRef}
						style={styles.cover}
						contentFit='cover'
					/>
					<View style={styles.trackInfo}>
						<Text
							variant='titleLarge'
							style={[styles.title, { color: '#fff' }]}
						>
							{title}
						</Text>
						<Text
							variant='bodyMedium'
							style={{ color: 'rgba(255,255,255,0.8)' }}
							numberOfLines={1}
						>
							{artistName}
						</Text>
					</View>
				</View>

				<View style={styles.lyricsContainer}>
					<View style={styles.quoteContainer}>
						<View style={styles.quoteOpen}>
							<Icon
								source='format-quote-open'
								size={120}
								color='rgba(255,255,255,0.1)'
							/>
						</View>
						<View style={styles.quoteClose}>
							<Icon
								source='format-quote-close'
								size={120}
								color='rgba(255,255,255,0.1)'
							/>
						</View>
					</View>
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
		width: 375,
		padding: 24,
		borderRadius: 0,
		overflow: 'hidden',
		position: 'relative',
	},
	content: {
		flexDirection: 'column',
		gap: 24,
		zIndex: 1,
	},
	quoteContainer: {
		...StyleSheet.absoluteFillObject,
		zIndex: 0,
		justifyContent: 'space-between',
		padding: 0,
	},
	quoteOpen: {
		position: 'absolute',
		top: -36,
		left: -36,
	},
	quoteClose: {
		position: 'absolute',
		right: -36,
		bottom: -36,
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
