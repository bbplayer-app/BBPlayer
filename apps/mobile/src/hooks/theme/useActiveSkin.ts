import useAppStore from '@/hooks/stores/useAppStore'
import { getSkin } from '@/lib/theme/skins'

export default function useActiveSkin() {
	return useAppStore((state) => {
		return getSkin(
			state.settings.installedSkins ?? [],
			state.settings.activeSkinId,
		)
	})
}
