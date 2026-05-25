import useAppStore from '@/hooks/stores/useAppStore'
import { getSkin } from '@/lib/theme/skins'

export default function useActiveSkin() {
	return useAppStore((state) => {
		const activeSkinId =
			state.settings.activeSkinId ??
			(state.settings.enableMygoTheme ? 'mygo-sunny-sky' : null)
		return getSkin(activeSkinId)
	})
}
