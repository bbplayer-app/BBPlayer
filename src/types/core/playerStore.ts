import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import type { RNTPTrack } from '@/types/rntp'
import type { Result } from 'neverthrow'
import type { RepeatMode } from 'react-native-track-player'
import type { Track, TrackDownloadRecord } from './media'

// 播放器状态接口
interface PlayerState {
	// 队列相关
	tracks: Record<string, Track> // 歌曲数据源，key 是 uniqueKey
	orderedList: string[] // 顺序播放列表，存储 uniqueKey
	shuffledList: string[] // 随机播放列表，存储 uniqueKey

	currentTrackUniqueKey: string | null // 当前播放歌曲的 uniqueKey

	// 播放状态
	isPlaying: boolean
	isBuffering: boolean
	repeatMode: RepeatMode
	shuffleMode: boolean

	// 播放统计
	currentPlayStartAt: number | null // 当前曲目开始播放的时间戳(ms)

	// 定时关闭
	sleepTimerEndAt: number | null
}

interface addToQueueParams {
	tracks: Track[]
	playNow: boolean
	clearQueue: boolean
	startFromKey?: string
	playNext: boolean
}

// 播放器操作接口
interface PlayerActions {
	// 辅助函数
	_getActiveList: () => string[]
	_getCurrentTrack: () => Track | null
	_getCurrentIndex: () => number
	_finalizeAndRecordCurrentPlay: (
		reason?: 'skip' | 'ended' | 'stop',
	) => Promise<void>

	// 队列操作
	addToQueue: ({
		tracks,
		playNow,
		clearQueue,
		startFromKey,
		playNext,
	}: addToQueueParams) => Promise<void>
	resetStore: () => Promise<void>
	skipToTrack: (index: number) => Promise<void>
	rntpQueue: () => Promise<RNTPTrack[]>
	removeTrack: (id: string) => Promise<void>
	reShuffleQueue: () => void

	// 播放控制
	togglePlay: () => Promise<void>
	skipToNext: () => Promise<void>
	skipToPrevious: () => Promise<void>
	seekTo: (position: number) => Promise<void>

	// 模式控制
	toggleRepeatMode: () => void
	toggleShuffleMode: () => void
	setSleepTimer: (durationInSeconds: number | null, silent?: boolean) => void

	// 音频流处理
	patchAudio: (
		track: Track,
	) => Promise<
		Result<{ track: Track; needsUpdate: boolean }, BilibiliApiError | Error>
	>
	/**
	 * 用于在音频下载后直接更新队列中数据，下一次播放时可以直接使用本地数据。因为在切歌时是不会重新从数据库读取数据的
	 * @param uniqueKey
	 * @param status
	 * @returns
	 */
	updateDownloadStatus: (uniqueKey: string, status: TrackDownloadRecord) => void
}

// 完整的播放器存储类型
type PlayerStore = PlayerState & PlayerActions

export type { addToQueueParams, PlayerActions, PlayerState, PlayerStore }
