import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { useCurrentTrack as useOrpheusTrack } from '@roitium/expo-orpheus'
import { useEffect, useState } from 'react'

export function useCurrentTrack() {
	const { track: orpheusTrack } = useOrpheusTrack()

	const [internalTrack, setInternalTrack] = useState<Track | null>(null)

	useEffect(() => {
		let isMounted = true

		const fetchInternalTrack = async () => {
			if (!orpheusTrack) {
				setInternalTrack(null)
				return
			}
			const result = await trackService.getTrackByUniqueKey(orpheusTrack.id)

			if (!isMounted) return

			if (result.isErr()) {
				setInternalTrack(null)
				toastAndLogError(
					'读取当前曲目信息失败',
					result.error,
					'Hooks.useCurrentTrack',
				)
				return
			}

			setInternalTrack(result.value)
		}

		void fetchInternalTrack()

		return () => {
			isMounted = false
		}
	}, [orpheusTrack, orpheusTrack?.id])

	return internalTrack
}

export default useCurrentTrack
