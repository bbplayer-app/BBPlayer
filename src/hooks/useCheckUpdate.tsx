import { checkForAppUpdate } from '@/lib/services/updateService'
import { storage } from '@/utils/mmkv'
import { useEffect } from 'react'
import { useModalStore } from './stores/useModalStore'

export default function useCheckUpdate() {
	useEffect(() => {
		if (__DEV__) {
			return
		}
		let isMounted = true
		const run = async () => {
			const skipped = storage.getString('skip_version') ?? ''
			const result = await checkForAppUpdate()
			if (!isMounted) return
			if (result.isErr()) return
			const { update } = result.value
			if (!update) return
			if (skipped && skipped === update.version) return
			if (update.forced) {
				useModalStore.getState().open('UpdateApp', update, { dismissible: false })
			} else {
				useModalStore.getState().open('UpdateApp', update, { dismissible: true })
			}
		}
		void run()
		return () => {
			isMounted = false
		}
	}, [])
}
