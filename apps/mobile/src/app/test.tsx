import { Orpheus } from '@bbplayer/orpheus'
import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import dayjs from 'dayjs'
import { asc, sql } from 'drizzle-orm'
import * as DocumentPicker from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import * as Updates from 'expo-updates'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Dialog, Portal, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import Button from '@/components/common/Button'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import { SyncFailuresSheet } from '@/features/playlist/local/components/SyncFailuresSheet'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import db, { expoDb } from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import lyricService from '@/lib/services/lyricService'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import toast from '@/utils/toast'

const logger = log.extend('TestPage')

export default function TestPage() {
	const [loading, setLoading] = useState(false)
	const syncFailuresSheetRef = useRef<TrueSheet>(null)
	const { isUpdatePending } = Updates.useUpdates()
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [updateChannel, setUpdateChannel] = useState('')
	const [updateChannelModalVisible, setUpdateChannelModalVisible] =
		useState(false)
	const [queryDate, setQueryDate] = useState('')
	const updateChannelState = useTextFieldState(updateChannel)
	const queryDateState = useTextFieldState(queryDate)

	const testCheckUpdate = async () => {
		setLoading(true)
		try {
			const result = await Updates.checkForUpdateAsync()
			toast.success('检查更新结果', {
				description: `isAvailable: ${result.isAvailable}, whyNotAvailable: ${result.reason}, isRollbackToEmbedding: ${result.isRollBackToEmbedded}`,
				duration: Number.POSITIVE_INFINITY,
			})
		} catch (error) {
			toast.error('检查更新失败', { description: String(error) })
		}
		setLoading(false)
	}

	const testUpdatePackage = async () => {
		setLoading(true)
		try {
			if (isUpdatePending) {
				expoDb.closeSync()
				await Updates.reloadAsync()
				return
			}
			setLoading(true)
			const result = await Updates.checkForUpdateAsync()
			if (!result.isAvailable) {
				toast.error('没有可用的更新', {
					description: '当前已是最新版本',
				})
				return
			}
			const updateResult = await Updates.fetchUpdateAsync()
			if (updateResult.isNew) {
				toast.success('有新版本可用', {
					description: '现在更新',
				})
				setTimeout(() => {
					expoDb.closeSync()
					setLoading(false) // I thought this is meaningless
					void Updates.reloadAsync()
				}, 1000)
			}
		} catch (error) {
			toast.error('更新失败', { description: String(error) })
		}
		setLoading(false)
	}

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
							const result = await DocumentPicker.getDocumentAsync({
								type: '*/*',
								copyToCacheDirectory: true,
								multiple: true,
							})

							if (result.canceled) {
								setLoading(false)
								return
							}

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
			// 兼容秒和毫秒时间戳。
			// 如果 startTime > 1e11，认为是毫秒；否则认为是秒。
			// 我们查询时可以简单地查询两个范围，或者使用 SQL 表达式转换。
			// 为了简单起见，我们在 JS 端处理或者用 OR。
			const rows = await db
				.select()
				.from(schema.playHistory)
				.where(
					sql`${schema.playHistory.startTime} BETWEEN ${startTime} AND ${endTime}
                        OR (${schema.playHistory.startTime} * 1000) BETWEEN ${startTime} AND ${endTime}`,
				)

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
						onPress={() => setUpdateChannelModalVisible(true)}
						loading={loading}
						style={styles.button}
					>
						更改热更新渠道
					</Button>
					<Button
						onPress={testCheckUpdate}
						loading={loading}
						style={styles.button}
					>
						查询是否有可热更新的包
					</Button>
					<Button
						onPress={testUpdatePackage}
						loading={loading}
						style={styles.button}
					>
						拉取热更新并重载
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
						<Host
							matchContents={{ vertical: true }}
							style={{ marginBottom: 8, width: '100%' }}
						>
							<OutlinedTextField
								value={queryDateState}
								onValueChange={setQueryDate}
								singleLine
								modifiers={[fillMaxWidth()]}
							>
								<OutlinedTextField.Placeholder>
									<ComposeText>例如 2024/03/22</ComposeText>
								</OutlinedTextField.Placeholder>
							</OutlinedTextField>
						</Host>
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

			<Portal>
				<AnimatedModalOverlay
					visible={updateChannelModalVisible}
					onDismiss={() => setUpdateChannelModalVisible(false)}
				>
					<Dialog.Title>
						设置热更新渠道
						<Text style={{ color: 'red' }}>&thinsp;(高危)&thinsp;</Text>
					</Dialog.Title>
					<Dialog.Content>
						<Text style={{ color: 'red' }}>
							如果您不知道您正在做什么，请关闭此弹窗！
						</Text>
						<Text>
							{'\n'}
							（注意：所设置的 channel
							是持久化的，如果需要恢复请点击下面的按钮）
						</Text>
						<Host
							matchContents={{ vertical: true }}
							style={{ marginTop: 16, width: '100%' }}
						>
							<OutlinedTextField
								value={updateChannelState}
								onValueChange={setUpdateChannel}
								singleLine
								modifiers={[fillMaxWidth()]}
							>
								<OutlinedTextField.Label>
									<ComposeText>更新渠道</ComposeText>
								</OutlinedTextField.Label>
							</OutlinedTextField>
						</Host>
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={() => setUpdateChannelModalVisible(false)}>
							取消
						</Button>
						<Button
							onPress={() => {
								setUpdateChannelModalVisible(false)
								Updates.setUpdateRequestHeadersOverride({
									'expo-channel-name': 'production',
								})
							}}
						>
							恢复默认
						</Button>
						<Button
							onPress={() => {
								setUpdateChannelModalVisible(false)
								Updates.setUpdateRequestHeadersOverride({
									'expo-channel-name': updateChannel,
								})
								void testCheckUpdate()
							}}
						>
							保存并查询是否有更新
						</Button>
					</Dialog.Actions>
				</AnimatedModalOverlay>
			</Portal>
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
