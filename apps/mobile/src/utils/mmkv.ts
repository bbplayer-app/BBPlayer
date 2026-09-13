import { ObservablePersistLocalStorageBase } from '@legendapp/state/persist-plugins/local-storage'
import { createMMKV } from 'react-native-mmkv'
import type { StateStorage } from 'zustand/middleware/persist'

import type { TypedMMKVInterface } from '@/types/storage'

const mmkv = createMMKV()

export const storage = mmkv as unknown as TypedMMKVInterface

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
