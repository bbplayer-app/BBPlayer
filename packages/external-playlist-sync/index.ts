import Meting from '@roitium/meting'

import { processPlaylist } from './matcher.js'
import type { GenericTrack } from './src/types/common.js'
import type { NeteasePlaylistResponse } from './src/types/netease.js'

async function main() {
	const meting = new Meting('netease')
	const playlistId = '12614770265'

	try {
		console.log(`Fetching playlist ${playlistId}...`)
		const result = await meting.playlist(playlistId)
		const data = JSON.parse(result) as NeteasePlaylistResponse

		// Map to GenericTrack
		const tracks: GenericTrack[] = data.playlist.tracks.map((track) => ({
			title: track.name,
			artists: track.ar.map((a) => a.name),
			album: track.al.name,
			duration: track.dt,
		}))

		console.log(`Found ${tracks.length} tracks. Starting process...`)
		await processPlaylist(tracks)
	} catch (error) {
		console.error('Error fetching playlist:', error)
	}
}

main()
