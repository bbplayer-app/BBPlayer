import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import { usePlaylistMetadata } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { playlistService } from '@/lib/services/playlistService'
import { syncLocalToBilibiliService } from '@/lib/services/syncLocalToBilibiliService'
import toast from '@/utils/toast'
import { useEffect, useReducer } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Button,
	Dialog,
	Divider,
	ProgressBar,
	Text,
} from 'react-native-paper'

interface SyncLocalToBilibiliModalProps {
	playlistId: number
}

type Step =
	| 'checking'
	| 'confirm_create'
	| 'diffing'
	| 'confirm_sync'
	| 'syncing'
	| 'success'
	| 'error'

interface RemoteFolder {
	id: number
	title: string
}

interface DiffResult {
	toAdd: string[]
	toRemove: string[]
}

interface State {
	step: Step
	remoteFolder: RemoteFolder | null
	diffResult: DiffResult | null
	progress: number
	totalOps: number
	failCount: number
	errorMsg: string
}

type Action =
	| { type: 'SET_STEP'; payload: Step }
	| { type: 'SET_REMOTE_FOLDER'; payload: RemoteFolder }
	| { type: 'SET_DIFF_RESULT'; payload: DiffResult }
	| { type: 'SET_PROGRESS'; payload: number }
	| { type: 'SET_TOTAL_OPS'; payload: number }
	| { type: 'SET_FAIL_COUNT'; payload: number }
	| { type: 'SET_ERROR'; payload: string }
	| { type: 'RESET' }

const initialState: State = {
	step: 'checking',
	remoteFolder: null,
	diffResult: null,
	progress: 0,
	totalOps: 0,
	failCount: 0,
	errorMsg: '',
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case 'SET_STEP':
			return { ...state, step: action.payload }
		case 'SET_REMOTE_FOLDER':
			return { ...state, remoteFolder: action.payload }
		case 'SET_DIFF_RESULT':
			return { ...state, diffResult: action.payload }
		case 'SET_PROGRESS':
			return { ...state, progress: action.payload }
		case 'SET_TOTAL_OPS':
			return { ...state, totalOps: action.payload }
		case 'SET_FAIL_COUNT':
			return { ...state, failCount: action.payload }
		case 'SET_ERROR':
			return { ...state, errorMsg: action.payload, step: 'error' }
		case 'RESET':
			return initialState
		default:
			return state
	}
}

export default function SyncLocalToBilibiliModal({
	playlistId,
}: SyncLocalToBilibiliModalProps) {
	const close = useModalStore((state) => state.close)
	const [state, dispatch] = useReducer(reducer, initialState)
	const {
		step,
		remoteFolder,
		diffResult,
		progress,
		totalOps,
		failCount,
		errorMsg,
	} = state

	const { data: playlist } = usePlaylistMetadata(playlistId)
	const { data: userInfo } = usePersonalInformation()

	// 检查远程收藏夹
	useEffect(() => {
		if (step !== 'checking') return

		if (!userInfo?.mid) {
			dispatch({ type: 'SET_ERROR', payload: '未登录 B 站，请先登录' })
			return
		}
		if (!playlist) return // 等待加载

		const check = async () => {
			const res = await syncLocalToBilibiliService.findRemotePlaylistByName(
				Number(userInfo.mid),
				playlist.title,
			)
			if (res.isErr()) {
				dispatch({ type: 'SET_ERROR', payload: res.error.message })
				return
			}

			if (res.value) {
				dispatch({ type: 'SET_REMOTE_FOLDER', payload: res.value })
				dispatch({ type: 'SET_STEP', payload: 'diffing' })
			} else {
				dispatch({ type: 'SET_STEP', payload: 'confirm_create' })
			}
		}
		void check()
	}, [step, playlist, userInfo?.mid])

	// 创建远程收藏夹
	const handleCreate = async () => {
		if (!playlist) return
		const res = await syncLocalToBilibiliService.createRemotePlaylist(
			playlist.title,
		)
		if (res.isErr()) {
			dispatch({ type: 'SET_ERROR', payload: res.error.message })
			return
		}
		dispatch({
			type: 'SET_REMOTE_FOLDER',
			payload: { id: res.value.id, title: playlist.title },
		})
		dispatch({ type: 'SET_STEP', payload: 'diffing' })
	}

	// 计算差异
	useEffect(() => {
		if (step !== 'diffing' || !remoteFolder) return

		const diff = async () => {
			// 获取本地歌单
			const tracksRes = await playlistService.getPlaylistTracks(playlistId)
			if (tracksRes.isErr()) {
				dispatch({ type: 'SET_ERROR', payload: '获取本地歌单失败' })
				return
			}

			const res = await syncLocalToBilibiliService.calculateSyncDiff(
				tracksRes.value,
				remoteFolder.id,
			)
			if (res.isErr()) {
				dispatch({ type: 'SET_ERROR', payload: res.error.message })
				return
			}

			dispatch({ type: 'SET_DIFF_RESULT', payload: res.value })
			dispatch({ type: 'SET_STEP', payload: 'confirm_sync' })
		}
		void diff()
	}, [step, remoteFolder, playlistId])

	// 执行同步
	const handleSync = async () => {
		if (!remoteFolder || !diffResult) return
		dispatch({ type: 'SET_STEP', payload: 'syncing' })

		const total = diffResult.toAdd.length + diffResult.toRemove.length
		dispatch({ type: 'SET_TOTAL_OPS', payload: total })
		dispatch({ type: 'SET_PROGRESS', payload: 0 })

		if (total === 0) {
			dispatch({ type: 'SET_STEP', payload: 'success' })
			return
		}

		// 添加
		let addsFailed = 0
		if (diffResult.toAdd.length > 0) {
			const res = await syncLocalToBilibiliService.executeBatchAdd(
				remoteFolder.id,
				diffResult.toAdd,
				(p) => dispatch({ type: 'SET_PROGRESS', payload: p }),
			)
			if (res.isErr()) {
				toast.error('部分歌曲添加失败，请查看日志')
			} else {
				addsFailed = res.value
			}
		}

		// 删除
		if (diffResult.toRemove.length > 0) {
			const res = await syncLocalToBilibiliService.executeBatchRemove(
				remoteFolder.id,
				diffResult.toRemove,
			)
			if (res.isErr()) {
				toast.error('部分歌曲删除失败')
			}
		}

		dispatch({ type: 'SET_FAIL_COUNT', payload: addsFailed })
		dispatch({ type: 'SET_STEP', payload: 'success' })
	}

	const renderContent = () => {
		switch (step) {
			case 'checking':
				return (
					<>
						<Dialog.Title>同步到 B 站</Dialog.Title>
						<Dialog.Content>
							<View style={styles.center}>
								<ActivityIndicator size='large' />
								<Text style={{ marginTop: 20 }}>正在查找远程收藏夹...</Text>
							</View>
						</Dialog.Content>
					</>
				)
			case 'confirm_create':
				return (
					<>
						<Dialog.Title>同步到 B 站</Dialog.Title>
						<Dialog.Content>
							<Text variant='bodyLarge'>
								未找到名为 &quot;{playlist?.title}&quot; 的 B 站收藏夹。
							</Text>
							<Text
								variant='bodyMedium'
								style={{ marginTop: 8, color: 'gray' }}
							>
								是否创建一个新的公开收藏夹？
							</Text>
						</Dialog.Content>
						<Dialog.Actions>
							<Button onPress={() => close('SyncLocalToBilibili')}>取消</Button>
							<Button
								mode='contained'
								onPress={handleCreate}
							>
								创建并继续
							</Button>
						</Dialog.Actions>
					</>
				)
			case 'diffing':
				return (
					<>
						<Dialog.Title>同步到 B 站</Dialog.Title>
						<Dialog.Content>
							<View style={styles.center}>
								<ActivityIndicator size='large' />
								<Text style={{ marginTop: 20 }}>正在对比列表差异...</Text>
							</View>
						</Dialog.Content>
					</>
				)
			case 'confirm_sync': {
				const nothingToSync =
					diffResult?.toAdd.length === 0 && diffResult.toRemove.length === 0

				if (nothingToSync) {
					return (
						<>
							<Dialog.Title>同步确认</Dialog.Title>
							<Dialog.Content>
								<Text variant='bodyLarge'>无需同步</Text>
								<Text
									variant='bodyMedium'
									style={{ marginTop: 8, color: 'gray' }}
								>
									当前本地列表与远程收藏夹已完全一致。
								</Text>
							</Dialog.Content>
							<Dialog.Actions>
								<Button onPress={() => close('SyncLocalToBilibili')}>
									关闭
								</Button>
							</Dialog.Actions>
						</>
					)
				}
				return (
					<>
						<Dialog.Title>同步确认</Dialog.Title>
						<Dialog.Content>
							<View style={styles.statRow}>
								<Text>新增歌曲</Text>
								<Text style={{ color: 'green', fontWeight: 'bold' }}>
									+{diffResult?.toAdd.length}
								</Text>
							</View>
							<Divider style={{ marginVertical: 4 }} />
							<View style={styles.statRow}>
								<Text>移除歌曲 (远端多余)</Text>
								<Text style={{ color: 'red', fontWeight: 'bold' }}>
									-{diffResult?.toRemove.length}
								</Text>
							</View>
							<Text
								variant='bodySmall'
								style={{ marginTop: 10, color: 'gray', fontWeight: 'bold' }}
							>
								注意：这是一个镜像同步操作。本地没有的歌曲将会从远端删除。
							</Text>
						</Dialog.Content>
						<Dialog.Actions>
							<Button onPress={() => close('SyncLocalToBilibili')}>取消</Button>
							<Button
								mode='contained'
								onPress={handleSync}
							>
								开始同步
							</Button>
						</Dialog.Actions>
					</>
				)
			}
			case 'syncing':
				return (
					<>
						<Dialog.Title>同步到 B 站</Dialog.Title>
						<Dialog.Content>
							<View style={styles.center}>
								<ActivityIndicator size='large' />
								<Text style={{ marginTop: 20, marginBottom: 10 }}>
									同步中...
								</Text>
								<ProgressBar
									progress={totalOps > 0 ? progress / totalOps : 0}
									style={{ width: '100%' }}
								/>
								<Text style={{ marginTop: 5 }}>
									{progress} / {totalOps}
								</Text>
							</View>
						</Dialog.Content>
					</>
				)
			case 'success':
				return (
					<>
						<Dialog.Title>同步完成</Dialog.Title>
						<Dialog.Content>
							<View style={styles.center}>
								<Text
									variant='titleLarge'
									style={{
										color: failCount > 0 ? 'orange' : 'green',
										marginBottom: 10,
									}}
								>
									{failCount > 0 ? '同步部分成功' : '同步成功'}
								</Text>
								{failCount > 0 && (
									<Text style={{ color: 'gray' }}>
										有 {failCount} 首歌曲未能同步成功，请稍后重试。（可能是你的
										IP 被风控了，R.I.P.）
									</Text>
								)}
							</View>
						</Dialog.Content>
						<Dialog.Actions>
							<Button
								mode='contained'
								onPress={() => close('SyncLocalToBilibili')}
							>
								我知道了
							</Button>
						</Dialog.Actions>
					</>
				)
			case 'error':
				return (
					<>
						<Dialog.Title>出错了</Dialog.Title>
						<Dialog.Content>
							<View style={styles.center}>
								<Text style={{ color: 'red', marginBottom: 10 }}>
									{errorMsg}
								</Text>
							</View>
						</Dialog.Content>
						<Dialog.Actions>
							<Button onPress={() => close('SyncLocalToBilibili')}>关闭</Button>
						</Dialog.Actions>
					</>
				)
		}
	}

	return renderContent()
}

const styles = StyleSheet.create({
	center: {
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
	},
	statRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 8,
	},
})
