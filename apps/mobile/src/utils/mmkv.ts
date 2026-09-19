import { ObservablePersistLocalStorageBase } from '@legendapp/state/persist-plugins/local-storage'
import type { StateStorage } from 'zustand/middleware/persist'

import { mmkv, storage } from './mmkv-instance'

export { storage } from './mmkv-instance'

export const zustandStorage: StateStorage = {
	setItem: (name, value) => {
		// @ts-expect-error -- 管不了 zustand 的类型定义
		return storage.set(name, value)
	},
	getItem: (name) => {
		// @ts-expect-error -- 管不了 zustand 的类型定义
		const value = storage.getString(name)
		return value ?? null
	},
	removeItem: (name) => {
		// @ts-expect-error -- 管不了 zustand 的类型定义
		return storage.remove(name)
	},
}

// Adapt our existing MMKV instance to Legend's synchronous storage plugin.
export const legendPersistStorage = new ObservablePersistLocalStorageBase({
	getItem: (key) => mmkv.getString(key) ?? null,
	setItem: (key, value) => mmkv.set(key, value),
	removeItem: (key) => mmkv.remove(key),
	get length() {
		return mmkv.getAllKeys().length
	},
	key: (index) => mmkv.getAllKeys()[index] ?? null,
	clear: () => mmkv.clearAll(),
})
