import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { InstalledSkin } from '@/lib/theme/skins'
import { zustandStorage } from '@/utils/mmkv'

export type SkinBootSplashMode = 'poster' | 'video'

export interface SkinSettingsUpdate {
	activeSkinId?: string | null
	playFullSkinBootSplashAnimation?: boolean
	selectedSkinBootSplashAssetId?: string | null
	selectedSkinBootSplashMode?: SkinBootSplashMode
	skinSliderThumbOffsetX?: number
	skinSliderThumbOffsetY?: number
	skinSliderThumbSize?: number
}

interface SkinStoreState {
	activeSkinId: string | null
	addInstalledSkin: (skin: InstalledSkin) => void
	installedSkins: InstalledSkin[]
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
			installedSkins: [],
			playFullSkinBootSplashAnimation: false,
			selectedSkinBootSplashAssetId: null,
			selectedSkinBootSplashMode: 'poster',
			skinSliderThumbOffsetX: 0,
			skinSliderThumbOffsetY: 0,
			skinSliderThumbSize: DEFAULT_SLIDER_THUMB_SIZE,

			addInstalledSkin: (skin) => {
				set((state) => ({
					installedSkins: [
						skin,
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
			version: 1,

			partialize: (state) => ({
				activeSkinId: state.activeSkinId,
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
