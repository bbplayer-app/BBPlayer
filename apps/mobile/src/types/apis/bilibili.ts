import { scope, type } from 'arktype'

/**
 * 获取音频流入参（dash）
 */
const BilibiliAudioStreamParams = type({
	bvid: 'string',
	cid: 'number',
	audioQuality: 'number',
	enableDolby: 'boolean',
	enableHiRes: 'boolean',
})

/**
 * 获取音频流（dash）返回值
 */
const BilibiliAudioStreamResponse = type({
	'durl?': [
		{
			order: 'number', // 恒为 1
			url: 'string',
			backup_url: 'string[]',
		},
		'[]',
	],
	'dash?': {
		'audio?': type({
			id: 'number',
			baseUrl: 'string',
			backupUrl: 'string[]',
		})
			.array()
			.or('null'),
		'dolby?': type({
			type: 'number',
			'audio?': type({
				id: 'number',
				baseUrl: 'string',
				backupUrl: 'string[]',
			})
				.array()
				.or('null'),
		}).or('null'),
		'flac?': type({
			display: 'boolean',
			'audio?': type({
				id: 'number',
				baseUrl: 'string',
				backupUrl: 'string[]',
			}).or('null'),
		}).or('null'),
	},
	'volume?': type({
		measured_i: 'number',
		target_i: 'number',
		multi_scene_args: {
			high_dynamic_target_i: "'-24'",
			normal_target_i: "'-14'",
			undersized_target_i: "'-28'",
		},
	}).or('undefined'),
})

/**
 * 历史记录获得的视频信息
 */
const BilibiliHistoryVideo = type({
	aid: 'number',
	bvid: 'string',
	title: 'string',
	pic: 'string',
	pubdate: 'number',
	owner: {
		name: 'string',
		mid: 'number',
		face: 'string',
	},
	duration: 'number',
})

/**
 * bilibili 视频详情接口获取到的 pages 字段
 */
const BilibiliVideoDetailsPage = type({
	part: 'string',
	duration: 'number',
	cid: 'number',
})

/**
 * 通过details接口获取的视频完整信息
 */
const BilibiliVideoDetails = type({
	aid: 'number',
	bvid: 'string',
	title: 'string',
	pic: 'string',
	pubdate: 'number',
	duration: 'number',
	desc: 'string',
	owner: {
		name: 'string',
		mid: 'number',
		face: 'string',
	},
	cid: 'number',
	pages: BilibiliVideoDetailsPage.array(),
})

/**
 * 收藏夹信息
 */
const BilibiliPlaylist = type({
	id: 'number',
	title: 'string',
	media_count: 'number',
	fav_state: 'number', // 目标 id 是否存在于收藏夹中：0：不存在；1：存在（当未提供 rid 时始终为 0）
})

/**
 * 搜索结果视频信息
 */
const BilibiliSearchVideo = type({
	aid: 'number',
	bvid: 'string',
	title: 'string',
	pic: 'string',
	author: 'string',
	duration: 'string', // MM:SS（MM 可以超过 60min）
	senddate: 'number',
	mid: 'number',
	typeid: 'number',
})

/**
 * 热门搜索信息
 */
const BilibiliHotSearch = type({
	keyword: 'string',
	show_name: 'string',
})

/**
 * 用户详细信息
 */
const BilibiliUserInfo = type({
	mid: 'number',
	name: 'string',
	face: 'string',
	sign: 'string',
})

/**
 * 收藏夹内容项
 */
const BilibiliFavoriteListContent = type({
	id: 'number',
	bvid: 'string',
	upper: {
		mid: 'number',
		name: 'string',
		face: 'string',
	},
	title: 'string',
	cover: 'string',
	duration: 'number',
	pubdate: 'number',
	page: 'number',
	type: 'number', // 2：视频稿件 12：音频 21：视频合集
	attr: 'number', // 失效	0: 正常；9: up自己删除；1: 其他原因删除
})

/**
 * 收藏夹内容列表
 */
const BilibiliFavoriteListContents = type({
	'info?': type({
		id: 'number',
		title: 'string',
		cover: 'string',
		media_count: 'number',
		intro: 'string',
		upper: {
			name: 'string',
			face: 'string',
			mid: 'number',
		},
	}).or('null'),
	'medias?': BilibiliFavoriteListContent.array().or('null'),
	has_more: 'boolean',
	ttl: 'number',
})

/**
 * 收藏夹所有内容（仅ID）
 */
const BilibiliFavoriteListAllContents = type({
	id: 'number',
	bvid: 'string',
	type: 'number', // 2：视频稿件 12：音频 21：视频合集
}).array()

/**
 * 追更合集/收藏夹列表中的单项数据
 */
const BilibiliCollection = type({
	id: 'number',
	title: 'string',
	cover: 'string',
	upper: {
		mid: 'number',
		name: 'string',
		// face: string 恒为空
	},
	media_count: 'number',
	ctime: 'number', // 创建时间
	intro: 'string',
	attr: 'number', // 在不转换成 8-bit 的情况下，可能会有值：22 关注的别人收藏夹 0 追更视频合集 1 已失效（应通过 state 来区分）
	state: '0 | 1', // 0: 正常；1:收藏夹已失效
})

/**
 * 追更合集/收藏夹内容
 */
const BilibiliCollectionContent = type({
	info: {
		id: 'number',
		season_type: 'number', // 未知
		title: 'string',
		cover: 'string',
		media_count: 'number',
		intro: 'string',
		upper: {
			name: 'string',
			mid: 'number',
		},
	},
	medias: {
		id: 'number', // avid
		bvid: 'string',
		title: 'string',
		cover: 'string',
		intro: 'string',
		duration: 'number',
		pubtime: 'number',
		upper: {
			mid: 'number',
			name: 'string',
		},
	},
})

/**
 * 合集详情信息
 */
const BilibiliCollectionInfo = type({
	id: 'number',
	season_type: 'number', // wtf
	title: 'string',
	cover: 'string',
	upper: {
		mid: 'number',
		name: 'string',
	},
	cnt_info: {
		collect: 'number',
		play: 'number',
		danmaku: 'number',
	},
	media_count: 'number',
	intro: 'string',
})

/**
 * 合集内单个内容
 */
const BilibiliMediaItemInCollection = type({
	id: 'number',
	title: 'string',
	cover: 'string',
	duration: 'number',
	pubtime: 'number',
	bvid: 'string',
	upper: {
		mid: 'number',
		name: 'string',
	},
	cnt_info: {
		collect: 'number',
		play: 'number',
		danmaku: 'number',
	},
})

/**
 * /x/space/fav/season/list
 * 合集内容
 */
const BilibiliCollectionAllContents = type({
	info: BilibiliCollectionInfo,
	'medias?': BilibiliMediaItemInCollection.array().or('null'),
})

/**
 * 分 p 视频数据
 */
const BilibiliMultipageVideo = type({
	cid: 'number',
	page: 'number',
	part: 'string',
	duration: 'number',
	first_frame: 'string',
})

/**
 * 添加/删除一个视频到收藏夹的响应
 */
const BilibiliDealFavoriteForOneVideoResponse = type({
	prompt: 'boolean',
	ga_data: 'unknown',
	toast_msg: 'string',
	success_num: 'number',
})

/**
 * 用户上传内容接口返回
 */
const BilibiliUserUploadedVideosResponse = type({
	page: {
		pn: 'number',
		ps: 'number',
		count: 'number',
	},
	list: {
		vlist: type({
			aid: 'number',
			bvid: 'string',
			title: 'string',
			pic: 'string',
			created: 'number',
			length: 'string', // MM:SS
			author: 'string', // 不一定是所查询的 up 主本人，因为存在合作视频
		}).array(),
	},
})

enum BilibiliQrCodeLoginStatus {
	QRCODE_LOGIN_STATUS_WAIT = 86101, // 等待扫码
	QRCODE_LOGIN_STATUS_SCANNED_BUT_NOT_CONFIRMED = 86090, // 扫码但未确认
	QRCODE_LOGIN_STATUS_SUCCESS = 0, // 扫码成功
	QRCODE_LOGIN_STATUS_QRCODE_EXPIRED = 86038, // 二维码已过期
}

/**
 * 搜索建议
 */
const BilibiliSearchSuggestionItem = type({
	term: 'string',
	value: 'string',
	ref: 'number',
	name: 'string',
	spid: 'number',
	type: 'string',
})

const BilibiliWebPlayerInfo = type({
	'bgm_info?': {
		music_id: 'number',
		music_title: 'string',
		jump_url: 'string',
	},
})

const BilibiliToViewVideo = type({
	aid: 'number',
	bvid: 'string',
	count: 'number', // 分 p 数
	pubdate: 'number',
	owner: {
		mid: 'number',
		name: 'string',
		face: 'string',
	},
	cid: 'number',
	title: 'string',
	duration: 'number',
	pic: 'string',
	progress: 'number',
})

const BilibiliToViewVideoList = type({
	count: 'number',
	list: BilibiliToViewVideo.array(),
})

/**
 * 评论区用户信息
 */
const BilibiliCommentMember = type({
	mid: 'string',
	uname: 'string',
	sex: 'string',
	sign: 'string',
	avatar: 'string',
	rank: 'string',
	level_info: {
		current_level: 'number',
	},
})

/**
 * 评论内容
 */
const BilibiliCommentContent = type({
	message: 'string',
	plat: 'number',
	device: 'string',
	members: 'unknown[]',
	jump_url: 'unknown', // Record<string, unknown> is hard in arktype, treating as unknown for now or strict object
	max_line: 'number',
	'pictures?': type({
		img_src: 'string',
		img_width: 'number',
		img_height: 'number',
		img_size: 'number',
	}).array(),
})

/**
 * 单条评论信息
 * 使用 scope 来处理递归类型
 */
const types = scope({
	commentItem: {
		rpid: 'number',
		oid: 'number',
		type: 'number',
		mid: 'number',
		root: 'number',
		parent: 'number',
		dialog: 'number',
		count: 'number',
		rcount: 'number',
		state: 'number',
		fansgrade: 'number',
		attr: 'number',
		ctime: 'number',
		rpid_str: 'string',
		root_str: 'string',
		parent_str: 'string',
		like: 'number',
		action: 'number',
		member: BilibiliCommentMember,
		content: BilibiliCommentContent,
		'replies?': 'commentItem[] | null', // Recursive reference via scope string
		assist: 'number',
		folder: {
			has_folded: 'boolean',
			is_folded: 'boolean',
			rule: 'string',
		},
		invisible: 'boolean',
	},
}).export()

const BilibiliCommentItem = types.commentItem

/**
 * 获取评论区列表返回值
 */
const BilibiliCommentsResponse = type({
	cursor: {
		is_begin: 'boolean',
		prev: 'number',
		next: 'number',
		is_end: 'boolean',
		mode: 'number',
		show_header: 'number',
		all_count: 'number',
		support_mode: 'number[]',
		name: 'string',
	},
	'replies?': BilibiliCommentItem.array().or('null'),
	top: {
		'upper?': BilibiliCommentItem.or('null'),
		'admin?': BilibiliCommentItem.or('null'),
	},
})

/**
 * 获取楼中楼（子评论）返回值
 */
const BilibiliReplyCommentsResponse = type({
	page: {
		num: 'number',
		size: 'number',
		count: 'number',
	},
	'replies?': BilibiliCommentItem.array().or('null'),
	root: BilibiliCommentItem,
})

/**
 * 单条弹幕数据（项目内使用）
 */
const BilibiliDanmakuItem = type({
	id: 'string',
	progress: 'number', // 弹幕出现时间（ms）
	mode: 'number', // 弹幕模式：1/2/3：滚动；4：底部；5：顶部
	fontsize: 'number', // 我们可能不会使用这个值，统一归一化
	color: 'number', // 十进制 RGB888
	content: 'string', // 弹幕内容
	weight: '0<=number.integer<=10', // 弹幕权重 [0-10]，我们在过滤弹幕时有用，值越大权重越高
})

// Export Types inferred from Validators
type BilibiliAudioStreamParams = typeof BilibiliAudioStreamParams.infer
type BilibiliAudioStreamResponse = typeof BilibiliAudioStreamResponse.infer
type BilibiliHistoryVideo = typeof BilibiliHistoryVideo.infer
type BilibiliVideoDetailsPage = typeof BilibiliVideoDetailsPage.infer
type BilibiliVideoDetails = typeof BilibiliVideoDetails.infer
type BilibiliPlaylist = typeof BilibiliPlaylist.infer
type BilibiliSearchVideo = typeof BilibiliSearchVideo.infer
type BilibiliHotSearch = typeof BilibiliHotSearch.infer
type BilibiliUserInfo = typeof BilibiliUserInfo.infer
type BilibiliFavoriteListContent = typeof BilibiliFavoriteListContent.infer
type BilibiliFavoriteListContents = typeof BilibiliFavoriteListContents.infer
type BilibiliFavoriteListAllContents =
	typeof BilibiliFavoriteListAllContents.infer
type BilibiliCollection = typeof BilibiliCollection.infer
type BilibiliCollectionContent = typeof BilibiliCollectionContent.infer
type BilibiliCollectionInfo = typeof BilibiliCollectionInfo.infer
type BilibiliMediaItemInCollection = typeof BilibiliMediaItemInCollection.infer
type BilibiliCollectionAllContents = typeof BilibiliCollectionAllContents.infer
type BilibiliMultipageVideo = typeof BilibiliMultipageVideo.infer
type BilibiliDealFavoriteForOneVideoResponse =
	typeof BilibiliDealFavoriteForOneVideoResponse.infer
type BilibiliUserUploadedVideosResponse =
	typeof BilibiliUserUploadedVideosResponse.infer
type BilibiliSearchSuggestionItem = typeof BilibiliSearchSuggestionItem.infer
type BilibiliWebPlayerInfo = typeof BilibiliWebPlayerInfo.infer
type BilibiliToViewVideo = typeof BilibiliToViewVideo.infer
type BilibiliToViewVideoList = typeof BilibiliToViewVideoList.infer
type BilibiliCommentMember = typeof BilibiliCommentMember.infer
type BilibiliCommentContent = typeof BilibiliCommentContent.infer
type BilibiliCommentItem = typeof BilibiliCommentItem.infer
type BilibiliCommentsResponse = typeof BilibiliCommentsResponse.infer
type BilibiliReplyCommentsResponse = typeof BilibiliReplyCommentsResponse.infer
type BilibiliDanmakuItem = typeof BilibiliDanmakuItem.infer

export {
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
	BilibiliDanmakuItem,
	BilibiliDealFavoriteForOneVideoResponse,
	BilibiliFavoriteListAllContents,
	BilibiliFavoriteListContent,
	BilibiliFavoriteListContents,
	BilibiliHistoryVideo,
	BilibiliHotSearch,
	BilibiliMediaItemInCollection,
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
	BilibiliVideoDetailsPage,
	BilibiliWebPlayerInfo,
}
