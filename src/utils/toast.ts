import { toast as sonner } from 'sonner-native'

import * as Haptics from './haptics'

interface Options {
	description?: string
	id?: string | number
	duration?: number
	action?: {
		label: string
		onClick: () => void
	}
}

const show = (message: string, options?: Options) => {
	return sonner(message, {
		description: options?.description,
		duration: options?.duration,
		id: options?.id,
		action: options?.action,
	})
}

const success = (message: string, options?: Options) => {
	void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
	return sonner.success(message, {
		description: options?.description,
		duration: options?.duration,
		id: options?.id,
		action: options?.action,
	})
}

const error = (message: string, options?: Options) => {
	void Haptics.performHaptics(Haptics.AndroidHaptics.Reject)
	return sonner.error(message, {
		description: options?.description,
		duration: options?.duration,
		id: options?.id,
		action: options?.action,
	})
}

const info = (message: string, options?: Options) => {
	return sonner.info(message, {
		description: options?.description,
		duration: options?.duration,
		id: options?.id,
		action: options?.action,
	})
}

const dismiss = (id?: string | number) => {
	if (id !== undefined && id !== null) {
		sonner.dismiss(id)
	} else {
		sonner.dismiss()
	}
}

const toast = {
	show,
	success,
	error,
	info,
	dismiss,
}

export default toast
