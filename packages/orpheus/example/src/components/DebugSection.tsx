import { Orpheus } from '@bbplayer/orpheus'
import type { FC } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'

import { TEST_TRACKS } from '../constants'

import { Button } from './Buttons'

interface DebugSectionProps {
	progress: { position: number; duration: number; buffered: number }
	restorePlaybackPositionEnabled: boolean
	setRestorePlaybackPositionEnabled: (val: boolean) => void
	autoplay: boolean
	setAutoplay: (val: boolean) => void
	desktopLyricsShown: boolean
	desktopLyricsLocked: boolean
	setLastEventLog: (log: string) => void
	syncDesktopLyricsStatus: () => Promise<void>

	// Handlers from App.tsx
	onAddTracks: () => void
	onClearAndPlay: () => void
	onRemoveCurrent: () => void
	onTestIndexTrack: () => void
}

export const DebugSection: FC<DebugSectionProps> = ({
	progress,
	restorePlaybackPositionEnabled,
	setRestorePlaybackPositionEnabled,
	autoplay,
	setAutoplay,
	desktopLyricsShown,
	desktopLyricsLocked,
	setLastEventLog,
	syncDesktopLyricsStatus,
	onAddTracks,
	onClearAndPlay,
	onRemoveCurrent,
	onTestIndexTrack,
}) => {
	return (
		<View style={styles.actionsContainer}>
			<Text style={styles.sectionTitle}>Queue API</Text>
			<View style={styles.grid}>
				<Button
					title='Add to End'
					onPress={onAddTracks}
				/>
				<Button
					title='Clear & Play'
					onPress={onClearAndPlay}
					primary
				/>
				<Button
					title='Clear Queue'
					onPress={() => {
						void Orpheus.clear()
					}}
					danger
				/>
				<Button
					title='Remove Current'
					onPress={onRemoveCurrent}
					danger
				/>
			</View>

			<Text style={[styles.sectionTitle, { marginTop: 15 }]}>Info & Seek</Text>
			<View style={styles.grid}>
				<Button
					title='Log Queue'
					onPress={async () => {
						const q = await Orpheus.getQueue()
						console.log('Current Queue:', q)
						setLastEventLog(`Queue Length: ${q.length}`)
					}}
				/>
				<Button
					title='Get Track [0]'
					onPress={onTestIndexTrack}
				/>

				<Button
					title='Seek +15s'
					onPress={() => {
						void Orpheus.seekTo(progress.position + 15)
					}}
				/>
				<Button
					title='Seek to 0s'
					onPress={() => {
						void Orpheus.seekTo(0)
					}}
				/>

				<Button
					title={
						(restorePlaybackPositionEnabled ? 'Disable' : 'Enable') + ' Restore'
					}
					onPress={() => {
						Orpheus.restorePlaybackPositionEnabled =
							!Orpheus.restorePlaybackPositionEnabled
						setRestorePlaybackPositionEnabled(
							Orpheus.restorePlaybackPositionEnabled,
						)
					}}
				/>

				<Button
					title={(autoplay ? 'Disable' : 'Enable') + ' Autoplay'}
					onPress={() => {
						Orpheus.autoplayOnStartEnabled = !Orpheus.autoplayOnStartEnabled
						setAutoplay(Orpheus.autoplayOnStartEnabled)
					}}
				/>

				<Button
					title='Set Sleep (10s)'
					onPress={() => {
						void Orpheus.setSleepTimer(10000)
					}}
				/>
				<Button
					title='Get Sleep Time'
					onPress={async () => {
						try {
							const endTime = await Orpheus.getSleepTimerEndTime()
							if (endTime) {
								Alert.alert('Sleep End', `${endTime / 1000}s`)
							} else {
								Alert.alert('Sleep End', 'Not Set')
							}
						} catch (e) {
							if (e instanceof Error) {
								Alert.alert('Error', e.message)
							}
							console.log(e)
						}
					}}
				/>
				<Button
					title='Cancel Sleep'
					onPress={() => {
						void Orpheus.cancelSleepTimer()
					}}
				/>
			</View>

			<Text style={[styles.sectionTitle, { marginTop: 15 }]}>Download API</Text>
			<View style={styles.grid}>
				<Button
					title='Download [0]'
					onPress={() => {
						void Orpheus.downloadTrack(TEST_TRACKS[0])
					}}
				/>
				<Button
					title='Download Batch'
					onPress={() => {
						void Orpheus.multiDownload(TEST_TRACKS.slice(1))
					}}
				/>
				<Button
					title='Get Downloads'
					onPress={async () => {
						const downloads = await Orpheus.getDownloads()
						console.log('All Downloads:', downloads)
						setLastEventLog(`Downloads: ${downloads.length}`)
					}}
				/>
				<Button
					title='Get ID Status'
					onPress={async () => {
						const ids = TEST_TRACKS.map((t) => t.id)
						try {
							const statusMap = await Orpheus.getDownloadStatusByIds(ids)
							console.log('Status Map:', statusMap)
							Alert.alert('Status Map', JSON.stringify(statusMap, null, 2))
						} catch (e) {
							if (e instanceof Error) {
								Alert.alert('Error', e.message)
							}
							console.log(e)
							return
						}
					}}
				/>
				<Button
					title='Del All DLs'
					onPress={() => {
						void Orpheus.removeAllDownloads()
					}}
					danger
				/>
			</View>

			<Text style={[styles.sectionTitle, { marginTop: 15 }]}>
				Desktop Lyrics API
			</Text>
			<View style={{ marginBottom: 10 }}>
				<Text style={{ color: '#aaa', fontSize: 12 }}>
					Status: {desktopLyricsShown ? 'Shown' : 'Hidden'} /{' '}
					{desktopLyricsLocked ? 'Locked' : 'Unlocked'}
				</Text>
			</View>
			<View style={styles.grid}>
				<Button
					title='Req Permission'
					onPress={async () => {
						await Orpheus.requestOverlayPermission()
					}}
				/>
				<Button
					title='Check Permission'
					onPress={async () => {
						const has = await Orpheus.checkOverlayPermission()
						Alert.alert('Permission', has ? 'Granted' : 'Denied')
					}}
				/>
				<Button
					title='Show Lyrics'
					onPress={async () => {
						await Orpheus.showDesktopLyrics()
						await syncDesktopLyricsStatus()
					}}
					primary
				/>
				<Button
					title='Hide Lyrics'
					onPress={async () => {
						await Orpheus.hideDesktopLyrics()
						await syncDesktopLyricsStatus()
					}}
					danger
				/>
				<Button
					title='Lock Lyrics'
					onPress={async () => {
						Orpheus.isDesktopLyricsLocked = true
						await syncDesktopLyricsStatus()
					}}
				/>
				<Button
					title='Unlock Lyrics'
					onPress={async () => {
						Orpheus.isDesktopLyricsLocked = false
						await syncDesktopLyricsStatus()
					}}
				/>
				<Button
					title='Refresh Status'
					onPress={async () => {
						await syncDesktopLyricsStatus()
					}}
				/>
			</View>

			<Text style={[styles.sectionTitle, { marginTop: 15 }]}>Debug Tools</Text>
			<View style={styles.grid}>
				<Button
					title='Trigger Error'
					onPress={() => {
						void Orpheus.debugTriggerError()
					}}
					danger
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	actionsContainer: {
		backgroundColor: '#1E1E1E',
		padding: 15,
		borderRadius: 12,
	},
	sectionTitle: {
		color: '#666',
		marginBottom: 15,
		fontSize: 12,
		fontWeight: 'bold',
		textTransform: 'uppercase',
	},
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
})
