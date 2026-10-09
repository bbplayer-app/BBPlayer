import { Orpheus, type AbLoopState, type AbLoopRange } from '@bbplayer/orpheus'

import { orpheusQueryKeys } from '@/hooks/queries/orpheus'
import { useAbLoopDraftStore } from '@/hooks/stores/useAbLoopDraftStore'
import { queryClient } from '@/lib/config/queryClient'
import { seekWithinTrack } from '@/lib/player/seek'
import { trackService } from '@/lib/services/trackService'
import log from '@/utils/log'

export type { AbLoopState } from '@bbplayer/orpheus'

const logger = log.extend('Player.AbLoop')
let nextRevision = 0
let operationRevision = 0
let mutationQueue: Promise<unknown> = Promise.resolve()
let nextSession = 0
let editSession: { token: number; trackId: string } | null = null

/** 持久提交与当前播放应用分开；切歌后已接受的提交仍属于原曲目。 */
export type AbLoopCommitResult =
	| { status: 'committed'; playback: 'applied' | 'deferred' }
	| { status: 'ignored' }

export class AbLoopRecoveryError extends Error {
	constructor(
		cause: unknown,
		readonly recoveryError: unknown,
	) {
		super('未保存，播放状态恢复失败', { cause })
		this.name = 'AbLoopRecoveryError'
	}
}

export function isAbLoopEditCurrent(token: number) {
	return editSession?.token === token
}

// 请求按发起顺序编号；过期曲目的操作不能使当前曲目的恢复请求失效。
async function beginRequest(trackId: string): Promise<number | undefined> {
	const revision = ++nextRevision
	if (
		(await Orpheus.getCurrentTrack())?.id !== trackId ||
		revision < operationRevision
	)
		return undefined
	operationRevision = revision
	return revision
}

// 串行化原生修改；即使上一个操作失败，后续操作仍能执行。
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
	const result = mutationQueue.then(operation)
	mutationQueue = result.catch(() => undefined)
	return result
}

async function readSavedLoop(trackId: string): Promise<AbLoopState | null> {
	const result = await trackService.getAbLoopByUniqueKey(trackId)
	if (result.isErr()) throw result.error
	return result.value
		? { trackId, start: result.value.startPoint, end: result.value.endPoint }
		: null
}

function writeNativeLoop(trackId: string, loop: AbLoopState | null) {
	return loop
		? Orpheus.setAbLoop(trackId, loop.start, loop.end)
		: Orpheus.clearAbLoop(trackId)
}

async function refreshCache(trackId: string, isCurrent: () => boolean) {
	await queryClient.cancelQueries({ queryKey: orpheusQueryKeys.abLoop() })
	if (!isCurrent()) return
	const active = await Orpheus.getAbLoop()
	if (!isCurrent() || (await Orpheus.getCurrentTrack())?.id !== trackId) return
	if (isCurrent()) queryClient.setQueryData(orpheusQueryKeys.abLoop(), active)
}

// 缓存不是提交的一部分；刷新失败不能撤销已经写入的持久设置。
async function refreshCommittedCache(trackId: string) {
	try {
		await refreshCache(trackId, () => true)
	} catch (error) {
		logger.warning('刷新 AB 循环缓存失败', { trackId, error })
		await queryClient
			.invalidateQueries({ queryKey: orpheusQueryKeys.abLoop() })
			.catch((invalidateError: unknown) =>
				logger.warning('失效 AB 循环缓存失败', { trackId, invalidateError }),
			)
	}
}

async function applyState(
	trackId: string,
	loop: AbLoopState | null,
	revision: number,
	mode: 'committed' | 'preview' = 'committed',
): Promise<boolean> {
	if (revision !== operationRevision) return false
	if ((await Orpheus.getCurrentTrack())?.id !== trackId) return false
	if (revision !== operationRevision) return false
	const applied =
		mode === 'preview'
			? await Orpheus.setAbLoopPreview(trackId, loop)
			: await writeNativeLoop(trackId, loop)
	if (!applied || revision !== operationRevision) return false
	await refreshCache(trackId, () => revision === operationRevision)
	return revision === operationRevision
}

/** 前台与后台均通过同一个 Headless 切歌入口恢复设置。 */
export async function applyAbLoopForTrack(trackId: string): Promise<void> {
	try {
		if (
			editSession?.trackId === trackId &&
			(await Orpheus.getCurrentTrack())?.id === trackId
		)
			return
		const revision = await beginRequest(trackId)
		if (revision === undefined) return
		await enqueue(async () => {
			if (revision !== operationRevision || editSession?.trackId === trackId)
				return
			if ((await Orpheus.getCurrentTrack())?.id !== trackId) return
			if (revision !== operationRevision) return
			useAbLoopDraftStore.getState().resetForTrack(trackId)
			editSession = null
			// 查询也串行化，避免在提交前读出的旧设置于提交后恢复。
			const loop = await readSavedLoop(trackId)
			await applyState(trackId, loop, revision)
		})
	} catch (error) {
		logger.warning('应用 AB 循环失败', { trackId, error })
	}
}

/**
 * 原生先应用、SQLite 后提交。会话关闭不取消已接受的提交；失败补偿只作用于原曲目。
 * SQLite 是持久设置来源，进程中断后的冷启动与切歌恢复仍从 SQLite 收敛。
 */
async function commitAbLoop(
	trackId: string,
	loop: AbLoopState | null,
	token?: number,
): Promise<AbLoopCommitResult> {
	const owner = editSession?.trackId === trackId ? editSession : null
	const draft = useAbLoopDraftStore.getState().draft
	if (token !== undefined && owner?.token !== token)
		return { status: 'ignored' }
	const revision = ++nextRevision
	if ((await Orpheus.getCurrentTrack())?.id !== trackId)
		return { status: 'ignored' }
	if (token !== undefined && editSession !== owner) return { status: 'ignored' }
	operationRevision = Math.max(operationRevision, revision)
	return enqueue(async () => {
		const saved = await readSavedLoop(trackId)
		let nativeAttempted = false
		let previousActive: AbLoopState | null = null
		try {
			if ((await Orpheus.getCurrentTrack())?.id === trackId) {
				previousActive = await Orpheus.getAbLoop()
				nativeAttempted = true
				const applied = await writeNativeLoop(trackId, loop)
				if (!applied) {
					// false 按原生契约表示未应用；只有异常或后续写库失败需要补偿。
					nativeAttempted = false
					if ((await Orpheus.getCurrentTrack())?.id === trackId)
						throw new Error('原生播放器拒绝区间循环设置')
				}
			}
			const result = loop
				? await trackService.setAbLoopByUniqueKey(trackId, loop.start, loop.end)
				: await trackService.clearAbLoopByUniqueKey(trackId)
			if (result.isErr()) throw result.error
		} catch (error) {
			logger.warning('AB 提交失败，尝试恢复播放状态', { trackId, error })
			if (nativeAttempted) {
				try {
					if ((await Orpheus.getCurrentTrack())?.id === trackId) {
						const restored = await writeNativeLoop(trackId, saved)
						if (!restored && (await Orpheus.getCurrentTrack())?.id === trackId)
							throw new Error('无法恢复原生正式循环', { cause: error })
						if (restored && owner !== null && editSession === owner) {
							const previewRestored = await Orpheus.setAbLoopPreview(
								trackId,
								previousActive?.trackId === trackId ? previousActive : null,
							)
							if (
								!previewRestored &&
								(await Orpheus.getCurrentTrack())?.id === trackId
							)
								throw new Error('无法恢复编辑器试听状态', { cause: error })
						}
					}
				} catch (recoveryError) {
					logger.error('AB 提交失败且恢复失败', {
						trackId,
						error,
						recoveryError,
					})
					await refreshCommittedCache(trackId)
					throw new AbLoopRecoveryError(error, recoveryError)
				}
			}
			await refreshCommittedCache(trackId)
			throw error
		}
		if (owner !== null && editSession === owner) {
			editSession = null
			if (useAbLoopDraftStore.getState().draft?.trackId === trackId)
				useAbLoopDraftStore.getState().clear()
		} else if (
			editSession === null &&
			draft?.trackId === trackId &&
			useAbLoopDraftStore.getState().draft === draft
		) {
			useAbLoopDraftStore.getState().clear()
		}
		await refreshCommittedCache(trackId)
		// 界面反馈不依赖预览 revision；已经切歌时持久提交仍然成功。
		let applied = false
		try {
			const active = await Orpheus.getAbLoop()
			applied =
				nativeAttempted &&
				(await Orpheus.getCurrentTrack())?.id === trackId &&
				(loop === null
					? active === null
					: active?.trackId === trackId &&
						active.start === loop.start &&
						active.end === loop.end)
		} catch (error) {
			logger.warning('读取提交后的曲目失败', { trackId, error })
		}
		return { status: 'committed', playback: applied ? 'applied' : 'deferred' }
	})
}

export function saveAbLoop(
	trackId: string,
	start: number,
	end: number,
	token?: number,
) {
	return commitAbLoop(trackId, { trackId, start, end }, token)
}

export function clearAbLoop(trackId: string, token?: number) {
	return commitAbLoop(trackId, null, token)
}

/** 先同步正式设置，再暂时解除旧区间限制；延迟的后台恢复不能覆盖编辑。 */
export async function beginAbLoopEdit(trackId: string) {
	const revision = await beginRequest(trackId)
	if (revision === undefined) return null
	const token = ++nextSession
	editSession = { token, trackId }
	try {
		const editor = await enqueue(async () => {
			const result = await trackService.getAbLoopByUniqueKey(trackId)
			if (result.isErr()) throw result.error
			if (!isAbLoopEditCurrent(token) || revision !== operationRevision)
				return null
			const saved = result.value
			const loop = saved
				? { trackId, start: saved.startPoint, end: saved.endPoint }
				: null
			if (!(await applyState(trackId, loop, revision))) return null
			if (!(await applyState(trackId, null, revision, 'preview'))) return null
			return { token, savedLoop: loop }
		})
		if (!editor) await endAbLoopEdit(token)
		return editor
	} catch (error) {
		await endAbLoopEdit(token).catch((restoreError: unknown) =>
			logger.warning('初始化失败后恢复循环失败', { restoreError }),
		)
		throw error
	}
}

export async function previewAbLoop(token: number, range: AbLoopRange | null) {
	const session = editSession
	if (!session || session.token !== token) return false
	const revision = await beginRequest(session.trackId)
	if (revision === undefined || !isAbLoopEditCurrent(token)) return false
	return enqueue(() =>
		isAbLoopEditCurrent(token)
			? applyState(
					session.trackId,
					range ? { trackId: session.trackId, ...range } : null,
					revision,
					'preview',
				)
			: Promise.resolve(false),
	)
}

/** 所有关闭路径共用，包括卸载和后台；旧会话清理不会恢复到新会话上。 */
export async function endAbLoopEdit(token: number) {
	const session = editSession
	if (!session || session.token !== token) return
	editSession = null
	const revision = await beginRequest(session.trackId)
	if (revision === undefined) return
	await enqueue(async () => {
		if (revision !== operationRevision || editSession !== null) return
		const loop = await readSavedLoop(session.trackId)
		await applyState(session.trackId, loop, revision)
	})
}

export function seekAbLoopEdit(token: number, seconds: number) {
	return enqueue(async () => {
		const session = editSession
		if (!session || session.token !== token) return null
		return seekWithinTrack(session.trackId, seconds, false, () =>
			isAbLoopEditCurrent(token),
		)
	})
}
