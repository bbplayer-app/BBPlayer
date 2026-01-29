import { Orpheus } from '@roitium/expo-orpheus'
import * as Updates from 'expo-updates'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Button,
	Dialog,
	Portal,
	Text,
	TextInput,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { expoDb } from '@/lib/db/db'
import lyricService from '@/lib/services/lyricService'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import toast from '@/utils/toast'

const logger = log.extend('TestPage')

export default function TestPage() {
	const [loading, setLoading] = useState(false)
	const { isUpdatePending } = Updates.useUpdates()
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [updateChannel, setUpdateChannel] = useState('')
	const [updateChannelModalVisible, setUpdateChannelModalVisible] =
		useState(false)

	const testCheckUpdate = async () => {
		setLoading(true)
		try {
			const result = await Updates.checkForUpdateAsync()
			toast.success('检查更新结果', {
				description: `isAvailable: ${result.isAvailable}, whyNotAvailable: ${result.reason}, isRollbackToEmbedding: ${result.isRollBackToEmbedded}`,
				duration: Number.POSITIVE_INFINITY,
			})
		} catch (error) {
			console.error('检查更新失败:', error)
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
			if (updateResult.isNew === true) {
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
			console.error('更新失败:', error)
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

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<ScrollView
				style={[styles.scrollView, { paddingTop: insets.top + 30 }]}
				contentContainerStyle={{ paddingBottom: haveTrack ? 80 : 20 }}
				contentInsetAdjustmentBehavior='automatic'
			>
				<View style={styles.buttonContainer}>
					<Button
						mode='outlined'
						onPress={() => setUpdateChannelModalVisible(true)}
						loading={loading}
						style={styles.button}
					>
						更改热更新渠道
					</Button>
					<Button
						mode='outlined'
						onPress={testCheckUpdate}
						loading={loading}
						style={styles.button}
					>
						查询是否有可热更新的包
					</Button>
					<Button
						mode='outlined'
						onPress={testUpdatePackage}
						loading={loading}
						style={styles.button}
					>
						拉取热更新并重载
					</Button>
					<Button
						mode='outlined'
						onPress={handleDeleteAllDownloadRecords}
						loading={loading}
						style={styles.button}
					>
						清空下载缓存
					</Button>
					<Button
						mode='outlined'
						onPress={clearAllLyrcis}
						loading={loading}
						style={styles.button}
					>
						清空所有歌词缓存
					</Button>
					<Button
						mode='outlined'
						onPress={() => Orpheus.clear()}
						loading={loading}
						style={styles.button}
					>
						清空播放器队列
					</Button>
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
						<TextInput
							style={{ marginTop: 16 }}
							onChangeText={setUpdateChannel}
							mode='outlined'
							label='更新渠道'
						/>
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
