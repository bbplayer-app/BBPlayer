import {
	type MenuAction,
	type NativeActionEvent,
} from '@expo/ui/community/menu'
import { useCallback, useMemo } from 'react'

import * as Haptics from '@/utils/haptics'
import log from '@/utils/log'

const logger = log.extend('UI.useMenuActions')

export type MenuEntry = Omit<MenuAction, 'id' | 'subactions'> & {
	id?: string
	onPress?: () => void
	subactions?: MenuEntry[]
}

export type MenuBuilder = {
	add: (entry: MenuEntry) => void
}

type MenuActions = {
	actions: MenuAction[]
	onPressAction: (event: NativeActionEvent) => void
	onOpenMenu: () => void
}

type BuiltActions = {
	actions: MenuAction[]
	handlers: Map<string, () => void>
}

function buildActions(entries: MenuEntry[], prefix: string): BuiltActions {
	const actions: MenuAction[] = []
	const handlers = new Map<string, () => void>()

	for (const entry of entries) {
		const { onPress, subactions, id, ...action } = entry
		const actionId = id ?? `${prefix}${entry.title}`

		if (__DEV__ && handlers.has(actionId)) {
			logger.warning(`Duplicate action id: "${actionId}"`)
		}

		if (onPress) {
			handlers.set(actionId, onPress)
		}

		const built: MenuAction = { ...action, id: actionId }

		if (subactions && subactions.length > 0) {
			const builtSubactions = buildActions(subactions, `${actionId}.`)
			built.subactions = builtSubactions.actions

			for (const [key, handler] of builtSubactions.handlers) {
				handlers.set(key, handler)
			}
		}

		actions.push(built)
	}

	return { actions, handlers }
}

export function useMenuActions(build: (menu: MenuBuilder) => void): MenuActions
export function useMenuActions(entries: MenuEntry[]): MenuActions
export function useMenuActions(
	input: MenuEntry[] | ((menu: MenuBuilder) => void),
): MenuActions {
	const { actions, handlers } = useMemo(() => {
		const entries: MenuEntry[] = []

		if (typeof input === 'function') {
			input({ add: (entry) => entries.push(entry) })
		} else {
			entries.push(...input)
		}

		return buildActions(entries, '')
	}, [input])

	const onPressAction = useCallback(
		(event: NativeActionEvent) => {
			handlers.get(event.nativeEvent.event)?.()
		},
		[handlers],
	)

	const onOpenMenu = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
	}, [])

	return { actions, onPressAction, onOpenMenu }
}
