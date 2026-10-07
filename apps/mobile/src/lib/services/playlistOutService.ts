import * as Application from 'expo-application'
import { decode } from 'he'
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'
import { Platform } from 'react-native'
import { fetch } from 'react-native-nitro-fetch'

import {
	parseKugouCredentialsInput,
	playlistOutStorage,
} from '@/lib/storage/playlistOutStorage'
import type { GenericPlaylist, GenericTrack } from '@/types/external_playlist'
import log from '@/utils/log'
import toast from '@/utils/toast'

const logger = log.extend('Services.PlaylistOut')

const API_BASE = 'https://playlistout-api.lengxiqwq.com'
const REQUEST_TIMEOUT_MS = 25000
const FALLBACK_APP_VERSION = '2.7.0'

export interface PlaylistOutClientEnv {
	deviceClass: 'mobile' | 'desktop'
	os: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown'
	version: string
}

function decodeHtmlText(raw: string): string {
	if (!raw) return ''
	return decode(raw.replace(/<br\s*\/?>/gi, '\n')).trim()
}

function formatPlaylistDate(raw: unknown): string | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined

	if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
		const ms = raw > 1e11 ? raw : raw * 1000
		const d = new Date(ms)
		if (!isNaN(d.getTime())) {
			const yyyy = d.getFullYear()
			const mm = String(d.getMonth() + 1).padStart(2, '0')
			const dd = String(d.getDate()).padStart(2, '0')
			return `${yyyy}-${mm}-${dd}`
		}
		return undefined
	}

	if (typeof raw === 'string') {
		const trimmed = raw.trim()
		if (!trimmed) return undefined
		if (/^\d+$/.test(trimmed)) {
			return formatPlaylistDate(Number(trimmed))
		}
		const dateMatch = trimmed.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
		if (dateMatch) {
			return dateMatch[1].replace(/\//g, '-')
		}
		const parsed = Date.parse(trimmed.replace(' ', 'T'))
		if (!isNaN(parsed) && parsed > 0) {
			return formatPlaylistDate(parsed)
		}
		return trimmed
	}

	return undefined
}

function extractTags(rawTags: unknown): string[] | undefined {
	if (!Array.isArray(rawTags) || rawTags.length === 0) return undefined
	const tags = rawTags
		.map((t: unknown) => {
			if (typeof t === 'string') return decodeHtmlText(t)
			if (
				t &&
				typeof t === 'object' &&
				'name' in t &&
				typeof t.name === 'string'
			) {
				return decodeHtmlText(t.name)
			}
			if (
				t &&
				typeof t === 'object' &&
				'tagname' in t &&
				typeof t.tagname === 'string'
			) {
				return decodeHtmlText(t.tagname)
			}
			return ''
		})
		.filter(Boolean)
	return tags.length > 0 ? tags : undefined
}

// In-memory cache for locally loaded JSON playlists
const localPlaylistCache = new Map<
	string,
	{ playlist: GenericPlaylist; tracks: GenericTrack[] }
>()

export class PlaylistOutService {
	/**
	 * Detect host runtime environment (aligned with MusicFree plugin detectClientEnvironment)
	 */
	public detectClientEnvironment(): PlaylistOutClientEnv {
		const rawOs = Platform.OS
		let os: PlaylistOutClientEnv['os'] = 'unknown'
		if (rawOs === 'android') os = 'android'
		else if (rawOs === 'ios') os = 'ios'
		else if (rawOs === 'windows') os = 'windows'
		else if (rawOs === 'macos') os = 'macos'

		const deviceClass: PlaylistOutClientEnv['deviceClass'] =
			os === 'windows' || os === 'macos' ? 'desktop' : 'mobile'

		const rawVer = (
			Application.nativeApplicationVersion || FALLBACK_APP_VERSION
		).trim()
		const version = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/.test(rawVer)
			? rawVer
			: FALLBACK_APP_VERSION

		return {
			deviceClass,
			os,
			version,
		}
	}

	/**
	 * Build standardized PlaylistOut telemetry & attribution headers
	 * Strictly aligned with PlaylistOut Analytics V2 & MusicFree plugin contract
	 */
	public getPlaylistOutHeaders(): Record<string, string> {
		const envInfo = this.detectClientEnvironment()
		return {
			Accept: 'application/json, text/plain, */*',
			'User-Agent': `PlaylistOut-BBPlayer/${envInfo.version} (${envInfo.deviceClass}; ${envInfo.os})`,
			'X-PlaylistOut-Client-Type': 'plugin',
			'X-PlaylistOut-Client-Id': 'bbplayer',
			'X-PlaylistOut-Client-Version': envInfo.version,
			'X-PlaylistOut-Device-Class': envInfo.deviceClass,
			'X-PlaylistOut-Host': envInfo.os,
		}
	}

	/**
	 * Detect music platform from URL or text
	 */
	public detectPlatform(
		text: string,
	): 'netease' | 'qq' | 'kugou' | 'qishui' | 'json' | null {
		const trimmed = text.trim()
		if (!trimmed) return null
		if (
			trimmed.startsWith('{') ||
			trimmed.startsWith('[') ||
			/^https?:\/\/[^\s]+\.json(?:\?[^\s]*)?$/i.test(trimmed)
		) {
			return 'json'
		}
		if (/163\.com|126\.net|163cn\.tv/i.test(trimmed)) return 'netease'
		if (/qq\.com/i.test(trimmed)) return 'qq'
		if (/kugou\.com/i.test(trimmed)) return 'kugou'
		if (/qishui|douyin/i.test(trimmed)) return 'qishui'
		return null
	}

	/**
	 * Cache a locally parsed playlist for subsequent sync retrieval
	 */
	public setCachedPlaylist(
		id: string,
		data: { playlist: GenericPlaylist; tracks: GenericTrack[] },
	): void {
		localPlaylistCache.set(id, data)
	}

	/**
	 * Retrieve a cached locally parsed playlist
	 */
	public getCachedPlaylist(
		id: string,
	): ResultAsync<{ playlist: GenericPlaylist; tracks: GenericTrack[] }, Error> {
		const cached = localPlaylistCache.get(id)
		if (!cached) {
			return errAsync(new Error('未找到缓存的本地歌单数据，请重新选择文件导入'))
		}
		return okAsync(cached)
	}

	/**
	 * Parse JSON playlist string (exported from Playlist Out or raw tracks list)
	 */
	public parseJsonPlaylist(
		jsonStr: string,
		fallbackTitle = '本地导入歌单',
	): Result<{ playlist: GenericPlaylist; tracks: GenericTrack[] }, Error> {
		try {
			const parsed = JSON.parse(jsonStr)
			let rawTracks: unknown[] = []
			let playlistMeta: Record<string, unknown> = {}

			if (Array.isArray(parsed)) {
				rawTracks = parsed
			} else if (parsed && typeof parsed === 'object') {
				playlistMeta = parsed as Record<string, unknown>
				if (Array.isArray(parsed.tracks)) {
					rawTracks = parsed.tracks
				} else if (
					parsed.data?.result?.tracks &&
					Array.isArray(parsed.data.result.tracks)
				) {
					rawTracks = parsed.data.result.tracks
					if (parsed.data.result && typeof parsed.data.result === 'object') {
						playlistMeta = parsed.data.result
					}
				} else if (
					parsed.result?.tracks &&
					Array.isArray(parsed.result.tracks)
				) {
					rawTracks = parsed.result.tracks
					if (parsed.result && typeof parsed.result === 'object') {
						playlistMeta = parsed.result
					}
				} else if (parsed.data?.tracks && Array.isArray(parsed.data.tracks)) {
					rawTracks = parsed.data.tracks
				}
			}

			if (rawTracks.length === 0) {
				return err(new Error('JSON 数据中未包含歌曲列表或列表为空'))
			}

			const tracks = this.normalizeTracks(rawTracks)
			const playlistId = `local_json_${Date.now()}`
			const rawTitle =
				(typeof playlistMeta.name === 'string' && playlistMeta.name) ||
				(typeof playlistMeta.title === 'string' && playlistMeta.title) ||
				fallbackTitle
			const title = decodeHtmlText(rawTitle) || fallbackTitle
			const coverUrl =
				(typeof playlistMeta.coverUrl === 'string' && playlistMeta.coverUrl) ||
				(typeof playlistMeta.cover === 'string' && playlistMeta.cover) ||
				(typeof playlistMeta.picUrl === 'string' && playlistMeta.picUrl) ||
				''
			const rawDesc =
				(typeof playlistMeta.description === 'string' &&
					playlistMeta.description) ||
				(typeof playlistMeta.intro === 'string' && playlistMeta.intro) ||
				(typeof playlistMeta.desc === 'string' && playlistMeta.desc) ||
				''
			const description = decodeHtmlText(rawDesc)

			let authorName = ''
			if (
				typeof playlistMeta.creator === 'string' &&
				playlistMeta.creator.trim()
			) {
				authorName = playlistMeta.creator.trim()
			} else if (
				typeof playlistMeta.author === 'string' &&
				playlistMeta.author.trim()
			) {
				authorName = playlistMeta.author.trim()
			} else if (
				typeof playlistMeta.creator === 'object' &&
				playlistMeta.creator
			) {
				if (
					'nickname' in playlistMeta.creator &&
					typeof playlistMeta.creator.nickname === 'string'
				) {
					authorName = playlistMeta.creator.nickname.trim()
				} else if (
					'name' in playlistMeta.creator &&
					typeof playlistMeta.creator.name === 'string'
				) {
					authorName = playlistMeta.creator.name.trim()
				}
			} else if (
				typeof playlistMeta.author === 'object' &&
				playlistMeta.author
			) {
				if (
					'name' in playlistMeta.author &&
					typeof playlistMeta.author.name === 'string'
				) {
					authorName = playlistMeta.author.name.trim()
				} else if (
					'nickname' in playlistMeta.author &&
					typeof playlistMeta.author.nickname === 'string'
				) {
					authorName = playlistMeta.author.nickname.trim()
				}
			}

			authorName = decodeHtmlText(authorName) || '本地导入'

			const createTime = formatPlaylistDate(
				playlistMeta.createTime ??
					playlistMeta.ctime ??
					playlistMeta.publishTime ??
					playlistMeta.publishtime ??
					playlistMeta.create_time,
			)
			const updateTime = formatPlaylistDate(
				playlistMeta.updateTime ??
					playlistMeta.mtime ??
					playlistMeta.update_time,
			)
			const tags = extractTags(playlistMeta.tags)
			const playCount =
				typeof playlistMeta.playCount === 'number' && playlistMeta.playCount > 0
					? playlistMeta.playCount
					: undefined
			const platform =
				typeof playlistMeta.platform === 'string' && playlistMeta.platform
					? playlistMeta.platform
					: undefined

			return ok({
				playlist: {
					id: playlistId,
					title,
					coverUrl,
					description,
					trackCount: tracks.length,
					author: {
						name: authorName,
						id: 0,
					},
					createTime,
					updateTime,
					tags,
					playCount,
					platform,
				},
				tracks,
			})
		} catch (e) {
			return err(
				new Error(
					`解析 JSON 失败: ${e instanceof Error ? e.message : String(e)}`,
				),
			)
		}
	}

	/**
	 * Call Playlist Out production API to resolve playlist from query/link
	 */
	public resolvePlaylist(
		query: string,
		signal?: AbortSignal,
	): ResultAsync<{ playlist: GenericPlaylist; tracks: GenericTrack[] }, Error> {
		const trimmed = query.trim()
		if (!trimmed) {
			return errAsync(new Error('歌单链接不能为空'))
		}

		// Direct JSON text handling
		if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
			const jsonRes = this.parseJsonPlaylist(trimmed, '直接粘贴的 JSON 歌单')
			if (jsonRes.isErr()) {
				return errAsync(jsonRes.error)
			}
			return okAsync(jsonRes.value)
		}

		// Online JSON URL handling (aligned with MusicFree plugin)
		const jsonUrlMatch = trimmed.match(
			/^https?:\/\/[^\s]+\.json(?:\?[^\s]*)?$/i,
		)
		if (jsonUrlMatch) {
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
			if (signal) {
				signal.addEventListener('abort', () => controller.abort(), {
					once: true,
				})
			}

			return ResultAsync.fromPromise(
				fetch(jsonUrlMatch[0], {
					headers: this.getPlaylistOutHeaders(),
					signal: controller.signal,
				})
					.then(async (res) => {
						clearTimeout(timeoutId)
						if (!res.ok) {
							throw new Error(`HTTP ${res.status}`)
						}
						return res.text()
					})
					.finally(() => {
						clearTimeout(timeoutId)
					}),
				(e) => {
					clearTimeout(timeoutId)
					return new Error(
						`拉取在线 JSON 歌单失败: ${e instanceof Error ? e.message : String(e)}`,
					)
				},
			).andThen((rawText) => {
				const jsonRes = this.parseJsonPlaylist(rawText, '在线 JSON 歌单')
				if (jsonRes.isErr()) {
					return errAsync(jsonRes.error)
				}
				return okAsync(jsonRes.value)
			})
		}

		const apiUrl = `${API_BASE}/api/v1/resolve?q=${encodeURIComponent(trimmed)}&type=playlist`
		const headers: Record<string, string> = {
			...this.getPlaylistOutHeaders(),
		}

		let kugouToken = playlistOutStorage.getKugouToken()
		let kugouUserid = playlistOutStorage.getKugouUserid()

		// If token contains combined credentials, auto-parse
		if (kugouToken) {
			const parsed = parseKugouCredentialsInput(kugouToken)
			if (parsed) {
				kugouToken = parsed.token
				if (!kugouUserid && parsed.userid) {
					kugouUserid = parsed.userid
				}
			}
		}

		if (kugouToken) {
			headers.Authorization = `Bearer ${kugouToken}`
			headers['X-Kugou-Token'] = kugouToken
			if (kugouUserid) {
				headers['X-Kugou-Userid'] = kugouUserid
			}
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

		if (signal) {
			signal.addEventListener('abort', () => controller.abort(), { once: true })
		}

		return ResultAsync.fromPromise(
			fetch(apiUrl, {
				headers,
				signal: controller.signal,
			})
				.then(async (res) => {
					clearTimeout(timeoutId)
					if (!res.ok) {
						let detail = `HTTP ${res.status}`
						try {
							const errBody = await res.json()
							if (errBody?.error?.message) {
								detail = errBody.error.message
							}
						} catch {
							// fallback
						}
						throw new Error(`解析失败: ${detail}`)
					}
					return res.json()
				})
				.finally(() => {
					clearTimeout(timeoutId)
				}),
			(e) => {
				clearTimeout(timeoutId)
				if (controller.signal.aborted) {
					return new Error('请求 Playlist Out 超时，请检查网络或稍后重试')
				}
				return new Error(
					`请求 Playlist Out API 失败: ${e instanceof Error ? e.message : String(e)}`,
				)
			},
		).andThen((data) => {
			if (!data?.success) {
				const errMsg =
					data?.error?.message ||
					data?.error?.code ||
					'Playlist Out 解析未能返回有效数据'
				return errAsync(new Error(`歌单解析失败: ${errMsg}`))
			}

			if (data.meta?.client) {
				logger.debug('PlaylistOut attribution acknowledged', {
					channel: data.meta.client.channel,
					clientId: data.meta.client.id,
					clientVersion: data.meta.client.version,
					hostPlatform: data.meta.client.hostPlatform,
					country: data.meta.server?.country,
					region: data.meta.server?.region,
				})
			}

			const result = data.data?.result || data.result
			if (!result) {
				return errAsync(new Error('未在解析结果中找到歌单详情'))
			}

			const rawTracks = result.tracks
			if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
				return errAsync(new Error('解析成功，但该歌单内未找到有效歌曲'))
			}

			const tracks = this.normalizeTracks(rawTracks)
			const rawPlaylistTitle =
				(typeof result.name === 'string' && result.name) ||
				(typeof result.title === 'string' && result.title) ||
				'导入外部歌单'
			const playlistTitle = decodeHtmlText(rawPlaylistTitle) || '导入外部歌单'
			const playlistCoverUrl =
				(typeof result.coverUrl === 'string' && result.coverUrl) ||
				(typeof result.cover === 'string' && result.cover) ||
				(typeof result.picUrl === 'string' && result.picUrl) ||
				''
			const platformName =
				(typeof data.data?.platform === 'string' && data.data.platform) ||
				(typeof result.platform === 'string' && result.platform) ||
				'外部歌单'
			const rawPlaylistDesc =
				(typeof result.description === 'string' && result.description) ||
				(typeof result.intro === 'string' && result.intro) ||
				(typeof result.desc === 'string' && result.desc) ||
				''
			const playlistDesc = decodeHtmlText(rawPlaylistDesc)

			let authorName = ''
			let authorId = 0

			// 1. String creator / author / owner / user
			if (typeof result.creator === 'string' && result.creator.trim()) {
				authorName = result.creator.trim()
			} else if (typeof result.author === 'string' && result.author.trim()) {
				authorName = result.author.trim()
			} else if (typeof result.owner === 'string' && result.owner.trim()) {
				authorName = result.owner.trim()
			} else if (typeof result.user === 'string' && result.user.trim()) {
				authorName = result.user.trim()
			}

			// 2. Object author / creator
			if (!authorName) {
				if (typeof result.author === 'object' && result.author) {
					if (
						'name' in result.author &&
						typeof result.author.name === 'string'
					) {
						authorName = result.author.name.trim()
					} else if (
						'nickname' in result.author &&
						typeof result.author.nickname === 'string'
					) {
						authorName = result.author.nickname.trim()
					}
					if ('id' in result.author && typeof result.author.id === 'number') {
						authorId = result.author.id
					}
				} else if (typeof result.creator === 'object' && result.creator) {
					if (
						'nickname' in result.creator &&
						typeof result.creator.nickname === 'string'
					) {
						authorName = result.creator.nickname.trim()
					} else if (
						'name' in result.creator &&
						typeof result.creator.name === 'string'
					) {
						authorName = result.creator.name.trim()
					}
					if (
						'userId' in result.creator &&
						typeof result.creator.userId === 'number'
					) {
						authorId = result.creator.userId
					}
				}
			}

			// 3. Fallback to platform user or "未知创建者"
			authorName =
				decodeHtmlText(authorName) ||
				(platformName ? `${platformName}用户` : '未知创建者')

			const createTime = formatPlaylistDate(
				result.createTime ??
					result.ctime ??
					result.publishTime ??
					result.publishtime ??
					result.create_time,
			)
			const updateTime = formatPlaylistDate(
				result.updateTime ?? result.mtime ?? result.update_time,
			)
			const tags = extractTags(result.tags)
			const playCount =
				typeof result.playCount === 'number' && result.playCount > 0
					? result.playCount
					: undefined

			const playlist: GenericPlaylist = {
				id:
					typeof result.id === 'string' || typeof result.id === 'number'
						? String(result.id)
						: String(Date.now()),
				title: playlistTitle,
				coverUrl: playlistCoverUrl,
				description: playlistDesc,
				trackCount:
					typeof result.trackCount === 'number'
						? result.trackCount
						: tracks.length,
				author: {
					name: authorName,
					id: authorId,
				},
				createTime,
				updateTime,
				tags,
				playCount,
				platform: platformName,
			}

			const isPreview =
				result.retrieval?.mode === 'preview' || result.isPartialPreview === true
			if (isPreview && platformName === 'kugou') {
				toast.info(
					'当前未配置或酷狗凭据已失效，仅展示前 10 首预览曲目。可在设置中填入酷狗 Token + UID 解锁完整歌单。',
				)
			}

			logger.info(
				`Successfully resolved playlist "${playlist.title}" with ${tracks.length} tracks via Playlist Out`,
			)

			return okAsync({ playlist, tracks })
		})
	}

	/**
	 * Normalize raw track objects into standard GenericTrack
	 */
	private normalizeTracks(rawTracks: unknown[]): GenericTrack[] {
		return rawTracks
			.map((item): GenericTrack | null => {
				if (!item || typeof item !== 'object') return null
				const t = item as Record<string, unknown>

				const rawTitle =
					typeof t.title === 'string'
						? t.title
						: typeof t.name === 'string'
							? t.name
							: ''
				const title = decodeHtmlText(rawTitle)
				if (!title) return null

				let artists: string[] = []
				if (Array.isArray(t.artists)) {
					artists = t.artists
						.map((a) => {
							if (typeof a === 'string') return decodeHtmlText(a)
							if (
								a &&
								typeof a === 'object' &&
								'name' in a &&
								typeof a.name === 'string'
							) {
								return decodeHtmlText(a.name)
							}
							return ''
						})
						.filter(Boolean)
				} else if (typeof t.artist === 'string' && t.artist.trim()) {
					artists = [decodeHtmlText(t.artist)]
				} else if (
					t.artist &&
					typeof t.artist === 'object' &&
					'name' in t.artist &&
					typeof t.artist.name === 'string'
				) {
					artists = [decodeHtmlText(t.artist.name)]
				}

				if (artists.length === 0) {
					artists = ['未知歌手']
				}

				let album = ''
				if (typeof t.album === 'string') {
					album = decodeHtmlText(t.album)
				} else if (
					t.album &&
					typeof t.album === 'object' &&
					'name' in t.album &&
					typeof t.album.name === 'string'
				) {
					album = decodeHtmlText(t.album.name)
				}

				const rawDuration = Number(
					t.durationMs ?? t.duration ?? t.dt ?? t.interval ?? 0,
				)
				// Convert seconds to milliseconds if duration is in seconds
				const duration =
					rawDuration > 0 && rawDuration < 10000 && t.durationMs === undefined
						? Math.round(rawDuration * 1000)
						: Math.round(rawDuration)

				const coverUrl =
					(typeof t.coverUrl === 'string' && t.coverUrl) ||
					(typeof t.cover === 'string' && t.cover) ||
					(typeof t.picUrl === 'string' && t.picUrl) ||
					(typeof t.artwork === 'string' && t.artwork) ||
					undefined

				const translatedTitle =
					typeof t.translatedTitle === 'string'
						? decodeHtmlText(t.translatedTitle)
						: undefined

				return {
					title,
					artists,
					album,
					duration,
					coverUrl,
					translatedTitle,
				}
			})
			.filter((t): t is GenericTrack => t !== null)
	}

	/**
	 * Verify Kugou token and userid against PlaylistOut official auth status endpoint
	 */
	public async verifyKugouCredentials(
		token: string,
		userid: string,
	): Promise<{ valid: boolean; message: string }> {
		let cleanToken = token.trim()
		let cleanUserid = userid.trim()

		const parsedToken = parseKugouCredentialsInput(cleanToken)
		const parsedUserid = parseKugouCredentialsInput(cleanUserid)
		cleanToken = parsedToken?.token || parsedUserid?.token || cleanToken
		cleanUserid = parsedToken?.userid || parsedUserid?.userid || cleanUserid

		if (!cleanToken) {
			return { valid: false, message: 'Token 不能为空' }
		}
		if (!cleanUserid) {
			return {
				valid: false,
				message:
					'用户 ID (UID) 不能为空。酷狗官方接口必须同时提供 Token 与 UID 才能解锁完整歌单。',
			}
		}

		try {
			const res = await fetch(`${API_BASE}/api/kugou/auth/status`, {
				headers: {
					...this.getPlaylistOutHeaders(),
					Authorization: `Bearer ${cleanToken}`,
					'X-Kugou-Token': cleanToken,
					'X-Kugou-Userid': cleanUserid,
				},
			})

			const data = await res.json()
			if (res.ok && data?.success && data?.data?.status === 'valid') {
				return { valid: true, message: '酷狗账号凭据有效，已成功连接！' }
			}

			if (data?.data?.status === 'invalid') {
				return {
					valid: false,
					message:
						data.data.message ||
						'凭据已失效或已过期，请前往网页端重新扫码登录获取。',
				}
			}

			const errMsg = data?.error?.message || `验证失败 (HTTP ${res.status})`
			return { valid: false, message: errMsg }
		} catch (e) {
			return {
				valid: false,
				message: `网络请求失败: ${e instanceof Error ? e.message : String(e)}`,
			}
		}
	}
}

export const playlistOutService = new PlaylistOutService()
