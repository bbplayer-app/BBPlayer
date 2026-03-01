import { useMemo } from 'react'

import {
	useSharedPlaylistMembersStore,
	type SharedPlaylistMember,
} from '@/hooks/stores/useSharedPlaylistMembersStore'

export function useSharedPlaylistMembers(
	shareId?: string | null,
): SharedPlaylistMember[] {
	const members = useSharedPlaylistMembersStore((state) =>
		shareId ? state.membersByShareId[shareId] : undefined,
	)
	return useMemo(() => members ?? [], [members])
}

export type { SharedPlaylistMember }
