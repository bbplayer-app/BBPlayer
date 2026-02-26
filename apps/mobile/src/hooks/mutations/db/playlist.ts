import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'expo-router'

import { playlistKeys } from '@/hooks/queries/db/playlist'
import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { api as bbplayerApi } from '@/lib/api/bbplayer/client'
import { queryClient } from '@/lib/config/queryClient'
import { playlistFacade } from '@/lib/facades/playlist'
import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import type { FavoriteSyncProgress } from '@/lib/facades/syncBilibiliPlaylist'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist } from '@/types/core/media'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { UpdatePlaylistPayload } from '@/types/services/playlist'
import type { CreateTrackPayload } from '@/types/services/track'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

/** 若当前无 BBPlayer JWT，尝试用 Bilibili Cookie 自动换取。无 cookie 时抛出异常。 */
async function ensureBBPlayerToken(): Promise<void> {
	const store = useAppStore.getState()
	if (store.bbplayerToken) return

	const cookie = store.bilibiliCookie
	if (!cookie || Object.keys(cookie).length === 0) {
		throw new Error('请先登录 Bilibili，才能使用共享功能')
	}

	const cookieStr = serializeCookieObject(cookie)
	const resp = await bbplayerApi.auth.login.$post({
		json: { cookie: cookieStr },
	})
	if (!resp.ok) {
		const body = await resp.json().catch(() => ({}))
		throw new Error(
			`BBPlayer 身份验证失败（${resp.status}）：${JSON.stringify(body)}`,
		)
	}
	const data = (await resp.json()) as { token: string }
	store.setBbplayerToken(data.token)
}

const SCOPE = 'Mutation.DB.Playlist'

queryClient.setMutationDefaults(['db', 'playlist'], {
	retry: false,
})

// React Query 的 invalidateQueries 会直接在后台刷新当前页面活跃的查询，能满足咱们的需求。
// 只有当我们需要在 mutate 之后要跳转到另一个页面时，才需要去 invalidateQueries
export const usePlaylistSync = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'sync'],
		mutationFn: async ({
			remoteSyncId,
			type,
			onProgress,
		}: {
			remoteSyncId: number
			type: Playlist['type']
			toastId?: string
			onProgress?: (progress: FavoriteSyncProgress) => void
		}) => {
			const result = await syncFacade.sync(remoteSyncId, type, onProgress)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (id, { toastId }) => {
			toast.success('同步成功', { id: toastId })
			if (!id) return
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(id),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(id),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
			])
		},
		onError: (error, { remoteSyncId, type, toastId }) => {
			if (toastId) {
				toast.dismiss(toastId)
			}
			toastAndLogError(
				`同步播放列表失败: remoteSyncId=${remoteSyncId}, type=${type}`,
				error,
				SCOPE,
			)
		},
	})
}

/**
 * 针对单个音轨，批量更新它所在的本地播放列表。
 * 当该 track 不存在时，会自动创建
 * 你可能并不需要直接使用此 mutation，请去使用 <AddVideoToLocalPlaylistModal /> 组件
 * @returns
 */
export const useUpdateTrackLocalPlaylists = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'updateTrackLocalPlaylists'],
		mutationFn: async (args: {
			toAddPlaylistIds: number[]
			toRemovePlaylistIds: number[]
			trackPayload: CreateTrackPayload
			artistPayload?: CreateArtistPayload | null
		}) => {
			const res = await playlistFacade.updateTrackLocalPlaylists(args)
			if (res.isErr()) throw res.error
			return res.value
		},
		onSuccess: async (trackId, { toAddPlaylistIds, toRemovePlaylistIds }) => {
			toast.success('操作成功')
			const promises: Promise<unknown>[] = []
			promises.push(
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistsContainingTrack(trackId),
				}),
			)
			promises.push(
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
			)
			for (const id of [...toAddPlaylistIds, ...toRemovePlaylistIds]) {
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistContents(id),
					}),
				)
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistMetadata(id),
					}),
				)
			}
			await Promise.all(promises)
		},
		onError: (error, { trackPayload }) =>
			toastAndLogError(
				`操作音频收藏位置失败: trackTitle=${trackPayload.title}`,
				error,
				SCOPE,
			),
	})
}

export const useDuplicatePlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'duplicatePlaylist'],
		mutationFn: async ({
			playlistId,
			name,
		}: {
			playlistId: number
			name: string
		}) => {
			const result = await playlistFacade.duplicatePlaylist(playlistId, name)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async () => {
			toast.success('复制成功')
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
		},
		onError: (error, { playlistId, name }) =>
			toastAndLogError(
				`复制播放列表失败: playlistId=${playlistId}, name=${name}`,
				error,
				SCOPE,
			),
	})
}

export const useEditPlaylistMetadata = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'editPlaylistMetadata'],
		mutationFn: async ({
			playlistId,
			payload,
		}: {
			playlistId: number
			payload: UpdatePlaylistPayload
		}) => {
			if (playlistId === 0) return
			const result = await playlistFacade.updatePlaylistMetadata(
				playlistId,
				payload,
			)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (_, variables) => {
			toast.success('操作成功')
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(variables.playlistId),
				}),
			])
		},
		onError: (error, { playlistId }) =>
			toastAndLogError(
				`修改播放列表信息失败：playlistId=${playlistId}`,
				error,
				SCOPE,
			),
	})
}

export const useDeletePlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'deletePlaylist'],
		mutationFn: async ({ playlistId }: { playlistId: number }) => {
			// 共享歌单需要有效 token；本地歌单无需，若获取失败静默忽略
			try {
				await ensureBBPlayerToken()
			} catch {
				// local 歌单不需要 token，继续执行
			}
			const result = await playlistFacade.deletePlaylist(playlistId)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async () => {
			toast.success('删除成功')
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
		},
		onError: (error, { playlistId }) =>
			toastAndLogError(
				`删除播放列表失败: playlistId=${playlistId}`,
				error,
				SCOPE,
			),
	})
}

export const useBatchDeleteTracksFromLocalPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'batchDeleteTracksFromLocalPlaylist'],
		mutationFn: async ({
			trackIds,
			playlistId,
		}: {
			trackIds: number[]
			playlistId: number
		}) => {
			const result = await playlistFacade.removeTracksFromPlaylist(
				playlistId,
				trackIds,
			)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (data, variables) => {
			toast.success('删除成功', {
				description:
					data.missingTrackIds.length !== 0
						? `但缺少了: ${data.missingTrackIds.toString()} (理论来说不应该出现此错误)`
						: undefined,
			})
			const promises = [
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(variables.playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(variables.playlistId),
				}),
			]
			for (const id of data.removedTrackIds) {
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistsContainingTrack(id),
					}),
				)
			}
			await Promise.all(promises)
		},
		onError: (error) =>
			toastAndLogError('从播放列表中删除 track 失败', error, SCOPE),
	})
}

export const useCreateNewLocalPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'createNewLocalPlaylist'],
		mutationFn: async (payload: {
			title: string
			description?: string
			coverUrl?: string
		}) => {
			const result = await playlistService.createPlaylist({
				...payload,
				type: 'local',
			})
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (playlist) => {
			toast.success('创建播放列表成功')
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(playlist.id),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlist.id),
				}),
			])
		},
		onError: (error) => toastAndLogError('创建播放列表失败', error, SCOPE),
	})
}

export const useReorderLocalPlaylistTrack = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'reorderLocalPlaylistTrack'],
		mutationFn: async ({
			playlistId,
			trackId,
			prevSortKey,
			nextSortKey,
		}: {
			playlistId: number
			trackId: number
			prevSortKey: string | null
			nextSortKey: string | null
		}) => {
			const result = await playlistFacade.reorderLocalPlaylistTrack(
				playlistId,
				{
					trackId,
					prevSortKey,
					nextSortKey,
				},
			)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (_, { playlistId }) => {
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistContents(playlistId),
			})
		},
		onError: (error) => toastAndLogError('重排序歌曲位置失败', error, SCOPE),
	})
}

/**
 * 批量添加 tracks 到本地播放列表
 * @param playlistId
 * @param payloads 应包含 track 和 artist，**artist 只能为 remote 来源**
 * @returns
 */
export const useBatchAddTracksToLocalPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'batchAddTracksToLocalPlaylist'],
		mutationFn: async ({
			playlistId,
			payloads,
		}: {
			playlistId: number
			payloads: { track: CreateTrackPayload; artist: CreateArtistPayload }[]
		}) => {
			const result = await playlistFacade.batchAddTracksToLocalPlaylist(
				playlistId,
				payloads,
			)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (trackIds, { playlistId }) => {
			toast.success('添加成功')
			const promises = [
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlistId),
				}),
			]
			for (const id of trackIds) {
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistsContainingTrack(id),
					}),
				)
			}
			await Promise.all(promises)
		},
		onError: (error) =>
			toastAndLogError('批量添加歌曲到播放列表失败', error, SCOPE),
	})
}

/**
 * 将本地歌单升级为共享歌单（启用分享）
 */
export const useEnableSharing = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'enableSharing'],
		mutationFn: async ({ playlistId }: { playlistId: number }) => {
			await ensureBBPlayerToken()
			const result = await sharedPlaylistFacade.enableSharing(playlistId)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (_, { playlistId }) => {
			toast.success('已开启共享')
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlistId),
				}),
			])
		},
		onError: (error) => toastAndLogError('启用共享歌单失败', error, SCOPE),
	})
}

/**
 * 通过 shareId 订阅一个共享歌单
 */
export const useSubscribeToSharedPlaylist = () => {
	const router = useRouter()
	return useMutation({
		mutationKey: ['db', 'playlist', 'subscribeToSharedPlaylist'],
		mutationFn: async ({ shareId }: { shareId: string }) => {
			await ensureBBPlayerToken()
			const result = await sharedPlaylistFacade.subscribeToPlaylist(shareId)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async ({ localPlaylistId }) => {
			toast.success('订阅成功')
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
			router.push({
				pathname: '/playlist/local/[id]',
				params: { id: String(localPlaylistId) },
			})
		},
		onError: (error) => toastAndLogError('订阅共享歌单失败', error, SCOPE),
	})
}

/**
 * 拉取共享歌单的增量变更
 */
export const usePullSharedPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'pullSharedPlaylist'],
		mutationFn: async ({ playlistId }: { playlistId: number }) => {
			await ensureBBPlayerToken()
			const result = await sharedPlaylistFacade.pullChanges(playlistId)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (_, { playlistId }) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
			])
		},
		onError: (error, { playlistId }) =>
			toastAndLogError(
				`拉取共享歌单失败: playlistId=${playlistId}`,
				error,
				SCOPE,
			),
	})
}
