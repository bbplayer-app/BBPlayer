import { element } from './share'

const from = new URLSearchParams(window.location.search).get('from')
const marker = '/link-to/'
const index = from?.indexOf(marker) ?? -1
if (from && index !== -1) {
	const rest = from.slice(index + marker.length)
	if (rest) {
		const retry = element<HTMLAnchorElement>('retry-link')
		retry.href = `bbplayer://${rest}`
		retry.hidden = false
		element('download-link').classList.replace('btn-primary', 'btn-secondary')
		element('fallback-description').textContent =
			'应用未能打开，可能是 BBPlayer 还未安装。点击「重试打开」再试一次，或前往 GitHub 下载安装。'
	}
}
