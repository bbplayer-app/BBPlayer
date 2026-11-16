import type lyricService from './lyricService'

/**
 * 按需加载歌词服务。它依赖歌词解析和各家歌词 API，加载较重，
 * 而启动路径上（播放器副作用、启动后任务）只在事件回调里用到，所以第一次用到时再 require。
 */
export function getLyricService(): typeof lyricService {
	// SAFETY: require 的就是 ./lyricService 本身，导出形状与静态 import 一致
	const mod = require('./lyricService') as typeof import('./lyricService')

	return mod.default
}
