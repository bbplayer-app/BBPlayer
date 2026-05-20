import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { zustandStorage } from '@/utils/mmkv'

export type SharedPlaylistMember = {
	accountId: string
	name: string
	avatarUrl?: string | null
	role: 'owner' | 'editor'
}

const EMPTY: SharedPlaylistMember[] = []

interface SharedPlaylistMembersState {
	membersByShareId: Record<string, SharedPlaylistMember[]>
	setMembers: (shareId: string, members: SharedPlaylistMember[]) => void
	clearMembers: (shareId: string) => void
	clearAll: () => void
}

export const useSharedPlaylistMembersStore =
	create<SharedPlaylistMembersState>()(
		persist(
			immer((set) => ({
				membersByShareId: {},
				setMembers: (shareId, members) => {
					set((state) => {
						state.membersByShareId[shareId] = members
					})
				},
				clearMembers: (shareId) => {
					set((state) => {
						delete state.membersByShareId[shareId]
					})
				},
				clearAll: () => {
					set((state) => {
						state.membersByShareId = {}
					})
				},
			})),
			{
				name: 'shared-playlist-members',
				storage: createJSONStorage(() => zustandStorage),
			},
		),
	)

export const getSharedPlaylistMembers = (
	shareId: string | null | undefined,
): SharedPlaylistMember[] => {
	if (!shareId) return EMPTY
	return (
		useSharedPlaylistMembersStore.getState().membersByShareId[shareId] ?? EMPTY
	)
}

export const setSharedPlaylistMembers = (
	shareId: string,
	members: SharedPlaylistMember[],
): void => {
	useSharedPlaylistMembersStore.getState().setMembers(shareId, members)
}

export const clearSharedPlaylistMembers = (
	shareId: string | null | undefined,
): void => {
	if (!shareId) return
	useSharedPlaylistMembersStore.getState().clearMembers(shareId)
}

export const clearAllSharedPlaylistMembers = (): void => {
	useSharedPlaylistMembersStore.getState().clearAll()
}
