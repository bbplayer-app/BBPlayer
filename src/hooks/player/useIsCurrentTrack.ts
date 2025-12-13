import { toastAndLogError } from '@/utils/error-handling'
import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect, useRef, useState } from 'react'

export function useIsCurrentTrack(trackUniqueKey: string) {
	const [isCurrent, setIsCurrent] = useState(false)
	const lastRequestIdRef = useRef(0)

	useEffect(() => {
		let isMounted = true

		const checkCurrentStatus = async () => {
			const currentRequestId = ++lastRequestIdRef.current

			try {
				const currentTrack = await Orpheus.getCurrentTrack()
				if (!isMounted || currentRequestId !== lastRequestIdRef.current) {
					return
				}

				const isMatch = currentTrack?.id === trackUniqueKey
				setIsCurrent(isMatch)
			} catch (e) {
				if (isMounted && currentRequestId === lastRequestIdRef.current) {
					toastAndLogError('读取当前曲目信息失败', e, 'Hooks.useIsCurrentTrack')
					setIsCurrent(false)
				}
			}
		}

		void checkCurrentStatus()

		const sub = Orpheus.addListener('onTrackStarted', () => {
			void checkCurrentStatus()
		})

		return () => {
			isMounted = false
			sub.remove()
		}
	}, [trackUniqueKey])

	return isCurrent
}

export default useIsCurrentTrack
