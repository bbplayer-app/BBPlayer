import type { LyricLine } from '@bbplayer/splash'
import { batch, observable, ObservableHint } from '@legendapp/state'

import { subtitleParagraphs } from '@/features/player/utils/subtitles'
import { seekWithinTrack } from '@/lib/player/seek'
import { toastAndLogError } from '@/utils/error-handling'

/** One reader session per track/subtitle source. Content stays immutable. */
export function createSubtitleReaderStore(
	lines: LyricLine[],
	trackId?: string,
	sourceKey = '',
) {
	const paragraphs = subtitleParagraphs(lines)
	const cueToParagraph = new Map<number, number>()
	const paragraphCue: Record<string, number> = {}
	for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
		paragraphCue[paragraph.id] = -1
		for (const { index } of paragraph.cues)
			cueToParagraph.set(index, paragraphIndex)
	}
	const content = ObservableHint.opaque({
		lines,
		paragraphs,
		cueToParagraph,
		sourceKey,
	})
	const searchText = paragraphs.map((paragraph) =>
		paragraph.content.toLocaleLowerCase(),
	)
	const state$ = observable({
		content,
		currentCue: -1,
		currentParagraphIndex: 0,
		paragraphCue,
		ready: false,
		following: true,
		followRevision: 0,
		searchVisible: false,
		search: '',
		query: '',
		// Keep the last results while hidden, so closing search does not rebuild them.
		searchResults: ObservableHint.opaque({
			paragraphs: [] as typeof paragraphs,
			query: '',
		}),
		focusedParagraphId: '',
		resultIndex: 0,
		visibleParagraphIds: [] as string[],
		visibleSearchParagraphIds: [] as string[],
	})
	const pauseFollowing = () => state$.following.set(false)
	const resumeFollowing = () => {
		batch(() => {
			state$.search.set('')
			state$.query.set('')
			state$.searchVisible.set(false)
			state$.following.set(true)
			state$.followRevision.set((revision) => revision + 1)
		})
	}
	return {
		content,
		state$,
		setCurrentCue: (index: number) => {
			if (index === state$.currentCue.peek()) return
			const previous = paragraphs[state$.currentParagraphIndex.peek()]
			const paragraphIndex = cueToParagraph.get(index) ?? 0
			const current = paragraphs[paragraphIndex]
			batch(() => {
				if (previous && previous !== current)
					state$.paragraphCue[previous.id].set(-1)
				if (current) state$.paragraphCue[current.id].set(index)
				state$.currentCue.set(index)
				state$.currentParagraphIndex.set(paragraphIndex)
				state$.ready.set(true)
			})
		},
		pauseFollowing,
		resumeFollowing,
		setVisibleParagraphs: (ids: string[], search: boolean) => {
			const target = search
				? state$.visibleSearchParagraphIds
				: state$.visibleParagraphIds
			const previous = target.peek()
			if (
				previous.length !== ids.length ||
				previous.some((id, index) => id !== ids[index])
			) {
				target.set(ids)
			}
		},
		openSearch: () => {
			batch(() => {
				pauseFollowing()
				state$.searchVisible.set(true)
			})
		},
		changeSearch: (value: string) => {
			const query = value.trim().toLocaleLowerCase()
			batch(() => {
				state$.search.set(value)
				if (query === state$.query.peek()) return
				state$.query.set(query)
				state$.resultIndex.set(0)
				if (!query) return
				const results = paragraphs.filter((_, index) =>
					searchText[index].includes(query),
				)
				state$.searchResults.set(
					ObservableHint.opaque({ paragraphs: results, query }),
				)
				state$.focusedParagraphId.set(results[0]?.id ?? '')
			})
		},
		navigateSearch: (direction: number) => {
			const { paragraphs: results } = state$.searchResults.peek()
			if (!state$.query.peek() || !results.length) return
			const next = Math.max(
				0,
				Math.min(results.length - 1, state$.resultIndex.peek() + direction),
			)
			batch(() => {
				state$.resultIndex.set(next)
				state$.focusedParagraphId.set(results[next].id)
			})
		},
		seek: async (index: number) => {
			const line = lines[index]
			if (!line || !trackId) return
			try {
				if ((await seekWithinTrack(trackId, line.startTime / 1000)) !== null) {
					resumeFollowing()
				}
			} catch (error) {
				toastAndLogError('字幕跳转失败', error, 'Player.Subtitles')
			}
		},
	}
}

export type SubtitleReaderStore = ReturnType<typeof createSubtitleReaderStore>
