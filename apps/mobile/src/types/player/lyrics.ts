export type Tags = Record<string, string>

export interface OldLyricLine {
	/**
	 * 歌词的起始时间，单位：秒
	 */
	timestamp: number
	/**
	 * 原始歌词内容
	 */
	text: string
	/**
	 * 翻译歌词
	 */
	translation?: string
}

export interface ParsedLrc {
	tags: Tags
	lyrics: OldLyricLine[] | null
	rawOriginalLyrics: string // 原始歌词
	rawTranslatedLyrics?: string // 原始翻译歌词
	offset?: number // 单位秒
}

export type LyricSearchResult = (
	| {
			source: 'netease'
			duration: number // 秒
			title: string
			artist: string
			remoteId: number
	  }
	| {
			source: 'qqmusic'
			duration: number // 秒
			title: string
			artist: string
			remoteId: string
	  }
	| {
			source: 'kugou'
			duration: number // 秒
			title: string
			artist: string
			remoteId: string
	  }
)[]

export interface LyricFileData {
	id: string // 歌曲唯一ID
	updateTime: number // 缓存时间

	// 所有歌词都是 SPL 格式
	lrc?: string | undefined // 主歌词
	tlyric?: string | undefined // 翻译歌词
	romalrc?: string | undefined // 罗马音歌词

	/** 当歌词获取失败时（如离线状态），存储错误信息直接展示，不走解析流程 */
	errorMessage?: string | undefined

	/**
	 * 用户手动跳过了该歌曲的歌词获取。
	 * 为 true 时，smartFetchLyrics 不会尝试重新获取网络歌词。
	 * 当用户手动搜索或编辑歌词时，此字段应被重置为 false。
	 */
	manualSkip?: boolean | undefined

	misc?:
		| {
				userOffset?: number | undefined // 用户设置的歌词偏移量
		  }
		| undefined
}

// 歌词提供者最终应该返回的数据结构
export type LyricProviderResponseData = Omit<
	LyricFileData,
	'id' | 'updateTime' | 'misc'
>
