/**
 * 最小的“逐字”单元
 */
export interface LyricSpan {
	/** 这一小段的文字 */
	text: string
	/** 绝对开始时间 (毫秒 ms) */
	startTime: number
	/** 绝对结束时间 (毫秒 ms) */
	endTime: number
	/** 预计算持续时间 (毫秒 ms) */
	duration: number
}

/**
 * 每一行歌词
 */
export interface LyricLine {
	/** 该行歌词的开始时间 (毫秒 ms) */
	startTime: number
	/** 该行歌词的结束时间 (毫秒 ms) */
	endTime: number
	/** 主歌词内容（第一次出现的） */
	content: string
	/** 翻译歌词列表，支持多行翻译 */
	translations: string[]
	/** 是否为动态歌词（包含逐字 spans） */
	isDynamic: boolean
	/** 逐字歌词片段列表 */
	spans: LyricSpan[]
}

/**
 * 最终输出的 SPL 歌词大对象
 */
export interface SplLyricData {
	/** 元数据，如标题、作者等 (Key-Value) */
	meta: Record<string, string>
	/** 排好序的、展开了重复行的扁平化歌词行数组 */
	lines: LyricLine[]
}

/**
 * 内部使用的原始行结构
 */
export interface RawLine {
	lineNumber: number
	timestamps: number[]
	content: string
}

/**
 * SPL 解析错误类
 */
export class SplParseError extends Error {
	constructor(
		public line: number,
		message: string,
	) {
		super(`第 ${line} 行解析错误: ${message}`)
		this.name = 'SplParseError'
	}
}
