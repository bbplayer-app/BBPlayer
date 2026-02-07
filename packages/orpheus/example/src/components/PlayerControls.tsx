import {
	Orpheus,
	type Track,
	PlaybackState,
	RepeatMode,
} from '@bbplayer/orpheus'
import type { FC } from 'react'
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'

import { ControlButton, Button } from './Buttons'

interface PlayerControlsProps {
	currentTrack: Track | null
	playbackState: PlaybackState
	isPlaying: boolean
	progress: { position: number; duration: number; buffered: number }
	repeatMode: RepeatMode
	shuffleMode: boolean
	playbackSpeed: number
	lastEventLog: string
	onPlayPause: () => void
	onToggleRepeat: () => void
	onToggleShuffle: () => void
	onToggleSpeed: () => void
}

export const PlayerControls: FC<PlayerControlsProps> = ({
	currentTrack,
	playbackState,
	isPlaying,
	progress,
	repeatMode,
	shuffleMode,
	playbackSpeed,
	lastEventLog,
	onPlayPause,
	onToggleRepeat,
	onToggleShuffle,
	onToggleSpeed,
}) => {
	const formatTime = (seconds: number) => {
		if (!seconds || isNaN(seconds) || seconds < 0) return '0:00'
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${secs < 10 ? '0' : ''}${secs}`
	}

	const progressPercent =
		progress.duration > 0 ? (progress.position / progress.duration) * 100 : 0

	return (
		<View>
			{/* 1. Header State */}
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Orpheus Debugger</Text>
				<Text style={styles.stateTag}>{PlaybackState[playbackState]}</Text>
			</View>

			{/* 2. Artwork & Info */}
			<View style={styles.artworkContainer}>
				{currentTrack?.artwork ? (
					<Image
						source={{ uri: currentTrack.artwork }}
						style={styles.artwork}
					/>
				) : (
					<View style={[styles.artwork, styles.artworkPlaceholder]}>
						<Text style={{ color: '#666' }}>No Artwork</Text>
					</View>
				)}

				<Text
					style={styles.title}
					numberOfLines={1}
				>
					{currentTrack?.title ?? 'Not Playing'}
				</Text>
				<Text
					style={styles.artist}
					numberOfLines={1}
				>
					{currentTrack?.artist ?? 'Orpheus Player'}
				</Text>
				<Text style={styles.trackId}>ID: {currentTrack?.id ?? '-'}</Text>
				<Text style={styles.debugText}>{lastEventLog}</Text>
			</View>

			{/* 3. Progress Bar */}
			<View style={styles.progressContainer}>
				<View style={styles.progressBarBg}>
					<View
						style={[
							styles.progressBarBuffered,
							{
								width: `${progress.duration > 0 ? Math.min((progress.buffered / progress.duration) * 100, 100) : 0}%`,
							},
						]}
					/>
					<View
						style={[
							styles.progressBarFill,
							{ width: `${Math.min(progressPercent, 100)}%` },
						]}
					/>
				</View>
				<View style={styles.timeRow}>
					<Text style={styles.timeText}>{formatTime(progress.position)}</Text>
					<Text style={styles.timeText}>{formatTime(progress.duration)}</Text>
				</View>
			</View>

			{/* 4. Controls */}
			<View style={styles.controlsRow}>
				<ControlButton
					label='⏮'
					onPress={() => Orpheus.skipToPrevious()}
				/>

				<TouchableOpacity
					style={styles.playBtn}
					onPress={onPlayPause}
				>
					<Text style={styles.playBtnText}>{isPlaying ? '⏸' : '▶️'}</Text>
				</TouchableOpacity>

				<ControlButton
					label='⏭'
					onPress={() => Orpheus.skipToNext()}
				/>
			</View>

			{/* 5. Mode Controls */}
			<View style={styles.modeRow}>
				<Button
					title={`Repeat: ${RepeatMode[repeatMode]}`}
					onPress={onToggleRepeat}
					small
				/>
				<Button
					title={`Shuffle: ${shuffleMode ? 'ON' : 'OFF'}`}
					onPress={onToggleShuffle}
					small
					active={shuffleMode}
				/>
				<Button
					title={`Speed: ${playbackSpeed.toFixed(1)}x`}
					onPress={onToggleSpeed}
					small
					active={playbackSpeed !== 1.0}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
	stateTag: {
		color: '#1DB954',
		fontSize: 12,
		borderWidth: 1,
		borderColor: '#1DB954',
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
	},

	artworkContainer: { alignItems: 'center', marginBottom: 25 },
	artwork: {
		width: 240,
		height: 240,
		borderRadius: 12,
		marginBottom: 15,
		backgroundColor: '#000',
	},
	artworkPlaceholder: {
		backgroundColor: '#222',
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#333',
	},
	title: {
		color: '#fff',
		fontSize: 22,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 5,
	},
	artist: { color: '#bbb', fontSize: 16, marginBottom: 5 },
	trackId: {
		color: '#444',
		fontSize: 10,
		fontFamily: 'monospace',
		marginBottom: 5,
	},
	debugText: {
		color: '#e5e5e5',
		fontSize: 10,
		fontFamily: 'monospace',
		backgroundColor: '#333',
		padding: 4,
		borderRadius: 4,
		marginTop: 5,
	},

	progressContainer: { marginBottom: 30 },
	progressBarBg: {
		height: 6,
		backgroundColor: '#333',
		borderRadius: 3,
		overflow: 'hidden',
		position: 'relative',
	},
	progressBarBuffered: {
		height: '100%',
		backgroundColor: '#555',
		position: 'absolute',
		left: 0,
		top: 0,
	},
	progressBarFill: {
		height: '100%',
		backgroundColor: '#1DB954',
		position: 'absolute',
		left: 0,
		top: 0,
	},
	timeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8,
	},
	timeText: { color: '#888', fontSize: 12, fontVariant: ['tabular-nums'] },

	controlsRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 30,
		gap: 40,
	},
	playBtn: {
		width: 70,
		height: 70,
		borderRadius: 35,
		backgroundColor: '#fff',
		justifyContent: 'center',
		alignItems: 'center',
	},
	playBtnText: { fontSize: 32, color: '#000', marginLeft: 4 },

	modeRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 10,
		marginBottom: 30,
	},
})
