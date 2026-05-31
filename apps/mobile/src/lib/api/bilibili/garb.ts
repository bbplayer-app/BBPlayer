export interface BilibiliGarbSearchItem {
	item_id: number
	name: string
	part_id?: number
	jump_link?: string
	properties?: Record<string, unknown>
	suit_items?: Record<string, unknown>
}

export interface GarbSkinSearchResult {
	itemId: number
	name: string
	coverUri: string | null
	packageUrl: string | null
	packageMd5: string | null
	raw: BilibiliGarbSearchItem
}

interface BilibiliGarbSearchResponse {
	code: number
	message: string
	data?: {
		list?: BilibiliGarbSearchItem[]
	}
}

const SEARCH_ENDPOINT = 'https://api.bilibili.com/x/garb/v2/mall/home/search'

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

const findStringByKey = (value: unknown, keys: Set<string>): string | null => {
	if (typeof value === 'string') return null
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findStringByKey(item, keys)
			if (found) return found
		}
		return null
	}
	if (!isRecord(value)) return null

	for (const [key, item] of Object.entries(value)) {
		if (keys.has(key) && typeof item === 'string' && item.trim()) {
			return item
		}

		const found = findStringByKey(item, keys)
		if (found) return found
	}

	return null
}

const mapSearchItem = (item: BilibiliGarbSearchItem): GarbSkinSearchResult => {
	const coverUri =
		(typeof item.properties?.image_cover === 'string'
			? item.properties.image_cover
			: null) ??
		findStringByKey(item, new Set(['image_cover', 'image_preview', 'preview']))

	return {
		itemId: item.item_id,
		name: item.name,
		coverUri,
		packageUrl: findStringByKey(
			item,
			new Set(['package_url', 'packageUrl', 'package']),
		),
		packageMd5: findStringByKey(item, new Set(['package_md5', 'packageMd5'])),
		raw: item,
	}
}

export async function searchGarbSkins(
	query: string,
	signal?: AbortSignal,
): Promise<GarbSkinSearchResult[]> {
	const params = new URLSearchParams({
		key_word: query,
		ps: '20',
		pn: '1',
	})
	const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
		signal,
		headers: {
			Referer: 'https://www.bilibili.com/',
		},
	})

	if (!response.ok) {
		throw new Error(`搜索失败：${response.status} ${response.statusText}`)
	}

	const payload = (await response.json()) as BilibiliGarbSearchResponse
	if (payload.code !== 0) {
		throw new Error(payload.message || `搜索失败：${payload.code}`)
	}

	return (payload.data?.list ?? []).map(mapSearchItem)
}
