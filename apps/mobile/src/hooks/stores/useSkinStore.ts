import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { InstalledSkin, InstalledSkinMeta } from '@/services/theme/types'
import { installedSkinToMeta } from '@/services/theme/types'
import { zustandStorage } from '@/utils/mmkv'

export type SkinBootSplashMode = 'poster' | 'video'

export interface SkinSettingsUpdate {
	activeAvatarFrameIndex?: number
	activeLoadingIndex?: number
	activePlayIconIndex?: number
	activeSkinId?: string | null
	activeSkinIndex?: number
	activeThumbUpIndex?: number
	playFullSkinBootSplashAnimation?: boolean
	selectedSkinBootSplashAssetId?: string | null
	selectedSkinBootSplashMode?: SkinBootSplashMode
	skinSliderThumbOffsetX?: number
	skinSliderThumbOffsetY?: number
	skinSliderThumbSize?: number
}

interface SkinStoreState {
	activeAvatarFrameIndex: number
	activeLoadingIndex: number
	activePlayIconIndex: number
	activeSkinId: string | null
	activeSkinIndex: number
	activeThumbUpIndex: number
	addInstalledSkin: (skin: InstalledSkin) => void
	installedSkins: InstalledSkinMeta[]
	playFullSkinBootSplashAnimation: boolean
	removeInstalledSkin: (id: string) => void
	selectedSkinBootSplashAssetId: string | null
	selectedSkinBootSplashMode: SkinBootSplashMode
	setSkinSettings: (updates: SkinSettingsUpdate) => void
	skinSliderThumbOffsetX: number
	skinSliderThumbOffsetY: number
	skinSliderThumbSize: number
}

const DEFAULT_SLIDER_THUMB_SIZE = 20

const useSkinStore = create<SkinStoreState>()(
	persist(
		(set) => ({
			activeAvatarFrameIndex: 0,
			activeLoadingIndex: 0,
			activePlayIconIndex: 0,
			activeSkinId: null,
			activeSkinIndex: 0,
			activeThumbUpIndex: 0,
			installedSkins: [],
			playFullSkinBootSplashAnimation: false,
			selectedSkinBootSplashAssetId: null,
			selectedSkinBootSplashMode: 'poster',
			skinSliderThumbOffsetX: 0,
			skinSliderThumbOffsetY: 0,
			skinSliderThumbSize: DEFAULT_SLIDER_THUMB_SIZE,

			addInstalledSkin: (skin) => {
				const meta = installedSkinToMeta(skin)
				set((state) => ({
					installedSkins: [
						meta,
						...state.installedSkins.filter(
							(installedSkin) => installedSkin.id !== skin.id,
						),
					],
				}))
			},

			removeInstalledSkin: (id) => {
				set((state) => ({
					activeSkinId: state.activeSkinId === id ? null : state.activeSkinId,
					installedSkins: state.installedSkins.filter((skin) => skin.id !== id),
					selectedSkinBootSplashAssetId:
						state.activeSkinId === id
							? null
							: state.selectedSkinBootSplashAssetId,
				}))
			},

			setSkinSettings: (updates) => {
				set((state) => ({
					...state,
					...updates,
				}))
			},
		}),
		{
			name: 'skin-storage',
			storage: createJSONStorage(() => zustandStorage),
			version: 3,

			migrate: (persistedState, version) => {
				if (version < 3) {
					// 这个版本主要是把 coverUri 字段迁移到 coverPath 字段，因为 coverUri 字段本身存的就是相对路径，重命名后避免混淆
					const state = persistedState as Record<string, unknown>
					if (Array.isArray(state.installedSkins)) {
						state.installedSkins = state.installedSkins.map(
							(skin: Record<string, unknown>) => {
								if ('coverUri' in skin && !('coverPath' in skin)) {
									const { coverUri, ...rest } = skin
									return { ...rest, coverPath: coverUri }
								}
								return skin
							},
						)
					}
				}
				return persistedState as SkinStoreState
			},

			partialize: (state) => ({
				activeAvatarFrameIndex: state.activeAvatarFrameIndex,
				activeLoadingIndex: state.activeLoadingIndex,
				activePlayIconIndex: state.activePlayIconIndex,
				activeSkinId: state.activeSkinId,
				activeSkinIndex: state.activeSkinIndex,
				activeThumbUpIndex: state.activeThumbUpIndex,
				installedSkins: state.installedSkins,
				playFullSkinBootSplashAnimation: state.playFullSkinBootSplashAnimation,
				selectedSkinBootSplashAssetId: state.selectedSkinBootSplashAssetId,
				selectedSkinBootSplashMode: state.selectedSkinBootSplashMode,
				skinSliderThumbOffsetX: state.skinSliderThumbOffsetX,
				skinSliderThumbOffsetY: state.skinSliderThumbOffsetY,
				skinSliderThumbSize: state.skinSliderThumbSize,
			}),

			merge: (persistedState, currentState) => {
				if (!persistedState) return currentState

				const persisted = persistedState as Partial<SkinStoreState>
				return {
					...currentState,
					...persisted,
					installedSkins: persisted.installedSkins ?? [],
					activeAvatarFrameIndex: persisted.activeAvatarFrameIndex ?? 0,
					activeLoadingIndex: persisted.activeLoadingIndex ?? 0,
					activePlayIconIndex: persisted.activePlayIconIndex ?? 0,
					activeSkinIndex: persisted.activeSkinIndex ?? 0,
					activeThumbUpIndex: persisted.activeThumbUpIndex ?? 0,
					playFullSkinBootSplashAnimation:
						persisted.playFullSkinBootSplashAnimation ?? false,
					selectedSkinBootSplashMode:
						persisted.selectedSkinBootSplashMode ?? 'poster',
					skinSliderThumbOffsetX: persisted.skinSliderThumbOffsetX ?? 0,
					skinSliderThumbOffsetY: persisted.skinSliderThumbOffsetY ?? 0,
					skinSliderThumbSize:
						persisted.skinSliderThumbSize ?? DEFAULT_SLIDER_THUMB_SIZE,
				}
			},
		},
	),
)

export default useSkinStore
