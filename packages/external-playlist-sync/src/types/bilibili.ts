/**
 * 搜索结果视频信息
 */
export interface BilibiliSearchVideo {
	aid: number
	bvid: string
	title: string
	pic: string
	author: string
	duration: string // HH:MM or MM:SS
	senddate: number
	mid: number
	typeid: number // video zone tid
}

export interface MatchCandidate {
	video: BilibiliSearchVideo
	score: number
}
