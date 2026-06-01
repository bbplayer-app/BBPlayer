import { useEffect, useState } from 'react'

import useSkinStore from '@/hooks/stores/useSkinStore'
import { loadActiveSkin, invalidateSkinCache } from '@/lib/theme/skins'
import type { AppSkin } from '@/lib/theme/skins'

export default function useActiveSkin(): AppSkin | null {
	const activeSkinId = useSkinStore((state) => state.activeSkinId)
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const activePlayIconIndex = useSkinStore((state) => state.activePlayIconIndex)
	const activeThumbUpIndex = useSkinStore((state) => state.activeThumbUpIndex)
	const activeAvatarFrameIndex = useSkinStore(
		(state) => state.activeAvatarFrameIndex,
	)
	const activeLoadingIndex = useSkinStore((state) => state.activeLoadingIndex)
	const installedSkins = useSkinStore((state) => state.installedSkins)

	const [appSkin, setAppSkin] = useState<AppSkin | null>(null)

	useEffect(() => {
		if (!activeSkinId) {
			setAppSkin(null)
			return
		}

		const meta = installedSkins.find((skin) => skin.id === activeSkinId)
		if (!meta) {
			setAppSkin(null)
			return
		}

		let cancelled = false

		void loadActiveSkin(
			meta,
			activeSkinIndex,
			activePlayIconIndex,
			activeThumbUpIndex,
			activeAvatarFrameIndex,
			activeLoadingIndex,
		).then((skin) => {
			if (!cancelled) setAppSkin(skin)
		})

		return () => {
			cancelled = true
		}
	}, [
		activeAvatarFrameIndex,
		activeLoadingIndex,
		activePlayIconIndex,
		activeSkinId,
		activeSkinIndex,
		activeThumbUpIndex,
		installedSkins,
	])

	return appSkin
}

export { invalidateSkinCache }
