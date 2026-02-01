export const parseExternalPlaylistInfo = (
	text: string,
): { id: string; source: 'netease' | 'qq' } | null => {
	// Netease Music
	if (text.includes('music.163.com')) {
		const result = /id=(\d+)/.exec(text)
		if (result?.[1]) {
			return { id: result[1], source: 'netease' }
		}
	}

	// QQ Music
	if (text.includes('.qq.com')) {
		const result = /id=(\d+)/.exec(text)
		if (result?.[1]) {
			return { id: result[1], source: 'qq' }
		}
	}

	return null
}
