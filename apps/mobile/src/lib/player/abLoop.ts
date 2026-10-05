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

async function applyState(
	trackId: string,
	loop: AbLoopState | null,
	revision: number,
	mode: 'committed' | 'preview' | 'restore' = 'committed',
): Promise<boolean> {
	if (revision !== operationRevision) return false
	if ((await Orpheus.getCurrentTrack())?.id !== trackId) return false
	if (revision !== operationRevision) return false
	const applied =
		mode === 'preview'
			? await Orpheus.setAbLoopPreview(trackId, loop)
			: mode === 'restore'
				? await Orpheus.clearAbLoopPreview(trackId)
				: loop
					? await Orpheus.setAbLoop(trackId, loop.start, loop.end)
					: await Orpheus.clearAbLoop(trackId)
	if (!applied || revision !== operationRevision) return false
	await queryClient.cancelQueries({ queryKey: orpheusQueryKeys.abLoop() })
	if (revision !== operationRevision) return false
	// 从原生读取实际状态，避免切歌发生在原生调用与缓存更新之间。
	const active = await Orpheus.getAbLoop()
	if (
		revision !== operationRevision ||
		(await Orpheus.getCurrentTrack())?.id !== trackId
	)
		return false
	if (revision !== operationRevision) return false
	queryClient.setQueryData(orpheusQueryKeys.abLoop(), active)
	return true
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
		useAbLoopDraftStore.getState().resetForTrack(trackId)
		editSession = null
		const result = await trackService.getAbLoopByUniqueKey(trackId)
		if (result.isErr()) throw result.error
		const loop = result.value
		await enqueue(() =>
			applyState(
				trackId,
				loop
					? {
							trackId,
							start: loop.startPoint,
							end: loop.endPoint,
						}
					: null,
				revision,
			),
		)
	} catch (error) {
		logger.warning('应用 AB 循环失败', { trackId, error })
	}
}

export async function saveAbLoop(
	trackId: string,
	start: number,
	end: number,
	token?: number,
): Promise<boolean> {
	const revision = await beginRequest(trackId)
	if (revision === undefined) return false
	return enqueue(async () => {
		if (
			revision !== operationRevision ||
			(token !== undefined && !isAbLoopEditCurrent(token))
		)
			return false
		const result = await trackService.setAbLoopByUniqueKey(trackId, start, end)
		if (result.isErr()) throw result.error
		const applied = await applyState(trackId, { trackId, start, end }, revision)
		if (applied) {
			editSession = null
			useAbLoopDraftStore.getState().clear()
		}
		return applied
	})
}

export async function clearAbLoop(
	trackId: string,
	token?: number,
): Promise<boolean> {
	const revision = await beginRequest(trackId)
	if (revision === undefined) return false
	return enqueue(async () => {
		if (
			revision !== operationRevision ||
			(token !== undefined && !isAbLoopEditCurrent(token))
		)
			return false
		const result = await trackService.clearAbLoopByUniqueKey(trackId)
		if (result.isErr()) throw result.error
		const applied = await applyState(trackId, null, revision)
		if (applied) {
			editSession = null
			useAbLoopDraftStore.getState().clear()
		}
		return applied
	})
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
	await enqueue(() => applyState(session.trackId, null, revision, 'restore'))
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
