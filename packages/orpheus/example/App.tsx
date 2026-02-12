import {
	Orpheus,
	PlaybackState,
	RepeatMode,
	useCurrentTrack,
} from '@bbplayer/orpheus'
import { useEffect, useState, useCallback } from 'react'
import { StyleSheet, SafeAreaView, ScrollView, Alert, View } from 'react-native'

import { DebugSection } from './src/components/DebugSection'
import { PlayerControls } from './src/components/PlayerControls'
import { SpectrumVisualizer } from './src/components/SpectrumVisualizer'
import { TEST_TRACKS } from './src/constants'

export default function OrpheusTestScreen() {
	// --- State ---
	const [isPlaying, setIsPlaying] = useState(false)
	const [playbackState, setPlaybackState] = useState<PlaybackState>(
		PlaybackState.IDLE,
	)
	const [progress, setProgress] = useState({
		position: 0,
		duration: 0,
		buffered: 0,
	})

	const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.OFF)
	const [shuffleMode, setShuffleMode] = useState(false)
	const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
	const { track: currentTrack } = useCurrentTrack()
	const [restorePlaybackPositionEnabled, setRestorePlaybackPositionEnabled] =
		useState(false)
	const [autoplay, setAutoplay] = useState(false)
	const [desktopLyricsShown, setDesktopLyricsShown] = useState(false)
	const [desktopLyricsLocked, setDesktopLyricsLocked] = useState(false)

	// Debug Info
	const [lastEventLog, setLastEventLog] = useState<string>('Ready')

	// --- Initialization & Listeners ---
	const syncDesktopLyricsStatus = useCallback(async () => {
		try {
			const shown = Orpheus.isDesktopLyricsShown
			setDesktopLyricsShown(shown)
			const locked = Orpheus.isDesktopLyricsLocked
			setDesktopLyricsLocked(locked)
			await Promise.resolve()
		} catch {
			// ignore lyrics status sync error
		}
	}, [])

	const syncFullState = useCallback(async () => {
		try {
			const playing = await Orpheus.getIsPlaying()
			setIsPlaying(playing)

			const shuffle = await Orpheus.getShuffleMode()
			setShuffleMode(shuffle)

			const speed = await Orpheus.getPlaybackSpeed()
			setPlaybackSpeed(speed)

			const repeat = await Orpheus.getRepeatMode()
			setRepeatMode(repeat)

			await syncDesktopLyricsStatus()
		} catch (e) {
			// ignore sync error
			if (e instanceof Error) {
				setLastEventLog(`Sync Error: ${e.message}`)
			}
		}
	}, [syncDesktopLyricsStatus])

	useEffect(() => {
		setRestorePlaybackPositionEnabled(Orpheus.restorePlaybackPositionEnabled)
		setAutoplay(Orpheus.autoplayOnStartEnabled)
	}, [restorePlaybackPositionEnabled, autoplay])

	useEffect(() => {
		void syncFullState()

		const subState = Orpheus.addListener('onPlaybackStateChanged', (event) => {
			setPlaybackState(event.state)
		})

		const subTrackFinish = Orpheus.addListener('onTrackFinished', (event) => {
			setLastEventLog(`Track Finished: ${event.trackId}`)
		})

		const subPlaying = Orpheus.addListener('onIsPlayingChanged', (event) => {
			setIsPlaying(event.status)
		})

		const subProgress = Orpheus.addListener('onPositionUpdate', (event) => {
			setProgress({
				position: event.position,
				duration: event.duration,
				buffered: event.buffered,
			})
		})

		const subError = Orpheus.addListener('onPlayerError', (event) => {
			if (event.platform === 'android') {
				Alert.alert(
					'Player Error',
					`Code: ${event.errorCode}\nMessage: ${event.message}\nCause: ${event.rootCauseMessage}\nStack: ${event.stackTrace}`,
				)
				setLastEventLog(`Error: ${event.errorCode}`)
			} else {
				Alert.alert('Player Error', `Error: ${event.error}`)
				setLastEventLog(`Error: iOS Error`)
			}
		})

		const subDownload = Orpheus.addListener('onDownloadUpdated', (_task) => {
			// download progress updates ignored in this screen
		})

		const subSpeed = Orpheus.addListener('onPlaybackSpeedChanged', (event) => {
			setPlaybackSpeed(event.speed)
		})

		return () => {
			subState.remove()
			// subTrackStart.remove();
			subTrackFinish.remove()
			subPlaying.remove()
			subProgress.remove()
			subError.remove()
			subDownload.remove()
			subSpeed.remove()
		}
	}, [syncFullState])

	// --- Handlers ---

	const handlePlayPause = async () => {
		try {
			if (isPlaying) {
				await Orpheus.pause()
			} else {
				await Orpheus.play()
			}
		} catch (e) {
			if (e instanceof Error) {
				Alert.alert('Action Failed', e.message)
			}
		}
	}

	const handleAddTracks = async () => {
		try {
			await Orpheus.addToEnd(TEST_TRACKS, undefined, false)
			setLastEventLog('Tracks added to queue end')
			Alert.alert('Success', 'Tracks added to queue')
		} catch (e) {
			if (e instanceof Error) {
				Alert.alert('Add Failed', e.message)
			}
		}
	}

	const handleClearAndPlay = async () => {
		try {
			await Orpheus.addToEnd(TEST_TRACKS, TEST_TRACKS[0].id, true)
			setLastEventLog('Queue cleared and playing new tracks')
		} catch (e) {
			if (e instanceof Error) {
				Alert.alert('Action Failed', e.message)
			}
		}
	}

	const handleTestIndexTrack = async () => {
		try {
			const track = await Orpheus.getIndexTrack(0)
			if (track) {
				Alert.alert(
					'Get Index 0 Success',
					`Title: ${track.title}\nID: ${track.id}`,
				)
			} else {
				Alert.alert('Get Index 0', 'Empty (Queue might be empty)')
			}
		} catch (e) {
			if (e instanceof Error) {
				Alert.alert('Error', e.message)
			}
		}
	}

	const toggleRepeat = async () => {
		const nextMode = (repeatMode + 1) % 3
		await Orpheus.setRepeatMode(nextMode)
		setRepeatMode(nextMode)
	}

	const toggleShuffle = async () => {
		const nextState = !shuffleMode
		await Orpheus.setShuffleMode(nextState)
		setShuffleMode(nextState)
	}

	const toggleSpeed = async () => {
		const speeds = [0.5, 1.0, 1.25, 1.5, 2.0]
		let nextSpeed = 1.0

		for (const s of speeds) {
			if (playbackSpeed < s - 0.01) {
				nextSpeed = s
				break
			}
		}
		if (playbackSpeed >= speeds[speeds.length - 1] - 0.01) {
			nextSpeed = speeds[0]
		}

		await Orpheus.setPlaybackSpeed(nextSpeed)
		setPlaybackSpeed(nextSpeed)
	}

	const handleRemoveCurrent = async () => {
		try {
			const idx = await Orpheus.getCurrentIndex()
			if (idx !== -1) {
				await Orpheus.removeTrack(idx)
				setLastEventLog(`Removed track at index ${idx}`)
			} else {
				Alert.alert('Cannot Remove', 'No current index playing')
			}
		} catch (e) {
			if (e instanceof Error) {
				Alert.alert('Error', e.message)
			}
		}
	}

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<PlayerControls
					currentTrack={currentTrack}
					playbackState={playbackState}
					isPlaying={isPlaying}
					progress={progress}
					repeatMode={repeatMode}
					shuffleMode={shuffleMode}
					playbackSpeed={playbackSpeed}
					lastEventLog={lastEventLog}
					onPlayPause={handlePlayPause}
					onToggleRepeat={toggleRepeat}
					onToggleShuffle={toggleShuffle}
					onToggleSpeed={toggleSpeed}
				/>

				<SpectrumVisualizer isPlaying={isPlaying} />

				<View style={{ marginTop: 20 }}>
					<DebugSection
						progress={progress}
						restorePlaybackPositionEnabled={restorePlaybackPositionEnabled}
						setRestorePlaybackPositionEnabled={
							setRestorePlaybackPositionEnabled
						}
						autoplay={autoplay}
						setAutoplay={setAutoplay}
						desktopLyricsShown={desktopLyricsShown}
						desktopLyricsLocked={desktopLyricsLocked}
						setLastEventLog={setLastEventLog}
						syncDesktopLyricsStatus={syncDesktopLyricsStatus}
						onAddTracks={handleAddTracks}
						onClearAndPlay={handleClearAndPlay}
						onRemoveCurrent={handleRemoveCurrent}
						onTestIndexTrack={handleTestIndexTrack}
					/>
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#121212' },
	scrollContent: { padding: 20, paddingBottom: 50 },
})
