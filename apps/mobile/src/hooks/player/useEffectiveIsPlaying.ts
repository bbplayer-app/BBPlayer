import { useIsPlaying } from '@bbplayer/orpheus'

import { useDlnaCastStore } from '@/hooks/stores/useDlnaCastStore'

export default function useEffectiveIsPlaying() {
	const local = useIsPlaying()
	const casting = useDlnaCastStore((s) => !!s.castingDevice)
	const dlnaPlaying = useDlnaCastStore((s) => s.playing)
	return casting ? dlnaPlaying : local
}
