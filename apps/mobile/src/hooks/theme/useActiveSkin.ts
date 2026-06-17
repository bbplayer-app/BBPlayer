import { useEffect, useState } from 'react'

import useSkinStore from '@/hooks/stores/useSkinStore'
import { loadActiveSkin, invalidateSkinCache } from '@/services/theme/runtime'
import type { AppSkin } from '@/services/theme/types'

export default function useActiveSkin(): AppSkin | null {
	const activeSkinId = useSkinStore((state) => state.activeSkinId)
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

		void loadActiveSkin(meta).then((skin) => {
			if (!cancelled) setAppSkin(skin)
		})

		return () => {
			cancelled = true
		}
	}, [activeSkinId, installedSkins])

	return appSkin
}

export { invalidateSkinCache }
