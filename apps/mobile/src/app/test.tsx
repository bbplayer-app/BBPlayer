import { Orpheus } from '@bbplayer/orpheus'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import dayjs from 'dayjs'
import { asc, sql } from 'drizzle-orm'
import * as DocumentPicker from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { TextInput, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import { SyncFailuresSheet } from '@/features/playlist/local/components/SyncFailuresSheet'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import db, { expoDb } from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import lyricService from '@/lib/services/lyricService'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'

const logger = log.extend('TestPage')

async function queryPlayHistoryByDateRange(startTime: number, endTime: number) {
	return db
		.select()
		.from(schema.playHistory)
		.where(
			sql`${schema.playHistory.startTime} BETWEEN ${startTime} AND ${endTime}
                        OR (${schema.playHistory.startTime} * 1000) BETWEEN ${startTime} AND ${endTime}`,
		)
}

async function importMMKVFiles() {
	const result = await DocumentPicker.getDocumentAsync({
		type: '*/*',
		copyToCacheDirectory: true,
		multiple: true,
	})

	if (result.canceled) return

	const mmkvDir = new Directory(Paths.document, 'mmkv')
	if (!mmkvDir.exists) {
		mmkvDir.create()
	}

	for (const asset of result.assets) {
		const pickedFile = new File(asset.uri)
		const targetFile = new File(mmkvDir, asset.name)
		if (targetFile.exists) {
			targetFile.delete()
		}
		pickedFile.copySync(targetFile)
	}

	toast.success('MMKV 导入成功')
}

export default function TestPage() {
	const [loading, setLoading] = useState(false)
	const syncFailuresSheetRef = useRef<TrueSheet>(null)
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [queryDate, setQueryDate] = useState('')

	const handleDeleteAllDownloadRecords = () => {
		alert(
			'清除下载缓存',
			'是否清除所有下载缓存？包括下载记录、数据库记录以及实际文件',
			[
				{
					text: '取消',
				},
				{
					text: '确定',
					onPress: async () => {
						setLoading(true)
						try {
							await Orpheus.removeAllDownloads()
							logger.info('清除数据库下载记录及实际文件成功')
							toast.success('清除下载缓存成功')
						} catch (error) {
							toastAndLogError('清除下载缓存失败', error, 'TestPage')
						}
						setLoading(false)
					},
				},
			],
			{ cancelable: true },
		)
	}

	const clearAllLyrcis = () => {
		const clearAction = () => {
			setLoading(true)
			const result = lyricService.clearAllLyrics()
			if (result.isOk()) {
				toast.success('清除成功')
			} else {
				toast.error('清除歌词失败', {
					description:
						result.error instanceof Error ? result.error.message : '未知错误',
				})
			}
			setLoading(false)
		}
		alert(
			'清除所有歌词',
			'是否清除所有已保存的歌词？下次播放时将重新从网络获取歌词',
			[
				{
					text: '取消',
				},
				{
					text: '确定',
					onPress: clearAction,
				},
			],
		)
	}

	const testPullSharedPlaylist = async () => {
		setLoading(true)
		try {
			const result = await sharedPlaylistFacade.pullChanges(44)
			if (result.isErr()) {
				toastAndLogError('拉取共享歌单失败', result.error, 'TestPage')
				setLoading(false)
				return
			}
			toast.success('拉取共享歌单成功', {
				description: `applied=${result.value.applied}`,
			})
		} catch (error) {
			toastAndLogError('拉取共享歌单失败', error, 'TestPage')
		}
		setLoading(false)
	}

	const dumpSyncQueue = async () => {
		setLoading(true)
		try {
			const rows = await db
				.select()
				.from(schema.playlistSyncQueue)
				.orderBy(asc(schema.playlistSyncQueue.id))
			logger.info('playlist_sync_queue', rows)
			toast.success('队列表输出', {
				description: `rows=${rows.length}（详见日志）`,
			})
		} catch (error) {
			toastAndLogError('读取 playlist_sync_queue 失败', error, 'TestPage')
		}
		setLoading(false)
	}

	const openSyncFailuresSheet = () => {
		if (syncFailuresSheetRef.current) {
			void syncFailuresSheetRef.current.present()
		}
	}

	const handleImportDatabase = async () => {
		alert(
			'导入数据库',
			'导入将覆盖当前数据库并自动重启应用，是否继续？',
			[
				{ text: '取消' },
				{
					text: '确定',
					onPress: async () => {
						setLoading(true)
						try {
							const result = await DocumentPicker.getDocumentAsync({
								type: '*/*',
								copyToCacheDirectory: true,
							})

							if (result.canceled) {
								setLoading(false)
								return
							}

							const pickedFile = new File(result.assets[0].uri)
							const dbDir = new Directory(Paths.document, 'SQLite')
							const dbFile = new File(dbDir, 'db.db')

							if (!dbDir.exists) {
								dbDir.create()
							}

							expoDb.closeSync()
							if (dbFile.exists) {
								dbFile.delete()
							}
							pickedFile.copySync(dbFile)

							toast.success('导入成功')
						} catch (error) {
							toastAndLogError('导入数据库失败', error, 'TestPage')
						}
						setLoading(false)
					},
				},
			],
			{ cancelable: true },
		)
	}

	const handleImportMMKV = async () => {
		alert(
			'导入 MMKV 数据',
			'请同时选择 mmkv.default 和 mmkv.default.crc 文件进行导入。',
			[
				{ text: '取消' },
				{
					text: '确定',
					onPress: async () => {
						setLoading(true)
						try {
							await importMMKVFiles()
						} catch (error) {
							toastAndLogError('导入 MMKV 失败', error, 'TestPage')
						}
						setLoading(false)
					},
				},
			],
			{ cancelable: true },
		)
	}

	const handleQueryPlayHistoryByDate = async () => {
		if (!queryDate) {
			toast.error('请输入日期')
			return
		}

		const date = dayjs(queryDate, 'YYYY/MM/DD', true)
		if (!date.isValid()) {
			toast.error('日期格式不正确，请使用 YYYY/MM/DD')
			return
		}

		const startTime = date.startOf('day').valueOf()
		const endTime = date.endOf('day').valueOf()

		setLoading(true)
		try {
			const rows = await queryPlayHistoryByDateRange(startTime, endTime)

			logger.info(`查询 ${queryDate} 的播放历史:`, rows)
			toast.success(`查询成功: ${queryDate}`, {
				description: `共找到 ${rows.length} 条记录（详见日志）`,
			})
		} catch (error) {
			toastAndLogError('查询播放历史失败', error, 'TestPage')
		}
		setLoading(false)
	}

	const openModal = useModalStore((state) => state.open)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<ScrollView
				style={[styles.scrollView, { paddingTop: insets.top + 30 }]}
				contentContainerStyle={{ paddingBottom: haveTrack ? 80 : 20 }}
				contentInsetAdjustmentBehavior='automatic'
			>
				<View style={styles.buttonContainer}>
					<Button
						mode='contained'
						onPress={() => router.push('/onboarding')}
						style={styles.button}
					>
						Onboarding 页面测试
					</Button>
					<Button
						mode='contained'
						onPress={() => {
							storage.set('first_open', true)
							expoDb.closeSync()
							const { DevSettings } = require('react-native')
							DevSettings.reload()
						}}
						style={styles.button}
					>
						重置 first_open 并重启
					</Button>
					<Button
						mode='contained'
						onPress={() => openModal('InputExternalPlaylistInfo', undefined)}
						loading={loading}
						style={styles.button}
					>
						同步外部歌单
					</Button>
					<Button
						onPress={testPullSharedPlaylist}
						loading={loading}
						style={styles.button}
					>
						测试共享歌单增量拉取
					</Button>
					<Button
						onPress={handleDeleteAllDownloadRecords}
						loading={loading}
						style={styles.button}
					>
						清空下载缓存
					</Button>
					<Button
						onPress={clearAllLyrcis}
						loading={loading}
						style={styles.button}
					>
						清空所有歌词缓存
					</Button>
					<Button
						onPress={() => Orpheus.clear()}
						loading={loading}
						style={styles.button}
					>
						清空播放器队列
					</Button>
					<Button
						onPress={dumpSyncQueue}
						loading={loading}
						style={styles.button}
					>
						输出 playlist_sync_queue
					</Button>
					<Button
						onPress={openSyncFailuresSheet}
						style={styles.button}
					>
						预览同步失败记录 Sheet
					</Button>
					<Button
						mode='contained'
						onPress={handleImportDatabase}
						loading={loading}
						style={styles.button}
					>
						导入数据库 (Import db.db)
					</Button>
					<Button
						mode='contained'
						onPress={handleImportMMKV}
						loading={loading}
						style={styles.button}
					>
						导入 MMKV 数据 (Import mmkv)
					</Button>

					<View style={{ marginTop: 16 }}>
						<TextInput
							mode='outlined'
							label='查询日期 (YYYY/MM/DD)'
							value={queryDate}
							onChangeText={setQueryDate}
							placeholder='例如 2024/03/22'
							style={{ marginBottom: 8 }}
						/>
						<Button
							mode='contained'
							onPress={handleQueryPlayHistoryByDate}
							loading={loading}
						>
							查询指定日期的播放历史
						</Button>
					</View>
				</View>
			</ScrollView>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>

			<SyncFailuresSheet
				ref={syncFailuresSheetRef}
				useMockData
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
		padding: 16,
	},
	buttonContainer: {
		marginBottom: 16,
	},
	button: {
		marginBottom: 8,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
