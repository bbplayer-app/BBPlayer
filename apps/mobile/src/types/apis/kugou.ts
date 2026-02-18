import { type } from 'arktype'

const KugouSearchSongInfo = type({
	hash: 'string',
	filename: 'string',
	album_name: 'string',
	duration: 'number', // assume seconds
	singername: 'string',
	songname: 'string',
})

const KugouSearchResponse = type({
	status: 'number',
	data: {
		info: KugouSearchSongInfo.array(),
		total: 'number',
	},
})

const KugouLyricCandidate = type({
	id: 'string',
	accesskey: 'string',
	fmt: 'string',
	duration: 'number',
	singer: 'string',
	song: 'string',
})

const KugouLyricSearchResponse = type({
	status: 'number',
	candidates: KugouLyricCandidate.array(),
})

const KugouLyricDownloadResponse = type({
	status: 'number',
	content: 'string', // Base64 encoded lrc
	fmt: 'string',
})

type KugouSearchSongInfo = typeof KugouSearchSongInfo.infer
type KugouSearchResponse = typeof KugouSearchResponse.infer
type KugouLyricCandidate = typeof KugouLyricCandidate.infer
type KugouLyricSearchResponse = typeof KugouLyricSearchResponse.infer
type KugouLyricDownloadResponse = typeof KugouLyricDownloadResponse.infer

export {
	KugouLyricCandidate,
	KugouLyricDownloadResponse,
	KugouLyricSearchResponse,
	KugouSearchResponse,
	KugouSearchSongInfo,
}
