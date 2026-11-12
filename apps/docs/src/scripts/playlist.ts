import { element, setImage, showError } from './share'

interface PreviewData {
	playlist: {
		title: string
		description?: string | null
		cover_url?: string | null
		track_count: number
	}
	owner: { name: string; avatar_url?: string | null } | null
	tracks: { title: string; artist_name?: string; cover_url?: string }[]
	preview_limit: number
}

async function loadPlaylist() {
	const params = new URLSearchParams(window.location.search)
	const shareId = params.get('shareId')
	const inviteCode = params.get('inviteCode')

	try {
		if (!shareId) {
			showError('无效的分享链接')

			return
		}

		const response = await fetch(
			`https://be.bbplayer.roitium.com/playlists/${encodeURIComponent(shareId)}/preview`,
		)

		if (!response.ok) {
			showError(
				response.status === 404
					? '歌单不存在或已删除'
					: `加载失败（${response.status}）`,
			)

			return
		}

		const data: PreviewData = await response.json()
		const { playlist, owner, tracks } = data
		const title = playlist.title || '未命名歌单'
		element('playlist-title').textContent = title
		setImage(
			element<HTMLImageElement>('playlist-cover'),
			playlist.cover_url || undefined,
			title,
			element('cover-placeholder'),
		)

		if (playlist.description) {
			element('playlist-description').textContent = playlist.description
			element('playlist-description').hidden = false
		}

		if (owner) {
			element('owner-name').textContent = owner.name
			setImage(
				element<HTMLImageElement>('owner-avatar'),
				owner.avatar_url || undefined,
				owner.name,
				element('owner-placeholder'),
			)
			element('owner').hidden = false
		}

		element('track-count').textContent = `${playlist.track_count} 首曲目`
		element('banner-text').textContent =
			`${owner?.name ? `${owner.name} ` : ''}${inviteCode ? '邀请你共同编辑歌单' : '分享了一个歌单给你'}`

		if (inviteCode) {
			element('playlist-banner').classList.replace(
				'banner-share',
				'banner-invite',
			)
			element('share-icon').hidden = true
			element('invite-icon').hidden = false
			element('app-link-label').textContent = '接受邀请，在 BBPlayer 中打开'
		}

		const appParams = new URLSearchParams({ shareId })

		if (inviteCode) appParams.set('inviteCode', inviteCode)
		element<HTMLAnchorElement>('app-link').href =
			`https://app.bbplayer.roitium.com/app/link-to/share/playlist?${appParams}`
		const list = element('track-list')
		const template = element<HTMLTemplateElement>('track-template')
		tracks.forEach((track, index) => {
			const fragment = template.content.cloneNode(true) as DocumentFragment
			fragment.querySelector('.track-index')!.textContent = String(index + 1)
			fragment.querySelector('.track-title')!.textContent = track.title

			if (track.artist_name) {
				const artist = fragment.querySelector<HTMLElement>('.track-artist')!
				artist.textContent = track.artist_name
				artist.hidden = false
			}

			setImage(
				fragment.querySelector<HTMLImageElement>('.track-cover')!,
				track.cover_url,
				track.title,
				fragment.querySelector<HTMLElement>('.track-cover-placeholder')!,
			)
			list.append(fragment)
		})
		list.hidden = tracks.length === 0

		if (tracks.length < playlist.track_count) {
			element('more-hint').textContent =
				`仅预览前 ${data.preview_limit} 首 · 订阅后自动同步全部曲目`
			element('more-hint').hidden = false
		}

		element('playlist-card').hidden = false
	} catch {
		showError('网络错误，请稍后重试')
	} finally {
		element('loading').hidden = true
	}
}

void loadPlaylist()
