export interface YrcLine {
	t: number
	c: { tx: string }[]
}

export function formatSplTime(ms: number): string {
	// 将负时间戳统一处理为 0
	if (ms < 0) ms = 0

	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	const milliseconds = Math.floor(ms % 1000)

	const mm = minutes.toString().padStart(2, '0')
	const ss = seconds.toString().padStart(2, '0')
	const SSS = milliseconds.toString().padStart(3, '0')

	return `${mm}:${ss}.${SSS}`
}

export function parseYrc(yrcContent: string): string {
	const lines = yrcContent.split('\n')
	const splLines: string[] = []

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed) continue

		try {
			if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
				const json = JSON.parse(trimmed) as YrcLine
				if (json.c && Array.isArray(json.c)) {
					const text = json.c.map((item) => item.tx).join('')
					const time = formatSplTime(json.t || 0)
					splLines.push(`[${time}]${text}`)
				}
				continue
			}
		} catch {
			// 若非 JSON，则继续正则解析
		}

		// 标准 LRC 行: [mm:ss.xx]、[mm:ss.xxx]，以及网易云偶尔返回的
		// [mm:ss:xx]。SPL 仅接受小数点作为秒与小数部分的分隔符，故将后者规范化。
		// 同时需支持元数据标签，如 [ar:Author]
		const standardLrcLine = /^(?:\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\])+/.test(
			trimmed,
		)
		if (standardLrcLine || /^\[[a-zA-Z]+:/.test(trimmed)) {
			splLines.push(
				trimmed.replace(/\[(\d{1,2}):(\d{1,2}):(\d{1,3})\]/g, '[$1:$2.$3]'),
			)
			continue
		}

		const lineMatch = /^\[(\d+),(\d+)\](.*)/.exec(trimmed)
		if (lineMatch) {
			// 匹配 YRC 行格式: [开始时间,持续时间]内容
			const lineStartTime = parseInt(lineMatch[1], 10)
			const content = lineMatch[3]

			const splLineWords: string[] = []

			const wordRegex = /\((\d+),(\d+),(\d+)\)([^(]*)/g
			let match
			let lastWordEndTime = lineStartTime

			while ((match = wordRegex.exec(content)) !== null) {
				const wordStartTime = parseInt(match[1], 10)
				const wordDuration = parseInt(match[2], 10)
				const wordEndTime = wordStartTime + wordDuration
				const wordText = match[4]

				if (wordStartTime > lastWordEndTime) {
					// 检测到间隔，为当前词插入时间戳
					// 必须先显式结束上一个词，否则上一个词会被拉长填满间隔
					splLineWords.push(`<${formatSplTime(lastWordEndTime)}>`)
					splLineWords.push(`<${formatSplTime(wordStartTime)}>${wordText}`)
				} else if (splLineWords.length === 0) {
					// 首个词，仅添加文本（起始点即为行起始点）
					splLineWords.push(wordText)
				} else {
					// 连续词
					splLineWords.push(`<${formatSplTime(wordStartTime)}>${wordText}`)
				}

				// 记录当前词的末尾作为上一个词的末尾，供后续间隔判断或行尾使用
				lastWordEndTime = wordEndTime
			}

			// 构造最终行数据
			let splLine = `[${formatSplTime(lineStartTime)}]` + splLineWords.join('')

			// 附加最后一个词的结束时间偏移量
			splLine += `<${formatSplTime(lastWordEndTime)}>`

			splLines.push(splLine)
		}
	}

	return splLines.join('\n')
}
