export interface YrcLine {
	t: number
	c: { tx: string }[]
}

export function formatSplTime(ms: number): string {
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
			// Not JSON, continue to regex parsing
		}

		const lineMatch = /^\[(\d+),(\d+)\](.*)/.exec(trimmed)
		if (lineMatch) {
			const lineStartTime = parseInt(lineMatch[1], 10)
			const lineDuration = parseInt(lineMatch[2], 10)
			const lineEndTime = lineStartTime + lineDuration
			const content = lineMatch[3]

			let splLine = `[${formatSplTime(lineStartTime)}]`

			const wordRegex = /\((\d+),(\d+),(\d+)\)([^(]*)/g
			let match
			let firstWord = true

			while ((match = wordRegex.exec(content)) !== null) {
				const wordStartTime = parseInt(match[1], 10)
				const wordText = match[4]

				if (firstWord) {
					if (wordStartTime > lineStartTime) {
						splLine += `<${formatSplTime(wordStartTime)}>${wordText}`
					} else {
						splLine += wordText
					}
					firstWord = false
				} else {
					splLine += `[${formatSplTime(wordStartTime)}]${wordText}`
				}
			}

			splLine += `[${formatSplTime(lineEndTime)}]`
			splLines.push(splLine)
		}
	}

	return splLines.join('\n')
}
