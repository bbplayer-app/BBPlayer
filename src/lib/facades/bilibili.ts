import { bilibiliApi } from '@/lib/api/bilibili/api'
import { av2bv } from '@/lib/api/bilibili/utils'
import { FetchRemotePlaylistMetadataFailedError } from '@/lib/errors/facade'
import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import type { Playlist } from '@/types/core/media'
import { Context, Effect, Layer } from 'effect'

export interface BilibiliFacadeSignature {
	readonly fetchRemotePlaylistMetadata: (
		remoteId: number,
		type: Playlist['type'],
	) => Effect.Effect<
		{
			title: string
			description: string
			coverUrl: string
		},
		BilibiliApiError | FetchRemotePlaylistMetadataFailedError
	>
}

export class BilibiliFacade extends Context.Tag('BilibiliFacade')<
	BilibiliFacade,
	BilibiliFacadeSignature
>() {}

export const BilibiliFacadeLive = Layer.succeed(
	BilibiliFacade,
	BilibiliFacade.of({
		fetchRemotePlaylistMetadata: (remoteId, type) =>
			Effect.gen(function* () {
				switch (type) {
					case 'collection': {
						const result = yield* bilibiliApi
							.getCollectionAllContents(remoteId)
							.pipe(
								Effect.mapError(
									(e) =>
										new FetchRemotePlaylistMetadataFailedError({
											source: 'bilibili',
											remoteId: String(remoteId),
											cause: e,
										}),
								),
							)
						const metadata = result.info
						return {
							title: metadata.title,
							description: metadata.intro,
							coverUrl: metadata.cover,
						}
					}
					case 'multi_page': {
						const result = yield* bilibiliApi
							.getVideoDetails(av2bv(remoteId))
							.pipe(
								Effect.mapError(
									(e) =>
										new FetchRemotePlaylistMetadataFailedError({
											source: 'bilibili',
											remoteId: String(remoteId),
											cause: e,
										}),
								),
							)
						return {
							title: result.title,
							description: result.desc,
							coverUrl: result.pic,
						}
					}
					case 'favorite': {
						const result = yield* bilibiliApi
							.getFavoriteListContents(remoteId, 1)
							.pipe(
								Effect.mapError(
									(e) =>
										new FetchRemotePlaylistMetadataFailedError({
											source: 'bilibili',
											remoteId: String(remoteId),
											cause: e,
										}),
								),
							)
						const metadata = result.info
						return {
							title: metadata.title,
							description: metadata.intro,
							coverUrl: metadata.cover,
						}
					}
					default:
						return yield* new FetchRemotePlaylistMetadataFailedError({
							source: 'bilibili',
							remoteId: String(remoteId),
							cause: `获取播放列表元数据失败：未知的播放列表类型：${type}`,
						})
				}
			}),
	}),
)

export const bilibiliFacade = Effect.serviceFunctions(BilibiliFacade)
