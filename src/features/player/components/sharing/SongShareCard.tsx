import type { Track } from '@/types/core/media'
import ImageThemeColors from '@roitium/expo-image-theme-colors'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import ViewShot from 'react-native-view-shot'

interface SongShareCardProps {
	track: Track
	viewShotRef: React.RefObject<ViewShot | null>
}

export const SongShareCard = ({ track, viewShotRef }: SongShareCardProps) => {
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
				fileName: `share-song-${track.uniqueKey}`,
			}}
			style={[styles.container, { backgroundColor }]}
		>
			<LinearGradient
				colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
				style={StyleSheet.absoluteFill}
			/>

			<View style={styles.cardContent}>
				<View style={styles.coverContainer}>
					<Image
						source={{ uri: track.coverUrl ?? undefined }}
						style={styles.cover}
						contentFit='cover'
					/>
				</View>

				<View style={styles.infoContainer}>
					<Text
						variant='headlineMedium'
						style={[styles.title, { color: '#fff' }]}
						numberOfLines={2}
					>
						{track.title}
					</Text>
					<Text
						variant='titleMedium'
						style={[styles.artist, { color: 'rgba(255,255,255,0.8)' }]}
						numberOfLines={1}
					>
						{track.artist?.name ?? 'Unknown Artist'}
					</Text>
				</View>

				<View style={styles.footer}>
					<View style={styles.qrContainer}>
						<QRCode
							value={shareUrl}
							size={80}
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
							长按识别二维码
						</Text>
						<Text
							variant='labelSmall'
							style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4 }}
						>
							听见好音乐
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
		padding: 32,
		paddingBottom: 40,
		alignItems: 'center',
	},
	cardContent: {
		width: '100%',
		gap: 24,
	},
	coverContainer: {
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 8,
		},
		shadowOpacity: 0.3,
		shadowRadius: 12,
		elevation: 10,
	},
	cover: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: 16,
		backgroundColor: 'rgba(255,255,255,0.1)',
	},
	infoContainer: {
		gap: 8,
	},
	title: {
		fontWeight: 'bold',
		textAlign: 'left',
	},
	artist: {
		textAlign: 'left',
	},
	footer: {
		marginTop: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingTop: 24,
		borderTopWidth: 1,
		borderTopColor: 'rgba(255,255,255,0.2)',
	},
	qrContainer: {
		borderRadius: 8,
		overflow: 'hidden',
	},
	footerTextContainer: {
		alignItems: 'flex-end',
		justifyContent: 'center',
		flex: 1,
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
