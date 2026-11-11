import { element, setImage, showError } from './share'

const params = new URLSearchParams(window.location.search)
const id = params.get('id') || ''
const [source, bvid, cid] = id.split('::')

if (source !== 'bilibili') {
	showError('暂不支持此来源的分享链接')
} else if (!bvid) {
	showError('无效的分享链接')
} else {
	const title = params.get('title') || '未知曲目'
	element('track-title').textContent = title
	setImage(
		element<HTMLImageElement>('track-cover'),
		params.get('cover') || undefined,
		title,
		element('cover-placeholder'),
	)
	const bilibiliUrl = new URL(
		`https://www.bilibili.com/video/${encodeURIComponent(bvid)}`,
	)
	const p = params.get('p')
	if (p || cid) bilibiliUrl.searchParams.set('p', p || '1')
	element<HTMLAnchorElement>('bilibili-link').href = bilibiliUrl.href
	const appUrl = cid
		? new URL(
				`https://app.bbplayer.roitium.com/app/link-to/playlist/remote/multipage/${encodeURIComponent(bvid)}`,
			)
		: new URL(
				`https://app.bbplayer.roitium.com/app/link-to/playlist/remote/search-result/global/${encodeURIComponent(bvid)}`,
			)
	if (cid) appUrl.searchParams.set('cid', cid)
	element<HTMLAnchorElement>('app-link').href = appUrl.href
	element('track-card').hidden = false
}
