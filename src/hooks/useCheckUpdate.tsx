import navigationRef from '@/app/navigationRef'
import type { ReleaseInfo } from '@/lib/services/updateService'
import { checkForAppUpdate } from '@/lib/services/updateService'
import { storage } from '@/utils/mmkv'
import { useEffect } from 'react'
import { useModalStore } from './stores/useModalStore'

const tryOpenModal = (target: ReleaseInfo, dismissible: boolean) => {
	// 大概率打开时 navigationRef 还没准备好
	if (navigationRef.isReady()) {
		useModalStore
			.getState()
			.open('UpdateApp', target, { dismissible: dismissible })
		return
	}
	setImmediate(() => {
		tryOpenModal(target, dismissible)
	})
}

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
				tryOpenModal(update, false)
			} else {
				tryOpenModal(update, true)
			}
		}
		void run()
		return () => {
			isMounted = false
		}
	}, [])
}
