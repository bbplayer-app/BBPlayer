import { checkForAppUpdate } from '@/lib/services/updateService'
import { storage } from '@/utils/mmkv'
import { useEffect, useRef } from 'react'
import { useModalStore } from './stores/useModalStore'

export default function useCheckUpdate() {
	const isMounted = useRef(true)
	const open = useModalStore((state) => state.open)

	useEffect(() => {
		if (__DEV__) {
			return
		}
		const run = async () => {
			const skipped = storage.getString('skip_version') ?? ''
			const result = await checkForAppUpdate()
			if (!isMounted.current) return
			if (result.isErr()) return
			const { update } = result.value
			if (!update) return
			if (skipped && skipped === update.version) return
			if (update.forced) {
				open('UpdateApp', update, { dismissible: false })
			} else {
				open('UpdateApp', update)
			}
		}
		void run()
		return () => {
			isMounted.current = false
		}
	}, [open])
}
