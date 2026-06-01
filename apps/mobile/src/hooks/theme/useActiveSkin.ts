import { useEffect, useState } from 'react'

import useSkinStore from '@/hooks/stores/useSkinStore'
import { loadActiveSkin, invalidateSkinCache } from '@/lib/theme/skins'
import type { AppSkin } from '@/lib/theme/skins'

export default function useActiveSkin(): AppSkin | null {
	const activeSkinId = useSkinStore((state) => state.activeSkinId)
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
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

		void loadActiveSkin(meta, activeSkinIndex).then((skin) => {
			if (!cancelled) setAppSkin(skin)
		})

		return () => {
			cancelled = true
		}
	}, [activeSkinId, activeSkinIndex, installedSkins])

	return appSkin
}

export { invalidateSkinCache }
