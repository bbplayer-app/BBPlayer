import { type } from 'arktype'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { useAppStore } from '@/hooks/stores/useAppStore'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import {
	BilibiliAudioStreamParams,
	BilibiliAudioStreamResponse,
	BilibiliCollection,
	BilibiliCollectionAllContents,
	BilibiliCommentsResponse,
	BilibiliDanmakuItem,
	BilibiliDealFavoriteForOneVideoResponse,
	BilibiliFavoriteListAllContents,
	BilibiliFavoriteListContents,
	BilibiliHistoryVideo,
	BilibiliHotSearch,
	BilibiliMultipageVideo,
	BilibiliPlaylist,
	BilibiliQrCodeLoginStatus,
	BilibiliReplyCommentsResponse,
	BilibiliSearchSuggestionItem,
	BilibiliSearchVideo,
	BilibiliToViewVideo,
	BilibiliToViewVideoList,
	BilibiliUserInfo,
	BilibiliUserUploadedVideosResponse,
	BilibiliVideoDetails,
	BilibiliWebPlayerInfo,
} from '@/types/apis/bilibili'
import type { BilibiliTrack } from '@/types/core/media'
import log from '@/utils/log'

import { bilibiliApiClient } from './client'
import { DmSegMobileReply } from './proto/dm'
import { bv2av } from './utils'
import getWbiEncodedParams from './wbi'

const logger = log.extend('3Party.Bilibili.Api')

/**
 * B站 API 客户端类
 */
export class BilibiliApi {
	/**
	 * 获取用户观看历史记录
	 */
	getHistory(): ResultAsync<BilibiliHistoryVideo[], BilibiliApiError> {
		return bilibiliApiClient.get({
			target: '/x/v2/history',
			validator: BilibiliHistoryVideo.array(),
		})
	}

	/**
	 * 获取分区热门视频
	 */
	getPopularVideos(
		partition: string,
	): ResultAsync<BilibiliVideoDetails[], BilibiliApiError> {
		return bilibiliApiClient
			.get({
				target: `/x/web-interface/ranking/v2?rid=${partition}`,
				validator: type({
					list: BilibiliVideoDetails.array(),
				}).or('null'),
			})
			.map((response) => response?.list ?? [])
	}

	/**
	 * 获取用户收藏夹列表
	 */
	getFavoritePlaylists(
		userMid: number,
	): ResultAsync<BilibiliPlaylist[], BilibiliApiError> {
		return bilibiliApiClient
			.get({
				target: `/x/v3/fav/folder/created/list-all?up_mid=${userMid}`,
				validator: type({
					'list?': BilibiliPlaylist.array().or('null'),
				}).or('null'),
			})
			.map((response) => response?.list ?? [])
	}

	/**
	 * 创建收藏夹
	 */
	createFavoriteFolder(
		title: string,
		intro?: string,
		cover?: string,
		privacy: 0 | 1 = 0, // 0: public, 1: private
	): ResultAsync<
		{ id: number; title: string; mid: number; fid: number },
		BilibiliApiError
	> {
		return bilibiliApiClient.postWithCsrf<{
			id: number
			fid: number
			mid: number
			title: string
		}>({
			target: '/x/v3/fav/folder/add',
			payload: {
				title,
				intro: intro ?? '',
				privacy: String(privacy),
				cover: cover ?? '',
			},
			validator: type({
				id: 'number',
				fid: 'number',
				mid: 'number',
				title: 'string',
			}),
		})
	}

	/**
	 * 获取分段弹幕
	 * @param bvid 视频 BV 号
	 * @param cid 视频 CID
	 * @param segment_index 分段索引（6min 一段，从 1 开始）
	 */
	getSegDanmaku(
		bvid: string,
		cid: number,
		segment_index: number,
	): ResultAsync<BilibiliDanmakuItem[], BilibiliApiError> {
		const params = getWbiEncodedParams({
			type: 1,
			oid: cid,
			segment_index: segment_index,
			pid: bv2av(bvid),
		})

		return params
			.andThen((params) => {
				return bilibiliApiClient.getBuffer({
					target: '/x/v2/dm/wbi/web/seg.so',
					params,
				})
			})
			.andThen((buffer) => {
				try {
					const data = new Uint8Array(buffer)
					const decoded = DmSegMobileReply.decode(data)
					const t = BilibiliDanmakuItem.array()
					const validated = t(decoded.elems)
					if (validated instanceof type.errors) {
						return errAsync(
							new BilibiliApiError({
								message: `弹幕解包失败: ${validated.summary}`,
								type: 'ValidationFailed',
								cause: validated,
							}),
						)
					}
					return okAsync(validated)
				} catch (error) {
					return errAsync(
						new BilibiliApiError({
							message: `弹幕解包失败: ${error instanceof Error ? error.message : String(error)}`,
							type: 'ResponseFailed',
							cause: error,
						}),
					)
				}
			})
	}

	/**
	 * 搜索视频
	 * keyword: string,
	 * page: number,
	 * options?: { skipCookie?: boolean },
	 */
	searchVideos(
		keyword: string,
		page: number,
		options?: { skipCookie?: boolean },
	): ResultAsync<
		{ result: BilibiliSearchVideo[]; numPages: number },
		BilibiliApiError
	> {
		const params = getWbiEncodedParams({
			keyword,
			search_type: 'video',
			page: page.toString(),
		})

		return params
			.andThen((params) => {
				return bilibiliApiClient.get({
					target: '/x/web-interface/wbi/search/type',
					params,
					validator: type({
						'result?': BilibiliSearchVideo.array().or('null'),
						numPages: 'number',
					}),
					skipCookie: options?.skipCookie,
				})
			})
			.andThen((res) => {
				if (!res.result) {
					res.result = []
				}
				return okAsync(
					res as { result: BilibiliSearchVideo[]; numPages: number },
				)
			})
	}

	/**
	 * 获取热门搜索关键词
	 */
	getHotSearches(): ResultAsync<BilibiliHotSearch[], BilibiliApiError> {
		return bilibiliApiClient
			.get({
				target: '/x/web-interface/search/square',
				params: {
					limit: '10',
				},
				validator: type({
					trending: type({
						list: BilibiliHotSearch.array(),
					}),
				}).or('null'),
			})
			.map((response) => response?.trending.list ?? [])
	}

	/**
	 * 获取搜索建议
	 */
	getSearchSuggestions(
		term: string,
		signal?: AbortSignal,
	): ResultAsync<BilibiliSearchSuggestionItem[], BilibiliApiError> {
		// Manual fetch implementation, keeping as is but we could add manual validation
		const params = new URLSearchParams()
		params.append('main_ver', 'v1')
		params.append('term', term)
		const bilibiliCookie = useAppStore.getState().bilibiliCookie
		if (bilibiliCookie?.mid) {
			params.append('userid', bilibiliCookie.mid)
		}
		const url = `https://s.search.bilibili.com/main/suggest?${params.toString()}`

		return ResultAsync.fromPromise(
			fetch(url, {
				method: 'GET',
				signal: signal,
			}),
			(e) => {
				if (e instanceof Error && e.name === 'AbortError') {
					return new BilibiliApiError({
						message: '请求被取消',
						type: 'RequestAborted',
					})
				}
				return new BilibiliApiError({
					message: e instanceof Error ? e.message : String(e),
					type: 'RequestFailed',
				})
			},
		)
			.andThen((response) => {
				if (!response.ok) {
					return errAsync(
						new BilibiliApiError({
							message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
							msgCode: response.status,
							type: 'RequestFailed',
						}),
					)
				}
				return ResultAsync.fromPromise(
					response.json() as Promise<{
						code: number
						result: { tag: BilibiliSearchSuggestionItem[] }
					}>,
					(error) =>
						new BilibiliApiError({
							message: error instanceof Error ? error.message : String(error),
							type: 'ResponseFailed',
						}),
				)
			})
			.andThen((data) => {
				if (data.code !== 0) {
					return errAsync(
						new BilibiliApiError({
							message: `获取搜索建议失败: ${data.code}`,
							msgCode: data.code,
							type: 'RequestFailed',
						}),
					)
				}
				// Manual validation
				const validator = BilibiliSearchSuggestionItem.array()
				const result = validator(data.result.tag)
				if (result instanceof type.errors) {
					return errAsync(
						new BilibiliApiError({
							message: `搜索建议数据校验失败: ${result.summary}`,
							type: 'ValidationFailed',
							rawData: data.result.tag,
						}),
					)
				}
				return okAsync(result)
			})
	}

	/**
	 * 获取视频音频流信息
	 * 优先级（在 dolby 和 hi-res 都开启的情况下）：dolby > hi-res > normal
	 */
	getAudioStream(
		params: BilibiliAudioStreamParams,
	): ResultAsync<
		Exclude<BilibiliTrack['bilibiliMetadata']['bilibiliStreamUrl'], undefined>,
		BilibiliApiError
	> {
		const { bvid, cid, audioQuality, enableDolby, enableHiRes } = params
		const wbiParams = getWbiEncodedParams({
			bvid,
			cid: String(cid),
			fnval: '4048',
			fnver: '0',
			fourk: '1',
			qlt: String(audioQuality),
			voice_balance: '1',
		})

		return wbiParams
			.andThen((params) => {
				return bilibiliApiClient.get({
					target: '/x/player/wbi/playurl',
					params,
					validator: BilibiliAudioStreamResponse,
				})
			})
			.andThen((response) => {
				const { dash, durl, volume } = response

				if (!dash) {
					if (!durl?.[0]) {
						return errAsync(
							new BilibiliApiError({
								message: '请求到的流数据不包含 dash 或 durl 任一字段',
								type: 'AudioStreamError',
							}),
						)
					}
					logger.debug('老视频不存在 dash，回退到使用 durl 音频流')
					return okAsync({
						url: durl[0].url,
						quality: 114514,
						getTime: Date.now() + 60 * 1000, // Add 60s buffer
						type: 'mp4' as const,
						volume,
					})
				}

				if (enableDolby && dash?.dolby?.audio && dash.dolby.audio.length > 0) {
					logger.debug('优先使用 Dolby 音频流')
					return okAsync({
						url: dash.dolby.audio[0].baseUrl,
						quality: dash.dolby.audio[0].id,
						getTime: Date.now() + 60 * 1000, // Add 60s buffer
						type: 'dash' as const,
						volume,
					})
				}

				if (enableHiRes && dash?.flac?.audio) {
					logger.debug('次级使用 Hi-Res 音频流')
					return okAsync({
						url: dash.flac.audio.baseUrl,
						quality: dash.flac.audio.id,
						getTime: Date.now() + 60 * 1000, // Add 60s buffer
						type: 'dash' as const,
						volume,
					})
				}

				if (!dash?.audio || dash.audio.length === 0) {
					logger.error('未找到有效的音频流数据', { response })
					return errAsync(
						new BilibiliApiError({
							message: '未找到有效的音频流数据',
							type: 'AudioStreamError',
						}),
					)
				}

				let stream:
					| BilibiliTrack['bilibiliMetadata']['bilibiliStreamUrl']
					| null = null
				const getTime = Date.now() + 60 * 1000 // 加 60s 提前量

				// 尝试找到指定质量的音频流
				const targetAudio = dash.audio.find(
					(audio) => audio.id === audioQuality,
				)

				if (targetAudio) {
					stream = {
						url: targetAudio.baseUrl,
						quality: targetAudio.id,
						getTime,
						type: 'dash',
						volume,
					}
					logger.debug('找到指定质量音频流', { quality: audioQuality })
				} else {
					// Fallback: 使用最高质量如果未找到指定质量
					logger.warning('未找到指定质量音频流，使用最高质量', {
						requestedQuality: audioQuality,
						availableQualities: dash.audio.map((a) => a.id),
					})
					const highestQualityAudio = dash.audio[0]
					if (highestQualityAudio) {
						stream = {
							url: highestQualityAudio.baseUrl,
							quality: highestQualityAudio.id,
							getTime,
							type: 'dash',
							volume,
						}
					}
				}

				if (!stream) {
					logger.error('未能确定任何可用的音频流', { response })
					return errAsync(
						new BilibiliApiError({
							message: '未能确定任何可用的音频流',
							type: 'AudioStreamError',
						}),
					)
				}

				return okAsync(stream)
			})
	}

	/**
	 * 获取视频分P列表
	 */
	getPageList(
		bvid: string,
	): ResultAsync<BilibiliMultipageVideo[], BilibiliApiError> {
		return bilibiliApiClient.get({
			target: '/x/player/pagelist',
			params: {
				bvid,
			},
			validator: BilibiliMultipageVideo.array(),
		})
	}

	/**
	 * 获取登录本人信息
	 */
	getUserInfo(): ResultAsync<BilibiliUserInfo, BilibiliApiError> {
		return bilibiliApiClient.get({
			target: '/x/space/myinfo',
			validator: BilibiliUserInfo,
		})
	}

	/**
	 * 获取别人用户信息
	 */
	getOtherUserInfo(mid: number) {
		const params = getWbiEncodedParams({
			mid: mid.toString(),
		})
		return params.andThen((params) => {
			return bilibiliApiClient.get({
				target: '/x/space/wbi/acc/info',
				params,
				validator: BilibiliUserInfo,
			})
		})
	}

	/**
	 * 获取收藏夹内容(分页)
	 */
	getFavoriteListContents(
		favoriteId: number,
		pn: number,
	): ResultAsync<BilibiliFavoriteListContents, BilibiliApiError> {
		return bilibiliApiClient.get({
			target: '/x/v3/fav/resource/list',
			params: {
				media_id: favoriteId.toString(),
				pn: pn.toString(),
				ps: '40',
			},
			validator: BilibiliFavoriteListContents,
		})
	}

	/**
	 * 搜索收藏夹内容
	 * @param favoriteId 如果是全局搜索，随意提供一个**有效**的收藏夹 ID 即可
	 */
	searchFavoriteListContents(
		favoriteId: number,
		scope: 'all' | 'this',
		pn: number,
		keyword: string,
	): ResultAsync<BilibiliFavoriteListContents, BilibiliApiError> {
		return bilibiliApiClient
			.get({
				target: '/x/v3/fav/resource/list',
				params: {
					media_id: favoriteId.toString(),
					pn: pn.toString(),
					ps: '40',
					keyword,
					type: scope === 'this' ? '0' : '1',
				},
				validator: BilibiliFavoriteListContents,
			})
			.andThen((res) => {
				res.medias ??= []
				return okAsync(res)
			})
	}

	/**
	 * 获取收藏夹所有视频内容（仅bvid和类型）
	 * 此接口用于获取收藏夹内所有视频的bvid，常用于批量操作前获取所有目标ID
	 */
	getFavoriteListAllContents(
		favoriteId: number,
	): ResultAsync<BilibiliFavoriteListAllContents, BilibiliApiError> {
		return bilibiliApiClient
			.get({
				target: '/x/v3/fav/resource/ids',
				params: {
					media_id: favoriteId.toString(),
				},
				validator: BilibiliFavoriteListAllContents,
			})
			.map((response) => response.filter((item) => item.type === 2)) // 过滤非视频稿件 (type 2 is video)
	}

	/**
	 * 获取视频详细信息
	 */
	getVideoDetails(
		bvid: string,
	): ResultAsync<BilibiliVideoDetails, BilibiliApiError> {
		return bilibiliApiClient.get({
			target: '/x/web-interface/view',
			params: {
				bvid,
			},
			validator: BilibiliVideoDetails,
		})
	}

	/**
	 * 批量删除收藏夹内容
	 */
	batchDeleteFavoriteListContents(
		favoriteId: number,
		bvids: string[],
	): ResultAsync<0, BilibiliApiError> {
		const resourcesIds = bvids.map((bvid) => `${bv2av(bvid)}:2`)
		return bilibiliApiClient.postWithCsrf<0>({
			target: '/x/v3/fav/resource/batch-del',
			payload: {
				resources: resourcesIds.join(','),
				media_id: String(favoriteId),
				platform: 'web',
			},
		})
	}

	/**
	 * 获取用户追更的视频合集/收藏夹（非用户自己创建的）列表
	 */
	getCollectionsList(
		pageNumber: number,
		mid: number,
	): ResultAsync<
		{ list: BilibiliCollection[]; count: number; hasMore: boolean },
		BilibiliApiError
	> {
		return bilibiliApiClient
			.get({
				target: '/x/v3/fav/folder/collected/list',
				params: {
					pn: pageNumber.toString(),
					ps: '20', // Page size
					up_mid: mid.toString(),
					platform: 'web',
				},
				validator: type({
					'list?': BilibiliCollection.array().or('null'),
					count: 'number',
					has_more: 'boolean',
				}),
			})
			.map((response) => ({
				list: response.list ?? [],
				count: response.count,
				hasMore: response.has_more,
			}))
	}

	/**
	 * 获取合集详细信息和完整内容
	 */
	getCollectionAllContents(
		collectionId: number,
	): ResultAsync<BilibiliCollectionAllContents, BilibiliApiError> {
		return bilibiliApiClient.get({
			target: '/x/space/fav/season/list',
			params: {
				season_id: collectionId.toString(),
				ps: '20', // Page size, adjust if needed
				pn: '1', // Start from page 1
			},
			validator: BilibiliCollectionAllContents,
		})
	}

	/**
	 * 单个视频添加/删除到多个收藏夹
	 */
	dealFavoriteForOneVideo(
		bvid: string,
		addToFavoriteIds: string[],
		delInFavoriteIds: string[],
	): ResultAsync<BilibiliDealFavoriteForOneVideoResponse, BilibiliApiError> {
		const avid = bv2av(bvid)
		const addToFavoriteIdsCombined = addToFavoriteIds.join(',')
		const delInFavoriteIdsCombined = delInFavoriteIds.join(',')

		const data = {
			rid: String(avid),
			add_media_ids: addToFavoriteIdsCombined,
			del_media_ids: delInFavoriteIdsCombined,
			type: '2',
		}
		return bilibiliApiClient.postWithCsrf({
			target: '/x/v3/fav/resource/deal',
			payload: data,
			validator: BilibiliDealFavoriteForOneVideoResponse,
		})
	}

	/**
	 * 获取目标视频的收藏情况
	 */
	getTargetVideoFavoriteStatus(
		userMid: number,
		bvid: string,
	): ResultAsync<BilibiliPlaylist[], BilibiliApiError> {
		const avid = bv2av(bvid)
		return bilibiliApiClient
			.get({
				target: '/x/v3/fav/folder/created/list-all',
				params: {
					up_mid: userMid.toString(),
					rid: String(avid),
					type: '2',
				},
				validator: type({
					'list?': BilibiliPlaylist.array().or('null'),
				}).or('null'),
			})
			.map((response) => {
				if (!response?.list) {
					return []
				}
				return response.list
			})
	}

	/**
	 * 上报观看记录
	 */
	reportPlaybackHistory(
		bvid: string,
		cid: number,
		progress: number,
	): ResultAsync<0, BilibiliApiError> {
		const avid = bv2av(bvid)

		const data = {
			aid: String(avid),
			cid: String(cid),
			progress: Math.floor(progress).toString(),
		}
		return bilibiliApiClient
			.postWithCsrf<0>({
				target: '/x/v2/history/report',
				payload: data,
				validator: type('0'),
			})
			.map(() => 0)
	}

	/**
	 * 查询用户投稿视频明细
	 * 可通过 keyword 搜索用户发布的视频
	 */
	getUserUploadedVideos(
		mid: number,
		pn: number,
		keyword?: string,
	): ResultAsync<BilibiliUserUploadedVideosResponse, BilibiliApiError> {
		const params = getWbiEncodedParams({
			mid: mid.toString(),
			pn: pn.toString(),
			keyword: keyword ?? '',
			ps: '30',
		})
		return params.andThen((params) => {
			return bilibiliApiClient.get({
				target: '/x/space/wbi/arc/search',
				params,
				validator: BilibiliUserUploadedVideosResponse,
			})
		})
	}

	/**
	 * 获取评论区列表
	 * @param bvid 视频 BV 号
	 * @param next 加载游标，第一页为 0
	 * @param mode 排序方式 3: 热度, 2: 时间
	 */
	getComments(
		bvid: string,
		next: number,
		mode = 3,
	): ResultAsync<BilibiliCommentsResponse, BilibiliApiError> {
		const avid = bv2av(bvid)
		return bilibiliApiClient.get({
			target: '/x/v2/reply/main',
			params: {
				oid: String(avid),
				type: '1', // 1 for video
				mode: String(mode),
				next: String(next),
				plat: '1',
			},
			validator: BilibiliCommentsResponse,
		})
	}

	/**
	 * 获取楼中楼（子评论）列表
	 * @param bvid 视频 BV 号
	 * @param rpid 根评论 ID
	 * @param pn 页码，从 1 开始
	 */
	getReplyComments(
		bvid: string,
		rpid: number,
		pn: number,
	): ResultAsync<BilibiliReplyCommentsResponse, BilibiliApiError> {
		const avid = bv2av(bvid)
		return bilibiliApiClient.get({
			target: '/x/v2/reply/reply',
			params: {
				oid: String(avid),
				type: '1',
				root: String(rpid),
				pn: String(pn),
				ps: '20',
			},
			validator: BilibiliReplyCommentsResponse,
		})
	}

	/**
	 * 点赞/取消点赞评论
	 * @param bvid 视频 BV 号
	 * @param rpid 评论 ID
	 * @param action 1: 点赞, 0: 取消点赞
	 */
	likeComment(
		bvid: string,
		rpid: number,
		action: 0 | 1,
	): ResultAsync<0, BilibiliApiError> {
		const avid = bv2av(bvid)
		return bilibiliApiClient.postWithCsrf<0>({
			target: '/x/v2/reply/action',
			payload: {
				oid: String(avid),
				type: '1',
				rpid: String(rpid),
				action: String(action),
			},
		})
	}

	/**
	 * 申请登录二维码
	 */
	getLoginQrCode(): ResultAsync<
		{ url: string; qrcode_key: string },
		BilibiliApiError
	> {
		return bilibiliApiClient.get({
			target:
				'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
			validator: type({
				url: 'string',
				qrcode_key: 'string',
			}),
		})
	}

	/**
	 * 轮询二维码登录状态接口
	 */
	pollQrCodeLoginStatus(
		qrcode_key: string,
	): ResultAsync<
		{ status: BilibiliQrCodeLoginStatus; cookies: string },
		BilibiliApiError
	> {
		const reqFunction = async () => {
			const response = await fetch(
				`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcode_key}`,
				{
					method: 'GET',
					headers: {
						'User-Agent':
							'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0',
					},
				},
			)
			if (!response.ok) {
				throw new BilibiliApiError({
					message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
					msgCode: response.status,
					type: 'RequestFailed',
				})
			}
			const data = (await response.json()) as {
				data: { code: number }
				code: number
			}
			if (data.code !== 0) {
				throw new BilibiliApiError({
					message: `获取二维码登录状态失败: ${data.code}`,
					msgCode: data.code,
					rawData: data,
					type: 'ResponseFailed',
				})
			}
			// Manual validation if needed, but the structure is simple
			// The status is an enum
			let cookies = ''
			if (data.data.code === 0) {
				// 登录成功
				const setCookie = response.headers.get('set-cookie')
				if (setCookie) {
					cookies = setCookie
				}
			}

			// Validating enum check
			// const isValidStatus = Object.values(BilibiliQrCodeLoginStatus).includes(data.data.code);

			return {
				status: data.data.code as BilibiliQrCodeLoginStatus,
				cookies,
			}
		}

		return ResultAsync.fromPromise(reqFunction(), (error) => {
			if (error instanceof BilibiliApiError) {
				return error
			}
			return new BilibiliApiError({
				message: error instanceof Error ? error.message : String(error),
				type: 'RequestFailed',
			})
		})
	}

	/**
	 * 点赞视频
	 * @param bvid 视频 BV 号
	 * @param like true: 点赞, false: 取消点赞
	 */
	thumbUpVideo(
		bvid: string,
		like: boolean,
	): ResultAsync<
		{
			code: number
			message: string
			ttl: number
		},
		BilibiliApiError
	> {
		const avid = bv2av(bvid)
		return bilibiliApiClient.postWithCsrf({
			target: '/x/web-interface/archive/like',
			payload: {
				aid: String(avid),
				like: like ? '1' : '2',
			},
		})
	}

	/**
	 * 检查视频是否点赞
	 * @param bvid 视频 BV 号
	 */
	checkVideoIsThumbUp(
		bvid: string,
	): ResultAsync<{ has_like: number }, BilibiliApiError> {
		const avid = bv2av(bvid)
		return bilibiliApiClient.get({
			target: '/x/web-interface/archive/has/like',
			params: {
				aid: String(avid),
			},
		})
	}

	/**
	 * 删除稍后再看视频
	 * @param deleteAll 是否清空
	 * @param avid 视频 AVID
	 */
	deleteToViewVideo(
		deleteAll: boolean = false,
		avid?: number,
	): ResultAsync<0, BilibiliApiError> {
		if (deleteAll) {
			return this.clearToViewVideoList()
		}
		return bilibiliApiClient
			.postWithCsrf<0 | null>({
				target: '/x/v2/history/toview/del',
				payload: {
					aid: String(avid),
				},
				validator: type('0').or('null'),
			})
			.map(() => 0)
	}

	/**
	 * 清空稍后再看列表
	 */
	clearToViewVideoList(): ResultAsync<0, BilibiliApiError> {
		return bilibiliApiClient
			.postWithCsrf<0 | null>({
				target: '/x/v2/history/toview/clear',
				validator: type('0').or('null'),
			})
			.map(() => 0)
	}

	/**
	 * 获取稍后再看列表
	 */
	getToViewVideoList(): ResultAsync<
		{ list: BilibiliToViewVideo[]; count: number },
		BilibiliApiError
	> {
		return bilibiliApiClient
			.get({
				target: '/x/v2/history/toview/web',
				validator: BilibiliToViewVideoList,
			})
			.map((res) => ({
				list: res.list,
				count: res.count,
			}))
	}

	/**
	 * 获取 Web 播放器信息 (cid, avid required)
	 */
	getWebPlayerInfo(
		bvid: string,
		cid: number,
	): ResultAsync<BilibiliWebPlayerInfo, BilibiliApiError> {
		const avid = bv2av(bvid)
		const params = getWbiEncodedParams({
			aid: String(avid),
			cid: String(cid),
		})
		return params.andThen((p) => {
			return bilibiliApiClient.get({
				target: '/x/player/wbi/v2',
				params: p,
				validator: BilibiliWebPlayerInfo,
			})
		})
	}

	/**
	 * 获取 B23 短链接的真实 URL
	 */
	getB23ResolvedUrl(shortUrl: string): ResultAsync<string, BilibiliApiError> {
		return ResultAsync.fromPromise(
			fetch(shortUrl, {
				method: 'HEAD',
				redirect: 'follow',
			}).then((res) => res.url),
			(e) =>
				new BilibiliApiError({
					message: e instanceof Error ? e.message : String(e),
					type: 'RequestFailed',
				}),
		)
	}
}

export const bilibiliApi = new BilibiliApi()
