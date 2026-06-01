import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { InstalledSkin, InstalledSkinMeta } from '@/lib/theme/skins'
import { installedSkinToMeta } from '@/lib/theme/skins'
import { zustandStorage } from '@/utils/mmkv'

export type SkinBootSplashMode = 'poster' | 'video'

export interface SkinSettingsUpdate {
	activeSkinId?: string | null
	activeSkinIndex?: number
	playFullSkinBootSplashAnimation?: boolean
	selectedSkinBootSplashAssetId?: string | null
	selectedSkinBootSplashMode?: SkinBootSplashMode
	skinSliderThumbOffsetX?: number
	skinSliderThumbOffsetY?: number
	skinSliderThumbSize?: number
}

interface SkinStoreState {
	activeSkinId: string | null
	activeSkinIndex: number
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
			activeSkinId: null,
			activeSkinIndex: 0,
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
			version: 2,

			partialize: (state) => ({
				activeSkinId: state.activeSkinId,
				activeSkinIndex: state.activeSkinIndex,
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
					activeSkinIndex: persisted.activeSkinIndex ?? 0,
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
