export type Tags = Record<string, string>

export interface LyricLine {
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
	lyrics: LyricLine[] | null
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
	lrc?: string // 主歌词
	tlyric?: string // 翻译歌词
	romalrc?: string // 罗马音歌词

	misc?: {
		userOffset?: number // 用户设置的歌词偏移量
	}
}

// 歌词提供者最终应该返回的数据结构
export type LyricProviderResponseData = Omit<
	LyricFileData,
	'id' | 'updateTime' | 'misc'
>
