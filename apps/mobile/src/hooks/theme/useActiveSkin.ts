import { useMemo } from 'react'

import useSkinStore from '@/hooks/stores/useSkinStore'
import { buildAppSkin } from '@/lib/theme/skins'

export default function useActiveSkin() {
	const activeSkinId = useSkinStore((state) => state.activeSkinId)
	const installedSkins = useSkinStore((state) => state.installedSkins)

	return useMemo(() => {
		if (!activeSkinId) return null

		const installedSkin = installedSkins.find(
			(skin) => skin.id === activeSkinId,
		)
		if (!installedSkin) return null

		return buildAppSkin(installedSkin)
	}, [activeSkinId, installedSkins])
}
