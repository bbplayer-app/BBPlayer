import { toast as sonner } from 'sonner-native'

import * as Haptics from './haptics'

interface Options {
	description?: string | undefined
	id?: string | number | undefined
	duration?: number | undefined
	action?:
		| {
				label: string
				onClick: () => void
		  }
		| undefined
}

const omitUndefined = <T extends object>(obj: T) => {
	return Object.fromEntries(
		Object.entries(obj).filter(([_, value]) => value !== undefined),
	)
}

const show = (message: string, options?: Options) => {
	return sonner(message, omitUndefined(options ?? {}))
}

const success = (message: string, options?: Options) => {
	void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
	return sonner.success(message, omitUndefined(options ?? {}))
}

const error = (message: string, options?: Options) => {
	void Haptics.performHaptics(Haptics.AndroidHaptics.Reject)
	return sonner.error(message, omitUndefined(options ?? {}))
}

const info = (message: string, options?: Options) => {
	return sonner.info(message, omitUndefined(options ?? {}))
}

const dismiss = (id?: string | number) => {
	if (id !== undefined && id !== null) {
		sonner.dismiss(id)
	} else {
		sonner.dismiss()
	}
}

const loading = (message: string, options?: Options) => {
	return sonner.loading(message, omitUndefined(options ?? {}))
}

const toast = {
	show,
	success,
	error,
	info,
	loading,
	dismiss,
}

export default toast
