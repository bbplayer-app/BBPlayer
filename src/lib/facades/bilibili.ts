import {
	bilibiliApi,
	type bilibiliApi as BilibiliApiService,
} from '@/lib/api/bilibili/api'
import { av2bv } from '@/lib/api/bilibili/utils'
import { createFacadeError } from '@/lib/errors/facade'
import type { Playlist } from '@/types/core/media'
import { SPAN_STATUS_ERROR, SPAN_STATUS_OK } from '@/types/sentry/span'
import * as Sentry from '@sentry/react-native'
import { err, ok } from 'neverthrow'

export class BilibiliFacade {
	constructor(private readonly bilibiliApi: typeof BilibiliApiService) {}

	public async fetchRemotePlaylistMetadata(
		remoteId: number,
		type: Playlist['type'],
	) {
		return Sentry.startSpan(
			{
				op: 'function',
				name: 'BilibiliFacade.fetchRemotePlaylistMetadata',
				attributes: {
					type: type,
				},
			},
			async (span) => {
				switch (type) {
					case 'collection': {
						const result =
							await this.bilibiliApi.getCollectionAllContents(remoteId)
						if (result.isErr()) {
							span.setStatus({ code: SPAN_STATUS_ERROR })
							return err(
								createFacadeError(
									'fetchRemotePlaylistMetadataFailed',
									'获取合集元数据失败',
									{ cause: result.error },
								),
							)
						}
						const metadata = result.value.info
						span.setStatus({ code: SPAN_STATUS_OK })
						return ok({
							title: metadata.title,
							description: metadata.intro,
							coverUrl: metadata.cover,
						})
					}
					case 'multi_page': {
						const result = await this.bilibiliApi.getVideoDetails(
							av2bv(remoteId),
						)
						if (result.isErr()) {
							span.setStatus({ code: SPAN_STATUS_ERROR })
							return err(
								createFacadeError(
									'fetchRemotePlaylistMetadataFailed',
									'获取多集视频元数据失败',
									{ cause: result.error },
								),
							)
						}
						const metadata = result.value
						span.setStatus({ code: SPAN_STATUS_OK })
						return ok({
							title: metadata.title,
							description: metadata.desc,
							coverUrl: metadata.pic,
						})
					}
					case 'favorite': {
						const result = await this.bilibiliApi.getFavoriteListContents(
							remoteId,
							1,
						)
						if (result.isErr()) {
							span.setStatus({ code: SPAN_STATUS_ERROR })
							return err(
								createFacadeError(
									'fetchRemotePlaylistMetadataFailed',
									'获取收藏夹元数据失败',
									{ cause: result.error },
								),
							)
						}
						const metadata = result.value.info
						span.setStatus({ code: SPAN_STATUS_OK })
						return ok({
							title: metadata.title,
							description: metadata.intro,
							coverUrl: metadata.cover,
						})
					}
					default:
						span.setStatus({ code: SPAN_STATUS_ERROR })
						return err(
							createFacadeError(
								'fetchRemotePlaylistMetadataFailed',
								`获取播放列表元数据失败：未知的播放列表类型：${type}`,
							),
						)
				}
			},
		)
	}
}

export const bilibiliFacade = new BilibiliFacade(bilibiliApi)
