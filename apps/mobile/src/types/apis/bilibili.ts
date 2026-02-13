/**
 * 获取音频流入参（dash）
 */
interface BilibiliAudioStreamParams {
	bvid: string
	cid: number
	audioQuality: number
	enableDolby: boolean
	enableHiRes: boolean
}

/**
 * 获取音频流（dash）返回值
 */
interface BilibiliAudioStreamResponse {
	durl?: [
		{
			order: number // 恒为 1
			url: string
			backup_url: string[]
		},
	]
	dash?: {
		audio:
			| {
					id: number
					baseUrl: string
					backupUrl: string[]
			  }[]
			| null
		dolby?: {
			type: number
			audio:
				| {
						id: number
						baseUrl: string
						backupUrl: string[]
				  }[]
				| null
		} | null
		flac?: {
			display: boolean
			audio: {
				id: number
				baseUrl: string
				backupUrl: string[]
			} | null
		} | null
	}
	volume?:
		| {
				measured_i: number
				target_i: number
				multi_scene_args: {
					high_dynamic_target_i: '-24'
					normal_target_i: '-14'
					undersized_target_i: '-28'
				}
		  }
		| undefined
}

/**
 * 历史记录获得的视频信息
 */
interface BilibiliHistoryVideo {
	aid: number
	bvid: string
	title: string
	pic: string
	pubdate: number
	owner: {
		name: string
		mid: number
		face: string
	}
	duration: number
}

/**
 * 通过details接口获取的视频完整信息
 */
interface BilibiliVideoDetails {
	aid: number
	bvid: string
	title: string
	pic: string
	pubdate: number
	duration: number
	desc: string
	owner: {
		name: string
		mid: number
		face: string
	}
	cid: number
	pages: BilibiliVideoDetailsPage[]
}

/**
 * bilibili 视频详情接口获取到的 pages 字段
 */
interface BilibiliVideoDetailsPage {
	part: string
	duration: number
	cid: number
}

/**
 * 收藏夹信息
 */
interface BilibiliPlaylist {
	id: number
	title: string
	media_count: number
	fav_state: number // 目标 id 是否存在于收藏夹中：0：不存在；1：存在（当未提供 rid 时始终为 0）
}

/**
 * 搜索结果视频信息
 */
interface BilibiliSearchVideo {
	aid: number
	bvid: string
	title: string
	pic: string
	author: string
	duration: string // MM:SS（MM 可以超过 60min）
	senddate: number
	mid: number
	typeid: number
}

/**
 * 热门搜索信息
 */
interface BilibiliHotSearch {
	keyword: string
	show_name: string
}

/**
 * 用户详细信息
 */
interface BilibiliUserInfo {
	mid: number
	name: string
	face: string
	sign: string
}

/**
 * 收藏夹内容项
 */
interface BilibiliFavoriteListContent {
	id: number
	bvid: string
	upper: {
		mid: number
		name: string
		face: string
	}
	title: string
	cover: string
	duration: number
	pubdate: number
	page: number
	type: number // 2：视频稿件 12：音频 21：视频合集
	attr: number // 失效	0: 正常；9: up自己删除；1: 其他原因删除
}

/**
 * 收藏夹内容列表
 */
interface BilibiliFavoriteListContents {
	info: {
		id: number
		title: string
		cover: string
		media_count: number
		intro: string
		upper: {
			name: string
			face: string
			mid: number
		}
	} | null
	medias: BilibiliFavoriteListContent[] | null
	has_more: boolean
	ttl: number
}

/**
 * 收藏夹所有内容（仅ID）
 */
type BilibiliFavoriteListAllContents = {
	id: number
	bvid: string
	type: number // 2：视频稿件 12：音频 21：视频合集
}[]

/**
 * 追更合集/收藏夹列表中的单项数据
 */
interface BilibiliCollection {
	id: number
	title: string
	cover: string
	upper: {
		mid: number
		name: string
		// face: string 恒为空
	}
	media_count: number
	ctime: number // 创建时间
	intro: string
	attr: number // 在不转换成 8-bit 的情况下，可能会有值：22 关注的别人收藏夹 0 追更视频合集 1 已失效（应通过 state 来区分）
	state: 0 | 1 // 0: 正常；1:收藏夹已失效
}

/**
 * 追更合集/收藏夹内容
 */
interface BilibiliCollectionContent {
	info: {
		id: number
		season_type: number // 未知
		title: string
		cover: string
		media_count: number
		intro: string
		upper: {
			name: string
			mid: number
		}
	}
	medias: {
		id: number // avid
		bvid: string
		title: string
		cover: string
		intro: string
		duration: number
		pubtime: number
		upper: {
			mid: number
			name: string
		}
	}
}

/**
 * 合集详情信息
 */
interface BilibiliCollectionInfo {
	id: number
	season_type: number // wtf
	title: string
	cover: string
	upper: {
		mid: number
		name: string
	}
	cnt_info: {
		collect: number
		play: number
		danmaku: number
	}
	media_count: number
	intro: string
}

/**
 * 合集内单个内容
 */
interface BilibiliMediaItemInCollection {
	id: number
	title: string
	cover: string
	duration: number
	pubtime: number
	bvid: string
	upper: {
		mid: number
		name: string
	}
	cnt_info: {
		collect: number
		play: number
		danmaku: number
	}
}

/**
 * /x/space/fav/season/list
 * 合集内容
 */
interface BilibiliCollectionAllContents {
	info: BilibiliCollectionInfo
	medias: BilibiliMediaItemInCollection[] | null
}

/**
 * 分 p 视频数据
 */
interface BilibiliMultipageVideo {
	cid: number
	page: number
	part: string
	duration: number
	first_frame: string
}

/**
 * 添加/删除一个视频到收藏夹的响应
 */
interface BilibiliDealFavoriteForOneVideoResponse {
	prompt: boolean
	ga_data: unknown
	toast_msg: string
	success_num: number
}

/**
 * 用户上传内容接口返回
 */
interface BilibiliUserUploadedVideosResponse {
	page: {
		pn: number
		ps: number
		count: number
	}
	list: {
		vlist: {
			aid: number
			bvid: string
			title: string
			pic: string
			created: number
			length: string // MM:SS
			author: string // 不一定是所查询的 up 主本人，因为存在合作视频
		}[]
	}
}

enum BilibiliQrCodeLoginStatus {
	QRCODE_LOGIN_STATUS_WAIT = 86101, // 等待扫码
	QRCODE_LOGIN_STATUS_SCANNED_BUT_NOT_CONFIRMED = 86090, // 扫码但未确认
	QRCODE_LOGIN_STATUS_SUCCESS = 0, // 扫码成功
	QRCODE_LOGIN_STATUS_QRCODE_EXPIRED = 86038, // 二维码已过期
}

/**
 * 搜索建议
 */
interface BilibiliSearchSuggestionItem {
	term: string
	value: string
	ref: number
	name: string
	spid: number
	type: string
}

interface BilibiliWebPlayerInfo {
	bgm_info?: {
		music_id: number
		music_title: string
		jump_url: string
	}
}

interface BilibiliToViewVideoList {
	count: number
	list: {
		aid: number
		bvid: string
		count: number // 分 p 数
		pubdate: number
		owner: {
			mid: number
			name: string
			face: string
		}
		cid: number
		title: string
		duration: number
		pic: string
		progress: number
	}[]
}

/**
 * 评论区用户信息
 */
interface BilibiliCommentMember {
	mid: string
	uname: string
	sex: string
	sign: string
	avatar: string
	rank: string
	level_info: {
		current_level: number
	}
}

/**
 * 评论内容
 */
interface BilibiliCommentContent {
	message: string
	plat: number
	device: string
	members: unknown[]
	jump_url: Record<string, unknown>
	max_line: number
	pictures?: {
		img_src: string
		img_width: number
		img_height: number
		img_size: number
	}[]
}

/**
 * 单条评论信息
 */
interface BilibiliCommentItem {
	rpid: number
	oid: number
	type: number
	mid: number
	root: number
	parent: number
	dialog: number
	count: number
	rcount: number
	state: number
	fansgrade: number
	attr: number
	ctime: number
	rpid_str: string
	root_str: string
	parent_str: string
	like: number
	action: number
	member: BilibiliCommentMember
	content: BilibiliCommentContent
	replies: BilibiliCommentItem[] | null
	assist: number
	folder: {
		has_folded: boolean
		is_folded: boolean
		rule: string
	}
	invisible: boolean
}

/**
 * 获取评论区列表返回值
 */
interface BilibiliCommentsResponse {
	cursor: {
		is_begin: boolean
		prev: number
		next: number
		is_end: boolean
		mode: number
		show_header: number
		all_count: number
		support_mode: number[]
		name: string
	}
	replies: BilibiliCommentItem[] | null
	top: {
		upper: BilibiliCommentItem | null
		admin: BilibiliCommentItem | null
	}
}

/**
 * 获取楼中楼（子评论）返回值
 */
interface BilibiliReplyCommentsResponse {
	page: {
		num: number
		size: number
		count: number
	}
	replies: BilibiliCommentItem[] | null
	root: BilibiliCommentItem
}

/**
 * 单条弹幕数据（项目内使用）
 */
interface BilibiliDanmakuItem {
	id: number | Long
	progress: number // 弹幕出现时间（ms）
	mode: number // 弹幕模式：1/2/3：滚动；4：底部；5：顶部
	fontsize?: 18 | 25 | 36 | null // 我们可能不会使用这个值，统一归一化
	color?: number | null // 十进制 RGB888
	content: string // 弹幕内容
	weight?: number | null // 弹幕权重 [0-10]，我们在过滤弹幕时有用，值越大权重越高
}

export type {
	BilibiliAudioStreamParams,
	BilibiliAudioStreamResponse,
	BilibiliCollection,
	BilibiliCollectionAllContents,
	BilibiliCollectionContent,
	BilibiliCollectionInfo,
	BilibiliCommentContent,
	BilibiliCommentItem,
	BilibiliCommentMember,
	BilibiliCommentsResponse,
	BilibiliDealFavoriteForOneVideoResponse,
	BilibiliFavoriteListAllContents,
	BilibiliFavoriteListContent,
	BilibiliFavoriteListContents,
	BilibiliHistoryVideo,
	BilibiliHotSearch,
	BilibiliMediaItemInCollection,
	BilibiliMultipageVideo,
	BilibiliPlaylist,
	BilibiliReplyCommentsResponse,
	BilibiliSearchSuggestionItem,
	BilibiliSearchVideo,
	BilibiliToViewVideoList,
	BilibiliUserInfo,
	BilibiliUserUploadedVideosResponse,
	BilibiliVideoDetails,
	BilibiliWebPlayerInfo,
	BilibiliDanmakuItem,
}

export { BilibiliQrCodeLoginStatus }
