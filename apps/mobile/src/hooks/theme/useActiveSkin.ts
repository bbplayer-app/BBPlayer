import { useMemo } from 'react'

import useAppStore from '@/hooks/stores/useAppStore'
import { getSkin, type InstalledSkin } from '@/lib/theme/skins'

const EMPTY_INSTALLED_SKINS: InstalledSkin[] = []

export default function useActiveSkin() {
	const installedSkins = useAppStore(
		(state) => state.settings.installedSkins ?? EMPTY_INSTALLED_SKINS,
	)
	const activeSkinId = useAppStore((state) => state.settings.activeSkinId)

	return useMemo(
		() => getSkin(installedSkins, activeSkinId),
		[activeSkinId, installedSkins],
	)
}
